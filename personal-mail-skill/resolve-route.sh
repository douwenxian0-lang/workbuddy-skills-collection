#!/usr/bin/env bash
# resolve-route.sh — personal-mail-skill 路由决策脚本
#
# 功能：确定性地决定邮件任务应路由到 agent-email 还是 imap-smtp-email，
#       替代之前不可靠的"提示词注入"方案。
#
# 输出：一行 JSON，LLM 按 next_skill 字段直接 read 对应 SKILL.md。
#   成功示例：
#     {"success":true,"next_skill":"agent-email","reason":"用户默认偏好为 qq_agent_mail"}
#     {"success":true,"next_skill":"imap-smtp-email","reason":"用户默认偏好为 qq_mail"}
#     {"success":true,"next_skill":"imap-smtp-email","reason":"未设置偏好，兜底路由"}
#   失败示例：
#     {"success":false,"next_skill":"imap-smtp-email","reason":"配置读取失败，兜底路由"}
#
# 用法：bash resolve-route.sh
#
# 环境变量（由 OpenClaw 运行时自动注入）：
#   QCLAW_PLUGIN_CONFIG_PATH — qclaw-plugin-config.json 的完整路径
#   AUTH_GATEWAY_PORT        — Auth Gateway 本地端口（默认 19000）
#   BUILD_ENV                — 环境标识（test = 测试环境）
set -euo pipefail

# ── 工具函数 ──

json_extract() {
  local json="$1"
  local path="$2"
  if command -v jq &>/dev/null; then
    echo "$json" | jq -r "$path" 2>/dev/null || echo "null"
  else
    echo "$json" | node -e "
const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const keys = '${path}'.replace(/^\./,'').split('.').filter(Boolean);
let val = data;
for (const k of keys) { val = val?.[k]; }
if (val === null || val === undefined) console.log('null');
else if (typeof val === 'object') console.log(JSON.stringify(val));
else console.log(val);
" 2>/dev/null || echo "null"
  fi
}

emit() {
  local success="$1"
  local next_skill="$2"
  local reason="$3"
  # 使用 node 输出规范 JSON，避免 bash 拼接时转义问题
  SUCCESS_VALUE="$success" NEXT_SKILL="$next_skill" REASON="$reason" node -e "
process.stdout.write(JSON.stringify({
  success: process.env.SUCCESS_VALUE === 'true',
  next_skill: process.env.NEXT_SKILL,
  reason: process.env.REASON
}) + '\n');
"
}

# ── 步骤 1：从 qclaw-plugin-config.json 读取默认邮箱偏好 ──

CONFIG_PATH="${QCLAW_PLUGIN_CONFIG_PATH:-}"
PROVIDER_ID=""
ADDRESS=""

if [[ -n "$CONFIG_PATH" && -f "$CONFIG_PATH" ]]; then
  config_content=$(cat "$CONFIG_PATH" 2>/dev/null || echo "{}")
  PROVIDER_ID=$(json_extract "$config_content" ".email.default.providerId" | tr -d '\r\n') || PROVIDER_ID=""
  ADDRESS=$(json_extract "$config_content" ".email.default.address" | tr -d '\r\n') || ADDRESS=""

  # 清理 null 值
  [[ "$PROVIDER_ID" == "null" ]] && PROVIDER_ID=""
  [[ "${ADDRESS:-}" == "null" ]] && ADDRESS=""
fi

# ── 步骤 2：如果有默认偏好，直接路由 ──

if [[ -n "$PROVIDER_ID" ]]; then
  if [[ "$PROVIDER_ID" == "qq_agent_mail" ]]; then
    emit true "agent-email" "用户默认偏好为 qq_agent_mail（Agent 邮箱${ADDRESS:+，地址 ${ADDRESS}}）"
    exit 0
  else
    emit true "imap-smtp-email" "用户默认偏好为 ${PROVIDER_ID}${ADDRESS:+（地址 ${ADDRESS}）}"
    exit 0
  fi
fi

# ── 步骤 3：无偏好 → 查 4230 接口看绑定情况 ──

if [ "${BUILD_ENV:-}" = "test" ]; then
  REMOTE_BASE_URL="https://jprx.sparta.html5.qq.com"
else
  REMOTE_BASE_URL="https://jprx.m.qq.com"
fi
PROXY_PORT="${AUTH_GATEWAY_PORT:-19000}"
PROXY_BASE_URL="http://localhost:${PROXY_PORT}"
REMOTE_URL="${REMOTE_BASE_URL}/data/4230/forward"

# 尝试查 4230，但失败时不阻塞——兜底路由到 imap-smtp-email（拦截层会处理）
set +e
tmp_body=$(mktemp)
HTTP_STATUS=$(curl -s -o "$tmp_body" -w "%{http_code}" \
  -X POST "${PROXY_BASE_URL}/proxy/api" \
  -H "Remote-URL: ${REMOTE_URL}" \
  -H "Content-Type: application/json" \
  -d '{}' \
  --connect-timeout 5 \
  --max-time 10)
CURL_EXIT=$?
set -e

if [[ $CURL_EXIT -ne 0 || "$HTTP_STATUS" != "200" ]]; then
  rm -f "$tmp_body"
  emit true "imap-smtp-email" "无法连接凭证服务（HTTP ${HTTP_STATUS:-timeout}），兜底路由到 imap-smtp-email"
  exit 0
fi

response=$(cat "$tmp_body")
rm -f "$tmp_body"

ret=$(json_extract "$response" ".ret" | tr -d '\r\n')
if [[ "$ret" != "0" ]]; then
  emit true "imap-smtp-email" "凭证服务返回异常（ret=${ret}），兜底路由到 imap-smtp-email"
  exit 0
fi

# 解析 4230 返回的 platforms 列表
# 4230 返回结构: { data: { resp: { data: { platforms: [{platform, is_enabled}...] } } } }
platforms_json=$(json_extract "$response" ".data.resp.data.platforms")
if [[ "$platforms_json" == "null" || -z "$platforms_json" ]]; then
  # 备选路径
  platforms_json=$(json_extract "$response" ".data.data.platforms")
fi
if [[ "$platforms_json" == "null" || -z "$platforms_json" ]]; then
  platforms_json=$(json_extract "$response" ".data.platforms")
fi

# 用 node 解析 platforms，统计已绑定的邮箱
ROUTE_RESULT=$(PLATFORMS_JSON="${platforms_json:-[]}" node -e "
const rawPlatforms = JSON.parse(process.env.PLATFORMS_JSON || '[]');
const allowed = new Set(['qq_agent_mail', '163_mail', 'qq_mail', 'gmail', 'outlook', 'sina_mail', 'sohu_mail']);
const bound = Array.isArray(rawPlatforms)
  ? rawPlatforms.filter(p => p.platform && allowed.has(p.platform) && p.is_enabled !== false)
  : [];
const count = bound.length;
const platforms = bound.map(p => p.platform);

if (count === 0) {
  // 没有绑定任何邮箱 → 路由到 imap-smtp-email（拦截层会弹绑定卡片）
  process.stdout.write(JSON.stringify({
    success: true,
    next_skill: 'imap-smtp-email',
    reason: '用户未绑定任何个人邮箱，路由到 imap-smtp-email（系统拦截层会引导绑定）'
  }) + '\n');
} else if (count === 1) {
  // 只绑了一个 → 直接用它
  const p = platforms[0];
  if (p === 'qq_agent_mail') {
    process.stdout.write(JSON.stringify({
      success: true,
      next_skill: 'agent-email',
      reason: '用户仅绑定了 Agent 邮箱（qq_agent_mail），自动路由'
    }) + '\n');
  } else {
    process.stdout.write(JSON.stringify({
      success: true,
      next_skill: 'imap-smtp-email',
      reason: '用户仅绑定了 ' + p + '，自动路由到 imap-smtp-email'
    }) + '\n');
  }
} else {
  // 绑了多个但没设偏好 → 路由到 imap-smtp-email（拦截层会弹选择卡片）
  process.stdout.write(JSON.stringify({
    success: true,
    next_skill: 'imap-smtp-email',
    reason: '用户绑定了多个邮箱（' + platforms.join(', ') + '）但未设置默认偏好，路由到 imap-smtp-email（系统拦截层会弹选择卡片）'
  }) + '\n');
}
" 2>/dev/null)

if [[ -n "$ROUTE_RESULT" ]]; then
  echo "$ROUTE_RESULT"
else
  emit true "imap-smtp-email" "路由计算异常，兜底路由到 imap-smtp-email"
fi

exit 0

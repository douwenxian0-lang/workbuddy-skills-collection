#!/usr/bin/env bash
# ============================================================================
# AIPPT Generate Script
# 通过 Auth Gateway 的 aippt 代理调用智绘高迪 Design Agent API
#
# Gateway 会等待上游 SSE 的 started 事件，提取 projectId 后返回 JSON：
#   { success, projectId, sessionIds, workspaceUrl, message }
# 脚本只需解析该 JSON 即可。
# ============================================================================

set -euo pipefail

# ── 参数校验 ──────────────────────────────────────────────────────────────
# 支持三种入参方式（优先级从高到低，UTF-8 安全）：
#   1) PROMPT_FILE: 指向一个 UTF-8 编码的文本文件，命令行只传 ASCII 路径，最稳
#   2) PROMPT_B64 : base64(UTF-8 字节)，命令行也是纯 ASCII
#   3) PROMPT     : 直接传字符串（macOS/Linux 上 UTF-8 没问题，Windows 慎用）
if [ -n "${PROMPT_FILE:-}" ]; then
  if [ ! -f "$PROMPT_FILE" ]; then
    echo "❌ 错误: PROMPT_FILE 指向的文件不存在: $PROMPT_FILE" >&2
    exit 1
  fi
  PROMPT=$(cat "$PROMPT_FILE")
  export PROMPT
elif [ -n "${PROMPT_B64:-}" ]; then
  PROMPT=$(printf '%s' "$PROMPT_B64" | base64 -d 2>/dev/null) || {
    echo "❌ 错误: PROMPT_B64 解码失败" >&2
    exit 1
  }
  export PROMPT
fi

if [ -z "${PROMPT:-}" ]; then
  echo "❌ 错误: 缺少 PROMPT/PROMPT_FILE/PROMPT_B64" >&2
  echo "推荐用法（UTF-8 安全）:" >&2
  echo "  PROMPT_FILE=/tmp/prompt.txt bash $0" >&2
  echo "  PROMPT_B64=\"\$(printf '%s' '描述' | base64)\" bash $0" >&2
  exit 1
fi

# ── 推导 Auth Gateway aippt 代理地址 ──────────────────────────────────────
# QCLAW_LLM_BASE_URL 格式: http://127.0.0.1:{port}/proxy/llm
# 替换 /llm 为 /aippt/agent/run
if [ -z "${QCLAW_LLM_BASE_URL:-}" ]; then
  echo "❌ 错误: QCLAW_LLM_BASE_URL 未设置" >&2
  exit 1
fi

AUTH_GW_BASE="${QCLAW_LLM_BASE_URL%/llm}"
AIPPT_URL="${AUTH_GW_BASE}/aippt/agent/run"

# ── 构建请求 body ────────────────────────────────────────────────────────
# Gateway handler 会自动注入 customModelProvider（含 apiKey 与 modelId）和 createProject
# Skill 脚本负责传业务字段：prompt + taskAgentType（v2）+ num
BODY=$(python3 -c '
import json, os

body = {
    "prompt": os.environ["PROMPT"],
    "taskAgentType": "ppt_v2",
    "num": 1,
}

print(json.dumps(body, ensure_ascii=False))
')

# ── 获取 API Key（通过 4164 凭证托管接口）──────────────────────────────
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AIPPT_API_KEY=""

if [ -f "${SKILL_DIR}/get-token.sh" ]; then
  AIPPT_API_KEY=$(bash "${SKILL_DIR}/get-token.sh" 2>/dev/null) || true
fi

if [ -z "$AIPPT_API_KEY" ]; then
  echo "❌ 错误: 未获取到 AIPPT API Key，请先在集成面板中完成授权" >&2
  exit 1
fi

echo "📝 开始生成 PPT..."
echo ""

# ── 调用 aippt 代理 ──────────────────────────────────────────────────────
# Gateway 内部处理 SSE，收到 started 事件后返回 JSON 响应
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

HTTP_CODE=$(curl -s -w "%{http_code}" -o "$TMPFILE" \
  -X POST "${AIPPT_URL}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${QCLAW_LLM_API_KEY:-__QCLAW_AUTH_GATEWAY_MANAGED__}" \
  -H "X-API-Key: ${AIPPT_API_KEY}" \
  -H "X-Platform: qclaw" \
  -d "$BODY" \
  --max-time 300)

RESPONSE=$(cat "$TMPFILE")

if [ "$HTTP_CODE" -ne 200 ]; then
  echo "❌ API 请求失败 (HTTP ${HTTP_CODE}):" >&2
  echo "$RESPONSE" >&2
  exit 1
fi

# ── 解析 JSON 响应 ────────────────────────────────────────────────────────
SUCCESS=$(python3 -c "
import json, sys
try:
    d = json.loads(sys.argv[1])
    print('true' if d.get('success') else 'false')
except:
    print('false')
" "$RESPONSE" 2>/dev/null || echo "false")

if [ "$SUCCESS" != "true" ]; then
  echo "❌ 生成失败:" >&2
  echo "$RESPONSE" >&2
  exit 1
fi

# 提取关键字段
# 注意：v2 协议会用 sessionId 驱动后续 poll / resume-interrupt 流程
# Gateway handler 透传上游 started 事件的 sessionIds 数组（v1 字段），
# 也兼容上游可能改成单数 sessionId 的情况；这里两者都尝试。
RESULT=$(python3 -c "
import json, sys
d = json.loads(sys.argv[1])
session_id = d.get('sessionId', '') or ''
if not session_id:
    sids = d.get('sessionIds') or []
    if isinstance(sids, list) and sids:
        session_id = sids[0] or ''
print(json.dumps({
    'projectId': d.get('projectId', ''),
    'sessionId': session_id,
    'workspaceUrl': d.get('workspaceUrl', ''),
    'message': d.get('message', ''),
}, indent=2, ensure_ascii=False))
" "$RESPONSE" 2>/dev/null)

PROJECT_ID=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('projectId',''))" "$RESPONSE" 2>/dev/null || echo "")
WORKSPACE_URL=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('workspaceUrl',''))" "$RESPONSE" 2>/dev/null || echo "")
SESSION_ID=$(python3 -c "
import json, sys
d = json.loads(sys.argv[1])
sid = d.get('sessionId', '') or ''
if not sid:
    sids = d.get('sessionIds') or []
    if isinstance(sids, list) and sids:
        sid = sids[0] or ''
print(sid)
" "$RESPONSE" 2>/dev/null || echo "")

# 兜底拼上 ?from=qclaw 渠道标识（用于平台侧统计 / 前端适配）
if [ -n "$WORKSPACE_URL" ] && [[ "$WORKSPACE_URL" != *"from=qclaw"* ]]; then
  if [[ "$WORKSPACE_URL" == *"?"* ]]; then
    WORKSPACE_URL="${WORKSPACE_URL}&from=qclaw"
  else
    WORKSPACE_URL="${WORKSPACE_URL}?from=qclaw"
  fi
fi

# 同步把 RESULT 里的 workspaceUrl 也修正
RESULT=$(python3 -c "
import json, sys
d = json.loads(sys.argv[1])
session_id = d.get('sessionId', '') or ''
if not session_id:
    sids = d.get('sessionIds') or []
    if isinstance(sids, list) and sids:
        session_id = sids[0] or ''
print(json.dumps({
    'projectId': d.get('projectId', ''),
    'sessionId': session_id,
    'workspaceUrl': sys.argv[2],
    'message': d.get('message', ''),
}, indent=2, ensure_ascii=False))
" "$RESPONSE" "$WORKSPACE_URL" 2>/dev/null)

echo "🚀 任务已启动，PPT 正在后台生成中"
echo ""
echo "✅ PPT 生成任务已提交！"
echo ""
echo "结果："
echo "$RESULT"
echo ""
if [ -n "$WORKSPACE_URL" ]; then
  echo "📊 编辑地址: ${WORKSPACE_URL}"
fi
if [ -n "$SESSION_ID" ]; then
  echo "🔑 sessionId: ${SESSION_ID}（用于 poll / resume）"
else
  echo "⚠️  未能从响应中提取 sessionId，后续轮询/恢复流程将无法继续" >&2
fi

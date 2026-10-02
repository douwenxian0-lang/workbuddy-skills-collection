#!/usr/bin/env bash
# ============================================================================
# AIPPT Resume Script
# 调用智绘高迪 Design Agent v2 resume-interrupt 接口提交用户答复。
#
# 直连上游 https://api.zhihui.qq.com/bll-design-agent/agent/resume-interrupt
# 鉴权头由 skill 自行组装：
#   X-API-Key  ← 通过 ../get-token.sh 从 4164 凭证服务拉取
#   X-Platform ← 常量 "qclaw"
#
# Action 透传设计：
#   ACTION_JSON 由上层 Agent（LLM）根据 SKILL.md 三种 interrupt 模板组装好，
#   本脚本只负责把它包到 { sessionId, interruptId, action } 外层后转发。
#
# 输出：上游原始 JSON（非 200 时进 stderr + exit != 0）
#
# 用法：
#   SESSION_ID=xxx \
#   INTERRUPT_ID=yyy \
#   ACTION_JSON='{"type":"submit","params":{"answers":{...}}}' \
#     bash __SKILL_DIR__/scripts/resume.sh
# ============================================================================

set -euo pipefail

# ── 参数校验 ──────────────────────────────────────────────────────────────
if [ -z "${SESSION_ID:-}" ]; then
  echo "❌ 错误: 缺少 SESSION_ID 环境变量" >&2
  exit 1
fi

if [ -z "${INTERRUPT_ID:-}" ]; then
  echo "❌ 错误: 缺少 INTERRUPT_ID 环境变量" >&2
  exit 1
fi

# ACTION 入参支持三种方式（优先级从高到低，UTF-8 安全）：
#   1) ACTION_FILE: 指向一个 UTF-8 JSON 文件，命令行只传 ASCII 路径，最稳
#   2) ACTION_B64 : base64(UTF-8 JSON 字节)，命令行也是纯 ASCII
#   3) ACTION_JSON: 直接传 JSON 字符串（macOS/Linux 上 OK，Windows 慎用）
if [ -n "${ACTION_FILE:-}" ]; then
  if [ ! -f "$ACTION_FILE" ]; then
    echo "❌ 错误: ACTION_FILE 指向的文件不存在: $ACTION_FILE" >&2
    exit 1
  fi
  ACTION_JSON=$(cat "$ACTION_FILE")
  export ACTION_JSON
elif [ -n "${ACTION_B64:-}" ]; then
  ACTION_JSON=$(printf '%s' "$ACTION_B64" | base64 -d 2>/dev/null) || {
    echo "❌ 错误: ACTION_B64 解码失败" >&2
    exit 1
  }
  export ACTION_JSON
fi

if [ -z "${ACTION_JSON:-}" ]; then
  echo "❌ 错误: 缺少 ACTION_JSON/ACTION_FILE/ACTION_B64（应为 { type, params? } 形式的 JSON）" >&2
  exit 1
fi

# ── 取上游鉴权 token ──────────────────────────────────────────────────────
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AIPPT_API_KEY=""

if [ -f "${SKILL_DIR}/get-token.sh" ]; then
  AIPPT_API_KEY=$(bash "${SKILL_DIR}/get-token.sh" 2>/dev/null) || true
fi

if [ -z "$AIPPT_API_KEY" ]; then
  echo "❌ 错误: 未获取到 AIPPT API Key，请先在集成面板中完成授权" >&2
  exit 1
fi

# ── 用 python3 拼最外层 body（避免 shell 字符串转义问题） ─────────────────
BODY=$(python3 -c '
import json, os, sys

# 严格校验 ACTION_JSON 是合法 JSON 对象
try:
    action = json.loads(os.environ["ACTION_JSON"])
except Exception as e:
    print(f"ACTION_JSON not valid JSON: {e}", file=sys.stderr)
    sys.exit(1)

if not isinstance(action, dict) or not action.get("type"):
    print("ACTION_JSON must be an object with a non-empty \"type\" field", file=sys.stderr)
    sys.exit(1)

body = {
    "sessionId": os.environ["SESSION_ID"],
    "interruptId": os.environ["INTERRUPT_ID"],
    "action": action,
}
print(json.dumps(body, ensure_ascii=False))
')

if [ -z "$BODY" ]; then
  echo "❌ 错误: 请求 body 拼装失败" >&2
  exit 1
fi

# ── 调用上游 resume-interrupt 接口 ────────────────────────────────────────
UPSTREAM="https://api.zhihui.qq.com/bll-design-agent/agent/resume-interrupt"

TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

HTTP_CODE=$(curl -s -w "%{http_code}" -o "$TMPFILE" \
  -X POST "$UPSTREAM" \
  -H "Content-Type: application/json; charset=utf-8" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer ${AIPPT_API_KEY}" \
  -H "X-API-Key: ${AIPPT_API_KEY}" \
  -H "X-Platform: qclaw" \
  -d "$BODY" \
  --max-time 30)

RESPONSE=$(cat "$TMPFILE")

if [ "$HTTP_CODE" -ne 200 ]; then
  echo "❌ resume-interrupt 请求失败 (HTTP ${HTTP_CODE}):" >&2
  echo "$RESPONSE" >&2
  exit 1
fi

# 直接透传上游 JSON（如 { accepted: true, ... }）给上层 Agent 解析
echo "$RESPONSE"

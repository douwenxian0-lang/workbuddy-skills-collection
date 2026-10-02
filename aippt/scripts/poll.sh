#!/usr/bin/env bash
# ============================================================================
# AIPPT Poll Script
# 调用智绘高迪 Design Agent v2 events 接口查询当前会话状态。
#
# 直连上游 https://api.zhihui.qq.com/bll-design-agent/agent/events
# 鉴权头由 skill 自行组装：
#   X-API-Key  ← 通过 ../get-token.sh 从 4164 凭证服务拉取
#   X-Platform ← 常量 "qclaw"
#
# 输出：上游原始 JSON（非 200 时进 stderr + exit != 0）
#
# 用法：
#   SESSION_ID=xxx bash __SKILL_DIR__/scripts/poll.sh
# ============================================================================

set -euo pipefail

# ── 参数校验 ──────────────────────────────────────────────────────────────
if [ -z "${SESSION_ID:-}" ]; then
  echo "❌ 错误: 缺少 SESSION_ID 环境变量" >&2
  echo "用法: SESSION_ID=<sessionId> bash $0" >&2
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

# ── 调用上游 events 接口 ─────────────────────────────────────────────────
UPSTREAM="https://api.zhihui.qq.com/bll-design-agent/agent/events?sessionId=${SESSION_ID}"

TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

HTTP_CODE=$(curl -s -w "%{http_code}" -o "$TMPFILE" \
  -X GET "$UPSTREAM" \
  -H "Authorization: Bearer ${AIPPT_API_KEY}" \
  -H "X-API-Key: ${AIPPT_API_KEY}" \
  -H "X-Platform: qclaw" \
  -H "Accept: application/json" \
  --max-time 30)

RESPONSE=$(cat "$TMPFILE")

if [ "$HTTP_CODE" -ne 200 ]; then
  echo "❌ events 请求失败 (HTTP ${HTTP_CODE}):" >&2
  echo "$RESPONSE" >&2
  exit 1
fi

# ── 配色卡 base64 落盘：避免 LLM 流式吐 base64 ──────────────────────────
# 若上游返回 pptIntakeStyleCards interrupt，把每张卡片的 previewBase64 解码
# 写到 __SKILL_DIR__/.tmp/style-{candidateId}.png，并把 JSON 里的 previewBase64
# 字段替换成 previewPath（本地绝对路径），让上层 Agent 输出短路径而非长 base64。
TMPDIR_STYLE="${SKILL_DIR}/.tmp"
mkdir -p "$TMPDIR_STYLE"

RESPONSE=$(python3 - "$RESPONSE" "$TMPDIR_STYLE" <<'PYEOF'
import sys, json, base64, os, pathlib

raw = sys.argv[1]
tmpdir = sys.argv[2]

try:
    obj = json.loads(raw)
except Exception:
    # 非 JSON 直接透传
    print(raw, end='')
    sys.exit(0)

interrupt = (obj.get('data') or {}).get('interrupt') or {}
if interrupt.get('type') == 'pptIntakeStyleCards':
    cards = ((interrupt.get('data') or {}).get('styleCards')) or []
    for card in cards:
        b64 = card.get('previewBase64')
        cid = card.get('candidateId') or 'unknown'
        if not b64:
            continue
        # 清掉可能的 data: 前缀
        if ',' in b64 and b64.lstrip().startswith('data:'):
            b64 = b64.split(',', 1)[1]
        try:
            png_bytes = base64.b64decode(b64)
        except Exception:
            continue
        # candidateId 一般形如 c_0 / c_1，但仍做安全过滤
        safe_cid = ''.join(ch for ch in str(cid) if ch.isalnum() or ch in ('_', '-'))
        path = pathlib.Path(tmpdir) / f'style-{safe_cid}.png'
        try:
            path.write_bytes(png_bytes)
            card['previewPath'] = str(path.resolve())
            # 删掉超长字段，避免 LLM 流式吐 base64
            card.pop('previewBase64', None)
        except Exception:
            # 写盘失败时保留原 base64 字段作为兜底
            pass

print(json.dumps(obj, ensure_ascii=False))
PYEOF
)

# 直接透传上游 JSON（含 data.state / data.interrupt）给上层 Agent 解析
echo "$RESPONSE"

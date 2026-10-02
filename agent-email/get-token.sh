#!/usr/bin/env bash
# get-token.sh — 从凭证网关 4164 接口获取 QQ Agent 邮箱 access_token 并写入 agent-email/.env
#
# 用法：
#   bash get-token.sh                      # 从凭证服务自动拉取（platform=qq_agent_mail）
#   bash get-token.sh --token <ak>         # 手动指定 token（仅排障）
#
# 输出：
#   stdout: 一行 JSON，{ success, message, env_path?, email?, error_code? }
#   .env:   写入 AGENTLY_ACCESS_TOKEN / AGENTLY_EMAIL / AGENTLY_BASE_URL
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SKILL_DIR}/.env"

PLATFORM="qq_agent_mail"
TOKEN=""
EMAIL=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --token) [[ $# -lt 2 ]] && { echo "错误: --token 需要提供值" >&2; exit 1; }; TOKEN="$2"; shift 2 ;;
    --email) [[ $# -lt 2 ]] && { echo "错误: --email 需要提供值" >&2; exit 1; }; EMAIL="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# BUILD_ENV=test 时走测试环境，其他情况走现网
if [ "${BUILD_ENV:-}" = "test" ]; then
  REMOTE_BASE_URL="https://jprx.sparta.html5.qq.com"
else
  REMOTE_BASE_URL="https://jprx.m.qq.com"
fi
PROXY_PORT="${AUTH_GATEWAY_PORT:-19000}"
PROXY_BASE_URL="http://localhost:${PROXY_PORT}"
REMOTE_URL="${REMOTE_BASE_URL}/data/4164/forward"
AGENTLY_BASE_URL="${AGENTLY_BASE_URL:-https://api.agent.qq.com}"

emit_json() {
  local success="$1"
  local error_code="$2"
  local message="$3"
  local extra_json="${4:-{}}"
  SUCCESS_VALUE="$success" ERROR_CODE_VALUE="$error_code" MESSAGE_VALUE="$message" EXTRA_JSON_VALUE="$extra_json" node - <<'NODE'
const rawExtra = String(process.env.EXTRA_JSON_VALUE || '{}').trim();
let extra;
try {
  extra = JSON.parse(rawExtra);
} catch (error) {
  if (rawExtra.endsWith('}}')) {
    extra = JSON.parse(rawExtra.slice(0, -1));
  } else {
    throw error;
  }
}
const payload = {
  success: process.env.SUCCESS_VALUE === 'true',
  message: process.env.MESSAGE_VALUE || '',
  ...extra,
};
if (process.env.ERROR_CODE_VALUE !== '') {
  payload.error_code = Number(process.env.ERROR_CODE_VALUE);
}
process.stdout.write(`${JSON.stringify(payload)}\n`);
NODE
}

json_extract() {
  local json="$1"
  local path="$2"

  if command -v jq &>/dev/null; then
    echo "$json" | jq -r "$path"
  else
    local node_path
    node_path=$(echo "$path" | node -e "
const p = require('fs').readFileSync('/dev/stdin','utf8').trim();
if (p === '.') { process.stdout.write(''); process.exit(0); }
const parts = p.replace(/^\./, '').split('.');
process.stdout.write(parts.map(k => '[\"' + k + '\"]').join(''));
")
    echo "$json" | node -e "
const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const val = data${node_path};
if (val === null || val === undefined) console.log('null');
else if (typeof val === 'object') console.log(JSON.stringify(val));
else console.log(val);
"
  fi
}

write_env() {
  local email_address="$1"
  local access_token="$2"
  local token_source="$3"
  cat > "$ENV_FILE" <<EOF
# QQ Agent Mail Configuration
AGENTLY_BASE_URL=${AGENTLY_BASE_URL}
AGENTLY_ACCESS_TOKEN=${access_token}
AGENTLY_EMAIL=${email_address}

# File access whitelist
ALLOWED_READ_DIRS=$HOME/Downloads,$HOME/Documents
ALLOWED_WRITE_DIRS=$HOME/Downloads

# Token source (used to decide whether runtime auto-refresh may overwrite this file)
TOKEN_SOURCE=${token_source}
EOF
  chmod 600 "$ENV_FILE"
}

# ── 模式一：手动指定 token（仅排障）──
if [[ -n "$TOKEN" ]]; then
  if [[ "$TOKEN" =~ [[:space:]] ]]; then
    emit_json false 1 "授权码不能包含空格或换行符" "{\"mode\":\"manual-token\"}"
    exit 1
  fi
  if [[ -n "$EMAIL" && "$EMAIL" != *@* ]]; then
    emit_json false 1 "邮箱地址格式无效" "{\"mode\":\"manual-token\"}"
    exit 1
  fi
  EMAIL=$(echo "$EMAIL" | tr -d '[:space:]')
  write_env "${EMAIL:-unknown@agent.qq.com}" "$TOKEN" "manual_token"
  emit_json true "" "已写入 Agent 邮箱凭证" "{\"env_path\":\"${ENV_FILE}\",\"mode\":\"manual-token\",\"email\":\"${EMAIL}\"}"
  exit 0
fi

# ── 模式二：从凭证网关 4164 拉取（platform=qq_agent_mail）──
BODY="{\"platform\":\"${PLATFORM}\"}"
tmp_body=$(mktemp)
set +e
HTTP_STATUS=$(curl -s -o "$tmp_body" -w "%{http_code}" \
  -X POST "${PROXY_BASE_URL}/proxy/api" \
  -H "Remote-URL: ${REMOTE_URL}" \
  -H "Content-Type: application/json" \
  -d "$BODY")
CURL_EXIT=$?
set -e
response=$(cat "$tmp_body")
rm -f "$tmp_body"

if [[ $CURL_EXIT -ne 0 ]]; then
  emit_json false 999 "请求凭证服务失败，请检查本地代理或登录态。" "{\"platform\":\"${PLATFORM}\",\"mode\":\"credential-service\"}"
  exit 1
fi
if [[ "$HTTP_STATUS" != "200" ]]; then
  emit_json false 999 "凭证服务 HTTP 请求失败，状态码: ${HTTP_STATUS}" "{\"platform\":\"${PLATFORM}\",\"mode\":\"credential-service\"}"
  exit 1
fi

ret=$(json_extract "$response" '.ret' | tr -d '\r')
if [[ "$ret" != "0" ]]; then
  emit_json false 999 "凭证服务网关返回异常，ret=${ret}" "{\"platform\":\"${PLATFORM}\",\"mode\":\"credential-service\"}"
  exit 1
fi

common_code=$(json_extract "$response" '.data.resp.common.code' | tr -d '\r')
common_message=$(json_extract "$response" '.data.resp.common.message' | tr -d '\r')
if [[ -z "$common_code" || "$common_code" == "null" ]]; then
  common_code="999"
fi
if [[ "$common_code" != "0" ]]; then
  emit_json false "$common_code" "${common_message:-凭证服务返回失败，请确认已在集成面板授权 Agent 邮箱}" "{\"platform\":\"${PLATFORM}\",\"mode\":\"credential-service\"}"
  exit 1
fi

access_token=$(json_extract "$response" '.data.resp.data.access_token' | tr -d '\r')
email_address=$(json_extract "$response" '.data.resp.data.extra_data.email_address' | tr -d '\r')
if [[ -z "$access_token" || "$access_token" == "null" ]]; then
  emit_json false 3 "凭证服务未返回可用的 Agent 邮箱授权码" "{\"platform\":\"${PLATFORM}\",\"mode\":\"credential-service\"}"
  exit 1
fi
if [[ -z "$email_address" || "$email_address" == "null" ]]; then
  email_address="unknown@agent.qq.com"
fi

write_env "$email_address" "$access_token" "credential_service"
emit_json true "" "已从凭证服务刷新 Agent 邮箱凭证" "{\"env_path\":\"${ENV_FILE}\",\"mode\":\"credential-service\",\"platform\":\"${PLATFORM}\",\"email\":\"${email_address}\"}"
exit 0

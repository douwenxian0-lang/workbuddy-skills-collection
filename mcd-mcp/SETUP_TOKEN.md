# 麦当劳 MCP Token 初始化

本 Skill 通过凭证托管服务自动获取 MCP Token，无需用户手动配置。

## Token 获取流程

1. 用户在 QClaw 集成面板中完成麦当劳授权
2. Skill 每次需要 Token 时通过 `get-token.sh` / `get-token.ps1` 实时获取
3. Token 通过本地 Auth Gateway 代理请求 4164 接口，自动注入 JWT 认证

## 环境要求

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `AUTH_GATEWAY_PORT` | 本地凭证代理端口 | `19000` |
| `CREDENTIAL_PLATFORM` | 凭证平台标识 | `mcdonald` |
| `BUILD_ENV` | 环境（test / production） | — |

## 脚本说明

| 脚本 | 平台 | 用法 |
|------|------|------|
| `get-token.sh` | macOS / Linux | `token=$(bash "${SKILL_DIR}/get-token.sh")` |
| `get-token.ps1` | Windows | `$token = & "${SKILL_DIR}\get-token.ps1"` |

## 错误处理

脚本执行失败（exit code ≠ 0）时，说明用户尚未完成麦当劳授权，需引导用户在集成面板中完成授权。

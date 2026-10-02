# 同程程心 Token 初始化说明

## 概述

同程程心 Skill 通过凭证托管服务（credential-hosted）管理 Token。用户在QClaw 集成面板中完成OAuth 授权后，Token 由后端自动管理，Skill 通过本地脚本获取。

## 获取 Token

### macOS / Linux

```bash
TOKEN=$(bash "${SKILL_DIR}/get-token.sh")
```

### Windows

```powershell
$token = & "${SKILL_DIR}\get-token.ps1"
```

## 使用方式

获取到的 Token 作为 API Key 使用：

```bash
# 环境变量方式
export CHENGXIN_API_KEY="$TOKEN"

# 或直接在请求中使用
curl -H "Authorization: Bearer $TOKEN" https://api.example.com/...
```

## 注意事项

- 每次调用必须重新获取 Token（不缓存、不复用）
- Token 有效期30 天，脚本会自动获取最新有效 Token
- 若 API 返回 401 错误，重新执行脚本获取新 Token
- 脚本执行失败时（exit code ≠ 0），提示用户在集成面板中完成授权

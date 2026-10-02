# QQ音乐 Token 初始化说明

## 概述

本 Skill 通过 QClaw 的凭证托管服务（credential-hosted）获取 QQ音乐 API Key，无需用户手动配置环境变量。

## 工作原理

1. 用户在 QClaw 集成面板中完成 QQ音乐授权（输入从 [QQ音乐技能页](https://y.qq.com/n/ryqq_v2/qqmusic_skills) 获取的授权码）
2. 授权码通过后端凭证托管服务存储
3. Skill 运行时通过 `get-token.sh`（macOS/Linux）或 `get-token.ps1`（Windows）实时获取 Token
4. Token 作为 `Authorization: Bearer` header 传入 API 调用

## 使用方式

### macOS / Linux

```bash
QQMUSIC_API_KEY=$(bash "${SKILL_DIR}/get-token.sh")
```

### Windows

```powershell
$token = & "${SKILL_DIR}\get-token.ps1"
```

## 注意事项

- Token 长期有效，但每次调用仍建议重新获取以确保最新
- 若 API 返回 401 错误，重新执行脚本获取新 Token
- 脚本失败时（exit code ≠ 0），提示用户在集成面板中完成 QQ音乐授权

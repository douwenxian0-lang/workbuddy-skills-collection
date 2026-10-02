# Token 初始化说明 — 百度地图连接器

## 概述

百度地图连接器使用凭证托管服务管理用户的 SK (Service Key)。Skill 运行时通过 `get-token.sh`（macOS/Linux）或 `get-token.ps1`（Windows）动态获取 Token，无需用户手动配置环境变量。

## 使用方式

### macOS / Linux

在执行任何百度地图 API 调用之前，先获取 Token：

```bash
TOKEN=$(bash "${SKILL_DIR}/get-token.sh")
```

然后在 API 请求中使用：

```bash
curl --get "https://api.map.baidu.com/agent_plan/v1/place" \
  -H "Authorization: Bearer ${TOKEN}" \
  --data-urlencode "user_raw_request=帮我查北京可带宠物的咖啡馆" \
  --data-urlencode "region=北京市"
```

### Windows (PowerShell)

```powershell
$token = & "${SKILL_DIR}\get-token.ps1"
$headers = @{ "Authorization" = "Bearer $token" }
```

## 注意事项

1. **每次调用必须重新获取 Token** — 不缓存、不复用
2. **禁止明文打印 Token** — 不要在终端输出 Token 值
3. **Token 由凭证托管服务管理** — 用户在集成面板完成授权后，Token 自动可用
4. **授权有效期**：永久（permanent） — 除非用户主动断开连接
5. **Token 获取失败时**：提示用户在集成面板中完成百度地图授权

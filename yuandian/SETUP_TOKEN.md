# Token 初始化 — 元典智库连接器

> `get-token.sh` / `get-token.ps1` 与本文件位于同一目录下。
> 执行前将 `<SCRIPT_PATH>` 替换为本文件所在目录的绝对路径。

## 概述

元典智库通过 3 个原生 HTTP MCP server 提供能力：

| MCP 服务名 | URL | 用途 |
|------------|-----|------|
| `yuandian-law` | `https://open.chineselaw.com/mcp/law/stream` | 法律法规检索、效力校验 |
| `yuandian-case` | `https://open.chineselaw.com/mcp/case/stream` | 司法案例、判决文书、诉讼记录 |
| `yuandian-company` | `https://open.chineselaw.com/mcp/company/stream` | 工商信息、股权结构、企业全景 |

API Key 由 QClaw 凭证托管服务管理。Skill 运行时通过 `get-token.sh`（macOS/Linux）或 `get-token.ps1`（Windows）动态获取 API Key，并写入 mcporter 配置，**无需用户手动配置环境变量**。

## 重要：每次会话开始时自动注入 API Key 到 mcporter

由于每次命令执行都是独立的 shell 进程，且 mcporter 配置一旦写入即对后续命令永久生效（按 `--scope home`），**必须在会话开始时一次性获取 API Key 并将 3 个 MCP server 注册到 mcporter**。

### macOS / Linux

```bash
# ✅ 会话开始时：获取 API Key 并注册 3 个 MCP server
api_key=$(bash '<SCRIPT_PATH>/get-token.sh') && \
mcporter config remove yuandian-law 2>/dev/null; \
mcporter config remove yuandian-case 2>/dev/null; \
mcporter config remove yuandian-company 2>/dev/null; \
mcporter config add yuandian-law "https://open.chineselaw.com/mcp/law/stream" \
  --header "Authorization=Bearer $api_key" \
  --header "Accept=application/json, text/event-stream" \
  --transport http --scope home && \
mcporter config add yuandian-case "https://open.chineselaw.com/mcp/case/stream" \
  --header "Authorization=Bearer $api_key" \
  --header "Accept=application/json, text/event-stream" \
  --transport http --scope home && \
mcporter config add yuandian-company "https://open.chineselaw.com/mcp/company/stream" \
  --header "Authorization=Bearer $api_key" \
  --header "Accept=application/json, text/event-stream" \
  --transport http --scope home
```

### Windows (PowerShell)

```powershell
# ✅ 会话开始时：获取 API Key 并注册 3 个 MCP server
$apiKey = & "<SCRIPT_PATH>\get-token.ps1"

mcporter config remove yuandian-law 2>$null
mcporter config remove yuandian-case 2>$null
mcporter config remove yuandian-company 2>$null

mcporter config add yuandian-law "https://open.chineselaw.com/mcp/law/stream" `
  --header "Authorization=Bearer $apiKey" `
  --header "Accept=application/json, text/event-stream" `
  --transport http --scope home

mcporter config add yuandian-case "https://open.chineselaw.com/mcp/case/stream" `
  --header "Authorization=Bearer $apiKey" `
  --header "Accept=application/json, text/event-stream" `
  --transport http --scope home

mcporter config add yuandian-company "https://open.chineselaw.com/mcp/company/stream" `
  --header "Authorization=Bearer $apiKey" `
  --header "Accept=application/json, text/event-stream" `
  --transport http --scope home
```

注入完成后，同一会话内可直接调用：

```bash
mcporter list yuandian-law --schema
mcporter call yuandian-company.<tool_name> --args '{...}'
```

## 注意事项

1. **每次会话开始都需重新执行注入**：mcporter 配置写入到 `~/.mcporter/`（home scope），但 API Key 可能由凭证服务轮换，应每次会话用最新 token 覆盖
2. **禁止明文打印 API Key**：上述命令中的 `$api_key` 不要 echo 出来，注入完毕直接进入业务调用
3. **API Key 由凭证托管服务管理**：用户在集成面板完成授权后，token 自动可用
4. **授权有效期**：永久（permanent）— 除非用户主动断开连接
5. **Token 获取失败时**：提示用户在集成面板中完成元典智库授权（不要引导用户去 https://open.chineselaw.com/ 手动取 Key 后填入命令）

## 失败处理

如果 `get-token.sh` 输出 `ERROR` 或返回空值：

- 用户尚未在**应用内集成面板**中完成元典智库授权
- 请提示用户：在集成面板中点击「元典智库」→ 输入 API Key → 完成授权，然后重试
- API Key 获取地址：**https://open.chineselaw.com/**

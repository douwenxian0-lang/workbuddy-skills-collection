# Token 初始化 — 企查查连接器

> `get-token.sh` / `get-token.ps1` 与本文件位于同一目录下。
> 执行前将 `<SCRIPT_PATH>` 替换为本文件所在目录的绝对路径。

## 概述

企查查通过 1 个原生 HTTP MCP server 提供能力：

| MCP 服务名 | URL | 用途 |
|------------|-----|------|
| `qcc-company` | `https://agent.qcc.com/mcp/company/stream` | 企业工商信息、股权结构、高管人员、财务数据、对外投资、历史变更、上市信息、分支机构、联系方式、开票信息 |

API Key 由 QClaw 凭证托管服务管理。Skill 运行时通过 `get-token.sh`（macOS/Linux）或 `get-token.ps1`（Windows）动态获取 API Key，并写入 mcporter 配置，**无需用户手动配置环境变量**。

## 初始化流程（智能判断，避免重复配置）

mcporter 配置写入 `~/.mcporter/`（home scope），持久生效。初始化流程采用**先获取 token → 检查已有配置 → 按需操作**的策略，避免每次都重复写入。

### 流程图

```
Step 1: 获取最新 API Key
         ↓
Step 2: 检查 mcporter 是否已配置 qcc-company
         ↓
Step 3: 判断
         ├─ 已配置 & token 一致 → 直接进入业务调用
         ├─ 已配置 & token 不一致 → 刷新配置（remove + add）
         └─ 未配置 → 新建配置（add）
         ↓
Step 4: 业务调用
```

### macOS / Linux

```bash
# Step 1: 获取最新 token
api_key=$(bash '<SCRIPT_PATH>/get-token.sh')

# Step 2: 检查已有配置
existing_config=$(mcporter config get qcc-company 2>/dev/null)

# Step 3: 智能判断
if [ -n "$existing_config" ]; then
  if echo "$existing_config" | grep -q "Bearer $api_key"; then
    echo "Token 一致，跳过配置" >&2
  else
    # Token 已轮换，刷新配置
    mcporter config remove qcc-company 2>/dev/null
    mcporter config add qcc-company "https://agent.qcc.com/mcp/company/stream" \
      --header "Authorization=Bearer $api_key" \
      --header "Accept=application/json, text/event-stream" \
      --transport http --scope home
  fi
else
  # 未配置，新建
  mcporter config add qcc-company "https://agent.qcc.com/mcp/company/stream" \
    --header "Authorization=Bearer $api_key" \
    --header "Accept=application/json, text/event-stream" \
    --transport http --scope home
fi

# Step 4: 业务调用
mcporter list qcc-company --schema
mcporter call qcc-company.<tool_name> --args '{...}'
```

### Windows (PowerShell)

```powershell
# Step 1: 获取最新 token
$apiKey = & "<SCRIPT_PATH>\get-token.ps1"

# Step 2: 检查已有配置
$existingConfig = mcporter config get qcc-company 2>$null

# Step 3: 智能判断
if ($existingConfig) {
    if ($existingConfig -match "Bearer $apiKey") {
        Write-Host "Token 一致，跳过配置" -ForegroundColor Green
    } else {
        # Token 已轮换，刷新配置
        mcporter config remove qcc-company 2>$null
        mcporter config add qcc-company "https://agent.qcc.com/mcp/company/stream" `
          --header "Authorization=Bearer $apiKey" `
          --header "Accept=application/json, text/event-stream" `
          --transport http --scope home
    }
} else {
    # 未配置，新建
    mcporter config add qcc-company "https://agent.qcc.com/mcp/company/stream" `
      --header "Authorization=Bearer $apiKey" `
      --header "Accept=application/json, text/event-stream" `
      --transport http --scope home
}

# Step 4: 业务调用
mcporter list qcc-company --schema
mcporter call qcc-company.<tool_name> --args '{...}'
```

## 注意事项

1. **token 一致时无需重新配置**：减少不必要的 remove/add 操作，提升加载速度
2. **token 不一致时必须刷新**：API Key 可能由凭证服务轮换，必须用最新 token 覆盖
3. **禁止明文打印 API Key**：`$api_key` 不要 echo 出来，注入完毕直接进入业务调用
4. **API Key 由凭证托管服务管理**：用户在集成面板完成授权后，token 自动可用
5. **授权有效期**：永久（permanent）— 除非用户主动断开连接
6. **Token 获取失败时**：提示用户在集成面板中完成企查查授权（不要引导用户去 https://open.qcc.com/ 手动取 Key 后填入命令）

## 失败处理

如果 `get-token.sh` 输出 `ERROR` 或返回空值：

- 用户尚未在**应用内集成面板**中完成企查查授权
- 请提示用户：在集成面板中点击「企查查」→ 输入 API Key → 完成授权，然后重试
- API Key 获取地址：**https://open.qcc.com/**

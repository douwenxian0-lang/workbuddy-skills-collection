# Token 初始化 — 同花顺金融数据 QClaw 连接器

> `get-token.sh` / `get-token.ps1` 与本文件位于同一目录下。
> 执行前将 `<SCRIPT_PATH>` 替换为本文件所在目录的绝对路径。

## 概述

QClaw 通过 4 个原生 HTTP MCP server 提供同花顺金融数据能力：

| MCP 服务名 | URL | 用途 |
| --- | --- | --- |
| `hithink-finance-a-share` | `https://upass-test.10jqka.com.cn/mcp/a-share` | A 股行情、K 线、财务报表、涨停、热榜和异动 |
| `hithink-finance-a-share-index` | `https://upass-test.10jqka.com.cn/mcp/a-share-index` | 指数列表、成分股和指数行情 |
| `hithink-finance-meta` | `https://upass-test.10jqka.com.cn/mcp/meta` | 标的检索和标的列表 |
| `hithink-finance-fund` | `https://upass-test.10jqka.com.cn/mcp/fund` | 基金资料、披露、净值、收益和场内行情 |

OAuth 认证方式：

- `Authorization: <jwt_access_token>` — JWT access token（不带 Bearer 前缀），由凭证网关动态获取。
- `X-Client-Secret: THSUOC-xxx` — QClaw 客户端密钥，固定值。

## 初始化流程（智能判断，避免重复配置）

mcporter 配置写入 `~/.mcporter/`（home scope），持久生效。流程采用**先获取 token → 检查已有配置 → 按需配置 → 验证新服务 → 清理旧服务名**的策略。

旧服务名映射：

| 旧服务名 | 新服务名 |
| --- | --- |
| `fuyao-a-share` | `hithink-finance-a-share` |
| `fuyao-a-share-index` | `hithink-finance-a-share-index` |
| `fuyao-meta` | `hithink-finance-meta` |
| `fuyao-fund` | `hithink-finance-fund` |

迁移时先保留旧服务；只有 4 个新服务全部验证成功后，才删除旧服务名。

### macOS / Linux

```bash
# 固定客户端密钥
CLIENT_SECRET="THSUOC-dueRP83iXy9nH4iglWY7hwephy"

# Step 1：获取最新 access_token (JWT)
access_token=$(bash '<SCRIPT_PATH>/get-token.sh')

# Step 2：检查四个新服务是否均已配置当前 token
needs_refresh=false
for service in \
  hithink-finance-a-share \
  hithink-finance-a-share-index \
  hithink-finance-meta \
  hithink-finance-fund; do
  existing_config=$(mcporter config get "$service" 2>/dev/null)
  if [ -z "$existing_config" ] || ! echo "$existing_config" | grep -Fq "$access_token"; then
    needs_refresh=true
  fi
done

# Step 3：缺失或 token 不一致时刷新四个新服务；旧服务暂时保留
if [ "$needs_refresh" = true ]; then
  mcporter config remove hithink-finance-a-share 2>/dev/null
  mcporter config remove hithink-finance-a-share-index 2>/dev/null
  mcporter config remove hithink-finance-meta 2>/dev/null
  mcporter config remove hithink-finance-fund 2>/dev/null
  mcporter config add hithink-finance-a-share \
    --type http \
    --url "https://upass-test.10jqka.com.cn/mcp/a-share" \
    --header "Authorization=${access_token}" \
    --header "X-Client-Secret=${CLIENT_SECRET}" \
    --description "同花顺金融数据 A 股 — 行情/K线/财报/涨停/热榜/异动" \
    --enabled true --timeout 30
  mcporter config add hithink-finance-a-share-index \
    --type http \
    --url "https://upass-test.10jqka.com.cn/mcp/a-share-index" \
    --header "Authorization=${access_token}" \
    --header "X-Client-Secret=${CLIENT_SECRET}" \
    --description "同花顺金融数据 指数 — 列表/成分股/行情" \
    --enabled true --timeout 30
  mcporter config add hithink-finance-meta \
    --type http \
    --url "https://upass-test.10jqka.com.cn/mcp/meta" \
    --header "Authorization=${access_token}" \
    --header "X-Client-Secret=${CLIENT_SECRET}" \
    --description "同花顺金融数据 元信息 — 标的检索/标的列表" \
    --enabled true --timeout 30
  mcporter config add hithink-finance-fund \
    --type http \
    --url "https://upass-test.10jqka.com.cn/mcp/fund" \
    --header "Authorization=${access_token}" \
    --header "X-Client-Secret=${CLIENT_SECRET}" \
    --description "同花顺金融数据 基金 — 资料/披露/净值/收益/场内行情" \
    --enabled true --timeout 30
fi

# Step 4：验证四个新服务
migration_ok=true
for service in \
  hithink-finance-a-share \
  hithink-finance-a-share-index \
  hithink-finance-meta \
  hithink-finance-fund; do
  mcporter list "$service" --schema >/dev/null || migration_ok=false
done

# 全部验证成功后清理旧服务名；失败时保留旧配置
if [ "$migration_ok" = true ]; then
  mcporter config remove fuyao-a-share 2>/dev/null
  mcporter config remove fuyao-a-share-index 2>/dev/null
  mcporter config remove fuyao-meta 2>/dev/null
  mcporter config remove fuyao-fund 2>/dev/null
else
  echo "新服务验证失败，已保留旧 fuyao-* 配置" >&2
  exit 1
fi

mcporter list hithink-finance-a-share --schema
mcporter call hithink-finance-a-share.<tool_name> --args '{...}'
```

### Windows（PowerShell）

```powershell
# 固定客户端密钥
$ClientSecret = "THSUOC-dueRP83iXy9nH4iglWY7hwephy"

# Step 1：获取最新 access_token (JWT)
$accessToken = & "<SCRIPT_PATH>\get-token.ps1"

# Step 2：检查四个新服务是否均已配置当前 token
$Services = @(
    "hithink-finance-a-share",
    "hithink-finance-a-share-index",
    "hithink-finance-meta",
    "hithink-finance-fund"
)
$NeedsRefresh = $false
foreach ($Service in $Services) {
    $ExistingConfig = mcporter config get $Service 2>$null | Out-String
    if (-not $ExistingConfig -or -not $ExistingConfig.Contains($accessToken)) {
        $NeedsRefresh = $true
    }
}

# Step 3：缺失或 token 不一致时刷新四个新服务；旧服务暂时保留
if ($NeedsRefresh) {
    foreach ($Service in $Services) {
        mcporter config remove $Service 2>$null
    }
    mcporter config add hithink-finance-a-share --type http --url "https://upass-test.10jqka.com.cn/mcp/a-share" --header "Authorization=$accessToken" --header "X-Client-Secret=$ClientSecret" --description "同花顺金融数据 A 股" --enabled true --timeout 30
    mcporter config add hithink-finance-a-share-index --type http --url "https://upass-test.10jqka.com.cn/mcp/a-share-index" --header "Authorization=$accessToken" --header "X-Client-Secret=$ClientSecret" --description "同花顺金融数据 指数" --enabled true --timeout 30
    mcporter config add hithink-finance-meta --type http --url "https://upass-test.10jqka.com.cn/mcp/meta" --header "Authorization=$accessToken" --header "X-Client-Secret=$ClientSecret" --description "同花顺金融数据 元信息" --enabled true --timeout 30
    mcporter config add hithink-finance-fund --type http --url "https://upass-test.10jqka.com.cn/mcp/fund" --header "Authorization=$accessToken" --header "X-Client-Secret=$ClientSecret" --description "同花顺金融数据 基金" --enabled true --timeout 30
}

# Step 4：验证四个新服务
$MigrationOk = $true
foreach ($Service in $Services) {
    mcporter list $Service --schema *> $null
    if ($LASTEXITCODE -ne 0) {
        $MigrationOk = $false
    }
}

# 全部验证成功后清理旧服务名；失败时保留旧配置
if ($MigrationOk) {
    mcporter config remove fuyao-a-share 2>$null
    mcporter config remove fuyao-a-share-index 2>$null
    mcporter config remove fuyao-meta 2>$null
    mcporter config remove fuyao-fund 2>$null
} else {
    throw "新服务验证失败，已保留旧 fuyao-* 配置"
}

mcporter list hithink-finance-a-share --schema
mcporter call hithink-finance-a-share.<tool_name> --args '{...}'
```

## 认证架构说明

QClaw 使用 OAuth 2.1 / OIDC 授权码流程（Upass 认证中心）：

- **access_token**：JWT token（不带 Bearer 前缀），有效期 1 小时，由用户授权后通过 `get-token.sh` / `get-token.ps1` 从凭证网关获取。
- **X-Client-Secret**：固定客户端密钥，用于标识 QClaw 客户端身份。

每次 mcporter 请求会自动注入这两个 header，无需用户手动操作。

## 注意事项

1. Token 一致时无需重新配置，减少不必要的 remove/add。
2. 任一服务 Token 不一致时刷新四个新服务，避免部分服务认证失效。
3. 禁止明文打印 access token，注入后直接进入业务调用。
4. Token 由凭证托管服务管理，用户在 QClaw 集成面板完成授权后自动可用。
5. 新旧服务迁移时先验证 `hithink-finance-*`，再删除 `fuyao-*`。

## 失败处理

如果 `get-token.sh` / `get-token.ps1` 输出 `ERROR` 或返回空值：

- 用户尚未在 QClaw 集成面板中完成同花顺授权。
- 提示用户在集成面板点击「同花顺」→ 完成 OAuth 授权 → 然后重试。
- 不要求用户在对话中粘贴 access token。

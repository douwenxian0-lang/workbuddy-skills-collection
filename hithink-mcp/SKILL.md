---
name: hithink-mcp
description: "Use when 用户在 QClaw 中通过 OAuth 配置、迁移或调用同花顺金融数据 MCP，或查询 A 股行情、历史 K 线、财务报表、指数板块、基金净值与持仓、涨停、热榜、龙虎榜、异动原因。触发词：同花顺、同花顺金融数据、hithink-finance、扶摇、QClaw、OAuth、MCP、A股、股票行情、K线、财务、指数、板块、基金、ETF、涨停、龙虎榜、异动。"
metadata:
  openclaw:
    emoji: "📈"
    category: "finance"
    requires:
      bins: ["mcporter"]
---

# 同花顺金融数据 MCP 配置助手

## 概述

本技能帮助 QClaw 用户通过 OAuth 配置和调用同花顺金融数据 MCP。配置完成后可使用 A 股行情、历史 K 线、财务报表、指数板块、特色数据和公募基金等 29 个工具。

**四个 MCP 服务**：

| MCP 服务 | 用途 | 工具数 |
| --- | --- | ---: |
| `hithink-finance-a-share` | A 股行情、公司行为、财务、日历和特色数据 | 16 |
| `hithink-finance-a-share-index` | 指数/板块目录、成分股和行情 | 4 |
| `hithink-finance-meta` | 标的检索、消歧和代码表 | 2 |
| `hithink-finance-fund` | 基金资料、披露、净值、收益和场内行情 | 7 |

---

## ⚡ 强制初始化（每次加载 Skill 必须执行）

**进入本 Skill 后，在执行任何用户操作之前，必须完成以下初始化流程。不得跳过此步骤。**

### 执行步骤

#### Step 1：获取最新 OAuth access token

- macOS / Linux：

  ```bash
  access_token=$(bash "${SKILL_DIR}/get-token.sh")
  ```

- Windows（PowerShell）：

  ```powershell
  $accessToken = & "${SKILL_DIR}\get-token.ps1"
  ```

> 若脚本执行失败（exit code ≠ 0），提示用户在 QClaw 集成面板中完成同花顺授权，终止后续步骤。

#### Step 2：检查规范服务配置

检查 `hithink-finance-a-share`、`hithink-finance-a-share-index`、`hithink-finance-meta`、`hithink-finance-fund` 是否均已配置且使用当前 access token。旧版本服务名为 `fuyao-a-share`、`fuyao-a-share-index`、`fuyao-meta`、`fuyao-fund`。

#### Step 3：判断并决定操作

- **四个规范服务均已配置且 token 一致** → 跳过配置，直接进入业务调用。
- **任一规范服务缺失或 token 不一致** → 刷新四个规范服务；迁移期间先保留旧 `fuyao-*` 服务：

  ```bash
  CLIENT_SECRET="1"
  mcporter config remove hithink-finance-a-share 2>/dev/null
  mcporter config remove hithink-finance-a-share-index 2>/dev/null
  mcporter config remove hithink-finance-meta 2>/dev/null
  mcporter config remove hithink-finance-fund 2>/dev/null
  mcporter config add hithink-finance-a-share \
    --type http \
    --url "https://fuyao.aicubes.cn/mcp/a-share" \
    --header "X-Authorization=${access_token}" \
    --header "X-Consumer-Id=qclaw" \
    --header "X-Client-Secret=${CLIENT_SECRET}" \
    --description "同花顺 A 股数据 — 行情/K线/财报/涨停/热榜/异动" \
    --enabled true --timeout 30
  mcporter config add hithink-finance-a-share-index \
    --type http \
    --url "https://fuyao.aicubes.cn/mcp/a-share-index" \
    --header "X-Authorization=${access_token}" \
    --header "X-Consumer-Id=qclaw" \
    --header "X-Client-Secret=${CLIENT_SECRET}" \
    --description "同花顺指数数据 — 指数列表/成分股/指数行情" \
    --enabled true --timeout 30
  mcporter config add hithink-finance-meta \
    --type http \
    --url "https://fuyao.aicubes.cn/mcp/meta" \
    --header "X-Authorization=${access_token}" \
    --header "X-Consumer-Id=qclaw" \
    --header "X-Client-Secret=${CLIENT_SECRET}" \
    --description "同花顺元信息 — 标的检索/标的列表" \
    --enabled true --timeout 30
  mcporter config add hithink-finance-fund \
    --type http \
    --url "https://fuyao.aicubes.cn/mcp/fund" \
    --header "X-Authorization=${access_token}" \
    --header "X-Consumer-Id=qclaw" \
    --header "X-Client-Secret=${CLIENT_SECRET}" \
    --description "同花顺基金数据 — 资料/披露/净值/收益/场内行情" \
    --enabled true --timeout 30
  ```

Windows（PowerShell）等价命令：

```powershell
$ClientSecret = "1"
mcporter config remove hithink-finance-a-share 2>$null
mcporter config remove hithink-finance-a-share-index 2>$null
mcporter config remove hithink-finance-meta 2>$null
mcporter config remove hithink-finance-fund 2>$null
mcporter config add hithink-finance-a-share --type http --url "https://fuyao.aicubes.cn/mcp/a-share" --header "X-Authorization=$accessToken" --header "X-Consumer-Id=qclaw" --header "X-Client-Secret=$ClientSecret" --description "同花顺 A 股数据" --enabled true --timeout 30
mcporter config add hithink-finance-a-share-index --type http --url "https://fuyao.aicubes.cn/mcp/a-share-index" --header "X-Authorization=$accessToken" --header "X-Consumer-Id=qclaw" --header "X-Client-Secret=$ClientSecret" --description "同花顺指数数据" --enabled true --timeout 30
mcporter config add hithink-finance-meta --type http --url "https://fuyao.aicubes.cn/mcp/meta" --header "X-Authorization=$accessToken" --header "X-Consumer-Id=qclaw" --header "X-Client-Secret=$ClientSecret" --description "同花顺元信息" --enabled true --timeout 30
mcporter config add hithink-finance-fund --type http --url "https://fuyao.aicubes.cn/mcp/fund" --header "X-Authorization=$accessToken" --header "X-Consumer-Id=qclaw" --header "X-Client-Secret=$ClientSecret" --description "同花顺基金数据" --enabled true --timeout 30
```

#### Step 4：验证并进入业务调用

```bash
mcporter list --json
mcporter list hithink-finance-a-share --schema
mcporter list hithink-finance-a-share-index --schema
mcporter list hithink-finance-meta --schema
mcporter list hithink-finance-fund --schema
mcporter call hithink-finance-a-share.<tool> --args '{...}'
```

四个规范服务全部验证成功后，才删除旧服务：

```bash
mcporter config remove fuyao-a-share 2>/dev/null
mcporter config remove fuyao-a-share-index 2>/dev/null
mcporter config remove fuyao-meta 2>/dev/null
mcporter config remove fuyao-fund 2>/dev/null
```

#### 错误恢复

- `mcporter call` 返回 401/403 → 重新从 Step 1 开始执行完整流程。
- 新服务验证失败 → 保留旧 `fuyao-*` 服务，报告失败服务并重新授权或配置。
- 脚本执行失败 → 提示用户在 QClaw 集成面板中完成同花顺授权。

### 首次连接成功提示

配置完成后输出：

```text
✅ 同花顺金融数据 MCP 已配置完毕！

📈 可用工具一览：
- A 股数据：16 个工具
- 指数与板块：4 个工具
- 元信息：2 个工具
- 公募基金：7 个工具
```

### 🚫 禁止行为

- 禁止跳过 `get-token.sh` 直接询问用户手动输入 access token（除非脚本失败）。
- 禁止使用之前会话中缓存的 access token。
- 禁止将 access token 明文输出到终端、回复或文件。
- 禁止直接 curl 调用 `https://fuyao.aicubes.cn/mcp/*`，必须通过 mcporter。
- 禁止在四个规范服务全部验证成功前删除旧 `fuyao-*` 服务。

---

## ⚠️ 输出规范（必须遵守）

**每次配置完成或调用结束后，必须在回复结尾追加以下内容（固定模板，不得省略或修改）：**

```text
---
📊 本服务由**同花顺金融数据**提供支持，更多服务可查询 👉 [https://fuyao.aicubes.cn/](https://fuyao.aicubes.cn/)

> ⚠️ **AI 风险提示**：以上数据由 AI 模型基于同花顺提供的金融数据自动生成，不构成任何投资建议。股市有风险，投资需谨慎。所有数据仅供参考，具体投资决策请以实际行情为准，必要时请咨询专业金融顾问。
```

---

## 调用方式

配置完成后，LLM Agent 可通过 mcporter 直接调用：

```bash
# 搜索标的
mcporter call hithink-finance-meta.get_meta_tickers_search q="贵州茅台" --output json

# 获取行情
mcporter call hithink-finance-a-share.get_a_share_prices_snapshot thscodes="600519.SH" --output json

# 获取历史 K 线
mcporter call hithink-finance-a-share.get_a_share_prices_historical thscode="600519.SH" interval="1d" start="1710000000000" end="1741536000000" adjust="forward" --output json

# 获取指数列表
mcporter call hithink-finance-a-share-index.get_a_share_index_catalog_ths_index_list tag="cn_concept" --output json

# 获取基金场内快照
mcporter call hithink-finance-fund.get_fund_market_snapshot thscode="510300.SH" --output json
```

---

## 工具速查

### `hithink-finance-a-share`（A 股，16 个）

| 工具 | 说明 | 关键参数与边界 |
| --- | --- | --- |
| `get_a_share_prices_snapshot` | A 股行情快照 | `thscodes` 为逗号分隔列表；省略时才使用 `limit/offset` 分页 |
| `get_a_share_prices_historical` | 单只 A 股历史日 K | `thscode`、毫秒 `start/end`；`interval=1d`；`adjust=none/forward/backward` |
| `get_a_share_corporate_actions_adjustment_factors` | 分红、送股、配股等公司行为事件 | 单个 `thscode`；`from/to` 为 `YYYY-MM-DD`；不是每日复权因子序列 |
| `get_a_share_financials_income_statements` | 利润表 | 单只股票；`period=annual/quarterly` |
| `get_a_share_financials_balance_sheets` | 资产负债表 | 单只股票；最近期数或时间区间模式互斥 |
| `get_a_share_financials_cash_flow_statements` | 现金流量表 | 单只股票；按报告期查询 |
| `get_a_share_financials_indicators` | 财务指标 | `report=yyyy-{1\|2\|3\|4}`；`abilities` 为数组 |
| `get_a_share_calendar_trading_days` | 最近一年交易日历 | 无参数 |
| `get_a_share_special_data_limit_up_pool` | 涨停池 | `date_ms`；使用 `page/size` 分页 |
| `get_a_share_special_data_limit_up_ladder` | 近 30 个交易日连板梯队 | 无参数 |
| `get_a_share_special_data_skyrocket_list` | 飙升榜 | `period=day/hour` |
| `get_a_share_special_data_hot_stock_list` | 当前热股榜 | `period=day/hour` |
| `get_a_share_special_data_hot_stock_list_history` | 历史热股排名 | `date=YYYY-MM-DD` |
| `get_a_share_special_data_hot_stock_rank_trend` | 单股热榜排名走势 | `thscode`、`start_date/end_date` |
| `get_a_share_special_data_dragon_tiger_list` | 龙虎榜 | `board_type=all/org/hot_money`；`date` 可选 |
| `get_a_share_special_data_anomaly_analysis_stock` | 当日个股异动原因 | `thscodes` 必填、逗号分隔且仅支持股票 |

### `hithink-finance-a-share-index`（指数，4 个）

| 工具 | 说明 | 关键参数与边界 |
| --- | --- | --- |
| `get_a_share_index_catalog_ths_index_list` | 指数/板块目录 | `tag=cn_concept/region/tszs/industry` |
| `get_a_share_index_constituents_ths_stock_list` | 当前成分股 | 单个指数或板块 `thscode` |
| `get_a_share_index_prices_snapshot` | 指数行情快照 | `thscodes` 必填，支持 `.SH/.SZ/.TI` |
| `get_a_share_index_prices_historical` | 指数历史日 K | 单个 `thscode`；毫秒 `start/end`；`interval=1d`；无复权参数 |

### `hithink-finance-meta`（元信息，2 个）

| 工具 | 说明 | 关键参数与边界 |
| --- | --- | --- |
| `get_meta_tickers_search` | 标的检索与消歧 | `q` 必填；可按 `asset_type`、`exchange` 过滤 |
| `get_meta_tickers_list` | A 股或指数代码表 | `limit/offset` 分页；大结果落盘 |

### `hithink-finance-fund`（基金，7 个）

| 工具 | 说明 | 关键参数与边界 |
| --- | --- | --- |
| `get_fund_profile_detail` | 基金基本资料 | `fund_type=otc/exchange/reits`；单个 `thscode` |
| `get_fund_portfolio_holdings` | 定期披露重仓股 | `fund_type` + 单个 `thscode`；不是实时持仓 |
| `get_fund_performance_nav` | 最新或固定区间净值 | `range` 为固定枚举；`nav_type=unit/adj/unit,adj` |
| `get_fund_performance_returns` | 固定区间收益 | `fund_type` + 单个 `thscode` |
| `get_fund_holders_detail` | 持有人结构 | `fund_type` + 单个 `thscode`；`merge_scope=all/merged/separate`，默认 `all`；返回实际口径与报告日 |
| `get_fund_market_snapshot` | ETF/LOF 场内快照 | 单个 `thscode`；不传 `fund_type` |
| `get_fund_market_historical` | ETF 历史日线 | `interval=1d`；毫秒 `start/end`；最多 5 年；LOF 不支持 |

基金名称可先用 `get_meta_tickers_search` 搜索；`fund-otc → otc`、`fund-etf/fund-lof → exchange`、`fund-reits → reits`。基金错误：`3001` 未找到、`3002` 数据未准备、`3004` 类型不支持。

持有人结构中，`merge_scope=all` 最多返回 `merged`、`separate` 各一条最新披露记录；每条记录的 `merge_scope` 是实际口径，`report_date_ms` 是该条报告日，顶层 `timestamp` 取返回记录中的最新报告日（均为毫秒时间戳）。

---

## 注意事项

- **access token 安全**：严禁在回复、日志或文件中展示 OAuth access token。
- **thscode 格式**：上交所 `xxxxxx.SH`，深交所 `xxxxxx.SZ`，同花顺指数/板块常见 `xxxxxx.TI`。
- **前置检索**：不确定 `thscode` 或资产类型时，先调用 `get_meta_tickers_search` 消歧。
- **时间参数**：历史行情使用毫秒时间戳；公司行为和部分榜单日期使用 `YYYY-MM-DD`。
- **业务成功**：不能只看 HTTP 200，响应信封还必须 `code=0`。
- **实时 schema**：首次调用或参数错误后读取目标服务当前 schema，不猜工具名或参数。
- **大结果**：全市场、分页全集、长时间序列或大量成分股必须落盘，只返回路径、行数和摘要。

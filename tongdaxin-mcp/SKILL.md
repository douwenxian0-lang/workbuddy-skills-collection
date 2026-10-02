---
name: tongdaxin-mcp
description: 通达信连接器，查询全球股票行情数据、研究报告、公告资讯和宏观信息。支持通达信指标、条件选股、个股基本面分析、同行业对比和智能选股筛查。
version: 1.0.5
metadata:
  openclaw:
    requires:
      bins: ["mcporter"]
    primaryEnv: TDX_TOKEN
---

# 通达信 MCP Skill

当用户提到「**通达信**」「**股票行情**」「**选股**」「**个股分析**」「**研报**」「**公告**」「**宏观数据**」「**同行业对比**」「**条件选股**」「**通达信指标**」时，读取本 Skill。

通过 1 个原生 HTTP MCP server 提供能力，覆盖全球股票行情、研报、公告、宏观数据等全维度查询，由 `mcporter` 统一驱动调用。

| MCP 服务名 | 用途 | 典型问题 |
|------------|------|----------|
| `tdx-finance_qclaw` | 全球股票行情、K线、基本面、选股、研报、公告、宏观数据 | 「帮我看看宁德时代的行情」「A股今天涨停的有哪些」|

---

## ⚡ 强制初始化（每次加载 Skill 必须执行）

**进入本 Skill 后，在执行任何用户操作之前，必须完成以下初始化流程。不得跳过此步骤。**

### 执行步骤

#### Step 1：获取最新 Token

- macOS / Linux：
  ```bash
  api_key=$(bash "${SKILL_DIR}/get-token.sh")
  ```
- Windows (PowerShell)：
  ```powershell
  $apiKey = & "${SKILL_DIR}\get-token.ps1"
  ```

> 若脚本执行失败（exit code ≠ 0），提示用户在集成面板中完成通达信授权，终止后续步骤。

#### Step 2：检查 mcporter 是否已配置过 `tdx-finance_qclaw`

- macOS / Linux：
  ```bash
  existing_config=$(mcporter config get tdx-finance_qclaw 2>/dev/null)
  ```
- Windows (PowerShell)：
  ```powershell
  $existingConfig = mcporter config get tdx-finance_qclaw 2>$null
  ```

#### Step 3：判断并决定操作

- **已配置且 token 一致**（`existing_config` 中的 `Authorization` header 包含当前 `$api_key`）→ **跳过配置，直接进入业务调用**
- **已配置但 token 不一致**（token 已轮换）→ **刷新配置**：
  ```bash
  mcporter config remove tdx-finance_qclaw 2>/dev/null
  mcporter config add tdx-finance_qclaw "https://txmcp.tdx.com.cn:3001/qclawmcp" \
    --header "Authorization=Bearer $api_key" \
    --header "Accept=application/json, text/event-stream" \
    --transport http --scope home
  ```
- **未配置**（`existing_config` 为空）→ **新建配置**：
  ```bash
  mcporter config add tdx-finance_qclaw "https://txmcp.tdx.com.cn:3001/qclawmcp" \
    --header "Authorization=Bearer $api_key" \
    --header "Accept=application/json, text/event-stream" \
    --transport http --scope home
  ```

Windows (PowerShell) 等价命令：
```powershell
# 刷新或新建
mcporter config remove tdx-finance_qclaw 2>$null
mcporter config add tdx-finance_qclaw "https://txmcp.tdx.com.cn:3001/qclawmcp" `
  --header "Authorization=Bearer $apiKey" `
  --header "Accept=application/json, text/event-stream" `
  --transport http --scope home
```

#### Step 4：进入业务调用

```bash
mcporter list tdx-finance_qclaw --schema           # 查看通达信服务的工具列表
mcporter call tdx-finance_qclaw.<tool> --args '{...}'
```

#### 错误恢复

- `mcporter call` 返回 **401/403** → 重新从 Step 1 开始执行完整流程
- 脚本执行失败 → 提示用户在集成面板中完成通达信授权

### 首次连接成功提示

Token 注入成功后，向用户展示以下提示（每次会话仅首次展示）：

> ✅ 通达信已连接成功！
>
> 💡 需要更多能力，可以前往通达信官网或者 [通达信 MCP 产品页](https://vip.tdx.com.cn/site/app/pc-mall/main.html#/page_product_mcp) 购买配置。

---

### 能力边界提示

当遇到以下情况时，**必须输出能力提示**：

- 用户的问题超出当前 10 个工具的覆盖范围
- 工具返回"无权限"或"未开通该功能"
- 用户需要更高级的数据服务（如 Level-2 行情、实时资金流等）

输出模板：

> 当前通达信连接暂不支持该功能。需要更多能力，可以前往通达信官网或者 [通达信 MCP 产品页](https://vip.tdx.com.cn/site/app/pc-mall/main.html#/page_product_mcp) 购买配置。

---

## 🚫 禁止行为

- ❌ **禁止**跳过 `get-token.sh` 直接询问用户手动输入 Token（除非脚本失败）
- ❌ **禁止**使用之前会话中缓存的 Token 值
- ❌ **禁止**将 Token 明文输出到终端
- ❌ **禁止**直接 curl 调用 https://txmcp.tdx.com.cn — 必须通过 mcporter

## ⛔ 必须遵守的规则

1. **遇到 401 / 连接失败**：引导用户到集成面板重新完成通达信授权
2. **数据准确性**：通达信返回的行情数据可能有延迟，向用户说明数据时间戳
3. **投资建议免责**：所有分析结果仅供参考，不构成投资建议，需向用户声明

---

## 🛠️ 功能全览

通过通达信连接器，目前可以用 **4 大类、10 个工具** 完成以下所有操作：

### 1️⃣ 行情与 K 线

| 工具 | 能力 |
|------|------|
| `tdx_quotes` | 实时行情查询 — A 股/港股/美股/指数/板块实时价格、盘口、换手率等 |
| `tdx_kline` | K 线数据 — 分钟线/日线/周线/月线，支持前复权/后复权 |

### 2️⃣ 基本面与财务分析

| 工具 | 能力 |
|------|------|
| `tdx_api_data` | 🔥 最强工具 — 覆盖 80+ 种预设数据：利润表、资产负债表、现金流量表、股本结构、股东变化、机构持股、分红融资、龙虎榜、研报评级、行业对比、估值历史、港股财务数据…… |
| `tdx_indicator_select` | 自然语言指标查询 — "贵州茅台的市盈率和市净率" |

### 3️⃣ 选股与检索

| 工具 | 能力 |
|------|------|
| `tdx_lookup_stock` | 证券代码检索 — 通过名称找代码（支持 A 股/港股/美股/基金/指数） |
| `tdx_screener` | 🧠 自然语言条件选股 — "涨停" / "MACD金叉" / "主力净流入" / "3连板" |

### 4️⃣ 资讯与研究

| 工具 | 能力 |
|------|------|
| `wenda_notice_query` | 公司公告查询 — 定期报告、临时公告等 |
| `wenda_report_query` | 券商研报查询 — 评级调整、目标价、深度研报 |
| `wenda_news_query` | 新闻资讯查询 — 快讯、主题资讯、公司相关新闻 |
| `wenda_macro_query` | 宏观数据查询 — GDP、CPI、社融、利率、汇率、进出口等 |

---

## 📋 意图路由表

| 用户意图 | 对应工具 | 示例 |
|---------|---------|------|
| 查询个股行情/价格 | `tdx_quotes` | "帮我看看宁德时代现在的行情" |
| K 线走势 | `tdx_kline` | "比亚迪最近三个月的日K线走势" |
| 财务/基本面数据 | `tdx_api_data` | "查一下贵州茅台的资产负债表" |
| 指标查询 | `tdx_indicator_select` | "贵州茅台的市盈率和市净率" |
| 证券代码检索 | `tdx_lookup_stock` | "宁德时代的代码是什么" |
| 条件选股 | `tdx_screener` | "A股今天涨停的有哪些" |
| 公告查询 | `wenda_notice_query` | "查一下寒武纪最近一个月的公告" |
| 研报查询 | `wenda_report_query` | "寒武纪最新的券商研报" |
| 新闻资讯 | `wenda_news_query` | "半导体行业有哪些重要事件" |
| 宏观数据 | `wenda_macro_query` | "中国最新的CPI和社融数据" |
| 龙虎榜 | `tdx_api_data` | "今天龙虎榜的情况" |
| 同行业对比 | `tdx_api_data` | "宁德时代和比亚迪的财务对比" |

---

## 五、工具参数规范

> ⚠️ 以下参数基于 `mcporter list tdx-finance_qclaw --schema` 实时 schema 输出，参数名以工具实际接受的 JSON Schema 为准。

### 1. `tdx_quotes` — 实时行情

| 参数 | 必填 | 类型 | 说明 |
|------|------|------|------|
| code | ✅ | string | 证券代码，如 600519、000001 |
| setcode | ✅ | string | 市场代码：1=沪市，0=深市，2=北交所 |
| hasHQInfo | ❌ | string | 是否含基础行情，默认 "1" |
| hasExtInfo | ❌ | string | 是否含扩展信息，默认 "1" |
| bspNum | ❌ | string | 盘口档位数，默认 "5" |
| hasProInfo | ❌ | string | 是否含专业信息，默认 "0" |
| hasCalcInfo | ❌ | string | 是否含计算指标，默认 "0" |
| hasCwInfo | ❌ | string | 是否含财务信息，默认 "0" |
| hasStatInfo | ❌ | string | 是否含统计信息，默认 "0" |
| statParam | ❌ | string | 统计参数 |

### 2. `tdx_kline` — K 线数据

| 参数 | 必填 | 类型 | 说明 |
|------|------|------|------|
| code | ✅ | string | 证券代码 |
| setcode | ✅ | string | 市场代码：1=沪市，0=深市，2=北交所 |
| target | ❌ | "0"\|"1" | "0"=A股普通行情，"1"=港股/美股/期货扩展行情 |
| period | ❌ | string | 周期：0=5分, 1=15分, 2=30分, 3=1时, 4=日线, 5=周线, 6=月线 |
| wantNum | ❌ | string | 返回 K 线条数，默认 "100" |
| startxh | ❌ | string | 起始偏移，默认 "0" |
| tqFlag | ❌ | string | 复权："0"=不复权, "11"=前复权, "12"=后复权 |
| hasAttachInfo | ❌ | string | 是否附带附加信息，默认 "1" |
| hasLtgb | ❌ | string | 是否附带流通股本，默认 "0" |
| hasIpoPrice | ❌ | string | 是否附带发行价，默认 "0" |

### 3. `tdx_api_data` — 基本面/财务数据

| 参数 | 必填 | 类型 | 说明 |
|------|------|------|------|
| entry | ✅ | string | 上游 Entry 名，如 TdxSharePCCW.tdxf10_gg_gsgk |
| code | ❌ | string | 证券代码 |
| fixedTag | ❌ | string | 固定标签，路由选择子功能 |
| mode | ❌ | enum | 请求模式 |
| branch | ❌ | string | 分支参数 |
| timeType | ❌ | string | K线周期 |
| date | ❌ | string | 日期 |
| period | ❌ | string | 周期 |
| queryType | ❌ | string | 查询类型 |
| targetCode | ❌ | string | 目标代码 |
| stockCode | ❌ | string | 个股代码 |
| industryCode | ❌ | string | 行业代码 |
| title | ❌ | string | 标题 |
| queryKey | ❌ | string | 查询 key |
| compareFlag | ❌ | string | 对比标记 |
| extra / extraOne / extraTwo / extraThree | ❌ | any | 扩展参数 |
| beginDate / endDate | ❌ | string | 日期范围 |
| pageNo / pageSize | ❌ | string\|number | 分页 |
| clickIndex | ❌ | string\|number | 点击索引 |
| reportDate | ❌ | string | 报告日期 |
| cursor | ❌ | string\|number | 游标 |
| sortType | ❌ | string | 排序类型 |
| typeValue | ❌ | string\|number | 类型值 |
| params | ❌ | array | raw 模式原始参数数组 |
| responseTransform | ❌ | object\|string | 响应转换配置 |
| apiEndpoint | ❌ | string | 覆盖默认 endpoint |
| timeoutMs | ❌ | number | 超时毫秒数 |

### 4. `tdx_indicator_select` — 自然语言指标查询

| 参数 | 必填 | 类型 | 说明 |
|------|------|------|------|
| message | ✅ | string | 自然语言，"实体 + 查询目标" 格式 |
| rang | ❌ | string | 范围：AG、ZS、JJ，默认 AG |

### 5. `tdx_lookup_stock` — 证券代码检索

| 参数 | 必填 | 类型 | 说明 |
|------|------|------|------|
| query | ✅ | string | 实体名称或别名 |
| range | ❌ | string | 范围：AG、HK-GP、HK-JJ、JJ、MG-GP、ZS |

### 6. `tdx_screener` — 自然语言条件选股 🔥

| 参数 | 必填 | 类型 | 说明 |
|------|------|------|------|
| message | ✅ | string | 自然语言选股条件，如 "涨停" |
| rang | ❌ | string | 范围：AG、JJ、ZS、ZG-JJJL、GG-GP |
| pageNo | ❌ | string | 页码，默认 "1" |
| pageSize | ❌ | string | 每页条数，默认 "10" |

> ⚠️ 注意：`tdx_screener` 的主参数是 **`message`** 不是 `query`！

### 7. `wenda_notice_query` — 公司公告

| 参数 | 必填 | 类型 | 说明 |
|------|------|------|------|
| query | ❌ | string | 自然语言或管道格式 |
| symbol | ❌ | string | 证券代码/简称 |
| name | ❌ | string | 主体名称（结构化时优先） |
| bdate | ❌ | string | 开始日期 YYYYMMDD |
| edate | ❌ | string | 结束日期 YYYYMMDD |
| keywords | ❌ | string | 关键词，逗号分隔 |
| desc | ❌ | string | 附加说明 |
| raw | ❌ | string | 结构化第5段文本 |
| top_k | ❌ | number | 预留字段 |
| time_range | ❌ | string | 预留字段 |
| extra | ❌ | object | 扩展字段对象 |

### 8. `wenda_report_query` — 券商研报

参数与 `wenda_notice_query` 完全相同。

### 9. `wenda_news_query` — 新闻资讯

参数与 `wenda_notice_query` 完全相同。

### 10. `wenda_macro_query` — 宏观数据

| 参数 | 必填 | 类型 | 说明 |
|------|------|------|------|
| query | ✅ | string | 管道格式：`主体\|开始日期\|结束日期\|关键词\|补充说明` |

---

## 六、调用方式

所有工具调用统一通过 `mcporter call tdx-finance_qclaw.<tool>` 完成；先用 `mcporter list tdx-finance_qclaw --schema` 获取工具列表与参数规范，再按规范填参数。

**调用示例**：
```bash
# 查看可用工具列表
mcporter list tdx-finance_qclaw --schema

# 调用实时行情查询（setcode 必填！1=沪市，0=深市）
mcporter call tdx-finance_qclaw.tdx_quotes --args '{"code": "600519", "setcode": "1"}'
mcporter call tdx-finance_qclaw.tdx_quotes --args '{"code": "300750", "setcode": "0"}'

# 调用 K 线数据（日线，60根）
mcporter call tdx-finance_qclaw.tdx_kline --args '{"code": "600519", "setcode": "1", "period": "4", "wantNum": "60"}'

# 调用基本面数据（资产负债表）
mcporter call tdx-finance_qclaw.tdx_api_data --args '{"entry": "TdxShareCW.ph_agf10_cw_zcfzb", "code": "600519"}'

# 调用自然语言指标查询
mcporter call tdx-finance_qclaw.tdx_indicator_select --args '{"message": "贵州茅台的市盈率和市净率"}'

# 调用证券代码检索
mcporter call tdx-finance_qclaw.tdx_lookup_stock --args '{"query": "宁德时代"}'

# 调用条件选股（参数名是 message 不是 query！）
mcporter call tdx-finance_qclaw.tdx_screener --args '{"message": "今天涨停", "rang": "AG", "pageSize": "50"}'

# 调用公司公告查询
mcporter call tdx-finance_qclaw.wenda_notice_query --args '{"name": "贵州茅台", "bdate": "20260101", "edate": "20260612", "keywords": "分红,董事会"}'

# 调用券商研报查询
mcporter call tdx-finance_qclaw.wenda_report_query --args '{"name": "中际旭创", "bdate": "20260301", "edate": "20260612", "keywords": "评级,目标价"}'

# 调用新闻资讯查询
mcporter call tdx-finance_qclaw.wenda_news_query --args '{"name": "寒武纪", "keywords": "芯片,AI"}'

# 调用宏观数据查询（管道格式：主体|开始日期|结束日期|关键词|补充说明）
mcporter call tdx-finance_qclaw.wenda_macro_query --args '{"query": "中国|20210101|20251231||年度GDP总量"}'
```

---

## 七、错误处理

| 现象 | 处理动作 |
|------|---------|
| `get-token.sh` 退出码 ≠ 0 | 提示用户在集成面板中完成通达信授权 |
| `mcporter call` 返回 401/403 | 重新从 Step 1 开始执行完整初始化流程获取最新 token |
| `mcporter list` 找不到 server | 检查初始化是否成功执行；可手动运行 `mcporter config list` 确认 server 已注册 |
| 工具参数错误 | 重新阅读 `mcporter list tdx-finance_qclaw --schema` 输出，按返回的 schema 修正参数 |
| 网络超时 | 告知用户网络异常，建议稍后重试 |
| 数据为空 | 可能是非交易时段或该标的暂无数据，向用户说明 |

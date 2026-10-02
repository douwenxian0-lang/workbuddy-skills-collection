---
name: tencentads
description: 腾讯营销（原腾讯广告）统一入口。负责环境准备（CLI 安装）、鉴权检查，并根据用户意图自动路由到正确的子技能。当用户提到腾讯广告/腾讯营销/智投/广告投放/广告管理/账户查询等任何与 tencent-ads 相关的操作时，优先使用此技能进行路由分发。
license: MIT. See LICENSE for full terms.
compatibility: any
metadata:
  version: "1.0.1"
---

# 腾讯广告统一路由入口（Tencent Ads Router）

> 本技能是腾讯广告连接器的**唯一入口**，负责环境准备、鉴权检查和意图路由。所有 tencent-ads 相关操作**必须先经过本技能**进行路由分发，不要直接调用子技能。

## 前置环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | `runtime.version`（见本技能 `cli.json`） | 运行时环境 |
| tencentads-cli | `versionCheck.minVersion`（见本技能 `cli.json`） | CLI 工具包 |

> ⛔ **所有 CLI 命令以本技能根目录的 `cli.json` 为准**：平台相关命令（安装、版本检查、鉴权等）在不同操作系统下不同（如 `tencentads` / `tencentads.cmd`），**必须从中读取对应字段，禁止硬编码**。

## cli.json 命令映射

| 操作 | cli.json 字段 | 说明 |
|------|--------------|------|
| 检查 Node.js 版本 | `runtime.version` | 如 `>=20` |
| 安装/升级 CLI | `init.{os}` | 按当前操作系统取对应命令 |
| 验证 CLI 版本 | `versionCheck.command.{os}` | 版本号需 ≥ `versionCheck.minVersion` |
| 登录鉴权 | `auth.{os}` | 一键授权 |
| 退出授权 | `unAuth.{os}` | 退出登录 |
| 检查鉴权状态 | `status.{os}` | 成功时返回 JSON 匹配 `statusMatchJson` |
| 授权域名 | `authUrlDomain` | 浏览器授权页面域名 |

其中 `{os}` 为 `darwin` / `linux` / `win32`。

## 执行流程

```
步骤 1：环境检查      步骤 2：鉴权检查      步骤 3：意图识别      步骤 4：路由分发
─────────────────→ ──────────────────→ ──────────────────→ ──────────────────→
安装/升级 CLI          验证 API Key 状态      匹配用户意图         引导到对应子技能
```

---

## 步骤 1：环境检查

### 1A. 检查 Node.js 版本

根据 `cli.json` 中 `runtime.version` 要求的版本号，执行 `node --version` 验证。不满足时告知用户。

### 1B. 安装/升级 CLI

读取 `cli.json` → `init`，按当前操作系统执行对应的安装命令。

### 1C. 验证 CLI 版本

读取 `cli.json` → `versionCheck.command`，按当前操作系统执行，确认版本 ≥ `versionCheck.minVersion`。版本过低时 CLB 会提示升级。

---

## 步骤 2：鉴权检查

> ⚠️ 鉴权是所有子技能的**前置条件**，必须先通过才能路由到业务 Skill。

### 2A. 检查鉴权状态

读取 `cli.json` → `status`，按当前操作系统执行。返回 JSON 匹配 `statusMatchJson`（默认 `{"status": "active"}`）→ 鉴权有效，进入步骤 3；否则进入步骤 2B。

### 2B. 引导用户完成鉴权

向用户说明：

> 使用腾讯广告技能需要先完成授权。请按以下步骤操作：

**方式一：一键授权（推荐）**

读取 `cli.json` → `auth`，按当前操作系统执行。执行后会打开浏览器引导用户授权，完成后自动保存凭据。

**方式二：手动配置 API Key（备用）**

如无法使用浏览器，向用户说明：

> 请提供你的腾讯广告 API Key（格式：`mkt_` 开头的字符串）。
> API Key 可从腾讯广告平台的开发者设置中获取。

收到 API Key 后，进入 `skills/tencentads/tencentads-auth` 目录执行：

```bash
cd skills/tencentads/tencentads-auth
node scripts/auth-save-apikey.mjs --api-key <用户提供的API Key>
node scripts/auth-status.mjs
```

> **安全原则**：API Key 不应在对话窗口中回显。收到 Key 后立即调用脚本保存，不要在回复中展示。

鉴权成功后，进入步骤 3。

---

## 步骤 3：意图识别与路由分发

根据用户意图，匹配到对应的子技能。下方是完整的路由表，**按优先级从高到低**匹配：

### 路由决策表

> ⛔ **路由规则**：从上到下依次匹配，命中即停止，同一请求只路由到一个子技能。

| 优先级 | 用户意图 / 关键词 | 路由目标 | 说明 |
|--------|------------------|----------|------|
| **P0** | 授权/登录/API Key/认证失败/AUTH_REQUIRED/AUTH_EXPIRED | `tencentads-auth` | 鉴权问题最高优先处理 |
| **P0** | "创建" + 智投/艾米/AIM+/全店托管/短直双开/小店智投/爆剧跑量/小游戏跑量/线索跑量/商品智投/小说智投/全域通/视频号直播智投/APP游戏智投/APP阅读智投/AI应用智投 | `tencentads-delivery-smart-create` | ⚠️ "推商品"不带"智投"二字属于小店 category，但"推商品智投"带"智投"属于商品智投(category 生态) |
| **P1** | "创建广告"/"创建营销单元" + 非智投/手动版位/CPC/CPM/oCPM | `tencentads-delivery-standard-create` | 用户未提智投关键词时默认走常规创建 |
| **P2** | "修改"/"更新"/"调整" + 广告/项目/出价/预算/定向/日期/时段/状态 | `tencentads-delivery-standard-update` | 更新操作，支持单条和批量 |
| **P3** | 消耗/花费/曝光/点击/点击率/CTR/转化/转化成本/转化率/ROI/分时/按天/趋势/效果数据/汇总 | `tencentads-management` (query-report) | **必须明确提到指标关键词**（消耗、曝光、点击、转化、ROI等）才走报表 |
| **P4** | "查广告"/"查项目"/"看广告"/"看下创意"/"广告详情"/"定向"/"出价"/"版位"/"关键词"/"否定词"/操作日志 | `tencentads-management` | 实体查询（非报表）。含 query-adgroups、query-creatives、bidword、negativewords、operation-logs |
| **P5** | 账户余额/账户预算/日预算/广告主/资金账户/客户账号 | `tencentads-advertiser` | 广告主信息查询 |
| **P6** | 创意/动态创意/新建创意/素材标签/material_label | `tencentads-creatives` | 创意管理（创建/管理） |
| **P7** | 修改创意/更新创意/删除创意 中的创意 | `tencentads-creatives` | 创意更新/删除也是创意管理的一部分 |

### 特殊歧义消解规则

#### 规则 A："创建广告"到底是智投还是常规？

| 用户说法 | 路由 |
|---------|------|
| 含智投/AIM+/艾米/全店托管/跑量/短直双开 等关键词 | `tencentads-delivery-smart-create` |
| 不含以上任何关键词 | `tencentads-delivery-standard-create`（默认） |

#### 规则 B："看广告/创意数据"到底是报表还是实体？

| 用户说法 | 是否含效果指标词 | 路由 |
|---------|----------------|------|
| "查广告消耗"/"看曝光点击" | ✅ 有（消耗/曝光/点击/转化等） | `tencentads-management` (query-report) |
| "查广告"/"看下创意"/"广告数据" | ❌ 无 | `tencentads-management` (query-adgroups/creatives) |

> **核心判断**：仅有"数据"二字但不带消耗/曝光/点击等指标词 → 默认视为实体查询。只有明确提到指标时才走报表。

#### 规则 C："项目" vs "广告" 术语说明

| 用户术语 | 对应概念 | 在 management 中的 `tencent_ads_type` |
|---------|---------|--------------------------------------|
| "项目"、"智投项目"、"智能投放项目" | 智投项目 | `"smart"` |
| "竞价广告"、"3.0广告"、"非智投"、"常规广告" | 标准广告 | `"standard"` |
| 只说"广告"、未明确类型 | 全部 | `"all"`（默认） |

#### 规则 D：多意图判发

- 用户说"两种都看"、"智投和非智投都要" → 在 management 中先查智投(`GREATER_EQUALS`)，再查非智投(`LESS`)，两次请求串行
- 用户说"先查广告，再创建广告" → 依次路由到 management → 对应的 create skill

---

## 步骤 4：路由分发

确认目标子技能后，切换上下文到该技能，由它完成具体的业务操作。

| 子技能名称 | 用途 | 关键说明 |
|-----------|------|---------|
| `tencentads-auth` | 鉴权凭证管理 | API Key 保存/验证/退出；所有子技能的认证基础 |
| `tencentads-advertiser` | 广告主信息查询 | 账户列表、日预算、余额、资金账户 |
| `tencentads-management` | 综合数据管理 | 报表查询（854个指标）、广告/创意详情、关键词/否定词管理、操作日志 |
| `tencentads-creatives` | 创意管理 | 动态创意创建/查询/更新/删除、素材标签管理 |
| `tencentads-delivery-smart-create` | 智投广告创建 | AIM+ 7步创建流程，按步骤1→7顺序执行 |
| `tencentads-delivery-standard-create` | 常规广告创建 | 标准投放 7步创建流程，按步骤1→7顺序执行 |
| `tencentads-delivery-standard-update` | 广告/项目通用更新 | 支持单条和批量更新多个字段 |

---

## 常见错误处理

### 错误 1：未安装 CLI

用户未安装 `tencentads-cli` 时，`tencentads` 命令不可用。此时：
1. 先执行步骤 1B 安装 CLI
2. 再继续后续流程

### 错误 2：鉴权失败

子技能返回 `AUTH_REQUIRED` / `AUTH_EXPIRED` / `未找到腾讯广告认证凭据` 等错误时：
1. 路由到 `tencentads-auth` 技能
2. 引导用户重新授权
3. 鉴权成功后重新执行原操作

### 错误 3：意图不明确

当用户输入无法唯一匹配到某一个子技能时（如只说"帮我操作广告"），向用户确认：
- 查询还是创建？
- 智投还是常规？
- 如无法判断，按默认规则（P7 为背景兜底）

---

## 相关技能

- 所有 `tencentads-*` 系列技能共享 `tencentads-cli` 环境
- 所有 `tencentads-*` 系列技能共享 `tencentads-auth` 的鉴权凭据
- 各子技能之间通过代理自动协同，无需用户手动切换

---

## 执行原则

1. **先环境，后业务**：环境检查未通过（CLI 未装/版本过低/未鉴权），不进入业务路由
2. **鉴权失败立即终止业务路由**：先解决鉴权问题
3. **路由优先于执行**：收到请求后先判断属于哪个子技能，再切换上下文执行
4. **同一请求只路由一个子技能**：除非用户明确要求多步操作
5. **意图不明确时确认，不猜测**：无法判断智投/常规时，默认走常规；无法判断报表/实体时，默认走实体

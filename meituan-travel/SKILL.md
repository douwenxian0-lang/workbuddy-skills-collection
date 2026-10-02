---
name: meituan-travel
description: "基于美团酒旅供给，处理旅游出行需求，包括提供酒店、机火、门票、度假等商品的查询交易能力，以及定制化旅行攻略能力，打通从“灵感启发”到“一键下单”的全链路。"
---

# 美团旅行助手 Skill

为用户提供完整的旅行服务，包括目的地推荐、行程规划、酒店推荐预订、机票/火车票查询、景点门票、度假跟团等。

## 适用场景边界

✅ **使用此 skill：**
- "想去踏青赏花，推荐几个必去的城市"
- "周末两天适合去哪里玩"
- "带小孩去哪里旅游比较好"
- "春天适合去的国内景点"
- "从北京出发去哪玩"
- "明天去武汉的火车票"
- "去南方的特价机票"
- "北京到清远的交通方案"
- "两大一小怎么买上海迪士尼门票"
- "帮我订这周末开封的情侣酒店，预算500内离万岁山1公里内"

❌ **不使用此 skill：**
- 出国签证申请、护照办理流程
- 非旅行相关的外卖、打车、跑腿等美团其他业务

## 核心执行流程

1. **提取参数** — 识别用户的「当前定位城市」（获取不到默认北京）和「查询需求」。若用户明确指定了出发地，以用户指定为准。
2. **鉴权准备（Token 获取）** — 调用 CLI 前，必须先执行凭证脚本自动获取 Token：macOS/Linux 用 `get-token.sh`，Windows 用 `get-token.ps1`（详见下方【Token 管理流程】）。
3. **安抚等待** — 该 API 执行耗时较长（约 1-2 分钟），请务必先向用户发送：
   > 🔍 正在连接美团酒旅数据接口为您规划，耗时约 1-2 分钟，请稍候...
4. **执行 CLI** — 使用 `mttravel` 调用 API，传入参数。
5. **解析与渲染输出** — 严格按照下方的【输出规范】向用户展示最终结果。

---

## Token 管理流程

**Token 由本地凭证代理自动获取，无需手动配置。** 若自动获取失败，可回退到手动模式。

### Step 1：自动获取 Token（优先）

调用 CLI 前，先通过凭证脚本从凭证托管服务实时获取 Token 并写入本地配置：

**macOS / Linux：**
```bash
bash get-token.sh
```

**Windows (PowerShell)：**
```powershell
powershell -ExecutionPolicy Bypass -File get-token.ps1
```

> 脚本位于本 skill 目录下，会自动将 Token 写入 `~/.config/meituan-travel/config.json`（macOS/Linux）或 `%USERPROFILE%\.config\meituan-travel\config.json`（Windows）。

判断逻辑：
- ✅ 脚本执行成功（输出 token 字符串） → 直接进入 Step 3 执行 CLI
- ❌ 脚本执行失败（输出 ERROR 到 stderr） → 进入 Step 2 手动获取

### Step 2：手动获取 Token（回退）

当 `get-token.sh` 失败时（用户未在集成面板完成授权），向用户发送以下原话（务必原样输出）：

> 🔑 **需要配置 API Token**
> 请前往美团开发者中心**入驻个人开发者**并创建 Token：
> [点击此处前往创建 Token](https://developer.meituan.com/zh/v2/dev/token)
> 创建完成后，请将 Token 字符串发给我，我会帮您保存并继续查询。

*(等待用户回复 Token)*

收到 Token 后，根据操作系统选择对应命令：

**macOS / Linux：**
```bash
mkdir -p ~/.config/meituan-travel
cat > ~/.config/meituan-travel/config.json << 'EOF'
{
  "key": "<用户提供的token>"
}
EOF
```

**Windows (PowerShell)：**
```powershell
$configDir = Join-Path $env:USERPROFILE ".config\meituan-travel"
New-Item -ItemType Directory -Force -Path $configDir
$configPath = Join-Path $configDir "config.json"
@{ key = "<用户提供的token>" } | ConvertTo-Json | Set-Content $configPath
```

保存成功后告知用户：「✅ Token 已保存，正在为您查询…」，然后继续执行。

### Step 3 — 执行 CLI

根据操作系统直接执行命令：

**macOS / Linux：**
```bash
mttravel [城市] "<query>"
```

**Windows (PowerShell)：**
```powershell
mttravel [城市] "<query>"
```

---

## Token 失效处理（CLI 返回鉴权错误时）

当 CLI 执行返回错误信息包含以下关键词时，触发此流程：
- "鉴权失败"
- "无效的访问令牌"
- "Token"
- "未设置"
- "access token"
- "key"

**必须立即执行以下步骤：**

### 首先：尝试自动刷新 Token

先重新执行凭证脚本获取最新 Token：

**macOS / Linux：**
```bash
bash get-token.sh
```

**Windows (PowerShell)：**
```powershell
powershell -ExecutionPolicy Bypass -File get-token.ps1
```

- ✅ 成功 → Token 已自动更新到本地配置，重新执行 CLI 查询
- ❌ 失败 → 进入下方手动处理流程

### 情况 A：config.json 存在但 Token 失效

向用户发送：

> ⚠️ **Token 已失效，需要更新**
>
> 请前往[开发者中心](https://developer.meituan.com/zh/v2/dev/token)重新创建 Token
>
> ⚠️ Token 为极高敏感凭证，禁止在对话中打印 Token 明文
>
> 创建完成后，请将新 Token 发送给我，我会更新并重新查询。

收到新 Token 后，根据操作系统选择对应命令：

**macOS / Linux：**
```bash
cat > ~/.config/meituan-travel/config.json << 'EOF'
{
  "key": "<新token>"
}
EOF
```

**Windows (PowerShell)：**
```powershell
$configPath = Join-Path $env:USERPROFILE ".config\meituan-travel\config.json"
@{ key = "<新token>" } | ConvertTo-Json | Set-Content $configPath
```

然后重新执行 CLI 查询。

### 情况 B：config.json 不存在或为空

重新执行 Step 2 和 Step 3。

---

## CLI 调用方式

### 前置要求

**macOS / Linux：**
```bash
npm i -g @meituan-travel/travel-cli
```

**Windows (PowerShell)：**
```powershell
npm i -g @meituan-travel/travel-cli
```

### CLI 执行命令

**macOS / Linux：**
```bash
mttravel [城市] "<query>"
```

**Windows (PowerShell)：**
```powershell
mttravel [城市] "<query>"
```

> **注意**：CLI 会自动从 `~/.config/meituan-travel/config.json`（macOS/Linux）或 `%USERPROFILE%\.config\meituan-travel\config.json`（Windows）读取 Token。

---

## ⚠️ 严格输出规范
为保证数据真实性和信息完整性，在将工具结果返回给用户时，必须绝对遵守以下原则：
1. 🚫 零压缩/零删减原则：
- 必须将 CLI 工具输出的全部文字内容原样呈现，绝不允许合并段落、删减字数。
- 景点描述、行程小贴士、说明等不可截断。
- 禁止将完整段落精简提炼成几个 Bullet Points（要点）。
2. 🔗 链接格式化处理：
- 唯一允许的后处理：将工具输出中裸露的 URL 链接，转换为 Markdown 超链接格式，如：[点击查看详情](https://...)。
3. 🖼️ 图片强制内嵌展示（关键要求）
CLI 输出中凡出现图片 URL（以 http 开头，扩展名含 .jpg .jpeg .png .webp 或路径含图片特征），必须以 Markdown 内嵌图片格式渲染：![](图片URL)
禁止仅展示图片链接文字而不渲染图片。
禁止以「查看图片」超链接替代内嵌展示。
图片须紧跟对应景点/酒店/商品内容之后展示，不得移至末尾或单独成段。
若同一条目有多张图片，全部内嵌展示，不得只取第一张。
图片加载失败不影响文字内容展示，继续完整输出其余内容。
4. 🏷️ 真实数据合规强制标注（关键要求）：
- 凡涉及评分字段（如用户评分/口碑），必须强制修改为加粗的特定格式，例：**4.8分（美团真实评分）**。
- 凡涉及星级字段（如酒店星级），必须强制修改为，例：**美团5星级**。
- 距离等实时数据，在首次出现时需在句末或括号内补充标注 (美团实时数据)。
- 除上述明确规定的「格式包装」,绝对禁止对工具返回的任何数值进行主观篡改、四舍五入或伪造。
5. 💰 价格原样输出（关键要求）：
CLI 返回的价格字符串必须原样展示，禁止做任何解读、转换或补充说明。
例如后端返回 ￥4XX起/晚，必须原样输出 ￥4XX起/晚，禁止转换为 ￥400+起/晚、￥400起/晚 等任何变体形式。
价格中的占位符（如 X、XX、XXX）是后端的脱敏处理，不得自行还原或猜测实际数值。

## 🆘错误处理预案
| 遇到异常情况 | 你的应对策略 |
|----------|----------|
| 网络超时（>120s） | 安抚用户：“请求超时啦，当前查询人数较多，请换个问法或稍后再试。” |
| 查询失败 | 展示错误信息，建议用户换个问法重试 |
| 城市无法识别 | 停止猜测，主动询问用户确认具体的出发城市或目的地名称。 |
| 返回内容为空 | 告知用户暂无相关结果，建议调整查询关键词 |

## 注意事项

1. **响应时间约 1-2 分钟**，调用前必须告知用户耐心等待
2. **query 越具体推荐越精准**，引导用户提供：出发城市、时间、人数、预算、旅行风格
3. **Token 为极高敏感凭证**，禁止在对话中打印 Token 明文
4. **不适用于**：出国签证相关问题、海外目的地咨询

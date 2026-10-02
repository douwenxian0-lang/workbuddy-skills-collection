---
name: aippt
description: "当用户明确要求使用 AI 智能设计生成 PPT 演示文稿时使用本技能（智绘高迪/AIPPT）。本技能调用智绘高迪 Design Agent v2（选项版）API，通过对话与用户协作完成「需求确认 → 配色选择 → 大纲确认 → 后台渲染」全流程。当用户说'AI生成PPT'、'智绘PPT'、'自动生成演示文稿'、'帮我做个PPT'时触发。注意：本技能仅用于生成全新的 PPT，不用于读取、解析或编辑已有的 .pptx 文件——编辑已有文件请使用 pptx 技能。"
---

# AIPPT Skill — AI 智能 PPT 生成（v2 选项版）

通过智绘高迪 Design Agent v2 API，按 **「启动 → 轮询 → 两步交互（需求 + 配色）→ 交接 Web 端确认大纲」** 与用户协作完成 PPT。

> ⚠️ **重要变更**：大纲生成耗时较长，因此 **qclaw 端只完成需求确认（3.1）和配色选择（3.2）两步交互**；当 3.2 的 resume 调用成功后，**立即停止本地轮询**，直接给用户编辑链接，引导其到高迪 Web 端确认大纲并查看最终生成结果。**不要再在 qclaw 端等待 / 处理 `pptOutlineDecide`**。

> **Windows 用户**：所有 `bash` 命令请替换为对应的 `powershell -ExecutionPolicy Bypass -File` 版本，详见下方双版本示例。Windows 下使用 `python` 而非 `python3`。

---

## ⚠️ 调用前必须输出提示（MANDATORY）

**在执行 `generate.sh` 之前**，必须先向用户输出以下温馨提示：

```markdown
> 💡 **温馨提示**
> PPT 生成过程会持续消耗积分；如需终止任务，请进入下方编辑链接在智绘高迪平台操作。每张 PPT 平均消耗约 0.5 积分。
```

---

## 🧭 Agent 必读约束清单（先读这里）

执行本 skill 时，下列约束**全部强制**，违反即视为执行错误。每条都有详细章节，先在这里建立索引：

1. **链接格式**：所有给用户的编辑地址必须是 `https://goatdee.qq.com/ppt/{projectId}?from=qclaw`（含 `?from=qclaw`），优先直接用脚本返回的 `workspaceUrl`。详见 [输出链接地址规则](#输出链接地址的严格规则mandatory)
2. **输出格式**：面向用户的输出必须严格套用 5 个模板（A/B/C/E/F），不允许自由发挥。详见 [输出格式规范](#输出格式规范mandatory)
3. **PROMPT 不要擅自加页数**：用户没说页数就**绝对不要**在 PROMPT 里写"X 页"。详见 [页数规则](#关于页数的严格规则mandatory)
4. **本地只交互 2 步**：qclaw 端**只处理** `pptIntakeQuestions`（3.1）和 `pptIntakeStyleCards`（3.2）；**3.2 的 `resume.sh` 调用成功后立即停止轮询**，按格式 E 输出链接，让用户去高迪 Web 端确认大纲。**绝对不要**继续 poll 等待 `pptOutlineDecide`，也不要在 qclaw 端处理它。详见 [Step 4：交接 Web 端](#step-4交接-web-端处理大纲)
5. **启动后不暴露链接**：格式 A（启动后输出）**不包含** projectId 和编辑链接——链接只在格式 E（配色完成交接）或格式 F（熔断）时才首次给用户。`projectId` / `sessionId` / `workspaceUrl` 是 Agent 内部状态，启动阶段**不要回显给用户**
6. **不擅自代答 + skip 作用域**：3.1 / 3.2 的所有问题都必须由用户明确回答；用户答得含糊/漏题才追问一次，答完整就直接 submit；用户**明确**说"跳过本题/不答了/这题用默认"才允许走 `skip`。`skip` **只跳过当前这一个 interrupt 步骤**：3.1 跳过仍会进入 3.2；3.2 跳过 / 完成后**直接交接 Web 端**结束本地流程。详见 [Step 3 入口规则](#step-3处理-interrupt与用户对话)
7. **轮询退避 + 熔断**：等 interrupt 时按 `5/5/10/20/30/30` 秒退避，6 次仍 `running` 即熔断、按格式 F 输出链接结束。详见 [Step 2 退避规则](#轮询退避与熔断规则mandatory)
8. **编码安全**：默认走环境变量即可；仅在 Windows + 中文出现乱码时才切文件传参。详见 [编码要求](#编码要求mandatory)
9. **interrupt actions 速查**：`pptIntakeQuestions` / `pptIntakeStyleCards` 支持 `submit` / `skip`；`pptOutlineDecide` 支持 `approve` / `edit`，**但本 skill 不在本地处理它**

---

## 总体流程（状态机）

```
┌─────────────┐
│ generate.sh │  POST /agent/run（SSE）
└──────┬──────┘  → { sessionId, projectId, workspaceUrl }
       │
       ▼
┌─────────────────────────────────────────┐
│ 循环：poll.sh                            │
│   GET /agent/events?sessionId=xxx        │
│   读取 data.state：                      │
│     · running        → 按退避表 sleep 再 poll │
│     · awaiting_input → 处理 interrupt    │
│     · executing      → 退出循环          │
└──────┬──────────────────────────────────┘
       │ 命中 awaiting_input
       ▼
┌─────────────────────────────────────────┐
│ 根据 data.interrupt.type 与用户对话：     │
│   · pptIntakeQuestions  → 问答收集 → resume → 回到 poll │
│   · pptIntakeStyleCards → 选配色卡 → resume → ★ 直接交接 Web 端，结束本地流程 │
│   · pptOutlineDecide    → 不应在本地出现；若出现立即按格式 E 交接 Web 端     │
└─────────────────────────────────────────┘
```

执行规约：
- 本 skill 在本地**只处理 2 个 interrupt**（`pptIntakeQuestions` → `pptIntakeStyleCards`）
- 完成 3.1 resume 后 → **回到 Step 2 继续 poll** 等下一个 interrupt（应为 3.2）
- 完成 3.2 resume 后 → **立即停止轮询**，按 [输出格式 E](#e-配色完成后交接-web-端step-4) 输出编辑链接结束流程；**不要**继续 poll，更**不要**等 `executing` 或 `pptOutlineDecide`
- 每完成一个 resume 后，**1-2 秒内** events 可能仍返回上一阶段状态（accepted 异步生效），稍等再 poll 即可
- 若中途收到 `state == "executing"`（极少出现，可能用户跳过了配色），同样按格式 E 输出链接结束

---

## Step 1：启动任务

**默认走环境变量即可**（macOS / Linux 即使中文也没问题）：

```bash
PROMPT="制作一个关于人工智能发展趋势的商业演示" bash __SKILL_DIR__/scripts/generate.sh
```

```powershell
$env:PROMPT="制作一个关于人工智能发展趋势的商业演示"; powershell -ExecutionPolicy Bypass -File "__SKILL_DIR__/scripts/generate.ps1"
```

**仅当**：① Windows 平台 **且** ② `PROMPT` 含中文 **且** ③ 实际跑出来发现乱码 → 才需要走文件方式：

```powershell
# 1. Agent 用 write_to_file 写 UTF-8 文件：__SKILL_DIR__/.tmp/prompt.txt
# 2. 命令行只传 ASCII 路径
$env:PROMPT_FILE="__SKILL_DIR__/.tmp/prompt.txt"; powershell -ExecutionPolicy Bypass -File "__SKILL_DIR__/scripts/generate.ps1"
```

> 详见 [⚠️ 编码要求](#编码要求mandatory)。**默认情况下不要为了"以防万一"而提前写文件——多一次 tool call 是真负担。**

**输出 JSON 示例**（必须解析记录 `sessionId` 和 `projectId`，后续每一步都要用）：

```json
{
  "success": true,
  "projectId": "69def187a7e1519b00d4708e",
  "sessionId": "6a1d139fb11efe1894c98adf",
  "sessionIds": ["6a1d139fb11efe1894c98adf"],
  "workspaceUrl": "https://goatdee.qq.com/ppt/69def187a7e1519b00d4708e?from=qclaw",
  "message": "PPT 任务已启动..."
}
```

> 如果 `sessionId` 字段为空，回退使用 `sessionIds[0]`。
> `workspaceUrl` 由脚本兜底拼上 `?from=qclaw`，无需 Agent 二次处理。

启动成功后**严格按 [输出格式 A](#a-启动后输出step-1-完成) 向用户输出**（注意：**不包含** projectId 和编辑链接），然后进入 Step 2。

---

## Step 2：轮询状态

**macOS / Linux：**

```bash
SESSION_ID="6a1d139fb11efe1894c98adf" bash __SKILL_DIR__/scripts/poll.sh
```

**Windows (PowerShell)：**

```powershell
$env:SESSION_ID="6a1d139fb11efe1894c98adf"; powershell -ExecutionPolicy Bypass -File "__SKILL_DIR__/scripts/poll.ps1"
```

**响应结构**：

```json
{
  "statusCode": 200,
  "data": {
    "sessionId": "...",
    "state": "running" | "awaiting_input" | "executing",
    "interrupt": { ... },          // 仅 awaiting_input 时出现
    "updatedAt": "..."
  }
}
```

**根据 `data.state` 决策**：

| state | 行为 |
|-------|------|
| `running` | 按下方退避表等待后**重新调用 poll**（继续等下一个 interrupt） |
| `awaiting_input` | 进入 Step 3，处理 `data.interrupt`（仅当 type 为 `pptIntakeQuestions` / `pptIntakeStyleCards` 时；若 type 为 `pptOutlineDecide` 直接走 [Step 4 交接](#step-4交接-web-端处理大纲)） |
| `executing` | **退出循环**，按 [输出格式 E](#e-配色完成后交接-web-端step-4) 交接 Web 端 |

> ⚠️ **本地只跑 2 轮"等 interrupt"循环**：第 1 轮等 3.1（`pptIntakeQuestions`），第 2 轮等 3.2（`pptIntakeStyleCards`）。**3.2 resume 成功后不再回到 Step 2**，直接走 Step 4 输出链接结束。

### ⚠️ 轮询退避与熔断规则（MANDATORY）

**单次"等 interrupt"循环的退避间隔（秒）严格遵循下表，最多 6 次后熔断**：

| 第 N 次轮询 | 等待时间 | 累计耗时 |
|------------|---------|---------|
| 1 | 5s  | 5s   |
| 2 | 5s  | 10s  |
| 3 | 10s | 20s  |
| 4 | 20s | 40s  |
| 5 | 30s | 70s  |
| 6 | 30s | 100s |

执行规约：
- 每次调 `poll.sh` 前按上表 `sleep`，然后 poll 一次；返回 `running` 则继续下一行；返回 `awaiting_input` / `executing` 则**立即跳出**
- 6 次轮询后仍是 `running` → **触发熔断**：停止继续轮询，按 [熔断输出格式](#熔断输出格式) 直接给用户输出 `workspaceUrl`，让其去 Web 端继续操作
- **每完成一个 resume 后，退避计数重新从第 1 次开始**（因为上游进入下一阶段，不复用之前的累计）
- **3.2 的 resume 成功后不再启动新的退避循环**（本地不再 poll 大纲）
- 单次轮询脚本自身超时 30s（脚本内置），与上面退避表是两个维度
- 轮询过程对用户保持**克制**：除了每个阶段的"已开始等待平台问询"和熔断/拿到 interrupt 时，**不要在中间逐次刷屏**

---

## Step 3：处理 Interrupt（与用户对话）

读取 `data.interrupt.type`，本地**只处理** `pptIntakeQuestions`（3.1）和 `pptIntakeStyleCards`（3.2）两类。每一类都需要：①把信息整理后呈现给用户；②等待用户回答；③组装 `ACTION_JSON` 调 `resume.sh`；④回到 Step 2 继续 poll（**3.2 例外：resume 成功后直接走 Step 4，不再 poll**）。

> 若 `type == "pptOutlineDecide"`：本 skill 不在 qclaw 端处理，**立即按 [输出格式 E](#e-配色完成后交接-web-端step-4) 输出链接交接 Web 端**，结束本次流程。

### ⚠️ 用户回答的确认规则（MANDATORY）

**仅在用户回答缺失或含糊时才二次确认；用户答完整就直接 submit，不要让用户再确认一次。**

- **不允许擅自代答**：任何 `questions[]` 中的题目，都不能由你根据 PROMPT/上下文自行推断答案；选项也不能擅自挑选默认值
- **缺答 / 含糊才追问一次**：如果用户的回复**遗漏了任何一题**、回答模糊（如"随便"、"你看着办"、"差不多就行"）、或回答与该题选项 / `customInputType` 不匹配 → 按下方"追问输出格式"再问一次，**不要**直接 submit
- **配色同样适用**：
  - `pptIntakeStyleCards`：用户必须明确指认 1 个候选；如回复"都行"/"你帮我选"，需重新呈现 3 张卡片让其再选
- **答案完整 → 直接 submit**：用户已对所有题目给出明确答复时，直接拼 ACTION_JSON 调 resume，不要再回显"我即将提交…请你确认"

#### `skip` 使用边界（仅 3.1 / 3.2 适用）

`pptIntakeQuestions` / `pptIntakeStyleCards` 的 `actions[]` 都允许 `skip`，但有严格使用条件：

- 🎯 **作用域（最关键）**：`skip` **只跳过当前这一个 interrupt 步骤**，平台会按该步默认值继续；但流程**不会终止**——
  - 3.1 跳过 → 平台用默认意图参数生成草稿，**仍会**进入 3.2 让用户选配色
  - 3.2 跳过 → 平台用默认配色继续，**本 skill 立即按 [输出格式 E](#e-配色完成后交接-web-端step-4) 交接 Web 端**，由用户在高迪上确认大纲并查看生成结果
  - **绝对不要**把"跳过"理解成"跳过整个 PPT 生成流程"
- ✅ **允许 skip**：用户**明确**说"跳过本题"、"这题不答"、"这题用默认"、"都不喜欢，这步按默认配色"
- ❌ **不允许 skip**：用户回答含糊（"随便"、"你定"、"都行"、"你帮我选"）——这种情况按上面的"缺答 / 含糊才追问一次"处理，**不能**当作 skip 提交
- 当用户在 3.1 说"跳过"但语义不清时，**先追问澄清**："跳过这一题，后面的配色还是会让你选，可以吗？"
- 在 3.1 / 3.2 输出模板里都要附带"跳过本题/本步"的提示，给用户一个明示的逃生通道
- skip 的 ACTION_JSON 永远是：`{ "type": "skip" }`（无 `params`）

追问输出格式（仅当出现漏答/含糊时使用）：

```markdown
🔁 **以下问题还需要你明确回答**，我才能继续：

- 第 X 题：**{question}**（参考选项：{options}）
- 第 Y 题：**{question}**（参考选项：{options}）

请逐条给出明确答复（不要回"随便"或"你定"）。
```

---

### 3.1 `pptIntakeQuestions`（意图确认）

**interrupt 数据**：
```json
{
  "id": "ae9856ba-...",
  "type": "pptIntakeQuestions",
  "actions": ["submit", "skip"],
  "data": {
    "questions": [
      {
        "id": "q_audience",
        "question": "目标受众是谁？",
        "options": ["企业高管", "技术团队", "投资人"],
        "allowMultiple": false,
        "allowCustom": true,
        "customInputType": "text"
      }
      // ...
    ]
  }
}
```

**对用户呈现**：把所有 `questions[]` 列出来，标号 1/2/3，附 `options` 作为参考选项。如果 `allowCustom=true`，告诉用户可以自由作答。同时附"不想答可以直接说『跳过本题』，**只跳过这一题**，后面还会让你选配色"的逃生通道（详见 [skip 使用边界](#skip-使用边界仅-31--32-适用)）。

**ACTION_JSON 模板**：

- 用户答完了 → `submit`（`answers` 的 key **必须**用 `questions[].id`）：

```json
{
  "type": "submit",
  "params": {
    "answers": {
      "q_audience": "企业高管",
      "q_page_count": "10-15",
      "q_style": "科技蓝 (深蓝/浅灰色系)"
    }
  }
}
```

- 用户明确要求跳过 → `{ "type": "skip" }`

### 3.2 `pptIntakeStyleCards`（配色方案选择）

**interrupt 数据**（注意：`poll.sh` / `poll.ps1` 已对原始上游响应做后处理——把 `previewBase64` 解码落盘到 `__SKILL_DIR__/.tmp/style-{candidateId}.png`，并将字段替换为 `previewPath`。**Agent 看到的就是路径，不会看到 base64**）：

```json
{
  "id": "b123c64b-...",
  "type": "pptIntakeStyleCards",
  "actions": ["submit", "skip"],
  "data": {
    "styleCards": [
      {
        "candidateId": "c_0",
        "title": "经典墨绿金",
        "desc": "深邃墨绿搭配古铜金...",
        "previewPath": "/Users/.../skill_dir/.tmp/style-c_0.png"   // 由脚本写入；绝对路径
      }
      // ... 通常 3 个
    ]
  }
}
```

> ⚠️ **绝对禁止**：在输出 markdown 时使用 `data:image/png;base64,...` 这种内嵌 base64 形式——base64 字符串过长会被 LLM 流式逐 token 输出，用户体验极差。**永远使用 openclaw 的 `local://` 自定义协议引用 `previewPath`**，下文格式 C 给出标准写法。

**对用户呈现**：把每张 `styleCards[]` 的 `title` + `desc` 列出来，并把 `previewPath` 用 openclaw 的 `local://` 协议内嵌图片：`![](local://{previewPath})`。让用户**看图选 1 个**。**不要**让用户输入 `candidateId`，由你根据用户口语化的回答（"第 1 个"/"墨绿那个"）映射回 `candidateId`。同时附"都不喜欢可直接说『跳过本步』，**只跳过配色选择**，之后会到高迪 Web 端确认大纲并查看生成结果"的逃生通道（详见 [skip 使用边界](#skip-使用边界仅-31--32-适用)）。

> ⚠️ **关键**：3.2 的 resume 调用成功后，**不要再回到 Step 2 继续 poll**——直接按 [输出格式 E](#e-配色完成后交接-web-端step-4) 输出编辑链接结束本次 skill 流程，把大纲确认与最终生成都交给 Web 端。

**ACTION_JSON 模板**：

- 用户选了某套 → `submit`（`selectedCandidateId` **必须**命中 `styleCards[].candidateId`）：

```json
{
  "type": "submit",
  "params": {
    "selectedCandidateId": "c_0"
  }
}
```

- 用户明确要求跳过 → `{ "type": "skip" }`

### 3.3 `pptOutlineDecide`（大纲确认）— ⚠️ **本地不处理，仅作为 API 参考**

> 🚫 **本 skill 不在 qclaw 端处理大纲确认**。如果 poll 真的拿到 `type == "pptOutlineDecide"` 的 interrupt（一般不会，因为 3.2 resume 后即停止轮询），**立即按 [输出格式 E](#e-配色完成后交接-web-端step-4) 交接 Web 端**，**不要**继续呈现大纲、**不要**调 `resume.sh`。
>
> 下面的字段说明仅供排错参考，**正常流程下不会执行**。

<details>
<summary>展开查看（仅参考，请勿在本地执行）</summary>

**interrupt 数据**：
```json
{
  "id": "5081ab29-...",
  "type": "pptOutlineDecide",
  "actions": ["approve", "edit"],
  "data": {
    "outline": [
      {
        "id": "p_0",
        "pageType": "cover",
        "title": "小米汽车技术解析",
        "corePoints": "面向汽车从业者的竞品分析..."
      }
    ]
  }
}
```

`actions` 含 `approve` / `edit`（**没有 `skip`**）。`edit.params.edits[].pageId` 必须命中 `outline[].id`，仅支持改 `title` / `corePoints`，不支持新增/删除页。

</details>

### 3.x 调用 resume.sh

**默认走环境变量即可**：

```bash
SESSION_ID="6a1d139fb11efe1894c98adf" \
INTERRUPT_ID="ae9856ba-..." \
ACTION_JSON='{"type":"submit","params":{"answers":{"q_audience":"企业高管"}}}' \
  bash __SKILL_DIR__/scripts/resume.sh
```

```powershell
$env:SESSION_ID="6a1d139fb11efe1894c98adf"
$env:INTERRUPT_ID="ae9856ba-..."
$env:ACTION_JSON='{"type":"submit","params":{"answers":{"q_audience":"企业高管"}}}'
powershell -ExecutionPolicy Bypass -File "__SKILL_DIR__/scripts/resume.ps1"
```

**仅当**：① Windows 平台 **且** ② `ACTION_JSON` 含中文（中文 answer 值 / `edits[].title`）**且** ③ 实际跑出来发现乱码 → 才走文件方式：

```powershell
# 1. Agent 用 write_to_file 写 UTF-8 JSON：__SKILL_DIR__/.tmp/action-intake.json
# 2. 命令行只传 ASCII 路径
$env:SESSION_ID="6a1d139fb11efe1894c98adf"
$env:INTERRUPT_ID="ae9856ba-..."
$env:ACTION_FILE="__SKILL_DIR__/.tmp/action-intake.json"
powershell -ExecutionPolicy Bypass -File "__SKILL_DIR__/scripts/resume.ps1"
```

> `{"type":"approve"}` 这种纯 ASCII 永远不需要走文件。

resume 成功（HTTP 200）后：

- **3.1 完成（`pptIntakeQuestions` 的 submit/skip）** → 立刻回到 Step 2 继续 poll，等下一个 interrupt（应为 3.2）
- **3.2 完成（`pptIntakeStyleCards` 的 submit/skip）** → **不要再 poll**，直接进入 [Step 4：交接 Web 端](#step-4交接-web-端处理大纲) 输出链接结束流程

---

## ⚠️ 输出格式规范（MANDATORY）

**所有面向用户的输出，必须严格按下面 5 个模板拼装。** 不允许自由发挥行文、emoji 或顺序。占位符 `{xxx}` 来自脚本返回的 JSON 字段或 interrupt 数据。

### A. 启动后输出（Step 1 完成）

```markdown
🚀 **PPT 生成任务已创建**

正在等待平台询问几个问题以更精准地生成 PPT，请稍候……
```

> ⚠️ **不要在这一步把 `projectId` / 编辑链接给用户。** 链接只在 [格式 E](#e-配色完成后交接-web-端step-4)（配色完成交接）或 [格式 F](#熔断输出格式)（熔断）时才输出。`projectId` / `sessionId` / `workspaceUrl` 是 Agent 内部状态，启动阶段仅用于后续 poll / resume 调用，**不要回显给用户**。

### B. 意图问答输出（Step 3.1 `pptIntakeQuestions`）

```markdown
📝 **请回答以下问题，帮助我更准确地生成 PPT**：

1. **{questions[0].question}**
   - 参考选项：{questions[0].options 用 / 拼接}
   - {若 allowCustom=true 则附："也可以自由作答"}

2. **{questions[1].question}**
   - 参考选项：...

...

💡 **怎么回答比较合适**：
- 每题都要给出明确答复，**不要漏题**，也不要回"随便/你看着办/差不多"
- 推荐格式：`1. 企业高管  2. 10-15 页  3. 科技蓝` 这样按编号逐条回答
- 也可以连贯描述：`目标受众是企业高管，希望 10-15 页，配色偏科技蓝`
- 选项里没有合适的、且该题 `allowCustom=true`，可以直接写自己的答案
- **不想答可以直接说"跳过本题"**——只跳过这一题，平台会用默认意图参数继续；后面**还会**让你选配色、确认大纲
```

### C. 配色卡片输出（Step 3.2 `pptIntakeStyleCards`）

```markdown
🎨 **请从以下 {N} 套配色方案中选 1 套**：

**1. {styleCards[0].title}**
- 风格描述：{styleCards[0].desc}

![{styleCards[0].title} 预览](local://{styleCards[0].previewPath})

**2. {styleCards[1].title}**
- 风格描述：{styleCards[1].desc}

![{styleCards[1].title} 预览](local://{styleCards[1].previewPath})

...

💡 **怎么回答比较合适**：
- 必须明确指认 **1 套**，例如：`第 1 个` / `选 2` / `墨绿金那套`
- 不接受"都行"、"你帮我选"、"随便"这类答复——会再次让你选
- **都不喜欢可以直接说"跳过本步"**——只跳过配色选择这一步，平台会用默认配色；之后请到 Web 端确认大纲
- 如果上方图片**无法显示**，请升级 QClaw 到最新版本以支持本地图片预览
```

> ⚠️ **图片必须用 openclaw 的 `local://` 自定义协议 + `previewPath`**（如 `local:///Users/.../style-c_0.png`，注意三个斜杠：协议头 `local:` + `//` + 绝对路径开头的 `/`）。**绝对禁止**用 `data:image/png;base64,...`、`file://` 或 `https://` —— 前者会让 LLM 流式输出 base64 卡顿，后两者在 openclaw 渲染进程里加载不到。

### D. 配色完成后交接（已废弃，见格式 E）

> 旧的"大纲确认"模板已下线。3.2 配色 resume 成功后**不再**在 qclaw 端展示大纲，**直接走 [格式 E](#e-配色完成后交接-web-端step-4) 交接 Web 端**。

### E. <a id="e-配色完成后交接-web-端step-4"></a>配色完成后交接 Web 端（Step 4）

```markdown
✅ **需求和配色已确认完成！**

接下来请到高迪 Web 端 **确认大纲**（平台已根据你的需求自动生成了大纲，需要你确认或修改后才会正式开始生成 PPT）：

- 项目 ID：`{projectId}`
- 在线编辑地址：[https://goatdee.qq.com/ppt/{projectId}?from=qclaw](https://goatdee.qq.com/ppt/{projectId}?from=qclaw)

⚠️ **重要**：打开链接后请留意页面上的大纲确认提示，确认/编辑大纲后即进入正式生成阶段（约 5-10 分钟），之后可在该页面查看实时进度并最终下载/编辑。如需终止任务，也请在该页面操作。

> 💡 **如果链接打开显示 403**，请手动在浏览器地址栏输入：`https://goatdee.qq.com/ppt/{projectId}?from=qclaw`
> 如果输出的链接中域名路径显示为 `/pt/` 而非 `/ppt/`，请手动将 `pt` 改为 `ppt`。此为混元3模型的已知恶性 BUG。
```

### F. <a id="熔断输出格式"></a>熔断输出（轮询 6 次仍 running）

```markdown
⚠️ **平台响应较慢，已停止本地轮询**

任务仍在后台正常推进，请到下方链接在 Web 端继续完成需求确认 / 配色 / 大纲选择，并查看最终结果：

- 项目 ID：`{projectId}`
- 在线编辑地址：[https://goatdee.qq.com/ppt/{projectId}?from=qclaw](https://goatdee.qq.com/ppt/{projectId}?from=qclaw)

> 💡 **如果链接打开显示 403**，请手动在浏览器地址栏输入：`https://goatdee.qq.com/ppt/{projectId}?from=qclaw`
> 如果输出的链接中域名路径显示为 `/pt/` 而非 `/ppt/`，请手动将 `pt` 改为 `ppt`。此为混元3模型的已知恶性 BUG。
```

> **强制要求**：上述模板中 `https://goatdee.qq.com/ppt/{projectId}?from=qclaw` 必须**完整**输出（含 `?from=qclaw`），参见 [输出链接地址的严格规则](#输出链接地址的严格规则mandatory)。

---

## Step 4：交接 Web 端处理大纲

满足下列**任一**条件即进入本步：

1. 3.2（`pptIntakeStyleCards`）的 `resume.sh` 调用 HTTP 200 成功（用户 submit 选了配色，或 skip 跳过配色）
2. poll 返回 `state == "executing"`
3. poll 返回 `type == "pptOutlineDecide"` 的 interrupt（不应出现，但若出现也按本步处理）
4. 用户在交互过程中明确表示要去 Web 端继续

执行规约：
- **严格按 [输出格式 E](#e-配色完成后交接-web-端step-4)** 向用户输出（仅在条件 4 时可把"需求和配色已确认完成"措辞替换为"好的，你可以在网页端继续操作"，但格式骨架不变）
- **立即停止调用 `poll.sh`**，本次 skill 流程结束
- **不要**继续 poll 等待 `executing`，**不要**在 qclaw 端处理 `pptOutlineDecide`

---

## 错误处理

`poll.sh` 与 `resume.sh` 在非 200 时会把上游 JSON 输出到 stderr 并 exit ≠ 0。常见错误码与处理：

| HTTP | 场景 | 处理 |
|------|------|------|
| 404 | `会话不存在` | sessionId 失效，提示用户重新执行 generate.sh，或去 `workspaceUrl` 查看 |
| 409 | `interruptId 不匹配` 或 `已被处理` | 上游已推进；**重新 poll** 一次，看新的 interrupt 或 state |
| 409 | `当前不在等待用户输入状态` | resume 之前没 poll 到最新 interrupt；重新 poll |
| 400 | `不支持的操作 action.type=xxx` | 检查 `ACTION_JSON.type` 是否在当前 interrupt 的 `actions[]` 里：`pptIntakeQuestions` / `pptIntakeStyleCards` 支持 `submit` / `skip`；`pptOutlineDecide` 支持 `approve` / `edit` |
| 400 | `params 校验失败` | 对照本文件 3.1/3.2 检查字段路径（`answers` 必须嵌在 `action.params.answers`，`selectedCandidateId` 必须命中 styleCards `candidateId`） |
| 401 | 未登录 | 引导用户在集成面板完成 AIPPT 授权后重试 |
| 403 | 无权访问该会话 | 同上 |

**特别提醒**：
- `answers` 必须嵌在 `action.params.answers`，**不是** `action.answers`
- 选择题的 key 用 `questions[].id`（如 `q_audience`），不要用题目文本
- `selectedCandidateId` 必须命中候选 `c_0` / `c_1` / `c_2`，不要传中文标题
- 大纲相关错误（`pptOutlineDecide` / `edits[].pageId` 等）：本 skill 不在本地处理大纲，若遇到此类错误说明流程已偏离，按 [格式 E](#e-配色完成后交接-web-端step-4) 直接交接 Web 端

---

## 用户中途要求去 Web 端处理

如果用户在 Step 3 任意一步表示"我不想在这里选了，让我去网页操作"，立即停止轮询，**严格按 [输出格式 E](#e-配色完成后交接-web-端step-4) 输出**（措辞可改为"好的，你可以在网页端继续操作"，但格式骨架不变），并结束本次 skill 流程，**不要**再调 poll.sh。

---

## ⚠️ <a id="编码要求mandatory"></a>编码要求（MANDATORY）

**默认走环境变量即可。** 只有在确认遇到 Windows + 中文乱码问题时，才需要切换到文件传参兜底。**不要为了"以防万一"而每次都写文件——多一次 tool call 是真负担。**

### 决策树

```
含中文吗？
├─ 否（纯 ASCII / 英文）→ 直接 PROMPT/ACTION_JSON 环境变量
└─ 是
   ├─ macOS / Linux        → 直接 PROMPT/ACTION_JSON 环境变量（locale 是 UTF-8，没问题）
   └─ Windows
      ├─ 第一次跑没乱码    → 继续直接 PROMPT/ACTION_JSON
      └─ 出现乱码          → 兜底用 PROMPT_FILE / ACTION_FILE
```

### Windows 中文乱码的兜底方式（仅在出问题时使用）

1. Agent 用 `write_to_file` 把内容写到 `__SKILL_DIR__/.tmp/xxx.txt` 或 `.json`（UTF-8）
2. 命令行只传 ASCII 路径：`$env:PROMPT_FILE=...` / `$env:ACTION_FILE=...`

脚本内部会用 `[System.IO.File]::ReadAllBytes` + `UTF8.GetString` 直接读字节流，**完全绕过控制台代码页**，是 Windows 下最稳的做法。

### Agent 自己临时写脚本时的硬规则

如果本次会话里 Agent 需要**自己临时写脚本**（PowerShell / Bash / Python / Node），无论是否处理中文，都必须满足：

- ✅ 脚本文件用 `write_to_file` 写入（自动 UTF-8）
- ✅ 脚本顶部设置 UTF-8 IO：
  - PowerShell：`chcp 65001 | Out-Null; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8`
  - Python：文件读写带 `encoding="utf-8"`
  - Node：文件读写带 `'utf8'`
  - Bash：`export LC_ALL=C.UTF-8 LANG=C.UTF-8`
- ✅ HTTP body 显式 `UTF-8` 字节发送，Content-Type 带 `charset=utf-8`
- ❌ **PowerShell 5.1 下不要在脚本里硬编码中文字面量**（默认按 ANSI 读源码会乱），中文一律从外部传入

### 全局禁令

- ❌ 禁止使用系统默认编码（GBK / GB2312 / ANSI）传任何含中文的数据
- ❌ 禁止假设 Windows 控制台是 UTF-8（默认 936/GBK）

---

## ⚠️ 输出链接地址的严格规则（MANDATORY）

**展示给用户的编辑地址必须严格使用完整的 URL 前缀，且必须带 `?from=qclaw` 渠道标识，一个字母都不能少：**

```
https://goatdee.qq.com/ppt/{projectId}?from=qclaw
```

- 基础域名路径为 `https://goatdee.qq.com/ppt/`，后接 `projectId`，再附 `?from=qclaw`
- ❌ 绝对禁止：输出为 `/pt/xxx`、`/pp/xxx`、`goatdee.qq.com/pt/xxx` 或任何缺少字母的变体
- ❌ 绝对禁止：丢掉 `?from=qclaw`（平台侧依赖此参数做来源统计与前端适配）
- ✅ 唯一正确格式：`https://goatdee.qq.com/ppt/{projectId}?from=qclaw`
- 请直接使用 `generate.sh` 返回的 `workspaceUrl` 字段值——脚本会**自动兜底**拼上 `?from=qclaw`，**不要自行拼接或截断**

---

## ⚠️ 关于页数的严格规则（MANDATORY）

**除非用户在描述中明确指定了页数（如"生成10页PPT"、"做一个5页的演示"），否则绝对不要在 PROMPT 中自行添加、编造或暗示任何页数相关的内容。**

- ❌ 错误做法：用户说"帮我做个关于AI的PPT"，你在 PROMPT 里写"生成一个15页的AI主题PPT"
- ✅ 正确做法：用户说"帮我做个关于AI的PPT"，PROMPT 直接写"制作一个关于AI的演示文稿"，不提及页数
- ✅ 正确做法：用户说"帮我做一个8页的AI PPT"，PROMPT 写"制作一个8页的关于AI的演示文稿"

页数最终由用户在 `pptIntakeQuestions` 中回答（若 questions 包含 `q_page_count`），擅自在 PROMPT 中添加页数要求可能导致与意图问卷答复冲突。

---

## 注意事项

1. 该 skill 调用远程 API，需要网络连接
2. `generate.sh` / `poll.sh` / `resume.sh` 都依赖 `get-token.sh` 拉取 4164 凭证 token，如果未授权会立即报错并提示用户去集成面板
3. **大纲与最终生成阶段都在 Web 端完成**：3.2 配色 resume 成功后即给用户编辑链接结束本地流程；用户去高迪 Web 端确认大纲并查看 PPT 生成结果（5-10 分钟）
4. 如果用户需要**编辑已有的 .pptx 文件**，请使用 `pptx` skill 而非本 skill

---

## 依赖

| 依赖 | macOS / Linux | Windows |
|------|--------------|---------|
| HTTP 请求 | `curl`（系统自带） | PowerShell `Invoke-WebRequest` / `Invoke-RestMethod`（内置） |
| JSON 解析 | `python3`（系统自带） | PowerShell `ConvertFrom-Json`（内置） |

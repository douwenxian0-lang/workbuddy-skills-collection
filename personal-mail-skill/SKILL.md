---
name: personal-mail-skill
description: "个人邮箱二级路由层。仅在 email-skill 把任务转发到本 skill 后被调用——典型场景是『发给别人 / 需要附件 / 抄送 / 收件箱搜索 / 下载附件』等完整收发需求。本 skill 通过执行路由脚本确定性地决定路由到 agent-email 或 imap-smtp-email，然后立即用 read 工具读取目标 SKILL.md 执行邮件操作。"
trigger_keywords:
  - 给客户发邮件
  - 给同事发邮件
  - 抄送
  - cc
  - 密送
  - bcc
  - 邮件附件
  - 发送邮件附件
  - HTML 邮件
  - 收件箱
  - 查邮件
  - 搜索邮件
  - 邮件正文
  - 标记已读
  - 标记未读
exclude_when:
  - 用户明确说"用 Agent 邮箱 / AI 邮箱"（应直接路由到 agent-email）
  - 用户明确说"用我的 QQ/163/Gmail/Outlook"（应直接路由到 imap-smtp-email）
  - 用户场景是"发到我邮箱 / 推到我邮箱"等自留存（应路由到 public-skill）
---

# Personal Mail Skill（个人邮箱二级路由层）

> **⚠️ 强制指令**：你正在执行 `personal-mail-skill`。读取本文件后，**不要回复用户，不要停顿，必须立即执行下方的路由脚本**。
>
> **定位**：个人邮箱场景下的"完整收发"二级路由层。
> 上游（`email-skill`）把"发给别人 / 需要完整邮件能力"的任务转发到本 skill 后，本 skill **通过脚本**确定性地决定路由到 `agent-email` 或 `imap-smtp-email`。

## 0. 路由流程（必须严格按步骤执行）

### 步骤 1：执行路由脚本

**立即执行以下命令**，不要询问用户，不要做任何检查：

macOS / Linux：

```bash
bash '<SCRIPT_PATH>/resolve-route.sh'
```

Windows（PowerShell）：

```powershell
powershell -ExecutionPolicy Bypass -File "<SCRIPT_PATH>\resolve-route.ps1"
```

其中 `<SCRIPT_PATH>` 指本 skill（`personal-mail-skill`）的根目录。

### 步骤 2：按脚本输出执行路由

脚本会输出一行 JSON，格式如下：

```json
{"success":true,"next_skill":"agent-email","reason":"用户默认偏好为 qq_agent_mail（Agent 邮箱）"}
```

**你必须按 `next_skill` 字段的值执行路由**：

| `next_skill` 值 | 路由动作 |
|-----------------|---------|
| `agent-email` | 立即用 `read` 工具读取 `agent-email/SKILL.md` |
| `imap-smtp-email` | 立即用 `read` 工具读取 `imap-smtp-email/SKILL.md` |

读取目标 SKILL.md 后，继续执行该文件中的邮件操作指令（发送邮件 / 查询邮件 / 下载附件等）。

### 禁止行为

- ❌ 跳过步骤 1 直接用 `read` 工具读取某个 SKILL.md（必须先执行脚本获取路由决策）
- ❌ 在执行脚本之前向用户追问"用哪个邮箱""绑定了哪个"
- ❌ 主动查询 4230 / 4164 / 任何邮箱凭证接口（这是脚本的事）
- ❌ 忽略脚本的 `next_skill` 输出，自行决定路由
- ❌ 用文字回复"我不知道用哪个邮箱"替代执行脚本
- ❌ 读取目标 skill 的 SKILL.md 后就停止，不继续执行该文件中的邮件操作指令
- ❌ 在 `success: false` 时停下来——即使脚本失败，`next_skill` 仍然有效（兜底到 `imap-smtp-email`），继续路由

## 1. 何时进入本 skill

本 skill 由 `email-skill` 在 L1 决策时通过 `read` 工具读取本 skill 的 `SKILL.md` 进入。**直接被用户调用是不期望的**。

进入本 skill 时，以下事实成立：
- 用户**没有显式指定**邮箱通道（否则会在 L0 直接命中 `agent-email` / `imap-smtp-email` / `public-skill`）
- 用户**不是单纯自留存**（否则会在 L1 命中 `public-skill`）
- 用户场景是**完整收发**：发给别人、附件、抄送、密送、HTML、收件箱搜索、下载附件等

## 2. 路由逻辑说明

脚本 `resolve-route.sh`（macOS/Linux）/ `resolve-route.ps1`（Windows）内部按以下优先级决策：

1. **有默认偏好**：从 `qclaw-plugin-config.json` 读取 `email.default.providerId`
   - `qq_agent_mail` → 路由到 `agent-email`
   - 其他 platform → 路由到 `imap-smtp-email`
2. **无偏好 + 查 4230 接口**：
   - 绑定 0 个邮箱 → `imap-smtp-email`（拦截层弹绑定卡片）
   - 绑定 1 个邮箱 → 自动使用该邮箱对应的 skill
   - 绑定 ≥2 个邮箱 → `imap-smtp-email`（拦截层弹选择卡片）
3. **接口异常** → 兜底路由到 `imap-smtp-email`

## 3. 与 email-skill 的关系

| 层级 | Skill | 职责 |
|------|-------|------|
| L0+L1（一级路由） | `email-skill` | 用户是否显式指定？发给自己还是别人？ |
| L2（二级路由） | `personal-mail-skill`（本 skill） | 执行路由脚本，按默认偏好分流到 Agent 邮箱 or 私邮通道 |
| 执行层 | `agent-email` / `imap-smtp-email` | 真正发邮件 / 收邮件 / 下载附件 |

## 4. 个人邮箱口径

本 skill 把"个人邮箱"定义为：

- **Agent 邮箱**（`qq_agent_mail`）：QClaw 专属代收代发通道
- **私邮 platform**（6 个）：`qq_mail` / `163_mail` / `gmail` / `outlook` / `sina_mail` / `sohu_mail`

## 5. 一句话记忆

> 执行路由脚本（macOS/Linux 用 `resolve-route.sh`，Windows 用 `resolve-route.ps1`）→ 按输出的 `next_skill` 立即用 `read` 工具读取对应的 SKILL.md → 执行邮件操作。

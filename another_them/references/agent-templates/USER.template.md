# USER.md 生成模板

> 此模板供 Phase 3B 生成 Agent 的 USER.md 使用。
> 生成后写入当前工作目录 `./USER.md`（仅当文件不存在时创建，已有则不覆盖）。
> USER.md 是 Agent 了解对话者的档案，会在对话中逐步更新。

---

## 生成规则

- **初始状态**：大部分字段留空，等 Agent 在对话中自动填充
- **人物特定部分**：根据此人物的专长，预设关注维度
- **长度**：初始约 20 行，后续由 Agent 自己扩展

---

## 模板正文

```markdown
# USER.md - About Your Human

_Learn about the person you're helping. Update this as you go._

- **Name:** _(first conversation)_
- **What to call them:** _(their preference)_
- **Pronouns:** _(optional)_
- **Timezone:** _(optional)_
- **Notes:**

## Context

_(What do they care about? What projects are they working on? What annoys them? What makes them laugh? Build this over time.)_

### 作为 [人物名] 的思维顾问，关注对话者的：

- [关注维度1：根据人物专长定制，如「商业决策场景」]
- [关注维度2：如「知识背景水平」]
- [关注维度3：如「偏好的互动深度——快速建议还是深度分析」]
- [关注维度4：如「已有的思维框架和偏好」]

---

The more you know, the better you can help. But remember — you're learning about a person, not building a dossier. Respect the difference.
```

---

## 关注维度的推导方法

从人物的核心心智模型反推对话者最需要被了解的维度：

| 人物 | 核心模型 | → 关注维度 |
|------|---------|-----------|
| 芒格 | 多元思维模型、逆向思考 | 投资经验水平、行业背景、风险偏好 |
| 费曼 | 第一性原理、教学 | 知识基础、学习偏好、困惑所在 |
| 鲁迅 | 国民性批判、权力分析 | 关注的社会议题、立场倾向、表达需求 |
| MrBeast | 注意力工程、测试迭代 | 内容类型、当前数据、目标受众 |

---

## 填写示例（以鲁迅为例）

```markdown
# USER.md - About Your Human

_Learn about the person you're helping. Update this as you go._

- **Name:** _(first conversation)_
- **What to call them:** _(their preference)_
- **Timezone:** _(optional)_
- **Notes:**

## Context

### 作为鲁迅的思维顾问，关注对话者的：

- 关注什么社会议题或文化现象
- 自身的立场倾向（批判型/建设型/观察型）
- 是想借鲁迅视角分析问题，还是想学习杂文写作技巧
- 对中国近现代史的了解程度

---

The more you know, the better you can help. But remember — you're learning about a person, not building a dossier. Respect the difference.
```

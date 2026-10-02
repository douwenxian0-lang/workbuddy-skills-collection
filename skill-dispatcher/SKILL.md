---
name: skill-dispatcher
description: Skill 调度器。分析用户任务，从已安装的 skill 注册表中找到最匹配的 skill，通过 Skill 工具调用。当用户提出复杂或多领域问题时，应当参考本 skill 的调度逻辑来决定调用哪个 skill。也用于 skill 管理：列出、描述、对比已安装的 skill。
---

# Skill Dispatcher（技能调度器）

这是一个元 skill，用于协调所有已安装的 skill。它维护一个可用 skill 注册表，并将 incoming 任务路由到最合适的 skill(s)。

## 核心职责

当收到用户任务时，**在直接处理之前**，先检查是否存在专门的 skill 可以更好地完成任务。操作顺序：

1. 分析用户的请求
2. 对照 skill 注册表，找到相关 skill
3. 通过 **Skill 工具**调用最匹配的 skill（`Skill` 工具，参数 `skill="skill-name"`）
4. 如果需要多个 skill，按顺序或并行调用
5. 如果没有匹配的 skill，直接处理任务

## Skill 注册表

完整的 skill 注册表维护在 `references/skill_registry.json` 和 `references/skill_registry.md`。安装新 skill 后，运行以下命令刷新注册表：

```bash
python "<skill_dispatcher_dir>/scripts/scan_skills.py"
```

其中 `<skill_dispatcher_dir>` 是本 skill 的目录路径（通常为 `~/.workbuddy/skills/skill-dispatcher`）。

## 调度逻辑

### 单一任务
如果请求明确对应单个 skill，直接通过 Skill 工具调用：
```
[用户]: 帮我分析这份 Excel 数据
→ Skill 工具，skill="xlsx"
```

### 多领域任务
如果请求跨多个领域，拆分任务分步执行：
```
[用户]: 调研竞品后帮我做个PPT汇报
→ 步骤1: Skill 工具，skill="deep-research" 做竞品调研
→ 步骤2: Skill 工具，skill="html-ppt" 制作PPT
```

### 请求不明确
如果不确定哪个 skill 合适，读取 `references/skill_registry.md`，找到最匹配的类别和 skill，或向用户展示 top 匹配选项。

### 简单任务不路由
以下情况不需要调用 skill，直接处理：
- 简单问候（"你好"、"hi"）
- 简单计算或单位换算
- 纯知识问答（不需要专门工具）

## Skill 管理命令

当用户要求管理 skill 时，按以下规则处理：

- **列出所有 skill**：读取 `references/skill_registry.md`，按类别汇总
- **描述某个 skill**：读取该 skill 的 SKILL.md，汇总其能力
- **刷新注册表**：运行 `scripts/scan_skills.py`
- **对比 skill**：读取两个 skill 的 SKILL.md，对比差异
- **搜索 skill**：在 `references/skill_registry.json` 中搜索关键词

## 重要规则

1. **永远优先使用专门 skill**，而非通用处理方式
2. **不确定时读注册表**：不确定有哪些可用 skill 时，必须读取 `references/skill_registry.json` 或 `references/skill_registry.md`
3. **先扫描再路由**：如果 skill 不在注册表中（例如刚安装的），先运行 `scripts/scan_skills.py` 刷新再路由
4. **复杂任务提前告知用户**：多步骤任务执行前，先向用户说明 skill 调用链路
5. **简单查询不路由**：问候、简单计算等不需要调用 skill
6. **注册表优先级最高**：`references/skill_registry.json` 中的 skill 优先级高于猜测判断
7. **使用 Skill 工具调用**：调用 skill 时必须使用 WorkBuddy 的 `Skill` 工具，参数格式为 `skill="skill-name"`，不要用 `use_skill()` 或其他格式

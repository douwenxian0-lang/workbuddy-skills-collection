---
name: trace2skill
description: "Trace2Skill - 从真实轨迹中演化 Agent 技能。自动改进 SKILL.md，支持 Claude Code 和 WorkBuddy。"
agent_created: true
---

# Trace2Skill - Agent 技能演化框架

## ✅ 安装完成状态

| 组件 | 状态 | 位置 |
|--------|------|------|
| **Python 包** | ✅ 已安装 | `site-packages/trace2skill/` |
| **WorkBuddy 适配器** | ✅ 已实现 | `trace2skill-dl/trace2skill/workbuddy_adapters.py` |
| **JSONL 解析器** | ✅ 已测试 | 可以解析 WorkBuddy 会话 |
| **配置文件** | ✅ 已创建 | `~/.trace2skill/workbuddy.yaml` |
| **注册** | ✅ 已完成 | `harnesses/__init__.py`, `evidence_adapters/__init__.py` |

---

## 🚀 已创建的组件

### 1. WorkBuddy 适配器 (`workbuddy_adapters.py`)

**位置**: `C:\Users\Administrator\trace2skill-dl\trace2skill\workbuddy_adapters.py`

**已实现**:

1. ✅ `_parse_workbuddy_jsonl(path)` - 解析 WorkBuddy JSONL 为 `Trajectory`
2. ✅ `WorkBuddyHarnessAdapter` - 从 `~/.workbuddy/projects/` 读取会话
3. ✅ `WorkBuddyEvidenceAdapter` - 从会话文件中收集证据

**测试结果**:
```
Testing parser with: 8cef8743-356c-4b8d-b65e-7946818bfe28.jsonl
  ✅ Trajectory parsed successfully!
  task_id: 8cef8743-356c-4b8d-b
  query: <user_query>帮我修复一下txt 文件</user_query>...
  steps: 4 steps
  final_answer: (empty)...
  model: 
  metadata: {'session_id': '8cef8743-356c-4b8d-b65e-7946818bfe28'}
```

### 2. 配置文件 (`workbuddy.yaml`)

**位置**: `C:\Users\Administrator\.trace2skill\workbuddy.yaml`

**内容**:
```yaml
skill_path: ~/.workbuddy/skills/<your-skill>/SKILL.md
harness_adapter: workbuddy
evidence_adapter: workbuddy
llm_provider: anthropic
workbuddy:
  projects_dir: ~/.workbuddy/projects
  sessions_dir: ~/.workbuddy/sessions
```

### 3. 注册到 Trace2Skill

**已注册**:
- ✅ `trace2skill.harnesses.WorkBuddyHarnessAdapter`
- ✅ `trace2skill.evidence_adapters.WorkBuddyEvidenceAdapter`

**验证**:
```bash
python -c "from trace2skill.harnesses import WorkBuddyHarnessAdapter; print('✅ OK')"
python -c "from trace2skill.evidence_adapters import WorkBuddyEvidenceAdapter; print('✅ OK')"
```

---

## 📦 快速开始

### 使用 WorkBuddyHarnessAdapter

```python
import asyncio
from trace2skill.harnesses import WorkBuddyHarnessAdapter
from pathlib import Path

async def main():
    adapter = WorkBuddyHarnessAdapter(
        projects_dir=Path.home() / ".workbuddy" / "projects"
    )

    # 从现有会话中读取轨迹
    traj = await adapter.run_task(
        query="帮我修复 txt 文件",
        skill_dir=Path("~/.workbuddy/skills/<skill>"),
        workspace=Path("C:/Users/Administrator/WorkBuddy/test"),
        turn_budget=50,
    )

    print(f"Parsed {len(traj.steps)} steps")
    print(f"Query: {traj.query[:50]}...")

asyncio.run(main())
```

### 使用 WorkBuddyEvidenceAdapter

```python
import asyncio
from trace2skill.evidence_adapters import WorkBuddyEvidenceAdapter

async def main():
    adapter = WorkBuddyEvidenceAdapter(
        sessions_dir=Path.home() / ".workbuddy" / "sessions",
        projects_dir=Path.home() / ".workbuddy" / "projects"
    )

    evidence = await adapter.collect(
        session_id="8cef8743-356c-4b8d-b65e-7946818bfe28"
    )

    print(f"Trajectory: {evidence.trajectory.task_id}")
    print(f"Signals: {evidence.next_user_turns}, {evidence.behavioral}")

asyncio.run(main())
```

### 运行 Trace2Skill 管道

```bash
# 1. 准备任务集 (tasks.jsonl)
echo '{"task_id":"test-1","query":"上传产品图片"}' > tasks.jsonl

# 2. 运行演化管道
trace2skill evolve \
  --config ~/.trace2skill/workbuddy.yaml \
  --tasks tasks.jsonl \
  --output improved/

# 3. 查看改进
cat improved/SKILL.md

# 4. 对比差异
diff ~/.workbuddy/skills/<skill>/SKILL.md improved/SKILL.md

# 5. 应用改进（如果满意）
cp improved/SKILL.md ~/.workbuddy/skills/<skill>/SKILL.md
```

---

## 📁 文件位置

| 组件 | 路径 | 说明 |
|--------|------|------|
| **Trace2Skill 源码** | `C:\Users\Administrator\trace2skill-dl\` | 本地克隆仓库 |
| **WorkBuddy 适配器** | `trace2skill-dl\trace2skill\workbuddy_adapters.py` | 源代码 |
| **配置文件** | `C:\Users\Administrator\.trace2skill\workbuddy.yaml` | Trace2Skill 配置 |
| **Trace2Skill 技能** | `~/.workbuddy/skills/trace2skill/SKILL.md` | 本文档 |
| **WorkBuddy 会话** | `~/.workbuddy/projects/<cwd>/<session_id>.jsonl` | 对话数据 |

---

## ⚠️ 当前限制

1. **HarnessAdapter 不运行新任务** - 只读取现有会话
   - 需要 WorkBuddy 的 HTTP API 或 CLI 来运行新任务
   - 会话元数据显示本地 API: `http://127.0.0.1:PORT`

2. **EvidenceAdapter 提取信号有限** - `next_user_turns` 和 `execution` 是存根
   - 需要从 JSONL 中实际提取这些信号

3. **没有自动化半在线模式** - 需要手动触发 `evolve-online`
   - 可以创建 WorkBuddy hook 在会话结束时自动触发

---

## 🔮 下一步改进

1. **实现 HTTP 客户端** - 使用 WorkBuddy 的本地 API
   - 发送任务并获取响应
   - 解析为 `Trajectory` 格式

2. **提取更多信号** - 改进 `WorkBuddyEvidenceAdapter`
   - 从 JSONL 中提取 `next_user_turns`
   - 计算 `execution` 指标（工具错误、延迟等）

3. **创建 Hook 集成** - 在 WorkBuddy 中自动触发演化
   - 类似于 Claude Code 的 `SessionEnd` hook
   - 在会话结束时自动运行 `trace2skill evolve-online`

---

## 🔗 相关资源

- **论文**: [arXiv:2603.25158](https://arxiv.org/abs/2603.25158)
- **GitHub**: [Hert4/trace2skill](https://github.com/Hert4/trace2skill)
- **本地副本**: `C:\Users\Administrator\trace2skill-dl\`
- **WorkBuddy 数据**: `~/.workbuddy/projects/`

---

**最后更新**: 2026-05-12  
**状态**: ✅ 基础实现完成，可以解析 WorkBuddy 会话

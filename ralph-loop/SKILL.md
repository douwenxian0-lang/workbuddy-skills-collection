---
title: "Ralph Loop - 自主AI编码循环"
summary: "通过bash循环实现自主AI编码，每轮迭代获取新鲜上下文，基于The Ralph Playbook"
---

# Ralph Loop

通过 bash 循环实现自主 AI 编码，每轮迭代获取新鲜上下文。基于 [The Ralph Playbook](https://ghuntley.com/ralph/)。

## 核心理念

**两个提示，一个循环**：通过传递 `plan` 参数在规划和构建模式之间切换。

**上下文就是一切**：
- 200K+ tokens 广告 ≈ 176K 可用，40-60% 利用率是"智能区"
- 紧凑任务 + 每循环一个任务 = 100% 智能区上下文利用
- **主智能体作为调度器** — 不要在主上下文中做昂贵工作；生成子智能体
- **子智能体作为内存** — 每个子智能体获得约156kb，会被垃圾回收。分散执行以避免污染主上下文
- **简单和简洁取胜** — 更少的部件、更简洁的输入 = 更确定的结果
- **Markdown 优于 JSON** — 定义和跟踪工作的更高 token 效率

## 三个阶段

### Phase 1: Define Requirements（定义需求）
- 你 + LLM 聊天
- 产出：`specs/*.md`（每个关注点一个文件）

### Phase 2: Planning Mode（规划模式）
- 命令：`./loop.sh plan`
- 仅做差距分析
- 加载：`PROMPT_plan.md`、`AGENTS.md`
- 产出：`IMPLEMENTATION_PLAN.md`

### Phase 3: Building Mode（构建模式）
- 命令：`./loop.sh`
- 每循环一个任务
- 加载：`PROMPT_build.md`、`AGENTS.md`
- 产出：`src/` 代码 + git commit

## 循环模式

| 命令 | 模式 | 目的 |
|---|---|---|
| `./loop.sh plan` | 规划 | 差距分析，生成计划 |
| `./loop.sh plan 5` | 规划 | 最多5次迭代 |
| `./loop.sh` | 构建 | 从计划实施 |
| `./loop.sh 20` | 构建 | 最多20次迭代 |

## 文件结构

```
project-root/
├── loop.sh              # 循环脚本（plan/build模式）
├── PROMPT_plan.md       # 规划提示
├── PROMPT_build.md      # 构建提示
├── AGENTS.md            # 操作指南（构建/测试命令）
├── IMPLEMENTATION_PLAN.md  # 由Ralph生成
├── specs/               # 每个关注点一个spec
└── src/                 # 你的代码
```

## 使用场景

- 当用户需要自主AI编码时
- 当用户需要分阶段实施项目时
- 当用户提到 "ralph"、"自主编码"、"循环构建" 时
- 需要新鲜上下文的迭代开发时

## 安装

```bash
# 克隆仓库
git clone https://github.com/harry-hathorn/ralph-loop.git

# 复制到技能目录
cp -r ralph-loop/ralph-loop ~/.workbuddy/skills/ralph-loop
```

## 快速开始

```bash
# 在项目目录初始化
~/.workbuddy/skills/ralph-loop/scripts/init_ralph.sh /path/to/project

cd /path/to/project

# 使用 ralph-loop 技能进行对话，产出 specs
# 配置 AGENTS.md，设置项目目标

# 生成计划
./loop.sh plan

# 从计划构建
./loop.sh
```

## 关键原则

### 引导 Ralph：模式 + 背压
- **上游引导** — specs、prompts 和 AGENTS.md 每轮加载，给模型已知起始状态
- **下游引导** — 测试、类型检查、lint 和构建拒绝无效工作

### 让 Ralph 做 Ralph
- 利用 LLM 自我识别、自我纠正、自我改进的能力
- 通过迭代实现最终一致性
- **使用保护** — 自主操作需要 `--dangerously-skip-permissions`

### 在循环外移动
- Ralph 做所有工作。你的工作是设计设置和环境
- **观察和纠正方向** — 观察早期循环，发现差距出现的地方，添加标志
- **像调吉他一样调整它** — 不要预先规定所有事情；当 Ralph 以特定方式失败时反应性调整

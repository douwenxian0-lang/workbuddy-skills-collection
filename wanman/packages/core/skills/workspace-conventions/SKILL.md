---
name: workspace-conventions
description: File and output conventions for agent workspaces
---

# Workspace Conventions

## Directory Structure

Each agent's working directory is `/workspace/agents/{agent-name}/`.

**Rule: Only write files within your own working directory.**

```
/workspace/agents/
├── ceo/           ← CEO's working directory
├── marketing/     ← Marketing agent
├── finance/       ← Finance agent
├── feedback/      ← Feedback/research agent
├── dev/           ← Dev agent
└── devops/        ← DevOps agent
```

## Output File Naming

| Type | Naming | Example |
|------|--------|---------|
| Report | `{topic}-report.md` | `budget-report.md` |
| Brand guide | `brand-guide.md` | |
| Content plan | `{platform}-plan.md` | `social-media-plan.md` |
| Web page | `index.html` | |
| Design | `{name}-brief.md` | `poster-brief.md` |

## Cross-Agent References

When a task description references another agent's output, use the full path:

```
See brand guide at /workspace/agents/marketing/brand-guide.md
```

## Agent Name Identifier

When using `wanman artifact put`, the system automatically records the agent name. Ensure the environment variable `WANMAN_AGENT_NAME` is correctly set.

## Task Completion Checklist

1. Write key data to artifacts (`wanman artifact put`)
2. Write detailed reports to MD files
3. Mark the task as done with `wanman task done`, noting the number of artifacts in the result

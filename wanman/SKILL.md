---
name: wanman
description: >
  Agent matrix framework for running supervised networks of Claude Code/Codex agents.
  Use when: (1) setting up multi-agent collaboration, (2) orchestrating multiple agents,
  (3) user asks about wanman or agent matrix frameworks.
---

# wanman - Agent Matrix Framework

Agent Matrix framework — run a supervised network of Claude Code or Codex agents that collaborate on your machine.

## What it does

- Coordinates multiple agents (CEO, dev, devops, marketing, feedback, etc.) through an async message bus with steer/follow-up priorities.
- Runs each agent as a real Claude Code or Codex CLI subprocess.
- Isolates every agent in a per-agent worktree and per-agent `$HOME`.
- Is CLI-first: everything is scriptable, observable, and reproducible.

## Quickstart

```bash
# Prerequisites: Node 20+, pnpm 9+, git, a logged-in Claude Code or Codex CLI.
git clone https://github.com/chekusu/wanman.git wanman.dev
cd wanman.dev
pnpm install
pnpm build

# Run from source
pnpm --filter @wanman/cli exec wanman takeover /path/to/any/git/repo
```

## Included Skills

wanman comes with built-in skills in `packages/core/skills/`:
- `artifact-naming` - Artifact naming conventions
- `artifact-quality` - Artifact quality standards
- `cross-validation` - Cross-validation workflows
- `research-methodology` - Research methodology
- `wanman-cli` - CLI command reference
- `workspace-conventions` - Workspace conventions

## Documentation

See `README.md` and `docs/` directory for detailed setup and usage.

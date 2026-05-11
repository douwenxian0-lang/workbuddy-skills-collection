---
name: wanman-cli
description: wanman CLI command reference — inter-agent communication, task management, artifact storage
---

# wanman CLI

You are running inside the wanman Agent Matrix. Use the following CLI commands to collaborate with other agents.

## Startup Protocol

On every startup, execute in order:

1. `cat ./CLAUDE.md` — Read your role guide
2. `wanman recv` — Check for pending messages
3. `wanman task list --assignee $WANMAN_AGENT_NAME` — View tasks assigned to you

## Messages

| Command | Description |
|---------|-------------|
| `wanman send <agent> "<message>"` | Send a normal message |
| `wanman send <agent> "<message>" --steer` | Urgent message (interrupts the target agent's current work) |
| `wanman send human --type decision "<message>"` | Ask the human to make a decision |
| `wanman send human --type blocker "<message>"` | Tell the human what is blocking progress |
| `wanman recv` | Receive pending messages |
| `wanman escalate "<message>"` | Escalate to the CEO agent |

**Note**: `--steer` forcefully interrupts the target agent's process and restarts it. Use only in urgent situations.
Prefer explicit `--type decision|blocker` when sending to `human`, so the product can render the right card.

## Tasks

```bash
wanman task create "<title>" --assign <agent> [--priority 1-10] [--after id1,id2] [--desc "<description>"]
wanman task list [--status <pending|in_progress|done|blocked>] [--assignee <agent>]
wanman task get <id>
wanman task update <id> --status <in_progress|blocked|done> [--result "<text>"]
wanman task done <id> "<result>"
```

- `--after`: Declare dependencies (comma-separated task IDs); the task will not execute until dependencies are complete
- `--priority`: 1 = highest, 10 = lowest
- `task done` is a shortcut for `task update --status done --result`

## Artifacts (Structured Outputs)

```bash
wanman artifact put --kind <kind> --path "<domain>/<category>/<item>" \
  --source "<source>" --confidence <0-1> [--task <id>] [--file <path>] '<metadata json>'
wanman artifact list [--agent <a>] [--kind <k>]
wanman artifact get <id>
```

- `--file`: Store file contents in the database (version-controlled storage)
- `--source`: Information source, e.g., `web_search:site.com`, `estimate`, `official_data`
- `--confidence`: 0.3-0.5 (estimate) | 0.6-0.8 (data-backed) | 0.9+ (authoritative source)

## Context (Cross-Agent Shared Key-Value Store)

```bash
wanman context set <key> "<value>"
wanman context get <key>
```

Used to share blueprints, summaries, and other information needed across agents.

## Hypothesis Tracking

```bash
wanman hypothesis create "<title>" [--rationale "<text>"]
wanman hypothesis list [--status <proposed|active|validated|rejected>]
wanman hypothesis update <id> --status <validated|rejected> [--outcome "<text>"] [--evidence <artifact-ids>]
```

## Agent Management

```bash
wanman agents                              # List all agents and states
wanman agents spawn <template> [name]      # Spawn a clone (e.g. feedback-2)
wanman agents destroy <name>               # Destroy a dynamic clone
```

## Standard Workflow

1. `wanman task update <id> --status in_progress`
2. Do the work, write outputs to the `./output/` directory
3. `wanman task done <id> "completion description"`
4. `wanman send ceo "Task complete: <title>, output: output/<filename>"`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `WANMAN_AGENT_NAME` | Your agent name (set automatically) |
| `WANMAN_URL` | Supervisor address (default `http://localhost:3120`) |

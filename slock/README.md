# Slack Skill for OpenClaw/Clawd 💬

[![Trust Score](https://img.shields.io/badge/Trust%20Score-9%2F10-brightgreen)](AUDIT_REPORT.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Send messages, manage channels, and interact with your Slack workspace from OpenClaw/Clawd agents.

## Features

- 🔐 Secure OAuth authentication
- 💬 Send and read messages
- #️⃣ Channel management
- 👥 User directory
- 🔍 Message search
- 📊 JSON output for agent processing
- ⚡ Zero dependencies

## Quick Start

```bash
# Clone and link
git clone https://github.com/sincere-arjun/slack-skill.git
cd slack-skill
npm link

# Authenticate
slack auth --token xoxb-your-token-here

# Start using
slack channels
slack send --channel C123456 --text "Hello from my agent!"
```

## Setup

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps)
2. Add OAuth scopes: `chat:write`, `channels:read`, `users:read`, `search:read`
3. Install to workspace and copy Bot User OAuth Token
4. Run `slack auth --token <token>`

See [SKILL.md](SKILL.md) for full documentation.

## Commands

| Command | Description |
|---------|-------------|
| `slack auth --token <t>` | Authenticate |
| `slack whoami` | Show current user |
| `slack channels` | List channels |
| `slack channel <id>` | Channel details |
| `slack send --channel <id> --text "msg"` | Send message |
| `slack messages --channel <id>` | Get messages |
| `slack users` | List users |
| `slack search "query"` | Search messages |
| `slack status --text "msg"` | Set status |

## Examples

```bash
# Send daily update
slack send --channel C123456 --text "🌅 Morning standup starting"

# Search for errors
slack search "error in production" --json

# Get recent activity
slack messages --channel CAlerts --limit 10
```

## Trust & Security

- **Trust Score:** 9/10 ([View Audit](AUDIT_REPORT.md))
- Credentials stored with 600 permissions
- No external dependencies
- HTTPS-only API calls

## License

MIT © SecureSkills

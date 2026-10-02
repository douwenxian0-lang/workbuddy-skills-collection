# slack 💬

Send messages, manage channels, and interact with your Slack workspace from OpenClaw/Clawd.

## Install

```bash
# From this directory
npm link

# Or use directly
node /path/to/slack-skill/slack.js <command>
```

## Setup

1. Create a Slack app at https://api.slack.com/apps
2. Go to "OAuth & Permissions"
3. Add the following scopes:
   - `chat:write` - Send messages
   - `channels:read` - List public channels
   - `groups:read` - List private channels
   - `users:read` - List users
   - `search:read` - Search messages
   - `users.profile:write` - Update status
4. Install the app to your workspace
5. Copy the "Bot User OAuth Token" (starts with `xoxb-`)
6. Authenticate:

```bash
slack auth --token xoxb-your-token-here
```

Credentials are stored in `~/.config/slack/credentials.json`.

## Commands

### Authentication
```bash
slack auth --token <token>      # Save credentials
slack whoami                     # Show current user
slack whoami --json              # JSON output
```

### Channels
```bash
slack channels                          # List all channels
slack channels --type public_channel    # Public only
slack channels --type private_channel   # Private only
slack channels --json                   # JSON output

slack channel <channel-id>              # Show channel details
slack channel C123456 --limit 20        # Show with 20 recent messages
```

### Messages
```bash
# Send a message
slack send --channel C123456 --text "Hello team!"

# Reply to a thread
slack send --channel C123456 --text "Reply" --thread 1234567890.123456

# Get recent messages
slack messages --channel C123456
slack messages --channel C123456 --limit 50 --json
```

### Users
```bash
slack users                     # List all users
slack users --json              # JSON output
slack user U123456              # Show user details
```

### Search
```bash
slack search "deploy error"              # Search messages
slack search "project status" --json     # JSON output
slack search "error" --limit 50          # More results
```

### Status
```bash
slack status --text "In a meeting" --emoji ":calendar:"    # Set status
slack status --text "Working from home" --emoji ":house:"   # Update status
slack status                                                 # Clear status
```

## JSON Output

All commands support `--json` for structured output:

```bash
slack channels --json | jq '.[] | select(.is_private == false)'
slack users --json | jq '.[] | select(.email | contains("@company.com"))'
```

## Security

- Credentials stored with 600 permissions (user-only)
- Bot tokens have limited scopes based on your app configuration
- Never commit tokens to version control
- Rotate tokens if compromised

## Examples

### Daily Standup Report
```bash
# Send morning update
slack send --channel C123456 --text "🌅 Good morning! Today's focus:
• Complete API integration
• Review PRs
• Update documentation"
```

### Monitor Channel Activity
```bash
# Get last 5 messages from alerts channel
slack messages --channel CAlerts --limit 5 --json | jq -r '.[].text'
```

### Search for Decisions
```bash
# Find decision messages
slack search "decided to use" --json | jq -r '.[] | "\(.channel): \(.text)"'
```

### Team Directory
```bash
# Export team list
slack users --json | jq -r '.[] | "\(.name): \(.email)"' > team.txt
```

## API Reference

This skill uses the Slack Web API:
https://api.slack.com/web

Rate limits: https://api.slack.com/docs/rate-limits

## Troubleshooting

**"Authentication required" error**
- Run `slack auth --token <token>` with a valid bot token
- Token should start with `xoxb-`

**"channel_not_found" error**
- Bot must be invited to the channel first
- Use `/invite @YourBotName` in Slack

**"missing_scope" error**
- Your app needs additional OAuth scopes
- Reinstall the app after adding scopes

**Rate limiting**
- Slack allows ~1 request per second for most endpoints
- The skill will show an error if you hit limits

## Privacy Note

This skill accesses workspace data through the Slack API. Only data your bot token has access to is available. Private channels require the bot to be explicitly invited.

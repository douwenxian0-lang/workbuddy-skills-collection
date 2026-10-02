#!/usr/bin/env node

/**
 * Slack Skill for OpenClaw/Clawd
 * Manage Slack workspaces, channels, and messages
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG_DIR = path.join(require('os').homedir(), '.config', 'slack');
const CREDENTIALS_FILE = path.join(CONFIG_DIR, 'credentials.json');

// Ensure config directory exists
function ensureConfig() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// Read credentials
function getCredentials() {
  try {
    const data = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

// Save credentials
function saveCredentials(creds) {
  ensureConfig();
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2));
  fs.chmodSync(CREDENTIALS_FILE, 0o600);
}

// API request helper
function apiRequest(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const creds = getCredentials();
    if (!creds?.token) {
      reject(new Error('Authentication required. Run: slack auth --token <your-token>'));
      return;
    }

    const url = new URL(`https://slack.com/api/${endpoint}`);
    if (options.query) {
      Object.entries(options.query).forEach(([k, v]) => {
        if (v !== undefined) url.searchParams.append(k, v);
      });
    }

    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${creds.token}`,
        'Content-Type': 'application/json; charset=utf-8'
      }
    };

    const req = https.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (!json.ok) {
            reject(new Error(`Slack API error: ${json.error}`));
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

// Format output
function output(data, format = 'pretty') {
  if (format === 'json') {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(data);
  }
}

// Commands
const commands = {
  // Authentication
  async auth(args) {
    const token = args['--token'];
    if (!token) {
      console.error('Usage: slack auth --token <your-token>');
      process.exit(1);
    }

    // Validate token by making a test request
    try {
      const test = await apiRequest('auth.test', { token });
      saveCredentials({ token, team: test.team, user: test.user });
      console.log(`✓ Authenticated as @${test.user} on ${test.team}`);
    } catch (e) {
      console.error(`✗ Authentication failed: ${e.message}`);
      process.exit(1);
    }
  },

  async whoami(args) {
    const creds = getCredentials();
    if (!creds) {
      console.error('Not authenticated. Run: slack auth --token <token>');
      process.exit(1);
    }
    
    const data = await apiRequest('auth.test');
    const result = {
      user: data.user,
      user_id: data.user_id,
      team: data.team,
      team_id: data.team_id,
      url: data.url
    };
    
    if (args['--json']) {
      output(result, 'json');
    } else {
      console.log(`@${data.user} on ${data.team}`);
      console.log(`Team ID: ${data.team_id}`);
      console.log(`User ID: ${data.user_id}`);
    }
  },

  // Channels
  async channels(args) {
    const types = args['--type'] || 'public_channel,private_channel';
    const data = await apiRequest('conversations.list', {
      query: { types, limit: args['--limit'] || 100 }
    });

    const channels = data.channels.map(c => ({
      id: c.id,
      name: c.name,
      is_private: c.is_private,
      num_members: c.num_members,
      topic: c.topic?.value || '',
      purpose: c.purpose?.value || ''
    }));

    if (args['--json']) {
      output(channels, 'json');
    } else {
      channels.forEach(c => {
        const privacy = c.is_private ? '🔒' : '#️⃣';
        console.log(`${privacy} ${c.name}`);
        console.log(`   ID: ${c.id} | Members: ${c.num_members || 'unknown'}`);
        if (c.topic) console.log(`   Topic: ${c.topic}`);
      });
    }
  },

  async channel(args) {
    const channelId = args['<channel-id>'] || args['--channel'];
    if (!channelId) {
      console.error('Usage: slack channel <channel-id>');
      process.exit(1);
    }

    const [info, history] = await Promise.all([
      apiRequest('conversations.info', { query: { channel: channelId } }),
      apiRequest('conversations.history', { 
        query: { channel: channelId, limit: args['--limit'] || 10 } 
      })
    ]);

    const result = {
      channel: info.channel,
      recent_messages: history.messages
    };

    if (args['--json']) {
      output(result, 'json');
    } else {
      const c = info.channel;
      console.log(`#${c.name}`);
      console.log(`ID: ${c.id}`);
      console.log(`Created: ${new Date(c.created * 1000).toISOString()}`);
      console.log(`Topic: ${c.topic?.value || '(none)'}`);
      console.log(`Purpose: ${c.purpose?.value || '(none)'}`);
      console.log(`\nRecent messages (${history.messages.length}):`);
      history.messages.forEach(m => {
        const time = new Date(parseFloat(m.ts) * 1000).toLocaleString();
        console.log(`  [${time}] <${m.user}>: ${m.text?.substring(0, 100)}${m.text?.length > 100 ? '...' : ''}`);
      });
    }
  },

  // Messages
  async send(args) {
    const channel = args['--channel'];
    const text = args['--text'] || args['<message>'];
    const thread = args['--thread'];

    if (!channel || !text) {
      console.error('Usage: slack send --channel <channel-id> --text "message"');
      process.exit(1);
    }

    const body = {
      channel,
      text,
      thread_ts: thread
    };

    const data = await apiRequest('chat.postMessage', { method: 'POST', body });
    
    if (args['--json']) {
      output({ ok: true, ts: data.ts, channel: data.channel }, 'json');
    } else {
      console.log(`✓ Message sent (ts: ${data.ts})`);
    }
  },

  async messages(args) {
    const channel = args['--channel'];
    if (!channel) {
      console.error('Usage: slack messages --channel <channel-id>');
      process.exit(1);
    }

    const data = await apiRequest('conversations.history', {
      query: {
        channel,
        limit: args['--limit'] || 20
      }
    });

    const messages = data.messages.map(m => ({
      ts: m.ts,
      user: m.user,
      text: m.text,
      thread_ts: m.thread_ts,
      reply_count: m.reply_count
    }));

    if (args['--json']) {
      output(messages, 'json');
    } else {
      messages.forEach(m => {
        const time = new Date(parseFloat(m.ts) * 1000).toLocaleString();
        const replies = m.reply_count ? ` (${m.reply_count} replies)` : '';
        console.log(`[${time}] <${m.user}>: ${m.text?.substring(0, 80)}${m.text?.length > 80 ? '...' : ''}${replies}`);
      });
    }
  },

  // Users
  async users(args) {
    const data = await apiRequest('users.list', {
      query: { limit: args['--limit'] || 100 }
    });

    const users = data.members
      .filter(u => !u.is_bot && !u.deleted)
      .map(u => ({
        id: u.id,
        name: u.name,
        real_name: u.real_name,
        email: u.profile?.email,
        status: u.profile?.status_text
      }));

    if (args['--json']) {
      output(users, 'json');
    } else {
      users.forEach(u => {
        console.log(`@${u.name} (${u.real_name})`);
        console.log(`   ID: ${u.id}`);
        if (u.email) console.log(`   Email: ${u.email}`);
        if (u.status) console.log(`   Status: ${u.status}`);
      });
    }
  },

  async user(args) {
    const userId = args['<user-id>'] || args['--user'];
    if (!userId) {
      console.error('Usage: slack user <user-id>');
      process.exit(1);
    }

    const data = await apiRequest('users.info', { query: { user: userId } });
    const u = data.user;

    const result = {
      id: u.id,
      name: u.name,
      real_name: u.real_name,
      email: u.profile?.email,
      status: u.profile?.status_text,
      status_emoji: u.profile?.status_emoji,
      title: u.profile?.title,
      timezone: u.tz,
      is_admin: u.is_admin,
      is_owner: u.is_owner
    };

    if (args['--json']) {
      output(result, 'json');
    } else {
      console.log(`@${u.name}`);
      console.log(`Real name: ${u.real_name}`);
      console.log(`ID: ${u.id}`);
      console.log(`Email: ${u.profile?.email || '(hidden)'}`);
      console.log(`Title: ${u.profile?.title || '(none)'}`);
      console.log(`Timezone: ${u.tz}`);
      if (u.profile?.status_text) {
        console.log(`Status: ${u.profile.status_emoji} ${u.profile.status_text}`);
      }
    }
  },

  // Search
  async search(args) {
    const query = args['<query>'] || args['--query'];
    if (!query) {
      console.error('Usage: slack search "query"');
      process.exit(1);
    }

    const data = await apiRequest('search.messages', {
      query: { query, count: args['--limit'] || 20 }
    });

    const matches = data.messages?.matches?.map(m => ({
      channel: m.channel?.name,
      user: m.username,
      text: m.text,
      ts: m.ts,
      permalink: m.permalink
    })) || [];

    if (args['--json']) {
      output(matches, 'json');
    } else {
      console.log(`Found ${data.messages?.total || 0} messages`);
      matches.forEach(m => {
        const time = new Date(parseFloat(m.ts) * 1000).toLocaleString();
        console.log(`\n[${time}] #${m.channel} @${m.user}:`);
        console.log(`  ${m.text?.substring(0, 150)}${m.text?.length > 150 ? '...' : ''}`);
      });
    }
  },

  // Status
  async status(args) {
    const text = args['--text'];
    const emoji = args['--emoji'] || '';

    const profile = {
      status_text: text || '',
      status_emoji: emoji,
      status_expiration: 0
    };

    await apiRequest('users.profile.set', {
      method: 'POST',
      body: { profile: JSON.stringify(profile) }
    });

    if (text) {
      console.log(`✓ Status set: ${emoji} ${text}`);
    } else {
      console.log('✓ Status cleared');
    }
  },

  // Help
  help() {
    console.log(`
Slack Skill for OpenClaw/Clawd

USAGE:
  slack <command> [options]

COMMANDS:
  auth --token <token>           Authenticate with Slack
  whoami                         Show current user info
  channels [--type types]        List channels
  channel <id>                   Show channel details
  send --channel <id> --text "msg"  Send a message
  messages --channel <id>        Get recent messages
  users                          List workspace users
  user <id>                      Show user details
  search "query"                 Search messages
  status [--text "msg"] [--emoji :emoji:]  Set/clear status
  help                           Show this help

OPTIONS:
  --json                         Output JSON format
  --limit <n>                    Limit results (default: 20)

EXAMPLES:
  slack auth --token xoxb-123456789
  slack channels
  slack send --channel C123456 --text "Hello team!"
  slack messages --channel C123456 --limit 50
  slack search "deploy error" --json
`);
  }
};

// Parse arguments
function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg;
      const val = argv[i + 1];
      if (val && !val.startsWith('--')) {
        args[key] = val;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(arg);
    }
  }
  // Support positional args
  if (args._.length > 1) {
    args['<command>'] = args._[0];
    args['<channel-id>'] = args._[1];
    args['<user-id>'] = args._[1];
    args['<message>'] = args._[1];
    args['<query>'] = args._.slice(1).join(' ');
  }
  return args;
}

// Main
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || 'help';

  if (command === 'help' || command === '--help' || command === '-h') {
    commands.help();
    return;
  }

  if (!commands[command]) {
    console.error(`Unknown command: ${command}`);
    console.error('Run "slack help" for usage');
    process.exit(1);
  }

  try {
    await commands[command](args);
  } catch (e) {
    if (args['--json']) {
      console.log(JSON.stringify({ error: e.message }));
    } else {
      console.error(`Error: ${e.message}`);
    }
    process.exit(1);
  }
}

main();

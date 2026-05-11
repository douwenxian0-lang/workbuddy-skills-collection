/**
 * wanman recv [--agent <name>]
 */

import { RPC_METHODS } from '@wanman/core';
import type { AgentMessage } from '@wanman/core';
import { rpcCall } from '../transport.js';

export async function recvCommand(args: string[]): Promise<void> {
  let agent = process.env['WANMAN_AGENT_NAME'] || '';

  const agentIdx = args.indexOf('--agent');
  if (agentIdx !== -1 && args[agentIdx + 1]) {
    agent = args[agentIdx + 1]!;
  }

  if (!agent) {
    console.error('Usage: wanman recv [--agent <name>]');
    console.error('Or set WANMAN_AGENT_NAME environment variable');
    process.exit(1);
  }

  const resp = await rpcCall(RPC_METHODS.AGENT_RECV, { agent, limit: 10 });

  if (resp.error) {
    console.error(`Error: ${resp.error.message}`);
    process.exit(1);
  }

  const { messages } = resp.result as { messages: AgentMessage[] };

  if (messages.length === 0) {
    console.log('No pending messages.');
    return;
  }

  for (const msg of messages) {
    const time = new Date(msg.timestamp).toISOString();
    const tag = msg.priority === 'steer' ? '[STEER]' : `[${msg.type}]`;
    const text = typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload);
    console.log(`${tag} ${msg.from} (${time}): ${text}`);
  }
}

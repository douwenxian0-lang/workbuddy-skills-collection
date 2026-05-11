/**
 * wanman escalate <message> — shortcut to send a steer message to ceo-agent
 */

import { RPC_METHODS } from '@wanman/core';
import { rpcCall } from '../transport.js';

export async function escalateCommand(args: string[]): Promise<void> {
  const content = args.join(' ');

  if (!content) {
    console.error('Usage: wanman escalate <message>');
    process.exit(1);
  }

  const from = process.env['WANMAN_AGENT_NAME'] || 'cli';

  const resp = await rpcCall(RPC_METHODS.AGENT_SEND, {
    from,
    to: 'ceo',
    type: 'message',
    payload: content,
    priority: 'steer',
  });

  if (resp.error) {
    // If ceo agent doesn't exist, try ceo-agent
    if (resp.error.message.includes('not found')) {
      console.error('No CEO agent found. Make sure a "ceo" agent is configured.');
    } else {
      console.error(`Error: ${resp.error.message}`);
    }
    process.exit(1);
  }

  const result = resp.result as { id: string; status: string };
  console.log(`Escalated to CEO: ${result.id} (${result.status})`);
}

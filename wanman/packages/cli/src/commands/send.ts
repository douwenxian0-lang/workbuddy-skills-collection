/**
 * wanman send <agent> <message> [--steer] [--type <message|decision|blocker>]
 */

import { RPC_METHODS } from '@wanman/core';
import { rpcCall } from '../transport.js';

const SEND_MESSAGE_TYPES = new Set(['message', 'decision', 'blocker']);

export async function sendCommand(args: string[]): Promise<void> {
  const steerIdx = args.indexOf('--steer');
  const isSteer = steerIdx !== -1;
  if (isSteer) args.splice(steerIdx, 1);

  const typeIdx = args.indexOf('--type');
  let messageType = 'message';
  if (typeIdx !== -1) {
    const rawType = args[typeIdx + 1]?.trim().toLowerCase();
    if (!rawType || !SEND_MESSAGE_TYPES.has(rawType)) {
      console.error('Error: --type must be one of "message", "decision", or "blocker"');
      process.exit(1);
    }
    messageType = rawType;
    args.splice(typeIdx, 2);
  }

  const to = args[0];
  const content = args.slice(1).join(' ');

  if (!to || !content) {
    console.error('Usage: wanman send <agent> <message> [--steer] [--type <message|decision|blocker>]');
    process.exit(1);
  }

  const from = process.env['WANMAN_AGENT_NAME'] || 'cli';
  const priority = isSteer ? 'steer' : 'normal';

  const resp = await rpcCall(RPC_METHODS.AGENT_SEND, {
    from,
    to,
    type: messageType,
    payload: content,
    priority,
  });

  if (resp.error) {
    console.error(`Error: ${resp.error.message}`);
    process.exit(1);
  }

  const result = resp.result as { id: string; status: string };
  console.log(`Message ${result.id} ${result.status} → ${to} (${messageType}, ${priority})`);
}

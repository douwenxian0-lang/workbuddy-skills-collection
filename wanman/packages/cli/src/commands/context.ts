/**
 * wanman context get <key>
 * wanman context set <key> <value>
 */

import { RPC_METHODS } from '@wanman/core';
import type { ContextEntry } from '@wanman/core';
import { rpcCall } from '../transport.js';

export async function contextCommand(args: string[]): Promise<void> {
  const subcommand = args[0];

  if (subcommand === 'get') {
    const key = args[1];
    if (!key) {
      console.error('Usage: wanman context get <key>');
      process.exit(1);
    }

    const resp = await rpcCall(RPC_METHODS.CONTEXT_GET, { key });
    if (resp.error) {
      console.error(`Error: ${resp.error.message}`);
      process.exit(1);
    }

    const entry = resp.result as ContextEntry | null;
    if (!entry) {
      console.log(`Key "${key}" not found.`);
      return;
    }

    console.log(entry.value);
  } else if (subcommand === 'set') {
    const key = args[1];
    const value = args.slice(2).join(' ');
    if (!key || !value) {
      console.error('Usage: wanman context set <key> <value>');
      process.exit(1);
    }

    const agent = process.env['WANMAN_AGENT_NAME'] || 'cli';
    const resp = await rpcCall(RPC_METHODS.CONTEXT_SET, { key, value, agent });
    if (resp.error) {
      console.error(`Error: ${resp.error.message}`);
      process.exit(1);
    }

    console.log(`Set "${key}" = "${value}"`);
  } else {
    console.error('Usage: wanman context get|set <key> [value]');
    process.exit(1);
  }
}

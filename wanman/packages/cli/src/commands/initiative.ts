import { RPC_METHODS } from '@wanman/core';
import { rpcCall } from '../transport.js';

const USAGE = `Usage:
  wanman initiative create <title> --goal <goal> [--summary <text>] [--priority <1-10>] [--source <p1,p2>] [--status <active|paused|completed|abandoned>]
  wanman initiative list [--status <status>]
  wanman initiative get <id>
  wanman initiative update <id> [--title <text>] [--goal <text>] [--summary <text>] [--priority <1-10>] [--source <p1,p2>] [--status <status>]`;

export async function initiativeCommand(args: string[]): Promise<void> {
  const sub = args[0];

  switch (sub) {
    case 'create': {
      const title = extractPositional(args.slice(1));
      const goal = extractFlag(args, '--goal');
      if (!title || !goal) {
        console.error(USAGE);
        process.exit(1);
      }
      const agent = process.env['WANMAN_AGENT_NAME'] || 'cli';
      const resp = await rpcCall(RPC_METHODS.INITIATIVE_CREATE, {
        title,
        goal,
        summary: extractFlag(args, '--summary'),
        priority: parseInt(extractFlag(args, '--priority') || '5', 10),
        status: extractFlag(args, '--status'),
        sources: extractCsvFlag(args, '--source'),
        agent,
      });
      if (resp.error) {
        console.error(`Error: ${resp.error.message}`);
        process.exit(1);
      }
      const initiative = resp.result as { id: string; title: string; status: string };
      console.log(`Initiative ${initiative.id} created: "${initiative.title}" [${initiative.status}]`);
      break;
    }

    case 'list': {
      const resp = await rpcCall(RPC_METHODS.INITIATIVE_LIST, {
        status: extractFlag(args, '--status'),
      });
      if (resp.error) {
        console.error(`Error: ${resp.error.message}`);
        process.exit(1);
      }
      const { initiatives } = resp.result as { initiatives: Array<{ id: string; title: string; status: string; priority: number; summary: string }> };
      if (initiatives.length === 0) {
        console.log('No initiatives found.');
        return;
      }
      for (const initiative of initiatives) {
        console.log(`[${initiative.status}] ${initiative.id.slice(0, 8)} P${initiative.priority} "${initiative.title}" — ${initiative.summary.slice(0, 100)}`);
      }
      console.log(`\n${initiatives.length} initiative(s)`);
      break;
    }

    case 'get': {
      const id = args[1];
      if (!id) {
        console.error('Usage: wanman initiative get <id>');
        process.exit(1);
      }
      const resp = await rpcCall(RPC_METHODS.INITIATIVE_GET, { id });
      if (resp.error) {
        console.error(`Error: ${resp.error.message}`);
        process.exit(1);
      }
      console.log(JSON.stringify(resp.result, null, 2));
      break;
    }

    case 'update': {
      const id = args[1];
      if (!id) {
        console.error(USAGE);
        process.exit(1);
      }
      const agent = process.env['WANMAN_AGENT_NAME'] || 'cli';
      const resp = await rpcCall(RPC_METHODS.INITIATIVE_UPDATE, {
        id,
        title: extractFlag(args, '--title'),
        goal: extractFlag(args, '--goal'),
        summary: extractFlag(args, '--summary'),
        priority: extractFlag(args, '--priority') ? parseInt(extractFlag(args, '--priority')!, 10) : undefined,
        status: extractFlag(args, '--status'),
        sources: extractFlag(args, '--source') ? extractCsvFlag(args, '--source') : undefined,
        agent,
      });
      if (resp.error) {
        console.error(`Error: ${resp.error.message}`);
        process.exit(1);
      }
      const initiative = resp.result as { id: string; status: string };
      console.log(`Initiative ${initiative.id} updated [${initiative.status}]`);
      break;
    }

    default:
      console.error(USAGE);
      process.exit(1);
  }
}

function extractPositional(args: string[]): string {
  const parts: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i]!.startsWith('--')) {
      i++;
      continue;
    }
    parts.push(args[i]!);
  }
  return parts.join(' ');
}

function extractFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function extractCsvFlag(args: string[], flag: string): string[] {
  const value = extractFlag(args, flag);
  if (!value) return [];
  return value.split(',').map(part => part.trim()).filter(Boolean);
}

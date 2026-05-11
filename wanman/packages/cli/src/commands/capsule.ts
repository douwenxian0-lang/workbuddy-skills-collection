import { RPC_METHODS } from '@wanman/core';
import { rpcCall } from '../transport.js';

const USAGE = `Usage:
  wanman capsule create --goal <goal> --owner <agent> --branch <name> --base <sha> --paths <p1,p2> --acceptance <text> [--initiative <id>] [--task <id>] [--reviewer <agent>] [--subsystem <label>] [--scope-type <code|docs|tests|ops|mixed>] [--blocked-by <id1,id2>] [--supersedes <id>]
  wanman capsule list [--status <open|in_review|merged|abandoned>] [--owner <agent>] [--initiative <id>] [--reviewer <agent>]
  wanman capsule mine [--agent <name>] [--status <status>]
  wanman capsule get <id>
  wanman capsule update <id> [--goal <text>] [--owner <agent>] [--branch <name>] [--base <sha>] [--paths <p1,p2>] [--acceptance <text>] [--initiative <id>] [--task <id>] [--reviewer <agent>] [--subsystem <label>] [--scope-type <code|docs|tests|ops|mixed>] [--blocked-by <id1,id2>] [--supersedes <id>] [--status <status>]`;

export async function capsuleCommand(args: string[]): Promise<void> {
  const sub = args[0];

  switch (sub) {
    case 'create': {
      const goal = extractFlag(args, '--goal');
      const ownerAgent = extractFlag(args, '--owner');
      const branch = extractFlag(args, '--branch');
      const baseCommit = extractFlag(args, '--base');
      const acceptance = extractFlag(args, '--acceptance');
      const allowedPaths = extractCsvFlag(args, '--paths');
      if (!goal || !ownerAgent || !branch || !baseCommit || !acceptance || allowedPaths.length === 0) {
        console.error(USAGE);
        process.exit(1);
      }
      const agent = process.env['WANMAN_AGENT_NAME'] || 'cli';
      const resp = await rpcCall(RPC_METHODS.CAPSULE_CREATE, {
        goal,
        ownerAgent,
        branch,
        baseCommit,
        allowedPaths,
        acceptance,
        reviewer: extractFlag(args, '--reviewer'),
        initiativeId: extractFlag(args, '--initiative'),
        taskId: extractFlag(args, '--task'),
        subsystem: extractFlag(args, '--subsystem'),
        scopeType: extractFlag(args, '--scope-type'),
        blockedBy: extractCsvFlag(args, '--blocked-by'),
        supersedes: extractFlag(args, '--supersedes'),
        agent,
      });
      if (resp.error) {
        console.error(`Error: ${resp.error.message}`);
        process.exit(1);
      }
      const capsule = resp.result as { id: string; branch: string; status: string; conflicts?: Array<{ capsuleId: string; level: string }> };
      console.log(`Capsule ${capsule.id} created on ${capsule.branch} [${capsule.status}]`);
      if (capsule.conflicts && capsule.conflicts.length > 0) {
        console.log(`Weak conflicts: ${capsule.conflicts.map(conflict => `${conflict.capsuleId.slice(0, 8)}(${conflict.level})`).join(', ')}`);
      }
      break;
    }

    case 'list': {
      const resp = await rpcCall(RPC_METHODS.CAPSULE_LIST, {
        status: extractFlag(args, '--status'),
        ownerAgent: extractFlag(args, '--owner'),
        initiativeId: extractFlag(args, '--initiative'),
        reviewer: extractFlag(args, '--reviewer'),
      });
      if (resp.error) {
        console.error(`Error: ${resp.error.message}`);
        process.exit(1);
      }
      const { capsules } = resp.result as {
        capsules: Array<{ id: string; goal: string; status: string; ownerAgent: string; branch: string; initiativeId?: string; taskId?: string }>;
      };
      if (capsules.length === 0) {
        console.log('No capsules found.');
        return;
      }
      for (const capsule of capsules) {
        const refs = [
          capsule.initiativeId ? `I:${capsule.initiativeId.slice(0, 8)}` : '',
          capsule.taskId ? `T:${capsule.taskId.slice(0, 8)}` : '',
        ].filter(Boolean).join(' ');
        console.log(`[${capsule.status}] ${capsule.id.slice(0, 8)} ${capsule.ownerAgent} ${capsule.branch} "${capsule.goal}"${refs ? ` [${refs}]` : ''}`);
      }
      console.log(`\n${capsules.length} capsule(s)`);
      break;
    }

    case 'mine': {
      const agent = extractFlag(args, '--agent') || process.env['WANMAN_AGENT_NAME'] || 'cli';
      const resp = await rpcCall(RPC_METHODS.CAPSULE_MINE, {
        agent,
        status: extractFlag(args, '--status'),
      });
      if (resp.error) {
        console.error(`Error: ${resp.error.message}`);
        process.exit(1);
      }
      const { capsules } = resp.result as {
        capsules: Array<{ id: string; goal: string; status: string; branch: string; acceptance: string }>;
      };
      if (capsules.length === 0) {
        console.log('No owned capsules found.');
        return;
      }
      for (const capsule of capsules) {
        console.log(`[${capsule.status}] ${capsule.id.slice(0, 8)} ${capsule.branch} "${capsule.goal}"`);
        console.log(`  acceptance: ${capsule.acceptance}`);
      }
      break;
    }

    case 'get': {
      const id = args[1];
      if (!id) {
        console.error('Usage: wanman capsule get <id>');
        process.exit(1);
      }
      const resp = await rpcCall(RPC_METHODS.CAPSULE_GET, { id });
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
      const allowedPaths = extractFlag(args, '--paths') ? extractCsvFlag(args, '--paths') : undefined;
      const blockedBy = extractFlag(args, '--blocked-by') ? extractCsvFlag(args, '--blocked-by') : undefined;
      const resp = await rpcCall(RPC_METHODS.CAPSULE_UPDATE, {
        id,
        goal: extractFlag(args, '--goal'),
        ownerAgent: extractFlag(args, '--owner'),
        branch: extractFlag(args, '--branch'),
        baseCommit: extractFlag(args, '--base'),
        allowedPaths,
        acceptance: extractFlag(args, '--acceptance'),
        reviewer: extractFlag(args, '--reviewer'),
        status: extractFlag(args, '--status'),
        initiativeId: extractFlag(args, '--initiative'),
        taskId: extractFlag(args, '--task'),
        subsystem: extractFlag(args, '--subsystem'),
        scopeType: extractFlag(args, '--scope-type'),
        blockedBy,
        supersedes: extractFlag(args, '--supersedes'),
        agent,
      });
      if (resp.error) {
        console.error(`Error: ${resp.error.message}`);
        process.exit(1);
      }
      const capsule = resp.result as { id: string; status: string };
      console.log(`Capsule ${capsule.id} updated [${capsule.status}]`);
      break;
    }

    default:
      console.error(USAGE);
      process.exit(1);
  }
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

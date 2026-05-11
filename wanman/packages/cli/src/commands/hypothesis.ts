/**
 * wanman hypothesis create|list|update
 *
 * CEO's divergent thinking tree — track hypotheses, branches, and outcomes.
 */

import { RPC_METHODS } from '@wanman/core';
import { rpcCall } from '../transport.js';

const USAGE = `Usage:
  wanman hypothesis create "<title>" [--rationale <text>] [--expected-value <text>] [--estimated-cost <text>] [--parent <id>]
  wanman hypothesis list [--status <proposed|active|validated|rejected|abandoned>] [--tree <root-id>]
  wanman hypothesis update <id> --status <status> [--outcome <text>] [--evidence <artifact-ids>]

Status values: proposed, active, validated, rejected, abandoned

Examples:
  wanman hypothesis create "Deepen location analysis" --rationale "Lacking specific site comparisons" --expected-value "Reduce rental risk" --estimated-cost "2-3 tasks"
  wanman hypothesis update 1 --status active
  wanman hypothesis update 1 --status validated --outcome "Identified optimal location" --evidence 42,43,44
  wanman hypothesis list --status active
  wanman hypothesis list --tree 1`;

export async function hypothesisCommand(args: string[]): Promise<void> {
  const sub = args[0];

  switch (sub) {
    case 'create': {
      const title = extractPositional(args.slice(1));
      const rationale = extractFlag(args, '--rationale');
      const expectedValue = extractFlag(args, '--expected-value');
      const estimatedCost = extractFlag(args, '--estimated-cost');
      const parentId = extractFlag(args, '--parent');

      if (!title) {
        console.error('Error: title is required');
        console.error(USAGE);
        process.exit(1);
      }

      const agent = process.env['WANMAN_AGENT_NAME'] || 'ceo';
      const resp = await rpcCall(RPC_METHODS.HYPOTHESIS_CREATE, {
        title,
        agent,
        rationale,
        expectedValue,
        estimatedCost,
        parentId: parentId ? parseInt(parentId, 10) : undefined,
      });

      if (resp.error) {
        console.error(`Error: ${resp.error.message}`);
        process.exit(1);
      }

      const rows = resp.result as Array<{ id: number }>;
      const id = Array.isArray(rows) && rows[0] ? rows[0].id : '?';
      console.log(`Hypothesis #${id} created: ${title}`);
      break;
    }

    case 'list': {
      const status = extractFlag(args, '--status');
      const treeRoot = extractFlag(args, '--tree');

      const resp = await rpcCall(RPC_METHODS.HYPOTHESIS_LIST, {
        status,
        treeRoot: treeRoot ? parseInt(treeRoot, 10) : undefined,
      });

      if (resp.error) {
        console.error(`Error: ${resp.error.message}`);
        process.exit(1);
      }

      const rows = resp.result as Array<{
        id: number; parent_id: number | null; title: string; status: string;
        rationale: string | null; outcome: string | null; created_at: string;
      }>;
      if (!Array.isArray(rows) || rows.length === 0) {
        console.log('No hypotheses found.');
        return;
      }

      const statusIcon: Record<string, string> = {
        proposed: '?', active: '>', validated: '+', rejected: 'x', abandoned: '-',
      };
      for (const h of rows) {
        const icon = statusIcon[h.status] ?? '?';
        const parent = h.parent_id ? ` (branch of #${h.parent_id})` : '';
        const outcome = h.outcome ? ` => ${h.outcome.slice(0, 60)}` : '';
        console.log(`[${icon}] #${h.id} ${h.status.padEnd(10)} ${h.title}${parent}${outcome}`);
      }
      console.log(`\n${rows.length} hypothesis(es)`);
      break;
    }

    case 'update': {
      const id = args[1];
      if (!id) {
        console.error('Error: hypothesis id is required');
        console.error(USAGE);
        process.exit(1);
      }
      const status = extractFlag(args, '--status');
      const outcome = extractFlag(args, '--outcome');
      const evidenceStr = extractFlag(args, '--evidence');
      const evidence = evidenceStr ? evidenceStr.split(',').map(s => parseInt(s.trim(), 10)) : undefined;

      if (!status) {
        console.error('Error: --status is required');
        process.exit(1);
      }

      const resp = await rpcCall(RPC_METHODS.HYPOTHESIS_UPDATE, {
        id: parseInt(id, 10),
        status,
        outcome,
        evidence,
      });

      if (resp.error) {
        console.error(`Error: ${resp.error.message}`);
        process.exit(1);
      }

      console.log(`Hypothesis #${id} updated: status=${status}`);
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

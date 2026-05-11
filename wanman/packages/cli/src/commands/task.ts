/**
 * wanman task create|list|get|update
 *
 * Task management for the Agent Matrix task pool.
 */

import { RPC_METHODS } from '@wanman/core';
import { rpcCall } from '../transport.js';

const USAGE = `Usage:
  wanman task create <title> [--assign <agent> | --assignee <agent>] [--priority <1-10>] [--parent <id>] [--after <id1,id2>] [--path <p1,p2>] [--pattern <g1,g2>] [--desc <description>] [--initiative <id>] [--capsule <id>] [--subsystem <label>] [--scope-type <code|docs|tests|ops|mixed>] [--profile <execution-profile>]
  wanman task list [--status <status>] [--assignee <agent>] [--initiative <id>] [--capsule <id>]
  wanman task get <id>
  wanman task update <id> --status <status> [--assign <agent> | --assignee <agent>] [--result <text>] [--initiative <id>] [--capsule <id>] [--subsystem <label>] [--scope-type <code|docs|tests|ops|mixed>] [--profile <execution-profile>]
  wanman task done <id> [result text]

--after <id1,id2>: task IDs that must be done before this task starts (comma-separated)
--path <p1,p2>: explicit files or directories this task owns
--pattern <g1,g2>: glob-like path prefixes this task owns`;

export async function taskCommand(args: string[]): Promise<void> {
  const sub = args[0];

  switch (sub) {
    case 'create': {
      const title = extractPositional(args.slice(1));
      if (!title) {
        console.error(USAGE);
        process.exit(1);
      }
      const agent = process.env['WANMAN_AGENT_NAME'] || 'cli';
      const afterStr = extractFlag(args, '--after');
      const dependsOn = afterStr ? afterStr.split(',').map(s => s.trim()).filter(Boolean) : undefined;
      const paths = extractCsvFlag(args, '--path');
      const patterns = extractCsvFlag(args, '--pattern');
      const resp = await rpcCall(RPC_METHODS.TASK_CREATE, {
        title,
        description: extractFlag(args, '--desc') || '',
        assignee: extractAssigneeFlag(args),
        priority: parseInt(extractFlag(args, '--priority') || '5', 10),
        parentId: extractFlag(args, '--parent'),
        dependsOn,
        initiativeId: extractFlag(args, '--initiative'),
        capsuleId: extractFlag(args, '--capsule'),
        subsystem: extractFlag(args, '--subsystem'),
        scopeType: extractFlag(args, '--scope-type'),
        executionProfile: extractFlag(args, '--profile'),
        scope: paths.length > 0 || patterns.length > 0 ? {
          paths,
          ...(patterns.length > 0 ? { patterns } : {}),
        } : undefined,
        agent,
      });
      if (resp.error) {
        console.error(`Error: ${resp.error.message}`);
        process.exit(1);
      }
      const task = resp.result as { id: string; title: string; status: string };
      console.log(`Task ${task.id} created: "${task.title}" [${task.status}]`);
      break;
    }

    case 'list': {
      const status = extractFlag(args, '--status');
      const assignee = extractFlag(args, '--assignee');
      const initiativeId = extractFlag(args, '--initiative');
      const capsuleId = extractFlag(args, '--capsule');
      const resp = await rpcCall(RPC_METHODS.TASK_LIST, {
        status,
        assignee,
        initiativeId,
        capsuleId,
      });
      if (resp.error) {
        console.error(`Error: ${resp.error.message}`);
        process.exit(1);
      }
      const { tasks } = resp.result as { tasks: Array<{ id: string; title: string; status: string; assignee?: string; priority: number; dependsOn?: string[]; initiativeId?: string; capsuleId?: string }> };
      if (tasks.length === 0) {
        console.log('No tasks found.');
        return;
      }
      const displayTasks = await getDependencyStatusSource(tasks, { status, assignee, initiativeId, capsuleId });
      const doneTaskIds = displayTasks.filter(t => t.status === 'done').map(t => t.id);
      for (const t of tasks) {
        const assigneeLabel = t.assignee ? ` → ${t.assignee}` : '';
        const deps = t.dependsOn ?? [];
        const blocked = deps.length > 0 && deps.some(d => !doneTaskIds.some(doneId => taskIdsMatch(doneId, d)));
        const statusLabel = blocked ? `blocked` : t.status;
        const depInfo = deps.length > 0 ? ` (after: ${deps.map(d => d.slice(0, 8)).join(',')})` : '';
        const boardInfo = [
          t.initiativeId ? `I:${t.initiativeId.slice(0, 8)}` : '',
          t.capsuleId ? `C:${t.capsuleId.slice(0, 8)}` : '',
        ].filter(Boolean).join(' ');
        console.log(`[${statusLabel}] ${t.id.slice(0, 8)} P${t.priority} "${t.title}"${assigneeLabel}${depInfo}${boardInfo ? ` [${boardInfo}]` : ''}`);
      }
      console.log(`\n${tasks.length} task(s)`);
      break;
    }

    case 'get': {
      const id = args[1];
      if (!id) {
        console.error('Usage: wanman task get <id>');
        process.exit(1);
      }
      const resp = await rpcCall(RPC_METHODS.TASK_GET, { id });
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
      const resp = await rpcCall(RPC_METHODS.TASK_UPDATE, {
        id,
        status: extractFlag(args, '--status'),
        assignee: extractAssigneeFlag(args),
        result: extractFlag(args, '--result'),
        initiativeId: extractFlag(args, '--initiative'),
        capsuleId: extractFlag(args, '--capsule'),
        subsystem: extractFlag(args, '--subsystem'),
        scopeType: extractFlag(args, '--scope-type'),
        executionProfile: extractFlag(args, '--profile'),
        agent,
      });
      if (resp.error) {
        console.error(`Error: ${resp.error.message}`);
        process.exit(1);
      }
      const task = resp.result as { id: string; status: string };
      console.log(`Task ${task.id} updated [${task.status}]`);
      break;
    }

    case 'done': {
      const id = args[1];
      if (!id) {
        console.error('Usage: wanman task done <id> [result text]');
        process.exit(1);
      }
      const resultText = args.slice(2).join(' ') || undefined;
      const agent = process.env['WANMAN_AGENT_NAME'] || 'cli';
      const resp = await rpcCall(RPC_METHODS.TASK_UPDATE, {
        id,
        status: 'done',
        result: resultText,
        agent,
      });
      if (resp.error) {
        console.error(`Error: ${resp.error.message}`);
        process.exit(1);
      }
      console.log(`Task ${id} marked done.`);
      break;
    }

    default:
      console.error(USAGE);
      process.exit(1);
  }
}

/** Extract positional args (everything before flags). */
function extractPositional(args: string[]): string {
  const parts: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i]!.startsWith('--')) {
      i++; // skip flag value
      continue;
    }
    parts.push(args[i]!);
  }
  return parts.join(' ');
}

/** Extract a flag value: --flag value */
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

function extractAssigneeFlag(args: string[]): string | undefined {
  return extractFlag(args, '--assign') ?? extractFlag(args, '--assignee');
}

function taskIdsMatch(taskId: string, reference: string): boolean {
  return taskId === reference || taskId.startsWith(reference) || reference.startsWith(taskId);
}

async function getDependencyStatusSource(
  tasks: Array<{ id: string; status: string; dependsOn?: string[] }>,
  filter: { status?: string; assignee?: string; initiativeId?: string; capsuleId?: string },
): Promise<Array<{ id: string; status: string; dependsOn?: string[] }>> {
  const hasDependencyFilteredView = Boolean((filter.status || filter.assignee || filter.initiativeId || filter.capsuleId) && tasks.some(t => (t.dependsOn ?? []).length > 0));
  if (!hasDependencyFilteredView) {
    return tasks;
  }

  const resp = await rpcCall(RPC_METHODS.TASK_LIST, {});
  if (resp.error) {
    console.error(`Error: ${resp.error.message}`);
    process.exit(1);
  }

  const { tasks: allTasks } = resp.result as {
    tasks: Array<{ id: string; status: string; dependsOn?: string[] }>;
  };
  return allTasks;
}

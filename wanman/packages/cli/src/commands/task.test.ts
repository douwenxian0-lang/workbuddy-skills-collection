import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../transport.js', () => ({
  rpcCall: vi.fn(),
}));

import { taskCommand } from './task.js';
import { rpcCall } from '../transport.js';

const mockRpcCall = vi.mocked(rpcCall);
const expectedAgent = process.env['WANMAN_AGENT_NAME'] || 'cli';

describe('taskCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  it('passes scope paths and patterns through task create', async () => {
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0',
      id: 1,
      result: { id: 'task-1', title: 'Refactor supervisor', status: 'pending' },
    });

    await taskCommand([
      'create',
      'Refactor supervisor',
      '--assign', 'dev',
      '--path', 'packages/runtime/src/supervisor.ts,packages/runtime/src/agent-process.ts',
      '--pattern', 'packages/runtime/src/__tests__/**',
      '--initiative', 'initiative-1',
      '--capsule', 'capsule-1',
      '--subsystem', 'runtime-supervisor',
      '--scope-type', 'code',
      '--profile', 'runtime.patch',
    ]);

    expect(mockRpcCall).toHaveBeenCalledWith('task.create', expect.objectContaining({
      title: 'Refactor supervisor',
      assignee: 'dev',
      initiativeId: 'initiative-1',
      capsuleId: 'capsule-1',
      subsystem: 'runtime-supervisor',
      scopeType: 'code',
      executionProfile: 'runtime.patch',
      scope: {
        paths: [
          'packages/runtime/src/supervisor.ts',
          'packages/runtime/src/agent-process.ts',
        ],
        patterns: ['packages/runtime/src/__tests__/**'],
      },
    }));
  });

  it('accepts --assignee as an alias for task create', async () => {
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0',
      id: 1,
      result: { id: 'task-2', title: 'Refactor task parsing', status: 'pending' },
    });

    await taskCommand([
      'create',
      'Refactor task parsing',
      '--assignee', 'dev-2',
    ]);

    expect(mockRpcCall).toHaveBeenCalledWith('task.create', expect.objectContaining({
      title: 'Refactor task parsing',
      assignee: 'dev-2',
    }));
  });

  it('passes assignee updates through task update when using --assignee', async () => {
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0',
      id: 1,
      result: { id: 'task-3', status: 'assigned' },
    });

    await taskCommand([
      'update',
      'task-3',
      '--status', 'assigned',
      '--assignee', 'dev',
    ]);

    expect(mockRpcCall).toHaveBeenCalledWith('task.update', expect.objectContaining({
      id: 'task-3',
      status: 'assigned',
      assignee: 'dev',
    }));
  });

  it('passes --profile through task update', async () => {
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0',
      id: 1,
      result: { id: 'task-4', status: 'assigned' },
    });

    await taskCommand([
      'update',
      'task-4',
      '--status', 'assigned',
      '--profile', 'marketing.launch_copy',
    ]);

    expect(mockRpcCall).toHaveBeenCalledWith('task.update', expect.objectContaining({
      id: 'task-4',
      status: 'assigned',
      executionProfile: 'marketing.launch_copy',
    }));
  });

  it('exits when task create is missing a title', async () => {
    await expect(taskCommand(['create'])).rejects.toThrow('process.exit');
    expect(console.error).toHaveBeenCalled();
  });

  it('renders done tasks with prefix dependencies as done instead of blocked', async () => {
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0',
      id: 1,
      result: {
        tasks: [
          {
            id: '2d3706c8-7e9a-4b2f-9120-aaaaaaaaaaaa',
            title: 'Dependency task',
            status: 'done',
            priority: 2,
          },
          {
            id: '0df967bb-7286-4a9c-82ad-a9b20fb782a7',
            title: 'Document support-email webhook operator setup and release impact',
            status: 'done',
            assignee: 'marketing',
            priority: 3,
            dependsOn: ['2d3706c8'],
          },
        ],
      },
    });

    await taskCommand(['list']);

    expect(console.log).toHaveBeenCalledWith('[done] 2d3706c8 P2 "Dependency task"');
    expect(console.log).toHaveBeenCalledWith(
      '[done] 0df967bb P3 "Document support-email webhook operator setup and release impact" → marketing (after: 2d3706c8)'
    );
  });

  it('renders assignee-filtered dependency-complete tasks as done', async () => {
    mockRpcCall
      .mockResolvedValueOnce({
        jsonrpc: '2.0',
        id: 1,
        result: {
          tasks: [
            {
              id: '0df967bb-7286-4a9c-82ad-a9b20fb782a7',
              title: 'Document support-email webhook operator setup and release impact',
              status: 'done',
              assignee: 'marketing',
              priority: 3,
              dependsOn: ['2d3706c8'],
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        jsonrpc: '2.0',
        id: 2,
        result: {
          tasks: [
            {
              id: '2d3706c8-7e9a-4b2f-9120-aaaaaaaaaaaa',
              title: 'Dependency task',
              status: 'done',
              priority: 2,
            },
            {
              id: '0df967bb-7286-4a9c-82ad-a9b20fb782a7',
              title: 'Document support-email webhook operator setup and release impact',
              status: 'done',
              assignee: 'marketing',
              priority: 3,
              dependsOn: ['2d3706c8'],
            },
          ],
        },
      });

    await taskCommand(['list', '--assignee', 'marketing']);

    expect(mockRpcCall).toHaveBeenNthCalledWith(1, 'task.list', { assignee: 'marketing', status: undefined });
    expect(mockRpcCall).toHaveBeenNthCalledWith(2, 'task.list', {});
    expect(console.log).toHaveBeenCalledWith(
      '[done] 0df967bb P3 "Document support-email webhook operator setup and release impact" → marketing (after: 2d3706c8)'
    );
  });

  it('renders blocked when dependency is still incomplete even if assignee is present', async () => {
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0',
      id: 1,
      result: {
        tasks: [
          {
            id: '17717fad-5393-41ff-8d10-bbc870c4ba3c',
            title: 'Record actual runtime token usage in supervisor metrics',
            status: 'assigned',
            assignee: 'dev-3',
            priority: 6,
          },
          {
            id: '8514bc30-1234-4567-89ab-1234567890ab',
            title: 'Reproduce and fix task assignee drift outside metrics-owned files',
            status: 'assigned',
            assignee: 'dev-2',
            priority: 7,
            dependsOn: ['17717fad'],
          },
        ],
      },
    });

    await taskCommand(['list']);

    expect(console.log).toHaveBeenCalledWith(
      '[assigned] 17717fad P6 "Record actual runtime token usage in supervisor metrics" → dev-3'
    );
    expect(console.log).toHaveBeenCalledWith(
      '[blocked] 8514bc30 P7 "Reproduce and fix task assignee drift outside metrics-owned files" → dev-2 (after: 17717fad)'
    );
  });

  it('prints a friendly message when task list is empty', async () => {
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0',
      id: 1,
      result: { tasks: [] },
    });

    await taskCommand(['list', '--assignee', 'dev']);

    expect(mockRpcCall).toHaveBeenCalledWith('task.list', { assignee: 'dev', status: undefined });
    expect(console.log).toHaveBeenCalledWith('No tasks found.');
  });

  it('exits when task list returns an RPC error', async () => {
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32000, message: 'list failed' },
    });

    await expect(taskCommand(['list'])).rejects.toThrow('process.exit');
    expect(console.error).toHaveBeenCalledWith('Error: list failed');
  });

  it('prints task details for task get', async () => {
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0',
      id: 1,
      result: { id: 'task-1', status: 'assigned', assignee: 'dev' },
    });

    await taskCommand(['get', 'task-1']);

    expect(mockRpcCall).toHaveBeenCalledWith('task.get', { id: 'task-1' });
    expect(console.log).toHaveBeenCalledWith(JSON.stringify({ id: 'task-1', status: 'assigned', assignee: 'dev' }, null, 2));
  });

  it('exits when task get is missing an id', async () => {
    await expect(taskCommand(['get'])).rejects.toThrow('process.exit');
    expect(console.error).toHaveBeenCalledWith('Usage: wanman task get <id>');
  });

  it('exits when task get returns an RPC error', async () => {
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32000, message: 'missing task' },
    });

    await expect(taskCommand(['get', 'task-404'])).rejects.toThrow('process.exit');
    expect(console.error).toHaveBeenCalledWith('Error: missing task');
  });

  it('updates a task status and assignee', async () => {
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0',
      id: 1,
      result: { id: 'task-1', status: 'review' },
    });

    await taskCommand(['update', 'task-1', '--status', 'review', '--assign', 'cto', '--result', 'ready']);

    expect(mockRpcCall).toHaveBeenCalledWith('task.update', {
      id: 'task-1',
      status: 'review',
      assignee: 'cto',
      result: 'ready',
      agent: expectedAgent,
    });
    expect(console.log).toHaveBeenCalledWith('Task task-1 updated [review]');
  });

  it('accepts --assignee as an update alias', async () => {
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0',
      id: 1,
      result: { id: 'task-2', status: 'assigned' },
    });

    await taskCommand(['update', 'task-2', '--assignee', 'marketing']);

    expect(mockRpcCall).toHaveBeenCalledWith('task.update', {
      id: 'task-2',
      status: undefined,
      assignee: 'marketing',
      result: undefined,
      agent: expectedAgent,
    });
  });

  it('exits when task update is missing an id', async () => {
    await expect(taskCommand(['update'])).rejects.toThrow('process.exit');
    expect(console.error).toHaveBeenCalled();
  });

  it('exits when task update returns an RPC error', async () => {
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32000, message: 'update failed' },
    });

    await expect(taskCommand(['update', 'task-3', '--status', 'done'])).rejects.toThrow('process.exit');
    expect(console.error).toHaveBeenCalledWith('Error: update failed');
  });

  it('marks a task done with result text', async () => {
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0',
      id: 1,
      result: { id: 'task-1', status: 'done' },
    });

    await taskCommand(['done', 'task-1', 'fixed', 'and', 'verified']);

    expect(mockRpcCall).toHaveBeenCalledWith('task.update', {
      id: 'task-1',
      status: 'done',
      result: 'fixed and verified',
      agent: expectedAgent,
    });
    expect(console.log).toHaveBeenCalledWith('Task task-1 marked done.');
  });

  it('exits when task done is missing an id', async () => {
    await expect(taskCommand(['done'])).rejects.toThrow('process.exit');
    expect(console.error).toHaveBeenCalledWith('Usage: wanman task done <id> [result text]');
  });

  it('exits when task done returns an RPC error', async () => {
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32000, message: 'done failed' },
    });

    await expect(taskCommand(['done', 'task-4'])).rejects.toThrow('process.exit');
    expect(console.error).toHaveBeenCalledWith('Error: done failed');
  });

  it('prints usage for unknown task subcommands', async () => {
    await expect(taskCommand(['bogus'])).rejects.toThrow('process.exit');
    expect(console.error).toHaveBeenCalled();
  });
});

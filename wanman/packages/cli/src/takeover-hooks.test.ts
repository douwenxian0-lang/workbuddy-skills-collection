import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExecutionContext, PollExecutionContext, RunOptions } from './execution-session.js'
import type { LocalSupervisorHandle } from './local-supervisor.js'
import type { RuntimeClient } from './runtime-client.js'
import type { ProjectIntent, ProjectProfile } from './takeover-project.js'
import { buildTakeoverExecutionHooks } from './takeover-hooks.js'

function makeProfile(overrides: Partial<ProjectProfile> = {}): ProjectProfile {
  return {
    path: '/repo',
    languages: ['typescript'],
    packageManagers: ['pnpm'],
    frameworks: ['react'],
    ci: ['github-actions'],
    testFrameworks: ['vitest'],
    hasReadme: true,
    hasClaudeMd: false,
    hasDocs: true,
    issueTracker: 'github',
    githubRemote: 'git@github.com:test/repo.git',
    readmeExcerpt: '# Repo',
    codeRoots: ['apps', 'packages'],
    packageScripts: ['build', 'test'],
    ...overrides,
  }
}

function makeIntent(overrides: Partial<ProjectIntent> = {}): ProjectIntent {
  return {
    projectName: 'Acme',
    summary: 'Acme project summary',
    canonicalDocs: [
      {
        path: 'README.md',
        kind: 'readme',
        title: 'README',
        excerpt: 'Intro',
        headings: ['Overview'],
        score: 10,
      },
      {
        path: 'docs/roadmap.md',
        kind: 'roadmap',
        title: 'Roadmap',
        excerpt: 'Roadmap',
        headings: ['Now'],
        score: 9,
      },
    ],
    roadmapDocs: [
      {
        path: 'docs/roadmap.md',
        kind: 'roadmap',
        title: 'Roadmap',
        excerpt: 'Roadmap',
        headings: ['Now'],
        score: 9,
      },
    ],
    codeRoots: ['packages/runtime', 'packages/cli'],
    packageScripts: ['build', 'test'],
    strategicThemes: ['ship user value'],
    mission: 'Ship the next externally valuable improvements.',
    ...overrides,
  }
}

function makeRuntime(): RuntimeClient & {
  listTasks: ReturnType<typeof vi.fn>
  listInitiatives: ReturnType<typeof vi.fn>
  listCapsules: ReturnType<typeof vi.fn>
  listArtifacts: ReturnType<typeof vi.fn>
  createInitiative: ReturnType<typeof vi.fn>
  sendMessage: ReturnType<typeof vi.fn>
  spawnAgent: ReturnType<typeof vi.fn>
  updateTask: ReturnType<typeof vi.fn>
} {
  return {
    waitForHealth: vi.fn(),
    getHealth: vi.fn(),
    listTasks: vi.fn().mockResolvedValue([]),
    listInitiatives: vi.fn().mockResolvedValue([]),
    listCapsules: vi.fn().mockResolvedValue([]),
    listArtifacts: vi.fn().mockResolvedValue([]),
    createInitiative: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    spawnAgent: vi.fn().mockResolvedValue(undefined),
    updateTask: vi.fn().mockResolvedValue(undefined),
  } as unknown as RuntimeClient & {
    listTasks: ReturnType<typeof vi.fn>
    listInitiatives: ReturnType<typeof vi.fn>
    listCapsules: ReturnType<typeof vi.fn>
    listArtifacts: ReturnType<typeof vi.fn>
    createInitiative: ReturnType<typeof vi.fn>
    sendMessage: ReturnType<typeof vi.fn>
    spawnAgent: ReturnType<typeof vi.fn>
    updateTask: ReturnType<typeof vi.fn>
  }
}

function makeContext(runtime: RuntimeClient): ExecutionContext {
  const backend: LocalSupervisorHandle = {
    runtime,
    endpoint: 'http://127.0.0.1:3120',
    port: 3120,
    child: {} as any,
    readLogs: vi.fn().mockResolvedValue({ lines: [], cursor: 0 }),
    attachSignalForwarding: vi.fn(() => () => {}),
    stop: vi.fn().mockResolvedValue(undefined),
    waitForExit: vi.fn().mockResolvedValue(undefined),
  }
  const opts: RunOptions = {
    loops: 10,
    pollInterval: 1,
    workerKey: 'lmstudio',
    noBrain: true,
    keep: false,
    output: '/tmp',
    infinite: false,
    errorLimit: 20,
  }

  return {
    backend,
    runtime,
    goal: 'goal',
    opts,
    spec: {},
    runId: 'run-1',
    workspaceRoot: '/workspace/agents',
  }
}

describe('buildTakeoverExecutionHooks', () => {
  let runtime: ReturnType<typeof makeRuntime>

  beforeEach(() => {
    runtime = makeRuntime()
  })

  it('seeds the mission board and sends kickoff steer after health when the repo is idle', async () => {
    const hooks = buildTakeoverExecutionHooks(makeProfile(), makeIntent())
    await hooks.afterHealthy?.(makeContext(runtime))

    expect(runtime.listInitiatives).toHaveBeenCalledWith()
    expect(runtime.listTasks).toHaveBeenCalledWith()

    expect(runtime.createInitiative.mock.calls).toHaveLength(3)
    expect(runtime.createInitiative.mock.calls[0]?.[0]).toMatchObject({
      title: 'Advance roadmap-backed product delivery',
      agent: 'takeover-mission-board',
      status: 'active',
    })

    expect(runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      from: 'takeover-bootstrap',
      to: 'ceo',
      priority: 'steer',
    }))
  })

  it('nudges CEO and dev when active implementation tasks are missing initiative/capsule linkage', async () => {
    runtime.listInitiatives.mockResolvedValueOnce([{ id: 'initiative-1', status: 'active' }])
    runtime.listCapsules.mockResolvedValueOnce([])

    const hooks = buildTakeoverExecutionHooks(makeProfile(), makeIntent())
    const context: PollExecutionContext = {
      ...makeContext(runtime),
      loop: 2,
      startTime: Date.now(),
      agents: [],
      tasks: [{
        id: 'task-12345678',
        title: 'Implement feature',
        status: 'in_progress',
        assignee: 'dev',
        priority: 5,
      }],
      logs: [],
    }
    await hooks.afterPoll?.(context)

    expect(runtime.sendMessage.mock.calls).toHaveLength(2)
    expect(runtime.sendMessage.mock.calls.map(call => call[0]?.to)).toEqual(['ceo', 'dev'])
    expect(runtime.sendMessage.mock.calls[0]?.[0]?.payload).toContain('task-123')
    expect(runtime.sendMessage.mock.calls[0]?.[0]?.payload).toContain('change capsule')
  })

  it('does not poll the mission board on non-refresh loops while work is already active', async () => {
    const hooks = buildTakeoverExecutionHooks(makeProfile(), makeIntent())
    const context: PollExecutionContext = {
      ...makeContext(runtime),
      loop: 1,
      startTime: Date.now(),
      agents: [],
      tasks: [{
        id: 'task-1',
        title: 'Implement feature',
        status: 'in_progress',
        assignee: 'dev',
        priority: 5,
        initiativeId: 'initiative-1',
        capsuleId: 'capsule-1',
      }],
      logs: [],
    }
    await hooks.afterPoll?.(context)

    expect(runtime.listInitiatives).not.toHaveBeenCalled()
    expect(runtime.listCapsules).not.toHaveBeenCalled()
    expect(runtime.sendMessage).not.toHaveBeenCalled()
  })

  it('uses the shared workforce allocator surface through runtime client', async () => {
    const hooks = buildTakeoverExecutionHooks(makeProfile(), makeIntent())
    const context: PollExecutionContext = {
      ...makeContext(runtime),
      loop: 1,
      startTime: Date.now(),
      agents: [{ name: 'dev', state: 'running', lifecycle: 'on-demand' }],
      tasks: [
        { id: 'task-1', title: 'First', status: 'assigned', assignee: 'dev', priority: 10, initiativeId: 'initiative-1', capsuleId: 'capsule-1' },
        { id: 'task-2', title: 'Second', status: 'assigned', assignee: 'dev', priority: 8, initiativeId: 'initiative-1', capsuleId: 'capsule-2' },
      ],
      logs: [],
    }
    await hooks.afterPoll?.(context)

    expect(runtime.spawnAgent).toHaveBeenCalledWith('dev', 'dev-2')
    expect(runtime.updateTask).toHaveBeenCalledWith({
      id: 'task-2',
      assignee: 'dev-2',
      status: 'assigned',
      agent: 'takeover-allocator',
    })
  })
})

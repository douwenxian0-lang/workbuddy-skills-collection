import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ensureMissionBoard,
  maybeNudgeMissionControl,
  maybeScaleWorkforce,
  planDynamicClone,
  sendKickoffSteer,
  type MissionNudgeState,
  type TakeoverCoordinationBackend,
  type TakeoverTask,
} from './takeover-coordination.js'
import type { ProjectIntent, ProjectProfile } from './takeover-project.js'

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

function makeBackend(overrides: Partial<TakeoverCoordinationBackend> = {}): TakeoverCoordinationBackend & {
  created: any[]
  sent: any[]
  assigned: any[]
  spawned: any[]
} {
  const created: any[] = []
  const sent: any[] = []
  const assigned: any[] = []
  const spawned: any[] = []
  return {
    listTasks: async () => [],
    listInitiatives: async () => [],
    listCapsules: async () => [],
    createInitiative: async seed => { created.push(seed) },
    sendSteer: async message => { sent.push(message) },
    assignTask: async (taskId, assignee) => { assigned.push({ taskId, assignee }) },
    spawnAgent: async (template, name) => { spawned.push({ template, name }) },
    ...overrides,
    created,
    sent,
    assigned,
    spawned,
  }
}

describe('takeover coordination', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('seeds mission board through a generic backend', async () => {
    const backend = makeBackend()

    await ensureMissionBoard(backend, makeProfile(), makeIntent())

    expect(backend.created).toHaveLength(3)
    expect(backend.created[0]).toMatchObject({
      title: 'Advance roadmap-backed product delivery',
      priority: 10,
    })
  })

  it('sends kickoff only when backlog is empty', async () => {
    const backend = makeBackend()

    await sendKickoffSteer(backend, makeIntent(), 'local-takeover-bootstrap')
    expect(backend.sent).toHaveLength(1)
    expect(backend.sent[0]).toMatchObject({
      from: 'local-takeover-bootstrap',
      to: 'ceo',
    })

    const busyBackend = makeBackend({
      listTasks: async () => [{ id: 'task-1', status: 'assigned' }],
    })
    await sendKickoffSteer(busyBackend, makeIntent())
    expect(busyBackend.sent).toHaveLength(0)
  })

  it('nudges capsule gaps through the shared mission-control logic', async () => {
    const backend = makeBackend({
      listInitiatives: async () => [{ id: 'initiative-1', status: 'active' }],
      listCapsules: async () => [],
    })
    const nudgeState: MissionNudgeState = {}
    const tasks: TakeoverTask[] = [{
      id: 'task-12345678',
      title: 'Implement feature',
      priority: 5,
      status: 'in_progress',
      assignee: 'dev',
    }]

    const changed = await maybeNudgeMissionControl(backend, makeIntent(), tasks, nudgeState)

    expect(changed).toBe(true)
    expect(backend.sent).toHaveLength(2)
    expect(backend.sent.map(message => message.to)).toEqual(['ceo', 'dev'])
    expect(backend.sent[0]?.payload).toContain('change capsule')
  })

  it('plans and executes dev workforce scaling against a backend capability surface', async () => {
    const tasks: TakeoverTask[] = [
      { id: 'task-1', title: 'First', priority: 10, status: 'assigned', assignee: 'dev' },
      { id: 'task-2', title: 'Second', priority: 8, status: 'assigned', assignee: 'dev' },
      { id: 'task-3', title: 'Third', priority: 6, status: 'assigned', assignee: 'dev' },
    ]

    const plan = planDynamicClone(tasks, ['dev'])
    expect(plan).toMatchObject({
      clonesToSpawn: ['dev-2', 'dev-3'],
    })

    const backend = makeBackend()
    const changed = await maybeScaleWorkforce(backend, tasks, ['dev'], 'takeover-allocator', 3)

    expect(changed).toBe(true)
    expect(backend.spawned).toEqual([
      { template: 'dev', name: 'dev-2' },
      { template: 'dev', name: 'dev-3' },
    ])
    expect(backend.assigned).toEqual([
      { taskId: 'task-2', assignee: 'dev-2' },
      { taskId: 'task-3', assignee: 'dev-3' },
    ])
  })
})

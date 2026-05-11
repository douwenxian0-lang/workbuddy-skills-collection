import { buildMissionSeeds, type MissionSeed, buildTakeoverKickoffPayload } from './takeover-mission.js'
import type { RuntimeClient } from './runtime-client.js'
import type { ProjectIntent, ProjectProfile } from './takeover-project.js'

export interface TakeoverTask {
  id: string
  title?: string
  priority?: number
  status: string
  assignee?: string
  initiativeId?: string
  capsuleId?: string
}

export interface TakeoverInitiative {
  id: string
  status: string
  title?: string
  priority?: number
}

export interface TakeoverCapsule {
  id: string
  status: string
  goal?: string
  ownerAgent?: string
  branch?: string
  initiativeId?: string
  taskId?: string
}

export interface DynamicWorkforcePlan {
  clonesToSpawn: string[]
  reassignments: Array<{ taskId: string; taskTitle: string; assignee: string }>
}

export interface MissionNudgeState {
  lastSignature?: string
  lastSentAt?: number
}

export interface TakeoverCoordinationBackend {
  listTasks(): Promise<TakeoverTask[]>
  listInitiatives(): Promise<TakeoverInitiative[]>
  listCapsules(): Promise<TakeoverCapsule[]>
  createInitiative(seed: MissionSeed): Promise<void>
  sendSteer(message: {
    from: string
    to: string
    payload: string
  }): Promise<void>
  spawnAgent?(template: string, name: string): Promise<void>
  assignTask?(taskId: string, assignee: string): Promise<void>
  log?(message: string): void
}

const DEFAULT_MAX_DEV_WORKERS = 3

export function createTakeoverCoordinationBackend(
  runtime: Pick<RuntimeClient, 'listTasks' | 'listInitiatives' | 'listCapsules' | 'createInitiative' | 'sendMessage' | 'spawnAgent' | 'updateTask'>,
  opts: { log?: (message: string) => void } = {},
): TakeoverCoordinationBackend {
  return {
    listTasks: () => runtime.listTasks(),
    listInitiatives: () => runtime.listInitiatives(),
    listCapsules: () => runtime.listCapsules(),
    createInitiative: async seed => {
      await runtime.createInitiative({
        ...seed,
        status: 'active',
        agent: 'takeover-mission-board',
      })
    },
    sendSteer: async ({ from, to, payload }) => {
      await runtime.sendMessage({
        from,
        to,
        payload,
        type: 'message',
        priority: 'steer',
      })
    },
    spawnAgent: runtime.spawnAgent ? ((template, name) => runtime.spawnAgent(template, name)) : undefined,
    assignTask: runtime.updateTask
      ? ((taskId, assignee) => runtime.updateTask({
          id: taskId,
          assignee,
          status: 'assigned',
          agent: 'takeover-allocator',
        }))
      : undefined,
    log: opts.log,
  }
}

export function collectCapsuleGapTasks(tasks: TakeoverTask[]): Array<{ id: string; assignee?: string }> {
  return tasks.filter(task => {
    if (task.status === 'done') return false
    if (!task.assignee) return false
    if (!(task.assignee === 'dev' || /^dev-\d+$/.test(task.assignee))) return false
    return !task.initiativeId || !task.capsuleId
  })
}

function buildMissionNudgeSignature(
  kind: string,
  initiatives: TakeoverInitiative[],
  capsules: TakeoverCapsule[],
  tasks: Array<{ id: string }>,
): string {
  return JSON.stringify({
    kind,
    initiatives: initiatives.map(initiative => ({ id: initiative.id, status: initiative.status })),
    capsules: capsules.map(capsule => ({ id: capsule.id, status: capsule.status })),
    tasks: tasks.map(task => task.id),
  })
}

export async function ensureMissionBoard(
  backend: TakeoverCoordinationBackend,
  profile: ProjectProfile,
  intent: ProjectIntent,
): Promise<boolean> {
  const current = await backend.listInitiatives().catch(() => [])
  if (current.length > 0) return false

  const seeds = buildMissionSeeds(profile, intent)
  for (const seed of seeds) {
    await backend.createInitiative(seed)
    backend.log?.(`Mission board: created initiative "${seed.title}"`)
  }
  return seeds.length > 0
}

export async function sendKickoffSteer(
  backend: TakeoverCoordinationBackend,
  intent: ProjectIntent,
  from = 'takeover-bootstrap',
): Promise<void> {
  const current = await backend.listTasks().catch(() => [])
  if (current.length > 0) return
  await backend.sendSteer({
    from,
    to: 'ceo',
    payload: buildTakeoverKickoffPayload(intent),
  }).catch(() => undefined)
}

export async function maybeNudgeMissionControl(
  backend: TakeoverCoordinationBackend,
  intent: ProjectIntent,
  tasks: TakeoverTask[],
  nudgeState: MissionNudgeState,
  from = 'takeover-mission-control',
): Promise<boolean> {
  const initiatives = await backend.listInitiatives().catch(() => [])
  const capsules = await backend.listCapsules().catch(() => [])
  const activeInitiatives = initiatives.filter(initiative => initiative.status === 'active')
  const activeCapsules = capsules.filter(capsule => capsule.status === 'open' || capsule.status === 'in_review')
  const gapTasks = collectCapsuleGapTasks(tasks)

  let payload: string | undefined
  let recipients = ['ceo']
  let signatureKind = 'none'

  if (activeInitiatives.length === 0) {
    signatureKind = 'empty-initiative-board'
    payload = [
      `Mission board is empty for ${intent.projectName}.`,
      'Create 1-3 active initiatives anchored to roadmap/docs/user value before adding more implementation work.',
      'Then ensure every new code task links to an initiative and every PR-sized implementation task has a change capsule.',
    ].join(' ')
  } else if (tasks.length === 0 && activeCapsules.length === 0) {
    signatureKind = 'backlog-drained'
    payload = [
      'Backlog and active capsules are empty.',
      'Refresh the mission board from roadmap/docs/code roots, then create the next batch of initiative-linked tasks and capsules.',
      'Do not stop at local optima such as green tests or internal cleanup alone.',
    ].join(' ')
  } else if (gapTasks.length > 0) {
    signatureKind = 'capsule-gap'
    recipients = [...new Set(['ceo', ...gapTasks.map(task => task.assignee!).filter(Boolean)])]
    payload = [
      `The following active implementation tasks are missing initiative/capsule linkage: ${gapTasks.map(task => task.id.slice(0, 8)).join(', ')}.`,
      'Before more branch work expands, create or link the correct initiative and change capsule, freeze allowed paths, and update the task metadata.',
      'Use `wanman capsule create ... --task <id> --initiative <id>` and `wanman task update <id> --initiative <id> --capsule <id>`.',
    ].join(' ')
  }

  if (!payload) return false

  const signature = buildMissionNudgeSignature(signatureKind, initiatives, capsules, gapTasks)
  const now = Date.now()
  if (nudgeState.lastSignature === signature && now - (nudgeState.lastSentAt ?? 0) < 90_000) {
    return false
  }

  for (const to of recipients) {
    await backend.sendSteer({
      from,
      to,
      payload,
    }).catch(() => undefined)
  }

  nudgeState.lastSignature = signature
  nudgeState.lastSentAt = now
  backend.log?.(`Mission control: sent ${signatureKind} steer to ${recipients.join(', ')}`)
  return true
}

export function listDevWorkers(agentNames: string[]): string[] {
  const clones = agentNames
    .filter(name => /^dev-\d+$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  return ['dev', ...clones]
}

export function planDynamicClone(
  tasks: TakeoverTask[],
  workers: string[],
  maxWorkers = DEFAULT_MAX_DEV_WORKERS,
): DynamicWorkforcePlan | null {
  const devTasks = tasks
    .filter(task => (task.assignee === 'dev' || /^dev-\d+$/.test(task.assignee || '')) && task.status !== 'done')
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

  if (devTasks.length < 2) return null

  const desiredWorkerCount = Math.min(maxWorkers, devTasks.length)
  const desiredWorkers = [...workers]
  const clonesToSpawn: string[] = []
  while (desiredWorkers.length < desiredWorkerCount) {
    const cloneName = `dev-${desiredWorkers.length + 1}`
    desiredWorkers.push(cloneName)
    clonesToSpawn.push(cloneName)
  }

  const reassignments = devTasks.flatMap((task, index) => {
    const assignee = desiredWorkers[index % desiredWorkers.length]!
    if (task.assignee === assignee) return []
    return [{ taskId: task.id, taskTitle: task.title ?? task.id, assignee }]
  })

  if (clonesToSpawn.length === 0 && reassignments.length === 0) return null
  return { clonesToSpawn, reassignments }
}

export async function maybeScaleWorkforce(
  backend: TakeoverCoordinationBackend,
  tasks: TakeoverTask[],
  workers: string[],
  from = 'takeover-allocator',
  maxWorkers = DEFAULT_MAX_DEV_WORKERS,
): Promise<boolean> {
  if (!backend.spawnAgent || !backend.assignTask) return false

  const plan = planDynamicClone(tasks, workers, maxWorkers)
  if (!plan) return false

  let changed = false
  for (const cloneName of plan.clonesToSpawn) {
    await backend.spawnAgent('dev', cloneName)
    backend.log?.(`Allocator: spawned ${cloneName} from dev`)
    changed = true
  }

  for (const task of plan.reassignments) {
    await backend.assignTask(task.taskId, task.assignee)
    if (task.assignee !== 'dev') {
      await backend.sendSteer({
        from,
        to: task.assignee,
        payload: `You are the shadow dev worker for task ${task.taskId.slice(0, 8)}: "${task.taskTitle}". Start immediately, stay scoped to this task, and report status back to ceo and dev.`,
      }).catch(() => undefined)
    }
    backend.log?.(`Allocator: assigned ${task.taskId.slice(0, 8)} "${task.taskTitle}" -> ${task.assignee}`)
    changed = true
  }

  return changed
}

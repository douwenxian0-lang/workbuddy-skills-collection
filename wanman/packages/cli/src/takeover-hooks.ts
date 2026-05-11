import {
  createTakeoverCoordinationBackend,
  ensureMissionBoard,
  listDevWorkers,
  maybeNudgeMissionControl,
  maybeScaleWorkforce,
  type MissionNudgeState,
  sendKickoffSteer,
} from './takeover-coordination.js'
import type { ExecutionHooks } from './execution-session.js'
import type { ProjectIntent, ProjectProfile } from './takeover-project.js'

export function buildTakeoverExecutionHooks(
  profile: ProjectProfile,
  intent: ProjectIntent,
): ExecutionHooks {
  const missionNudgeState: MissionNudgeState = {}

  return {
    afterHealthy: async ({ runtime }) => {
      const backend = createTakeoverCoordinationBackend(runtime)
      await ensureMissionBoard(backend, profile, intent)
      await sendKickoffSteer(backend, intent)
    },
    afterPoll: async ({ runtime, loop, tasks, agents }) => {
      const backend = createTakeoverCoordinationBackend(runtime)
      const scaled = await maybeScaleWorkforce(
        backend,
        tasks,
        listDevWorkers(agents.map(agent => agent.name)),
        'takeover-allocator',
      )
      if (scaled) return
      if (loop % 2 !== 0 && tasks.length > 0) return
      await maybeNudgeMissionControl(backend, intent, tasks, missionNudgeState)
    },
  }
}

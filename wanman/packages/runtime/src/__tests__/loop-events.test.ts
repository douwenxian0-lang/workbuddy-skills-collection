import { describe, it, expect } from 'vitest'
import type {
  LoopEvent,
  LoopClassification,
  LoopTick,
  LoopClassified,
  AgentSpawned,
  TaskTransition,
  TaskBlocked,
  QueueBacklog,
  ArtifactCreated,
  LoopSnapshot,
} from '../loop-events.js'

describe('LoopEvent types', () => {
  const ts = '2026-03-21T00:00:00Z'
  const runId = 'run-test-001'

  it('should accept a valid LoopTick', () => {
    const event: LoopTick = { type: 'loop.tick', runId, loop: 1, timestamp: ts }
    expect(event.type).toBe('loop.tick')
    expect(event.loop).toBe(1)
  })

  it('should accept a valid LoopClassified', () => {
    const event: LoopClassified = {
      type: 'loop.classified',
      runId,
      loop: 1,
      classification: 'productive',
      reasons: ['task transition detected'],
      timestamp: ts,
    }
    expect(event.type).toBe('loop.classified')
    expect(event.classification).toBe('productive')
    expect(event.reasons).toHaveLength(1)
  })

  it('should accept all classification values', () => {
    const classifications: LoopClassification[] = [
      'productive', 'idle', 'blocked', 'backlog_stuck', 'error',
    ]
    for (const c of classifications) {
      const event: LoopClassified = {
        type: 'loop.classified', runId, loop: 1,
        classification: c, reasons: [], timestamp: ts,
      }
      expect(event.classification).toBe(c)
    }
  })

  it('should accept a valid AgentSpawned', () => {
    const event: AgentSpawned = {
      type: 'agent.spawned', runId, loop: 2,
      agent: 'ceo', lifecycle: '24/7', trigger: 'startup',
      timestamp: ts,
    }
    expect(event.agent).toBe('ceo')
    expect(event.lifecycle).toBe('24/7')
    expect(event.trigger).toBe('startup')
  })

  it('should accept all trigger values', () => {
    const triggers: AgentSpawned['trigger'][] = [
      'startup', 'message', 'steer', 'cron', 'backlog-drain',
    ]
    for (const t of triggers) {
      const event: AgentSpawned = {
        type: 'agent.spawned', runId, loop: 1,
        agent: 'dev', lifecycle: 'on-demand', trigger: t,
        timestamp: ts,
      }
      expect(event.trigger).toBe(t)
    }
  })

  it('should accept a valid TaskTransition', () => {
    const event: TaskTransition = {
      type: 'task.transition', runId, loop: 3,
      taskId: 42, assignee: 'dev', from: 'pending', to: 'in_progress',
      timestamp: ts,
    }
    expect(event.taskId).toBe(42)
    expect(event.from).toBe('pending')
    expect(event.to).toBe('in_progress')
  })

  it('should accept TaskTransition without assignee', () => {
    const event: TaskTransition = {
      type: 'task.transition', runId, loop: 3,
      taskId: 42, from: 'pending', to: 'assigned',
      timestamp: ts,
    }
    expect(event.assignee).toBeUndefined()
  })

  it('should accept a valid TaskBlocked', () => {
    const event: TaskBlocked = {
      type: 'task.blocked', runId, loop: 4,
      taskId: 10, assignee: 'finance', waitingOn: [8, 9],
      timestamp: ts,
    }
    expect(event.waitingOn).toEqual([8, 9])
  })

  it('should accept a valid QueueBacklog', () => {
    const event: QueueBacklog = {
      type: 'queue.backlog', runId, loop: 5,
      agent: 'feedback', pendingMessages: 3,
      timestamp: ts,
    }
    expect(event.pendingMessages).toBe(3)
  })

  it('should accept a valid ArtifactCreated', () => {
    const event: ArtifactCreated = {
      type: 'artifact.created', runId, loop: 6,
      agent: 'finance', kind: 'budget_item', path: 'costs/opex/rent',
      timestamp: ts,
    }
    expect(event.kind).toBe('budget_item')
    expect(event.path).toBe('costs/opex/rent')
  })

  it('should accept ArtifactCreated without path', () => {
    const event: ArtifactCreated = {
      type: 'artifact.created', runId, loop: 6,
      agent: 'marketing', kind: 'content_plan',
      timestamp: ts,
    }
    expect(event.path).toBeUndefined()
  })

  it('should accept LoopEvent union for all event types', () => {
    const events: LoopEvent[] = [
      { type: 'loop.tick', runId, loop: 1, timestamp: ts },
      { type: 'loop.classified', runId, loop: 1, classification: 'idle', reasons: [], timestamp: ts },
      { type: 'agent.spawned', runId, loop: 1, agent: 'ceo', lifecycle: '24/7', trigger: 'startup', timestamp: ts },
      { type: 'task.transition', runId, loop: 1, taskId: 1, from: 'pending', to: 'done', timestamp: ts },
      { type: 'task.blocked', runId, loop: 1, taskId: 2, waitingOn: [1], timestamp: ts },
      { type: 'queue.backlog', runId, loop: 1, agent: 'dev', pendingMessages: 0, timestamp: ts },
      { type: 'artifact.created', runId, loop: 1, agent: 'finance', kind: 'report', timestamp: ts },
    ]
    expect(events).toHaveLength(7)
    const types = events.map(e => e.type)
    expect(types).toContain('loop.tick')
    expect(types).toContain('loop.classified')
    expect(types).toContain('agent.spawned')
    expect(types).toContain('task.transition')
    expect(types).toContain('task.blocked')
    expect(types).toContain('queue.backlog')
    expect(types).toContain('artifact.created')
  })
})

describe('LoopSnapshot', () => {
  it('should accept a valid snapshot', () => {
    const snapshot: LoopSnapshot = {
      loop: 17,
      runId: 'run-test-001',
      timestamp: '2026-03-21T12:34:56Z',
      classification: 'backlog_stuck',
      reasons: ['feedback has 2 pending messages while idle'],
      agents: [
        { name: 'ceo', state: 'running', lifecycle: '24/7' },
        { name: 'feedback', state: 'idle', lifecycle: 'on-demand' },
      ],
      taskTransitions: 1,
      artifactsCreated: 0,
      pendingMessages: { marketing: 0, feedback: 2 },
    }
    expect(snapshot.classification).toBe('backlog_stuck')
    expect(snapshot.agents).toHaveLength(2)
    expect(snapshot.pendingMessages['feedback']).toBe(2)
  })
})

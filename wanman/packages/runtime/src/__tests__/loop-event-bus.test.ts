import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  }),
}))

import { LoopEventBus } from '../loop-event-bus.js'
import type { LoopEvent } from '../loop-events.js'

describe('LoopEventBus', () => {
  let bus: LoopEventBus

  beforeEach(() => {
    bus = new LoopEventBus('run-test-001')
  })

  describe('construction', () => {
    it('should initialize with runId and loop 0', () => {
      expect(bus.runId).toBe('run-test-001')
      expect(bus.currentLoop).toBe(0)
    })
  })

  describe('tick()', () => {
    it('should increment loop counter', () => {
      bus.tick()
      expect(bus.currentLoop).toBe(1)
      bus.tick()
      expect(bus.currentLoop).toBe(2)
    })

    it('should emit loop.tick event', () => {
      const events: LoopEvent[] = []
      bus.on(e => events.push(e))
      bus.tick()

      expect(events).toHaveLength(1)
      expect(events[0]!.type).toBe('loop.tick')
      expect(events[0]!.runId).toBe('run-test-001')
      if (events[0]!.type === 'loop.tick') {
        expect(events[0]!.loop).toBe(1)
      }
    })
  })

  describe('emit()', () => {
    it('should deliver events to all subscribers', () => {
      const events1: LoopEvent[] = []
      const events2: LoopEvent[] = []
      bus.on(e => events1.push(e))
      bus.on(e => events2.push(e))

      bus.tick()
      expect(events1).toHaveLength(1)
      expect(events2).toHaveLength(1)
    })

    it('should not throw if listener throws (non-fatal observability)', () => {
      bus.on(() => { throw new Error('listener crash') })
      // Should not throw
      expect(() => bus.tick()).not.toThrow()
    })
  })

  describe('on() / off()', () => {
    it('should unsubscribe listener via off()', () => {
      const events: LoopEvent[] = []
      const listener = (e: LoopEvent) => events.push(e)
      bus.on(listener)
      bus.tick()
      expect(events).toHaveLength(1)

      bus.off(listener)
      bus.tick()
      expect(events).toHaveLength(1) // no new events
    })
  })

  describe('classify()', () => {
    const agents = [
      { name: 'ceo', state: 'running', lifecycle: '24/7' },
      { name: 'dev', state: 'idle', lifecycle: 'on-demand' },
    ]

    it('should classify as idle when nothing happens', () => {
      bus.tick()
      const result = bus.classify(agents)
      expect(result.classification).toBe('idle')
      expect(result.reasons).toContain('no state changes detected')
    })

    it('should classify as productive when task transitions occur', () => {
      bus.tick()
      bus.emit({
        type: 'task.transition', runId: 'run-test-001', loop: 1,
        taskId: 1, from: 'pending', to: 'in_progress',
        timestamp: new Date().toISOString(),
      })
      const result = bus.classify(agents)
      expect(result.classification).toBe('productive')
      expect(result.reasons[0]).toContain('task transition')
    })

    it('should classify as productive when artifacts are created', () => {
      bus.tick()
      bus.emit({
        type: 'artifact.created', runId: 'run-test-001', loop: 1,
        agent: 'finance', kind: 'budget_item',
        timestamp: new Date().toISOString(),
      })
      const result = bus.classify(agents)
      expect(result.classification).toBe('productive')
      expect(result.reasons[0]).toContain('artifact')
    })

    it('should classify as productive when both transitions and artifacts occur', () => {
      bus.tick()
      bus.emit({
        type: 'task.transition', runId: 'run-test-001', loop: 1,
        taskId: 1, from: 'pending', to: 'done',
        timestamp: new Date().toISOString(),
      })
      bus.emit({
        type: 'artifact.created', runId: 'run-test-001', loop: 1,
        agent: 'finance', kind: 'report',
        timestamp: new Date().toISOString(),
      })
      const result = bus.classify(agents)
      expect(result.classification).toBe('productive')
      expect(result.reasons).toHaveLength(2)
    })

    it('should classify as backlog_stuck when pending messages exist', () => {
      bus.tick()
      bus.emit({
        type: 'queue.backlog', runId: 'run-test-001', loop: 1,
        agent: 'feedback', pendingMessages: 3,
        timestamp: new Date().toISOString(),
      })
      const result = bus.classify(agents)
      expect(result.classification).toBe('backlog_stuck')
      expect(result.reasons[0]).toContain('feedback')
      expect(result.reasons[0]).toContain('3')
    })

    it('should classify as blocked when tasks are blocked', () => {
      bus.tick()
      bus.emit({
        type: 'task.blocked', runId: 'run-test-001', loop: 1,
        taskId: 5, waitingOn: [3, 4],
        timestamp: new Date().toISOString(),
      })
      const result = bus.classify(agents)
      expect(result.classification).toBe('blocked')
      expect(result.reasons[0]).toContain('blocked by dependencies')
    })

    it('should classify as error when errors are recorded', () => {
      bus.tick()
      bus.recordError()
      const result = bus.classify(agents)
      expect(result.classification).toBe('error')
      expect(result.reasons[0]).toContain('error')
    })

    it('error should take priority over productive', () => {
      bus.tick()
      bus.emit({
        type: 'task.transition', runId: 'run-test-001', loop: 1,
        taskId: 1, from: 'pending', to: 'done',
        timestamp: new Date().toISOString(),
      })
      bus.recordError()
      const result = bus.classify(agents)
      expect(result.classification).toBe('error')
    })

    it('productive should take priority over backlog_stuck', () => {
      bus.tick()
      bus.emit({
        type: 'task.transition', runId: 'run-test-001', loop: 1,
        taskId: 1, from: 'pending', to: 'done',
        timestamp: new Date().toISOString(),
      })
      bus.emit({
        type: 'queue.backlog', runId: 'run-test-001', loop: 1,
        agent: 'dev', pendingMessages: 2,
        timestamp: new Date().toISOString(),
      })
      const result = bus.classify(agents)
      expect(result.classification).toBe('productive')
    })

    it('should reset counters between ticks', () => {
      bus.tick()
      bus.emit({
        type: 'task.transition', runId: 'run-test-001', loop: 1,
        taskId: 1, from: 'pending', to: 'done',
        timestamp: new Date().toISOString(),
      })
      expect(bus.classify(agents).classification).toBe('productive')

      bus.tick() // resets counters
      expect(bus.classify(agents).classification).toBe('idle')
    })

    it('should emit the classified event to listeners', () => {
      const events: LoopEvent[] = []
      bus.on(e => events.push(e))

      bus.tick()
      bus.classify(agents)

      const classified = events.filter(e => e.type === 'loop.classified')
      expect(classified).toHaveLength(1)
    })
  })

  describe('snapshot()', () => {
    const agents = [
      { name: 'ceo', state: 'running', lifecycle: '24/7' },
      { name: 'dev', state: 'idle', lifecycle: 'on-demand' },
    ]

    it('should produce a valid snapshot', () => {
      bus.tick()
      bus.emit({
        type: 'task.transition', runId: 'run-test-001', loop: 1,
        taskId: 1, from: 'pending', to: 'done',
        timestamp: new Date().toISOString(),
      })
      bus.emit({
        type: 'artifact.created', runId: 'run-test-001', loop: 1,
        agent: 'finance', kind: 'report',
        timestamp: new Date().toISOString(),
      })
      bus.emit({
        type: 'queue.backlog', runId: 'run-test-001', loop: 1,
        agent: 'marketing', pendingMessages: 1,
        timestamp: new Date().toISOString(),
      })

      const snap = bus.snapshot(agents)
      expect(snap.loop).toBe(1)
      expect(snap.runId).toBe('run-test-001')
      expect(snap.classification).toBe('productive')
      expect(snap.taskTransitions).toBe(1)
      expect(snap.artifactsCreated).toBe(1)
      expect(snap.pendingMessages).toEqual({ marketing: 1 })
      expect(snap.agents).toHaveLength(2)
      expect(snap.agents[0]!.name).toBe('ceo')
      expect(snap.agents[0]!.state).toBe('running')
    })
  })

  describe('recordError()', () => {
    it('should increment error count', () => {
      bus.tick()
      bus.recordError()
      bus.recordError()
      const result = bus.classify([])
      expect(result.classification).toBe('error')
      expect(result.reasons[0]).toContain('2 error')
    })
  })

  describe('removeAllListeners()', () => {
    it('should remove all listeners', () => {
      const events: LoopEvent[] = []
      bus.on(e => events.push(e))
      bus.removeAllListeners()
      bus.tick()
      expect(events).toHaveLength(0)
    })
  })

  describe('agent.spawned tracking', () => {
    it('should count agent spawns', () => {
      bus.tick()
      bus.emit({
        type: 'agent.spawned', runId: 'run-test-001', loop: 1,
        agent: 'ceo', lifecycle: '24/7', trigger: 'startup',
        timestamp: new Date().toISOString(),
      })
      // Agent spawns alone don't make a loop productive (need task transition or artifact)
      const result = bus.classify([])
      expect(result.classification).toBe('idle')
    })
  })
})

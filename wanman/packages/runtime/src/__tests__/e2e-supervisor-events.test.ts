/**
 * E2E test: Supervisor RPC → EventBus event emission.
 *
 * Creates a real Supervisor (SQLite in-memory, headless mode), wires EventBus,
 * sends real RPC requests, and verifies events are emitted correctly.
 *
 * This tests the integration between:
 *   RPC handler → task.transition / artifact.created event emission → EventBus → listeners
 *
 * Run: pnpm -F @wanman/runtime test e2e-supervisor-events
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { AgentMatrixConfig, JsonRpcRequest } from '@wanman/core'
import { RPC_METHODS } from '@wanman/core'
import type { LoopEvent } from '../loop-events.js'

// ── Minimal mocks (only what can't run for real) ──

const { mockExecSync } = vi.hoisted(() => ({
  mockExecSync: vi.fn<(...args: unknown[]) => string | Buffer>(),
}))
vi.mock('node:child_process', () => ({ execSync: mockExecSync }))

vi.mock('../http-server.js', () => ({
  createHttpServer: vi.fn(() => ({ close: (cb: () => void) => cb() })),
}))

vi.mock('../logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  }),
}))

vi.mock('../agent-process.js', () => {
  class MockAgentProcess {
    definition: unknown
    state = 'idle'
    constructor(def: unknown) { this.definition = def }
    async start() {}
    stop() {}
    handleSteer() {}
  }
  return { AgentProcess: MockAgentProcess }
})

// Brain mock for artifact operations
const artifactStore: Array<Record<string, unknown>> = []
let artifactIdCounter = 1

vi.mock('../brain-manager.js', () => {
  class MockBrainManager {
    isInitialized = true
    env = { DATABASE_URL: 'mock://', DB9_DATABASE_ID: 'mock', DB9_DATABASE_NAME: 'mock', PGHOST: 'mock', PGPORT: '5432', PGUSER: 'mock', PGPASSWORD: 'mock', PGDATABASE: 'mock' }
    brainSkill = { name: 'brain', content: 'stub' }
    dbId = 'mock-db'
    async initialize() {}
    async executeSQL(sql: string) {
      if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX')) return []
      if (sql.startsWith('INSERT INTO artifacts')) {
        const id = artifactIdCounter++
        const row = { id, agent: 'finance', kind: 'budget_item', created_at: new Date().toISOString() }
        artifactStore.push(row)
        return [row]
      }
      return []
    }
  }
  return { BrainManager: MockBrainManager }
})

import { Supervisor } from '../supervisor.js'

const config: AgentMatrixConfig = {
  agents: [
    { name: 'ceo', lifecycle: '24/7' as const, model: 'claude-sonnet-4-6', systemPrompt: '' },
    { name: 'dev', lifecycle: 'on-demand' as const, model: 'claude-sonnet-4-6', systemPrompt: '' },
  ],
  brain: { token: 'mock', dbName: 'mock' },
}

function rpc(method: string, params: Record<string, unknown> = {}): JsonRpcRequest {
  return { jsonrpc: '2.0', id: `test-${Date.now()}-${Math.random()}`, method, params }
}

describe('Supervisor RPC → EventBus E2E', () => {
  let supervisor: Supervisor
  let collectedEvents: LoopEvent[]

  beforeAll(async () => {
    supervisor = new Supervisor(config, { headless: true })

    // Wire up EventBus before start
    const bus = supervisor.initEventBus('run-e2e-supervisor')
    collectedEvents = []
    bus.on(e => collectedEvents.push(e))

    // Start a tick so we're in loop 1
    bus.tick()

    await supervisor.start()
  }, 15_000)

  afterAll(async () => {
    await supervisor.shutdown()
  })

  it('should emit task.transition when task status changes via RPC', async () => {
    // Create a task
    const createRes = await supervisor.handleRpcAsync(rpc(RPC_METHODS.TASK_CREATE, {
      title: 'E2E test task',
      assignee: 'dev',
      priority: 5,
    } as unknown as Record<string, unknown>))
    expect(createRes.error).toBeUndefined()
    const task = createRes.result as { id: string }
    expect(task.id).toBeTruthy()

    // Clear events
    collectedEvents.length = 0

    // Update task status: pending → in_progress
    const updateRes = await supervisor.handleRpcAsync(rpc(RPC_METHODS.TASK_UPDATE, {
      id: task.id,
      status: 'in_progress',
    }))
    expect(updateRes.error).toBeUndefined()

    // Verify task.transition event was emitted
    const transitions = collectedEvents.filter(e => e.type === 'task.transition')
    expect(transitions).toHaveLength(1)

    const t = transitions[0]!
    expect(t.type).toBe('task.transition')
    if (t.type === 'task.transition') {
      // TaskPool auto-sets status to 'assigned' when assignee is provided at creation
      expect(t.from).toBe('assigned')
      expect(t.to).toBe('in_progress')
      expect(t.runId).toBe('run-e2e-supervisor')
    }
  })

  it('should emit task.transition for done status', async () => {
    // Create another task
    const createRes = await supervisor.handleRpcAsync(rpc(RPC_METHODS.TASK_CREATE, {
      title: 'Task to complete',
      assignee: 'finance',
      priority: 3,
    } as unknown as Record<string, unknown>))
    const task = createRes.result as { id: string }

    // Move to in_progress first
    await supervisor.handleRpcAsync(rpc(RPC_METHODS.TASK_UPDATE, {
      id: task.id, status: 'in_progress',
    }))

    collectedEvents.length = 0

    // Mark as done
    await supervisor.handleRpcAsync(rpc(RPC_METHODS.TASK_UPDATE, {
      id: task.id, status: 'done', result: 'completed successfully',
    }))

    const transitions = collectedEvents.filter(e => e.type === 'task.transition')
    expect(transitions).toHaveLength(1)
    if (transitions[0]!.type === 'task.transition') {
      expect(transitions[0]!.from).toBe('in_progress')
      expect(transitions[0]!.to).toBe('done')
    }
  })

  it('should NOT emit task.transition when status is unchanged', async () => {
    const createRes = await supervisor.handleRpcAsync(rpc(RPC_METHODS.TASK_CREATE, {
      title: 'No-op task',
      priority: 1,
    } as unknown as Record<string, unknown>))
    const task = createRes.result as { id: string }

    collectedEvents.length = 0

    // Update without changing status (only result)
    await supervisor.handleRpcAsync(rpc(RPC_METHODS.TASK_UPDATE, {
      id: task.id, result: 'updated notes only',
    }))

    const transitions = collectedEvents.filter(e => e.type === 'task.transition')
    expect(transitions).toHaveLength(0)
  })

  it('should emit artifact.created when artifact is stored via RPC', async () => {
    collectedEvents.length = 0

    const res = await supervisor.handleRpcAsync(rpc(RPC_METHODS.ARTIFACT_PUT, {
      kind: 'budget_item',
      agent: 'finance',
      source: 'e2e-test',
      confidence: 0.9,
      path: 'costs/opex/rent',
      content: 'Monthly rent: ¥150,000',
      metadata: { currency: 'JPY' },
    }))
    expect(res.error).toBeUndefined()

    const artifacts = collectedEvents.filter(e => e.type === 'artifact.created')
    expect(artifacts).toHaveLength(1)

    const a = artifacts[0]!
    if (a.type === 'artifact.created') {
      expect(a.agent).toBe('finance')
      expect(a.kind).toBe('budget_item')
      expect(a.path).toBe('costs/opex/rent')
      expect(a.runId).toBe('run-e2e-supervisor')
    }
  })

  it('should track events correctly for classification', async () => {
    // Get the bus and tick to start a new loop
    const bus = supervisor.eventBus!
    bus.tick() // new loop

    collectedEvents.length = 0

    // Create and update a task in this loop
    const createRes = await supervisor.handleRpcAsync(rpc(RPC_METHODS.TASK_CREATE, {
      title: 'Classification test task',
      assignee: 'dev',
      priority: 7,
    } as unknown as Record<string, unknown>))
    const task = createRes.result as { id: string }

    await supervisor.handleRpcAsync(rpc(RPC_METHODS.TASK_UPDATE, {
      id: task.id, status: 'in_progress',
    }))

    // Classify — should be productive because task transitioned
    const classified = bus.classify([
      { name: 'ceo', state: 'idle', lifecycle: '24/7' },
      { name: 'dev', state: 'running', lifecycle: 'on-demand' },
    ])

    expect(classified.classification).toBe('productive')
    expect(classified.reasons.some(r => r.includes('task transition'))).toBe(true)
  })

  it('should classify idle when no events in a loop', () => {
    const bus = supervisor.eventBus!
    bus.tick() // new loop, no events

    const classified = bus.classify([
      { name: 'ceo', state: 'idle', lifecycle: '24/7' },
    ])

    expect(classified.classification).toBe('idle')
  })

  it('should produce correct snapshot with mixed events', async () => {
    const bus = supervisor.eventBus!
    bus.tick() // new loop

    // Task transition
    const createRes = await supervisor.handleRpcAsync(rpc(RPC_METHODS.TASK_CREATE, {
      title: 'Snapshot test',
      priority: 1,
    } as unknown as Record<string, unknown>))
    const task = createRes.result as { id: string }
    await supervisor.handleRpcAsync(rpc(RPC_METHODS.TASK_UPDATE, {
      id: task.id, status: 'done',
    }))

    // Artifact
    await supervisor.handleRpcAsync(rpc(RPC_METHODS.ARTIFACT_PUT, {
      kind: 'tech_spec', agent: 'dev', source: 'e2e',
      confidence: 0.8, content: 'spec content', metadata: {},
    }))

    const snap = bus.snapshot([
      { name: 'ceo', state: 'idle', lifecycle: '24/7' },
      { name: 'dev', state: 'running', lifecycle: 'on-demand' },
    ])

    expect(snap.classification).toBe('productive')
    expect(snap.taskTransitions).toBe(1)
    expect(snap.artifactsCreated).toBe(1)
    expect(snap.agents).toHaveLength(2)
  })
})

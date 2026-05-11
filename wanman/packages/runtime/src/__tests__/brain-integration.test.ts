/**
 * Integration tests for BrainManager wiring into Supervisor → AgentProcess → agent adapters.
 *
 * Verifies that when `brain` config is provided, DATABASE_URL (and related env vars)
 * are propagated all the way down to the spawned Claude Code processes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { AgentMatrixConfig, JsonRpcRequest } from '@wanman/core'
import { RPC_METHODS } from '@wanman/core'

// ── Mocks ──

// Mock http-server to avoid real network binding
vi.mock('../http-server.js', () => ({
  createHttpServer: vi.fn(() => ({
    close: (cb: () => void) => cb(),
  })),
}))

// Mock logger to suppress output
vi.mock('../logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Capture adapter startRun calls so we can inspect the `env` parameter
const startRunCalls: Array<{ model: string; systemPrompt: string; cwd: string; initialMessage?: string; env?: Record<string, string> }> = []

// Deferred helper for controlling promise resolution
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

let waitDeferreds: Array<ReturnType<typeof deferred<number>>> = []
let spawnCallCount = 0

vi.mock('../agent-adapter.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../agent-adapter.js')>()
  return {
    ...actual,
    createAgentAdapter: vi.fn((runtime: string) => ({
      runtime,
      startRun: vi.fn((opts: Record<string, unknown>) => {
        startRunCalls.push(opts as typeof startRunCalls[0])
        const idx = spawnCallCount++
        if (!waitDeferreds[idx]) {
          waitDeferreds[idx] = deferred<number>()
        }
        return {
          proc: { stdin: { end: vi.fn() } },
          wait: vi.fn(() => waitDeferreds[idx]!.promise),
          kill: vi.fn(),
          sendMessage: vi.fn(),
          onEvent: vi.fn(),
          onResult: vi.fn(),
          onExit: vi.fn(),
        }
      }),
    })),
  }
})

// Mock brain-manager to avoid real API calls
const mockBrainEnv: Record<string, string> = {
  DATABASE_URL: 'postgresql://user:pass@pg.db9.ai:5432/wanman_brain',
  DB9_DATABASE_ID: 'db-test-123',
  DB9_DATABASE_NAME: 'wanman-brain',
  PGHOST: 'pg.db9.ai',
  PGPORT: '5432',
  PGUSER: 'user',
  PGPASSWORD: 'pass',
  PGDATABASE: 'wanman_brain',
}

const mockInitialize = vi.fn(async () => {})
const brainConstructorCalls: unknown[] = []

vi.mock('../brain-manager.js', () => {
  class MockBrainManager {
    initialize = mockInitialize
    get env() { return mockBrainEnv }
    get isInitialized() { return true }
    constructor(config: unknown) {
      brainConstructorCalls.push(config)
    }
  }
  return { BrainManager: MockBrainManager }
})

// Import after mocks
import { Supervisor } from '../supervisor.js'

function makeConfig(overrides?: Partial<AgentMatrixConfig>): AgentMatrixConfig {
  return {
    agents: [
      { name: 'ceo', lifecycle: '24/7', model: 'sonnet', systemPrompt: 'You are the CEO.' },
    ],
    dbPath: ':memory:',
    port: 0,
    ...overrides,
  }
}

function rpc(method: string, params?: Record<string, unknown>, id = 1): JsonRpcRequest {
  return { jsonrpc: '2.0', id, method, params }
}

describe('Brain → Supervisor → AgentProcess integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    startRunCalls.length = 0
    brainConstructorCalls.length = 0
    waitDeferreds = []
    spawnCallCount = 0
  })

  it('should pass DATABASE_URL to spawned processes when brain config is provided', async () => {
    vi.useFakeTimers()
    const config: AgentMatrixConfig = {
      ...makeConfig(),
      brain: { token: 'test-token', dbName: 'wanman-brain' },
    }

    // Need at least one deferred for the 24/7 agent spawn
    waitDeferreds[0] = deferred<number>()

    const supervisor = new Supervisor(config)
    await supervisor.start()

    // BrainManager should have been constructed with the brain config
    expect(brainConstructorCalls).toHaveLength(1)
    expect(brainConstructorCalls[0]).toEqual({ token: 'test-token', dbName: 'wanman-brain' })
    expect(mockInitialize).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(50)

    // Agent adapter should have been called with env containing DATABASE_URL
    expect(startRunCalls.length).toBeGreaterThanOrEqual(1)
    const firstCall = startRunCalls[0]!
    expect(firstCall.env).toBeDefined()
    expect(firstCall.env!.DATABASE_URL).toBe('postgresql://user:pass@pg.db9.ai:5432/wanman_brain')
    expect(firstCall.env!.DB9_DATABASE_ID).toBe('db-test-123')
    expect(firstCall.env!.PGHOST).toBe('pg.db9.ai')

    // Cleanup
    waitDeferreds[0].resolve(0)
    await vi.advanceTimersByTimeAsync(0)
    await supervisor.shutdown()
  })

  it('should NOT include DATABASE_URL when brain config is absent', async () => {
    vi.useFakeTimers()
    const config = makeConfig() // no brain field

    waitDeferreds[0] = deferred<number>()

    const supervisor = new Supervisor(config)
    await supervisor.start()

    // BrainManager should NOT have been constructed
    expect(brainConstructorCalls).toHaveLength(0)
    expect(mockInitialize).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(50)

    expect(startRunCalls.length).toBeGreaterThanOrEqual(1)
    const firstCall = startRunCalls[0]!
    // env should NOT have brain env vars (only agent identity)
    expect(firstCall.env?.DATABASE_URL).toBeUndefined()
    expect(firstCall.env?.DB9_DATABASE_ID).toBeUndefined()

    // Cleanup
    waitDeferreds[0].resolve(0)
    await vi.advanceTimersByTimeAsync(0)
    await supervisor.shutdown()
  })

  it('should pass brain env to multiple agents', async () => {
    vi.useFakeTimers()
    const config: AgentMatrixConfig = {
      ...makeConfig({
        agents: [
          { name: 'ceo', lifecycle: '24/7', model: 'sonnet', systemPrompt: 'ceo' },
          { name: 'reviewer', lifecycle: '24/7', model: 'haiku', systemPrompt: 'reviewer' },
        ],
      }),
      brain: { token: 'test-token', dbName: 'wanman-brain' },
    }

    waitDeferreds[0] = deferred<number>()
    waitDeferreds[1] = deferred<number>()

    const supervisor = new Supervisor(config)
    await supervisor.start()

    supervisor.handleRpc(rpc(RPC_METHODS.AGENT_SEND, {
      from: 'ceo',
      to: 'reviewer',
      type: 'message',
      payload: 'Please review the latest work.',
      priority: 'normal',
    }))

    await vi.advanceTimersByTimeAsync(50)
    await vi.advanceTimersByTimeAsync(10_100)

    // Both agents should have been spawned with brain env
    expect(startRunCalls.length).toBeGreaterThanOrEqual(2)
    for (const call of startRunCalls) {
      expect(call.env?.DATABASE_URL).toBe('postgresql://user:pass@pg.db9.ai:5432/wanman_brain')
    }

    waitDeferreds[0].resolve(0)
    waitDeferreds[1].resolve(0)
    await vi.advanceTimersByTimeAsync(0)
    await supervisor.shutdown()
  })
})

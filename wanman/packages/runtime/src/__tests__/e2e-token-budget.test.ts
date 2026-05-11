/**
 * E2E test: Token budget tracking through Supervisor.
 *
 * Verifies that recordTokenUsage() updates the context store
 * so CEO can query `wanman context get token_usage`.
 *
 * Run: pnpm -F @wanman/runtime test e2e-token-budget
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { AgentMatrixConfig } from '@wanman/core'
import { RPC_METHODS } from '@wanman/core'

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

import { Supervisor } from '../supervisor.js'

const config: AgentMatrixConfig = {
  agents: [
    { name: 'ceo', lifecycle: '24/7' as const, model: 'claude-sonnet-4-6', systemPrompt: '' },
    { name: 'dev', lifecycle: 'on-demand' as const, model: 'claude-sonnet-4-6', systemPrompt: '' },
  ],
}

describe('Token budget tracking E2E', () => {
  let supervisor: Supervisor

  beforeAll(async () => {
    supervisor = new Supervisor(config, { headless: true })
    supervisor.initEventBus('run-token-e2e')
    await supervisor.start()
  }, 10_000)

  afterAll(async () => {
    await supervisor.shutdown()
  })

  it('should track token usage per agent', () => {
    supervisor.recordTokenUsage('ceo', 1000, 500)
    supervisor.recordTokenUsage('dev', 2000, 800)
    supervisor.recordTokenUsage('ceo', 500, 200)

    const summary = supervisor.tokenTracker.getUsage('run-token-e2e')
    expect(summary.total).toBe(1000 + 500 + 2000 + 800 + 500 + 200)
    expect(summary.byAgent['ceo']).toBe(1000 + 500 + 500 + 200)
    expect(summary.byAgent['dev']).toBe(2000 + 800)
  })

  it('should update context store with token_usage', async () => {
    // Query context via RPC
    const res = await supervisor.handleRpcAsync({
      jsonrpc: '2.0',
      id: 'test-1',
      method: RPC_METHODS.CONTEXT_GET,
      params: { key: 'token_usage' },
    })

    expect(res.error).toBeUndefined()
    const result = res.result as { value: string }
    const usage = JSON.parse(result.value)
    expect(usage.total).toBe(5000) // 1500 + 2800 + 700
    expect(usage.byAgent.ceo).toBe(2200)
    expect(usage.byAgent.dev).toBe(2800)
  })

  it('should check budget when WANMAN_TOKEN_BUDGET is set', () => {
    const origBudget = process.env['WANMAN_TOKEN_BUDGET']
    process.env['WANMAN_TOKEN_BUDGET'] = '10000'

    supervisor.recordTokenUsage('finance', 100, 50)

    const summary = supervisor.tokenTracker.getUsage('run-token-e2e')
    const check = supervisor.tokenTracker.checkBudget('run-token-e2e', 10000)
    expect(check.remaining).toBe(10000 - summary.total)
    expect(check.exceeded).toBe(false)
    expect(check.warning).toBe(false) // 5150/10000 = 51.5%, not yet warning

    process.env['WANMAN_TOKEN_BUDGET'] = origBudget
  })

  it('should detect budget warning', () => {
    // Record a lot of tokens to trigger warning (< 20% remaining)
    supervisor.recordTokenUsage('dev', 3000, 1000) // total now ~9150

    const check = supervisor.tokenTracker.checkBudget('run-token-e2e', 10000)
    // 10000 - 9150 = 850, which is < 2000 (20% of 10000)
    expect(check.warning).toBe(true)
    expect(check.exceeded).toBe(false)
  })

  it('should detect budget exceeded', () => {
    supervisor.recordTokenUsage('dev', 5000, 5000) // blow past budget

    const check = supervisor.tokenTracker.checkBudget('run-token-e2e', 10000)
    expect(check.exceeded).toBe(true)
  })
})

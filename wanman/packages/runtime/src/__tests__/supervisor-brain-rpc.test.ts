/**
 * Unit tests for Supervisor async RPC handlers: artifact and hypothesis operations.
 * Mocks BrainManager with controllable executeSQL to verify SQL construction,
 * parameter validation, escaping, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { AgentMatrixConfig, JsonRpcRequest } from '@wanman/core'
import { RPC_METHODS, RPC_ERRORS } from '@wanman/core'

// Mock child_process to prevent real git operations during start()
vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => ''),
}))

// Mock http-server
vi.mock('../http-server.js', () => ({
  createHttpServer: vi.fn(() => ({
    close: (cb: () => void) => cb(),
  })),
}))

// Mock logger
vi.mock('../logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Mock agent-process
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

// Controllable mock for brain-manager
const mockExecuteSQL = vi.fn()
const mockBrainInitialize = vi.fn(async () => {})

vi.mock('../brain-manager.js', () => {
  class MockBrainManager {
    initialize = mockBrainInitialize
    get env() { return {} }
    get isInitialized() { return true }
    executeSQL = mockExecuteSQL
    get brainSkill() { return { name: 'brain', content: '# brain stub' } }
  }
  return { BrainManager: MockBrainManager }
})

import { Supervisor } from '../supervisor.js'

function makeConfig(overrides?: Partial<AgentMatrixConfig>): AgentMatrixConfig {
  return {
    agents: [
      { name: 'coder', lifecycle: '24/7', model: 'sonnet', systemPrompt: 'coder' },
    ],
    dbPath: ':memory:',
    port: 0,
    brain: { token: 'test-token', dbName: 'test-brain' },
    ...overrides,
  }
}

function rpc(method: string, params?: Record<string, unknown>): JsonRpcRequest {
  return { jsonrpc: '2.0', id: 1, method, params }
}

/** Get the SQL string from the last executeSQL call */
function lastSQL(): string {
  const calls = mockExecuteSQL.mock.calls
  return calls[calls.length - 1]?.[0] ?? ''
}

describe('Supervisor brain RPC handlers', () => {
  let supervisor: Supervisor

  beforeEach(async () => {
    vi.clearAllMocks()
    // Also drain any queued `mockResolvedValueOnce` / `mockRejectedValueOnce`
    // left over from the previous test. `vi.clearAllMocks` only resets
    // `mock.calls`, so without this an error-path test leaves a pending
    // rejection that fires on the next handler's first executeSQL call.
    mockExecuteSQL.mockReset()
    mockExecuteSQL.mockResolvedValue([])
    supervisor = new Supervisor(makeConfig())
    await supervisor.start()
  })

  afterEach(async () => {
    await supervisor.shutdown()
  })

  // ── Brain not initialized — all handlers ──

  describe('brain not initialized', () => {
    let noBrainSupervisor: Supervisor

    beforeEach(async () => {
      noBrainSupervisor = new Supervisor(makeConfig({ brain: undefined }))
      await noBrainSupervisor.start()
    })

    afterEach(async () => {
      await noBrainSupervisor.shutdown()
    })

    const methods = [
      RPC_METHODS.ARTIFACT_GET,
      RPC_METHODS.ARTIFACT_LIST,
      RPC_METHODS.HYPOTHESIS_CREATE,
      RPC_METHODS.HYPOTHESIS_LIST,
      RPC_METHODS.HYPOTHESIS_UPDATE,
    ]

    for (const method of methods) {
      it(`${method} should return error`, async () => {
        const res = await noBrainSupervisor.handleRpcAsync(
          rpc(method, { id: 1, title: 'test', status: 'active', agent: 'ceo' }),
        )
        expect(res.error?.code).toBe(RPC_ERRORS.INTERNAL_ERROR)
        expect(res.error?.message).toContain('Brain not initialized')
      })
    }
  })

  // ── ARTIFACT_GET ──

  describe('artifact.get', () => {
    it('should query artifact by id', async () => {
      const fakeRow = { id: 42, agent: 'feedback', kind: 'market_data', content: 'hello' }
      mockExecuteSQL.mockResolvedValueOnce([fakeRow])

      const res = await supervisor.handleRpcAsync(rpc(RPC_METHODS.ARTIFACT_GET, { id: 42 }))

      expect(res.error).toBeUndefined()
      expect(res.result).toEqual([fakeRow])
      expect(lastSQL()).toContain('WHERE id = 42')
      expect(lastSQL()).toContain('content')
    })

    it('should return error when id is missing', async () => {
      const res = await supervisor.handleRpcAsync(rpc(RPC_METHODS.ARTIFACT_GET, {}))
      expect(res.error?.code).toBe(RPC_ERRORS.INVALID_PARAMS)
      expect(res.error?.message).toContain('id')
    })

    it('should safely parse string id to integer', async () => {
      mockExecuteSQL.mockResolvedValueOnce([])
      await supervisor.handleRpcAsync(rpc(RPC_METHODS.ARTIFACT_GET, { id: '99' }))
      expect(lastSQL()).toContain('WHERE id = 99')
    })

    it('should reject non-numeric id', async () => {
      const res = await supervisor.handleRpcAsync(rpc(RPC_METHODS.ARTIFACT_GET, { id: 'abc' }))
      expect(res.error?.code).toBe(RPC_ERRORS.INVALID_PARAMS)
      expect(res.error?.message).toContain('must be a number')
    })

    it('should accept id: 0 as valid', async () => {
      mockExecuteSQL.mockResolvedValueOnce([])
      const res = await supervisor.handleRpcAsync(rpc(RPC_METHODS.ARTIFACT_GET, { id: 0 }))
      expect(res.error).toBeUndefined()
      expect(lastSQL()).toContain('WHERE id = 0')
    })

    it('should handle executeSQL failure', async () => {
      mockExecuteSQL.mockRejectedValueOnce(new Error('connection lost'))
      const res = await supervisor.handleRpcAsync(rpc(RPC_METHODS.ARTIFACT_GET, { id: 1 }))
      expect(res.error?.code).toBe(RPC_ERRORS.INTERNAL_ERROR)
      expect(res.error?.message).toContain('connection lost')
    })
  })

  // ── ARTIFACT_LIST ──

  describe('artifact.list', () => {
    it('should list all artifacts without filters', async () => {
      mockExecuteSQL.mockResolvedValueOnce([])
      const res = await supervisor.handleRpcAsync(rpc(RPC_METHODS.ARTIFACT_LIST, {}))

      expect(res.error).toBeUndefined()
      expect(lastSQL()).toContain('length(content) as content_length')
      expect(lastSQL()).not.toContain('WHERE')
      expect(lastSQL()).toContain('ORDER BY created_at DESC LIMIT 100')
    })

    it('should filter by agent', async () => {
      mockExecuteSQL.mockResolvedValueOnce([])
      await supervisor.handleRpcAsync(rpc(RPC_METHODS.ARTIFACT_LIST, { agent: 'feedback' }))
      expect(lastSQL()).toContain("agent = 'feedback'")
    })

    it('should filter by kind', async () => {
      mockExecuteSQL.mockResolvedValueOnce([])
      await supervisor.handleRpcAsync(rpc(RPC_METHODS.ARTIFACT_LIST, { kind: 'market_data' }))
      expect(lastSQL()).toContain("kind = 'market_data'")
    })

    it('should filter by verified', async () => {
      mockExecuteSQL.mockResolvedValueOnce([])
      await supervisor.handleRpcAsync(rpc(RPC_METHODS.ARTIFACT_LIST, { verified: true }))
      expect(lastSQL()).toContain("metadata->>'verified' = 'true'")
    })

    it('should combine multiple filters with AND', async () => {
      mockExecuteSQL.mockResolvedValueOnce([])
      await supervisor.handleRpcAsync(rpc(RPC_METHODS.ARTIFACT_LIST, { agent: 'dev', kind: 'code' }))
      const sql = lastSQL()
      expect(sql).toContain("agent = 'dev'")
      expect(sql).toContain("kind = 'code'")
      expect(sql).toContain(' AND ')
    })

    it('should reject agent names that fail the SAFE_IDENT whitelist', async () => {
      // The handler guards with SAFE_IDENT before building SQL so that a
      // malicious agent string (containing apostrophes, semicolons, etc.)
      // cannot reach the query builder at all. This is stricter than
      // per-value escaping and is the intentional design.
      const res = await supervisor.handleRpcAsync(rpc(RPC_METHODS.ARTIFACT_LIST, { agent: "O'Malley" }))
      expect(res.error?.code).toBe(RPC_ERRORS.INVALID_PARAMS)
      expect(res.error?.message).toContain('invalid agent filter')
    })

    it('should sanitize verified to boolean string (prevent injection)', async () => {
      mockExecuteSQL.mockResolvedValueOnce([])
      await supervisor.handleRpcAsync(rpc(RPC_METHODS.ARTIFACT_LIST, {
        verified: "true'; DROP TABLE artifacts--" as unknown as boolean,
      }))
      const sql = lastSQL()
      // Should be sanitized to just 'false' (non-boolean string → false)
      expect(sql).not.toContain('DROP TABLE')
      expect(sql).toContain("metadata->>'verified' = 'false'")
    })

    it('should handle executeSQL failure', async () => {
      mockExecuteSQL.mockRejectedValueOnce(new Error('timeout'))
      const res = await supervisor.handleRpcAsync(rpc(RPC_METHODS.ARTIFACT_LIST, {}))
      expect(res.error?.code).toBe(RPC_ERRORS.INTERNAL_ERROR)
      expect(res.error?.message).toContain('timeout')
    })
  })

  // ── HYPOTHESIS_CREATE ──

  describe('hypothesis.create', () => {
    it('should create with minimal params (title only, defaults agent to ceo)', async () => {
      mockExecuteSQL.mockResolvedValueOnce([{ id: 1, title: 'test', status: 'proposed' }])

      const res = await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_CREATE, {
        title: '深化选址分析',
      }))

      expect(res.error).toBeUndefined()
      const sql = lastSQL()
      expect(sql).toContain('INSERT INTO hypotheses')
      expect(sql).toContain("'ceo'")
      expect(sql).toContain("'深化选址分析'")
      expect(sql).toContain('RETURNING id, title, status, created_at')
    })

    it('should include all optional fields', async () => {
      mockExecuteSQL.mockResolvedValueOnce([{ id: 1 }])

      await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_CREATE, {
        title: 'test',
        agent: 'ceo',
        rationale: '当前只有区域级数据',
        expectedValue: '确定最优选址',
        estimatedCost: '2-3 tasks',
        parentId: 5,
      }))

      const sql = lastSQL()
      expect(sql).toContain('rationale')
      expect(sql).toContain('expected_value')
      expect(sql).toContain('estimated_cost')
      expect(sql).toContain('parent_id')
      expect(sql).toContain("'当前只有区域级数据'")
      expect(sql).toContain("'确定最优选址'")
      expect(sql).toContain("'2-3 tasks'")
    })

    it('should return error when title is missing', async () => {
      const res = await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_CREATE, { agent: 'ceo' }))
      expect(res.error?.code).toBe(RPC_ERRORS.INVALID_PARAMS)
      expect(res.error?.message).toContain('title')
    })

    it('should escape single quotes in all text fields', async () => {
      mockExecuteSQL.mockResolvedValueOnce([{ id: 1 }])

      await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_CREATE, {
        title: "O'Brien's hypothesis",
        agent: 'ceo',
        rationale: "it's important",
      }))

      const sql = lastSQL()
      expect(sql).toContain("O''Brien''s hypothesis")
      expect(sql).toContain("it''s important")
    })

    it('should parse parentId to integer', async () => {
      mockExecuteSQL.mockResolvedValueOnce([{ id: 1 }])

      await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_CREATE, {
        title: 'child',
        parentId: '3',
      }))

      const sql = lastSQL()
      expect(sql).toContain('parent_id')
      // Verify it's an unquoted integer, not a string
      expect(sql).toMatch(/3\)/)
    })

    it('should handle executeSQL failure', async () => {
      mockExecuteSQL.mockRejectedValueOnce(new Error('unique violation'))
      const res = await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_CREATE, {
        title: 'test',
        agent: 'ceo',
      }))
      expect(res.error?.code).toBe(RPC_ERRORS.INTERNAL_ERROR)
      expect(res.error?.message).toContain('unique violation')
    })
  })

  // ── HYPOTHESIS_LIST ──

  describe('hypothesis.list', () => {
    it('should list all without filters', async () => {
      mockExecuteSQL.mockResolvedValueOnce([])
      const res = await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_LIST, {}))

      expect(res.error).toBeUndefined()
      const sql = lastSQL()
      expect(sql).toContain('FROM hypotheses')
      expect(sql).not.toContain('WHERE')
      expect(sql).toContain('ORDER BY created_at DESC LIMIT 100')
    })

    it('should filter by status', async () => {
      mockExecuteSQL.mockResolvedValueOnce([])
      await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_LIST, { status: 'active' }))
      expect(lastSQL()).toContain("status = 'active'")
    })

    it('should use recursive CTE for tree query', async () => {
      mockExecuteSQL.mockResolvedValueOnce([])
      await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_LIST, { treeRoot: 1 }))

      const sql = lastSQL()
      expect(sql).toContain('WITH RECURSIVE tree AS')
      expect(sql).toContain('WHERE id = 1')
      expect(sql).toContain('UNION ALL')
      expect(sql).toContain('h.parent_id = t.id')
      expect(sql).toContain('ORDER BY id')
    })

    it('should prefer treeRoot over status filter', async () => {
      mockExecuteSQL.mockResolvedValueOnce([])
      await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_LIST, { treeRoot: 1, status: 'active' }))

      const sql = lastSQL()
      // treeRoot takes the tree query path, status is ignored
      expect(sql).toContain('WITH RECURSIVE')
      expect(sql).not.toContain("status = 'active'")
    })

    it('should reject status values that fail the SAFE_IDENT whitelist', async () => {
      // Defense-in-depth: the handler rejects an apostrophe-bearing status
      // before building SQL rather than relying on escaping alone.
      const res = await supervisor.handleRpcAsync(
        rpc(RPC_METHODS.HYPOTHESIS_LIST, { status: "active'; DROP TABLE--" }),
      )
      expect(res.error?.code).toBe(RPC_ERRORS.INVALID_PARAMS)
      expect(res.error?.message).toContain('invalid status')
    })

    it('should safely parse treeRoot to integer', async () => {
      mockExecuteSQL.mockResolvedValueOnce([])
      await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_LIST, { treeRoot: '7' }))
      expect(lastSQL()).toContain('WHERE id = 7')
    })

    it('should handle executeSQL failure', async () => {
      mockExecuteSQL.mockRejectedValueOnce(new Error('relation does not exist'))
      const res = await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_LIST, {}))
      expect(res.error?.code).toBe(RPC_ERRORS.INTERNAL_ERROR)
      expect(res.error?.message).toContain('relation does not exist')
    })
  })

  // ── HYPOTHESIS_UPDATE ──

  describe('hypothesis.update', () => {
    it('should update status to active without resolved_at', async () => {
      mockExecuteSQL.mockResolvedValueOnce([{ id: 1, status: 'active', resolved_at: null }])

      const res = await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_UPDATE, {
        id: 1, status: 'active',
      }))

      expect(res.error).toBeUndefined()
      const sql = lastSQL()
      expect(sql).toContain("status = 'active'")
      expect(sql).not.toContain('resolved_at = now()')
      expect(sql).toContain('RETURNING id, status, resolved_at')
    })

    it('should auto-set resolved_at for validated', async () => {
      mockExecuteSQL.mockResolvedValueOnce([{ id: 1 }])
      await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_UPDATE, { id: 1, status: 'validated' }))
      expect(lastSQL()).toContain('resolved_at = now()')
    })

    it('should auto-set resolved_at for rejected', async () => {
      mockExecuteSQL.mockResolvedValueOnce([{ id: 1 }])
      await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_UPDATE, { id: 1, status: 'rejected' }))
      expect(lastSQL()).toContain('resolved_at = now()')
    })

    it('should auto-set resolved_at for abandoned', async () => {
      mockExecuteSQL.mockResolvedValueOnce([{ id: 1 }])
      await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_UPDATE, { id: 1, status: 'abandoned' }))
      expect(lastSQL()).toContain('resolved_at = now()')
    })

    it('should NOT set resolved_at for proposed', async () => {
      mockExecuteSQL.mockResolvedValueOnce([{ id: 1 }])
      await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_UPDATE, { id: 1, status: 'proposed' }))
      expect(lastSQL()).not.toContain('resolved_at = now()')
    })

    it('should include outcome when provided', async () => {
      mockExecuteSQL.mockResolvedValueOnce([{ id: 1 }])
      await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_UPDATE, {
        id: 1, status: 'validated', outcome: '确定了最优选址',
      }))
      expect(lastSQL()).toContain("outcome = '确定了最优选址'")
    })

    it('should include evidence artifact IDs as postgres array', async () => {
      mockExecuteSQL.mockResolvedValueOnce([{ id: 1 }])
      await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_UPDATE, {
        id: 1, status: 'validated', evidence: [42, 43, 44],
      }))
      expect(lastSQL()).toContain('evidence_artifact_ids = ARRAY[42,43,44]')
    })

    it('should return error when id is missing', async () => {
      const res = await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_UPDATE, { status: 'active' }))
      expect(res.error?.code).toBe(RPC_ERRORS.INVALID_PARAMS)
      expect(res.error?.message).toContain('id')
    })

    it('should return error when id is non-numeric', async () => {
      const res = await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_UPDATE, { id: 'abc', status: 'active' }))
      expect(res.error?.code).toBe(RPC_ERRORS.INVALID_PARAMS)
      expect(res.error?.message).toContain('must be a number')
    })

    it('should accept id: 0 as valid', async () => {
      mockExecuteSQL.mockResolvedValueOnce([])
      const res = await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_UPDATE, { id: 0, status: 'active' }))
      expect(res.error).toBeUndefined()
      expect(lastSQL()).toContain('WHERE id = 0')
    })

    it('should return error when status is missing', async () => {
      const res = await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_UPDATE, { id: 1 }))
      expect(res.error?.code).toBe(RPC_ERRORS.INVALID_PARAMS)
      expect(res.error?.message).toContain('status')
    })

    it('should escape single quotes in outcome', async () => {
      mockExecuteSQL.mockResolvedValueOnce([{ id: 1 }])
      await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_UPDATE, {
        id: 1, status: 'rejected', outcome: "it's not feasible",
      }))
      expect(lastSQL()).toContain("it''s not feasible")
    })

    it('should safely parse evidence IDs to integers', async () => {
      mockExecuteSQL.mockResolvedValueOnce([{ id: 1 }])
      await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_UPDATE, {
        id: 1, status: 'validated', evidence: ['10', '20'],
      }))
      expect(lastSQL()).toContain('ARRAY[10,20]')
    })

    it('should handle executeSQL failure', async () => {
      mockExecuteSQL.mockRejectedValueOnce(new Error('deadlock'))
      const res = await supervisor.handleRpcAsync(rpc(RPC_METHODS.HYPOTHESIS_UPDATE, {
        id: 1, status: 'active',
      }))
      expect(res.error?.code).toBe(RPC_ERRORS.INTERNAL_ERROR)
      expect(res.error?.message).toContain('deadlock')
    })
  })
})

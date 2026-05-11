/**
 * Unit tests for BrainManager — db9 database initialization and brain schema setup.
 * Mocks @sandbank.dev/db9 to avoid real API calls.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Db9Database } from '@sandbank.dev/db9'

// Mock logger to suppress output
vi.mock('../logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// --- db9 mocks ---

const mockListDatabases = vi.fn<() => Promise<Db9Database[]>>()
const mockCreateDatabase = vi.fn<(name: string) => Promise<Db9Database>>()
const mockExecuteSQL = vi.fn<(dbId: string, query: string) => Promise<unknown>>()

const mockBrainSkillDef = { name: 'brain', content: '# brain skill stub' }

vi.mock('@sandbank.dev/db9', () => {
  class MockDb9Client {
    listDatabases = mockListDatabases
    createDatabase = mockCreateDatabase
    executeSQL = mockExecuteSQL
  }
  class MockDb9ServiceAdapter {
    client: MockDb9Client
    constructor(_config: unknown) {
      this.client = new MockDb9Client()
    }
  }
  return {
    Db9ServiceAdapter: MockDb9ServiceAdapter,
    initBrainSchema: vi.fn(async () => {}),
    brainSkillDefinition: vi.fn(() => mockBrainSkillDef),
  }
})

// Import after mocks are set up
import { BrainManager, type BrainManagerConfig } from '../brain-manager.js'
import { initBrainSchema, brainSkillDefinition } from '@sandbank.dev/db9'

const fakeDb: Db9Database = {
  id: 'db-123',
  name: 'wanman-brain',
  state: 'ready',
  host: 'pg.db9.ai',
  port: 5432,
  username: 'user1',
  password: 'secret',
  database: 'wanman_brain',
  connection_string: 'postgresql://user1:secret@pg.db9.ai:5432/wanman_brain',
  created_at: '2026-01-01T00:00:00Z',
}

function makeConfig(overrides?: Partial<BrainManagerConfig>): BrainManagerConfig {
  return {
    token: 'test-token',
    dbName: 'wanman-brain',
    ...overrides,
  }
}

describe('BrainManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('construction', () => {
    it('should construct with a token and dbName', () => {
      const bm = new BrainManager(makeConfig())
      expect(bm).toBeDefined()
    })
  })

  describe('isInitialized', () => {
    it('should be false before initialize()', () => {
      const bm = new BrainManager(makeConfig())
      expect(bm.isInitialized).toBe(false)
    })

    it('should be true after initialize()', async () => {
      mockListDatabases.mockResolvedValue([fakeDb])
      const bm = new BrainManager(makeConfig())
      await bm.initialize()
      expect(bm.isInitialized).toBe(true)
    })
  })

  describe('initialize() — create new db', () => {
    it('should create db and run brain schema when no existing db', async () => {
      mockListDatabases.mockResolvedValue([])
      mockCreateDatabase.mockResolvedValue(fakeDb)

      const bm = new BrainManager(makeConfig())
      await bm.initialize()

      expect(mockListDatabases).toHaveBeenCalledOnce()
      expect(mockCreateDatabase).toHaveBeenCalledWith('wanman-brain')
      expect(initBrainSchema).toHaveBeenCalledOnce()
      expect(bm.isInitialized).toBe(true)
    })

    it('should throw if created db is not ready', async () => {
      mockListDatabases.mockResolvedValue([])
      mockCreateDatabase.mockResolvedValue({ ...fakeDb, state: 'creating' })

      const bm = new BrainManager(makeConfig())
      await expect(bm.initialize()).rejects.toThrow('not ready')
    })
  })

  describe('initialize() — reuse existing db', () => {
    it('should reuse existing database when found', async () => {
      mockListDatabases.mockResolvedValue([fakeDb])

      const bm = new BrainManager(makeConfig())
      await bm.initialize()

      expect(mockListDatabases).toHaveBeenCalledOnce()
      expect(mockCreateDatabase).not.toHaveBeenCalled()
      expect(initBrainSchema).toHaveBeenCalledOnce()
      expect(bm.isInitialized).toBe(true)
    })

    it('should skip non-ready databases when searching for existing', async () => {
      const notReady = { ...fakeDb, state: 'creating' }
      mockListDatabases.mockResolvedValue([notReady])
      mockCreateDatabase.mockResolvedValue(fakeDb)

      const bm = new BrainManager(makeConfig())
      await bm.initialize()

      // Should not reuse the 'creating' db, should create a new one
      expect(mockCreateDatabase).toHaveBeenCalledWith('wanman-brain')
    })
  })

  describe('initWanmanSchema', () => {
    it('should create hypotheses table and indexes during initialize', async () => {
      mockListDatabases.mockResolvedValue([fakeDb])
      const bm = new BrainManager(makeConfig())
      await bm.initialize()

      const sqlCalls = mockExecuteSQL.mock.calls
        .map(c => c[1] as string)
        .filter(sql => sql?.includes('hypotheses'))

      expect(sqlCalls).toHaveLength(3)
      expect(sqlCalls[0]).toContain('CREATE TABLE IF NOT EXISTS hypotheses')
      expect(sqlCalls[0]).toContain('parent_id int REFERENCES hypotheses(id)')
      expect(sqlCalls[0]).toContain("CHECK (status IN ('proposed', 'active', 'validated', 'rejected', 'abandoned'))")
      expect(sqlCalls[0]).toContain('evidence_artifact_ids int[]')
      expect(sqlCalls[1]).toContain('CREATE INDEX IF NOT EXISTS idx_hypotheses_status')
      expect(sqlCalls[2]).toContain('CREATE INDEX IF NOT EXISTS idx_hypotheses_parent')
    })

    it('should create runs table during initialize', async () => {
      mockListDatabases.mockResolvedValue([fakeDb])
      const bm = new BrainManager(makeConfig())
      await bm.initialize()

      const sqlCalls = mockExecuteSQL.mock.calls
        .map(c => c[1] as string)
        .filter(sql => sql?.includes('runs'))

      // CREATE TABLE runs (no indexes)
      const createTable = sqlCalls.find(s => s.includes('CREATE TABLE IF NOT EXISTS runs'))
      expect(createTable).toBeDefined()
      expect(createTable).toContain('id text PRIMARY KEY')
      expect(createTable).toContain('goal text')
      expect(createTable).toContain('config jsonb')
      expect(createTable).toContain('total_loops int DEFAULT 0')
      expect(createTable).toContain('productive_loops int DEFAULT 0')
      expect(createTable).toContain('total_cost_usd real DEFAULT 0')
      expect(createTable).toContain('exit_reason text')
    })

    it('should create loop_events table with indexes during initialize', async () => {
      mockListDatabases.mockResolvedValue([fakeDb])
      const bm = new BrainManager(makeConfig())
      await bm.initialize()

      const sqlCalls = mockExecuteSQL.mock.calls
        .map(c => c[1] as string)
        .filter(sql => sql?.includes('loop_events'))

      expect(sqlCalls.length).toBeGreaterThanOrEqual(4) // CREATE TABLE + 3 indexes
      expect(sqlCalls[0]).toContain('CREATE TABLE IF NOT EXISTS loop_events')
      expect(sqlCalls[0]).toContain('run_id text NOT NULL')
      expect(sqlCalls[0]).toContain('loop_number int NOT NULL')
      expect(sqlCalls[0]).toContain('event_type text NOT NULL')
      expect(sqlCalls[0]).toContain('classification text')
      expect(sqlCalls[0]).toContain('payload jsonb NOT NULL')
      expect(sqlCalls.some(s => s.includes('idx_loop_events_run'))).toBe(true)
      expect(sqlCalls.some(s => s.includes('idx_loop_events_type'))).toBe(true)
      expect(sqlCalls.some(s => s.includes('idx_loop_events_classification'))).toBe(true)
    })

    it('should create skill_evals table during initialize', async () => {
      mockListDatabases.mockResolvedValue([fakeDb])
      const bm = new BrainManager(makeConfig())
      await bm.initialize()

      const sqlCalls = mockExecuteSQL.mock.calls
        .map(c => c[1] as string)
        .filter(sql => sql?.includes('skill_evals'))

      const createTable = sqlCalls.find(s => s.includes('CREATE TABLE IF NOT EXISTS skill_evals'))
      expect(createTable).toBeDefined()
      expect(createTable).toContain('agent text NOT NULL')
      expect(createTable).toContain('eval_name text NOT NULL')
      expect(createTable).toContain('skill_version text NOT NULL')
      expect(createTable).toContain('pass_rate real')
      expect(createTable).toContain('avg_tokens int')
      expect(createTable).toContain('avg_duration_ms int')
    })

    it('should create run_feedback table with indexes during initialize', async () => {
      mockListDatabases.mockResolvedValue([fakeDb])
      const bm = new BrainManager(makeConfig())
      await bm.initialize()

      const sqlCalls = mockExecuteSQL.mock.calls
        .map(c => c[1] as string)
        .filter(sql => sql?.includes('run_feedback'))

      expect(sqlCalls.length).toBeGreaterThanOrEqual(3) // CREATE TABLE + 2 indexes
      const createTable = sqlCalls.find(s => s.includes('CREATE TABLE IF NOT EXISTS run_feedback'))
      expect(createTable).toBeDefined()
      expect(createTable).toContain('run_id text')
      expect(createTable).toContain('agent text NOT NULL')
      expect(createTable).toContain('task_completed boolean')
      expect(createTable).toContain('cost_usd real')
      expect(createTable).toContain('duration_ms int')
      expect(createTable).toContain('token_count int')
      expect(createTable).toContain('errored boolean DEFAULT false')
      expect(createTable).toContain('steer_count int DEFAULT 0')
      expect(sqlCalls.some(s => s.includes('ALTER TABLE run_feedback ADD COLUMN execution_profile'))).toBe(true)
      expect(sqlCalls.some(s => s.includes('ALTER TABLE run_feedback ADD COLUMN activation_snapshot_id'))).toBe(true)
      expect(sqlCalls.some(s => s.includes('idx_run_feedback_agent'))).toBe(true)
      expect(sqlCalls.some(s => s.includes('idx_run_feedback_run'))).toBe(true)
    })

    it('should create skills version table with indexes during initialize', async () => {
      mockListDatabases.mockResolvedValue([fakeDb])
      const bm = new BrainManager(makeConfig())
      await bm.initialize()

      const sqlCalls = mockExecuteSQL.mock.calls
        .map(c => c[1] as string)
        .filter(sql => sql?.includes('skills'))

      expect(sqlCalls.length).toBeGreaterThanOrEqual(3) // CREATE TABLE + 2 indexes
      const createTable = sqlCalls.find(s => s.includes('CREATE TABLE IF NOT EXISTS skills'))
      expect(createTable).toBeDefined()
      expect(createTable).toContain('agent text NOT NULL')
      expect(createTable).toContain('version int NOT NULL DEFAULT 1')
      expect(createTable).toContain('content text NOT NULL')
      expect(createTable).toContain('is_active boolean DEFAULT true')
      expect(createTable).toContain('eval_pass_rate real')
      expect(createTable).toContain("created_by text DEFAULT 'human'")
      expect(sqlCalls.some(s => s.includes('idx_skills_agent_active'))).toBe(true)
      expect(sqlCalls.some(s => s.includes('idx_skills_agent_version'))).toBe(true)
    })

    it('should create shared skill registry and activation snapshot tables', async () => {
      mockListDatabases.mockResolvedValue([fakeDb])
      const bm = new BrainManager(makeConfig())
      await bm.initialize()

      const sqlCalls = mockExecuteSQL.mock.calls.map(c => c[1] as string)

      expect(sqlCalls.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS shared_skills'))).toBe(true)
      expect(sqlCalls.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS shared_skill_versions'))).toBe(true)
      expect(sqlCalls.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS skill_bundles'))).toBe(true)
      expect(sqlCalls.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS skill_bundle_entries'))).toBe(true)
      expect(sqlCalls.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS skill_activation_snapshots'))).toBe(true)
    })

    it('should run after initBrainSchema', async () => {
      mockListDatabases.mockResolvedValue([fakeDb])
      const callOrder: string[] = []
      ;(initBrainSchema as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callOrder.push('initBrainSchema')
      })
      mockExecuteSQL.mockImplementation(async () => {
        callOrder.push('executeSQL')
      })

      const bm = new BrainManager(makeConfig())
      await bm.initialize()

      // initBrainSchema should be called before any executeSQL (from initWanmanSchema)
      expect(callOrder[0]).toBe('initBrainSchema')
      expect(callOrder.filter(c => c === 'executeSQL').length).toBeGreaterThan(0)
      expect(callOrder.slice(1).every(c => c === 'executeSQL')).toBe(true)
    })
  })

  describe('brainSkill', () => {
    it('should return brain skill definition after db9 module is loaded', async () => {
      mockListDatabases.mockResolvedValue([fakeDb])
      const bm = new BrainManager(makeConfig())
      await bm.initialize()
      const skill = bm.brainSkill
      expect(skill).toEqual(mockBrainSkillDef)
      expect(brainSkillDefinition).toHaveBeenCalled()
    })
  })

  describe('databaseUrl', () => {
    it('should throw before initialize()', () => {
      const bm = new BrainManager(makeConfig())
      expect(() => bm.databaseUrl).toThrow('not initialized')
    })

    it('should return connection string after initialize()', async () => {
      mockListDatabases.mockResolvedValue([fakeDb])
      const bm = new BrainManager(makeConfig())
      await bm.initialize()
      expect(bm.databaseUrl).toBe(fakeDb.connection_string)
    })
  })

  describe('env', () => {
    it('should throw before initialize()', () => {
      const bm = new BrainManager(makeConfig())
      expect(() => bm.env).toThrow('not initialized')
    })

    it('should return correct environment variables after initialize()', async () => {
      mockListDatabases.mockResolvedValue([fakeDb])
      const bm = new BrainManager(makeConfig())
      await bm.initialize()

      const env = bm.env
      expect(env).toEqual({
        DATABASE_URL: fakeDb.connection_string,
        DB9_DATABASE_ID: fakeDb.id,
        DB9_DATABASE_NAME: fakeDb.name,
        PGHOST: fakeDb.host,
        PGPORT: String(fakeDb.port),
        PGUSER: fakeDb.username,
        PGPASSWORD: fakeDb.password,
        PGDATABASE: fakeDb.database,
      })
    })
  })
})

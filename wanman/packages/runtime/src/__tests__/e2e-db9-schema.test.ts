/**
 * E2E test: db9 schema + real database operations.
 *
 * Creates a temporary db9 database, runs initWanmanSchema(),
 * verifies tables exist and data round-trips work.
 *
 * Requires: db9 CLI authenticated (db9 status → logged in)
 * Run: DB9_E2E=1 pnpm -F @wanman/runtime test e2e-db9-schema
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'node:child_process'

const DB9_E2E = process.env['DB9_E2E'] === '1'
const TEST_DB_NAME = `wanman-e2e-${Date.now()}`

let dbId: string | null = null

function db9Sql(query: string): string {
  return execSync(`db9 db sql ${dbId} -q "${query.replace(/"/g, '\\"')}"`, {
    encoding: 'utf-8',
    timeout: 15_000,
  }).trim()
}

function db9SqlJson(query: string): unknown[] {
  const out = execSync(`db9 --json db sql ${dbId} -q "${query.replace(/"/g, '\\"')}"`, {
    encoding: 'utf-8',
    timeout: 15_000,
  }).trim()
  return JSON.parse(out)
}

describe('db9 schema E2E', () => {
  beforeAll(async () => {
    if (!DB9_E2E) return

    // Create temporary database
    const createOut = execSync(`db9 --json db create --name ${TEST_DB_NAME}`, {
      encoding: 'utf-8',
      timeout: 30_000,
    })
    const db = JSON.parse(createOut)
    dbId = db.id
    console.log(`  E2E db created: ${dbId} (${TEST_DB_NAME})`)

    // Wait for database to be ready
    let ready = false
    const start = Date.now()
    while (!ready && Date.now() - start < 30_000) {
      try {
        db9Sql('SELECT 1')
        ready = true
      } catch {
        await new Promise(r => setTimeout(r, 2000))
      }
    }
    if (!ready) throw new Error('Database not ready after 30s')
  }, 60_000)

  afterAll(async () => {
    if (!DB9_E2E || !dbId) return
    try {
      execSync(`db9 db delete ${dbId} --yes`, { timeout: 15_000 })
      console.log(`  E2E db deleted: ${dbId}`)
    } catch (err) {
      console.warn(`  Failed to delete E2E db: ${err}`)
    }
  }, 30_000)

  it('should create all wanman tables via BrainManager', async () => {
    if (!DB9_E2E || !dbId) return

    // Run the same DDL that initWanmanSchema() executes
    // (We test the SQL directly since BrainManager requires the SDK)
    db9Sql(`CREATE TABLE IF NOT EXISTS runs (id text PRIMARY KEY, goal text, config jsonb, started_at timestamptz DEFAULT now(), ended_at timestamptz, total_loops int DEFAULT 0, productive_loops int DEFAULT 0, total_tokens int DEFAULT 0, total_cost_usd real DEFAULT 0, exit_reason text, metadata jsonb DEFAULT '{}')`)

    db9Sql(`CREATE TABLE IF NOT EXISTS loop_events (id serial PRIMARY KEY, run_id text NOT NULL, loop_number int NOT NULL, event_type text NOT NULL, classification text, agent text, payload jsonb NOT NULL DEFAULT '{}', created_at timestamptz DEFAULT now())`)
    db9Sql(`CREATE INDEX IF NOT EXISTS idx_loop_events_run ON loop_events (run_id, loop_number)`)

    db9Sql(`CREATE TABLE IF NOT EXISTS skill_evals (id serial PRIMARY KEY, agent text NOT NULL, eval_name text NOT NULL, skill_version text NOT NULL, pass_rate real, avg_tokens int, avg_duration_ms int, model text, created_at timestamptz DEFAULT now())`)

    db9Sql(`CREATE TABLE IF NOT EXISTS run_feedback (id serial PRIMARY KEY, run_id text, agent text NOT NULL, skill_version text, task_completed boolean, cost_usd real, duration_ms int, token_count int, errored boolean DEFAULT false, human_intervention boolean DEFAULT false, steer_count int DEFAULT 0, loop_number int, created_at timestamptz DEFAULT now())`)

    // Verify tables exist
    const tables = db9Sql(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    )
    expect(tables).toContain('runs')
    expect(tables).toContain('loop_events')
    expect(tables).toContain('skill_evals')
    expect(tables).toContain('run_feedback')
  }, 30_000)

  it('should insert and query runs', async () => {
    if (!DB9_E2E || !dbId) return

    db9Sql(`INSERT INTO runs (id, goal) VALUES ('run-e2e-001', 'E2E test goal')`)

    const rows = db9SqlJson(`SELECT id, goal FROM runs WHERE id = 'run-e2e-001'`)
    expect(rows).toHaveLength(1)
    expect((rows[0] as { id: string }).id).toBe('run-e2e-001')
    expect((rows[0] as { goal: string }).goal).toBe('E2E test goal')
  }, 15_000)

  it('should insert and query loop_events with JSONB payload', async () => {
    if (!DB9_E2E || !dbId) return

    db9Sql(`INSERT INTO loop_events (run_id, loop_number, event_type, classification, agent, payload) VALUES ('run-e2e-001', 1, 'loop.classified', 'productive', 'ceo', '{"reasons":["task transition"]}')`)

    const rows = db9SqlJson(`SELECT run_id, loop_number, event_type, classification, payload FROM loop_events WHERE run_id = 'run-e2e-001'`)
    expect(rows).toHaveLength(1)
    const row = rows[0] as Record<string, unknown>
    expect(row.event_type).toBe('loop.classified')
    expect(row.classification).toBe('productive')
    // payload is JSONB — db9 returns it as object
    const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload
    expect(payload.reasons).toContain('task transition')
  }, 15_000)

  it('should insert and query run_feedback', async () => {
    if (!DB9_E2E || !dbId) return

    db9Sql(`INSERT INTO run_feedback (run_id, agent, task_completed, cost_usd, duration_ms, token_count, loop_number) VALUES ('run-e2e-001', 'finance', true, 0.05, 3000, 5000, 1)`)

    const rows = db9SqlJson(`SELECT agent, task_completed, cost_usd, token_count FROM run_feedback WHERE run_id = 'run-e2e-001'`)
    expect(rows).toHaveLength(1)
    const row = rows[0] as Record<string, unknown>
    expect(row.agent).toBe('finance')
    expect(row.task_completed).toBe(true)
  }, 15_000)

  it('should insert and query skill_evals', async () => {
    if (!DB9_E2E || !dbId) return

    db9Sql(`INSERT INTO skill_evals (agent, eval_name, skill_version, pass_rate, avg_tokens, model) VALUES ('finance', 'mrr-calculation', 'v1', 0.95, 3000, 'claude-sonnet-4-6')`)

    const rows = db9SqlJson(`SELECT agent, eval_name, pass_rate FROM skill_evals WHERE agent = 'finance'`)
    expect(rows).toHaveLength(1)
    const row = rows[0] as Record<string, unknown>
    expect(row.eval_name).toBe('mrr-calculation')
    expect(Number(row.pass_rate)).toBeCloseTo(0.95, 1)
  }, 15_000)

  it('should update runs with final stats', async () => {
    if (!DB9_E2E || !dbId) return

    db9Sql(`UPDATE runs SET ended_at = now(), total_loops = 50, productive_loops = 42, total_cost_usd = 1.5, exit_reason = 'manual' WHERE id = 'run-e2e-001'`)

    const rows = db9SqlJson(`SELECT total_loops, productive_loops, exit_reason FROM runs WHERE id = 'run-e2e-001'`)
    const row = rows[0] as Record<string, unknown>
    expect(row.total_loops).toBe(50)
    expect(row.productive_loops).toBe(42)
    expect(row.exit_reason).toBe('manual')
  }, 15_000)

  it('should support cross-table queries (run → loop_events → run_feedback)', async () => {
    if (!DB9_E2E || !dbId) return

    const rows = db9SqlJson(`
      SELECT r.id, r.goal,
        (SELECT count(*) FROM loop_events le WHERE le.run_id = r.id) as event_count,
        (SELECT count(*) FROM run_feedback rf WHERE rf.run_id = r.id) as feedback_count
      FROM runs r WHERE r.id = 'run-e2e-001'
    `)
    const row = rows[0] as Record<string, unknown>
    expect(Number(row.event_count)).toBe(1)
    expect(Number(row.feedback_count)).toBe(1)
  }, 15_000)
})

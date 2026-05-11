/**
 * E2E test: Autoresearch-inspired patterns.
 *
 * Tests the features borrowed from Karpathy's autoresearch:
 * 1. SkillManager.autoPromote() — automatic version promotion
 * 2. results.tsv generation — human-scannable loop summaries
 *
 * Run: pnpm -F @wanman/runtime test e2e-autoresearch-patterns
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { existsSync, readFileSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

vi.mock('../logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  }),
}))

import { SkillManager } from '../skill-manager.js'
import { LoopEventBus } from '../loop-event-bus.js'
import { LoopLogger } from '../loop-logger.js'

// ── Shared in-memory SQL store ──

const tables: { skills: Array<Record<string, unknown>>; run_feedback: Array<Record<string, unknown>> } = {
  skills: [],
  run_feedback: [],
}
let idCounter = 0

function resetDb() {
  tables.skills = []
  tables.run_feedback = []
  idCounter = 0
}

function executeSQL(sql: string): unknown {
  const s = sql.trim()

  if (s.includes('INSERT INTO skills')) {
    const id = ++idCounter
    // Extract quoted strings from VALUES(...)
    const valuesStr = s.slice(s.indexOf('VALUES'))
    const quoted: string[] = []
    let i = 0
    while (i < valuesStr.length) {
      if (valuesStr[i] === "'") {
        let end = i + 1
        while (end < valuesStr.length) {
          if (valuesStr[end] === "'" && valuesStr[end + 1] !== "'") break
          if (valuesStr[end] === "'" && valuesStr[end + 1] === "'") end++
          end++
        }
        quoted.push(valuesStr.slice(i + 1, end).replace(/''/g, "'"))
        i = end + 1
      } else i++
    }
    // VALUES ('agent', version, 'content', false/true, 'created_by')
    const versionMatch = s.match(/,\s*(\d+)\s*,\s*'/)
    const row: Record<string, unknown> = {
      id, agent: quoted[0], version: Number(versionMatch?.[1] ?? 1),
      content: quoted[1] ?? '', is_active: false, // createVersion always sets false
      eval_pass_rate: null, created_at: new Date().toISOString(), created_by: quoted[2] ?? 'test',
    }
    tables.skills.push(row)
    return [row]
  }
  if (s.includes('MAX(version)')) {
    const agent = s.match(/agent\s*=\s*'([^']+)'/)?.[1]
    const vs = tables.skills.filter(r => r.agent === agent).map(r => r.version as number)
    return [{ max_v: vs.length ? Math.max(...vs) : 0 }]
  }
  if (s.includes('FROM skills') && s.includes('is_active = true')) {
    const agent = s.match(/agent\s*=\s*'([^']+)'/)?.[1]
    return tables.skills.filter(r => r.agent === agent && r.is_active).sort((a, b) => (b.version as number) - (a.version as number)).slice(0, 1)
  }
  if (s.includes('FROM skills') && s.includes('ORDER BY version DESC')) {
    const agent = s.match(/agent\s*=\s*'([^']+)'/)?.[1]
    return tables.skills.filter(r => r.agent === agent).sort((a, b) => (b.version as number) - (a.version as number))
  }
  if (s.includes('UPDATE skills SET is_active = false')) {
    const agent = s.match(/agent\s*=\s*'([^']+)'/)?.[1]
    tables.skills.filter(r => r.agent === agent).forEach(r => { r.is_active = false })
    return []
  }
  if (s.includes('UPDATE skills SET is_active = true')) {
    const agent = s.match(/agent\s*=\s*'([^']+)'/)?.[1]
    const version = Number(s.match(/version\s*=\s*(\d+)/)?.[1])
    const row = tables.skills.find(r => r.agent === agent && r.version === version)
    if (row) row.is_active = true
    return []
  }
  if (s.includes('SET eval_pass_rate')) {
    const rate = Number(s.match(/eval_pass_rate\s*=\s*([\d.]+)/)?.[1])
    const agent = s.match(/agent\s*=\s*'([^']+)'/)?.[1]
    const version = Number(s.match(/version\s*=\s*(\d+)/)?.[1])
    const row = tables.skills.find(r => r.agent === agent && r.version === version)
    if (row) row.eval_pass_rate = rate
    return []
  }
  return []
}

const mockBrain = { isInitialized: true, executeSQL: vi.fn(async (sql: string) => executeSQL(sql)) }

// ── Tests ──

// Skipped in OSS: the CEO agent and its CLAUDE.md shipped inside @wanman/core
// were SaaS-internal (Scope Boundary, Completeness Principle, specific Chinese
// autonomy language) and were dropped in the wanman.dev split. A framework
// consumer bringing their own ceo agent can re-enable these once the file
// exists at packages/core/agents/ceo/CLAUDE.md.
describe.skip('CEO CLAUDE.md autonomy guarantee (SaaS-only)', () => {
  it('should contain autonomy guarantee text', () => {
    const fs = require('node:fs')
    const path = require('node:path')
    const claudeMd = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'core', 'agents', 'ceo', 'CLAUDE.md'),
      'utf-8',
    )
    expect(claudeMd).toContain('不要停下来问人类')
    expect(claudeMd).toContain('人类可能在睡觉')
    expect(claudeMd).toContain('你是自主的')
  })

  it('should contain Scope Boundary declaration', () => {
    const fs = require('node:fs')
    const path = require('node:path')
    const claudeMd = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'core', 'agents', 'ceo', 'CLAUDE.md'),
      'utf-8',
    )
    expect(claudeMd).toContain('Scope Boundary')
    expect(claudeMd).toContain('可修改')
    expect(claudeMd).toContain('不可修改')
  })

  it('should contain Completeness Principle', () => {
    const fs = require('node:fs')
    const path = require('node:path')
    const claudeMd = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'core', 'agents', 'ceo', 'CLAUDE.md'),
      'utf-8',
    )
    expect(claudeMd).toContain('Completeness Principle')
    expect(claudeMd).toContain('不接受 MVP')
  })
})

describe('autoPromote (autoresearch: keep improvements, discard regressions)', () => {
  let sm: SkillManager

  beforeAll(() => {
    resetDb()
    sm = new SkillManager(mockBrain as any, '/tmp/nonexistent')
  })

  it('should return insufficient_data when only 1 version exists', async () => {
    await sm.createVersion('ceo', 'v1 content', 'human')
    await sm.activateVersion('ceo', 1)
    expect(await sm.autoPromote('ceo')).toBe('insufficient_data')
  })

  it('should return insufficient_data when eval pass rates not set', async () => {
    await sm.createVersion('ceo', 'v2 content', 'optimizer')
    expect(await sm.autoPromote('ceo')).toBe('insufficient_data')
  })

  it('should promote when candidate is better', async () => {
    await sm.updateEvalPassRate('ceo', 1, 0.6)
    await sm.updateEvalPassRate('ceo', 2, 0.85)

    const result = await sm.autoPromote('ceo')
    expect(result).toBe('promoted')

    // v2 should now be active
    const content = await sm.resolveSkill('ceo')
    expect(content).toBe('v2 content')
  })

  it('should keep current when candidate is worse', async () => {
    // Create v3 with bad eval
    await sm.createVersion('ceo', 'v3 bad content', 'optimizer')
    await sm.updateEvalPassRate('ceo', 3, 0.4) // worse than v2's 0.85

    const result = await sm.autoPromote('ceo')
    expect(result).toBe('kept')

    // v2 should still be active
    const content = await sm.resolveSkill('ceo')
    expect(content).toBe('v2 content')
  })
})

describe('results.tsv (autoresearch-style loop summaries)', () => {
  const tmpDir = join(tmpdir(), `results-tsv-test-${Date.now()}`)
  const ndjsonPath = join(tmpDir, 'loop-events.ndjson')
  const tsvPath = join(tmpDir, 'results.tsv')

  beforeAll(() => { mkdirSync(tmpDir, { recursive: true }) })
  afterAll(() => { try { rmSync(tmpDir, { recursive: true }) } catch { /* ignore */ } })

  it('should create results.tsv with header on first classified event', () => {
    const bus = new LoopEventBus('run-tsv-test')
    const logger = new LoopLogger({ ndjsonPath, bufferCapacity: 100 })
    logger.attach(bus)

    bus.tick()
    bus.classify([])

    expect(existsSync(tsvPath)).toBe(true)
    const content = readFileSync(tsvPath, 'utf-8')
    const lines = content.trim().split('\n')

    // Header + 1 data line
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('run_id')
    expect(lines[0]).toContain('tasks_created')
    expect(lines[0]).toContain('tasks_done')
    expect(lines[0]).toContain('completion_rate')
    expect(lines[1]).toContain('run-tsv-test')
    expect(lines[1]).toContain('idle')

    logger.detach(bus)
  })

  it('should append lines for each classified loop', () => {
    const bus = new LoopEventBus('run-tsv-test-2')
    const logger = new LoopLogger({ ndjsonPath: join(tmpDir, 'events2.ndjson'), bufferCapacity: 100 })
    // Reuse same tsvPath (it already has header from previous test)
    ;(logger as any).tsvPath = tsvPath
    logger.attach(bus)

    // 3 more loops
    bus.tick()
    bus.emit({ type: 'task.transition', runId: 'run-tsv-test-2', loop: 1, taskId: 1, from: 'pending', to: 'done', timestamp: new Date().toISOString() })
    bus.classify([])

    bus.tick()
    bus.classify([])

    bus.tick()
    bus.emit({ type: 'artifact.created', runId: 'run-tsv-test-2', loop: 3, agent: 'dev', kind: 'tech_spec', timestamp: new Date().toISOString() })
    bus.classify([])

    const content = readFileSync(tsvPath, 'utf-8')
    const lines = content.trim().split('\n')

    // Header + 1 (from prev test) + 3 new = 5
    expect(lines).toHaveLength(5)

    // Check classifications
    expect(lines[2]).toContain('productive') // task transition
    expect(lines[3]).toContain('idle')
    expect(lines[4]).toContain('productive') // artifact created

    logger.detach(bus)
  })

  it('tsv should be human-readable (tab-separated, no JSON)', () => {
    const content = readFileSync(tsvPath, 'utf-8')
    const lines = content.trim().split('\n')

    for (const line of lines) {
      const cols = line.split('\t')
      expect(cols.length).toBeGreaterThanOrEqual(5) // run_id, loop, classification, tasks_created, tasks_done, completion_rate, reasons, timestamp
      // No JSON objects in any column
      expect(line).not.toContain('{')
      expect(line).not.toContain('}')
    }
  })
})

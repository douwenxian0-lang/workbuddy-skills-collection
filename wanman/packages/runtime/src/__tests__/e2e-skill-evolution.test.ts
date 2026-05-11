/**
 * E2E test: Complete skill evolution loop.
 *
 * Simulates the full pipeline:
 *   1. Multiple agent runs produce run_feedback
 *   2. Metrics aggregation identifies underperformers
 *   3. New skill version created with improvements
 *   4. A/B eval comparison
 *   5. Better version activated
 *
 * Uses real SQLite + mocked BrainManager to test the complete SkillManager lifecycle.
 *
 * Run: pnpm -F @wanman/runtime test e2e-skill-evolution
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'

vi.mock('../logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  }),
}))

import { SkillManager } from '../skill-manager.js'

// In-memory SQL store simulating db9
const tables: { skills: Array<Record<string, unknown>>; run_feedback: Array<Record<string, unknown>> } = {
  skills: [],
  run_feedback: [],
}
let skillIdCounter = 0

function resetDb() {
  tables.skills = []
  tables.run_feedback = []
  skillIdCounter = 0
}

// Simple SQL interpreter for testing
function executeSQL(sql: string): unknown {
  const s = sql.trim()

  // INSERT INTO skills
  if (s.includes('INSERT INTO skills')) {
    const id = ++skillIdCounter
    // Extract values via regex
    const agentMatch = s.match(/VALUES\s*\('([^']+)'/)
    const versionMatch = s.match(/,\s*(\d+)\s*,\s*'/)
    const contentMatch = s.match(/,\s*(\d+)\s*,\s*'([\s\S]*?)'\s*,\s*(true|false)/)
    const createdByMatch = s.match(/,\s*'([^']+)'\s*\)\s*RETURNING/)

    const row: Record<string, unknown> = {
      id,
      agent: agentMatch?.[1] ?? 'unknown',
      version: Number(versionMatch?.[1] ?? 1),
      content: contentMatch?.[2] ?? '',
      is_active: s.includes(', false,') ? false : s.includes(', true,'),
      eval_pass_rate: null,
      created_at: new Date().toISOString(),
      created_by: createdByMatch?.[1] ?? 'human',
    }
    tables.skills.push(row)
    return [row]
  }

  // SELECT MAX(version)
  if (s.includes('MAX(version)')) {
    const agentMatch = s.match(/agent\s*=\s*'([^']+)'/)
    const agent = agentMatch?.[1]
    const versions = tables.skills.filter(r => r.agent === agent).map(r => r.version as number)
    return [{ max_v: versions.length > 0 ? Math.max(...versions) : 0 }]
  }

  // SELECT content FROM skills WHERE agent AND is_active
  if (s.includes('FROM skills') && s.includes('is_active = true')) {
    const agentMatch = s.match(/agent\s*=\s*'([^']+)'/)
    const agent = agentMatch?.[1]
    const rows = tables.skills
      .filter(r => r.agent === agent && r.is_active === true)
      .sort((a, b) => (b.version as number) - (a.version as number))
    return rows.slice(0, 1)
  }

  // SELECT FROM skills WHERE agent ORDER BY version DESC
  if (s.includes('FROM skills') && s.includes('ORDER BY version DESC')) {
    const agentMatch = s.match(/agent\s*=\s*'([^']+)'/)
    const agent = agentMatch?.[1]
    return tables.skills
      .filter(r => r.agent === agent)
      .sort((a, b) => (b.version as number) - (a.version as number))
  }

  // UPDATE skills SET is_active = false
  if (s.includes('UPDATE skills SET is_active = false')) {
    const agentMatch = s.match(/agent\s*=\s*'([^']+)'/)
    const agent = agentMatch?.[1]
    tables.skills.filter(r => r.agent === agent).forEach(r => { r.is_active = false })
    return []
  }

  // UPDATE skills SET is_active = true WHERE version
  if (s.includes('UPDATE skills SET is_active = true')) {
    const agentMatch = s.match(/agent\s*=\s*'([^']+)'/)
    const versionMatch = s.match(/version\s*=\s*(\d+)/)
    const agent = agentMatch?.[1]
    const version = Number(versionMatch?.[1])
    const row = tables.skills.find(r => r.agent === agent && r.version === version)
    if (row) row.is_active = true
    return []
  }

  // UPDATE skills SET eval_pass_rate
  if (s.includes('SET eval_pass_rate')) {
    const rateMatch = s.match(/eval_pass_rate\s*=\s*([\d.]+)/)
    const agentMatch = s.match(/agent\s*=\s*'([^']+)'/)
    const versionMatch = s.match(/version\s*=\s*(\d+)/)
    const row = tables.skills.find(
      r => r.agent === agentMatch?.[1] && r.version === Number(versionMatch?.[1])
    )
    if (row) row.eval_pass_rate = Number(rateMatch?.[1])
    return []
  }

  // SELECT aggregated metrics from run_feedback
  if (s.includes('FROM run_feedback') && s.includes('GROUP BY agent')) {
    const byAgent = new Map<string, Array<Record<string, unknown>>>()
    for (const r of tables.run_feedback) {
      const list = byAgent.get(r.agent as string) || []
      list.push(r)
      byAgent.set(r.agent as string, list)
    }
    return Array.from(byAgent.entries()).map(([agent, rows]) => ({
      agent,
      runs: rows.length,
      success_rate: Math.round(
        (rows.filter(r => r.task_completed).length / rows.length) * 1000
      ) / 10,
      avg_duration_ms: Math.round(
        rows.reduce((sum, r) => sum + (r.duration_ms as number), 0) / rows.length
      ),
      avg_steer_count: Math.round(
        rows.reduce((sum, r) => sum + (r.steer_count as number), 0) / rows.length * 10
      ) / 10,
      intervention_rate: 0,
    }))
  }

  return []
}

const mockBrain = {
  isInitialized: true,
  executeSQL: vi.fn(async (sql: string) => executeSQL(sql)),
}

describe('Skill Evolution Loop E2E', () => {
  let skillManager: SkillManager

  beforeAll(() => {
    resetDb()
    skillManager = new SkillManager(mockBrain as any, '/tmp/nonexistent-skills')
  })

  it('Step 1: seed initial skill versions', async () => {
    // CEO skill v1
    const ceoV1 = await skillManager.createVersion('ceo', '# CEO v1\nBasic orchestration.', 'human')
    expect(ceoV1).not.toBeNull()
    expect(ceoV1!.version).toBe(1)
    await skillManager.activateVersion('ceo', 1)

    // Finance skill v1
    const finV1 = await skillManager.createVersion('finance', '# Finance v1\nBasic budgets.', 'human')
    expect(finV1!.version).toBe(1)
    await skillManager.activateVersion('finance', 1)

    // Dev skill v1
    const devV1 = await skillManager.createVersion('dev', '# Dev v1\nBasic coding.', 'human')
    expect(devV1!.version).toBe(1)
    await skillManager.activateVersion('dev', 1)
  })

  it('Step 2: simulate 10 runs with mixed results', () => {
    // CEO: 9/10 success (good)
    for (let i = 0; i < 10; i++) {
      tables.run_feedback.push({
        agent: 'ceo', task_completed: i < 9, duration_ms: 5000 + i * 100,
        steer_count: 0, human_intervention: false,
      })
    }

    // Finance: 6/10 success (underperforming)
    for (let i = 0; i < 10; i++) {
      tables.run_feedback.push({
        agent: 'finance', task_completed: i < 6, duration_ms: 8000 + i * 200,
        steer_count: i >= 6 ? 2 : 0, human_intervention: i >= 8,
      })
    }

    // Dev: 4/10 success (severely underperforming)
    for (let i = 0; i < 10; i++) {
      tables.run_feedback.push({
        agent: 'dev', task_completed: i < 4, duration_ms: 10000 + i * 300,
        steer_count: i >= 4 ? 3 : 0, human_intervention: i >= 7,
      })
    }

    expect(tables.run_feedback).toHaveLength(30)
  })

  it('Step 3: aggregate metrics and identify underperformers', async () => {
    const metrics = await skillManager.getSkillMetrics()
    expect(metrics).toHaveLength(3)

    const ceoMetrics = metrics.find(m => m.agent === 'ceo')!
    expect(ceoMetrics.successRate).toBe(90)

    const finMetrics = metrics.find(m => m.agent === 'finance')!
    expect(finMetrics.successRate).toBe(60)

    const devMetrics = metrics.find(m => m.agent === 'dev')!
    expect(devMetrics.successRate).toBe(40)

    // Identify underperformers (threshold 80%)
    const underperformers = await skillManager.identifyUnderperformers(80)
    expect(underperformers).toHaveLength(2) // finance + dev
    expect(underperformers.map(u => u.agent).sort()).toEqual(['dev', 'finance'])
  })

  it('Step 4: create improved skill versions for underperformers', async () => {
    // Optimizer creates improved finance skill
    const finV2 = await skillManager.createVersion(
      'finance',
      '# Finance v2\nImproved budgets with MRR calculation and confidence scoring.\n\n## Changes\n- Added explicit confidence thresholds\n- Added escalation rules for anomalies',
      'optimizer',
    )
    expect(finV2!.version).toBe(2)
    expect(finV2!.createdBy).toBe('optimizer')
    expect(finV2!.isActive).toBe(false) // not yet activated

    // Optimizer creates improved dev skill
    const devV2 = await skillManager.createVersion(
      'dev',
      '# Dev v2\nImproved coding with test-first approach.\n\n## Changes\n- Must write tests before implementation\n- Must run typecheck before submitting',
      'optimizer',
    )
    expect(devV2!.version).toBe(2)
  })

  it('Step 5: A/B eval — compare old vs new skill pass rates', async () => {
    // Simulate eval results: v1 vs v2
    // Finance v1: 0.6 pass rate (matches run_feedback)
    await skillManager.updateEvalPassRate('finance', 1, 0.6)
    // Finance v2: 0.85 pass rate (improved)
    await skillManager.updateEvalPassRate('finance', 2, 0.85)

    // Dev v1: 0.4 pass rate
    await skillManager.updateEvalPassRate('dev', 1, 0.4)
    // Dev v2: 0.78 pass rate (improved)
    await skillManager.updateEvalPassRate('dev', 2, 0.78)

    // Verify eval results stored
    const finVersions = await skillManager.getVersions('finance')
    expect(finVersions.find(v => v.version === 1)!.evalPassRate).toBe(0.6)
    expect(finVersions.find(v => v.version === 2)!.evalPassRate).toBe(0.85)
  })

  it('Step 6: activate improved versions (v2 > v1 in eval)', async () => {
    // Finance v2 eval pass rate (0.85) > v1 (0.6) → activate v2
    await skillManager.activateVersion('finance', 2)

    // Dev v2 eval pass rate (0.78) > v1 (0.4) → activate v2
    await skillManager.activateVersion('dev', 2)

    // Verify active versions
    const finContent = await skillManager.resolveSkill('finance')
    expect(finContent).toContain('Finance v2')
    expect(finContent).toContain('confidence thresholds')

    const devContent = await skillManager.resolveSkill('dev')
    expect(devContent).toContain('Dev v2')
    expect(devContent).toContain('test-first')

    // CEO should still be on v1 (no underperformance)
    const ceoContent = await skillManager.resolveSkill('ceo')
    expect(ceoContent).toContain('CEO v1')
  })

  it('Step 7: rollback if needed', async () => {
    // Simulate: dev v2 turns out worse in production → rollback
    const success = await skillManager.rollback('dev')
    expect(success).toBe(true)

    const devContent = await skillManager.resolveSkill('dev')
    expect(devContent).toContain('Dev v1')

    // Version history preserved
    const versions = await skillManager.getVersions('dev')
    expect(versions).toHaveLength(2)
    expect(versions.find(v => v.version === 1)!.isActive).toBe(true)
    expect(versions.find(v => v.version === 2)!.isActive).toBe(false)
  })

  it('Step 8: verify file system fallback when no db9 versions', async () => {
    // For an agent with no db9 skills, should fallback to file
    // Since /tmp/nonexistent-skills doesn't exist, returns null
    const content = await skillManager.resolveSkill('marketing')
    expect(content).toBeNull()
  })

  it('Full cycle summary: underperformer detection was correct', async () => {
    const metrics = await skillManager.getSkillMetrics()

    // CEO: 90% success → NOT underperformer (correct)
    // Finance: 60% success → underperformer → improved to v2 (correct)
    // Dev: 40% success → underperformer → improved to v2, then rolled back (correct)

    expect(metrics.find(m => m.agent === 'ceo')!.successRate).toBeGreaterThanOrEqual(80)
    expect(metrics.find(m => m.agent === 'finance')!.successRate).toBeLessThan(80)
    expect(metrics.find(m => m.agent === 'dev')!.successRate).toBeLessThan(80)
  })
})

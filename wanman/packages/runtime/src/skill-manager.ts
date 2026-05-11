/**
 * SkillManager — dynamic skill version management.
 *
 * Resolves agent skills from db9 (with file system fallback),
 * supports versioning, updates, rollback, and metrics queries.
 *
 * Part of the Skill Evolution pipeline:
 *   run_feedback → metrics → optimizer → skill update → eval → publish
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { BrainManager } from './brain-manager.js'
import { esc } from './sql-escape.js'
import { createLogger } from './logger.js'

const log = createLogger('skill-manager')

export interface SkillVersion {
  id: number
  agent: string
  version: number
  content: string
  isActive: boolean
  evalPassRate: number | null
  createdAt: string
  createdBy: string
}

export interface SkillMetrics {
  agent: string
  runs: number
  successRate: number
  avgDurationMs: number
  avgSteerCount: number
  interventionRate: number
}

export class SkillManager {
  private brainManager: BrainManager | null
  private skillsDir: string

  constructor(brainManager: BrainManager | null, skillsDir: string) {
    this.brainManager = brainManager
    this.skillsDir = skillsDir
  }

  /**
   * Resolve the active skill content for an agent.
   * Priority: db9 active version → local file system → null
   */
  async resolveSkill(agent: string): Promise<string | null> {
    // 1. Try db9 (latest active version)
    if (this.brainManager?.isInitialized) {
      try {
        const result = await this.brainManager.executeSQL(
          `SELECT content FROM skills WHERE agent = '${esc(agent)}' AND is_active = true ORDER BY version DESC LIMIT 1`
        ) as Array<{ content: string }>
        if (result.length > 0) {
          log.info('resolved skill from db9', { agent, source: 'db9' })
          return result[0]!.content
        }
      } catch (err) {
        log.warn('db9 skill resolution failed, falling back to file', { agent, error: String(err) })
      }
    }

    // 2. Fall back to local file system
    const localPath = path.join(this.skillsDir, agent, 'AGENT.md')
    if (fs.existsSync(localPath)) {
      log.info('resolved skill from file', { agent, source: 'file' })
      return fs.readFileSync(localPath, 'utf-8')
    }

    return null
  }

  /** Get all versions of a skill for an agent */
  async getVersions(agent: string): Promise<SkillVersion[]> {
    if (!this.brainManager?.isInitialized) return []
    try {
      const rows = await this.brainManager.executeSQL(
        `SELECT id, agent, version, content, is_active, eval_pass_rate, created_at, created_by FROM skills WHERE agent = '${esc(agent)}' ORDER BY version DESC`
      ) as Array<Record<string, unknown>>
      return rows.map(r => ({
        id: r.id as number,
        agent: r.agent as string,
        version: r.version as number,
        content: r.content as string,
        isActive: r.is_active as boolean,
        evalPassRate: r.eval_pass_rate as number | null,
        createdAt: r.created_at as string,
        createdBy: r.created_by as string,
      }))
    } catch {
      return []
    }
  }

  /** Create a new skill version (does NOT activate it — use activateVersion for that) */
  async createVersion(agent: string, content: string, createdBy: string = 'human'): Promise<SkillVersion | null> {
    if (!this.brainManager?.isInitialized) return null

    // Language policy: warn if content contains significant non-English text.
    // All skills should be written in English for cross-runtime compatibility.
    const cjkRatio = countCJKRatio(content)
    if (cjkRatio > 0.05) {
      log.warn('skill content contains significant non-English text', {
        agent, createdBy, cjkRatio: Math.round(cjkRatio * 100),
        hint: 'Skills should be written in English. See workspace-conventions skill.',
      })
    }

    // Get next version number
    const existing = await this.brainManager.executeSQL(
      `SELECT COALESCE(MAX(version), 0) as max_v FROM skills WHERE agent = '${esc(agent)}'`
    ) as Array<{ max_v: number }>
    const nextVersion = (existing[0]?.max_v ?? 0) + 1

    const result = await this.brainManager.executeSQL(
      `INSERT INTO skills (agent, version, content, is_active, created_by) VALUES ('${esc(agent)}', ${nextVersion}, '${esc(content)}', false, '${esc(createdBy)}') RETURNING id, agent, version, is_active, created_at, created_by`
    ) as Array<Record<string, unknown>>

    if (result.length === 0) return null
    const r = result[0]!
    return {
      id: r.id as number,
      agent: r.agent as string,
      version: r.version as number,
      content,
      isActive: false,
      evalPassRate: null,
      createdAt: r.created_at as string,
      createdBy: r.created_by as string,
    }
  }

  /** Activate a specific version (deactivates all others for that agent) */
  async activateVersion(agent: string, version: number): Promise<boolean> {
    if (!this.brainManager?.isInitialized) return false
    try {
      await this.brainManager.executeSQL(
        `UPDATE skills SET is_active = false WHERE agent = '${esc(agent)}'`
      )
      await this.brainManager.executeSQL(
        `UPDATE skills SET is_active = true WHERE agent = '${esc(agent)}' AND version = ${version}`
      )
      log.info('skill version activated', { agent, version })
      return true
    } catch {
      return false
    }
  }

  /** Rollback to previous version */
  async rollback(agent: string): Promise<boolean> {
    if (!this.brainManager?.isInitialized) return false
    const versions = await this.getVersions(agent)
    if (versions.length < 2) return false

    const currentActive = versions.find(v => v.isActive)
    const previousVersion = versions.find(v => !v.isActive && v.version < (currentActive?.version ?? Infinity))
    if (!previousVersion) return false

    return this.activateVersion(agent, previousVersion.version)
  }

  /**
   * Auto-promote: compare latest inactive version's eval pass rate against
   * the active version. If better, activate it. If worse or insufficient data, keep current.
   *
   * Inspired by autoresearch: "keep improvements, discard regressions"
   */
  async autoPromote(agent: string): Promise<'promoted' | 'kept' | 'insufficient_data'> {
    if (!this.brainManager?.isInitialized) return 'insufficient_data'

    const versions = await this.getVersions(agent)
    if (versions.length < 2) return 'insufficient_data'

    const active = versions.find(v => v.isActive)
    const candidate = versions.find(v => !v.isActive && v.version > (active?.version ?? 0))

    if (!active || !candidate) return 'insufficient_data'
    if (active.evalPassRate === null || candidate.evalPassRate === null) return 'insufficient_data'

    if (candidate.evalPassRate > active.evalPassRate) {
      await this.activateVersion(agent, candidate.version)
      log.info('auto-promoted skill', {
        agent,
        from: `v${active.version} (${active.evalPassRate})`,
        to: `v${candidate.version} (${candidate.evalPassRate})`,
      })
      return 'promoted'
    }

    log.info('auto-promote kept current', {
      agent,
      active: `v${active.version} (${active.evalPassRate})`,
      candidate: `v${candidate.version} (${candidate.evalPassRate})`,
    })
    return 'kept'
  }

  /** Update eval pass rate for a skill version */
  async updateEvalPassRate(agent: string, version: number, passRate: number): Promise<void> {
    if (!this.brainManager?.isInitialized) return
    await this.brainManager.executeSQL(
      `UPDATE skills SET eval_pass_rate = ${passRate} WHERE agent = '${esc(agent)}' AND version = ${version}`
    )
  }

  /** Get aggregated metrics for all agents from run_feedback (last 30 days) */
  async getSkillMetrics(): Promise<SkillMetrics[]> {
    if (!this.brainManager?.isInitialized) return []
    try {
      const rows = await this.brainManager.executeSQL(`
        SELECT agent,
          count(*) as runs,
          round(avg(CASE WHEN task_completed THEN 1 ELSE 0 END) * 100, 1) as success_rate,
          round(avg(duration_ms)) as avg_duration_ms,
          round(avg(steer_count), 1) as avg_steer_count,
          round(avg(CASE WHEN human_intervention THEN 1 ELSE 0 END) * 100, 1) as intervention_rate
        FROM run_feedback
        WHERE created_at > now() - interval '30 days'
        GROUP BY agent
        ORDER BY success_rate ASC
      `) as Array<Record<string, unknown>>
      return rows.map(r => ({
        agent: r.agent as string,
        runs: Number(r.runs),
        successRate: Number(r.success_rate),
        avgDurationMs: Number(r.avg_duration_ms),
        avgSteerCount: Number(r.avg_steer_count),
        interventionRate: Number(r.intervention_rate),
      }))
    } catch {
      return []
    }
  }

  /** Identify underperforming agents (success_rate < threshold) */
  async identifyUnderperformers(threshold = 80): Promise<SkillMetrics[]> {
    const metrics = await this.getSkillMetrics()
    return metrics.filter(m => m.successRate < threshold && m.runs >= 3)
  }
}

/** Return the ratio of CJK characters to total non-whitespace characters (0–1). */
function countCJKRatio(text: string): number {
  const stripped = text.replace(/\s+/g, '')
  if (stripped.length === 0) return 0
  const cjk = stripped.match(/[\u4e00-\u9fff\u3400-\u4dbf\uF900-\uFAFF]/g)
  return (cjk?.length ?? 0) / stripped.length
}

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { BrainManager } from './brain-manager.js'
import { createLogger } from './logger.js'
import { esc } from './sql-escape.js'

const log = createLogger('shared-skill-manager')

/**
 * Resolve the on-disk root for materialized skill-activation snapshots.
 *
 * Resolution order:
 *   1. Explicit `snapshotsRoot` argument (highest priority — tests/host override).
 *   2. `WANMAN_SKILL_SNAPSHOTS_DIR` env var.
 *   3. Sibling of `sharedSkillsDir` (e.g. `<parent>/skill-snapshots` next to
 *      `<parent>/shared-skills`) iff that sibling is writable by the
 *      current process.
 *   4. `${os.tmpdir()}/wanman-skill-snapshots` — always writable, safe for
 *      unprivileged OSS consumers.
 */
function resolveSnapshotsRoot(sharedSkillsDir: string, explicit?: string): string {
  if (explicit) return explicit
  const envOverride = process.env['WANMAN_SKILL_SNAPSHOTS_DIR']
  if (envOverride) return envOverride

  const sibling = path.join(path.dirname(sharedSkillsDir), 'skill-snapshots')
  try {
    fs.mkdirSync(sibling, { recursive: true })
    return sibling
  } catch (err) {
    const fallback = path.join(os.tmpdir(), 'wanman-skill-snapshots')
    log.warn('falling back to tmpdir for skill snapshots', {
      sibling,
      fallback,
      reason: err instanceof Error ? err.message : String(err),
    })
    return fallback
  }
}

export type ActivationScope = 'task' | 'loop' | 'run'
export type SharedSkillSource = 'builtin' | 'db' | 'project' | 'candidate'

export interface ResolvedSharedSkill {
  skillName: string
  version: number
  path: string
  source: SharedSkillSource
}

export interface ActivationSnapshotRecord {
  id: string
  runId: string
  loopNumber?: number
  taskId?: string
  agent: string
  executionProfile?: string
  bundleId?: string
  bundleVersion?: number
  activationScope: ActivationScope
  materializedPath: string
  resolvedSkills: ResolvedSharedSkill[]
}

interface FilesystemSkill {
  name: string
  dir: string
  content: string
}

interface SharedSkillVersionRow {
  version: number
  content: string
  status: string
}

export class SharedSkillManager {
  private brainManager: BrainManager | null
  private sharedSkillsDir: string
  private snapshotsRoot: string

  constructor(brainManager: BrainManager | null, sharedSkillsDir: string, snapshotsRoot?: string) {
    this.brainManager = brainManager
    this.sharedSkillsDir = sharedSkillsDir
    this.snapshotsRoot = resolveSnapshotsRoot(sharedSkillsDir, snapshotsRoot)
  }

  listFilesystemSkills(): FilesystemSkill[] {
    if (!fs.existsSync(this.sharedSkillsDir)) {
      return []
    }

    const skills: FilesystemSkill[] = []
    for (const entry of fs.readdirSync(this.sharedSkillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const dir = path.join(this.sharedSkillsDir, entry.name)
      const skillPath = path.join(dir, 'SKILL.md')
      if (!fs.existsSync(skillPath)) continue
      skills.push({
        name: entry.name,
        dir,
        content: fs.readFileSync(skillPath, 'utf-8'),
      })
    }

    return skills.sort((left, right) => left.name.localeCompare(right.name))
  }

  async syncFilesystemSkills(): Promise<void> {
    if (!this.brainManager?.isInitialized) return

    for (const skill of this.listFilesystemSkills()) {
      await this.brainManager.executeSQL(`
        INSERT INTO shared_skills (name, title, category, owner, description, stability)
        VALUES (
          '${esc(skill.name)}',
          '${esc(skill.name)}',
          'process',
          'human',
          'Imported from WANMAN_SHARED_SKILLS',
          'stable'
        )
        ON CONFLICT (name) DO NOTHING
      `)

      const versions = await this.readSkillVersions(skill.name)
      const matchingVersion = versions.find(version => version.content === skill.content)

      if (matchingVersion) {
        if (matchingVersion.status !== 'active') {
          await this.brainManager.executeSQL(
            `UPDATE shared_skill_versions SET status = 'deprecated' WHERE skill_name = '${esc(skill.name)}' AND status = 'active'`
          )
          await this.brainManager.executeSQL(
            `UPDATE shared_skill_versions SET status = 'active' WHERE skill_name = '${esc(skill.name)}' AND version = ${matchingVersion.version}`
          )
        }
        continue
      }

      const nextVersion = (versions[0]?.version ?? 0) + 1
      await this.brainManager.executeSQL(
        `UPDATE shared_skill_versions SET status = 'deprecated' WHERE skill_name = '${esc(skill.name)}' AND status = 'active'`
      )
      await this.brainManager.executeSQL(`
        INSERT INTO shared_skill_versions (
          skill_name,
          version,
          content,
          status,
          created_by,
          change_summary
        ) VALUES (
          '${esc(skill.name)}',
          ${nextVersion},
          '${esc(skill.content)}',
          'active',
          'system',
          'Imported from filesystem baseline'
        )
      `)
    }
  }

  verifyActivationInfrastructure(): void {
    fs.mkdirSync(this.snapshotsRoot, { recursive: true })

    const sampleSkill = this.listFilesystemSkills()[0]
    if (!sampleSkill) {
      return
    }

    const probeRoot = path.join(this.snapshotsRoot, `.probe-${randomUUID()}`)
    try {
      fs.mkdirSync(probeRoot, { recursive: true })
      fs.cpSync(sampleSkill.dir, path.join(probeRoot, sampleSkill.name), { recursive: true })
    } finally {
      fs.rmSync(probeRoot, { recursive: true, force: true })
    }
  }

  async createActivationSnapshot(input: {
    runId: string
    loopNumber?: number
    taskId?: string
    agent: string
    executionProfile?: string
    bundleId?: string
    bundleVersion?: number
    activationScope: ActivationScope
    activatedBy?: 'human' | 'ceo' | 'optimizer' | 'system'
  }): Promise<ActivationSnapshotRecord | null> {
    const skills = this.listFilesystemSkills()
    if (skills.length === 0) {
      return null
    }

    await this.syncFilesystemSkills()

    const id = `snapshot-${randomUUID()}`
    const materializedPath = path.join(this.snapshotsRoot, id)
    fs.mkdirSync(materializedPath, { recursive: true })

    const resolvedSkills: ResolvedSharedSkill[] = []
    for (const skill of skills) {
      const skillDir = path.join(materializedPath, skill.name)
      fs.cpSync(skill.dir, skillDir, { recursive: true })
      resolvedSkills.push({
        skillName: skill.name,
        version: await this.resolveSkillVersion(skill.name, skill.content),
        path: path.join(skillDir, 'SKILL.md'),
        source: 'builtin',
      })
    }

    if (this.brainManager?.isInitialized) {
      await this.brainManager.executeSQL(`
        INSERT INTO skill_activation_snapshots (
          id,
          run_id,
          loop_number,
          task_id,
          agent,
          execution_profile,
          bundle_id,
          bundle_version,
          activation_scope,
          resolved_skills,
          materialized_path,
          activated_by
        ) VALUES (
          '${esc(id)}',
          '${esc(input.runId)}',
          ${input.loopNumber ?? 'NULL'},
          ${sqlTextOrNull(input.taskId)},
          '${esc(input.agent)}',
          ${sqlTextOrNull(input.executionProfile)},
          ${sqlTextOrNull(input.bundleId)},
          ${input.bundleVersion ?? 'NULL'},
          '${input.activationScope}',
          '${esc(JSON.stringify(resolvedSkills))}'::jsonb,
          '${esc(materializedPath)}',
          '${input.activatedBy ?? 'system'}'
        )
      `)
    }

    log.info('materialized activation snapshot', {
      agent: input.agent,
      snapshotId: id,
      activationScope: input.activationScope,
      taskId: input.taskId,
      executionProfile: input.executionProfile,
      skillCount: resolvedSkills.length,
    })

    return {
      id,
      runId: input.runId,
      loopNumber: input.loopNumber,
      taskId: input.taskId,
      agent: input.agent,
      executionProfile: input.executionProfile,
      bundleId: input.bundleId,
      bundleVersion: input.bundleVersion,
      activationScope: input.activationScope,
      materializedPath,
      resolvedSkills,
    }
  }

  cleanupSnapshots(snapshots: Iterable<ActivationSnapshotRecord>): void {
    for (const snapshot of snapshots) {
      fs.rmSync(snapshot.materializedPath, { recursive: true, force: true })
    }
  }

  private async readSkillVersions(skillName: string): Promise<SharedSkillVersionRow[]> {
    if (!this.brainManager?.isInitialized) return []
    const rows = await this.brainManager.executeSQL(
      `SELECT version, content, status FROM shared_skill_versions WHERE skill_name = '${esc(skillName)}' ORDER BY version DESC`
    ) as Array<Record<string, unknown>>
    return rows.map(row => ({
      version: Number(row.version),
      content: String(row.content ?? ''),
      status: String(row.status ?? ''),
    }))
  }

  private async resolveSkillVersion(skillName: string, content: string): Promise<number> {
    const versions = await this.readSkillVersions(skillName)
    return versions.find(version => version.content === content)?.version ?? 1
  }
}

function sqlTextOrNull(value: string | undefined): string {
  return value ? `'${esc(value)}'` : 'NULL'
}

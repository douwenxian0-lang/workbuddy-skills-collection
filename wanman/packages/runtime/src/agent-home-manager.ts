import fs from 'node:fs'
import path from 'node:path'
import type { ActivationSnapshotRecord } from './shared-skill-manager.js'
import { createLogger } from './logger.js'

const log = createLogger('agent-home-manager')
const DEFAULT_HOME_ENTRIES = [
  '.config',
  '.gitconfig',
  '.git-credentials',
  '.ssh',
  '.npmrc',
  '.aws',
  '.docker',
  '.kube',
] as const

export class AgentHomeManager {
  private baseHome: string
  private homesRoot: string

  constructor(baseHome: string, homesRoot: string) {
    this.baseHome = baseHome
    this.homesRoot = homesRoot
  }

  prepareAgentHome(agentName: string, snapshot?: ActivationSnapshotRecord | null): string {
    const agentHome = path.join(this.homesRoot, agentName)
    fs.mkdirSync(agentHome, { recursive: true })

    for (const entry of DEFAULT_HOME_ENTRIES) {
      this.syncHomeEntry(path.join(this.baseHome, entry), path.join(agentHome, entry))
    }

    const skillSource = snapshot
      ? snapshot.materializedPath
      : this.ensureEmptySkillsDir(agentHome)

    for (const runtimeDir of ['.claude', '.codex']) {
      const sourceRoot = path.join(this.baseHome, runtimeDir)
      const targetRoot = path.join(agentHome, runtimeDir)
      fs.mkdirSync(targetRoot, { recursive: true })
      this.syncRuntimeHome(sourceRoot, targetRoot)
      this.linkSkillsDir(path.join(targetRoot, 'skills'), skillSource)
    }

    log.info('prepared isolated agent home', {
      agent: agentName,
      home: agentHome,
      snapshotId: snapshot?.id,
      skillsPath: skillSource,
    })

    return agentHome
  }

  cleanupHomes(): void {
    fs.rmSync(this.homesRoot, { recursive: true, force: true })
  }

  private syncRuntimeHome(sourceRoot: string, targetRoot: string): void {
    if (!fs.existsSync(sourceRoot)) {
      return
    }

    for (const entry of fs.readdirSync(sourceRoot)) {
      if (entry === 'skills') continue
      this.syncHomeEntry(path.join(sourceRoot, entry), path.join(targetRoot, entry))
    }
  }

  private syncHomeEntry(source: string, target: string): void {
    if (!fs.existsSync(source)) return
    fs.rmSync(target, { recursive: true, force: true })
    const stat = fs.statSync(source)
    fs.symlinkSync(source, target, stat.isDirectory() ? 'dir' : 'file')
  }

  private linkSkillsDir(target: string, source: string): void {
    fs.rmSync(target, { recursive: true, force: true })
    fs.symlinkSync(source, target, 'dir')
  }

  private ensureEmptySkillsDir(agentHome: string): string {
    const emptySkillsDir = path.join(agentHome, '.wanman', 'empty-skills')
    fs.mkdirSync(emptySkillsDir, { recursive: true })
    return emptySkillsDir
  }
}

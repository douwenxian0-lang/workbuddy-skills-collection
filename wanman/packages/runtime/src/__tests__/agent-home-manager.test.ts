import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AgentHomeManager } from '../agent-home-manager.js'

const tempRoots: string[] = []

describe('AgentHomeManager', () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('mounts active snapshot skills into isolated claude and codex homes', () => {
    const { baseHome, homesRoot, snapshotPath } = createFixture()
    const manager = new AgentHomeManager(baseHome, homesRoot)

    const agentHome = manager.prepareAgentHome('ceo', {
      id: 'snapshot-1',
      runId: 'run-1',
      agent: 'ceo',
      activationScope: 'task',
      materializedPath: snapshotPath,
      resolvedSkills: [],
    })

    expect(fs.readlinkSync(path.join(agentHome, '.claude', 'skills'))).toBe(snapshotPath)
    expect(fs.readlinkSync(path.join(agentHome, '.codex', 'skills'))).toBe(snapshotPath)
    expect(fs.readlinkSync(path.join(agentHome, '.claude', '.credentials.json'))).toBe(path.join(baseHome, '.claude', '.credentials.json'))
    expect(fs.readlinkSync(path.join(agentHome, '.config'))).toBe(path.join(baseHome, '.config'))
    expect(fs.readlinkSync(path.join(agentHome, '.npmrc'))).toBe(path.join(baseHome, '.npmrc'))
    expect(fs.readlinkSync(path.join(agentHome, '.aws'))).toBe(path.join(baseHome, '.aws'))
  })

  it('creates an empty skills mount when no snapshot is active', () => {
    const { baseHome, homesRoot } = createFixture()
    const manager = new AgentHomeManager(baseHome, homesRoot)

    const agentHome = manager.prepareAgentHome('marketing')
    const claudeSkills = path.join(agentHome, '.claude', 'skills')

    expect(fs.lstatSync(claudeSkills).isSymbolicLink()).toBe(true)
    expect(fs.readdirSync(claudeSkills)).toHaveLength(0)
  })

  it('cleans up all prepared homes', () => {
    const { baseHome, homesRoot } = createFixture()
    const manager = new AgentHomeManager(baseHome, homesRoot)

    manager.prepareAgentHome('ops')
    expect(fs.existsSync(homesRoot)).toBe(true)

    manager.cleanupHomes()
    expect(fs.existsSync(homesRoot)).toBe(false)
  })
})

function createFixture(): { baseHome: string; homesRoot: string; snapshotPath: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wanman-agent-home-'))
  tempRoots.push(root)

  const baseHome = path.join(root, 'base-home')
  const homesRoot = path.join(root, 'homes')
  const snapshotPath = path.join(root, 'snapshot')

  fs.mkdirSync(path.join(baseHome, '.claude'), { recursive: true })
  fs.mkdirSync(path.join(baseHome, '.codex'), { recursive: true })
  fs.mkdirSync(path.join(baseHome, '.config'), { recursive: true })
  fs.mkdirSync(path.join(baseHome, '.aws'), { recursive: true })
  fs.writeFileSync(path.join(baseHome, '.claude', '.credentials.json'), '{}')
  fs.writeFileSync(path.join(baseHome, '.codex', 'config.json'), '{}')
  fs.writeFileSync(path.join(baseHome, '.npmrc'), 'registry=https://registry.npmjs.org')

  fs.mkdirSync(path.join(snapshotPath, 'research'), { recursive: true })
  fs.writeFileSync(path.join(snapshotPath, 'research', 'SKILL.md'), '# Research')

  return { baseHome, homesRoot, snapshotPath }
}

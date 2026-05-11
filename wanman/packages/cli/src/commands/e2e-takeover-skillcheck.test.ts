/**
 * E2E test: takeover scanner on real projects + skill:check on real skills.
 *
 * Uses the wanman.dev monorepo itself as the test subject — no mocks.
 * Run: pnpm -F @wanman/cli test e2e-takeover-skillcheck
 */

import { describe, it, expect } from 'vitest'
import * as path from 'node:path'
import { scanProject, generateAgentConfig, inferGoal } from './takeover.js'
import { checkAllSkills, checkSkill } from './skill-check.js'

const PROJECT_ROOT = path.resolve(__dirname, '../../../..')
const SKILLS_DIR = path.join(PROJECT_ROOT, 'packages', 'core', 'skills')

describe('takeover scanner E2E — wanman.dev itself', () => {
  it('should detect TypeScript + JavaScript', () => {
    const profile = scanProject(PROJECT_ROOT)
    expect(profile.languages).toContain('typescript')
    expect(profile.languages).toContain('javascript')
  })

  it('should detect pnpm as package manager', () => {
    const profile = scanProject(PROJECT_ROOT)
    expect(profile.packageManagers).toContain('pnpm')
  })

  it('should detect vitest as test framework', () => {
    const profile = scanProject(PROJECT_ROOT)
    expect(profile.testFrameworks).toContain('vitest')
  })

  it('should report docs detection as a boolean', () => {
    const profile = scanProject(PROJECT_ROOT)
    expect(typeof profile.hasDocs).toBe('boolean')
  })

  it('should detect README', () => {
    const profile = scanProject(PROJECT_ROOT)
    expect(profile.hasReadme).toBe(true)
  })

  it('should detect GitHub as issue tracker (if remote exists)', () => {
    const profile = scanProject(PROJECT_ROOT)
    // This is a real git repo — should have a remote
    if (profile.githubRemote) {
      expect(profile.issueTracker).toBe('github')
      expect(profile.githubRemote).toContain('github.com')
    }
  })

  it('should generate reasonable agent config', () => {
    const profile = scanProject(PROJECT_ROOT)
    const config = generateAgentConfig(profile)

    // CEO and dev should always be enabled
    const enabled = config.agents.filter(a => a.enabled).map(a => a.name)
    expect(enabled).toContain('ceo')
    expect(enabled).toContain('dev')

    // Should have a non-empty goal
    expect(config.goal.length).toBeGreaterThan(10)
  })

  it('should infer a goal mentioning TypeScript', () => {
    const profile = scanProject(PROJECT_ROOT)
    const goal = inferGoal(profile)
    expect(goal).toContain('typescript')
  })

  it('should produce a complete profile with all fields', () => {
    const profile = scanProject(PROJECT_ROOT)
    expect(profile.path).toBe(path.resolve(PROJECT_ROOT))
    expect(Array.isArray(profile.languages)).toBe(true)
    expect(Array.isArray(profile.packageManagers)).toBe(true)
    expect(Array.isArray(profile.frameworks)).toBe(true)
    expect(Array.isArray(profile.ci)).toBe(true)
    expect(Array.isArray(profile.testFrameworks)).toBe(true)
    expect(typeof profile.hasReadme).toBe('boolean')
    expect(typeof profile.hasClaudeMd).toBe('boolean')
    expect(typeof profile.hasDocs).toBe('boolean')
    expect(['github', 'none']).toContain(profile.issueTracker)
  })
})

describe('skill:check E2E — real skills directory', () => {
  it('should find all bundled skills', () => {
    // wanman.dev ships 6 generic skills (financial-analysis was SaaS-specific
    // and removed in the OSS split). Keep this in sync with the directory
    // contents under packages/core/skills/.
    const results = checkAllSkills(SKILLS_DIR)
    expect(results.length).toBe(6)
  })

  it('should pass validation for all skills', () => {
    const results = checkAllSkills(SKILLS_DIR)
    const failed = results.filter(r => !r.valid)
    if (failed.length > 0) {
      console.log('Failed skills:', failed.map(f => `${f.skillName}: ${f.invalidCommands.join(', ')}`))
    }
    expect(failed).toHaveLength(0)
  })

  it('should find commands in wanman-cli skill', () => {
    const result = checkSkill(path.join(SKILLS_DIR, 'wanman-cli', 'SKILL.md'))
    expect(result.referencedCommands.length).toBeGreaterThan(10)
    expect(result.referencedCommands).toContain('recv')
    expect(result.referencedCommands).toContain('send')
    expect(result.referencedCommands).toContain('task create')
    expect(result.referencedCommands).toContain('artifact put')
  })

  it('should find commands in cross-validation skill', () => {
    const result = checkSkill(path.join(SKILLS_DIR, 'cross-validation', 'SKILL.md'))
    expect(result.valid).toBe(true)
    expect(result.referencedCommands.length).toBeGreaterThan(0)
  })

  it('each skill should have a name matching its directory', () => {
    const results = checkAllSkills(SKILLS_DIR)
    for (const r of results) {
      expect(r.skillName).toBeTruthy()
      expect(r.filePath).toContain(r.skillName)
    }
  })
})

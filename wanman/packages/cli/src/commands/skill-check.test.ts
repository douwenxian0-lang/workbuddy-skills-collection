import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  extractCommands,
  validateCommand,
  checkSkill,
  checkAllSkills,
  formatDashboard,
  KNOWN_COMMANDS,
  KNOWN_SUBCOMMANDS,
} from './skill-check.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = join(tmpdir(), `skill-check-test-${Date.now()}`)
  mkdirSync(tmpDir, { recursive: true })
})

afterEach(() => {
  try { rmSync(tmpDir, { recursive: true }) } catch { /* ignore */ }
})

function createSkill(name: string, content: string): string {
  const dir = join(tmpDir, name)
  mkdirSync(dir, { recursive: true })
  const filePath = join(dir, 'SKILL.md')
  writeFileSync(filePath, content)
  return filePath
}

describe('extractCommands', () => {
  it('should extract simple commands', () => {
    const cmds = extractCommands('Run `wanman recv` to get messages.')
    expect(cmds).toContain('recv')
  })

  it('should extract commands with subcommands', () => {
    const cmds = extractCommands('Use `wanman task create` to add tasks.')
    expect(cmds).toContain('task create')
  })

  it('should deduplicate', () => {
    const cmds = extractCommands('wanman recv\nwanman recv\nwanman recv')
    expect(cmds).toEqual(['recv'])
  })

  it('should extract multiple different commands', () => {
    const cmds = extractCommands('wanman send ceo "hi"\nwanman task list\nwanman artifact put')
    expect(cmds).toContain('send')
    expect(cmds).toContain('task list')
    expect(cmds).toContain('artifact put')
  })

  it('should return empty for content without commands', () => {
    expect(extractCommands('No commands here.')).toEqual([])
  })

  it('should handle multiline skill content', () => {
    const content = `# My Skill

1. Run \`wanman recv\`
2. Then \`wanman task list\`
3. Finally \`wanman send ceo "done"\`
`
    const cmds = extractCommands(content)
    expect(cmds).toContain('recv')
    expect(cmds).toContain('task list')
    expect(cmds).toContain('send')
  })
})

describe('validateCommand', () => {
  it('should validate known top-level commands', () => {
    for (const cmd of KNOWN_COMMANDS) {
      expect(validateCommand(cmd)).toBe(true)
    }
  })

  it('should validate known subcommands', () => {
    expect(validateCommand('task create')).toBe(true)
    expect(validateCommand('task list')).toBe(true)
    expect(validateCommand('initiative create')).toBe(true)
    expect(validateCommand('capsule mine')).toBe(true)
    expect(validateCommand('artifact put')).toBe(true)
    expect(validateCommand('hypothesis update')).toBe(true)
  })

  it('should reject unknown commands', () => {
    expect(validateCommand('nonexistent')).toBe(false)
  })

  it('should reject unknown subcommands', () => {
    expect(validateCommand('task nonexistent')).toBe(false)
  })

  it('should accept top-level command without subcommand even if subcommands exist', () => {
    // "wanman task" alone is valid (delegates to task help)
    expect(validateCommand('task')).toBe(true)
  })
})

describe('checkSkill', () => {
  it('should validate a skill with correct commands', () => {
    const filePath = createSkill('wanman-cli', `
# CLI Skill
\`wanman recv\` — get messages
\`wanman task list\` — list tasks
\`wanman artifact put\` — store data
`)
    const result = checkSkill(filePath)
    expect(result.skillName).toBe('wanman-cli')
    expect(result.valid).toBe(true)
    expect(result.invalidCommands).toEqual([])
    expect(result.referencedCommands.length).toBeGreaterThan(0)
  })

  it('should detect invalid commands', () => {
    const filePath = createSkill('bad-skill', `
\`wanman fakecommand\` — does not exist
\`wanman recv\` — valid
`)
    const result = checkSkill(filePath)
    expect(result.valid).toBe(false)
    expect(result.invalidCommands).toContain('fakecommand')
  })

  it('should warn when no commands referenced', () => {
    const filePath = createSkill('no-cmds', `
# A skill about general concepts
No CLI commands here.
`)
    const result = checkSkill(filePath)
    expect(result.valid).toBe(true) // No invalid = valid
    expect(result.warnings).toContain('No wanman CLI commands referenced')
  })
})

describe('checkAllSkills', () => {
  it('should check multiple skills', () => {
    createSkill('skill-a', '`wanman recv` works')
    createSkill('skill-b', '`wanman send ceo "hi"` works')

    const results = checkAllSkills(tmpDir)
    expect(results).toHaveLength(2)
    expect(results.every(r => r.valid)).toBe(true)
  })

  it('should return empty for nonexistent directory', () => {
    expect(checkAllSkills('/nonexistent')).toEqual([])
  })

  it('should skip directories without SKILL.md', () => {
    mkdirSync(join(tmpDir, 'empty-dir'), { recursive: true })
    createSkill('real-skill', '`wanman recv`')

    const results = checkAllSkills(tmpDir)
    expect(results).toHaveLength(1)
    const [result] = results
    expect(result?.skillName).toBe('real-skill')
  })
})

describe('formatDashboard', () => {
  it('should format passing results', () => {
    const results = [
      { skillName: 'my-skill', filePath: '/tmp/x', referencedCommands: ['recv'], invalidCommands: [], warnings: [], valid: true },
    ]
    const output = formatDashboard(results)
    expect(output).toContain('✅')
    expect(output).toContain('my-skill')
    expect(output).toContain('1 passed')
    expect(output).toContain('0 failed')
  })

  it('should format failing results', () => {
    const results = [
      { skillName: 'bad-skill', filePath: '/tmp/x', referencedCommands: ['fake'], invalidCommands: ['fake'], warnings: [], valid: false },
    ]
    const output = formatDashboard(results)
    expect(output).toContain('❌')
    expect(output).toContain('fake')
    expect(output).toContain('1 failed')
  })

  it('should show warnings', () => {
    const results = [
      { skillName: 'warn-skill', filePath: '/tmp/x', referencedCommands: [], invalidCommands: [], warnings: ['No commands'], valid: true },
    ]
    const output = formatDashboard(results)
    expect(output).toContain('⚠')
    expect(output).toContain('No commands')
  })
})

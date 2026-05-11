/**
 * `wanman skill:check` — Static validation of SKILL.md files.
 *
 * Tier 1 (free): Validates that SKILL.md files reference real wanman CLI commands.
 * gstack-inspired tiered testing approach.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

/** Known wanman CLI commands (top-level) */
export const KNOWN_COMMANDS = new Set([
  'send', 'recv', 'agents', 'context', 'escalate',
  'task', 'initiative', 'capsule', 'artifact', 'hypothesis', 'run', 'takeover',
])

/** Known subcommands per top-level command */
export const KNOWN_SUBCOMMANDS: Record<string, Set<string>> = {
  task: new Set(['create', 'list', 'get', 'update', 'done']),
  initiative: new Set(['create', 'list', 'get', 'update']),
  capsule: new Set(['create', 'list', 'mine', 'get', 'update']),
  artifact: new Set(['put', 'list', 'get']),
  hypothesis: new Set(['create', 'list', 'update']),
  context: new Set(['get', 'set']),
}

export interface SkillCheckResult {
  skillName: string
  filePath: string
  /** CLI commands referenced in the skill */
  referencedCommands: string[]
  /** Commands that don't exist */
  invalidCommands: string[]
  /** Warnings (non-fatal) */
  warnings: string[]
  /** Overall pass/fail */
  valid: boolean
}

/** Extract wanman CLI commands referenced in a SKILL.md file */
export function extractCommands(content: string): string[] {
  const commands: string[] = []
  // Match wanman commands that appear in code contexts (backticks, code blocks, or after pipe/semicolon)
  // Only match lowercase command names to avoid false positives like "wanman CLI" or "wanman Agent Matrix"
  const regex = /wanman\s+([a-z][\w:]+)(?:\s+([a-z]\w+))?/g
  let match
  while ((match = regex.exec(content)) !== null) {
    const cmd = match[1]!
    const sub = match[2]
    if (sub && KNOWN_SUBCOMMANDS[cmd]?.has(sub)) {
      commands.push(`${cmd} ${sub}`)
    } else {
      commands.push(cmd)
    }
  }
  // Deduplicate
  return [...new Set(commands)]
}

/** Validate a single command reference */
export function validateCommand(cmd: string): boolean {
  const parts = cmd.split(' ')
  const topLevel = parts[0]!
  if (!KNOWN_COMMANDS.has(topLevel)) return false
  if (parts.length > 1) {
    const sub = parts[1]!
    if (KNOWN_SUBCOMMANDS[topLevel] && !KNOWN_SUBCOMMANDS[topLevel]!.has(sub)) return false
  }
  return true
}

/** Check a single SKILL.md file */
export function checkSkill(filePath: string): SkillCheckResult {
  const content = fs.readFileSync(filePath, 'utf-8')
  const skillName = path.basename(path.dirname(filePath))
  const referencedCommands = extractCommands(content)
  const invalidCommands = referencedCommands.filter(cmd => !validateCommand(cmd))
  const warnings: string[] = []

  if (referencedCommands.length === 0) {
    warnings.push('No wanman CLI commands referenced')
  }

  return {
    skillName,
    filePath,
    referencedCommands,
    invalidCommands,
    warnings,
    valid: invalidCommands.length === 0,
  }
}

/** Check all SKILL.md files in a directory */
export function checkAllSkills(skillsDir: string): SkillCheckResult[] {
  const results: SkillCheckResult[] = []

  if (!fs.existsSync(skillsDir)) return results

  for (const entry of fs.readdirSync(skillsDir)) {
    const skillPath = path.join(skillsDir, entry, 'SKILL.md')
    if (fs.existsSync(skillPath)) {
      results.push(checkSkill(skillPath))
    }
  }

  return results
}

/** Format results as a health dashboard */
export function formatDashboard(results: SkillCheckResult[]): string {
  const lines: string[] = []
  lines.push('wanman skill:check — Skill Health Dashboard')
  lines.push('═'.repeat(50))

  let passed = 0
  let failed = 0

  for (const r of results) {
    const status = r.valid ? '✅' : '❌'
    lines.push(`${status} ${r.skillName}`)
    lines.push(`   Commands: ${r.referencedCommands.length} referenced`)
    if (r.invalidCommands.length > 0) {
      lines.push(`   Invalid:  ${r.invalidCommands.join(', ')}`)
      failed++
    } else {
      passed++
    }
    for (const w of r.warnings) {
      lines.push(`   ⚠ ${w}`)
    }
  }

  lines.push('─'.repeat(50))
  lines.push(`Total: ${results.length} skills, ${passed} passed, ${failed} failed`)

  return lines.join('\n')
}

export async function skillCheckCommand(args: string[]): Promise<void> {
  const skillsDir = args[0] || path.join(process.cwd(), 'packages', 'core', 'skills')

  if (!fs.existsSync(skillsDir)) {
    console.error(`Skills directory not found: ${skillsDir}`)
    process.exit(1)
  }

  const results = checkAllSkills(skillsDir)
  console.log(formatDashboard(results))

  const hasFailures = results.some(r => !r.valid)
  if (hasFailures) process.exit(1)
}

/**
 * TUI Dashboard — renders live agent/task/log state to the terminal.
 *
 * Uses `log-update` for in-place refresh and `chalk` for color.
 * Designed for the `wanman run` dashboard loop.
 */

import type { RuntimeArtifact } from '../runtime-client.js'
import logUpdate from 'log-update'
import chalk from 'chalk'

// ── Types ──

export interface DashboardState {
  goal: string
  loop: number
  maxLoops: number
  /** Elapsed milliseconds since run started */
  elapsed: number
  brainName?: string
  agents: { name: string; state: string; lifecycle: string }[]
  tasks: { id: string; title: string; status: string; assignee?: string; priority: number; result?: string }[]
  logs: string[]
  artifacts: RuntimeArtifact[]
}

// ── Helpers ──

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}m${String(s).padStart(2, '0')}s`
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

const STATUS_ICON: Record<string, string> = {
  running: chalk.green('●'),
  idle: chalk.gray('○'),
  exited: chalk.yellow('◆'),
  error: chalk.red('✖'),
  spawning: chalk.cyan('◎'),
}

const TASK_ICON: Record<string, string> = {
  done: chalk.green('✓'),
  in_progress: chalk.yellow('⚡'),
  review: chalk.blue('◉'),
  assigned: chalk.cyan('▶'),
  pending: chalk.gray('…'),
  failed: chalk.red('✖'),
}

function agentIcon(state: string): string {
  return STATUS_ICON[state] ?? chalk.gray('?')
}

function taskIcon(status: string): string {
  return TASK_ICON[status] ?? chalk.gray('?')
}

function formatLogLine(raw: string, maxLen: number): string {
  try {
    const obj = JSON.parse(raw)
    const ts = obj.ts ? new Date(obj.ts).toLocaleTimeString('en-GB', { hour12: false }) : ''
    const scope = obj.scope || ''
    const msg = obj.msg || ''
    // Pick a few interesting extra fields
    const extras: string[] = []
    if (obj.agent) extras.push(obj.agent)
    if (obj.tool) extras.push(`tool:${obj.tool}`)
    if (obj.task) extras.push(`task:${obj.task}`)
    const extra = extras.length ? chalk.dim(` (${extras.join(', ')})`) : ''
    const formatted = `${chalk.dim(ts)} ${chalk.cyan(scope.padEnd(14))} ${chalk.white(msg)}${extra}`
    return truncate(formatted, maxLen + 40) // extra room for ANSI codes
  } catch {
    return chalk.gray(truncate(raw, maxLen))
  }
}

// ── Render ──

export function formatDashboard(state: DashboardState): string {
  const { goal, loop, maxLoops, elapsed, brainName, agents, tasks, logs, artifacts } = state
  const w = Math.min(process.stdout.columns || 80, 100)
  const hr = chalk.gray('─'.repeat(w))

  const lines: string[] = []

  // Header (leading blank line as buffer for log-update cursor positioning)
  lines.push('')
  lines.push(hr)
  lines.push(
    chalk.bold('  wanman run')
    + chalk.gray(' — ')
    + chalk.cyan(truncate(goal, w - 20)),
  )
  lines.push(
    chalk.gray('  ⏱ ')
    + formatElapsed(elapsed)
    + chalk.gray(' │ Loop ')
    + chalk.white(`${loop}/${maxLoops}`)
    + (brainName ? chalk.gray(' │ Brain: ') + chalk.dim(brainName) : ''),
  )
  lines.push(hr)

  // Agents
  lines.push(chalk.bold('  Agents'))
  if (agents.length === 0) {
    lines.push(chalk.gray('    (waiting for health...)'))
  } else {
    for (const a of agents) {
      lines.push(
        `    ${agentIcon(a.state)} ${chalk.white(a.name.padEnd(12))} ${chalk.dim(a.state)}`,
      )
    }
  }
  lines.push('')

  // Tasks
  lines.push(chalk.bold('  Tasks'))
  if (tasks.length === 0) {
    lines.push(chalk.gray('    (no tasks yet)'))
  } else {
    // Sort: active first, then waiting, then done
    const order: Record<string, number> = { in_progress: 0, review: 1, assigned: 2, pending: 3, failed: 4, done: 5 }
    const sorted = [...tasks].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9))
    for (const t of sorted) {
      const icon = taskIcon(t.status)
      const assignee = t.assignee ? chalk.dim(`→ ${t.assignee}`) : ''
      const pri = chalk.dim(`P${t.priority}`)
      const title = truncate(t.title, w - 30)
      lines.push(`    ${icon} ${pri} ${chalk.white(title)} ${assignee}`)
    }
    // Summary
    const done = tasks.filter(t => t.status === 'done').length
    const active = tasks.filter(t => ['in_progress', 'review'].includes(t.status)).length
    const waiting = tasks.filter(t => ['pending', 'assigned'].includes(t.status)).length
    lines.push(
      chalk.gray(`    ── ${done} done, ${active} active, ${waiting} waiting ──`),
    )
  }
  lines.push('')

  // Logs
  lines.push(chalk.bold('  Logs'))
  if (logs.length === 0) {
    lines.push(chalk.gray('    (no logs yet)'))
  } else {
    for (const raw of logs.slice(-10)) {
      lines.push('    ' + formatLogLine(raw, w - 6))
    }
  }
  lines.push('')

  // Artifacts
  if (artifacts.length > 0) {
    lines.push(chalk.bold('  Artifacts'))
    for (const a of artifacts) {
      lines.push(
        `    ${chalk.dim(a.agent.padEnd(12))} ${chalk.white(a.kind.padEnd(20))} ${chalk.yellow('×' + a.cnt)}`,
      )
    }
    lines.push('')
  }

  lines.push(hr)
  lines.push(chalk.dim('  Ctrl+C to stop'))

  return lines.join('\n')
}

export function renderDashboard(state: DashboardState): void {
  logUpdate(formatDashboard(state))
}

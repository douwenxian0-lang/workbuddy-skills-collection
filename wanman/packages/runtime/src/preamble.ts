/**
 * Preamble generator — builds context summaries injected into agent prompts
 * when they are (re)spawned.
 *
 * Solves: agent loses context on respawn (gstack session-awareness pattern).
 */

import type { Task } from './task-pool.js'
import type { AgentMessage } from '@wanman/core'

export interface PreambleInput {
  agentName: string
  /** Tasks assigned to this agent or relevant to it */
  tasks: Task[]
  /** Recent messages (already delivered or pending) */
  recentMessages: AgentMessage[]
  /** Current loop number */
  loopNumber: number
  /** System uptime in seconds */
  uptimeSeconds: number
  /** If this respawn was caused by a steer interrupt */
  steerReason?: string
  /** Run ID for reference */
  runId?: string
}

/**
 * Generate a markdown preamble for an agent about to be spawned.
 *
 * Keeps it concise — agents have limited context windows and we don't
 * want the preamble to crowd out actual work instructions.
 */
export function generatePreamble(input: PreambleInput): string {
  const sections: string[] = []

  // Header
  sections.push(`## System Context (Loop #${input.loopNumber})`)
  if (input.runId) {
    sections.push(`Run ID: \`${input.runId}\` | Uptime: ${formatUptime(input.uptimeSeconds)}`)
  }

  // Steer interrupt notice (highest priority)
  if (input.steerReason) {
    sections.push('')
    sections.push(`> **⚠ You were interrupted by a steer message.** Reason: ${input.steerReason}`)
    sections.push('> Prioritize handling the steer message. Previous work may need to be paused.')
  }

  // Current tasks
  const myTasks = input.tasks.filter(t =>
    t.assignee === input.agentName ||
    t.status === 'pending' ||
    t.status === 'assigned'
  )
  if (myTasks.length > 0) {
    sections.push('')
    sections.push('### Current Tasks')
    for (const t of myTasks.slice(0, 10)) {
      const status = statusEmoji(t.status)
      const assignee = t.assignee ? ` (${t.assignee})` : ''
      sections.push(`- ${status} [${t.id.slice(0, 8)}] ${t.title}${assignee}`)
    }
    if (myTasks.length > 10) {
      sections.push(`- ...and ${myTasks.length - 10} more tasks`)
    }
  }

  // Recent messages
  if (input.recentMessages.length > 0) {
    sections.push('')
    sections.push('### Recent Messages')
    for (const m of input.recentMessages.slice(0, 5)) {
      const text = typeof m.payload === 'string'
        ? m.payload.slice(0, 100)
        : JSON.stringify(m.payload).slice(0, 100)
      const priority = m.priority === 'steer' ? ' **[STEER]**' : ''
      sections.push(`- ${m.from}${priority}: ${text}${text.length >= 100 ? '...' : ''}`)
    }
  }

  return sections.join('\n')
}

function statusEmoji(status: string): string {
  switch (status) {
    case 'done': return '✅'
    case 'failed': return '❌'
    case 'in_progress': return '🔄'
    case 'assigned': return '📋'
    case 'review': return '🔍'
    default: return '⏳'
  }
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h${m}m`
}

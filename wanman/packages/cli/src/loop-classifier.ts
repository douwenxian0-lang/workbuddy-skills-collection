/**
 * Loop observability — classifies each dashboard poll loop as
 * productive, idle, blocked, backlog_stuck, or error.
 */

export type LoopClassification = 'productive' | 'idle' | 'blocked' | 'backlog_stuck' | 'error'

export interface TaskSnapshot {
  id: string
  title: string
  status: string
  assignee?: string
}

export interface AgentSnapshot {
  name: string
  state: string
  lifecycle: string
}

export interface LoopSnapshot {
  loop: number
  timestamp: string
  elapsed: number
  classification: LoopClassification
  reasons: string[]
  tasks: TaskSnapshot[]
  taskTransitions: number
  agents: AgentSnapshot[]
}

/** Count how many tasks changed status between two poll snapshots. New tasks also count. */
export function countTransitions(
  prev: { id: string; status: string }[],
  current: { id: string; status: string }[],
): number {
  const prevMap = new Map(prev.map(t => [t.id, t.status]))
  let count = 0
  for (const t of current) {
    const prevStatus = prevMap.get(t.id)
    if (prevStatus !== undefined && prevStatus !== t.status) count++
  }
  // New tasks count as transitions too
  count += current.filter(t => !prevMap.has(t.id)).length
  return count
}

/** Classify a single loop based on task transitions and agent states. */
export function classifyLoop(
  prevTasks: { id: string; status: string }[],
  currentTasks: { id: string; status: string }[],
  agents: AgentSnapshot[],
): { classification: LoopClassification; reasons: string[] } {
  const reasons: string[] = []
  const transitions = countTransitions(prevTasks, currentTasks)

  if (transitions > 0) {
    reasons.push(`${transitions} task transition(s)`)
    return { classification: 'productive', reasons }
  }

  // Check for blocked tasks (assigned/pending but not yet done)
  const activeTasks = currentTasks.filter(t => t.status === 'assigned' || t.status === 'pending')
  if (activeTasks.length > 0) {
    const allDone = currentTasks.filter(t => t.status === 'done').length
    if (allDone < currentTasks.length) {
      reasons.push(`${activeTasks.length} task(s) waiting`)
      return { classification: 'blocked', reasons }
    }
  }

  reasons.push('no state changes')
  return { classification: 'idle', reasons }
}

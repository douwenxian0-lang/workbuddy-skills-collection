/**
 * Unit tests for loop observability — countTransitions and classifyLoop.
 * 100% branch coverage for all classification paths.
 */

import { describe, it, expect } from 'vitest'
import { countTransitions, classifyLoop } from './loop-classifier.js'
import type { AgentSnapshot } from './loop-classifier.js'

// ── Helpers ──

function task(id: string, status: string, assignee?: string) {
  return { id, title: `Task ${id}`, status, assignee }
}

function agent(name: string, state: string, lifecycle: '24/7' | 'on-demand' = 'on-demand'): AgentSnapshot {
  return { name, state, lifecycle }
}

// ── countTransitions ──

describe('countTransitions', () => {
  it('returns 0 when both lists are empty', () => {
    expect(countTransitions([], [])).toBe(0)
  })

  it('returns 0 when tasks are unchanged', () => {
    const prev = [task('1', 'pending'), task('2', 'done')]
    const curr = [task('1', 'pending'), task('2', 'done')]
    expect(countTransitions(prev, curr)).toBe(0)
  })

  it('counts status changes', () => {
    const prev = [task('1', 'pending'), task('2', 'assigned')]
    const curr = [task('1', 'in_progress'), task('2', 'done')]
    expect(countTransitions(prev, curr)).toBe(2)
  })

  it('counts new tasks as transitions', () => {
    const prev = [task('1', 'done')]
    const curr = [task('1', 'done'), task('2', 'pending'), task('3', 'assigned')]
    expect(countTransitions(prev, curr)).toBe(2)
  })

  it('counts both status changes and new tasks', () => {
    const prev = [task('1', 'pending')]
    const curr = [task('1', 'in_progress'), task('2', 'assigned')]
    expect(countTransitions(prev, curr)).toBe(2) // 1 change + 1 new
  })

  it('handles tasks disappearing from current (no count)', () => {
    const prev = [task('1', 'pending'), task('2', 'done')]
    const curr = [task('1', 'pending')]
    expect(countTransitions(prev, curr)).toBe(0)
  })

  it('handles first loop (empty prev)', () => {
    const curr = [task('1', 'pending'), task('2', 'assigned')]
    expect(countTransitions([], curr)).toBe(2) // all new
  })
})

// ── classifyLoop ──

describe('classifyLoop', () => {
  describe('productive classification', () => {
    it('classifies as productive when tasks transition', () => {
      const prev = [task('1', 'pending')]
      const curr = [task('1', 'in_progress')]
      const agents = [agent('ceo', 'idle')]

      const result = classifyLoop(prev, curr, agents)
      expect(result.classification).toBe('productive')
      expect(result.reasons).toContain('1 task transition(s)')
    })

    it('classifies as productive when new tasks appear', () => {
      const prev: ReturnType<typeof task>[] = []
      const curr = [task('1', 'pending')]
      const agents = [agent('ceo', 'idle')]

      const result = classifyLoop(prev, curr, agents)
      expect(result.classification).toBe('productive')
    })

    it('does not treat running agents alone as productive', () => {
      const tasks = [task('1', 'in_progress')]

      const result = classifyLoop(tasks, tasks, [agent('writer-1', 'running')])
      expect(result.classification).toBe('idle')
      expect(result.reasons).toContain('no state changes')
    })

    it('prioritizes task transitions over agent running', () => {
      const prev = [task('1', 'pending')]
      const curr = [task('1', 'done')]

      const result = classifyLoop(prev, curr, [agent('writer-1', 'running')])
      expect(result.classification).toBe('productive')
      expect(result.reasons[0]).toContain('transition')
    })
  })

  describe('blocked classification', () => {
    it('classifies as blocked when assigned tasks are waiting', () => {
      const tasks = [task('1', 'done'), task('2', 'assigned')]

      const result = classifyLoop(tasks, tasks, [agent('writer', 'idle')])
      expect(result.classification).toBe('blocked')
      expect(result.reasons[0]).toContain('waiting')
    })

    it('classifies as blocked when pending tasks exist', () => {
      const tasks = [task('1', 'pending')]

      const result = classifyLoop(tasks, tasks, [agent('ceo', 'idle')])
      expect(result.classification).toBe('blocked')
    })

    it('classifies as blocked with mix of done and assigned', () => {
      const tasks = [
        task('1', 'done'),
        task('2', 'done'),
        task('3', 'assigned'),
      ]

      const result = classifyLoop(tasks, tasks, [agent('editor', 'idle')])
      expect(result.classification).toBe('blocked')
    })
  })

  describe('idle classification', () => {
    it('classifies as idle when all tasks done and no agent running', () => {
      const tasks = [task('1', 'done'), task('2', 'done')]

      const result = classifyLoop(tasks, tasks, [
        agent('ceo', 'idle'),
        agent('writer', 'idle'),
      ])
      expect(result.classification).toBe('idle')
      expect(result.reasons).toContain('no state changes')
    })

    it('classifies as idle when no tasks exist and no agents running', () => {
      const result = classifyLoop([], [], [agent('ceo', 'idle')])
      expect(result.classification).toBe('idle')
    })

    it('classifies as idle with no agents at all', () => {
      const tasks = [task('1', 'done')]
      const result = classifyLoop(tasks, tasks, [])
      expect(result.classification).toBe('idle')
    })

    it('keeps backlog_stuck reserved for queue observability, not task-only snapshots', () => {
      const tasks = [task('1', 'assigned', 'feedback')]
      const result = classifyLoop(tasks, tasks, [agent('feedback', 'idle')])
      expect(result.classification).toBe('blocked')
    })
  })

  // ── Scenario-based tests (universal task types) ──

  describe('novel generation scenario', () => {
    it('tracks architect → writer → editor pipeline', () => {
      // Loop 1: CEO creates architect task
      const r1 = classifyLoop([], [task('1', 'assigned', 'architect')], [agent('ceo', 'running')])
      expect(r1.classification).toBe('productive')

      // Loop 2: architect running, but the task is still waiting on work
      const t2 = [task('1', 'assigned', 'architect')]
      const r2 = classifyLoop(t2, t2, [agent('architect', 'running')])
      expect(r2.classification).toBe('blocked')

      // Loop 3: architect done, CEO creates writer tasks
      const t3prev = [task('1', 'assigned', 'architect')]
      const t3curr = [
        task('1', 'done', 'architect'),
        task('2', 'assigned', 'writer-1'),
        task('3', 'assigned', 'writer-2'),
      ]
      const r3 = classifyLoop(t3prev, t3curr, [agent('ceo', 'idle')])
      expect(r3.classification).toBe('productive')
      expect(countTransitions(t3prev, t3curr)).toBe(3) // 1 status change + 2 new

      // Loop N: all done, idle
      const tDone = [
        task('1', 'done'), task('2', 'done'),
        task('3', 'done'), task('4', 'done'),
      ]
      const rDone = classifyLoop(tDone, tDone, [agent('ceo', 'idle'), agent('editor', 'idle')])
      expect(rDone.classification).toBe('idle')
    })
  })

  describe('game company scenario', () => {
    it('tracks multi-agent task decomposition', () => {
      // CEO decomposes goal into multiple domains
      const prevEmpty: ReturnType<typeof task>[] = []
      const afterDecompose = [
        task('1', 'assigned', 'dev'),
        task('2', 'assigned', 'marketing'),
        task('3', 'assigned', 'finance'),
        task('4', 'assigned', 'devops'),
      ]
      const r = classifyLoop(prevEmpty, afterDecompose, [agent('ceo', 'running')])
      expect(r.classification).toBe('productive')
      expect(countTransitions(prevEmpty, afterDecompose)).toBe(4)

      // Some agents working, some blocked
      const mid = [
        task('1', 'in_progress', 'dev'),
        task('2', 'in_progress', 'marketing'),
        task('3', 'assigned', 'finance'), // waiting for dev
        task('4', 'assigned', 'devops'),  // waiting for dev
      ]
      const rMid = classifyLoop(afterDecompose, mid, [
        agent('dev', 'running'),
        agent('marketing', 'running'),
        agent('finance', 'idle'),
      ])
      expect(rMid.classification).toBe('productive') // transitions happened
    })
  })

  describe('hybrid model scenario (Qwen workers)', () => {
    it('handles same classification regardless of model — only state matters', () => {
      // Qwen workers behave identically to Claude workers from classification perspective
      const tasks = [task('1', 'in_progress', 'feedback')]
      const agents = [
        agent('ceo', 'idle', '24/7'),          // Claude
        agent('feedback', 'running', 'on-demand'), // Qwen worker
      ]

      const result = classifyLoop(tasks, tasks, agents)
      expect(result.classification).toBe('idle')
    })

    it('detects idle even when Qwen worker is configured but not running', () => {
      const tasks = [task('1', 'done')]
      const agents = [
        agent('ceo', 'idle', '24/7'),
        agent('feedback', 'idle', 'on-demand'),
        agent('dev', 'idle', 'on-demand'),
      ]

      const result = classifyLoop(tasks, tasks, agents)
      expect(result.classification).toBe('idle')
    })
  })
})

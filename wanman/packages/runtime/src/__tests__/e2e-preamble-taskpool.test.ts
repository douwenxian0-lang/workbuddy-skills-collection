/**
 * E2E test: Preamble generation with real TaskPool (SQLite in-memory).
 *
 * Verifies that generatePreamble() produces correct output when fed
 * data from a real TaskPool with real tasks in various states.
 *
 * Run: pnpm -F @wanman/runtime test e2e-preamble-taskpool
 */

import { describe, it, expect, beforeAll } from 'vitest'
import Database from 'better-sqlite3'
import { TaskPool } from '../task-pool.js'
import { generatePreamble } from '../preamble.js'

describe('Preamble + real TaskPool E2E', () => {
  let taskPool: TaskPool
  let taskIds: string[]

  beforeAll(async () => {
    const db = new Database(':memory:')
    taskPool = new TaskPool(db)
    taskIds = []

    // Create a realistic task tree
    const t1 = await taskPool.create({
      title: '调研中目黑商铺租金',
      description: '搜索 suumo.jp 和 homes.co.jp',
      assignee: 'feedback',
      priority: 8,
      scope: { paths: ['research/'] },
    })
    taskIds.push(t1.id)

    const t2 = await taskPool.create({
      title: '计算初期投资预算',
      description: '基于租金数据估算',
      assignee: 'finance',
      priority: 7,
      scope: { paths: ['budget/'] },
      dependsOn: [t1.id],
    })
    taskIds.push(t2.id)

    const t3 = await taskPool.create({
      title: '设计品牌视觉',
      description: 'Logo, 配色, 字体选择',
      assignee: 'marketing',
      priority: 5,
      scope: { paths: ['brand/'] },
    })
    taskIds.push(t3.id)

    // Progress some tasks
    await taskPool.update(t1.id, { status: 'in_progress' })
    await taskPool.update(t3.id, { status: 'done', result: '品牌方案完成' })
  })

  it('should include assigned tasks for the agent', () => {
    const tasks = taskPool.listSync()
    const preamble = generatePreamble({
      agentName: 'feedback',
      tasks,
      recentMessages: [],
      loopNumber: 10,
      uptimeSeconds: 600,
      runId: 'run-preamble-e2e',
    })

    expect(preamble).toContain('调研中目黑商铺租金')
    expect(preamble).toContain('🔄') // in_progress
    expect(preamble).toContain('Loop #10')
    expect(preamble).toContain('run-preamble-e2e')
    expect(preamble).toContain('10m') // 600s = 10m
  })

  it('should show pending/assigned tasks for CEO (not in_progress of other agents)', () => {
    const tasks = taskPool.listSync()
    const preamble = generatePreamble({
      agentName: 'ceo',
      tasks,
      recentMessages: [],
      loopNumber: 5,
      uptimeSeconds: 300,
    })

    // CEO should see pending/assigned tasks (t2 is pending with dependency)
    expect(preamble).toContain('### Current Tasks')
    expect(preamble).toContain('计算初期投资预算') // pending (assigned to finance, but depends_on blocks it)
    // t1 is in_progress + assigned to feedback — CEO shouldn't see it in preamble
    // (it's not pending/assigned and not assigned to ceo)
  })

  it('should show done tasks with correct emoji', () => {
    const tasks = taskPool.listSync()
    const preamble = generatePreamble({
      agentName: 'marketing',
      tasks,
      recentMessages: [],
      loopNumber: 1,
      uptimeSeconds: 30,
    })

    expect(preamble).toContain('✅') // done
    expect(preamble).toContain('设计品牌视觉')
  })

  it('should include steer reason when provided', () => {
    const tasks = taskPool.listSync()
    const preamble = generatePreamble({
      agentName: 'feedback',
      tasks,
      recentMessages: [],
      loopNumber: 15,
      uptimeSeconds: 900,
      steerReason: 'CEO: 预算超支，停止租金调研',
    })

    expect(preamble).toContain('You were interrupted by a steer message')
    expect(preamble).toContain('预算超支')
  })

  it('should include recent messages with correct formatting', () => {
    const tasks = taskPool.listSync()
    const preamble = generatePreamble({
      agentName: 'finance',
      tasks,
      recentMessages: [
        { id: '1', from: 'ceo', to: 'finance', type: 'message', priority: 'normal' as const, payload: '请计算 MRR', timestamp: Date.now(), delivered: false },
        { id: '2', from: 'feedback', to: 'finance', type: 'message', priority: 'steer' as const, payload: '紧急：竞品降价', timestamp: Date.now(), delivered: false },
      ],
      loopNumber: 20,
      uptimeSeconds: 1200,
    })

    expect(preamble).toContain('### Recent Messages')
    expect(preamble).toContain('ceo')
    expect(preamble).toContain('请计算 MRR')
    expect(preamble).toContain('[STEER]')
    expect(preamble).toContain('紧急：竞品降价')
  })

  it('should handle the full task lifecycle correctly', async () => {
    // Complete t1, start t2
    await taskPool.update(taskIds[0]!, { status: 'done', result: '租金数据已收集' })
    await taskPool.update(taskIds[1]!, { status: 'in_progress' })

    const tasks = taskPool.listSync()
    const preamble = generatePreamble({
      agentName: 'finance',
      tasks,
      recentMessages: [],
      loopNumber: 30,
      uptimeSeconds: 1800,
      runId: 'run-lifecycle',
    })

    // Finance should see their in_progress task
    expect(preamble).toContain('🔄')
    expect(preamble).toContain('计算初期投资预算')
    expect(preamble).toContain('run-lifecycle')
    expect(preamble).toContain('30m') // 1800s = 30m
  })

  it('should produce a concise preamble (not too verbose)', () => {
    const tasks = taskPool.listSync()
    const preamble = generatePreamble({
      agentName: 'dev',
      tasks,
      recentMessages: [],
      loopNumber: 1,
      uptimeSeconds: 5,
    })

    // Should be reasonably short — not overwhelming the agent's context
    const lineCount = preamble.split('\n').length
    expect(lineCount).toBeLessThan(30)
  })
})

/**
 * Unit tests for TaskPool — task lifecycle and scope conflict detection.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { TaskPool } from '../task-pool.js'

describe('TaskPool', () => {
  let db: Database.Database
  let pool: TaskPool

  beforeEach(() => {
    db = new Database(':memory:')
    pool = new TaskPool(db)
  })

  afterEach(() => {
    db.close()
  })

  it('should create a task with all fields populated', async () => {
    const before = Date.now()
    const task = await pool.create({
      title: 'Implement feature X',
      description: 'Add the new feature X to the system',
      scope: { paths: ['packages/runtime/src/foo.ts'] },
      priority: 5,
    })

    expect(task.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(task.title).toBe('Implement feature X')
    expect(task.description).toBe('Add the new feature X to the system')
    expect(task.scope.paths).toEqual(['packages/runtime/src/foo.ts'])
    expect(task.status).toBe('pending')
    expect(task.priority).toBe(5)
    expect(task.assignee).toBeUndefined()
    expect(task.parentId).toBeUndefined()
    expect(task.result).toBeUndefined()
    expect(task.createdAt).toBeGreaterThanOrEqual(before)
    expect(task.createdAt).toBeLessThanOrEqual(Date.now())
    expect(task.updatedAt).toBe(task.createdAt)
  })

  it('should create a task with optional fields', async () => {
    const task = await pool.create({
      title: 'Sub-task',
      description: 'A child task',
      scope: { paths: ['src/a.ts'], patterns: ['src/**'] },
      priority: 8,
      parentId: 'parent-123',
      executionProfile: 'marketing.launch_copy',
    })

    expect(task.parentId).toBe('parent-123')
    expect(task.scope.patterns).toEqual(['src/**'])
    expect(task.executionProfile).toBe('marketing.launch_copy')
  })

  it('should claim a pending task', async () => {
    const created = await pool.create({
      title: 'Task A',
      description: 'desc',
      scope: { paths: ['a.ts'] },
      priority: 3,
    })

    const claimed = await pool.claim(created.id, 'agent-001')

    expect(claimed.status).toBe('assigned')
    expect(claimed.assignee).toBe('agent-001')
    expect(claimed.updatedAt).toBeGreaterThanOrEqual(created.updatedAt)
  })

  it('should throw when claiming an already-claimed task', async () => {
    const created = await pool.create({
      title: 'Task B',
      description: 'desc',
      scope: { paths: ['b.ts'] },
      priority: 3,
    })

    await pool.claim(created.id, 'agent-001')

    await expect(pool.claim(created.id, 'agent-002')).rejects.toThrow()
  })

  it('should throw when claiming a non-existent task', async () => {
    await expect(pool.claim('non-existent-id', 'agent-001')).rejects.toThrow()
  })

  it('should update task status and result', async () => {
    const created = await pool.create({
      title: 'Task C',
      description: 'desc',
      scope: { paths: ['c.ts'] },
      priority: 3,
    })

    await pool.claim(created.id, 'agent-001')

    const updated = await pool.update(created.id, {
      status: 'in_progress',
    })
    expect(updated.status).toBe('in_progress')

    const done = await pool.update(created.id, {
      status: 'done',
      result: 'Feature implemented successfully',
      executionProfile: 'runtime.patch',
    })
    expect(done.status).toBe('done')
    expect(done.result).toBe('Feature implemented successfully')
    expect(done.executionProfile).toBe('runtime.patch')
    expect(done.updatedAt).toBeGreaterThanOrEqual(updated.updatedAt)
  })

  it('should list all tasks with no filter', async () => {
    await pool.create({ title: 'T1', description: 'd', scope: { paths: ['a.ts'] }, priority: 1 })
    await pool.create({ title: 'T2', description: 'd', scope: { paths: ['b.ts'] }, priority: 2 })
    await pool.create({ title: 'T3', description: 'd', scope: { paths: ['c.ts'] }, priority: 3 })

    const all = await pool.list()
    expect(all).toHaveLength(3)
  })

  it('should list tasks filtered by status', async () => {
    const t1 = await pool.create({ title: 'T1', description: 'd', scope: { paths: ['a.ts'] }, priority: 1 })
    await pool.create({ title: 'T2', description: 'd', scope: { paths: ['b.ts'] }, priority: 2 })

    await pool.claim(t1.id, 'agent-001')

    const pending = await pool.list({ status: 'pending' })
    expect(pending).toHaveLength(1)
    expect(pending[0]!.title).toBe('T2')

    const assigned = await pool.list({ status: 'assigned' })
    expect(assigned).toHaveLength(1)
    expect(assigned[0]!.title).toBe('T1')
  })

  it('should list tasks filtered by assignee', async () => {
    const t1 = await pool.create({ title: 'T1', description: 'd', scope: { paths: ['a.ts'] }, priority: 1 })
    const t2 = await pool.create({ title: 'T2', description: 'd', scope: { paths: ['b.ts'] }, priority: 2 })

    await pool.claim(t1.id, 'agent-001')
    await pool.claim(t2.id, 'agent-002')

    const agent1Tasks = await pool.list({ assignee: 'agent-001' })
    expect(agent1Tasks).toHaveLength(1)
    expect(agent1Tasks[0]!.title).toBe('T1')
  })

  // --- Scope conflict tests ---

  it('should detect scope conflict on overlapping paths', async () => {
    await pool.create({
      title: 'Task X',
      description: 'd',
      scope: { paths: ['packages/runtime/src/foo.ts', 'packages/runtime/src/bar.ts'] },
      priority: 5,
    })

    const conflicts = await pool.checkConflict({
      paths: ['packages/runtime/src/foo.ts'],
    })

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]!.title).toBe('Task X')
  })

  it('should detect scope conflict via pattern matching', async () => {
    await pool.create({
      title: 'Task with pattern',
      description: 'd',
      scope: { paths: [], patterns: ['packages/runtime/**'] },
      priority: 5,
    })

    const conflicts = await pool.checkConflict({
      paths: ['packages/runtime/src/foo.ts'],
    })

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]!.title).toBe('Task with pattern')
  })

  it('should detect scope conflict when incoming has pattern and existing has path', async () => {
    await pool.create({
      title: 'Task with path',
      description: 'd',
      scope: { paths: ['packages/runtime/src/foo.ts'] },
      priority: 5,
    })

    const conflicts = await pool.checkConflict({
      paths: [],
      patterns: ['packages/runtime/**'],
    })

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]!.title).toBe('Task with path')
  })

  it('should return empty when no scope overlap', async () => {
    await pool.create({
      title: 'Task in packages/core',
      description: 'd',
      scope: { paths: ['packages/core/src/index.ts'] },
      priority: 5,
    })

    const conflicts = await pool.checkConflict({
      paths: ['packages/runtime/src/foo.ts'],
    })

    expect(conflicts).toHaveLength(0)
  })

  it('should exclude task by excludeTaskId in conflict check', async () => {
    const task = await pool.create({
      title: 'Self task',
      description: 'd',
      scope: { paths: ['packages/runtime/src/foo.ts'] },
      priority: 5,
    })

    const conflicts = await pool.checkConflict(
      { paths: ['packages/runtime/src/foo.ts'] },
      task.id,
    )

    expect(conflicts).toHaveLength(0)
  })

  it('should not report conflicts with done or failed tasks', async () => {
    const task = await pool.create({
      title: 'Finished task',
      description: 'd',
      scope: { paths: ['packages/runtime/src/foo.ts'] },
      priority: 5,
    })

    await pool.claim(task.id, 'agent-001')
    await pool.update(task.id, { status: 'done' })

    const conflicts = await pool.checkConflict({
      paths: ['packages/runtime/src/foo.ts'],
    })

    expect(conflicts).toHaveLength(0)
  })

  // --- ID prefix matching tests ---

  it('should resolve task by 8-char prefix via get()', async () => {
    const task = await pool.create({
      title: 'Prefix test',
      description: 'd',
      scope: { paths: ['a.ts'] },
      priority: 1,
    })
    const prefix = task.id.slice(0, 8)
    const found = pool.get(prefix)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(task.id)
    expect(found!.title).toBe('Prefix test')
  })

  it('should resolve task by full UUID via get()', async () => {
    const task = await pool.create({
      title: 'Full ID test',
      description: 'd',
      scope: { paths: ['a.ts'] },
      priority: 1,
    })
    const found = pool.get(task.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(task.id)
  })

  it('should return null for non-matching prefix', () => {
    const found = pool.get('deadbeef')
    expect(found).toBeNull()
  })

  it('should update task by short prefix ID', async () => {
    const task = await pool.create({
      title: 'Update by prefix',
      description: 'd',
      scope: { paths: ['a.ts'] },
      priority: 1,
    })
    await pool.claim(task.id, 'agent-001')

    const prefix = task.id.slice(0, 8)
    const updated = await pool.update(prefix, { status: 'done', result: 'ok' })
    expect(updated.status).toBe('done')
    expect(updated.result).toBe('ok')
    expect(updated.id).toBe(task.id)
  })

  it('should claim task by short prefix ID', async () => {
    const task = await pool.create({
      title: 'Claim by prefix',
      description: 'd',
      scope: { paths: ['a.ts'] },
      priority: 1,
    })

    const prefix = task.id.slice(0, 8)
    const claimed = await pool.claim(prefix, 'agent-001')
    expect(claimed.status).toBe('assigned')
    expect(claimed.assignee).toBe('agent-001')
    expect(claimed.id).toBe(task.id)
  })

  it('should detect pattern-to-pattern conflict', async () => {
    await pool.create({
      title: 'Broad task',
      description: 'd',
      scope: { paths: [], patterns: ['packages/runtime/**'] },
      priority: 5,
    })

    const conflicts = await pool.checkConflict({
      paths: [],
      patterns: ['packages/runtime/src/**'],
    })

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]!.title).toBe('Broad task')
  })

  describe('update — atomic merge', () => {
    it('keeps unspecified fields intact (COALESCE semantics)', async () => {
      const task = await pool.create({
        title: 'T1', description: 'd', scope: { paths: ['a.ts'] }, priority: 5,
      })
      await pool.claim(task.id, 'agent-a')
      // First caller sets result only; second caller changes status only. Neither
      // should clobber the other's field.
      const afterResult = await pool.update(task.id, { result: 'phase-1 done' })
      expect(afterResult.result).toBe('phase-1 done')
      expect(afterResult.assignee).toBe('agent-a')

      const afterStatus = await pool.update(task.id, { status: 'in_progress' })
      expect(afterStatus.status).toBe('in_progress')
      expect(afterStatus.result).toBe('phase-1 done')
      expect(afterStatus.assignee).toBe('agent-a')
    })

    it('does not lose a concurrently-written field under interleaved updates', async () => {
      const task = await pool.create({
        title: 'T2', description: 'd', scope: { paths: ['b.ts'] }, priority: 5,
      })
      await pool.claim(task.id, 'agent-a')

      // Simulate two updates racing: one writes status, the other writes result.
      // With the old read-modify-write, whichever ran second would echo back the
      // row it read and overwrite the other. COALESCE writes merge cleanly.
      await Promise.all([
        pool.update(task.id, { status: 'in_progress' }),
        pool.update(task.id, { result: 'interim' }),
      ])

      const latest = pool.get(task.id)!
      expect(latest.status).toBe('in_progress')
      expect(latest.result).toBe('interim')
    })

    it('enforces expectedStatus when provided', async () => {
      const task = await pool.create({
        title: 'T3', description: 'd', scope: { paths: ['c.ts'] }, priority: 5,
      })
      await pool.claim(task.id, 'agent-a')
      // Manually transition to 'in_progress' without the expectedStatus guard.
      await pool.update(task.id, { status: 'in_progress' })

      await expect(
        pool.update(task.id, { result: 'stale' }, 'assigned'),
      ).rejects.toThrow(/update conflict/)

      // With the correct expectedStatus, the update succeeds.
      const ok = await pool.update(task.id, { result: 'fresh' }, 'in_progress')
      expect(ok.result).toBe('fresh')
    })

    it('throws when task id is unknown', async () => {
      await expect(pool.update('00000000-0000-0000-0000-000000000000', { status: 'done' })).rejects.toThrow(
        /Task not found/,
      )
    })
  })

  describe('releaseByAssignee', () => {
    it('reverts assigned + in_progress tasks back to pending and clears assignee', async () => {
      const t1 = await pool.create({ title: 'T1', description: 'd', scope: { paths: ['a.ts'] }, priority: 5 })
      const t2 = await pool.create({ title: 'T2', description: 'd', scope: { paths: ['b.ts'] }, priority: 5 })
      const t3 = await pool.create({ title: 'T3', description: 'd', scope: { paths: ['c.ts'] }, priority: 5 })

      await pool.claim(t1.id, 'agent-a')
      await pool.claim(t2.id, 'agent-a')
      await pool.update(t2.id, { status: 'in_progress' })
      await pool.claim(t3.id, 'agent-b')

      const released = pool.releaseByAssignee('agent-a')
      expect(released).toBe(2)

      const after1 = pool.get(t1.id)!
      const after2 = pool.get(t2.id)!
      const after3 = pool.get(t3.id)!
      expect(after1.status).toBe('pending')
      expect(after1.assignee).toBeUndefined()
      expect(after2.status).toBe('pending')
      expect(after2.assignee).toBeUndefined()
      expect(after3.status).toBe('assigned')
      expect(after3.assignee).toBe('agent-b')
    })

    it('leaves terminal and review tasks alone', async () => {
      const t1 = await pool.create({ title: 'T1', description: 'd', scope: { paths: ['a.ts'] }, priority: 5 })
      const t2 = await pool.create({ title: 'T2', description: 'd', scope: { paths: ['b.ts'] }, priority: 5 })
      const t3 = await pool.create({ title: 'T3', description: 'd', scope: { paths: ['c.ts'] }, priority: 5 })
      await pool.claim(t1.id, 'agent-a')
      await pool.update(t1.id, { status: 'review' })
      await pool.claim(t2.id, 'agent-a')
      await pool.update(t2.id, { status: 'done' })
      await pool.claim(t3.id, 'agent-a')
      await pool.update(t3.id, { status: 'failed' })

      const released = pool.releaseByAssignee('agent-a')
      expect(released).toBe(0)
      expect(pool.get(t1.id)!.status).toBe('review')
      expect(pool.get(t2.id)!.status).toBe('done')
      expect(pool.get(t3.id)!.status).toBe('failed')
    })
  })
})

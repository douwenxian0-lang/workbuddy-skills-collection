/**
 * Tests for MergeQueue — merge queue for serialised branch integration.
 * Uses real git repos in temp directories.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { execFileSync } from 'child_process'
import { tmpdir } from 'os'
import { MergeQueue } from '../merge-queue.js'
import type { MergeRequest, MergeQueueConfig } from '../merge-queue.js'

let repoDir: string

/** Helper: create a fresh git repo with an initial commit on 'main'. */
function createRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mq-test-'))
  execFileSync('git', ['init'], { cwd: dir, stdio: 'pipe' })
  execFileSync('git', ['branch', '-M', 'main'], { cwd: dir, stdio: 'pipe' })
  // Need user config for commits
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir, stdio: 'pipe' })
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir, stdio: 'pipe' })
  execFileSync('git', ['commit', '--allow-empty', '-m', 'init'], { cwd: dir, stdio: 'pipe' })
  return dir
}

/** Helper: create a branch with a file commit, then go back to main. */
function createBranchWithCommit(dir: string, branch: string, filename: string, content: string): void {
  execFileSync('git', ['checkout', '-b', branch], { cwd: dir, stdio: 'pipe' })
  writeFileSync(join(dir, filename), content)
  execFileSync('git', ['add', '.'], { cwd: dir, stdio: 'pipe' })
  execFileSync('git', ['commit', '-m', `add ${filename}`], { cwd: dir, stdio: 'pipe' })
  execFileSync('git', ['checkout', 'main'], { cwd: dir, stdio: 'pipe' })
}

afterAll(() => {
  // Clean up all temp dirs — they start with mq-test-
  // Individual tests handle their own cleanup via repoDir
})

describe('MergeQueue', () => {
  beforeEach(() => {
    repoDir = createRepo()
  })

  afterEach(() => {
    // Best-effort cleanup — each test gets its own temp dir via beforeEach
    if (repoDir) {
      rmSync(repoDir, { recursive: true, force: true })
    }
  })

  describe('enqueue', () => {
    it('should create a MergeRequest with status=queued', async () => {
      const mq = new MergeQueue({ repoDir })
      const req = await mq.enqueue('task-1', 'feature-1', 'agent-1')

      expect(req.id).toBeDefined()
      expect(req.taskId).toBe('task-1')
      expect(req.branch).toBe('feature-1')
      expect(req.agentId).toBe('agent-1')
      expect(req.status).toBe('queued')
      expect(req.createdAt).toBeLessThanOrEqual(Date.now())
      expect(req.createdAt).toBeGreaterThan(Date.now() - 5000)
      expect(req.mergedAt).toBeUndefined()
      expect(req.error).toBeUndefined()
    })

    it('should reject invalid branch names', async () => {
      const mq = new MergeQueue({ repoDir })
      await expect(mq.enqueue('task-1', 'bad branch name!', 'agent-1')).rejects.toThrow(/Invalid branch name/)
    })
  })

  describe('list', () => {
    it('should return all requests', async () => {
      const mq = new MergeQueue({ repoDir })
      await mq.enqueue('task-1', 'feature-1', 'agent-1')
      await mq.enqueue('task-2', 'feature-2', 'agent-2')

      const list = await mq.list()
      expect(list).toHaveLength(2)
      expect(list[0]!.taskId).toBe('task-1')
      expect(list[1]!.taskId).toBe('task-2')
    })
  })

  describe('getStatus', () => {
    it('should return specific request by id', async () => {
      const mq = new MergeQueue({ repoDir })
      const req = await mq.enqueue('task-1', 'feature-1', 'agent-1')

      const result = await mq.getStatus(req.id)
      expect(result).not.toBeNull()
      expect(result!.id).toBe(req.id)
      expect(result!.taskId).toBe('task-1')
    })

    it('should return null for unknown id', async () => {
      const mq = new MergeQueue({ repoDir })
      const result = await mq.getStatus('nonexistent-id')
      expect(result).toBeNull()
    })
  })

  describe('process', () => {
    it('should successfully merge a branch (fast-forward)', async () => {
      createBranchWithCommit(repoDir, 'feature-1', 'file1.txt', 'hello from feature-1')

      const mq = new MergeQueue({ repoDir })
      await mq.enqueue('task-1', 'feature-1', 'agent-1')

      const result = await mq.process()
      expect(result.status).toBe('merged')
      expect(result.mergedAt).toBeDefined()
      expect(result.mergedAt).toBeGreaterThan(0)
      expect(result.error).toBeUndefined()

      // Verify the file is now on main
      const content = readFileSync(join(repoDir, 'file1.txt'), 'utf-8')
      expect(content).toBe('hello from feature-1')
    })

    it('should detect and handle rebase conflict', async () => {
      // Create conflicting changes on main and feature branch
      // First, create a file on main
      writeFileSync(join(repoDir, 'conflict.txt'), 'main content')
      execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' })
      execFileSync('git', ['commit', '-m', 'add conflict.txt on main'], { cwd: repoDir, stdio: 'pipe' })

      // Now create a branch from a point BEFORE the main commit (from init)
      execFileSync('git', ['checkout', '-b', 'feature-conflict', 'HEAD~1'], { cwd: repoDir, stdio: 'pipe' })
      writeFileSync(join(repoDir, 'conflict.txt'), 'feature content')
      execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' })
      execFileSync('git', ['commit', '-m', 'add conflict.txt on feature'], { cwd: repoDir, stdio: 'pipe' })
      execFileSync('git', ['checkout', 'main'], { cwd: repoDir, stdio: 'pipe' })

      const mq = new MergeQueue({ repoDir })
      await mq.enqueue('task-conflict', 'feature-conflict', 'agent-1')

      const result = await mq.process()
      expect(result.status).toBe('conflict')
      expect(result.error).toBeDefined()
    })

    it('should call onConflict callback on conflict', async () => {
      // Same conflict setup
      writeFileSync(join(repoDir, 'conflict2.txt'), 'main content')
      execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' })
      execFileSync('git', ['commit', '-m', 'add conflict2.txt on main'], { cwd: repoDir, stdio: 'pipe' })

      execFileSync('git', ['checkout', '-b', 'feature-conflict2', 'HEAD~1'], { cwd: repoDir, stdio: 'pipe' })
      writeFileSync(join(repoDir, 'conflict2.txt'), 'feature content')
      execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' })
      execFileSync('git', ['commit', '-m', 'add conflict2.txt on feature'], { cwd: repoDir, stdio: 'pipe' })
      execFileSync('git', ['checkout', 'main'], { cwd: repoDir, stdio: 'pipe' })

      let callbackReq: MergeRequest | null = null
      const onConflict = async (req: MergeRequest) => {
        callbackReq = req
      }

      const mq = new MergeQueue({ repoDir, onConflict })
      await mq.enqueue('task-conflict2', 'feature-conflict2', 'agent-1')

      await mq.process()
      expect(callbackReq).not.toBeNull()
      expect(callbackReq!.status).toBe('conflict')
      expect(callbackReq!.taskId).toBe('task-conflict2')
    })

    it('should handle test command failure', async () => {
      createBranchWithCommit(repoDir, 'feature-testfail', 'file-testfail.txt', 'test content')

      const mq = new MergeQueue({
        repoDir,
        testCommand: 'false',  // 'false' always exits with code 1
      })
      await mq.enqueue('task-testfail', 'feature-testfail', 'agent-1')

      const result = await mq.process()
      expect(result.status).toBe('failed')
      expect(result.error).toBeDefined()
    })

    it('should throw when queue is empty', async () => {
      const mq = new MergeQueue({ repoDir })
      await expect(mq.process()).rejects.toThrow('No queued merge requests')
    })

    it('should process multiple merges in order', async () => {
      createBranchWithCommit(repoDir, 'feature-a', 'a.txt', 'file a')
      createBranchWithCommit(repoDir, 'feature-b', 'b.txt', 'file b')

      const mq = new MergeQueue({ repoDir })
      await mq.enqueue('task-a', 'feature-a', 'agent-1')
      await mq.enqueue('task-b', 'feature-b', 'agent-2')

      const resultA = await mq.process()
      expect(resultA.status).toBe('merged')
      expect(resultA.taskId).toBe('task-a')

      const resultB = await mq.process()
      expect(resultB.status).toBe('merged')
      expect(resultB.taskId).toBe('task-b')

      // Both files should be on main now
      expect(readFileSync(join(repoDir, 'a.txt'), 'utf-8')).toBe('file a')
      expect(readFileSync(join(repoDir, 'b.txt'), 'utf-8')).toBe('file b')
    })

    it('should run testCommand on success and proceed to merge', async () => {
      createBranchWithCommit(repoDir, 'feature-tested', 'tested.txt', 'tested content')

      const mq = new MergeQueue({
        repoDir,
        testCommand: 'true',  // 'true' always exits with code 0
      })
      await mq.enqueue('task-tested', 'feature-tested', 'agent-1')

      const result = await mq.process()
      expect(result.status).toBe('merged')
    })
  })
})

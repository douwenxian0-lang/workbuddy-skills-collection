/**
 * MergeQueue — serialised branch integration queue.
 *
 * Dev Agents complete tasks on feature branches and submit them to
 * the MergeQueue.  The queue processes requests one at a time:
 * rebase → test → fast-forward merge, ensuring the target branch
 * stays linear and always passes tests.
 */

import { execFileSync, execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

// Allow letters, digits, _ - . / (for branch names like agent/task-1)
const SAFE_NAME = /^[a-zA-Z0-9_\-\.\/]+$/

export interface MergeRequest {
  id: string
  taskId: string
  branch: string
  agentId: string
  status: 'queued' | 'testing' | 'merged' | 'conflict' | 'failed'
  createdAt: number
  mergedAt?: number
  error?: string
}

export interface MergeQueueConfig {
  repoDir: string
  targetBranch?: string      // default: "main"
  testCommand?: string       // e.g. "npm test" — if undefined, skip testing
  onConflict?: (req: MergeRequest) => Promise<void>
}

export class MergeQueue {
  private readonly config: MergeQueueConfig
  private readonly targetBranch: string
  private readonly queue: MergeRequest[] = []

  constructor(config: MergeQueueConfig) {
    this.config = config
    this.targetBranch = config.targetBranch ?? 'main'
  }

  /**
   * Add a branch to the merge queue.
   */
  async enqueue(taskId: string, branch: string, agentId: string): Promise<MergeRequest> {
    if (!SAFE_NAME.test(branch)) {
      throw new Error(`Invalid branch name "${branch}": must match ${SAFE_NAME}`)
    }

    const req: MergeRequest = {
      id: randomUUID(),
      taskId,
      branch,
      agentId,
      status: 'queued',
      createdAt: Date.now(),
    }

    this.queue.push(req)
    return req
  }

  /**
   * Process the next queued merge request.
   *
   * Steps:
   *  1. Pick the first request with status='queued'
   *  2. Rebase the branch onto the target branch
   *  3. Run the test command (if configured)
   *  4. Fast-forward merge into the target branch
   *
   * Throws if the queue is empty.
   */
  async process(): Promise<MergeRequest> {
    const req = this.queue.find((r) => r.status === 'queued')
    if (!req) {
      throw new Error('No queued merge requests')
    }

    const { repoDir, testCommand, onConflict } = this.config
    const cwd = repoDir

    // Step 1: Checkout the target branch
    execFileSync('git', ['checkout', this.targetBranch], { cwd, stdio: 'pipe' })

    // Step 2: Rebase the feature branch onto the target branch
    try {
      execFileSync('git', ['rebase', this.targetBranch, req.branch], { cwd, stdio: 'pipe' })
    } catch {
      // Rebase conflict — abort and mark
      try {
        execFileSync('git', ['rebase', '--abort'], { cwd, stdio: 'pipe' })
      } catch {
        // rebase --abort may fail if there's nothing to abort; ignore
      }
      // Make sure we're back on the target branch
      try {
        execFileSync('git', ['checkout', this.targetBranch], { cwd, stdio: 'pipe' })
      } catch {
        // best effort
      }

      req.status = 'conflict'
      req.error = `Rebase conflict: branch "${req.branch}" conflicts with "${this.targetBranch}"`

      if (onConflict) {
        await onConflict(req)
      }

      return req
    }

    // Step 3: Run test command (if configured)
    // testCommand is a trusted config value (not user input), so shell: true is safe
    // and allows commands like "npm test" to work without manual splitting.
    if (testCommand) {
      req.status = 'testing'
      try {
        execSync(testCommand, { cwd, stdio: 'pipe' })
      } catch {
        req.status = 'failed'
        req.error = `Test command failed: "${testCommand}"`
        // Checkout target branch to leave repo in clean state
        try {
          execFileSync('git', ['checkout', this.targetBranch], { cwd, stdio: 'pipe' })
        } catch {
          // best effort
        }
        return req
      }
    }

    // Step 4: Fast-forward merge
    execFileSync('git', ['checkout', this.targetBranch], { cwd, stdio: 'pipe' })
    execFileSync('git', ['merge', '--ff-only', req.branch], { cwd, stdio: 'pipe' })

    req.status = 'merged'
    req.mergedAt = Date.now()

    return req
  }

  /**
   * List all merge requests (all statuses).
   */
  async list(): Promise<MergeRequest[]> {
    return [...this.queue]
  }

  /**
   * Get a specific merge request by ID. Returns null if not found.
   */
  async getStatus(id: string): Promise<MergeRequest | null> {
    return this.queue.find((r) => r.id === id) ?? null
  }
}

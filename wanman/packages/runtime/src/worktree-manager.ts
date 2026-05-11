/**
 * WorktreeManager — Git worktree lifecycle management.
 *
 * Each dev Agent works in an isolated Git worktree to avoid
 * filesystem-level conflicts. This class manages creating,
 * listing, retrieving, removing, and cleaning up worktrees.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

export interface WorktreeInfo {
  name: string       // e.g. "task-123"
  path: string       // e.g. "/workspace/.worktrees/task-123"
  branch: string     // e.g. "agent/task-123"
  createdAt: number  // Unix timestamp ms
  agentId?: string   // Agent that claimed this worktree
}

interface WorktreeMeta {
  name: string
  branch: string
  createdAt: number
  agentId?: string
}

const BRANCH_PREFIX = 'agent/'
const WORKTREES_DIR = '.worktrees'
const META_FILE = '.worktree-meta.json'
const SAFE_NAME = /^[a-zA-Z0-9_\-\.]+$/

export class WorktreeManager {
  private readonly repoDir: string
  private readonly worktreesDir: string

  constructor(repoDir: string) {
    this.repoDir = repoDir
    this.worktreesDir = join(repoDir, WORKTREES_DIR)
  }

  /**
   * Create a new worktree for the given task name.
   * Creates branch `agent/<name>` based on `baseBranch` (default: HEAD).
   */
  async create(name: string, baseBranch?: string): Promise<WorktreeInfo> {
    if (!SAFE_NAME.test(name)) {
      throw new Error(`Invalid worktree name "${name}": must match ${SAFE_NAME}`)
    }
    if (baseBranch !== undefined && !SAFE_NAME.test(baseBranch)) {
      throw new Error(`Invalid base branch "${baseBranch}": must match ${SAFE_NAME}`)
    }

    const wtPath = join(this.worktreesDir, name)
    const branch = `${BRANCH_PREFIX}${name}`

    // Ensure the parent .worktrees directory exists
    mkdirSync(this.worktreesDir, { recursive: true })

    const base = baseBranch ?? 'HEAD'

    try {
      execFileSync('git', ['worktree', 'add', '-b', branch, wtPath, base], {
        cwd: this.repoDir,
        stdio: 'pipe',
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`Failed to create worktree "${name}": ${msg}`)
    }

    const now = Date.now()
    const meta: WorktreeMeta = {
      name,
      branch,
      createdAt: now,
    }

    // Write metadata file
    writeFileSync(join(wtPath, META_FILE), JSON.stringify(meta))

    return {
      name,
      path: wtPath,
      branch,
      createdAt: now,
    }
  }

  /**
   * Remove a worktree by name.
   * Removes the worktree directory and prunes the git worktree list.
   * Also deletes the associated branch.
   */
  async remove(name: string): Promise<void> {
    const wtPath = join(this.worktreesDir, name)

    if (!existsSync(wtPath)) {
      throw new Error(`Worktree "${name}" does not exist`)
    }

    const branch = `${BRANCH_PREFIX}${name}`

    try {
      execFileSync('git', ['worktree', 'remove', wtPath, '--force'], {
        cwd: this.repoDir,
        stdio: 'pipe',
      })
    } catch {
      // If git worktree remove fails, try manual cleanup
      rmSync(wtPath, { recursive: true, force: true })
      execFileSync('git', ['worktree', 'prune'], { cwd: this.repoDir, stdio: 'pipe' })
    }

    // Try to delete the branch (best effort)
    try {
      execFileSync('git', ['branch', '-D', branch], {
        cwd: this.repoDir,
        stdio: 'pipe',
      })
    } catch {
      // Branch may already be deleted or not exist
    }
  }

  /**
   * List all managed worktrees (those in the .worktrees directory).
   * Uses `git worktree list --porcelain` as the authoritative source,
   * then enriches with metadata from .worktree-meta.json files.
   */
  async list(): Promise<WorktreeInfo[]> {
    let output: string
    try {
      output = execFileSync('git', ['worktree', 'list', '--porcelain'], {
        cwd: this.repoDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf-8',
      })
    } catch {
      return []
    }

    // Git may return canonical/real paths (e.g. /private/tmp on macOS where
    // /tmp is a symlink). Resolve our worktreesDir to the same canonical form
    // for comparison, but use the original worktreesDir for returned paths
    // so they stay consistent with create()/remove().
    const canonicalWorktreesDir = existsSync(this.worktreesDir)
      ? realpathSync(this.worktreesDir)
      : this.worktreesDir
    const results: WorktreeInfo[] = []

    // Porcelain output: blocks separated by blank lines.
    // Each block has lines like:
    //   worktree /path/to/worktree
    //   HEAD abc123
    //   branch refs/heads/agent/task-1
    const blocks = output.split('\n\n').filter((b) => b.trim().length > 0)

    for (const block of blocks) {
      const lines = block.split('\n')

      let wtPath = ''
      let branch = ''

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          wtPath = line.slice('worktree '.length)
        } else if (line.startsWith('branch ')) {
          // e.g. "branch refs/heads/agent/task-1"
          branch = line.slice('branch refs/heads/'.length)
        }
      }

      if (!wtPath) continue

      // Only include worktrees that live under our .worktrees/ directory
      if (!wtPath.startsWith(canonicalWorktreesDir + '/')) continue

      // Derive name from the directory name under .worktrees/
      const name = wtPath.slice(canonicalWorktreesDir.length + 1).split('/')[0]
      if (!name) continue

      // Use the original (non-canonical) path for consistency with create()/remove()
      const normalizedPath = join(this.worktreesDir, name)

      // Try to read metadata for createdAt and agentId
      let createdAt = 0
      let agentId: string | undefined

      const metaPath = join(normalizedPath, META_FILE)
      if (existsSync(metaPath)) {
        try {
          const meta: WorktreeMeta = JSON.parse(readFileSync(metaPath, 'utf-8'))
          createdAt = meta.createdAt
          agentId = meta.agentId
        } catch {
          // Use defaults if metadata is corrupt
        }
      }

      results.push({
        name,
        path: normalizedPath,
        branch,
        createdAt,
        agentId,
      })
    }

    return results
  }

  /**
   * Get info for a specific worktree by name.
   * Uses the authoritative git worktree list to verify existence.
   * Returns null if the worktree does not exist.
   */
  async get(name: string): Promise<WorktreeInfo | null> {
    const all = await this.list()
    return all.find((wt) => wt.name === name) ?? null
  }

  /**
   * Clean up worktrees older than the specified duration.
   * Returns the number of worktrees removed.
   */
  async cleanup(olderThanMs: number): Promise<number> {
    const worktrees = await this.list()
    const cutoff = Date.now() - olderThanMs
    let removed = 0

    for (const wt of worktrees) {
      if (wt.createdAt > 0 && wt.createdAt < cutoff) {
        try {
          await this.remove(wt.name)
          removed++
        } catch {
          // Best effort — skip if removal fails
        }
      }
    }

    return removed
  }
}

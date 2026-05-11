/**
 * Unit tests for Supervisor git auto-commit functionality.
 * Mocks node:child_process execSync to verify git command construction
 * and error handling without touching the real filesystem.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { AgentMatrixConfig } from '@wanman/core'

// Capture execSync calls — must use vi.hoisted() since vi.mock is hoisted
const { mockExecSync } = vi.hoisted(() => ({
  mockExecSync: vi.fn<(cmd: string, ...rest: unknown[]) => string | Buffer>(),
}))
vi.mock('node:child_process', () => ({
  execSync: mockExecSync,
}))

// Mock http-server
vi.mock('../http-server.js', () => ({
  createHttpServer: vi.fn(() => ({
    close: (cb: () => void) => cb(),
  })),
}))

// Mock logger — capture warn calls for error-path verification
const { mockLogWarn, mockLogInfo } = vi.hoisted(() => ({
  mockLogWarn: vi.fn(),
  mockLogInfo: vi.fn(),
}))
vi.mock('../logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: mockLogInfo,
    warn: mockLogWarn,
    error: vi.fn(),
  }),
}))

// Mock agent-process
vi.mock('../agent-process.js', () => {
  class MockAgentProcess {
    definition: unknown
    state = 'idle'
    constructor(def: unknown) { this.definition = def }
    async start() {}
    stop() {}
    handleSteer() {}
  }
  return { AgentProcess: MockAgentProcess }
})

import { Supervisor } from '../supervisor.js'

function makeConfig(overrides?: Partial<AgentMatrixConfig>): AgentMatrixConfig {
  return {
    agents: [
      { name: 'dev', lifecycle: '24/7', model: 'sonnet', systemPrompt: 'dev' },
    ],
    dbPath: ':memory:',
    port: 0,
    ...overrides,
  }
}

/** Get all command strings passed to execSync */
function cmds(): string[] {
  return mockExecSync.mock.calls.map(c => String(c[0]))
}

describe('Supervisor initWorkspaceGit', () => {
  afterEach(async () => {
    vi.clearAllMocks()
  })

  it('should skip init when already a git repo', async () => {
    // git rev-parse succeeds → already a repo
    mockExecSync.mockReturnValue('')

    const supervisor = new Supervisor(makeConfig())
    await supervisor.start()

    expect(cmds()).toContain('git rev-parse --is-inside-work-tree')
    expect(cmds()).not.toContain('git init')

    await supervisor.shutdown()
  })

  it('should run full init sequence when not a repo', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd === 'git rev-parse --is-inside-work-tree') {
        throw new Error('not a git repo')
      }
      return ''
    })

    const supervisor = new Supervisor(makeConfig())
    await supervisor.start()

    const allCmds = cmds()
    expect(allCmds).toContain('git init')
    expect(allCmds).toContain('git config user.email "agents@wanman.dev"')
    expect(allCmds).toContain('git config user.name "wanman agents"')
    expect(allCmds).toContain('git add -A')
    expect(allCmds.find(c => c.includes('git commit'))).toContain('init: workspace initialized')

    await supervisor.shutdown()
  })

  it('should keep the current git worktree root when already inside a repo', async () => {
    mockExecSync.mockReturnValue('')

    const supervisor = new Supervisor(makeConfig({ workspaceRoot: '/workspace/agents' }))
    await supervisor.start()

    const call = mockExecSync.mock.calls.find(c => c[0] === 'git rev-parse --is-inside-work-tree')
    expect(call).toBeDefined()
    expect(call![1]).toEqual(
      expect.objectContaining({ cwd: '/workspace' }),
    )

    await supervisor.shutdown()
  })

  it('should keep the current git worktree root when workspaceRoot has a trailing slash', async () => {
    mockExecSync.mockReturnValue('')

    const supervisor = new Supervisor(makeConfig({ workspaceRoot: '/workspace/agents/' }))
    await supervisor.start()

    const call = mockExecSync.mock.calls.find(c => c[0] === 'git rev-parse --is-inside-work-tree')
    expect(call![1]).toEqual(
      expect.objectContaining({ cwd: '/workspace' }),
    )

    await supervisor.shutdown()
  })

  it('should prefer explicit gitRoot when provided', async () => {
    mockExecSync.mockReturnValue('')

    const supervisor = new Supervisor(makeConfig({
      workspaceRoot: '/workspace/project/repo/.wanman/agents',
      gitRoot: '/workspace/project/repo',
    }))
    await supervisor.start()

    const call = mockExecSync.mock.calls.find(c => c[0] === 'git rev-parse --is-inside-work-tree')
    expect(call![1]).toEqual(expect.objectContaining({ cwd: '/workspace/project/repo' }))

    await supervisor.shutdown()
  })

  it('should handle git init failure gracefully (no throw)', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd === 'git rev-parse --is-inside-work-tree') throw new Error('not a repo')
      if (cmd === 'git init') throw new Error('permission denied')
      return ''
    })

    const supervisor = new Supervisor(makeConfig())
    await expect(supervisor.start()).resolves.toBeUndefined()

    await supervisor.shutdown()
  })
})

describe('Supervisor gitAutoCommit', () => {
  let supervisor: Supervisor

  // Helper to access private method
  function autoCommit(assignee: string, title: string): void {
    const sv = supervisor as unknown as { gitAutoCommit: (a: string, t: string) => void }
    sv.gitAutoCommit(assignee, title)
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    // Default: git rev-parse succeeds (already a repo)
    mockExecSync.mockReturnValue('')
    supervisor = new Supervisor(makeConfig())
    await supervisor.start()
    // Clear calls from start(), keep workspaceGitRoot set
    mockExecSync.mockClear()
    mockLogInfo.mockClear()
    mockLogWarn.mockClear()
  })

  afterEach(async () => {
    await supervisor.shutdown()
  })

  it('should skip when workspaceGitRoot is not set', () => {
    // Force-clear workspaceGitRoot
    const sv = supervisor as unknown as { workspaceGitRoot: string | null }
    sv.workspaceGitRoot = null

    autoCommit('dev', 'test task')

    expect(mockExecSync).not.toHaveBeenCalled()
  })

  it('should skip when no changes exist', () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (String(cmd) === 'git status --porcelain') return ''
      return ''
    })

    autoCommit('dev', 'test task')

    // Called git status but not git commit
    expect(cmds()).toContain('git status --porcelain')
    expect(cmds().filter(c => c.startsWith('git commit'))).toHaveLength(0)
  })

  it('should skip when changes exist but nothing in per-agent output directories', () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (String(cmd) === 'git status --porcelain') return 'M some/other/file.txt'
      if (String(cmd).startsWith('git diff --cached')) return '' // nothing staged after git add
      return ''
    })

    autoCommit('dev', 'test task')

    expect(cmds().filter(c => c.startsWith('git commit'))).toHaveLength(0)
  })

  it('should commit with correct message and author', () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (String(cmd) === 'git status --porcelain') return 'M agents/dev/output/website/index.html'
      if (String(cmd).startsWith('git diff --cached')) return 'agents/dev/output/website/index.html'
      if (String(cmd).startsWith('git rev-parse --short')) return 'abc1234'
      return ''
    })

    autoCommit('dev', 'website build')

    const commitCmd = cmds().find(c => c.startsWith('git commit'))
    expect(commitCmd).toBeDefined()
    expect(commitCmd).toContain('dev: website build')
    expect(commitCmd).toContain('--author="dev-agent <dev@wanman.dev>"')
  })

  it('should truncate long task titles to 72 chars', () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (String(cmd) === 'git status --porcelain') return 'M agents/marketing/output/file.md'
      if (String(cmd).startsWith('git diff --cached')) return 'agents/marketing/output/file.md'
      if (String(cmd).startsWith('git rev-parse --short')) return 'def5678'
      return ''
    })

    const longTitle = 'A'.repeat(100)
    autoCommit('marketing', longTitle)

    const commitCmd = cmds().find(c => c.startsWith('git commit'))
    expect(commitCmd).toBeDefined()
    // "marketing: " (11 chars) + 72 chars of title
    expect(commitCmd).toContain('marketing: ' + 'A'.repeat(72))
    expect(commitCmd).not.toContain('A'.repeat(73))
  })

  it('should escape double quotes in task title', () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (String(cmd) === 'git status --porcelain') return 'M agents/dev/output/file.md'
      if (String(cmd).startsWith('git diff --cached')) return 'agents/dev/output/file.md'
      if (String(cmd).startsWith('git rev-parse --short')) return 'aaa0000'
      return ''
    })

    autoCommit('dev', 'Fix "broken" quotes')

    const commitCmd = cmds().find(c => c.startsWith('git commit'))
    expect(commitCmd).toContain('\\"broken\\"')
  })

  it('should log commit SHA and file count on success', () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (String(cmd) === 'git status --porcelain') return 'M file1\nM file2'
      if (String(cmd).startsWith('git diff --cached')) return 'agents/marketing/output/a.md\nagents/marketing/output/b.html'
      if (String(cmd).startsWith('git rev-parse --short')) return 'bbb1111'
      return ''
    })

    autoCommit('marketing', 'brand design')

    expect(mockLogInfo).toHaveBeenCalledWith('git auto-commit', expect.objectContaining({
      assignee: 'marketing',
      sha: 'bbb1111',
      files: 2,
    }))
  })

  it('should handle git commit failure gracefully (log warn, no throw)', () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (String(cmd) === 'git status --porcelain') return 'M agents/dev/output/file.md'
      if (String(cmd).startsWith('git diff --cached')) return 'agents/dev/output/file.md'
      if (String(cmd).startsWith('git commit')) throw new Error('lock file exists')
      return ''
    })

    // Should not throw
    expect(() => autoCommit('dev', 'test')).not.toThrow()
    expect(mockLogWarn).toHaveBeenCalledWith('git auto-commit failed', expect.objectContaining({
      assignee: 'dev',
    }))
  })

  it('should only stage per-agent output directories', () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (String(cmd) === 'git status --porcelain') return 'M agents/dev/output/file.md'
      if (String(cmd).startsWith('git diff --cached')) return 'agents/dev/output/file.md'
      if (String(cmd).startsWith('git rev-parse --short')) return 'ccc2222'
      return ''
    })

    autoCommit('dev', 'test')

    const addCmd = cmds().find(c => c.startsWith('git add'))
    expect(addCmd).toContain('agents/*/output/')
    // Should NOT use `git add -A` or `git add .`
    expect(addCmd).not.toContain('-A')
  })

  it('should stage the configured workspace path when workspaceRoot is nested', async () => {
    await supervisor.shutdown()
    vi.clearAllMocks()
    mockExecSync.mockReturnValue('')
    supervisor = new Supervisor(makeConfig({
      workspaceRoot: '/workspace/project/repo/.wanman/agents',
      gitRoot: '/workspace/project/repo',
    }))
    await supervisor.start()
    mockExecSync.mockClear()

    mockExecSync.mockImplementation((cmd: string) => {
      if (String(cmd) === 'git status --porcelain') return 'M .wanman/agents/dev/output/file.md'
      if (String(cmd).startsWith('git diff --cached')) return '.wanman/agents/dev/output/file.md'
      if (String(cmd).startsWith('git rev-parse --short')) return 'ddd3333'
      return ''
    })

    autoCommit('dev', 'nested workspace')

    const addCmd = cmds().find(c => c.startsWith('git add'))
    expect(addCmd).toContain('.wanman/agents/*/output/')
  })
})

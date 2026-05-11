import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { watchFile, watchCommand } from './watch.js'

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process')
  return { ...actual, execSync: vi.fn() }
})

const mockExecSync = vi.mocked(execSync)

let tmpDir: string
let ndjsonPath: string

const sampleEvents = [
  { type: 'loop.tick', runId: 'run-1', loop: 1, timestamp: '2026-03-21T10:00:00Z' },
  { type: 'loop.classified', runId: 'run-1', loop: 1, classification: 'idle', reasons: ['no state changes'], timestamp: '2026-03-21T10:00:01Z' },
  { type: 'loop.tick', runId: 'run-1', loop: 2, timestamp: '2026-03-21T10:00:15Z' },
  { type: 'agent.spawned', runId: 'run-1', loop: 2, agent: 'ceo', lifecycle: '24/7', trigger: 'startup', timestamp: '2026-03-21T10:00:16Z' },
  { type: 'task.transition', runId: 'run-1', loop: 2, taskId: 1, from: 'pending', to: 'assigned', assignee: 'dev', timestamp: '2026-03-21T10:00:17Z' },
  { type: 'loop.classified', runId: 'run-1', loop: 2, classification: 'productive', reasons: ['1 task transition(s)'], timestamp: '2026-03-21T10:00:18Z' },
  { type: 'loop.tick', runId: 'run-1', loop: 3, timestamp: '2026-03-21T10:00:30Z' },
  { type: 'artifact.created', runId: 'run-1', loop: 3, agent: 'finance', kind: 'budget_item', path: 'costs/rent', timestamp: '2026-03-21T10:00:31Z' },
  { type: 'queue.backlog', runId: 'run-1', loop: 3, agent: 'feedback', pendingMessages: 2, timestamp: '2026-03-21T10:00:32Z' },
  { type: 'loop.classified', runId: 'run-1', loop: 3, classification: 'productive', reasons: ['1 artifact(s) created'], timestamp: '2026-03-21T10:00:33Z' },
  { type: 'loop.tick', runId: 'run-1', loop: 4, timestamp: '2026-03-21T10:00:45Z' },
  { type: 'task.blocked', runId: 'run-1', loop: 4, taskId: 5, waitingOn: [3, 4], timestamp: '2026-03-21T10:00:46Z' },
  { type: 'loop.classified', runId: 'run-1', loop: 4, classification: 'blocked', reasons: ['1 task(s) blocked'], timestamp: '2026-03-21T10:00:47Z' },
  { type: 'loop.tick', runId: 'run-1', loop: 5, timestamp: '2026-03-21T10:01:00Z' },
  { type: 'loop.classified', runId: 'run-1', loop: 5, classification: 'backlog_stuck', reasons: ['feedback backlog unchanged for 3 loops'], timestamp: '2026-03-21T10:01:01Z' },
]

beforeEach(() => {
  tmpDir = join(tmpdir(), `watch-test-${Date.now()}`)
  mkdirSync(tmpDir, { recursive: true })
  ndjsonPath = join(tmpDir, 'loop-events.ndjson')
  writeFileSync(ndjsonPath, sampleEvents.map(e => JSON.stringify(e)).join('\n') + '\n')
  mockExecSync.mockReset()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
    throw new Error(`process.exit:${code}`)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  try { rmSync(tmpDir, { recursive: true }) } catch { /* ignore */ }
})

describe('watchFile', () => {
  it('should display events from NDJSON file', () => {
    watchFile(ndjsonPath, { tail: 50, history: false })

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('15 events'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('productive'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('idle'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('blocked'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('backlog_stuck'))
  })

  it('should respect --tail limit', () => {
    watchFile(ndjsonPath, { tail: 3, history: false })

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('3 events'))
  })

  it('should filter by agent', () => {
    watchFile(ndjsonPath, { tail: 50, history: false, agent: 'finance' })

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('1 events'))
  })

  it('should filter by classification', () => {
    watchFile(ndjsonPath, { tail: 50, history: false, classification: 'productive' })

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('2 events'))
  })

  it('should filter backlog_stuck classification for operators', () => {
    watchFile(ndjsonPath, { tail: 50, history: false, classification: 'backlog_stuck' })

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('1 events'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('📬 backlog_stuck'))
  })

  it('should filter by event type', () => {
    watchFile(ndjsonPath, { tail: 50, history: false, type: 'task.transition' })

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('1 events'))
  })

  it('should show summary with productive rate and backlog_stuck counts', () => {
    watchFile(ndjsonPath, { tail: 50, history: false })

    expect(console.log).toHaveBeenCalledWith(
      'Summary: 5 loops | 2 productive (40%) | 1 idle | 1 blocked | 1 backlog_stuck | 0 error',
    )
  })

  it('should handle empty file', () => {
    writeFileSync(ndjsonPath, '')

    watchFile(ndjsonPath, { tail: 50, history: false })

    expect(console.log).toHaveBeenCalledWith('No events yet.')
  })

  it('should handle malformed lines gracefully', () => {
    writeFileSync(ndjsonPath, '{"type":"loop.tick","runId":"r","loop":1,"timestamp":"T"}\nnot json\n{"type":"loop.tick","runId":"r","loop":2,"timestamp":"T"}\n')

    watchFile(ndjsonPath, { tail: 50, history: false })

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('2 events'))
  })

  it('should surface file-not-found errors for live mode', () => {
    expect(() => watchFile(join(tmpDir, 'missing.ndjson'), { tail: 50, history: false })).toThrow('process.exit:1')
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('File not found'))
  })

  it('should format all event types correctly', () => {
    watchFile(ndjsonPath, { tail: 50, history: false })

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🚀'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('📋'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('📦'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('📬'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🚫'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('✅'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('💤'))
  })

  it('should format unknown classifications and event types defensively', () => {
    writeFileSync(
      ndjsonPath,
      [
        JSON.stringify({ type: 'loop.classified', runId: 'run-1', loop: 1, classification: 'mystery', reasons: [], timestamp: '2026-03-21T10:00:00Z' }),
        JSON.stringify({ type: 'agent.custom', runId: 'run-1', loop: 1, timestamp: '2026-03-21T10:00:01Z', foo: 'bar' }),
      ].join('\n') + '\n',
    )

    watchFile(ndjsonPath, { tail: 50, history: false })

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('❓ mystery'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"type":"agent.custom"'))
  })
})

describe('watchCommand', () => {
  it('shows help including backlog_stuck classification', async () => {
    await watchCommand(['--help'])

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('backlog_stuck'))
    expect(mockExecSync).not.toHaveBeenCalled()
  })

  it('uses the default deliverables path in live mode', async () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const deliverablesDir = join(tmpDir, 'deliverables')
    mkdirSync(deliverablesDir, { recursive: true })
    writeFileSync(join(deliverablesDir, 'loop-events.ndjson'), sampleEvents.map(e => JSON.stringify(e)).join('\n') + '\n')

    await watchCommand([])

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('15 events'))
    cwdSpy.mockRestore()
  })

  it('queries history mode with operator-facing filters', async () => {
    mockExecSync
      .mockReturnValueOnce('db-123')
      .mockReturnValueOnce('run-1 | 5 | loop.classified | backlog_stuck | feedback | 2026-03-21T10:01:01Z\n')

    await watchCommand(['--history', '--tail', '7', '--run', 'run-1', '--agent', 'feedback', '--classification', 'backlog_stuck'])

    expect(mockExecSync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("x.name==='wanman-brain-local'"),
      expect.objectContaining({ encoding: 'utf-8', timeout: 10_000 }),
    )
    expect(mockExecSync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("SELECT run_id, loop_number, event_type, classification, agent, created_at FROM loop_events WHERE 1=1 AND run_id = 'run-1' AND agent = 'feedback' AND classification = 'backlog_stuck' ORDER BY created_at DESC LIMIT 7"),
      expect.objectContaining({ encoding: 'utf-8', timeout: 15_000 }),
    )
    expect(console.log).toHaveBeenCalledWith('wanman watch --history (db: wanman-brain-local)')
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('backlog_stuck'))
  })

  it('fails clearly when the history database is missing', async () => {
    mockExecSync.mockReturnValueOnce('')

    await expect(watchCommand(['--history', '--db', 'missing-db'])).rejects.toThrow('process.exit:1')
    expect(console.error).toHaveBeenCalledWith('Database not found: missing-db')
  })

  it('fails clearly when the history query throws', async () => {
    mockExecSync
      .mockReturnValueOnce('db-123')
      .mockImplementationOnce(() => {
        throw new Error('db exploded')
      })

    await expect(watchCommand(['--history'])).rejects.toThrow('process.exit:1')
    expect(console.error).toHaveBeenCalledWith('Failed to query db9: db exploded')
  })
})

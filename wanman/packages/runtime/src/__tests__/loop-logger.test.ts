import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { existsSync, readFileSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

vi.mock('../logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  }),
}))

import { LoopLogger, RingBuffer } from '../loop-logger.js'
import { LoopEventBus } from '../loop-event-bus.js'
import type { LoopEvent } from '../loop-events.js'

describe('RingBuffer', () => {
  it('should push and retrieve items', () => {
    const buf = new RingBuffer<number>(5)
    buf.push(1)
    buf.push(2)
    buf.push(3)
    expect(buf.toArray()).toEqual([1, 2, 3])
    expect(buf.size).toBe(3)
  })

  it('should wrap around when capacity is exceeded', () => {
    const buf = new RingBuffer<number>(3)
    buf.push(1)
    buf.push(2)
    buf.push(3)
    buf.push(4) // overwrites 1
    expect(buf.toArray()).toEqual([2, 3, 4])
    expect(buf.size).toBe(3)
  })

  it('should handle empty buffer', () => {
    const buf = new RingBuffer<number>(5)
    expect(buf.toArray()).toEqual([])
    expect(buf.size).toBe(0)
  })

  it('should handle capacity of 1', () => {
    const buf = new RingBuffer<string>(1)
    buf.push('a')
    expect(buf.toArray()).toEqual(['a'])
    buf.push('b')
    expect(buf.toArray()).toEqual(['b'])
    expect(buf.size).toBe(1)
  })

  it('should handle exactly filling capacity', () => {
    const buf = new RingBuffer<number>(3)
    buf.push(1)
    buf.push(2)
    buf.push(3)
    expect(buf.toArray()).toEqual([1, 2, 3])
    expect(buf.size).toBe(3)
  })
})

describe('LoopLogger', () => {
  let tmpDir: string
  let ndjsonPath: string
  let mockBrainManager: { isInitialized: boolean; executeSQL: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    tmpDir = join(tmpdir(), `loop-logger-test-${Date.now()}`)
    mkdirSync(tmpDir, { recursive: true })
    ndjsonPath = join(tmpDir, 'loop-events.ndjson')
    mockBrainManager = {
      isInitialized: true,
      executeSQL: vi.fn().mockResolvedValue([]),
    }
  })

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true }) } catch { /* ignore */ }
  })

  describe('NDJSON local write', () => {
    it('should write events to NDJSON file', () => {
      const bus = new LoopEventBus('run-001')
      const logger = new LoopLogger({ ndjsonPath })
      logger.attach(bus)

      bus.tick()

      expect(existsSync(ndjsonPath)).toBe(true)
      const lines = readFileSync(ndjsonPath, 'utf-8').trim().split('\n')
      expect(lines).toHaveLength(1)
      const event = JSON.parse(lines[0]!)
      expect(event.type).toBe('loop.tick')
      expect(event.runId).toBe('run-001')

      logger.detach(bus)
    })

    it('should append multiple events', () => {
      const bus = new LoopEventBus('run-001')
      const logger = new LoopLogger({ ndjsonPath })
      logger.attach(bus)

      bus.tick()
      bus.tick()
      bus.tick()

      const lines = readFileSync(ndjsonPath, 'utf-8').trim().split('\n')
      expect(lines).toHaveLength(3)

      logger.detach(bus)
    })
  })

  describe('Ring buffer', () => {
    it('should keep recent events in memory', () => {
      const bus = new LoopEventBus('run-001')
      const logger = new LoopLogger({ ndjsonPath, bufferCapacity: 2 })
      logger.attach(bus)

      bus.tick()
      bus.tick()
      bus.tick() // overwrites first tick

      const recent = logger.recentEvents()
      expect(recent).toHaveLength(2)
      expect((recent[0] as { loop: number }).loop).toBe(2)
      expect((recent[1] as { loop: number }).loop).toBe(3)

      logger.detach(bus)
    })
  })

  describe('db9 write (best-effort)', () => {
    it('should write events to db9 loop_events table', async () => {
      const bus = new LoopEventBus('run-001')
      const logger = new LoopLogger({
        ndjsonPath,
        brainManager: mockBrainManager as any,
      })
      logger.attach(bus)

      bus.tick()

      // Wait for async db9 write
      await new Promise(r => setTimeout(r, 10))

      expect(mockBrainManager.executeSQL).toHaveBeenCalledTimes(1)
      const sql = mockBrainManager.executeSQL.mock.calls[0]![0] as string
      expect(sql).toContain('INSERT INTO loop_events')
      expect(sql).toContain('run-001')
      expect(sql).toContain('loop.tick')

      logger.detach(bus)
    })

    it('should not throw when db9 write fails', async () => {
      mockBrainManager.executeSQL.mockRejectedValue(new Error('db9 down'))
      const bus = new LoopEventBus('run-001')
      const logger = new LoopLogger({
        ndjsonPath,
        brainManager: mockBrainManager as any,
      })
      logger.attach(bus)

      // Should not throw
      bus.tick()

      await new Promise(r => setTimeout(r, 10))

      // NDJSON should still have been written
      expect(existsSync(ndjsonPath)).toBe(true)
      const lines = readFileSync(ndjsonPath, 'utf-8').trim().split('\n')
      expect(lines).toHaveLength(1)

      logger.detach(bus)
    })

    it('should skip db9 write when brainManager is null', () => {
      const bus = new LoopEventBus('run-001')
      const logger = new LoopLogger({ ndjsonPath, brainManager: null })
      logger.attach(bus)

      bus.tick()

      // No db9 calls expected — just NDJSON
      expect(existsSync(ndjsonPath)).toBe(true)

      logger.detach(bus)
    })

    it('should skip db9 write when brainManager is not initialized', () => {
      mockBrainManager.isInitialized = false
      const bus = new LoopEventBus('run-001')
      const logger = new LoopLogger({
        ndjsonPath,
        brainManager: mockBrainManager as any,
      })
      logger.attach(bus)

      bus.tick()
      expect(mockBrainManager.executeSQL).not.toHaveBeenCalled()

      logger.detach(bus)
    })
  })

  describe('createRun()', () => {
    it('should insert a run record', async () => {
      const logger = new LoopLogger({
        ndjsonPath,
        brainManager: mockBrainManager as any,
      })
      await logger.createRun('run-001', 'test goal', { agents: [] })

      expect(mockBrainManager.executeSQL).toHaveBeenCalledTimes(1)
      const sql = mockBrainManager.executeSQL.mock.calls[0]![0] as string
      expect(sql).toContain('INSERT INTO runs')
      expect(sql).toContain('run-001')
      expect(sql).toContain('test goal')
    })

    it('should handle null goal', async () => {
      const logger = new LoopLogger({
        ndjsonPath,
        brainManager: mockBrainManager as any,
      })
      await logger.createRun('run-001')

      const sql = mockBrainManager.executeSQL.mock.calls[0]![0] as string
      expect(sql).toContain('NULL')
    })

    it('should not throw when db9 fails', async () => {
      mockBrainManager.executeSQL.mockRejectedValue(new Error('db9 down'))
      const logger = new LoopLogger({
        ndjsonPath,
        brainManager: mockBrainManager as any,
      })
      // Should not throw
      await logger.createRun('run-001', 'test')
    })

    it('should skip when brainManager not initialized', async () => {
      mockBrainManager.isInitialized = false
      const logger = new LoopLogger({
        ndjsonPath,
        brainManager: mockBrainManager as any,
      })
      await logger.createRun('run-001')
      expect(mockBrainManager.executeSQL).not.toHaveBeenCalled()
    })
  })

  describe('finalizeRun()', () => {
    it('should update run record with stats', async () => {
      const logger = new LoopLogger({
        ndjsonPath,
        brainManager: mockBrainManager as any,
      })
      await logger.finalizeRun('run-001', {
        totalLoops: 100,
        productiveLoops: 85,
        totalTokens: 500000,
        totalCostUsd: 12.5,
        exitReason: 'manual',
      })

      const sql = mockBrainManager.executeSQL.mock.calls[0]![0] as string
      expect(sql).toContain('UPDATE runs SET')
      expect(sql).toContain('total_loops = 100')
      expect(sql).toContain('productive_loops = 85')
      expect(sql).toContain('total_tokens = 500000')
      expect(sql).toContain("exit_reason = 'manual'")
    })

    it('should not throw when db9 fails', async () => {
      mockBrainManager.executeSQL.mockRejectedValue(new Error('db9 down'))
      const logger = new LoopLogger({
        ndjsonPath,
        brainManager: mockBrainManager as any,
      })
      await logger.finalizeRun('run-001', {
        totalLoops: 10, productiveLoops: 8, totalTokens: 1000,
        totalCostUsd: 0.5, exitReason: 'error_limit',
      })
    })
  })

  describe('detach()', () => {
    it('should stop receiving events after detach', () => {
      const bus = new LoopEventBus('run-001')
      const logger = new LoopLogger({ ndjsonPath })
      logger.attach(bus)

      bus.tick()
      logger.detach(bus)
      bus.tick()

      const lines = readFileSync(ndjsonPath, 'utf-8').trim().split('\n')
      expect(lines).toHaveLength(1) // only the first tick
    })
  })

  describe('external HTTP hook', () => {
    it('should POST to hookUrl on loop.classified events', async () => {
      const fetchCalls: Array<{ url: string; body: string }> = []
      vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
        fetchCalls.push({ url, body: init.body as string })
        return { ok: true, status: 200 }
      }))

      const bus = new LoopEventBus('run-001')
      const logger = new LoopLogger({
        ndjsonPath,
        hookUrl: 'http://localhost:9999/hook',
      })
      logger.attach(bus)

      bus.tick()
      bus.classify([])

      await new Promise(r => setTimeout(r, 50))

      expect(fetchCalls).toHaveLength(1)
      expect(fetchCalls[0]!.url).toBe('http://localhost:9999/hook')
      const payload = JSON.parse(fetchCalls[0]!.body)
      expect(payload.type).toBe('loop.classified')
      expect(payload.classification).toBe('idle')

      logger.detach(bus)
      vi.unstubAllGlobals()
    })

    it('should NOT POST for non-classified events', async () => {
      const fetchCalls: unknown[] = []
      vi.stubGlobal('fetch', vi.fn(async () => {
        fetchCalls.push(1)
        return { ok: true }
      }))

      const bus = new LoopEventBus('run-001')
      const logger = new LoopLogger({
        ndjsonPath,
        hookUrl: 'http://localhost:9999/hook',
      })
      logger.attach(bus)

      bus.tick() // loop.tick — should NOT trigger hook

      await new Promise(r => setTimeout(r, 50))

      expect(fetchCalls).toHaveLength(0)

      logger.detach(bus)
      vi.unstubAllGlobals()
    })

    it('should not throw when hook POST fails', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('connection refused') }))

      const bus = new LoopEventBus('run-001')
      const logger = new LoopLogger({
        ndjsonPath,
        hookUrl: 'http://localhost:9999/hook',
      })
      logger.attach(bus)

      // Should not throw
      bus.tick()
      bus.classify([])

      await new Promise(r => setTimeout(r, 50))

      logger.detach(bus)
      vi.unstubAllGlobals()
    })

    it('should read hookUrl from WANMAN_LOOP_HOOK env', async () => {
      const origEnv = process.env['WANMAN_LOOP_HOOK']
      process.env['WANMAN_LOOP_HOOK'] = 'http://env-hook:8080/events'

      const fetchCalls: string[] = []
      vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        fetchCalls.push(url)
        return { ok: true }
      }))

      const bus = new LoopEventBus('run-001')
      const logger = new LoopLogger({ ndjsonPath }) // no explicit hookUrl
      logger.attach(bus)

      bus.tick()
      bus.classify([])

      await new Promise(r => setTimeout(r, 50))

      expect(fetchCalls[0]).toBe('http://env-hook:8080/events')

      logger.detach(bus)
      vi.unstubAllGlobals()
      if (origEnv === undefined) delete process.env['WANMAN_LOOP_HOOK']
      else process.env['WANMAN_LOOP_HOOK'] = origEnv
    })
  })

  describe('db9 write with classification event', () => {
    it('should include classification in the SQL', async () => {
      const bus = new LoopEventBus('run-001')
      const logger = new LoopLogger({
        ndjsonPath,
        brainManager: mockBrainManager as any,
      })
      logger.attach(bus)

      bus.tick()
      bus.classify([])

      await new Promise(r => setTimeout(r, 10))

      // Find the loop.classified insert
      const classifiedCall = mockBrainManager.executeSQL.mock.calls
        .find(c => (c[0] as string).includes('loop.classified'))
      expect(classifiedCall).toBeDefined()
      expect(classifiedCall![0]).toContain("'idle'") // classification

      logger.detach(bus)
    })
  })
})

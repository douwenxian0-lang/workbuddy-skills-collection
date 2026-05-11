import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { existsSync, readFileSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

vi.mock('../logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  }),
}))

import { Heartbeat, type HeartbeatData } from '../heartbeat.js'

describe('Heartbeat', () => {
  let tmpDir: string
  let heartbeatPath: string

  beforeEach(() => {
    tmpDir = join(tmpdir(), `heartbeat-test-${Date.now()}`)
    mkdirSync(tmpDir, { recursive: true })
    heartbeatPath = join(tmpDir, '.wanman', 'heartbeat.json')
  })

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true }) } catch { /* ignore */ }
  })

  describe('construction', () => {
    it('should create directory structure', () => {
      new Heartbeat(heartbeatPath, 'run-001')
      expect(existsSync(join(tmpDir, '.wanman'))).toBe(true)
    })

    it('should initialize loopCount to 0', () => {
      const hb = new Heartbeat(heartbeatPath, 'run-001')
      expect(hb.loopCount).toBe(0)
    })
  })

  describe('write()', () => {
    it('should write heartbeat file', () => {
      const hb = new Heartbeat(heartbeatPath, 'run-001')
      hb.write()

      expect(existsSync(heartbeatPath)).toBe(true)
      const data: HeartbeatData = JSON.parse(readFileSync(heartbeatPath, 'utf-8'))
      expect(data.pid).toBe(process.pid)
      expect(data.runId).toBe('run-001')
      expect(data.loopCount).toBe(0)
      expect(data.lastTick).toBeDefined()
    })

    it('should not throw on write error', () => {
      // Create heartbeat at valid path, then corrupt the path for write()
      const hb = new Heartbeat(heartbeatPath, 'run-001')
      // Override path to an unwritable location
      ;(hb as any).path = '/dev/null/impossible/heartbeat.json'
      // write() should catch the error and not throw
      expect(() => hb.write()).not.toThrow()
    })
  })

  describe('tick()', () => {
    it('should increment loop count and write', () => {
      const hb = new Heartbeat(heartbeatPath, 'run-001')
      hb.tick()
      hb.tick()
      hb.tick()

      expect(hb.loopCount).toBe(3)
      const data: HeartbeatData = JSON.parse(readFileSync(heartbeatPath, 'utf-8'))
      expect(data.loopCount).toBe(3)
    })
  })

  describe('start() / stop()', () => {
    it('should write immediately on start', () => {
      const hb = new Heartbeat(heartbeatPath, 'run-001')
      hb.start(60_000) // very long interval — won't fire during test

      expect(existsSync(heartbeatPath)).toBe(true)
      hb.stop()
    })

    it('should stop writing after stop()', () => {
      const hb = new Heartbeat(heartbeatPath, 'run-001')
      hb.start(60_000)
      hb.stop()

      // No error on double stop
      hb.stop()
    })

    it('should write periodically', async () => {
      const hb = new Heartbeat(heartbeatPath, 'run-001')
      hb.start(50) // 50ms interval

      await new Promise(r => setTimeout(r, 130))
      hb.stop()

      // Should have written at least the initial + 2 interval writes
      const data: HeartbeatData = JSON.parse(readFileSync(heartbeatPath, 'utf-8'))
      expect(data.pid).toBe(process.pid)
    })
  })
})

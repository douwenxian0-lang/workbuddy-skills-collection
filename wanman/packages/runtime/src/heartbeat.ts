/**
 * Heartbeat — periodic file-based liveness signal.
 *
 * Writes .wanman/heartbeat.json at regular intervals so external processes
 * can detect if the system is hung (gstack inspiration).
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createLogger } from './logger.js'

const log = createLogger('heartbeat')

export interface HeartbeatData {
  pid: number
  runId: string
  lastTick: string
  loopCount: number
}

export class Heartbeat {
  private path: string
  private runId: string
  private timer: ReturnType<typeof setInterval> | null = null
  private _loopCount = 0

  constructor(path: string, runId: string) {
    this.path = path
    this.runId = runId
    mkdirSync(dirname(this.path), { recursive: true })
  }

  get loopCount(): number { return this._loopCount }

  /** Start periodic heartbeat writes */
  start(intervalMs = 5_000): void {
    this.write()
    this.timer = setInterval(() => this.write(), intervalMs)
    // Don't keep the process alive just for heartbeat
    if (this.timer.unref) this.timer.unref()
  }

  /** Stop heartbeat writes */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /** Update loop count (call on each loop tick) */
  tick(): void {
    this._loopCount++
    this.write()
  }

  /** Write heartbeat to file */
  write(): void {
    const data: HeartbeatData = {
      pid: process.pid,
      runId: this.runId,
      lastTick: new Date().toISOString(),
      loopCount: this._loopCount,
    }
    try {
      writeFileSync(this.path, JSON.stringify(data, null, 2) + '\n')
    } catch (err) {
      // Non-fatal: heartbeat write failure should never crash the system
      log.warn('heartbeat write failed', { error: String(err) })
    }
  }
}

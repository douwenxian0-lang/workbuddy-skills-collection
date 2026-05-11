/**
 * LoopLogger — dual-write persistence for loop events.
 *
 * Local: NDJSON file (must succeed — the safety net)
 * db9:   loop_events table (best-effort, non-fatal)
 *
 * Design: mails.dev dual-write pattern + gstack non-blocking observability
 */

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { LoopEventBus } from './loop-event-bus.js'
import type { LoopEvent } from './loop-events.js'
import type { BrainManager } from './brain-manager.js'
import { esc } from './sql-escape.js'
import { createLogger } from './logger.js'

const log = createLogger('loop-logger')

/** Ring buffer: keeps last N events in memory */
export class RingBuffer<T> {
  private buffer: (T | undefined)[]
  private head = 0
  private _size = 0

  constructor(readonly capacity: number) {
    this.buffer = new Array(capacity)
  }

  push(item: T): void {
    this.buffer[this.head] = item
    this.head = (this.head + 1) % this.capacity
    if (this._size < this.capacity) this._size++
  }

  get size(): number { return this._size }

  /** Return items from oldest to newest */
  toArray(): T[] {
    if (this._size === 0) return []
    const result: T[] = []
    const start = this._size < this.capacity ? 0 : this.head
    for (let i = 0; i < this._size; i++) {
      const idx = (start + i) % this.capacity
      result.push(this.buffer[idx] as T)
    }
    return result
  }
}

export interface LoopLoggerOptions {
  /** Path to NDJSON output file */
  ndjsonPath: string
  /** BrainManager for db9 writes (optional — if null, only local writes) */
  brainManager?: BrainManager | null
  /** Ring buffer capacity (default: 1000) */
  bufferCapacity?: number
  /** External HTTP hook URL (env: WANMAN_LOOP_HOOK). POST JSON on each loop.classified event. */
  hookUrl?: string
}

export class LoopLogger {
  private ndjsonPath: string
  private tsvPath: string
  private brainManager: BrainManager | null
  private ringBuffer: RingBuffer<LoopEvent>
  private hookUrl: string | null
  private listener: ((event: LoopEvent) => void) | null = null

  constructor(options: LoopLoggerOptions) {
    this.ndjsonPath = options.ndjsonPath
    this.tsvPath = join(dirname(options.ndjsonPath), 'results.tsv')
    this.brainManager = options.brainManager ?? null
    this.ringBuffer = new RingBuffer(options.bufferCapacity ?? 1000)
    this.hookUrl = options.hookUrl ?? process.env['WANMAN_LOOP_HOOK'] ?? null

    // Ensure output directory exists
    mkdirSync(dirname(this.ndjsonPath), { recursive: true })
  }

  /** Subscribe to an event bus and start logging */
  attach(bus: LoopEventBus): void {
    this.listener = (event: LoopEvent) => this.handleEvent(event, bus.runId)
    bus.on(this.listener)
  }

  /** Unsubscribe from the event bus */
  detach(bus: LoopEventBus): void {
    if (this.listener) {
      bus.off(this.listener)
      this.listener = null
    }
  }

  /** Get recent events from the ring buffer */
  recentEvents(): LoopEvent[] {
    return this.ringBuffer.toArray()
  }

  /** Create a run record in db9 */
  async createRun(runId: string, goal?: string, config?: Record<string, unknown>): Promise<void> {
    if (!this.brainManager?.isInitialized) return
    const sql = `INSERT INTO runs (id, goal, config) VALUES ('${esc(runId)}', ${goal ? `'${esc(goal)}'` : 'NULL'}, ${config ? `'${esc(JSON.stringify(config))}'::jsonb` : 'NULL'}) ON CONFLICT (id) DO NOTHING`
    try {
      await this.brainManager.executeSQL(sql)
    } catch (err) {
      log.warn('failed to create run record in db9', { runId, error: String(err) })
    }
  }

  /** Update a run record with final stats */
  async finalizeRun(
    runId: string,
    stats: { totalLoops: number; productiveLoops: number; totalTokens: number; totalCostUsd: number; exitReason: string },
  ): Promise<void> {
    if (!this.brainManager?.isInitialized) return
    const sql = `UPDATE runs SET ended_at = now(), total_loops = ${stats.totalLoops}, productive_loops = ${stats.productiveLoops}, total_tokens = ${stats.totalTokens}, total_cost_usd = ${stats.totalCostUsd}, exit_reason = '${esc(stats.exitReason)}' WHERE id = '${esc(runId)}'`
    try {
      await this.brainManager.executeSQL(sql)
    } catch (err) {
      log.warn('failed to finalize run record in db9', { runId, error: String(err) })
    }
  }

  private handleEvent(event: LoopEvent, runId: string): void {
    // 1. Ring buffer (always)
    this.ringBuffer.push(event)

    // 2. Local NDJSON (must succeed)
    try {
      appendFileSync(this.ndjsonPath, JSON.stringify(event) + '\n')
    } catch (err) {
      log.error('NDJSON write failed', { error: String(err) })
    }

    // 3. db9 (best-effort, non-fatal)
    if (this.brainManager?.isInitialized) {
      this.writeToDb9(event, runId).catch(err => {
        log.warn('db9 loop event write failed', { type: event.type, error: String(err) })
      })
    }

    // 4. results.tsv summary (autoresearch-style, only on loop.classified)
    if (event.type === 'loop.classified') {
      try {
        this.appendTsv(event as LoopEvent & { classification: string; reasons: string[]; loop: number }, runId)
      } catch (err) {
        log.warn('results.tsv write failed', { error: String(err) })
      }
    }

    // 5. External HTTP hook (best-effort, only on loop.classified)
    if (this.hookUrl && event.type === 'loop.classified') {
      this.postHook(event).catch(err => {
        log.warn('loop hook POST failed', { url: this.hookUrl, error: String(err) })
      })
    }
  }

  /** Append a single-line summary to results.tsv (autoresearch-style) */
  private appendTsv(event: { classification: string; reasons: string[]; loop: number; runId: string; timestamp: string }, runId: string): void {
    // Write header if file doesn't exist
    if (!existsSync(this.tsvPath)) {
      appendFileSync(this.tsvPath, 'run_id\tloop\tclassification\ttasks_created\ttasks_done\tcompletion_rate\treasons\ttimestamp\n')
    }
    const reasons = event.reasons.join('; ').replace(/\t/g, ' ')
    const tc = this._taskSnapshot.created
    const td = this._taskSnapshot.done
    const rate = tc > 0 ? Math.round((td / tc) * 100) : 0
    appendFileSync(this.tsvPath, `${runId}\t${event.loop}\t${event.classification}\t${tc}\t${td}\t${rate}%\t${reasons}\t${event.timestamp}\n`)
  }

  /** Task snapshot — updated externally by CLI each loop */
  private _taskSnapshot = { created: 0, done: 0 }

  /** Update task snapshot (call before classify each loop) */
  updateTaskSnapshot(created: number, done: number): void {
    this._taskSnapshot = { created, done }
  }

  private async postHook(event: LoopEvent): Promise<void> {
    const resp = await fetch(this.hookUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(5_000),
    })
    if (!resp.ok) {
      log.warn('loop hook returned non-OK', { status: resp.status })
    }
  }

  private async writeToDb9(event: LoopEvent, runId: string): Promise<void> {
    const loop = 'loop' in event ? event.loop : 0
    const agent = 'agent' in event ? (event as { agent?: string }).agent : null
    const classification = event.type === 'loop.classified'
      ? (event as { classification: string }).classification
      : null

    const sql = `INSERT INTO loop_events (run_id, loop_number, event_type, classification, agent, payload) VALUES ('${esc(runId)}', ${loop}, '${esc(event.type)}', ${classification ? `'${esc(classification)}'` : 'NULL'}, ${agent ? `'${esc(agent)}'` : 'NULL'}, '${esc(JSON.stringify(event))}'::jsonb)`

    await this.brainManager!.executeSQL(sql)
  }
}

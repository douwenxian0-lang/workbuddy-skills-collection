import { EventEmitter } from 'node:events'
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type LoopClassification =
  | 'productive'
  | 'idle'
  | 'blocked'
  | 'backlog_stuck'
  | 'error'

export interface LoopTick {
  type: 'loop.tick'
  runId: string
  loop: number
  timestamp: string
}

export interface LoopClassified {
  type: 'loop.classified'
  runId: string
  loop: number
  classification: LoopClassification
  reasons: string[]
  timestamp: string
}

export interface AgentSpawned {
  type: 'agent.spawned'
  runId: string
  loop: number
  agent: string
  lifecycle: '24/7' | 'on-demand'
  trigger: 'startup' | 'message' | 'steer' | 'cron' | 'backlog-drain'
  timestamp: string
}

export interface TaskTransition {
  type: 'task.transition'
  runId: string
  loop: number
  taskId: number
  assignee?: string
  from: string
  to: string
  timestamp: string
}

export interface TaskBlocked {
  type: 'task.blocked'
  runId: string
  loop: number
  taskId: number
  assignee?: string
  waitingOn: number[]
  timestamp: string
}

export interface QueueBacklog {
  type: 'queue.backlog'
  runId: string
  loop: number
  agent: string
  pendingMessages: number
  timestamp: string
}

export interface ArtifactCreated {
  type: 'artifact.created'
  runId: string
  loop: number
  agent: string
  kind: string
  path?: string
  timestamp: string
}

export type LoopEvent =
  | LoopTick
  | LoopClassified
  | AgentSpawned
  | TaskTransition
  | TaskBlocked
  | QueueBacklog
  | ArtifactCreated

export class LoopEventBus {
  private emitter = new EventEmitter()
  private currentLoopValue = 0
  private taskTransitions = 0
  private artifactsCreated = 0
  private agentSpawns = 0
  private errors = 0
  private pendingMessages: Record<string, number> = {}
  private blockedTasks = 0

  constructor(private readonly currentRunId: string) {
    this.emitter.setMaxListeners(20)
  }

  get runId(): string {
    return this.currentRunId
  }

  get currentLoop(): number {
    return this.currentLoopValue
  }

  on(listener: (event: LoopEvent) => void): void {
    this.emitter.on('event', listener)
  }

  off(listener: (event: LoopEvent) => void): void {
    this.emitter.off('event', listener)
  }

  emit(event: LoopEvent): void {
    switch (event.type) {
      case 'task.transition':
        this.taskTransitions++
        break
      case 'artifact.created':
        this.artifactsCreated++
        break
      case 'agent.spawned':
        this.agentSpawns++
        break
      case 'task.blocked':
        this.blockedTasks++
        break
      case 'queue.backlog':
        this.pendingMessages[event.agent] = event.pendingMessages
        break
    }

    try {
      this.emitter.emit('event', event)
    } catch {
      // Observability is best-effort and should never fail the run.
    }
  }

  tick(): void {
    this.currentLoopValue++
    this.taskTransitions = 0
    this.artifactsCreated = 0
    this.agentSpawns = 0
    this.errors = 0
    this.pendingMessages = {}
    this.blockedTasks = 0

    this.emit({
      type: 'loop.tick',
      runId: this.currentRunId,
      loop: this.currentLoopValue,
      timestamp: new Date().toISOString(),
    })
  }

  classify(agentStates: Array<{ name: string; state: string; lifecycle: string }>): LoopClassified {
    const { classification, reasons } = this.computeClassification(agentStates)
    const event: LoopClassified = {
      type: 'loop.classified',
      runId: this.currentRunId,
      loop: this.currentLoopValue,
      classification,
      reasons,
      timestamp: new Date().toISOString(),
    }
    this.emit(event)
    return event
  }

  recordError(): void {
    this.errors++
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners()
  }

  private computeClassification(
    agentStates: Array<{ name: string; state: string; lifecycle: string }>,
  ): { classification: LoopClassification; reasons: string[] } {
    const reasons: string[] = []

    if (this.errors > 0) {
      reasons.push(`${this.errors} error(s) in this loop`)
      return { classification: 'error', reasons }
    }

    if (this.taskTransitions > 0 || this.artifactsCreated > 0) {
      if (this.taskTransitions > 0) reasons.push(`${this.taskTransitions} task transition(s)`)
      if (this.artifactsCreated > 0) reasons.push(`${this.artifactsCreated} artifact(s) created`)
      return { classification: 'productive', reasons }
    }

    const stuckAgents = Object.entries(this.pendingMessages).filter(([, count]) => count > 0)
    if (stuckAgents.length > 0) {
      for (const [agent, count] of stuckAgents) {
        reasons.push(`${agent} has ${count} pending message(s) while idle`)
      }
      return { classification: 'backlog_stuck', reasons }
    }

    if (this.blockedTasks > 0) {
      reasons.push(`${this.blockedTasks} task(s) blocked by dependencies`)
      return { classification: 'blocked', reasons }
    }

    reasons.push('no state changes detected')
    return { classification: 'idle', reasons }
  }
}

class RingBuffer<T> {
  private buffer: (T | undefined)[]
  private head = 0
  private sizeValue = 0

  constructor(private readonly capacity: number) {
    this.buffer = new Array(capacity)
  }

  push(item: T): void {
    this.buffer[this.head] = item
    this.head = (this.head + 1) % this.capacity
    if (this.sizeValue < this.capacity) this.sizeValue++
  }

  toArray(): T[] {
    if (this.sizeValue === 0) return []
    const result: T[] = []
    const start = this.sizeValue < this.capacity ? 0 : this.head
    for (let i = 0; i < this.sizeValue; i++) {
      const index = (start + i) % this.capacity
      result.push(this.buffer[index] as T)
    }
    return result
  }
}

export interface LoopLoggerOptions {
  ndjsonPath: string
  bufferCapacity?: number
}

export class LoopLogger {
  private readonly ringBuffer: RingBuffer<LoopEvent>
  private readonly tsvPath: string
  private listener: ((event: LoopEvent) => void) | null = null
  private taskSnapshot = { created: 0, done: 0 }

  constructor(private readonly options: LoopLoggerOptions) {
    mkdirSync(dirname(options.ndjsonPath), { recursive: true })
    this.ringBuffer = new RingBuffer(options.bufferCapacity ?? 1000)
    this.tsvPath = join(dirname(options.ndjsonPath), 'results.tsv')
  }

  attach(bus: LoopEventBus): void {
    this.listener = event => this.handleEvent(event, bus.runId)
    bus.on(this.listener)
  }

  detach(bus: LoopEventBus): void {
    if (!this.listener) return
    bus.off(this.listener)
    this.listener = null
  }

  recentEvents(): LoopEvent[] {
    return this.ringBuffer.toArray()
  }

  updateTaskSnapshot(created: number, done: number): void {
    this.taskSnapshot = { created, done }
  }

  private handleEvent(event: LoopEvent, runId: string): void {
    this.ringBuffer.push(event)

    try {
      appendFileSync(this.options.ndjsonPath, JSON.stringify(event) + '\n')
    } catch {
      // The dashboard should still continue even if local logging fails.
    }

    if (event.type === 'loop.classified') {
      this.appendTsv(event, runId)
    }
  }

  private appendTsv(event: LoopClassified, runId: string): void {
    try {
      if (!existsSync(this.tsvPath)) {
        writeFileSync(this.tsvPath, 'run_id\tloop\tclassification\ttasks_created\ttasks_done\tcompletion_rate\treasons\ttimestamp\n')
      }

      const reasons = event.reasons.join('; ').replace(/\t/g, ' ')
      const completionRate = this.taskSnapshot.created > 0
        ? Math.round((this.taskSnapshot.done / this.taskSnapshot.created) * 100)
        : 0

      appendFileSync(
        this.tsvPath,
        `${runId}\t${event.loop}\t${event.classification}\t${this.taskSnapshot.created}\t${this.taskSnapshot.done}\t${completionRate}%\t${reasons}\t${event.timestamp}\n`,
      )
    } catch {
      // results.tsv is best-effort only.
    }
  }
}

export interface HeartbeatData {
  pid: number
  runId: string
  lastTick: string
  loopCount: number
}

export class Heartbeat {
  private timer: ReturnType<typeof setInterval> | null = null
  private loopCountValue = 0

  constructor(
    private readonly heartbeatPath: string,
    private readonly runId: string,
  ) {
    mkdirSync(dirname(this.heartbeatPath), { recursive: true })
  }

  get loopCount(): number {
    return this.loopCountValue
  }

  start(intervalMs = 5_000): void {
    this.write()
    this.timer = setInterval(() => this.write(), intervalMs)
    if (this.timer.unref) this.timer.unref()
  }

  stop(): void {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }

  tick(): void {
    this.loopCountValue++
    this.write()
  }

  private write(): void {
    const data: HeartbeatData = {
      pid: process.pid,
      runId: this.runId,
      lastTick: new Date().toISOString(),
      loopCount: this.loopCountValue,
    }

    try {
      writeFileSync(this.heartbeatPath, JSON.stringify(data, null, 2) + '\n')
    } catch {
      // Heartbeat is informational only.
    }
  }
}

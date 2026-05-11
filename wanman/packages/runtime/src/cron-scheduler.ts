// Cron Scheduler — triggers agents at scheduled times.
//
// Supports standard 5-field cron expressions:
//   minute hour day-of-month month day-of-week
//
// Examples:
//   '0 8 * * *'     — every day at 08:00
//   '0 * * * *'     — every hour at :00
//   '0 9 * * 1'     — every Monday at 09:00
//   '*/15 * * * *'  — every 15 minutes

import { createLogger } from './logger.js';

const log = createLogger('cron-scheduler');

/** Check interval — every 60 seconds */
const CHECK_INTERVAL_MS = 60_000;

export interface CronJob {
  /** Agent name */
  agent: string;
  /** Original cron expression */
  expression: string;
  /** Parsed schedule */
  schedule: ParsedCron;
}

interface ParsedCron {
  minutes: Set<number>;
  hours: Set<number>;
  daysOfMonth: Set<number>;
  months: Set<number>;
  daysOfWeek: Set<number>;
}

export type CronCallback = (agent: string, expression: string) => void;

export class CronScheduler {
  private jobs: CronJob[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private callback: CronCallback;
  private lastCheck: Date | null = null;

  constructor(callback: CronCallback) {
    this.callback = callback;
  }

  /** Register a cron job for an agent. */
  addJob(agent: string, expression: string): void {
    const schedule = parseCron(expression);
    this.jobs.push({ agent, expression, schedule });
    log.info('cron job registered', { agent, expression });
  }

  /** Start the scheduler loop. */
  start(): void {
    if (this.timer) return;

    // Set lastCheck to now so we don't fire immediately for all past times
    this.lastCheck = new Date();

    this.timer = setInterval(() => {
      this.tick();
    }, CHECK_INTERVAL_MS);

    // Don't keep the process alive just for this timer
    if (this.timer && typeof this.timer === 'object' && 'unref' in this.timer) {
      this.timer.unref();
    }

    log.info('cron scheduler started', { jobCount: this.jobs.length });
  }

  /** Stop the scheduler loop. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      log.info('cron scheduler stopped');
    }
  }

  /** Manual tick — check all jobs against current time. Exposed for testing. */
  tick(now?: Date): void {
    const current = now || new Date();

    for (const job of this.jobs) {
      if (matchesCron(job.schedule, current)) {
        log.info('cron triggered', { agent: job.agent, expression: job.expression });
        try {
          this.callback(job.agent, job.expression);
        } catch (err) {
          log.error('cron callback error', {
            agent: job.agent,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    this.lastCheck = current;
  }

  /** Get all registered jobs (for testing/debugging). */
  getJobs(): ReadonlyArray<CronJob> {
    return this.jobs;
  }
}

// ── Cron Expression Parser ──

// Parse a standard 5-field cron expression.
//
// Fields: minute(0-59) hour(0-23) day-of-month(1-31) month(1-12) day-of-week(0-6, 0=Sun)
//
// Supports: *, specific values, ranges (1-5), steps (star/15), lists (1,3,5)
export function parseCron(expression: string): ParsedCron {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: "${expression}" — expected 5 fields, got ${parts.length}`);
  }

  return {
    minutes: parseField(parts[0]!, 0, 59),
    hours: parseField(parts[1]!, 0, 23),
    daysOfMonth: parseField(parts[2]!, 1, 31),
    months: parseField(parts[3]!, 1, 12),
    daysOfWeek: parseField(parts[4]!, 0, 6),
  };
}

function parseField(field: string, min: number, max: number): Set<number> {
  const values = new Set<number>();

  for (const part of field.split(',')) {
    if (part === '*') {
      for (let i = min; i <= max; i++) values.add(i);
    } else if (part.includes('/')) {
      // Step values: */15 or 1-30/5
      const [rangePart, stepStr] = part.split('/');
      const step = parseInt(stepStr!, 10);
      if (isNaN(step) || step <= 0) {
        throw new Error(`Invalid step in cron field: "${part}"`);
      }

      let start = min;
      let end = max;
      if (rangePart !== '*') {
        if (rangePart!.includes('-')) {
          const [s, e] = rangePart!.split('-').map(Number);
          start = s!;
          end = e!;
        } else {
          start = parseInt(rangePart!, 10);
        }
      }

      for (let i = start; i <= end; i += step) {
        values.add(i);
      }
    } else if (part.includes('-')) {
      // Range: 1-5
      const [start, end] = part.split('-').map(Number);
      for (let i = start!; i <= end!; i++) {
        values.add(i);
      }
    } else {
      // Single value
      const val = parseInt(part, 10);
      if (isNaN(val) || val < min || val > max) {
        throw new Error(`Invalid value in cron field: "${part}" (valid range: ${min}-${max})`);
      }
      values.add(val);
    }
  }

  return values;
}

/** Check if a date matches a parsed cron schedule. */
export function matchesCron(schedule: ParsedCron, date: Date): boolean {
  return (
    schedule.minutes.has(date.getMinutes()) &&
    schedule.hours.has(date.getHours()) &&
    schedule.daysOfMonth.has(date.getDate()) &&
    schedule.months.has(date.getMonth() + 1) &&
    schedule.daysOfWeek.has(date.getDay())
  );
}

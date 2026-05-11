/**
 * SQLite-backed shared context store.
 * Simple key-value store for inter-agent shared state (MRR, error rate, etc.).
 */

import Database from 'better-sqlite3';
import type { ContextEntry } from '@wanman/core';
import { createLogger } from './logger.js';

const log = createLogger('context-store');

export class ContextStore {
  private db: Database.Database;
  private getStmt: Database.Statement;
  private setStmt: Database.Statement;
  private allStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.init();

    this.getStmt = this.db.prepare(`
      SELECT key, value, updated_by, updated_at
      FROM context WHERE key = ?
    `);

    this.setStmt = this.db.prepare(`
      INSERT INTO context (key, value, updated_by, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
    `);

    this.allStmt = this.db.prepare(`
      SELECT key, value, updated_by, updated_at FROM context
    `);
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS context (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    log.info('initialized');
  }

  get(key: string): ContextEntry | null {
    const row = this.getStmt.get(key) as { key: string; value: string; updated_by: string; updated_at: number } | undefined;
    if (!row) return null;
    return {
      key: row.key,
      value: row.value,
      updatedBy: row.updated_by,
      updatedAt: row.updated_at,
    };
  }

  set(key: string, value: string, agent: string): void {
    this.setStmt.run(key, value, agent, Date.now());
    log.info('set', { key, agent });
  }

  getAll(): ContextEntry[] {
    const rows = this.allStmt.all() as Array<{ key: string; value: string; updated_by: string; updated_at: number }>;
    return rows.map(r => ({
      key: r.key,
      value: r.value,
      updatedBy: r.updated_by,
      updatedAt: r.updated_at,
    }));
  }
}

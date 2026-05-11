import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { Initiative, InitiativeStatus } from '@wanman/core';

interface InitiativeRow {
  id: string;
  title: string;
  goal: string;
  summary: string;
  status: InitiativeStatus;
  priority: number;
  sources: string;
  created_by: string;
  created_at: number;
  updated_at: number;
}

type InitiativeCreateInput = Omit<Initiative, 'id' | 'createdAt' | 'updatedAt'>;
type InitiativeUpdateInput = Partial<Pick<Initiative, 'title' | 'goal' | 'summary' | 'status' | 'priority' | 'sources'>>;

function rowToInitiative(row: InitiativeRow): Initiative {
  return {
    id: row.id,
    title: row.title,
    goal: row.goal,
    summary: row.summary,
    status: row.status,
    priority: row.priority,
    sources: row.sources ? JSON.parse(row.sources) as string[] : [],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class InitiativeBoard {
  private db: Database.Database;
  private insertStmt!: Database.Statement;
  private getByIdStmt!: Database.Statement;
  private getByPrefixStmt!: Database.Statement;
  private listAllStmt!: Database.Statement;
  private updateStmt!: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.init();

    this.insertStmt = this.db.prepare(`
      INSERT INTO initiatives (id, title, goal, summary, status, priority, sources, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.getByIdStmt = this.db.prepare(`
      SELECT id, title, goal, summary, status, priority, sources, created_by, created_at, updated_at
      FROM initiatives WHERE id = ?
    `);

    this.getByPrefixStmt = this.db.prepare(`
      SELECT id, title, goal, summary, status, priority, sources, created_by, created_at, updated_at
      FROM initiatives WHERE id LIKE ? || '%'
    `);

    this.listAllStmt = this.db.prepare(`
      SELECT id, title, goal, summary, status, priority, sources, created_by, created_at, updated_at
      FROM initiatives ORDER BY priority DESC, created_at ASC
    `);

    this.updateStmt = this.db.prepare(`
      UPDATE initiatives
      SET title = ?, goal = ?, summary = ?, status = ?, priority = ?, sources = ?, updated_at = ?
      WHERE id = ?
    `);
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS initiatives (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        goal TEXT NOT NULL,
        summary TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('active', 'paused', 'completed', 'abandoned')),
        priority INTEGER NOT NULL,
        sources TEXT NOT NULL DEFAULT '[]',
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_initiatives_status ON initiatives(status)
    `);
  }

  resolveId(idOrPrefix: string): string | null {
    if (idOrPrefix.length === 36) return idOrPrefix;
    const rows = this.getByPrefixStmt.all(idOrPrefix) as InitiativeRow[];
    if (rows.length === 1) return rows[0]!.id;
    return null;
  }

  get(idOrPrefix: string): Initiative | null {
    const row = this.getByIdStmt.get(idOrPrefix) as InitiativeRow | undefined;
    if (row) return rowToInitiative(row);
    const fullId = this.resolveId(idOrPrefix);
    if (!fullId) return null;
    const resolved = this.getByIdStmt.get(fullId) as InitiativeRow | undefined;
    return resolved ? rowToInitiative(resolved) : null;
  }

  async create(input: InitiativeCreateInput): Promise<Initiative> {
    const id = randomUUID();
    const now = Date.now();
    this.insertStmt.run(
      id,
      input.title,
      input.goal,
      input.summary,
      input.status,
      input.priority,
      JSON.stringify(input.sources),
      input.createdBy,
      now,
      now,
    );
    return this.get(id)!;
  }

  async update(idOrPrefix: string, updates: InitiativeUpdateInput): Promise<Initiative> {
    const existing = this.get(idOrPrefix);
    if (!existing) {
      throw new Error(`Initiative not found: ${idOrPrefix}`);
    }
    const now = Date.now();
    this.updateStmt.run(
      updates.title ?? existing.title,
      updates.goal ?? existing.goal,
      updates.summary ?? existing.summary,
      updates.status ?? existing.status,
      updates.priority ?? existing.priority,
      JSON.stringify(updates.sources ?? existing.sources),
      now,
      existing.id,
    );
    return this.get(existing.id)!;
  }

  listSync(): Initiative[] {
    return (this.listAllStmt.all() as InitiativeRow[]).map(rowToInitiative);
  }

  async list(filter?: { status?: InitiativeStatus }): Promise<Initiative[]> {
    if (!filter?.status) {
      return this.listSync();
    }
    const stmt = this.db.prepare(`
      SELECT id, title, goal, summary, status, priority, sources, created_by, created_at, updated_at
      FROM initiatives
      WHERE status = ?
      ORDER BY priority DESC, created_at ASC
    `);
    return (stmt.all(filter.status) as InitiativeRow[]).map(rowToInitiative);
  }
}

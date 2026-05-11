import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { ChangeCapsule, ChangeCapsuleStatus, TaskScopeType } from '@wanman/core';

export type CapsuleConflictLevel = 'parallel_ok' | 'weak_conflict' | 'high_conflict';

export interface CapsuleConflict {
  capsule: ChangeCapsule;
  level: CapsuleConflictLevel;
  reason: string;
}

interface CapsuleRow {
  id: string;
  goal: string;
  owner_agent: string;
  branch: string;
  base_commit: string;
  allowed_paths: string;
  acceptance: string;
  reviewer: string;
  status: ChangeCapsuleStatus;
  initiative_id: string | null;
  task_id: string | null;
  subsystem: string | null;
  scope_type: TaskScopeType | null;
  blocked_by: string | null;
  supersedes: string | null;
  created_at: number;
  updated_at: number;
}

type CapsuleCreateInput = Omit<ChangeCapsule, 'id' | 'createdAt' | 'updatedAt'>;
type CapsuleUpdateInput = Partial<Omit<ChangeCapsule, 'id' | 'createdAt' | 'updatedAt'>>;

const ACTIVE_STATUSES: ChangeCapsuleStatus[] = ['open', 'in_review'];
const HOT_PATHS = [
  'packages/runtime/src/supervisor.ts',
  'packages/cli/src/commands/run.ts',
  'packages/cli/src/commands/takeover.ts',
  'packages/core/src/agents/registry.ts',
];

function rowToCapsule(row: CapsuleRow): ChangeCapsule {
  const capsule: ChangeCapsule = {
    id: row.id,
    goal: row.goal,
    ownerAgent: row.owner_agent,
    branch: row.branch,
    baseCommit: row.base_commit,
    allowedPaths: row.allowed_paths ? JSON.parse(row.allowed_paths) as string[] : [],
    acceptance: row.acceptance,
    reviewer: row.reviewer,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.initiative_id != null) capsule.initiativeId = row.initiative_id;
  if (row.task_id != null) capsule.taskId = row.task_id;
  if (row.subsystem != null) capsule.subsystem = row.subsystem;
  if (row.scope_type != null) capsule.scopeType = row.scope_type;
  if (row.blocked_by != null) capsule.blockedBy = JSON.parse(row.blocked_by) as string[];
  if (row.supersedes != null) capsule.supersedes = row.supersedes;
  return capsule;
}

function normalizeDir(pathValue: string): string {
  const parts = pathValue.split('/').filter(Boolean);
  return parts.slice(0, -1).join('/');
}

function isHotPath(pathValue: string): boolean {
  return HOT_PATHS.some(hot => pathValue === hot || pathValue.startsWith(`${hot}/`));
}

function classifyConflict(a: ChangeCapsule, b: ChangeCapsule): CapsuleConflictLevel {
  const pathsA = new Set(a.allowedPaths);
  const pathsB = new Set(b.allowedPaths);

  for (const pathValue of pathsA) {
    if (pathsB.has(pathValue)) return 'high_conflict';
  }

  const touchesHotA = [...pathsA].some(isHotPath);
  const touchesHotB = [...pathsB].some(isHotPath);
  if (touchesHotA && touchesHotB) return 'high_conflict';

  if (a.subsystem && b.subsystem && a.subsystem === b.subsystem) {
    return 'weak_conflict';
  }

  const dirsB = new Set([...pathsB].map(normalizeDir).filter(Boolean));
  const hasSharedDir = [...pathsA]
    .map(normalizeDir)
    .filter(Boolean)
    .some(dir => dirsB.has(dir));
  if (hasSharedDir) return 'weak_conflict';

  return 'parallel_ok';
}

export class ChangeCapsulePool {
  private db: Database.Database;
  private insertStmt!: Database.Statement;
  private getByIdStmt!: Database.Statement;
  private getByPrefixStmt!: Database.Statement;
  private listAllStmt!: Database.Statement;
  private updateStmt!: Database.Statement;
  private activeCapsulesStmt!: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.init();

    this.insertStmt = this.db.prepare(`
      INSERT INTO change_capsules (
        id, goal, owner_agent, branch, base_commit, allowed_paths, acceptance, reviewer, status,
        initiative_id, task_id, subsystem, scope_type, blocked_by, supersedes, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.getByIdStmt = this.db.prepare(`
      SELECT id, goal, owner_agent, branch, base_commit, allowed_paths, acceptance, reviewer, status,
             initiative_id, task_id, subsystem, scope_type, blocked_by, supersedes, created_at, updated_at
      FROM change_capsules WHERE id = ?
    `);

    this.getByPrefixStmt = this.db.prepare(`
      SELECT id, goal, owner_agent, branch, base_commit, allowed_paths, acceptance, reviewer, status,
             initiative_id, task_id, subsystem, scope_type, blocked_by, supersedes, created_at, updated_at
      FROM change_capsules WHERE id LIKE ? || '%'
    `);

    this.listAllStmt = this.db.prepare(`
      SELECT id, goal, owner_agent, branch, base_commit, allowed_paths, acceptance, reviewer, status,
             initiative_id, task_id, subsystem, scope_type, blocked_by, supersedes, created_at, updated_at
      FROM change_capsules ORDER BY created_at ASC
    `);

    const placeholders = ACTIVE_STATUSES.map(() => '?').join(', ');
    this.activeCapsulesStmt = this.db.prepare(`
      SELECT id, goal, owner_agent, branch, base_commit, allowed_paths, acceptance, reviewer, status,
             initiative_id, task_id, subsystem, scope_type, blocked_by, supersedes, created_at, updated_at
      FROM change_capsules WHERE status IN (${placeholders})
    `);

    this.updateStmt = this.db.prepare(`
      UPDATE change_capsules
      SET goal = ?, owner_agent = ?, branch = ?, base_commit = ?, allowed_paths = ?, acceptance = ?, reviewer = ?,
          status = ?, initiative_id = ?, task_id = ?, subsystem = ?, scope_type = ?, blocked_by = ?, supersedes = ?,
          updated_at = ?
      WHERE id = ?
    `);
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS change_capsules (
        id TEXT PRIMARY KEY,
        goal TEXT NOT NULL,
        owner_agent TEXT NOT NULL,
        branch TEXT NOT NULL,
        base_commit TEXT NOT NULL,
        allowed_paths TEXT NOT NULL DEFAULT '[]',
        acceptance TEXT NOT NULL,
        reviewer TEXT NOT NULL DEFAULT 'cto',
        status TEXT NOT NULL CHECK(status IN ('open', 'in_review', 'merged', 'abandoned')),
        initiative_id TEXT,
        task_id TEXT,
        subsystem TEXT,
        scope_type TEXT CHECK(scope_type IN ('code', 'docs', 'tests', 'ops', 'mixed')),
        blocked_by TEXT,
        supersedes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_change_capsules_status ON change_capsules(status)
    `);
  }

  resolveId(idOrPrefix: string): string | null {
    if (idOrPrefix.length === 36) return idOrPrefix;
    const rows = this.getByPrefixStmt.all(idOrPrefix) as CapsuleRow[];
    if (rows.length === 1) return rows[0]!.id;
    return null;
  }

  get(idOrPrefix: string): ChangeCapsule | null {
    const row = this.getByIdStmt.get(idOrPrefix) as CapsuleRow | undefined;
    if (row) return rowToCapsule(row);
    const fullId = this.resolveId(idOrPrefix);
    if (!fullId) return null;
    const resolved = this.getByIdStmt.get(fullId) as CapsuleRow | undefined;
    return resolved ? rowToCapsule(resolved) : null;
  }

  async create(input: CapsuleCreateInput): Promise<ChangeCapsule> {
    const id = randomUUID();
    const now = Date.now();
    this.insertStmt.run(
      id,
      input.goal,
      input.ownerAgent,
      input.branch,
      input.baseCommit,
      JSON.stringify(input.allowedPaths),
      input.acceptance,
      input.reviewer,
      input.status,
      input.initiativeId ?? null,
      input.taskId ?? null,
      input.subsystem ?? null,
      input.scopeType ?? null,
      input.blockedBy ? JSON.stringify(input.blockedBy) : null,
      input.supersedes ?? null,
      now,
      now,
    );
    return this.get(id)!;
  }

  async update(idOrPrefix: string, updates: CapsuleUpdateInput): Promise<ChangeCapsule> {
    const existing = this.get(idOrPrefix);
    if (!existing) {
      throw new Error(`Capsule not found: ${idOrPrefix}`);
    }
    const now = Date.now();
    this.updateStmt.run(
      updates.goal ?? existing.goal,
      updates.ownerAgent ?? existing.ownerAgent,
      updates.branch ?? existing.branch,
      updates.baseCommit ?? existing.baseCommit,
      JSON.stringify(updates.allowedPaths ?? existing.allowedPaths),
      updates.acceptance ?? existing.acceptance,
      updates.reviewer ?? existing.reviewer,
      updates.status ?? existing.status,
      updates.initiativeId ?? existing.initiativeId ?? null,
      updates.taskId ?? existing.taskId ?? null,
      updates.subsystem ?? existing.subsystem ?? null,
      updates.scopeType ?? existing.scopeType ?? null,
      JSON.stringify(updates.blockedBy ?? existing.blockedBy ?? []),
      updates.supersedes ?? existing.supersedes ?? null,
      now,
      existing.id,
    );
    return this.get(existing.id)!;
  }

  listSync(): ChangeCapsule[] {
    return (this.listAllStmt.all() as CapsuleRow[]).map(rowToCapsule);
  }

  async list(filter?: { status?: ChangeCapsuleStatus; ownerAgent?: string; initiativeId?: string; reviewer?: string }): Promise<ChangeCapsule[]> {
    if (!filter || (!filter.status && !filter.ownerAgent && !filter.initiativeId && !filter.reviewer)) {
      return this.listSync();
    }

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.status) {
      conditions.push('status = ?');
      params.push(filter.status);
    }
    if (filter.ownerAgent) {
      conditions.push('owner_agent = ?');
      params.push(filter.ownerAgent);
    }
    if (filter.initiativeId) {
      conditions.push('initiative_id = ?');
      params.push(filter.initiativeId);
    }
    if (filter.reviewer) {
      conditions.push('reviewer = ?');
      params.push(filter.reviewer);
    }

    const stmt = this.db.prepare(`
      SELECT id, goal, owner_agent, branch, base_commit, allowed_paths, acceptance, reviewer, status,
             initiative_id, task_id, subsystem, scope_type, blocked_by, supersedes, created_at, updated_at
      FROM change_capsules
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at ASC
    `);

    return (stmt.all(...params) as CapsuleRow[]).map(rowToCapsule);
  }

  async mine(ownerAgent: string, status?: ChangeCapsuleStatus): Promise<ChangeCapsule[]> {
    const capsules = await this.list({ ownerAgent, ...(status ? { status } : {}) });
    return status ? capsules : capsules.filter(capsule => capsule.status === 'open' || capsule.status === 'in_review');
  }

  async checkConflict(candidate: {
    allowedPaths: string[];
    subsystem?: string;
  }, excludeCapsuleId?: string): Promise<CapsuleConflict[]> {
    const rows = this.activeCapsulesStmt.all(...ACTIVE_STATUSES) as CapsuleRow[];
    const probe: ChangeCapsule = {
      id: 'probe',
      goal: 'probe',
      ownerAgent: 'probe',
      branch: 'probe',
      baseCommit: 'probe',
      allowedPaths: candidate.allowedPaths,
      acceptance: 'probe',
      reviewer: 'cto',
      status: 'open',
      createdAt: 0,
      updatedAt: 0,
      ...(candidate.subsystem ? { subsystem: candidate.subsystem } : {}),
    };

    const conflicts: CapsuleConflict[] = [];
    for (const row of rows) {
      if (excludeCapsuleId && row.id === excludeCapsuleId) continue;
      const capsule = rowToCapsule(row);
      const level = classifyConflict(probe, capsule);
      if (level === 'parallel_ok') continue;
      const reason = level === 'high_conflict'
        ? 'overlapping allowed paths or shared hot files'
        : 'shared subsystem or directory prefix';
      conflicts.push({ capsule, level, reason });
    }
    return conflicts;
  }
}

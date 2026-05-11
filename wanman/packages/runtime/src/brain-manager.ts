import { createLogger } from './logger.js'

const log = createLogger('brain-manager')

interface Db9Database {
  id: string
  name: string
  state: string
  host: string
  port: number
  username: string
  password: string
  database: string
  connection_string: string
  created_at: string
}

interface Db9Client {
  listDatabases(): Promise<Db9Database[]>
  createDatabase(name: string): Promise<Db9Database>
  executeSQL(dbId: string, query: string): Promise<unknown>
}

interface Db9ServiceAdapterLike {
  client: Db9Client
}

interface Db9Module {
  Db9ServiceAdapter: new (config: { token: string; baseUrl?: string }) => Db9ServiceAdapterLike
  initBrainSchema(client: Db9Client, dbId: string): Promise<void>
  brainSkillDefinition(): unknown
}

let cachedDb9Module: Promise<Db9Module> | null = null

async function loadDb9Module(): Promise<Db9Module> {
  cachedDb9Module ??= (async () => {
    try {
      return (await import('@sandbank.dev/db9')) as Db9Module
    } catch {
      throw new Error(
        '`@sandbank.dev/db9` is not installed. Either install it as an optional dependency (pnpm add @sandbank.dev/db9) or run with the cloud brain disabled (--no-brain).',
      )
    }
  })()
  return cachedDb9Module
}

export interface BrainManagerConfig {
  /** db9.ai API token */
  token: string
  /** Database name (used to find or create) */
  dbName: string
  /** db9 API base URL (default: https://db9.ai/api) */
  baseUrl?: string
}

export class BrainManager {
  private adapter: Db9ServiceAdapterLike | null = null
  private config: BrainManagerConfig
  private db: Db9Database | null = null
  private db9Module: Db9Module | null = null

  constructor(config: BrainManagerConfig) {
    this.config = config
  }

  get isInitialized(): boolean {
    return this.db !== null
  }

  get databaseUrl(): string {
    if (!this.db) throw new Error('BrainManager not initialized — call initialize() first')
    return this.db.connection_string
  }

  /** Environment variables to inject into agent processes */
  get env(): Record<string, string> {
    if (!this.db) throw new Error('BrainManager not initialized')
    return {
      DATABASE_URL: this.db.connection_string,
      DB9_DATABASE_ID: this.db.id,
      DB9_DATABASE_NAME: this.db.name,
      PGHOST: this.db.host,
      PGPORT: String(this.db.port),
      PGUSER: this.db.username,
      PGPASSWORD: this.db.password,
      PGDATABASE: this.db.database,
    }
  }

  get brainSkill() {
    if (!this.db9Module) {
      throw new Error('BrainManager not initialized — db9 module not loaded')
    }
    return this.db9Module.brainSkillDefinition()
  }

  /** Database ID for SQL operations */
  get dbId(): string {
    if (!this.db) throw new Error('BrainManager not initialized')
    return this.db.id
  }

  /** Execute SQL against the brain database */
  async executeSQL(sql: string): Promise<unknown> {
    if (!this.db || !this.adapter) throw new Error('BrainManager not initialized')
    return this.adapter.client.executeSQL(this.db.id, sql)
  }

  /** Initialize: find or create database, ensure brain schema */
  async initialize(): Promise<void> {
    this.db9Module = await loadDb9Module()
    this.adapter = new this.db9Module.Db9ServiceAdapter({
      token: this.config.token,
      baseUrl: this.config.baseUrl,
    })

    log.info('initializing brain', { dbName: this.config.dbName })

    // Check for existing database
    // DB9 API may return state as 'ready' or 'ACTIVE' (both mean usable)
    const isReady = (state: string) => /^(ready|active)$/i.test(state)
    const existing = await this.adapter.client.listDatabases()
    const found = existing.find(db => db.name === this.config.dbName && isReady(db.state))

    if (found) {
      log.info('reusing existing database', { id: found.id, name: found.name })
      this.db = found
    } else {
      log.info('creating new database', { name: this.config.dbName })
      this.db = await this.adapter.client.createDatabase(this.config.dbName)
      if (!isReady(this.db.state)) {
        throw new Error(`Database '${this.db.id}' is not ready (state: ${this.db.state})`)
      }
    }

    // Initialize brain schema (idempotent: CREATE IF NOT EXISTS)
    await this.db9Module.initBrainSchema(this.adapter.client, this.db.id)

    // Initialize wanman-specific schema extensions
    await this.initWanmanSchema()

    log.info('brain initialized', { id: this.db.id, name: this.db.name, host: this.db.host })
  }

  /** wanman-specific schema extensions (idempotent) */
  private async initWanmanSchema(): Promise<void> {
    // Hypotheses table: CEO's divergent thinking tree
    await this.executeSQL(`
      CREATE TABLE IF NOT EXISTS hypotheses (
        id serial PRIMARY KEY,
        parent_id int REFERENCES hypotheses(id),
        agent text NOT NULL DEFAULT 'ceo',
        title text NOT NULL,
        rationale text,
        expected_value text,
        estimated_cost text,
        status text NOT NULL DEFAULT 'proposed'
          CHECK (status IN ('proposed', 'active', 'validated', 'rejected', 'abandoned')),
        outcome text,
        evidence_artifact_ids int[],
        created_at timestamptz DEFAULT now(),
        resolved_at timestamptz
      )
    `)
    await this.executeSQL(`CREATE INDEX IF NOT EXISTS idx_hypotheses_status ON hypotheses (status)`)
    await this.executeSQL(`CREATE INDEX IF NOT EXISTS idx_hypotheses_parent ON hypotheses (parent_id)`)

    // Runs table: one record per wanman run session
    await this.executeSQL(`
      CREATE TABLE IF NOT EXISTS runs (
        id text PRIMARY KEY,
        goal text,
        config jsonb,
        started_at timestamptz DEFAULT now(),
        ended_at timestamptz,
        total_loops int DEFAULT 0,
        productive_loops int DEFAULT 0,
        total_tokens int DEFAULT 0,
        total_cost_usd real DEFAULT 0,
        exit_reason text,
        metadata jsonb DEFAULT '{}'
      )
    `)

    // Loop events table: per-loop observability data
    await this.executeSQL(`
      CREATE TABLE IF NOT EXISTS loop_events (
        id serial PRIMARY KEY,
        run_id text NOT NULL,
        loop_number int NOT NULL,
        event_type text NOT NULL,
        classification text,
        agent text,
        payload jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz DEFAULT now()
      )
    `)
    await this.executeSQL(`CREATE INDEX IF NOT EXISTS idx_loop_events_run ON loop_events (run_id, loop_number)`)
    await this.executeSQL(`CREATE INDEX IF NOT EXISTS idx_loop_events_type ON loop_events (event_type)`)
    await this.executeSQL(`CREATE INDEX IF NOT EXISTS idx_loop_events_classification ON loop_events (classification)`)

    // Skill evals table: evaluation results for agent skills
    await this.executeSQL(`
      CREATE TABLE IF NOT EXISTS skill_evals (
        id serial PRIMARY KEY,
        agent text NOT NULL,
        eval_name text NOT NULL,
        skill_version text NOT NULL,
        pass_rate real,
        avg_tokens int,
        avg_duration_ms int,
        model text,
        created_at timestamptz DEFAULT now()
      )
    `)

    // Run feedback table: per-agent execution metrics
    await this.executeSQL(`
      CREATE TABLE IF NOT EXISTS run_feedback (
        id serial PRIMARY KEY,
        run_id text,
        agent text NOT NULL,
        skill_version text,
        task_completed boolean,
        cost_usd real,
        duration_ms int,
        token_count int,
        errored boolean DEFAULT false,
        human_intervention boolean DEFAULT false,
        steer_count int DEFAULT 0,
        loop_number int,
        created_at timestamptz DEFAULT now()
      )
    `)
    for (const alter of [
      `ALTER TABLE run_feedback ADD COLUMN task_id text`,
      `ALTER TABLE run_feedback ADD COLUMN execution_profile text`,
      `ALTER TABLE run_feedback ADD COLUMN bundle_id text`,
      `ALTER TABLE run_feedback ADD COLUMN bundle_version int`,
      `ALTER TABLE run_feedback ADD COLUMN activation_snapshot_id text`,
      `ALTER TABLE run_feedback ADD COLUMN accepted_by_ceo boolean`,
      `ALTER TABLE run_feedback ADD COLUMN accepted_by_user boolean`,
      `ALTER TABLE run_feedback ADD COLUMN revision_count int DEFAULT 0`,
      `ALTER TABLE run_feedback ADD COLUMN output_quality_score real`,
      `ALTER TABLE run_feedback ADD COLUMN artifact_reused boolean`,
      `ALTER TABLE run_feedback ADD COLUMN artifact_lookup_success boolean`,
    ]) {
      try {
        await this.executeSQL(alter)
      } catch {
        // Column already exists — ignore.
      }
    }
    await this.executeSQL(`CREATE INDEX IF NOT EXISTS idx_run_feedback_agent ON run_feedback (agent)`)
    await this.executeSQL(`CREATE INDEX IF NOT EXISTS idx_run_feedback_run ON run_feedback (run_id)`)

    // Skills version table: supports dynamic skill updates and A/B testing
    await this.executeSQL(`
      CREATE TABLE IF NOT EXISTS skills (
        id serial PRIMARY KEY,
        agent text NOT NULL,
        version int NOT NULL DEFAULT 1,
        content text NOT NULL,
        is_active boolean DEFAULT true,
        eval_pass_rate real,
        created_at timestamptz DEFAULT now(),
        created_by text DEFAULT 'human'
      )
    `)
    await this.executeSQL(`CREATE INDEX IF NOT EXISTS idx_skills_agent_active ON skills (agent, is_active)`)
    await this.executeSQL(`CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_agent_version ON skills (agent, version)`)

    await this.executeSQL(`
      CREATE TABLE IF NOT EXISTS shared_skills (
        name text PRIMARY KEY,
        title text NOT NULL,
        category text NOT NULL CHECK (category IN ('process', 'preference', 'capability')),
        owner text NOT NULL DEFAULT 'human',
        description text,
        stability text NOT NULL DEFAULT 'stable' CHECK (stability IN ('stable', 'experimental')),
        created_at timestamptz DEFAULT now()
      )
    `)

    await this.executeSQL(`
      CREATE TABLE IF NOT EXISTS shared_skill_versions (
        id serial PRIMARY KEY,
        skill_name text NOT NULL REFERENCES shared_skills(name),
        version int NOT NULL,
        content text NOT NULL,
        status text NOT NULL DEFAULT 'candidate'
          CHECK (status IN ('draft', 'candidate', 'canary', 'active', 'deprecated', 'archived')),
        based_on_version int,
        change_summary text,
        eval_summary jsonb DEFAULT '{}'::jsonb,
        created_by text NOT NULL DEFAULT 'human',
        created_at timestamptz DEFAULT now(),
        UNIQUE (skill_name, version)
      )
    `)
    await this.executeSQL(`CREATE INDEX IF NOT EXISTS idx_shared_skill_versions_name_status ON shared_skill_versions (skill_name, status)`)

    await this.executeSQL(`
      CREATE TABLE IF NOT EXISTS skill_bundles (
        id text NOT NULL,
        version int NOT NULL,
        execution_profile text NOT NULL,
        description text,
        status text NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'active', 'deprecated')),
        created_by text NOT NULL DEFAULT 'human',
        created_at timestamptz DEFAULT now(),
        PRIMARY KEY (id, version)
      )
    `)

    await this.executeSQL(`
      CREATE TABLE IF NOT EXISTS skill_bundle_entries (
        bundle_id text NOT NULL,
        bundle_version int NOT NULL,
        skill_name text NOT NULL REFERENCES shared_skills(name),
        version_policy text NOT NULL CHECK (version_policy IN ('pin', 'track_active')),
        pinned_version int,
        required boolean NOT NULL DEFAULT true,
        mode text NOT NULL DEFAULT 'always' CHECK (mode IN ('always', 'advisory')),
        order_index int NOT NULL DEFAULT 0,
        PRIMARY KEY (bundle_id, bundle_version, skill_name),
        FOREIGN KEY (bundle_id, bundle_version) REFERENCES skill_bundles(id, version)
      )
    `)

    await this.executeSQL(`
      CREATE TABLE IF NOT EXISTS skill_activation_snapshots (
        id text PRIMARY KEY,
        run_id text NOT NULL,
        loop_number int,
        task_id text,
        agent text NOT NULL,
        execution_profile text,
        bundle_id text,
        bundle_version int,
        activation_scope text NOT NULL CHECK (activation_scope IN ('task', 'loop', 'run')),
        resolved_skills jsonb NOT NULL,
        materialized_path text NOT NULL,
        activated_by text NOT NULL DEFAULT 'system',
        created_at timestamptz DEFAULT now()
      )
    `)
    await this.executeSQL(`CREATE INDEX IF NOT EXISTS idx_skill_activation_snapshots_run_agent ON skill_activation_snapshots (run_id, agent)`)

    log.info('wanman schema extensions initialized')
  }
}

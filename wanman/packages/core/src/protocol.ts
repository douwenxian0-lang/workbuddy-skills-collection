/**
 * JSON-RPC 2.0 protocol types and method constants for Agent Matrix communication.
 *
 * Communication flow:
 *   Agent Process ──Bash──► wanman CLI ──HTTP/JSON-RPC──► Supervisor Relay ──► Target Agent
 */

// ── JSON-RPC 2.0 base types ──

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// ── Standard JSON-RPC error codes ──

export const RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  /** Agent not found */
  AGENT_NOT_FOUND: -32000,
  /** Agent is not running */
  AGENT_NOT_RUNNING: -32001,
} as const;

// ── RPC method constants ──

export const RPC_METHODS = {
  /** Send a message to an agent */
  AGENT_SEND: 'agent.send',
  /** Receive pending messages for an agent */
  AGENT_RECV: 'agent.recv',
  /** List all agents and their states */
  AGENT_LIST: 'agent.list',
  /** Get shared context value */
  CONTEXT_GET: 'context.get',
  /** Set shared context value */
  CONTEXT_SET: 'context.set',
  /** List all context keys */
  CONTEXT_LIST: 'context.list',
  /** Push an external event */
  EVENT_PUSH: 'event.push',
  /** Health check */
  HEALTH_CHECK: 'health.check',
  /** List all auth providers and their status */
  AUTH_PROVIDERS: 'auth.providers',
  /** Start a CLI login flow */
  AUTH_START: 'auth.start',
  /** Query login status for a provider */
  AUTH_STATUS: 'auth.status',
  /** Create a task in the task pool */
  TASK_CREATE: 'task.create',
  /** List tasks (optionally filtered by status/assignee) */
  TASK_LIST: 'task.list',
  /** Get a single task by ID */
  TASK_GET: 'task.get',
  /** Update a task (status, assignee, result) */
  TASK_UPDATE: 'task.update',
  /** Create a long-running initiative */
  INITIATIVE_CREATE: 'initiative.create',
  /** List initiatives */
  INITIATIVE_LIST: 'initiative.list',
  /** Get a single initiative by ID */
  INITIATIVE_GET: 'initiative.get',
  /** Update initiative fields */
  INITIATIVE_UPDATE: 'initiative.update',
  /** Create a PR-sized change capsule */
  CAPSULE_CREATE: 'capsule.create',
  /** List change capsules */
  CAPSULE_LIST: 'capsule.list',
  /** Get a single change capsule by ID */
  CAPSULE_GET: 'capsule.get',
  /** Update change capsule fields */
  CAPSULE_UPDATE: 'capsule.update',
  /** List active capsules owned by an agent */
  CAPSULE_MINE: 'capsule.mine',
  /** Store a structured artifact in db9 brain */
  ARTIFACT_PUT: 'artifact.put',
  /** List artifacts (optionally filtered) */
  ARTIFACT_LIST: 'artifact.list',
  /** Get a single artifact by ID (with full content) */
  ARTIFACT_GET: 'artifact.get',
  /** Create a hypothesis */
  HYPOTHESIS_CREATE: 'hypothesis.create',
  /** List hypotheses */
  HYPOTHESIS_LIST: 'hypothesis.list',
  /** Update hypothesis status */
  HYPOTHESIS_UPDATE: 'hypothesis.update',

  // ── Skill management ──
  /** Get active skill content for an agent */
  SKILL_GET: 'skill.get',
  /** Create a new skill version */
  SKILL_UPDATE: 'skill.update',
  /** Rollback to previous skill version */
  SKILL_ROLLBACK: 'skill.rollback',
  /** Get aggregated skill metrics from run_feedback */
  SKILL_METRICS: 'skill.metrics',

  // ── Dynamic agent spawning ──
  /** Spawn a temporary clone of an existing agent role */
  AGENT_SPAWN: 'agent.spawn',
  /** Destroy a dynamically spawned agent */
  AGENT_DESTROY: 'agent.destroy',

  // ── Supervisor control ──
  /** Pause all agents — suspend running processes, halt the run loop */
  SUPERVISOR_PAUSE: 'supervisor.pause',
  /** Resume all agents — continue the run loop */
  SUPERVISOR_RESUME: 'supervisor.resume',
} as const;

// ── RPC param/result types ──

export interface AgentSendParams {
  from: string;
  to: string;
  type?: string;       // defaults to 'message'
  payload: unknown;    // replaces content
  priority: 'steer' | 'normal';
}

export interface AgentRecvParams {
  agent: string;
  limit?: number;
}

export interface ContextGetParams {
  key: string;
}

export interface ContextSetParams {
  key: string;
  value: string;
  agent: string;
}

export interface EventPushParams {
  type: string;
  source: string;
  payload: Record<string, unknown>;
}

export interface TaskCreateParams {
  title: string;
  description?: string;
  scope?: { paths: string[]; patterns?: string[] };
  priority?: number;
  parentId?: string;
  assignee?: string;
  dependsOn?: string[]; // task IDs that must be done before this task starts
  initiativeId?: string;
  capsuleId?: string;
  subsystem?: string;
  scopeType?: 'code' | 'docs' | 'tests' | 'ops' | 'mixed';
  executionProfile?: string;
  agent: string; // who created the task
}

export interface TaskListParams {
  status?: string;
  assignee?: string;
  initiativeId?: string;
  capsuleId?: string;
}

export interface TaskGetParams {
  id: string;
}

export interface TaskUpdateParams {
  id: string;
  status?: string;
  assignee?: string;
  result?: string;
  initiativeId?: string;
  capsuleId?: string;
  subsystem?: string;
  scopeType?: 'code' | 'docs' | 'tests' | 'ops' | 'mixed';
  executionProfile?: string;
  agent: string; // who is updating
}

export interface InitiativeCreateParams {
  title: string;
  goal: string;
  summary?: string;
  status?: 'active' | 'paused' | 'completed' | 'abandoned';
  priority?: number;
  sources?: string[];
  agent: string;
}

export interface InitiativeListParams {
  status?: 'active' | 'paused' | 'completed' | 'abandoned';
}

export interface InitiativeGetParams {
  id: string;
}

export interface InitiativeUpdateParams {
  id: string;
  title?: string;
  goal?: string;
  summary?: string;
  status?: 'active' | 'paused' | 'completed' | 'abandoned';
  priority?: number;
  sources?: string[];
  agent: string;
}

export interface CapsuleCreateParams {
  goal: string;
  ownerAgent: string;
  branch: string;
  baseCommit: string;
  allowedPaths: string[];
  acceptance: string;
  reviewer?: string;
  initiativeId?: string;
  taskId?: string;
  subsystem?: string;
  scopeType?: 'code' | 'docs' | 'tests' | 'ops' | 'mixed';
  blockedBy?: string[];
  supersedes?: string;
  agent: string;
}

export interface CapsuleListParams {
  status?: 'open' | 'in_review' | 'merged' | 'abandoned';
  ownerAgent?: string;
  initiativeId?: string;
  reviewer?: string;
}

export interface CapsuleGetParams {
  id: string;
}

export interface CapsuleUpdateParams {
  id: string;
  goal?: string;
  ownerAgent?: string;
  branch?: string;
  baseCommit?: string;
  allowedPaths?: string[];
  acceptance?: string;
  reviewer?: string;
  status?: 'open' | 'in_review' | 'merged' | 'abandoned';
  initiativeId?: string;
  taskId?: string;
  subsystem?: string;
  scopeType?: 'code' | 'docs' | 'tests' | 'ops' | 'mixed';
  blockedBy?: string[];
  supersedes?: string;
  agent: string;
}

export interface CapsuleMineParams {
  agent: string;
  status?: 'open' | 'in_review' | 'merged' | 'abandoned';
}

export interface ArtifactPutParams {
  kind: string;
  agent: string;
  source: string;
  confidence: number;
  taskId?: string;
  path?: string;
  content?: string;
  metadata: Record<string, unknown>;
}

export interface ArtifactListParams {
  agent?: string;
  kind?: string;
  verified?: boolean;
}

export interface ArtifactGetParams {
  id: number;
}

// ── Helper to create JSON-RPC request/response ──

let rpcIdCounter = 0;

export function createRpcRequest(method: string, params?: Record<string, unknown>): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id: ++rpcIdCounter,
    method,
    params,
  };
}

export function createRpcResponse(id: string | number, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

export function createRpcError(id: string | number, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message, data } };
}

/**
 * SafetyGate — controls execution permissions for irreversible actions.
 *
 * Automatable operations (e.g. git_commit, git_merge_staging) are
 * auto-allowed.  Everything else requires explicit human approval
 * before proceeding.
 */

import { randomUUID } from 'node:crypto'

export type ActionType =
  | 'git_commit'
  | 'git_merge_staging'
  | 'git_merge_production'
  | 'deploy_staging'
  | 'deploy_production'
  | 'send_email'
  | 'send_slack'
  | 'financial_transaction'
  | 'delete_data'
  | 'modify_permissions'

export type ApprovalStatus = 'pending' | 'approved' | 'denied'

export interface ApprovalRequest {
  id: string
  action: ActionType
  context: Record<string, unknown>
  status: ApprovalStatus
  createdAt: number
  resolvedAt?: number
  reason?: string
}

export interface CheckResult {
  allowed: boolean
  requiresApproval: boolean
  reason?: string
}

/** Actions that can be auto-approved (safe, reversible). */
const AUTO_ALLOW: Set<ActionType> = new Set([
  'git_commit',
  'git_merge_staging',
])

export class SafetyGate {
  private approvals: Map<string, ApprovalRequest> = new Map()

  /**
   * Check if an action is allowed or needs approval.
   */
  check(action: ActionType, _context?: Record<string, unknown>): CheckResult {
    if (AUTO_ALLOW.has(action)) {
      return { allowed: true, requiresApproval: false }
    }
    return { allowed: false, requiresApproval: true }
  }

  /**
   * Create an approval request for a restricted action.
   * Returns the approval ID.
   */
  requestApproval(action: ActionType, context?: Record<string, unknown>): string {
    const id = randomUUID()
    const request: ApprovalRequest = {
      id,
      action,
      context: context ?? {},
      status: 'pending',
      createdAt: Date.now(),
    }
    this.approvals.set(id, request)
    return id
  }

  /**
   * Approve a pending request.
   * Throws if the request does not exist or is not pending.
   */
  approve(approvalId: string): void {
    const request = this.approvals.get(approvalId)
    if (!request) {
      throw new Error(`Approval request "${approvalId}" not found`)
    }
    if (request.status !== 'pending') {
      throw new Error(
        `Cannot approve request "${approvalId}": status is "${request.status}", expected "pending"`,
      )
    }
    request.status = 'approved'
    request.resolvedAt = Date.now()
  }

  /**
   * Deny a pending request with a reason.
   * Throws if the request does not exist or is not pending.
   */
  deny(approvalId: string, reason: string): void {
    const request = this.approvals.get(approvalId)
    if (!request) {
      throw new Error(`Approval request "${approvalId}" not found`)
    }
    if (request.status !== 'pending') {
      throw new Error(
        `Cannot deny request "${approvalId}": status is "${request.status}", expected "pending"`,
      )
    }
    request.status = 'denied'
    request.reason = reason
    request.resolvedAt = Date.now()
  }

  /**
   * Get an approval request by ID. Returns null if not found.
   */
  getApproval(approvalId: string): ApprovalRequest | null {
    return this.approvals.get(approvalId) ?? null
  }

  /**
   * List all pending approval requests.
   */
  listPending(): ApprovalRequest[] {
    return [...this.approvals.values()].filter((r) => r.status === 'pending')
  }
}

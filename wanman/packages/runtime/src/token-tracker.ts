/**
 * TokenTracker — tracks token consumption per workflow, agent, and task.
 *
 * Provides budget warnings (remaining < 20%) and hard-limit detection
 * (exceeded) so callers can throttle or halt execution before burning
 * through their allocation.
 */

export type WorkflowPhase = 'explore' | 'evaluate' | 'execute'

export interface TokenUsage {
  workflowId: string
  agentId: string
  taskId?: string
  phase: WorkflowPhase
  inputTokens: number
  outputTokens: number
  totalTokens?: number
  timestamp: number
}

export interface UsageSummary {
  /** inputTokens + outputTokens combined across all records. */
  total: number
  /** phase → total tokens. */
  byPhase: Record<string, number>
  /** agentId → total tokens. */
  byAgent: Record<string, number>
}

export interface BudgetCheck {
  /** Budget minus total consumed. */
  remaining: number
  /** True when remaining < 0. */
  exceeded: boolean
  /** True when remaining < 20% of budget. */
  warning: boolean
}

export class TokenTracker {
  private records: TokenUsage[] = []

  /** Record a token usage event. */
  record(usage: TokenUsage): void {
    this.records.push(usage)
  }

  /** Get aggregated usage summary for a workflow. */
  getUsage(workflowId: string): UsageSummary {
    const filtered = this.records.filter((r) => r.workflowId === workflowId)

    let total = 0
    const byPhase: Record<string, number> = {}
    const byAgent: Record<string, number> = {}

    for (const r of filtered) {
      const tokens = resolveTotalTokens(r)
      total += tokens
      byPhase[r.phase] = (byPhase[r.phase] ?? 0) + tokens
      byAgent[r.agentId] = (byAgent[r.agentId] ?? 0) + tokens
    }

    return { total, byPhase, byAgent }
  }

  /** Check budget status for a workflow. */
  checkBudget(workflowId: string, budget: number): BudgetCheck {
    const { total } = this.getUsage(workflowId)
    const remaining = budget - total
    return {
      remaining,
      exceeded: remaining < 0,
      warning: remaining < budget * 0.2,
    }
  }

  /** Get all records for a workflow (for audit). */
  getRecords(workflowId: string): TokenUsage[] {
    return this.records.filter((r) => r.workflowId === workflowId)
  }
}

function resolveTotalTokens(usage: TokenUsage): number {
  return usage.totalTokens ?? (usage.inputTokens + usage.outputTokens)
}

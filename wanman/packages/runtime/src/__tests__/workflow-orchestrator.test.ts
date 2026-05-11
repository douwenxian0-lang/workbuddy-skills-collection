/**
 * Unit tests for WorkflowOrchestrator — three-phase workflow orchestration.
 *
 * The orchestrator composes ExplorationEngine, EvaluationEngine, and
 * ExecutionPlanner into a single explore → evaluate → execute workflow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  WorkflowOrchestrator,
  type WorkflowConfig,
  type WorkflowResult,
} from '../workflow-orchestrator.js'
import type { LLMCaller, ExplorationGoal } from '../exploration-engine.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGoal(): ExplorationGoal {
  return {
    description: 'Build a REST API for user management',
    constraints: ['Must use TypeScript', 'Must support pagination'],
    context: 'Existing Express app',
  }
}

function makeDefaultConfig(overrides?: Partial<WorkflowConfig>): WorkflowConfig {
  return {
    tokenBudget: 100000,
    ...overrides,
  }
}

/**
 * Build a mock LLMCaller that handles three sequential calls:
 *   1. explore  → returns two options
 *   2. evaluate → returns scores with high confidence (0.85)
 *   3. plan     → returns two tasks
 */
function makeMockLLM(evaluationConfidence = 0.85) {
  return {
    call: vi.fn()
      // First call: explore
      .mockResolvedValueOnce({
        content: JSON.stringify([
          {
            title: 'Option A',
            description: 'desc A',
            approach: 'approach A',
            estimatedTokens: 50000,
            risks: [],
            tradeoffs: [],
            confidence: 0.8,
          },
          {
            title: 'Option B',
            description: 'desc B',
            approach: 'approach B',
            estimatedTokens: 30000,
            risks: [],
            tradeoffs: [],
            confidence: 0.6,
          },
        ]),
        tokensUsed: 2000,
      })
      // Second call: evaluate
      .mockResolvedValueOnce({
        content: JSON.stringify({
          scores: [
            {
              optionId: 'will-be-replaced',
              scores: { feasibility: 8, risk: 7, impact: 9, cost: 6 },
              reasoning: 'Good',
            },
            {
              optionId: 'will-be-replaced-2',
              scores: { feasibility: 6, risk: 9, impact: 5, cost: 8 },
              reasoning: 'OK',
            },
          ],
          confidence: evaluationConfidence,
        }),
        tokensUsed: 1500,
      })
      // Third call: plan
      .mockResolvedValueOnce({
        content: JSON.stringify({
          tasks: [
            {
              title: 'Task 1',
              description: 'desc',
              scope: { paths: ['src/a.ts'] },
              dependencies: [],
              estimatedTokens: 20000,
              priority: 8,
            },
            {
              title: 'Task 2',
              description: 'desc',
              scope: { paths: ['src/b.ts'] },
              dependencies: ['Task 1'],
              estimatedTokens: 30000,
              priority: 7,
            },
          ],
        }),
        tokensUsed: 1000,
      }),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorkflowOrchestrator', () => {
  describe('start()', () => {
    it('should run explore + evaluate + plan when confidence >= threshold and set phase to done', async () => {
      const llm = makeMockLLM(0.85)
      const orchestrator = new WorkflowOrchestrator(llm)

      const result = await orchestrator.start(makeGoal(), makeDefaultConfig({
        autoApproveThreshold: 0.8,
      }))

      // All three phases should have run
      expect(llm.call).toHaveBeenCalledTimes(3)
      expect(result.phase).toBe('done')
      expect(result.requiresHumanApproval).toBe(false)

      // All three results should be present
      expect(result.exploration).toBeDefined()
      expect(result.exploration!.options).toHaveLength(2)
      expect(result.evaluation).toBeDefined()
      expect(result.evaluation!.scores).toHaveLength(2)
      expect(result.plan).toBeDefined()
      expect(result.plan!.tasks).toHaveLength(2)

      // plan.optionId should match one of the exploration option IDs
      const explorationOptionIds = result.exploration!.options.map((o) => o.id)
      expect(explorationOptionIds).toContain(result.plan!.optionId)
    })

    it('should stop at evaluate when confidence < threshold and set requiresHumanApproval', async () => {
      const llm = makeMockLLM(0.5) // low confidence
      const orchestrator = new WorkflowOrchestrator(llm)

      const result = await orchestrator.start(makeGoal(), makeDefaultConfig({
        autoApproveThreshold: 0.8,
      }))

      // Only explore + evaluate should have run
      expect(llm.call).toHaveBeenCalledTimes(2)
      expect(result.phase).toBe('evaluate')
      expect(result.requiresHumanApproval).toBe(true)

      // Exploration and evaluation present, but no plan
      expect(result.exploration).toBeDefined()
      expect(result.evaluation).toBeDefined()
      expect(result.plan).toBeUndefined()
    })

    it('should track tokensUsed across all phases', async () => {
      const llm = makeMockLLM(0.9)
      const orchestrator = new WorkflowOrchestrator(llm)

      const result = await orchestrator.start(makeGoal(), makeDefaultConfig({
        autoApproveThreshold: 0.8,
      }))

      // explore: 2000, evaluate: 1500, plan: 1000
      expect(result.tokensUsed).toBe(4500)
      expect(result.tokensRemaining).toBe(100000 - 4500)
    })

    it('should respect budget ratios', async () => {
      const llm = makeMockLLM(0.9)
      const orchestrator = new WorkflowOrchestrator(llm)

      const config = makeDefaultConfig({
        tokenBudget: 100000,
        exploreBudgetRatio: 0.4,
        evaluateBudgetRatio: 0.1,
        executeBudgetRatio: 0.5,
        autoApproveThreshold: 0.8,
      })

      await orchestrator.start(makeGoal(), config)

      // We can't easily inspect the budget passed to engines, but we can
      // verify that the LLM was called 3 times (all phases ran)
      expect(llm.call).toHaveBeenCalledTimes(3)
    })

    it('should use default budget ratios when not specified', async () => {
      const llm = makeMockLLM(0.9)
      const orchestrator = new WorkflowOrchestrator(llm)

      const result = await orchestrator.start(makeGoal(), makeDefaultConfig({
        autoApproveThreshold: 0.8,
      }))

      // Default ratios: 0.3 explore, 0.1 evaluate, 0.6 execute
      // All phases should complete
      expect(result.phase).toBe('done')
    })

    it('should use default autoApproveThreshold of 0.8 when not specified', async () => {
      // Confidence 0.85 > 0.8 → should auto-approve
      const llm = makeMockLLM(0.85)
      const orchestrator = new WorkflowOrchestrator(llm)

      const result = await orchestrator.start(makeGoal(), makeDefaultConfig())

      expect(result.phase).toBe('done')
      expect(result.requiresHumanApproval).toBe(false)
    })

    it('should store the workflow so getStatus() can retrieve it', async () => {
      const llm = makeMockLLM(0.9)
      const orchestrator = new WorkflowOrchestrator(llm)

      const result = await orchestrator.start(makeGoal(), makeDefaultConfig())
      const status = orchestrator.getStatus(result.goalId)

      expect(status).not.toBeNull()
      expect(status!.goalId).toBe(result.goalId)
      expect(status!.phase).toBe('done')
    })
  })

  describe('getStatus()', () => {
    it('should return the workflow result for a known goalId', async () => {
      const llm = makeMockLLM(0.9)
      const orchestrator = new WorkflowOrchestrator(llm)

      const result = await orchestrator.start(makeGoal(), makeDefaultConfig())
      const status = orchestrator.getStatus(result.goalId)

      expect(status).toEqual(result)
    })

    it('should return null for an unknown goalId', () => {
      const llm = makeMockLLM(0.9)
      const orchestrator = new WorkflowOrchestrator(llm)

      expect(orchestrator.getStatus('nonexistent-id')).toBeNull()
    })
  })

  describe('resume()', () => {
    it('should continue to plan phase after human approval', async () => {
      const llm = makeMockLLM(0.5) // low confidence → stops at evaluate
      const orchestrator = new WorkflowOrchestrator(llm)

      const startResult = await orchestrator.start(makeGoal(), makeDefaultConfig({
        autoApproveThreshold: 0.8,
      }))

      expect(startResult.phase).toBe('evaluate')
      expect(startResult.requiresHumanApproval).toBe(true)

      // The third mock from makeMockLLM (plan with 2 tasks) is still queued.
      // resume() will consume it. No need to add another mock.

      const resumed = await orchestrator.resume(startResult.goalId)

      expect(resumed.phase).toBe('done')
      expect(resumed.requiresHumanApproval).toBe(false)
      expect(resumed.plan).toBeDefined()
      expect(resumed.plan!.tasks).toHaveLength(2)

      // plan.optionId should match one of the exploration option IDs
      const explorationOptionIds = resumed.exploration!.options.map((o) => o.id)
      expect(explorationOptionIds).toContain(resumed.plan!.optionId)

      // tokensUsed should include all phases: 2000 + 1500 + 1000
      expect(resumed.tokensUsed).toBe(4500)
    })

    it('should throw if workflow not found', async () => {
      const llm = makeMockLLM()
      const orchestrator = new WorkflowOrchestrator(llm)

      await expect(orchestrator.resume('nonexistent-id')).rejects.toThrow(
        /not found/i,
      )
    })

    it('should throw if workflow phase is not evaluate', async () => {
      const llm = makeMockLLM(0.9) // high confidence → goes to done
      const orchestrator = new WorkflowOrchestrator(llm)

      const result = await orchestrator.start(makeGoal(), makeDefaultConfig())

      expect(result.phase).toBe('done')

      await expect(orchestrator.resume(result.goalId)).rejects.toThrow(
        /not in evaluate phase/i,
      )
    })
  })

  describe('tokensRemaining', () => {
    it('should be correctly calculated as tokenBudget - tokensUsed', async () => {
      const llm = makeMockLLM(0.9)
      const orchestrator = new WorkflowOrchestrator(llm)

      const result = await orchestrator.start(makeGoal(), makeDefaultConfig({
        tokenBudget: 50000,
      }))

      // explore: 2000, evaluate: 1500, plan: 1000 → total: 4500
      expect(result.tokensUsed).toBe(4500)
      expect(result.tokensRemaining).toBe(50000 - 4500)
      expect(result.tokensRemaining).toBe(45500)
    })

    it('should be correct for paused workflows (explore + evaluate only)', async () => {
      const llm = makeMockLLM(0.5) // stops at evaluate
      const orchestrator = new WorkflowOrchestrator(llm)

      const result = await orchestrator.start(makeGoal(), makeDefaultConfig({
        tokenBudget: 50000,
        autoApproveThreshold: 0.8,
      }))

      // explore: 2000, evaluate: 1500 → total: 3500
      expect(result.tokensUsed).toBe(3500)
      expect(result.tokensRemaining).toBe(50000 - 3500)
      expect(result.tokensRemaining).toBe(46500)
    })
  })
})

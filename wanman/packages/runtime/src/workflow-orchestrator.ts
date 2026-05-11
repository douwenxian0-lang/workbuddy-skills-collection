/**
 * WorkflowOrchestrator — three-phase workflow orchestrator.
 *
 * Composes ExplorationEngine, EvaluationEngine, and ExecutionPlanner into a
 * single explore → evaluate → execute pipeline. Manages phase transitions,
 * token budget allocation, and human-approval gating.
 */

import { randomUUID } from 'crypto';
import type {
  LLMCaller,
  ExplorationGoal,
  ExplorationResult,
} from './exploration-engine.js';
import type {
  EvaluationResult,
  EvaluationCriteria,
} from './evaluation-engine.js';
import type { ExecutionPlan } from './execution-planner.js';
import { ExplorationEngine } from './exploration-engine.js';
import { EvaluationEngine } from './evaluation-engine.js';
import { ExecutionPlanner } from './execution-planner.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkflowPhase = 'explore' | 'evaluate' | 'execute' | 'done';

export interface WorkflowConfig {
  tokenBudget: number;
  exploreBudgetRatio?: number; // default: 0.3
  evaluateBudgetRatio?: number; // default: 0.1
  executeBudgetRatio?: number; // default: 0.6
  autoApproveThreshold?: number; // default: 0.8 (confidence above this = auto-approve)
  evaluationCriteria?: EvaluationCriteria[]; // defaults to DEFAULT_CRITERIA
}

export interface WorkflowResult {
  goalId: string;
  phase: WorkflowPhase;
  exploration?: ExplorationResult;
  evaluation?: EvaluationResult;
  plan?: ExecutionPlan;
  tokensUsed: number;
  tokensRemaining: number;
  requiresHumanApproval: boolean;
}

// Internal state stored per workflow — extends WorkflowResult with config
// needed for resume().
interface WorkflowState extends WorkflowResult {
  config: WorkflowConfig;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export class WorkflowOrchestrator {
  private workflows: Map<string, WorkflowState> = new Map();

  constructor(private llm: LLMCaller) {}

  /**
   * Start a new workflow. Runs explore → evaluate phases.
   * If confidence >= autoApproveThreshold, also runs plan phase.
   * If confidence < threshold, stops at evaluate and sets requiresHumanApproval=true.
   */
  async start(
    goal: ExplorationGoal,
    config: WorkflowConfig,
  ): Promise<WorkflowResult> {
    const goalId = randomUUID();
    const {
      tokenBudget,
      exploreBudgetRatio = 0.3,
      evaluateBudgetRatio = 0.1,
      executeBudgetRatio = 0.6,
      autoApproveThreshold = 0.8,
      evaluationCriteria,
    } = config;

    const exploreBudget = tokenBudget * exploreBudgetRatio;
    const evaluateBudget = tokenBudget * evaluateBudgetRatio;
    const executeBudget = tokenBudget * executeBudgetRatio;

    // Use a tracking LLM wrapper so we can accumulate tokensUsed across
    // all engines regardless of what each engine's return type exposes.
    let cumulativeTokens = 0;
    const trackingLLM: LLMCaller = {
      call: async (systemPrompt, userPrompt) => {
        const result = await this.llm.call(systemPrompt, userPrompt);
        cumulativeTokens += result.tokensUsed;
        return result;
      },
    };

    // Phase 1: Explore
    const explorer = new ExplorationEngine(trackingLLM);
    const exploration = await explorer.explore(goal, exploreBudget);

    // Phase 2: Evaluate
    const evaluator = new EvaluationEngine(trackingLLM);
    const evaluation = await evaluator.evaluate(
      exploration.options,
      evaluationCriteria,
      evaluateBudget,
    );

    // Check confidence threshold
    if (evaluation.confidence >= autoApproveThreshold) {
      // Phase 3: Plan (auto-approved)
      const selectedOption = this.findSelectedOption(exploration, evaluation);
      const planner = new ExecutionPlanner(trackingLLM);
      const plan = await planner.plan(selectedOption, executeBudget);

      const state: WorkflowState = {
        goalId,
        phase: 'done',
        exploration,
        evaluation,
        plan,
        tokensUsed: cumulativeTokens,
        tokensRemaining: tokenBudget - cumulativeTokens,
        requiresHumanApproval: false,
        config,
      };

      this.workflows.set(goalId, state);
      return this.toResult(state);
    }

    // Confidence below threshold — pause for human approval
    const state: WorkflowState = {
      goalId,
      phase: 'evaluate',
      exploration,
      evaluation,
      tokensUsed: cumulativeTokens,
      tokensRemaining: tokenBudget - cumulativeTokens,
      requiresHumanApproval: true,
      config,
    };

    this.workflows.set(goalId, state);
    return this.toResult(state);
  }

  /** Get current status of a workflow */
  getStatus(goalId: string): WorkflowResult | null {
    const state = this.workflows.get(goalId);
    if (!state) return null;
    return this.toResult(state);
  }

  /** Resume a paused workflow (after human approval) — runs the plan phase */
  async resume(goalId: string): Promise<WorkflowResult> {
    const state = this.workflows.get(goalId);
    if (!state) {
      throw new Error(`Workflow ${goalId} not found`);
    }
    if (state.phase !== 'evaluate') {
      throw new Error(
        `Workflow ${goalId} is not in evaluate phase (current: ${state.phase})`,
      );
    }

    // Find the selected option
    const selectedOption = this.findSelectedOption(
      state.exploration!,
      state.evaluation!,
    );

    // Calculate remaining execute budget
    const {
      tokenBudget,
      executeBudgetRatio = 0.6,
    } = state.config;
    const remainingBudget = tokenBudget - state.tokensUsed;
    const executeBudget = Math.min(
      tokenBudget * executeBudgetRatio,
      Math.max(0, remainingBudget),
    );

    // Run the plan phase using a tracking wrapper
    let planTokens = 0;
    const trackingLLM: LLMCaller = {
      call: async (systemPrompt, userPrompt) => {
        const result = await this.llm.call(systemPrompt, userPrompt);
        planTokens += result.tokensUsed;
        return result;
      },
    };

    const planner = new ExecutionPlanner(trackingLLM);
    const plan = await planner.plan(selectedOption, executeBudget);

    state.plan = plan;
    state.tokensUsed += planTokens;
    state.tokensRemaining = state.config.tokenBudget - state.tokensUsed;
    state.phase = 'done';
    state.requiresHumanApproval = false;

    return this.toResult(state);
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  /**
   * Find the selected option from exploration results based on evaluation.
   *
   * The EvaluationEngine's selectedOptionId comes from the LLM response, which
   * may reference IDs that don't match the actual ExplorationOption IDs (since
   * the LLM may return arbitrary strings). We handle this by:
   * 1. First trying a direct ID match
   * 2. Falling back to index-based matching (the position of the selected
   *    score in the evaluation scores array corresponds to the position in
   *    the exploration options array)
   */
  private findSelectedOption(
    exploration: ExplorationResult,
    evaluation: EvaluationResult,
  ) {
    // Try direct ID match first
    const directMatch = exploration.options.find(
      (opt) => opt.id === evaluation.selectedOptionId,
    );
    if (directMatch) return directMatch;

    // Fall back to index-based matching
    const selectedIndex = evaluation.scores.findIndex(
      (s) => s.optionId === evaluation.selectedOptionId,
    );
    if (selectedIndex >= 0 && selectedIndex < exploration.options.length) {
      return exploration.options[selectedIndex]!;
    }

    // Last resort: return the first option
    return exploration.options[0]!;
  }

  /** Strip internal config from state to produce a public WorkflowResult. */
  private toResult(state: WorkflowState): WorkflowResult {
    return {
      goalId: state.goalId,
      phase: state.phase,
      exploration: state.exploration ? { ...state.exploration, options: [...state.exploration.options] } : undefined,
      evaluation: state.evaluation ? { ...state.evaluation, scores: [...state.evaluation.scores] } : undefined,
      plan: state.plan,
      tokensUsed: state.tokensUsed,
      tokensRemaining: state.tokensRemaining,
      requiresHumanApproval: state.requiresHumanApproval,
    };
  }
}

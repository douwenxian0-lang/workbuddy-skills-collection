/**
 * ExecutionPlanner — decomposes a selected ExplorationOption into concrete
 * PlannedTask items with scope annotations and dependency relationships,
 * ready for TaskPool consumption.
 */

import type { ExplorationOption, LLMCaller } from './exploration-engine.js';
import type { TaskScope } from './task-pool.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlannedTask {
  title: string;
  description: string;
  scope: TaskScope;
  dependencies: string[]; // titles of prerequisite tasks
  estimatedTokens: number;
  priority: number; // 1-10
}

export interface ExecutionPlan {
  optionId: string;
  tasks: PlannedTask[];
  totalEstimatedTokens: number;
}

// ---------------------------------------------------------------------------
// Raw shape returned by the LLM (before validation / clamping)
// ---------------------------------------------------------------------------

interface RawTask {
  title: string;
  description: string;
  scope: { paths: string[]; patterns?: string[] };
  dependencies: string[];
  estimatedTokens: number;
  priority: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip markdown code fences (```json ... ```) that LLMs commonly wrap
 * around structured output.
 */
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenceRe = /^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/;
  const match = fenceRe.exec(trimmed);
  return match ? match[1]! : trimmed;
}

function validateRawTasks(parsed: unknown): asserts parsed is { tasks: RawTask[] } {
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as { tasks?: unknown }).tasks)
  ) {
    throw new Error(
      'Failed to parse LLM response: expected an object with a tasks array',
    );
  }

  const tasks = (parsed as { tasks: unknown[] }).tasks;

  for (let i = 0; i < tasks.length; i++) {
    const item = tasks[i];
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof (item as RawTask).title !== 'string' ||
      typeof (item as RawTask).description !== 'string' ||
      typeof (item as RawTask).scope !== 'object' ||
      (item as RawTask).scope === null ||
      !Array.isArray((item as RawTask).scope.paths) ||
      !Array.isArray((item as RawTask).dependencies) ||
      typeof (item as RawTask).estimatedTokens !== 'number' ||
      typeof (item as RawTask).priority !== 'number'
    ) {
      throw new Error(
        `Failed to parse LLM response: task at index ${i} has invalid shape`,
      );
    }

    // Clamp values — LLMs are unpredictable.
    const raw = item as RawTask;
    raw.estimatedTokens = Math.max(0, raw.estimatedTokens);
    raw.priority = Math.max(1, Math.min(10, raw.priority));
  }
}

// ---------------------------------------------------------------------------
// Planner
// ---------------------------------------------------------------------------

export class ExecutionPlanner {
  constructor(private llm: LLMCaller) {}

  /**
   * Decompose the given exploration option into a concrete task list.
   *
   * @param option - The selected ExplorationOption to break down.
   * @param budget - Optional informational token budget (unused for now,
   *   reserved for future budget-aware planning).
   */
  async plan(option: ExplorationOption, budget?: number): Promise<ExecutionPlan> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(option, budget);

    const response = await this.llm.call(systemPrompt, userPrompt);

    const { tasks: rawTasks } = this.parseResponse(response.content);

    const tasks: PlannedTask[] = rawTasks.map((raw) => ({
      title: raw.title,
      description: raw.description,
      scope: raw.scope,
      dependencies: raw.dependencies,
      estimatedTokens: raw.estimatedTokens,
      priority: raw.priority,
    }));

    const totalEstimatedTokens = tasks.reduce(
      (sum, t) => sum + t.estimatedTokens,
      0,
    );

    return {
      optionId: option.id,
      tasks,
      totalEstimatedTokens,
    };
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private buildSystemPrompt(): string {
    return [
      'You are an expert software architect and project planner.',
      'Given an implementation option, decompose it into concrete, actionable tasks.',
      'Return a JSON object with a single "tasks" array.',
      'Each task in the array must have the following fields:',
      '  - title (string): a short name for the task',
      '  - description (string): what needs to be done',
      '  - scope (object): { paths: string[], patterns?: string[] } — files and glob patterns this task touches',
      '  - dependencies (string[]): titles of prerequisite tasks that must complete first',
      '  - estimatedTokens (number): estimated token cost to execute this task',
      '  - priority (number): importance from 1 (lowest) to 10 (highest)',
      '',
      'Return ONLY the JSON object — no markdown fences, no explanation.',
    ].join('\n');
  }

  private buildUserPrompt(option: ExplorationOption, budget?: number): string {
    const parts: string[] = [
      `Option title: ${option.title}`,
      `Description: ${option.description}`,
      `Approach: ${option.approach}`,
      `Estimated total tokens: ${option.estimatedTokens}`,
      `Confidence: ${option.confidence}`,
    ];

    if (option.risks.length > 0) {
      parts.push('');
      parts.push('Risks:');
      for (const r of option.risks) {
        parts.push(`- ${r}`);
      }
    }

    if (option.tradeoffs.length > 0) {
      parts.push('');
      parts.push('Tradeoffs:');
      for (const t of option.tradeoffs) {
        parts.push(`- ${t}`);
      }
    }

    if (budget !== undefined) {
      parts.push('');
      parts.push(`Token budget: ${budget}`);
    }

    return parts.join('\n');
  }

  private parseResponse(content: string): { tasks: RawTask[] } {
    const cleaned = stripCodeFences(content);

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(
        `Failed to parse LLM response as JSON: ${cleaned.slice(0, 200)}`,
      );
    }

    validateRawTasks(parsed);

    if (parsed.tasks.length === 0) {
      throw new Error('LLM returned no tasks');
    }

    return parsed;
  }
}

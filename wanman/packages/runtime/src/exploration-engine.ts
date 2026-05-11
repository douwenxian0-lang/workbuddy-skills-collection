/**
 * ExplorationEngine — generates multiple implementation options for a given goal.
 *
 * Given an ExplorationGoal, the engine asks an LLM to propose several
 * distinct approaches. Each approach includes cost estimates, risks,
 * tradeoffs, and a confidence score so upstream decision-makers can
 * select the best path forward.
 */

import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExplorationGoal {
  description: string;
  constraints?: string[];
  context?: string;
}

export interface ExplorationOption {
  id: string;
  title: string;
  description: string;
  approach: string;
  estimatedTokens: number;
  risks: string[];
  tradeoffs: string[];
  confidence: number;
}

export interface ExplorationResult {
  goalId: string;
  options: ExplorationOption[];
  tokensUsed: number;
  timestamp: number;
}

/** Thin abstraction over an LLM call — easy to mock in tests. */
export interface LLMCaller {
  call(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<{ content: string; tokensUsed: number }>;
}

// ---------------------------------------------------------------------------
// Raw shape returned by the LLM (before we assign IDs)
// ---------------------------------------------------------------------------

interface RawOption {
  title: string;
  description: string;
  approach: string;
  estimatedTokens: number;
  risks: string[];
  tradeoffs: string[];
  confidence: number;
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
  // Match ```json ... ``` or ``` ... ```
  const fenceRe = /^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/;
  const match = fenceRe.exec(trimmed);
  return match ? match[1]! : trimmed;
}

function validateRawOptions(parsed: unknown): asserts parsed is RawOption[] {
  if (!Array.isArray(parsed)) {
    throw new Error(
      'Failed to parse LLM response: expected a JSON array of options',
    );
  }

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof (item as RawOption).title !== 'string' ||
      typeof (item as RawOption).description !== 'string' ||
      typeof (item as RawOption).approach !== 'string' ||
      typeof (item as RawOption).estimatedTokens !== 'number' ||
      !Array.isArray((item as RawOption).risks) ||
      !Array.isArray((item as RawOption).tradeoffs) ||
      typeof (item as RawOption).confidence !== 'number'
    ) {
      throw new Error(
        `Failed to parse LLM response: option at index ${i} has invalid shape`,
      );
    }

    // Clamp confidence to [0, 1] and estimatedTokens to >= 0.
    // LLMs are unpredictable — clamping is safer than throwing.
    const raw = item as RawOption;
    raw.confidence = Math.max(0, Math.min(1, raw.confidence));
    raw.estimatedTokens = Math.max(0, raw.estimatedTokens);
  }
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class ExplorationEngine {
  constructor(private llm: LLMCaller) {}

  /**
   * Generate multiple implementation options for the given goal.
   *
   * @param goal - The exploration goal describing what to implement.
   * @param budget - Informational token budget. A warning is logged if
   *   exceeded, but the call is not blocked.
   */
  async explore(
    goal: ExplorationGoal,
    budget: number,
  ): Promise<ExplorationResult> {
    const goalId = randomUUID();

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(goal);

    const response = await this.llm.call(systemPrompt, userPrompt);

    const rawOptions = this.parseResponse(response.content);

    const options: ExplorationOption[] = rawOptions.map((raw) => ({
      id: randomUUID(),
      title: raw.title,
      description: raw.description,
      approach: raw.approach,
      estimatedTokens: raw.estimatedTokens,
      risks: raw.risks,
      tradeoffs: raw.tradeoffs,
      confidence: raw.confidence,
    }));

    if (response.tokensUsed > budget) {
      console.warn(
        `[ExplorationEngine] Token usage (${response.tokensUsed}) exceeded budget (${budget})`,
      );
    }

    return {
      goalId,
      options,
      tokensUsed: response.tokensUsed,
      timestamp: Date.now(),
    };
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private buildSystemPrompt(): string {
    return [
      'You are an expert software architect.',
      'Given a goal, generate multiple distinct implementation options.',
      'Return a JSON array where each element has the following fields:',
      '  - title (string): a short name for the option',
      '  - description (string): a brief summary',
      '  - approach (string): the concrete technical approach',
      '  - estimatedTokens (number): estimated token cost to execute this option',
      '  - risks (string[]): potential risks',
      '  - tradeoffs (string[]): tradeoffs of this approach',
      '  - confidence (number): your confidence in this option, between 0 and 1',
      '',
      'Return ONLY the JSON array — no markdown fences, no explanation.',
    ].join('\n');
  }

  private buildUserPrompt(goal: ExplorationGoal): string {
    const parts: string[] = [`Goal: ${goal.description}`];

    if (goal.constraints && goal.constraints.length > 0) {
      parts.push('');
      parts.push('Constraints:');
      for (const c of goal.constraints) {
        parts.push(`- ${c}`);
      }
    }

    if (goal.context) {
      parts.push('');
      parts.push(`Context: ${goal.context}`);
    }

    return parts.join('\n');
  }

  private parseResponse(content: string): RawOption[] {
    const cleaned = stripCodeFences(content);

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(
        `Failed to parse LLM response as JSON: ${cleaned.slice(0, 200)}`,
      );
    }

    validateRawOptions(parsed);

    if (parsed.length === 0) {
      throw new Error('LLM returned no options');
    }

    return parsed;
  }
}

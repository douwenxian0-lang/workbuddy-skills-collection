/**
 * EvaluationEngine — evaluates ExplorationEngine options, scores them, and
 * selects the best one.
 *
 * Given a set of ExplorationOptions and evaluation criteria, the engine asks
 * an LLM to score each option on every criterion. It then computes a weighted
 * total score and picks the highest-scoring option. When the LLM's confidence
 * is below a threshold (0.7), the result is flagged for human approval.
 */

import type { ExplorationOption, LLMCaller } from './exploration-engine.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EvaluationCriteria {
  name: string;
  weight: number; // 0-1, all weights should sum to ~1
  description: string;
}

export interface EvaluationScore {
  optionId: string;
  scores: Record<string, number>; // criteria name -> score (0-10)
  totalScore: number; // weighted sum
  reasoning: string;
}

export interface EvaluationResult {
  scores: EvaluationScore[];
  selectedOptionId: string; // the option with highest totalScore
  confidence: number; // 0-1
  tokensUsed: number;
  requiresHumanApproval: boolean; // true when confidence < 0.7
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_CRITERIA: EvaluationCriteria[] = [
  {
    name: 'feasibility',
    weight: 0.3,
    description: 'How feasible is this approach with current resources?',
  },
  {
    name: 'risk',
    weight: 0.25,
    description: 'How low-risk is this approach? (10 = very safe)',
  },
  {
    name: 'impact',
    weight: 0.25,
    description: 'How high is the expected impact/value?',
  },
  {
    name: 'cost',
    weight: 0.2,
    description: 'How cost-efficient is this approach? (10 = very cheap)',
  },
];

// ---------------------------------------------------------------------------
// Raw shape returned by the LLM
// ---------------------------------------------------------------------------

interface RawScore {
  optionId: string;
  scores: Record<string, number>;
  reasoning: string;
}

interface RawLLMEvaluation {
  scores: RawScore[];
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
  const fenceRe = /^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/;
  const match = fenceRe.exec(trimmed);
  return match ? match[1]! : trimmed;
}

function validateRawEvaluation(
  parsed: unknown,
): asserts parsed is RawLLMEvaluation {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(
      'Failed to parse LLM response: expected a JSON object with scores and confidence',
    );
  }

  const obj = parsed as Record<string, unknown>;

  if (!Array.isArray(obj.scores)) {
    throw new Error(
      'Failed to parse LLM response: expected "scores" to be an array',
    );
  }

  if (obj.scores.length === 0) {
    throw new Error(
      'Failed to parse LLM response: scores must be a non-empty array',
    );
  }

  for (let i = 0; i < obj.scores.length; i++) {
    const item = obj.scores[i] as Record<string, unknown> | undefined;
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof item.optionId !== 'string' ||
      typeof item.scores !== 'object' ||
      item.scores === null ||
      typeof item.reasoning !== 'string'
    ) {
      throw new Error(
        `Failed to parse LLM response: score at index ${i} has invalid shape`,
      );
    }
  }

  if (typeof obj.confidence !== 'number') {
    throw new Error(
      'Failed to parse LLM response: expected "confidence" to be a number',
    );
  }
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class EvaluationEngine {
  constructor(private llm: LLMCaller) {}

  async evaluate(
    options: ExplorationOption[],
    criteria?: EvaluationCriteria[],
    budget?: number,
  ): Promise<EvaluationResult> {
    const effectiveCriteria = criteria ?? DEFAULT_CRITERIA;

    const systemPrompt = this.buildSystemPrompt(effectiveCriteria);
    const userPrompt = this.buildUserPrompt(options, effectiveCriteria);

    const response = await this.llm.call(systemPrompt, userPrompt);

    const rawEvaluation = this.parseResponse(response.content);

    const scores: EvaluationScore[] = rawEvaluation.scores.map((raw) => ({
      optionId: raw.optionId,
      scores: raw.scores,
      totalScore: this.calculateTotalScore(raw.scores, effectiveCriteria),
      reasoning: raw.reasoning,
    }));

    // Select the option with the highest totalScore
    let selectedOptionId = scores[0]!.optionId;
    let highestScore = scores[0]!.totalScore;
    for (const score of scores) {
      if (score.totalScore > highestScore) {
        highestScore = score.totalScore;
        selectedOptionId = score.optionId;
      }
    }

    if (budget !== undefined && response.tokensUsed > budget) {
      console.warn(
        `[EvaluationEngine] Token usage (${response.tokensUsed}) exceeded budget (${budget})`,
      );
    }

    return {
      scores,
      selectedOptionId,
      confidence: rawEvaluation.confidence,
      tokensUsed: response.tokensUsed,
      requiresHumanApproval: rawEvaluation.confidence < 0.7,
    };
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private buildSystemPrompt(criteria: EvaluationCriteria[]): string {
    const criteriaLines = criteria.map(
      (c) => `  - ${c.name} (weight ${c.weight}): ${c.description}`,
    );

    return [
      'You are an expert evaluator of software implementation options.',
      'Given a set of options, score each one on the following criteria (0-10 scale):',
      ...criteriaLines,
      '',
      'Return a JSON object with the following shape:',
      '{',
      '  "scores": [',
      '    {',
      '      "optionId": "<option id>",',
      '      "scores": { "<criteria name>": <score 0-10>, ... },',
      '      "reasoning": "<explanation of your scoring>"',
      '    }',
      '  ],',
      '  "confidence": <0-1, your overall confidence in the evaluation>',
      '}',
      '',
      'Return ONLY the JSON object — no markdown fences, no explanation.',
    ].join('\n');
  }

  private buildUserPrompt(
    options: ExplorationOption[],
    criteria: EvaluationCriteria[],
  ): string {
    const parts: string[] = ['Evaluate the following options:'];

    for (const option of options) {
      parts.push('');
      parts.push(`Option ID: ${option.id}`);
      parts.push(`Title: ${option.title}`);
      parts.push(`Description: ${option.description}`);
      parts.push(`Approach: ${option.approach}`);
      parts.push(`Estimated Tokens: ${option.estimatedTokens}`);
      if (option.risks.length > 0) {
        parts.push(`Risks: ${option.risks.join(', ')}`);
      }
      if (option.tradeoffs.length > 0) {
        parts.push(`Tradeoffs: ${option.tradeoffs.join(', ')}`);
      }
      parts.push(`Confidence: ${option.confidence}`);
    }

    parts.push('');
    parts.push('Criteria:');
    for (const c of criteria) {
      parts.push(`- ${c.name} (weight ${c.weight}): ${c.description}`);
    }

    return parts.join('\n');
  }

  private parseResponse(content: string): RawLLMEvaluation {
    const cleaned = stripCodeFences(content);

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(
        `Failed to parse LLM response as JSON: ${cleaned.slice(0, 200)}`,
      );
    }

    validateRawEvaluation(parsed);
    return parsed;
  }

  private calculateTotalScore(
    scores: Record<string, number>,
    criteria: EvaluationCriteria[],
  ): number {
    let total = 0;
    for (const criterion of criteria) {
      const score = scores[criterion.name];
      if (typeof score === 'number') {
        total += score * criterion.weight;
      }
    }
    return total;
  }
}

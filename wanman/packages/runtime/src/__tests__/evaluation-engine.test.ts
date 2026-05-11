/**
 * Unit tests for EvaluationEngine — evaluates ExplorationOptions and selects the best one.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  EvaluationEngine,
  DEFAULT_CRITERIA,
  type EvaluationCriteria,
  type EvaluationResult,
  type EvaluationScore,
} from '../evaluation-engine.js'
import type { LLMCaller, ExplorationOption } from '../exploration-engine.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOptions(): ExplorationOption[] {
  return [
    {
      id: 'opt-1',
      title: 'Option A',
      description: 'desc A',
      approach: 'approach A',
      estimatedTokens: 50000,
      risks: ['risk1'],
      tradeoffs: ['tradeoff1'],
      confidence: 0.8,
    },
    {
      id: 'opt-2',
      title: 'Option B',
      description: 'desc B',
      approach: 'approach B',
      estimatedTokens: 30000,
      risks: [],
      tradeoffs: ['tradeoff2'],
      confidence: 0.6,
    },
  ]
}

function makeLLMResponse(overrides?: {
  scores?: Array<{
    optionId: string
    scores: Record<string, number>
    reasoning: string
  }>
  confidence?: number
}) {
  return {
    scores: overrides?.scores ?? [
      {
        optionId: 'opt-1',
        scores: { feasibility: 8, risk: 7, impact: 9, cost: 6 },
        reasoning: 'Strong approach with good feasibility',
      },
      {
        optionId: 'opt-2',
        scores: { feasibility: 6, risk: 9, impact: 5, cost: 8 },
        reasoning: 'Safe but lower impact',
      },
    ],
    confidence: overrides?.confidence ?? 0.85,
  }
}

function makeMockLLM(content?: string, tokensUsed?: number): LLMCaller {
  return {
    call: vi.fn().mockResolvedValue({
      content: content ?? JSON.stringify(makeLLMResponse()),
      tokensUsed: tokensUsed ?? 2000,
    }),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EvaluationEngine', () => {
  let mockLLM: LLMCaller
  let engine: EvaluationEngine

  beforeEach(() => {
    mockLLM = makeMockLLM()
    engine = new EvaluationEngine(mockLLM)
  })

  it('should return EvaluationResult with correct structure', async () => {
    const result = await engine.evaluate(makeOptions())

    expect(result).toBeDefined()
    expect(result.scores).toBeInstanceOf(Array)
    expect(result.scores).toHaveLength(2)
    expect(typeof result.selectedOptionId).toBe('string')
    expect(typeof result.confidence).toBe('number')
    expect(typeof result.tokensUsed).toBe('number')
    expect(typeof result.requiresHumanApproval).toBe('boolean')

    for (const score of result.scores) {
      expect(typeof score.optionId).toBe('string')
      expect(typeof score.scores).toBe('object')
      expect(typeof score.totalScore).toBe('number')
      expect(typeof score.reasoning).toBe('string')
    }
  })

  it('should calculate totalScore as weighted sum correctly', async () => {
    const result = await engine.evaluate(makeOptions())

    // opt-1: feasibility=8*0.3 + risk=7*0.25 + impact=9*0.25 + cost=6*0.2
    //      = 2.4 + 1.75 + 2.25 + 1.2 = 7.6
    const score1 = result.scores.find((s) => s.optionId === 'opt-1')!
    expect(score1).toBeDefined()
    expect(score1.totalScore).toBeCloseTo(7.6, 5)

    // opt-2: feasibility=6*0.3 + risk=9*0.25 + impact=5*0.25 + cost=8*0.2
    //      = 1.8 + 2.25 + 1.25 + 1.6 = 6.9
    const score2 = result.scores.find((s) => s.optionId === 'opt-2')!
    expect(score2).toBeDefined()
    expect(score2.totalScore).toBeCloseTo(6.9, 5)
  })

  it('should select option with highest totalScore', async () => {
    const result = await engine.evaluate(makeOptions())

    // opt-1 has totalScore 7.6 vs opt-2 has 6.9
    expect(result.selectedOptionId).toBe('opt-1')
  })

  it('should set requiresHumanApproval=true when confidence < 0.7', async () => {
    const lowConfidence = makeLLMResponse({ confidence: 0.5 })
    const llm = makeMockLLM(JSON.stringify(lowConfidence), 1500)
    const eng = new EvaluationEngine(llm)

    const result = await eng.evaluate(makeOptions())

    expect(result.confidence).toBe(0.5)
    expect(result.requiresHumanApproval).toBe(true)
  })

  it('should set requiresHumanApproval=false when confidence >= 0.7', async () => {
    const highConfidence = makeLLMResponse({ confidence: 0.85 })
    const llm = makeMockLLM(JSON.stringify(highConfidence), 1500)
    const eng = new EvaluationEngine(llm)

    const result = await eng.evaluate(makeOptions())

    expect(result.confidence).toBe(0.85)
    expect(result.requiresHumanApproval).toBe(false)
  })

  it('should set requiresHumanApproval=false when confidence is exactly 0.7', async () => {
    const boundaryConfidence = makeLLMResponse({ confidence: 0.7 })
    const llm = makeMockLLM(JSON.stringify(boundaryConfidence), 1500)
    const eng = new EvaluationEngine(llm)

    const result = await eng.evaluate(makeOptions())

    expect(result.confidence).toBe(0.7)
    expect(result.requiresHumanApproval).toBe(false)
  })

  it('should use DEFAULT_CRITERIA when none provided', async () => {
    await engine.evaluate(makeOptions())

    const call = (mockLLM.call as ReturnType<typeof vi.fn>).mock.calls[0]!
    const combined = (call[0] as string) + ' ' + (call[1] as string)

    // All default criteria names should appear in the prompt
    for (const c of DEFAULT_CRITERIA) {
      expect(combined).toContain(c.name)
    }
  })

  it('should use custom criteria when provided', async () => {
    const customCriteria: EvaluationCriteria[] = [
      { name: 'speed', weight: 0.5, description: 'How fast can this be done?' },
      {
        name: 'quality',
        weight: 0.5,
        description: 'How high quality is the result?',
      },
    ]

    const customResponse = {
      scores: [
        {
          optionId: 'opt-1',
          scores: { speed: 8, quality: 9 },
          reasoning: 'Fast and high quality',
        },
        {
          optionId: 'opt-2',
          scores: { speed: 6, quality: 7 },
          reasoning: 'Slower but decent',
        },
      ],
      confidence: 0.9,
    }

    const llm = makeMockLLM(JSON.stringify(customResponse), 1500)
    const eng = new EvaluationEngine(llm)

    const result = await eng.evaluate(makeOptions(), customCriteria)

    // opt-1: speed=8*0.5 + quality=9*0.5 = 4 + 4.5 = 8.5
    const score1 = result.scores.find((s) => s.optionId === 'opt-1')!
    expect(score1.totalScore).toBeCloseTo(8.5, 5)

    // opt-2: speed=6*0.5 + quality=7*0.5 = 3 + 3.5 = 6.5
    const score2 = result.scores.find((s) => s.optionId === 'opt-2')!
    expect(score2.totalScore).toBeCloseTo(6.5, 5)

    expect(result.selectedOptionId).toBe('opt-1')
  })

  it('should handle markdown code fences in LLM response', async () => {
    const wrapped =
      '```json\n' + JSON.stringify(makeLLMResponse()) + '\n```'
    const llm = makeMockLLM(wrapped, 1800)
    const eng = new EvaluationEngine(llm)

    const result = await eng.evaluate(makeOptions())

    expect(result.scores).toHaveLength(2)
    expect(result.selectedOptionId).toBe('opt-1')
    expect(result.confidence).toBe(0.85)
  })

  it('should handle invalid JSON from LLM gracefully', async () => {
    const llm = makeMockLLM('this is not json at all', 500)
    const eng = new EvaluationEngine(llm)

    await expect(eng.evaluate(makeOptions())).rejects.toThrow(
      /failed to parse/i,
    )
  })
})

/**
 * Unit tests for ExplorationEngine — generates multiple implementation options for a goal.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ExplorationEngine,
  type LLMCaller,
  type ExplorationGoal,
  type ExplorationOption,
} from '../exploration-engine.js'

function makeMockOptions() {
  return [
    {
      title: 'Option A',
      description: 'desc A',
      approach: 'approach A',
      estimatedTokens: 50000,
      risks: ['risk1'],
      tradeoffs: ['tradeoff1'],
      confidence: 0.8,
    },
    {
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

function makeMockLLM(content?: string, tokensUsed?: number): LLMCaller {
  return {
    call: vi.fn().mockResolvedValue({
      content: content ?? JSON.stringify(makeMockOptions()),
      tokensUsed: tokensUsed ?? 1500,
    }),
  }
}

describe('ExplorationEngine', () => {
  let mockLLM: LLMCaller
  let engine: ExplorationEngine

  beforeEach(() => {
    mockLLM = makeMockLLM()
    engine = new ExplorationEngine(mockLLM)
  })

  it('should return ExplorationResult with correct goalId and timestamp', async () => {
    const before = Date.now()

    const result = await engine.explore(
      { description: 'Build a REST API' },
      10000,
    )

    expect(result.goalId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    expect(result.timestamp).toBeGreaterThanOrEqual(before)
    expect(result.timestamp).toBeLessThanOrEqual(Date.now())
    expect(result.options).toHaveLength(2)
  })

  it('should parse LLM response correctly into ExplorationOption[]', async () => {
    const result = await engine.explore(
      { description: 'Refactor the auth module' },
      10000,
    )

    expect(result.options).toHaveLength(2)

    const optA = result.options.find((o) => o.title === 'Option A')!
    expect(optA).toBeDefined()
    expect(optA.description).toBe('desc A')
    expect(optA.approach).toBe('approach A')
    expect(optA.estimatedTokens).toBe(50000)
    expect(optA.risks).toEqual(['risk1'])
    expect(optA.tradeoffs).toEqual(['tradeoff1'])
    expect(optA.confidence).toBe(0.8)

    const optB = result.options.find((o) => o.title === 'Option B')!
    expect(optB).toBeDefined()
    expect(optB.description).toBe('desc B')
    expect(optB.approach).toBe('approach B')
    expect(optB.estimatedTokens).toBe(30000)
    expect(optB.risks).toEqual([])
    expect(optB.tradeoffs).toEqual(['tradeoff2'])
    expect(optB.confidence).toBe(0.6)
  })

  it('should handle LLM response wrapped in markdown code fences', async () => {
    const wrapped = '```json\n' + JSON.stringify(makeMockOptions()) + '\n```'
    const llm = makeMockLLM(wrapped, 1200)
    const eng = new ExplorationEngine(llm)

    const result = await eng.explore(
      { description: 'Migrate database' },
      10000,
    )

    expect(result.options).toHaveLength(2)
    expect(result.options[0]!.title).toBe('Option A')
    expect(result.options[1]!.title).toBe('Option B')
  })

  it('should assign unique IDs to each option', async () => {
    const result = await engine.explore(
      { description: 'Add caching layer' },
      10000,
    )

    const ids = result.options.map((o) => o.id)
    expect(ids).toHaveLength(2)
    // All IDs should be valid UUIDs
    for (const id of ids) {
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
    }
    // All IDs should be unique
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('should include tokensUsed from LLM response', async () => {
    const llm = makeMockLLM(undefined, 2500)
    const eng = new ExplorationEngine(llm)

    const result = await eng.explore(
      { description: 'Optimize query performance' },
      10000,
    )

    expect(result.tokensUsed).toBe(2500)
  })

  it('should handle invalid JSON from LLM gracefully (throws descriptive error)', async () => {
    const llm = makeMockLLM('this is not json at all', 500)
    const eng = new ExplorationEngine(llm)

    await expect(
      eng.explore({ description: 'Do something' }, 10000),
    ).rejects.toThrow(/failed to parse/i)
  })

  it('should include goal constraints in the prompt sent to LLM', async () => {
    const goal: ExplorationGoal = {
      description: 'Rewrite the payment service',
      constraints: ['不能修改 API 接口', '预算 < 500K tokens'],
      context: 'We use Stripe for payments',
    }

    await engine.explore(goal, 10000)

    const call = (mockLLM.call as ReturnType<typeof vi.fn>).mock.calls[0]!
    const systemPrompt = call[0] as string
    const userPrompt = call[1] as string

    // Constraints should appear somewhere in the prompts
    const combined = systemPrompt + ' ' + userPrompt
    expect(combined).toContain('不能修改 API 接口')
    expect(combined).toContain('预算 < 500K tokens')
    expect(combined).toContain('Rewrite the payment service')
  })

  it('should throw when LLM returns an empty array', async () => {
    const llm = makeMockLLM(JSON.stringify([]), 100)
    const eng = new ExplorationEngine(llm)

    await expect(
      eng.explore({ description: 'Empty response' }, 10000),
    ).rejects.toThrow('LLM returned no options')
  })

  it('should clamp confidence outside [0,1] and negative estimatedTokens', async () => {
    const badOptions = [
      {
        title: 'Over-confident',
        description: 'desc',
        approach: 'approach',
        estimatedTokens: -500,
        risks: [],
        tradeoffs: [],
        confidence: 1.5,
      },
      {
        title: 'Under-confident',
        description: 'desc',
        approach: 'approach',
        estimatedTokens: 1000,
        risks: [],
        tradeoffs: [],
        confidence: -0.3,
      },
    ]
    const llm = makeMockLLM(JSON.stringify(badOptions), 800)
    const eng = new ExplorationEngine(llm)

    const result = await eng.explore(
      { description: 'Clamp test' },
      10000,
    )

    const optOver = result.options.find((o) => o.title === 'Over-confident')!
    expect(optOver.confidence).toBe(1)
    expect(optOver.estimatedTokens).toBe(0)

    const optUnder = result.options.find((o) => o.title === 'Under-confident')!
    expect(optUnder.confidence).toBe(0)
    expect(optUnder.estimatedTokens).toBe(1000)
  })

  it('should log a warning but not fail when tokensUsed exceeds budget', async () => {
    const llm = makeMockLLM(undefined, 5000)
    const eng = new ExplorationEngine(llm)

    // Budget of 1000, but LLM uses 5000 — should still succeed
    const result = await eng.explore(
      { description: 'Over-budget task' },
      1000,
    )

    expect(result.tokensUsed).toBe(5000)
    expect(result.options).toHaveLength(2)
  })
})

/**
 * Unit tests for ExecutionPlanner — decomposes an ExplorationOption into concrete tasks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ExecutionPlanner,
  type PlannedTask,
  type ExecutionPlan,
} from '../execution-planner.js'
import type { LLMCaller, ExplorationOption } from '../exploration-engine.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOption(): ExplorationOption {
  return {
    id: 'opt-42',
    title: 'Build REST API',
    description: 'Create a REST API with CRUD endpoints',
    approach: 'Use Express with TypeScript',
    estimatedTokens: 80000,
    risks: ['tight deadline'],
    tradeoffs: ['more boilerplate'],
    confidence: 0.85,
  }
}

function makeMockTasks() {
  return {
    tasks: [
      {
        title: 'Set up database schema',
        description: 'Create the SQLite tables...',
        scope: { paths: ['src/db.ts'], patterns: ['src/models/**'] },
        dependencies: [],
        estimatedTokens: 20000,
        priority: 8,
      },
      {
        title: 'Implement API endpoints',
        description: 'Create REST endpoints...',
        scope: { paths: ['src/api.ts'], patterns: ['src/routes/**'] },
        dependencies: ['Set up database schema'],
        estimatedTokens: 35000,
        priority: 7,
      },
    ],
  }
}

function makeMockLLM(content?: string, tokensUsed?: number): LLMCaller {
  return {
    call: vi.fn().mockResolvedValue({
      content: content ?? JSON.stringify(makeMockTasks()),
      tokensUsed: tokensUsed ?? 1500,
    }),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExecutionPlanner', () => {
  let mockLLM: LLMCaller
  let planner: ExecutionPlanner

  beforeEach(() => {
    mockLLM = makeMockLLM()
    planner = new ExecutionPlanner(mockLLM)
  })

  it('should return ExecutionPlan with correct optionId', async () => {
    const result = await planner.plan(makeOption())

    expect(result.optionId).toBe('opt-42')
  })

  it('should parse LLM response into PlannedTask array correctly', async () => {
    const result = await planner.plan(makeOption())

    expect(result.tasks).toHaveLength(2)

    const task0 = result.tasks[0]!
    expect(task0.title).toBe('Set up database schema')
    expect(task0.description).toBe('Create the SQLite tables...')
    expect(task0.scope).toEqual({ paths: ['src/db.ts'], patterns: ['src/models/**'] })
    expect(task0.dependencies).toEqual([])
    expect(task0.estimatedTokens).toBe(20000)
    expect(task0.priority).toBe(8)

    const task1 = result.tasks[1]!
    expect(task1.title).toBe('Implement API endpoints')
    expect(task1.description).toBe('Create REST endpoints...')
    expect(task1.scope).toEqual({ paths: ['src/api.ts'], patterns: ['src/routes/**'] })
    expect(task1.dependencies).toEqual(['Set up database schema'])
    expect(task1.estimatedTokens).toBe(35000)
    expect(task1.priority).toBe(7)
  })

  it('should calculate totalEstimatedTokens as sum', async () => {
    const result = await planner.plan(makeOption())

    // 20000 + 35000 = 55000
    expect(result.totalEstimatedTokens).toBe(55000)
  })

  it('should handle markdown code fences', async () => {
    const wrapped = '```json\n' + JSON.stringify(makeMockTasks()) + '\n```'
    const llm = makeMockLLM(wrapped, 1200)
    const plan = new ExecutionPlanner(llm)

    const result = await plan.plan(makeOption())

    expect(result.tasks).toHaveLength(2)
    expect(result.tasks[0]!.title).toBe('Set up database schema')
    expect(result.tasks[1]!.title).toBe('Implement API endpoints')
  })

  it('should handle code fences without json specifier', async () => {
    const wrapped = '```\n' + JSON.stringify(makeMockTasks()) + '\n```'
    const llm = makeMockLLM(wrapped, 1200)
    const plan = new ExecutionPlanner(llm)

    const result = await plan.plan(makeOption())

    expect(result.tasks).toHaveLength(2)
  })

  it('should validate task structure (missing fields → error)', async () => {
    const invalid = {
      tasks: [
        {
          title: 'Incomplete task',
          // missing description, scope, dependencies, estimatedTokens, priority
        },
      ],
    }
    const llm = makeMockLLM(JSON.stringify(invalid), 500)
    const plan = new ExecutionPlanner(llm)

    await expect(plan.plan(makeOption())).rejects.toThrow(/invalid shape/i)
  })

  it('should throw on empty tasks array', async () => {
    const empty = { tasks: [] }
    const llm = makeMockLLM(JSON.stringify(empty), 500)
    const plan = new ExecutionPlanner(llm)

    await expect(plan.plan(makeOption())).rejects.toThrow(/no tasks/i)
  })

  it('should throw when tasks field is missing entirely', async () => {
    const noTasks = { something: 'else' }
    const llm = makeMockLLM(JSON.stringify(noTasks), 500)
    const plan = new ExecutionPlanner(llm)

    await expect(plan.plan(makeOption())).rejects.toThrow()
  })

  it('should clamp priority and estimatedTokens', async () => {
    const badTasks = {
      tasks: [
        {
          title: 'Over-priority',
          description: 'desc',
          scope: { paths: ['src/a.ts'] },
          dependencies: [],
          estimatedTokens: -500,
          priority: 15,
        },
        {
          title: 'Under-priority',
          description: 'desc',
          scope: { paths: ['src/b.ts'] },
          dependencies: [],
          estimatedTokens: 10000,
          priority: -3,
        },
      ],
    }
    const llm = makeMockLLM(JSON.stringify(badTasks), 800)
    const plan = new ExecutionPlanner(llm)

    const result = await plan.plan(makeOption())

    const overTask = result.tasks.find((t) => t.title === 'Over-priority')!
    expect(overTask.priority).toBe(10)
    expect(overTask.estimatedTokens).toBe(0)

    const underTask = result.tasks.find((t) => t.title === 'Under-priority')!
    expect(underTask.priority).toBe(1)
    expect(underTask.estimatedTokens).toBe(10000)
  })

  it('should include option details in prompt sent to LLM', async () => {
    const option = makeOption()
    await planner.plan(option)

    const call = (mockLLM.call as ReturnType<typeof vi.fn>).mock.calls[0]!
    const systemPrompt = call[0] as string
    const userPrompt = call[1] as string
    const combined = systemPrompt + ' ' + userPrompt

    expect(combined).toContain(option.title)
    expect(combined).toContain(option.description)
    expect(combined).toContain(option.approach)
  })

  it('should handle invalid JSON from LLM gracefully', async () => {
    const llm = makeMockLLM('this is not json at all', 500)
    const plan = new ExecutionPlanner(llm)

    await expect(plan.plan(makeOption())).rejects.toThrow(/failed to parse/i)
  })

  it('should clamp totalEstimatedTokens correctly when individual tokens are clamped', async () => {
    const tasksWithNegative = {
      tasks: [
        {
          title: 'Task A',
          description: 'desc',
          scope: { paths: ['a.ts'] },
          dependencies: [],
          estimatedTokens: -100,
          priority: 5,
        },
        {
          title: 'Task B',
          description: 'desc',
          scope: { paths: ['b.ts'] },
          dependencies: [],
          estimatedTokens: 500,
          priority: 5,
        },
      ],
    }
    const llm = makeMockLLM(JSON.stringify(tasksWithNegative), 500)
    const plan = new ExecutionPlanner(llm)

    const result = await plan.plan(makeOption())

    // -100 is clamped to 0, so total = 0 + 500 = 500
    expect(result.totalEstimatedTokens).toBe(500)
  })
})

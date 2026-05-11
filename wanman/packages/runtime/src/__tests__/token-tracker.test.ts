/**
 * Tests for TokenTracker — tracks token consumption per workflow/agent/task,
 * with budget warnings and hard limits.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { TokenTracker } from '../token-tracker.js'
import type { TokenUsage } from '../token-tracker.js'

let tracker: TokenTracker

/** Helper to create a TokenUsage record with sensible defaults. */
function usage(overrides: Partial<TokenUsage> = {}): TokenUsage {
  return {
    workflowId: 'wf-1',
    agentId: 'agent-a',
    phase: 'explore',
    inputTokens: 100,
    outputTokens: 50,
    timestamp: Date.now(),
    ...overrides,
  }
}

describe('TokenTracker', () => {
  beforeEach(() => {
    tracker = new TokenTracker()
  })

  // ── record() ──────────────────────────────────────────────────────

  describe('record', () => {
    it('should store usage events', () => {
      tracker.record(usage())
      tracker.record(usage({ agentId: 'agent-b' }))

      const records = tracker.getRecords('wf-1')
      expect(records).toHaveLength(2)
    })
  })

  // ── getUsage() ────────────────────────────────────────────────────

  describe('getUsage', () => {
    it('should return correct total (input + output combined)', () => {
      tracker.record(usage({ inputTokens: 200, outputTokens: 100 }))
      tracker.record(usage({ inputTokens: 300, outputTokens: 150 }))

      const summary = tracker.getUsage('wf-1')
      expect(summary.total).toBe(750) // 200+100 + 300+150
    })

    it('should group by phase correctly', () => {
      tracker.record(usage({ phase: 'explore', inputTokens: 100, outputTokens: 50 }))
      tracker.record(usage({ phase: 'evaluate', inputTokens: 200, outputTokens: 100 }))
      tracker.record(usage({ phase: 'execute', inputTokens: 50, outputTokens: 25 }))
      tracker.record(usage({ phase: 'explore', inputTokens: 10, outputTokens: 5 }))

      const summary = tracker.getUsage('wf-1')
      expect(summary.byPhase).toEqual({
        explore: 165,  // 100+50 + 10+5
        evaluate: 300, // 200+100
        execute: 75,   // 50+25
      })
    })

    it('should group by agent correctly', () => {
      tracker.record(usage({ agentId: 'agent-a', inputTokens: 100, outputTokens: 50 }))
      tracker.record(usage({ agentId: 'agent-b', inputTokens: 200, outputTokens: 100 }))
      tracker.record(usage({ agentId: 'agent-a', inputTokens: 30, outputTokens: 20 }))

      const summary = tracker.getUsage('wf-1')
      expect(summary.byAgent).toEqual({
        'agent-a': 200, // 100+50 + 30+20
        'agent-b': 300, // 200+100
      })
    })

    it('should return zeros for unknown workflow', () => {
      const summary = tracker.getUsage('wf-unknown')
      expect(summary.total).toBe(0)
      expect(summary.byPhase).toEqual({})
      expect(summary.byAgent).toEqual({})
    })
  })

  // ── checkBudget() ─────────────────────────────────────────────────

  describe('checkBudget', () => {
    it('should return correct remaining tokens', () => {
      tracker.record(usage({ inputTokens: 200, outputTokens: 100 }))

      const check = tracker.checkBudget('wf-1', 1000)
      expect(check.remaining).toBe(700) // 1000 - 300
    })

    it('should set exceeded=true when over budget', () => {
      tracker.record(usage({ inputTokens: 600, outputTokens: 500 }))

      const check = tracker.checkBudget('wf-1', 1000)
      expect(check.exceeded).toBe(true)
      expect(check.remaining).toBe(-100) // 1000 - 1100
    })

    it('should set warning=true when below 20% of budget', () => {
      // Budget 1000, use 850 → remaining 150, which is < 200 (20% of 1000)
      tracker.record(usage({ inputTokens: 500, outputTokens: 350 }))

      const check = tracker.checkBudget('wf-1', 1000)
      expect(check.warning).toBe(true)
      expect(check.exceeded).toBe(false)
    })

    it('should set exceeded=false and warning=false when plenty of budget', () => {
      tracker.record(usage({ inputTokens: 50, outputTokens: 50 }))

      const check = tracker.checkBudget('wf-1', 1000)
      expect(check.exceeded).toBe(false)
      expect(check.warning).toBe(false)
      expect(check.remaining).toBe(900)
    })
  })

  // ── getRecords() ──────────────────────────────────────────────────

  describe('getRecords', () => {
    it('should return only records for the specified workflow', () => {
      tracker.record(usage({ workflowId: 'wf-1' }))
      tracker.record(usage({ workflowId: 'wf-2' }))
      tracker.record(usage({ workflowId: 'wf-1' }))

      const records = tracker.getRecords('wf-1')
      expect(records).toHaveLength(2)
      expect(records.every((r) => r.workflowId === 'wf-1')).toBe(true)
    })

    it('should return empty array for unknown workflow', () => {
      const records = tracker.getRecords('wf-unknown')
      expect(records).toHaveLength(0)
    })
  })

  // ── cross-workflow isolation ───────────────────────────────────────

  describe('multiple workflows', () => {
    it('should track workflows independently', () => {
      tracker.record(usage({ workflowId: 'wf-1', inputTokens: 100, outputTokens: 50 }))
      tracker.record(usage({ workflowId: 'wf-2', inputTokens: 200, outputTokens: 100 }))

      const summary1 = tracker.getUsage('wf-1')
      const summary2 = tracker.getUsage('wf-2')

      expect(summary1.total).toBe(150)
      expect(summary2.total).toBe(300)

      const budget1 = tracker.checkBudget('wf-1', 500)
      const budget2 = tracker.checkBudget('wf-2', 500)

      expect(budget1.remaining).toBe(350)
      expect(budget2.remaining).toBe(200)
    })
  })
})

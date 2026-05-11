/**
 * Tests for SafetyGate — controls execution permissions for irreversible actions.
 * Auto-allows safe operations, gates dangerous ones behind approval.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { SafetyGate } from '../safety-gate.js'
import type { ActionType } from '../safety-gate.js'

let gate: SafetyGate

describe('SafetyGate', () => {
  beforeEach(() => {
    gate = new SafetyGate()
  })

  describe('check', () => {
    it('should auto-allow git_commit', () => {
      const result = gate.check('git_commit')
      expect(result.allowed).toBe(true)
      expect(result.requiresApproval).toBe(false)
    })

    it('should auto-allow git_merge_staging', () => {
      const result = gate.check('git_merge_staging')
      expect(result.allowed).toBe(true)
      expect(result.requiresApproval).toBe(false)
    })

    it('should require approval for git_merge_production', () => {
      const result = gate.check('git_merge_production')
      expect(result.allowed).toBe(false)
      expect(result.requiresApproval).toBe(true)
    })

    it('should require approval for deploy_production', () => {
      const result = gate.check('deploy_production')
      expect(result.allowed).toBe(false)
      expect(result.requiresApproval).toBe(true)
    })

    it('should require approval for deploy_staging', () => {
      const result = gate.check('deploy_staging')
      expect(result.allowed).toBe(false)
      expect(result.requiresApproval).toBe(true)
    })

    it('should require approval for send_email', () => {
      const result = gate.check('send_email')
      expect(result.allowed).toBe(false)
      expect(result.requiresApproval).toBe(true)
    })

    it('should require approval for send_slack', () => {
      const result = gate.check('send_slack')
      expect(result.allowed).toBe(false)
      expect(result.requiresApproval).toBe(true)
    })

    it('should require approval for financial_transaction', () => {
      const result = gate.check('financial_transaction')
      expect(result.allowed).toBe(false)
      expect(result.requiresApproval).toBe(true)
    })

    it('should require approval for delete_data', () => {
      const result = gate.check('delete_data')
      expect(result.allowed).toBe(false)
      expect(result.requiresApproval).toBe(true)
    })

    it('should require approval for modify_permissions', () => {
      const result = gate.check('modify_permissions')
      expect(result.allowed).toBe(false)
      expect(result.requiresApproval).toBe(true)
    })
  })

  describe('requestApproval', () => {
    it('should create a pending approval request', () => {
      const id = gate.requestApproval('deploy_production', { env: 'prod' })
      expect(id).toBeDefined()
      expect(typeof id).toBe('string')

      const approval = gate.getApproval(id)
      expect(approval).not.toBeNull()
      expect(approval!.action).toBe('deploy_production')
      expect(approval!.status).toBe('pending')
      expect(approval!.context).toEqual({ env: 'prod' })
      expect(approval!.createdAt).toBeLessThanOrEqual(Date.now())
      expect(approval!.createdAt).toBeGreaterThan(Date.now() - 5000)
      expect(approval!.resolvedAt).toBeUndefined()
      expect(approval!.reason).toBeUndefined()
    })

    it('should create request with empty context when not provided', () => {
      const id = gate.requestApproval('delete_data')
      const approval = gate.getApproval(id)
      expect(approval!.context).toEqual({})
    })
  })

  describe('approve', () => {
    it('should change status to approved', () => {
      const id = gate.requestApproval('deploy_production')
      gate.approve(id)

      const approval = gate.getApproval(id)
      expect(approval!.status).toBe('approved')
      expect(approval!.resolvedAt).toBeDefined()
      expect(approval!.resolvedAt).toBeLessThanOrEqual(Date.now())
    })

    it('should throw when approving a non-pending request (already approved)', () => {
      const id = gate.requestApproval('deploy_production')
      gate.approve(id)
      expect(() => gate.approve(id)).toThrow()
    })

    it('should throw when approving a non-pending request (already denied)', () => {
      const id = gate.requestApproval('deploy_production')
      gate.deny(id, 'not safe')
      expect(() => gate.approve(id)).toThrow()
    })

    it('should throw when approving a non-existent request', () => {
      expect(() => gate.approve('nonexistent-id')).toThrow()
    })
  })

  describe('deny', () => {
    it('should change status to denied with reason', () => {
      const id = gate.requestApproval('financial_transaction', { amount: 1000 })
      gate.deny(id, 'amount exceeds limit')

      const approval = gate.getApproval(id)
      expect(approval!.status).toBe('denied')
      expect(approval!.reason).toBe('amount exceeds limit')
      expect(approval!.resolvedAt).toBeDefined()
      expect(approval!.resolvedAt).toBeLessThanOrEqual(Date.now())
    })

    it('should throw when denying a non-pending request (already approved)', () => {
      const id = gate.requestApproval('deploy_production')
      gate.approve(id)
      expect(() => gate.deny(id, 'too late')).toThrow()
    })

    it('should throw when denying a non-pending request (already denied)', () => {
      const id = gate.requestApproval('deploy_production')
      gate.deny(id, 'first denial')
      expect(() => gate.deny(id, 'second denial')).toThrow()
    })

    it('should throw when denying a non-existent request', () => {
      expect(() => gate.deny('nonexistent-id', 'reason')).toThrow()
    })
  })

  describe('getApproval', () => {
    it('should return null for non-existent approval', () => {
      const result = gate.getApproval('nonexistent-id')
      expect(result).toBeNull()
    })

    it('should return the approval request by ID', () => {
      const id = gate.requestApproval('send_email', { to: 'user@test.com' })
      const approval = gate.getApproval(id)
      expect(approval).not.toBeNull()
      expect(approval!.id).toBe(id)
      expect(approval!.action).toBe('send_email')
    })
  })

  describe('listPending', () => {
    it('should return only pending requests', () => {
      const id1 = gate.requestApproval('deploy_production')
      const id2 = gate.requestApproval('send_email')
      const id3 = gate.requestApproval('delete_data')

      // Approve one, deny another, leave one pending
      gate.approve(id1)
      gate.deny(id2, 'not now')

      const pending = gate.listPending()
      expect(pending).toHaveLength(1)
      expect(pending[0]!.id).toBe(id3)
      expect(pending[0]!.status).toBe('pending')
    })

    it('should return empty array when no pending requests', () => {
      const id = gate.requestApproval('deploy_production')
      gate.approve(id)

      const pending = gate.listPending()
      expect(pending).toHaveLength(0)
    })

    it('should return all pending when none resolved', () => {
      gate.requestApproval('deploy_production')
      gate.requestApproval('send_email')
      gate.requestApproval('delete_data')

      const pending = gate.listPending()
      expect(pending).toHaveLength(3)
    })
  })
})

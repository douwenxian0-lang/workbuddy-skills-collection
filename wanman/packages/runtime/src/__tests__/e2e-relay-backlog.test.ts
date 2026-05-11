/**
 * E2E test: Relay message routing, backlog, and steer priority.
 *
 * Uses real SQLite MessageStore + Relay (no mocks) to verify:
 * - Message routing between agents
 * - Steer priority (steer messages first)
 * - Backlog counting
 * - Steer callback invocation
 *
 * Run: pnpm -F @wanman/runtime test e2e-relay-backlog
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { MessageStore } from '../message-store.js'
import { Relay } from '../relay.js'

describe('Relay + MessageStore E2E', () => {
  let db: Database.Database
  let store: MessageStore
  let relay: Relay

  beforeEach(() => {
    db = new Database(':memory:')
    store = new MessageStore(db)
    relay = new Relay(store)
  })

  describe('basic message routing', () => {
    it('should send and receive a message', () => {
      relay.send('ceo', 'dev', 'message', { text: '请开始编码' }, 'normal')

      const msgs = relay.recv('dev', 10)
      expect(msgs).toHaveLength(1)
      expect(msgs[0]!.from).toBe('ceo')
      expect(msgs[0]!.payload).toEqual({ text: '请开始编码' })
    })

    it('should not deliver the same message twice', () => {
      relay.send('ceo', 'dev', 'message', 'hello', 'normal')

      const first = relay.recv('dev', 10)
      expect(first).toHaveLength(1)

      const second = relay.recv('dev', 10)
      expect(second).toHaveLength(0)
    })

    it('should route messages to correct agent only', () => {
      relay.send('ceo', 'dev', 'message', 'for dev', 'normal')
      relay.send('ceo', 'finance', 'message', 'for finance', 'normal')

      const devMsgs = relay.recv('dev', 10)
      expect(devMsgs).toHaveLength(1)
      expect(devMsgs[0]!.payload).toBe('for dev')

      const financeMsgs = relay.recv('finance', 10)
      expect(financeMsgs).toHaveLength(1)
      expect(financeMsgs[0]!.payload).toBe('for finance')
    })

    it('should handle multiple messages in order', () => {
      relay.send('ceo', 'dev', 'message', 'first', 'normal')
      relay.send('ceo', 'dev', 'message', 'second', 'normal')
      relay.send('ceo', 'dev', 'message', 'third', 'normal')

      const msgs = relay.recv('dev', 10)
      expect(msgs).toHaveLength(3)
      expect(msgs.map(m => m.payload)).toEqual(['first', 'second', 'third'])
    })
  })

  describe('steer priority', () => {
    it('should deliver steer messages before normal messages', () => {
      relay.send('ceo', 'dev', 'message', 'normal 1', 'normal')
      relay.send('ceo', 'dev', 'message', 'normal 2', 'normal')
      relay.send('ceo', 'dev', 'message', 'URGENT', 'steer')
      relay.send('ceo', 'dev', 'message', 'normal 3', 'normal')

      const msgs = relay.recv('dev', 10)
      expect(msgs).toHaveLength(4)
      // Steer should come first
      expect(msgs[0]!.payload).toBe('URGENT')
      expect(msgs[0]!.priority).toBe('steer')
    })

    it('should detect steer messages via hasSteer()', () => {
      relay.send('ceo', 'dev', 'message', 'steer msg', 'steer')

      expect(relay.hasSteer('dev')).toBe(true)
      expect(relay.hasSteer('finance')).toBe(false)
    })
  })

  describe('backlog counting', () => {
    it('should count pending messages correctly', () => {
      expect(relay.countPending('dev')).toBe(0)

      relay.send('ceo', 'dev', 'message', 'msg 1', 'normal')
      relay.send('ceo', 'dev', 'message', 'msg 2', 'normal')
      relay.send('ceo', 'dev', 'message', 'msg 3', 'normal')

      expect(relay.countPending('dev')).toBe(3)

      // Receive 2 (limit)
      relay.recv('dev', 2)
      expect(relay.countPending('dev')).toBe(1)

      // Receive remaining
      relay.recv('dev', 10)
      expect(relay.countPending('dev')).toBe(0)
    })

    it('should count per-agent independently', () => {
      relay.send('ceo', 'dev', 'message', 'for dev', 'normal')
      relay.send('ceo', 'finance', 'message', 'for finance 1', 'normal')
      relay.send('ceo', 'finance', 'message', 'for finance 2', 'normal')

      expect(relay.countPending('dev')).toBe(1)
      expect(relay.countPending('finance')).toBe(2)
      expect(relay.countPending('marketing')).toBe(0)
    })
  })

  describe('steer callback', () => {
    it('should invoke steer callback when steer message arrives', () => {
      const steerCallbacks: string[] = []
      relay.setSteerCallback((agent) => { steerCallbacks.push(agent) })

      relay.send('ceo', 'dev', 'message', 'normal msg', 'normal')
      expect(steerCallbacks).toHaveLength(0)

      relay.send('ceo', 'dev', 'message', 'steer msg', 'steer')
      expect(steerCallbacks).toHaveLength(1)
      expect(steerCallbacks[0]).toBe('dev')
    })

    it('should not invoke steer callback for normal messages', () => {
      const steerCallbacks: string[] = []
      relay.setSteerCallback((agent) => { steerCallbacks.push(agent) })

      relay.send('ceo', 'dev', 'message', 'hello', 'normal')
      relay.send('finance', 'dev', 'message', 'data ready', 'normal')

      expect(steerCallbacks).toHaveLength(0)
    })
  })

  describe('backlog drain scenario', () => {
    it('should simulate realistic backlog drain pattern', () => {
      // Simulate: CEO sends task, dev receives, while processing more messages arrive
      relay.send('ceo', 'dev', 'message', 'Task: implement login', 'normal')

      // Dev receives and starts working
      const batch1 = relay.recv('dev', 10)
      expect(batch1).toHaveLength(1)

      // While dev is working, CEO sends more messages
      relay.send('ceo', 'dev', 'message', 'Also: add tests', 'normal')
      relay.send('finance', 'dev', 'message', 'Budget limit: ¥50k', 'normal')

      // After dev finishes, check backlog
      const backlog = relay.countPending('dev')
      expect(backlog).toBe(2)

      // Drain backlog
      const batch2 = relay.recv('dev', 10)
      expect(batch2).toHaveLength(2)
      expect(relay.countPending('dev')).toBe(0)
    })

    it('should handle empty backlog gracefully', () => {
      const msgs = relay.recv('dev', 10)
      expect(msgs).toHaveLength(0)
      expect(relay.countPending('dev')).toBe(0)
    })
  })

  describe('high-volume message handling', () => {
    it('should handle 100 messages correctly', () => {
      for (let i = 0; i < 100; i++) {
        relay.send('ceo', 'dev', 'message', `msg-${i}`, 'normal')
      }

      expect(relay.countPending('dev')).toBe(100)

      // Receive in batches
      const batch1 = relay.recv('dev', 50)
      expect(batch1).toHaveLength(50)
      expect(relay.countPending('dev')).toBe(50)

      const batch2 = relay.recv('dev', 50)
      expect(batch2).toHaveLength(50)
      expect(relay.countPending('dev')).toBe(0)
    })
  })
})

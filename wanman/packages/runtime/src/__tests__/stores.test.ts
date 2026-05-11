/**
 * Unit tests for MessageStore, ContextStore, and Relay.
 * Migrated from node:test to vitest.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { MessageStore } from '../message-store.js'
import { ContextStore } from '../context-store.js'
import { Relay } from '../relay.js'

describe('MessageStore', () => {
  let db: Database.Database
  let store: MessageStore

  beforeEach(() => {
    db = new Database(':memory:')
    store = new MessageStore(db)
  })

  it('should enqueue and retrieve messages', () => {
    store.enqueue('alice', 'bob', 'message', 'hello', 'normal')
    store.enqueue('charlie', 'bob', 'message', 'world', 'normal')

    const pending = store.getPending('bob')
    expect(pending).toHaveLength(2)
    expect(pending[0]!.from).toBe('alice')
    expect(pending[0]!.payload).toBe('hello')
    expect(pending[1]!.from).toBe('charlie')
  })

  it('should return steer messages before normal', () => {
    store.enqueue('alice', 'bob', 'message', 'low priority', 'normal')
    store.enqueue('charlie', 'bob', 'message', 'URGENT', 'steer')
    store.enqueue('dave', 'bob', 'message', 'also low', 'normal')

    const pending = store.getPending('bob')
    expect(pending).toHaveLength(3)
    expect(pending[0]!.payload).toBe('URGENT')
    expect(pending[0]!.priority).toBe('steer')
    expect(pending[1]!.payload).toBe('low priority')
    expect(pending[2]!.payload).toBe('also low')
  })

  it('should mark messages as delivered', () => {
    const id = store.enqueue('alice', 'bob', 'message', 'hello', 'normal')
    store.markDelivered(id)

    const pending = store.getPending('bob')
    expect(pending).toHaveLength(0)
  })

  it('should batch mark as delivered', () => {
    const id1 = store.enqueue('alice', 'bob', 'message', 'msg1', 'normal')
    const id2 = store.enqueue('charlie', 'bob', 'message', 'msg2', 'normal')
    store.markDeliveredBatch([id1, id2])

    expect(store.getPending('bob')).toHaveLength(0)
  })

  it('should detect steer messages', () => {
    expect(store.hasSteer('bob')).toBe(false)
    store.enqueue('alice', 'bob', 'message', 'urgent', 'steer')
    expect(store.hasSteer('bob')).toBe(true)
  })

  it('should respect limit', () => {
    for (let i = 0; i < 20; i++) {
      store.enqueue('alice', 'bob', 'message', `msg ${i}`, 'normal')
    }
    const pending = store.getPending('bob', 5)
    expect(pending).toHaveLength(5)
  })

  it('should only return messages for the target agent', () => {
    store.enqueue('alice', 'bob', 'message', 'for bob', 'normal')
    store.enqueue('alice', 'charlie', 'message', 'for charlie', 'normal')

    expect(store.getPending('bob')).toHaveLength(1)
    expect(store.getPending('charlie')).toHaveLength(1)
    expect(store.getPending('unknown')).toHaveLength(0)
  })

  it('should return UUID-formatted IDs', () => {
    const id = store.enqueue('alice', 'bob', 'message', 'hello', 'normal')
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('should set delivered to false for pending messages', () => {
    store.enqueue('alice', 'bob', 'message', 'hello', 'normal')
    const pending = store.getPending('bob')
    expect(pending[0]!.delivered).toBe(false)
  })

  describe('countPending', () => {
    it('should return 0 when no messages', () => {
      expect(store.countPending('bob')).toBe(0)
    })

    it('should count undelivered messages', () => {
      store.enqueue('alice', 'bob', 'message', 'msg1', 'normal')
      store.enqueue('alice', 'bob', 'message', 'msg2', 'normal')
      store.enqueue('alice', 'bob', 'message', 'msg3', 'steer')
      expect(store.countPending('bob')).toBe(3)
    })

    it('should not count delivered messages', () => {
      const id = store.enqueue('alice', 'bob', 'message', 'msg1', 'normal')
      store.enqueue('alice', 'bob', 'message', 'msg2', 'normal')
      store.markDelivered(id)
      expect(store.countPending('bob')).toBe(1)
    })

    it('should only count messages for the target agent', () => {
      store.enqueue('alice', 'bob', 'message', 'for bob', 'normal')
      store.enqueue('alice', 'charlie', 'message', 'for charlie', 'normal')
      expect(store.countPending('bob')).toBe(1)
      expect(store.countPending('charlie')).toBe(1)
      expect(store.countPending('unknown')).toBe(0)
    })

    it('should return 0 after all messages delivered via batch', () => {
      const id1 = store.enqueue('alice', 'bob', 'message', 'msg1', 'normal')
      const id2 = store.enqueue('alice', 'bob', 'message', 'msg2', 'normal')
      store.markDeliveredBatch([id1, id2])
      expect(store.countPending('bob')).toBe(0)
    })
  })
})

describe('ContextStore', () => {
  let db: Database.Database
  let store: ContextStore

  beforeEach(() => {
    db = new Database(':memory:')
    store = new ContextStore(db)
  })

  it('should get/set values', () => {
    store.set('mrr', '5000', 'finance')
    const entry = store.get('mrr')
    expect(entry).not.toBeNull()
    expect(entry!.value).toBe('5000')
    expect(entry!.updatedBy).toBe('finance')
  })

  it('should return null for missing keys', () => {
    expect(store.get('nonexistent')).toBeNull()
  })

  it('should overwrite existing keys', () => {
    store.set('mrr', '5000', 'finance')
    store.set('mrr', '6000', 'finance')
    expect(store.get('mrr')!.value).toBe('6000')
  })

  it('should list all entries', () => {
    store.set('a', '1', 'agent1')
    store.set('b', '2', 'agent2')
    const all = store.getAll()
    expect(all).toHaveLength(2)
  })

  it('should track updatedAt timestamp', () => {
    const before = Date.now()
    store.set('key', 'val', 'agent')
    const entry = store.get('key')
    expect(entry!.updatedAt).toBeGreaterThanOrEqual(before)
    expect(entry!.updatedAt).toBeLessThanOrEqual(Date.now())
  })

  it('should update updatedBy on overwrite', () => {
    store.set('key', 'v1', 'agent1')
    store.set('key', 'v2', 'agent2')
    expect(store.get('key')!.updatedBy).toBe('agent2')
  })
})

describe('Relay', () => {
  let db: Database.Database
  let messageStore: MessageStore
  let relay: Relay

  beforeEach(() => {
    db = new Database(':memory:')
    messageStore = new MessageStore(db)
    relay = new Relay(messageStore)
  })

  it('should send and receive messages', () => {
    relay.send('alice', 'bob', 'message', 'hello', 'normal')
    const messages = relay.recv('bob')
    expect(messages).toHaveLength(1)
    expect(messages[0]!.payload).toBe('hello')
  })

  it('should mark messages as delivered after recv', () => {
    relay.send('alice', 'bob', 'message', 'hello', 'normal')
    relay.recv('bob')
    // Second recv should return empty
    expect(relay.recv('bob')).toHaveLength(0)
  })

  it('should trigger steer callback on steer message', () => {
    let steeredAgent = ''
    relay.setSteerCallback((agent) => { steeredAgent = agent })

    relay.send('alice', 'bob', 'message', 'urgent!', 'steer')
    expect(steeredAgent).toBe('bob')
  })

  it('should not trigger steer callback on normal', () => {
    let called = false
    relay.setSteerCallback(() => { called = true })

    relay.send('alice', 'bob', 'message', 'hello', 'normal')
    expect(called).toBe(false)
  })

  it('should check for steer messages', () => {
    expect(relay.hasSteer('bob')).toBe(false)
    relay.send('alice', 'bob', 'message', 'urgent', 'steer')
    expect(relay.hasSteer('bob')).toBe(true)
  })

  it('should return message ID from send', () => {
    const id = relay.send('alice', 'bob', 'message', 'hello', 'normal')
    expect(id).toBeTruthy()
    expect(typeof id).toBe('string')
  })

  it('should respect recv limit', () => {
    for (let i = 0; i < 20; i++) {
      relay.send('alice', 'bob', 'message', `msg ${i}`, 'normal')
    }
    const messages = relay.recv('bob', 3)
    expect(messages).toHaveLength(3)
  })

  it('should not trigger steer callback when none is set', () => {
    // Should not throw
    expect(() => {
      relay.send('alice', 'bob', 'message', 'urgent', 'steer')
    }).not.toThrow()
  })

  describe('countPending', () => {
    it('should count pending messages without consuming them', () => {
      relay.send('alice', 'bob', 'message', 'msg1', 'normal')
      relay.send('alice', 'bob', 'message', 'msg2', 'normal')

      // countPending should not consume
      expect(relay.countPending('bob')).toBe(2)
      expect(relay.countPending('bob')).toBe(2) // still 2

      // recv consumes them
      relay.recv('bob')
      expect(relay.countPending('bob')).toBe(0)
    })

    it('should reflect new messages arriving after recv', () => {
      relay.send('alice', 'bob', 'message', 'msg1', 'normal')
      relay.recv('bob') // consume
      expect(relay.countPending('bob')).toBe(0)

      relay.send('alice', 'bob', 'message', 'msg2', 'normal')
      expect(relay.countPending('bob')).toBe(1)
    })
  })
})

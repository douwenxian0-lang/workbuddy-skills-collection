/**
 * Unit tests for the context command.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../transport.js', () => ({
  rpcCall: vi.fn(),
}))

import { contextCommand } from './context.js'
import { rpcCall } from '../transport.js'

const mockRpcCall = vi.mocked(rpcCall)

describe('contextCommand', () => {
  const originalEnv = process.env['WANMAN_AGENT_NAME']

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit') })
    delete process.env['WANMAN_AGENT_NAME']
  })

  afterEach(() => {
    if (originalEnv) process.env['WANMAN_AGENT_NAME'] = originalEnv
    else delete process.env['WANMAN_AGENT_NAME']
  })

  describe('get', () => {
    it('should get a context value', async () => {
      mockRpcCall.mockResolvedValue({
        jsonrpc: '2.0', id: 1,
        result: { key: 'mrr', value: '5000', updatedBy: 'finance', updatedAt: Date.now() },
      })

      await contextCommand(['get', 'mrr'])
      expect(mockRpcCall).toHaveBeenCalledWith('context.get', { key: 'mrr' })
      expect(console.log).toHaveBeenCalledWith('5000')
    })

    it('should handle missing key', async () => {
      mockRpcCall.mockResolvedValue({
        jsonrpc: '2.0', id: 1,
        result: null,
      })

      await contextCommand(['get', 'missing'])
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('not found'))
    })

    it('should exit on missing key arg', async () => {
      await expect(contextCommand(['get'])).rejects.toThrow('process.exit')
    })

    it('should exit on RPC error', async () => {
      mockRpcCall.mockResolvedValue({
        jsonrpc: '2.0', id: 1,
        error: { code: -32602, message: 'Missing key' },
      })

      await expect(contextCommand(['get', 'k'])).rejects.toThrow('process.exit')
    })
  })

  describe('set', () => {
    it('should set a context value', async () => {
      mockRpcCall.mockResolvedValue({
        jsonrpc: '2.0', id: 1,
        result: { status: 'ok' },
      })

      await contextCommand(['set', 'mrr', '6000'])
      expect(mockRpcCall).toHaveBeenCalledWith('context.set', {
        key: 'mrr', value: '6000', agent: 'cli',
      })
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('6000'))
    })

    it('should join multi-word values', async () => {
      mockRpcCall.mockResolvedValue({
        jsonrpc: '2.0', id: 1,
        result: { status: 'ok' },
      })

      await contextCommand(['set', 'status', 'all', 'good'])
      expect(mockRpcCall).toHaveBeenCalledWith('context.set', expect.objectContaining({
        value: 'all good',
      }))
    })

    it('should use WANMAN_AGENT_NAME as agent', async () => {
      process.env['WANMAN_AGENT_NAME'] = 'finance'
      mockRpcCall.mockResolvedValue({
        jsonrpc: '2.0', id: 1,
        result: { status: 'ok' },
      })

      await contextCommand(['set', 'mrr', '5000'])
      expect(mockRpcCall).toHaveBeenCalledWith('context.set', expect.objectContaining({
        agent: 'finance',
      }))
    })

    it('should exit on missing key/value', async () => {
      await expect(contextCommand(['set', 'key'])).rejects.toThrow('process.exit')
    })

    it('should exit on RPC error', async () => {
      mockRpcCall.mockResolvedValue({
        jsonrpc: '2.0', id: 1,
        error: { code: -32602, message: 'Missing params' },
      })

      await expect(contextCommand(['set', 'k', 'v'])).rejects.toThrow('process.exit')
    })
  })

  describe('unknown subcommand', () => {
    it('should exit on unknown subcommand', async () => {
      await expect(contextCommand(['unknown'])).rejects.toThrow('process.exit')
    })

    it('should exit on no subcommand', async () => {
      await expect(contextCommand([])).rejects.toThrow('process.exit')
    })
  })
})

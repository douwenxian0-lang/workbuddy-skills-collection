/**
 * Unit tests for the recv command.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../transport.js', () => ({
  rpcCall: vi.fn(),
}))

import { recvCommand } from './recv.js'
import { rpcCall } from '../transport.js'

const mockRpcCall = vi.mocked(rpcCall)

describe('recvCommand', () => {
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

  it('should receive messages using --agent flag', async () => {
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0', id: 1,
      result: {
        messages: [{
          id: '1', from: 'alice', to: 'echo', priority: 'normal',
          type: 'message', payload: 'hello', timestamp: Date.now(), delivered: false,
        }],
      },
    })

    await recvCommand(['--agent', 'echo'])

    expect(mockRpcCall).toHaveBeenCalledWith('agent.recv', { agent: 'echo', limit: 10 })
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('alice'))
  })

  it('should use WANMAN_AGENT_NAME env var', async () => {
    process.env['WANMAN_AGENT_NAME'] = 'my-agent'
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0', id: 1,
      result: { messages: [] },
    })

    await recvCommand([])

    expect(mockRpcCall).toHaveBeenCalledWith('agent.recv', { agent: 'my-agent', limit: 10 })
  })

  it('should print no messages when empty', async () => {
    process.env['WANMAN_AGENT_NAME'] = 'echo'
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0', id: 1,
      result: { messages: [] },
    })

    await recvCommand([])

    expect(console.log).toHaveBeenCalledWith('No pending messages.')
  })

  it('should exit on missing agent', async () => {
    await expect(recvCommand([])).rejects.toThrow('process.exit')
  })

  it('should exit on RPC error', async () => {
    process.env['WANMAN_AGENT_NAME'] = 'echo'
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0', id: 1,
      error: { code: -32603, message: 'Internal error' },
    })

    await expect(recvCommand([])).rejects.toThrow('process.exit')
  })

  it('should show steer tag for steer messages', async () => {
    process.env['WANMAN_AGENT_NAME'] = 'echo'
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0', id: 1,
      result: {
        messages: [{
          id: '1', from: 'ceo', to: 'echo', priority: 'steer',
          type: 'message', payload: 'urgent', timestamp: Date.now(), delivered: false,
        }],
      },
    })

    await recvCommand([])
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[STEER]'))
  })
})

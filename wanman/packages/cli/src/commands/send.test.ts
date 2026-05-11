/**
 * Unit tests for the send command.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock transport
vi.mock('../transport.js', () => ({
  rpcCall: vi.fn(),
}))

import { sendCommand } from './send.js'
import { rpcCall } from '../transport.js'

const mockRpcCall = vi.mocked(rpcCall)

describe('sendCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit') })
  })

  it('should send a normal message', async () => {
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0', id: 1,
      result: { id: 'msg-1', status: 'queued' },
    })

    await sendCommand(['echo', 'hello', 'world'])

    expect(mockRpcCall).toHaveBeenCalledWith('agent.send', {
      from: 'cli',
      to: 'echo',
      type: 'message',
      payload: 'hello world',
      priority: 'normal',
    })
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('msg-1'))
  })

  it('should send a steer message with --steer flag', async () => {
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0', id: 1,
      result: { id: 'msg-2', status: 'queued' },
    })

    await sendCommand(['echo', '--steer', 'urgent'])

    expect(mockRpcCall).toHaveBeenCalledWith('agent.send', expect.objectContaining({
      priority: 'steer',
      type: 'message',
      payload: 'urgent',
    }))
  })

  it('should send an explicit decision message type', async () => {
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0', id: 1,
      result: { id: 'msg-2a', status: 'queued' },
    })

    await sendCommand(['human', '--type', 'decision', 'Need', 'approval'])

    expect(mockRpcCall).toHaveBeenCalledWith('agent.send', expect.objectContaining({
      to: 'human',
      type: 'decision',
      payload: 'Need approval',
      priority: 'normal',
    }))
  })

  it('should reject an invalid explicit message type', async () => {
    await expect(sendCommand(['echo', '--type', 'note', 'hello'])).rejects.toThrow('process.exit')
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('--type must be one of'))
  })

  it('should use WANMAN_AGENT_NAME as from', async () => {
    process.env['WANMAN_AGENT_NAME'] = 'dev-agent'
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0', id: 1,
      result: { id: 'msg-3', status: 'queued' },
    })

    await sendCommand(['echo', 'hi'])

    expect(mockRpcCall).toHaveBeenCalledWith('agent.send', expect.objectContaining({
      from: 'dev-agent',
    }))
    delete process.env['WANMAN_AGENT_NAME']
  })

  it('should exit on missing args', async () => {
    await expect(sendCommand([])).rejects.toThrow('process.exit')
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Usage'))
  })

  it('should exit on RPC error', async () => {
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0', id: 1,
      error: { code: -32000, message: 'Agent not found' },
    })

    await expect(sendCommand(['unknown', 'hi'])).rejects.toThrow('process.exit')
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Agent not found'))
  })
})

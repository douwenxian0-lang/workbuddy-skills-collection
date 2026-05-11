/**
 * Unit tests for the escalate command.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../transport.js', () => ({
  rpcCall: vi.fn(),
}))

import { escalateCommand } from './escalate.js'
import { rpcCall } from '../transport.js'

const mockRpcCall = vi.mocked(rpcCall)

describe('escalateCommand', () => {
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

  it('should send steer message to ceo', async () => {
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0', id: 1,
      result: { id: 'msg-1', status: 'queued' },
    })

    await escalateCommand(['need', 'help'])

    expect(mockRpcCall).toHaveBeenCalledWith('agent.send', {
      from: 'cli',
      to: 'ceo',
      type: 'message',
      payload: 'need help',
      priority: 'steer',
    })
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Escalated'))
  })

  it('should use WANMAN_AGENT_NAME as from', async () => {
    process.env['WANMAN_AGENT_NAME'] = 'dev-agent'
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0', id: 1,
      result: { id: 'msg-2', status: 'queued' },
    })

    await escalateCommand(['urgent'])

    expect(mockRpcCall).toHaveBeenCalledWith('agent.send', expect.objectContaining({
      from: 'dev-agent',
    }))
  })

  it('should exit on empty message', async () => {
    await expect(escalateCommand([])).rejects.toThrow('process.exit')
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Usage'))
  })

  it('should show friendly error when ceo not found', async () => {
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0', id: 1,
      error: { code: -32000, message: 'Agent "ceo" not found' },
    })

    await expect(escalateCommand(['help'])).rejects.toThrow('process.exit')
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('No CEO agent found'))
  })

  it('should show generic error for other errors', async () => {
    mockRpcCall.mockResolvedValue({
      jsonrpc: '2.0', id: 1,
      error: { code: -32603, message: 'Internal error' },
    })

    await expect(escalateCommand(['help'])).rejects.toThrow('process.exit')
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Internal error'))
  })
})

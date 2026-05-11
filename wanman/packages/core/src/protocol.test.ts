import { describe, it, expect } from 'vitest'
import {
  RPC_ERRORS,
  RPC_METHODS,
  createRpcRequest,
  createRpcResponse,
  createRpcError,
} from './protocol.js'

describe('RPC_ERRORS', () => {
  it('should have standard JSON-RPC error codes', () => {
    expect(RPC_ERRORS.PARSE_ERROR).toBe(-32700)
    expect(RPC_ERRORS.INVALID_REQUEST).toBe(-32600)
    expect(RPC_ERRORS.METHOD_NOT_FOUND).toBe(-32601)
    expect(RPC_ERRORS.INVALID_PARAMS).toBe(-32602)
    expect(RPC_ERRORS.INTERNAL_ERROR).toBe(-32603)
  })

  it('should have custom error codes', () => {
    expect(RPC_ERRORS.AGENT_NOT_FOUND).toBe(-32000)
    expect(RPC_ERRORS.AGENT_NOT_RUNNING).toBe(-32001)
  })
})

describe('RPC_METHODS', () => {
  it('should define all expected methods', () => {
    expect(RPC_METHODS.AGENT_SEND).toBe('agent.send')
    expect(RPC_METHODS.AGENT_RECV).toBe('agent.recv')
    expect(RPC_METHODS.AGENT_LIST).toBe('agent.list')
    expect(RPC_METHODS.CONTEXT_GET).toBe('context.get')
    expect(RPC_METHODS.CONTEXT_SET).toBe('context.set')
    expect(RPC_METHODS.EVENT_PUSH).toBe('event.push')
    expect(RPC_METHODS.HEALTH_CHECK).toBe('health.check')
  })
})

describe('createRpcRequest', () => {
  it('should create a valid JSON-RPC 2.0 request', () => {
    const req = createRpcRequest('agent.send', { to: 'bob', content: 'hi' })
    expect(req.jsonrpc).toBe('2.0')
    expect(typeof req.id).toBe('number')
    expect(req.method).toBe('agent.send')
    expect(req.params).toEqual({ to: 'bob', content: 'hi' })
  })

  it('should auto-increment IDs', () => {
    const req1 = createRpcRequest('test.a')
    const req2 = createRpcRequest('test.b')
    expect(req2.id).toBeGreaterThan(req1.id as number)
  })

  it('should work without params', () => {
    const req = createRpcRequest('health.check')
    expect(req.params).toBeUndefined()
    expect(req.method).toBe('health.check')
  })
})

describe('createRpcResponse', () => {
  it('should create a success response', () => {
    const res = createRpcResponse(1, { status: 'ok' })
    expect(res).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: { status: 'ok' },
    })
  })

  it('should handle string IDs', () => {
    const res = createRpcResponse('abc', 42)
    expect(res.id).toBe('abc')
    expect(res.result).toBe(42)
  })

  it('should handle null result', () => {
    const res = createRpcResponse(1, null)
    expect(res.result).toBeNull()
  })
})

describe('createRpcError', () => {
  it('should create an error response', () => {
    const res = createRpcError(1, RPC_ERRORS.METHOD_NOT_FOUND, 'Unknown method')
    expect(res).toEqual({
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: -32601,
        message: 'Unknown method',
      },
    })
  })

  it('should include optional data', () => {
    const res = createRpcError(2, RPC_ERRORS.INTERNAL_ERROR, 'fail', { detail: 'boom' })
    expect(res.error?.data).toEqual({ detail: 'boom' })
  })

  it('should not include result field', () => {
    const res = createRpcError(1, -32600, 'bad')
    expect(res.result).toBeUndefined()
  })
})

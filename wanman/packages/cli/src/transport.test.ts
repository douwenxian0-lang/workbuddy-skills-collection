/**
 * Unit tests for CLI transport — rpcCall and healthCheck.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Save original fetch
const originalFetch = globalThis.fetch

describe('transport', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    globalThis.fetch = mockFetch as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.resetModules()
  })

  describe('rpcCall', () => {
    it('should send a JSON-RPC POST request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ jsonrpc: '2.0', id: 1, result: { status: 'ok' } }),
      })

      const { rpcCall } = await import('./transport.js')
      const res = await rpcCall('agent.send', { to: 'echo', content: 'hi' })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, opts] = mockFetch.mock.calls[0]! as [string, RequestInit]
      expect(url).toContain('/rpc')
      expect(opts.method).toBe('POST')
      expect(res.result).toEqual({ status: 'ok' })
    })

    it('should throw on non-ok HTTP response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      })

      const { rpcCall } = await import('./transport.js')
      await expect(rpcCall('test')).rejects.toThrow('HTTP 500')
    })

    it('should send correct JSON-RPC structure', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ jsonrpc: '2.0', id: 1, result: null }),
      })

      const { rpcCall } = await import('./transport.js')
      await rpcCall('agent.list')

      const body = JSON.parse((mockFetch.mock.calls[0]![1] as RequestInit).body as string)
      expect(body.jsonrpc).toBe('2.0')
      expect(body.method).toBe('agent.list')
      expect(typeof body.id).toBe('number')
    })
  })

  describe('healthCheck', () => {
    it('should GET /health endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok', agents: [] }),
      })

      const { healthCheck } = await import('./transport.js')
      const result = await healthCheck()

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const url = mockFetch.mock.calls[0]![0] as string
      expect(url).toContain('/health')
      expect(result).toEqual({ status: 'ok', agents: [] })
    })

    it('should throw on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable',
      })

      const { healthCheck } = await import('./transport.js')
      await expect(healthCheck()).rejects.toThrow('HTTP 503')
    })
  })
})

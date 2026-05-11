/**
 * Unit tests for the structured JSON logger.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLogger } from '../logger.js'

describe('createLogger', () => {
  const originalStdout = process.stdout.write
  const originalStderr = process.stderr.write
  let stdoutCalls: string[]
  let stderrCalls: string[]

  beforeEach(() => {
    stdoutCalls = []
    stderrCalls = []
    process.stdout.write = vi.fn((chunk: string | Uint8Array) => {
      stdoutCalls.push(chunk.toString())
      return true
    }) as typeof process.stdout.write
    process.stderr.write = vi.fn((chunk: string | Uint8Array) => {
      stderrCalls.push(chunk.toString())
      return true
    }) as typeof process.stderr.write
  })

  afterEach(() => {
    process.stdout.write = originalStdout
    process.stderr.write = originalStderr
  })

  it('should write info messages to stdout as JSON', () => {
    const log = createLogger('test-scope')
    log.info('hello world')

    expect(stdoutCalls).toHaveLength(1)
    const parsed = JSON.parse(stdoutCalls[0]!)
    expect(parsed.level).toBe('info')
    expect(parsed.scope).toBe('test-scope')
    expect(parsed.msg).toBe('hello world')
    expect(parsed.ts).toBeTruthy()
  })

  it('should write error messages to stderr', () => {
    const log = createLogger('test')
    log.error('something broke', { code: 500 })

    expect(stderrCalls).toHaveLength(1)
    const parsed = JSON.parse(stderrCalls[0]!)
    expect(parsed.level).toBe('error')
    expect(parsed.code).toBe(500)
  })

  it('should write warn messages to stderr', () => {
    const log = createLogger('test')
    log.warn('watch out')

    expect(stderrCalls).toHaveLength(1)
    const parsed = JSON.parse(stderrCalls[0]!)
    expect(parsed.level).toBe('warn')
  })

  it('should include extra data in the log entry', () => {
    const log = createLogger('test')
    log.info('with data', { agent: 'echo', count: 5 })

    const parsed = JSON.parse(stdoutCalls[0]!)
    expect(parsed.agent).toBe('echo')
    expect(parsed.count).toBe(5)
  })

  it('should include scope in every message', () => {
    const log = createLogger('my-module')
    log.info('a')
    log.warn('b')

    expect(JSON.parse(stdoutCalls[0]!).scope).toBe('my-module')
    expect(JSON.parse(stderrCalls[0]!).scope).toBe('my-module')
  })

  it('should suppress debug messages at default info log level', () => {
    const log = createLogger('test')
    log.debug('this should be suppressed')

    // Default WANMAN_LOG_LEVEL is 'info', so debug should not appear
    expect(stdoutCalls).toHaveLength(0)
    expect(stderrCalls).toHaveLength(0)
  })
})

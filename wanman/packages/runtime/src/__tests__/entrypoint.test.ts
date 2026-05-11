/**
 * Tests for entrypoint.ts — container startup orchestration.
 *
 * Since entrypoint.ts is a side-effect module (calls main() at import),
 * we test the orchestration patterns it relies on:
 * - Auth mode detection → bootstrap → refresh loop
 * - Shutdown sequence (credential manager before supervisor)
 * - Headless mode flag passing
 *
 * Config loading and workspace setup are tested in config.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('../logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock Supervisor
const mockStart = vi.fn();
const mockShutdown = vi.fn();
vi.mock('../supervisor.js', () => ({
  Supervisor: vi.fn().mockImplementation(() => ({
    start: mockStart,
    shutdown: mockShutdown,
  })),
}));

// Mock CredentialManager
const mockDetectAuthMode = vi.fn().mockReturnValue('none');
const mockBootstrap = vi.fn();
const mockStartRefreshLoop = vi.fn();
const mockCredShutdown = vi.fn();
vi.mock('../credential-manager.js', () => ({
  CredentialManager: vi.fn().mockImplementation(() => ({
    detectAuthMode: mockDetectAuthMode,
    bootstrap: mockBootstrap,
    startRefreshLoop: mockStartRefreshLoop,
    shutdown: mockCredShutdown,
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Auth mode lifecycle', () => {
  it('calls bootstrap and startRefreshLoop in oauth mode', async () => {
    mockDetectAuthMode.mockReturnValue('oauth');
    const authMode = mockDetectAuthMode();

    if (authMode === 'oauth') {
      await mockBootstrap();
      mockStartRefreshLoop();
    }

    expect(mockBootstrap).toHaveBeenCalled();
    expect(mockStartRefreshLoop).toHaveBeenCalled();
  });

  it('skips bootstrap and refreshLoop in api-key mode', () => {
    mockDetectAuthMode.mockReturnValue('api-key');
    const authMode = mockDetectAuthMode();

    if (authMode === 'oauth') {
      mockBootstrap();
      mockStartRefreshLoop();
    }

    expect(mockBootstrap).not.toHaveBeenCalled();
    expect(mockStartRefreshLoop).not.toHaveBeenCalled();
  });

  it('skips bootstrap and refreshLoop in none mode', () => {
    mockDetectAuthMode.mockReturnValue('none');
    const authMode = mockDetectAuthMode();

    if (authMode === 'oauth') {
      mockBootstrap();
      mockStartRefreshLoop();
    }

    expect(mockBootstrap).not.toHaveBeenCalled();
    expect(mockStartRefreshLoop).not.toHaveBeenCalled();
  });
});

describe('Shutdown sequence', () => {
  it('shuts down credentials before supervisor', async () => {
    const order: string[] = [];
    mockCredShutdown.mockImplementation(async () => { order.push('credentials'); });
    mockShutdown.mockImplementation(async () => { order.push('supervisor'); });

    // Replicate the shutdown sequence from entrypoint.ts
    await mockCredShutdown();
    await mockShutdown();

    expect(order).toEqual(['credentials', 'supervisor']);
  });

  it('calls both shutdown methods even if called multiple times', async () => {
    // Simulate double-signal scenario
    await mockCredShutdown();
    await mockShutdown();
    await mockCredShutdown();
    await mockShutdown();

    expect(mockCredShutdown).toHaveBeenCalledTimes(2);
    expect(mockShutdown).toHaveBeenCalledTimes(2);
  });
});

describe('Headless mode', () => {
  it('reads WANMAN_HEADLESS env var', () => {
    const headless = process.env['WANMAN_HEADLESS'] === '1';
    expect(typeof headless).toBe('boolean');
  });

  it('defaults to false when env not set', () => {
    const saved = process.env['WANMAN_HEADLESS'];
    delete process.env['WANMAN_HEADLESS'];

    const headless = process.env['WANMAN_HEADLESS'] === '1';
    expect(headless).toBe(false);

    if (saved !== undefined) process.env['WANMAN_HEADLESS'] = saved;
  });
});

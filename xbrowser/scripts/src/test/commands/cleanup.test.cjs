const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// We need to mock browser-lifecycle before requiring cleanup
const browserLifecycle = require('../../src/lib/browser-lifecycle.cjs');

describe('cleanupCommand()', () => {
  let origCloseAllSessions;

  beforeEach(() => {
    origCloseAllSessions = browserLifecycle.closeAllSessions;

    // Default mock: all sessions close successfully
    browserLifecycle.closeAllSessions = () => [
      { success: true, browserId: 'cft', session: 'xbrowser-cft' },
      { success: true, browserId: 'chrome', session: 'xbrowser-chrome' },
      { success: true, browserId: 'edge', session: 'xbrowser-edge' },
      { success: true, browserId: 'qqbrowser', session: 'xbrowser-qqbrowser' },
    ];
  });

  afterEach(() => {
    browserLifecycle.closeAllSessions = origCloseAllSessions;
  });

  function getCleanupCommand() {
    return require('../../src/commands/cleanup.cjs').cleanupCommand;
  }

  it('returns ok with command="cleanup"', () => {
    const cleanupCommand = getCleanupCommand();
    const r = cleanupCommand([]);
    assert.equal(r.ok, true);
    assert.equal(r.command, 'cleanup');
  });

  it('result has sessions_closed field', () => {
    const cleanupCommand = getCleanupCommand();
    const r = cleanupCommand([]);
    assert.equal(typeof r.data.sessions_closed, 'number');
  });

  it('counts sessions closed correctly', () => {
    const cleanupCommand = getCleanupCommand();
    const r = cleanupCommand([]);
    assert.equal(r.data.sessions_closed, 4);
  });

  it('adds warnings for failed sessions', () => {
    browserLifecycle.closeAllSessions = () => [
      { success: true, browserId: 'cft', session: 'xbrowser-cft' },
      { success: false, browserId: 'chrome', session: 'xbrowser-chrome', error: 'connection refused' },
    ];
    const cleanupCommand = getCleanupCommand();
    const r = cleanupCommand([]);
    assert.equal(r.data.sessions_closed, 1);
    assert.ok(r.warnings);
    assert.equal(r.warnings.length, 1);
    assert.ok(r.warnings[0].includes('chrome'));
    assert.ok(r.warnings[0].includes('connection refused'));
  });

  it('with --force, includes deprecation warning', () => {
    const cleanupCommand = getCleanupCommand();
    const r = cleanupCommand(['--force']);
    assert.ok(r.warnings);
    assert.ok(r.warnings.some(w => w.includes('--force') && w.includes('废弃')));
  });
});

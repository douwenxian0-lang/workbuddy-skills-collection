const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { findAvailablePort, isPortFree } = require('../../src/lib/find-port.cjs');
const { closeBrowser } = require('../../src/lib/close-browser.cjs');
const {
  ensureConnection,
  closeSession,
  closeAllSessions,
  identifyBrowser,
  probeCdpPort,
} = require('../../src/lib/browser-lifecycle.cjs');

// ---------------------------------------------------------------------------
// find-port.cjs
// ---------------------------------------------------------------------------
describe('find-port', () => {
  describe('isPortFree()', () => {
    it('returns boolean', async () => {
      const result = await isPortFree(19999);
      assert.equal(typeof result, 'boolean');
    });
  });

  describe('findAvailablePort()', () => {
    it('returns { available, port } structure', async () => {
      const result = await findAvailablePort();
      assert.equal(typeof result.available, 'boolean');
      if (result.available) {
        assert.equal(typeof result.port, 'number');
      } else {
        assert.equal(result.port, null);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// close-browser.cjs
// ---------------------------------------------------------------------------
describe('close-browser', () => {
  describe('closeBrowser()', () => {
    it('returns error for unknown browser', () => {
      const result = closeBrowser('firefox');
      assert.equal(result.browser, 'firefox');
      // On macOS/Linux/Windows, unknown browser returns success: false
      assert.equal(typeof result.success, 'boolean');
      if (!result.success) {
        assert.equal(typeof result.error, 'string');
      }
    });

    it('returns method field indicating how browser was closed', () => {
      // Use phantom browser ID to avoid killing user's real Chrome.
      // Phantom IDs route through name-kill path but pkill finds nothing → no side effect.
      const result = closeBrowser('__test_phantom_browser__');
      assert.equal(typeof result.method, 'string');
      assert.ok(['pid', 'pid_stale', 'name', 'skip', 'none'].includes(result.method),
        `unexpected method: ${result.method}`);
    });

    it('returns method=skip for cft', () => {
      const result = closeBrowser('cft');
      assert.equal(result.success, true);
      assert.equal(result.browser, 'cft');
      assert.equal(result.method, 'skip');
    });

    it('handles stale PID file gracefully', () => {
      // Use phantom browser ID so the fallback name-kill doesn't touch real Chrome.
      const { savePid, removePid } = require('../../src/lib/paths.cjs');
      savePid('__test_phantom_browser__', 1); // PID 1 is init/launchd, not a browser
      const result = closeBrowser('__test_phantom_browser__');
      assert.equal(typeof result.success, 'boolean');
      assert.equal(result.browser, '__test_phantom_browser__');
      // Should have fallen through to name-based kill since PID 1 is not the phantom browser
      removePid('__test_phantom_browser__');
    });
  });
});

// ---------------------------------------------------------------------------
// browser-lifecycle.cjs
// ---------------------------------------------------------------------------
describe('browser-lifecycle', () => {
  describe('identifyBrowser()', () => {
    it('identifies chrome from user-agent', () => {
      assert.equal(identifyBrowser('Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36'), 'chrome');
    });

    it('identifies edge from user-agent', () => {
      assert.equal(identifyBrowser('Mozilla/5.0 Chrome/120.0.0.0 Edg/120.0.0.0'), 'edge');
    });

    it('identifies qqbrowser from user-agent', () => {
      assert.equal(identifyBrowser('Mozilla/5.0 Chrome/120.0.0.0 QQBrowser/12.0'), 'qqbrowser');
    });

    it('returns null for empty string', () => {
      assert.equal(identifyBrowser(''), null);
    });

    it('returns null for null', () => {
      assert.equal(identifyBrowser(null), null);
    });
  });

  describe('ensureConnection()', () => {
    it('returns profile connection for cft immediately', async () => {
      const result = await ensureConnection('cft', {});
      assert.equal(result.ready, true);
      assert.equal(result.browserId, 'cft');
      assert.equal(result.connectionType, 'profile');
      assert.equal(result.cdpPort, null);
      assert.equal(result.sessionName, 'xbrowser-cft');
    });

    it('returns correct shape for unknown local browser', async () => {
      // Use phantom browser ID to avoid spawning a real headless Chrome.
      // Unknown browsers hit the `installed: false` early-return path.
      const result = await ensureConnection('__test_phantom_browser__', {});
      assert.equal(result.browserId, '__test_phantom_browser__');
      assert.equal(result.sessionName, 'xbrowser-__test_phantom_browser__');
      assert.equal(result.ready, false);
      assert.equal(result.connectionType, 'cdp');
      assert.equal(result.cdpPort, null);
      assert.ok(typeof result.error === 'string' && result.error.length > 0);
    });
  });

  describe('closeSession()', () => {
    it('returns correct structure', () => {
      const result = closeSession('cft');
      assert.equal(result.browserId, 'cft');
      assert.equal(result.session, 'xbrowser-cft');
      assert.equal(typeof result.success, 'boolean');
      // In test env, agent-browser likely not installed, so success: false
      if (!result.success) {
        assert.equal(typeof result.error, 'string');
      }
    });

    it('returns correct session name for each browser', () => {
      const result = closeSession('chrome');
      assert.equal(result.session, 'xbrowser-chrome');
      assert.equal(result.browserId, 'chrome');
    });
  });

  describe('closeAllSessions()', () => {
    it('returns array of results for all browser IDs', () => {
      const results = closeAllSessions();
      assert.ok(Array.isArray(results));
      assert.equal(results.length, 4); // cft, chrome, edge, qqbrowser
      for (const r of results) {
        assert.equal(typeof r.success, 'boolean');
        assert.equal(typeof r.browserId, 'string');
        assert.equal(typeof r.session, 'string');
      }
    });

    it('includes all browser IDs', () => {
      const results = closeAllSessions();
      const ids = results.map((r) => r.browserId);
      assert.ok(ids.includes('cft'));
      assert.ok(ids.includes('chrome'));
      assert.ok(ids.includes('edge'));
      assert.ok(ids.includes('qqbrowser'));
    });
  });

  describe('probeCdpPort()', () => {
    it('returns null for non-listening port', async () => {
      const result = await probeCdpPort(19999);
      assert.equal(result, null);
    });
  });

  describe('scanCdpPorts()', () => {
    it('returns null when no ports respond', async () => {
      const { scanCdpPorts } = require('../../src/lib/browser-lifecycle.cjs');
      const result = await scanCdpPorts('chrome', [59990, 59991, 59992]);
      assert.equal(result, null);
    });
  });

  describe('waitForCdp() with isExited', () => {
    it('returns false immediately when isExited() returns true', async () => {
      const { waitForCdp } = require('../../src/lib/browser-lifecycle.cjs');
      const start = Date.now();
      const result = await waitForCdp(59999, { timeoutSec: 5, isExited: () => true });
      const elapsed = Date.now() - start;
      assert.equal(result, false);
      assert.ok(elapsed < 2000, 'Should return quickly, not wait full timeout');
    });
  });

  describe('launchBrowserWithCdp()', () => {
    it('returns launched: false for a non-existent browser', () => {
      const { launchBrowserWithCdp } = require('../../src/lib/browser-lifecycle.cjs');
      const r = launchBrowserWithCdp('nonexistent_browser', 9222, {});
      assert.equal(r.launched, false);
      assert.ok(r.error);
    });
  });
});

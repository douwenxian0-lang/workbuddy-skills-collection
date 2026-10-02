// test/lib/paths.test.cjs
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  CLI_VERSION, VERSION_PATH, XBROWSER_DIR, PIDS_DIR,
  pidFile, savePid, readPid, removePid, compareVersions,
  BROWSER_IDS, LOCAL_BROWSER_IDS,
} = require('../../src/lib/paths.cjs');

describe('CLI_VERSION', () => {
  it('is "1.2.0"', () => {
    assert.equal(CLI_VERSION, '1.2.0');
  });
});

describe('VERSION_PATH', () => {
  it('is .version inside XBROWSER_DIR', () => {
    assert.ok(VERSION_PATH.endsWith('.version'));
    assert.ok(VERSION_PATH.startsWith(XBROWSER_DIR));
  });
});

describe('PIDS_DIR', () => {
  it('is pids inside XBROWSER_DIR', () => {
    assert.ok(PIDS_DIR.endsWith('pids'));
    assert.ok(PIDS_DIR.startsWith(XBROWSER_DIR));
  });
});

describe('pidFile()', () => {
  it('returns path ending with <browserId>.pid', () => {
    const p = pidFile('chrome');
    assert.ok(p.endsWith('chrome.pid'));
    assert.ok(p.startsWith(PIDS_DIR));
  });

  it('returns different paths for different browsers', () => {
    assert.notEqual(pidFile('chrome'), pidFile('edge'));
  });
});

describe('savePid / readPid / removePid', () => {
  const testBrowser = '__test_browser__';

  // Clean up after each test
  it('round-trip: savePid → readPid → removePid', () => {
    savePid(testBrowser, 12345);
    assert.equal(readPid(testBrowser), 12345);
    removePid(testBrowser);
    assert.equal(readPid(testBrowser), null);
  });

  it('readPid returns null for non-existent file', () => {
    assert.equal(readPid('__nonexistent_browser__'), null);
  });

  it('readPid returns null for corrupt content', () => {
    // Write non-numeric content directly
    const p = pidFile(testBrowser);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, 'not-a-number', 'utf8');
    assert.equal(readPid(testBrowser), null);
    removePid(testBrowser);
  });

  it('readPid returns null for empty file', () => {
    const p = pidFile(testBrowser);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, '', 'utf8');
    assert.equal(readPid(testBrowser), null);
    removePid(testBrowser);
  });

  it('readPid returns null for negative number', () => {
    const p = pidFile(testBrowser);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, '-1', 'utf8');
    assert.equal(readPid(testBrowser), null);
    removePid(testBrowser);
  });

  it('readPid returns null for zero', () => {
    const p = pidFile(testBrowser);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, '0', 'utf8');
    assert.equal(readPid(testBrowser), null);
    removePid(testBrowser);
  });

  it('savePid overwrites existing PID', () => {
    savePid(testBrowser, 111);
    assert.equal(readPid(testBrowser), 111);
    savePid(testBrowser, 222);
    assert.equal(readPid(testBrowser), 222);
    removePid(testBrowser);
  });

  it('removePid is idempotent (no error on double remove)', () => {
    savePid(testBrowser, 999);
    removePid(testBrowser);
    removePid(testBrowser); // should not throw
    assert.equal(readPid(testBrowser), null);
  });
});

describe('compareVersions()', () => {
  it('returns 0 for equal versions', () => {
    assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  });

  it('returns -1 when a < b', () => {
    assert.equal(compareVersions('0.9.0', '1.0.0'), -1);
  });

  it('returns 1 when a > b', () => {
    assert.equal(compareVersions('1.1.0', '1.0.0'), 1);
  });

  it('pads missing segments with 0', () => {
    assert.equal(compareVersions('1.0', '1.0.0'), 0);
  });

  it('compares patch versions', () => {
    assert.equal(compareVersions('1.0.1', '1.0.0'), 1);
    assert.equal(compareVersions('1.0.0', '1.0.2'), -1);
  });

  it('compares minor versions', () => {
    assert.equal(compareVersions('1.2.0', '1.1.0'), 1);
  });
});

describe('AGENT_BROWSER_BIN', () => {
  it('points to native binary under node_modules/agent-browser/bin/', () => {
    const { AGENT_BROWSER_BIN } = require('../../src/lib/paths.cjs');
    assert.ok(AGENT_BROWSER_BIN.includes(path.join('node_modules', 'agent-browser', 'bin')),
      `Expected native binary path, got: ${AGENT_BROWSER_BIN}`);
    assert.ok(!AGENT_BROWSER_BIN.includes('.bin'),
      'Should not point to .bin/ shim');
  });
});

describe('AGENT_BROWSER_IS_NATIVE', () => {
  it('is exported as a boolean', () => {
    const { AGENT_BROWSER_IS_NATIVE } = require('../../src/lib/paths.cjs');
    assert.equal(typeof AGENT_BROWSER_IS_NATIVE, 'boolean');
  });

  it('is true on supported platforms (darwin/linux/win32 with x64/arm64)', () => {
    const { AGENT_BROWSER_IS_NATIVE } = require('../../src/lib/paths.cjs');
    const p = os.platform();
    const a = os.arch();
    if (['darwin', 'linux', 'win32'].includes(p) && ['x64', 'arm64'].includes(a)) {
      assert.equal(AGENT_BROWSER_IS_NATIVE, true);
    }
  });
});

describe('getNativeBinaryName()', () => {
  it('produces correct binary name for current platform', () => {
    const { AGENT_BROWSER_BIN } = require('../../src/lib/paths.cjs');
    const basename = path.basename(AGENT_BROWSER_BIN);
    const p = os.platform();
    const a = os.arch();
    if (p === 'darwin' && a === 'arm64') {
      assert.equal(basename, 'agent-browser-darwin-arm64');
    } else if (p === 'darwin' && a === 'x64') {
      assert.equal(basename, 'agent-browser-darwin-x64');
    } else if (p === 'win32') {
      assert.equal(basename, 'agent-browser-win32-x64.exe');
    } else if (p === 'linux' && a === 'x64') {
      assert.ok(basename === 'agent-browser-linux-x64' || basename === 'agent-browser-linux-musl-x64');
    }
  });
});

describe('LOCAL_BROWSER_IDS', () => {
  it('contains chrome, edge, qqbrowser but not cft', () => {
    assert.ok(LOCAL_BROWSER_IDS.includes('chrome'));
    assert.ok(LOCAL_BROWSER_IDS.includes('edge'));
    assert.ok(LOCAL_BROWSER_IDS.includes('qqbrowser'));
    assert.ok(!LOCAL_BROWSER_IDS.includes('cft'));
  });

  it('has exactly one fewer entry than BROWSER_IDS', () => {
    assert.equal(LOCAL_BROWSER_IDS.length, BROWSER_IDS.length - 1);
  });
});

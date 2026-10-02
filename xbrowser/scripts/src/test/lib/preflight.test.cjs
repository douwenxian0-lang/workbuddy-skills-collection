const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkCli, checkBrowsers, checkProfile } = require('../../src/lib/preflight.cjs');

function withPreflightHome(homeDir, fn) {
  const modulePath = require.resolve('../../src/lib/preflight.cjs');
  const originalCacheEntry = require.cache[modulePath];
  const hadOriginalCacheEntry = Object.prototype.hasOwnProperty.call(require.cache, modulePath);
  const oldHome = process.env.HOME;
  const oldUserProfile = process.env.USERPROFILE;
  process.env.HOME = homeDir;
  process.env.USERPROFILE = homeDir;
  try {
    delete require.cache[modulePath];
    const preflight = require('../../src/lib/preflight.cjs');
    return fn(preflight);
  } finally {
    if (oldHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = oldHome;
    }
    if (oldUserProfile === undefined) {
      delete process.env.USERPROFILE;
    } else {
      process.env.USERPROFILE = oldUserProfile;
    }
    delete require.cache[modulePath];
    if (hadOriginalCacheEntry) {
      require.cache[modulePath] = originalCacheEntry;
    }
  }
}

function cftBinaryPath(versionDir, { nested = false } = {}) {
  if (process.platform === 'darwin') {
    const appPath = ['Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'];
    return nested
      ? path.join(versionDir, 'chrome-mac-arm64', ...appPath)
      : path.join(versionDir, ...appPath);
  }
  if (process.platform === 'win32') {
    return nested ? path.join(versionDir, 'chrome-win64', 'chrome.exe') : path.join(versionDir, 'chrome.exe');
  }
  return nested ? path.join(versionDir, 'chrome-linux64', 'chrome') : path.join(versionDir, 'chrome');
}

function withPatchedReaddirSync(patchedFn, fn) {
  const originalReaddirSync = fs.readdirSync;
  fs.readdirSync = (...args) => patchedFn(originalReaddirSync, ...args);
  try {
    return fn();
  } finally {
    fs.readdirSync = originalReaddirSync;
  }
}

describe('checkCli()', () => {
  it('returns correct structure', () => {
    const result = checkCli();
    assert.equal(typeof result.installed, 'boolean');
    assert.equal(typeof result.version, 'string');
    assert.equal(typeof result.bin_path, 'string');
    assert.ok(result.bin_path.length > 0, 'bin_path should not be empty');
  });
});

describe('checkBrowsers()', () => {
  it('returns cft and local fields', () => {
    const result = checkBrowsers();
    assert.ok('cft' in result);
    assert.ok('local' in result);
  });

  it('cft has installed and path fields', () => {
    const { cft } = checkBrowsers();
    assert.equal(typeof cft.installed, 'boolean');
    assert.equal(typeof cft.path, 'string');
  });

  it('local is an array of browser results', () => {
    const { local } = checkBrowsers();
    assert.ok(Array.isArray(local));
    assert.equal(local.length, 3);
    for (const b of local) {
      assert.equal(typeof b.name, 'string');
      assert.equal(typeof b.installed, 'boolean');
    }
  });

  it('restores preflight require cache after loading with a fake home', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'xb-cft-home-'));
    const modulePath = require.resolve('../../src/lib/preflight.cjs');
    const originalCacheEntry = require.cache[modulePath];
    try {
      withPreflightHome(home, ({ checkBrowsers: checkBrowsersWithHome }) => {
        assert.equal(checkBrowsersWithHome().cft.installed, false);
      });

      assert.strictEqual(require.cache[modulePath], originalCacheEntry);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('restores original HOME and USERPROFILE values after loading with a fake home', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'xb-cft-home-'));
    const oldHome = process.env.HOME;
    const oldUserProfile = process.env.USERPROFILE;
    process.env.HOME = 'original-home-value';
    process.env.USERPROFILE = 'original-userprofile-value';
    try {
      withPreflightHome(home, ({ checkBrowsers: checkBrowsersWithHome }) => {
        assert.equal(checkBrowsersWithHome().cft.installed, false);
      });

      assert.equal(process.env.HOME, 'original-home-value');
      assert.equal(process.env.USERPROFILE, 'original-userprofile-value');
    } finally {
      if (oldHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = oldHome;
      }
      if (oldUserProfile === undefined) {
        delete process.env.USERPROFILE;
      } else {
        process.env.USERPROFILE = oldUserProfile;
      }
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('removes HOME and USERPROFILE after loading when they were originally unset', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'xb-cft-home-'));
    const oldHome = process.env.HOME;
    const oldUserProfile = process.env.USERPROFILE;
    delete process.env.HOME;
    delete process.env.USERPROFILE;
    try {
      withPreflightHome(home, ({ checkBrowsers: checkBrowsersWithHome }) => {
        assert.equal(checkBrowsersWithHome().cft.installed, false);
      });

      assert.equal(Object.prototype.hasOwnProperty.call(process.env, 'HOME'), false);
      assert.equal(Object.prototype.hasOwnProperty.call(process.env, 'USERPROFILE'), false);
      assert.notEqual(process.env.HOME, 'undefined');
      assert.notEqual(process.env.USERPROFILE, 'undefined');
    } finally {
      if (oldHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = oldHome;
      }
      if (oldUserProfile === undefined) {
        delete process.env.USERPROFILE;
      } else {
        process.env.USERPROFILE = oldUserProfile;
      }
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('detects CfT under ~/.agent-browser/browsers/chrome-{version}', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'xb-cft-home-'));
    try {
      const versionDir = path.join(home, '.agent-browser', 'browsers', 'chrome-123.0.0.1');
      const bin = cftBinaryPath(versionDir);
      fs.mkdirSync(path.dirname(bin), { recursive: true });
      fs.writeFileSync(bin, '');

      withPreflightHome(home, ({ checkBrowsers: checkBrowsersWithHome }) => {
        const { cft } = checkBrowsersWithHome();

        assert.equal(cft.installed, true);
        assert.equal(cft.path, bin);
        assert.equal(cft.version, '123.0.0.1');
      });
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('detects CfT under the current platform nested browser layout', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'xb-cft-home-'));
    try {
      const versionDir = path.join(home, '.agent-browser', 'browsers', 'chrome-123.0.0.1');
      const bin = cftBinaryPath(versionDir, { nested: true });
      fs.mkdirSync(path.dirname(bin), { recursive: true });
      fs.writeFileSync(bin, '');

      withPreflightHome(home, ({ checkBrowsers: checkBrowsersWithHome }) => {
        const { cft } = checkBrowsersWithHome();

        assert.equal(cft.installed, true);
        assert.equal(cft.path, bin);
        assert.equal(cft.version, '123.0.0.1');
      });
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('does not report CfT installed when version directory lacks binary', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'xb-cft-home-'));
    try {
      fs.mkdirSync(path.join(home, '.agent-browser', 'browsers', 'chrome-123.0.0.1'), { recursive: true });

      withPreflightHome(home, ({ checkBrowsers: checkBrowsersWithHome }) => {
        assert.equal(checkBrowsersWithHome().cft.installed, false);
      });
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('does not report CfT installed when candidate path is a directory', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'xb-cft-home-'));
    try {
      const versionDir = path.join(home, '.agent-browser', 'browsers', 'chrome-123.0.0.1');
      const bin = cftBinaryPath(versionDir);
      fs.mkdirSync(bin, { recursive: true });

      withPreflightHome(home, ({ checkBrowsers: checkBrowsersWithHome }) => {
        assert.equal(checkBrowsersWithHome().cft.installed, false);
      });
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('does not report CfT installed when browsers directory cannot be read', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'xb-cft-home-'));
    try {
      const browsersDir = path.join(home, '.agent-browser', 'browsers');
      fs.mkdirSync(browsersDir, { recursive: true });

      withPreflightHome(home, ({ checkBrowsers: checkBrowsersWithHome }) => {
        withPatchedReaddirSync((originalReaddirSync, target, ...args) => {
          if (target === browsersDir) {
            throw new Error('EACCES');
          }
          return originalReaddirSync(target, ...args);
        }, () => {
          assert.deepEqual(checkBrowsersWithHome().cft, { installed: false, path: '' });
        });
      });
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('does not use old ~/.cache/agent-browser path for CfT detection', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'xb-cft-home-'));
    try {
      const oldBin = path.join(home, '.cache', 'agent-browser', 'chrome');
      fs.mkdirSync(path.dirname(oldBin), { recursive: true });
      fs.writeFileSync(oldBin, '');

      withPreflightHome(home, ({ checkBrowsers: checkBrowsersWithHome }) => {
        assert.equal(checkBrowsersWithHome().cft.installed, false);
      });
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('chooses the highest CfT version directory with a binary', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'xb-cft-home-'));
    try {
      const lowVersionDir = path.join(home, '.agent-browser', 'browsers', 'chrome-122.0.0.1');
      const highVersionDir = path.join(home, '.agent-browser', 'browsers', 'chrome-123.0.0.1');
      const lowBin = cftBinaryPath(lowVersionDir);
      const highBin = cftBinaryPath(highVersionDir);
      fs.mkdirSync(path.dirname(lowBin), { recursive: true });
      fs.mkdirSync(path.dirname(highBin), { recursive: true });
      fs.writeFileSync(lowBin, '');
      fs.writeFileSync(highBin, '');

      withPreflightHome(home, ({ checkBrowsers: checkBrowsersWithHome }) => {
        const { cft } = checkBrowsersWithHome();

        assert.equal(cft.installed, true);
        assert.equal(cft.path, highBin);
        assert.equal(cft.version, '123.0.0.1');
      });
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('falls back to a lower CfT version when the highest version has no binary', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'xb-cft-home-'));
    try {
      const lowVersionDir = path.join(home, '.agent-browser', 'browsers', 'chrome-122.0.0.1');
      const highVersionDir = path.join(home, '.agent-browser', 'browsers', 'chrome-123.0.0.1');
      const lowBin = cftBinaryPath(lowVersionDir);
      fs.mkdirSync(path.dirname(lowBin), { recursive: true });
      fs.mkdirSync(highVersionDir, { recursive: true });
      fs.writeFileSync(lowBin, '');

      withPreflightHome(home, ({ checkBrowsers: checkBrowsersWithHome }) => {
        const { cft } = checkBrowsersWithHome();

        assert.equal(cft.installed, true);
        assert.equal(cft.path, lowBin);
        assert.equal(cft.version, '122.0.0.1');
      });
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});

describe('checkProfile()', () => {
  it('returns correct structure for existing browserId', () => {
    const result = checkProfile('chrome');
    assert.equal(result.browserId, 'chrome');
    assert.equal(typeof result.path, 'string');
    assert.equal(typeof result.exists, 'boolean');
    assert.equal(typeof result.size_bytes, 'number');
  });

  it('returns exists=false for non-existent profile', () => {
    const result = checkProfile('nonexistent_browser_xyz');
    assert.equal(result.exists, false);
    assert.equal(result.size_bytes, 0);
  });
});

'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { syncProfile, EXCLUDE_DIRS, EXCLUDE_FILES, MIGRATABLE_IDS } = require('../../src/lib/sync-profile.cjs');
const lifecycleMod = require('../../src/lib/browser-lifecycle.cjs');
const detectMod = require('../../src/lib/detect-browsers.cjs');

describe('EXCLUDE_DIRS / EXCLUDE_FILES', () => {
  it('EXCLUDE_DIRS contains expected cache directories', () => {
    assert.ok(Array.isArray(EXCLUDE_DIRS));
    assert.ok(EXCLUDE_DIRS.length > 0);
    assert.ok(EXCLUDE_DIRS.includes('Cache'));
    assert.ok(EXCLUDE_DIRS.includes('Code Cache'));
    assert.ok(EXCLUDE_DIRS.includes('GPUCache'));
    assert.ok(EXCLUDE_DIRS.includes('Crashpad'));
  });

  it('EXCLUDE_FILES contains singleton lock files', () => {
    assert.ok(Array.isArray(EXCLUDE_FILES));
    assert.ok(EXCLUDE_FILES.includes('SingletonLock'));
    assert.ok(EXCLUDE_FILES.includes('SingletonSocket'));
    assert.ok(EXCLUDE_FILES.includes('SingletonCookie'));
    assert.equal(EXCLUDE_FILES.length, 3);
  });
});

describe('MIGRATABLE_IDS', () => {
  it('includes chrome, edge, qqbrowser but not cft', () => {
    assert.ok(MIGRATABLE_IDS.includes('chrome'));
    assert.ok(MIGRATABLE_IDS.includes('edge'));
    assert.ok(MIGRATABLE_IDS.includes('qqbrowser'));
    assert.ok(!MIGRATABLE_IDS.includes('cft'));
  });
});

describe('syncProfile()', () => {
  it('rejects cft browserId', () => {
    const result = syncProfile('cft');
    assert.equal(result.success, false);
    assert.equal(result.browserId, 'cft');
    assert.ok(result.error.includes('CfT'));
  });

  it('rejects unknown browserId', () => {
    const result = syncProfile('firefox');
    assert.equal(result.success, false);
    assert.ok(result.error.includes('Unknown browser'));
  });

  it('returns failure when source does not exist', () => {
    const result = syncProfile('chrome', '/tmp/__xb_nonexistent_profile_dir_12345');
    assert.equal(result.success, false);
    assert.equal(result.browserId, 'chrome');
    assert.equal(result.source, '/tmp/__xb_nonexistent_profile_dir_12345');
    assert.ok(result.error.includes('Source profile not found'));
    assert.ok(result.hint);
  });

  it('returns correct structure shape on failure', () => {
    const result = syncProfile('edge', '/tmp/__xb_nonexistent_edge_profile');
    assert.equal(typeof result.success, 'boolean');
    assert.equal(typeof result.browserId, 'string');
    assert.equal(typeof result.source, 'string');
    assert.equal(typeof result.dest, 'string');
    assert.equal(typeof result.error, 'string');
  });

  describe('browser running', () => {
    let origIsRunning;
    let origDetectBrowser;
    let tmpSource;

    before(() => {
      origIsRunning = lifecycleMod.isRunning;
      origDetectBrowser = detectMod.detectBrowser;

      tmpSource = fs.mkdtempSync(path.join(os.tmpdir(), 'xb-running-test-'));
      fs.writeFileSync(path.join(tmpSource, 'Preferences'), '{}');
    });

    after(() => {
      lifecycleMod.isRunning = origIsRunning;
      detectMod.detectBrowser = origDetectBrowser;
      try { fs.rmSync(tmpSource, { recursive: true, force: true }); } catch { /* cleanup */ }
    });

    it('returns running: true with hint when browser is running', () => {
      lifecycleMod.isRunning = () => true;
      detectMod.detectBrowser = (id) => ({
        display_name: 'Google Chrome',
        user_data_path: tmpSource,
      });

      const result = syncProfile('chrome', tmpSource);

      assert.equal(result.success, false);
      assert.equal(result.running, true);
      assert.equal(result.browserId, 'chrome');
      assert.equal(result.source, tmpSource);
      assert.ok(result.error.includes('正在运行'));
      assert.ok(result.hint.includes('guide close-browser'));
      assert.ok(result.hint.includes('--browser chrome'));
    });
  });

  // Skip rsync-based test on Windows (uses robocopy)
  const isWin = os.platform() === 'win32';
  const describeSync = isWin ? describe.skip : describe;

  describeSync('real sync (temp dirs)', () => {
    let tmpDir;
    let sourceDir;
    let destDir;
    let origIsRunning;

    before(() => {
      origIsRunning = lifecycleMod.isRunning;
      lifecycleMod.isRunning = () => false;
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xb-sync-test-'));
      sourceDir = path.join(tmpDir, 'source-profile');
      destDir = path.join(tmpDir, 'dest-profile');
      fs.mkdirSync(sourceDir, { recursive: true });

      // Create test files in source
      fs.writeFileSync(path.join(sourceDir, 'Preferences'), '{"test": true}');
      fs.writeFileSync(path.join(sourceDir, 'Cookies'), 'cookie-data');
      fs.mkdirSync(path.join(sourceDir, 'Default'), { recursive: true });
      fs.writeFileSync(path.join(sourceDir, 'Default', 'Bookmarks'), '{"bookmarks": []}');

      // Create files/dirs that should be excluded
      fs.mkdirSync(path.join(sourceDir, 'Cache'), { recursive: true });
      fs.writeFileSync(path.join(sourceDir, 'Cache', 'data_0'), 'cache-data');
      fs.mkdirSync(path.join(sourceDir, 'GPUCache'), { recursive: true });
      fs.writeFileSync(path.join(sourceDir, 'GPUCache', 'data_0'), 'gpu-cache');
      fs.writeFileSync(path.join(sourceDir, 'SingletonLock'), '');
    });

    after(() => {
      lifecycleMod.isRunning = origIsRunning;
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch { /* cleanup best-effort */ }
    });

    it('copies profile files to dest, excluding caches', () => {
      // Use qqbrowser — unlikely to be running on dev machine, avoids browser-close logic
      const result = syncProfile('qqbrowser', sourceDir);
      assert.equal(result.success, true, `sync failed: ${result.error}`);
      assert.equal(result.browserId, 'qqbrowser');
      assert.equal(result.source, sourceDir);
      assert.ok(result.dest);

      // Verify included files were copied
      assert.ok(fs.existsSync(path.join(result.dest, 'Preferences')));
      assert.ok(fs.existsSync(path.join(result.dest, 'Cookies')));
      assert.ok(fs.existsSync(path.join(result.dest, 'Default', 'Bookmarks')));

      // Verify excluded dirs/files were NOT copied
      assert.ok(!fs.existsSync(path.join(result.dest, 'Cache', 'data_0')),
        'Cache should be excluded');
      assert.ok(!fs.existsSync(path.join(result.dest, 'GPUCache', 'data_0')),
        'GPUCache should be excluded');
      assert.ok(!fs.existsSync(path.join(result.dest, 'SingletonLock')),
        'SingletonLock should be excluded');
    });
  });
});

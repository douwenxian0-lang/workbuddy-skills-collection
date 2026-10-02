const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const tmpDir = path.join(os.tmpdir(), `xb-test-config-${Date.now()}`);

describe('config-store', () => {
  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    process.env.__XB_TEST_CONFIG_PATH = path.join(tmpDir, 'config.json');
  });

  afterEach(() => {
    delete process.env.__XB_TEST_CONFIG_PATH;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('readConfig returns null when no config exists', () => {
    const { readConfig } = require('../../src/lib/config-store.cjs');
    const r = readConfig();
    assert.equal(r, null);
  });

  it('writeDefaultConfig creates valid config', () => {
    const { writeDefaultConfig, readConfig } = require('../../src/lib/config-store.cjs');
    writeDefaultConfig();
    const cfg = readConfig();
    assert.equal(cfg.browser, 'cft');
    assert.equal(cfg.headed, true);
    assert.ok(cfg.profiles);
    assert.ok(cfg.profiles.cft);
  });

  it('writeDefaultConfig creates profiles for all LOCAL_BROWSER_IDS', () => {
    const { writeDefaultConfig, readConfig } = require('../../src/lib/config-store.cjs');
    const { LOCAL_BROWSER_IDS } = require('../../src/lib/paths.cjs');
    writeDefaultConfig();
    const cfg = readConfig();
    for (const id of LOCAL_BROWSER_IDS) {
      assert.deepEqual(cfg.profiles[id], { migrated: false }, `Missing or incorrect profile for ${id}`);
    }
    assert.deepEqual(cfg.profiles.cft, { exists: true });
  });

  it('updateConfig merges values', () => {
    const { writeDefaultConfig, updateConfig, readConfig } = require('../../src/lib/config-store.cjs');
    writeDefaultConfig();
    updateConfig({ browser: 'edge', headed: true });
    const cfg = readConfig();
    assert.equal(cfg.browser, 'edge');
    assert.equal(cfg.headed, true);
  });

  it('updateConfig accepts multiple values', () => {
    const { writeDefaultConfig, updateConfig, readConfig } = require('../../src/lib/config-store.cjs');
    writeDefaultConfig();
    updateConfig({ browser: 'chrome', headed: true });
    const cfg = readConfig();
    assert.equal(cfg.browser, 'chrome');
    assert.equal(cfg.headed, true);
  });

  it('validates browser value', () => {
    const { writeDefaultConfig, updateConfig } = require('../../src/lib/config-store.cjs');
    writeDefaultConfig();
    assert.throws(() => updateConfig({ browser: 'firefox' }), /Invalid browser/);
  });

  it('isComplete returns true for valid config', () => {
    const { writeDefaultConfig, readConfig, isComplete } = require('../../src/lib/config-store.cjs');
    writeDefaultConfig();
    assert.equal(isComplete(readConfig()), true);
  });

  it('isComplete returns false for null browser', () => {
    const { isComplete } = require('../../src/lib/config-store.cjs');
    assert.equal(isComplete({ browser: null }), false);
  });

  it('migrateV1Config converts isolated mode to cft', () => {
    const { migrateV1Config } = require('../../src/lib/config-store.cjs');
    const v1 = { mode: 'isolated', browser: 'chrome-for-testing', headed: false, profile_migrated: true, profile_source: 'chrome' };
    const v2 = migrateV1Config(v1);
    assert.equal(v2.browser, 'cft');
    assert.equal(v2.profiles.chrome.migrated, true);
    assert.equal(v2.mode, undefined);
  });

  it('migrateV1Config converts local-reuse mode', () => {
    const { migrateV1Config } = require('../../src/lib/config-store.cjs');
    const v1 = { mode: 'local-reuse', browser: 'edge', headed: true, profile_migrated: false, profile_source: null };
    const v2 = migrateV1Config(v1);
    assert.equal(v2.browser, 'edge');
    assert.equal(v2.headed, true);
    assert.equal(v2.mode, undefined);
  });

  it('migrateV1Config creates profiles for all LOCAL_BROWSER_IDS', () => {
    const { migrateV1Config } = require('../../src/lib/config-store.cjs');
    const { LOCAL_BROWSER_IDS } = require('../../src/lib/paths.cjs');
    const v1 = { mode: 'isolated', browser: 'chrome-for-testing', headed: false };
    const v2 = migrateV1Config(v1);
    for (const id of LOCAL_BROWSER_IDS) {
      assert.ok(v2.profiles[id] !== undefined, `Missing profile for ${id}`);
    }
    assert.deepEqual(v2.profiles.cft, { exists: true });
  });
});

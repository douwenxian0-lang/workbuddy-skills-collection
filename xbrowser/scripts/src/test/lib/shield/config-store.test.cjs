const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { setupTmpStateDir, teardownTmpStateDir } = require('../../helpers/with-tmp-state-dir.cjs');

let tmpDir;
let configStoreMod;
let SHIELD_DIR;
let CONFIG_FILE;

beforeEach(() => {
  tmpDir = setupTmpStateDir();
  // Re-require AFTER helper sets env + clears cache
  configStoreMod = require('../../../src/lib/shield/config-store.cjs');
  ({ SHIELD_DIR, CONFIG_FILE } = require('../../../src/lib/shield/paths.cjs'));
});

afterEach(() => {
  teardownTmpStateDir(tmpDir);
  tmpDir = undefined;
});

describe('readConfig defaults', () => {
  it('returns safe defaults when no file', () => {
    const cfg = configStoreMod.readConfig();
    assert.equal(cfg.enabled, true);
    assert.deepEqual(cfg.allowlist, []);
  });
});

describe('writeConfig + readConfig roundtrip', () => {
  it('persists allowlist', () => {
    configStoreMod.writeConfig({ enabled: true, allowlist: ['192.168.1.10:8080'] });
    assert.deepEqual(configStoreMod.readConfig().allowlist, ['192.168.1.10:8080']);
  });
  it('writes _sig field', () => {
    configStoreMod.writeConfig({ enabled: true, allowlist: [] });
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    assert.ok(typeof raw._sig === 'string' && raw._sig.length > 0);
  });
});

describe('default config initialization audit', () => {
  it('writeDefaultConfigWithInitLog writes default config and shield-initialized log', () => {
    const cfg = configStoreMod.writeDefaultConfigWithInitLog({ reason: 'new', source: 'init' });
    assert.equal(cfg.version, 1);
    assert.equal(cfg.enabled, true);
    assert.deepEqual(cfg.allowlist, []);

    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    assert.equal(raw.version, 1);
    assert.equal(raw.enabled, true);
    assert.deepEqual(raw.allowlist, []);
    assert.ok(typeof raw._sig === 'string' && raw._sig.length > 0);

    const { readRecent } = require('../../../src/lib/shield/log-store.cjs');
    const [entry] = readRecent(1);
    assert.equal(entry.kind, 'shield-initialized');
    assert.equal(entry.reason, 'new');
    assert.equal(entry.source, 'init');
    assert.equal(entry.config_version, 1);
    assert.equal(entry.enabled, true);
  });

  it('ensureDefaultConfigInitialized is idempotent', () => {
    configStoreMod.ensureDefaultConfigInitialized({ reason: 'new', source: 'init' });
    configStoreMod.ensureDefaultConfigInitialized({ reason: 'new', source: 'init' });

    const { readRecent } = require('../../../src/lib/shield/log-store.cjs');
    const initialized = readRecent(10).filter((e) => e.kind === 'shield-initialized');
    assert.equal(initialized.length, 1);
  });

  it('rolls back default config when initialization log append fails so retry can initialize once', () => {
    const configStorePath = require.resolve('../../../src/lib/shield/config-store.cjs');
    const logStorePath = require.resolve('../../../src/lib/shield/log-store.cjs');
    const logStore = require(logStorePath);
    const originalAppendEntry = logStore.appendEntry;

    try {
      logStore.appendEntry = () => {
        throw new Error('simulated append failure');
      };
      delete require.cache[configStorePath];
      const failingStore = require(configStorePath);

      assert.throws(
        () => failingStore.writeDefaultConfigWithInitLog({ reason: 'new', source: 'init' }),
        /simulated append failure/,
      );
      assert.equal(fs.existsSync(CONFIG_FILE), false, 'config file should be rolled back after log append failure');

      logStore.appendEntry = originalAppendEntry;
      delete require.cache[configStorePath];
      const retryStore = require(configStorePath);
      retryStore.ensureDefaultConfigInitialized({ reason: 'new', source: 'init' });

      const initialized = logStore.readRecent(10).filter((e) => e.kind === 'shield-initialized');
      assert.equal(initialized.length, 1);
    } finally {
      logStore.appendEntry = originalAppendEntry;
      delete require.cache[configStorePath];
      configStoreMod = require(configStorePath);
    }
  });
});

describe('tampered config detection', () => {
  it('resets to safe defaults when payload tampered', () => {
    configStoreMod.writeConfig({ enabled: false, allowlist: ['evil:80'] });
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    raw.allowlist.push('worse:80');
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(raw));
    const cfg = configStoreMod.readConfig();
    assert.equal(cfg.enabled, true);
    assert.deepEqual(cfg.allowlist, []);
    assert.equal(cfg._corrupted, true);
  });
  it('resets when JSON malformed', () => {
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, 'not json');
    const cfg = configStoreMod.readConfig();
    assert.equal(cfg.enabled, true);
    assert.equal(cfg._corrupted, true);
  });

  it('logs config-corrupted and shield-initialized when resetting malformed config', () => {
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, 'not json');
    const cfg = configStoreMod.readConfig();
    assert.equal(cfg.enabled, true);
    assert.equal(cfg._corrupted, true);

    const { readRecent } = require('../../../src/lib/shield/log-store.cjs');
    const entries = readRecent(2);
    assert.equal(entries[0].kind, 'shield-initialized');
    assert.equal(entries[0].reason, 'corrupted-reset');
    assert.equal(entries[0].source, 'config-store');
    assert.equal(entries[0].config_version, 1);
    assert.equal(entries[0].enabled, true);
    assert.equal(entries[0].corrupted_reason, 'parse-error');
    assert.equal(entries[1].kind, 'config-corrupted');
    assert.equal(entries[1].reason, 'parse-error');
  });
});

describe('isEnabled / setEnabled', () => {
  it('default is true', () => {
    assert.equal(configStoreMod.isEnabled(), true);
  });
  it('reflects setEnabled(false)', () => {
    configStoreMod.setEnabled(false);
    assert.equal(configStoreMod.isEnabled(), false);
  });
});

describe('addToAllowlist / removeFromAllowlist', () => {
  it('add then list', () => {
    configStoreMod.addToAllowlist('192.168.1.10:8080');
    assert.deepEqual(configStoreMod.getAllowlist(), ['192.168.1.10:8080']);
  });
  it('dedupe', () => {
    configStoreMod.addToAllowlist('a:1');
    configStoreMod.addToAllowlist('a:1');
    assert.deepEqual(configStoreMod.getAllowlist(), ['a:1']);
  });
  it('remove', () => {
    configStoreMod.addToAllowlist('a:1');
    configStoreMod.addToAllowlist('b:2');
    configStoreMod.removeFromAllowlist('a:1');
    assert.deepEqual(configStoreMod.getAllowlist(), ['b:2']);
  });
});

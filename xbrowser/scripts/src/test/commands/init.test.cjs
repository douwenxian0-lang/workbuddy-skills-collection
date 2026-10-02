// test/commands/init.test.cjs
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { setupTmpStateDir, teardownTmpStateDir } = require('../helpers/with-tmp-state-dir.cjs');

// 模块级 tmpDir，由 setupTmpEnv 写入；it 内通过此变量定位测试 fs 路径
let tmpDir;

function setupTmpEnv() {
  // 1. 让 helper 清 cache + 设 OPENCLAW_STATE_DIR
  tmpDir = setupTmpStateDir();

  // 2. config 文件路径锁定（独立 env，跟 OPENCLAW_STATE_DIR 正交）
  process.env.__XB_TEST_CONFIG_PATH = path.join(tmpDir, 'tools', 'xbrowser', 'config.json');

  // 3. 创建 dummy agent-browser bin（独立路径 mock，不走 paths 派生）
  const xbrowserDir = path.join(tmpDir, 'tools', 'xbrowser');
  const binDir = path.join(xbrowserDir, 'node_modules', 'agent-browser', 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  const ext = os.platform() === 'win32' ? '.exe' : '';
  const binName = `agent-browser-${os.platform()}-${os.arch()}${ext}`;
  const dummyBin = path.join(binDir, binName);
  fs.writeFileSync(dummyBin, '#!/bin/sh\necho "agent-browser 0.25.3"');
  fs.chmodSync(dummyBin, 0o755);

  // 4. AGENT_BROWSER_BIN mutation：dummy bin 不走 paths 派生，单独设置
  //    helper 清缓存后第一次 require paths 才能拿到新 env 计算的模块
  const pathsMod = require('../../src/lib/paths.cjs');
  pathsMod.AGENT_BROWSER_BIN = dummyBin;
}

function teardownTmpEnv() {
  delete process.env.__XB_TEST_CONFIG_PATH;
  teardownTmpStateDir(tmpDir);
  tmpDir = undefined;
}

function writeVersion(version) {
  const xbrowserDir = path.join(tmpDir, 'tools', 'xbrowser');
  fs.mkdirSync(xbrowserDir, { recursive: true });
  fs.writeFileSync(path.join(xbrowserDir, '.version'), version, 'utf8');
}

function writeConfig(cfg) {
  const xbrowserDir = path.join(tmpDir, 'tools', 'xbrowser');
  fs.mkdirSync(xbrowserDir, { recursive: true });
  const cfgPath = path.join(xbrowserDir, 'config.json');
  fs.writeFileSync(cfgPath, JSON.stringify(cfg || {
    browser: 'cft',
    headed: false,
    profiles: { cft: { exists: true } },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
}

function getInitCommand() {
  // helper 已清 src/lib/* 缓存，但 src/commands/init.cjs 不在 src/lib/ 下，需手动清
  delete require.cache[require.resolve('../../src/commands/init.cjs')];
  delete require.cache[require.resolve('../../src/lib/preflight.cjs')];
  delete require.cache[require.resolve('../../src/lib/config-store.cjs')];
  return require('../../src/commands/init.cjs').initCommand;
}

function readShieldLogEntries() {
  const logPath = path.join(tmpDir, 'tools', 'xbrowser', 'shield', 'logs', 'protection.jsonl');
  if (!fs.existsSync(logPath)) return [];
  return fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
}

describe('initCommand() — version flow', () => {
  beforeEach(() => setupTmpEnv());
  afterEach(() => teardownTmpEnv());

  it('dir does not exist → creates dir + writes .version + fails at CLI check', () => {
    const pathsMod = require('../../src/lib/paths.cjs');
    const xbrowserDir = path.join(tmpDir, 'tools', 'xbrowser');
    fs.rmSync(tmpDir, { recursive: true, force: true });
    pathsMod.AGENT_BROWSER_BIN = path.join(xbrowserDir, 'nonexistent', 'agent-browser');
    const initCommand = getInitCommand();
    const r = initCommand();

    assert.equal(r.ok, false);
    assert.ok(fs.existsSync(xbrowserDir), 'working dir should be created');
    assert.ok(fs.existsSync(path.join(xbrowserDir, '.version')), '.version should be written');
    assert.equal(fs.readFileSync(path.join(xbrowserDir, '.version'), 'utf8'), pathsMod.CLI_VERSION);
  });

  it('dir exists, no .version (stale) → cleanup + rebuild + writes .version', () => {
    const pathsMod = require('../../src/lib/paths.cjs');
    const xbrowserDir = path.join(tmpDir, 'tools', 'xbrowser');
    fs.writeFileSync(path.join(xbrowserDir, 'old-file.txt'), 'stale');
    pathsMod.AGENT_BROWSER_BIN = path.join(xbrowserDir, 'nonexistent', 'agent-browser');
    const initCommand = getInitCommand();
    const r = initCommand();

    assert.equal(r.ok, false);
    assert.ok(!fs.existsSync(path.join(xbrowserDir, 'old-file.txt')), 'stale files should be deleted');
    assert.ok(fs.existsSync(path.join(xbrowserDir, '.version')), '.version should be written');
    assert.equal(fs.readFileSync(path.join(xbrowserDir, '.version'), 'utf8'), pathsMod.CLI_VERSION);
  });

  it('.version empty → treated as missing → cleanup + rebuild', () => {
    const pathsMod = require('../../src/lib/paths.cjs');
    const xbrowserDir = path.join(tmpDir, 'tools', 'xbrowser');
    fs.writeFileSync(path.join(xbrowserDir, '.version'), '  \n', 'utf8');
    fs.writeFileSync(path.join(xbrowserDir, 'stale.txt'), 'old');
    pathsMod.AGENT_BROWSER_BIN = path.join(xbrowserDir, 'nonexistent', 'agent-browser');
    const initCommand = getInitCommand();
    const r = initCommand();

    assert.equal(r.ok, false);
    assert.ok(!fs.existsSync(path.join(xbrowserDir, 'stale.txt')), 'stale files should be deleted');
    assert.ok(fs.existsSync(path.join(xbrowserDir, '.version')));
    assert.equal(fs.readFileSync(path.join(xbrowserDir, '.version'), 'utf8'), pathsMod.CLI_VERSION);
  });

  it('.version matches CLI_VERSION → skips step 3, continues checks', () => {
    const pathsMod = require('../../src/lib/paths.cjs');
    const xbrowserDir = path.join(tmpDir, 'tools', 'xbrowser');
    writeVersion(pathsMod.CLI_VERSION);
    writeConfig();
    const initCommand = getInitCommand();
    const r = initCommand();

    assert.ok(fs.existsSync(path.join(xbrowserDir, 'config.json')), 'config should not be deleted');
    assert.equal(fs.readFileSync(path.join(xbrowserDir, '.version'), 'utf8'), pathsMod.CLI_VERSION);
  });

  it('ready init creates shield config and initialized log when missing', () => {
    const pathsMod = require('../../src/lib/paths.cjs');
    writeVersion(pathsMod.CLI_VERSION);
    writeConfig();
    const initCommand = getInitCommand();
    const r = initCommand();

    assert.equal(r.ok, true);
    const shieldCfgPath = path.join(tmpDir, 'tools', 'xbrowser', 'shield', 'config.json');
    assert.ok(fs.existsSync(shieldCfgPath));
    const shieldCfg = JSON.parse(fs.readFileSync(shieldCfgPath, 'utf8'));
    assert.equal(shieldCfg.version, 1);
    assert.equal(shieldCfg.enabled, true);
    assert.deepEqual(shieldCfg.allowlist, []);

    const initEntry = readShieldLogEntries().find((e) => e.kind === 'shield-initialized');
    assert.equal(initEntry.reason, 'new');
    assert.equal(initEntry.source, 'init');
    assert.equal(initEntry.config_version, 1);
    assert.equal(initEntry.enabled, true);
  });

  it('ready init does not duplicate shield-initialized log', () => {
    const pathsMod = require('../../src/lib/paths.cjs');
    writeVersion(pathsMod.CLI_VERSION);
    writeConfig();
    const initCommand = getInitCommand();
    assert.equal(initCommand().ok, true);
    assert.equal(initCommand().ok, true);

    const initialized = readShieldLogEntries().filter((e) => e.kind === 'shield-initialized');
    assert.equal(initialized.length, 1);
  });

  it('ready init returns failure without ready data when shield initialization fails and preserves main config', () => {
    const pathsMod = require('../../src/lib/paths.cjs');
    writeVersion(pathsMod.CLI_VERSION);
    writeConfig();
    const cfgPath = path.join(tmpDir, 'tools', 'xbrowser', 'config.json');
    const beforeConfig = fs.readFileSync(cfgPath, 'utf8');

    const shieldCfgPath = require.resolve('../../src/lib/shield/config-store.cjs');
    require(shieldCfgPath);
    const original = require.cache[shieldCfgPath].exports.ensureDefaultConfigInitialized;
    require.cache[shieldCfgPath].exports.ensureDefaultConfigInitialized = () => {
      throw new Error('simulated shield failure');
    };

    let r;
    try {
      const initCommand = getInitCommand();
      r = initCommand();
    } finally {
      require.cache[shieldCfgPath].exports.ensureDefaultConfigInitialized = original;
      delete require.cache[require.resolve('../../src/commands/init.cjs')];
    }

    assert.equal(r.ok, false);
    assert.equal(r.data, undefined);
    assert.match(r.error, /安全防护初始化失败/);
    assert.match(r.error, /simulated shield failure/);
    assert.equal(fs.readFileSync(cfgPath, 'utf8'), beforeConfig);
  });

  it('.version > CLI_VERSION (illegal) → cleanup + rebuild + writes .version', () => {
    const pathsMod = require('../../src/lib/paths.cjs');
    const xbrowserDir = path.join(tmpDir, 'tools', 'xbrowser');
    writeVersion('99.0.0');
    fs.writeFileSync(path.join(xbrowserDir, 'some-file.txt'), 'data');
    pathsMod.AGENT_BROWSER_BIN = path.join(xbrowserDir, 'nonexistent', 'agent-browser');
    const initCommand = getInitCommand();
    const r = initCommand();

    assert.equal(r.ok, false);
    assert.ok(!fs.existsSync(path.join(xbrowserDir, 'some-file.txt')), 'old files should be deleted');
    assert.equal(fs.readFileSync(path.join(xbrowserDir, '.version'), 'utf8'), pathsMod.CLI_VERSION);
  });

  it('.version < CLI_VERSION → runs migration + writes updated .version', () => {
    const pathsMod = require('../../src/lib/paths.cjs');
    const xbrowserDir = path.join(tmpDir, 'tools', 'xbrowser');
    writeVersion('0.9.0');
    writeConfig();
    const initCommand = getInitCommand();
    const r = initCommand();

    assert.equal(fs.readFileSync(path.join(xbrowserDir, '.version'), 'utf8'), pathsMod.CLI_VERSION);
    assert.ok(fs.existsSync(path.join(xbrowserDir, 'config.json')));
  });

  it('.version < CLI_VERSION and CLI_VERSION reaches 1.2.0 → triggers 1.2.0 migration', () => {
    const pathsMod = require('../../src/lib/paths.cjs');
    const xbrowserDir = path.join(tmpDir, 'tools', 'xbrowser');
    writeVersion('1.0.0');
    writeConfig();
    const initCommand = getInitCommand();
    const r = initCommand();

    assert.equal(r.ok, true);
    assert.equal(fs.readFileSync(path.join(xbrowserDir, '.version'), 'utf8'), pathsMod.CLI_VERSION);
    assert.equal(fs.existsSync(path.join(xbrowserDir, 'shield', 'config.json')), true);
  });

  it('version match but CLI missing → fail with hint to setup (no dir delete)', () => {
    const pathsMod = require('../../src/lib/paths.cjs');
    const xbrowserDir = path.join(tmpDir, 'tools', 'xbrowser');
    writeVersion(pathsMod.CLI_VERSION);
    pathsMod.AGENT_BROWSER_BIN = path.join(xbrowserDir, 'nonexistent', 'agent-browser');
    const initCommand = getInitCommand();
    const r = initCommand();

    assert.equal(r.ok, false);
    assert.match(r.hint, /setup/);
    assert.ok(fs.existsSync(path.join(xbrowserDir, '.version')));
  });

  it('version match, CLI present, but config missing → fail with hint to guide config', () => {
    const pathsMod = require('../../src/lib/paths.cjs');
    writeVersion(pathsMod.CLI_VERSION);
    const initCommand = getInitCommand();
    const r = initCommand();

    assert.equal(r.ok, false);
    assert.equal(r.hint, 'xb guide config');
    assert.equal(r.data.status, 'needs_config');
    assert.equal(r.data.guide, undefined, 'data.guide should not exist');
  });

  it('version match, CLI present, config exists but incomplete → fail with hint to guide incomplete-config', () => {
    const pathsMod = require('../../src/lib/paths.cjs');
    writeVersion(pathsMod.CLI_VERSION);
    // Write an incomplete config (missing browser field)
    writeConfig({ headed: true });
    const initCommand = getInitCommand();
    const r = initCommand();

    assert.equal(r.ok, false);
    assert.equal(r.hint, 'xb guide incomplete-config');
    assert.equal(r.data.status, 'config_incomplete');
    assert.equal(r.data.guide, undefined, 'data.guide should not exist');
  });
});

describe('migration 1.1.0 → 1.2.0', () => {
  beforeEach(() => {
    setupTmpEnv();
    const pathsMod = require('../../src/lib/paths.cjs');
    pathsMod.CLI_VERSION = '1.2.0';
  });
  afterEach(() => teardownTmpEnv());

  it('writes shield/config.json with default enabled=true and empty allowlist', () => {
    writeVersion('1.1.0');
    writeConfig();
    const initCommand = getInitCommand();
    initCommand();

    const cfgPath = path.join(tmpDir, 'tools', 'xbrowser', 'shield', 'config.json');
    assert.ok(fs.existsSync(cfgPath), `shield config should exist at ${cfgPath}`);
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    assert.equal(cfg.enabled, true);
    assert.deepEqual(cfg.allowlist, []);
    assert.ok(typeof cfg._sig === 'string' && cfg._sig.length > 0);
  });

  it('writes shield-initialized log entry with migration context when config is absent', () => {
    writeVersion('1.1.0');
    writeConfig();
    const initCommand = getInitCommand();
    initCommand();

    const logPath = path.join(tmpDir, 'tools', 'xbrowser', 'shield', 'logs', 'protection.jsonl');
    assert.ok(fs.existsSync(logPath), `shield log should exist at ${logPath}`);
    const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
    const entry = JSON.parse(lines[0]);
    assert.equal(entry.kind, 'shield-initialized');
    assert.equal(entry.reason, 'migration');
    assert.equal(entry.source, 'init');
    assert.equal(entry.from_version, '1.1.0');
    assert.equal(entry.to_version, '1.2.0');
    assert.equal(entry.config_version, 1);
    assert.equal(entry.enabled, true);
  });

  it('migration does not overwrite user shield config or add initialized log when config exists', () => {
    writeVersion('1.1.0');
    writeConfig();
    const shieldConfigStore = require('../../src/lib/shield/config-store.cjs');
    shieldConfigStore.writeConfig({ enabled: false, allowlist: ['example.com'] });

    const initCommand = getInitCommand();
    const r = initCommand();

    assert.equal(r.ok, true);
    const cfg = shieldConfigStore.readConfig();
    assert.equal(cfg.enabled, false);
    assert.deepEqual(cfg.allowlist, ['example.com']);
    const initialized = readShieldLogEntries().filter((e) => e.kind === 'shield-initialized');
    assert.equal(initialized.length, 0);
  });

  it('migration summary preserves existing shield config without claiming default enablement', () => {
    writeVersion('1.1.0');
    writeConfig();
    const shieldConfigStore = require('../../src/lib/shield/config-store.cjs');
    shieldConfigStore.writeConfig({ enabled: false, allowlist: ['example.com'] });

    const initCommand = getInitCommand();
    const r = initCommand();

    assert.equal(r.ok, true);
    const cfg = shieldConfigStore.readConfig();
    assert.equal(cfg.enabled, false);
    assert.deepEqual(cfg.allowlist, ['example.com']);
    assert.ok(r.data.upgrade, 'expected r.data.upgrade to exist');
    assert.doesNotMatch(r.data.upgrade.summary, /默认启用/);
    assert.deepEqual(r.data.upgrade.changes, ['shield-config-preserved']);
  });

  it('migration reports corrupted shield config reset without claiming preservation', () => {
    writeVersion('1.1.0');
    writeConfig();
    const shieldCfgPath = path.join(tmpDir, 'tools', 'xbrowser', 'shield', 'config.json');
    fs.mkdirSync(path.dirname(shieldCfgPath), { recursive: true });
    fs.writeFileSync(shieldCfgPath, 'not json', 'utf8');

    const initCommand = getInitCommand();
    const r = initCommand();

    assert.equal(r.ok, true);
    assert.ok(r.data.upgrade, 'expected r.data.upgrade to exist');
    assert.doesNotMatch(r.data.upgrade.summary, /保留现有设置/);
    assert.match(r.data.upgrade.summary, /配置损坏/);
    assert.match(r.data.upgrade.summary, /默认启用/);
    assert.deepEqual(r.data.upgrade.changes, ['shield-config-reset-corrupted']);

    const raw = JSON.parse(fs.readFileSync(shieldCfgPath, 'utf8'));
    assert.equal(raw.enabled, true);
    assert.deepEqual(raw.allowlist, []);
    assert.ok(typeof raw._sig === 'string' && raw._sig.length > 0);

    const entries = readShieldLogEntries();
    const corrupted = entries.find((e) => e.kind === 'config-corrupted');
    const initialized = entries.find((e) => e.kind === 'shield-initialized');
    assert.ok(corrupted, 'expected config-corrupted log entry');
    assert.equal(corrupted.reason, 'parse-error');
    assert.ok(initialized, 'expected shield-initialized log entry');
    assert.equal(initialized.reason, 'corrupted-reset');
  });

  it('ok result contains data.upgrade with summary and changes', () => {
    writeVersion('1.1.0');
    writeConfig();
    const initCommand = getInitCommand();
    const r = initCommand();

    assert.equal(r.ok, true);
    assert.ok(r.data.upgrade, 'expected r.data.upgrade to exist');
    assert.equal(r.data.upgrade.from_version, '1.1.0');
    assert.equal(r.data.upgrade.to_version, '1.2.0');
    assert.match(r.data.upgrade.summary, /XBrowser 自动升级/);
    assert.match(r.data.upgrade.summary, /xb shield status/);
    assert.deepEqual(r.data.upgrade.changes, ['shield-module-initialized']);
  });

  it('fail result (e.g. needs_config) does NOT contain data.upgrade', () => {
    writeVersion('1.1.0');
    // 不调 writeConfig() → 触发 needs_config
    const initCommand = getInitCommand();
    const r = initCommand();

    assert.equal(r.ok, false);
    assert.equal(r.data.status, 'needs_config');
    assert.equal(r.data.upgrade, undefined);
  });

  it('same version → no migration → no data.upgrade', () => {
    writeVersion('1.2.0');  // 等于即将 bump 后的 CLI_VERSION
    writeConfig();
    const initCommand = getInitCommand();
    const r = initCommand();

    assert.equal(r.ok, true);
    assert.equal(r.data.upgrade, undefined);
  });

  it('migration failure (ensureDefaultConfigInitialized throws) → fail with no data.upgrade', () => {
    writeVersion('1.1.0');
    writeConfig();

    const shieldCfgPath = require.resolve('../../src/lib/shield/config-store.cjs');
    require(shieldCfgPath); // 加载并 cache
    const original = require.cache[shieldCfgPath].exports.ensureDefaultConfigInitialized;
    require.cache[shieldCfgPath].exports.ensureDefaultConfigInitialized = () => {
      throw new Error('simulated write failure');
    };

    let r;
    try {
      const initCommand = getInitCommand();
      r = initCommand();
    } finally {
      require.cache[shieldCfgPath].exports.ensureDefaultConfigInitialized = original;
      delete require.cache[require.resolve('../../src/commands/init.cjs')];
    }

    assert.equal(r.ok, false);
    assert.match(r.error, /升级兼容执行失败/);
    assert.match(r.error, /simulated write failure/);
    assert.equal(r.hint, 'xb setup');
    assert.equal(r.data?.upgrade, undefined);
    assert.equal(
      fs.readFileSync(path.join(tmpDir, 'tools', 'xbrowser', '.version'), 'utf8'),
      '1.1.0',
    );
  });
});

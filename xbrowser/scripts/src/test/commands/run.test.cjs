const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { setupTmpStateDir, teardownTmpStateDir } = require('../helpers/with-tmp-state-dir.cjs');

const tmpDir = path.join(os.tmpdir(), `xb-test-run-${Date.now()}`);

describe('runCommand()', () => {
  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    // Set up a valid config so we can get past config checks
    const cfgPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(cfgPath, JSON.stringify({
      browser: 'cft',
      headed: false,
      profiles: { cft: { exists: true } },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    process.env.__XB_TEST_CONFIG_PATH = cfgPath;

    // Create a dummy CLI binary so checkCli() passes
    const binDir = path.join(tmpDir, 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    const dummyBin = path.join(binDir, 'agent-browser');
    fs.writeFileSync(dummyBin, '#!/bin/sh\necho "1.0.0"');
    fs.chmodSync(dummyBin, 0o755);
    // Override AGENT_BROWSER_BIN via paths module cache
    // We'll patch the paths module directly
    const pathsMod = require('../../src/lib/paths.cjs');
    pathsMod._origBin = pathsMod.AGENT_BROWSER_BIN;
    pathsMod.AGENT_BROWSER_BIN = dummyBin;
  });

  afterEach(() => {
    delete process.env.__XB_TEST_CONFIG_PATH;
    // Restore original AGENT_BROWSER_BIN
    const pathsMod = require('../../src/lib/paths.cjs');
    if (pathsMod._origBin) {
      pathsMod.AGENT_BROWSER_BIN = pathsMod._origBin;
      delete pathsMod._origBin;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // We need to require runCommand lazily so env vars are set
  function getRunCommand() {
    return require('../../src/commands/run.cjs').runCommand;
  }

  it('returns fail with "缺少操作指令" when no args', async () => {
    const runCommand = getRunCommand();
    const r = await runCommand([]);
    assert.equal(r.ok, false);
    assert.equal(r.command, 'run');
    assert.match(r.error, /缺少操作指令/);
  });

  it('returns fail with validation error and similar_commands for typo "opne"', async () => {
    const runCommand = getRunCommand();
    const r = await runCommand(['--browser', 'default', 'opne', 'https://example.com']);
    assert.equal(r.ok, false);
    assert.equal(r.command, 'run');
    assert.ok(r.error.includes('opne'), 'error should mention the typo');
    assert.ok(r.data.similar_commands, 'should have similar_commands');
    assert.ok(r.data.similar_commands.includes('open'), 'similar_commands should include "open"');
  });

  it('returns fail with valid_subcommands for invalid compound subverb "get content"', async () => {
    const runCommand = getRunCommand();
    const r = await runCommand(['--browser', 'default', 'get', 'content', '@e1']);
    assert.equal(r.ok, false);
    assert.equal(r.command, 'run');
    assert.ok(r.error.includes('content'), 'error should mention "content"');
    assert.ok(r.data.valid_subcommands, 'should have valid_subcommands');
    assert.ok(r.data.valid_subcommands.includes('text'), 'valid_subcommands should include "text"');
  });

  it('return shape has command="run" and ok field', async () => {
    const runCommand = getRunCommand();
    const r = await runCommand([]);
    assert.equal(r.command, 'run');
    assert.equal(typeof r.ok, 'boolean');
  });

  it('returns fail when --browser not provided', async () => {
    const runCommand = getRunCommand();
    const r = await runCommand(['open', 'https://example.com']);
    assert.equal(r.ok, false);
    assert.match(r.error, /--browser/);
    assert.match(r.hint, /default|cft|chrome|edge|qqbrowser/);
    assert.ok(r.data.configured_browser);
  });

  it('--browser default resolves to config browser', async () => {
    const runCommand = getRunCommand();
    const r = await runCommand(['--browser', 'default', 'open', 'https://example.com']);
    if (!r.ok) {
      assert.ok(!r.error.includes('--browser'), 'should not fail on --browser when default is provided');
    }
  });

  it('--browser invalid-id returns fail', async () => {
    const runCommand = getRunCommand();
    const r = await runCommand(['--browser', 'firefox', 'open', 'https://example.com']);
    assert.equal(r.ok, false);
    assert.match(r.error, /firefox/);
  });

  it('blocks with fail when syncProfile returns running: true', async () => {
    // Stub checkProfile to report profile missing
    const preflightMod = require('../../src/lib/preflight.cjs');
    const origCheckProfile = preflightMod.checkProfile;
    preflightMod.checkProfile = (bid) => ({
      browserId: bid,
      path: `/tmp/fake-profile-${bid}`,
      exists: false,
      size_bytes: 0,
    });

    // Stub syncProfile to simulate browser-running failure
    const syncMod = require('../../src/lib/sync-profile.cjs');
    const origSyncProfile = syncMod.syncProfile;
    syncMod.syncProfile = (bid) => ({
      success: false,
      browserId: bid,
      source: '/fake/source',
      dest: `/tmp/fake-profile-${bid}`,
      running: true,
      error: 'Chrome 正在运行，需要先关闭浏览器才能迁移数据',
      hint: `xb guide close-browser --browser ${bid}`,
    });

    // Clear run.cjs from require cache so it picks up the stubs
    const runModPath = require.resolve('../../src/commands/run.cjs');
    delete require.cache[runModPath];

    try {
      const { runCommand } = require('../../src/commands/run.cjs');
      const r = await runCommand(['--browser', 'chrome', 'open', 'https://example.com']);
      assert.equal(r.ok, false);
      assert.equal(r.command, 'run');
      assert.match(r.error, /正在运行/);
      assert.match(r.hint, /xb guide close-browser/);
      assert.equal(r.data.browser_running, true);
      assert.equal(r.data.browser, 'chrome');
    } finally {
      preflightMod.checkProfile = origCheckProfile;
      syncMod.syncProfile = origSyncProfile;
      // Re-clear so next test gets fresh module
      delete require.cache[runModPath];
    }
  });
});

describe('runCommand() shield layer-1 always-on', () => {
  let shieldTmpDir;
  const cfgTmp = path.join(os.tmpdir(), `xb-test-run-shield-cfg-${Date.now()}`);

  beforeEach(() => {
    shieldTmpDir = setupTmpStateDir();
    delete require.cache[require.resolve('../../src/commands/run.cjs')];
    fs.mkdirSync(cfgTmp, { recursive: true });

    // xb cli config
    const cfgPath = path.join(cfgTmp, 'config.json');
    fs.writeFileSync(cfgPath, JSON.stringify({
      browser: 'cft', headed: false,
      profiles: { cft: { exists: true } },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    process.env.__XB_TEST_CONFIG_PATH = cfgPath;

    // dummy bin
    const binDir = path.join(cfgTmp, 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    const dummyBin = path.join(binDir, 'agent-browser');
    fs.writeFileSync(dummyBin, '#!/bin/sh\necho "1.0.0"');
    fs.chmodSync(dummyBin, 0o755);
    const pathsMod = require('../../src/lib/paths.cjs');
    pathsMod._origBin = pathsMod.AGENT_BROWSER_BIN;
    pathsMod.AGENT_BROWSER_BIN = dummyBin;
  });

  afterEach(() => {
    delete process.env.__XB_TEST_CONFIG_PATH;
    const pathsMod = require('../../src/lib/paths.cjs');
    if (pathsMod._origBin) {
      pathsMod.AGENT_BROWSER_BIN = pathsMod._origBin;
      delete pathsMod._origBin;
    }
    fs.rmSync(cfgTmp, { recursive: true, force: true });
    teardownTmpStateDir(shieldTmpDir);
    shieldTmpDir = undefined;
  });

  it('blocks cloud-metadata URL even when shield is disabled', async () => {
    const { writeConfig } = require('../../src/lib/shield/config-store.cjs');
    writeConfig({ enabled: false, allowlist: [] });
    const { runCommand } = require('../../src/commands/run.cjs');
    const r = await runCommand(['--browser', 'cft', 'open', 'http://169.254.169.254/']);
    assert.equal(r.ok, false);
    assert.match(r.error, /网络防护已拦截/);
    assert.equal(r.data.reason, 'cloud-metadata');
    assert.equal(r.data.policy_layer, 'layer-1-always-on');
  });

  it('blocks dangerous-protocol URL even when shield is disabled', async () => {
    const { writeConfig } = require('../../src/lib/shield/config-store.cjs');
    writeConfig({ enabled: false, allowlist: [] });
    const { runCommand } = require('../../src/commands/run.cjs');
    const r = await runCommand(['--browser', 'cft', 'open', 'file:///etc/passwd']);
    assert.equal(r.ok, false);
    assert.equal(r.data.reason, 'dangerous-protocol');
    assert.equal(r.data.policy_layer, 'layer-1-always-on');
  });

  it('allows private-network URL when shield is disabled (layer-2 honored)', async () => {
    const { writeConfig } = require('../../src/lib/shield/config-store.cjs');
    writeConfig({ enabled: false, allowlist: [] });
    const { runCommand } = require('../../src/commands/run.cjs');
    const r = await runCommand(['--browser', 'cft', 'open', 'http://192.168.1.10/']);
    // The dummy bin echoes "1.0.0" which is invalid JSON, leading to a wrapEngineError fail —
    // BUT crucially it must NOT be blocked by the shield (no policy_layer field).
    if (!r.ok) {
      assert.notEqual(r.data && r.data.policy_layer, 'layer-1-always-on');
      assert.notEqual(r.data && r.data.policy_layer, 'default-protection');
    }
  });

  it('records invalid URL format as open-error, not block', async () => {
    const { runCommand } = require('../../src/commands/run.cjs');
    const r = await runCommand(['--browser', 'cft', 'open', 'not-a-url']);
    assert.equal(r.ok, false);
    assert.match(r.error, /打开失败/);
    assert.match(r.error, /URL 格式无效/);
    assert.doesNotMatch(r.error, /网络防护已拦截/);
    assert.equal(r.data.reason, 'invalid-format');

    const { readRecent } = require('../../src/lib/shield/log-store.cjs');
    const [entry] = readRecent(1);
    assert.equal(entry.kind, 'open-error');
    assert.equal(entry.reason, 'invalid-format');
  });

  it('records DNS resolution failure as open-error, not block', async () => {
    const policy = require('../../src/lib/shield/policy.cjs');
    const originalCheckUrl = policy.checkUrl;
    policy.checkUrl = async () => ({ allow: false, reason: 'dns-resolve-failed', detail: 'example.invalid' });
    delete require.cache[require.resolve('../../src/commands/run.cjs')];
    try {
      const { runCommand } = require('../../src/commands/run.cjs');
      const r = await runCommand(['--browser', 'cft', 'open', 'https://example.invalid/']);
      assert.equal(r.ok, false);
      assert.match(r.error, /打开失败/);
      assert.match(r.error, /DNS/);
      assert.doesNotMatch(r.error, /网络防护已拦截/);
      const { readRecent } = require('../../src/lib/shield/log-store.cjs');
      const [entry] = readRecent(1);
      assert.equal(entry.kind, 'open-error');
      assert.equal(entry.reason, 'dns-resolve-failed');
    } finally {
      policy.checkUrl = originalCheckUrl;
      delete require.cache[require.resolve('../../src/commands/run.cjs')];
    }
  });
});

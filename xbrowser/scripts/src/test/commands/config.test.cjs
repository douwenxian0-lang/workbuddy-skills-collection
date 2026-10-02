const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const tmpDir = path.join(os.tmpdir(), `xb-test-config-cmd-${Date.now()}`);
const { configCommand } = require('../../src/commands/config.cjs');

describe('configCommand()', () => {
  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    process.env.__XB_TEST_CONFIG_PATH = path.join(tmpDir, 'config.json');
  });

  afterEach(() => {
    delete process.env.__XB_TEST_CONFIG_PATH;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('show returns fail when no config exists', () => {
    const r = configCommand(['show']);
    assert.equal(r.ok, false);
    assert.equal(r.command, 'config');
    assert.match(r.error, /配置文件不存在/);
    assert.equal(r.hint, 'xb init');
  });

  it('reset creates default config and returns ok', () => {
    const r = configCommand(['reset']);
    assert.equal(r.ok, true);
    assert.equal(r.command, 'config');
    assert.equal(r.data.action, 'reset');
    assert.equal(r.data.config.browser, 'cft');
    assert.equal(r.data.config.headed, true);
  });

  it('show returns config with browser=cft after init', () => {
    configCommand(['reset']);
    const r = configCommand(['show']);
    assert.equal(r.ok, true);
    assert.equal(r.data.action, 'show');
    assert.equal(r.data.config.browser, 'cft');
    assert.ok(r.data.config_path);
  });

  it('set browser=edge updates browser', () => {
    configCommand(['reset']);
    const r = configCommand(['set', 'browser=edge']);
    assert.equal(r.ok, true);
    assert.equal(r.data.action, 'set');
    assert.equal(r.data.updated.browser, 'edge');
    assert.equal(r.data.config.browser, 'edge');
  });

  it('set browser=firefox returns fail (invalid browser)', () => {
    configCommand(['reset']);
    const r = configCommand(['set', 'browser=firefox']);
    assert.equal(r.ok, false);
    assert.match(r.error, /Invalid browser/);
  });

  it('set browser=edge headed=true updates both', () => {
    configCommand(['reset']);
    const r = configCommand(['set', 'browser=edge', 'headed=true']);
    assert.equal(r.ok, true);
    assert.equal(r.data.updated.browser, 'edge');
    assert.equal(r.data.updated.headed, true);
    assert.equal(r.data.config.browser, 'edge');
    assert.equal(r.data.config.headed, true);
  });

  it('no subcommand returns fail with subcommands hint', () => {
    const r = configCommand([]);
    assert.equal(r.ok, false);
    assert.equal(r.command, 'config');
    assert.match(r.error, /缺少子命令/);
    assert.deepEqual(r.data.subcommands, ['show', 'set', 'reset']);
  });
});

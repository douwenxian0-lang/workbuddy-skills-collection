'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const XB = path.join(__dirname, '..', '..', 'xb.cjs');

function xb(args, opts = {}) {
  try {
    const out = execSync(`node "${XB}" ${args}`, {
      encoding: 'utf8',
      timeout: 30000,
      ...opts,
    });
    return JSON.parse(out);
  } catch (e) {
    const stdout = e.stdout || '';
    try { return JSON.parse(stdout); } catch { return { ok: false, raw: stdout, stderr: e.stderr }; }
  }
}

describe('integration: bundled xb.cjs', () => {
  // --- Help & version (stateless) ---

  it('1. xb help → ok with 11 commands', () => {
    const r = xb('help');
    assert.equal(r.ok, true);
    assert.equal(r.command, 'help');
    assert.ok(Array.isArray(r.data.commands));
    assert.equal(r.data.commands.length, 11);
    // ensure shield is included
    assert.ok(r.data.commands.some((c) => c.name === 'shield'));
    // ensure hidden subcommands are NOT exposed in usage strings
    const shieldEntry = r.data.commands.find((c) => c.name === 'shield');
    assert.ok(shieldEntry);
    assert.ok(!/allow|disable/.test(shieldEntry.usage));
  });

  it('2. xb version → 1.2.0 with platform info', () => {
    const r = xb('version');
    assert.equal(r.ok, true);
    assert.equal(r.data.xb, '1.2.0');
    assert.ok(r.data.node);
    assert.ok(r.data.platform);
    assert.ok(r.data.arch);
  });

  it('3. xb help run → browser_actions array', () => {
    const r = xb('help run');
    assert.equal(r.ok, true);
    assert.equal(r.data.name, 'run');
    assert.ok(Array.isArray(r.data.browser_actions));
  });

  it('4. xb help config → subcommands array', () => {
    const r = xb('help config');
    assert.equal(r.ok, true);
    assert.ok(Array.isArray(r.data.subcommands));
  });

  it('5. xb help guide → shield guide subcommands', () => {
    const r = xb('help guide');
    assert.equal(r.ok, true);
    assert.ok(Array.isArray(r.data.subcommands));
    assert.ok(r.data.subcommands.some((c) => c.name.startsWith('shield-allow')));
    assert.ok(r.data.subcommands.some((c) => c.name === 'shield-off'));
  });

  it('6. xb help shield → public subcommands only', () => {
    const r = xb('help shield');
    assert.equal(r.ok, true);
    assert.ok(Array.isArray(r.data.subcommands));
    assert.ok(!r.data.subcommands.some((c) => c.name === 'allow'));
    assert.ok(!r.data.subcommands.some((c) => c.name === 'disable'));
  });

  it('5. xb unknowncmd → ok:false with available_commands', () => {
    const r = xb('unknowncmd');
    assert.equal(r.ok, false);
    assert.ok(Array.isArray(r.data.available_commands));
  });

  // --- Config commands (stateful, use temp config) ---

  describe('config lifecycle', () => {
    let tmpConfigPath;
    let configEnv;

    before(() => {
      tmpConfigPath = path.join(os.tmpdir(), `xb-integration-test-${Date.now()}.json`);
      configEnv = { env: { ...process.env, __XB_TEST_CONFIG_PATH: tmpConfigPath } };
    });

    after(() => {
      try { fs.unlinkSync(tmpConfigPath); } catch {}
    });

    it('7. xb config reset → default browser=cft', () => {
      const r = xb('config reset', configEnv);
      assert.equal(r.ok, true);
      assert.equal(r.data.action, 'reset');
      assert.equal(r.data.config.browser, 'cft');
    });

    it('8. xb config show → browser=cft', () => {
      const r = xb('config show', configEnv);
      assert.equal(r.ok, true);
      assert.equal(r.data.config.browser, 'cft');
    });

    it('9. xb config set browser=edge headed=true → updated', () => {
      const r = xb('config set browser=edge headed=true', configEnv);
      assert.equal(r.ok, true);
      assert.equal(r.data.updated.browser, 'edge');
    });

    it('10. xb config show → reflects set values', () => {
      const r = xb('config show', configEnv);
      assert.equal(r.data.config.browser, 'edge');
      assert.equal(r.data.config.headed, true);
    });
  });

  // --- Status ---

  it('10. xb status → has cli, browsers, config, profiles', () => {
    const r = xb('status');
    assert.equal(r.ok, true);
    assert.ok(r.data.cli);
    assert.ok(r.data.browsers);
    assert.ok('config' in r.data);
    assert.ok(r.data.profiles);
  });

  // --- Init ---

  it('11. xb init → returns with command=init', () => {
    const r = xb('init');
    assert.equal(r.command, 'init');
  });

  // --- Validation (run with bad action/subcommand) ---

  describe('run validation', () => {
    let tmpConfigPath;
    let validationEnv;

    before(() => {
      tmpConfigPath = path.join(os.tmpdir(), `xb-integration-validation-${Date.now()}.json`);
      // Pre-create a valid config so run's preflight passes
      fs.writeFileSync(tmpConfigPath, JSON.stringify({
        browser: 'cft',
        headed: false,
        profiles: { cft: { exists: true } },
      }));
      validationEnv = { env: { ...process.env, __XB_TEST_CONFIG_PATH: tmpConfigPath } };
    });

    after(() => {
      try { fs.unlinkSync(tmpConfigPath); } catch {}
    });

    it('12. xb run opne → suggests "open"', () => {
      const r = xb('run --browser default opne https://example.com', validationEnv);
      assert.equal(r.ok, false);
      assert.ok(r.error.includes('opne'));
      assert.ok(Array.isArray(r.data.similar_commands));
      assert.ok(r.data.similar_commands.includes('open'));
    });

    it('13. xb run get content @e1 → valid_subcommands includes text', () => {
      const r = xb('run --browser default get content @e1', validationEnv);
      assert.equal(r.ok, false);
      assert.ok(Array.isArray(r.data.valid_subcommands));
      assert.ok(r.data.valid_subcommands.includes('text'));
    });
  });

  // --- Cleanup ---

  it('14. xb cleanup → sessions_closed is number', () => {
    const r = xb('cleanup');
    assert.equal(r.ok, true);
    assert.equal(typeof r.data.sessions_closed, 'number');
  });
});

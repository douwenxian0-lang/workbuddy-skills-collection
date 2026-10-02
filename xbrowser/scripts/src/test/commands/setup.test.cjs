const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { setupCommand } = require('../../src/commands/setup.cjs');

describe('setupCommand()', () => {
  it('returns XbResult with command="setup"', async () => {
    const r = await setupCommand();
    assert.equal(r.command, 'setup');
  });

  it('result has ok field (boolean)', async () => {
    const r = await setupCommand();
    assert.equal(typeof r.ok, 'boolean');
  });

  it('if ok=true, result has cli_version', async () => {
    const r = await setupCommand();
    if (r.ok) {
      assert.equal(typeof r.data.cli_version, 'string');
    }
  });

  it('result data has install_path field', async () => {
    const r = await setupCommand();
    if (r.data) {
      assert.equal(typeof r.data.install_path, 'string');
      assert.ok(r.data.install_path.length > 0, 'install_path should not be empty');
    }
  });

  it('if ok=true, browser_installed is boolean', async () => {
    const r = await setupCommand();
    if (r.ok) {
      assert.equal(typeof r.data.browser_installed, 'boolean');
    }
  });

  it('if ok=false, has error and hint', async () => {
    const r = await setupCommand();
    if (!r.ok) {
      assert.equal(typeof r.error, 'string');
      assert.ok(r.error.length > 0, 'error should not be empty');
      assert.equal(typeof r.hint, 'string');
    }
  });
});

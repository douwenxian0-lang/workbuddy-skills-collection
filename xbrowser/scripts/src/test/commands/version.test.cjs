const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { versionCommand } = require('../../src/commands/version.cjs');
const { CLI_VERSION } = require('../../src/lib/paths.cjs');

describe('versionCommand()', () => {
  it('xb version matches CLI_VERSION', () => {
    const r = versionCommand();
    assert.equal(r.data.xb, CLI_VERSION);
  });
});

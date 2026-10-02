const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { statusCommand } = require('../../src/commands/status.cjs');
const { BROWSER_IDS } = require('../../src/lib/paths.cjs');

describe('statusCommand()', () => {
  it('returns ok with command="status"', () => {
    const r = statusCommand();
    assert.equal(r.ok, true);
    assert.equal(r.command, 'status');
  });

  it('result data has cli, browsers, config, profiles fields', () => {
    const r = statusCommand();
    assert.ok(r.data.cli, 'missing cli');
    assert.ok(r.data.browsers, 'missing browsers');
    assert.ok(r.data.config, 'missing config');
    assert.ok(r.data.profiles, 'missing profiles');
  });

  it('browsers has all 4 browser IDs', () => {
    const r = statusCommand();
    for (const id of BROWSER_IDS) {
      assert.ok(id in r.data.browsers, `missing browser: ${id}`);
    }
  });

  it('profiles has all 4 browser IDs with path and exists fields', () => {
    const r = statusCommand();
    for (const id of BROWSER_IDS) {
      const p = r.data.profiles[id];
      assert.ok(p, `missing profile for ${id}`);
      assert.equal(typeof p.path, 'string', `${id}.path should be string`);
      assert.equal(typeof p.exists, 'boolean', `${id}.exists should be boolean`);
    }
  });

  it('config has exists and complete fields', () => {
    const r = statusCommand();
    assert.equal(typeof r.data.config.exists, 'boolean');
    assert.equal(typeof r.data.config.complete, 'boolean');
  });
});

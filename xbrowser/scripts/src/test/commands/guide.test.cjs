'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { guideCommand } = require('../../src/commands/guide.cjs');

describe('guide command', () => {
  it('no args returns error with available subcommands', () => {
    const r = guideCommand([]);
    assert.equal(r.ok, false);
    assert.ok(r.error.includes('缺少子命令'));
  });

  it('guide config returns step 0 by default', () => {
    const r = guideCommand(['config']);
    assert.equal(r.ok, true);
    assert.equal(r.data.step, 0);
    assert.equal(r.data.awaits_user_input, true);
  });

  it('guide config --step 1 returns browser-select', () => {
    const r = guideCommand(['config', '--step', '1']);
    assert.equal(r.ok, true);
    assert.equal(r.data.step, 1);
    assert.ok(r.data.options.some(o => o.value === 'cft'));
  });

  it('guide config --step 2 returns headed-select', () => {
    const r = guideCommand(['config', '--step', '2']);
    assert.equal(r.ok, true);
    assert.equal(r.data.step, 2);
    assert.equal(r.data.awaits_user_input, true);
  });

  it('guide close-browser requires --browser', () => {
    const r = guideCommand(['close-browser']);
    assert.equal(r.ok, false);
    assert.ok(r.error.includes('--browser'));
  });

  it('guide close-browser --browser chrome returns 3 options', () => {
    const r = guideCommand(['close-browser', '--browser', 'chrome']);
    assert.equal(r.ok, true);
    assert.equal(r.data.step, 'close-browser');
    assert.equal(r.data.options.length, 3);
    assert.equal(r.data.awaits_user_input, true);
  });

  it('guide incomplete-config returns 2 options', () => {
    const r = guideCommand(['incomplete-config']);
    assert.equal(r.ok, true);
    assert.equal(r.data.step, 'incomplete-config');
    assert.equal(r.data.options.length, 2);
    assert.equal(r.data.awaits_user_input, true);
  });

  it('unknown subcommand returns error', () => {
    const r = guideCommand(['nonexistent']);
    assert.equal(r.ok, false);
  });
});

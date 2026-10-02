const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateAction } = require('../../src/lib/commands-whitelist.cjs');

describe('validateAction()', () => {
  it('accepts valid simple verb', () => {
    const r = validateAction(['open', 'https://example.com']);
    assert.equal(r.valid, true);
    assert.equal(r.verb, 'open');
  });

  it('accepts valid compound verb', () => {
    const r = validateAction(['get', 'text', '@e1']);
    assert.equal(r.valid, true);
    assert.equal(r.verb, 'get');
    assert.equal(r.subverb, 'text');
  });

  it('rejects unknown verb with suggestion', () => {
    const r = validateAction(['opne', 'https://example.com']);
    assert.equal(r.valid, false);
    assert.ok(r.error.includes('opne'));
    assert.ok(r.similar.includes('open'));
  });

  it('rejects invalid compound subverb with usage hint', () => {
    const r = validateAction(['get', 'content', '@e1']);
    assert.equal(r.valid, false);
    assert.ok(r.error.includes('content'));
    assert.ok(r.hint.includes('get'));
    assert.ok(r.validSubverbs.includes('text'));
  });

  it('rejects compound verb missing required subverb', () => {
    const r = validateAction(['get']);
    assert.equal(r.valid, false);
    assert.ok(r.error.includes('子命令'));
    assert.ok(r.validSubverbs.length > 0);
  });

  it('accepts verb with optional subverb (cookies without sub)', () => {
    const r = validateAction(['cookies']);
    assert.equal(r.valid, true);
    assert.equal(r.verb, 'cookies');
  });

  it('accepts cookies with valid sub', () => {
    const r = validateAction(['cookies', 'set', 'name', 'value']);
    assert.equal(r.valid, true);
    assert.equal(r.verb, 'cookies');
    assert.equal(r.subverb, 'set');
  });

  it('accepts tab without sub (tab list)', () => {
    const r = validateAction(['tab']);
    assert.equal(r.valid, true);
  });

  it('accepts tab with number (tab 0 — not a known sub, treated as arg)', () => {
    const r = validateAction(['tab', '0']);
    assert.equal(r.valid, true);
    assert.equal(r.verb, 'tab');
  });

  it('accepts batch with command list', () => {
    const r = validateAction(['batch', 'open https://a.com', 'snapshot -i']);
    assert.equal(r.valid, true);
    assert.equal(r.verb, 'batch');
  });

  it('returns error for empty input', () => {
    const r = validateAction([]);
    assert.equal(r.valid, false);
    assert.ok(r.error.includes('操作指令'));
  });

  it('accepts all simple verbs', () => {
    const simples = ['open', 'back', 'forward', 'reload', 'close', 'snapshot',
      'click', 'dblclick', 'fill', 'type', 'press', 'hover', 'select',
      'check', 'uncheck', 'scroll', 'scrollintoview', 'drag', 'upload', 'focus',
      'keydown', 'keyup', 'screenshot', 'pdf', 'wait', 'eval',
      'highlight', 'inspect'];
    for (const v of simples) {
      const r = validateAction([v]);
      assert.equal(r.valid, true, `expected ${v} to be valid`);
    }
  });

  it('suggests close for "clsoe" typo', () => {
    const r = validateAction(['clsoe']);
    assert.equal(r.valid, false);
    assert.ok(r.similar.includes('close'));
  });
});

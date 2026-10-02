const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ok, fail, output } = require('../../src/lib/result.cjs');

describe('result.ok()', () => {
  it('returns success structure', () => {
    const r = ok('init', { status: 'ready' });
    assert.equal(r.ok, true);
    assert.equal(r.command, 'init');
    assert.deepEqual(r.data, { status: 'ready' });
    assert.equal(r.error, undefined);
    assert.equal(r.hint, undefined);
  });

  it('includes warnings when provided', () => {
    const r = ok('run', {}, ['profile 为空']);
    assert.deepEqual(r.warnings, ['profile 为空']);
  });

  it('omits warnings when empty array', () => {
    const r = ok('run', {}, []);
    assert.equal(r.warnings, undefined);
  });
});

describe('result.fail()', () => {
  it('returns error structure', () => {
    const r = fail('run', '环境未初始化', 'xb init');
    assert.equal(r.ok, false);
    assert.equal(r.command, 'run');
    assert.equal(r.error, '环境未初始化');
    assert.equal(r.hint, 'xb init');
  });

  it('includes data when provided', () => {
    const r = fail('run', '未知指令', 'xb help run', { similar_commands: ['open'] });
    assert.deepEqual(r.data, { similar_commands: ['open'] });
  });

  it('omits hint when not provided', () => {
    const r = fail('run', '出错了');
    assert.equal(r.hint, undefined);
  });
});

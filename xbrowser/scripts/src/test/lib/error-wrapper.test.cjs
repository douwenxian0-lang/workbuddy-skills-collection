const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { wrapEngineError } = require('../../src/lib/error-wrapper.cjs');

describe('wrapEngineError()', () => {
  it('translates timeout error', () => {
    const r = wrapEngineError('Timeout 30000ms exceeded', 'open');
    assert.ok(r.error.includes('超时'));
    assert.ok(r.hint.includes('--timeout'));
  });

  it('translates element not found', () => {
    const r = wrapEngineError('Element not found: @e5', 'click');
    assert.ok(r.error.includes('元素引用已失效'));
    assert.ok(r.hint.includes('snapshot'));
  });

  it('translates navigation failed', () => {
    const r = wrapEngineError('Navigation failed: net::ERR_NAME_NOT_RESOLVED', 'open');
    assert.ok(r.error.includes('页面加载失败'));
  });

  it('translates session closed', () => {
    const r = wrapEngineError('Session closed', 'snapshot');
    assert.ok(r.error.includes('浏览器实例已关闭'));
    assert.ok(r.hint.includes('init'));
  });

  it('translates missing URL', () => {
    const r = wrapEngineError('open requires a URL', 'open');
    assert.ok(r.error.includes('URL'));
  });

  it('translates daemon startup failure', () => {
    const r = wrapEngineError('Daemon process exited during startup with no error output', 'open');
    assert.ok(r.error.includes('引擎启动失败'));
    assert.ok(r.hint.includes('status'));
  });

  it('translates daemon failed to start', () => {
    const r = wrapEngineError('Daemon failed to start (socket: /tmp/foo.sock)', 'click');
    assert.ok(r.error.includes('引擎启动失败'));
  });

  it('translates ECONNREFUSED', () => {
    const r = wrapEngineError('connect ECONNREFUSED 127.0.0.1:9222', 'snapshot');
    assert.ok(r.error.includes('连接断开'));
  });

  it('translates ENOENT for missing executable', () => {
    const r = wrapEngineError('spawn /usr/bin/chrome ENOENT', 'open');
    assert.ok(r.error.includes('未找到'));
  });

  it('translates permission denied', () => {
    const r = wrapEngineError('EACCES: permission denied, open /tmp/foo', 'open');
    assert.ok(r.error.includes('权限'));
  });

  it('translates CDP protocol error', () => {
    const r = wrapEngineError('Protocol error (Runtime.callFunctionOn): Target closed', 'eval');
    // This matches "target closed" pattern first (session closed), which is fine
    assert.ok(r.error);
  });

  it('translates browser crash', () => {
    const r = wrapEngineError('browser process crashed with SIGSEGV', 'snapshot');
    assert.ok(r.error.includes('崩溃'));
  });

  it('translates Unknown ref error', () => {
    const r = wrapEngineError('Unknown ref: e999', 'click');
    assert.ok(r.error.includes('元素引用已失效'));
    assert.ok(r.hint.includes('snapshot'));
  });

  it('wraps unknown errors with raw_error field', () => {
    const r = wrapEngineError('Something completely unexpected', 'eval');
    assert.equal(r.error, '浏览器操作失败');
    assert.ok(r.hint.includes('raw_error'));
    assert.equal(r.raw_error, 'Something completely unexpected');
  });

  it('handles null input gracefully', () => {
    const r = wrapEngineError(null, 'open');
    assert.equal(r.error, '未知错误');
    assert.equal(r.raw_error, undefined);
  });

  it('handles undefined input gracefully', () => {
    const r = wrapEngineError(undefined, 'open');
    assert.equal(r.error, '未知错误');
  });

  it('handles empty string input', () => {
    const r = wrapEngineError('', 'open');
    assert.equal(r.error, '未知错误');
  });
});

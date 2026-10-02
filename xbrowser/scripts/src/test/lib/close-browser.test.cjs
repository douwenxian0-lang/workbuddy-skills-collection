const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('close-browser module', () => {
  it('exports closeBrowser and killByPidOnly', () => {
    const mod = require('../../src/lib/close-browser.cjs');
    assert.equal(typeof mod.closeBrowser, 'function');
    assert.equal(typeof mod.killByPidOnly, 'function');
  });

  it('closeBrowser returns skip for cft', () => {
    const { closeBrowser } = require('../../src/lib/close-browser.cjs');
    const result = closeBrowser('cft');
    assert.equal(result.success, true);
    assert.equal(result.method, 'skip');
  });

  it('killByPidOnly returns skip for cft', () => {
    const { killByPidOnly } = require('../../src/lib/close-browser.cjs');
    const result = killByPidOnly('cft');
    assert.equal(result.success, true);
    assert.equal(result.method, 'skip');
  });

  it('killByPidOnly returns skip_no_pid when no PID file exists', () => {
    const { killByPidOnly } = require('../../src/lib/close-browser.cjs');
    // Use 'qqbrowser' which is unlikely to be running and have a PID file
    const result = killByPidOnly('qqbrowser');
    assert.equal(result.success, true);
    assert.equal(result.method, 'skip_no_pid');
  });
});

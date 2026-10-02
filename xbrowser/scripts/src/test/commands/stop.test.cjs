const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const closeBrowserMod = require('../../src/lib/close-browser.cjs');
const browserLifecycle = require('../../src/lib/browser-lifecycle.cjs');

describe('stopCommand()', () => {
  let origCloseBrowser;
  let origIsRunning;

  beforeEach(() => {
    origCloseBrowser = closeBrowserMod.closeBrowser;
    origIsRunning = browserLifecycle.isRunning;
    // Default mocks
    closeBrowserMod.closeBrowser = (name) => ({ success: true, browser: name });
    browserLifecycle.isRunning = () => false;
  });

  afterEach(() => {
    closeBrowserMod.closeBrowser = origCloseBrowser;
    browserLifecycle.isRunning = origIsRunning;
  });

  function getStopCommand() {
    return require('../../src/commands/stop.cjs').stopCommand;
  }

  it('returns error when no browser specified', () => {
    const stopCommand = getStopCommand();
    const r = stopCommand([]);
    assert.equal(r.ok, false);
    assert.ok(r.error.includes('浏览器'));
  });

  it('returns error for invalid browser id', () => {
    const stopCommand = getStopCommand();
    const r = stopCommand(['firefox']);
    assert.equal(r.ok, false);
    assert.ok(r.error.includes('firefox'));
  });

  it('returns error when trying to stop cft', () => {
    const stopCommand = getStopCommand();
    const r = stopCommand(['cft']);
    assert.equal(r.ok, false);
    assert.ok(r.hint.includes('cleanup'));
  });

  // --- No --force: check-only mode ---

  it('stop chrome (no force, not running) → ok:true', () => {
    browserLifecycle.isRunning = () => false;
    const stopCommand = getStopCommand();
    const r = stopCommand(['chrome']);
    assert.equal(r.ok, true);
    assert.equal(r.data.browser, 'chrome');
    assert.equal(r.data.running, false);
  });

  it('stop chrome (no force, running) → ok:false + hint to guide', () => {
    browserLifecycle.isRunning = () => true;
    const stopCommand = getStopCommand();
    const r = stopCommand(['chrome']);
    assert.equal(r.ok, false);
    assert.ok(r.hint.includes('guide'));
    assert.equal(r.data.browser, 'chrome');
    assert.equal(r.data.running, true);
  });

  it('stop all (no force, some running) → ok:false + running list', () => {
    browserLifecycle.isRunning = (id) => id === 'chrome';
    const stopCommand = getStopCommand();
    const r = stopCommand(['all']);
    assert.equal(r.ok, false);
    assert.ok(r.data.running_browsers.includes('chrome'));
    assert.ok(r.hint.includes('--force'));
  });

  it('stop all (no force, none running) → ok:true', () => {
    browserLifecycle.isRunning = () => false;
    const stopCommand = getStopCommand();
    const r = stopCommand(['all']);
    assert.equal(r.ok, true);
    assert.equal(r.data.target, 'all');
  });

  // --- With --force ---

  it('stop chrome --force → executes closeBrowser, returns ok', () => {
    let closedBrowser = null;
    closeBrowserMod.closeBrowser = (name) => { closedBrowser = name; return { success: true, browser: name }; };
    const stopCommand = getStopCommand();
    const r = stopCommand(['chrome', '--force']);
    assert.equal(r.ok, true);
    assert.equal(r.data.browser, 'chrome');
    assert.equal(r.data.success, true);
    assert.equal(closedBrowser, 'chrome');
  });

  it('stop chrome --force handles closeBrowser failure', () => {
    closeBrowserMod.closeBrowser = () => ({ success: false, error: 'process stuck' });
    const stopCommand = getStopCommand();
    const r = stopCommand(['chrome', '--force']);
    assert.equal(r.ok, false);
    assert.ok(r.error.includes('失败'));
  });

  it('stop all --force → executes closeBrowser for all', () => {
    const closed = [];
    closeBrowserMod.closeBrowser = (name) => { closed.push(name); return { success: true, browser: name }; };
    const stopCommand = getStopCommand();
    const r = stopCommand(['all', '--force']);
    assert.equal(r.ok, true);
    assert.ok(Array.isArray(r.data.results));
    assert.ok(closed.length > 0);
  });
});

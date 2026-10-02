const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseRunArgs, filterActionArgs } = require('../../src/lib/arg-parser.cjs');

describe('parseRunArgs()', () => {
  it('extracts --browser before action', () => {
    const r = parseRunArgs(['--browser', 'edge', 'open', 'https://example.com']);
    assert.equal(r.browser, 'edge');
    assert.deepEqual(r.actionArgs, ['open', 'https://example.com']);
  });

  it('extracts --browser after action', () => {
    const r = parseRunArgs(['open', 'https://example.com', '--browser', 'edge']);
    assert.equal(r.browser, 'edge');
    assert.deepEqual(r.actionArgs, ['open', 'https://example.com']);
  });

  it('extracts --headed from anywhere', () => {
    const r = parseRunArgs(['open', '--headed', 'https://example.com']);
    assert.equal(r.headed, true);
    assert.deepEqual(r.actionArgs, ['open', 'https://example.com']);
  });

  it('extracts --timeout with value', () => {
    const r = parseRunArgs(['--timeout', '60000', 'open', 'https://example.com']);
    assert.equal(r.timeout, 60000);
    assert.deepEqual(r.actionArgs, ['open', 'https://example.com']);
  });

  it('handles multiple env params scattered', () => {
    const r = parseRunArgs(['--browser', 'edge', 'open', 'https://example.com', '--timeout', '60000', '--headed']);
    assert.equal(r.browser, 'edge');
    assert.equal(r.timeout, 60000);
    assert.equal(r.headed, true);
    assert.deepEqual(r.actionArgs, ['open', 'https://example.com']);
  });

  it('returns empty actionArgs when no action provided', () => {
    const r = parseRunArgs(['--headed']);
    assert.equal(r.headed, true);
    assert.deepEqual(r.actionArgs, []);
  });

  it('does not consume --full as xb param (passes through)', () => {
    const r = parseRunArgs(['screenshot', '--full']);
    assert.deepEqual(r.actionArgs, ['screenshot', '--full']);
    assert.equal(r.headed, false);
  });

  it('handles -- separator as escape hatch', () => {
    const r = parseRunArgs(['--headed', '--', '--browser', 'open']);
    assert.equal(r.headed, true);
    assert.deepEqual(r.actionArgs, ['--browser', 'open']);
    assert.equal(r.browser, undefined);
  });

  it('handles --timeout value followed immediately by action', () => {
    const r = parseRunArgs(['--timeout', '5000', 'fill', '@e3', 'hello']);
    assert.equal(r.timeout, 5000);
    assert.deepEqual(r.actionArgs, ['fill', '@e3', 'hello']);
  });

  it('returns defaults when no args', () => {
    const r = parseRunArgs([]);
    assert.equal(r.browser, undefined);
    assert.equal(r.headed, false);
    assert.equal(r.timeout, undefined);
    assert.deepEqual(r.actionArgs, []);
  });
});

describe('parseRunArgs() error handling', () => {
  it('reports error when --browser has no value', () => {
    const r = parseRunArgs(['--browser']);
    assert.ok(r.errors.length > 0);
    assert.ok(r.errors[0].includes('--browser'));
    assert.deepEqual(r.actionArgs, []);
  });

  it('reports error when --timeout has no value', () => {
    const r = parseRunArgs(['open', '--timeout']);
    assert.ok(r.errors.length > 0);
    assert.ok(r.errors[0].includes('--timeout'));
    assert.deepEqual(r.actionArgs, ['open']);
  });

  it('reports error when --timeout value is not a number', () => {
    const r = parseRunArgs(['--timeout', 'abc', 'open', 'http://x.com']);
    assert.ok(r.errors.length > 0);
    assert.ok(r.errors[0].includes('数字'));
    assert.equal(r.timeout, undefined);
    assert.deepEqual(r.actionArgs, ['open', 'http://x.com']);
  });

  it('returns empty errors array when no issues', () => {
    const r = parseRunArgs(['--browser', 'chrome', 'open', 'http://x.com']);
    assert.deepEqual(r.errors, []);
  });
});

describe('filterActionArgs()', () => {
  it('passes through normal action args unchanged', () => {
    const r = filterActionArgs(['open', 'https://example.com']);
    assert.deepEqual(r.filtered, ['open', 'https://example.com']);
    assert.deepEqual(r.stripped, []);
  });

  it('strips blocked valued param with its value', () => {
    const r = filterActionArgs(['open', 'https://example.com', '--profile', '/tmp/test']);
    assert.deepEqual(r.filtered, ['open', 'https://example.com']);
    assert.deepEqual(r.stripped, ['--profile']);
  });

  it('strips blocked flag param', () => {
    const r = filterActionArgs(['open', 'https://example.com', '--debug']);
    assert.deepEqual(r.filtered, ['open', 'https://example.com']);
    assert.deepEqual(r.stripped, ['--debug']);
  });

  it('strips multiple blocked params at once', () => {
    const r = filterActionArgs(['open', 'https://example.com', '--profile', '/tmp/x', '--json', '--session', 'foo']);
    assert.deepEqual(r.filtered, ['open', 'https://example.com']);
    assert.deepEqual(r.stripped, ['--profile', '--json', '--session']);
  });

  it('handles valued param at end without value', () => {
    const r = filterActionArgs(['open', 'https://example.com', '--profile']);
    assert.deepEqual(r.filtered, ['open', 'https://example.com']);
    assert.deepEqual(r.stripped, ['--profile']);
  });

  it('does not strip unknown flags (passes them through)', () => {
    const r = filterActionArgs(['open', 'https://example.com', '--full', '--annotate-custom']);
    assert.deepEqual(r.filtered, ['open', 'https://example.com', '--full', '--annotate-custom']);
    assert.deepEqual(r.stripped, []);
  });

  it('returns empty arrays for empty input', () => {
    const r = filterActionArgs([]);
    assert.deepEqual(r.filtered, []);
    assert.deepEqual(r.stripped, []);
  });
});

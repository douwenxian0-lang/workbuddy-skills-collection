const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { setupTmpStateDir, teardownTmpStateDir } = require('../../helpers/with-tmp-state-dir.cjs');

let tmpDir;
let logStoreMod;
let LOG_FILE;

beforeEach(() => {
  tmpDir = setupTmpStateDir();
  // Re-require AFTER helper sets env + clears cache
  logStoreMod = require('../../../src/lib/shield/log-store.cjs');
  ({ LOG_FILE } = require('../../../src/lib/shield/paths.cjs'));
  logStoreMod._resetWriteCounter && logStoreMod._resetWriteCounter();
});

afterEach(() => {
  teardownTmpStateDir(tmpDir);
  tmpDir = undefined;
});

describe('appendEntry', () => {
  it('creates log file with one line', () => {
    logStoreMod.appendEntry({ kind: 'block', url: 'http://x/' });
    const c = fs.readFileSync(LOG_FILE, 'utf8');
    assert.match(c, /"kind":"block"/);
    assert.equal(c.endsWith('\n'), true);
  });

  it('each entry includes ISO timestamp', () => {
    logStoreMod.appendEntry({ kind: 'block' });
    const obj = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8').trim());
    assert.match(obj.t, /^\d{4}-\d{2}-\d{2}T/);
  });

  it('appends multiple lines', () => {
    logStoreMod.appendEntry({ kind: 'block' });
    logStoreMod.appendEntry({ kind: 'allow-added' });
    const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n');
    assert.equal(lines.length, 2);
  });
});

describe('readRecent', () => {
  it('returns last N entries newest-first', () => {
    for (let i = 0; i < 5; i++) logStoreMod.appendEntry({ kind: 'block', i });
    const r = logStoreMod.readRecent(3);
    assert.equal(r.length, 3);
    assert.equal(r[0].i, 4);
    assert.equal(r[2].i, 2);
  });

  it('returns [] when no log file', () => {
    teardownTmpStateDir(tmpDir);
    tmpDir = setupTmpStateDir();
    logStoreMod = require('../../../src/lib/shield/log-store.cjs');
    ({ LOG_FILE } = require('../../../src/lib/shield/paths.cjs'));
    logStoreMod._resetWriteCounter && logStoreMod._resetWriteCounter();
    assert.deepEqual(logStoreMod.readRecent(10), []);
  });

  it('returns all when limit > total', () => {
    logStoreMod.appendEntry({ kind: 'block', i: 0 });
    assert.equal(logStoreMod.readRecent(100).length, 1);
  });
});

describe('countLines', () => {
  it('returns 0 when no file', () => {
    assert.equal(logStoreMod.countLines(), 0);
  });
  it('returns count after appends', () => {
    for (let i = 0; i < 7; i++) logStoreMod.appendEntry({ kind: 'block' });
    assert.equal(logStoreMod.countLines(), 7);
  });
});

describe('rotation', () => {
  it('truncates to threshold when exceeded', () => {
    logStoreMod._setRotateThreshold(50);
    logStoreMod._setRotateCheckEvery(1);
    for (let i = 0; i < 75; i++) logStoreMod.appendEntry({ kind: 'block', i });
    const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n');
    assert.ok(lines.length <= 50);
    const first = JSON.parse(lines[0]);
    assert.ok(first.i >= 25); // 前 25 条应该被裁掉
  });
});

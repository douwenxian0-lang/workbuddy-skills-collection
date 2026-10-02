const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { setupTmpStateDir, teardownTmpStateDir } = require('../../helpers/with-tmp-state-dir.cjs');

let tmpDir;
let pendingStoreMod;
let PENDING_DIR;
let pendingAllowFile;
let pendingOffFile;
let sign;

beforeEach(() => {
  tmpDir = setupTmpStateDir();
  // Re-require AFTER helper sets env + clears cache
  pendingStoreMod = require('../../../src/lib/shield/pending-store.cjs');
  ({ PENDING_DIR, pendingAllowFile, pendingOffFile } = require('../../../src/lib/shield/paths.cjs'));
  ({ sign } = require('../../../src/lib/shield/crypto.cjs'));
});

afterEach(() => {
  teardownTmpStateDir(tmpDir);
  tmpDir = undefined;
});

// 辅助：把 pending 文件的 step1_at 改到 N 秒之前
function rewindPending(file, secondsAgo) {
  const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
  obj.step1_at = Math.floor(Date.now() / 1000) - secondsAgo;
  const { _sig, ...payload } = obj;
  obj._sig = sign(payload);
  fs.writeFileSync(file, JSON.stringify(obj));
}

describe('createAllowPending / consumeAllowPending', () => {
  it('rejects without prior pending', () => {
    const r = pendingStoreMod.consumeAllowPending('192.168.1.10:8080');
    assert.equal(r.ok, false);
    assert.match(r.error, /必须先经过/);
  });

  it('rejects when consumed within MIN_WAIT_MS', () => {
    pendingStoreMod.createAllowPending('192.168.1.10:8080');
    const r = pendingStoreMod.consumeAllowPending('192.168.1.10:8080');
    assert.equal(r.ok, false);
    assert.match(r.error, /非法操作/);
  });

  it('accepts after MIN_WAIT_MS', () => {
    pendingStoreMod.createAllowPending('192.168.1.10:8080');
    rewindPending(pendingAllowFile('192.168.1.10:8080'), 5);
    const r = pendingStoreMod.consumeAllowPending('192.168.1.10:8080');
    assert.equal(r.ok, true);
    assert.equal(fs.existsSync(pendingAllowFile('192.168.1.10:8080')), false);
  });

  it('rejects when target mismatch (different file path)', () => {
    pendingStoreMod.createAllowPending('192.168.1.10:8080');
    const r = pendingStoreMod.consumeAllowPending('192.168.1.11:8080');
    assert.equal(r.ok, false);
    assert.match(r.error, /必须先经过/);
  });

  it('rejects when signature tampered', () => {
    pendingStoreMod.createAllowPending('a:1');
    const f = pendingAllowFile('a:1');
    const obj = JSON.parse(fs.readFileSync(f, 'utf8'));
    obj._sig = 'deadbeef';
    fs.writeFileSync(f, JSON.stringify(obj));
    const r = pendingStoreMod.consumeAllowPending('a:1');
    assert.equal(r.ok, false);
  });

  it('rejects when expired (> MAX_WAIT_MS)', () => {
    pendingStoreMod.createAllowPending('a:1');
    rewindPending(pendingAllowFile('a:1'), 31 * 60); // 31 分钟前
    const r = pendingStoreMod.consumeAllowPending('a:1');
    assert.equal(r.ok, false);
    assert.match(r.error, /超时/);
  });

  it('createAllowPending overwrites existing pending', async () => {
    pendingStoreMod.createAllowPending('a:1');
    const t1 = JSON.parse(fs.readFileSync(pendingAllowFile('a:1'), 'utf8')).step1_at;
    await new Promise((r) => setTimeout(r, 1100));
    pendingStoreMod.createAllowPending('a:1');
    const t2 = JSON.parse(fs.readFileSync(pendingAllowFile('a:1'), 'utf8')).step1_at;
    assert.ok(t2 > t1);
  });
});

describe('createOffPending / consumeOffPending', () => {
  it('rejects without pending', () => {
    const r = pendingStoreMod.consumeOffPending('20260513');
    assert.equal(r.ok, false);
    assert.match(r.error, /必须先经过/);
  });

  it('rejects when date mismatch', () => {
    pendingStoreMod.createOffPending();
    rewindPending(pendingOffFile(), 5);
    const r = pendingStoreMod.consumeOffPending('20990101');
    assert.equal(r.ok, false);
    assert.match(r.error, /日期/);
  });

  it('accepts when date matches today', () => {
    pendingStoreMod.createOffPending();
    rewindPending(pendingOffFile(), 5);
    const r = pendingStoreMod.consumeOffPending(pendingStoreMod.todayYYYYMMDD());
    assert.equal(r.ok, true);
    assert.equal(fs.existsSync(pendingOffFile()), false);
  });

  it('rejects within MIN_WAIT_MS even with correct date', () => {
    pendingStoreMod.createOffPending();
    const r = pendingStoreMod.consumeOffPending(pendingStoreMod.todayYYYYMMDD());
    assert.equal(r.ok, false);
    assert.match(r.error, /非法操作/);
  });
});

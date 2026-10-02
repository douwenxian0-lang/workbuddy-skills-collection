const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { withFileLock } = require('../../../src/lib/shield/file-lock.cjs');

const TMP = path.join(os.tmpdir(), `xb-shield-lock-${process.pid}`);
fs.mkdirSync(TMP, { recursive: true });

after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {} });

describe('withFileLock', () => {
  it('runs callback and returns its value', async () => {
    const target = path.join(TMP, 'a');
    const result = await withFileLock(target, async () => 42);
    assert.equal(result, 42);
  });

  it('removes .lock after success', async () => {
    const target = path.join(TMP, 'b');
    await withFileLock(target, async () => {});
    assert.equal(fs.existsSync(`${target}.lock`), false);
  });

  it('removes .lock after error', async () => {
    const target = path.join(TMP, 'c');
    await assert.rejects(
      withFileLock(target, async () => { throw new Error('boom'); }),
      /boom/
    );
    assert.equal(fs.existsSync(`${target}.lock`), false);
  });

  it('serializes concurrent callers', async () => {
    const target = path.join(TMP, 'd');
    const events = [];
    const make = (id) => withFileLock(target, async () => {
      events.push(`${id}-start`);
      await new Promise((r) => setTimeout(r, 20));
      events.push(`${id}-end`);
    });
    await Promise.all([make('A'), make('B')]);
    assert.equal(events.length, 4);
    // 第二个事件必定是某个 -end，证明两个 critical section 不重叠
    assert.equal(events[1].endsWith('-end'), true);
  });

  it('throws ELOCKTIMEOUT when stale lock blocks', async () => {
    const target = path.join(TMP, 'e');
    fs.writeFileSync(`${target}.lock`, '');
    await assert.rejects(
      withFileLock(target, async () => {}, { maxWaitMs: 30, pollIntervalMs: 5 }),
      /timeout/i
    );
    fs.unlinkSync(`${target}.lock`);
  });
});

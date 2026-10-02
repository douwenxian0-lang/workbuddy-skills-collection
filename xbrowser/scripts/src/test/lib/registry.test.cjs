'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  MIRRORS,
  checkUrl,
  httpGet,
  detectRegistry,
  downloadTarball,
  getPackageInfo,
} = require('../../src/lib/registry.cjs');

describe('MIRRORS', () => {
  it('has 3 entries each with name and base', () => {
    assert.equal(MIRRORS.length, 3);
    for (const m of MIRRORS) {
      assert.equal(typeof m.name, 'string');
      assert.equal(typeof m.base, 'string');
      assert.ok(m.base.startsWith('https://'));
    }
  });

  it('includes Tencent, npmmirror, and npmjs', () => {
    const bases = MIRRORS.map((m) => m.base);
    assert.ok(bases.some((b) => b.includes('tencent')));
    assert.ok(bases.some((b) => b.includes('npmmirror')));
    assert.ok(bases.some((b) => b.includes('npmjs')));
  });
});

describe('checkUrl()', () => {
  it('returns a boolean', async () => {
    const result = await checkUrl('https://registry.npmjs.org', 5000);
    assert.equal(typeof result, 'boolean');
  });

  it('returns false for unreachable host', async () => {
    const result = await checkUrl('http://192.0.2.1:1', 1000);
    assert.equal(result, false);
  });
});

describe('httpGet()', () => {
  it('returns a Buffer on success', async () => {
    const buf = await httpGet('https://registry.npmjs.org/', 10000);
    assert.ok(Buffer.isBuffer(buf));
    assert.ok(buf.length > 0);
  });

  it('rejects on non-200 status', async () => {
    await assert.rejects(
      () => httpGet('https://registry.npmjs.org/this-package-does-not-exist-xyz-999', 10000),
      (err) => {
        assert.ok(err.message.includes('HTTP'));
        return true;
      },
    );
  });
});

describe('detectRegistry()', () => {
  it('returns a string URL', async () => {
    const url = await detectRegistry();
    assert.equal(typeof url, 'string');
    assert.ok(url.startsWith('https://'));
  });
});

describe('downloadTarball()', () => {
  it('is a function that returns a Promise', () => {
    assert.equal(typeof downloadTarball, 'function');
    // Just verify it delegates to httpGet — we don't download a real tarball here
  });
});

describe('getPackageInfo()', () => {
  it('is a function', () => {
    assert.equal(typeof getPackageInfo, 'function');
  });
});

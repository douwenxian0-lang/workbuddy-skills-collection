const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  getMachineId, deriveKey, sign, verify, canonicalize,
} = require('../../../src/lib/shield/crypto.cjs');

describe('canonicalize', () => {
  it('sorts keys alphabetically', () => {
    assert.equal(canonicalize({ b: 2, a: 1 }), '{"a":1,"b":2}');
  });
  it('handles nested objects', () => {
    assert.equal(canonicalize({ x: { b: 2, a: 1 } }), '{"x":{"a":1,"b":2}}');
  });
  it('preserves array order', () => {
    assert.equal(canonicalize({ list: [2, 1] }), '{"list":[2,1]}');
  });
  it('strips _sig field', () => {
    assert.equal(canonicalize({ a: 1, _sig: 'xxx' }), '{"a":1}');
  });
});

describe('getMachineId', () => {
  it('returns non-empty string', () => {
    const id = getMachineId();
    assert.equal(typeof id, 'string');
    assert.ok(id.length > 0);
  });
  it('is stable across calls', () => {
    assert.equal(getMachineId(), getMachineId());
  });
});

describe('deriveKey', () => {
  it('returns 32-byte Buffer', () => {
    const key = deriveKey();
    assert.ok(Buffer.isBuffer(key));
    assert.equal(key.length, 32);
  });
  it('is deterministic', () => {
    assert.deepEqual(deriveKey(), deriveKey());
  });
});

describe('sign / verify', () => {
  it('sign produces hex string', () => {
    assert.match(sign({ a: 1 }), /^[0-9a-f]+$/);
  });
  it('verify accepts valid signature', () => {
    const payload = { enabled: true, allowlist: ['a:1'] };
    assert.equal(verify(payload, sign(payload)), true);
  });
  it('verify rejects tampered payload', () => {
    const payload = { enabled: true, allowlist: ['a:1'] };
    const sig = sign(payload);
    payload.allowlist.push('evil:80');
    assert.equal(verify(payload, sig), false);
  });
  it('verify rejects garbage signature', () => {
    assert.equal(verify({ a: 1 }, 'deadbeef'), false);
  });
  it('verify rejects undefined/null/empty', () => {
    assert.equal(verify({ a: 1 }, undefined), false);
    assert.equal(verify({ a: 1 }, null), false);
    assert.equal(verify({ a: 1 }, ''), false);
  });
});

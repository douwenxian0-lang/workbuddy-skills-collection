const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateAllowlistEntry } = require('../../../src/lib/shield/allowlist-format.cjs');

describe('validateAllowlistEntry - accept', () => {
  it('accepts host:port', () => {
    assert.equal(validateAllowlistEntry('192.168.1.10:8080').valid, true);
    assert.equal(validateAllowlistEntry('localhost:3000').valid, true);
    assert.equal(validateAllowlistEntry('[::1]:8080').valid, true);
    assert.equal(validateAllowlistEntry('10.0.0.5:443').valid, true);
  });
});

describe('validateAllowlistEntry - reject format', () => {
  it('rejects missing port', () => {
    const r = validateAllowlistEntry('192.168.1.10');
    assert.equal(r.valid, false);
    assert.match(r.reason, /端口/);
  });
  it('rejects bare localhost', () => {
    assert.equal(validateAllowlistEntry('localhost').valid, false);
  });
  it('rejects wildcards', () => {
    assert.equal(validateAllowlistEntry('*.local:80').valid, false);
    assert.equal(validateAllowlistEntry('*:80').valid, false);
  });
  it('rejects CIDR', () => {
    assert.equal(validateAllowlistEntry('192.168.0.0/16').valid, false);
  });
  it('rejects 0.0.0.0', () => {
    assert.equal(validateAllowlistEntry('0.0.0.0:80').valid, false);
  });
  it('rejects empty string', () => {
    assert.equal(validateAllowlistEntry('').valid, false);
  });
  it('rejects invalid port', () => {
    assert.equal(validateAllowlistEntry('localhost:abc').valid, false);
    assert.equal(validateAllowlistEntry('localhost:99999').valid, false);
    assert.equal(validateAllowlistEntry('localhost:0').valid, false);
  });
});

describe('validateAllowlistEntry - forbidden targets', () => {
  it('rejects cloud metadata IPs even with valid format', () => {
    const r = validateAllowlistEntry('169.254.169.254:80');
    assert.equal(r.valid, false);
    assert.match(r.reason, /云元数据|forbidden/);
    assert.equal(r.code, 'forbidden-allowlist-target');
  });
  it('rejects metadata hostnames', () => {
    assert.equal(validateAllowlistEntry('metadata.google.internal:80').valid, false);
  });
});

describe('validateAllowlistEntry - IPv4-mapped cloud metadata', () => {
  it('rejects hex IPv4-mapped metadata IP', () => {
    const r = validateAllowlistEntry('[::ffff:a9fe:a9fe]:80');
    assert.equal(r.valid, false);
    assert.equal(r.code, 'forbidden-allowlist-target');
  });
  it('rejects dotted IPv4-mapped metadata IP', () => {
    const r = validateAllowlistEntry('[::ffff:169.254.169.254]:80');
    assert.equal(r.valid, false);
    assert.equal(r.code, 'forbidden-allowlist-target');
  });
});

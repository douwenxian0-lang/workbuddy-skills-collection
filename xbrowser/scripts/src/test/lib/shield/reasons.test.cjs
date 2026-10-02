const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  ShieldReason,
  ShieldLogKind,
  isOpenErrorReason,
  logKindForReason,
} = require('../../../src/lib/shield/reasons.cjs');

describe('shield reason classification', () => {
  it('classifies URL/DNS failures as open-error and security denials as block', () => {
    assert.equal(isOpenErrorReason(ShieldReason.INVALID_FORMAT), true);
    assert.equal(isOpenErrorReason(ShieldReason.DNS_RESOLVE_FAILED), true);
    assert.equal(isOpenErrorReason(ShieldReason.PRIVATE_NETWORK), false);
    assert.equal(isOpenErrorReason(ShieldReason.CLOUD_METADATA), false);
    assert.equal(isOpenErrorReason(ShieldReason.DANGEROUS_PROTOCOL), false);

    assert.equal(logKindForReason(ShieldReason.INVALID_FORMAT), ShieldLogKind.OPEN_ERROR);
    assert.equal(logKindForReason(ShieldReason.DNS_RESOLVE_FAILED), ShieldLogKind.OPEN_ERROR);
    assert.equal(logKindForReason(ShieldReason.PRIVATE_NETWORK), ShieldLogKind.BLOCK);
  });
});

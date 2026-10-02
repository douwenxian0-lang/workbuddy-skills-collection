'use strict';

const ShieldReason = Object.freeze({
  INVALID_FORMAT: 'invalid-format',
  DNS_RESOLVE_FAILED: 'dns-resolve-failed',
  PRIVATE_NETWORK: 'private-network',
  PRIVATE_NETWORK_VIA_DNS: 'private-network-via-dns',
  CLOUD_METADATA: 'cloud-metadata',
  CLOUD_METADATA_VIA_DNS: 'cloud-metadata-via-dns',
  DANGEROUS_PROTOCOL: 'dangerous-protocol',
});

const ShieldLogKind = Object.freeze({
  BLOCK: 'block',
  OPEN_ERROR: 'open-error',
  SHIELD_INITIALIZED: 'shield-initialized',
  SHIELD_ON: 'shield-on',
  SHIELD_OFF: 'shield-off',
  ALLOW_ADDED: 'allow-added',
  ALLOW_REMOVED: 'allow-removed',
  CONFIG_CORRUPTED: 'config-corrupted',
});

function isOpenErrorReason(reason) {
  return reason === ShieldReason.INVALID_FORMAT ||
    reason === ShieldReason.DNS_RESOLVE_FAILED;
}

function logKindForReason(reason) {
  return isOpenErrorReason(reason) ? ShieldLogKind.OPEN_ERROR : ShieldLogKind.BLOCK;
}

module.exports = {
  ShieldReason,
  ShieldLogKind,
  isOpenErrorReason,
  logKindForReason,
};

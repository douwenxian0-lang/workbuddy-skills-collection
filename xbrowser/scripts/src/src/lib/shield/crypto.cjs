'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const { execSync } = require('node:child_process');

const HMAC_CONTEXT = 'xbrowser-shield-hmac-v1';

let cachedMachineId = null;
let cachedKey = null;

function getMachineId() {
  if (cachedMachineId !== null) return cachedMachineId;
  cachedMachineId = readMachineIdFromPlatform() || fallbackMachineId();
  return cachedMachineId;
}

function readMachineIdFromPlatform() {
  try {
    if (process.platform === 'darwin') {
      const out = execSync('ioreg -d2 -c IOPlatformExpertDevice', { encoding: 'utf8', timeout: 1000 });
      const m = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
      if (m) return m[1];
    } else if (process.platform === 'linux') {
      for (const p of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
        if (fs.existsSync(p)) {
          const v = fs.readFileSync(p, 'utf8').trim();
          if (v) return v;
        }
      }
    } else if (process.platform === 'win32') {
      const out = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', { encoding: 'utf8', timeout: 1000 });
      const m = out.match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/);
      if (m) return m[1];
    }
  } catch {
    // Intentional: platform command unavailable / blocked / errored.
    // Returning null causes getMachineId() to use fallbackMachineId().
  }
  return null;
}

function fallbackMachineId() {
  const material = [os.hostname(), os.userInfo().username, os.homedir()].join('|');
  return crypto.createHash('sha256').update(material).digest('hex');
}

function deriveKey() {
  if (cachedKey !== null) return cachedKey;
  // HKDF-style derivation: machine-id is the secret (HMAC key), context is the info string
  cachedKey = crypto.createHmac('sha256', getMachineId()).update(HMAC_CONTEXT).digest();
  return cachedKey;
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) {
      if (k === '_sig') continue;
      out[k] = sortKeys(value[k]);
    }
    return out;
  }
  return value;
}

function canonicalize(obj) {
  return JSON.stringify(sortKeys(obj));
}

function sign(payload) {
  return crypto.createHmac('sha256', deriveKey()).update(canonicalize(payload)).digest('hex');
}

function verify(payload, sig) {
  if (typeof sig !== 'string' || sig.length === 0) return false;
  const expected = sign(payload);
  if (expected.length !== sig.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
  } catch {
    return false;
  }
}

function _resetCache() { cachedMachineId = null; cachedKey = null; }

module.exports = { getMachineId, deriveKey, sign, verify, canonicalize, _resetCache };

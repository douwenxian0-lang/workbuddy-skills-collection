'use strict';

const fs = require('node:fs');
const { SHIELD_DIR, CONFIG_FILE } = require('./paths.cjs');
const { sign, verify } = require('./crypto.cjs');
const { appendEntry } = require('./log-store.cjs');
const { ShieldLogKind } = require('./reasons.cjs');

const DEFAULT_CONFIG = Object.freeze({ version: 1, enabled: true, allowlist: [] });

function ensureDir() {
  fs.mkdirSync(SHIELD_DIR, { recursive: true });
}

function readConfig() {
  let raw;
  try { raw = fs.readFileSync(CONFIG_FILE, 'utf8'); } catch {
    return { ...DEFAULT_CONFIG };
  }
  let obj;
  try { obj = JSON.parse(raw); } catch {
    return resetCorrupted('parse-error');
  }
  const { _sig, ...payload } = obj;
  if (!verify(payload, _sig)) {
    return resetCorrupted('signature-invalid');
  }
  return { ...DEFAULT_CONFIG, ...payload };
}

function resetCorrupted(reason) {
  try {
    appendEntry({ kind: ShieldLogKind.CONFIG_CORRUPTED, reason, action: 'reset-to-safe' });
  } catch {}
  const cfg = writeDefaultConfigWithInitLog({
    reason: 'corrupted-reset',
    source: 'config-store',
    corrupted_reason: reason,
  });
  return { ...cfg, _corrupted: true };
}

function writeConfig(cfg) {
  ensureDir();
  const clean = {
    version: DEFAULT_CONFIG.version,
    enabled: !!cfg.enabled,
    allowlist: [...(cfg.allowlist || [])],
  };
  const _sig = sign(clean);
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...clean, _sig }, null, 2));
}

function writeDefaultConfigWithInitLog(context = {}) {
  const cfg = { ...DEFAULT_CONFIG };
  writeConfig(cfg);
  try {
    appendEntry({
      kind: ShieldLogKind.SHIELD_INITIALIZED,
      reason: context.reason || 'new',
      source: context.source || 'unknown',
      config_version: cfg.version,
      enabled: cfg.enabled,
      ...(context.from_version ? { from_version: context.from_version } : {}),
      ...(context.to_version ? { to_version: context.to_version } : {}),
      ...(context.corrupted_reason ? { corrupted_reason: context.corrupted_reason } : {}),
    });
  } catch (e) {
    fs.rmSync(CONFIG_FILE, { force: true });
    throw e;
  }
  return readConfig();
}

function ensureDefaultConfigInitialized(context = {}) {
  if (fs.existsSync(CONFIG_FILE)) {
    const config = readConfig();
    if (config._corrupted) {
      return { config, initialized: false, resetCorrupted: true, status: 'reset-corrupted' };
    }
    return { config, initialized: false, resetCorrupted: false, status: 'preserved' };
  }
  return {
    config: writeDefaultConfigWithInitLog(context),
    initialized: true,
    resetCorrupted: false,
    status: 'initialized',
  };
}

function isEnabled() { return readConfig().enabled; }

function setEnabled(flag) {
  const cfg = readConfig();
  cfg.enabled = !!flag;
  writeConfig(cfg);
}

function getAllowlist() { return readConfig().allowlist; }

function addToAllowlist(entry) {
  const cfg = readConfig();
  if (!cfg.allowlist.includes(entry)) cfg.allowlist.push(entry);
  writeConfig(cfg);
}

function removeFromAllowlist(entry) {
  const cfg = readConfig();
  cfg.allowlist = cfg.allowlist.filter((e) => e !== entry);
  writeConfig(cfg);
}

module.exports = {
  readConfig, writeConfig, writeDefaultConfigWithInitLog, ensureDefaultConfigInitialized,
  isEnabled, setEnabled, getAllowlist, addToAllowlist, removeFromAllowlist,
};

'use strict';

const fs = require('fs');
const path = require('path');
const { CONFIG_PATH, BROWSER_IDS, LOCAL_BROWSER_IDS, ensureDir } = require('./paths.cjs');

const VALID_BROWSERS = new Set(BROWSER_IDS);

function getConfigPath() {
  return process.env.__XB_TEST_CONFIG_PATH || CONFIG_PATH;
}

function readConfig() {
  const p = getConfigPath();
  if (!fs.existsSync(p)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (raw.mode !== undefined) {
      const v2 = migrateV1Config(raw);
      ensureDir(path.dirname(p));
      fs.writeFileSync(p, JSON.stringify(v2, null, 2));
      return v2;
    }
    return raw;
  } catch {
    return null;
  }
}

function writeDefaultConfig() {
  const now = new Date().toISOString();
  const config = {
    browser: 'cft',
    headed: true,
    profiles: {
      ...Object.fromEntries(LOCAL_BROWSER_IDS.map((id) => [id, { migrated: false }])),
      cft: { exists: true },
    },
    created_at: now,
    updated_at: now,
  };
  const p = getConfigPath();
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(config, null, 2));
  return config;
}

function updateConfig(updates) {
  const cfg = readConfig();
  if (!cfg) throw new Error('Config not initialized');

  if (updates.browser !== undefined) {
    if (!VALID_BROWSERS.has(updates.browser)) {
      throw new Error(`Invalid browser: ${updates.browser}. Valid: ${BROWSER_IDS.join(', ')}`);
    }
    cfg.browser = updates.browser;
  }
  if (updates.headed !== undefined) {
    cfg.headed = updates.headed === true || updates.headed === 'true';
  }

  cfg.updated_at = new Date().toISOString();
  fs.writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2));
  return cfg;
}

function isComplete(cfg) {
  return cfg != null && cfg.browser != null;
}

function migrateV1Config(v1) {
  let browser = 'cft';
  if (v1.mode === 'local-reuse' && v1.browser && v1.browser !== 'chrome-for-testing') {
    browser = v1.browser;
  }

  const profiles = {
    ...Object.fromEntries(LOCAL_BROWSER_IDS.map((id) => [id, { migrated: false }])),
    cft: { exists: true },
  };

  if (v1.profile_migrated && v1.profile_source) {
    const src = v1.profile_source === 'chrome-for-testing' ? 'cft' : v1.profile_source;
    if (profiles[src]) profiles[src].migrated = true;
  }

  const now = new Date().toISOString();
  return {
    browser,
    headed: v1.headed || false,
    profiles,
    created_at: v1.created_at || now,
    updated_at: now,
  };
}

module.exports = { readConfig, writeDefaultConfig, updateConfig, isComplete, migrateV1Config };

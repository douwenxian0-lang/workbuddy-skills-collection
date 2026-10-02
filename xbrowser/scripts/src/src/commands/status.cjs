'use strict';

const { ok } = require('../lib/result.cjs');
const { checkCli, checkBrowsers, checkProfile } = require('../lib/preflight.cjs');
const { readConfig, isComplete } = require('../lib/config-store.cjs');
const { BROWSER_IDS, LOCAL_BROWSER_IDS } = require('../lib/paths.cjs');

function statusCommand() {
  // 1. CLI info
  const cli = checkCli();

  // 2. Browsers info
  const { cft, local } = checkBrowsers();
  const localByName = {};
  for (const b of local) {
    localByName[b.name] = b;
  }
  const browsers = { cft: { installed: cft.installed } };
  for (const id of LOCAL_BROWSER_IDS) {
    const b = localByName[id];
    browsers[id] = b
      ? { installed: b.installed, version: b.version }
      : { installed: false, version: '' };
  }

  // 3. Config info
  const cfg = readConfig();
  const config = {
    exists: cfg != null,
    complete: isComplete(cfg),
    values: cfg || null,
  };

  // 4. Profiles info
  const profiles = {};
  for (const id of BROWSER_IDS) {
    const p = checkProfile(id);
    profiles[id] = { path: p.path, exists: p.exists };
  }

  return ok('status', { cli, browsers, config, profiles });
}

module.exports = { statusCommand };

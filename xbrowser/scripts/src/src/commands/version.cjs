'use strict';

const os = require('os');
const { execFileSync } = require('child_process');
const { ok } = require('../lib/result.cjs');
const { AGENT_BROWSER_BIN, CLI_VERSION } = require('../lib/paths.cjs');

function versionCommand() {
  let engine = '';
  try {
    engine = execFileSync(AGENT_BROWSER_BIN, ['--version'], {
      encoding: 'utf8', timeout: 10000,
    }).trim();
  } catch (_) {}

  return ok('version', {
    xb: CLI_VERSION,
    engine,
    node: process.version,
    platform: os.platform(),
    arch: os.arch(),
  });
}

module.exports = { versionCommand };

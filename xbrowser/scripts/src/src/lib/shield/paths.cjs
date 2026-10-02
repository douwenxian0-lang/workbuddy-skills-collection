'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
const { XBROWSER_DIR } = require('../paths.cjs');

const SHIELD_DIR = path.join(XBROWSER_DIR, 'shield');
const CONFIG_FILE = path.join(SHIELD_DIR, 'config.json');
const PENDING_DIR = path.join(SHIELD_DIR, 'pending');
const LOGS_DIR = path.join(SHIELD_DIR, 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'protection.jsonl');

function pendingAllowFile(target) {
  const hash = crypto.createHash('sha256').update(target).digest('hex').slice(0, 16);
  return path.join(PENDING_DIR, `s-wl-${hash}.shield`);
}

function pendingOffFile() {
  return path.join(PENDING_DIR, 'pending.shield');
}

module.exports = {
  SHIELD_DIR, CONFIG_FILE, PENDING_DIR, LOGS_DIR, LOG_FILE,
  pendingAllowFile, pendingOffFile,
};

'use strict';

const fs = require('node:fs');
const { LOG_FILE, LOGS_DIR } = require('./paths.cjs');

let ROTATE_THRESHOLD = 3000;
let ROTATE_CHECK_EVERY = 100;
let writeCounter = 0;

function _setRotateThreshold(n) { ROTATE_THRESHOLD = n; }
function _setRotateCheckEvery(n) { ROTATE_CHECK_EVERY = n; }
function _resetWriteCounter() { writeCounter = 0; }

function ensureDir() {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function withLogLock(fn) {
  const lockPath = `${LOG_FILE}.lock`;
  const deadline = Date.now() + 100;
  while (true) {
    try {
      const fd = fs.openSync(
        lockPath,
        fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY,
        0o600,
      );
      fs.closeSync(fd);
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      if (Date.now() >= deadline) {
        const err = new Error(`log-lock timeout: ${lockPath}`);
        err.code = 'ELOCKTIMEOUT';
        throw err;
      }
      const until = Date.now() + 5;
      while (Date.now() < until) { /* spin briefly */ }
    }
  }
  try { return fn(); } finally {
    try { fs.unlinkSync(lockPath); } catch {}
  }
}

function appendEntry(entry) {
  ensureDir();
  const enriched = { t: new Date().toISOString(), ...entry };
  const line = JSON.stringify(enriched) + '\n';
  withLogLock(() => {
    fs.appendFileSync(LOG_FILE, line);
    writeCounter++;
    if (writeCounter % ROTATE_CHECK_EVERY === 0) rotateIfNeeded();
  });
}

function rotateIfNeeded() {
  let content;
  try { content = fs.readFileSync(LOG_FILE, 'utf8'); } catch { return; }
  const lines = content.split('\n').filter(Boolean);
  if (lines.length <= ROTATE_THRESHOLD) return;
  const keep = lines.slice(-ROTATE_THRESHOLD);
  fs.writeFileSync(LOG_FILE, keep.join('\n') + '\n');
}

function readRecent(limit = 20) {
  let content;
  try { content = fs.readFileSync(LOG_FILE, 'utf8'); } catch { return []; }
  const lines = content.split('\n').filter(Boolean);
  return lines.slice(-limit).reverse().map((l) => {
    try { return JSON.parse(l); } catch { return { raw: l, parseError: true }; }
  });
}

function countLines() {
  try {
    return fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean).length;
  } catch { return 0; }
}

module.exports = {
  appendEntry, readRecent, countLines,
  _setRotateThreshold, _setRotateCheckEvery, _resetWriteCounter,
};

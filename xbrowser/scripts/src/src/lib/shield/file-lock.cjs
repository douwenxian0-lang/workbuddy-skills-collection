'use strict';

const fs = require('node:fs');

const DEFAULT_MAX_WAIT_MS = 100;
const DEFAULT_POLL_MS = 10;

async function withFileLock(target, callback, opts = {}) {
  const lockPath = `${target}.lock`;
  const maxWait = opts.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const poll = opts.pollIntervalMs ?? DEFAULT_POLL_MS;
  const deadline = Date.now() + maxWait;

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
        const err = new Error(`file-lock timeout: ${lockPath}`);
        err.code = 'ELOCKTIMEOUT';
        throw err;
      }
      await new Promise((r) => setTimeout(r, poll));
    }
  }

  try {
    return await callback();
  } finally {
    try { fs.unlinkSync(lockPath); } catch {}
  }
}

module.exports = { withFileLock };

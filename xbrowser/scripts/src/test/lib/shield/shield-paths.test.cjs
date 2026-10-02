'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');

const { setupTmpStateDir, teardownTmpStateDir } = require('../../helpers/with-tmp-state-dir.cjs');

let tmpDir;

beforeEach(() => {
  tmpDir = setupTmpStateDir();
});

afterEach(() => {
  teardownTmpStateDir(tmpDir);
  tmpDir = undefined;
});

describe('SHIELD_DIR derives from XBROWSER_DIR', () => {
  it('SHIELD_DIR is under XBROWSER_DIR', () => {
    const { SHIELD_DIR } = require('../../../src/lib/shield/paths.cjs');
    const { XBROWSER_DIR } = require('../../../src/lib/paths.cjs');
    assert.ok(SHIELD_DIR.startsWith(XBROWSER_DIR));
    assert.equal(SHIELD_DIR, path.join(XBROWSER_DIR, 'shield'));
  });

  it('OPENCLAW_STATE_DIR change cascades to SHIELD_DIR', () => {
    const { SHIELD_DIR } = require('../../../src/lib/shield/paths.cjs');
    assert.ok(SHIELD_DIR.startsWith(tmpDir), `expected SHIELD_DIR=${SHIELD_DIR} to start with tmpDir=${tmpDir}`);
    assert.equal(SHIELD_DIR, path.join(tmpDir, 'tools', 'xbrowser', 'shield'));
  });

  it('CONFIG_FILE / PENDING_DIR / LOGS_DIR / LOG_FILE all derive from SHIELD_DIR', () => {
    const { SHIELD_DIR, CONFIG_FILE, PENDING_DIR, LOGS_DIR, LOG_FILE } = require('../../../src/lib/shield/paths.cjs');
    assert.equal(CONFIG_FILE, path.join(SHIELD_DIR, 'config.json'));
    assert.equal(PENDING_DIR, path.join(SHIELD_DIR, 'pending'));
    assert.equal(LOGS_DIR, path.join(SHIELD_DIR, 'logs'));
    assert.equal(LOG_FILE, path.join(LOGS_DIR, 'protection.jsonl'));
  });
});

describe('pendingAllowFile', () => {
  it('returns s-wl-<16hex>.shield format', () => {
    const { pendingAllowFile, PENDING_DIR } = require('../../../src/lib/shield/paths.cjs');
    const p = pendingAllowFile('192.168.1.10:8080');
    const base = path.basename(p);
    assert.match(base, /^s-wl-[0-9a-f]{16}\.shield$/);
    assert.ok(p.startsWith(PENDING_DIR));
  });

  it('different inputs produce different files', () => {
    const { pendingAllowFile } = require('../../../src/lib/shield/paths.cjs');
    assert.notEqual(pendingAllowFile('a:1'), pendingAllowFile('b:1'));
  });

  it('uses sha256(target).slice(0,16)', () => {
    const { pendingAllowFile } = require('../../../src/lib/shield/paths.cjs');
    const expected = crypto.createHash('sha256').update('192.168.1.10:8080').digest('hex').slice(0, 16);
    assert.ok(pendingAllowFile('192.168.1.10:8080').includes(expected));
  });
});

describe('pendingOffFile', () => {
  it('is pending.shield (single global)', () => {
    const { pendingOffFile, PENDING_DIR } = require('../../../src/lib/shield/paths.cjs');
    assert.equal(path.basename(pendingOffFile()), 'pending.shield');
    assert.ok(pendingOffFile().startsWith(PENDING_DIR));
  });
});

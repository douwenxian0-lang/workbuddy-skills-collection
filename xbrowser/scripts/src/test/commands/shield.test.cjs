const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { setupTmpStateDir, teardownTmpStateDir } = require('../helpers/with-tmp-state-dir.cjs');

let tmpDir;
let shieldCommandMod;
let configStoreMod;
let logStoreMod;
let pendingStoreMod;
let shieldPathsMod;
let sign;

beforeEach(() => {
  tmpDir = setupTmpStateDir();
  delete require.cache[require.resolve('../../src/commands/shield.cjs')];
  shieldCommandMod = require('../../src/commands/shield.cjs');
  configStoreMod = require('../../src/lib/shield/config-store.cjs');
  logStoreMod = require('../../src/lib/shield/log-store.cjs');
  pendingStoreMod = require('../../src/lib/shield/pending-store.cjs');
  shieldPathsMod = require('../../src/lib/shield/paths.cjs');
  ({ sign } = require('../../src/lib/shield/crypto.cjs'));
});

afterEach(() => {
  teardownTmpStateDir(tmpDir);
  tmpDir = undefined;
});

function rewindPending(file, secondsAgo) {
  const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
  obj.step1_at = Math.floor(Date.now() / 1000) - secondsAgo;
  const { _sig, ...payload } = obj;
  obj._sig = sign(payload);
  fs.writeFileSync(file, JSON.stringify(obj));
}

describe('shield status', () => {
  it('returns enabled=true defaults', () => {
    const r = shieldCommandMod.shieldCommand(['status']);
    assert.equal(r.ok, true);
    assert.equal(r.data.enabled, true);
    assert.equal(r.data.allowlist_count, 0);
    assert.equal(typeof r.data.blocks_24h, 'number');
  });

  it('counts only block logs in blocks_24h', () => {
    logStoreMod.appendEntry({ kind: 'open-error', reason: 'invalid-format', url: 'not-a-url' });
    logStoreMod.appendEntry({ kind: 'block', reason: 'private-network', url: 'http://127.0.0.1:65530/' });
    const r = shieldCommandMod.shieldCommand(['status']);
    assert.equal(r.ok, true);
    assert.equal(r.data.blocks_24h, 1);
  });
});

describe('shield list', () => {
  it('returns empty entries by default', () => {
    const r = shieldCommandMod.shieldCommand(['list']);
    assert.equal(r.ok, true);
    assert.deepEqual(r.data.entries, []);
  });
});

describe('shield logs', () => {
  it('returns empty entries by default', () => {
    const r = shieldCommandMod.shieldCommand(['logs']);
    assert.equal(r.ok, true);
    assert.equal(r.data.limit, 20);
    assert.deepEqual(r.data.entries, []);
  });
  it('respects --limit', () => {
    const r = shieldCommandMod.shieldCommand(['logs', '--limit', '5']);
    assert.equal(r.data.limit, 5);
  });
});

describe('shield enable', () => {
  it('enables protection (idempotent)', () => {
    const r = shieldCommandMod.shieldCommand(['enable']);
    assert.equal(r.ok, true);
    assert.equal(shieldCommandMod.shieldCommand(['status']).data.enabled, true);
  });
});

describe('shield remove', () => {
  it('removes entry from allowlist', () => {
    configStoreMod.addToAllowlist('192.168.1.10:8080');
    const r = shieldCommandMod.shieldCommand(['remove', '192.168.1.10:8080']);
    assert.equal(r.ok, true);
    assert.deepEqual(shieldCommandMod.shieldCommand(['list']).data.entries, []);
  });
  it('errors when target missing', () => {
    const r = shieldCommandMod.shieldCommand(['remove']);
    assert.equal(r.ok, false);
  });
});

describe('shield allow (confirm path)', () => {
  it('rejects without prior pending', () => {
    const r = shieldCommandMod.shieldCommand(['allow', '192.168.1.10:8080']);
    assert.equal(r.ok, false);
    assert.match(r.error, /必须先经过/);
  });

  it('rejects too-fast confirm', () => {
    pendingStoreMod.createAllowPending('192.168.1.10:8080');
    const r = shieldCommandMod.shieldCommand(['allow', '192.168.1.10:8080']);
    assert.equal(r.ok, false);
    assert.match(r.error, /非法操作/);
  });

  it('accepts confirm after MIN_WAIT_MS', () => {
    pendingStoreMod.createAllowPending('192.168.1.10:8080');
    rewindPending(shieldPathsMod.pendingAllowFile('192.168.1.10:8080'), 5);
    const r = shieldCommandMod.shieldCommand(['allow', '192.168.1.10:8080']);
    assert.equal(r.ok, true);
    assert.deepEqual(shieldCommandMod.shieldCommand(['list']).data.entries, ['192.168.1.10:8080']);
  });

  it('rejects malformed allowlist target even with valid pending', () => {
    pendingStoreMod.createAllowPending('localhost');
    rewindPending(shieldPathsMod.pendingAllowFile('localhost'), 5);
    const r = shieldCommandMod.shieldCommand(['allow', 'localhost']);
    assert.equal(r.ok, false);
    assert.match(r.error, /端口|格式/);
  });

  it('rejects forbidden allowlist target', () => {
    pendingStoreMod.createAllowPending('169.254.169.254:80');
    rewindPending(shieldPathsMod.pendingAllowFile('169.254.169.254:80'), 5);
    const r = shieldCommandMod.shieldCommand(['allow', '169.254.169.254:80']);
    assert.equal(r.ok, false);
    assert.match(r.error, /硬黑名单|forbidden/);
  });
});

describe('shield disable (confirm path)', () => {
  it('rejects without prior pending', () => {
    const r = shieldCommandMod.shieldCommand(['disable', '20990101']);
    assert.equal(r.ok, false);
    assert.match(r.error, /必须先经过/);
  });

  it('rejects when date wrong', () => {
    pendingStoreMod.createOffPending();
    rewindPending(shieldPathsMod.pendingOffFile(), 5);
    const r = shieldCommandMod.shieldCommand(['disable', '20990101']);
    assert.equal(r.ok, false);
    assert.match(r.error, /日期/);
  });

  it('accepts when date matches today', () => {
    pendingStoreMod.createOffPending();
    rewindPending(shieldPathsMod.pendingOffFile(), 5);
    const d = new Date();
    const today = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const r = shieldCommandMod.shieldCommand(['disable', today]);
    assert.equal(r.ok, true);
    assert.equal(shieldCommandMod.shieldCommand(['status']).data.enabled, false);
  });
});

describe('shield no subcommand (hidden command secrecy)', () => {
  it('error response does NOT leak allow/disable', () => {
    const r = shieldCommandMod.shieldCommand([]);
    assert.equal(r.ok, false);
    assert.ok(Array.isArray(r.data.subcommands));
    assert.ok(!r.data.subcommands.includes('allow'));
    assert.ok(!r.data.subcommands.includes('disable'));
  });
});

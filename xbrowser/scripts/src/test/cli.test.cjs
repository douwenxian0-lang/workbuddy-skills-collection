'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const path = require('path');

const cwd = path.resolve(__dirname, '..');

function run(args = '') {
  const cmd = `node src/cli.cjs ${args}`;
  try {
    const out = execSync(cmd, { cwd, encoding: 'utf8', timeout: 15000 });
    return JSON.parse(out);
  } catch (e) {
    // Process may exit with non-zero but still produce valid JSON on stdout
    if (e.stdout) return JSON.parse(e.stdout);
    throw e;
  }
}

describe('cli.cjs', () => {
  it('no args → help output', () => {
    const r = run();
    assert.equal(r.ok, true);
    assert.equal(r.command, 'help');
    assert.ok(Array.isArray(r.data.commands));
  });

  it('help → valid JSON with ok=true', () => {
    const r = run('help');
    assert.equal(r.ok, true);
    assert.equal(r.command, 'help');
    assert.ok(r.data.description);
  });

  it('version → valid JSON with xb version', () => {
    const r = run('version');
    assert.equal(r.ok, true);
    assert.equal(r.command, 'version');
    assert.equal(r.data.xb, '1.2.0');
    assert.equal(r.data.node, process.version);
  });

  it('unknown command → ok=false with available_commands', () => {
    const r = run('unknowncmd');
    assert.equal(r.ok, false);
    assert.equal(r.command, 'unknown');
    assert.match(r.error, /未知的命令 "unknowncmd"/);
    assert.ok(r.hint);
    assert.ok(Array.isArray(r.data.available_commands));
    assert.ok(r.data.available_commands.includes('help'));
    assert.ok(r.data.available_commands.includes('run'));
  });
});

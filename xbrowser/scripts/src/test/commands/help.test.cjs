const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { helpCommand } = require('../../src/commands/help.cjs');
const { versionCommand } = require('../../src/commands/version.cjs');

describe('helpCommand()', () => {
  it('returns global help when no args', () => {
    const r = helpCommand([]);
    assert.equal(r.ok, true);
    assert.equal(r.command, 'help');
    assert.ok(Array.isArray(r.data.commands));
    assert.ok(r.data.commands.length > 0);
    assert.equal(r.data.description, 'xbrowser 浏览器自动化工具');
    assert.ok(Array.isArray(r.data.quick_start));
  });

  it('returns run help with browser_actions', () => {
    const r = helpCommand(['run']);
    assert.equal(r.ok, true);
    assert.equal(r.command, 'help');
    assert.equal(r.data.name, 'run');
    assert.ok(Array.isArray(r.data.browser_actions));
    assert.ok(r.data.browser_actions.length > 0);
    assert.ok(Array.isArray(r.data.env_options));
    assert.ok(Array.isArray(r.data.examples));
  });

  it('returns config help with subcommands', () => {
    const r = helpCommand(['config']);
    assert.equal(r.ok, true);
    assert.equal(r.command, 'help');
    assert.equal(r.data.name, 'config');
    assert.ok(Array.isArray(r.data.subcommands));
    assert.ok(r.data.subcommands.length > 0);
    assert.ok(Array.isArray(r.data.config_keys));
    // reset subcommand exists (not init/guide)
    const names = r.data.subcommands.map(s => s.name);
    assert.ok(names.some(n => n.includes('reset')), 'should have reset subcommand');
    assert.ok(!names.some(n => n === 'init'), 'should not have init subcommand');
    assert.ok(!names.some(n => n.startsWith('guide')), 'should not have guide subcommand');
  });

  it('returns guide help with subcommands', () => {
    const r = helpCommand(['guide']);
    assert.equal(r.ok, true);
    assert.equal(r.command, 'help');
    assert.equal(r.data.name, 'guide');
    assert.ok(Array.isArray(r.data.subcommands));
    assert.ok(r.data.subcommands.length > 0);
    const names = r.data.subcommands.map(s => s.name);
    assert.ok(names.some(n => n.includes('config')), 'should have config subcommand');
    assert.ok(names.some(n => n.includes('close-browser')), 'should have close-browser subcommand');
    assert.ok(names.some(n => n.includes('incomplete-config')), 'should have incomplete-config subcommand');
    assert.ok(names.some(n => n.includes('shield-allow')), 'should have shield-allow guide subcommand');
    assert.ok(names.some(n => n.includes('shield-off')), 'should have shield-off guide subcommand');
  });

  it('returns simple help for known simple commands', () => {
    for (const cmd of ['init', 'status', 'setup', 'stop', 'cleanup', 'version']) {
      const r = helpCommand([cmd]);
      assert.equal(r.ok, true, `${cmd} should return ok`);
      assert.equal(r.data.name, cmd);
      assert.ok(r.data.description);
      assert.ok(r.data.usage);
    }
  });

  it('returns shield help with public subcommands only', () => {
    const r = helpCommand(['shield']);
    assert.equal(r.ok, true);
    assert.equal(r.command, 'help');
    assert.equal(r.data.name, 'shield');
    assert.ok(Array.isArray(r.data.subcommands));
    const names = r.data.subcommands.map(s => s.name);
    assert.ok(names.includes('status'));
    assert.ok(names.includes('list'));
    assert.ok(names.some(n => n.startsWith('logs')));
    assert.ok(names.includes('enable'));
    assert.ok(names.some(n => n.startsWith('remove')));
    assert.ok(!names.some(n => n.startsWith('allow')), 'hidden allow confirm command must not be public');
    assert.ok(!names.some(n => n.startsWith('disable')), 'hidden disable confirm command must not be public');
    assert.ok(Array.isArray(r.data.related));
    assert.ok(r.data.related.some(x => x.name.includes('shield-allow')));
    assert.ok(r.data.related.some(x => x.name.includes('shield-off')));
  });

  it('stop help shows --force flag', () => {
    const r = helpCommand(['stop']);
    assert.equal(r.ok, true);
    assert.match(r.data.usage, /\[--force\]/);
  });

  it('global help includes guide command', () => {
    const r = helpCommand([]);
    assert.equal(r.ok, true);
    const guide = r.data.commands.find(c => c.name === 'guide');
    assert.ok(guide, 'global help should include guide command');
    assert.ok(guide.usage.includes('shield-allow'), 'guide usage should include shield-allow');
    assert.ok(guide.usage.includes('shield-off'), 'guide usage should include shield-off');
  });

  it('returns fail for unknown command', () => {
    const r = helpCommand(['unknown']);
    assert.equal(r.ok, false);
    assert.equal(r.command, 'help');
    assert.match(r.error, /未知的命令 "unknown"/);
    assert.ok(r.hint);
  });

  it('returns global help when args is undefined', () => {
    const r = helpCommand();
    assert.equal(r.ok, true);
    assert.ok(Array.isArray(r.data.commands));
  });
});

describe('versionCommand()', () => {
  it('returns ok with version fields', () => {
    const r = versionCommand();
    assert.equal(r.ok, true);
    assert.equal(r.command, 'version');
    assert.equal(r.data.xb, '1.2.0');
    assert.equal(r.data.node, process.version);
    assert.equal(typeof r.data.platform, 'string');
    assert.equal(typeof r.data.arch, 'string');
    assert.equal(typeof r.data.engine, 'string');
  });
});

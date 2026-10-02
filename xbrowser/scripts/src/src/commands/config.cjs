'use strict';

const { ok, fail } = require('../lib/result.cjs');
const { readConfig, writeDefaultConfig, updateConfig } = require('../lib/config-store.cjs');
const { CONFIG_PATH } = require('../lib/paths.cjs');

function configCommand(args) {
  if (!args || args.length === 0) {
    return fail('config', '缺少子命令', 'xb help config', { subcommands: ['show', 'set', 'reset'] });
  }

  const sub = args[0];

  if (sub === 'show') return showConfig();
  if (sub === 'set') return setConfig(args);
  if (sub === 'reset') return resetConfig();

  return fail('config', `未知的子命令 "${sub}"`, 'xb help config', { subcommands: ['show', 'set', 'reset'] });
}

function showConfig() {
  const cfg = readConfig();
  if (!cfg) return fail('config', '配置文件不存在', 'xb init');
  return ok('config', { action: 'show', config: cfg, config_path: CONFIG_PATH });
}

function setConfig(args) {
  const updates = {};
  for (const arg of args.slice(1)) {
    const [key, ...rest] = arg.split('=');
    const value = rest.join('=');
    if (key === 'browser') updates.browser = value;
    else if (key === 'headed') updates.headed = value === 'true';
    else return fail('config', `未知的配置项 "${key}"`, 'xb help config', { valid_keys: ['browser', 'headed'] });
  }
  if (Object.keys(updates).length === 0) return fail('config', '缺少配置值', 'xb config set browser=cft');
  try {
    const cfg = updateConfig(updates);
    return ok('config', { action: 'set', updated: updates, config: cfg });
  } catch (e) {
    return fail('config', e.message, 'xb help config');
  }
}

function resetConfig() {
  const cfg = writeDefaultConfig();
  return ok('config', { action: 'reset', config: cfg });
}

module.exports = { configCommand };

#!/usr/bin/env node
'use strict';

const { output, fail } = require('./lib/result.cjs');

const { helpCommand } = require('./commands/help.cjs');
const { versionCommand } = require('./commands/version.cjs');
const { configCommand } = require('./commands/config.cjs');
const { statusCommand } = require('./commands/status.cjs');
const { initCommand } = require('./commands/init.cjs');
const { setupCommand } = require('./commands/setup.cjs');
const { runCommand } = require('./commands/run.cjs');
const { stopCommand } = require('./commands/stop.cjs');
const { cleanupCommand } = require('./commands/cleanup.cjs');
const { guideCommand } = require('./commands/guide.cjs');
const { shieldCommand } = require('./commands/shield.cjs');

const COMMANDS = {
  help: (args) => helpCommand(args),
  version: () => versionCommand(),
  config: (args) => configCommand(args),
  status: () => statusCommand(),
  init: () => initCommand(),
  setup: () => setupCommand(),
  run: (args) => runCommand(args),
  stop: (args) => stopCommand(args),
  cleanup: (args) => cleanupCommand(args),
  guide: (args) => guideCommand(args),
  shield: (args) => shieldCommand(args),
};

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const subArgs = args.slice(1);

  if (!command) {
    output(helpCommand([]));
    return;
  }

  const handler = COMMANDS[command];
  if (!handler) {
    output(fail('unknown', `未知的命令 "${command}"`, 'xb help', {
      available_commands: Object.keys(COMMANDS),
    }));
    process.exitCode = 1;
    return;
  }

  try {
    const result = await handler(subArgs);
    output(result);
    if (!result.ok) process.exitCode = 1;
  } catch (e) {
    output(fail(command, `内部错误: ${e.message || e}`, 'xb help'));
    process.exitCode = 1;
  }
}

main();

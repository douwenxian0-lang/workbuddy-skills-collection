'use strict';

const { ok, fail } = require('../lib/result.cjs');

function globalHelp() {
  return ok('help', {
    description: 'xbrowser 浏览器自动化工具',
    usage: 'xb <command> [options]',
    commands: [
      { name: 'init', description: '初始化环境（安装 + 配置引导）', usage: 'xb init' },
      { name: 'run', description: '执行浏览器操作', usage: 'xb run [--browser <name>] <action> [args...]' },
      { name: 'config', description: '配置管理', usage: 'xb config <show|set|reset>' },
      { name: 'guide', description: '引导用户完成配置或确认操作', usage: 'xb guide <config|close-browser|incomplete-config|shield-allow|shield-off>' },
      { name: 'status', description: '环境状态检查', usage: 'xb status' },
      { name: 'setup', description: '安装底层引擎', usage: 'xb setup' },
      { name: 'stop', description: '关闭指定浏览器进程', usage: 'xb stop <chrome|edge|qqbrowser|all> [--force]' },
      { name: 'cleanup', description: '清理 agent-browser 会话', usage: 'xb cleanup' },
      { name: 'shield', description: '网络防护管理', usage: 'xb shield <status|list|logs|enable|remove>' },
      { name: 'version', description: '显示版本信息', usage: 'xb version' },
      { name: 'help', description: '帮助信息', usage: 'xb help [command]' },
    ],
    quick_start: [
      'xb init',
      'xb run --browser default open https://example.com',
      'xb run --browser default wait --load networkidle',
      'xb run --browser default snapshot -i',
      'xb run --browser default click @e2',
      'xb cleanup',
    ],
  });
}

function runHelp() {
  return ok('help', {
    name: 'run',
    description: '执行浏览器命令。自动进行环境校验，根据配置添加必要参数。',
    usage: 'xb run [--browser <name>] [--headed] [--timeout <ms>] <action> [action-args...]',
    env_options: [
      { name: '--browser', description: '覆盖默认浏览器', values: 'cft|chrome|edge|qqbrowser' },
      { name: '--headed', description: '强制有头模式显示浏览器窗口' },
      { name: '--timeout', description: '命令超时（毫秒，上限 29000）', default: '25000' },
    ],
    parsing_rule: '两遍扫描：第一遍提取 xb 环境参数（--browser/--headed/--timeout），第二遍将剩余参数作为操作指令。参数位置不限。',
    browser_actions: [
      { name: 'open <url>', description: '打开网页' },
      { name: 'snapshot -i', description: '获取可交互元素快照（返回 @ref 编号）' },
      { name: 'click @ref', description: '点击元素' },
      { name: 'fill @ref "text"', description: '清空后填入文本' },
      { name: 'type @ref "text"', description: '逐字符输入（不清空）' },
      { name: 'press <key>', description: '按键（如 Enter、Tab）' },
      { name: 'screenshot [--full]', description: '截图（可选整页）' },
      { name: 'wait --load networkidle', description: '等待网络空闲' },
      { name: 'get text @ref', description: '获取元素文本' },
      { name: 'get url', description: '获取页面 URL' },
      { name: 'close', description: '关闭当前标签页' },
    ],
    examples: [
      { command: 'xb run --browser default open https://example.com', description: '打开网页' },
      { command: 'xb run --browser default snapshot -i', description: '获取页面元素快照' },
      { command: 'xb run --browser default click @e2', description: '点击编号为 e2 的元素' },
      { command: 'xb run --browser default fill @e3 "hello"', description: '在元素 e3 中填入 hello' },
      { command: 'xb run --browser edge open https://example.com', description: '使用 Edge 打开' },
      { command: 'xb run --browser default --headed screenshot --full', description: '有头模式截全页面' },
    ],
    notes: [
      '所有浏览器操作指令的完整列表见 references/xb-browser-commands.md',
      'open 后建议执行 wait --load networkidle 再 snapshot -i',
      '@ref 编号来自 snapshot 输出，DOM 变化后需重新 snapshot',
    ],
  });
}

function configHelp() {
  return ok('help', {
    name: 'config',
    description: '管理 xbrowser 配置',
    usage: 'xb config <show|set|reset>',
    subcommands: [
      { name: 'show', description: '查看当前配置' },
      { name: 'set <key>=<value> [...]', description: '修改配置值（支持多个）' },
      { name: 'reset', description: '重置为默认配置' },
    ],
    config_keys: [
      { name: 'browser', values: 'cft|chrome|edge|qqbrowser', default: 'cft' },
      { name: 'headed', values: 'true|false', default: 'false' },
    ],
  });
}

function guideHelp() {
  return ok('help', {
    name: 'guide',
    description: '引导用户完成配置或确认操作',
    usage: 'xb guide <config|close-browser|incomplete-config|shield-allow|shield-off>',
    subcommands: [
      { name: 'config [--step 0|1|2]', description: '配置引导（默认 step 0）' },
      { name: 'close-browser --browser <id>', description: '引导用户确认关闭浏览器' },
      { name: 'incomplete-config', description: '配置不完整时的引导' },
      { name: 'shield-allow <host:port>', description: '引导用户确认将地址加入网络防护白名单' },
      { name: 'shield-off', description: '引导用户确认关闭网络防护（强烈不推荐）' },
    ],
  });
}

const SIMPLE_HELP = {
  init:    { description: '初始化环境（安装底层引擎 + 配置引导）', usage: 'xb init' },
  status:  { description: '环境状态检查', usage: 'xb status' },
  setup:   { description: '安装底层引擎', usage: 'xb setup' },
  stop:    { description: '关闭指定浏览器进程', usage: 'xb stop <chrome|edge|qqbrowser|all> [--force]' },
  cleanup: { description: '清理 agent-browser 会话', usage: 'xb cleanup' },
  version: { description: '显示版本信息', usage: 'xb version' },
};

function shieldHelp() {
  return ok('help', {
    name: 'shield',
    description: '管理 xbrowser 网络防护（默认启用）',
    usage: 'xb shield <subcommand>',
    subcommands: [
      { name: 'status',             description: '查看防护状态（启用/白名单数/24h 拦截总数）' },
      { name: 'list',               description: '查看白名单条目' },
      { name: 'logs [--limit N]',   description: '查看拦截日志（默认 20 条）' },
      { name: 'enable',             description: '启用防护（默认已启用）' },
      { name: 'remove <host:port>', description: '删除白名单条目（直接生效）' },
    ],
    related: [
      { name: 'xb guide shield-allow <host:port>', description: '加白名单引导（用户确认后才生效）' },
      { name: 'xb guide shield-off',                description: '关闭防护引导（强烈不推荐）' },
    ],
    notes: [
      '默认拦截内网地址、云元数据端点、危险协议',
      '加白名单 / 关闭防护需要用户在 xb guide 引导后二次确认',
      '云元数据端点（169.254.169.254 等）永远拒绝，无法加入白名单',
    ],
  });
}

function helpCommand(args) {
  if (!args || args.length === 0) return globalHelp();

  const cmd = args[0].toLowerCase();

  if (cmd === 'run')     return runHelp();
  if (cmd === 'config')  return configHelp();
  if (cmd === 'guide')   return guideHelp();
  if (cmd === 'shield')  return shieldHelp();
  if (cmd === 'help')    return globalHelp();

  const simple = SIMPLE_HELP[cmd];
  if (simple) {
    return ok('help', { name: cmd, description: simple.description, usage: simple.usage });
  }

  return fail('help', `未知的命令 "${cmd}"`, 'xb help 查看所有命令');
}

module.exports = { helpCommand };

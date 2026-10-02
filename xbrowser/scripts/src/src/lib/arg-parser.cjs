'use strict';

const VALUED_PARAMS = new Set(['--browser', '--timeout']);
const FLAG_PARAMS = new Set(['--headed']);

function parseRunArgs(argv) {
  let browser;
  let headed = false;
  let timeout;
  const actionArgs = [];
  const errors = [];

  const consumed = new Set();
  let separatorIdx = -1;

  // Find -- separator first
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--') {
      separatorIdx = i;
      consumed.add(i);
      break;
    }
  }

  // Pass 1: extract xb params (only before separator, or all if no separator)
  const scanEnd = separatorIdx >= 0 ? separatorIdx : argv.length;
  for (let i = 0; i < scanEnd; i++) {
    const token = argv[i];

    if (VALUED_PARAMS.has(token)) {
      consumed.add(i);
      if (i + 1 >= scanEnd) {
        errors.push(`${token} 需要一个值`);
        continue;
      }
      consumed.add(i + 1);
      if (token === '--browser') browser = argv[i + 1];
      if (token === '--timeout') {
        const parsed = parseInt(argv[i + 1], 10);
        if (isNaN(parsed)) {
          errors.push(`--timeout 的值必须为数字，收到: "${argv[i + 1]}"`);
        } else {
          timeout = parsed;
        }
      }
      i++;
      continue;
    }

    if (FLAG_PARAMS.has(token)) {
      consumed.add(i);
      if (token === '--headed') headed = true;
      continue;
    }
  }

  // Pass 2: collect remaining tokens as action args
  for (let i = 0; i < argv.length; i++) {
    if (consumed.has(i)) continue;
    if (i === separatorIdx) {
      // Everything after separator is action
      for (let j = i + 1; j < argv.length; j++) {
        actionArgs.push(argv[j]);
      }
      break;
    }
    actionArgs.push(argv[i]);
  }

  return { browser, headed, timeout, actionArgs, errors };
}

const BLOCKED_VALUED = new Set([
  '--profile', '--session', '--session-name', '--cdp',
  '--executable-path', '--user-agent', '--args',
  '--proxy', '--proxy-bypass', '--config', '--provider',
  '--device', '--engine', '--state', '--download-path',
  '--screenshot-dir', '--screenshot-quality',
  '--screenshot-format', '--color-scheme', '--max-output',
  '--allowed-domains', '--action-policy', '--confirm-actions',
  '--extension', '--model', '--headers',
]);

// 这些参数由 xb 自动管理或不应透传。
// --headed 故意同时出现在 FLAG_PARAMS（parseRunArgs）和此处（filterActionArgs）：
//   - FLAG_PARAMS 在 -- 分隔符之前扫描，捕获合法位置（如 "xb run --headed open ..."）
//   - BLOCKED_FLAGS 拦截放错位置的情况（如 "xb run open --headed ..."），
//     避免与 xb 的自动 headed 管理产生语义分歧
const BLOCKED_FLAGS = new Set([
  '--headed', '--auto-connect', '--debug', '--verbose', '-v',
  '--quiet', '-q', '--ignore-https-errors', '--allow-file-access',
  '--confirm-interactive', '--no-auto-dialog',
  '--content-boundaries', '--annotate', '--json',
]);

function filterActionArgs(actionArgs) {
  const filtered = [];
  const stripped = [];
  let i = 0;
  while (i < actionArgs.length) {
    const token = actionArgs[i];
    if (BLOCKED_VALUED.has(token)) {
      stripped.push(token);
      i++; // skip the flag
      if (i < actionArgs.length && !actionArgs[i].startsWith('-')) {
        i++; // skip its value
      }
      continue;
    }
    if (BLOCKED_FLAGS.has(token)) {
      stripped.push(token);
      i++;
      continue;
    }
    filtered.push(token);
    i++;
  }
  return { filtered, stripped };
}

module.exports = { parseRunArgs, filterActionArgs };

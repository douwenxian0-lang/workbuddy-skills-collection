'use strict';

const SIMPLE_VERBS = new Set([
  'open', 'back', 'forward', 'reload', 'close',
  'snapshot',
  'click', 'dblclick', 'fill', 'type', 'press', 'hover', 'select',
  'check', 'uncheck', 'scroll', 'scrollintoview', 'drag', 'upload', 'focus',
  'keydown', 'keyup',
  'screenshot', 'pdf',
  'wait',
  'eval',
  'highlight', 'inspect',
]);

const COMPOUND_VERBS = {
  get:        { subs: new Set(['text','html','value','attr','title','url','cdp-url','count','box','styles']), required: true },
  is:         { subs: new Set(['visible','enabled','checked']), required: true },
  find:       { subs: new Set(['role','text','label','placeholder','alt','title','testid','first','last','nth']), required: true },
  set:        { subs: new Set(['viewport','device','geo','offline','headers','credentials','media']), required: true },
  mouse:      { subs: new Set(['move','down','up','wheel']), required: true },
  keyboard:   { subs: new Set(['type','inserttext']), required: true },
  network:    { subs: new Set(['route','unroute','requests','request','har']), required: true },
  storage:    { subs: new Set(['local','session']), required: true },
  cookies:    { subs: new Set(['set','clear']), required: false },
  tab:        { subs: new Set(['new','close']), required: false },
  window:     { subs: new Set(['new']), required: true },
  frame:      { subs: new Set(['main']), required: false },
  dialog:     { subs: new Set(['accept','dismiss','status']), required: true },
  state:      { subs: new Set(['save','load','list','show','rename','clear','clean']), required: true },
  session:    { subs: new Set(['list']), required: false },
  clipboard:  { subs: new Set(['read','write','copy','paste']), required: true },
  diff:       { subs: new Set(['snapshot','screenshot','url']), required: true },
  stream:     { subs: new Set(['enable','status','disable']), required: true },
  trace:      { subs: new Set(['start','stop']), required: true },
  profiler:   { subs: new Set(['start','stop']), required: true },
  record:     { subs: new Set(['start','stop','restart']), required: true },
  batch:      { subs: null, required: false },
  console:    { subs: null, required: false },
  errors:     { subs: null, required: false },
};

const ALL_VERBS = new Set([...SIMPLE_VERBS, ...Object.keys(COMPOUND_VERBS)]);

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

function findSimilar(input, maxDistance) {
  if (maxDistance === undefined) maxDistance = 3;
  const results = [];
  for (const verb of ALL_VERBS) {
    const dist = levenshtein(input.toLowerCase(), verb);
    if (dist <= maxDistance) results.push({ verb, dist });
  }
  results.sort((a, b) => a.dist - b.dist);
  return results.map(r => r.verb);
}

function validateAction(actionArgs) {
  if (!actionArgs || actionArgs.length === 0) {
    return { valid: false, error: '缺少操作指令', hint: '运行 xb help run 查看所有支持的操作指令' };
  }

  const verb = actionArgs[0].toLowerCase();

  if (SIMPLE_VERBS.has(verb)) {
    return { valid: true, verb };
  }

  const compound = COMPOUND_VERBS[verb];
  if (compound) {
    if (compound.subs === null || !compound.required) {
      if (actionArgs.length < 2 || !compound.subs) {
        return { valid: true, verb };
      }
      const sub = actionArgs[1].toLowerCase();
      if (compound.subs.has(sub)) {
        return { valid: true, verb, subverb: sub };
      }
      return { valid: true, verb };
    }

    if (actionArgs.length < 2) {
      const subs = [...compound.subs];
      return {
        valid: false, verb,
        error: `"${verb}" 需要子命令`,
        hint: `${verb} 的用法：${verb} <${subs.join('|')}> [参数...]`,
        validSubverbs: subs,
      };
    }

    const sub = actionArgs[1].toLowerCase();
    if (compound.subs.has(sub)) {
      return { valid: true, verb, subverb: sub };
    }

    const subs = [...compound.subs];
    return {
      valid: false, verb,
      error: `"${verb}" 的子命令 "${actionArgs[1]}" 不存在`,
      hint: `${verb} 的用法：${verb} <${subs.join('|')}> [参数...]`,
      validSubverbs: subs,
    };
  }

  const similar = findSimilar(verb);
  return {
    valid: false,
    error: `未知的操作指令 "${actionArgs[0]}"`,
    hint: '运行 xb help run 查看所有支持的操作指令',
    similar,
  };
}

module.exports = { validateAction, ALL_VERBS, COMPOUND_VERBS, SIMPLE_VERBS };

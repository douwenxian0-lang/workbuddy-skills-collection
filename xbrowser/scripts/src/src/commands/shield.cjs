'use strict';

const { ok, fail } = require('../lib/result.cjs');
const {
  isEnabled, setEnabled, getAllowlist, addToAllowlist, removeFromAllowlist,
} = require('../lib/shield/config-store.cjs');
const { consumeAllowPending, consumeOffPending } = require('../lib/shield/pending-store.cjs');
const { validateAllowlistEntry } = require('../lib/shield/allowlist-format.cjs');
const { readRecent, appendEntry } = require('../lib/shield/log-store.cjs');
const { ShieldLogKind } = require('../lib/shield/reasons.cjs');

function shieldCommand(args) {
  if (!args || args.length === 0) {
    return fail('shield', '缺少子命令', 'xb help shield', {
      subcommands: ['status', 'list', 'logs', 'enable', 'remove'],
    });
  }
  const sub = args[0];
  const rest = args.slice(1);

  switch (sub) {
    case 'status':  return shieldStatus();
    case 'list':    return shieldList();
    case 'logs':    return shieldLogs(rest);
    case 'enable':  return shieldEnable();
    case 'remove':  return shieldRemove(rest);
    case 'allow':   return shieldAllow(rest);
    case 'disable': return shieldDisable(rest);
    default:
      return fail('shield', `未知的子命令 "${sub}"`, 'xb help shield');
  }
}

function shieldStatus() {
  const list = getAllowlist();
  const recent = readRecent(1000);
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const blocks24h = recent.filter((e) => e && e.kind === ShieldLogKind.BLOCK && new Date(e.t).getTime() >= since).length;
  return ok('shield.status', {
    enabled: isEnabled(),
    allowlist_count: list.length,
    blocks_24h: blocks24h,
  });
}

function shieldList() {
  return ok('shield.list', { entries: getAllowlist() });
}

function shieldLogs(args) {
  let limit = 20;
  const idx = args.indexOf('--limit');
  if (idx !== -1 && args[idx + 1] != null) {
    const v = Number(args[idx + 1]);
    if (Number.isInteger(v) && v > 0 && v <= 1000) limit = v;
  }
  return ok('shield.logs', { limit, entries: readRecent(limit) });
}

function shieldEnable() {
  setEnabled(true);
  appendEntry({ kind: ShieldLogKind.SHIELD_ON, by: 'cli' });
  return ok('shield.enable', { enabled: true });
}

function shieldRemove(args) {
  if (!args[0]) return fail('shield.remove', '缺少 host:port 参数', 'xb shield remove <host:port>');
  removeFromAllowlist(args[0]);
  appendEntry({ kind: ShieldLogKind.ALLOW_REMOVED, target: args[0], by: 'cli' });
  return ok('shield.remove', { removed: args[0], current_allowlist: getAllowlist() });
}

function shieldAllow(args) {
  if (!args[0]) return fail('shield.allow', '缺少 host:port 参数', 'xb guide shield-allow <host:port>');
  const target = args[0];

  const consumed = consumeAllowPending(target);
  if (!consumed.ok) {
    return fail('shield.allow', consumed.error, '请重新执行 xb guide shield-allow ' + target);
  }

  const fmt = validateAllowlistEntry(target);
  if (!fmt.valid) {
    return fail('shield.allow', `白名单格式校验失败：${fmt.reason}`, 'xb help shield', { code: fmt.code });
  }

  addToAllowlist(target);
  appendEntry({ kind: ShieldLogKind.ALLOW_ADDED, target, by: 'user-confirmed' });
  return ok('shield.allow', { added: target, current_allowlist: getAllowlist() });
}

function shieldDisable(args) {
  if (!args[0]) return fail('shield.disable', '缺少日期参数 YYYYMMDD', 'xb guide shield-off');
  const consumed = consumeOffPending(args[0]);
  if (!consumed.ok) {
    return fail('shield.disable', consumed.error, '请重新执行 xb guide shield-off');
  }
  setEnabled(false);
  appendEntry({ kind: ShieldLogKind.SHIELD_OFF, by: 'user-confirmed' });
  return ok('shield.disable', { enabled: false });
}

module.exports = { shieldCommand };

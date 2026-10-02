'use strict';

const fs = require('node:fs');
const { PENDING_DIR, pendingAllowFile, pendingOffFile } = require('./paths.cjs');
const { sign, verify } = require('./crypto.cjs');

const MIN_WAIT_MS = 2000;
const MAX_WAIT_MS = 30 * 60 * 1000;

function ensureDir() {
  fs.mkdirSync(PENDING_DIR, { recursive: true });
}

function writePending(file, payload) {
  ensureDir();
  const body = { ...payload, _sig: sign(payload) };
  fs.writeFileSync(file, JSON.stringify(body, null, 2));
}

function createAllowPending(target) {
  const file = pendingAllowFile(target);
  writePending(file, {
    step1_at: Math.floor(Date.now() / 1000),
    operation: 'shield-allow',
    target,
  });
}

function createOffPending() {
  writePending(pendingOffFile(), {
    step1_at: Math.floor(Date.now() / 1000),
    operation: 'shield-off',
  });
}

function readPending(file) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return null; }
  let obj;
  try { obj = JSON.parse(raw); } catch { return null; }
  const { _sig, ...payload } = obj;
  if (!verify(payload, _sig)) return null;
  return payload;
}

function checkTimeWindow(step1At) {
  const elapsedMs = Date.now() - step1At * 1000;
  if (elapsedMs < MIN_WAIT_MS) return { ok: false, error: '确认失败：非法操作（操作时间异常）' };
  if (elapsedMs > MAX_WAIT_MS) return { ok: false, error: '确认失败：超时（pending 已过期）' };
  return { ok: true };
}

function consumeAllowPending(target) {
  const file = pendingAllowFile(target);
  const payload = readPending(file);
  if (!payload) return { ok: false, error: '确认失败：必须先经过 xb guide shield-allow 流程' };
  if (payload.operation !== 'shield-allow' || payload.target !== target) {
    return { ok: false, error: '确认失败：pending 数据不匹配' };
  }
  const win = checkTimeWindow(payload.step1_at);
  if (!win.ok) return win;
  try { fs.unlinkSync(file); } catch {}
  return { ok: true, target };
}

function todayYYYYMMDD() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function consumeOffPending(userDate) {
  const file = pendingOffFile();
  const payload = readPending(file);
  if (!payload) return { ok: false, error: '确认失败：必须先经过 xb guide shield-off 流程' };
  if (payload.operation !== 'shield-off') {
    return { ok: false, error: '确认失败：pending operation 不匹配' };
  }
  const win = checkTimeWindow(payload.step1_at);
  if (!win.ok) return win;
  if (String(userDate) !== todayYYYYMMDD()) {
    return { ok: false, error: '确认失败：日期不匹配' };
  }
  try { fs.unlinkSync(file); } catch {}
  return { ok: true };
}

module.exports = {
  createAllowPending, createOffPending,
  consumeAllowPending, consumeOffPending,
  todayYYYYMMDD,
  MIN_WAIT_MS, MAX_WAIT_MS,
};

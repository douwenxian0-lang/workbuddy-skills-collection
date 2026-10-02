'use strict';

const { isForbiddenHost, normalizeHostname } = require('./policy.cjs');

function parseHostPort(entry) {
  if (!entry || typeof entry !== 'string') return null;
  const trimmed = entry.trim();

  // IPv6 bracketed: [::1]:8080
  let ipv6 = trimmed.match(/^\[([^\]]+)\]:(\d+)$/);
  if (ipv6) return { host: ipv6[1], port: ipv6[2], isIPv6: true };

  // host:port
  const lastColon = trimmed.lastIndexOf(':');
  if (lastColon < 0) return null;
  const host = trimmed.slice(0, lastColon);
  const port = trimmed.slice(lastColon + 1);
  if (!host || !port) return null;
  return { host, port, isIPv6: false };
}

function validateAllowlistEntry(entry) {
  const parsed = parseHostPort(entry);
  if (!parsed) return { valid: false, reason: '格式必须为 host:port（端口必填）', code: 'missing-port' };

  // port 必须是 1-65535 整数
  const portNum = Number(parsed.port);
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    return { valid: false, reason: '端口必须为 1-65535 的整数', code: 'invalid-port' };
  }

  // 拒通配符
  if (parsed.host.includes('*')) {
    return { valid: false, reason: '不接受通配符（必须是具体 host）', code: 'wildcard-not-allowed' };
  }

  // 拒 CIDR
  if (parsed.host.includes('/')) {
    return { valid: false, reason: '不接受 CIDR 段', code: 'cidr-not-allowed' };
  }

  // 拒 0.0.0.0 和 ::
  if (parsed.host === '0.0.0.0' || parsed.host === '::') {
    return { valid: false, reason: '不接受通配地址', code: 'wildcard-address' };
  }

  // 拒云元数据等硬黑名单
  const normalizedHost = normalizeHostname(parsed.host);
  if (isForbiddenHost(normalizedHost)) {
    return {
      valid: false,
      reason: '该地址在硬黑名单中（云元数据端点不可加入白名单）',
      code: 'forbidden-allowlist-target',
    };
  }

  return { valid: true, host: normalizedHost, port: parsed.port };
}

module.exports = { validateAllowlistEntry, parseHostPort };

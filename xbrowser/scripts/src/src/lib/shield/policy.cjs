'use strict';

const net = require('node:net');
const { ShieldReason } = require('./reasons.cjs');

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const DANGEROUS_PROTOCOLS = new Set([
  'file:', 'chrome:', 'chrome-extension:', 'javascript:',
  'data:', 'view-source:', 'about:', 'ftp:', 'gopher:',
]);

const FORBIDDEN_IPS = new Set([
  '169.254.169.254',
  '169.254.170.2',
  '100.100.100.200',
]);

const FORBIDDEN_HOSTNAMES = new Set([
  'metadata.google.internal',
  'metadata.azure.com',
  'metadata',
]);

const PRIVATE_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.local$/i,
  /\.internal$/i,
];

function normalizeHostname(hostname) {
  if (!hostname) return '';
  let h = String(hostname).toLowerCase();
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
  const zoneIdx = h.indexOf('%');
  if (zoneIdx >= 0) h = h.slice(0, zoneIdx);
  return h;
}

function isPrivateIp(ip) {
  if (!ip || typeof ip !== 'string') return false;
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (/^fe[89ab][0-9a-f]?:/i.test(lower)) return true;
    if (/^f[cd][0-9a-f]{2}:/i.test(lower)) return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    // ::ffff:<hex>:<hex> 形式（URL 解析器规范化后的 IPv4-mapped）
    const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
      const hi = parseInt(mappedHex[1], 16);
      const lo = parseInt(mappedHex[2], 16);
      const a = (hi >> 8) & 0xff;
      const b = hi & 0xff;
      const c = (lo >> 8) & 0xff;
      const d = lo & 0xff;
      return isPrivateIp(`${a}.${b}.${c}.${d}`);
    }
    return false;
  }
  return false;
}

function isForbiddenHost(host) {
  if (!host) return false;
  const h = String(host).toLowerCase();
  if (FORBIDDEN_IPS.has(h)) return true;
  if (FORBIDDEN_HOSTNAMES.has(h)) return true;
  // Also recognize IPv4-mapped IPv6 forms of forbidden IPs
  const mapped = decodeIPv4Mapped(h);
  if (mapped && FORBIDDEN_IPS.has(mapped)) return true;
  return false;
}

function decodeIPv4Mapped(host) {
  if (!host || typeof host !== 'string') return null;
  const lower = host.toLowerCase();
  // dotted form: ::ffff:127.0.0.1
  const dotted = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return dotted[1];
  // hex form: ::ffff:7f00:1 (Node URL parser normalizes brackets to this)
  const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    const a = (hi >> 8) & 0xff;
    const b = hi & 0xff;
    const c = (lo >> 8) & 0xff;
    const d = lo & 0xff;
    return `${a}.${b}.${c}.${d}`;
  }
  return null;
}

function isPrivateHostname(host) {
  return PRIVATE_HOSTNAME_PATTERNS.some((re) => re.test(host));
}

function looksLikeIp(host) {
  return /^[\d.]+$/.test(host) || /^[\dxa-f.]+$/i.test(host);
}

function checkUrlSync(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { allow: false, reason: ShieldReason.INVALID_FORMAT, url: rawUrl };
  }

  if (DANGEROUS_PROTOCOLS.has(parsed.protocol) || !ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return { allow: false, reason: ShieldReason.DANGEROUS_PROTOCOL, detail: parsed.protocol };
  }

  const host = normalizeHostname(parsed.hostname);
  if (!host) {
    return { allow: false, reason: ShieldReason.INVALID_FORMAT, url: rawUrl };
  }

  // 检测原始 URL 中的形似 IP 但带前导零（八进制混淆）的主机名
  // URL 解析器会将 010.0.0.5 规范化为 8.0.0.5，绕过 RFC1918 检查
  const rawHostMatch = String(rawUrl).match(/^[a-z][a-z0-9+.-]*:\/\/(?:[^/@]*@)?\[?([^/?#:\]]+)\]?/i);
  if (rawHostMatch) {
    const rawHost = rawHostMatch[1];
    if (/^[\d.]+$/.test(rawHost) && /(^|\.)0\d+/.test(rawHost)) {
      return { allow: false, reason: ShieldReason.PRIVATE_NETWORK, detail: rawHost };
    }
  }

  if (isForbiddenHost(host)) {
    return { allow: false, reason: ShieldReason.CLOUD_METADATA, detail: host };
  }

  if (isPrivateHostname(host)) {
    return { allow: false, reason: ShieldReason.PRIVATE_NETWORK, detail: host };
  }

  if (net.isIP(host)) {
    if (isPrivateIp(host)) {
      return { allow: false, reason: ShieldReason.PRIVATE_NETWORK, detail: host };
    }
    return { allow: true };
  }

  // 形似 IP 但 net.isIP 不接受（如 010.0.0.5）→ 拒绝
  if (looksLikeIp(host) && /^[\d.]+$/.test(host)) {
    return { allow: false, reason: ShieldReason.PRIVATE_NETWORK, detail: host };
  }

  // 域名形态：标记需要 DNS
  return { allow: true, requiresDnsCheck: true, hostname: host, port: parsed.port, protocol: parsed.protocol };
}

function defaultPortForProtocol(protocol) {
  if (protocol === 'https:') return '443';
  if (protocol === 'http:') return '80';
  return '';
}

const dns = require('node:dns').promises;

function matchAllowlist(host, port, allowlist) {
  if (!allowlist || allowlist.length === 0) return false;
  const normalized = normalizeHostname(host);
  const portStr = String(port || '');
  const candidates = [
    `${normalized}:${portStr}`,
    `[${normalized}]:${portStr}`,
  ].map((s) => s.toLowerCase());
  return allowlist.some((entry) => candidates.includes(String(entry).toLowerCase()));
}

async function checkUrl(rawUrl, opts = {}) {
  const sync = checkUrlSync(rawUrl);

  // private-network 错误时尝试白名单豁免
  if (!sync.allow && sync.reason === ShieldReason.PRIVATE_NETWORK) {
    let parsed;
    try { parsed = new URL(rawUrl); } catch { return sync; }
    const host = normalizeHostname(parsed.hostname);
    const effectivePort = parsed.port || defaultPortForProtocol(parsed.protocol);
    if (matchAllowlist(host, effectivePort, opts.allowlist || [])) {
      return { allow: true, allowlistMatched: true };
    }
    return sync;
  }

  if (!sync.allow) return sync; // cloud-metadata / dangerous-protocol / invalid-format 不可豁免

  if (!sync.requiresDnsCheck) return sync;

  // 域名 → DNS 校验
  const lookupFn = opts.lookupFn || ((h) => dns.lookup(h, { all: true }));
  let addresses;
  try {
    addresses = await lookupFn(sync.hostname);
  } catch {
    return { allow: false, reason: ShieldReason.DNS_RESOLVE_FAILED, detail: sync.hostname };
  }
  for (const { address } of addresses) {
    if (isForbiddenHost(address)) {
      return { allow: false, reason: ShieldReason.CLOUD_METADATA_VIA_DNS, detail: address };
    }
    if (isPrivateIp(address)) {
      const effectivePort = sync.port || defaultPortForProtocol(sync.protocol);
      if (matchAllowlist(sync.hostname, effectivePort, opts.allowlist || [])) {
        return { allow: true, allowlistMatched: true };
      }
      return { allow: false, reason: ShieldReason.PRIVATE_NETWORK_VIA_DNS, detail: address };
    }
  }
  return { allow: true };
}

module.exports = {
  checkUrlSync, checkUrl, matchAllowlist,
  isPrivateIp, isForbiddenHost, normalizeHostname, decodeIPv4Mapped,
  ALLOWED_PROTOCOLS, DANGEROUS_PROTOCOLS, FORBIDDEN_IPS, FORBIDDEN_HOSTNAMES,
};

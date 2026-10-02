const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ShieldReason } = require('../../../src/lib/shield/reasons.cjs');
const { checkUrlSync, isPrivateIp, isForbiddenHost } = require('../../../src/lib/shield/policy.cjs');

describe('isPrivateIp - IPv4', () => {
  it('detects RFC1918', () => {
    assert.equal(isPrivateIp('10.0.0.5'), true);
    assert.equal(isPrivateIp('172.16.0.1'), true);
    assert.equal(isPrivateIp('172.31.255.255'), true);
    assert.equal(isPrivateIp('192.168.1.1'), true);
  });
  it('detects CGN (RFC6598)', () => {
    assert.equal(isPrivateIp('100.64.0.5'), true);
    assert.equal(isPrivateIp('100.127.255.255'), true);
    assert.equal(isPrivateIp('100.63.255.255'), false);
    assert.equal(isPrivateIp('100.128.0.0'), false);
  });
  it('detects loopback', () => {
    assert.equal(isPrivateIp('127.0.0.1'), true);
    assert.equal(isPrivateIp('127.255.255.255'), true);
  });
  it('detects link-local', () => {
    assert.equal(isPrivateIp('169.254.1.1'), true);
  });
  it('detects 0.x and multicast', () => {
    assert.equal(isPrivateIp('0.0.0.0'), true);
    assert.equal(isPrivateIp('224.0.0.1'), true);
  });
  it('rejects public IPv4', () => {
    assert.equal(isPrivateIp('8.8.8.8'), false);
    assert.equal(isPrivateIp('203.0.113.5'), false);
    assert.equal(isPrivateIp('172.32.0.0'), false);
  });
});

describe('isPrivateIp - IPv6', () => {
  it('detects loopback', () => {
    assert.equal(isPrivateIp('::1'), true);
  });
  it('detects ULA fc00::/7', () => {
    assert.equal(isPrivateIp('fc00::1'), true);
    assert.equal(isPrivateIp('fd00::1'), true);
  });
  it('detects link-local fe80::/10', () => {
    assert.equal(isPrivateIp('fe80::1'), true);
  });
  it('detects IPv4-mapped', () => {
    assert.equal(isPrivateIp('::ffff:127.0.0.1'), true);
    assert.equal(isPrivateIp('::ffff:8.8.8.8'), false);
  });
});

describe('isPrivateIp - non-IP', () => {
  it('rejects strings', () => {
    assert.equal(isPrivateIp('example.com'), false);
    assert.equal(isPrivateIp(''), false);
    assert.equal(isPrivateIp(undefined), false);
  });
});

describe('isForbiddenHost', () => {
  it('detects metadata literal IPs', () => {
    assert.equal(isForbiddenHost('169.254.169.254'), true);
    assert.equal(isForbiddenHost('169.254.170.2'), true);
    assert.equal(isForbiddenHost('100.100.100.200'), true);
  });
  it('detects metadata hostnames', () => {
    assert.equal(isForbiddenHost('metadata.google.internal'), true);
    assert.equal(isForbiddenHost('metadata.azure.com'), true);
    assert.equal(isForbiddenHost('metadata'), true);
    assert.equal(isForbiddenHost('METADATA'), true);
  });
  it('rejects normal addresses', () => {
    assert.equal(isForbiddenHost('192.168.1.1'), false);
    assert.equal(isForbiddenHost('example.com'), false);
  });
});

describe('checkUrlSync - protocols', () => {
  it('rejects file://', () => {
    assert.equal(checkUrlSync('file:///etc/passwd').reason, 'dangerous-protocol');
  });
  it('rejects javascript:', () => {
    assert.equal(checkUrlSync('javascript:alert(1)').reason, 'dangerous-protocol');
  });
  it('rejects chrome://', () => {
    assert.equal(checkUrlSync('chrome://settings').reason, 'dangerous-protocol');
  });
  it('rejects data:', () => {
    assert.equal(checkUrlSync('data:text/html,<h1>x</h1>').reason, 'dangerous-protocol');
  });
  it('rejects view-source:', () => {
    assert.equal(checkUrlSync('view-source:https://x.com').reason, 'dangerous-protocol');
  });
  it('allows https:', () => {
    const r = checkUrlSync('https://baidu.com/');
    assert.equal(r.allow, true);
    assert.equal(r.requiresDnsCheck, true);
  });
  it('allows http:', () => {
    assert.equal(checkUrlSync('http://example.com/').allow, true);
  });
});

describe('checkUrlSync - format', () => {
  it('rejects empty/garbage', () => {
    assert.equal(checkUrlSync('').reason, 'invalid-format');
    assert.equal(checkUrlSync('not a url').reason, 'invalid-format');
  });
});

describe('checkUrlSync - private IPs', () => {
  it('rejects literal private IPv4', () => {
    assert.equal(checkUrlSync('http://10.0.0.5/').reason, 'private-network');
    assert.equal(checkUrlSync('http://127.0.0.1/').reason, 'private-network');
    assert.equal(checkUrlSync('http://192.168.1.1/').reason, 'private-network');
    assert.equal(checkUrlSync('http://100.64.0.5/').reason, 'private-network');
  });
  it('rejects metadata IPs as cloud-metadata', () => {
    assert.equal(checkUrlSync('http://169.254.169.254/').reason, 'cloud-metadata');
  });
  it('rejects metadata hostnames as cloud-metadata', () => {
    assert.equal(checkUrlSync('http://metadata.google.internal/').reason, 'cloud-metadata');
  });
  it('rejects localhost variants', () => {
    assert.equal(checkUrlSync('http://localhost/').reason, 'private-network');
    assert.equal(checkUrlSync('http://localhost:3000/').reason, 'private-network');
  });
  it('rejects IPv6 loopback / mapped', () => {
    assert.equal(checkUrlSync('http://[::1]/').reason, 'private-network');
    assert.equal(checkUrlSync('http://[::ffff:127.0.0.1]/').reason, 'private-network');
  });
  it('rejects octal-style IP that fails net.isIP', () => {
    // "010.0.0.5" is not accepted by net.isIP as IPv4, but looks IP-like → rejected
    assert.equal(checkUrlSync('http://010.0.0.5/').reason, 'private-network');
  });
});

const { checkUrl, matchAllowlist } = require('../../../src/lib/shield/policy.cjs');

describe('policy reason constants', () => {
  it('returns ShieldReason constants for URL policy outcomes', async () => {
    assert.equal(checkUrlSync('not-a-url').reason, ShieldReason.INVALID_FORMAT);
    assert.equal(checkUrlSync('file:///tmp/example').reason, ShieldReason.DANGEROUS_PROTOCOL);
    assert.equal(checkUrlSync('http://127.0.0.1:65530/').reason, ShieldReason.PRIVATE_NETWORK);

    const dnsFailure = await checkUrl('https://qclaw-shield-message-nonexistent.invalid/', {
      lookupFn: async () => { throw new Error('mock dns failure'); },
    });
    assert.equal(dnsFailure.reason, ShieldReason.DNS_RESOLVE_FAILED);
  });
});

describe('matchAllowlist', () => {
  it('matches host:port exactly', () => {
    assert.equal(matchAllowlist('192.168.1.10', '8080', ['192.168.1.10:8080']), true);
  });
  it('rejects on host or port mismatch', () => {
    assert.equal(matchAllowlist('192.168.1.10', '9090', ['192.168.1.10:8080']), false);
    assert.equal(matchAllowlist('192.168.1.11', '8080', ['192.168.1.10:8080']), false);
  });
  it('handles IPv6 bracketed form', () => {
    assert.equal(matchAllowlist('::1', '8080', ['[::1]:8080']), true);
  });
  it('returns false on empty allowlist', () => {
    assert.equal(matchAllowlist('192.168.1.10', '8080', []), false);
  });
});

describe('checkUrl async with DNS', () => {
  it('rejects domain resolving to private IP', async () => {
    const fakeLookup = async () => [{ address: '127.0.0.1', family: 4 }];
    const r = await checkUrl('http://attacker.com/', { allowlist: [], lookupFn: fakeLookup });
    assert.equal(r.allow, false);
    assert.equal(r.reason, 'private-network-via-dns');
  });
  it('rejects domain resolving to cloud metadata', async () => {
    const fakeLookup = async () => [{ address: '169.254.169.254', family: 4 }];
    const r = await checkUrl('http://attacker.com/', { allowlist: [], lookupFn: fakeLookup });
    assert.equal(r.reason, 'cloud-metadata-via-dns');
  });
  it('allows domain resolving to public IP', async () => {
    const fakeLookup = async () => [{ address: '8.8.8.8', family: 4 }];
    const r = await checkUrl('http://example.com/', { allowlist: [], lookupFn: fakeLookup });
    assert.equal(r.allow, true);
  });
  it('allowlist bypasses private IP', async () => {
    const r = await checkUrl('http://192.168.1.10:8080/', { allowlist: ['192.168.1.10:8080'] });
    assert.equal(r.allow, true);
    assert.equal(r.allowlistMatched, true);
  });
  it('allowlist does NOT bypass cloud metadata', async () => {
    const r = await checkUrl('http://169.254.169.254/', { allowlist: ['169.254.169.254:80'] });
    assert.equal(r.allow, false);
    assert.equal(r.reason, 'cloud-metadata');
  });
  it('DNS failure returns dns-resolve-failed', async () => {
    const fakeLookup = async () => { throw new Error('ENOTFOUND'); };
    const r = await checkUrl('http://nx.example.com/', { allowlist: [], lookupFn: fakeLookup });
    assert.equal(r.reason, 'dns-resolve-failed');
  });
  it('domain resolves to multiple IPs - any private fails', async () => {
    const fakeLookup = async () => [
      { address: '8.8.8.8', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ];
    const r = await checkUrl('http://mixed.com/', { allowlist: [], lookupFn: fakeLookup });
    assert.equal(r.allow, false);
    assert.equal(r.reason, 'private-network-via-dns');
  });
});

describe('isForbiddenHost - IPv4-mapped IPv6', () => {
  it('detects dotted IPv4-mapped form of metadata IP', () => {
    assert.equal(isForbiddenHost('::ffff:169.254.169.254'), true);
  });
  it('detects hex IPv4-mapped form of metadata IP', () => {
    // ::ffff:a9fe:a9fe == 169.254.169.254
    assert.equal(isForbiddenHost('::ffff:a9fe:a9fe'), true);
  });
  it('still detects normal forbidden IPs', () => {
    assert.equal(isForbiddenHost('169.254.169.254'), true);
  });
});

describe('checkUrlSync - IPv4-mapped IPv6 cloud metadata', () => {
  it('rejects hex IPv4-mapped form as cloud-metadata (not private-network)', () => {
    const r = checkUrlSync('http://[::ffff:a9fe:a9fe]/');
    assert.equal(r.allow, false);
    assert.equal(r.reason, 'cloud-metadata');
  });
});

describe('checkUrl - default port allowlist', () => {
  it('matches allowlist when URL omits default port 80', async () => {
    const r = await checkUrl('http://192.168.1.10/', { allowlist: ['192.168.1.10:80'] });
    assert.equal(r.allow, true);
    assert.equal(r.allowlistMatched, true);
  });
  it('matches allowlist when URL omits default port 443', async () => {
    const fakeLookup = async () => [{ address: '192.168.1.10', family: 4 }];
    const r = await checkUrl('https://internal.example.com/', {
      allowlist: ['internal.example.com:443'],
      lookupFn: fakeLookup,
    });
    assert.equal(r.allow, true);
  });
});

'use strict';

const http = require('http');
const https = require('https');

const MIRRORS = [
  { name: '腾讯镜像', base: 'https://mirrors.tencent.com/npm' },
  { name: 'npmmirror', base: 'https://registry.npmmirror.com' },
  { name: 'npm 官方源', base: 'https://registry.npmjs.org' },
];

/**
 * HTTP GET that follows 301/302 redirects and returns a Buffer.
 * @param {string} url
 * @param {number} [timeoutMs=30000]
 * @returns {Promise<Buffer>}
 */
function httpGet(url, timeoutMs = 30000, maxRedirects = 10) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { timeout: timeoutMs }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        if (maxRedirects <= 0) {
          reject(new Error('Too many redirects'));
          return;
        }
        httpGet(res.headers.location, timeoutMs, maxRedirects - 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        res.resume();
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    })
      .on('error', reject)
      .on('timeout', function () {
        this.destroy();
        reject(new Error('timeout'));
      });
  });
}

/**
 * Quick reachability check — resolves true/false, never rejects.
 * @param {string} url
 * @param {number} [timeoutMs=5000]
 * @returns {Promise<boolean>}
 */
function checkUrl(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Try each mirror in order; return the first reachable base URL.
 * Falls back to npmjs.org.
 * @returns {Promise<string>}
 */
async function detectRegistry() {
  for (const mirror of MIRRORS) {
    const ok = await checkUrl(mirror.base);
    if (ok) return mirror.base;
  }
  return MIRRORS[2].base;
}

/**
 * Fetch and parse the "latest" metadata for a package.
 * @param {string} registryBase
 * @param {string} packageName
 * @returns {Promise<object>}
 */
async function getPackageInfo(registryBase, packageName, version) {
  const tag = version || 'latest';
  const url = `${registryBase}/${packageName}/${tag}`;
  const data = await httpGet(url);
  return JSON.parse(data.toString('utf8'));
}

/**
 * Download a tarball — alias for httpGet with a longer default timeout.
 * @param {string} url
 * @param {number} [timeoutMs=120000]
 * @returns {Promise<Buffer>}
 */
function downloadTarball(url, timeoutMs = 120000) {
  return httpGet(url, timeoutMs);
}

module.exports = {
  MIRRORS,
  detectRegistry,
  getPackageInfo,
  downloadTarball,
  httpGet,
  checkUrl,
};

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { AGENT_BROWSER_BIN, profileDir } = require('./paths.cjs');
const { detectAllBrowsers } = require('./detect-browsers.cjs');

const home = os.homedir();

/**
 * Check if agent-browser CLI is installed and get its version.
 */
function checkCli() {
  const installed = fs.existsSync(AGENT_BROWSER_BIN);
  let version = '';
  if (installed) {
    try {
      version = execFileSync(AGENT_BROWSER_BIN, ['--version'], {
        encoding: 'utf8', timeout: 10000,
      }).trim();
    } catch { /* version check failed */ }
  }
  return { installed, version, bin_path: AGENT_BROWSER_BIN };
}

/**
 * Detect Chrome for Testing (CfT) installed by agent-browser.
 * agent-browser stores CfT under ~/.agent-browser/browsers/chrome-{version}.
 */
function getCftBrowsersDir() {
  return path.join(home, '.agent-browser', 'browsers');
}

function compareChromeVersionDirsDesc(a, b) {
  const pa = a.replace(/^chrome-/, '').split('.').map((n) => Number(n) || 0);
  const pb = b.replace(/^chrome-/, '').split('.').map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] || 0) - (pa[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function cftBinaryCandidates(versionDir) {
  if (process.platform === 'darwin') {
    const appPath = ['Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'];
    return [
      path.join(versionDir, ...appPath),
      path.join(versionDir, 'chrome-mac-arm64', ...appPath),
      path.join(versionDir, 'chrome-mac-x64', ...appPath),
    ];
  }
  if (process.platform === 'win32') {
    return [
      path.join(versionDir, 'chrome.exe'),
      path.join(versionDir, 'chrome-win64', 'chrome.exe'),
    ];
  }
  return [
    path.join(versionDir, 'chrome'),
    path.join(versionDir, 'chrome-linux64', 'chrome'),
  ];
}

function safeIsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function detectCft() {
  const browsersDir = getCftBrowsersDir();
  if (!fs.existsSync(browsersDir)) return { installed: false, path: '' };

  let entries;
  try {
    entries = fs.readdirSync(browsersDir, { withFileTypes: true });
  } catch {
    return { installed: false, path: '' };
  }

  const versions = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('chrome-'))
    .map((entry) => entry.name)
    .sort(compareChromeVersionDirsDesc);
  for (const versionDirName of versions) {
    const versionDir = path.join(browsersDir, versionDirName);
    const binary = cftBinaryCandidates(versionDir).find((candidate) => safeIsFile(candidate));
    if (binary) {
      return { installed: true, path: binary, version: versionDirName.replace(/^chrome-/, '') };
    }
  }
  return { installed: false, path: '' };
}

/**
 * Check Chrome for Testing and all local browsers.
 */
function checkBrowsers() {
  const cft = detectCft();
  const local = detectAllBrowsers().browsers;
  return { cft, local };
}

/**
 * Check profile status for a specific browser.
 * @param {string} browserId — one of BROWSER_IDS
 */
function checkProfile(browserId) {
  const dir = profileDir(browserId);
  const exists = fs.existsSync(dir);
  let sizeBytes = 0;
  if (exists) {
    try {
      sizeBytes = getDirSize(dir);
    } catch { /* ignore */ }
  }
  return {
    browserId,
    path: dir,
    exists,
    size_bytes: sizeBytes,
  };
}

/**
 * Get total size of a directory in bytes (recursive).
 */
function getDirSize(dir) {
  let total = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile()) {
      total += fs.statSync(fullPath).size;
    } else if (entry.isDirectory()) {
      total += getDirSize(fullPath);
    }
  }
  return total;
}

module.exports = { checkCli, checkBrowsers, checkProfile };

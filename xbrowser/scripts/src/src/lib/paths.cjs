'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');

const stateDir = (process.env.OPENCLAW_STATE_DIR || '').trim()
  || path.join(os.homedir(), '.openclaw');

const XBROWSER_DIR = path.join(stateDir, 'tools', 'xbrowser');
const PROFILES_DIR = path.join(XBROWSER_DIR, 'profiles');
const PIDS_DIR = path.join(XBROWSER_DIR, 'pids');
const CONFIG_PATH = path.join(XBROWSER_DIR, 'config.json');
const VERSION_PATH = path.join(XBROWSER_DIR, '.version');

// Musl detection (pure filesystem, no child_process)
function isMusl() {
  if (os.platform() !== 'linux') return false;
  try {
    const files = fs.readdirSync('/lib');
    return files.some(f => f.startsWith('ld-musl-'));
  } catch {
    return false;
  }
}

// Platform-to-binary mapping (logic from agent-browser.js)
function getNativeBinaryName() {
  const p = os.platform();
  const a = os.arch();
  let osKey;
  if (p === 'darwin') osKey = 'darwin';
  else if (p === 'linux') osKey = isMusl() ? 'linux-musl' : 'linux';
  else if (p === 'win32') osKey = 'win32';
  else return null;

  let archKey;
  if (a === 'x64' || a === 'x86_64') archKey = 'x64';
  else if (a === 'arm64' || a === 'aarch64') archKey = 'arm64';
  else return null;

  const ext = p === 'win32' ? '.exe' : '';
  return `agent-browser-${osKey}-${archKey}${ext}`;
}

const NATIVE_BIN_NAME = getNativeBinaryName();
const AGENT_BROWSER_IS_NATIVE = !!NATIVE_BIN_NAME;
const AGENT_BROWSER_BIN = NATIVE_BIN_NAME
  ? path.join(XBROWSER_DIR, 'node_modules', 'agent-browser', 'bin', NATIVE_BIN_NAME)
  : path.join(XBROWSER_DIR, 'node_modules', 'agent-browser', 'bin', 'agent-browser.js');

const AGENT_BROWSER_VERSION = '0.25.3';

const CLI_VERSION = '1.2.0';

const BROWSER_IDS = ['cft', 'chrome', 'edge', 'qqbrowser'];
const LOCAL_BROWSER_IDS = BROWSER_IDS.filter((id) => id !== 'cft');

const CDP_CANDIDATE_PORTS = [9222, 9333, 9334, 9335, 9444, 9555, 9666];
const CDP_FALLBACK_PORTS = [19222, 19333, 29222, 39222];
const CDP_ALL_PORTS = [...CDP_CANDIDATE_PORTS, ...CDP_FALLBACK_PORTS];

function profileDir(browserId) {
  return path.join(PROFILES_DIR, browserId);
}

function sessionName(browserId) {
  return `xbrowser-${browserId}`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function pidFile(browserId) {
  return path.join(PIDS_DIR, `${browserId}.pid`);
}

function savePid(browserId, pid) {
  ensureDir(PIDS_DIR);
  fs.writeFileSync(pidFile(browserId), String(pid), 'utf8');
}

function readPid(browserId) {
  try {
    const content = fs.readFileSync(pidFile(browserId), 'utf8').trim();
    const pid = Number(content);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch { return null; }
}

function removePid(browserId) {
  try { fs.unlinkSync(pidFile(browserId)); } catch { /* ignore */ }
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

module.exports = {
  stateDir, XBROWSER_DIR, PROFILES_DIR, PIDS_DIR, CONFIG_PATH, VERSION_PATH,
  AGENT_BROWSER_BIN, AGENT_BROWSER_IS_NATIVE, AGENT_BROWSER_VERSION, CLI_VERSION, BROWSER_IDS, LOCAL_BROWSER_IDS,
  CDP_CANDIDATE_PORTS, CDP_FALLBACK_PORTS, CDP_ALL_PORTS,
  profileDir, sessionName, ensureDir, compareVersions,
  pidFile, savePid, readPid, removePid,
};

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const platform = os.platform();
const home = os.homedir();

const BROWSER_DEFS = {
  chrome: {
    display_name: 'Google Chrome',
    cdp_default_port: 9222,
    registry_keys: [
      'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe',
      'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe',
    ],
    paths: {
      darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
      win32: [
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      ],
      linux: [],
    },
    linux_commands: ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium'],
    user_data: {
      darwin: path.join(home, 'Library', 'Application Support', 'Google', 'Chrome'),
      win32: path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'Google', 'Chrome', 'User Data'),
      linux: path.join(home, '.config', 'google-chrome'),
    },
  },
  edge: {
    display_name: 'Microsoft Edge',
    cdp_default_port: 9334,
    registry_keys: [
      'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\msedge.exe',
      'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\msedge.exe',
    ],
    paths: {
      darwin: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
      win32: [
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      ],
      linux: [],
    },
    linux_commands: ['microsoft-edge', 'microsoft-edge-stable'],
    user_data: {
      darwin: path.join(home, 'Library', 'Application Support', 'Microsoft Edge'),
      win32: path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'Microsoft', 'Edge', 'User Data'),
      linux: path.join(home, '.config', 'microsoft-edge'),
    },
  },
  qqbrowser: {
    display_name: 'QQ 浏览器',
    cdp_default_port: 9333,
    registry_keys: [
      'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\QQBrowser.exe',
      'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\QQBrowser.exe',
    ],
    paths: {
      darwin: [
        '/Applications/QQBrowser.app/Contents/MacOS/QQBrowser',
        '/Applications/QQ浏览器.app/Contents/MacOS/QQ浏览器',
      ],
      win32: [
        path.join(process.env.LOCALAPPDATA || '', 'Tencent', 'QQBrowser', 'QQBrowser.exe'),
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Tencent', 'QQBrowser', 'QQBrowser.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Tencent', 'QQBrowser', 'QQBrowser.exe'),
      ],
      linux: [],
    },
    linux_commands: [],
    user_data: {
      darwin: path.join(home, 'Library', 'Application Support', 'QQBrowser3'),
      win32: path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'Tencent', 'QQBrowser', 'User Data'),
      linux: '',
    },
    darwin_user_data_fallback_pattern: 'QQBrowser',
  },
};

/**
 * Try to resolve executable via Windows registry.
 * Returns the path string or empty string.
 */
function resolveFromRegistry(registryKeys) {
  if (platform !== 'win32') return '';
  for (const key of registryKeys) {
    try {
      const out = execFileSync('reg', ['query', key, '/ve'], { encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
      const match = out.match(/REG_SZ\s+(.+)/);
      if (match) {
        const p = match[1].trim();
        if (fs.existsSync(p)) return p;
      }
    } catch (e) {
      const msg = (e.stderr || e.message || '').toLowerCase();
      if (e.code === 'ENOENT' || msg.includes('is not recognized') || msg.includes('not found')) {
        const systemRoot = process.env.SystemRoot || 'C:\\Windows';
        const regExe = path.join(systemRoot, 'System32', 'reg.exe');
        try {
          const out = execFileSync(regExe, ['query', key, '/ve'], { encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
          const match = out.match(/REG_SZ\s+(.+)/);
          if (match) {
            const p = match[1].trim();
            if (fs.existsSync(p)) return p;
          }
        } catch { /* full path also failed, continue */ }
      }
      /* registry key not found, continue */
    }
  }
  return '';
}

/**
 * Try to find executable via known filesystem paths.
 */
function resolveFromPaths(candidatePaths) {
  const platformPaths = candidatePaths[platform] || [];
  for (const p of platformPaths) {
    if (p && fs.existsSync(p)) return p;
  }
  return '';
}

/**
 * Try to find executable via `which` on Linux.
 */
function resolveFromLinuxCommands(commands) {
  if (platform !== 'linux') return '';
  for (const cmd of commands) {
    try {
      const p = execFileSync('which', [cmd], { encoding: 'utf8', timeout: 5000 }).trim();
      if (p && fs.existsSync(p)) return p;
    } catch { /* not found */ }
  }
  return '';
}

/**
 * Resolve user data directory, with optional fallback pattern search on macOS.
 */
function resolveUserData(def) {
  const udPath = def.user_data[platform];
  if (udPath && fs.existsSync(udPath)) return udPath;

  // macOS fallback: search Application Support for pattern match
  if (platform === 'darwin' && def.darwin_user_data_fallback_pattern) {
    const appSupport = path.join(home, 'Library', 'Application Support');
    try {
      const entries = fs.readdirSync(appSupport);
      for (const entry of entries) {
        if (entry.includes(def.darwin_user_data_fallback_pattern)) {
          const candidate = path.join(appSupport, entry);
          if (fs.statSync(candidate).isDirectory()) return candidate;
        }
      }
    } catch { /* ignore */ }
  }

  return udPath || '';
}

/**
 * Get browser version from executable path.
 */
function getVersion(executablePath) {
  if (!executablePath) return '';
  try {
    if (platform === 'darwin') {
      // Use the Info.plist from the .app bundle
      const appMatch = executablePath.match(/^(.+\.app)\//);
      if (appMatch) {
        const plistPath = path.join(appMatch[1], 'Contents', 'Info.plist');
        const out = execFileSync('defaults', ['read', plistPath, 'CFBundleShortVersionString'], {
          encoding: 'utf8', timeout: 5000,
        }).trim();
        if (out) return out;
      }
    }
    if (platform === 'win32') {
      const out = execFileSync('powershell', ['-Command',
        `(Get-Item '${executablePath.replace(/'/g, "''")}').VersionInfo.ProductVersion`
      ], { encoding: 'utf8', timeout: 5000 }).trim();
      if (out) return out;
    }
    if (platform === 'linux') {
      const out = execFileSync(executablePath, ['--version'], { encoding: 'utf8', timeout: 5000 }).trim();
      // Usually outputs something like "Google Chrome 120.0.6099.71"
      const match = out.match(/[\d]+\.[\d]+\.[\d]+(?:\.[\d]+)?/);
      if (match) return match[0];
    }
  } catch { /* version detection failed */ }
  return '';
}

/**
 * Detect a single browser by name.
 * @param {string} name — one of 'chrome', 'edge', 'qqbrowser'
 * @returns {object} detection result
 */
function detectBrowser(name) {
  const def = BROWSER_DEFS[name];
  if (!def) {
    return {
      name,
      display_name: name,
      installed: false,
      version: '',
      executable_path: '',
      user_data_path: '',
      user_data_exists: false,
      cdp_default_port: 0,
      notes: [`Unknown browser: ${name}`],
    };
  }

  const notes = [];

  // 1. Resolve executable
  let executablePath = resolveFromRegistry(def.registry_keys);
  let resolvedVia = executablePath ? 'registry' : '';
  if (!executablePath) {
    executablePath = resolveFromPaths(def.paths);
    if (executablePath) resolvedVia = 'file_path';
  }
  if (!executablePath) {
    executablePath = resolveFromLinuxCommands(def.linux_commands);
    if (executablePath) resolvedVia = 'linux_command';
  }

  const installed = !!executablePath;
  if (!installed) notes.push('Executable not found');
  if (installed && resolvedVia) notes.push(`Resolved via ${resolvedVia}`);

  // 2. Resolve user data
  const userDataPath = resolveUserData(def);
  const userDataExists = !!userDataPath && fs.existsSync(userDataPath);

  // 3. Version
  const version = getVersion(executablePath);

  return {
    name,
    display_name: def.display_name,
    installed,
    version,
    executable_path: executablePath,
    user_data_path: userDataPath,
    user_data_exists: userDataExists,
    cdp_default_port: def.cdp_default_port,
    notes,
  };
}

/**
 * Detect all defined browsers.
 * @returns {{ browsers: object[], platform: string, arch: string }}
 */
function detectAllBrowsers() {
  const browsers = Object.keys(BROWSER_DEFS).map((name) => detectBrowser(name));
  return { browsers, platform, arch: os.arch() };
}

module.exports = { BROWSER_DEFS, detectBrowser, detectAllBrowsers };

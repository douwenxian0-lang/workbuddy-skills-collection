'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const os = require('os');
const { readPid, removePid } = require('./paths.cjs');

/**
 * Cross-platform synchronous sleep using Atomics (no external process needed).
 * @param {number} ms — milliseconds to wait
 */
function sleepSync(ms) {
  const buf = new SharedArrayBuffer(4);
  const arr = new Int32Array(buf);
  Atomics.wait(arr, 0, 0, ms);
}

const platform = os.platform();

// ---------------------------------------------------------------------------
// Process name mappings (used for fallback kill and PID verification)
// ---------------------------------------------------------------------------

const MACOS_APP_NAMES = {
  chrome: 'Google Chrome',
  edge: 'Microsoft Edge',
  qqbrowser: 'QQBrowser',
};

const LINUX_PROCESS_PATTERNS = {
  chrome: ['google-chrome', 'chromium'],
  edge: ['microsoft-edge'],
  qqbrowser: [],
};

const WIN32_PROCESS_NAMES = {
  chrome: 'chrome',
  edge: 'msedge',
  qqbrowser: 'QQBrowser',
};

const WIN32_IMAGE_NAMES = {
  chrome: 'chrome.exe',
  edge: 'msedge.exe',
  qqbrowser: 'QQBrowser.exe',
};

// ---------------------------------------------------------------------------
// Helpers: run system command with fallback to full system path
// ---------------------------------------------------------------------------

/**
 * Run a Windows system command, falling back to full SystemRoot path if bare
 * command is not recognized (rare PATH issue).
 *
 * SECURITY: cmd and args MUST come from hardcoded constants, never user input.
 */
function runWinCmd(cmd, args, options = {}) {
  const opts = { encoding: 'utf8', timeout: 10000, stdio: 'pipe', ...options };
  try {
    return execFileSync(cmd, args, opts);
  } catch (e) {
    const msg = (e.stderr || e.message || '').toLowerCase();
    if (e.code === 'ENOENT' || msg.includes('is not recognized') || msg.includes('not found')) {
      const systemRoot = process.env.SystemRoot || 'C:\\Windows';
      const fullCmd = path.join(systemRoot, 'System32', `${cmd}.exe`);
      return execFileSync(fullCmd, args, opts);
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// PID verification: ensure PID still belongs to the expected browser
// ---------------------------------------------------------------------------

/**
 * Check if a given PID is actually a browser process matching the expected name.
 * Returns true if the PID belongs to the expected browser, false otherwise.
 */
function verifyPidIsBrowser(pid, browserName) {
  try {
    if (platform === 'darwin') {
      const appName = MACOS_APP_NAMES[browserName];
      if (!appName) return false;
      const out = execFileSync('ps', ['-p', String(pid), '-o', 'comm='], { encoding: 'utf8', timeout: 5000, stdio: 'pipe' }).trim();
      return out.toLowerCase().includes(appName.toLowerCase());
    }

    if (platform === 'linux') {
      const out = execFileSync('ps', ['-p', String(pid), '-o', 'comm='], { encoding: 'utf8', timeout: 5000, stdio: 'pipe' }).trim();
      const patterns = LINUX_PROCESS_PATTERNS[browserName] || [];
      return patterns.some((p) => out.toLowerCase().includes(p.toLowerCase()));
    }

    if (platform === 'win32') {
      const imageName = WIN32_IMAGE_NAMES[browserName];
      if (!imageName) return false;
      const out = runWinCmd('tasklist', ['/FI', `PID eq ${pid}`, '/NH']);
      return out.toLowerCase().includes(imageName.toLowerCase());
    }
  } catch { /* process not found or command failed */ }
  return false;
}

// ---------------------------------------------------------------------------
// Post-close verification: is the browser still running?
// ---------------------------------------------------------------------------

function isBrowserStillRunning(browserName) {
  try {
    if (platform === 'win32') {
      const imageName = WIN32_IMAGE_NAMES[browserName];
      if (!imageName) return false;
      const out = runWinCmd('tasklist', ['/FI', `IMAGENAME eq ${imageName}`, '/NH']);
      return out.toLowerCase().includes(imageName.toLowerCase());
    }

    if (platform === 'darwin') {
      const appName = MACOS_APP_NAMES[browserName];
      if (!appName) return false;
      execFileSync('pgrep', ['-f', appName], { timeout: 5000, stdio: 'pipe' });
      return true;
    }

    if (platform === 'linux') {
      const patterns = LINUX_PROCESS_PATTERNS[browserName] || [];
      for (const pattern of patterns) {
        try {
          execFileSync('pgrep', ['-f', pattern], { timeout: 5000, stdio: 'pipe' });
          return true;
        } catch { /* not found */ }
      }
      return false;
    }
  } catch { /* pgrep/tasklist exits non-zero when no process found */ }
  return false;
}

// ---------------------------------------------------------------------------
// Kill helpers
// ---------------------------------------------------------------------------

function killByPid(pid, browserName) {
  try {
    if (platform === 'win32') {
      // /T kills the entire process tree, /F forces termination
      runWinCmd('taskkill', ['/PID', String(pid), '/T', '/F']);
      return true;
    }

    if (platform === 'darwin' || platform === 'linux') {
      // Try SIGTERM first
      try { process.kill(pid, 'SIGTERM'); } catch { return false; }
      try {
        sleepSync(2000);
        process.kill(pid, 0); // still alive?
        // Still alive — force kill
        process.kill(pid, 'SIGKILL');
        sleepSync(500);
        try {
          process.kill(pid, 0); // verify once more
          return false;         // still alive = SIGKILL failed
        } catch {
          return true;          // finally dead
        }
      } catch { /* already dead after SIGTERM — good */ }
      return true;
    }
  } catch { /* kill failed */ }
  return false;
}

function killByNameWin32(browserName) {
  const imageName = WIN32_IMAGE_NAMES[browserName];
  if (!imageName) return false;
  try {
    // Graceful first (WM_CLOSE)
    try { runWinCmd('taskkill', ['/IM', imageName]); } catch { /* may not exist */ }
    // Wait, then force
    sleepSync(3000);
    try { runWinCmd('taskkill', ['/IM', imageName, '/F']); } catch { /* may already be gone */ }
    return true;
  } catch { return false; }
}

function killByNameDarwin(browserName) {
  const appName = MACOS_APP_NAMES[browserName];
  if (!appName) return false;
  // Graceful quit via Apple Events
  try { execFileSync('osascript', ['-e', `quit app "${appName}"`], { timeout: 10000, stdio: 'pipe' }); } catch {}
  // Fallback: pkill for headless processes
  try { execFileSync('pkill', ['-f', appName], { timeout: 5000, stdio: 'pipe' }); } catch {}
  return true;
}

function killByNameLinux(browserName) {
  const patterns = LINUX_PROCESS_PATTERNS[browserName] || [];
  if (patterns.length === 0) return false;
  for (const pattern of patterns) {
    try { execFileSync('pkill', ['-f', pattern], { timeout: 5000, stdio: 'pipe' }); } catch {}
  }
  return true;
}

// ---------------------------------------------------------------------------
// Main close function
// ---------------------------------------------------------------------------

/**
 * Close a browser by name.
 * Strategy: PID file (precise) → fallback by name → post-close verification.
 *
 * @param {string} name — one of 'chrome', 'edge', 'qqbrowser'
 * @returns {{ success: boolean, browser: string, method?: string, error?: string }}
 */
function closeBrowser(name) {
  // CfT is managed by agent-browser, not a standalone process
  if (name === 'cft') {
    return { success: true, browser: name, method: 'skip' };
  }

  let method = 'none';

  try {
    // --- Step 1: Try PID-based kill (precise) ---
    // Note: small TOCTOU window exists between verify and kill. Acceptable risk
    // since PID recycling in this ~1ms gap is astronomically unlikely.
    const pid = readPid(name);
    if (pid) {
      if (verifyPidIsBrowser(pid, name)) {
        killByPid(pid, name);
        method = 'pid';
      } else {
        // PID is stale or belongs to another process — clean up
        method = 'pid_stale';
      }
      removePid(name);
    }

    // --- Step 2: If no PID or PID was stale, fallback to name-based kill ---
    if (method === 'none' || method === 'pid_stale') {
      if (platform === 'win32') {
        killByNameWin32(name);
      } else if (platform === 'darwin') {
        killByNameDarwin(name);
      } else if (platform === 'linux') {
        killByNameLinux(name);
      } else {
        return { success: false, browser: name, error: `Unsupported platform: ${platform}` };
      }
      if (method === 'none') method = 'name';
    }

    // --- Step 3: Post-close verification ---
    // Brief wait for process to exit
    sleepSync(platform === 'win32' ? 2000 : 1000);

    if (isBrowserStillRunning(name)) {
      return { success: false, browser: name, method, error: `${name} 进程仍在运行` };
    }

    return { success: true, browser: name, method };
  } catch (e) {
    return { success: false, browser: name, method, error: e.message };
  }
}

/**
 * Kill only xb-launched browser processes via PID file.
 * Unlike closeBrowser(), does NOT fall back to name-based kill.
 * Safe for init cleanup — won't kill user's daily browser.
 */
function killByPidOnly(name) {
  if (name === 'cft') {
    return { success: true, browser: name, method: 'skip' };
  }

  const pid = readPid(name);
  if (!pid) {
    return { success: true, browser: name, method: 'skip_no_pid' };
  }

  if (!verifyPidIsBrowser(pid, name)) {
    removePid(name);
    return { success: true, browser: name, method: 'skip_stale_pid' };
  }

  killByPid(pid, name);
  removePid(name);

  // Brief wait for process exit
  sleepSync(platform === 'win32' ? 2000 : 1000);

  return { success: true, browser: name, method: 'pid' };
}

module.exports = { closeBrowser, killByPidOnly };

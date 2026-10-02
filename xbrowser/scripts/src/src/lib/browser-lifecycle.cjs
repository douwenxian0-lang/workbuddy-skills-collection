'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');
const { execFileSync, spawn } = require('child_process');
const os = require('os');
const {
  AGENT_BROWSER_BIN, BROWSER_IDS,
  CDP_ALL_PORTS,
  sessionName,
  profileDir, ensureDir,
  savePid, removePid,
} = require('./paths.cjs');
const { detectBrowser, BROWSER_DEFS } = require('./detect-browsers.cjs');
const { findAvailablePort } = require('./find-port.cjs');

const platform = os.platform();

// ---------------------------------------------------------------------------
// Process detection patterns (from v1 browser-status.cjs)
// ---------------------------------------------------------------------------
const PROCESS_PATTERNS = {
  chrome: { darwin_pgrep: 'Google Chrome', linux_pgrep: '(google-chrome|chromium)', win32_process: 'chrome.exe' },
  edge: { darwin_pgrep: 'Microsoft Edge', linux_pgrep: 'microsoft-edge', win32_process: 'msedge.exe' },
  qqbrowser: { darwin_pgrep: 'QQBrowser', linux_pgrep: null, win32_process: 'QQBrowser.exe' },
};

/**
 * Check if a browser process is currently running.
 * @param {string} browserId
 * @returns {boolean}
 */
function isRunning(browserId) {
  const pat = PROCESS_PATTERNS[browserId];
  if (!pat) return false;
  try {
    if (platform === 'darwin') {
      if (!pat.darwin_pgrep) return false;
      execFileSync('pgrep', ['-f', pat.darwin_pgrep], { timeout: 5000, stdio: 'pipe' });
      return true;
    }
    if (platform === 'linux') {
      if (!pat.linux_pgrep) return false;
      execFileSync('pgrep', ['-f', pat.linux_pgrep], { timeout: 5000, stdio: 'pipe' });
      return true;
    }
    if (platform === 'win32') {
      if (!pat.win32_process) return false;
      // SECURITY: pat.win32_process comes from PROCESS_PATTERNS (hardcoded). Never pass user input.
      const out = execFileSync('tasklist', ['/FI', `IMAGENAME eq ${pat.win32_process}`, '/NH'], {
        encoding: 'utf8', timeout: 5000, stdio: 'pipe',
      });
      return out.toLowerCase().includes(pat.win32_process.toLowerCase());
    }
  } catch { /* pgrep exits non-zero when no process found */ }
  return false;
}

// ---------------------------------------------------------------------------
// CDP probing
// ---------------------------------------------------------------------------

/**
 * Probe a CDP port via HTTP GET /json/version.
 * @param {number} port
 * @returns {Promise<{ port: number, browser_version: string, user_agent: string }|null>}
 */
function probeCdpPort(port) {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (val) => { if (!resolved) { resolved = true; resolve(val); } };
    const req = http.get(`http://127.0.0.1:${port}/json/version`, { timeout: 1000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const info = JSON.parse(data);
          done({
            port,
            browser_version: info['Browser'] || '',
            user_agent: info['User-Agent'] || '',
          });
        } catch {
          done(null);
        }
      });
    });
    req.on('error', () => done(null));
    req.on('timeout', () => { req.destroy(); done(null); });
  });
}

/**
 * Identify which browser is behind a CDP endpoint based on user-agent.
 * @param {string} userAgent
 * @returns {string|null} — 'qqbrowser', 'edge', 'chrome', or null
 */
function identifyBrowser(userAgent) {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  if (ua.includes('qqbrowser/')) return 'qqbrowser';
  if (ua.includes('edg/')) return 'edge';
  if (ua.includes('chrome/')) return 'chrome';
  return null;
}

// ---------------------------------------------------------------------------
// Wait for CDP ready
// ---------------------------------------------------------------------------

/**
 * Poll a CDP port until it responds, timeout, or process exits.
 * @param {number} port
 * @param {object} options
 * @param {number} [options.timeoutSec=10] — max seconds to wait
 * @param {function} [options.isExited] — returns true if browser process has exited
 * @returns {Promise<boolean>}
 */
async function waitForCdp(port, options = {}) {
  const { timeoutSec = 10, isExited } = options;
  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    if (isExited && isExited()) return false;
    const result = await probeCdpPort(port);
    if (result) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Browser launch
// ---------------------------------------------------------------------------

/**
 * Launch a local browser with CDP remote debugging enabled.
 * All Chromium-based browsers (Chrome, Edge, QQ Browser) use the same launch parameters.
 * If a browser doesn't support CDP (e.g. QQ Browser on macOS), the process exit
 * detection in waitForCdp will catch it and return a clear error.
 *
 * @param {string} browserId
 * @param {number} port
 * @param {object} [options={}]
 * @param {boolean} [options.headed=false] — true = show GUI window; false = headless
 * @returns {{ launched: boolean, child?: object, error?: string, isExited?: function, getExitCode?: function }}
 */
function launchBrowserWithCdp(browserId, port, options = {}) {
  const { headed = false } = options;

  const info = detectBrowser(browserId);
  if (!info.installed || !info.executable_path) {
    return { launched: false, error: `${info.display_name} 未找到可执行文件` };
  }

  // Use xb-managed per-browser profile directory
  const userDataDir = profileDir(browserId);
  ensureDir(userDataDir);

  // Check for SingletonLock — another instance may be using this profile
  // On macOS this is a symlink; it may be stale after a browser crash
  const lockFile = path.join(userDataDir, 'SingletonLock');
  if (fs.existsSync(lockFile)) {
    // Check if the lock is stale (process no longer exists)
    // On macOS, SingletonLock is a symlink like "<hostname>-<pid>"
    try {
      const target = fs.readlinkSync(lockFile);
      const pidMatch = target.match(/-(\d+)$/);
      if (pidMatch) {
        try {
          process.kill(Number(pidMatch[1]), 0); // Signal 0 = check existence
          // Process is alive — profile is genuinely in use
          return {
            launched: false,
            error: `${info.display_name} 的 profile 目录被其他实例占用 (PID: ${pidMatch[1]})`,
            hint: `请运行 xb stop ${browserId} 关闭浏览器后重试`,
          };
        } catch {
          // Process is dead — stale lock, remove it
          fs.unlinkSync(lockFile);
        }
      }
    } catch {
      // Not a symlink or can't read — try removing it
      try { fs.unlinkSync(lockFile); } catch {}
    }
  }

  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
  ];

  // Headless mode: use --headless (tested: --headless=new does NOT work on macOS)
  if (!headed) {
    args.push('--headless');
  }

  try {
    const child = spawn(info.executable_path, args, {
      detached: true,
      stdio: 'ignore',
    });

    // Persist PID for targeted shutdown later
    if (child.pid) {
      savePid(browserId, child.pid);
    }

    // Track whether the process has exited
    let exited = false;
    let exitCode = null;
    child.on('exit', (code) => {
      exited = true;
      exitCode = code;
      removePid(browserId);
    });
    child.on('error', () => {
      exited = true;
      removePid(browserId);
    });

    // Return child reference for monitoring (caller will unref after CDP ready)
    return { launched: true, child, isExited: () => exited, getExitCode: () => exitCode };
  } catch (e) {
    return { launched: false, error: e.message };
  }
}

/**
 * Scan a list of CDP ports in parallel, return the first port (by input order)
 * that responds AND matches the target browser's identity.
 *
 * @param {string} targetBrowserId — 'chrome', 'edge', 'qqbrowser'
 * @param {number[]} ports — ports to probe
 * @returns {Promise<{ port: number, browser_version: string }|null>}
 */
async function scanCdpPorts(targetBrowserId, ports) {
  if (!ports || ports.length === 0) return null;

  const results = await Promise.allSettled(
    ports.map((port) => probeCdpPort(port))
  );

  for (const r of results) {
    if (r.status !== 'fulfilled' || !r.value) continue;
    const probe = r.value;
    const detected = identifyBrowser(probe.user_agent);
    if (detected === targetBrowserId) {
      return { port: probe.port, browser_version: probe.browser_version };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// ensureConnection
// ---------------------------------------------------------------------------

/**
 * Ensure a browser connection is ready.
 * For CfT: returns profile-based connection (agent-browser handles launch).
 * For local browsers: detect/probe/launch CDP.
 *
 * @param {string} browserId — 'cft', 'chrome', 'edge', 'qqbrowser'
 * @param {object} [config={}]
 * @returns {Promise<object>}
 */
async function ensureConnection(browserId, config = {}) {
  const session = sessionName(browserId);
  const base = { browserId, sessionName: session };

  // CfT: agent-browser manages its own process via --profile
  if (browserId === 'cft') {
    return { ...base, ready: true, connectionType: 'profile', cdpPort: null };
  }

  // Local browsers: CDP-based connection
  const info = detectBrowser(browserId);
  if (!info.installed) {
    return {
      ...base,
      ready: false,
      connectionType: 'cdp',
      cdpPort: null,
      error: `${info.display_name} 未安装`,
      hint: `请安装 ${info.display_name} 后重试`,
    };
  }

  // 1. Probe default port first (fast path)
  const defaultPort = info.cdp_default_port;
  if (defaultPort) {
    const probe = await probeCdpPort(defaultPort);
    if (probe) {
      const detected = identifyBrowser(probe.user_agent);
      if (detected === browserId) {
        return { ...base, ready: true, connectionType: 'cdp', cdpPort: defaultPort };
      }
    }
  }

  // 2. Parallel scan remaining ports
  const remainingPorts = CDP_ALL_PORTS.filter((p) => p !== defaultPort);
  const scanResult = await scanCdpPorts(browserId, remainingPorts);
  if (scanResult) {
    return { ...base, ready: true, connectionType: 'cdp', cdpPort: scanResult.port };
  }

  // 3. No active CDP — check if browser is running without CDP
  if (isRunning(browserId)) {
    return {
      ...base,
      ready: false,
      connectionType: 'cdp',
      cdpPort: null,
      error: `${info.display_name} 正在运行但未启用 CDP 远程调试`,
      hint: `请保存数据后关闭 ${info.display_name}，或运行 xb stop ${browserId} 关闭后重新执行`,
    };
  }

  // 4. Browser not running — find port, launch, wait
  const portResult = await findAvailablePort();
  if (!portResult.available) {
    return {
      ...base,
      ready: false,
      connectionType: 'cdp',
      cdpPort: null,
      error: '没有可用的 CDP 端口',
      hint: '请释放端口或关闭其他调试会话',
    };
  }

  const launchResult = launchBrowserWithCdp(browserId, portResult.port, { headed: config.headed || false });
  if (!launchResult.launched) {
    return {
      ...base,
      ready: false,
      connectionType: 'cdp',
      cdpPort: null,
      error: `启动 ${info.display_name} 失败: ${launchResult.error}`,
      hint: launchResult.hint || '检查浏览器是否可访问，或 profile 目录是否被占用',
    };
  }

  // Wait for CDP with process exit detection (10 second timeout)
  const cdpReady = await waitForCdp(portResult.port, {
    timeoutSec: 10,
    isExited: launchResult.isExited,
  });

  if (!cdpReady) {
    if (launchResult.child) {
      try { launchResult.child.unref(); } catch {}
    }

    if (launchResult.isExited && launchResult.isExited()) {
      return {
        ...base,
        ready: false,
        connectionType: 'cdp',
        cdpPort: portResult.port,
        error: `${info.display_name} 启动后立即退出 (exit code: ${launchResult.getExitCode()})`,
        hint: '可能是 profile 目录被占用或浏览器异常，请运行 xb stop ' + browserId + ' 后重试',
      };
    }

    return {
      ...base,
      ready: false,
      connectionType: 'cdp',
      cdpPort: portResult.port,
      error: `${info.display_name} 已启动但 CDP 端口 ${portResult.port} 未就绪（等待 10s 超时）`,
      hint: '浏览器可能还在加载中，请稍后重新执行 xb run 命令',
    };
  }

  // CDP is ready — detach the child process so it outlives xb
  if (launchResult.child) {
    try { launchResult.child.unref(); } catch {}
  }

  return { ...base, ready: true, connectionType: 'cdp', cdpPort: portResult.port };
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

/**
 * Close an agent-browser session for a specific browser.
 * @param {string} browserId
 * @returns {{ success: boolean, browserId: string, session: string, error?: string }}
 */
function closeSession(browserId) {
  const session = sessionName(browserId);
  try {
    execFileSync(AGENT_BROWSER_BIN, ['--json', '--session', session, 'close', '--all'], {
      timeout: 10000, stdio: 'pipe',
    });
    return { success: true, browserId, session };
  } catch (e) {
    return { success: false, browserId, session, error: e.message };
  }
}

/**
 * Close all known browser sessions.
 * @returns {Array<{ success: boolean, browserId: string, session: string, error?: string }>}
 */
function closeAllSessions() {
  return BROWSER_IDS.map((id) => closeSession(id));
}

module.exports = {
  ensureConnection,
  closeSession,
  closeAllSessions,
  // Exported for testing / reuse by other modules
  probeCdpPort,
  identifyBrowser,
  scanCdpPorts,
  isRunning,
  waitForCdp,
  launchBrowserWithCdp,
};

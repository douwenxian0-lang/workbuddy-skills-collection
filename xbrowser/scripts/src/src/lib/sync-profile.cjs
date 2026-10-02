'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const { profileDir, ensureDir, LOCAL_BROWSER_IDS } = require('./paths.cjs');
const browserLifecycle = require('./browser-lifecycle.cjs');
const detectBrowsers = require('./detect-browsers.cjs');

const platform = os.platform();

// Directories excluded from profile sync (caches, temp storage, crash data)
const EXCLUDE_DIRS = [
  'Cache', 'Code Cache', 'DawnCache', 'GPUCache', 'GrShaderCache',
  'ShaderCache', 'Service Worker', 'blob_storage', 'Session Storage',
  'File System', 'BrowserMetrics', 'Crashpad',
];

// Files excluded from profile sync (lock files)
const EXCLUDE_FILES = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];

/** Valid browser IDs for profile migration (CfT excluded — managed by agent-browser). */
const MIGRATABLE_IDS = [...LOCAL_BROWSER_IDS];

/**
 * Copy a browser's local profile into xb's per-browser profile directory,
 * excluding caches and lock files.
 *
 * @param {string} browserId — a valid migratable browser ID (see MIGRATABLE_IDS)
 * @param {string} [sourcePath] — override source; auto-detected if omitted
 * @returns {{ success: boolean, browserId: string, source: string, dest: string, error?: string, hint?: string }}
 */
function syncProfile(browserId, sourcePath) {
  const dest = profileDir(browserId);
  const base = { success: false, browserId, source: '', dest };

  // 1. Validate browserId
  if (browserId === 'cft') {
    return { ...base, error: 'CfT profiles are managed by agent-browser, not migrated', hint: 'Use chrome, edge, or qqbrowser' };
  }
  if (!MIGRATABLE_IDS.includes(browserId)) {
    return { ...base, error: `Unknown browser: ${browserId}`, hint: `Valid browsers: ${MIGRATABLE_IDS.join(', ')}` };
  }

  // 2. Resolve source path
  let source = sourcePath;
  if (!source) {
    const info = detectBrowsers.detectBrowser(browserId);
    source = info.user_data_path;
  }
  base.source = source || '';

  // 3. Validate source exists
  if (!source || !fs.existsSync(source)) {
    return { ...base, error: 'Source profile not found', hint: 'Check if browser is installed' };
  }

  // 4. Check if browser is running → return early, let caller handle
  if (browserLifecycle.isRunning(browserId)) {
    const browserName = detectBrowsers.detectBrowser(browserId).display_name || browserId;
    return {
      ...base,
      source,
      running: true,
      error: `${browserName} 正在运行，需要先关闭浏览器才能迁移数据`,
      hint: `xb guide close-browser --browser ${browserId}`,
    };
  }

  // 5. Ensure dest directory
  ensureDir(dest);

  // 6. Copy profile using platform-specific tool
  try {
    if (platform === 'win32') {
      const robocopyArgs = [source, dest, '/MIR', '/XD', ...EXCLUDE_DIRS, '/XF', ...EXCLUDE_FILES];
      execFileSync('robocopy', robocopyArgs, { timeout: 300000, stdio: 'pipe' });
    } else {
      // macOS / Linux: rsync
      const rsyncArgs = ['-a', '--delete'];
      EXCLUDE_DIRS.forEach(d => rsyncArgs.push('--exclude', d));
      EXCLUDE_FILES.forEach(f => rsyncArgs.push('--exclude', f));
      rsyncArgs.push(`${source}/`, `${dest}/`);
      execFileSync('rsync', rsyncArgs, { timeout: 300000, stdio: 'pipe' });
    }
  } catch (e) {
    // robocopy exit codes 0-7 are success on Windows
    if (platform === 'win32' && e.status != null && e.status >= 0 && e.status <= 7) {
      // success — fall through
    } else {
      // Copy failed — attempt rollback if dest was created by us
      try {
        if (fs.existsSync(dest)) {
          fs.rmSync(dest, { recursive: true, force: true });
        }
      } catch { /* rollback best-effort */ }
      return { ...base, source, error: `Profile copy failed: ${e.message}`, hint: 'Check disk space and permissions' };
    }
  }

  // 7. Success
  return { success: true, browserId, source, dest };
}

module.exports = { syncProfile, EXCLUDE_DIRS, EXCLUDE_FILES, MIGRATABLE_IDS };

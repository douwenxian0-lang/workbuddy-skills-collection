# Eliminate Shell-String execSync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all `execSync` shell-string calls with `execFileSync` + array args to fix URL truncation and Windows element reference bugs, and harden the entire codebase against shell metacharacter issues.

**Architecture:** Convert 9 source files from `execSync(cmdString)` to `execFileSync(binary, argsArray)`. The foundation change is in `paths.cjs` which switches `AGENT_BROWSER_BIN` from a `.bin/` shim to the platform-native binary. All downstream consumers then use `execFileSync` with array args. No shell is involved in any subprocess call.

**Tech Stack:** Node.js (CJS), node:test framework, `child_process.execFileSync`

**Spec:** `docs/superpowers/specs/2026-04-17-fix-shell-metachar-truncation-design.md`

---

## File Structure

### Source files modified (9):
- `src/lib/paths.cjs` — Foundation: native binary resolution, `isMusl()`, `getNativeBinaryName()`
- `src/commands/run.cjs` — Core bug fix: `execFileSync` for action execution
- `src/commands/setup.cjs` — Remove `createBinShim()`, `execFileSync` for install
- `src/lib/preflight.cjs` — `execFileSync` for version check
- `src/commands/version.cjs` — `execFileSync` for version display
- `src/lib/browser-lifecycle.cjs` — `execFileSync` for close session + `isRunning()`
- `src/lib/close-browser.cjs` — `execFileSync` for all process management
- `src/lib/detect-browsers.cjs` — `execFileSync` for registry/powershell/defaults/which
- `src/lib/sync-profile.cjs` — `execFileSync` for robocopy/rsync

### Test files modified/created (8):
- `test/lib/paths.test.cjs` — Add tests for new exports
- `test/commands/run.test.cjs` — Update mock expectations
- `test/commands/setup.test.cjs` — Remove createBinShim refs
- `test/commands/init.test.cjs` — Update dummy bin path format
- `test/lib/browser-lifecycle.test.cjs` — Update mock expectations
- `test/lib/preflight.test.cjs` — Verify still passes
- `test/lib/sync-profile.test.cjs` — Update mock expectations
- `test/lib/close-browser.test.cjs` — NEW: unit tests for converted calls

---

### Task 1: Foundation — `paths.cjs` native binary resolution

**Files:**
- Modify: `src/lib/paths.cjs:16-17`
- Test: `test/lib/paths.test.cjs`

- [ ] **Step 1: Write failing tests for new exports**

Add to `test/lib/paths.test.cjs`:

```javascript
const os = require('os');

describe('AGENT_BROWSER_BIN', () => {
  it('points to native binary under node_modules/agent-browser/bin/', () => {
    const { AGENT_BROWSER_BIN } = require('../../src/lib/paths.cjs');
    assert.ok(AGENT_BROWSER_BIN.includes(path.join('node_modules', 'agent-browser', 'bin')),
      `Expected native binary path, got: ${AGENT_BROWSER_BIN}`);
    assert.ok(!AGENT_BROWSER_BIN.includes('.bin'),
      'Should not point to .bin/ shim');
  });
});

describe('AGENT_BROWSER_IS_NATIVE', () => {
  it('is exported as a boolean', () => {
    const { AGENT_BROWSER_IS_NATIVE } = require('../../src/lib/paths.cjs');
    assert.equal(typeof AGENT_BROWSER_IS_NATIVE, 'boolean');
  });

  it('is true on supported platforms (darwin/linux/win32 with x64/arm64)', () => {
    const { AGENT_BROWSER_IS_NATIVE } = require('../../src/lib/paths.cjs');
    const p = os.platform();
    const a = os.arch();
    if (['darwin', 'linux', 'win32'].includes(p) && ['x64', 'arm64'].includes(a)) {
      assert.equal(AGENT_BROWSER_IS_NATIVE, true);
    }
  });
});

describe('getNativeBinaryName()', () => {
  // getNativeBinaryName is not exported, but we can verify via AGENT_BROWSER_BIN
  it('produces correct binary name for current platform', () => {
    const { AGENT_BROWSER_BIN } = require('../../src/lib/paths.cjs');
    const basename = path.basename(AGENT_BROWSER_BIN);
    const p = os.platform();
    const a = os.arch();
    if (p === 'darwin' && a === 'arm64') {
      assert.equal(basename, 'agent-browser-darwin-arm64');
    } else if (p === 'darwin' && a === 'x64') {
      assert.equal(basename, 'agent-browser-darwin-x64');
    } else if (p === 'win32') {
      assert.equal(basename, 'agent-browser-win32-x64.exe');
    } else if (p === 'linux' && a === 'x64') {
      assert.ok(basename === 'agent-browser-linux-x64' || basename === 'agent-browser-linux-musl-x64');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/lib/paths.test.cjs`
Expected: FAIL — `AGENT_BROWSER_BIN` still points to `.bin/`, `AGENT_BROWSER_IS_NATIVE` not exported.

- [ ] **Step 3: Implement native binary resolution in `paths.cjs`**

Replace lines 16-17 of `src/lib/paths.cjs`:

```javascript
// DELETE these two lines:
// const AGENT_BROWSER_BIN_NAME = os.platform() === 'win32' ? 'agent-browser.cmd' : 'agent-browser';
// const AGENT_BROWSER_BIN = path.join(XBROWSER_DIR, 'node_modules', '.bin', AGENT_BROWSER_BIN_NAME);

// ADD: musl detection (pure filesystem, no child_process)
function isMusl() {
  if (os.platform() !== 'linux') return false;
  try {
    const files = fs.readdirSync('/lib');
    return files.some(f => f.startsWith('ld-musl-'));
  } catch {
    return false;
  }
}

// ADD: platform-to-binary mapping (logic from agent-browser.js)
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
```

Update `module.exports` to include `AGENT_BROWSER_IS_NATIVE`:

```javascript
module.exports = {
  stateDir, XBROWSER_DIR, PROFILES_DIR, PIDS_DIR, CONFIG_PATH, VERSION_PATH,
  AGENT_BROWSER_BIN, AGENT_BROWSER_IS_NATIVE, AGENT_BROWSER_VERSION, CLI_VERSION, BROWSER_IDS,
  CDP_CANDIDATE_PORTS, CDP_FALLBACK_PORTS, CDP_ALL_PORTS,
  profileDir, sessionName, ensureDir, compareVersions,
  pidFile, savePid, readPid, removePid,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/lib/paths.test.cjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/paths.cjs test/lib/paths.test.cjs
git commit -m "refactor(paths): resolve AGENT_BROWSER_BIN to native binary, remove .bin shim path"
```

---

### Task 2: Core fix — `run.cjs` execFileSync

**Files:**
- Modify: `src/commands/run.cjs:3,134-142`
- Test: `test/commands/run.test.cjs`

- [ ] **Step 1: Modify `run.cjs`**

In `src/commands/run.cjs`:

Line 3 — change require:
```javascript
const { execFileSync } = require('child_process');
```

Delete lines 134-137 (the `const cmd = ...` block with quoting regex). Keep `let stdout = ''` and `let stderr = ''` declarations at lines 139-140. Replace line 142 `execSync(cmd, ...)` with `execFileSync(AGENT_BROWSER_BIN, engineArgs, ...)` — same options object, same catch block:

```javascript
    stdout = execFileSync(AGENT_BROWSER_BIN, engineArgs, {
      encoding: 'utf8',
      timeout: engineTimeout + 5000,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, AGENT_BROWSER_DEFAULT_TIMEOUT: String(engineTimeout) },
    });
```

The `AGENT_BROWSER_IS_NATIVE` fallback pattern from the spec is not implemented at each call site. Instead, all 7 supported platforms (darwin-arm64, darwin-x64, linux-x64, linux-musl-x64, linux-arm64, linux-musl-arm64, win32-x64) have native binaries. On unsupported platforms, `preflight.cjs`'s `checkCli()` will fail `fs.existsSync(AGENT_BROWSER_BIN)` (the JS wrapper path won't exist after fresh install targeting the native binary) and return a clear error before any `execFileSync` call is reached. The `AGENT_BROWSER_IS_NATIVE` export remains useful for diagnostic/status commands.

- [ ] **Step 2: Run the specific test file**

Run: `node --test test/commands/run.test.cjs`
Expected: PASS. Note: existing tests use real system calls, not child_process mocks, so the `execSync` → `execFileSync` change is transparent to them.

- [ ] **Step 3: Commit**

```bash
git add src/commands/run.cjs
git commit -m "fix(run): use execFileSync with array args, eliminate shell metachar truncation"
```

---

### Task 3: Update `init.test.cjs` dummy bin path

**Files:**
- Modify: `test/commands/init.test.cjs:30-34`

- [ ] **Step 1: Read and update `init.test.cjs`**

Find lines 30-34 where the dummy bin is created at the `.bin/` path format. Update to create the dummy at the new native binary path format (`node_modules/agent-browser/bin/agent-browser-{platform}-{arch}`).

- [ ] **Step 2: Run test**

Run: `node --test test/commands/init.test.cjs`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add test/commands/init.test.cjs
git commit -m "test(init): update dummy bin path to match native binary resolution"
```

---

### Task 4: Cleanup — `setup.cjs` remove shim + execFileSync

**Files:**
- Modify: `src/commands/setup.cjs:3,18-36,103,123-127,152`
- Test: `test/commands/setup.test.cjs`

- [ ] **Step 1: Modify `setup.cjs`**

Line 3 — change require:
```javascript
const { execFileSync } = require('child_process');
```

Delete `createBinShim()` function (lines 18-36).

Delete line 103 (`createBinShim(XBROWSER_DIR);`).

Replace lines 123-127 (the `withDeps` variable + `execSync` install call):
```javascript
      const installArgs = ['--json', 'install'];
      if (os.platform() === 'linux') installArgs.push('--with-deps');
      execFileSync(AGENT_BROWSER_BIN, installArgs, {
        stdio: ['pipe', 'pipe', 'inherit'],
        timeout: 300000,
      });
```

Update `module.exports` — remove `createBinShim`:
```javascript
module.exports = { setupCommand };
```

- [ ] **Step 2: Run tests**

Run: `node --test test/commands/setup.test.cjs`
Expected: PASS. Tests don't mock child_process; `createBinShim` wasn't imported by tests.

- [ ] **Step 3: Commit**

```bash
git add src/commands/setup.cjs
git commit -m "refactor(setup): remove createBinShim, use execFileSync for browser install"
```

---

### Task 5: Simple conversions — `preflight.cjs`, `version.cjs`

**Files:**
- Modify: `src/lib/preflight.cjs:3,20`
- Modify: `src/commands/version.cjs:4,11`
- Test: `test/lib/preflight.test.cjs`, `test/commands/version.test.cjs`

- [ ] **Step 1: Modify `preflight.cjs`**

Line 3 — change require:
```javascript
const { execFileSync } = require('child_process');
```

Line 20 — replace:
```javascript
      version = execFileSync(AGENT_BROWSER_BIN, ['--version'], {
        encoding: 'utf8', timeout: 10000,
      }).trim();
```

- [ ] **Step 2: Modify `version.cjs`**

Line 4 — change require:
```javascript
const { execFileSync } = require('child_process');
```

Line 11 — replace the `execSync` call with:
```javascript
    engine = execFileSync(AGENT_BROWSER_BIN, ['--version'], {
      encoding: 'utf8', timeout: 10000,
    }).trim();
```

- [ ] **Step 3: Run tests**

Run: `node --test test/lib/preflight.test.cjs test/commands/version.test.cjs`
Expected: PASS. Tests use real system calls, no mock updates needed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/preflight.cjs src/commands/version.cjs
git commit -m "refactor(preflight,version): use execFileSync for agent-browser version check"
```

---

### Task 6: `browser-lifecycle.cjs` — full conversion

**Files:**
- Modify: `src/lib/browser-lifecycle.cjs:6,40,45,51,401`
- Test: `test/lib/browser-lifecycle.test.cjs`

- [ ] **Step 1: Modify `browser-lifecycle.cjs`**

Line 6 — change require (remove `execSync`, add `execFileSync`):
```javascript
const { execFileSync, spawn } = require('child_process');
```

Line 40 (darwin pgrep in `isRunning()`):
```javascript
      execFileSync('pgrep', ['-f', pat.darwin_pgrep], { timeout: 5000, stdio: 'pipe' });
```

Line 45 (linux pgrep in `isRunning()`):
```javascript
      execFileSync('pgrep', ['-f', pat.linux_pgrep], { timeout: 5000, stdio: 'pipe' });
```

Line 51 (win32 tasklist in `isRunning()`):
```javascript
      const out = execFileSync('tasklist', ['/FI', `IMAGENAME eq ${pat.win32_process}`, '/NH'], {
        encoding: 'utf8', timeout: 5000, stdio: 'pipe',
      });
```

Line 401 (`closeSession()`):
```javascript
    execFileSync(AGENT_BROWSER_BIN, ['--json', '--session', session, 'close', '--all'], {
      timeout: 10000, stdio: 'pipe',
    });
```

- [ ] **Step 2: Run tests**

Run: `node --test test/lib/browser-lifecycle.test.cjs`
Expected: PASS. Tests use real system calls, no mock updates needed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/browser-lifecycle.cjs
git commit -m "refactor(browser-lifecycle): replace all execSync with execFileSync"
```

---

### Task 7: `close-browser.cjs` — full conversion

**Files:**
- Modify: `src/lib/close-browser.cjs` (all `execSync` calls)
- Create: `test/lib/close-browser.test.cjs`

- [ ] **Step 1: Write test file for `close-browser.cjs`**

Create `test/lib/close-browser.test.cjs`:

```javascript
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// We test the module's exported functions indirectly.
// Direct testing of internal functions like runWinCmd requires
// the module to be loaded, which triggers platform-specific code paths.

describe('close-browser module', () => {
  it('exports closeBrowser and killByPidOnly', () => {
    const mod = require('../../src/lib/close-browser.cjs');
    assert.equal(typeof mod.closeBrowser, 'function');
    assert.equal(typeof mod.killByPidOnly, 'function');
  });

  it('closeBrowser returns skip for cft', () => {
    const { closeBrowser } = require('../../src/lib/close-browser.cjs');
    const result = closeBrowser('cft');
    assert.equal(result.success, true);
    assert.equal(result.method, 'skip');
  });

  it('killByPidOnly returns skip for cft', () => {
    const { killByPidOnly } = require('../../src/lib/close-browser.cjs');
    const result = killByPidOnly('cft');
    assert.equal(result.success, true);
    assert.equal(result.method, 'skip');
  });

  it('killByPidOnly returns skip_no_pid when no PID file exists', () => {
    const { killByPidOnly } = require('../../src/lib/close-browser.cjs');
    const result = killByPidOnly('chrome');
    assert.equal(result.success, true);
    assert.equal(result.method, 'skip_no_pid');
  });
});
```

- [ ] **Step 2: Run test to verify it passes with current code**

Run: `node --test test/lib/close-browser.test.cjs`
Expected: PASS (baseline).

- [ ] **Step 3: Modify `close-browser.cjs`**

Line 3 — change require:
```javascript
const { execFileSync } = require('child_process');
```

Rewrite `runWinCmd()` (lines 58-71):
```javascript
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
```

Convert `verifyPidIsBrowser()` (lines 81-104):
- Line 86: `execFileSync('ps', ['-p', String(pid), '-o', 'comm='], { encoding: 'utf8', timeout: 5000, stdio: 'pipe' })`
- Line 91: same as line 86
- Line 99: `runWinCmd('tasklist', ['/FI', `PID eq ${pid}`, '/NH'])`

Convert `isBrowserStillRunning()` (lines 110-138):
- Line 115: `runWinCmd('tasklist', ['/FI', `IMAGENAME eq ${imageName}`, '/NH'])`
- Line 122: `execFileSync('pgrep', ['-f', appName], { timeout: 5000, stdio: 'pipe' })`
- Line 130: `execFileSync('pgrep', ['-f', pattern], { timeout: 5000, stdio: 'pipe' })`

Convert `killByPid()` (line 148):
- `runWinCmd('taskkill', ['/PID', String(pid), '/T', '/F'])`

Convert `killByNameWin32()` (lines 173, 176):
- Line 173: `runWinCmd('taskkill', ['/IM', imageName])`
- Line 176: `runWinCmd('taskkill', ['/IM', imageName, '/F'])`

Convert `killByNameDarwin()` (lines 185, 187):
- Line 185: `execFileSync('osascript', ['-e', `quit app "${appName}"`], { timeout: 10000, stdio: 'pipe' })`
- Line 187: `execFileSync('pkill', ['-f', appName], { timeout: 5000, stdio: 'pipe' })`

Convert `killByNameLinux()` (line 195):
- `execFileSync('pkill', ['-f', pattern], { timeout: 5000, stdio: 'pipe' })`

- [ ] **Step 4: Run tests**

Run: `node --test test/lib/close-browser.test.cjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/close-browser.cjs test/lib/close-browser.test.cjs
git commit -m "refactor(close-browser): replace all execSync with execFileSync, rewrite runWinCmd"
```

---

### Task 8: `detect-browsers.cjs` — full conversion

**Files:**
- Modify: `src/lib/detect-browsers.cjs:3,95,108,140,182,189-191,196`
- Test: `test/lib/detect-browsers.test.cjs`

- [ ] **Step 1: Modify `detect-browsers.cjs`**

Line 3 — change require:
```javascript
const { execFileSync } = require('child_process');
```

`resolveFromRegistry()` — line 95:
```javascript
      const out = execFileSync('reg', ['query', key, '/ve'], { encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
```

Line 104-108 — update error detection and fallback:
```javascript
      const msg = (e.stderr || e.message || '').toLowerCase();
      if (e.code === 'ENOENT' || msg.includes('is not recognized') || msg.includes('not found')) {
        const systemRoot = process.env.SystemRoot || 'C:\\Windows';
        const regExe = path.join(systemRoot, 'System32', 'reg.exe');
        try {
          const out = execFileSync(regExe, ['query', key, '/ve'], { encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
```

`resolveFromLinuxCommands()` — line 140:
```javascript
      const p = execFileSync('which', [cmd], { encoding: 'utf8', timeout: 5000 }).trim();
```

`getVersion()` — line 182 (macOS):
```javascript
        const out = execFileSync('defaults', ['read', plistPath, 'CFBundleShortVersionString'], {
          encoding: 'utf8', timeout: 5000,
        }).trim();
```

Lines 189-191 (Windows PowerShell):
```javascript
      const out = execFileSync('powershell', ['-Command',
        `(Get-Item '${executablePath.replace(/'/g, "''")}').VersionInfo.ProductVersion`
      ], { encoding: 'utf8', timeout: 5000 }).trim();
```

Line 196 (Linux):
```javascript
      const out = execFileSync(executablePath, ['--version'], { encoding: 'utf8', timeout: 5000 }).trim();
```

- [ ] **Step 2: Run tests**

Run: `node --test test/lib/detect-browsers.test.cjs`
Expected: PASS. Tests use real system calls. Note: `which` might not be available on minimal Linux containers, but the existing `try/catch` handles this gracefully (falls through to filesystem path resolution).

- [ ] **Step 3: Commit**

```bash
git add src/lib/detect-browsers.cjs
git commit -m "refactor(detect-browsers): replace all execSync with execFileSync, command -v to which"
```

---

### Task 9: `sync-profile.cjs` — full conversion

**Files:**
- Modify: `src/lib/sync-profile.cjs:3,75-92`
- Test: `test/lib/sync-profile.test.cjs`

- [ ] **Step 1: Modify `sync-profile.cjs`**

Line 3 — change require:
```javascript
const { execFileSync } = require('child_process');
```

Replace lines 75-92 (the platform-specific copy block):
```javascript
    if (platform === 'win32') {
      const robocopyArgs = [source, dest, '/MIR', '/XD', ...EXCLUDE_DIRS, '/XF', ...EXCLUDE_FILES];
      const result = execFileSync('robocopy', robocopyArgs, { timeout: 300000, stdio: 'pipe' });
    } else {
      // macOS / Linux: rsync
      const rsyncArgs = ['-a', '--delete'];
      EXCLUDE_DIRS.forEach(d => rsyncArgs.push('--exclude', d));
      EXCLUDE_FILES.forEach(f => rsyncArgs.push('--exclude', f));
      rsyncArgs.push(`${source}/`, `${dest}/`);
      execFileSync('rsync', rsyncArgs, { timeout: 300000, stdio: 'pipe' });
    }
```

The catch block (lines 94-107) remains unchanged — `execFileSync` throws with the same `.status` property.

- [ ] **Step 2: Run tests**

Run: `node --test test/lib/sync-profile.test.cjs`
Expected: PASS. The "real sync" test actually runs rsync — `execFileSync('rsync', [...])` works the same way.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sync-profile.cjs
git commit -m "refactor(sync-profile): replace execSync with execFileSync for robocopy/rsync"
```

---

### Task 10: Final verification — full test suite + build

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `node --test test/**/*.test.cjs`
Expected: All tests pass.

- [ ] **Step 2: Verify no execSync remains in src/**

Run: `grep -r "execSync" src/ --include="*.cjs" -l`
Expected: No files listed.

- [ ] **Step 3: Build the bundle**

Run: `node build.cjs`
Expected: Build succeeds.

- [ ] **Step 4: Final commit (if any remaining fixes)**

```bash
git add -A
git commit -m "chore: final verification — zero execSync in src/"
```

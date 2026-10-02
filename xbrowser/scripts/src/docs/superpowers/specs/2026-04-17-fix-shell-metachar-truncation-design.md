# Fix: Eliminate Shell-String execSync Across xbrowser Codebase

**Date**: 2026-04-17
**Scope**: xbrowser-src (claw-skills/xbrowser-src)
**Status**: Draft

## Problem

`run.cjs` uses `execSync(cmd)` with string concatenation to invoke agent-browser. The quoting regex `/[\s"']/` only protects arguments containing spaces or quotes. URLs and CSS selectors typically don't match, so they're spliced raw into the shell command string.

- **macOS/Linux**: `/bin/sh` interprets `&` as background operator, truncating `&q=...` from URLs. `?`, `%`, `#` also at risk.
- **Windows**: `cmd.exe` interprets `&`, `|`, `<`, `>`, `^`, `%`, `!`, `(`, `)`, breaking CSS selectors and Chinese parameters.

**Reported symptoms**:
1. `xb run open 'https://zhihu.com/search?type=content&q=%E5%A4%A7%E6%A8%A1%E5%9E%8B'` — `&q=` value lost
2. Windows: element reference operations (selectors with brackets, Chinese text) fail

**Root cause location**: `src/commands/run.cjs:134-142`

```javascript
const cmd = `"${AGENT_BROWSER_BIN}" ${engineArgs.map(a => {
  if (/[\s"']/.test(a) || a === '') return `"${a.replace(/"/g, '\\"')}"`;
  return a;
}).join(' ')}`;
stdout = execSync(cmd, { ... });
```

## Solution

Replace all `execSync` shell-string calls to agent-browser with `execFileSync` + array args, targeting the platform-native binary directly. Remove the now-unnecessary `.bin/` shim infrastructure.

### Current call chain

```
run.cjs → execSync(cmdString) → shell → .bin/agent-browser (shim) → agent-browser.js (node) → spawn(nativeBinary)
```

### New call chain

```
run.cjs → execFileSync(nativeBinary, argsArray) → nativeBinary
```

## Detailed Changes

### 1. `src/lib/paths.cjs` — Native binary path resolution

**Delete**:
- `AGENT_BROWSER_BIN_NAME` constant (line 16)
- Old `AGENT_BROWSER_BIN` pointing to `.bin/` (line 17)

**Add**:
- `isMusl()` function — detects musl libc on Linux via filesystem check (`/lib/ld-musl-*.so.1`), avoiding `execSync` to keep `paths.cjs` shell-free
- `getNativeBinaryName()` function — maps `os.platform()` + `os.arch()` to binary filename (logic from `agent-browser.js:31-66`)
- New `AGENT_BROWSER_BIN` — resolves to `{XBROWSER_DIR}/node_modules/agent-browser/bin/agent-browser-{os}-{arch}[.exe]`
- Fallback: if `getNativeBinaryName()` returns null (unsupported platform), fall back to `node_modules/agent-browser/bin/agent-browser.js` (the JS wrapper itself, NOT the .bin/ shim)
- **New export**: `AGENT_BROWSER_IS_NATIVE` boolean — indicates whether `AGENT_BROWSER_BIN` points to a native binary or the JS wrapper. Call sites use this to decide invocation strategy (see Fallback Strategy below).

**Supported platforms** (matching agent-browser package):

| os.platform() | os.arch() | Binary name |
|---|---|---|
| darwin | arm64 | agent-browser-darwin-arm64 |
| darwin | x64 | agent-browser-darwin-x64 |
| linux | x64 | agent-browser-linux-x64 |
| linux (musl) | x64 | agent-browser-linux-musl-x64 |
| linux | arm64 | agent-browser-linux-arm64 |
| linux (musl) | arm64 | agent-browser-linux-musl-arm64 |
| win32 | x64 | agent-browser-win32-x64.exe |

**Exports**: `AGENT_BROWSER_BIN` name unchanged — all consumers keep the same import. New `AGENT_BROWSER_IS_NATIVE` boolean export added.

**Fallback strategy**: `execFileSync` on a `.js` file requires a shebang + executable permission on Unix, and doesn't work at all on Windows (no shebang support). To handle the fallback path safely, `paths.cjs` exports a helper:

```javascript
const AGENT_BROWSER_IS_NATIVE = !!NATIVE_BIN_NAME;

// All call sites use this pattern:
if (AGENT_BROWSER_IS_NATIVE) {
  execFileSync(AGENT_BROWSER_BIN, args, opts);
} else {
  // JS wrapper fallback — invoke via node explicitly
  execFileSync(process.execPath, [AGENT_BROWSER_BIN, ...args], opts);
}
```

This ensures the fallback works on all platforms without relying on shebang or file permissions.

**`isMusl()` implementation note**: Unlike upstream `agent-browser.js` which uses `execSync('ldd --version')`, we use a pure filesystem check (`fs.readdirSync('/lib')` looking for `ld-musl-*` entries). This avoids introducing `execSync` into `paths.cjs`, keeping it free of `child_process` dependency. On macOS/Windows, `isMusl()` returns `false` immediately.

```javascript
function isMusl() {
  if (os.platform() !== 'linux') return false;
  try {
    const files = fs.readdirSync('/lib');
    return files.some(f => f.startsWith('ld-musl-'));
  } catch {
    return false;
  }
}
```

### 2. `src/commands/run.cjs` — Core fix

**Line 3**: Change `const { execSync } = require('child_process')` to `const { execFileSync } = require('child_process')`

**Delete lines 134-137**: Remove shell command string construction (the `const cmd = ...` block with quoting regex).

**Replace line 142**: `execSync(cmd, {...})` → `execFileSync(AGENT_BROWSER_BIN, engineArgs, {...})`

The options object (`encoding`, `timeout`, `maxBuffer`, `env`) and the catch block (lines 148-151 reading `e.stdout`/`e.stderr`) remain unchanged — `execFileSync` error objects have the same structure.

### 3. `src/commands/setup.cjs` — Remove shim + fix call

**Delete**: `createBinShim()` function (lines 18-36) — no longer needed.

**Delete**: Line 103 `createBinShim(XBROWSER_DIR)` call.

**Line 124**: Change from:
```javascript
execSync(`"${AGENT_BROWSER_BIN}" --json install${withDeps}`, {
  stdio: ['pipe', 'pipe', 'inherit'],
  timeout: 300000,
});
```
To:
```javascript
const installArgs = ['--json', 'install'];
if (os.platform() === 'linux') installArgs.push('--with-deps');
execFileSync(AGENT_BROWSER_BIN, installArgs, {
  stdio: ['pipe', 'pipe', 'inherit'],
  timeout: 300000,
});
```

**Line 3**: Change `execSync` to `execFileSync` in require.

**Line 152**: Remove `createBinShim` from `module.exports`.

### 4. `src/lib/preflight.cjs` — Unify call

**Line 3**: Change require to `execFileSync`.

**Line 20**: Change from:
```javascript
version = execSync(`"${AGENT_BROWSER_BIN}" --version`, {
  encoding: 'utf8', timeout: 10000,
}).trim();
```
To:
```javascript
version = execFileSync(AGENT_BROWSER_BIN, ['--version'], {
  encoding: 'utf8', timeout: 10000,
}).trim();
```

**Line 16**: `fs.existsSync(AGENT_BROWSER_BIN)` remains — path changed but logic is the same.

### 5. `src/commands/version.cjs` — Unify call

**Line 4**: Change require to `execFileSync`.

**Line 11**: Change `execSync('"${AGENT_BROWSER_BIN}" --version', ...)` to `execFileSync(AGENT_BROWSER_BIN, ['--version'], ...)`.

### 6. `src/lib/browser-lifecycle.cjs` — Unify agent-browser call

**Line 401**: Change from:
```javascript
execSync(`"${AGENT_BROWSER_BIN}" --json --session "${session}" close --all`, {
  timeout: 10000, stdio: 'pipe',
});
```
To:
```javascript
execFileSync(AGENT_BROWSER_BIN, ['--json', '--session', session, 'close', '--all'], {
  timeout: 10000, stdio: 'pipe',
});
```

**Note**: `browser-lifecycle.cjs` also uses `execSync` for platform process management (`pgrep`, `tasklist` at lines 40-51). These are covered by Section 9 below (browser-lifecycle.cjs shares the `isRunning()` pattern with close-browser.cjs).

### 7. `src/lib/close-browser.cjs` — Eliminate shell for process management

All parameters come from hardcoded constants (`MACOS_APP_NAMES`, `WIN32_IMAGE_NAMES`, `LINUX_PROCESS_PATTERNS`). No user input. But converting to `execFileSync` improves robustness and consistency.

**Line 3**: Change `const { execSync } = require('child_process')` to `const { execFileSync } = require('child_process')`.

**`runWinCmd()` function (lines 58-71)**: Rewrite to use `execFileSync` + array args. Keep the SystemRoot fallback logic (needed when `tasklist`/`taskkill` not in PATH), but change error detection from `'is not recognized'` to include `ENOENT` (which is what `execFileSync` throws when binary not found):

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

**Signature change**: `runWinCmd(cmd, argsString)` → `runWinCmd(cmd, argsArray)`. All callers updated.

**All call sites converted**:

| Lines | Current | New |
|-------|---------|-----|
| 86, 91 | `execSync('ps -p ${pid} -o comm=')` | `execFileSync('ps', ['-p', String(pid), '-o', 'comm='])` |
| 99 | `runWinCmd('tasklist', '/FI "PID eq ${pid}" /NH')` | `runWinCmd('tasklist', ['/FI', `PID eq ${pid}`, '/NH'])` |
| 115 | `runWinCmd('tasklist', '/FI "IMAGENAME eq ${name}" /NH')` | `runWinCmd('tasklist', ['/FI', `IMAGENAME eq ${name}`, '/NH'])` |
| 122, 130 | `execSync('pgrep -f "${pattern}"')` | `execFileSync('pgrep', ['-f', pattern])` |
| 148 | `runWinCmd('taskkill', '/PID ${pid} /T /F')` | `runWinCmd('taskkill', ['/PID', String(pid), '/T', '/F'])` |
| 173 | `runWinCmd('taskkill', '/IM ${name}')` | `runWinCmd('taskkill', ['/IM', imageName])` |
| 176 | `runWinCmd('taskkill', '/IM ${name} /F')` | `runWinCmd('taskkill', ['/IM', imageName, '/F'])` |
| 185 | `execSync('osascript -e \'quit app "${appName}"\''` | `execFileSync('osascript', ['-e', `quit app "${appName}"`])` |
| 187, 195 | `execSync('pkill -f "${pattern}"')` | `execFileSync('pkill', ['-f', pattern])` |

**Note on `tasklist /FI` parameter**: The filter value (e.g. `PID eq 1234`) does NOT need surrounding quotes when passed via `execFileSync` array — quotes were only needed for shell parsing. `execFileSync` passes the string verbatim to the process.

### 8. `src/lib/detect-browsers.cjs` — Eliminate shell for browser detection

**Line 3**: Change `const { execSync } = require('child_process')` to `const { execFileSync } = require('child_process')`.

**`resolveFromRegistry()` (lines 91-120)**: Convert `reg query` calls to `execFileSync`. Keep the SystemRoot fallback for the same reason as `runWinCmd()`:

```javascript
// Line 95: was execSync(`reg query "${key}" /ve`)
execFileSync('reg', ['query', key, '/ve'], { encoding: 'utf8', timeout: 5000, stdio: 'pipe' })

// Line 108: fallback with full path
const regExe = path.join(systemRoot, 'System32', 'reg.exe');
execFileSync(regExe, ['query', key, '/ve'], { encoding: 'utf8', timeout: 5000, stdio: 'pipe' })
```

Error detection updated: catch `e.code === 'ENOENT'` in addition to `'is not recognized'`.

**`resolveFromLinuxCommands()` (line 140)**: `command -v` is a shell built-in, cannot be called via `execFileSync`. Replace with `which` (a real executable at `/usr/bin/which`). This function is guarded by `if (platform !== 'linux') return ''` so `which` availability is not a cross-platform concern:

```javascript
// was: execSync(`command -v ${cmd}`)
execFileSync('which', [cmd], { encoding: 'utf8', timeout: 5000 })
```

**`getVersion()` (lines 174-203)**: Convert all three platform branches:

| Line | Current | New |
|------|---------|-----|
| 182 | `execSync('defaults read "${plistPath}" CFBundleShortVersionString')` | `execFileSync('defaults', ['read', plistPath, 'CFBundleShortVersionString'])` |
| 189-191 | `execSync('powershell -Command "(Get-Item \'${path}\')..."')` | `execFileSync('powershell', ['-Command', `(Get-Item '${escapedPath}').VersionInfo.ProductVersion`])` |
| 196 | `execSync('"${executablePath}" --version')` | `execFileSync(executablePath, ['--version'])` |

**Note on PowerShell**: The `executablePath.replace(/'/g, "''")` escaping for single quotes is still needed within the PowerShell command string. The improvement is that `execFileSync` bypasses `cmd.exe` parsing, so characters like `()` in `C:\Program Files (x86)` are no longer misinterpreted by the outer shell.

### 9. `src/lib/sync-profile.cjs` — Eliminate shell for profile copy

**Line 3**: Change `const { execSync } = require('child_process')` to `const { execFileSync } = require('child_process')`.

**Windows robocopy (lines 75-83)**: Convert from shell string to array args:

```javascript
// was:
const cmd = `robocopy "${source}" "${dest}" /MIR /XD ${xdArgs} /XF ${xfArgs}`;
execSync(cmd, { timeout: 300000, stdio: 'pipe' });

// new:
const robocopyArgs = [source, dest, '/MIR', '/XD', ...EXCLUDE_DIRS, '/XF', ...EXCLUDE_FILES];
execFileSync('robocopy', robocopyArgs, { timeout: 300000, stdio: 'pipe' });
```

The `EXCLUDE_DIRS`/`EXCLUDE_FILES` arrays are spread directly — no quoting needed since `execFileSync` passes each element as a separate argv entry.

**macOS/Linux rsync (lines 84-92)**: Convert similarly:

```javascript
// was:
const excludeArgs = [...EXCLUDE_DIRS.map(d => `--exclude="${d}"`), ...EXCLUDE_FILES.map(f => `--exclude="${f}"`)].join(' ');
const cmd = `rsync -a --delete ${excludeArgs} "${source}/" "${dest}/"`;
execSync(cmd, { timeout: 300000, stdio: 'pipe' });

// new:
const rsyncArgs = ['-a', '--delete'];
EXCLUDE_DIRS.forEach(d => rsyncArgs.push('--exclude', d));
EXCLUDE_FILES.forEach(f => rsyncArgs.push('--exclude', f));
rsyncArgs.push(`${source}/`, `${dest}/`);
execFileSync('rsync', rsyncArgs, { timeout: 300000, stdio: 'pipe' });
```

**Note on rsync `--exclude`**: Using `--exclude` as a separate arg from the pattern (instead of `--exclude=pattern`) is the standard argv convention and works correctly with `execFileSync`.

**Catch block (lines 94-107)**: No change needed. `execFileSync` throws with the same `.status` property, so the robocopy exit code 0-7 check still works.

### 10. `src/lib/browser-lifecycle.cjs` — Complete conversion

In addition to the agent-browser call (Section 6), convert the `isRunning()` process detection calls:

**Line 6**: Final require:
```javascript
const { execFileSync, spawn } = require('child_process');
```

`execSync` fully removed — all calls converted to `execFileSync`.

**`isRunning()` calls (lines 40-54)**:

| Line | Current | New |
|------|---------|-----|
| 40 | `execSync('pgrep -f "${pat.darwin_pgrep}"')` | `execFileSync('pgrep', ['-f', pat.darwin_pgrep])` |
| 45 | `execSync('pgrep -f "${pat.linux_pgrep}"')` | `execFileSync('pgrep', ['-f', pat.linux_pgrep])` |
| 51 | `execSync('tasklist /FI "IMAGENAME eq ${pat.win32_process}" /NH')` | `execFileSync('tasklist', ['/FI', `IMAGENAME eq ${pat.win32_process}`, '/NH'])` |

## Test Plan

### Existing tests to update

1. **`test/lib/paths.test.cjs`** — Verify `AGENT_BROWSER_BIN` now points to `node_modules/agent-browser/bin/agent-browser-{platform}-{arch}` instead of `.bin/agent-browser`. Verify `AGENT_BROWSER_IS_NATIVE` export.

2. **`test/commands/run.test.cjs`** — Tests mock child_process; update mock expectations from `execSync` to `execFileSync`.

3. **`test/commands/setup.test.cjs`** — Remove any references to `createBinShim`; update mock expectations.

4. **`test/commands/init.test.cjs`** — This file heavily mutates `pathsMod.AGENT_BROWSER_BIN` and creates dummy bins at the `.bin/` path (lines 30-34). Update dummy bin creation to match the new native binary path format. Verify path format expectations still hold.

5. **`test/lib/browser-lifecycle.test.cjs`** — `closeSession()`/`closeAllSessions()` and `isRunning()` tests exercise `execSync` → `execFileSync` changes. Verify tests still pass.

6. **`test/lib/preflight.test.cjs`** — Exercises the `checkCli()` path with `execSync` → `execFileSync` change. Verify.

7. **`test/commands/version.test.cjs`** — Exercises `execSync` → `execFileSync` change. Verify.

8. **`test/lib/sync-profile.test.cjs`** — Exercises profile sync with `execSync` → `execFileSync` change. Verify robocopy exit code handling still works.

9. **`test/lib/detect-browsers.test.cjs`** — Exercises browser detection with `execSync` → `execFileSync` change. Verify.

### New test cases

10. **URL with shell metacharacters** — Verify that `engineArgs` containing `&`, `?`, `%`, `#`, `(`, `)` are passed through to `execFileSync` without truncation or modification.

11. **`getNativeBinaryName()` unit tests** — Correct binary name for known platform/arch combinations; null for unsupported platforms; `isMusl()` returns false on non-Linux.

12. **Fallback path test** — Verify that when `getNativeBinaryName()` returns null, `AGENT_BROWSER_BIN` resolves to the JS wrapper path and `AGENT_BROWSER_IS_NATIVE` is false.

13. **`runWinCmd` fallback test** — Verify that when bare command throws ENOENT, the SystemRoot full path is attempted.

14. **New `test/lib/close-browser.test.cjs`** — `close-browser.cjs` has 12+ call sites being converted but no existing unit test file. Create tests covering: `runWinCmd` ENOENT fallback, `verifyPidIsBrowser` per-platform dispatch, `isBrowserStillRunning` per-platform dispatch.

### Manual verification

15. macOS: `xb run open 'https://www.zhihu.com/search?type=content&q=%E5%A4%A7%E6%A8%A1%E5%9E%8B'` — verify full URL received by browser.

16. Windows (if available): test full flow `xb init → xb run → xb cleanup` with CSS selectors containing brackets and Chinese text.

17. Windows: verify `tasklist`/`taskkill`/`reg` commands work with `execFileSync` array args (filter parameters without shell quotes).

18. Linux: verify `which` returns same results as `command -v` for browser commands (`google-chrome`, `chromium-browser`, etc.).

## Risk Assessment

- **Low risk**: `execFileSync` error object has the same `.stdout`/`.stderr`/`.status` structure as `execSync` — catch blocks don't need changes.
- **Low risk**: `AGENT_BROWSER_BIN` export name unchanged — no import changes in consumers.
- **Fallback**: If `getNativeBinaryName()` returns null on an exotic platform, we fall back to the JS wrapper (`agent-browser.js`) invoked via `execFileSync(process.execPath, [jsPath, ...args])`. This avoids shebang/permission issues on all platforms.
- **No breaking change**: The `.bin/` shim was only created by our own `setup.cjs` and consumed internally. No external code depends on it.
- **Stale shim on disk**: Existing deployed installations will have orphaned `.bin/agent-browser` files after update. These are harmless since nothing references them. No cleanup needed.
- **Zero `execSync` remaining**: After this change, no source file under `src/` uses `execSync`. `paths.cjs` uses a pure filesystem check for musl detection instead. Test files (`cli.test.cjs`, `integration.test.cjs`) retain `execSync` for CLI invocation which is correct.
- **`getNativeBinaryName()` includes defensive `x86_64`/`aarch64` arch mappings** for parity with upstream `agent-browser.js`, even though Node.js `os.arch()` only returns `x64`/`arm64`.

## Files Changed Summary

| File | Type | Description |
|------|------|-------------|
| `src/lib/paths.cjs` | Modified | Native binary resolution, remove .bin shim path |
| `src/commands/run.cjs` | Modified | execFileSync + array args, remove string concat |
| `src/commands/setup.cjs` | Modified | Remove createBinShim, execFileSync for install |
| `src/lib/preflight.cjs` | Modified | execFileSync for --version |
| `src/commands/version.cjs` | Modified | execFileSync for --version |
| `src/lib/browser-lifecycle.cjs` | Modified | execFileSync for close --all + isRunning |
| `src/lib/close-browser.cjs` | Modified | execFileSync for all process mgmt, rewrite runWinCmd |
| `src/lib/detect-browsers.cjs` | Modified | execFileSync for reg/powershell/defaults/which |
| `src/lib/sync-profile.cjs` | Modified | execFileSync for robocopy/rsync |
| `test/lib/paths.test.cjs` | Modified | Update path expectations |
| `test/commands/run.test.cjs` | Modified | Update mock expectations |
| `test/commands/setup.test.cjs` | Modified | Remove createBinShim references |
| `test/lib/browser-lifecycle.test.cjs` | Modified | Update execSync → execFileSync mocks |
| `test/lib/sync-profile.test.cjs` | Modified | Update execSync → execFileSync mocks |
| `test/lib/detect-browsers.test.cjs` | Modified | Update execSync → execFileSync mocks |

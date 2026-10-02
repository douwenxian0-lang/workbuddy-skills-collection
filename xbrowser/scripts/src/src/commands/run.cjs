'use strict';

const { execFileSync } = require('child_process');
const { ok, fail } = require('../lib/result.cjs');
const { parseRunArgs, filterActionArgs } = require('../lib/arg-parser.cjs');
const { validateAction } = require('../lib/commands-whitelist.cjs');
const { readConfig, isComplete } = require('../lib/config-store.cjs');
const { AGENT_BROWSER_BIN, BROWSER_IDS, profileDir, sessionName, ensureDir } = require('../lib/paths.cjs');
const { checkCli, checkProfile } = require('../lib/preflight.cjs');
const { ensureConnection } = require('../lib/browser-lifecycle.cjs');
const { syncProfile } = require('../lib/sync-profile.cjs');
const { wrapEngineError } = require('../lib/error-wrapper.cjs');
const { isOpenErrorReason, logKindForReason } = require('../lib/shield/reasons.cjs');

/**
 * Core run command — proxies action args to agent-browser,
 * auto-injecting --json, --session-name, --profile / --cdp-url, etc.
 *
 * @param {string[]} args — everything after "run" on the CLI
 * @returns {Promise<object>} XbResult
 */
async function runCommand(args) {
  const warnings = [];

  // 1. No args
  if (!args || args.length === 0) {
    return fail('run', '缺少操作指令', 'xb help run');
  }

  // 2. Read config
  const cfg = readConfig();
  if (!cfg) return fail('run', '环境未初始化', 'xb init');
  if (!isComplete(cfg)) return fail('run', '配置未完成', 'xb init');

  // 3. Check CLI
  const cli = checkCli();
  if (!cli.installed) return fail('run', 'CLI 未安装', 'xb setup');

  // 4. Parse args
  const { browser, headed, timeout, actionArgs, errors } = parseRunArgs(args);
  if (errors.length > 0) {
    return fail('run', errors.join('; '), 'xb help run');
  }

  // 5. Validate action
  if (actionArgs.length === 0) {
    return fail('run', '缺少操作指令', 'xb help run');
  }
  const validation = validateAction(actionArgs);
  if (!validation.valid) {
    return fail('run', validation.error, validation.hint, {
      similar_commands: validation.similar,
      valid_subcommands: validation.validSubverbs,
    });
  }

  // 6. Resolve browser (--browser is required)
  if (!browser) {
    return fail('run', '缺少 --browser 参数',
      '请指定 --browser default|cft|chrome|edge|qqbrowser', {
        configured_browser: cfg.browser || 'cft',
        options: {
          default: '用户未指定浏览器时使用配置的默认浏览器',
          cft: 'Chrome for Testing',
          chrome: 'Google Chrome',
          edge: 'Microsoft Edge',
          qqbrowser: 'QQ 浏览器',
        },
      });
  }
  const browserId = browser === 'default' ? (cfg.browser || 'cft') : browser;
  if (!BROWSER_IDS.includes(browserId)) {
    return fail('run', `未知的浏览器 "${browserId}"`, `可选值：${BROWSER_IDS.join(', ')}`);
  }

  // 7. Resolve headed
  const isHeaded = headed || cfg.headed || false;

  // 8. Resolve timeout
  const timeoutMs = timeout || 25000;

  // 9. Resolve profile
  const profile = profileDir(browserId);

  // 10. Auto-migrate profile if needed (local browsers only)
  if (browserId !== 'cft') {
    const profileInfo = checkProfile(browserId);
    if (!profileInfo.exists) {
      const migrateResult = syncProfile(browserId);
      if (!migrateResult.success) {
        if (migrateResult.running) {
          // Browser is running — block and guide user to close it
          return fail('run', migrateResult.error, migrateResult.hint, {
            browser: browserId,
            browser_running: true,
          }, warnings.length > 0 ? warnings : undefined);
        }
        // Other migration failure — continue with empty profile
        warnings.push(`Profile 迁移失败：${migrateResult.error}。使用空 profile 继续。`);
        ensureDir(profile);
      }
    }
  }

  // 11. Ensure connection (local browsers only)
  let conn;
  if (browserId !== 'cft') {
    conn = await ensureConnection(browserId, { headed: isHeaded });
    if (!conn.ready) {
      return fail('run', conn.error, conn.hint);
    }
  }

  // 12. Construct engine command args
  const engineArgs = ['--json'];
  engineArgs.push('--session', sessionName(browserId));

  if (browserId === 'cft') {
    engineArgs.push('--profile', profile);
    if (isHeaded) engineArgs.push('--headed');
  } else {
    engineArgs.push('--cdp', String(conn.cdpPort));
  }

  // Cap timeout at 29s (agent-browser IPC read timeout is 30s, values above cause EAGAIN)
  const MAX_ENGINE_TIMEOUT = 29000;
  const engineTimeout = Math.min(timeoutMs, MAX_ENGINE_TIMEOUT);
  if (timeout && timeoutMs > MAX_ENGINE_TIMEOUT) {
    warnings.push(`--timeout ${timeoutMs}ms 超出引擎上限，已自动调整为 ${MAX_ENGINE_TIMEOUT}ms`);
  }

  // 11.5 Filter out agent-browser control params from action args
  const { filtered: cleanedActionArgs, stripped } = filterActionArgs(actionArgs);
  for (const param of stripped) {
    warnings.push(`已忽略参数 ${param}（xb 不支持手动指定，请勿传递此参数）`);
  }

  // SSRF guard: validate URL before passing to agent-browser
  const { extractUrls } = require('../lib/shield/action-url-extractor.cjs');
  const { checkUrl, checkUrlSync } = require('../lib/shield/policy.cjs');
  const { isEnabled, getAllowlist } = require('../lib/shield/config-store.cjs');
  const { appendEntry } = require('../lib/shield/log-store.cjs');

  const urls = extractUrls(cleanedActionArgs);
  const enabled = isEnabled();
  const allowlist = enabled ? getAllowlist() : [];
  for (const url of urls) {
    // Layer 1 (cloud-metadata / dangerous-protocol / invalid-format) is "永远生效",
    // even when the user has disabled the shield. Layer 2 (private-network with
    // allowlist + DNS) is honored only when the shield is enabled — disabling
    // means the user explicitly opted out of layer-2 inconvenience.
    if (!enabled) {
      const syncResult = checkUrlSync(url);
      if (!syncResult.allow && (
        syncResult.reason === 'cloud-metadata' ||
        syncResult.reason === 'dangerous-protocol' ||
        syncResult.reason === 'invalid-format'
      )) {
        appendEntry({
          kind: logKindForReason(syncResult.reason), url, reason: syncResult.reason,
          detail: syncResult.detail, trigger: 'run.' + cleanedActionArgs[0],
          layer: 'layer-1-always-on',
        });
        return fail(
          'run',
          buildFailureMessage(url, syncResult),
          buildFailureHint(url, syncResult),
          {
            url, reason: syncResult.reason, resolved_ip: syncResult.detail,
            policy_layer: 'layer-1-always-on',
          },
          warnings.length > 0 ? warnings : undefined,
        );
      }
      // Public / private-network (when disabled) / DNS-pending → pass through
      continue;
    }

    // Shield enabled: full async checkUrl with DNS + allowlist
    const result = await checkUrl(url, { allowlist });
    if (!result.allow) {
      appendEntry({
        kind: logKindForReason(result.reason), url, reason: result.reason,
        detail: result.detail, trigger: 'run.' + cleanedActionArgs[0],
      });
      return fail(
        'run',
        buildFailureMessage(url, result),
        buildFailureHint(url, result),
        {
          url, reason: result.reason, resolved_ip: result.detail,
          policy_layer: 'default-protection',
        },
        warnings.length > 0 ? warnings : undefined,
      );
    }
  }

  engineArgs.push(...cleanedActionArgs);

  // 13. Execute via child_process
  let stdout = '';
  let stderr = '';
  try {
    stdout = execFileSync(AGENT_BROWSER_BIN, engineArgs, {
      encoding: 'utf8',
      timeout: engineTimeout + 5000,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, AGENT_BROWSER_DEFAULT_TIMEOUT: String(engineTimeout) },
    });
  } catch (e) {
    stdout = e.stdout || '';
    stderr = e.stderr || '';
  }

  // 14. Parse output and wrap result
  let engineResult;
  try {
    engineResult = JSON.parse(stdout);
  } catch {
    const rawError = stderr || stdout || 'Unknown error';
    const wrapped = wrapEngineError(rawError, validation.verb);
    return fail('run', wrapped.error, wrapped.hint, {
      browser_command: cleanedActionArgs.join(' '),
      raw_output: (stdout + stderr).trim().slice(0, 2000),
      ...(wrapped.raw_error ? { raw_error: wrapped.raw_error } : {}),
    }, warnings);
  }

  if (engineResult && engineResult.error) {
    const wrapped = wrapEngineError(engineResult.error, validation.verb);
    return fail('run', wrapped.error, wrapped.hint, {
      browser_command: cleanedActionArgs.join(' '),
      result: engineResult,
      ...(wrapped.raw_error ? { raw_error: wrapped.raw_error } : {}),
    }, warnings);
  }

  return ok('run', {
    browser_command: cleanedActionArgs.join(' '),
    result: engineResult,
  }, warnings);
}

function describeReason(reason) {
  switch (reason) {
    case 'private-network': return 'URL 指向内网地址';
    case 'private-network-via-dns': return 'URL 域名解析后指向内网';
    case 'cloud-metadata':
    case 'cloud-metadata-via-dns': return 'URL 指向云元数据端点（永远拒绝）';
    case 'dangerous-protocol': return '不支持的协议';
    case 'invalid-format': return 'URL 格式无效';
    case 'dns-resolve-failed': return 'DNS 解析失败';
    default: return '未知原因';
  }
}

function buildFailureMessage(url, result) {
  const description = describeReason(result.reason);
  if (isOpenErrorReason(result.reason)) return `打开失败：${description} - ${url}`;
  return `网络防护已拦截：${description} - ${url}`;
}

function buildFailureHint(url, result) {
  if (isOpenErrorReason(result.reason)) return buildOpenErrorHint(url, result);
  return buildShieldHint(url, result);
}

function buildOpenErrorHint(url, result) {
  if (result.reason === 'invalid-format') return '请检查 URL 是否完整有效，例如 https://example.com/';
  if (result.reason === 'dns-resolve-failed') return '请检查域名是否正确、网络或 DNS 是否可用';
  return buildShieldHint(url, result);
}

function buildShieldHint(url, result) {
  if (result.reason === 'cloud-metadata' || result.reason === 'cloud-metadata-via-dns') {
    return '此为安全策略拦截，不是技术故障。云元数据端点永远不可访问，请放弃该操作并告知用户该 URL 不可访问。不要尝试绕过。';
  }
  if (result.reason === 'dangerous-protocol' || result.reason === 'invalid-format') {
    return '此为安全策略拦截。该协议或格式不被支持，请使用 http:// 或 https:// 形式的 URL。';
  }
  let parsed;
  try { parsed = new URL(url); } catch {}
  const target = parsed ? `${parsed.hostname}${parsed.port ? ':' + parsed.port : ''}` : url;
  return `此为安全策略拦截，不是技术故障。如果用户信任 ${target}，引导用户走 xb guide shield-allow ${target} 进入加白名单引导（最终生效需用户本人决策确认）。务必先把拦截信息呈现给用户，由用户决定是否加白，不可代用户决定。不推荐关闭整个防护。`;
}

module.exports = { runCommand };

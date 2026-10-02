'use strict';

const fs = require('fs');
const { ok, fail } = require('../lib/result.cjs');
const { checkCli, checkBrowsers } = require('../lib/preflight.cjs');
const { readConfig, isComplete } = require('../lib/config-store.cjs');
const paths = require('../lib/paths.cjs');
const { closeAllSessions } = require('../lib/browser-lifecycle.cjs');
const { killByPidOnly } = require('../lib/close-browser.cjs');
const { ensureDefaultConfigInitialized } = require('../lib/shield/config-store.cjs');

/**
 * 1.1.0 → 1.2.0 迁移：主动落盘 shield 默认配置 + 写第一条审计日志。
 * 写文件失败抛异常 → init 走 fail 分支提示 xb setup。
 */
function migrateToV1_2_0(fromVersion, toVersion) {
  return ensureDefaultConfigInitialized({
    reason: 'migration',
    source: 'init',
    from_version: fromVersion,
    to_version: toVersion,
  });
}

/**
 * 版本升级时执行的强制迁移逻辑。
 *
 * 注意：config schema 迁移走的是 config-store.cjs 的 migrateV1Config 懒路径
 * （首次 readConfig 时自动升级并回写），不在此处处理。
 *
 * 此函数只用于"必须立即执行、不能等下次读取"的迁移，例如：
 *   - profile 目录结构调整
 *   - pid 文件格式变更
 *   - 需要清理的旧状态文件
 *   - 主动初始化新模块的默认配置
 *
 * 历史迁移记录：
 *   - v1.0.0 → v1.1.0: 无强制迁移（config schema 由懒迁移覆盖）
 *   - v1.1.0 → v1.2.0: 主动落盘 shield 默认配置 + 审计日志
 *
 * @returns {object|null} 触发了迁移则返回 upgradeInfo，否则 null
 */
function runUpdateMigration(fromVersion, toVersion) {
  if (
    paths.compareVersions(fromVersion, '1.2.0') < 0 &&
    paths.compareVersions(toVersion, '1.2.0') >= 0
  ) {
    const result = migrateToV1_2_0(fromVersion, toVersion);  // 失败抛异常，由调用方 catch
    if (result.status === 'initialized') {
      return {
        from_version: fromVersion,
        to_version: toVersion,
        summary: `[XBrowser 自动升级] 已成功升级到 v${toVersion}。新增安全防护模块（shield），已默认启用。查看状态：xb shield status`,
        changes: ['shield-module-initialized'],
      };
    }
    if (result.status === 'reset-corrupted') {
      return {
        from_version: fromVersion,
        to_version: toVersion,
        summary: `[XBrowser 自动升级] 已成功升级到 v${toVersion}。检测到已有安全防护配置损坏，已重置为安全默认配置并默认启用。查看状态：xb shield status`,
        changes: ['shield-config-reset-corrupted'],
      };
    }
    return {
      from_version: fromVersion,
      to_version: toVersion,
      summary: `[XBrowser 自动升级] 已成功升级到 v${toVersion}。检测到已有安全防护配置，已保留现有设置；shield 模块可用。查看状态：xb shield status`,
      changes: ['shield-config-preserved'],
    };
  }
  // 未来追加新版本时：
  // if (paths.compareVersions(fromVersion, '1.3.0') < 0) { migrateToV1_3_0(); ... }
  return null;
}

function cleanupProcesses() {
  const warnings = [];
  try { closeAllSessions(); } catch (e) {
    warnings.push(`关闭 agent-browser 会话失败: ${e.message}`);
  }
  for (const id of paths.LOCAL_BROWSER_IDS) {
    try {
      const r = killByPidOnly(id);
      if (r.method === 'pid') warnings.push(`已关闭 xb 启动的 ${id} 进程`);
    } catch (e) {
      warnings.push(`关闭 ${id} 失败: ${e.message}`);
    }
  }
  return warnings;
}

function rebuildWorkDir() {
  fs.rmSync(paths.XBROWSER_DIR, { recursive: true, force: true });
  paths.ensureDir(paths.XBROWSER_DIR);
}

function initCommand() {
  const warnings = [];
  let upgradeInfo = null;

  // Step 1: Check working directory
  const dirExists = fs.existsSync(paths.XBROWSER_DIR);
  if (!dirExists) {
    paths.ensureDir(paths.XBROWSER_DIR);
  } else {
    // Step 2: Check .version file
    let fileVersion = null;
    if (fs.existsSync(paths.VERSION_PATH)) {
      fileVersion = fs.readFileSync(paths.VERSION_PATH, 'utf8').trim() || null;
    }

    if (fileVersion === null) {
      // No .version or empty — stale/legacy directory
      warnings.push(...cleanupProcesses());
      try {
        rebuildWorkDir();
      } catch (e) {
        return fail('init', `无法删除工作目录: ${e.message}`,
          '请手动关闭所有浏览器后重试', undefined, warnings);
      }
    } else {
      const cmp = paths.compareVersions(fileVersion, paths.CLI_VERSION);
      if (cmp === 0) {
        // Version matches — skip step 3, go to step 4
        return continueChecks(warnings, null);
      } else if (cmp < 0) {
        // Older version — run upgrade migration
        try {
          upgradeInfo = runUpdateMigration(fileVersion, paths.CLI_VERSION);
          // 不变量：迁移失败必须立即 return（见下方 catch），避免 fail-through 到
          //         writeFileSync(VERSION_PATH)，否则 .version 前进，下次 init 不再
          //         触发迁移，损害幂等性
        } catch (e) {
          return fail('init', `升级兼容执行失败: ${e.message}`, 'xb setup',
            undefined, warnings);
        }
      } else {
        // Illegal: .version > CLI_VERSION
        warnings.push(`检测到版本不一致 (文件: ${fileVersion}, CLI: ${paths.CLI_VERSION})，正在重建工作目录`);
        warnings.push(...cleanupProcesses());
        try {
          rebuildWorkDir();
        } catch (e) {
          return fail('init', `无法删除工作目录: ${e.message}`,
            '请手动关闭所有浏览器后重试', undefined, warnings);
        }
      }
    }
  }

  // Step 3: Write/update .version
  paths.ensureDir(paths.XBROWSER_DIR);
  fs.writeFileSync(paths.VERSION_PATH, paths.CLI_VERSION, 'utf8');

  // Steps 4-7
  return continueChecks(warnings, upgradeInfo);
}

function continueChecks(warnings, upgradeInfo) {
  const cliInfo = checkCli();
  if (!cliInfo.installed) {
    return fail('init', 'agent-browser CLI 未安装', 'xb setup', undefined, warnings);
  }

  const { cft, local } = checkBrowsers();
  const hasLocalBrowser = local.some((b) => b.installed);
  if (!cft.installed && !hasLocalBrowser) {
    return fail('init', '未检测到可用浏览器', 'xb setup', undefined, warnings);
  }

  const cfg = readConfig();
  if (cfg === null) {
    return fail('init', '首次使用，需要配置', 'xb guide config', {
      status: 'needs_config',
    }, warnings);
  }
  if (!isComplete(cfg)) {
    return fail('init', '配置未完成', 'xb guide incomplete-config', {
      status: 'config_incomplete',
    }, warnings);
  }

  try {
    ensureDefaultConfigInitialized({ reason: 'new', source: 'init' });
  } catch (e) {
    return fail('init', `安全防护初始化失败: ${e.message}`, 'xb setup',
      undefined, warnings.length > 0 ? warnings : undefined);
  }

  const data = {
    status: 'ready',
    env: {
      browser: cfg.browser,
      headed: cfg.headed,
      cli_version: cliInfo.version,
    },
  };
  if (upgradeInfo) data.upgrade = upgradeInfo;

  return ok('init', data, warnings.length > 0 ? warnings : undefined);
}

module.exports = { initCommand };

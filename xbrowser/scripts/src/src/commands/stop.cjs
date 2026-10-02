'use strict';

const { ok, fail } = require('../lib/result.cjs');
const closeBrowserMod = require('../lib/close-browser.cjs');
const { LOCAL_BROWSER_IDS } = require('../lib/paths.cjs');
const { BROWSER_DISPLAY_NAMES } = require('../lib/prompts.cjs');
const browserLifecycle = require('../lib/browser-lifecycle.cjs');

function stopSingle(browserId, force) {
  const browserName = BROWSER_DISPLAY_NAMES[browserId] || browserId;
  if (!force) {
    if (!browserLifecycle.isRunning(browserId)) {
      return ok('stop', { browser: browserId, running: false, message: `${browserName} 未在运行` });
    }
    return fail('stop',
      `${browserName} 正在运行，请通过引导用户确认数据保存的方式进行关闭`,
      `xb guide close-browser --browser ${browserId}`,
      { browser: browserId, running: true }
    );
  }
  const result = closeBrowserMod.closeBrowser(browserId);
  if (!result.success) {
    return fail('stop', `关闭 ${browserName} 失败: ${result.error}`, '请手动关闭浏览器后重试');
  }
  return ok('stop', {
    browser: browserId,
    success: true,
    next: `${browserName} 已关闭，可以重新执行 xb run --browser ${browserId} 继续自动化操作`,
  });
}

function stopCommand(args) {
  if (!args || args.length === 0) {
    return fail('stop', '请指定要关闭的浏览器', `用法: xb stop <${LOCAL_BROWSER_IDS.join('|')}|all> [--force]`);
  }

  const force = args.includes('--force');
  const positional = args.filter((a) => a !== '--force');
  const target = (positional[0] || '').toLowerCase();

  if (!target) {
    return fail('stop', '请指定要关闭的浏览器', `用法: xb stop <${LOCAL_BROWSER_IDS.join('|')}|all> [--force]`);
  }

  if (target === 'cft') {
    return fail('stop', 'CfT 由 agent-browser 管理，不需要手动关闭', '运行 xb cleanup 关闭 CfT 会话');
  }

  if (target === 'all') {
    if (!force) {
      const runningBrowsers = LOCAL_BROWSER_IDS.filter((id) => browserLifecycle.isRunning(id));
      if (runningBrowsers.length === 0) {
        return ok('stop', { target: 'all', running_browsers: [], message: '没有正在运行的本地浏览器' });
      }
      const names = runningBrowsers.map((id) => BROWSER_DISPLAY_NAMES[id] || id).join('、');
      return fail('stop',
        `以下浏览器正在运行：${names}`,
        `运行 xb stop all --force 强制关闭所有浏览器，或通过 xb guide close-browser 引导逐个关闭`,
        { target: 'all', running_browsers: runningBrowsers }
      );
    }
    const results = LOCAL_BROWSER_IDS.map((id) => {
      const r = closeBrowserMod.closeBrowser(id);
      return { browser: id, success: r.success, error: r.error || null };
    });
    const closed = results.filter((r) => r.success).length;
    return ok('stop', { target: 'all', results, browsers_closed: closed });
  }

  if (!LOCAL_BROWSER_IDS.includes(target)) {
    return fail('stop', `未知的浏览器 "${target}"`, `可选值: ${LOCAL_BROWSER_IDS.join(', ')}, all`);
  }

  return stopSingle(target, force);
}

module.exports = { stopCommand };

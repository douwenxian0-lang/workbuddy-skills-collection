'use strict';

const { ok, fail } = require('../lib/result.cjs');
const { getGuideStep } = require('../lib/prompts.cjs');
const { checkBrowsers } = require('../lib/preflight.cjs');
const { readConfig } = require('../lib/config-store.cjs');
const { LOCAL_BROWSER_IDS } = require('../lib/paths.cjs');
const { createAllowPending, createOffPending } = require('../lib/shield/pending-store.cjs');
const { validateAllowlistEntry } = require('../lib/shield/allowlist-format.cjs');

function guideCommand(args) {
  if (!args || args.length === 0) {
    return fail('guide', '缺少子命令', 'xb help guide', {
      subcommands: ['config', 'close-browser', 'incomplete-config', 'shield-allow', 'shield-off'],
    });
  }

  const sub = args[0];

  if (sub === 'config') return guideConfig(args);
  if (sub === 'close-browser') return guideCloseBrowser(args);
  if (sub === 'incomplete-config') return guideIncompleteConfig();
  if (sub === 'shield-allow') return guideShieldAllow(args);
  if (sub === 'shield-off') return guideShieldOff();

  return fail('guide', `未知的子命令 "${sub}"`, 'xb help guide', {
    subcommands: ['config', 'close-browser', 'incomplete-config', 'shield-allow', 'shield-off'],
  });
}

function guideConfig(args) {
  let step = 0;
  const stepIdx = args.indexOf('--step');
  if (stepIdx !== -1 && args[stepIdx + 1] != null) {
    const val = args[stepIdx + 1];
    if (val === '0' || val === '1' || val === '2') {
      step = Number(val);
    } else {
      return fail('guide', `无效的步骤 "${val}"`, 'xb guide config --step <0|1|2>');
    }
  }

  let context = {};
  if (step === 1) {
    const { local } = checkBrowsers();
    const installed = local.filter((b) => b.installed).map((b) => b.name);
    context = { browsers: installed };
  }

  const result = getGuideStep(step, context);
  return ok('guide', { action: 'config', ...result });
}

function guideCloseBrowser(args) {
  const browserIdx = args.indexOf('--browser');
  if (browserIdx === -1 || !args[browserIdx + 1]) {
    return fail('guide', '缺少 --browser 参数', 'xb guide close-browser --browser <chrome|edge|qqbrowser>');
  }

  const browserId = args[browserIdx + 1];
  if (!LOCAL_BROWSER_IDS.includes(browserId)) {
    return fail('guide', `不支持的浏览器 "${browserId}"`, `可选值: ${LOCAL_BROWSER_IDS.join(', ')}`);
  }

  const result = getGuideStep('close-browser', { browserId });
  return ok('guide', { action: 'close-browser', ...result });
}

function guideIncompleteConfig() {
  const cfg = readConfig();
  const result = getGuideStep('incomplete-config', { config: cfg || {} });
  return ok('guide', { action: 'incomplete-config', ...result });
}

function guideShieldAllow(args) {
  const target = args[1];
  if (!target) {
    return fail('guide', '缺少 host:port 参数', 'xb guide shield-allow <host:port>');
  }

  const fmt = validateAllowlistEntry(target);
  if (!fmt.valid) {
    return fail('guide', `白名单格式不合法：${fmt.reason}`, 'xb help shield', { code: fmt.code, target });
  }

  createAllowPending(target);
  const result = getGuideStep('shield-allow', { target });
  return ok('guide', { action: 'shield-allow', ...result });
}

function guideShieldOff() {
  createOffPending();
  const result = getGuideStep('shield-off', {});
  return ok('guide', { action: 'shield-off', ...result });
}

module.exports = { guideCommand };

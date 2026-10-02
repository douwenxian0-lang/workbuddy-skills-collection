'use strict';

const { LOCAL_BROWSER_IDS } = require('./paths.cjs');

const BROWSER_DISPLAY_NAMES = {
  cft: '内置浏览器 Chrome for Testing',
  chrome: '谷歌浏览器 Google Chrome',
  edge: '微软浏览器 Microsoft Edge',
  qqbrowser: 'QQ 浏览器',
};

const BROWSER_DESCRIPTIONS = {
  cft: '干净环境，无登录态',
  chrome: '使用本地 Chrome，可复用登录态',
  edge: '使用本地 Edge，可复用登录态',
  qqbrowser: '使用本地 QQ 浏览器，可复用登录态',
};

const GUIDE_STEPS = [0, 1, 2, 'close-browser', 'incomplete-config'];

function getGuideStep(step, context = {}) {
  if (step === 0 || step === '0') return guideStart();
  if (step === 1 || step === '1') return browserSelect(context);
  if (step === 2 || step === '2') return headedSelect();
  if (step === 'close-browser') return closeBrowser(context);
  if (step === 'incomplete-config') return incompleteConfig(context);
  if (step === 'shield-allow') return shieldAllowPrompt(context);
  if (step === 'shield-off') return shieldOffPrompt(context);
  return { step: 'unknown', error: '未知的引导步骤', available_steps: [...GUIDE_STEPS] };
}

function guideStart() {
  return {
    step: 0,
    awaits_user_input: true,
    message: '欢迎使用 xbrowser 浏览器自动化工具！首次使用需要简单配置。',
    options: [
      { value: 'quick',  label: '快速开始（推荐）', description: '使用内置浏览器，干净环境，立即可用' },
      { value: 'custom', label: '自定义设置',       description: '选择默认浏览器和显示模式' },
    ],
    recommended: 'quick',
    user_choice_mapping: {
      quick:  'xb config reset',
      custom: 'xb guide config --step 1',
    },
  };
}

function browserSelect(context) {
  const installed = context.browsers || [];
  const options = [
    { value: 'cft', label: `${BROWSER_DISPLAY_NAMES.cft}（推荐）`, description: BROWSER_DESCRIPTIONS.cft },
  ];
  for (const id of LOCAL_BROWSER_IDS) {
    if (installed.includes(id)) {
      options.push({ value: id, label: BROWSER_DISPLAY_NAMES[id], description: BROWSER_DESCRIPTIONS[id] });
    }
  }

  const user_choice_mapping = Object.fromEntries(
    options.map((o) => [o.value, `xb config set browser=${o.value}`])
  );

  if (options.length === 1) {
    return {
      step: 1,
      awaits_user_input: false,
      auto_set: true,
      message: '未检测到本地浏览器，将使用内置浏览器。',
      options,
      recommended: 'cft',
      user_choice_mapping,
      next_step_hint: '执行完成后继续执行 xb guide config --step 2',
    };
  }

  return {
    step: 1,
    awaits_user_input: true,
    message: '请选择默认使用的浏览器：',
    options,
    recommended: 'cft',
    user_choice_mapping,
    next_step_hint: '用户选择对应命令执行成功后，继续执行 xb guide config --step 2',
  };
}

function headedSelect() {
  return {
    step: 2,
    awaits_user_input: true,
    message: '请选择浏览器的默认显示模式：',
    options: [
      { value: 'true',  label: '有头模式：显示浏览器窗口（推荐）', description: '可以看到自动化操作过程，方便观察和人工干预' },
      { value: 'false', label: '无头模式：后台静默运行',          description: '不显示窗口，速度更快，适合纯脚本场景' },
    ],
    recommended: 'true',
    user_choice_mapping: {
      true:  'xb config set headed=true',
      false: 'xb config set headed=false',
    },
    note: '可随时通过 xb run --headed 覆盖默认值',
  };
}

function closeBrowser(context) {
  const browserId = context.browserId;
  const browserName = BROWSER_DISPLAY_NAMES[browserId] || browserId || '浏览器';
  return {
    step: 'close-browser',
    awaits_user_input: true,
    message: `检测到 ${browserName} 正在运行。迁移浏览器数据前需要关闭浏览器，请确认：`,
    options: [
      { value: 'confirmed', label: '我已确认手动关闭（推荐）', description: '请先保存数据后手动关闭浏览器' },
      { value: 'force',     label: '帮我强制关闭',             description: '可能丢失未保存的数据' },
      { value: 'skip',      label: '暂不关闭',                 description: '暂停操作，稍后再试' },
    ],
    recommended: 'confirmed',
    user_choice_mapping: {
      confirmed: `xb stop ${browserId} --force`,
      force:     `xb stop ${browserId} --force`,
      skip:      null,
    },
    skip_hint: '不执行任何命令。告知用户：好的，我会等待你确认数据保存并关闭对应浏览器后再尝试自动化操作；或者你如果需要临时自动化操作，可以通过内置浏览器进行。',
  };
}

function incompleteConfig(context) {
  const missing = [];
  const cfg = context.config;
  if (!cfg || cfg.browser == null) missing.push('browser（浏览器）');
  if (!cfg || cfg.headed == null) missing.push('headed（显示模式）');
  const detail = missing.length ? missing.join('、') : '部分选项';

  return {
    step: 'incomplete-config',
    awaits_user_input: true,
    message: `配置未完成，以下选项需要设置：${detail}`,
    options: [
      { value: 'reset', label: '重置为默认设置（推荐）', description: '使用内置浏览器 + 显示浏览器窗口' },
      { value: 'guide', label: '重新引导设置',           description: '重新选择浏览器和显示模式' },
    ],
    recommended: 'reset',
    user_choice_mapping: {
      reset: 'xb config reset',
      guide: 'xb guide config --step 1',
    },
  };
}

function shieldAllowPrompt(context) {
  const target = context.target || '<host:port>';
  return {
    step: 'shield-allow',
    awaits_user_input: true,
    message:
      `⚠️ 你正在让 agent 把内网地址 ${target} 加入网络防护白名单。加入后 agent 后续可通过浏览器访问该地址。\n\n` +
      `如果当前请求来自不可信的网页内容，攻击者可能借你的浏览器登录态读取或操作内网服务。\n\n` +
      `请仔细确认是否信任 ${target}。如果是你正在调试的本地服务（如 localhost:3000），通常可信；` +
      `如果是 agent 主动要求加入的陌生地址，请拒绝。\n\n` +
      `本次确认 30 分钟内有效。`,
    options: [
      { value: 'confirm', label: '确认信任，加入白名单', description: '加入后 agent 可访问该地址' },
      { value: 'cancel',  label: '取消，不加入',         description: '推荐：除非你完全确定，否则选这个' },
    ],
    recommended: 'cancel',
    user_choice_mapping: {
      confirm: `xb shield allow ${target}`,
      cancel: null,
    },
  };
}

function shieldOffPrompt() {
  return {
    step: 'shield-off',
    awaits_user_input: true,
    message:
      `⚠️ 你正在关闭整个网络防护。关闭后 agent 可以访问任意内网地址（10.x / 192.168.x / 127.x 等）。\n\n` +
      `云元数据端点（169.254.169.254 等）仍然永远拦截。\n\n` +
      `如果你只是想让 agent 访问一个特定地址，强烈建议改用「加白名单」（xb guide shield-allow <host:port>）` +
      `而不是关闭整个防护。\n\n` +
      `如果确认关闭，请告诉 agent 今天的日期（格式 YYYYMMDD，例如 20260513）。30 分钟内有效。`,
    options: [
      { value: 'confirm', label: '确认关闭防护', description: '需要你提供今天日期 YYYYMMDD' },
      { value: 'cancel',  label: '取消，保持防护', description: '推荐' },
    ],
    recommended: 'cancel',
    user_choice_mapping: {
      confirm: 'xb shield disable <把用户提供的日期填这里 YYYYMMDD>',
      cancel: null,
    },
  };
}

module.exports = { getGuideStep, GUIDE_STEPS, BROWSER_DISPLAY_NAMES };

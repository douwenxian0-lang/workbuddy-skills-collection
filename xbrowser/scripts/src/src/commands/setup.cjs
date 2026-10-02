'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { ok, fail } = require('../lib/result.cjs');
const { XBROWSER_DIR, AGENT_BROWSER_BIN, PROFILES_DIR, ensureDir, profileDir, AGENT_BROWSER_VERSION } = require('../lib/paths.cjs');
const { detectRegistry, getPackageInfo, downloadTarball } = require('../lib/registry.cjs');
const { extractTgz } = require('../lib/tar.cjs');
const { checkCli, checkBrowsers } = require('../lib/preflight.cjs');

const PACKAGE_NAME = 'agent-browser';

/**
 * Setup command — install CLI engine + browser. Idempotent.
 * @returns {Promise<object>} XbResult
 */
async function setupCommand() {
  // 1. Ensure work directory
  ensureDir(XBROWSER_DIR);

  // 2. Check if CLI already installed
  let cliInfo = checkCli();

  const needsInstall = !cliInfo.installed;
  const needsUpdate = cliInfo.installed && (() => {
    const currentVer = (cliInfo.version || '').replace('agent-browser ', '');
    return currentVer && currentVer !== AGENT_BROWSER_VERSION;
  })();

  if (!needsInstall && !needsUpdate) {
    process.stderr.write(`已安装 (${cliInfo.version || 'unknown'}), 跳过 CLI 安装\n`);
  } else {
    if (needsUpdate) {
      const currentVer = (cliInfo.version || '').replace('agent-browser ', '');
      process.stderr.write(`当前版本 ${currentVer}，目标版本 ${AGENT_BROWSER_VERSION}，正在更新...\n`);
    }

    // 3a. Detect best npm registry
    let registryBase;
    try {
      registryBase = await detectRegistry();
    } catch (e) {
      return fail('setup', `检测 npm 源失败: ${e.message}`, '请检查网络连接或配置代理');
    }

    // 3b. Get package info
    let pkgInfo;
    try {
      pkgInfo = await getPackageInfo(registryBase, PACKAGE_NAME, AGENT_BROWSER_VERSION);
    } catch (e) {
      return fail('setup', `获取包信息失败: ${e.message}`, '请检查网络连接或配置代理');
    }

    // 3c. Download tarball
    const tarballUrl = pkgInfo.dist && pkgInfo.dist.tarball;
    if (!tarballUrl) {
      return fail('setup', '包信息中缺少 tarball URL', '请检查 npm 源是否正常');
    }

    let tgzBuffer;
    try {
      process.stderr.write(`正在下载 v${pkgInfo.version}...\n`);
      tgzBuffer = await downloadTarball(tarballUrl, 120000);
    } catch (e) {
      return fail('setup', `下载失败: ${e.message}`, '请检查网络连接或配置代理');
    }

    // 3d. Extract
    const extractDir = path.join(XBROWSER_DIR, 'node_modules', PACKAGE_NAME);
    fs.mkdirSync(extractDir, { recursive: true });
    try {
      extractTgz(tgzBuffer, extractDir);
    } catch (e) {
      return fail('setup', `解压失败: ${e.message}`, '下载文件可能已损坏，请重试');
    }

    // 3e. Verify installation
    cliInfo = checkCli();
    if (!cliInfo.installed) {
      return fail('setup', '安装后仍未检测到底层引擎', '请检查安装目录权限');
    }

    process.stderr.write(`底层引擎 v${cliInfo.version || 'unknown'} 安装成功\n`);
  }

  // 4. Install Chrome for Testing
  const { cft } = checkBrowsers();
  let browserInstalled = cft.installed;

  if (browserInstalled) {
    process.stderr.write('浏览器已就绪, 跳过安装\n');
  } else {
    try {
      process.stderr.write('正在安装浏览器 (Chrome for Testing)...\n');
      const installArgs = ['--json', 'install'];
      if (os.platform() === 'linux') installArgs.push('--with-deps');
      execFileSync(AGENT_BROWSER_BIN, installArgs, {
        stdio: ['pipe', 'pipe', 'inherit'],
        timeout: 300000,
      });
      browserInstalled = true;
      process.stderr.write('浏览器安装成功\n');
    } catch (e) {
      return fail(
        'setup',
        `浏览器安装失败: ${e.message}`,
        '可能原因：网络无法访问 Google CDN，请检查代理设置',
        { cli_version: cliInfo.version, browser_installed: false, install_path: XBROWSER_DIR },
      );
    }
  }

  // 5. Ensure profile directories
  ensureDir(PROFILES_DIR);
  ensureDir(profileDir('cft'));

  // 6. Return success
  return ok('setup', {
    cli_version: cliInfo.version,
    browser_installed: browserInstalled,
    install_path: XBROWSER_DIR,
  });
}

module.exports = { setupCommand };

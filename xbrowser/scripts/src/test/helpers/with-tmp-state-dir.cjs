'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// 计算 src/lib 的绝对路径，用于精确匹配 require.cache key。
// __dirname = scripts/src/test/helpers → ../.. = scripts/src → ../../src/lib = scripts/src/src/lib
const LIB_DIR = path.resolve(__dirname, '..', '..', 'src', 'lib');

// 保存外部预设的 OPENCLAW_STATE_DIR（可能为 undefined），teardown 时还原
let savedStateDir;

function setupTmpStateDir() {
  // save 当前值（可能为 undefined）
  savedStateDir = process.env.OPENCLAW_STATE_DIR;

  const tmpDir = path.join(
    os.tmpdir(),
    `xb-shield-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  process.env.OPENCLAW_STATE_DIR = tmpDir;

  // 用绝对路径前缀精确匹配，避免子串误伤和跨平台路径分隔符差异
  for (const k of Object.keys(require.cache)) {
    if (k.startsWith(LIB_DIR)) delete require.cache[k];
  }
  return tmpDir;
}

function teardownTmpStateDir(tmpDir) {
  // 恢复外部预设（含 undefined → 删除）
  if (savedStateDir === undefined) {
    delete process.env.OPENCLAW_STATE_DIR;
  } else {
    process.env.OPENCLAW_STATE_DIR = savedStateDir;
  }
  savedStateDir = undefined;

  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

module.exports = { setupTmpStateDir, teardownTmpStateDir };

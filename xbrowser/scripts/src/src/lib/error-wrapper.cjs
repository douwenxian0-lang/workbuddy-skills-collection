'use strict';

const ERROR_PATTERNS = [
  {
    pattern: /timeout.*exceeded|timed?\s*out/i,
    error: '操作超时',
    hint: '尝试：xb run --timeout 29000 ...',
  },
  {
    pattern: /element not found|no element|cannot find|unknown ref/i,
    error: '元素引用已失效',
    hint: '先运行：xb run snapshot -i 获取最新引用',
  },
  {
    pattern: /navigation failed|net::|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_REFUSED/i,
    error: '页面加载失败',
    hint: '检查 URL 是否可达，或尝试 xb run wait --load networkidle',
  },
  {
    pattern: /session closed|browser.*closed|disconnected|target closed/i,
    error: '浏览器实例已关闭',
    hint: '重新运行 xb init 并打开页面',
  },
  {
    pattern: /requires? a url|missing.*url|open.*requires/i,
    error: 'open 需要 URL 参数',
    hint: '用法：xb run open <url>',
  },
  {
    pattern: /daemon.*exited|daemon.*failed|daemon.*start|no error output/i,
    error: '浏览器引擎启动失败',
    hint: '运行 xb status 检查环境状态，或 xb stop <browser> 后重试',
  },
  {
    pattern: /ECONNREFUSED|ECONNRESET|EPIPE/i,
    error: '浏览器连接断开',
    hint: '运行 xb cleanup 后重新执行',
  },
  {
    pattern: /ENOENT|spawn.*error|executable.*not found/i,
    error: '浏览器可执行文件未找到',
    hint: '运行 xb status 检查浏览器安装状态',
  },
  {
    pattern: /EACCES|permission denied/i,
    error: '权限不足',
    hint: '检查文件权限，或以管理员权限运行',
  },
  {
    pattern: /out of memory|OOM|allocation failed/i,
    error: '内存不足',
    hint: '关闭其他程序释放内存后重试',
  },
  {
    pattern: /protocol error|cdp error|inspector/i,
    error: 'CDP 协议错误',
    hint: '运行 xb cleanup 后重新执行',
  },
  {
    pattern: /crash|SIGSEGV|SIGABRT|SIGKILL/i,
    error: '浏览器进程崩溃',
    hint: '运行 xb stop <browser> 后重试',
  },
];

function wrapEngineError(rawError, verb) {
  if (!rawError) {
    return { error: '未知错误', hint: '运行 xb help run 查看用法' };
  }
  const msg = String(rawError);
  for (const { pattern, error, hint } of ERROR_PATTERNS) {
    if (pattern.test(msg)) {
      return { error, hint };
    }
  }
  return {
    error: '浏览器操作失败',
    hint: '运行 xb status 检查环境状态，或查看 raw_error 了解详情',
    raw_error: msg,
  };
}

module.exports = { wrapEngineError };

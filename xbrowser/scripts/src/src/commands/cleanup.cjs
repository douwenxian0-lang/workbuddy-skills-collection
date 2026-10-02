'use strict';

const { ok } = require('../lib/result.cjs');
const lifecycle = require('../lib/browser-lifecycle.cjs');

function cleanupCommand(args) {
  const warnings = [];

  // Deprecation warning for --force
  if (args.includes('--force')) {
    warnings.push('--force 已废弃，请使用 xb stop <browser> 关闭浏览器');
  }

  // Close all agent-browser sessions
  const sessionResults = lifecycle.closeAllSessions();
  const sessionsClosed = sessionResults.filter(r => r.success).length;
  const sessionsFailed = sessionResults.filter(r => !r.success);
  for (const f of sessionsFailed) {
    if (f.error) warnings.push(`Session ${f.browserId}: ${f.error}`);
  }

  return ok('cleanup', {
    sessions_closed: sessionsClosed,
  }, warnings.length > 0 ? warnings : undefined);
}

module.exports = { cleanupCommand };

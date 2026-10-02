'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

async function testPackagingHelpers() {
  const { SUPPORTED_CHANNELS, writeChannelConfig } = require('../pkg');
  assert.deepStrictEqual(SUPPORTED_CHANNELS, [
    'clawhub',
    'qclaw',
    'xiaoyiclaw',
    'miclaw',
    'skillhub',
    'workbuddy'
  ]);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-channel-'));
  try {
    for (const channel of SUPPORTED_CHANNELS) {
      const skillRoot = path.join(
        root,
        channel,
        channel === 'workbuddy' ? 'skills' : 'tc-chengxin'
      );
      writeChannelConfig(skillRoot, channel);
      assert.deepStrictEqual(
        JSON.parse(fs.readFileSync(path.join(skillRoot, 'channel.json'), 'utf8')),
        { callerChannel: channel }
      );
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function testHttpTransport() {
  const received = {};
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      received.header = req.headers['x-skill-caller-channel'];
      received.body = JSON.parse(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"code":"0","data":{}}');
    });
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  process.env.CHENGXIN_API_BASE = `http://127.0.0.1:${port}`;
  const modulePath = require.resolve('./lib/api-client');
  delete require.cache[modulePath];

  try {
    const { call_api } = require('./lib/api-client');
    await call_api('/probe', { query: 'test', callerChannel: 'qclaw' });
    assert.strictEqual(received.header, 'qclaw');
    assert.strictEqual(received.body.callerChannel, 'qclaw');
  } finally {
    await new Promise(resolve => server.close(resolve));
    delete process.env.CHENGXIN_API_BASE;
    delete require.cache[modulePath];
  }
}

(async () => {
  await testPackagingHelpers();
  await testHttpTransport();
  console.log('channel propagation tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

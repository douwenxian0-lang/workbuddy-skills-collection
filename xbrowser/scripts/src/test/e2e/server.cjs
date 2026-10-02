'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PAGES_DIR = path.join(__dirname, 'pages');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
};

function handler(req, res) {
  const parsed = url.parse(req.url, true);
  let pathname = parsed.pathname === '/' ? '/index.html' : parsed.pathname;

  // Handle form submission
  if (pathname === '/result.html' && parsed.query) {
    const params = parsed.query;
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>XB Test Result</title></head>
<body>
<h1>提交结果</h1>
<div id="result">
<p>姓名: <span id="name">${params.name || ''}</span></p>
<p>邮箱: <span id="email">${params.email || ''}</span></p>
<p>城市: <span id="city">${params.city || ''}</span></p>
<p>同意协议: <span id="agree">${params.agree === 'on' ? '是' : '否'}</span></p>
</div>
<a href="/" id="back-home">返回首页</a>
</body></html>`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  const filePath = path.join(PAGES_DIR, pathname);
  const ext = path.extname(filePath);

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404 Not Found</h1>');
    return;
  }

  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
  res.end(fs.readFileSync(filePath));
}

const server = http.createServer(handler);
const PORT = parseInt(process.env.XB_TEST_PORT || '18923', 10);
server.listen(PORT, () => {
  console.log(JSON.stringify({ ok: true, port: PORT, url: `http://localhost:${PORT}` }));
});

// Graceful shutdown
process.on('SIGTERM', () => { server.close(); process.exit(0); });
process.on('SIGINT', () => { server.close(); process.exit(0); });

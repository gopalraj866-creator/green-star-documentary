// npm run preview  ->  http://127.0.0.1:8080/index.html  (real-time preview with timeline bar)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const port = Number(process.env.PORT || 8080);
http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port}/index.html   (Space = pause, ←/→ = ±5 s, H = hide bar, click bar to seek)`));

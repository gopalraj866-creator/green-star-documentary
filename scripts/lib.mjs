// Shared helpers: tiny static server + Chromium launcher (software WebGL friendly).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json' };

export function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      const f = path.join(ROOT, u === '/' ? 'index.html' : u);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

export async function launch({ w, h }) {
  const args = [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--enable-webgl', '--disable-gpu-vsync', '--hide-scrollbars', '--force-color-profile=srgb',
    '--font-render-hinting=none', '--disable-lcd-text', '--no-sandbox', '--disable-dev-shm-usage',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    `--window-size=${w},${h}`,
  ];
  const opts = { headless: true, args };
  if (process.env.CHROME_PATH) opts.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(opts);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning' || /THREE|shader|GLSL/i.test(t)) console.log('[page]', m.type(), t.slice(0, 1500)); });
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 1500)));
  return { browser, page };
}

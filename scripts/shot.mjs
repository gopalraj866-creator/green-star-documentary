// Render selected times to PNG for visual inspection.  node scripts/shot.mjs <profile> <outdir> t1 t2 ...
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch } from './lib.mjs';
const [profile, outdir, ...times] = process.argv.slice(2);
const SIZES = { test: [960, 540], '1080p': [1920, 1080], '4k': [3840, 2160], shorts: [1080, 1920] };
const [w, h] = SIZES[profile];
fs.mkdirSync(outdir, { recursive: true });
const { srv, port } = await serve();
const { browser, page } = await launch({ w, h });
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/index.html?mode=export&profile=${profile}`);
await page.waitForFunction('window.__ready === true', null, { timeout: 600000 });
console.log('ready in', ((Date.now() - t0) / 1000).toFixed(1), 's; GL:', await page.evaluate('window.__glInfo()'));
for (const t of times) {
  const frame = Math.round(Number(t) * 30);
  const s = Date.now();
  const info = await page.evaluate((f) => window.__renderFrame(f), frame);
  await page.screenshot({ path: path.join(outdir, `t${String(t).padStart(6, '0')}.png`), type: 'png', timeout: 600000 });
  console.log('t=', t, JSON.stringify(info), ((Date.now() - s) / 1000).toFixed(2), 's');
}
await browser.close(); srv.close();

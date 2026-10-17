// Render a range of frames and encode them as one H.264 chunk.
//   node scripts/render.mjs --profile 1080p --start 0 --count 300 --out out/chunk_0000.mp4
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { serve, launch, ROOT } from './lib.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const profile = arg('profile', '1080p');
const start = Number(arg('start', 0));
const out = path.resolve(arg('out', `output/chunk_${profile}_${start}.mp4`));
const SIZES = { test: [960, 540], '1080p': [1920, 1080], '4k': [3840, 2160], shorts: [1080, 1920] };
const [w, h] = SIZES[profile];
fs.mkdirSync(path.dirname(out), { recursive: true });

const { srv, port } = await serve();
const { browser, page } = await launch({ w, h });
await page.goto(`http://127.0.0.1:${port}/index.html?mode=export&profile=${profile}`);
await page.waitForFunction('window.__ready === true', null, { timeout: 900000 });
const plan = await page.evaluate('window.__plan');
const count = Math.min(Number(arg('count', plan.frames)), plan.frames - start);
console.log(`profile=${profile} ${plan.w}x${plan.h} total=${plan.frames} frames (${plan.duration}s); chunk ${start}..${start + count - 1}`);
console.log('GL:', await page.evaluate('window.__glInfo()'));

const crf = arg('crf', profile === '4k' ? '16' : '15');
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(plan.fps), '-c:v', 'png', '-i', '-',
  '-c:v', 'libx264', '-preset', arg('preset', 'medium'), '-crf', crf, '-pix_fmt', 'yuv420p', '-profile:v', 'high',
  '-g', String(plan.fps), '-keyint_min', String(plan.fps), '-sc_threshold', '0', '-bf', '2',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-vf', 'scale=in_range=full:out_range=limited:out_color_matrix=bt709,format=yuv420p', '-movflags', '+faststart', out],
  { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((res, rej) => { ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))); ff.stdin.on('error', () => {}); });

const t0 = Date.now();
for (let k = 0; k < count; k++) {
  await page.evaluate((f) => window.__renderFrame(f), start + k);
  const png = await page.screenshot({ type: 'png', timeout: 600000 });
  if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
  if (k % 25 === 0 || k === count - 1) {
    const el = (Date.now() - t0) / 1000;
    console.log(`frame ${start + k} (${k + 1}/${count})  ${(el / (k + 1)).toFixed(2)} s/frame  eta ${(((count - k - 1) * el) / (k + 1) / 60).toFixed(1)} min`);
  }
}
ff.stdin.end();
await done;
await browser.close(); srv.close();
console.log('wrote', out);

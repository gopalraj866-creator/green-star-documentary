// Concatenate chunk MP4s (in order) into the final video; optionally mux an audio file.
//   node scripts/assemble.mjs --dir chunks --out final.mp4 [--audio narration.mp3] [--expect 480]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const dir = path.resolve(arg('dir', 'chunks')), out = path.resolve(arg('out', 'final.mp4')), audio = arg('audio', '');
const expect = Number(arg('expect', 0));
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mp4')).sort();
if (!files.length) { console.error('no chunks in', dir); process.exit(1); }
const list = path.join(dir, 'list.txt');
fs.writeFileSync(list, files.map((f) => `file '${path.join(dir, f)}'`).join('\n'));
const base = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
const args = audio
  ? [...base, '-i', path.resolve(audio), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-af', 'afade=t=out:st=474:d=6', '-shortest', '-movflags', '+faststart', out]
  : [...base, '-c', 'copy', '-movflags', '+faststart', out];
const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status);
const p = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=nb_read_packets,width,height,r_frame_rate:format=duration', '-of', 'json', out]);
const j = JSON.parse(p.stdout.toString());
const frames = Number(j.streams[0].nb_read_packets), dur = Number(j.format.duration);
console.log(`final: ${j.streams[0].width}x${j.streams[0].height} @ ${j.streams[0].r_frame_rate}, ${frames} frames, ${dur.toFixed(3)} s`);
if (expect && Math.abs(dur - expect) > 0.05) { console.error(`DURATION MISMATCH: expected ${expect}s`); process.exit(2); }

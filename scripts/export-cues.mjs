// Writes narration_script.txt, cues.json and captions.srt from the master timeline.
import fs from 'node:fs';
import * as T from '../src/timeline.js';
fs.mkdirSync('docs', { recursive: true });
const ts = (x) => { const ms = Math.round(x * 1000); const p = (n, l = 2) => String(n).padStart(l, '0'); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
const mm = (x) => `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(Math.floor(x % 60)).padStart(2, '0')}`;
fs.writeFileSync('docs/narration_script.txt', T.NARRATION.map((n) => `[${mm(n.t)}] ${n.text}`).join('\n\n') + '\n');
fs.writeFileSync('docs/cues.json', JSON.stringify({ fps: T.FPS, duration: T.DURATION, scenes: T.SCENES, cues: T.AUDIO_CUES }, null, 2));
const srt = T.NARRATION.map((n, i) => {
  const next = T.NARRATION[i + 1] ? T.NARRATION[i + 1].t - 0.4 : 466;
  const end = Math.min(next, n.t + 9);
  return `${i + 1}\n${ts(n.t)} --> ${ts(end)}\n${n.text}\n`;
}).join('\n');
fs.writeFileSync('docs/captions.srt', srt);
console.log('wrote docs/narration_script.txt, docs/cues.json, docs/captions.srt');

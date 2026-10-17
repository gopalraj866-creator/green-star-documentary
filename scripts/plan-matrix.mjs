// Emits the GitHub Actions matrix for the chosen profile(s). Prints JSON to stdout.
//   node scripts/plan-matrix.mjs <1080p|4k|shorts|all> <test:true|false> [chunk override]
import * as T from '../src/timeline.js';
const [which = '1080p', test = 'false', override = ''] = process.argv.slice(2);
const frames = { '1080p': T.TOTAL_FRAMES, '4k': T.TOTAL_FRAMES, shorts: T.exportPlan('shorts').frames };
const defChunk = { '1080p': 300, '4k': 150, shorts: 295 };
const profiles = which === 'all' ? ['1080p', '4k', 'shorts'] : [which];
const include = [];
for (const p of profiles) {
  const total = test === 'true' ? 60 : frames[p];
  const chunk = test === 'true' ? 30 : Number(override) || defChunk[p];
  let idx = 0;
  for (let s = 0; s < total; s += chunk) include.push({ profile: p, idx: String(idx++).padStart(4, '0'), start: s, count: Math.min(chunk, total - s) });
}
if (include.length > 250) { console.error('matrix too large (>250 jobs); raise chunk size'); process.exit(1); }
process.stdout.write(JSON.stringify({ include }));
console.error(`jobs: ${include.length}`);

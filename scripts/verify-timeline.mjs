// Verifies the master timeline, captions, shots and exact runtime. Run: npm run verify
import * as T from '../src/timeline.js';
import { cameraAt, rawPose } from '../src/camera.js';
import { generateDebris, HERO, heroPosition } from '../src/debris.js';
import { spectrumToRGB, rgbToCss } from '../src/spectrum.js';

let fail = 0;
const ok = (c, m) => { if (!c) { console.error('FAIL', m); fail++; } else console.log('ok  ', m); };

// --- runtime -----------------------------------------------------------------
ok(T.FPS === 30 && T.DURATION === 480, 'fps 30, duration 480 s');
ok(T.TOTAL_FRAMES === 14400, 'total frames = 14400');
ok(T.SCENES[0].t0 === 0 && T.SCENES.at(-1).t1 === 480, 'scenes span 0..480');
for (let i = 1; i < T.SCENES.length; i++) ok(T.SCENES[i].t0 === T.SCENES[i - 1].t1, `scene ${i} -> ${i + 1} contiguous`);
ok(Math.abs(T.blackoutAt(480) - 1) < 1e-9, 'picture fully black at 480.000 s');
ok(T.blackoutAt(479.9667) > 0.99, 'last frame (479.967 s) is effectively black');
ok(T.blackoutAt(0) === 1 && T.blackoutAt(20) === 0, 'opens from black, visible at 20 s');

// --- captions ------------------------------------------------------------------
const need = [
  ['c-hook', 'A STAR THAT SHOULDN’T LOOK GREEN?'], ['c-name', 'WD J1330+6435'], ['c-wd', 'WHITE DWARF'],
  ['c-dist', 'APPROXIMATELY 280 LIGHT-YEARS AWAY'], ['c-spec', 'THE STAR’S ATMOSPHERE CHANGES ITS APPARENT COLOUR.'],
  ['c-cut', 'A WHITE DWARF IS THE DENSE REMNANT OF AN EVOLVED STAR.'],
  ['c-colour', 'THE UNIVERSE IS MORE COLOURFUL THAN WE IMAGINED'], ['c-next', 'WHAT SHOULD WE EXPLORE NEXT?'], ['c-brand', 'TECHNICAL TALK INDIA'],
];
for (const [id, text] of need) { const c = T.CAPTIONS.find((x) => x.id === id); ok(c && c.text === text, `caption ${id} text exact`); }
for (const c of T.CAPTIONS) {
  ok(c.t0 >= 0 && c.t1 <= 480 && c.t1 - c.t0 > T.FADE_IN + T.FADE_OUT, `caption ${c.id} window ${c.t0}-${c.t1} fits fades`);
  const mid = (c.t0 + c.t1) / 2;
  ok(T.captionAlpha(c, mid) > 0.99 && T.captionAlpha(c, c.t0 - 0.01) === 0 && T.captionAlpha(c, c.t1 + 0.01) === 0, `caption ${c.id} fades in/out`);
}
// captions in the same group & kind must not overlap in time (so text never collides)
for (const g of ['center', 'stage', 'lower']) {
  const cs = T.CAPTIONS.filter((c) => c.group === g && c.kind !== 'note').sort((a, b) => a.t0 - b.t0);
  for (let i = 1; i < cs.length; i++) ok(cs[i].t0 >= cs[i - 1].t1 - 1.5, `group ${g}: ${cs[i - 1].id} / ${cs[i].id} do not collide`);
}
// the dips must not hide a headline
for (const d of T.DIPS) for (const c of T.CAPTIONS) ok(!(c.t0 < d.t + d.half && c.t1 > d.t - d.half) || c.kind === 'note' && false, `dip @${d.t}s clear of caption ${c.id}`);

// --- shots ---------------------------------------------------------------------
const deb = generateDebris();
for (let i = 1; i < T.SHOTS.length; i++) {
  const a = T.SHOTS[i - 1], b = T.SHOTS[i];
  ok(Math.abs(a.t1 - b.t0) < 1e-9, `shot ${a.id} -> ${b.id} contiguous`);
}
ok(T.SHOTS[0].t0 === 0 && T.SHOTS.at(-1).t1 === 480, 'shots cover 0..480');
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
let maxStep = 0, maxAt = 0;
for (let i = 1; i < T.TOTAL_FRAMES; i++) {
  const t = i / 30, p0 = cameraAt(t - 1 / 30, deb), p1 = cameraAt(t, deb);
  const nearDip = T.DIPS.some((d) => Math.abs(t - d.t) < d.half + 0.2);
  if (nearDip) continue;
  const dd = dist(p0.pos, p1.pos);
  const dc = Math.hypot(...p1.pos); // relative to star
  const rel = dd / Math.max(dc, 1);  // fraction of its distance travelled per frame
  if (rel > maxStep) { maxStep = rel; maxAt = t; }
  // direction change per frame
  const f0 = [p0.tgt[0] - p0.pos[0], p0.tgt[1] - p0.pos[1], p0.tgt[2] - p0.pos[2]];
  const f1 = [p1.tgt[0] - p1.pos[0], p1.tgt[1] - p1.pos[1], p1.tgt[2] - p1.pos[2]];
  const cosv = (f0[0] * f1[0] + f0[1] * f1[1] + f0[2] * f1[2]) / (Math.hypot(...f0) * Math.hypot(...f1));
  const deg = Math.acos(Math.min(1, cosv)) * 180 / Math.PI;
  if (deg * 30 > 16) { ok(false, `view turns ${deg * 30 | 0} deg/s at t=${t.toFixed(2)}`); break; }
}
ok(maxStep < 0.06, `no camera jumps: max per-frame move = ${(maxStep * 100).toFixed(2)}% of range (t=${maxAt.toFixed(1)}s)`);
// minimum distance of camera to the star centre (must stay outside the star: R = 1)
let minD = 1e9;
for (let i = 0; i < T.TOTAL_FRAMES; i++) { const t = i / 30; const p = cameraAt(t, deb).pos; const inEvo = t >= 90 && t < 140; if (!inEvo) minD = Math.min(minD, Math.hypot(...p)); }
ok(minD > 2.2, `camera never inside/touching the star (min centre distance ${minD.toFixed(2)})`);
let minHero = 1e9;
for (const k of ['A', 'B']) for (let t = 160; t < 380; t += 0.1) { const s = T.SHOTS.find((x) => x.type === 'follow' && x.frag === k); if (t < s.t0 || t > s.t1) continue; const f = heroPosition(deb, HERO[k], t); if (f.tau >= 0.999) ok(false, 'hero fragment gone during follow shot ' + k); minHero = Math.min(minHero, f.r); }
ok(minHero > 1.6, `hero fragments stay outside the star while tracked (min r ${minHero.toFixed(2)})`);

// --- shorts ----------------------------------------------------------------------
const sp = T.exportPlan('shorts');
ok(sp.frames === 1770 && Math.abs(sp.duration - 59) < 1e-9, 'shorts cut = 59.0 s = 1770 frames');
ok(T.shortsMap(0).fade > 0.99 && T.shortsMap(sp.duration - 1 / 30).fade > 0.9, 'shorts fade from/to black');

// --- colour model ------------------------------------------------------------------
console.log('modelled colour (illustrative):', rgbToCss(spectrumToRGB(0.72)), ' without absorption:', rgbToCss(spectrumToRGB(0)));
console.log(fail ? `\n${fail} check(s) FAILED` : '\nAll timeline checks passed');
process.exit(fail ? 1 : 0);

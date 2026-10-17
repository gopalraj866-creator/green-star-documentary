// Reusable camera director: explicit shots -> smooth interpolation -> damped pose.
// Pure maths (no three.js) so Node can verify the whole path.
import { SHOTS, smooth, smoother } from './timeline.js';
import { heroPosition, diskToWorld, HERO } from './debris.js';

const D2R = Math.PI / 180;
const cl01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, u) => a + (b - a) * u;
const lerp3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export const DAMP_WINDOW = 0.7; // seconds of exponential-free box damping (deterministic)

function ease(name, u) {
  switch (name) {
    case 'linear': return u;
    case 'smooth': return smooth(u);
    case 'in': return u * u * u;
    case 'out': return 1 - Math.pow(1 - u, 3);
    default: return smoother(u);
  }
}
const pair = (arr, u, expo) => (expo ? arr[0] * Math.pow(arr[1] / arr[0], u) : lerp(arr[0], arr[1], u));

export function shotIndexAt(t) {
  let idx = 0;
  for (let i = 0; i < SHOTS.length; i++) if (t >= SHOTS[i].t0) idx = i;
  return idx;
}

export function evalShot(s, t, debris) {
  const u = ease(s.ease, cl01((t - s.t0) / (s.t1 - s.t0)));
  let pos, tgt;
  if (s.type === 'follow') {
    const f = heroPosition(debris, HERO[s.frag], Math.min(Math.max(t, s.t0), s.t1));
    const rad = norm([f.x, 0, f.z]);
    const tan = [-Math.sin(f.ph), 0, Math.cos(f.ph)];
    const o0 = s.offset[0], o1 = s.offset[1];
    const o = [lerp(o0[0], o1[0], u), lerp(o0[1], o1[1], u), lerp(o0[2], o1[2], u)];
    const fp = [f.x, f.y, f.z];
    pos = add(add(fp, mul(rad, o[0])), add([0, o[1], 0], mul(tan, o[2])));
    const lk = s.look ? lerp(s.look[0], s.look[1], u) : 0;
    tgt = mul(fp, 1 - lk);
    pos = diskToWorld(...pos);
    tgt = diskToWorld(...tgt);
  } else {
    const d = pair(s.d, u, s.expo);
    const az = lerp(s.az[0], s.az[1], u) * D2R;
    const el = lerp(s.el[0], s.el[1], u) * D2R;
    const c = s.tgt || [0, 0, 0];
    pos = [c[0] + d * Math.cos(el) * Math.cos(az), c[1] + d * Math.sin(el), c[2] + d * Math.cos(el) * Math.sin(az)];
    tgt = [c[0], c[1], c[2]];
    if (s.frame === 'disk') { pos = diskToWorld(...pos); tgt = diskToWorld(...tgt); }
    if (s.shift) {
      const sh = lerp(s.shift[0], s.shift[1], u);
      if (sh) {
        const fwd = norm(sub(tgt, pos));
        const right = norm(cross(fwd, [0, 1, 0]));
        tgt = add(tgt, mul(right, sh));
      }
    }
  }
  return { pos, tgt, fov: lerp(s.fov[0], s.fov[1], u) };
}

/** Undamped pose incl. cross-blend into the following shot. */
export function rawPose(t, debris) {
  t = Math.max(0, Math.min(480, t));
  const i = shotIndexAt(t);
  const s = SHOTS[i];
  let p = evalShot(s, Math.min(t, s.t1), debris);
  const n = SHOTS[i + 1];
  if (n && s.blend > 0 && t > s.t1 - s.blend) {
    const w = smooth((t - (s.t1 - s.blend)) / s.blend);
    const q = evalShot(n, Math.max(t, n.t0), debris);
    p = { pos: lerp3(p.pos, q.pos, w), tgt: lerp3(p.tgt, q.tgt, w), fov: lerp(p.fov, q.fov, w) };
  }
  return p;
}

/** Damped pose: average of the raw path over a short trailing window. */
export function cameraAt(t, debris) {
  const N = 6;
  let pos = [0, 0, 0], tgt = [0, 0, 0], fov = 0;
  for (let k = 0; k < N; k++) {
    const p = rawPose(t - (k / (N - 1)) * DAMP_WINDOW, debris);
    pos = add(pos, p.pos); tgt = add(tgt, p.tgt); fov += p.fov;
  }
  return { pos: mul(pos, 1 / N), tgt: mul(tgt, 1 / N), fov: fov / N, shot: SHOTS[shotIndexAt(t)].id };
}

// Deterministic debris data + the CPU twin of the GLSL fragment-path function.
// The vertex shaders (shaders.js) implement exactly the same maths so the
// follow-camera can track a fragment that the GPU is animating.

export const DISK_TILT = (14 * Math.PI) / 180;
export const N_RING = 1500;
export const N_INF = 48;          // infalling fragments (rocks)
export const TRAIL_PER = 72;      // dust-trail particles per infalling fragment
export const N_DISK_DUST = 60000;
export const N_AMBIENT = 3500;
export const TRAIL_LAG = 7.0;     // seconds of path each trail covers
export const INF_K = 0.7;         // spin-up factor while falling

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const omegaOf = (r) => 1.4 * Math.pow(r, -1.5);

/** Indices of the two "hero" fragments tracked by the follow shots. */
export const HERO = { A: N_RING + 0, B: N_RING + N_INF / 2 };

export function generateDebris() {
  const rnd = mulberry32(1330643);
  const total = N_RING + N_INF;
  const orb = new Float32Array(total * 4);   // r0, a0, w0, h
  const inf = new Float32Array(total * 4);   // tStart, duration, size, seed
  const spin = new Float32Array(total * 4);  // axis xyz, rate

  for (let i = 0; i < total; i++) {
    const isInf = i >= N_RING;
    const k = i - N_RING;
    let r0, ts = 1e9, dur = 1, size;
    if (!isInf) {
      // ring rocks with faint ringlets (rejection sampling)
      for (;;) {
        r0 = 3.0 + Math.pow(rnd(), 1.15) * 8.5;
        const dens = 0.72 + 0.28 * Math.sin(r0 * 3.9) * Math.sin(r0 * 1.3 + 0.7);
        if (rnd() < dens) break;
      }
      size = 0.025 + Math.pow(rnd(), 3.2) * 0.11;
    } else {
      r0 = 4.6 + rnd() * 4.4;
      if (k < N_INF / 2) { ts = 148 + rnd() * 14; dur = 26 + rnd() * 16; }
      else { ts = 330 + rnd() * 40; dur = 18 + rnd() * 16; }
      size = 0.07 + rnd() * 0.11;
    }
    if (i === HERO.A) { r0 = 7.2; ts = 158; dur = 32; size = 0.2; }
    if (i === HERO.B) { r0 = 7.6; ts = 338; dur = 32; size = 0.2; }
    const a0 = rnd() * Math.PI * 2;
    const h = (rnd() - 0.5) * 2 * 0.045 * r0 * (isInf ? 0.8 : 1);
    orb.set([r0, a0, omegaOf(r0), h], i * 4);
    inf.set([ts, dur, size, rnd()], i * 4);
    let ax = rnd() * 2 - 1, ay = rnd() * 2 - 1, az = rnd() * 2 - 1;
    const l = Math.hypot(ax, ay, az) || 1;
    spin.set([ax / l, ay / l, az / l, (rnd() - 0.5) * 1.6], i * 4);
  }

  // trail particles: attributes copied from their fragment + (s, random)
  const nTr = N_INF * TRAIL_PER;
  const trOrb = new Float32Array(nTr * 4);
  const trInf = new Float32Array(nTr * 4);
  const trAux = new Float32Array(nTr * 2);
  for (let k = 0; k < N_INF; k++) {
    for (let j = 0; j < TRAIL_PER; j++) {
      const n = k * TRAIL_PER + j;
      const src = (N_RING + k) * 4;
      trOrb.set(orb.subarray(src, src + 4), n * 4);
      trInf.set(inf.subarray(src, src + 4), n * 4);
      trAux[n * 2] = (j + rnd()) / TRAIL_PER;
      trAux[n * 2 + 1] = rnd();
    }
  }

  // disk dust: r, a0, h, size
  const dust = new Float32Array(N_DISK_DUST * 4);
  for (let i = 0; i < N_DISK_DUST; i++) {
    let r;
    for (;;) {
      r = 2.4 + Math.pow(rnd(), 1.35) * 9.6;
      const dens = 0.55 + 0.45 * Math.sin(r * 4.7 + 0.3) * Math.sin(r * 1.7);
      if (rnd() < dens) break;
    }
    const g = (rnd() + rnd() + rnd() - 1.5) / 1.5;      // ~gaussian
    dust.set([r, rnd() * Math.PI * 2, g * 0.05 * r, 0.012 + rnd() * rnd() * 0.05], i * 4);
  }

  // ambient dust: base xyz + seed
  const amb = new Float32Array(N_AMBIENT * 4);
  for (let i = 0; i < N_AMBIENT; i++) {
    const u = rnd(), v = rnd();
    const rr = 4 + Math.cbrt(rnd()) * 36;
    const th = Math.acos(2 * u - 1), ph = v * Math.PI * 2;
    amb.set([rr * Math.sin(th) * Math.cos(ph), rr * Math.cos(th), rr * Math.sin(th) * Math.sin(ph), rnd()], i * 4);
  }

  return { total, orb, inf, spin, trOrb, trInf, trAux, dust, amb, nTrail: nTr };
}

// ---- CPU twin of `fragLocal` in the GLSL ---------------------------------
const cl01 = (x) => Math.max(0, Math.min(1, x));
export function fragLocal(orb, inf, t) {
  const r0 = orb[0], a0 = orb[1], w0 = orb[2], h = orb[3];
  const ts = inf[0], dur = inf[1];
  const tau = cl01((t - ts) / Math.max(dur, 1e-3));
  const r = r0 + (0.96 - r0) * Math.pow(tau, 1.8);
  const ph = a0 + w0 * (t + INF_K * dur * tau * tau * tau * (ts < 1e8 ? 1 : 0));
  const y = h * (1 - tau);
  return { x: r * Math.cos(ph), y, z: r * Math.sin(ph), r, ph, tau };
}

/** Rotate a disk-local point into world space (tilt about +X). */
export function diskToWorld(x, y, z) {
  const c = Math.cos(DISK_TILT), s = Math.sin(DISK_TILT);
  return [x, y * c - z * s, y * s + z * c];
}

export function heroPosition(debris, index, t) {
  const o = debris.orb.subarray(index * 4, index * 4 + 4);
  const f = debris.inf.subarray(index * 4, index * 4 + 4);
  return fragLocal(o, f, t);
}

// Cinematic text overlay (DOM) + scientific diagram layer (2D canvas).
// Both are pure functions of the master time: no CSS transitions, no timers.
import { CAPTIONS, captionAlpha, smooth } from './timeline.js';
import {
  continuum, absorption, spectrumToRGB, wavelengthToLinearRGB, srgbEncode, rgbToCss,
  LAMBDA_MIN, LAMBDA_MAX, ABS_CENTER,
} from './spectrum.js';

const FONT = "Inter, 'Segoe UI', 'Helvetica Neue', Arial, 'Liberation Sans', 'DejaVu Sans', sans-serif";
export const DEPTH_FINAL = 0.72;

export const CSS = `
:root{--u:1px}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:#000;overflow:hidden}
body{font-family:${FONT};-webkit-font-smoothing:antialiased}
#stage{position:fixed;left:0;top:0;background:#000;overflow:hidden}
#gl,#diagram{position:absolute;left:0;top:0;width:100%;height:100%;display:block}
#text{position:absolute;inset:0;pointer-events:none;color:#fff}
.grp{position:absolute;display:flex;flex-direction:column}
.g-center{left:8%;right:8%;top:50%;transform:translateY(-50%);align-items:center;text-align:center}
.g-lower{left:7%;right:7%;bottom:15%;align-items:center;text-align:center}
.g-lowernote{left:7%;right:7%;bottom:6.5%;align-items:center;text-align:center}
.g-info{left:6%;bottom:8%;align-items:flex-start;text-align:left;max-width:60%}
.g-stage{left:7%;right:7%;top:15%;align-items:center;text-align:center}
.g-top{left:6%;top:calc(6% + 46*var(--u));align-items:flex-start;text-align:left;max-width:70%}
.cap{position:relative;opacity:0;visibility:hidden;will-change:opacity,transform;text-shadow:0 0 calc(22*var(--u)) rgba(0,0,0,.65),0 calc(1*var(--u)) calc(3*var(--u)) rgba(0,0,0,.55)}
.cap .rule{display:block;height:calc(2*var(--u));width:calc(120*var(--u));margin:calc(16*var(--u)) auto 0;background:linear-gradient(90deg,rgba(154,230,76,0),#9ae64c 30%,#d7ff8f 70%,rgba(215,255,143,0));transform-origin:50% 50%;transform:scaleX(var(--p,0))}
.g-info .cap .rule,.g-top .cap .rule{margin-left:0;transform-origin:0 50%}
.cap.heading{font-weight:600;letter-spacing:.055em;line-height:1.14;font-size:calc(66*var(--u));text-wrap:balance;margin-bottom:calc(6*var(--u))}
.cap.heading.md{font-size:calc(44*var(--u));letter-spacing:.05em}
.g-info .cap.heading{font-size:calc(54*var(--u));letter-spacing:.07em;margin-bottom:calc(10*var(--u))}
.cap.label{font-weight:500;font-size:calc(24*var(--u));letter-spacing:.2em;color:#e4ffd0;margin-top:calc(6*var(--u))}
.cap.note{font-weight:400;font-size:calc(16.5*var(--u));letter-spacing:.14em;color:rgba(214,226,216,.72);margin-top:calc(6*var(--u))}
.cap.stage{font-weight:600;font-size:calc(40*var(--u));letter-spacing:.16em;color:#fff}
.cap.brand{font-weight:600;font-size:calc(50*var(--u));letter-spacing:.42em;padding-left:.42em;color:#fff}
#persist{position:absolute;left:6%;top:6%;color:rgba(232,245,226,.86);font-size:calc(15*var(--u));letter-spacing:.3em;font-weight:500;display:flex;align-items:center;gap:calc(14*var(--u));text-shadow:0 0 calc(10*var(--u)) rgba(0,0,0,.8)}
#persist i{display:block;width:calc(34*var(--u));height:calc(2*var(--u));background:#9ae64c}
#brandmark{position:absolute;right:7%;top:6%;color:rgba(232,245,226,.7);font-size:calc(14*var(--u));letter-spacing:.32em;font-weight:500;display:none}
#blackout{position:absolute;inset:0;background:#000;opacity:1;pointer-events:none}
body.portrait .g-center{top:30%;left:7%;right:7%}
body.portrait .g-lower{bottom:27%}
body.portrait .g-lowernote{bottom:22%}
body.portrait .g-info{bottom:27%;max-width:86%}
body.portrait .g-stage{top:13%}
body.portrait .g-top{top:calc(9.5% + 44*var(--u));max-width:86%}
body.portrait #persist{top:9%}
body.portrait #brandmark{display:block;top:calc(9% + 34*var(--u));right:auto;left:6%}
body.portrait .cap.heading{font-size:calc(70*var(--u))}
body.portrait .cap.heading.md{font-size:calc(50*var(--u))}
body.portrait .g-info .cap.heading{font-size:calc(60*var(--u))}
body.portrait .cap.label{font-size:calc(27*var(--u))}
body.portrait .cap.note{font-size:calc(19*var(--u))}
body.portrait .cap.brand{font-size:calc(54*var(--u))}
`;

export class TextOverlay {
  constructor(root) {
    this.root = root;
    this.groups = {};
    this.items = [];
    const mk = (cls) => { const d = document.createElement('div'); d.className = 'grp ' + cls; root.appendChild(d); return d; };
    this.groups.center = mk('g-center');
    this.groups.lower = mk('g-lower');
    this.groups.lowernote = mk('g-lowernote');
    this.groups.info = mk('g-info');
    this.groups.stage = mk('g-stage');
    this.groups.top = mk('g-top');
    for (const c of CAPTIONS) {
      const el = document.createElement('div');
      el.className = `cap ${c.kind} ${c.size || ''}`;
      el.id = c.id;
      const span = document.createElement('span');
      span.textContent = c.text;
      el.appendChild(span);
      if (c.kind === 'heading' || c.kind === 'brand') {
        const r = document.createElement('i');
        r.className = 'rule';
        el.appendChild(r);
      }
      let g = c.group;
      if (g === 'lower' && c.kind !== 'heading') g = 'lowernote';
      this.groups[g].appendChild(el);
      this.items.push({ c, el });
    }
    this.u = 1;
  }

  setUnit(u) { this.u = u; }

  update(t) {
    for (const { c, el } of this.items) {
      const a = captionAlpha(c, t);
      if (a <= 0.001) { el.style.display = 'none'; continue; }
      el.style.display = 'block';
      el.style.visibility = 'visible';
      el.style.opacity = a.toFixed(4);
      el.style.transform = `translateY(${((1 - a) * 12 * this.u).toFixed(2)}px)`;
      el.style.setProperty('--p', (Math.min(1, a * 1.15)).toFixed(4));
    }
  }
}

// ---------------------------------------------------------------------------
//  Diagram layer
// ---------------------------------------------------------------------------
const FLUX_MAX = (() => { let m = 0; for (let l = LAMBDA_MIN; l <= LAMBDA_MAX; l += 2) m = Math.max(m, continuum(l)); return m; })();
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, u) => a + (b - a) * u;

// Labels that are pinned to 3D positions (scene 4 and 7).
export const PINNED_LABELS = [
  { t0: 146, t1: 158, text: 'WHITE DWARF', at: 'star', dx: 110, dy: -120 },
  { t0: 148, t1: 159, text: 'ROCKY DEBRIS', at: 'disk', local: [-6.8, 0, 3.4], dx: -90, dy: -70 },
  { t0: 164, t1: 180, text: 'FALLING FRAGMENT', at: 'heroA', dx: 80, dy: -80 },
  { t0: 326, t1: 340, text: 'WHITE DWARF', at: 'star', dx: 110, dy: -120 },
  { t0: 328, t1: 342, text: 'DEBRIS DISK', at: 'disk', local: [-6.8, 0, 3.4], dx: -90, dy: -70 },
  { t0: 341, t1: 354, text: 'INFALLING FRAGMENT', at: 'heroB', dx: 80, dy: -80 },
];

export class Diagram {
  constructor(canvas) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.u = 1;
  }

  resize(w, h) {
    this.cv.width = w; this.cv.height = h;
    this.W = w; this.H = h;
    this.u = Math.min(w, h) / 1080;
  }

  font(px, weight = 500) { return `${weight} ${(px * this.u).toFixed(1)}px ${FONT}`; }

  text(str, x, y, px, { weight = 500, color = '#e8f5e0', align = 'left', spacing = 0.18, alpha = 1, baseline = 'alphabetic' } = {}) {
    const g = this.g;
    g.font = this.font(px, weight);
    g.textAlign = align;
    g.textBaseline = baseline;
    if ('letterSpacing' in g) g.letterSpacing = (spacing * px * this.u).toFixed(2) + 'px';
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fillText(str, x, y);
    g.globalAlpha = 1;
  }

  draw(t, env) {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.W, this.H);
    if (t >= 144 && t < 200) this.drawPinned(t, env);
    if (t >= 322 && t < 360) this.drawPinned(t, env);
    if (t >= 200 && t < 261) this.drawSpectrum(t - 200, env);
    if (t >= 259 && t < 321) this.drawCutaway(t - 260, env);
  }

  // ---- pinned 3D labels ------------------------------------------------------
  drawPinned(t, env) {
    const g = this.g, u = this.u;
    for (const L of PINNED_LABELS) {
      const a = smooth((t - L.t0) / 1.5) * smooth((L.t1 - t) / 1.5);
      if (a <= 0.01) continue;
      let p = null;
      if (L.at === 'star') p = env.project(0, 0, 0);
      else if (L.at === 'disk') p = env.projectDisk(L.local[0], L.local[1], L.local[2]);
      else if (L.at === 'heroA') p = env.projectHero('A', t);
      else if (L.at === 'heroB') p = env.projectHero('B', t);
      if (!p) continue;
      const m = 0.06;
      if (p.x < this.W * m || p.x > this.W * (1 - m) || p.y < this.H * m || p.y > this.H * (1 - m)) continue;
      const off = L.at === 'star' ? 1.0 + 0 : 1;
      const sx = Math.sign(L.dx) || 1;
      const x1 = p.x + L.dx * u, y1 = p.y + L.dy * u;
      g.save();
      g.globalAlpha = a;
      g.strokeStyle = 'rgba(190,255,150,0.85)';
      g.lineWidth = 1.5 * u;
      g.beginPath(); g.arc(p.x, p.y, 7 * u * off, 0, Math.PI * 2); g.stroke();
      g.beginPath();
      g.moveTo(p.x + sx * 7 * u, p.y - 5 * u);
      g.lineTo(x1, y1);
      g.lineTo(x1 + sx * 36 * u, y1);
      g.stroke();
      g.restore();
      this.text(L.text, x1 + sx * 46 * u, y1 + 6 * u, 17, { align: sx > 0 ? 'left' : 'right', color: '#e4ffd0', alpha: a, spacing: 0.2 });
    }
  }

  // ---- Scene 5: spectroscopy display ---------------------------------------
  drawSpectrum(s, env) {
    const g = this.g, W = this.W, H = this.H, u = this.u, portrait = env.portrait;
    const pa = smooth(s / 5) * (1 - smooth((s - 55) / 5));
    if (pa <= 0.002) return;
    const depth = DEPTH_FINAL * smooth((s - 17) / 14);
    const reveal = smooth((s - 5) / 10);

    g.save();
    g.globalAlpha = 1;
    g.fillStyle = `rgba(2,5,7,${(0.92 * pa).toFixed(3)})`;
    g.fillRect(0, 0, W, H);

    const x0 = W * (portrait ? 0.07 : 0.09), x1 = W * (portrait ? 0.93 : 0.91);
    const yTitle = H * (portrait ? 0.15 : 0.13);
    const curveTop = H * (portrait ? 0.17 : 0.17), curveBot = H * (portrait ? 0.295 : 0.33);
    const barTop = H * (portrait ? 0.31 : 0.345), barBot = H * (portrait ? 0.37 : 0.425);
    const axisY = barBot + 26 * u;
    const xOf = (l) => x0 + ((l - LAMBDA_MIN) / (LAMBDA_MAX - LAMBDA_MIN)) * (x1 - x0);
    const reachX = x0 + reveal * (x1 - x0);

    // titles
    this.text('VISIBLE SPECTRUM', x0, yTitle, 22, { weight: 600, color: '#ffffff', alpha: pa * smooth((s - 2) / 3), spacing: 0.24 });
    this.text('SCHEMATIC · ILLUSTRATIVE · NOT MEASURED DATA', x0, yTitle + 30 * u, 14.5, { color: 'rgba(214,226,216,0.75)', alpha: pa * smooth((s - 3) / 3), spacing: 0.16 });

    // bar
    g.globalAlpha = pa;
    for (let x = x0; x <= reachX; x += 2) {
      const l = LAMBDA_MIN + ((x - x0) / (x1 - x0)) * (LAMBDA_MAX - LAMBDA_MIN);
      const rgb = wavelengthToLinearRGB(l);
      const tr = absorption(l, depth);
      const k = Math.max(0.05, tr);
      g.fillStyle = `rgb(${Math.round(srgbEncode(rgb[0] * k) * 255)},${Math.round(srgbEncode(rgb[1] * k) * 255)},${Math.round(srgbEncode(rgb[2] * k) * 255)})`;
      g.fillRect(x, barTop, 2.5, barBot - barTop);
    }
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 1 * u;
    g.strokeRect(x0, barTop, x1 - x0, barBot - barTop);

    // axis + ticks
    g.strokeStyle = 'rgba(255,255,255,0.45)';
    g.beginPath(); g.moveTo(x0, axisY - 8 * u); g.lineTo(x1, axisY - 8 * u); g.stroke();
    for (let l = 400; l <= 700; l += 50) {
      const x = xOf(l);
      g.beginPath(); g.moveTo(x, axisY - 8 * u); g.lineTo(x, axisY - 2 * u); g.stroke();
      this.text(String(l), x, axisY + 22 * u, 15, { align: 'center', color: 'rgba(230,240,230,0.8)', alpha: pa, spacing: 0.08 });
    }
    this.text('WAVELENGTH (NM)', x1, axisY + 46 * u, 13.5, { align: 'right', color: 'rgba(214,226,216,0.7)', alpha: pa, spacing: 0.16 });

    // flux curves
    const fy = (flux) => curveBot - (curveBot - curveTop) * 0.92 * (flux / FLUX_MAX);
    if (reveal > 0.001) {
      // reference continuum (dashed) once the absorption appears
      if (depth > 0.01) {
        g.setLineDash([6 * u, 6 * u]);
        g.strokeStyle = 'rgba(255,255,255,0.35)';
        g.lineWidth = 1.5 * u;
        g.beginPath();
        let first = true;
        for (let x = x0; x <= reachX; x += 3) {
          const l = LAMBDA_MIN + ((x - x0) / (x1 - x0)) * (LAMBDA_MAX - LAMBDA_MIN);
          const y = fy(continuum(l));
          if (first) { g.moveTo(x, y); first = false; } else g.lineTo(x, y);
        }
        g.stroke();
        g.setLineDash([]);
      }
      // filled spectrum
      g.beginPath();
      g.moveTo(x0, curveBot);
      for (let x = x0; x <= reachX; x += 3) {
        const l = LAMBDA_MIN + ((x - x0) / (x1 - x0)) * (LAMBDA_MAX - LAMBDA_MIN);
        g.lineTo(x, fy(continuum(l) * absorption(l, depth)));
      }
      g.lineTo(reachX, curveBot);
      g.closePath();
      const grd = g.createLinearGradient(0, curveTop, 0, curveBot);
      grd.addColorStop(0, 'rgba(190,255,150,0.30)');
      grd.addColorStop(1, 'rgba(190,255,150,0.02)');
      g.fillStyle = grd;
      g.fill();
      g.strokeStyle = 'rgba(235,255,225,0.95)';
      g.lineWidth = 2.2 * u;
      g.beginPath();
      for (let x = x0; x <= reachX; x += 3) {
        const l = LAMBDA_MIN + ((x - x0) / (x1 - x0)) * (LAMBDA_MAX - LAMBDA_MIN);
        const y = fy(continuum(l) * absorption(l, depth));
        if (x === x0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
      this.text('FLUX', x0 - 6 * u, curveTop + 4 * u, 13, { align: 'left', color: 'rgba(214,226,216,0.7)', alpha: pa, spacing: 0.2 });
    }

    // absorption annotation
    const aa = smooth((s - 20) / 4) * (1 - smooth((s - 52) / 4)) * pa;
    if (aa > 0.01) {
      const xa = xOf(ABS_CENTER);
      const ya = fy(continuum(ABS_CENTER) * absorption(ABS_CENTER, depth));
      g.globalAlpha = aa;
      g.strokeStyle = 'rgba(255,190,110,0.95)';
      g.lineWidth = 1.8 * u;
      const lx0 = xOf(ABS_CENTER - 55), lx1 = xOf(ABS_CENTER + 55);
      const yb = barBot + 2 * u;
      g.beginPath();
      g.moveTo(lx0, barTop - 8 * u); g.lineTo(lx0, barTop - 14 * u); g.lineTo(lx1, barTop - 14 * u); g.lineTo(lx1, barTop - 8 * u);
      g.stroke();
      g.beginPath(); g.arc(xa, ya, 5 * u, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 1;
      const tx = portrait ? W * 0.5 : xa;
      const ty = (portrait ? barBot + 92 * u : barTop - 30 * u);
      const yText = portrait ? axisY + 78 * u : curveTop - 4 * u;
      this.text('BROAD ABSORPTION IN THE ORANGE', portrait ? W * 0.5 : xa, yText, portrait ? 20 : 19, { align: 'center', weight: 600, color: '#ffd7a0', alpha: aa, spacing: 0.14 });
      this.text('ATTRIBUTED TO SODIUM IN A VERY DENSE ATMOSPHERE', portrait ? W * 0.5 : xa, yText + 26 * u, portrait ? 14 : 14, { align: 'center', color: 'rgba(255,225,190,0.85)', alpha: aa, spacing: 0.12 });
      void tx; void ty; void yb;
    }

    // conversion to a modelled colour
    const conv = smooth((s - 33) / 4) * pa;
    if (conv > 0.01) {
      const cx = W * 0.5;
      const cy = H * (portrait ? 0.53 : 0.665);
      const rad = (portrait ? W * 0.10 : H * 0.075);
      const sep = W * (portrait ? 0.26 : 0.20);
      const colA = spectrumToRGB(0);
      const colB = spectrumToRGB(depth);
      const sw = (x, y, col, a) => {
        const rgbCss = (k) => rgbToCss(col.map((v) => v * k));
        const rg = g.createRadialGradient(x - rad * 0.35, y - rad * 0.35, rad * 0.1, x, y, rad);
        rg.addColorStop(0, rgbCss(1.0));
        rg.addColorStop(0.7, rgbCss(0.62));
        rg.addColorStop(1, rgbCss(0.14));
        g.globalAlpha = a;
        g.fillStyle = rg;
        g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
      };
      // guide lines from the bar down to the swatches
      g.globalAlpha = conv * 0.6;
      g.strokeStyle = 'rgba(255,255,255,0.4)';
      g.lineWidth = 1.2 * u;
      g.setLineDash([4 * u, 6 * u]);
      g.beginPath(); g.moveTo(cx - sep, cy - rad - 14 * u); g.lineTo(cx - sep, axisY + 62 * u);
      g.moveTo(cx + sep, cy - rad - 14 * u); g.lineTo(cx + sep, axisY + 62 * u);
      g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 1;
      sw(cx - sep, cy, colA, conv);
      const second = smooth((s - 40) / 5) * pa;
      sw(cx + sep, cy, colB, second);
      this.text('WITHOUT THE ABSORPTION', cx - sep, cy + rad + 36 * u, portrait ? 17 : 16, { align: 'center', alpha: conv, spacing: 0.16, color: 'rgba(230,240,230,0.9)' });
      this.text('WITH THE ABSORPTION', cx + sep, cy + rad + 36 * u, portrait ? 17 : 16, { align: 'center', alpha: second, spacing: 0.16, color: '#e8ffcf', weight: 600 });
      // arrow
      g.globalAlpha = second;
      g.strokeStyle = 'rgba(190,255,150,0.9)';
      g.lineWidth = 2 * u;
      g.beginPath(); g.moveTo(cx - sep + rad + 20 * u, cy); g.lineTo(cx + sep - rad - 22 * u, cy);
      g.moveTo(cx + sep - rad - 34 * u, cy - 9 * u); g.lineTo(cx + sep - rad - 22 * u, cy); g.lineTo(cx + sep - rad - 34 * u, cy + 9 * u);
      g.stroke();
      g.globalAlpha = 1;
      this.text('MODELLED HUMAN-VISIBLE COLOUR', cx, cy - rad - 34 * u, portrait ? 18 : 18, { align: 'center', weight: 600, color: '#ffffff', alpha: second, spacing: 0.2 });
    }
    g.restore();
  }

  // ---- Scene 6: schematic cross-section ---------------------------------------
  drawCutaway(s, env) {
    const g = this.g, W = this.W, H = this.H, u = this.u;
    const pa = smooth(s / 3) * (1 - smooth((s - 57) / 3));
    if (pa <= 0.002 || !env.silhouette) return;
    const open = smooth((s - 3.5) / 6);
    if (open <= 0.001) return;
    const phiMid = (38 * Math.PI) / 180;
    const half = (46 * Math.PI) / 180 * open;
    const phi0 = phiMid - half, phi1 = phiMid + half;
    const N = 40;
    const arc = (f, a, b) => {
      const pts = [];
      for (let i = 0; i <= N; i++) { const p = env.silhouette(f, lerp(a, b, i / N)); pts.push(p); }
      return pts;
    };
    const center = env.project(0, 0, 0);
    if (!center) return;

    g.save();
    g.globalAlpha = pa;
    // 1. cut away the surface inside the wedge
    let pts = arc(1.012, phi0, phi1);
    g.beginPath(); g.moveTo(center.x, center.y);
    for (const p of pts) g.lineTo(p.x, p.y);
    g.closePath();
    g.fillStyle = '#03060a';
    g.fill();

    // 2. layers (outer -> inner): atmosphere, envelope, degenerate core
    const layers = [
      { f0: 1.0, f1: 0.955, fill: 'rgba(206,255,170,0.97)', t: 8.0 },
      { f0: 0.955, f1: 0.84, fill: 'rgba(150,196,84,0.97)', t: 11.0 },
      { f0: 0.84, f1: 0.0, fill: null, t: 14.0 },
    ];
    layers.forEach((L) => {
      const a = smooth((s - L.t) / 3);
      if (a <= 0.001) return;
      g.globalAlpha = pa * a;
      g.beginPath();
      if (L.f1 > 0) {
        const o = arc(L.f0, phi0, phi1), inn = arc(L.f1, phi0, phi1).reverse();
        g.moveTo(o[0].x, o[0].y);
        for (const p of o) g.lineTo(p.x, p.y);
        for (const p of inn) g.lineTo(p.x, p.y);
        g.closePath();
        g.fillStyle = L.fill;
      } else {
        const o = arc(L.f0, phi0, phi1);
        g.moveTo(center.x, center.y);
        for (const p of o) g.lineTo(p.x, p.y);
        g.closePath();
        const rg = g.createRadialGradient(center.x, center.y, 0, center.x, center.y, env.starRadiusPx * 0.9);
        rg.addColorStop(0, 'rgba(255,255,240,1)');
        rg.addColorStop(0.6, 'rgba(236,244,196,1)');
        rg.addColorStop(1, 'rgba(200,226,140,1)');
        g.fillStyle = rg;
      }
      g.fill();
    });
    g.globalAlpha = pa;
    // wedge edges
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 1.6 * u;
    const e0 = env.silhouette(1.012, phi0), e1 = env.silhouette(1.012, phi1);
    g.beginPath();
    g.moveTo(e0.x, e0.y); g.lineTo(center.x, center.y); g.lineTo(e1.x, e1.y);
    g.stroke();

    // 3. labels with leader lines
    const labels = [
      { t: 17, f: 0.978, name: 'THIN ATMOSPHERE', sub: 'WHERE ELEMENTS FROM ACCRETED MATERIAL SHOW UP', y: 0.25 },
      { t: 22, f: 0.90, name: 'ENVELOPE', sub: 'A THIN, DENSE LAYER ABOVE THE CORE', y: 0.41 },
      { t: 27, f: 0.45, name: 'DEGENERATE CORE', sub: 'DENSE CARBON–OXYGEN INTERIOR (TYPICAL)', y: 0.57 },
    ];
    const lx = Math.min(W * 0.62, center.x + env.starRadiusPx * 1.2);
    labels.forEach((L) => {
      const a = smooth((s - L.t) / 2.5) * pa;
      if (a <= 0.01) return;
      const p = env.silhouette(L.f, phiMid);
      const ly = H * L.y;
      g.globalAlpha = a;
      g.strokeStyle = 'rgba(214,255,180,0.9)';
      g.lineWidth = 1.6 * u;
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(lx - 20 * u, ly); g.lineTo(lx, ly); g.stroke();
      g.fillStyle = '#e4ffd0';
      g.beginPath(); g.arc(p.x, p.y, 4.5 * u, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
      this.text(L.name, lx + 14 * u, ly + 2 * u, 24, { weight: 600, color: '#ffffff', alpha: a, spacing: 0.14 });
      this.text(L.sub, lx + 14 * u, ly + 32 * u, 14.5, { color: 'rgba(214,226,216,0.8)', alpha: a, spacing: 0.1 });
    });

    // 4. to-scale size comparison: the Sun versus an Earth-sized remnant
    const ia = smooth((s - 34) / 3) * pa;
    if (ia > 0.01) {
      const sunR = 66 * u;
      const cx = W * 0.865, cy = H * 0.77;
      const wd = Math.max(1.6 * u, (sunR / 109));    // Earth is ~1/109 of the Sun's radius
      g.globalAlpha = ia;
      const sg = g.createRadialGradient(cx - sunR * 0.3, cy - sunR * 0.3, sunR * 0.1, cx, cy, sunR);
      sg.addColorStop(0, 'rgba(255,244,214,1)');
      sg.addColorStop(1, 'rgba(240,170,70,1)');
      g.fillStyle = sg;
      g.beginPath(); g.arc(cx, cy, sunR, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e6ff9a';
      g.beginPath(); g.arc(cx + sunR + 34 * u, cy, wd, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(230,255,190,0.8)';
      g.lineWidth = 1.2 * u;
      g.beginPath(); g.arc(cx + sunR + 34 * u, cy, wd + 5 * u, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 1;
      this.text('THE SUN', cx, cy - sunR - 14 * u, 14.5, { align: 'center', alpha: ia, spacing: 0.2 });
      this.text('EARTH-SIZED REMNANT', cx + sunR * 0.6, cy + sunR + 30 * u, 13.5, { align: 'center', alpha: ia, spacing: 0.14, color: '#e6ff9a' });
      this.text('SIZES TO SCALE', cx + sunR * 0.6, cy + sunR + 52 * u, 12, { align: 'center', alpha: ia * 0.8, spacing: 0.18, color: 'rgba(214,226,216,0.75)' });
    }
    g.restore();
  }
}

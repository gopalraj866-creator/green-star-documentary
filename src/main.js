// THE REAL GREEN STAR — WD J1330+6435 · scientific visualization
// One deterministic scene driven by updateScene(timeSeconds).
//   ?mode=preview            real-time preview with timeline indicator (default)
//   ?mode=export&profile=..  deterministic frame export (1080p | 4k | shorts | test)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import * as TL from './timeline.js';
import { cameraAt } from './camera.js';
import * as DB from './debris.js';
import * as SH from './shaders.js';
import { spectrumToRGB } from './spectrum.js';
import { CSS, TextOverlay, Diagram, DEPTH_FINAL } from './overlay.js';

const params = new URLSearchParams(location.search);
const MODE = params.get('mode') === 'export' ? 'export' : 'preview';
const PROFILES = {
  '1080p': { w: 1920, h: 1080, plan: 'full' },
  '4k': { w: 3840, h: 2160, plan: 'full' },
  shorts: { w: 1080, h: 1920, plan: 'shorts' },
  test: { w: 960, h: 540, plan: 'full' },
};
const PROFILE = PROFILES[params.get('profile')] || PROFILES['1080p'];
const PLAN = TL.exportPlan(PROFILE.plan);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, u) => a + (b - a) * u;
const mix3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];

document.getElementById('app-css').textContent = CSS;
const stageEl = document.getElementById('stage');
const glCanvas = document.getElementById('gl');
const dgCanvas = document.getElementById('diagram');
const blackoutEl = document.getElementById('blackout');

// ---------------------------------------------------------------------------
//  Renderer / post
// ---------------------------------------------------------------------------
let W = PROFILE.w, H = PROFILE.h;
if (MODE === 'preview') {
  const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080, 1);
  W = Math.round(1920 * Math.min(s, 1) / 2) * 2; H = Math.round(W * 9 / 16);
  if (W < 640) { W = 640; H = 360; }
}
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.setClearColor(0x000000, 1);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 2.0e6);

const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(1);
composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.38, 0.55, 0.85);
composer.addPass(bloom);
const gradePass = new ShaderPass(new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.clone(SH.GRADE_SHADER.uniforms),
  vertexShader: SH.GRADE_SHADER.vertexShader,
  fragmentShader: SH.GRADE_SHADER.fragmentShader,
}));
composer.addPass(gradePass);
gradePass.material.uniforms.uRes.value = [W, H];

function layout() {
  const portrait = H > W;
  document.body.classList.toggle('portrait', portrait);
  if (MODE === 'export') {
    stageEl.style.width = W + 'px'; stageEl.style.height = H + 'px';
    stageEl.style.left = '0px'; stageEl.style.top = '0px';
    stageEl.style.setProperty('--u', (Math.min(W, H) / 1080) + 'px');
  } else {
    const k = Math.min(window.innerWidth / W, (window.innerHeight - 56) / H);
    const cw = Math.floor(W * k), ch = Math.floor(H * k);
    stageEl.style.width = cw + 'px'; stageEl.style.height = ch + 'px';
    stageEl.style.left = Math.floor((window.innerWidth - cw) / 2) + 'px';
    stageEl.style.top = Math.floor((window.innerHeight - 56 - ch) / 2) + 'px';
    stageEl.style.setProperty('--u', (Math.min(cw, ch) / 1080) + 'px');
    overlay.setUnit(Math.min(cw, ch) / 1080);
  }
}

// ---------------------------------------------------------------------------
//  Colour of the star (artistic reconstruction from the schematic spectrum)
// ---------------------------------------------------------------------------
const MODELLED = spectrumToRGB(DEPTH_FINAL);                  // linear sRGB, max channel = 1
const GREEN_CORE = [MODELLED[0] * 0.90, MODELLED[1], MODELLED[2] * 0.62];
const GREEN_RIM = mix3(GREEN_CORE, [0.32, 1.0, 0.30], 0.55);
const LOOK = {
  green: { core: GREEN_CORE, rim: GREEN_RIM, spot: [0.62, 0.86, 0.46], bright: 0.74, scale: 4.2, contrast: 1.7 },
  sun: { core: [1.0, 0.80, 0.42], rim: [1.0, 0.46, 0.14], spot: [0.62, 0.30, 0.10], bright: 0.85, scale: 3.4, contrast: 2.0 },
  giant: { core: [1.0, 0.40, 0.12], rim: [0.70, 0.12, 0.04], spot: [0.45, 0.12, 0.05], bright: 0.62, scale: 1.7, contrast: 1.25 },
  hot: { core: [0.86, 0.94, 1.0], rim: [0.45, 0.68, 1.0], spot: [0.75, 0.85, 1.0], bright: 1.1, scale: 5.0, contrast: 0.5 },
};
function mixLook(a, b, u) {
  return {
    core: mix3(a.core, b.core, u), rim: mix3(a.rim, b.rim, u), spot: mix3(a.spot, b.spot, u),
    bright: lerp(a.bright, b.bright, u), scale: lerp(a.scale, b.scale, u), contrast: lerp(a.contrast, b.contrast, u),
  };
}
function evoAt(t) {
  const K = TL.EVO_KEYS;
  if (t <= K[0].t) return K[0];
  for (let i = 1; i < K.length; i++) {
    if (t <= K[i].t) {
      const a = K[i - 1], b = K[i], u = TL.smooth((t - a.t) / (b.t - a.t));
      const lu = (t - a.t) / (b.t - a.t);
      // radius: exponential blend (giant swelling / collapse reads naturally)
      return {
        r: Math.exp(lerp(Math.log(a.r), Math.log(b.r), u)),
        stage: lerp(a.stage, b.stage, lu), shell: lerp(a.shell, b.shell, lu), alpha: lerp(a.alpha, b.alpha, lu),
      };
    }
  }
  return K[K.length - 1];
}
function starState(t) {
  if (t >= 90 && t < 140) {
    const e = evoAt(t);
    let look = e.stage <= 1 ? mixLook(LOOK.sun, LOOK.giant, e.stage) : mixLook(LOOK.giant, LOOK.hot, e.stage - 1);
    if (t > 130) look = mixLook(look, LOOK.green, TL.smooth((t - 131) / 8));
    return { r: e.r, look, evo: e };
  }
  return { r: 1, look: LOOK.green, evo: null };
}

// ---------------------------------------------------------------------------
//  Sky (baked once into a cube map) and star layers
// ---------------------------------------------------------------------------
const skyBake = new THREE.Scene();
const galN = new THREE.Vector3(0.18, 0.93, -0.32).normalize();
const galX = new THREE.Vector3(1, 0, 0).sub(galN.clone().multiplyScalar(galN.x)).normalize();
const galY = new THREE.Vector3().crossVectors(galN, galX).normalize();
const skyBakeMat = new THREE.ShaderMaterial({
  vertexShader: SH.SKY_VERT, fragmentShader: SH.SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false,
  uniforms: {
    uGalN: { value: galN }, uGalX: { value: galX }, uGalY: { value: galY },
    uNeb: { value: [new THREE.Vector3(-0.5, 0.2, 0.84).normalize(), new THREE.Vector3(0.7, -0.35, 0.62).normalize(), new THREE.Vector3(0.1, 0.55, -0.83).normalize()] },
    uBright: { value: 1 },
  },
});
skyBake.add(new THREE.Mesh(new THREE.SphereGeometry(5, 48, 24), skyBakeMat));
const SKY_SIZE = MODE === 'export' ? (PROFILE.w >= 3000 ? 2048 : 1536) : 512;
const skyRT = new THREE.WebGLCubeRenderTarget(SKY_SIZE, { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
const cubeCam = new THREE.CubeCamera(0.1, 20, skyRT);
cubeCam.update(renderer, skyBake);

const skyMat = new THREE.ShaderMaterial({
  uniforms: { uCube: { value: skyRT.texture }, uBright: { value: 1 } },
  vertexShader: SH.SKY_VERT,
  fragmentShader: `uniform samplerCube uCube; uniform float uBright; varying vec3 vDir;
    void main(){ gl_FragColor = vec4(textureCube(uCube, normalize(vDir)).rgb * uBright, 1.0); }`,
  side: THREE.BackSide, depthWrite: false, depthTest: false,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), skyMat);
sky.scale.setScalar(5.0e5);
sky.frustumCulled = false;
sky.renderOrder = -100;
scene.add(sky);

function starTint(rnd) {
  const u = rnd();
  const pal = [[1.0, 0.60, 0.34], [1.0, 0.80, 0.58], [1.0, 0.93, 0.82], [1.0, 0.98, 0.96], [0.84, 0.90, 1.0], [0.68, 0.80, 1.0]];
  const w = [0.10, 0.16, 0.22, 0.24, 0.17, 0.11];
  let acc = 0;
  for (let i = 0; i < pal.length; i++) { acc += w[i]; if (u <= acc) return pal[i]; }
  return pal[3];
}
function makeStarLayer({ count, rmin, rmax, seed, near, sizeBase, sizeBoost, bright }) {
  const rnd = DB.mulberry32(seed);
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), size = new Float32Array(count), sd = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = rnd() * 2 - 1, ph = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const r = rmin === rmax ? rmin : Math.cbrt(lerp(Math.pow(rmin, 3), Math.pow(rmax, 3), rnd()));
    pos.set([r * s * Math.cos(ph), r * u, r * s * Math.sin(ph)], i * 3);
    const m = Math.pow(rnd(), 4.2);                    // few bright stars, many faint ones
    const tint = starTint(rnd);
    const b = 0.22 + 1.35 * m;
    col.set([tint[0] * b, tint[1] * b, tint[2] * b], i * 3);
    size[i] = sizeBase + sizeBoost * m;
    sd[i] = rnd();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  const m = new THREE.ShaderMaterial({
    vertexShader: SH.STARS_VERT, fragmentShader: SH.STARS_FRAG, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uPx: { value: H / 1080 }, uTime: { value: 0 }, uNear: { value: near }, uBright: { value: bright } },
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.renderOrder = -50;
  scene.add(pts);
  return pts;
}
const starLayers = [
  makeStarLayer({ count: 16000, rmin: 90000, rmax: 90000, seed: 11, near: 0, sizeBase: 1.5, sizeBoost: 2.8, bright: 1.0 }),   // far sphere
  makeStarLayer({ count: 7000, rmin: 14000, rmax: 34000, seed: 22, near: 0, sizeBase: 1.6, sizeBoost: 3.0, bright: 0.9 }),    // mid volume (parallax on pullback)
  makeStarLayer({ count: 7500, rmin: 25, rmax: 9000, seed: 33, near: 1, sizeBase: 1.5, sizeBoost: 3.2, bright: 1.0 }),        // near volume (parallax on approach)
];

// ---------------------------------------------------------------------------
//  The star
// ---------------------------------------------------------------------------
const starGroup = new THREE.Group();
scene.add(starGroup);
const starSpin = new THREE.Group();
starGroup.add(starSpin);

const starMat = new THREE.ShaderMaterial({
  vertexShader: SH.STAR_VERT, fragmentShader: SH.STAR_FRAG,
  uniforms: {
    uTime: { value: 0 }, uCore: { value: new THREE.Vector3() }, uRim: { value: new THREE.Vector3() }, uSpot: { value: new THREE.Vector3() },
    uScale: { value: 4 }, uContrast: { value: 1 }, uBright: { value: 1.5 }, uSeed: { value: 3.7 },
  },
});
const starMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 96), starMat);
starSpin.add(starMesh);

const shellDefs = [
  { rs: 1.35, k: 9.0, int: 0.30 },
  { rs: 2.30, k: 4.6, int: 0.04 },
  { rs: 4.60, k: 2.2, int: 0.018 },
];
const shells = shellDefs.map((d) => {
  const m = new THREE.ShaderMaterial({
    vertexShader: SH.STAR_VERT, fragmentShader: SH.SHELL_FRAG, side: THREE.BackSide, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Vector3(0.7, 1, 0.5) }, uRs: { value: d.rs }, uK: { value: d.k }, uInt: { value: d.int } },
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(d.rs, 96, 48), m);
  mesh.renderOrder = 1;
  starGroup.add(mesh);
  return mesh;
});

const billMat = new THREE.ShaderMaterial({
  vertexShader: SH.BILL_VERT, fragmentShader: SH.BILL_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: {
    uSize: { value: 40 }, uPointSize: { value: 1 }, uPointI: { value: 0 }, uGlowI: { value: 1 }, uTime: { value: 0 },
    uColor: { value: new THREE.Vector3(0.7, 1, 0.5) }, uColor2: { value: new THREE.Vector3(0.9, 1, 0.8) },
  },
});
const billboard = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), billMat);
billboard.renderOrder = 2;
billboard.frustumCulled = false;
scene.add(billboard);

// ---------------------------------------------------------------------------
//  Debris system (disk frame is tilted about X)
// ---------------------------------------------------------------------------
const deb = DB.generateDebris();
const diskGroup = new THREE.Group();
diskGroup.rotation.x = DB.DISK_TILT;
scene.add(diskGroup);

const debrisUniform = { value: 1 };
const timeUniform = { value: 0 };
const focalUniform = { value: 1500 };

const rockGeo = new THREE.InstancedBufferGeometry();
{
  const ico = new THREE.IcosahedronGeometry(1, 1);
  rockGeo.index = ico.index;
  rockGeo.setAttribute('position', ico.getAttribute('position'));
  rockGeo.setAttribute('normal', ico.getAttribute('normal'));
  rockGeo.setAttribute('aOrb', new THREE.InstancedBufferAttribute(deb.orb, 4));
  rockGeo.setAttribute('aInf', new THREE.InstancedBufferAttribute(deb.inf, 4));
  rockGeo.setAttribute('aSpin', new THREE.InstancedBufferAttribute(deb.spin, 4));
  rockGeo.instanceCount = deb.total;
}
const rockMat = new THREE.ShaderMaterial({
  vertexShader: SH.ROCK_VERT, fragmentShader: SH.ROCK_FRAG, uniforms: { uTime: timeUniform, uDebris: debrisUniform },
});
rockMat.extensions = { derivatives: true };
const rocks = new THREE.Mesh(rockGeo, rockMat);
rocks.frustumCulled = false;
diskGroup.add(rocks);

function pointsFrom(attrs, count, mat, order) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  for (const [name, arr, n] of attrs) g.setAttribute(name, new THREE.BufferAttribute(arr, n));
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false; p.renderOrder = order;
  return p;
}
const trailMat = new THREE.ShaderMaterial({
  vertexShader: SH.TRAIL_VERT, fragmentShader: SH.TRAIL_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: timeUniform, uDebris: debrisUniform, uPxScale: focalUniform, uLag: { value: DB.TRAIL_LAG } },
});
diskGroup.add(pointsFrom([['aOrb', deb.trOrb, 4], ['aInf', deb.trInf, 4], ['aTr', deb.trAux, 2]], deb.nTrail, trailMat, 5));

const dustMat = new THREE.ShaderMaterial({
  vertexShader: SH.DUST_VERT, fragmentShader: SH.DUST_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: timeUniform, uDebris: debrisUniform, uPxScale: focalUniform, uSizeMul: { value: 1 }, uBrightMul: { value: 0.16 } },
});
diskGroup.add(pointsFrom([['aD', deb.dust, 4]], DB.N_DISK_DUST, dustMat, 4));

const ambMat = new THREE.ShaderMaterial({
  vertexShader: SH.AMBIENT_VERT, fragmentShader: SH.AMBIENT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: timeUniform, uAmb: { value: 0.35 }, uPxScale: focalUniform },
});
const ambient = pointsFrom([['aA', deb.amb, 4]], DB.N_AMBIENT, ambMat, 3);
scene.add(ambient);

// illustrative orbit lines (scene 7)
const lineMat = new THREE.ShaderMaterial({
  vertexShader: SH.LINE_VERT, fragmentShader: SH.LINE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uOpacity: { value: 0 } },
});
const orbitLines = new THREE.Group();
for (const r of [3.6, 5.4, 7.2, 9.0, 10.8]) {
  const pts = [];
  for (let i = 0; i < 360; i++) { const a = (i / 360) * Math.PI * 2; pts.push(new THREE.Vector3(r * Math.cos(a), 0, r * Math.sin(a))); }
  const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), lineMat);
  l.frustumCulled = false; l.renderOrder = 6;
  orbitLines.add(l);
}
diskGroup.add(orbitLines);

// ---------------------------------------------------------------------------
//  Scene 3: expelled gas
// ---------------------------------------------------------------------------
const gasMat = new THREE.ShaderMaterial({
  vertexShader: SH.STAR_VERT, fragmentShader: SH.GASSHELL_FRAG, side: THREE.BackSide, transparent: true, depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: { uTime: timeUniform, uAlpha: { value: 0 }, uSeed: { value: 4.2 }, uInner: { value: new THREE.Vector3(0.35, 0.95, 0.85) }, uOuter: { value: new THREE.Vector3(1.0, 0.45, 0.22) } },
});
const gasShell = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), gasMat);
gasShell.renderOrder = 3;
scene.add(gasShell);
{
  const rnd = DB.mulberry32(777);
  const N = 2600, aP = new Float32Array(N * 4), aR = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = rnd() * 2 - 1, ph = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    aP.set([s * Math.cos(ph), u, s * Math.sin(ph), 0.65 + 0.35 * rnd()], i * 4);
    aR[i] = rnd();
  }
  var puffGeo = new THREE.BufferGeometry();
  puffGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  puffGeo.setAttribute('aP', new THREE.BufferAttribute(aP, 4));
  puffGeo.setAttribute('aR', new THREE.BufferAttribute(aR, 1));
}
const puffMat = new THREE.ShaderMaterial({
  vertexShader: SH.PUFF_VERT, fragmentShader: SH.PUFF_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uProg: { value: 0 }, uR0: { value: 18 }, uRmax: { value: 130 }, uAlpha: { value: 0 }, uPxScale: focalUniform },
});
const puffs = new THREE.Points(puffGeo, puffMat);
puffs.frustumCulled = false; puffs.renderOrder = 3;
scene.add(puffs);

// ---------------------------------------------------------------------------
//  Overlay objects
// ---------------------------------------------------------------------------
const overlay = new TextOverlay(document.getElementById('text'));
const diagram = new Diagram(dgCanvas);
diagram.resize(W, H);

let preview = null;
const _v = new THREE.Vector3();
const env = {
  portrait: H > W,
  silhouette: null, starRadiusPx: 0,
  project(x, y, z) { _v.set(x, y, z).project(camera); if (_v.z > 1) return null; return { x: (_v.x * 0.5 + 0.5) * W, y: (-_v.y * 0.5 + 0.5) * H }; },
  projectDisk(x, y, z) { const w = DB.diskToWorld(x, y, z); return this.project(w[0], w[1], w[2]); },
  projectHero(key, t) { const f = DB.heroPosition(deb, DB.HERO[key], t); if (f.tau >= 0.999) return null; return this.projectDisk(f.x, f.y, f.z); },
};

// ---------------------------------------------------------------------------
//  updateScene — the single entry point. Pure function of (t, frame, extraFade).
// ---------------------------------------------------------------------------
function updateScene(t, frameIndex = 0, extraFade = 0) {
  t = Math.max(0, Math.min(TL.DURATION, t));
  const cam = cameraAt(t, deb);
  // vertical FOV, widened a little in portrait so the horizontal framing stays cinematic
  const aspect = W / H;
  let fov = cam.fov;
  if (aspect < 1) fov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * Math.max(1, (16 / 9) * 0.62 / aspect)) * 180 / Math.PI;
  camera.fov = fov; camera.aspect = aspect;
  camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
  camera.up.set(0, 1, 0);
  camera.lookAt(cam.tgt[0], cam.tgt[1], cam.tgt[2]);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  const focal = (H / 2) / Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  focalUniform.value = focal;
  timeUniform.value = t;

  const sc = TL.sceneAt(t).id;
  const st = starState(t);
  const camDist = camera.position.length();
  const Rpx = Math.tan(Math.asin(Math.min(0.999, st.r / Math.max(camDist, st.r * 1.001)))) * focal;

  // star
  starGroup.scale.setScalar(st.r);
  starSpin.rotation.y = t * 0.012;
  const u = starMat.uniforms;
  u.uTime.value = t;
  u.uCore.value.set(...st.look.core); u.uRim.value.set(...st.look.rim); u.uSpot.value.set(...st.look.spot);
  u.uBright.value = st.look.bright; u.uScale.value = st.look.scale; u.uContrast.value = st.look.contrast;
  const glowCol = mix3(st.look.core, st.look.rim, 0.45);
  shells.forEach((s) => s.material.uniforms.uColor.value.set(glowCol[0], glowCol[1], glowCol[2]));
  const bu = billMat.uniforms;
  bu.uColor.value.set(...mix3(st.look.rim, st.look.core, 0.35)); bu.uColor2.value.set(...mix3(st.look.core, [1, 1, 1], 0.35));
  bu.uTime.value = t;
  bu.uGlowI.value = 0.30 * (st.evo && st.evo.stage > 0.2 && st.evo.stage < 1.4 ? 0.8 : 1);
  // the star stays a visible point of light when it is sub-pixel
  const pxWanted = 2.0 * (H / 1080);
  const pointRad = Math.max(0.0001, pxWanted * camDist / focal / st.r);
  const farMix = 1 - TL.smooth((Rpx - 4 * (H / 1080)) / (10 * (H / 1080)));
  bu.uPointSize.value = pointRad;
  bu.uPointI.value = 3.2 * farMix * TL.smooth(t / 9);
  const size = Math.max(40, pointRad * 4.0);
  billboard.scale.setScalar(size * st.r);
  bu.uSize.value = size;
  billboard.position.set(0, 0, 0);
  billboard.quaternion.copy(camera.quaternion);

  // sky + stars: gently emerge from darkness at the start
  const sb = lerp(0.12, 1.0, TL.smooth(t / 26));
  skyMat.uniforms.uBright.value = sb * 0.9;
  starLayers.forEach((l) => { l.material.uniforms.uTime.value = t; l.material.uniforms.uBright.value = (l === starLayers[0] ? 1.0 : 0.95) * sb; l.material.uniforms.uPx.value = H / 1080; });
  sky.position.copy(camera.position);

  // debris
  let dv = 0;
  if (t >= 140 && t < 200) dv = 1;
  else if (t >= 320 && t < 390) dv = 1;
  else if (t >= 390 && t < 400) dv = 1 - TL.smooth((t - 388) / 11);
  debrisUniform.value = dv;
  diskGroup.visible = dv > 0.002;
  ambient.visible = dv > 0.002;
  const sceneSeven = t >= 320 && t < 392;
  lineMat.uniforms.uOpacity.value = sceneSeven ? 0.30 * TL.smooth((t - 326) / 6) * (1 - TL.smooth((t - 384) / 6)) : 0;
  orbitLines.visible = sceneSeven;
  // wide shots get slightly bigger dust; close shots stay fine
  dustMat.uniforms.uSizeMul.value = 1.0;
  ambMat.uniforms.uAmb.value = 0.35;

  // evolution gas
  const showGas = t >= 118 && t < 140 && st.evo;
  gasShell.visible = showGas;
  puffs.visible = showGas;
  if (showGas) {
    const R0 = 18;
    const rad = R0 + st.evo.shell * 130;
    gasShell.scale.setScalar(rad);
    gasMat.uniforms.uAlpha.value = st.evo.alpha;
    puffMat.uniforms.uProg.value = st.evo.shell;
    puffMat.uniforms.uAlpha.value = st.evo.alpha;
    puffMat.uniforms.uR0.value = R0 * 0.9;
  }

  // post
  const gu = gradePass.material.uniforms;
  gu.uFrame.value = frameIndex % 4096;
  bloom.strength = 0.38;
  bloom.radius = 0.55;

  // diagram + text (2D layers are pure functions of t)
  env.starRadiusPx = Rpx;
  env.portrait = H > W;
  env.silhouette = (f, phi) => {
    const c = env.project(0, 0, 0);
    return { x: c.x + f * Rpx * Math.cos(phi), y: c.y - f * Rpx * Math.sin(phi) };
  };
  overlay.update(t);
  diagram.draw(t, env);

  // black dips / fades are a final layer over everything
  const fade = Math.max(TL.blackoutAt(t), extraFade);
  blackoutEl.style.opacity = fade.toFixed(4);
  const persist = document.getElementById('persist');
  persist.style.opacity = (1 - TL.smooth((t - 474) / 5)).toFixed(3);
  const bm = document.getElementById('brandmark');
  bm.style.opacity = '1';

  composer.render();
  return { t, shot: cam.shot, scene: sc, Rpx, camDist };
}
window.updateScene = updateScene;

// ---------------------------------------------------------------------------
//  Export API (Playwright drives this) and preview player
// ---------------------------------------------------------------------------
async function boot() {
  try {
    await Promise.all(['400', '500', '600'].map((w) => document.fonts.load(`${w} 20px Inter`)));
    await document.fonts.ready;
  } catch (e) { /* fall back to system fonts */ }
  layout();
  window.addEventListener('resize', layout);

  window.__plan = { frames: PLAN.frames, duration: PLAN.duration, w: W, h: H, fps: TL.FPS, profile: params.get('profile') || '1080p' };
  window.__renderFrame = async (i) => {
    const m = PLAN.mapFrame(i);
    const info = updateScene(m.t, i, m.fade);
    renderer.getContext().finish();
    // let the compositor present this exact frame before the caller screenshots it
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return info;
  };
  window.__glInfo = () => {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  };

  if (MODE === 'export') {
    document.body.style.cursor = 'none';
    window.__ready = true;
    return;
  }
  startPreview();
}

function startPreview() {
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:56px;background:#05080a;color:#cfe;font:500 13px Inter,sans-serif;display:flex;align-items:center;gap:14px;padding:0 18px;z-index:9;border-top:1px solid #12261a';
  bar.innerHTML = '<button id="pp" style="background:#12261a;color:#cfe;border:0;padding:7px 14px;border-radius:6px;cursor:pointer">Pause</button><span id="tc" style="width:92px;font-variant-numeric:tabular-nums"></span><div id="trk" style="position:relative;flex:1;height:10px;background:#0e1a14;border-radius:5px;cursor:pointer"></div><span id="sn" style="width:260px;text-align:right;letter-spacing:.08em"></span>';
  document.body.appendChild(bar);
  const trk = bar.querySelector('#trk');
  for (const s of TL.SCENES) {
    const seg = document.createElement('div');
    seg.style.cssText = `position:absolute;top:0;bottom:0;left:${(s.t0 / 480) * 100}%;width:${((s.t1 - s.t0) / 480) * 100}%;border-right:2px solid #05080a;background:${s.id % 2 ? '#183223' : '#1d3b2a'}`;
    trk.appendChild(seg);
  }
  const head = document.createElement('div');
  head.style.cssText = 'position:absolute;top:-4px;width:3px;height:18px;background:#b6ff6a;border-radius:2px';
  trk.appendChild(head);
  let t = Number(params.get('t')) || 0, playing = true, last = performance.now(), frame = 0;
  const seek = (v) => { t = Math.max(0, Math.min(479.99, v)); };
  trk.addEventListener('click', (e) => { const r = trk.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * 480); });
  const pp = bar.querySelector('#pp');
  const toggle = () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Play'; last = performance.now(); };
  pp.addEventListener('click', toggle);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    if (e.code === 'ArrowRight') seek(t + 5);
    if (e.code === 'ArrowLeft') seek(t - 5);
    if (e.key === 'h') bar.style.display = bar.style.display === 'none' ? 'flex' : 'none';
  });
  const fmt = (x) => `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(Math.floor(x % 60)).padStart(2, '0')}`;
  function loop(now) {
    if (playing) { t += (now - last) / 1000; if (t >= 480) t = 0; }
    last = now;
    updateScene(t, frame++ , 0);
    head.style.left = `calc(${(t / 480) * 100}% - 1px)`;
    bar.querySelector('#tc').textContent = `${fmt(t)} / 08:00`;
    bar.querySelector('#sn').textContent = `SCENE ${TL.sceneAt(t).id} · ${TL.sceneAt(t).name}`;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// release GPU memory when the page goes away
window.addEventListener('pagehide', () => {
  composer.dispose(); renderer.dispose(); skyRT.dispose(); rt.dispose();
  scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); });
});

boot();

// All GLSL lives here. three.js (r160) compiles these as GLSL ES 3.00 and maps
// `varying` / `gl_FragColor` / `texture2D` for us (ShaderMaterial, not Raw).
import { INF_K } from './debris.js';

// ----------------------------------------------------------------------------
//  Shared chunks
// ----------------------------------------------------------------------------
export const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm5(vec3 p){
  float a=0.5; float s=0.0;
  for(int i=0;i<5;i++){ s+=a*snoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; }
  return s;
}
float fbm3(vec3 p){
  float a=0.5; float s=0.0;
  for(int i=0;i<3;i++){ s+=a*snoise(p); p=p*2.07+vec3(4.1,1.3,7.7); a*=0.5; }
  return s;
}
`;

// debris path function: the CPU twin lives in debris.js (fragLocal)
export const FRAG_PATH = /* glsl */ `
const float INF_K = ${INF_K.toFixed(3)};
vec3 fragLocal(vec4 orb, vec4 inf, float t, out float tau, out float ph){
  float dur = max(inf.y, 0.001);
  tau = clamp((t - inf.x) / dur, 0.0, 1.0);
  float r = orb.x + (0.96 - orb.x) * pow(tau, 1.8);
  float live = inf.x < 1.0e8 ? 1.0 : 0.0;
  ph = orb.y + orb.z * (t + INF_K * dur * tau * tau * tau * live);
  float y = orb.w * (1.0 - tau);
  return vec3(r * cos(ph), y, r * sin(ph));
}
`;

// ----------------------------------------------------------------------------
//  The star: surface, glow shells, corona billboard
// ----------------------------------------------------------------------------
export const STAR_VERT = /* glsl */ `
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vWorld;
void main(){
  vObj = position;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const STAR_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uCore;
uniform vec3 uRim;
uniform vec3 uSpot;
uniform float uScale;
uniform float uContrast;
uniform float uBright;
uniform float uSeed;
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vWorld;
${NOISE}
void main(){
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorld);
  float mu = clamp(dot(N, V), 0.0, 1.0);
  vec3 P = normalize(vObj);
  float t = uTime * 0.012;
  vec3 q = P * uScale + vec3(uSeed);
  // layered, domain-warped procedural noise: broad mottling -> granulation -> fine grain
  float w   = snoise(q * 0.7 + vec3(0.0, t, 0.0));
  float big = fbm5(q + w * 0.45 + vec3(t, 0.0, 0.0));
  float mid = fbm5(q * 2.9 + vec3(5.2) + vec3(0.0, t * 1.7, 0.0));
  float cell = 1.0 - abs(snoise(q * 6.3 + vec3(t * 2.3)));
  float fine = snoise(q * 15.0 + vec3(t * 3.0));
  float tex = (big * 0.50 + mid * 0.28 + cell * 0.22 + fine * 0.08) * uContrast;
  // limb darkening + colour: pale chartreuse core, green-white towards the limb
  float limb = 0.22 + 0.78 * pow(mu, 0.8);
  vec3 col = mix(uRim, uCore, pow(mu, 0.7));
  col *= (0.78 + 0.46 * tex) * limb;
  float dark = smoothstep(0.10, 0.80, -big * uContrast);
  col = mix(col, col * uSpot, dark * 0.32);
  // Fresnel rim light
  float fres = pow(1.0 - mu, 3.0);
  col += uRim * fres * 0.55;
  gl_FragColor = vec4(col * uBright, 1.0);
}
`;

// Transparent glow shells: back faces only, brightness falls off with the ray's
// impact parameter b (in star radii) so the edge of each shell is perfectly soft.
export const SHELL_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uRs;     // shell radius in star radii
uniform float uK;      // exponential falloff rate
uniform float uInt;
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vWorld;
void main(){
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorld);
  float mu = abs(dot(N, V));
  float b = uRs * sqrt(max(1.0 - mu * mu, 0.0));
  float I = exp(-(b - 1.0) * uK) * smoothstep(0.0, 0.45, mu) * uInt;
  gl_FragColor = vec4(uColor * I, 1.0);
}
`;

export const BILL_VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const BILL_FRAG = /* glsl */ `
uniform float uSize;       // plane half-size, in star radii
uniform float uPointSize;  // gaussian core radius, in star radii (keeps a far star visible as a point)
uniform float uPointI;
uniform float uGlowI;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uColor2;
varying vec2 vUv;
${NOISE}
void main(){
  vec2 p = (vUv - 0.5) * 2.0;
  float pl = length(p);
  float rr = pl * uSize;                          // radius in star radii
  float ang = atan(p.y, p.x);
  float edge = smoothstep(1.0, 0.55, pl);
  float halo = exp(-(rr - 1.0) * 1.9) * 0.50 + (0.90 / (1.0 + rr * rr * 0.9)) * 0.30;
  // restrained animated corona: slow streamers, never harsh
  float ray = 0.80 + 0.20 * snoise(vec3(cos(ang) * 1.7, sin(ang) * 1.7, uTime * 0.025 + rr * 0.12));
  float pt = exp(-pow(rr / max(uPointSize, 1e-4), 2.0)) * uPointI;
  vec3 col = mix(uColor, uColor2, clamp(rr * 0.07, 0.0, 1.0)) * (halo * ray * uGlowI * edge);
  col += uColor2 * pt;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ----------------------------------------------------------------------------
//  Star fields
// ----------------------------------------------------------------------------
export const STARS_VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute float aSeed;
uniform float uPx;
uniform float uTime;
uniform float uNear;
uniform float uBright;
varying vec3 vCol;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float dist = length(mv.xyz);
  float tw = 0.90 + 0.10 * sin(uTime * (0.5 + aSeed * 2.0) + aSeed * 61.0);
  float att = mix(1.0, clamp(300.0 / max(dist, 1.0), 0.35, 4.5), uNear);
  float ps = aSize * uPx * att;
  gl_PointSize = clamp(ps, 1.0, 16.0 * uPx);
  float nearFade = mix(1.0, smoothstep(1.5, 60.0, dist), uNear);
  vCol = aColor * uBright * tw * nearFade * clamp(ps, 0.0, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;
export const STARS_FRAG = /* glsl */ `
varying vec3 vCol;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d) * 4.0;
  float a = exp(-r2 * 3.2);
  gl_FragColor = vec4(vCol * a, 1.0);
}
`;

// Milky-Way-inspired sky dome with sparse, subtle nebulae
export const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
export const SKY_FRAG = /* glsl */ `
uniform vec3 uGalN;
uniform vec3 uGalX;
uniform vec3 uGalY;
uniform vec3 uNeb[3];
uniform float uBright;
varying vec3 vDir;
${NOISE}
void main(){
  vec3 d = normalize(vDir);
  float b = dot(d, uGalN);
  float l = atan(dot(d, uGalY), dot(d, uGalX));
  float band = exp(-pow(b / 0.16, 2.0));
  float broad = exp(-pow(b / 0.48, 2.0));
  float n1 = fbm5(d * 3.0 + vec3(2.0));
  float n2 = fbm3(d * 8.0 + vec3(7.0));
  float clouds = smoothstep(-0.25, 0.75, n1 * 0.65 + n2 * 0.55);
  float lane = smoothstep(0.12, 0.62, fbm5(d * 11.0 + vec3(9.0) + n1 * 0.6));
  float bulge = exp(-(l * l) / 0.55 - (b * b) / 0.03);
  vec3 cool = vec3(0.42, 0.52, 0.90);
  vec3 warm = vec3(0.90, 0.74, 0.62);
  vec3 col = cool * 0.30 * band * (0.45 + 0.95 * clouds)
           + warm * 0.55 * bulge * (0.60 + 0.70 * clouds)
           + cool * 0.035 * broad;
  col *= (1.0 - 0.55 * lane * band);
  // unresolved stars inside the band
  float g1 = snoise(d * 330.0);
  float g2 = snoise(d * 140.0);
  col += (pow(max(g1, 0.0), 7.0) * 1.5 + pow(max(g2, 0.0), 9.0) * 2.4) * (0.30 * band + 0.025) * vec3(1.0, 0.95, 0.90);
  // sparse nebula clouds
  vec3 nc0 = vec3(0.25, 0.75, 0.80);
  vec3 nc1 = vec3(0.85, 0.30, 0.50);
  vec3 nc2 = vec3(0.90, 0.55, 0.25);
  float s0 = smoothstep(0.78, 0.99, dot(d, uNeb[0])) * (0.5 + 0.5 * fbm5(d * 6.0 + vec3(1.0)));
  float s1 = smoothstep(0.82, 0.99, dot(d, uNeb[1])) * (0.5 + 0.5 * fbm5(d * 5.0 + vec3(5.0)));
  float s2 = smoothstep(0.80, 0.99, dot(d, uNeb[2])) * (0.5 + 0.5 * fbm5(d * 7.0 + vec3(9.0)));
  col += nc0 * s0 * 0.030 + nc1 * s1 * 0.026 + nc2 * s2 * 0.022;
  gl_FragColor = vec4(col * uBright * 0.115, 1.0);
}
`;

// ----------------------------------------------------------------------------
//  Debris: instanced rocks, dust trails, disk dust, ambient dust
// ----------------------------------------------------------------------------
export const ROCK_VERT = /* glsl */ `
attribute vec4 aOrb;
attribute vec4 aInf;
attribute vec4 aSpin;
uniform float uTime;
varying vec3 vW;
varying float vHeat;
varying float vTone;
${FRAG_PATH}
mat3 rotAxis(vec3 a, float ang){
  float c = cos(ang); float s = sin(ang); float k = 1.0 - c;
  return mat3(
    c + a.x*a.x*k,       a.x*a.y*k + a.z*s,  a.x*a.z*k - a.y*s,
    a.x*a.y*k - a.z*s,   c + a.y*a.y*k,      a.y*a.z*k + a.x*s,
    a.x*a.z*k + a.y*s,   a.y*a.z*k - a.x*s,  c + a.z*a.z*k
  );
}
void main(){
  float tau; float ph;
  vec3 c = fragLocal(aOrb, aInf, uTime, tau, ph);
  float gone = step(0.999, tau);
  float seed = aInf.w;
  vec3 p = position;
  p *= vec3(1.0, 0.65 + 0.35 * fract(seed * 7.13), 0.80 + 0.30 * fract(seed * 3.71));
  p *= 1.0 + 0.28 * sin(dot(position, vec3(5.1, 3.3, 4.7)) + seed * 31.0);
  p = rotAxis(normalize(aSpin.xyz), aSpin.w * uTime + seed * 6.2831) * p;
  float rr = length(c.xz);
  float stretch = 1.0 + 3.2 * smoothstep(2.8, 1.3, rr);   // tidal stretching close to the star
  vec3 tang = vec3(-sin(ph), 0.0, cos(ph));
  p += tang * dot(p, tang) * (stretch - 1.0);
  vec3 local = c + p * aInf.z * (1.0 - gone);
  vec4 w = modelMatrix * vec4(local, 1.0);
  vW = w.xyz;
  vHeat = smoothstep(2.6, 1.2, rr) * (1.0 - gone);
  vTone = fract(seed * 13.7);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
export const ROCK_FRAG = /* glsl */ `
uniform float uDebris;
varying vec3 vW;
varying float vHeat;
varying float vTone;
void main(){
  vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
  vec3 L = normalize(-vW);
  vec3 V = normalize(cameraPosition - vW);
  if (dot(n, V) < 0.0) n = -n;
  float I = 4.2 / (1.0 + 0.07 * dot(vW, vW));
  float diff = max(dot(n, L) * 0.75 + 0.25, 0.0);
  vec3 albedo = mix(vec3(0.22, 0.19, 0.17), vec3(0.36, 0.31, 0.27), vTone);
  vec3 lightCol = vec3(0.82, 1.0, 0.62);
  vec3 col = albedo * lightCol * diff * I;
  col += albedo * lightCol * 0.16 * I + albedo * vec3(0.030, 0.040, 0.055);
  col += lightCol * pow(1.0 - max(dot(n, V), 0.0), 3.0) * 0.05 * I * (0.3 + 0.7 * diff);
  col += vec3(1.0, 0.50, 0.15) * vHeat * vHeat * 2.4;
  gl_FragColor = vec4(col * uDebris, 1.0);
}
`;

export const TRAIL_VERT = /* glsl */ `
attribute vec4 aOrb;
attribute vec4 aInf;
attribute vec2 aTr;
uniform float uTime;
uniform float uDebris;
uniform float uPxScale;
uniform float uLag;
varying float vA;
varying float vHeat;
${FRAG_PATH}
void main(){
  float tt = uTime - aTr.x * uLag;
  float tau; float ph;
  vec3 c = fragLocal(aOrb, aInf, tt, tau, ph);
  float visible = step(aInf.x, tt) * step(tau, 0.999);
  vec3 jit = (vec3(fract(aTr.y * 17.3), fract(aTr.y * 91.7), fract(aTr.y * 53.1)) - 0.5) * 0.14 * (0.4 + aTr.x);
  c += jit;
  vec4 w = modelMatrix * vec4(c, 1.0);
  vec4 mv = viewMatrix * w;
  float rr = length(c.xz);
  vHeat = smoothstep(3.6, 1.3, rr);
  vA = visible * pow(1.0 - aTr.x, 1.6) * uDebris;
  float ps = (0.03 + 0.04 * aTr.y) * uPxScale / max(-mv.z, 0.1);
  gl_PointSize = clamp(ps, 1.0, 60.0);
  vA *= clamp(ps, 0.0, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;
export const TRAIL_FRAG = /* glsl */ `
varying float vA;
varying float vHeat;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float a = exp(-dot(d, d) * 4.0 * 3.0);
  vec3 col = mix(vec3(0.80, 0.72, 0.60), vec3(1.0, 0.55, 0.22), vHeat);
  gl_FragColor = vec4(col * vA * a * 0.6, 1.0);
}
`;

export const DUST_VERT = /* glsl */ `
attribute vec4 aD;
uniform float uTime;
uniform float uDebris;
uniform float uPxScale;
uniform float uSizeMul;
uniform float uBrightMul;
varying float vA;
varying float vHeat;
void main(){
  float r = aD.x;
  float w = 1.4 * pow(r, -1.5);
  float ph = aD.y + w * uTime;
  vec3 c = vec3(r * cos(ph), aD.z, r * sin(ph));
  vec4 wp = modelMatrix * vec4(c, 1.0);
  vec4 mv = viewMatrix * wp;
  vec3 Lh = normalize(wp.xyz);
  vec3 V = normalize(cameraPosition - wp.xyz);
  float cosT = dot(Lh, V);
  float g = 0.55;
  float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * cosT, 1.5);   // Henyey-Greenstein, forward scattering
  float scat = 0.14 + hg / 7.65;
  float I = 1.0 / (1.0 + 0.12 * r * r);
  vHeat = smoothstep(5.0, 2.4, r);
  float ps = aD.w * uSizeMul * uPxScale / max(-mv.z, 0.1);
  gl_PointSize = clamp(ps, 1.0, 26.0);
  vA = uDebris * uBrightMul * scat * (0.35 + I * 2.2) * clamp(ps, 0.0, 1.0) * min(1.0, 26.0 / max(ps, 1.0));
  gl_Position = projectionMatrix * mv;
}
`;
export const DUST_FRAG = /* glsl */ `
varying float vA;
varying float vHeat;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float a = exp(-dot(d, d) * 4.0 * 2.6);
  vec3 col = mix(vec3(0.62, 0.70, 0.55), vec3(1.0, 0.62, 0.30), vHeat);
  gl_FragColor = vec4(col * vA * a, 1.0);
}
`;

export const AMBIENT_VERT = /* glsl */ `
attribute vec4 aA;
uniform float uTime;
uniform float uAmb;
uniform float uPxScale;
varying float vA;
void main(){
  float s = aA.w * 6.2831;
  vec3 c = aA.xyz + 0.6 * vec3(sin(uTime * 0.07 + s), sin(uTime * 0.05 + s * 2.0), cos(uTime * 0.06 + s * 3.0));
  vec4 mv = modelViewMatrix * vec4(c, 1.0);
  float r2 = dot(c, c);
  float ps = (0.035 + 0.05 * aA.w) * uPxScale / max(-mv.z, 0.1);
  gl_PointSize = clamp(ps, 1.0, 40.0);
  vA = uAmb * (1.0 / (1.0 + r2 * 0.012)) * (0.4 + 0.6 * aA.w) * clamp(ps, 0.0, 1.0) * smoothstep(0.5, 6.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;
export const AMBIENT_FRAG = /* glsl */ `
varying float vA;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float a = exp(-dot(d, d) * 4.0 * 3.0);
  gl_FragColor = vec4(vec3(0.72, 0.95, 0.60) * vA * a * 0.8, 1.0);
}
`;

// ----------------------------------------------------------------------------
//  Scene 3: expelled gas shell (planetary-nebula style) and gas puffs
// ----------------------------------------------------------------------------
export const GASSHELL_FRAG = /* glsl */ `
uniform float uTime;
uniform float uAlpha;
uniform float uSeed;
uniform vec3 uInner;
uniform vec3 uOuter;
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vWorld;
${NOISE}
void main(){
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorld);
  float mu = abs(dot(N, V));
  float k = 0.80;                                   // inner/outer radius ratio of the thin shell
  float chordIn = sqrt(max(k * k - (1.0 - mu * mu), 0.0));
  float path = max(mu - chordIn, 0.0);              // limb-brightened, like a real thin shell
  vec3 P = normalize(vObj);
  float n = fbm5(P * 3.6 + vec3(uSeed) + vec3(uTime * 0.004));
  float fil = 0.25 + 1.15 * smoothstep(-0.25, 0.75, n);
  float b = sqrt(max(1.0 - mu * mu, 0.0));
  vec3 col = mix(uInner, uOuter, smoothstep(0.55, 0.98, b));
  float I = path * fil * uAlpha * 0.9 * smoothstep(0.0, 0.18, mu);
  gl_FragColor = vec4(col * I, 1.0);
}
`;

export const PUFF_VERT = /* glsl */ `
attribute vec4 aP;       // xyz unit direction, w speed
attribute float aR;      // random
uniform float uProg;
uniform float uR0;
uniform float uRmax;
uniform float uAlpha;
uniform float uPxScale;
varying float vA;
varying float vMix;
void main(){
  float r = uR0 + uProg * uRmax * aP.w;
  vec3 c = aP.xyz * r;
  vec4 mv = modelViewMatrix * vec4(c, 1.0);
  float ps = (1.2 + 3.2 * aR) * (0.6 + uProg * 1.6) * uPxScale / max(-mv.z, 0.1);
  gl_PointSize = clamp(ps, 1.5, 120.0);
  vA = uAlpha * (1.0 - pow(uProg, 3.0)) * (0.25 + 0.75 * aR) * 0.10;
  vMix = clamp(uProg * 1.4, 0.0, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;
export const PUFF_FRAG = /* glsl */ `
varying float vA;
varying float vMix;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float a = exp(-dot(d, d) * 4.0 * 2.4);
  vec3 col = mix(vec3(1.0, 0.45, 0.18), vec3(0.25, 0.85, 0.80), vMix);
  gl_FragColor = vec4(col * vA * a, 1.0);
}
`;

// ----------------------------------------------------------------------------
//  Illustrative orbit lines (scene 7)
// ----------------------------------------------------------------------------
export const LINE_VERT = /* glsl */ `
void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
export const LINE_FRAG = /* glsl */ `
uniform float uOpacity;
void main(){ gl_FragColor = vec4(vec3(0.55, 0.95, 0.60) * uOpacity, 1.0); }
`;

// ----------------------------------------------------------------------------
//  Final grade: filmic tone map, gentle grade, vignette, deterministic film grain
// ----------------------------------------------------------------------------
export const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uFrame: { value: 0 },
    uRes: { value: [1920, 1080] },
    uGrain: { value: 0.010 },
    uVig: { value: 0.38 },
    uExposure: { value: 1.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uFrame;
    uniform vec2 uRes;
    uniform float uGrain;
    uniform float uVig;
    uniform float uExposure;
    varying vec2 vUv;
    vec3 aces(vec3 x){
      const float a = 2.51; const float b = 0.03; const float c = 2.43; const float d = 0.59; const float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }
    vec3 oetf(vec3 c){
      return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    }
    float hash(vec2 p){
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec2 q = vUv - 0.5;
      q.x *= uRes.x / uRes.y;
      float v = 1.0 - uVig * smoothstep(0.30, 1.05, length(q));
      c *= v * uExposure;
      c = aces(c);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, 1.07);
      c += vec3(0.000, 0.0015, 0.0045) * (1.0 - l);
      c = oetf(clamp(c, 0.0, 1.0));
      float n = hash(gl_FragCoord.xy + uFrame * 17.0) + hash(gl_FragCoord.yx * 1.31 + uFrame * 29.0 + 7.0) - 1.0;
      c += n * uGrain * (0.55 + 0.45 * (1.0 - l));
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

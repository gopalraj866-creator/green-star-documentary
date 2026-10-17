// Schematic spectrum maths shared by the overlay (browser) and the test scripts (node).
// IMPORTANT: everything here is ILLUSTRATIVE. No measured spectral values are used.

export const LAMBDA_MIN = 380;
export const LAMBDA_MAX = 750;

// Wyman, Sloan & Shirley (2013) multi-lobe fit to the CIE 1931 colour matching functions.
function g(x, mu, s1, s2) { const t = (x - mu) / (x < mu ? s1 : s2); return Math.exp(-0.5 * t * t); }
export function cie(l) {
  return {
    x: 1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2),
    y: 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1),
    z: 1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8),
  };
}

// Smooth featureless continuum (arbitrary, gently peaked in the green-blue). Not a measured star.
// A smooth Planck-like curve for a cool star (schematic; no temperature is claimed on screen).
export function continuum(l) {
  const T = 3500;
  const lm = l * 1e-9;
  const b = 1 / (Math.pow(lm, 5) * (Math.exp(1.4388e-2 / (lm * T)) - 1));
  const l0 = 600e-9;
  const b0 = 1 / (Math.pow(l0, 5) * (Math.exp(1.4388e-2 / (l0 * T)) - 1));
  return b / b0;
}

// Broad orange absorption trough, schematic. depth 0..1 scales how strong it is.
export const ABS_CENTER = 625;   // nm, sodium D region (illustrative placement)
export const ABS_WIDTH = 45;     // nm, "broad" because the atmosphere is very dense
export function absorption(l, depth) {
  const t = (l - ABS_CENTER) / ABS_WIDTH;
  // slightly flat-topped trough so it reads as broad
  const prof = Math.exp(-Math.pow(Math.abs(t), 2.6));
  return 1 - 0.85 * depth * prof;
}

export function srgbEncode(c) {
  c = Math.max(0, Math.min(1, c));
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

export function xyzToLinearRGB(X, Y, Z) {
  return [
    3.2406 * X - 1.5372 * Y - 0.4986 * Z,
    -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
    0.0557 * X - 0.2040 * Y + 1.0570 * Z,
  ];
}

// Integrate spectrum -> linear sRGB (normalised so the brightest channel is 1).
export function spectrumToRGB(depth) {
  let X = 0, Y = 0, Z = 0;
  for (let l = LAMBDA_MIN; l <= LAMBDA_MAX; l += 2) {
    const s = continuum(l) * absorption(l, depth);
    const c = cie(l);
    X += s * c.x; Y += s * c.y; Z += s * c.z;
  }
  let rgb = xyzToLinearRGB(X, Y, Z).map((v) => Math.max(0, v));
  const m = Math.max(rgb[0], rgb[1], rgb[2]) || 1;
  return rgb.map((v) => v / m);
}

export function rgbToCss(rgbLinear) {
  const c = rgbLinear.map((v) => Math.round(srgbEncode(v) * 255));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// Visible-light display colour of a single wavelength (for drawing the spectrum bar).
export function wavelengthToLinearRGB(l) {
  const c = cie(l);
  const rgb = xyzToLinearRGB(c.x, c.y, c.z).map((v) => Math.max(0, v));
  const m = Math.max(rgb[0], rgb[1], rgb[2]) || 1;
  // gentle falloff at the edges of human vision
  let edge = 1;
  if (l < 420) edge = 0.3 + 0.7 * (l - 380) / 40;
  if (l > 700) edge = 0.3 + 0.7 * (750 - l) / 50;
  return rgb.map((v) => (v / m) * Math.max(0, edge));
}

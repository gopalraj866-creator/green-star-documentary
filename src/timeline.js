// =============================================================================
//  MASTER TIMELINE  —  THE REAL GREEN STAR  (480 s, 30 FPS, 14 400 frames)
//  Pure data + pure functions. No DOM / WebGL here, so Node can verify it.
// =============================================================================

export const FPS = 30;
export const DURATION = 480;
export const TOTAL_FRAMES = FPS * DURATION; // 14 400

// ---------------------------------------------------------------------------
//  Scenes (exactly the brief: 8 scenes, 480 s)
// ---------------------------------------------------------------------------
export const SCENES = [
  { id: 1, t0: 0,   t1: 40,  name: 'THE MYSTERIOUS GREEN STAR' },
  { id: 2, t0: 40,  t1: 90,  name: 'REVEAL: WD J1330+6435' },
  { id: 3, t0: 90,  t1: 140, name: 'A STAR’S LONG LIFE' },
  { id: 4, t0: 140, t1: 200, name: 'PLANETARY DEBRIS' },
  { id: 5, t0: 200, t1: 260, name: 'THE SPECTRUM' },
  { id: 6, t0: 260, t1: 320, name: 'SCHEMATIC CROSS-SECTION' },
  { id: 7, t0: 320, t1: 390, name: 'A FORMER PLANETARY SYSTEM' },
  { id: 8, t0: 390, t1: 480, name: 'FINAL ORBIT & PULLBACK' },
];

export function sceneAt(t) {
  for (const s of SCENES) if (t >= s.t0 && t < s.t1) return s;
  return SCENES[SCENES.length - 1];
}

// ---------------------------------------------------------------------------
//  Deliberate documentary transitions: a short dip to black centred on `t`.
//  Scene content that must "switch" does so exactly at the dip centre.
// ---------------------------------------------------------------------------
export const DIPS = [
  { t: 90,  half: 1.1 },
  { t: 140, half: 1.1 },
  { t: 320, half: 1.1 },
];

export const OPEN_FADE = { from: 0.0, to: 3.5 };     // black -> picture
export const CLOSE_FADE = { from: 474.0, to: 480.0 }; // picture -> black at exactly 480 s

const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
export const smoother = (x) => { x = clamp01(x); return x * x * x * (x * (x * 6 - 15) + 10); };

/** 0 = fully visible picture, 1 = fully black. */
export function blackoutAt(t) {
  let b = 0;
  b = Math.max(b, 1 - smooth((t - OPEN_FADE.from) / (OPEN_FADE.to - OPEN_FADE.from)));
  b = Math.max(b, smooth((t - CLOSE_FADE.from) / (CLOSE_FADE.to - CLOSE_FADE.from)));
  for (const d of DIPS) b = Math.max(b, 1 - smooth(Math.abs(t - d.t) / d.half));
  return clamp01(b);
}

// ---------------------------------------------------------------------------
//  On-screen text. `group` decides placement, `kind` decides typography.
//    heading : large white headline         label : small scientific label
//    note    : tiny disclaimer              stage : evolution-stage caption
// ---------------------------------------------------------------------------
export const CAPTIONS = [
  // ---- Scene 1
  { id: 'c-presents', group: 'info',   kind: 'label',   t0: 3,   t1: 11,  text: 'A TECHNICAL TALK INDIA FILM' },
  { id: 'c-hook',     group: 'center', kind: 'heading', t0: 22,  t1: 37,  text: 'A STAR THAT SHOULDN’T LOOK GREEN?' },
  // ---- Scene 2
  { id: 'c-name',     group: 'info',   kind: 'heading', t0: 46,  t1: 86,  text: 'WD J1330+6435', size: 'md' },
  { id: 'c-wd',       group: 'info',   kind: 'label',   t0: 50,  t1: 86,  text: 'WHITE DWARF' },
  { id: 'c-dist',     group: 'info',   kind: 'label',   t0: 56,  t1: 86,  text: 'APPROXIMATELY 280 LIGHT-YEARS AWAY' },
  { id: 'c-dist-n',   group: 'info',   kind: 'note',    t0: 60,  t1: 86,  text: 'DISTANCE: APPROXIMATE, AS REPORTED' },
  { id: 'c-art',      group: 'top',    kind: 'note',    t0: 68,  t1: 88,  text: 'SURFACE DETAIL IS AN ARTISTIC VISUALIZATION, NOT AN OBSERVATION' },
  // ---- Scene 3 (evolution; one stage caption at a time)
  { id: 'c-ev0',      group: 'stage',  kind: 'stage',   t0: 92,  t1: 103, text: 'SUN-LIKE STAR' },
  { id: 'c-ev1',      group: 'stage',  kind: 'stage',   t0: 105, t1: 117, text: 'RED GIANT' },
  { id: 'c-ev2',      group: 'stage',  kind: 'stage',   t0: 119, t1: 129, text: 'OUTER LAYERS EXPELLED' },
  { id: 'c-ev3',      group: 'stage',  kind: 'stage',   t0: 131, t1: 138.8, text: 'COMPACT WHITE DWARF' },
  { id: 'c-ev-n',     group: 'top',  kind: 'note',    t0: 93,  t1: 138, text: 'CONCEPTUAL SEQUENCE · NOT TO SCALE' },
  // ---- Scene 4
  { id: 'c-deb',      group: 'lower',  kind: 'heading', t0: 144, t1: 162, text: 'ROCKY DEBRIS ORBITS THE REMNANT', size: 'md' },
  { id: 'c-pol',      group: 'lower',  kind: 'heading', t0: 168, t1: 197, text: 'PLANETARY MATERIAL CAN POLLUTE A WHITE DWARF’S ATMOSPHERE', size: 'md' },
  { id: 'c-deb-n',    group: 'top',   kind: 'note',    t0: 144, t1: 198, text: 'CONCEPTUAL ILLUSTRATION · DISTANCES AND SIZES EXAGGERATED' },
  // ---- Scene 5 (the diagram canvas draws the spectrum itself)
  { id: 'c-spec',     group: 'lower',  kind: 'heading', t0: 238, t1: 257, text: 'THE STAR’S ATMOSPHERE CHANGES ITS APPARENT COLOUR.', size: 'md' },
  // ---- Scene 6
  { id: 'c-cut',      group: 'lower',  kind: 'heading', t0: 264, t1: 292, text: 'A WHITE DWARF IS THE DENSE REMNANT OF AN EVOLVED STAR.', size: 'md' },
  { id: 'c-cut-n',    group: 'top',   kind: 'note',    t0: 266, t1: 318, text: 'SCHEMATIC CROSS-SECTION · NOT A VIEW INSIDE THE STAR · LAYER THICKNESS NOT TO SCALE' },
  { id: 'c-typ',      group: 'lower',  kind: 'label',   t0: 296, t1: 317, text: 'A TYPICAL WHITE DWARF: ROUGHLY EARTH-SIZED, ABOUT HALF A SUN’S MASS' },
  // ---- Scene 7
  { id: 'c-sys',      group: 'lower',  kind: 'heading', t0: 326, t1: 352, text: 'MATERIAL FROM A FORMER PLANETARY SYSTEM', size: 'md' },
  { id: 'c-dust',     group: 'lower',  kind: 'label',   t0: 362, t1: 385, text: 'DUST AND ROCK, LIT BY THE REMNANT’S LIGHT' },
  { id: 'c-sys-n',    group: 'top',   kind: 'note',    t0: 324, t1: 388, text: 'ORBITAL PATHS ARE ILLUSTRATIVE · NO PLANETS OR ORBITAL PARAMETERS ARE IMPLIED' },
  // ---- Scene 8
  { id: 'c-colour',   group: 'lower' , kind: 'heading', t0: 430, t1: 448, text: 'THE UNIVERSE IS MORE COLOURFUL THAN WE IMAGINED' },
  { id: 'c-next',     group: 'lower' , kind: 'heading', t0: 452, t1: 465, text: 'WHAT SHOULD WE EXPLORE NEXT?' },
  { id: 'c-brand',    group: 'lower' , kind: 'brand',   t0: 467, t1: 478.5, text: 'TECHNICAL TALK INDIA' },
];

export const FADE_IN = 1.4;
export const FADE_OUT = 1.2;

/** Opacity (0..1) of a caption at time t. */
export function captionAlpha(c, t) {
  const fi = c.fadeIn ?? FADE_IN;
  const fo = c.fadeOut ?? FADE_OUT;
  return smooth((t - c.t0) / fi) * smooth((c.t1 - t) / fo);
}

// ---------------------------------------------------------------------------
//  Evolution sequence (scene 3) — explicit keyframes, seconds on the master clock.
//  r = star radius (arbitrary units, star radius 1 = "Sun-like"),
//  heat 0..1 colour: 0 sun-like, 1 red giant, 2 hot compact core -> see main.js
// ---------------------------------------------------------------------------
export const EVO_KEYS = [
  // t,    radius, stage(0 sun,1 giant,2 core), shellProgress(0..1), shellAlpha
  { t: 90,  r: 1.0,  stage: 0, shell: 0.0, alpha: 0.0 },
  { t: 104, r: 1.0,  stage: 0, shell: 0.0, alpha: 0.0 },
  { t: 118, r: 18.0, stage: 1, shell: 0.0, alpha: 0.0 },
  { t: 121, r: 18.0, stage: 1, shell: 0.02, alpha: 0.35 },
  { t: 130, r: 1.4,  stage: 2, shell: 0.45, alpha: 0.9 },
  { t: 135, r: 0.55, stage: 2, shell: 0.75, alpha: 0.55 },
  { t: 140, r: 0.5,  stage: 2, shell: 1.0, alpha: 0.0 },
];

// ---------------------------------------------------------------------------
//  Camera shots. Every number is an explicit keyframe value.
//    type 'orbit'  : spherical move about `center` (az/el in degrees, d in world units)
//    type 'follow' : tracks fragment `frag`; offset = [radial-outward, up, tangential] from the fragment
//    frame 'disk'  : coordinates are expressed in the tilted debris-disk frame
//    ease           : 'smoother' | 'smooth' | 'linear' | 'in' | 'out'
//    expo true     : distance is interpolated exponentially (long dollies)
//    blend         : seconds of cross-blend into the NEXT shot
//    shift         : aim the target sideways (camera-right) to place the star off-centre
// ---------------------------------------------------------------------------
export const SHOTS = [
  // 1. Extreme-wide opening + 2. fast-but-smooth approach through the starfield
  { id: 'approach', t0: 0, t1: 40, type: 'orbit', frame: 'world', ease: 'smoother', expo: true,
    d: [6000, 16], az: [74, 80], el: [6, 8], fov: [34, 40], tgt: [0, 0, 0], blend: 0 },
  // 3. Slow orbit
  { id: 'orbit-reveal', t0: 40, t1: 70, type: 'orbit', frame: 'world', ease: 'smooth', expo: true,
    d: [16, 7], az: [80, 200], el: [8, 18], fov: [40, 40], tgt: [0, 0, 0], blend: 0 },
  // 4. Close-up of the illuminated surface
  { id: 'closeup', t0: 70, t1: 90, type: 'orbit', frame: 'world', ease: 'smooth', expo: true,
    d: [7, 2.9], az: [200, 232], el: [18, 11], fov: [40, 36], tgt: [0, 0, 0], blend: 0 },

  // Scene 3 — conceptual evolution (own scale; star radius comes from EVO_KEYS)
  { id: 'evo-sun',   t0: 90,  t1: 104, type: 'orbit', frame: 'world', ease: 'smooth', expo: true,
    d: [5.6, 6.2], az: [20, 52], el: [9, 11], fov: [40, 40], tgt: [0, 0, 0], blend: 0 },
  { id: 'evo-giant', t0: 104, t1: 118, type: 'orbit', frame: 'world', ease: 'smooth', expo: true,
    d: [6.2, 52], az: [52, 96], el: [11, 14], fov: [40, 40], tgt: [0, 0, 0], blend: 0 },
  { id: 'evo-shed',  t0: 118, t1: 130, type: 'orbit', frame: 'world', ease: 'smooth', expo: true,
    d: [52, 150], az: [96, 128], el: [14, 18], fov: [40, 44], tgt: [0, 0, 0], blend: 0 },
  { id: 'evo-wd',    t0: 130, t1: 140, type: 'orbit', frame: 'world', ease: 'smoother', expo: true,
    d: [150, 8.5], az: [128, 150], el: [18, 10], fov: [44, 38], tgt: [0, 0, 0], blend: 0 },

  // Scene 4 — debris
  // 5. Wide shot of planetary debris
  { id: 'debris-wide', t0: 140, t1: 160, type: 'orbit', frame: 'disk', ease: 'smooth', expo: true,
    d: [36, 11.85], az: [-48, 56.4], el: [26, 5.4], fov: [44, 40], tgt: [0, 0, 0], blend: 3.5 },
  // 6. Side-tracking shot following a falling rocky fragment
  { id: 'debris-follow', t0: 160, t1: 182, type: 'follow', frame: 'disk', frag: 'A', ease: 'smooth',
    offset: [[4.2, 1.1, -3.2], [2.8, 0.7, -2.0]], look: [0.0, 0.85], fov: [40, 36], blend: 6 },
  { id: 'debris-pull', t0: 182, t1: 200, type: 'orbit', frame: 'disk', ease: 'smooth', expo: true,
    d: [6.63, 12.5], az: [-175, -208], el: [6.1, 10], fov: [36, 38], tgt: [0, 0, 0], blend: 4 },

  // Scene 5 — star sits left of frame while the spectrum diagram takes over
  { id: 'spec-orbit', t0: 200, t1: 260, type: 'orbit', frame: 'world', ease: 'smooth', expo: false,
    d: [12.5, 11], az: [152, 210], el: [10, 14], fov: [38, 38], tgt: [0, 0, 0], shift: [5.2, 4.6], blend: 4 },

  // Scene 6 — star centred for the cutaway (the overlay is registered to the star)
  { id: 'cut-orbit', t0: 260, t1: 320, type: 'orbit', frame: 'world', ease: 'smooth', expo: false,
    d: [5.4, 4.5], az: [215, 236], el: [9, 12], fov: [38, 38], tgt: [0, 0, 0], shift: [0, 0], blend: 0 },

  // Scene 7 — grand debris sequence, multiple camera paths
  { id: 'sys-wide', t0: 320, t1: 337, type: 'orbit', frame: 'disk', ease: 'smooth', expo: true,
    d: [44, 12.77], az: [20, -76], el: [38, 7.2], fov: [46, 40], tgt: [0, 0, 0], blend: 3.5 },
  { id: 'sys-follow', t0: 337, t1: 356, type: 'follow', frame: 'disk', frag: 'B', ease: 'smooth',
    offset: [[4.6, 1.4, 3.4], [3.0, 0.9, 2.2]], look: [0.0, 0.85], fov: [40, 34], blend: 6 },
  { id: 'sys-low', t0: 356, t1: 373, type: 'orbit', frame: 'disk', ease: 'smooth', expo: false,
    d: [8.59, 7.2], az: [11.2, 110], el: [6.6, 2.6], fov: [34, 50], tgt: [0, 0, 0], blend: 3 },
  { id: 'sys-pull', t0: 373, t1: 390, type: 'orbit', frame: 'disk', ease: 'smooth', expo: true,
    d: [7.2, 16], az: [110, 160], el: [2.6, 14], fov: [50, 40], tgt: [0, 0, 0], blend: 5 },

  // Scene 8 — final orbit, then 9. dramatic orbital pullback, 10. final wide reveal
  { id: 'fin-orbit', t0: 390, t1: 412, type: 'orbit', frame: 'world', ease: 'smooth', expo: true,
    d: [16, 7.4], az: [160, 260], el: [14, 9], fov: [40, 38], tgt: [0, 0, 0], blend: 4 },
  { id: 'fin-close', t0: 412, t1: 428, type: 'orbit', frame: 'world', ease: 'smooth', expo: true,
    d: [7.4, 4.4], az: [260, 372], el: [9, 13], fov: [38, 36], tgt: [0, 0, 0], blend: 0 },
  { id: 'fin-pullback', t0: 428, t1: 480, type: 'orbit', frame: 'world', ease: 'smoother', expo: true,
    d: [4.4, 21000], az: [372, 434], el: [13, 9], fov: [36, 42], tgt: [0, 0, 0], blend: 0 },
];

// ---------------------------------------------------------------------------
//  Audio markers. The video is SILENT unless the user supplies audio files.
//  These are only synchronisation cues for narration / music / transitions.
// ---------------------------------------------------------------------------
export const NARRATION = [
  { t: 8,   text: 'Out in the dark, far beyond the Solar System, there is a star that does not look the way stars are supposed to look.' },
  { t: 24,  text: 'Stars come in many colours, but green is almost never one of them. So what is going on?' },
  { t: 46,  text: 'This is WD J1330+6435, a white dwarf roughly 280 light-years from Earth. Astronomers report that its modelled colour is a pale chartreuse green.' },
  { t: 70,  text: 'What you see on the surface is an artistic visualization. Nobody has seen detail on a star this distant.' },
  { t: 93,  text: 'To understand the colour, we start with the life of a Sun-like star. It swells into a red giant.' },
  { t: 119, text: 'It sheds its outer layers into space, and leaves behind a hot, dense core: a white dwarf.' },
  { t: 144, text: 'Around some white dwarfs, rocky debris from a former planetary system orbits and falls inward.' },
  { t: 170, text: 'That planetary material can pollute the star’s atmosphere with elements you would never expect there.' },
  { t: 203, text: 'Astronomers study starlight by spreading it into a spectrum. Sodium in the dense atmosphere absorbs broadly across the orange part of that spectrum.' },
  { t: 234, text: 'Feed that spectrum into a model of human colour vision, and the star’s apparent colour changes. That is how the green is modelled.' },
  { t: 264, text: 'A white dwarf is the dense remnant of an evolved star. This diagram is a schematic, not a view inside.' },
  { t: 296, text: 'A typical white dwarf is roughly the size of Earth, with about half the mass of the Sun.' },
  { t: 326, text: 'Here, the debris is the remains of a former planetary system. Paths and distances are illustrative.' },
  { t: 362, text: 'Dust and rock, lit by the remnant’s faint light, spiral inward over time.' },
  { t: 392, text: 'One last orbit around the star, and its modelled colour.' },
  { t: 430, text: 'The universe is more colourful than we imagined.' },
  { t: 452, text: 'What should we explore next?' },
];

export const AUDIO_CUES = [
  { t: 0,    kind: 'music',  text: 'Ambient space bed in (optional, user-supplied)' },
  { t: 22,   kind: 'sfx',    text: 'Soft rising swell into the hook caption' },
  { t: 40,   kind: 'sfx',    text: 'Reveal: low gentle tone' },
  { t: 90,   kind: 'sfx',    text: 'Transition: soft whoosh into evolution sequence' },
  { t: 118,  kind: 'sfx',    text: 'Shell expulsion: slow swell' },
  { t: 140,  kind: 'sfx',    text: 'Transition into debris sequence' },
  { t: 200,  kind: 'sfx',    text: 'Transition into spectrum display' },
  { t: 232,  kind: 'sfx',    text: 'Colour conversion: gentle rising tone' },
  { t: 260,  kind: 'sfx',    text: 'Transition back to the star' },
  { t: 320,  kind: 'sfx',    text: 'Transition into the former planetary system' },
  { t: 428,  kind: 'music',  text: 'Music swell for the pullback' },
  { t: 466,  kind: 'music',  text: 'Music resolves; fade out by 08:00' },
  ...NARRATION.map((n) => ({ t: n.t, kind: 'narration', text: n.text })),
].sort((a, b) => a.t - b.t);

// ---------------------------------------------------------------------------
//  Shorts / vertical cut: five 11.8 s highlights = 59.0 s (1 770 frames).
// ---------------------------------------------------------------------------
export const SHORTS_SEGMENTS = [
  { t0: 22.0,  t1: 33.8 },   // the hook
  { t0: 52.0,  t1: 63.8 },   // the reveal
  { t0: 152.0, t1: 163.8 },  // debris
  { t0: 238.0, t1: 249.8 },  // the colour explanation
  { t0: 454.0, t1: 465.8 },  // pullback + question
];
export const SHORTS_FADE = 0.45;
export const SHORTS_DURATION = SHORTS_SEGMENTS.reduce((a, s) => a + (s.t1 - s.t0), 0);

/** Map a time on the shorts clock to {t: master time, fade: extra blackout 0..1}. */
export function shortsMap(local) {
  let acc = 0;
  for (let i = 0; i < SHORTS_SEGMENTS.length; i++) {
    const s = SHORTS_SEGMENTS[i];
    const len = s.t1 - s.t0;
    if (local < acc + len || i === SHORTS_SEGMENTS.length - 1) {
      const u = Math.max(0, Math.min(len, local - acc));
      const fade = Math.max(
        1 - smooth(u / SHORTS_FADE),
        1 - smooth((len - u) / SHORTS_FADE)
      );
      return { t: s.t0 + u, fade };
    }
    acc += len;
  }
  return { t: 0, fade: 1 };
}

/** Everything the exporter needs for a given output mode. */
export function exportPlan(mode) {
  if (mode === 'shorts') {
    const frames = Math.round(SHORTS_DURATION * FPS);
    return { frames, duration: frames / FPS, mapFrame: (i) => shortsMap(i / FPS) };
  }
  return { frames: TOTAL_FRAMES, duration: DURATION, mapFrame: (i) => ({ t: i / FPS, fade: 0 }) };
}

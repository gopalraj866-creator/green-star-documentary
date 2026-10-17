# The Real Green Star — WD J1330+6435
8-minute cinematic **scientific visualization** in Three.js / WebGL for *Technical Talk India*.
Deterministic: the same frame number always produces the same picture. Silent by default (audio cues provided).

> The green colour is an **artistic reconstruction** built from a schematic spectrum model — not a telescope photograph.
> Surface detail, debris and the cross-section are illustrations. Distance (~280 ly) is the approximate reported value.

## What you get
| Output | Size | Length | Frames |
|---|---|---|---|
| `1080p` | 1920×1080, 30 fps, H.264 | exactly 480.000 s | 14 400 |
| `4k`    | 3840×2160, 30 fps, H.264 | exactly 480.000 s | 14 400 |
| `shorts`| 1080×1920 vertical, 30 fps | 59.000 s (5 highlights) | 1 770 |

Shorts highlights: hook (00:22) · reveal (00:52) · debris (02:32) · why it looks green (03:58) · pull-back + question (07:34).

## Render on GitHub (recommended)
1. Create a GitHub repo, upload everything in this folder, push to `main`.
2. **Actions → "Render Green Star documentary" → Run workflow.**
   * `profile`: `1080p`, `4k`, `shorts` or `all`
   * `quick_test`: tick first — renders 2 s per profile in about a minute to confirm everything works
   * `chunk_frames`: leave blank (1080p = 300 frames/job, 4K = 150, Shorts = 295)
   * `audio_file`: optional path to a narration/music file you committed (e.g. `audio/narration.mp3`)
3. When finished, download `GreenStar-1080p` / `GreenStar-4k` / `GreenStar-shorts` from the run's **Artifacts**.

The render is split into parallel jobs (≤20 at a time); each job renders its frames with software WebGL (no GPU needed),
encodes a chunk, and a final job joins the chunks and **fails if the runtime isn't exactly 480 s** (59 s for Shorts).
Rough wall-clock: 1080p ≈ 1 h, 4K ≈ 3–4 h, Shorts ≈ 10 min. On a *public* repo Actions minutes are free;
on a private repo 4K can use more than the free monthly allowance (1080p ≈ 12 CPU-hours, 4K ≈ 50).
Artifacts are kept 14 days — download promptly.

## Preview locally
```
npm install
npm run preview        # http://127.0.0.1:8080/index.html
```
Real-time player with a timeline bar (preview only — never in exports). Space = pause, ←/→ = ±5 s, `H` hides the bar.
Preview on a slow machine will drop frames; the exported video is always exact.

## Render locally (optional)
```
npm install && npx playwright-core install chromium     # ffmpeg must be on PATH
npm run verify                                          # timeline / camera / runtime checks
node scripts/render.mjs --profile 1080p --start 0 --count 14400 --out chunks/all.mp4      # whole film, one job
node scripts/render.mjs --profile 1080p --start 0 --count 300  --out chunks/chunk_0000.mp4 # or in pieces,
node scripts/assemble.mjs --dir chunks --out final.mp4 --expect 480                       # then join
```
Capturing all 14 400 frames at 30 fps = 480.000 s. Frame *i* is drawn at time *i/30*; the last frame (479.967 s) is
black, and the picture reaches black at exactly 480 s. `assemble.mjs` checks the duration with ffprobe.

## Timeline (master clock, seconds)
| Time | Scene |
|---|---|
| 0–40 | Darkness → a tiny green point → fast approach through the starfield. *"A STAR THAT SHOULDN'T LOOK GREEN?"* |
| 40–90 | Slow orbit, reveal, close-up of the surface. WD J1330+6435 · WHITE DWARF · ~280 LIGHT-YEARS |
| 90–140 | Sun-like star → red giant → expelled shell → compact white dwarf (conceptual, not to scale) |
| 140–200 | Rocky debris, fragments spiralling in, dust trails; wide shot + side-tracking follow shot |
| 200–260 | Spectroscopy display: broad orange absorption (sodium) → modelled colour |
| 260–320 | Schematic cross-section, size comparison to the Sun (to scale) |
| 320–390 | Former planetary system: debris, orbit lines, follow shot, low pass, pull-back |
| 390–480 | Final orbit, close-up, long pull-back to a point among the stars, closing captions, fade to black at 480 s |

Everything is data in `src/timeline.js` (scenes, captions, camera shots, dips, narration, audio cues, Shorts cut).

## Audio
No audio is synthesised. `docs/narration_script.txt`, `docs/captions.srt` (subtitles for YouTube) and `docs/cues.json`
give timestamps for narration, music and transitions. Record your own narration/music, commit the file, and pass it as
`audio_file` (or mux locally with `node scripts/assemble.mjs ... --audio narration.mp3`).

## Project layout
```
index.html               page (preview + export)
src/main.js              scene, post-processing, updateScene(t), export API
src/timeline.js          master timeline (pure data/functions)
src/camera.js            camera director (keyframes, easing, damping, follow shots)
src/shaders.js           all GLSL (star surface, glow, sky, debris, grade)
src/debris.js            deterministic debris + CPU twin of the GPU orbit maths
src/spectrum.js          schematic spectrum → modelled colour (CIE 1931)
src/overlay.js           captions + diagram layer (spectrum, cross-section, labels)
scripts/                 verify, render, assemble, shot, preview, matrix planner, cue exporter
.github/workflows/render.yml
vendor/                  three.js r160 + addons, Inter font (SIL OFL) — no internet needed at render time
```

## Notes on the science (what is and isn't claimed)
* Reported: WD J1330+6435 is a white dwarf ~280–284 ly away whose spectrum (modelled through human colour vision) gives a pale
  chartreuse colour; broad absorption in the orange attributed to sodium in a very dense atmosphere; its atmosphere contains
  elements consistent with accreted planetary debris.
* Illustration only: surface texture, debris sizes/orbits, the evolution animation, the cross-section layers and the spectrum
  curve (not measured data). The video says so on screen.
* Source reporting: Popular Science, "Astronomers discover first green star and the reddest star ever recorded"
  (study in *RAS Techniques and Instruments*; M. Hollands, B. Gänsicke, Univ. of Warwick).

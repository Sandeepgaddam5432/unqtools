# UnQTools Publishing Videos

Two vertical (1080×1920, 30 FPS, H.264 + AAC) publishing videos built with the vendored
Brag skill (`brag/skills/brag/`) and the Hyperframes workflow, plus a 20s baseline brag.
All branding, copy, counts, and tool demos verified against the repository source and the
live site (unqtools.pages.dev) before authoring. No production code was modified.

## Deliverables

| Film | Path | Duration | Size | Poster | Editable source |
|------|------|----------|------|--------|-----------------|
| Flagship (3 min, narrated) | `video-3min/video-3min.mp4` | 180.0s | ~21 MB | `video-3min/poster.jpg` | `video-3min/composition/index.html` |
| Launch reel (1 min, music-led) | `video-1min/video-1min.mp4` | 60.0s | ~11 MB | `video-1min/poster.jpg` | `video-1min/composition/index.html` |
| Baseline brag (20s, /brag skill) | `baseline-brag/brag.mp4` | 20.0s | ~3 MB | `baseline-brag/brag.jpg` | `baseline-brag/composition/index.html` |

All three: h264 1080×1920 30/1 fps, AAC 48 kHz stereo, yuv420p, +faststart.
Posters are deliberate settled beats, baked as frame 0 (players/platforms grab frame 0).

Supporting files:
- Plans/storyboards: `baseline-brag/brag-plan.md`, `video-1min/storyboard.md`, `video-3min/storyboard.md`
- Composition briefs: `*/composition-brief.md`
- Narration: `video-3min/narration-script.md` + recorded clips `video-3min/composition/assets/voice/vo-01..10.mp3` (Arena voice `voice-00`)
- Captions: `video-3min/captions.md`, `video-1min/captions.md`
- Share copy: `*/share-copy.txt`

## Creative direction

Premium charcoal (#262624) + warm cream (#faf9f5) + terracotta (#d97757/#b5562d) — the app's
real tokens (`src/app/globals.css`); Geist + Geist Mono (local woff2); real logo
(`public/logo.svg`); real QR code of unqtools.pages.dev; UI recreations grounded in the real
tool pages (JSON Formatter, Password Generator, Compress PDF, QR Code Generator, Color
Picker, Word Counter, search + task cards + category grid from the home page).

## Featured tools & verified claims

- JSON Formatter (Format/Minify/Validate, sample subset from `src/tools/developer/json-formatter`) — status done
- Password Generator (Random / EFF passphrase / Pronounceable — real modes) — done
- QR Code Generator (real QR asset of the site URL) — done
- Compress PDF (5 real presets; demo file result clearly illustrative) — done
- Color Picker, Word & Character Counter — done
- Counts: 1,679 tools / 13 categories (`src/lib/counts.ts`, matches live site); 1,172
  `status:"done"` in `src/lib/catalog.ts` → on-screen "1,100+ ready now" (never "all functional")
- Privacy/offline: "No uploads / No accounts / No tracking / Works offline / 100% Client-Side /
  No Sign-up", PWA install + service worker (`public/sw.js`, `public/manifest.json`),
  "41.3K tests", "100% privacy" — all verbatim from the live home page.

## Validation & render QA

- `npx hyperframes check` passed with 0 errors on all three compositions (WCAG contrast
  17/17, 37/37, 31/31 respectively); remaining lint items are advisory structure warnings.
- Snapshot frame inspections across all scenes; fixed tofu glyphs, edge-to-edge headline,
  caret placement, SFX slot fits, and audio-automation JSON.
- ffprobe verified duration/resolution/fps/codecs on every final; volumedetect on narration,
  montage, and CTA windows shows balanced levels (mean −15…−20 dB, peaks ≤ −1.5 dB).
- Poster frames inspected and baked as frame 0.

## Environment notes (this sandbox)

- FFmpeg/FFprobe not preinstalled and apt blocked → bundled static binaries via npm
  (`@ffmpeg-installer`, `@ffprobe-installer`) exposed at `~/ffbin` (HYPERFRAMES_FFMPEG_PATH
  picked up via PATH).
- Chrome CDN blocked → Chromium 153 headless served from the npm `@sparticuz/chromium`
  package with its bundled AL2023 libs, exposed via `HYPERFRAMES_BROWSER_PATH=/tmp/chromium`.
- GSAP served locally (`assets/gsap.min.js`, npm) because cdn.jsdelivr.net is blocked.
- Render env helper: `source /home/user/hfenv.sh` before `npx hyperframes …`.
- Render mode: screenshot capture (BeginFrame needs chrome-headless-shell); ~10 min per 180s
  at `--quality high` on 2 vCPUs.

## Re-render

```bash
source /home/user/hfenv.sh
cd video-3min/composition && npx hyperframes check && npx hyperframes render --quality high --output ../video-3min.mp4
```

# Hyperframes Composition Brief: UnQTools (baseline brag)

## Objective
Create a 20-second vertical launch-style brag video for UnQTools following brag-plan.md.

## Output
- Composition directory: `composition/`
- Rendered video: `brag.mp4`
- Format: vertical — 1080x1920
- Duration: 20 seconds

## Source Material
- Project root: `/home/user/unqtools` (UnQTools app source, `videos` branch)
- Primary files read: `src/app/globals.css` (theme tokens), `src/app/layout.tsx` (Geist/Geist Mono, site metadata), `src/lib/counts.ts` (1679 tools / 13 categories), live site copy via fetch (hero "Private tools that respect you", badges, stats 1679/13/41.3K/100%), `src/tools/developer/json-formatter/ui.tsx` (sample + buttons), `src/tools/network-security/password-generator/ui.tsx`, `src/tools/pdf/compress-pdf/ui.tsx` (presets), `public/logo.svg`, `public/manifest.json`.
- Product name: UnQTools
- Tagline / strongest claim: "Private tools that respect you" — everything runs 100% in your browser.
- Key UI or visual moment to recreate: terracotta logo tile + wordmark; mono byte counters; pill badges; tool card with terracotta action button.
- Copy that must appear verbatim:
  - "Private tools that respect you"
  - "No uploads" / "No accounts" / "No tracking" / "Works offline"
  - "unqtools.pages.dev"
  - "1,679 tools" / "13 categories"

## Creative Direction
- Tone preset: polished
- Creative direction: premium product launch film — precision engineering, warm restraint
- Hook: mono task lines ("compress a pdf." "format json." "shrink an image.") slashed into "or one tab."
- Outro: logo + URL + "1,679 tools. Free. Private."
- Avoid: generic SaaS language, abstract filler, neon gradients, repetitive zooms, particles.

## Visual Identity
- Background: #262624 (deep panel #1b1b19, card #30302e, border #3e3e38)
- Text: #faf9f5; muted #b7b5a9
- Accent: #d97757 (primary), #b5562d deep; success green #34d399; gradient headline white→#a5b4fc→#fda4af
- Display font: Geist (local woff2, @font-face)
- Body/mono: Geist Mono (local woff2)
- Visual references: docs/screenshots/v6 (dark hero with floating capsules, terracotta wordmark; JSON Formatter tool page layout)

## Storyboard
Use the storyboard in `brag-plan.md` as the creative contract (5 scenes, 20s total).

Scene summary:
1. Twelve tabs — 3.0s — mono lines + slash wipe + "or one tab."
2. Brand reveal — 4.0s — logo lands beat-locked 4.10, tagline verbatim.
3. Tools doing work — 8.0s — JSON Formatter, Password Generator, QR Code demos (real QR svg asset).
4. Privacy — 3.0s — headline + 4 verified badges, sequential pops.
5. Outro — 2.0s — logo + URL + "1,679 tools. Free. Private."

## Audio
- Audio role: warm bed + sparse professional accents
- Music: happy-beats-business-moves-vol-10-by-ende-dot-app.mp3 (bundled in brag skill), trimmed 0–20s
- Music treatment: fade in 0→0.6, full under highlights, fade out 19→20
- Music cue guidance: bundled preset JSON; strongCues 4.10 (logo land, beat-locked) and 11.46 (QR card land); beat-grid ~0.55s for badge sequence (every other beat)
- Audio-reactive treatment: subtle — logo glow/card presence breathe with RMS; no waveform visuals
- SFX selection guidance: brag/skills/brag/assets/sfx/sfx-analysis.md; low HF-risk picks (impactSoft_medium_001 for logo, interface/click_003 on Format press, ui/rollover2 on generate, interface/click_005 on QR snap, ui/click2 on badges)
- Exact SFX choice: filenames above pre-selected by /brag; density sparse
- Audio files: copied into composition/assets/music and composition/assets/sfx

## Hyperframes Instructions
Load hyperframes-core/animation/creative/keyframes/cli. /brag owns story; Hyperframes owns mechanics.
- Root 1080x1920, data-duration 20.
- All fonts via local @font-face (Geist-Variable.woff2, GeistMono-Variable.woff2).
- Show real product UI recreations (JSON Formatter card, password card, QR asset).
- Music <audio id="music"> with data-automation volume lane (fade in/out).
- Each SFX its own <audio id>, data-start at the visual moment, short data-duration.
- Mark beat-locks with comments: // beat-locked: 4.10s etc.
- Run `npx hyperframes check` until 0 errors; render --quality high to brag.mp4.

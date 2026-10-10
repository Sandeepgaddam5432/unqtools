# Hyperframes Composition Brief: UnQTools — Viral Reel 60s

## Objective
Create a 60-second vertical high-velocity product-launch reel for UnQTools
(director-ordered extension of the /brag workflow: `--duration 60 --format vertical --voice --tone cinematic`).

## Output
- Composition directory: `brag-output/reel-60s/composition/` — **already implemented (picture-lock scaffold)**
- Rendered video: `brag-output/reel-60s/UnQTools_Viral_Reel_60s.mp4`
- Format: vertical — 1080x1920
- Duration: 60.0s

## Source Material
- Project root: `/home/user/unqtools` (Next.js 15 static PWA, Cloudflare Pages)
- Primary files read: `src/app/home-page-client.tsx`, `src/app/globals.css`, `src/lib/counts.ts`,
  `README.md`, `STATE.md`, `public/sw.js`, `public/manifest.json`, `src/components/navigation/sidebar.tsx`
- Product name: UnQTools — pronounced "Un-Q-Tools"
- Tagline / strongest claim: "Private tools that respect you" · "Your data never leaves your device."
- Key UI moments recreated: hero glass search bar, plain-language autocomplete, Compress PDF
  drag-drop + target-size flow, DevTools Network panel, airplane-mode toggle, PWA install chip, category chips
- Copy that appears verbatim:
  - "1,679 free browser tools — no signup, no tracking"
  - "Private tools that respect you"
  - "Search 1,679 tools…"
  - "make my PDF smaller" → Compress PDF · "join two pdfs" → Merge PDF
  - "No analytics / No cookies / No fingerprinting"
  - "Your data never leaves your device."
  - "Built with ❤️ by Sandeep Gaddam" (sidebar's own credit)
  - Category counts: 466/305/178/109/100/100/96/83/57/55/45/45/40 · stats strip 13 · 41.3K · 100%

## Creative Direction
- Tone preset: `cinematic`
- Creative direction: "privacy heist trailer — the file that never left"
- Interpretation: beat-locked hard cuts, big type, shockwave reveals; product surfaces stay
  truthful (real palette, real copy) inside an obsidian/violet/teal cinematic stage
- Angle: the network tab is the hero — watch it stay at 0 B
- Hook: "STOP." + red upload glyph, riser → 808-style drop at 3.01s
- Outro: glowing `unqtools.pages.dev` → heartbeat credit with sub-impact boom
- Avoid: generic SaaS language, abstract filler, invented metrics (all numbers audited — see brag-plan.md grounding table)

## Visual Identity
- Stage: obsidian glassmorphism `#0A0A0F` / `#12121A`, violet `#8B5CF6`, teal rim `#2DD4BF`
- Product surfaces (inside browser frame): UnQTools dark theme `#262624` bg, `#c3c0b6` fg,
  `#d97757 → #f2a35e` primary gradient
- Display font: Geist (site's own) · Body font: Geist · Mono: Geist Mono (DevTools surfaces)
- Browser frame: macOS/Arc-style — traffic lights, tab strip with active-tab transitions, lock-icon address bar

## Storyboard
`brag-plan.md` is the creative contract. Implemented scene map (all `// beat-locked:` /
`// beat-grid:` markers are in `composition/index.html`):
1. HOOK — 3.2s — STOP + upload glyph + riser
2. REVEAL — 9.0s — drop 3.01 → wordmark → badge → count-up 1,679 → stats → tagline
3. SEARCH — 8.6s — browser frame, 19 live keystrokes, spring autocomplete, Enter
4. COMPRESS — 11.7s — drag-drop flight, hot zone, target-size chips, gauge 0→100%, −75% card, 0 B mini-panel
5. ZERO TELEMETRY — 7.4s — DevTools Network, empty table, giant 0 B, 3 verbatim pills, caption
6. OFFLINE — 7.4s — airplane toggle, slashed Wi-Fi, 6 live tool tiles, install chip
7. MONTAGE — 6.8s — 13 category chips w/ real counts, 0.27s stagger + hold
8. OUTRO — 6.4s — URL bloom, ❤️ boom, heartbeat glow ×4, fade to black

## Audio
- Audio role: dense rhythmic layer under master VO
- Audio arc: riser (0–3) → drop-locked reveal → tactile foley middle → chime payoff → sub-boom credit → tail
- Music: `assets/music/bgm-reel.mp3` — INGEST SLOT. Director spec: synthwave/cyber-electronic,
  riser → 808 drop @0:03 → driving pulse → ambient tail. Shipped fallback: bundled ende.app vol-10 (60.00s, 109.96 BPM).
- Music treatment: vol 0.35, fade-in 0.4 / fade-out 1.6; `scripts/ingest-audio.sh` applies
  −12 dB sidechain ducking under the VO and loudness-matches (music ≈ 0.12–0.15 effective under narration)
- Music cue guidance: bundled preset `assets/music/bgm-reel.music-cues.json`.
  Strong-cue locks: 3.01s (drop), 20.19s (scene 4 entry). Beat grid: 4.10/5.19/6.82/7.08/7.35/12.02/33.19/34.28/35.37.
  After external BGM ingest: `npx hyperframes beats .` and re-snap marked moments (±0.15s major / ±0.10s minor).
- Audio-reactive treatment: subtle — orb/rim glow may breathe with RMS (hyperframes-creative owns extraction)
- Audio-coupled moments: 19 keystrokes (per-char foley), gauge sweep, chip cascade, stat count-up, heartbeat outro
- SFX selection guidance: `brag/skills/brag/assets/sfx/sfx-analysis.md`; chosen set is low/medium HF-risk
  for repeated moments (keypresses @0.5, click_003 ticks @0.35), heavier impacts isolated (drop 3.01, boom 55.80)
- Exact SFX choices: 45 clips wired in `index.html` (track-index 30–82), timestamps = animation starts
- Audio files: bundled music + SFX already copied into `composition/assets/`; VO slot documented in
  `composition/assets/voiceover/VO-INGEST.md`

## Voiceover (enabled — director ordered studio synthesis)
- Script: `voiceover-script.md` (timecoded + SSML) / `voiceover-plain.txt` (plain, 140 words)
- Track: `<audio id="vo" data-start="0" data-track-index="20" data-volume="1" src="assets/voiceover/voiceover.wav">`
- Local generation option: `npx hyperframes tts ../voiceover-plain.txt --voice af_heart --output composition/assets/voiceover/voiceover.wav`
- External studio option: synthesize the SSML block (ElevenLabs/Azure/Play.ht), export 48 kHz WAV ≤ 60.0s,
  run `brag-output/scripts/ingest-audio.sh <vo.wav> [<bgm.mp3>]`
- Pre-ingest: `prepare-assets.sh` writes a silent placeholder so check/render never fail
- Scene durations flex ±0.3s to the generated WAV duration if needed (adjust CHARS array + scene data-duration)

## Hyperframes Instructions
- The composition contract is implemented: paused GSAP root timeline on `window.__timelines["main"]`,
  `class="clip"` + `data-start`/`data-duration` on every timed element, deterministic logic only
  (hardcoded keystroke array, finite repeat counts — seek-safe)
- Run `npm run check` (lint + runtime + layout + WCAG contrast) before render; fix every error
- Render: `npm run render` → `../UnQTools_Viral_Reel_60s.mp4` (quality high)
- Poster: extract the settled reveal frame (≈5.9s, count-up mid-flight) or outro URL frame (≈55.0s),
  bake as frame 0 per step-4-deliver.md
- Keep creation and rendering local

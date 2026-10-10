# Hyperframes Composition Brief: UnQTools — Deep Dive 180s

## Objective
Create a 180-second vertical architectural product showcase for UnQTools
(director-ordered /brag extension: `--duration 180 --format vertical --voice --tone cinematic`).

## Output
- Composition directory: `brag-output/deepdive-180s/composition/` — **already implemented (picture-lock scaffold)**
- Rendered video: `brag-output/deepdive-180s/UnQTools_DeepDive_3min.mp4`
- Format: vertical — 1080x1920
- Duration: 180.0s

## Source Material
- Project root: `/home/user/unqtools` (Next.js 15 static PWA on Cloudflare Pages)
- Primary files read: `src/app/home-page-client.tsx`, `src/app/globals.css`, `src/lib/counts.ts`,
  `public/sw.js`, `public/manifest.json`, `README.md`, `STATE.md`,
  `src/tools/pdf/pdf-page-manager/ui.tsx`, `src/tools/pdf/compress-pdf/*`, `src/components/navigation/sidebar.tsx`
- Product name: UnQTools ("Un-Q-Tools")
- Tagline / strongest claims: "Private tools that respect you" · "Your data never leaves
  your device." · "60 PDF tools now beat iLovePDF / SmallPDF / Sejda"
- Key UI moments recreated: verbatim hero (badge/H1/sub-copy/search/stats/trust badges),
  DevTools Network panel, sw.js precache card, airplane toggle, Compress PDF full flow with
  target-size presets + gauge + before/after thumbs, Page Manager's 7 real tabs, 26→1 merge,
  counters (41,300 / 7,000 / 1,133), v18.7 stamp + 100x wave rail
- Copy that appears verbatim: see brag-plan.md grounding table (13 verbatim surfaces)

## Creative Direction
- Tone preset: `cinematic` — documentary scale
- Creative direction: "privacy documentary — the empty network tab"
- Interpretation: six acts with slates, counters as evidence, restrained foley, one boom
- Angle: the architecture IS the product
- Hook: files swallowed by a stranger's server rack (noir)
- Outro: glowing URL → heartbeat credit on a sub-impact boom
- Avoid: generic SaaS language, ungrounded metrics (every number traced to repo source)

## Visual Identity
- Stage: obsidian `#0A0A0F`/`#12121A` + violet `#8B5CF6` + teal `#2DD4BF` rim
- Product surfaces: real UnQTools dark theme `#262624`/`#c3c0b6`/`#d97757→#f2a35e`
- Fonts: Geist + Geist Mono (site's own)

## Storyboard
`brag-plan.md` is the creative contract. Six acts implemented with scene sections:
1. ACT I THE LEAK — 34.6s — rack + file ghosts + title slams + retention slots + device-safe turn
2. ACT II THE REVEAL — 39.4s — logo/badge/verbatim card/stat counters/constellation/READY 1,133/10× stamp/H1+trust/search demo
3. ACT III THE ARCHITECTURE — 46.4s — slate/layer stack/devtools 0 B/sw.js precache/airplane/telemetry pills+code chip/promise+phone
4. ACT IV THE FLAGSHIP FLOW — 35.2s — compress full flow/60-tools board/Page Manager 7 tabs/26→1 merge
5. ACT V THE RECEIPTS — 20.6s — slate/41,300 + 7,000 counters/v18.7 stamp/wave rail/ready counter/triad
6. ACT VI OUTRO — 7.6s — URL bloom/heartbeat credit/sub-boom/fade

## Audio
- Audio role: cinematic support under continuous documentary VO
- Audio arc: noir riser → beat-locked Act I titles → warm reveal ticks → sparse precision →
  driving flow foley → evidence ticks → music resolves ~164s → VO + heartbeat + final boom
- Music: `assets/music/bgm-deepdive.mp3` — INGEST SLOT (director spec: 3:00 synthwave,
  riser → 808 drop @0:03 → driving pulse → ambient reverb tail). Shipped fallback: bundled
  ende.app vol-1 (163.96s, 120.19 BPM), `data-duration="164"` `data-fade-out="5"` — the
  receipts + outro ride VO/foley as the ambient tail until a full-length score is ingested.
- Music treatment: 0.34 bed; ingest script applies −12 dB sidechain ducking under VO
- Music cue guidance: bundled preset `assets/music/bgm-deepdive.music-cues.json`.
  Strong-cue locks: 16.02 / 17.52 / 20.02 (Act I titles). Beat-grid: 34.47 (Act II logo).
  Beyond 25s the preset window ends — after external BGM ingest run `npx hyperframes beats .`
  (or `analyze_music_cues.py`) and re-snap the `// beat-locked:` markers.
- Audio-reactive treatment: subtle (orb/rim glow with RMS; hyperframes-creative owns extraction)
- Audio-coupled moments: file-ghost rises, stat counters (chips-stack ticks), 19 keystrokes,
  precache checklist, gauge sweep, tab cascade, 26→1 merge (shuffle riser), wave rail ticks, heartbeat
- SFX selection guidance: `brag/skills/brag/assets/sfx/sfx-analysis.md`; ~100 clips wired,
  low/medium HF-risk for repeated moments (click_003 ticks @0.30–0.35), single heavy impacts isolated
- Exact SFX choices: in `index.html` (track-index 30–142), timestamps = animation starts
- Audio files: bundled music + SFX copied into `composition/assets/`; VO slot per
  `composition/assets/voiceover/VO-INGEST.md`

## Voiceover (enabled — director ordered studio synthesis)
- Script: `voiceover-script.md` (timecoded per act/line + SSML master) / `voiceover-plain.txt` (421 words)
- Track: `<audio id="vo" data-start="0" data-duration="180" data-track-index="20" data-volume="1" src="assets/voiceover/voiceover.wav">`
- Local generation: `npx hyperframes tts ../voiceover-plain.txt --voice af_heart --output composition/assets/voiceover/voiceover.wav`
  (long-form alternative: synthesize per act and concatenate — see VO-INGEST.md)
- External studio: SSML master → 48 kHz WAV ≤ 180.0s → `scripts/ingest-audio.sh <vo.wav> [<bgm.mp3>]`
- Scene durations flex ±0.5s per act to the generated read if needed

## Hyperframes Instructions
- Contract implemented: paused GSAP root timeline on `window.__timelines["main"]`, `class="clip"`
  + `data-start`/`data-duration` on every timed element, deterministic + seek-safe only
  (hardcoded keystroke arrays, proxy-object counters with `onUpdate` formatting, finite
  `repeat` counts, property tweens instead of class callbacks)
- Run `npm run check` before render; fix all errors (incl. WCAG contrast)
- Render: `npm run render` → `../UnQTools_DeepDive_3min.mp4`
- Poster: strongest settled beat ≈ 36.5s (logo + badge + verbatim card) or 176.5s (URL + credit);
  bake as frame 0 per step-4-deliver.md
- Keep creation and rendering local

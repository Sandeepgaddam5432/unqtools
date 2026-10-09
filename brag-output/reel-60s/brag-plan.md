# Brag Plan: UnQTools — Viral Reel (60s, vertical)

> /brag creative contract, extended-duration run (`--duration 60 --format vertical --voice --tone cinematic`).
> The skill's default window is 15–25s; this run is an explicit director-ordered 60s product-launch reel,
> so the Hook → Reveal → Highlights → Outro pattern is scaled, not abandoned.

## What is this app?
UnQTools is a 100% static, privacy-first, offline-capable PWA packing **1,679 browser tools**
(13 categories) where every job — PDF compression, image conversion, QR generation, password
hashing — runs entirely on-device: no uploads, no accounts, no tracking.

## The angle
**"The network tab is the hero."** Every tool site begs you to upload; UnQTools dares you to
watch DevTools while you work and see *zero bytes leave*. The reel stages that dare as a
heist-movie reversal: the file never goes anywhere, because the toolbox came to the file.

## Hook (first 3 seconds)
Cold "STOP." over a red-glowing upload glyph — the reflex everyone has before dropping a
tax document on a random free-tool site. Tension riser → **808-style drop at 00:03.01**
(beat-locked to the 109.96 BPM grid) → the UnQTools wordmark shockwave.

## Key moments (the middle)
1. **Plain-language search typed live** — "make my PDF smaller" keystroke-by-keystroke
   (mechanical switch foley per character) → spring-physics autocomplete → **Compress PDF**.
   (Grounded: README v18.1 anti-confusion UX ships this exact query→tool mapping.)
2. **Drag-drop-compress** — Q3-report.pdf (24.8 MB) flies into the dropzone, circular gauge
   sweeps 0→100% "in your browser", result card slams **6.2 MB · −75%** while a live network
   mini-panel reads **0 B sent / 0 requests**. (Grounded: Compress PDF exact-target-size engine.)
3. **Zero-telemetry proof board** — full DevTools Network panel, empty request table, giant
   "0 B", pills: No analytics · No cookies · No fingerprinting (verbatim site copy).
4. **Airplane-mode flex** — Wi-Fi toggled off, slashed; six real tool tiles keep glowing
   "runs offline"; PWA install chip. (Grounded: public/sw.js cache-first + pwa-install.tsx.)

## Outro / punchline (final 6.4s)
Obsidian vignette → glowing **unqtools.pages.dev** → ❤️ lands on a deep sub-impact boom →
**"Built with ❤️ by Sandeep Gaddam"** (the product's own sidebar copy) with a pulsing
heartbeat glow (4 double-thumps), fade to black 59.2–60.0.

## User flow worth showing
Entry: hero search ("Search 1,679 tools…") → Key action: plain-language query + drag-drop a
PDF into Compress PDF → Result: −75% file, download button, network panel still at 0 B.
This flow IS the centerpiece (scenes S3–S5), per /brag's "show the working app" law.

## Tone
- Preset: `cinematic` (director brief: high-velocity product launch, obsidian glassmorphism,
  electric-violet + neon-teal rim lighting)
- Creative direction: "privacy heist trailer — the file that never left"
- Interpretation: big type, dramatic reveals, hard beat-locked cuts; restraint in copy
  (every on-screen product claim is verbatim from the repo), maximalism in motion + sound.

## Format: vertical — 1080x1920 · 30fps render (60fps-ready timeline) · 60.0s

## Visual identity
- Cinematic environment (director spec): obsidian `#0A0A0F` → `#12121A`, violet `#8B5CF6`, teal `#2DD4BF` rim
- Product truth (from `src/app/globals.css` dark theme): bg `#262624`, fg `#c3c0b6`,
  primary `#d97757`, gradient `#d97757 → #f2a35e` — the simulated browser chrome and every
  UnQTools UI surface use the REAL palette inside the obsidian stage
- Display/body font: Geist (+ Geist Mono for DevTools/terminal surfaces) — the site's own next/font families
- Strongest visual element: the hero search bar + trust-badge/stat-strip system from `home-page-client.tsx`

## Share copy (draft)
1,679 browser tools. Zero uploads. Watch the network tab — it stays at 0 B.
unqtools.pages.dev · Built with ❤️ by Sandeep Gaddam

## Audio direction
- Role: dense rhythmic layer (reel energy) under a master VO
- Music: **INGEST SLOT** `composition/assets/music/bgm-reel.mp3` — director spec: cyber-electronic/
  synthwave, tension riser → 808 sub-drop at 0:03 → driving pulse → ambient tail.
  **Bundled fallback shipped:** ende.app "Happy Beats vol-10" (60.00s, 109.96 BPM, punchy compact loop).
- Music treatment: bed 0.35 → sidechain-ducked to ≈0.12–0.15 (−12 dB) under VO by
  `scripts/ingest-audio.sh`; fade-in 0.4s, fade-out 1.6s
- Music cue guidance: bundled preset `assets/music/bgm-reel.music-cues.json` (vol-10).
  Strong-cue locks used: **3.01s** (drop/reveal, beat grid), **20.19s** (compress scene entry).
  Beat-grid windows: 4.10 / 5.19 / 6.82–7.35 / 12.02 / 33.19–35.37.
  If an external synthwave BGM is ingested, re-run `npx hyperframes beats composition/`
  (or `analyze_music_cues.py`) and re-snap the marked `// beat-locked:` moments.
- Audio-reactive treatment: subtle — orb glow + rim light may breathe with RMS once a real
  BGM is ingested (extraction delegated to hyperframes-creative at composition time)
- SFX posture: frame-accurate foley matrix (all CC0, bundled Kenney/OpenGameArt library):
  - mechanical keyboard clicks — `keyboard/keypress-0XX.wav` × 19, one per keystroke
  - suction pop on file land — `interface/drop_001.ogg` @ 22.20
  - crystal chime on completion — `impact/impactGlass_light_001/002.ogg` @ 25.60 / 26.00
  - airy swooshes on tab/scene transitions — `casino/card-slide-1.ogg`, `ui/switch11.ogg`
  - deep sub-impact boom on credit — `impact/impactBell_heavy_000.ogg` + `impactSoft_heavy_000.ogg` @ 55.80
- Audio-coupled moments: typing (per-character), gauge sweep, stat count-up, chip cascade, heartbeat outro
- Restraint rule: no SFX may mask the VO consonants; foley ≤ 0.85 vol; one boom per video

## Storyboard

### Scene 1 — HOOK "STOP." — 3.2s [0.0–3.2]
Upload glyph pulses red under "STOP." / "uploading your files to strangers' servers?".
Riser builds. Sequential/interaction: none. Audio intent: cold tension. Music: riser only.
Transition mood: **hard** (drop) → Scene 2

### Scene 2 — REVEAL — 9.0s [3.0–12.0]
Shockwave rings on the 3.01 drop → wordmark "UnQTools" → verbatim badge "1,679 free browser
tools — no signup, no tracking" → count-up 0→1,679 → stat chips 13 / 41.3K / 100% →
tagline "Private tools that respect you" (verbatim H1).
Sequential/interaction: yes — badge → counter → 3 stat chips (beat-grid 6.82/7.08/7.35).
Audio intent: payoff + scale. Transition mood: swoosh → Scene 3

### Scene 3 — SEARCH — 8.6s [12.0–20.6]
Arc-style browser frame (traffic lights, real tab title, lock + unqtools.pages.dev address).
Hero H1 + glass search bar; caret blinks; types "make my PDF smaller" (19 keystrokes,
15.60–18.46, click foley per char); spring dropdown: Compress PDF (hit) + Merge PDF; Enter flash.
Sequential/interaction: yes — live typing + autocomplete spring. Audio intent: tactile, precise.
Transition mood: tab-switch swoosh (strong cue 20.19) → Scene 4

### Scene 4 — DRAG · DROP · COMPRESS — 11.7s [20.3–32.0]
Compress PDF tool view. File chip "Q3-report.pdf · 24.8 MB" arcs into the dashed dropzone
(lands 22.20, pop foley, hot-zone flash). Target-size chips (1/3/6/10 MB/Custom — grounded
"5 presets + custom"); 6 MB selects. Circular gauge 0→100% (23.1–25.6) labeled "in your
browser"; result card "24.8 MB → 6.2 MB · −75%" + Download (chime 25.60/26.00); corner
network mini-panel "0 B sent · 0 requests" with steady green pulse.
Sequential/interaction: yes — drag-drop flight, gauge sweep, card slam.
Audio intent: momentum → crystalline payoff. Transition mood: hard cut → Scene 5

### Scene 5 — ZERO TELEMETRY — 7.4s [32.0–39.4]
Full DevTools Network panel: recording dot blinks, columns Name/Status/Size, empty table
"0 requests captured", giant teal "0 B transferred to any server". Pills land every other
beat (33.19/34.28/35.37): ✕ No analytics · ✕ No cookies · ✕ No fingerprinting (verbatim).
Caption: "Your data never leaves your device." (verbatim).
Sequential/interaction: yes — 3-pill beat-grid. Audio intent: clinical certainty.
Transition mood: soft → Scene 6

### Scene 6 — OFFLINE PWA — 7.4s [39.4–46.8]
"airplane mode · on" eyebrow; Wi-Fi card: toggle knob flips (40.00, switch foley), icon
slashed red. Six real tool tiles (Compress PDF, QR Generator, Password Generator, JSON
Formatter, HEIC→JPEG, BPM Detector) stay lit "runs offline". Green stamp "Still working."
(42.00). Install chip "⊕ Install UnQTools — works like an app" (43.20).
Sequential/interaction: yes — toggle flip + tile cascade. Audio intent: playful dare won.
Transition mood: clean → Scene 7

### Scene 7 — SCALE MONTAGE — 6.8s [46.8–53.6]
"13 categories · one toolbox" → 13 chips cascade 0.27s stagger (wide Developer 466 first;
PDF 305, Image 178, SEO 109, File 100, AI 100, Security 96, Text 83, Calculators 57,
Business 55, A/V 45, Education 45, Social 40 — all real counts), full set holds ≥ 2.5s.
Sequential/interaction: yes — chip cascade, first/last accented (restraint rule).
Audio intent: abundance. Transition mood: dramatic → Scene 8

### Scene 8 — OUTRO — 6.4s [53.6–60.0]
Glowing URL `unqtools.pages.dev` (54.2, teal bloom) → ❤️ + "Built with ❤️ by Sandeep
Gaddam" (55.8, SUB-IMPACT BOOM) with heartbeat glow pulses (56.2–59.4, 4 double-thumps)
→ pill "100% free · no signup · 1,679 tools" → fade to black 59.2–60.0.
Audio intent: resolution, warmth. End.

**Music mood for this video:** cyber-electronic cinematic (fallback: punchy upbeat corporate)
**Audio summary:** riser → drop-locked reveal → tactile typing/foley middle → chime payoff → one sub-boom under the heartbeat credit, VO always on top via −12 dB sidechain ducking.

## Voiceover script
See `voiceover-script.md` (timecoded, SSML-ready, 140 words @150 wpm) and
`voiceover-plain.txt` (TTS input). Ingest point: `composition/assets/voiceover/voiceover.wav`.

## Grounding audit (every factual on-screen claim → source)
| Claim | Source |
|---|---|
| 1,679 tools | `src/lib/counts.ts` TOOL_COUNT; hero copy `{toolCount} fast, free, offline-capable browser tools` |
| "no signup, no tracking" badge | hero badge verbatim, `home-page-client.tsx` |
| "Private tools that respect you" | hero H1 verbatim |
| 13 categories + counts | `CATEGORY_COUNTS` in `src/lib/counts.ts` |
| 41.3K tests / 100% privacy | hero stats strip verbatim |
| "make my PDF smaller" → Compress PDF | README v18.1 plain-language search |
| Compress PDF exact target size, 5 presets | README v18.2 (100x wave) |
| "Your data never leaves your device." | home privacy section verbatim |
| "No analytics, no cookies, no fingerprinting." | home privacy card verbatim |
| Works offline / installs like an app | `public/sw.js` (cache-first, offline fallback), `public/manifest.json` (display: standalone), `src/components/pwa-install.tsx` |
| "Built with ❤ by Sandeep Gaddam" | `src/components/navigation/sidebar.tsx` verbatim |
| 24.8→6.2 MB example | illustrative demo values consistent with README's exact-target-size capability (not a published benchmark) |

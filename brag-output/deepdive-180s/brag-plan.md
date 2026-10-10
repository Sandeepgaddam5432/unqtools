# Brag Plan: UnQTools — Deep Dive (180s, vertical)

> /brag creative contract, extended-duration run
> (`--duration 180 --format vertical --voice --tone cinematic`, direction: "architectural product showcase").
> The 15–25s default window is explicitly overridden by the director; the Hook → Reveal →
> Highlights → Outro grammar is preserved at feature length as a six-act structure.

## What is this app?
UnQTools — a 100% static, privacy-first, offline-capable PWA of **1,679 browser tools**
(13 categories) where PDF compression, image re-encoding, QR generation, barcode scanning
and password hashing all run on-device. No uploads, no accounts, no tracking, no telemetry.

## The angle
**"The architecture IS the product."** A three-minute documentary walk from the data-leak
problem, through the reveal, into the actual engineering (static hosting → client engines →
service worker → PWA), then a live flagship flow, then the receipts (41.3K tests, 7K PDF
tests, v18.7 waves). The proof isn't adjectives — it's an empty Network tab.

## Hook (first 3 seconds)
Noir cold open: your files — contract.pdf, photos.zip, tax-2025.pdf, bank-statement.csv —
float up out of a device and are swallowed by a red-glowing server rack labeled
"free tool site · uploads". First VO line: "Every file you upload to a free tool site is a
file you no longer control."

## Key moments (the middle)
1. **The Reveal (Act II)** — logo, verbatim hero copy card, live stat counters
   (1,679 / 13 / 41.3K / 100%), category constellation, READY NOW 1,133 counter, verbatim
   trust badges, and a fast live search demo ("make my PDF smaller" → Compress PDF).
2. **The Architecture (Act III)** — layer diagram (100% STATIC → CLIENT ENGINES
   pdf-lib·canvas·Web Audio·zxing·bcryptjs → YOUR DEVICE), live DevTools Network panel at
   0 B, real `public/sw.js` precache checklist ('/', '/manifest.json', '/logo.svg'),
   airplane-mode toggle, `requiresNetwork: false` code chip, promise card + installed-phone shot.
3. **The Flagship Flow (Act IV)** — Compress PDF drag-drop with exact target size (5 presets),
   4s gauge, before/after page thumbnails, −75% result, "60 PDF tools now beat iLovePDF ·
   SmallPDF · Sejda" board, PDF Page Manager's 7 real tabs, 26→1 mega-tool merge animation.
4. **The Receipts (Act V)** — 41,300-test counter, 7,000 PDF-test counter, v18.7 stamp,
   100x wave-rail lighting wave 1→6, wave-6 engine chips (redaction · repair · TTS · EPUB),
   READY NOW 1,133 + "fast · free · offline-capable" triad.

## Outro / punchline (final ~7.5s, staged from 172.4s)
Vignette gathers → glowing **unqtools.pages.dev** (174.2s) → ❤️ + **"Built with ❤️ by
Sandeep Gaddam"** land on a deep sub-impact boom (177.6s) → heartbeat glow pulses →
fade to black 179.0–180.0.

## User flow worth showing
Entry: plain-language search → Key action: drag-drop a 24.8 MB PDF into Compress PDF, pick
6 MB target → Result: 6.2 MB (−75%) download while the network panel reads 0 B. Shown twice:
compressed in Act II (search), full-length in Act IV (drag-drop-compress).

## Tone
- Preset: `cinematic` (documentary scale, trailer grammar)
- Creative direction: "privacy documentary — the empty network tab"
- Interpretation: six acts with slate titles, slower holds than the reel, big counters,
  restrained foley, one boom reserved for the credit.

## Format: vertical — 1080x1920 · 30fps render (60fps-ready timeline) · 180.0s

## Visual identity
- Cinematic environment (director spec): obsidian `#0A0A0F` → `#12121A`, violet `#8B5CF6`, teal rim `#2DD4BF`
- Product truth (from `src/app/globals.css`): `#262624` bg, `#c3c0b6` fg, `#d97757→#f2a35e` primary gradient — used for every simulated UnQTools surface
- Fonts: Geist / Geist Mono (the site's own families)
- Strongest visual element: the verbatim hero system (badge, H1, search bar, stats strip, trust badges) from `home-page-client.tsx`

## Share copy (draft)
Three minutes inside UnQTools: 1,679 browser tools, a service worker, and a Network tab
that never moves off 0 B. unqtools.pages.dev · Built with ❤️ by Sandeep Gaddam

## Audio direction
- Role: cinematic support under a continuous documentary VO
- Music: **INGEST SLOT** `composition/assets/music/bgm-deepdive.mp3` — director spec:
  synthwave score, tension riser → 808 sub-drop @0:03 → rhythmic driving pulse → ambient
  reverb tail, full 3:00. **Bundled fallback shipped:** ende.app vol-1 (163.96s, 120.19 BPM),
  data-fade-out 5s — music resolves at ~164s and the receipts/outro ride VO + foley +
  heartbeat as the "ambient tail" until a full-length score is ingested.
- Music treatment: bed 0.34, fade-in 0.5 / fade-out 5; `scripts/ingest-audio.sh` applies
  −12 dB sidechain ducking under VO and loudness matching
- Music cue guidance: bundled preset `assets/music/bgm-deepdive.music-cues.json` (vol-1,
  120.19 BPM; planning window 0–25s). Strong-cue locks used: **16.02s** ("The tool is
  free." title), **17.52s** ("The data is the product."), **20.02s** (retention slots).
  Beat-grid: **34.47s** (Act II logo). Cues beyond 25s: detect after BGM ingest via
  `npx hyperframes beats composition/` or `analyze_music_cues.py`, then re-snap marked moments.
- Audio-reactive treatment: subtle — orb/rim glow breathe with RMS once real BGM is ingested
- SFX posture: moderate density, motion-matched (≈100 clips wired): file-ghost drops,
  slate impacts, chips-stack counter ticks, 19+19 keystrokes (Acts II), switch on airplane
  toggle, glitch micro-accent on code chips, glass chimes on compress completion, plate on
  v18.7 stamp, one card-shuffle riser for the 26→1 merge, ONE sub-impact boom (credit)
- Restraint rule: foley never above 0.85; no SFX within 200ms of a VO line ending; Act III/V
  stay sparse — the counters and silence do the work

## Storyboard

### Act I — THE LEAK — 34.6s [0.0–34.6]
Rack + 4 rising file ghosts (uploaded ✓ ticks) → "YOUR FILES." / "THEIR SERVERS." title
slams (10.0/12.5) → "The tool is free." (16.02 beat-lock) / "The data is the product."
(17.52) → retention slot-machine (20.02) → question + device-safe glow (28.5).
Sequential/interaction: files rise one-by-one. Audio intent: noir dread → turn.
Transition mood: swoosh (33.8) → Act II

### Act II — THE REVEAL — 39.4s [34.2–73.6]
Logo (34.4 beat-grid) → verbatim badge → verbatim hero-copy card → 4 stat counters
(chips-stack ticks) → 13-tile constellation + READY 1,133 counter → type cards + 10× stamp
(60.8 plate) → verbatim H1 + 4 trust pills → compact browser search demo (19 keystrokes
69.8–72.1, spring dropdown 72.4, Enter 72.8).
Sequential/interaction: counters, tile cascade, live typing. Audio intent: warm awe.
Transition: slate impact → Act III

### Act III — THE ARCHITECTURE — 46.4s [73.2–119.6]
ARCHITECTURE slate → 3 layer cards slide in on their VO lines (76.2/80.7/84.5) + dependency
chips → live DevTools panel, 0 B, annotation chips → real sw.js card, precache checklist
✓✓✓ (94.0/94.9/95.8), cache-first line → airplane toggle (101.6) + OFFLINE pill → zero-
telemetry pills + `requiresNetwork: false` glitch chip → promise card + installed phone.
Sequential/interaction: layer build, checklist ticks, toggle. Audio intent: precision.
Transition: clean → Act IV

### Act IV — THE FLAGSHIP FLOW — 35.2s [119.2–154.4]
Compress PDF: chip flight (lands 120.8 pop) → preset chips, 6 MB select → 4s gauge →
thumbs before→after → −75% result (chime 126.5/128.2) → `engine: your CPU` chip → 0 B
mini-panel → "60 PDF tools beat…" board + rivals ✓✓✓ + feature ticks → Page Manager 7 real
tabs cascade (144.0–147.7, click ticks) → 26 minis converge (shuffle riser 149.6) → mega-card
boom (151.0).
Sequential/interaction: the full working flow. Audio intent: momentum → payoff.
Transition: hard → Act V

### Act V — THE RECEIPTS — 20.6s [154.0–174.6]
THE RECEIPTS slate → 0→41,300 counter → 0→7,000 teal counter → v18.7 stamp (plate 165.2)
→ wave-rail 1→6 lights (166.0–169.0, ticks) → wave-6 engine chips → 0→1,133 ready counter
→ triad pills. Sequential/interaction: counters + rail. Audio intent: weight of evidence.
Transition: vignette gather → Act VI

### Act VI — OUTRO — 7.6s [172.4–180.0]
Glowing URL (174.2, teal bloom) → ❤️ + "Built with ❤️ by Sandeep Gaddam" on the SUB-IMPACT
BOOM (177.6) → heartbeat glow ×3 → pill "1,679 tools · 100% private · free" → fade to black.
Audio intent: reverence, resolution. End.

**Music mood for this video:** synthwave documentary (fallback: warm upbeat corporate)
**Audio summary:** noir riser → beat-locked Act I titles → warm reveal with counter ticks →
sparse precision in the architecture act → driving foley in the flow → evidence ticks →
music resolves at 164s → VO + heartbeat + one final boom carry the credit home.

## Voiceover script
`voiceover-script.md` (timecoded + SSML, 421 words @150 wpm) · `voiceover-plain.txt` (TTS input).
Ingest point: `composition/assets/voiceover/voiceover.wav` (see VO-INGEST.md there).

## Grounding audit (every factual on-screen claim → source)
| Claim | Source |
|---|---|
| 1,679 tools · 13 categories · per-category counts | `src/lib/counts.ts` |
| READY NOW 1,133 · 26→1 PDF Page Manager merge · 301 redirects | README v18.1 / v18.0 |
| "fast, free, offline-capable… No uploads, no accounts, no tracking." | hero sub-copy verbatim, `home-page-client.tsx` |
| "Private tools that respect you" | hero H1 verbatim |
| "1,679 free browser tools — no signup, no tracking" | hero badge verbatim |
| Trust badges: 100% Client-Side / Works Offline / No Sign-up / No Tracking | `trustBadges` array verbatim |
| Stats strip: Tools / Categories / Tests 41.3K / Privacy 100% | `stats` array verbatim |
| "make my PDF smaller" → Compress PDF; "join two pdfs" → Merge PDF | README v18.1 |
| Compress PDF exact target size · 5 presets · batch + ZIP · in-browser image re-encoding | README v18.2 |
| "60 PDF tools now beat iLovePDF / SmallPDF / Sejda" | README v18.7 headline |
| Page Manager 7 tabs (Delete/Extract/Duplicate/Insert/Reorder/Rotate/Reverse) + hints | `src/tools/pdf/pdf-page-manager/ui.tsx` TABS verbatim |
| 7,000 PDF tests · v18.7 · wave 6 engines (redaction, repair, TTS, EPUB) | STATE.md v18.7 |
| 100x waves 1–6 | README v18.2–v18.7 |
| sw.js precache ['/', '/manifest.json', '/logo.svg'] · cache-first · offline navigate fallback | `public/sw.js` verbatim |
| installable standalone PWA | `public/manifest.json` (display: standalone), `pwa-install.tsx` |
| `requiresNetwork: false` | tool manifest field, e.g. `src/tools/file/7z-extractor/manifest.ts` |
| client engines: pdf-lib · canvas · Web Audio · zxing · bcryptjs | `package.json` deps + tool implementations |
| "What you do with the tools stays between you and your browser." | home privacy card verbatim |
| "No analytics, no cookies, no fingerprinting." | home privacy card verbatim |
| "Built with ❤ by Sandeep Gaddam" | `src/components/navigation/sidebar.tsx` verbatim |
| 24.8→6.2 MB demo values | illustrative, consistent with exact-target-size capability |
| Act I "free tool site" server/retention framing | creative framing (asserts nothing about UnQTools) — allowed per /brag grounding rules |

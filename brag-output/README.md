# UnQTools × /brag — Cinematic Video Pipeline

Two publication-ready vertical videos (9:16 · 1080×1920), built on the repo-vendored
**brag** suite (`brag/skills/brag/`) and its **Hyperframes** render backend:

| Project | Output file | Runtime | Character |
|---|---|---|---|
| `reel-60s/` | `UnQTools_Viral_Reel_60s.mp4` | 60.0s | high-velocity product launch (cinematic, beat-locked) |
| `deepdive-180s/` | `UnQTools_DeepDive_3min.mp4` | 180.0s | six-act architectural product showcase (documentary) |

Both carry: master VO track (−12 dB sidechain-ducked BGM under narration), cyber-electronic
BGM ingest slot (bundled fallback pre-wired), frame-accurate foley (mechanical keystrokes,
suction-pop file drop, crystal completion chimes, transition swooshes, one deep sub-impact
boom on the credit), and the mandated outro — glowing `unqtools.pages.dev` +
**"Built with ❤️ by Sandeep Gaddam"** with pulsing heartbeat glow.

```
brag-output/
├── README.md                  ← you are here (pipeline + render commands)
├── scripts/
│   ├── prepare-assets.sh      ← make both compositions render-ready (silent VO placeholders)
│   └── ingest-audio.sh        ← install external VO/BGM: −16 LUFS VO + −12 dB sidechain duck
├── reel-60s/
│   ├── brag-plan.md           ← /brag step-2 creative contract (+ grounding audit)
│   ├── composition-brief.md   ← /brag step-3 Hyperframes handoff brief
│   ├── voiceover-script.md    ← STUDIO SCRIPT: timecodes, phonetics, tone markers, SSML
│   ├── voiceover-plain.txt    ← TTS input (140 words @150 wpm)
│   ├── share-copy.txt         ← /brag step-4 caption
│   └── composition/           ← Hyperframes project (index.html timeline + styles.css + assets/)
│       └── assets/
│           ├── music/bgm-reel.mp3        ← INGEST SLOT (fallback: bundled ende.app vol-10, 60s/110BPM)
│           ├── voiceover/voiceover.wav   ← INGEST SLOT (see VO-INGEST.md)
│           └── sfx/{keyboard,interface,ui,impact,casino}/  ← selected CC0 foley
└── deepdive-180s/             ← same structure (bgm-deepdive.mp3 fallback: vol-1, 164s/120BPM)
```

## Pipeline status

- [x] Stage 1 — repo audit (brag engine + UnQTools metrics), VO scripts for both videos
- [x] Stage 2 — compositions implemented (picture-lock), foley wired, music/VO ingest slots live
- [ ] Audio ingest — external VO synthesis (+ optional synthwave BGM) → `ingest-audio.sh`
- [ ] Render — requires **FFmpeg + Chrome Headless Shell** (`npx hyperframes doctor` to verify)

> This sandbox has neither FFmpeg nor Chrome, so final renders execute on a machine that has
> them (your dev box / CI). Everything else is done and deterministic.

## Render commands (exact)

```bash
cd <repo-root>            # /path/to/unqtools

# 0) environment gate (one-time): needs Node 22+, FFmpeg, Chrome Headless Shell
npx hyperframes doctor
npx hyperframes browser ensure        # installs the headless Chrome used for rendering

# 1) make both compositions render-ready (silent VO placeholders if not ingested yet)
bash brag-output/scripts/prepare-assets.sh

# 2) synthesize the voiceovers — EITHER locally with brag's Kokoro TTS:
npx hyperframes tts brag-output/reel-60s/voiceover-plain.txt \
  --voice af_heart --output brag-output/reel-60s/composition/assets/voiceover/voiceover.wav
npx hyperframes tts brag-output/deepdive-180s/voiceover-plain.txt \
  --voice af_heart --output brag-output/deepdive-180s/composition/assets/voiceover/voiceover.wav
#    — OR externally (ElevenLabs/Azure/studio) using voiceover-script.md's SSML master,
#      then ingest with loudness + ducking:
bash brag-output/scripts/ingest-audio.sh reel-60s      /path/to/reel-vo.wav      [/path/to/synthwave-60s.mp3]
bash brag-output/scripts/ingest-audio.sh deepdive-180s /path/to/deepdive-vo.wav  [/path/to/synthwave-180s.mp3]

# 3) optional: re-snap beat locks if you ingested a custom BGM
npx hyperframes beats brag-output/reel-60s/composition
npx hyperframes beats brag-output/deepdive-180s/composition

# 4) the single pre-render gate (/brag step 4) — fix every error it reports
cd brag-output/reel-60s/composition      && npm run check
cd ../../deepdive-180s/composition       && npm run check

# 5) optional visual gut-check
npm run dev                               # Studio preview → http://localhost:… (per CLI output)

# 6) final renders (high quality → the deliverable filenames)
cd brag-output/reel-60s/composition      && npm run render     # → ../UnQTools_Viral_Reel_60s.mp4
cd ../../deepdive-180s/composition       && npm run render     # → ../UnQTools_DeepDive_3min.mp4

# 7) posters (best settled frames) + bake as frame 0 (brag step-4 ritual)
cd brag-output/reel-60s
ffmpeg -ss 5.9  -i UnQTools_Viral_Reel_60s.mp4 -frames:v 1 -q:v 2 poster.jpg
cd ../deepdive-180s
ffmpeg -ss 36.5 -i UnQTools_DeepDive_3min.mp4  -frames:v 1 -q:v 2 poster.jpg
# bake (each dir):
ffmpeg -y -i <video>.mp4 -i poster.jpg \
  -filter_complex "[0:v][1:v]overlay=0:0:enable='eq(n,0)'[v]" \
  -map "[v]" -map "0:a?" -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p \
  -c:a copy -movflags +faststart poster.mp4 && mv poster.mp4 <video>.mp4
```

## Design + sound matrix (as directed)

- **Background:** obsidian glassmorphism `#0A0A0F`→`#12121A`, electric-violet `#8B5CF6` key,
  neon-teal `#2DD4BF` rim; every simulated UnQTools surface uses the product's REAL dark
  palette (`#262624`/`#c3c0b6`/`#d97757→#f2a35e`, Geist) so all UI is grounded truth.
- **Browser interactions:** macOS/Arc-style frame (traffic lights, active-tab transitions,
  lock-icon address bar) · keystroke-accurate search typing with spring-physics autocomplete ·
  drag-and-drop file flight + circular processing gauge + instant zero-upload output ·
  live Network-inspector panels pinned at **0 B / 0 requests**.
- **3-track audio:** VO (track 20) over sidechain-ducked BGM (track 10) + foley (tracks 30+):
  mechanical keyboard clicks per keystroke · airy swooshes on transitions · suction pop on
  drop · crystal chime on completion · deep sub-impact boom on the credit card.
- **Outro (both):** centered glowing `unqtools.pages.dev` → ❤️ + "Built with ❤️ by Sandeep
  Gaddam" (the site's own sidebar copy) with pulsing heartbeat glow → fade to black.

## Honesty notes (audit-driven deviations, on purpose)

1. **1,679 — not "1700+".** `src/lib/counts.ts` (`TOOL_COUNT = 1679`; v18 merged 26 PDF
   tools: 1704→1679). /brag's grounding law forbids invented numbers; the exact figure is
   also the site's own hero copy and hits harder.
2. **"WebAssembly gauge" → "100% in your browser" gauge.** The catalog is overwhelmingly
   pure-JS engines (pdf-lib, canvas, zxing, Web Audio); WASM appears only in niche tools.
   The gauge copy uses the hero's verbatim claim instead of an ungrounded WASM one.
3. **BGM fallbacks** are the bundled CC-licensed ende.app tracks (not synthwave). The
   director's synthwave spec is an ingest slot — drop any track in via `ingest-audio.sh`
   (it loops/pads/ducks automatically); the reel fallback is exactly 60.00s.

---

## Sandbox / no-Chrome render recipe (used 2026-10-10, fully executed in-repo)

The render farm in this sandbox had **no FFmpeg, no Chrome, apt/playwright/GCS all blocked** (only
`registry.npmjs.org`, `pypi.org`, `github.com`, `codeload.github.com`, `api.github.com` reachable).
Everything was solved with allowed hosts only:

1. **FFmpeg/FFprobe** → npm-bundled statics: `npm i @ffmpeg-installer/ffmpeg @ffprobe-installer/ffprobe`,
   symlinked into `~/.local/bin`.
2. **Chrome 152** → `npm pack @sparticuz/chromium@152.0.0` (registry tarball ships `bin/chromium.br`
   = Chromium **152.0.7977** brotli + `al2023.tar.br` nss/nspr libs + swiftshader + fonts).
   Extract with Node `zlib.brotliDecompressSync`, `chmod +x`, put swiftshader `.so` beside the binary,
   then wrapper `/tmp/chrome152-wrapper`:
   `LD_LIBRARY_PATH=<al2023/lib> exec <chromium> --no-sandbox --disable-dev-shm-usage --disable-gpu --disable-software-rasterizer --in-process-gpu --disable-features=Vulkan "$@"`
3. **Render**: `export PATH=~/.local/bin:$PATH HYPERFRAMES_BROWSER_PATH=/tmp/chrome152-wrapper`
   then `npm run render` per composition (2-core box → low-memory profile, 1 worker, screenshot
   capture: reel 1800 frames ≈ 9 min, deep-dive 5400 frames ≈ 27 min).
4. **VO**: synthesized in-session (Arena TTS voice-00), measured ~126 wpm → `atempo≈1.126` re-calibrated
   to the 150 wpm timecodes (reel 59.60 s, deep-dive 179.91 s incl. 0.2 s/0.5 s lead-in), then
   `scripts/ingest-audio.sh <proj> <master.wav>` (−16 LUFS VO, −12 dB sidechain-ducked BGM).
5. **Hermetic compositions**: GSAP 3.14.2 + Geist/Geist-Mono variable fonts vendored at
   `assets/vendor/` (no CDN at render time) — fonts.css + gsap.min.js referenced relatively.

`hyperframes check` gates used: layout overlap/occlusion errors must be 0 (dz-hot glow now exits
before the file chip lands; −75% badge yields its corner to the network proof), contrast ≥ 4.5:1
(`--faint` raised to `#7e7e88`, save-span `#9c9a91`).

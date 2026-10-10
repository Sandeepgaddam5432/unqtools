# Hyperframes Composition Brief — UnQTools Flagship Film (180s)

## Objective
Premium vertical product launch film; narrated; separate composition from baseline & 1-min reel.
Storyboard: `storyboard.md` (creative contract). Narration script: `narration-script.md`.

## Output
- Composition: `composition/` · Render: `video-3min.mp4` · Poster: `poster.jpg`
- Vertical 1080x1920 · 30 FPS · 180s

## Verified claims (source)
- 1,679 tools / 13 categories — `src/lib/counts.ts` + live site.
- 1,172 status:"done" in `src/lib/catalog.ts` → on-screen "1,100+ ready now".
- 41.3K tests, 100% privacy stat row — live home page.
- Hero "Private tools that respect you"; sub "1679 fast, free, offline-capable browser tools — …";
  badges "100% Client-Side / Works Offline / No Sign-up / No Tracking".
- Task cards (6) verbatim from live home "What do you want to do?" section.
- Tool demos mirror real tools: json-formatter (Format/Minify/Validate, real sample subset),
  password-generator (Random/EFF/Pronounceable modes), qr-code-generator-image (real QR asset),
  compress-pdf (5 presets Low/Medium/High/Very high/Extreme), color-picker, word-character-counter.
- Offline: `public/sw.js` + `public/manifest.json` (display standalone) → "Works offline", "Install as app".
- Privacy: 100% static, no backend (AGENTS.md non-negotiables) → "Nothing leaves your browser".

## Visual identity
Same film grammar: #262624/#1b1b19 charcoal, #faf9f5 cream, #d97757/#b5562d terracotta,
#34d399 green, lavender→pink gradient headline, Geist + Geist Mono local, rounded cards/chips,
real logo.svg, real QR svg.

## Audio
- VO: assets/voice/vo-01..10.mp3 (voice-00), data-starts 0.6/10.6/25.3/45.5/61.5/77.5/92.5/108.5/130.5/171.8.
- Music: vol1.mp3 0–157 (automation duck 0.85↔0.35 around VO, fade 155.5–157); vol9.mp3 @155–180 (fade in 155–156.5, out 178.5–180).
- Beat-locks: logo 8.0 (vol-1 strong 8.02), ready-slam 147.5, montage cuts 156.07/158.7/161.34/164.5/167.13/169.76 (vol-9 strongCues) — commented // beat-locked.
- Beat-grid: tab ticks 0.27/1.37/2.46; task cards 34.0–36.5 alternating; category tiles stagger.
- SFX sparse per storyboard; audio-reactive subtle glow from extracted RMS (2 Hz).

## Hyperframes Instructions
Core/animation/creative/keyframes/cli; root data-duration 180; local @font-face; no <br> body
text; clips own timing; unique ids; check → 0 errors → render --quality high; poster at settled
CTA beat.

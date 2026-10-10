# VOICEOVER INGESTION POINT — UnQTools Deep Dive (180s)

## Expected file

```
assets/voiceover/voiceover.wav    ← THE composition references exactly this path
```

The timeline (`index.html`, `<audio id="vo">`) already points at
`assets/voiceover/voiceover.wav` on track-index 20 at data-start 0, full 180s.
Drop the file in and render — no code changes needed.

## Spec

| Property | Value |
|---|---|
| Duration | ≤ 180.0s (script's last word resolves by 179.9s) |
| Format | WAV, 48 kHz, 16/24-bit, mono or stereo |
| Loudness | −16 LUFS integrated (long-form social), true peak ≤ −1 dB |
| Voice | Documentary narrator, warm + precise. Kokoro `af_heart` is the /brag default. |
| Script | `../../voiceover-script.md` — SSML + plain-text, timecoded per line, per act |

## Ways to produce it

1. **Hyperframes Kokoro TTS (brag-native, local):**
   ```bash
   npx hyperframes tts ../../voiceover-plain.txt --voice af_heart --output voiceover.wav
   ```
2. **External studio TTS** (ElevenLabs / Azure / Play.ht / OpenAI TTS): paste the SSML
   master from `voiceover-script.md`, export per spec, rename to `voiceover.wav`, drop here.
   Long-form tip: synthesize per-act (6 files), concatenate in order, verify total ≤ 180.0s.
3. **Human VO artist:** hand them `voiceover-script.md`.

## Helper scripts (repo root)

- `brag-output/scripts/prepare-assets.sh` — writes a silent 180s placeholder
  `voiceover.wav` if none exists (renders stay valid pre-ingest).
- `brag-output/scripts/ingest-audio.sh <vo.wav> [bgm.mp3]` — loudness-normalizes VO to
  −16 LUFS, sidechain-ducks BGM −12 dB under narration, installs both into this folder.

## Timing flex

If the synthesized read runs long/short, scene `data-duration`s flex ±0.5s per act —
adjust the six act sections in `index.html` (brag rule: never stretch the video past
its window to fit narration; re-time visuals instead).

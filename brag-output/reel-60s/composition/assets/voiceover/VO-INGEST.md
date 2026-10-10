# VOICEOVER INGESTION POINT — UnQTools Viral Reel (60s)

## Expected file

```
assets/voiceover/voiceover.wav    ← THE composition references exactly this path
```

The timeline (`index.html`, `<audio id="vo">`) already points at
`assets/voiceover/voiceover.wav` on track-index 20 at data-start 0, full 60s.
Drop the file in and render — no code changes needed.

## Spec

| Property | Value |
|---|---|
| Duration | ≤ 60.0s (target speech ends 59.6s; last 0.4s is silence) |
| Format | WAV, 48 kHz, 16/24-bit, mono or stereo |
| Loudness | −16 LUFS integrated (reel/social target), true peak ≤ −1 dB |
| Voice | Warm, punchy, cinematic-trailer delivery. Kokoro `af_heart` is the /brag default. |
| Script | `../../voiceover-script.md` — SSML + plain-text versions, timecoded per line |

## Ways to produce it

1. **Hyperframes Kokoro TTS (brag-native, local):**
   ```bash
   npx hyperframes tts "../../voiceover-plain.txt" --voice af_heart --output voiceover.wav
   ```
   (run from this directory; `voiceover-plain.txt` sits next to this folder's parent — see below)

2. **External studio TTS** (ElevenLabs / Azure / Play.ht / OpenAI TTS): paste the SSML
   block from `voiceover-script.md`, export WAV per the spec above, rename to
   `voiceover.wav`, drop here.

3. **Human VO artist:** hand them `voiceover-script.md` — it carries timestamps,
   phonetics ("UnQTools" = Un-Q-Tools), tone markers and break cues.

## Helper scripts (repo root)

- `brag-output/scripts/prepare-assets.sh` — creates a silent placeholder
  `voiceover.wav` if none exists yet (renders stay valid pre-ingest).
- `brag-output/scripts/ingest-audio.sh <vo.wav> [bgm.mp3]` — loudness-normalizes
  the VO to −16 LUFS, sidechain-ducks the BGM −12 dB under it, and installs both
  into this folder.

## Placeholder policy

Until a real VO is ingested, `prepare-assets.sh` writes digital silence at the
exact expected path so `hyperframes check` and `render` never fail on a missing
asset. A render with the placeholder = picture-lock preview with music + SFX only.

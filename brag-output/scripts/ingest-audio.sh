#!/usr/bin/env bash
# ============================================================
# ingest-audio.sh — install externally-synthesized audio into a
# brag composition, broadcast-style.
#
#   Track 1 (VO)  → loudness-normalized to −16 LUFS, true peak ≤ −1 dB
#   Track 2 (BGM) → sidechain-compressed −12 dB under the VO (dynamic
#                   ducking), then installed as the composition's bgm file
#
# Usage:
#   bash brag-output/scripts/ingest-audio.sh reel-60s      /path/to/vo.wav [/path/to/bgm.mp3]
#   bash brag-output/scripts/ingest-audio.sh deepdive-180s /path/to/vo.wav [/path/to/bgm.mp3]
#
# Needs: ffmpeg + ffprobe on PATH (same requirement as Hyperframes render).
# If no BGM is given, the bundled fallback stays and only the VO is installed.
# ============================================================
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="$ROOT/brag-output"

say() { printf '\033[1;35m[ingest]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[ingest] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

PROJ="${1:-}"; VO_IN="${2:-}"; BGM_IN="${3:-}"
case "$PROJ" in reel-60s) DUR=60;; deepdive-180s) DUR=180;; *) die "project must be reel-60s | deepdive-180s";; esac
[ -n "$VO_IN" ] && [ -f "$VO_IN" ] || die "voiceover file not found: '${VO_IN:-<missing>}'"
command -v ffmpeg >/dev/null || die "ffmpeg not on PATH (also required by hyperframes render)"
command -v ffprobe >/dev/null || die "ffprobe not on PATH"

COMP="$OUT/$PROJ/composition"
VO_DIR="$COMP/assets/voiceover"
MUS_DIR="$COMP/assets/music"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# ---- duration guard ----
VDUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$VO_IN")
say "VO input: $VO_IN (${VDUR}s, window ${DUR}s)"
python3 -c "import sys; sys.exit(0 if float('$VDUR') <= float('$DUR') + 0.25 else 1)" \
  || die "VO is longer than the ${DUR}s window — trim the script and re-synthesize (do not stretch the video)"

# ---- Track 1: normalize VO → −16 LUFS, TP ≤ −1 dB, 48 kHz ----
say "loudness-normalizing VO → −16 LUFS"
ffmpeg -y -v error -i "$VO_IN" -af \
  "loudnorm=I=-16:TP=-1.0:LRA=11,aformat=sample_rates=48000:channel_layouts=stereo" \
  "$TMP/vo_norm.wav"
cp "$TMP/vo_norm.wav" "$VO_DIR/voiceover.wav"
say "installed → $VO_DIR/voiceover.wav"

# ---- Track 2: BGM (optional) — sidechain duck −12 dB under VO ----
BGM_FILE=$(ls "$MUS_DIR"/bgm-*.mp3 2>/dev/null | head -1 || true)
[ -n "$BGM_FILE" ] || die "no bgm-*.mp3 in $MUS_DIR (run prepare-assets.sh first)"

if [ -n "$BGM_IN" ] && [ -f "$BGM_IN" ]; then
  say "external BGM given → installing as $(basename "$BGM_FILE")"
  cp "$BGM_IN" "$TMP/bgm_src.mp3"
else
  say "no external BGM → ducking the bundled fallback"
  cp "$BGM_FILE" "$TMP/bgm_src.mp3"
fi

BDUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$TMP/bgm_src.mp3")
say "BGM source: ${BDUR}s"

# sidechaincompress: VO is the key; music ducks ~−12 dB (ratio 8, low threshold),
# fast attack, musical release; loop/pad BGM to the full window, then fade edges.
say "applying −12 dB sidechain ducking under VO"
ffmpeg -y -v error \
  -stream_loop -1 -i "$TMP/bgm_src.mp3" -i "$VO_DIR/voiceover.wav" \
  -filter_complex "\
[0:a]atrim=0:${DUR},asetpts=PTS-STARTPTS[bg];\
[bg][1:a]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=350:makeup=1[ducked];\
[ducked]afade=t=in:st=0:d=0.5,afade=t=out:st=$(python3 -c "print(${DUR}-1.6)"):d=1.6,\
loudnorm=I=-24:TP=-2.0:LRA=9,aformat=sample_rates=48000:channel_layouts=stereo[out]" \
  -map "[out]" "$TMP/bgm_ducked.wav"

# install as mp3 alongside (keeps composition src= paths untouched)
ffmpeg -y -v error -i "$TMP/bgm_ducked.wav" -codec:a libmp3lame -qscale:a 2 "$BGM_FILE"
say "installed (ducked) → $BGM_FILE"

say "Done. Render: cd $COMP && npm run check && npm run render"

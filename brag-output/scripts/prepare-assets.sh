#!/usr/bin/env bash
# ============================================================
# prepare-assets.sh — make both brag compositions render-ready
# Idempotent. Safe to re-run any time.
#
#   1. Verifies bundled fallback BGM + SFX are in place
#   2. Creates SILENT placeholder voiceover.wav files when no
#      real VO has been ingested yet (so `hyperframes check`
#      and `render` never fail on a missing asset)
#
# Usage:  bash brag-output/scripts/prepare-assets.sh
# Needs:  python3 (for the silent WAV writer — no ffmpeg required)
# ============================================================
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="$ROOT/brag-output"
SK="$ROOT/brag/skills/brag/assets"

say() { printf '\033[1;36m[prepare]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[prepare] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

[ -d "$SK/music" ] || die "bundled brag assets not found at $SK"

silent_wav() { # path seconds
  python3 - "$1" "$2" << 'PY'
import sys, wave, struct
path, secs = sys.argv[1], float(sys.argv[2])
with wave.open(path, "w") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(48000)
    chunk = struct.pack("<%dh" % (2 * 4800), *([0] * (2 * 4800)))  # 0.1s stereo silence
    for _ in range(int(secs * 10)):
        w.writeframes(chunk)
PY
}

for P in "reel-60s:60" "deepdive-180s:180"; do
  PROJ="${P%%:*}"; DUR="${P##*:}"
  COMP="$OUT/$PROJ/composition"
  say "── $PROJ (${DUR}s) ──"
  [ -f "$COMP/index.html" ] || die "missing $COMP/index.html"

  # BGM fallback present?
  BGM=$(ls "$COMP"/assets/music/bgm-*.mp3 2>/dev/null | head -1 || true)
  if [ -z "$BGM" ]; then
    say "  BGM missing → copying bundled fallback"
    if [ "$PROJ" = "reel-60s" ]; then
      cp "$SK/music/happy-beats-business-moves-vol-10-by-ende-dot-app.mp3" "$COMP/assets/music/bgm-reel.mp3"
    else
      cp "$SK/music/happy-beats-business-moves-vol-1-by-ende-dot-app.mp3" "$COMP/assets/music/bgm-deepdive.mp3"
    fi
  else
    say "  BGM ok: $(basename "$BGM")"
  fi

  # SFX sanity (keyboard clicks are the densest dependency)
  NKB=$(ls "$COMP"/assets/sfx/keyboard/keypress-*.wav 2>/dev/null | wc -l)
  [ "$NKB" -ge 8 ] || die "keyboard SFX missing in $COMP/assets/sfx/keyboard (found $NKB)"
  say "  SFX ok ($NKB keypress files + families)"

  # VO placeholder
  VO="$COMP/assets/voiceover/voiceover.wav"
  if [ -f "$VO" ]; then
    SZ=$(wc -c < "$VO")
    if [ "$SZ" -lt 100000 ]; then
      say "  VO is the silent placeholder — render will be music+SFX only (ingest real VO via ingest-audio.sh)"
    else
      say "  VO ingested ✓ ($(du -h "$VO" | cut -f1))"
    fi
  else
    silent_wav "$VO" "$DUR"
    say "  wrote silent placeholder VO (${DUR}s) → $VO"
  fi
done

say "Done. Next: bash brag-output/scripts/ingest-audio.sh <vo.wav> [<bgm.mp3>]  (per project)"

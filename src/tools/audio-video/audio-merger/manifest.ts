import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "audio-merger",
  name: "Audio Merger",
  description:
    "Merge multiple audio files into one continuous file entirely in the browser. Drag-and-drop an ordered list, decode each via Web Audio API, auto-unify sample rate and channel count, then concatenate with optional silence gap (6 presets) or linear crossfade (6 presets). Re-encode as 16-bit PCM WAV (pure-JS RIFF encoder — no library). Sample-rate unifier, channel upmixer, linear resampler, silence gap generator, crossfade calculator + applier, buffer concatenator, total-duration calculator, file-size estimator, timestamped filename, history (localStorage), shareable URL, summary stats, drag-and-drop + segment reordering. 100% client-side.",
  category: "audio-video",
  keywords: [
    "audio merger", "merge audio", "combine audio",
    "concatenate audio", "join audio", "audio joiner",
    "crossfade", "gap audio", "wav encoder",
    "audio editor", "pcm", "riff",
  ],
  icon: "combine",
  requiresNetwork: false,
  seo: {
    title: "Audio Merger — Combine Audio Files Online (Gap / Crossfade) | UnQTools",
    faq: [
      {
        q: "How does the audio merger work?",
        a: "Drop or pick multiple audio files. Each file is decoded with the Web Audio API into raw PCM samples per channel. We auto-detect the maximum sample rate and channel count across all files, resample and upmix each to that common format, then concatenate the segments — either with a silence gap (insert N ms of zeros between segments) or a linear crossfade (overlap the end of one segment with the start of the next, fading out A and fading in B). The output is re-encoded as a 16-bit PCM WAV with a pure-JS RIFF encoder.",
      },
      {
        q: "What if my files have different sample rates?",
        a: "The tool auto-detects the maximum sample rate across all files and linearly resamples each file to that rate before merging. Linear interpolation is used — sufficient for joining voice memos and music clips. Channel counts are unified the same way (mono files are upmixed to stereo by duplicating the channel when joining with a stereo file).",
      },
      {
        q: "What gap and crossfade presets are available?",
        a: "Gap presets: 0 ms (none), 100 ms, 250 ms, 500 ms, 1 s, 2 s. Crossfade presets: 0 ms (none), 50 ms, 100 ms, 250 ms, 500 ms, 1 s. If a crossfade > 0 ms is selected, gaps are skipped — the segments overlap by the crossfade duration. If crossfade is 0 and a gap > 0 ms is selected, silence is inserted between segments.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Multi-file ordered list with drag-and-drop. (2) Auto sample-rate unifier (max). (3) Auto channel unifier (max) with upmix. (4) Linear resampler. (5) Silence gap generator (6 presets). (6) Crossfade calculator (6 presets). (7) Linear crossfade applier. (8) Buffer concatenator (gap or crossfade). (9) Total-duration calculator. (10) File-size estimator. (11) Pure-JS 44-byte RIFF WAV encoder (16-bit PCM). (12) Timestamped filename generator. (13) History (localStorage, last 20). (14) Shareable URL settings. (15) Summary stats (segments, total duration, gap/crossfade counts, output size). (16) Segment reordering (move up/down in list).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. The audio files you load, decoded samples, and output WAV never leave your browser. There is no upload. Merge metadata in history is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "audio-splitter",
  name: "Audio Splitter",
  description:
    "Split an audio file into multiple segments entirely in the browser. Drag-and-drop a file, decode with Web Audio API, and split using one of three modes: equal-count (split into N parts), equal-duration (parts of X seconds each), silence detection (auto-detect quiet regions using dB threshold + min-duration presets), or manual timestamps. Each segment is re-encoded as a 16-bit PCM WAV (pure-JS RIFF encoder) and bundled into a pure-JS ZIP archive (STORE method, no library). Per-segment download links plus a single ZIP download. History (localStorage), shareable URL, summary stats. 100% client-side.",
  category: "audio-video",
  keywords: [
    "audio splitter", "split audio", "divide audio",
    "audio segments", "audio cutter", "silence detection",
    "wav encoder", "zip builder", "pcm", "riff",
  ],
  icon: "split",
  requiresNetwork: false,
  seo: {
    title: "Audio Splitter — Split Audio Online (Equal / Silence / Manual) | UnQTools",
    faq: [
      {
        q: "How does the audio splitter work?",
        a: "Drop or pick an audio file. We decode it with the Web Audio API into raw PCM samples per channel. Then, depending on your chosen mode, we compute split points (sample indices), extract each segment as a sub-buffer, and re-encode it as a 16-bit PCM WAV file with a pure-JS RIFF encoder. All segments are bundled into a ZIP archive (STORE method, pure-JS, no library) for one-click download, plus individual per-segment download links.",
      },
      {
        q: "What split modes are supported?",
        a: "Four modes: (1) Equal count — split into N equal parts. (2) Equal duration — split into parts of X seconds each (the last part may be shorter). (3) Silence detection — scan for silent regions (amplitude below a dB threshold for longer than a minimum duration) and split at the midpoint of each silence. (4) Manual timestamps — provide a list of timestamps (e.g. '0:00, 1:30, 3:45') and split at those exact points.",
      },
      {
        q: "What silence thresholds and durations are available?",
        a: "Five threshold presets: −30 dB (loud), −40 dB, −50 dB (default), −60 dB, −80 dB (very quiet). Five minimum-duration presets: 100 ms, 250 ms, 500 ms (default), 1 second, 2 seconds. A silence region must be quieter than the threshold AND longer than the minimum duration to trigger a split.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Four split modes (equal-count, equal-duration, silence, manual). (2) Equal duration split calculator (by count or by duration). (3) Silence detector (threshold + min duration). (4) Manual timestamp parser (4 time formats). (5) Split point validator. (6) Segment extractor (per-channel slice). (7) Per-segment WAV encoder (44-byte RIFF, 16-bit PCM). (8) Pure-JS ZIP archive builder (STORE method, no deps). (9) Filename generator per segment (zero-padded). (10) History (localStorage, last 20). (11) Shareable URL settings. (12) Drag-and-drop file input. (13) Summary stats (segment count, total duration, avg/min/max segment duration, output size). (14) Five silence threshold presets. (15) Five min-silence-duration presets. (16) Per-segment download links (in addition to ZIP).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. The audio file you load, decoded samples, segment WAVs, and ZIP archive never leave your browser. There is no upload. Split metadata in history is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

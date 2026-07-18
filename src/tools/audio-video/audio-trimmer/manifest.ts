import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "audio-trimmer",
  name: "Audio Trimmer",
  description:
    "Trim audio files to a start/end range entirely in the browser. Drag-and-drop or pick a file, decode with Web Audio API, set start/end timestamps (MM:SS.ms, HH:MM:SS, or seconds), apply fade in/out (5 presets), and re-encode as a 16-bit PCM WAV (pure-JS encoder — no library). Multi-format time parser, sample-range calculator, 44-byte RIFF WAV header builder, file-size estimator, trim validation, crossfade calculator, audio preview before/after, history (localStorage), shareable URL, summary stats (original duration, trimmed duration, % removed, output size). 100% client-side.",
  category: "audio-video",
  keywords: [
    "audio trimmer", "trim audio", "cut audio",
    "audio clipper", "wav encoder", "pcm",
    "audio editor", "waveform", "riff",
  ],
  icon: "scissors",
  requiresNetwork: false,
  seo: {
    title: "Audio Trimmer — Cut Audio Online (WAV Encoder, Fade In/Out) | UnQTools",
    faq: [
      {
        q: "How does the audio trimmer work?",
        a: "Drop or pick an audio file. We decode it with the Web Audio API into raw PCM samples, then build a new 16-bit PCM WAV file containing only the samples between your start and end timestamps. A pure-JS RIFF WAV header is written (no external library). The output downloads as a .wav file.",
      },
      {
        q: "What time formats can I enter?",
        a: "Four formats are supported: plain seconds (e.g. 12.5), MM:SS (e.g. 01:30), MM:SS.ms (e.g. 01:30.250), and HH:MM:SS (e.g. 01:02:03). The parser auto-detects which format you used.",
      },
      {
        q: "Can I apply fade in / fade out?",
        a: "Yes. Five presets are available: 0ms (off), 100ms, 500ms, 1s, and 2s. Fades apply a linear amplitude ramp on the first and last N ms of the trimmed segment to avoid clicks and pops at the cut points.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Multi-format time parser (4 input formats). (2) Sample range calculator (start/end × sampleRate). (3) 44-byte RIFF WAV header builder. (4) Sample-to-16-bit PCM converter. (5) File size estimator. (6) Trim validation (start < end, end ≤ duration). (7) Fade in/out generator (5 presets). (8) Crossfade calculator. (9) Timestamped filename generator. (10) History (localStorage, last 20). (11) Shareable URL settings. (12) Audio preview before & after. (13) Summary stats (original duration, trimmed duration, % removed, output size). (14) Drag-and-drop file input.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. The audio file you load, decoded samples, and output WAV never leave your browser. There is no upload. Trim metadata in history is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

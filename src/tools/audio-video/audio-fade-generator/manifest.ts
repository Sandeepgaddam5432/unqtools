import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "audio-fade-generator",
  name: "Audio Fade Generator",
  description:
    "Apply professional fade in / fade out to audio files entirely in the browser. Drag-and-drop or pick a file, decode with Web Audio API, choose a fade curve (linear, logarithmic, exponential, or S-curve), set fade in / fade out durations (6 presets from 100 ms to 5 s), and re-encode as a 16-bit PCM WAV (pure-JS encoder — no library). Fade gain array generator, per-sample fade applier, fade duration validator, sample-range calculator, ASCII curve visualizer, audio preview before/after, history (localStorage), shareable URL, and summary stats. 100% client-side.",
  category: "audio-video",
  keywords: [
    "audio fade", "fade in", "fade out",
    "fade generator", "linear fade", "logarithmic fade",
    "exponential fade", "s-curve fade", "cosine fade",
    "audio envelope", "gain ramp", "wav encoder",
  ],
  icon: "trending-up",
  requiresNetwork: false,
  seo: {
    title: "Audio Fade Generator — Fade In / Out (4 Curves, WAV) | UnQTools",
    faq: [
      {
        q: "How does the audio fade generator work?",
        a: "Drop or pick an audio file. We decode it with the Web Audio API into raw PCM samples, then build a gain envelope for the fade in (0→1 over N samples at the start) and fade out (1→0 over N samples at the end). Each sample in those ranges is multiplied by the gain value for its position. The result is re-encoded as a 16-bit PCM WAV file via a pure-JS RIFF encoder.",
      },
      {
        q: "What fade curves are supported?",
        a: "Four curves: Linear (constant rate, g = i/N), Logarithmic (slow start, fast end, g = log10(1 + 9·i/N)), Exponential (fast start, slow end, g = (i/N)²), and S-curve (smooth both ends, g = 0.5 − 0.5·cos(π·i/N)). S-curve is the most musical and avoids abrupt transitions.",
      },
      {
        q: "What fade durations are available?",
        a: "Six presets: 100 ms (very fast), 250 ms (fast), 500 ms (default), 1 s (smooth), 2 s (long), and 5 s (very long / ambient). Both fade in and fade out can be set independently. The tool validates that fade in + fade out does not exceed the total audio duration.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 4 fade curve types (linear, logarithmic, exponential, S-curve). (2) Fade in generator (gain array). (3) Fade out generator (gain array). (4) Per-sample fade applier (multiply). (5) 6 fade duration presets. (6) Fade validation (in + out ≤ duration). (7) Sample-range calculator. (8) Pure-JS WAV encoder (PCM 16-bit). (9) Timestamped filename generator. (10) History (localStorage, last 20). (11) Shareable URL settings. (12) Drag-and-drop file input. (13) Summary stats (fade in duration, fade out duration, total faded samples). (14) Audio preview before & after. (15) ASCII curve visualizer showing the gain envelope over time.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. The audio file you load, decoded samples, gain envelope, and output WAV never leave your browser. There is no upload. Fade metadata in history is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

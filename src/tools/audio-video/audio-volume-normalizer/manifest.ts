import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "audio-volume-normalizer",
  name: "Audio Volume Normalizer",
  description:
    "Normalize audio volume to a target dBFS — boost quiet audio and reduce loud audio to a consistent level. Three normalization modes (peak, RMS, simplified loudness), 8 dBFS presets including EBU R128 standard (-23 LUFS), dBFS ↔ linear gain converter, peak detector, RMS calculator, clipping detector, auto clipping preventer, sample scaler, pure-JS WAV encoder, text report generator, conversion history (localStorage), shareable URL, drag-and-drop, and summary stats. 100% client-side.",
  category: "audio-video",
  keywords: [
    "audio normalizer", "volume normalizer", "normalize audio",
    "dbfs", "loudness", "rms", "peak normalization",
    "ebu r128", "gain", "audio level", "loudness normalize",
  ],
  icon: "gauge",
  requiresNetwork: false,
  seo: {
    title: "Audio Volume Normalizer — Peak / RMS / Loudness to dBFS | UnQTools",
    faq: [
      {
        q: "How does the audio volume normalizer work?",
        a: "Drop or pick an audio file. We decode it locally with the Web Audio API (decodeAudioData), then analyze the samples to find the current peak or RMS level. We compute the linear gain needed to bring that level to your target dBFS, apply the gain uniformly across all samples, and re-encode the result as a 16-bit PCM WAV file.",
      },
      {
        q: "What normalization modes are supported?",
        a: "Three modes: Peak normalization (find max absolute sample, scale so it reaches target dBFS — useful for maximizing headroom), RMS normalization (compute root-mean-square of samples, scale to target RMS — closer to perceived loudness), and simplified loudness (full-band RMS as an approximation of EBU R128 LUFS).",
      },
      {
        q: "What dBFS targets are available?",
        a: "8 presets: -1, -3, -6, -10, -14, -16, -20, and -23 dBFS (EBU R128 broadcast standard for LUFS). The default is -16 dBFS, the common podcast / web audio standard.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 3 normalization modes (peak, RMS, simplified loudness). (2) 8 dBFS presets including EBU R128 -23 LUFS. (3) dBFS ↔ linear gain converter. (4) Peak detector. (5) RMS calculator. (6) Clipping detector (after gain). (7) Auto clipping preventer (reduces gain to max safe). (8) Sample scaler. (9) Pure-JS WAV encoder (PCM 16-bit). (10) Text report generator. (11) Conversion history (localStorage, last 20). (12) Shareable URL settings. (13) Drag-and-drop file input. (14) Summary stats (input/output levels, applied gain, peak before/after). (15) Loudness comparison (input vs output).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Audio decoding, analysis, gain application, and WAV encoding all happen locally in your browser via the Web Audio API and a pure-JS RIFF encoder. Your file is never uploaded. Normalization metadata in history is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

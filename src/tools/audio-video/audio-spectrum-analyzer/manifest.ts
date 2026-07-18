import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "audio-spectrum-analyzer",
  name: "Audio Spectrum Analyzer",
  description:
    "Analyze audio frequency spectrum entirely in the browser. Drag-and-drop or pick an audio file, decode with Web Audio API, choose FFT size (6 presets: 256/512/1024/2048/4096/8192) and window function (4 presets: hanning/hamming/blackman/rectangular), render a real-time spectrum on Canvas, find peak frequencies, compute energy in 7 standard frequency bands (sub-bass, bass, low-mid, mid, high-mid, presence, brilliance), dBFS conversion, magnitude calculator, exponential smoothing, 4 color palette presets, text report, CSV export, history (localStorage), shareable URL, summary stats. 100% client-side.",
  category: "audio-video",
  keywords: [
    "audio spectrum", "spectrum analyzer", "fft",
    "frequency analysis", "audio analyzer", "frequency bands",
    "peak frequency", "audio frequencies", "waveform fft",
  ],
  icon: "bar-chart-3",
  requiresNetwork: false,
  seo: {
    title: "Audio Spectrum Analyzer — FFT Frequency Analysis (Web Audio API) | UnQTools",
    faq: [
      {
        q: "How does the audio spectrum analyzer work?",
        a: "Drop or pick an audio file. We decode it with the Web Audio API into raw PCM samples. For real-time visualization we route a BufferSourceNode through an AnalyserNode and draw the frequency spectrum on a Canvas. For static analysis we run a pure-JS radix-2 FFT over windowed segments of the decoded samples and compute peak frequencies and band energies.",
      },
      {
        q: "What FFT sizes are supported?",
        a: "Six power-of-two presets: 256, 512, 1024, 2048, 4096, and 8192. Smaller sizes give faster, smoother visualizations; larger sizes give better frequency resolution. The validator accepts any power of two between 32 and 32768.",
      },
      {
        q: "What window functions are available?",
        a: "Four standard windowing functions: Hanning, Hamming, Blackman, and Rectangular (no window). Windowing reduces spectral leakage at the cost of slightly wider peaks. Blackman has the strongest leakage suppression; Rectangular the weakest.",
      },
      {
        q: "Which frequency bands are analyzed?",
        a: "Seven standard bands: sub-bass (20–60 Hz), bass (60–250 Hz), low-mid (250–500 Hz), mid (500 Hz–2 kHz), high-mid (2–4 kHz), presence (4–6 kHz), and brilliance (6–20 kHz). Energy per band is summed from the FFT magnitudes and reported in dBFS.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 6 FFT size presets. (2) FFT size validator (power of 2, 32–32768). (3) 4 window function generators. (4) 7 standard frequency bands. (5) FFT bin ↔ frequency converters. (6) Peak frequency finder (top N). (7) Band energy calculator. (8) dBFS converter. (9) Magnitude calculator (sqrt(re²+im²)). (10) Exponential smoothing applier. (11) 4 color palette presets (rainbow/heat/cool/mono). (12) Text report renderer. (13) CSV export. (14) History (localStorage, last 20). (15) Shareable URL settings. (16) Canvas-based real-time spectrum visualization.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. The audio file you load, decoded samples, FFT output, and reports never leave your browser. All decoding happens via the Web Audio API locally. Analysis metadata in history is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

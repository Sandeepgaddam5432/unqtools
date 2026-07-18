import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "audio-noise-reducer",
  name: "Audio Noise Reducer",
  description:
    "Reduce background noise from audio in the browser using spectral subtraction and a noise gate. Drag-and-drop or pick a file, decode with Web Audio API, estimate the noise floor from a leading silent region, subtract the average noise spectrum from each FFT window, and silence samples below a dBFS threshold. Then re-encode as a 16-bit PCM WAV (pure-JS encoder). 4 strength presets (light/medium/strong/aggressive), 4 noise-gate presets (-30/-40/-50/-60 dBFS), 5 FFT sizes, hanning windowing, magnitude/phase separation, IFFT reconstruction, file-size estimator, text + CSV report, history (localStorage), shareable URL, summary stats (input level, noise level, output level, % noise reduced). 100% client-side.",
  category: "audio-video",
  keywords: [
    "noise reducer", "denoise", "noise reduction",
    "spectral subtraction", "noise gate", "audio cleanup",
    "background noise", "hiss remover", "fft",
  ],
  icon: "waves",
  requiresNetwork: false,
  seo: {
    title: "Audio Noise Reducer — Spectral Subtraction + Noise Gate | UnQTools",
    faq: [
      {
        q: "How does the audio noise reducer work?",
        a: "Drop or pick an audio file. We decode it with the Web Audio API, split it into small overlapping windows (e.g. 1024 samples), apply a Hanning window, and run an FFT on each. The first ~100ms of the signal is treated as a noise sample: we average its magnitude spectrum to estimate the noise floor. For every subsequent window we subtract a scaled copy of the noise floor from the magnitude (clamped at zero), keep the original phase, and run an inverse FFT. We then overlap-add the windows back together. An optional noise gate silences samples below a dBFS threshold. The result is re-encoded as a 16-bit PCM WAV file (pure-JS RIFF encoder, no library).",
      },
      {
        q: "What strength and noise-gate presets are available?",
        a: "Four strength presets control how aggressively the noise floor is subtracted: light (25), medium (50), strong (75), and aggressive (100). Higher values remove more noise but may introduce musical-noise artifacts. Four noise-gate threshold presets are also available: -30 dBFS (gentle), -40 dBFS (default), -50 dBFS (aggressive), and -60 dBFS (only the quietest hiss). Anything quieter than the threshold is silenced.",
      },
      {
        q: "What FFT sizes can I choose?",
        a: "Five power-of-two FFT sizes: 256, 512, 1024 (default), 2048, and 4096. Smaller sizes track transient noise better; larger sizes give finer frequency resolution but smear attacks. A 50% hop size and Hanning window with overlap-add reconstruction guarantee perfect reconstruction when no subtraction is applied.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 4 strength presets (light/medium/strong/aggressive). (2) 4 noise-gate threshold presets (dBFS). (3) 5 FFT sizes. (4) Noise estimation from a sample window (average magnitude spectrum). (5) Spectral subtraction algorithm (subtract scaled noise floor, clamp to zero). (6) Noise-gate applier (silence samples below threshold). (7) Hanning window generator. (8) Magnitude/phase calculator from complex FFT. (9) Reconstruction from magnitude/phase via inverse FFT. (10) Pure-JS radix-2 Cooley-Tukey FFT + IFFT. (11) File-size estimator. (12) WAV encoder (44-byte RIFF header + 16-bit PCM). (13) Text report generator. (14) CSV report generator. (15) History (localStorage, last 20). (16) Shareable URL settings. (17) Summary stats (input level, noise level, output level, % noise reduced, clipping prevented).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. The audio file you load, decoded samples, FFT data, and output WAV never leave your browser. There is no upload. Noise-reduction metadata in history is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "audio-equalizer",
  name: "Audio Equalizer",
  description:
    "Apply a 10-band graphic EQ to audio entirely in the browser. Drag-and-drop or pick a file, decode with Web Audio API, adjust the gain (-12 dB to +12 dB) on each ISO-standard band (31, 62, 125, 250, 500, 1k, 2k, 4k, 8k, 16k Hz), apply via a chain of peaking BiquadFilterNodes in an OfflineAudioContext for batch processing, and re-encode as a 16-bit PCM WAV (pure-JS encoder). 10+ preset library (flat, bass-boost, treble-boost, vocal-boost, loudness, rock, pop, jazz, classical, podcast), 3-band & 5-band simplified modes, 7 gain presets per band, default Q factor 1.41, gain validator, filter-chain config builder, file-size estimator, text + CSV report, history (localStorage), shareable URL, summary stats. 100% client-side.",
  category: "audio-video",
  keywords: [
    "equalizer", "eq", "10-band eq", "graphic eq",
    "biquad filter", "audio tone control", "frequency bands",
    "bass boost", "treble boost", "audio filter",
  ],
  icon: "sliders-horizontal",
  requiresNetwork: false,
  seo: {
    title: "Audio Equalizer — 10-Band Graphic EQ (Biquad Filters) | UnQTools",
    faq: [
      {
        q: "How does the audio equalizer work?",
        a: "Drop or pick an audio file. We decode it with the Web Audio API, then build a chain of 10 peaking BiquadFilterNodes centered on the ISO-standard frequencies (31, 62, 125, 250, 500, 1k, 2k, 4k, 8k, 16k Hz) with the gain you set for each band. The chain is rendered offline via OfflineAudioContext for fast batch processing, and the output is re-encoded as a 16-bit PCM WAV file (pure-JS RIFF encoder, no library).",
      },
      {
        q: "What frequency bands are supported?",
        a: "Three band sets: a full 10-band ISO graphic EQ (31, 62, 125, 250, 500, 1k, 2k, 4k, 8k, 16k Hz), a simpler 5-band EQ (60, 250, 1k, 4k, 12k Hz), and a 3-band EQ (low/mid/high at 250/1k/4k Hz). All filters are peaking biquads with default Q = 1.41 (≈1 octave bandwidth).",
      },
      {
        q: "What gain range and presets are available?",
        a: "Each band's gain can be set from -12 dB (full cut) to +12 dB (full boost). Seven gain presets are provided per band: -12, -6, -3, 0, +3, +6, +12 dB. Plus 10+ full EQ preset library entries that set all bands at once: flat, bass-boost, treble-boost, vocal-boost, loudness, rock, pop, jazz, classical, podcast.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 10-band ISO frequency presets. (2) 5-band simplified presets. (3) 3-band bass/mid/treble presets. (4) 7 gain presets per band (-12 to +12 dB). (5) Biquad filter Q factor default (1.41). (6) 10+ EQ preset library (flat, bass-boost, treble-boost, vocal-boost, loudness, rock, pop, jazz, classical, podcast). (7) Gain validator (-12 ≤ gain ≤ 12). (8) Filter chain config builder ({ frequency, gain, Q }[] for BiquadFilterNode setup). (9) File-size estimator. (10) WAV encoder (44-byte RIFF header + 16-bit PCM). (11) Text report generator. (12) CSV report generator (band, frequency_hz, gain_db). (13) History (localStorage, last 20). (14) Shareable URL settings. (15) Summary stats (bands modified, total gain change, preset name).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. The audio file you load, decoded samples, EQ filter graph, and output WAV never leave your browser. There is no upload. EQ metadata in history is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

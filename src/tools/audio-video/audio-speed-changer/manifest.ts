import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "audio-speed-changer",
  name: "Audio Speed Changer",
  description:
    "Change audio playback speed (0.25× to 4.0×) with optional pitch preservation. Drag-and-drop or pick a file, decode with Web Audio API, choose a speed preset (7 from 0.5× to 2.0×) or enter a custom factor, toggle pitch preservation (uses OfflineAudioContext resampling to keep pitch when speed changes), and re-encode as a 16-bit PCM WAV. Pure-JS linear-interpolation resampler, pitch-shift (semitone) calculator, duration & file-size estimator, click-preventing fade in/out, audio preview before/after, history (localStorage), shareable URL, summary stats. 100% client-side.",
  category: "audio-video",
  keywords: [
    "audio speed", "change speed", "speed up audio",
    "slow down audio", "playback rate", "pitch preservation",
    "audio resampler", "tempo changer", "wav encoder",
  ],
  icon: "gauge",
  requiresNetwork: false,
  seo: {
    title: "Audio Speed Changer — Speed Up / Slow Down Audio (Pitch Preserve) | UnQTools",
    faq: [
      {
        q: "How does the audio speed changer work?",
        a: "Drop or pick an audio file. We decode it with the Web Audio API into raw PCM samples. With pitch preservation OFF, a pure-JS linear-interpolation resampler changes the sample rate (so both speed AND pitch shift together, like a tape). With pitch preservation ON, an OfflineAudioContext renders the buffer at the new playback rate (so the tempo changes but pitch stays the same). The result is re-encoded as a 16-bit PCM WAV.",
      },
      {
        q: "What speed range is supported?",
        a: "0.25× to 4.0×. Seven presets cover 0.5×, 0.75×, 1.0× (no change), 1.25×, 1.5×, 1.75×, and 2.0×. You can also enter any custom value in the supported range — fractional factors (e.g. 1.35×) are fine.",
      },
      {
        q: "How is pitch shift calculated when pitch preservation is off?",
        a: "Semitones = 12 × log2(speed). Doubling the speed (2.0×) raises pitch by exactly 12 semitones (one octave). Halving (0.5×) lowers it by 12 semitones. The tool shows the calculated pitch shift in the summary stats.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 7 speed presets (0.5× to 2.0×) + custom input. (2) Speed validation (0.25× to 4.0×). (3) Pitch preservation toggle (OfflineAudioContext resampling). (4) Pure-JS linear-interpolation resampler. (5) Pitch-shift (semitone) calculator. (6) Duration calculator (new duration = original / speed). (7) File-size estimator. (8) Pure-JS 44-byte RIFF WAV encoder (16-bit PCM). (9) Timestamped filename generator. (10) History (localStorage, last 20). (11) Shareable URL settings. (12) Drag-and-drop file input. (13) Summary stats (original duration, new duration, speed factor, pitch shift). (14) Audio preview before & after. (15) Click-preventing fade in/out at boundaries.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. The audio file you load, decoded samples, and output WAV never leave your browser. There is no upload. Speed-change metadata in history is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

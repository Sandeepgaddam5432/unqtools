import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "audio-waveform-viewer",
  name: "Audio Waveform Viewer",
  description:
    "Visualize audio waveforms entirely in the browser. Drag-and-drop or pick an audio file, decode with Web Audio API, render peak/RMS waveform on Canvas with zoom (6 presets: 1x/2x/5x/10x/50x/100x), select channel view (left/right/both/mono-mix), detect silence regions (5 threshold presets from -30dB to -80dB, 5 min-duration presets from 100ms to 2s), find top-N amplitude peaks, 5 color presets (blue/green/red/purple/mono), peak list renderer, text report, CSV export (peaks + silence), history (localStorage), shareable URL, summary stats (duration, sample rate, channels, peak count, silence count, % silence). 100% client-side.",
  category: "audio-video",
  keywords: [
    "audio waveform", "waveform viewer", "audio visualization",
    "peak detection", "silence detection", "audio analysis",
    "amplitude", "audio peaks", "waveform zoom",
  ],
  icon: "audio-waveform",
  requiresNetwork: false,
  seo: {
    title: "Audio Waveform Viewer — Peak/Silence Detection (Web Audio API) | UnQTools",
    faq: [
      {
        q: "How does the audio waveform viewer work?",
        a: "Drop or pick an audio file. We decode it with the Web Audio API into raw PCM samples. The waveform is drawn on a Canvas using per-pixel peak and RMS amplitude (so a 10-minute file renders in roughly 1000 columns, not millions of samples). Zoom in to see more detail; zoom out for an overview. Silence regions are detected by amplitude threshold and minimum duration.",
      },
      {
        q: "What channel views are available?",
        a: "Four modes: Left channel only, Right channel only, Both channels (stacked), and Mono mix (average of L+R). Mono-mix is the default for files with multiple channels; single-channel files render their sole channel regardless of the selection.",
      },
      {
        q: "How is silence detected?",
        a: "A sample window is considered silent if its peak amplitude (max absolute value) is below the chosen threshold. The threshold is specified in dBFS (decibels below full scale) and convertible to linear amplitude via 10^(dB/20). A silence region is a run of consecutive silent windows whose combined duration exceeds the minimum duration setting.",
      },
      {
        q: "What zoom levels are supported?",
        a: "Six presets: 1×, 2×, 5×, 10×, 50×, and 100×. Higher zoom means fewer samples per pixel column (more detail). At 1× you see the whole file; at 100× you can examine individual sample peaks. The pixel window size is computed as totalSamples / (pixels × zoom).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 4 channel view modes (L/R/both/mono-mix). (2) Mono-mix calculator. (3) Peak calculator per pixel window. (4) RMS calculator per pixel window. (5) Zoom-aware sample window size calculator. (6) Silence region detector. (7) 5 silence threshold presets (-30/-40/-50/-60/-80 dB). (8) 5 min silence duration presets (100ms/250ms/500ms/1s/2s). (9) 6 zoom presets. (10) 5 color presets (blue/green/red/purple/mono). (11) Peak list renderer (top-N). (12) Text report. (13) CSV export (peaks + silence regions). (14) History (localStorage, last 20). (15) Shareable URL settings. (16) Canvas-based waveform visualization with peak+RMS rendering.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. The audio file you load and decoded samples never leave your browser. All decoding and visualization happens locally via the Web Audio API and Canvas API. History metadata is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

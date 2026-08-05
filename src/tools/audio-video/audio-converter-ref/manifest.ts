/**
 * Audio Converter Reference — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "audio-converter-ref",
  name: "Audio Converter Reference",
  description: "Reference for audio format conversion: MP3/WAV/AAC/OGG/FLAC/Opus with quality settings. 100% private. 100% private.",
  category: "audio-video",
  keywords: ["audio-converter-ref".replace(/-/g, ", "), "audio-video"],
  icon: "music",
  requiresNetwork: false,
  seo: {
    title: "Audio Converter Reference | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};

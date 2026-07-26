/**
 * Video Bitrate Guide — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "video-bitrate-guide",
  name: "Video Bitrate Guide",
  description: "Calculate recommended bitrate for streaming/recording by resolution and FPS. 100% private. 100% private.",
  category: "audio-video",
  keywords: ["video-bitrate-guide".replace(/-/g, ", "), "audio-video"],
  icon: "gauge",
  requiresNetwork: false,
  seo: {
    title: "Video Bitrate Guide | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};

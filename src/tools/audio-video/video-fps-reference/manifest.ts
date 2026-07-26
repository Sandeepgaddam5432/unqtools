/**
 * Video FPS Reference — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "video-fps-reference",
  name: "Video FPS Reference",
  description: "Reference for frame rates (24/25/30/50/60/120/240), use cases, and conversion. 100% private. 100% private.",
  category: "audio-video",
  keywords: ["video-fps-reference".replace(/-/g, ", "), "audio-video"],
  icon: "video",
  requiresNetwork: false,
  seo: {
    title: "Video FPS Reference | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};

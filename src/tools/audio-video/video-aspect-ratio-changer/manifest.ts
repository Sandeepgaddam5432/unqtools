/**
 * Video Aspect Ratio Changer — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "video-aspect-ratio-changer",
  name: "Video Aspect Ratio Changer",
  description: "Change video aspect ratio with crop, pad, and blur background modes. 100% private. 100% private.",
  category: "audio-video",
  keywords: ["video-aspect-ratio-changer".replace(/-/g, ", "), "audio-video"],
  icon: "crop",
  requiresNetwork: false,
  seo: {
    title: "Video Aspect Ratio Changer | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};

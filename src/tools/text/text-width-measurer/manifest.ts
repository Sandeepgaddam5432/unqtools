/**
 * Text Width Measurer — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "text-width-measurer",
  name: "Text Width Measurer",
  description:
    "Measure text width in pixels for various fonts and sizes. Canvas-based with 10+ extras. 100% private.",
  category: "text",
  keywords: ["text width", "pixel width", "font measurement", "text size", "canvas measure"],
  icon: "ruler",
  requiresNetwork: false,
  seo: {
    title: "Text Width Measurer | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded to any server." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core functionality, (2) Batch mode, (3) Copy results, (4) Download as file, (5) History (localStorage), (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats summary, (11) Multi-format output, (12) Configurable settings, (13) Real-time preview." },
    ],
  },
  status: "done",
};

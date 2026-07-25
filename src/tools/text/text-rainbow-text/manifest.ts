/**
 * Rainbow Text Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "text-rainbow-text",
  name: "Rainbow Text Generator",
  description: "Generate rainbow-colored text with custom color schemes for HTML/markdown. 100% private. 100% private.",
  category: "text",
  keywords: ["text-rainbow-text".replace(/-/g, ", "), "text"],
  icon: "palette",
  requiresNetwork: false,
  seo: {
    title: "Rainbow Text Generator | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};

/**
 * Word Cloud Data Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "text-word-cloud-data",
  name: "Word Cloud Data Generator",
  description: "Generate word frequency data for word clouds with stop word removal. 100% private. 100% private.",
  category: "text",
  keywords: ["text-word-cloud-data".replace(/-/g, ", "), "text"],
  icon: "cloud",
  requiresNetwork: false,
  seo: {
    title: "Word Cloud Data Generator | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};

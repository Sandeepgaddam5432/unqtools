/**
 * Social Poll Creator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "social-poll-creator",
  name: "Social Poll Creator",
  description: "Create polls with options, vote tracking simulation, and platform formatting. 100% private. 100% private.",
  category: "social",
  keywords: ["social-poll-creator".replace(/-/g, ", "), "social"],
  icon: "bar-chart-3",
  requiresNetwork: false,
  seo: {
    title: "Social Poll Creator | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};

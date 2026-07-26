/**
 * Percentage Of Calculator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "percentage-of-calc",
  name: "Percentage Of Calculator",
  description: "Calculate X% of Y, what % is X of Y, and % increase/decrease. 100% private. 100% private.",
  category: "calculators",
  keywords: ["percentage-of-calc".replace(/-/g, ", "), "calculators"],
  icon: "percent",
  requiresNetwork: false,
  seo: {
    title: "Percentage Of Calculator | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};

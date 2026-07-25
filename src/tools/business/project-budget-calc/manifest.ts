/**
 * Project Budget Calculator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "project-budget-calc",
  name: "Project Budget Calculator",
  description: "Calculate project budget with labor, materials, overhead, contingency. 100% private. 100% private.",
  category: "business",
  keywords: ["project-budget-calc".replace(/-/g, ", "), "business"],
  icon: "wallet",
  requiresNetwork: false,
  seo: {
    title: "Project Budget Calculator | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};

/**
 * Binary Calculator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "binary-calculator",
  name: "Binary Calculator",
  description: "Add, subtract, multiply, divide binary numbers with step-by-step solution. 100% private. 100% private.",
  category: "calculators",
  keywords: ["binary-calculator".replace(/-/g, ", "), "calculators"],
  icon: "binary",
  requiresNetwork: false,
  seo: {
    title: "Binary Calculator | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};

/**
 * Crypto Price Widget Customizer — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "crypto-price-widget",
  name: "Crypto Price Widget Customizer",
  description: "Customize crypto price widget with coin selection and styling. 100% private. 100% private.",
  category: "business",
  keywords: ["crypto-price-widget".replace(/-/g, ", "), "business"],
  icon: "bitcoin",
  requiresNetwork: false,
  seo: {
    title: "Crypto Price Widget Customizer | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};

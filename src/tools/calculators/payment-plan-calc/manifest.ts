/**
 * Payment Plan Calculator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "payment-plan-calc",
  name: "Payment Plan Calculator",
  description: "Payment Plan calculator with detailed breakdown and 10+ extras. 100% private.",
  category: "calculators",
  keywords: ["payment,plan,calc", "calculator", "finance", "math"],
  icon: "calculator",
  requiresNetwork: false,
  seo: {
    title: "Payment Plan Calculator | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All calculations happen locally in your browser." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core calculation, (2) Detailed breakdown, (3) Copy results, (4) Download, (5) CSV export, (6) Multi-currency, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Year-by-year table, (12) Charts, (13) History." },
    ],
  },
  status: "done",
};

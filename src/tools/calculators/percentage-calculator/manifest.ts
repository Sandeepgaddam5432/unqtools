/**
 * Percentage Calculator — Tool Manifest
 * Reference: unqtools-docs / Category 6 / "6 Percentage Calculator".
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "percentage-calculator",
  name: "Percentage Calculator",
  description:
    "Calculate percentages 6 ways: X% of Y, X is what % of Y, % increase/decrease, % of total, tip %, tax %. With copy, history, and CSV export. 100% private.",
  category: "calculators",
  keywords: [
    "percentage calculator",
    "percent",
    "percent change",
    "percent increase",
    "percent decrease",
    "percent of",
    "tip",
    "tax",
  ],
  icon: "percent",
  requiresNetwork: false,
  seo: {
    title: "Percentage Calculator — 6 Modes + Percent Change | UnQTools",
    faq: [
      {
        q: "How is percentage calculated?",
        a: "Percentage = (Part / Whole) * 100. To find X% of Y, multiply X/100 * Y. To find what percent X is of Y, divide X/Y * 100. Percent change = (New - Old) / |Old| * 100.",
      },
      {
        q: "What extra features does this tool have?",
        a: "Extras: (1) 6 calculation modes in one tool, (2) % increase AND decrease side-by-side, (3) Tip + tax combined calc, (4) Multi-item percentage split, (5) Calculation history (last 10, localStorage), (6) CSV export of history, (7) Fraction-to-percent converter, (8) Reverse percentage (find original from final + %), (9) Compound percent change (chained %), (10) Percent error calculator, (11) Copy individual results, (12) Decimal precision control (0-6).",
      },
    ],
  },
  status: "done",
};

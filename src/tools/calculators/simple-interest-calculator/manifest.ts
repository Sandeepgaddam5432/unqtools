/**
 * Simple Interest Calculator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "simple-interest-calculator",
  name: "Simple Interest Calculator",
  description:
    "Calculate simple interest (SI = P*R*T/100) with 3 solver modes, partial years, and 10+ extras including comparison with compound interest. 100% private.",
  category: "calculators",
  keywords: ["simple interest", "si calculator", "principal", "rate", "time", "interest formula", "finance"],
  icon: "percent",
  requiresNetwork: false,
  seo: {
    title: "Simple Interest Calculator — 3 Solver Modes + CI Compare | UnQTools",
    faq: [
      { q: "What is the simple interest formula?", a: "Simple Interest (SI) = Principal × Rate × Time / 100. Total Amount = Principal + SI. Unlike compound interest, SI accrues only on the original principal." },
      { q: "What extras does this tool have?", a: "Extras: (1) Solve for SI given P,R,T, (2) Solve for P given SI,R,T, (3) Solve for R given P,SI,T, (4) Solve for T given P,SI,R, (5) Partial years (e.g. 2.5 years), (6) Compare side-by-side with compound interest, (7) Monthly interest breakdown, (8) Yearly interest breakdown, (9) CSV export of breakdown, (10) Multi-currency, (11) Copy individual results, (12) Per-day interest calculator, (13) Inflation-adjusted future value estimate." },
    ],
  },
  status: "done",
};

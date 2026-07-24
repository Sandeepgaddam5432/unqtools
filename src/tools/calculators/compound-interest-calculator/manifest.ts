/**
 * Compound Interest Calculator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "compound-interest-calculator",
  name: "Compound Interest Calculator",
  description:
    "Calculate compound interest: A = P(1+r/n)^(nt). Multiple compounding frequencies, regular contributions, inflation adjustment, and 10+ extras. 100% private.",
  category: "calculators",
  keywords: ["compound interest", "interest calculator", "investment calculator", "compounding", "principal", "rate", "finance"],
  icon: "trending-up",
  requiresNetwork: false,
  seo: {
    title: "Compound Interest Calculator — A=P(1+r/n)^(nt) + Contributions | UnQTools",
    faq: [
      { q: "What's the compound interest formula?", a: "A = P × (1 + r/n)^(nt), where P=principal, r=annual rate (decimal), n=compounding periods per year, t=years. With regular contributions, it gets more complex: A = P(1+r/n)^(nt) + PMT × [((1+r/n)^(nt) - 1) / (r/n)]." },
      { q: "What extras does this tool have?", a: "Extras: (1) 9 compounding frequencies (daily/weekly/monthly/quarterly/semi-annually/annually/continuously/custom), (2) Regular contributions (monthly/quarterly/annual), (3) Contribution at start vs end of period, (4) Inflation-adjusted real value, (5) Tax on interest, (6) Year-by-year breakdown, (7) Total contributions vs total interest split, (8) Multi-currency, (9) Copy individual results, (10) CSV export of breakdown, (11) Compare with simple interest, (12) Effective annual rate (APY), (13) Continuous compounding option, (14) Rule of 72 estimate." },
    ],
  },
  status: "done",
};

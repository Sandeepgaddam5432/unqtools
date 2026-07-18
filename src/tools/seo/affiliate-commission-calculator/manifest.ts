import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "affiliate-commission-calculator",
  name: "Affiliate Commission Calculator",
  description:
    "Calculate affiliate commissions across four program types — flat percent, tiered percent (progressive brackets), recurring (monthly × N months), and hybrid (initial + recurring). Apply refund-rate and tax-withholding adjustments, compute effective commission rate, compare two program types side-by-side, and project break-even sales to hit a target income. History (localStorage) + shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "affiliate commission", "commission calculator",
    "tiered commission", "recurring commission",
    "hybrid commission", "affiliate program",
    "affiliate revenue", "referral commission",
    "affiliate marketing", "break-even",
  ],
  icon: "calculator",
  requiresNetwork: false,
  seo: {
    title: "Affiliate Commission Calculator — Flat, Tiered, Recurring, Hybrid | UnQTools",
    faq: [
      {
        q: "How does the affiliate commission calculator work?",
        a: "Pick one of four program types (flat percent, tiered percent, recurring, or hybrid), enter your product price, sales count, commission percent, and (where applicable) tier brackets or recurring months. The tool computes gross commission, subtracts refunds and tax withholding, and reports net commission plus effective commission rate.",
      },
      {
        q: "How does the tiered-percent calculator work?",
        a: "Tiers are progressive brackets. Enter one tier per line as `minSales,percent` (e.g. `1,10` then `10,15` then `50,20` then `100,30`). Sales 1-9 earn 10%, sales 10-49 earn 15%, sales 50-99 earn 20%, and sales 100+ earn 30%. Each bracket's commission is summed for the total.",
      },
      {
        q: "How is the hybrid model calculated?",
        a: "Hybrid combines an initial commission (the full commissionPercent on the first payment) with a smaller recurring commission (half the commissionPercent on subsequent months) for `recurringMonths - 1` additional months. Both legs then have refund-rate and tax-withholding applied.",
      },
      {
        q: "What extra features does this tool have?",
        a: "(1) 4 program-type calculators (flat, tiered, recurring, hybrid). (2) Tiered commission calculator with progressive brackets. (3) Refund-rate adjustment. (4) Tax-withholding adjustment. (5) Recurring commission (monthly × N months). (6) Hybrid (initial + recurring). (7) Effective commission rate (net/gross). (8) Text report. (9) CSV export (component, value). (10) Copy + Download .txt + Download CSV. (11) History (localStorage, max 20). (12) Shareable URL. (13) Program-type presets. (14) Summary stats (gross, refunds, tax, net, effective rate). (15) Comparison mode (side-by-side for same sales volume). (16) Break-even calculator (sales to hit target income).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Every calculation runs locally in your browser. History is stored in localStorage on this device only. No pricing or sales numbers are transmitted.",
      },
    ],
  },
  status: "done",
};

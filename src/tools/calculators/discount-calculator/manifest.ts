/**
 * Discount Calculator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "discount-calculator",
  name: "Discount Calculator",
  description:
    "Calculate final price after discount, original price from final + %, stacked discounts, BOGO savings, and tax-inclusive final. With 10+ extras. 100% private.",
  category: "calculators",
  keywords: ["discount calculator", "sale price", "markdown", "percent off", "coupon", "savings", "original price"],
  icon: "tag",
  requiresNetwork: false,
  seo: {
    title: "Discount Calculator — Stacked Discounts + BOGO + Tax | UnQTools",
    faq: [
      { q: "How do I calculate a discount?", a: "Final price = Original × (1 - discount%/100). For stacked discounts (e.g. 20% then 10%), apply sequentially: Original × (1-0.2) × (1-0.1). Savings = Original - Final." },
      { q: "What extras does this tool have?", a: "Extras: (1) Single percent discount, (2) Fixed-amount discount, (3) Stacked multi-discount (up to 5), (4) Reverse: find original from final + %, (5) BOGO (buy-one-get-one) savings, (6) Tax-inclusive final price, (7) Side-by-side 3 discount comparison, (8) Coupon stacking with thresholds (e.g. $10 off $50+), (9) Savings history (localStorage), (10) CSV export, (11) Multi-currency, (12) Discount-after-tax toggle, (13) Markup vs markdown calculator." },
    ],
  },
  status: "done",
};

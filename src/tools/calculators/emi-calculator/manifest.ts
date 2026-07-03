/**
 * Loan / EMI Calculator — Tool Manifest
 * Reference: unqtools-docs / "5. Loan / EMI Calculator".
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "emi-calculator",
  name: "Loan / EMI Calculator",
  description:
    "Calculate EMI, total interest, and full amortization schedule with optional prepayments and CSV export. 100% private.",
  category: "calculators",
  keywords: [
    "emi calculator",
    "loan calculator",
    "amortization schedule",
    "prepayment",
    "interest",
    "monthly payment",
    "finance",
  ],
  icon: "calculator",
  requiresNetwork: false,
  seo: {
    title: "Loan / EMI Calculator — With Prepayment & Amortization | UnQTools",
    faq: [
      {
        q: "What is EMI?",
        a: "Equated Monthly Installment — the fixed monthly payment you make on a loan. It's calculated as P·r·(1+r)^n / ((1+r)^n − 1), where P is principal, r is monthly rate, and n is total months.",
      },
      {
        q: "How do prepayments reduce my loan?",
        a: "Each prepayment reduces your outstanding principal directly, which means less interest accrues on every subsequent month. You can model one-time lump-sum or recurring extra payments and instantly see the interest saved and months shaved off.",
      },
      {
        q: "Can I download the amortization schedule?",
        a: "Yes. The full month-by-month schedule can be downloaded as a CSV file. Choose monthly or yearly grouping.",
      },
    ],
  },
  status: "done",
};

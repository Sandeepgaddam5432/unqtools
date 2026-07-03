/**
 * Mortgage Calculator — Tool Manifest
 * Reference: unqtools-docs / "10. Mortgage Calculator".
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "mortgage-calculator",
  name: "Mortgage Calculator",
  description:
    "Full PITI mortgage calculator with PMI drop-off at 78% LTV, extra-payment payoff modeling, and CSV amortization export. 100% private.",
  category: "calculators",
  keywords: [
    "mortgage calculator",
    "piti",
    "pmi",
    "home loan",
    "amortization",
    "payoff",
    "extra payment",
    "hoa",
    "property tax",
  ],
  icon: "home",
  requiresNetwork: false,
  seo: {
    title: "Mortgage Calculator — Full PITI, PMI & Payoff | UnQTools",
    faq: [
      {
        q: "What is PITI?",
        a: "Principal, Interest, Taxes, and Insurance — the four components of a typical monthly mortgage payment. Some borrowers also add HOA dues; together these are your true monthly housing cost.",
      },
      {
        q: "When does PMI drop off?",
        a: "By US law (Homeowners Protection Act), lenders must automatically cancel PMI when your loan balance reaches 78% of the original home value, provided you're current on payments. You can request earlier cancellation at 80% LTV. This tool models both thresholds.",
      },
      {
        q: "How do extra payments help?",
        a: "Every extra dollar above your scheduled payment goes directly to principal. That reduces the base on which future interest accrues, shortening your loan term and dramatically cutting total interest paid.",
      },
    ],
  },
  status: "done",
};

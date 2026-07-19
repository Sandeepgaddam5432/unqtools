import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "tax-calculator",
  name: "Tax Calculator (Income / Sales / VAT / CGT)",
  description:
    "Calculate income tax (progressive brackets — US, UK, India), sales tax (US state lookup), VAT (UK, DE, FR, IN GST) and capital gains (long-term vs short-term). Multi-country, multi-year, multi-filing-status. Computes effective rate, marginal rate, net income, and breakdown by bracket. Export as text or CSV. 17 extra features: 4 tax types, 7 country presets, multi-bracket progressive calc, 3 filing statuses, 3 tax years, sales tax with US state lookup, VAT with country rates, capital gains LT/ST, deduction applier, effective rate, marginal rate, text/CSV renderers, history (localStorage), shareable URL, summary stats. 100% client-side.",
  category: "business",
  keywords: [
    "tax calculator", "income tax", "sales tax",
    "vat calculator", "capital gains tax",
    "tax bracket", "progressive tax",
    "us tax", "uk tax", "india tax", "gst",
  ],
  icon: "calculator",
  requiresNetwork: false,
  seo: {
    title: "Tax Calculator — Income / Sales / VAT / Capital Gains | UnQTools",
    faq: [
      {
        q: "How does the tax calculator work?",
        a: "Pick a tax type (income, sales, VAT or capital-gains), a country (US, UK, IN, DE, FR, CA, AU), and for income tax a filing status and tax year. Enter your amount (income, purchase amount or capital gain), optional deductions and for sales tax a US state. The tool computes the tax using the correct progressive brackets or flat rate, then shows effective rate, marginal rate, net income and a per-bracket breakdown.",
      },
      {
        q: "Which tax brackets are used?",
        a: "US income tax uses 2026 IRS brackets (10/12/22/24/32/35/37%) for single, married-jointly and head-of-household. UK uses 2026-27 bands (0/20/40/45%). India uses FY 2025-26 new regime slabs (0/5/10/15/20/30%). Sales tax uses per-state US rates (default 7%). VAT uses UK 20%, DE 19%, FR 20%, IN 18% GST. Capital gains: long-term rates are 0/15/20% (US) or country-specific; short-term = ordinary income tax.",
      },
      {
        q: "Can I deduct amounts before tax?",
        a: "Yes. Enter a deduction amount and it is subtracted from your taxable income before the brackets are applied (for income tax). For capital gains, the deduction also applies to the taxable gain.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 4 tax type calculators (income, sales, VAT, capital-gains). (2) 7 country presets (US, UK, IN, DE, FR, CA, AU). (3) Multi-bracket progressive income tax calculator. (4) 3 filing status presets (single, married-jointly, head-of-household). (5) 3 tax year presets (2024, 2025, 2026). (6) Sales tax calculator with US state lookup. (7) VAT calculator with country-specific rates. (8) Capital gains calculator (long-term vs short-term). (9) Deduction applier. (10) Effective tax rate calculator. (11) Marginal tax rate finder. (12) Render as text report (breakdown by bracket). (13) Render as CSV (bracket, rate, taxable_amount, tax). (14) Copy + Download .txt + Download CSV. (15) History (localStorage, last 20). (16) Shareable URL (encode inputs in hash). (17) Summary stats (gross, total tax, net, effective rate, marginal rate).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All tax calculation runs 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};

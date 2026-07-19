import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "loan-amortization-schedule",
  name: "Loan Amortization Schedule (Monthly, Bi-Weekly, Weekly)",
  description:
    "Generate full loan amortization schedules — monthly payment, principal/interest split, running balance, payoff date, and interest savings from extra payments. Standard amortization formula with monthly, bi-weekly, and weekly frequencies. Year-by-year summary for long loans. Export as text schedule or CSV. 17 extra features: 3 payment frequencies, monthly payment formula, per-payment interest calculator, per-payment principal calculator, balance tracker, extra-payment applier, total interest calculator, total paid calculator, payoff date estimator, text schedule renderer, CSV export, copy + download .txt + CSV, history (localStorage, last 20), shareable URL, summary stats, interest savings calculator (with vs without extra payment), year-by-year summary. 100% client-side.",
  category: "business",
  keywords: [
    "loan amortization", "amortization schedule",
    "monthly payment", "principal interest",
    "bi-weekly", "weekly", "extra payment",
    "payoff date", "interest savings", "mortgage calculator",
  ],
  icon: "landmark",
  requiresNetwork: false,
  seo: {
    title: "Loan Amortization Schedule — Monthly, Bi-Weekly, Weekly | UnQTools",
    faq: [
      {
        q: "How does the loan amortization calculator work?",
        a: "Enter your loan amount, annual interest rate (e.g. 6.5 for 6.5%), loan term in years, and a start date. Pick a payment frequency (monthly, bi-weekly, or weekly). The tool uses the standard amortization formula P × (r(1+r)^n) / ((1+r)^n − 1) to compute each periodic payment, then walks the schedule payment-by-payment, splitting each into interest (balance × rate per period) and principal (payment − interest + extra payment).",
      },
      {
        q: "How do extra payments reduce total interest?",
        a: "Each extra payment is applied directly to principal, which reduces the running balance faster. A lower balance means less interest accrues in subsequent periods, so the loan pays off sooner and total interest drops. The tool runs both scenarios (with and without the extra payment) and reports the interest savings and earlier payoff date.",
      },
      {
        q: "How are bi-weekly and weekly schedules computed?",
        a: "For bi-weekly, the periodic rate is annualRate / 26 / 100 and the number of payments is years × 26. For weekly, it is annualRate / 52 / 100 and years × 52. The amortization formula is the same; only r and n change. Payment dates advance by the appropriate number of days from the start date.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 3 payment frequency options (monthly, bi-weekly, weekly). (2) Monthly payment formula (standard amortization). (3) Per-payment interest calculator. (4) Per-payment principal calculator. (5) Balance tracker (running balance). (6) Extra-payment applier (reduces balance faster, saves interest). (7) Total interest calculator. (8) Total paid calculator. (9) Payoff date estimator. (10) Text schedule renderer (full amortization table). (11) CSV export (payment_num, date, payment, principal, interest, balance). (12) Copy + Download .txt + Download CSV. (13) History (localStorage, last 20). (14) Shareable URL (encode inputs in hash). (15) Summary stats (monthly payment, total interest, total paid, payoff date, interest savings). (16) Interest savings calculator (with vs without extra payment). (17) Year-by-year summary (aggregate per year for long loans).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All amortization calculations run 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};

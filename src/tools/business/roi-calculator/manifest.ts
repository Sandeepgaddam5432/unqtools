import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "roi-calculator",
  name: "ROI Calculator (ROI, Payback, NPV, IRR)",
  description:
    "Calculate Return on Investment, payback period, annualized ROI (geometric mean), Net Present Value (NPV) and Internal Rate of Return (IRR) via bisection. Enter initial investment, annual cash flows, discount rate, terminal value. Profitability check (NPV > 0 and IRR > discount rate). Export as text or CSV. 18 extra features: cash flow parser, total cash flow, net profit, ROI, annualized ROI, payback period (year+month), NPV, IRR (bisection), discount rate applier, terminal value applier, text report, CSV export, history (localStorage), shareable URL, summary stats, 5 ROI target presets, profitability indicator, copy & download. 100% client-side.",
  category: "business",
  keywords: [
    "roi", "return on investment", "roi calculator",
    "npv", "irr", "payback period", "annualized roi",
    "discount rate", "investment calculator", "capital budgeting",
  ],
  icon: "trending-up",
  requiresNetwork: false,
  seo: {
    title: "ROI Calculator — ROI, Payback, NPV, IRR | UnQTools",
    faq: [
      {
        q: "How does the ROI calculator work?",
        a: "Enter your initial investment and a list of annual cash flows (one per line, e.g. `5000\\n6000\\n7000\\n8000` for 4 years). Optionally set a discount rate (for NPV) and a terminal / salvage value at the end. The tool computes total cash flow, net profit, ROI, annualized ROI (geometric mean), payback period (with year + month precision), NPV, and IRR (via bisection method).",
      },
      {
        q: "How is IRR calculated?",
        a: "IRR is the discount rate at which NPV = 0. We use the bisection method between 0% and 1000% with up to 200 iterations and a tolerance of 1e-7, which gives a precise approximation for typical investment cash-flow streams. The tool reports `null` when no IRR exists (e.g. all cash flows are positive with no initial outflow, or no sign change exists).",
      },
      {
        q: "What is annualized ROI?",
        a: "Annualized ROI uses the geometric mean formula: ((totalCashFlow / initialInvestment) ^ (1 / years)) - 1. It converts a multi-year ROI into a per-year compound growth rate, making it easier to compare investments of different durations.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Annual cash flows parser. (2) Total cash flow calculator. (3) Net profit calculator. (4) ROI calculator (basic). (5) Annualized ROI calculator (geometric mean). (6) Payback period calculator (year + month precision). (7) NPV calculator (Net Present Value). (8) IRR calculator (bisection method). (9) Discount rate applier. (10) Terminal value applier. (11) Text report renderer. (12) CSV export (year, cash_flow, cumulative, discounted). (13) Copy + Download .txt + Download CSV. (14) History (localStorage, last 20). (15) Shareable URL (encode inputs in hash). (16) Summary stats (initial, total CF, net profit, ROI, annualized ROI, payback, NPV, IRR). (17) 5 ROI target presets (5%, 10%, 15%, 20%, 25%) for quick comparison. (18) Profitability indicator (profitable if NPV > 0 AND IRR > discount rate).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All ROI, NPV and IRR calculations run 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};

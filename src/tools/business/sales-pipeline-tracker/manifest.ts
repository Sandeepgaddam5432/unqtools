import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "sales-pipeline-tracker",
  name: "Sales Pipeline Tracker",
  description:
    "Track sales pipeline deals across 6 stages — lead, qualified, proposal, negotiation, closed-won, closed-lost. Compute weighted pipeline value, per-stage breakdown, win rate, average deal size, top deals, and stale-deal alerts. Filter by stage and expected close-date range. 100% client-side, with history (localStorage) and shareable URL. Includes 10+ extra features: deal parser with validation, stage presets with default probabilities, weighted value per deal, pipeline value, weighted pipeline, per-stage breakdown, win rate, average deal size, stage + date filters, text report, CSV export, top deals finder, stale deal detector.",
  category: "business",
  keywords: [
    "sales pipeline", "pipeline tracker", "crm",
    "deal tracker", "sales funnel", "win rate",
    "weighted pipeline", "sales forecast", "pipeline value",
  ],
  icon: "trending-up",
  requiresNetwork: false,
  seo: {
    title: "Sales Pipeline Tracker — Deals, Stages, Win Rate & Weighted Pipeline | UnQTools",
    faq: [
      {
        q: "How does the sales pipeline tracker work?",
        a: "Enter one deal per line in the form deal_name,customer,stage,amount,probability,expected_close_date. The tool parses the deals, classifies them by stage (lead, qualified, proposal, negotiation, closed-won, closed-lost), computes weighted pipeline value (amount × probability / 100), per-stage breakdowns, win rate, average deal size, top deals, and stale deals (open deals past their expected close date).",
      },
      {
        q: "What are the 6 pipeline stages and default probabilities?",
        a: "Lead (10%), Qualified (25%), Proposal (50%), Negotiation (75%), Closed Won (100%), Closed Lost (0%). If you omit the probability field for a deal, the stage default is used; if you provide one, your value wins (0–100).",
      },
      {
        q: "How are pipeline value and weighted pipeline calculated?",
        a: "Pipeline value is the sum of amounts of all OPEN deals (not yet closed-won or closed-lost). Weighted pipeline is the sum of each open deal's weighted value (amount × probability / 100). Closed-won and closed-lost deals are tracked separately for win-rate calculation.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Deal parser with field validation. (2) 6 stage presets with default probabilities. (3) Per-deal weighted value calculator. (4) Pipeline value calculator. (5) Weighted pipeline calculator. (6) Per-stage breakdown (count, amount, weighted). (7) Win rate calculator. (8) Average deal size calculator. (9) Stage filter. (10) Date range filter by expected close date. (11) Text report renderer. (12) CSV export. (13) Copy + Download .txt + Download CSV. (14) History (localStorage, last 20). (15) Shareable URL (deals encoded in hash). (16) Summary stats (total, pipeline, weighted, win rate, avg). (17) Top deals finder. (18) Stale deal detector (open deals past expected close date).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing and calculations run 100% in your browser. History is stored in localStorage on this device only. The share link encodes your inputs in the URL hash which never leaves the device unless you copy and send it yourself.",
      },
    ],
  },
  status: "done",
};

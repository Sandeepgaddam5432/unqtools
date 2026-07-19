import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "commission-tracker",
  name: "Sales Commission Tracker",
  description:
    "Track sales commissions per rep with four calculation models: flat-percent, tiered-percent (progressive brackets), base-plus-percent, and bonus-per-deal. Parse deals from CSV, compute per-rep totals, generate payout schedules (monthly/quarterly/annually), find top performers, detect commission caps, leaderboard, history (localStorage), shareable URL. 100% client-side.",
  category: "business",
  keywords: [
    "commission", "sales commission", "commission tracker",
    "tiered commission", "payout schedule", "sales rep",
    "bonus per deal", "quota", "commission calculator",
  ],
  icon: "badge-dollar-sign",
  requiresNetwork: false,
  seo: {
    title: "Sales Commission Tracker — Tiered, Flat & Bonus Payouts | UnQTools",
    faq: [
      {
        q: "How does the commission tracker work?",
        a: "Enter your commission model (flat percent, tiered percent with progressive brackets, base-plus-percent, or bonus-per-deal) and paste deals as CSV: deal_name,sales_rep,amount,close_date,status. The tool parses each line, calculates commission for closed-won deals only, aggregates per-rep totals, and generates a payout schedule grouped by month, quarter, or year based on close date.",
      },
      {
        q: "How is tiered commission calculated?",
        a: "Tiered commission uses progressive brackets. Example tiers '0,5\\n50000,10\\n100000,15' mean: first $50k at 5%, next $50k ($50k–$100k) at 10%, anything above $100k at 15%. So a $75k deal earns $2,500 + $2,500 = $5,000 — not $7,500 (which would be flat 10% of $75k).",
      },
      {
        q: "Can I export the commission report?",
        a: "Yes. Copy the text report to clipboard, download it as a .txt file, or download the full deal-level breakdown (with commission and payout period per row) as a CSV file ready for Excel or Google Sheets.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Deal parser with field validation. (2) Four commission type calculators (flat, tiered, base+percent, bonus-per-deal). (3) Progressive tiered brackets. (4) Per-rep totals (deals, amount, commission). (5) Payout schedule generator. (6) Three payout frequency presets (monthly/quarterly/annually). (7) Status filter (all/closed-won/closed-lost/open). (8) Top performer finder. (9) Average commission per deal. (10) Text report renderer. (11) CSV export. (12) Copy + Download .txt + Download CSV. (13) History (localStorage, last 20). (14) Shareable URL. (15) Summary stats. (16) Payout period formatter ('Q3 2026', 'July 2026', '2026'). (17) Commission cap detector (warns if commission exceeds deal amount). (18) Rep leaderboard sorted by commission.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All commission calculations run locally in your browser. Deal data never leaves this device. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

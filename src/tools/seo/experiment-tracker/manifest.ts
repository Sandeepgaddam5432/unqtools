import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "seo-experiment-tracker",
  name: "SEO Experiment Tracker",
  description:
    "Track SEO A/B experiments — title tag tests, meta description tests, content changes. Parse before/after CSV per page, compute deltas, % change, winners/losers/neutral, aggregate totals, basic statistical significance check, recommendation (roll out / roll back / extend), experiment status (planned/running/completed/paused), confidence score, filters, copy + download .txt + download CSV, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "seo experiment", "ab test seo", "seo test",
    "title tag test", "meta description test",
    "content test", "experiment tracker",
    "seo split test", "before after seo",
  ],
  icon: "flask-conical",
  requiresNetwork: false,
  seo: {
    title: "SEO Experiment Tracker — A/B Title/Meta/Content Tests | UnQTools",
    faq: [
      {
        q: "How does the SEO Experiment Tracker work?",
        a: "Paste before and after CSV data (one row per page: page,metric_value). The tool computes per-page deltas, % change, classifies winners/losers/neutral pages, calculates aggregate totals and averages, runs a basic significance check (winner count + magnitude of change), and produces a recommendation: roll out, roll back, or extend the test.",
      },
      {
        q: "What experiment types are supported?",
        a: "Five preset types: title-tag, meta-description, content-change, url-structure, and internal-linking. Each preset ships with a default hypothesis template. Control metric can be organic-traffic, rankings, clicks, impressions, or conversions.",
      },
      {
        q: "How is significance determined?",
        a: "Basic heuristic: if winners > losers AND average % change > +5%, the experiment is 'winning'. If losers > winners AND average % change < -5%, it's 'losing'. Otherwise 'inconclusive'. The confidence score (0-100) combines sample size (pages affected) and magnitude of change.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Before/after CSV parser with header detection. (2) Per-page delta calculator. (3) Per-page % change calculator. (4) Aggregate metrics (total, average). (5) Winners/losers/neutral categorizer. (6) Basic statistical significance checker. (7) Recommendation generator (roll out / roll back / extend). (8) Experiment status tracker (planned/running/completed/paused). (9) Experiment type presets (5 types). (10) Control metric presets (5 options). (11) Text report. (12) CSV export. (13) Copy + Download .txt + Download CSV. (14) History (localStorage, last 20). (15) Shareable URL. (16) Filter (winners/losers/all). (17) Summary stats. (18) Confidence score (0-100).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, scoring, and reporting happens locally in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

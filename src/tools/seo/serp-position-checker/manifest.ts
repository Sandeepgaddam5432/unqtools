import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "serp-position-checker",
  name: "SERP Position Checker",
  description:
    "Estimate SERP position for a keyword + URL from difficulty factors — position estimate, difficulty factors breakdown, recommendations, bulk keywords, position categories, export CSV, history (localStorage), shareable URL. 100% client-side, no API.",
  category: "seo",
  keywords: [
    "serp position", "rank estimate", "position estimate",
    "keyword difficulty", "ranking factors", "serp checker",
    "seo estimate", "ranking prediction",
  ],
  icon: "target",
  requiresNetwork: false,
  seo: {
    title: "SERP Position Checker — Estimate Rankings from Difficulty Factors | UnQTools",
    faq: [
      {
        q: "How does this SERP position checker estimate ranking?",
        a: "There is no live SERP API. We compute an algorithmic position estimate from on-page factors (URL match, title keyword presence, content depth), authority signals (domain strength, backlink count), and keyword difficulty. The estimate is a directional indicator — not a live rank reading.",
      },
      {
        q: "What factors are used in the estimate?",
        a: "(1) URL keyword match (exact, partial, none). (2) Title-tag keyword presence. (3) Content depth estimate. (4) Domain authority (0-100). (5) Backlink count. (6) Keyword difficulty (0-100). (7) Search intent match. Each factor contributes a weighted position adjustment.",
      },
      {
        q: "What are the position categories?",
        a: "Top 3 (positions 1-3), Top 10 (4-10), Top 20 (11-20), Top 50 (21-50), Top 100 (51-100), and Beyond 100 (unlikely to rank). The category drives the recommendation set.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Position estimate (1-100+). (2) Difficulty factor breakdown (7 weighted factors). (3) Actionable recommendations per factor. (4) Bulk keyword input. (5) URL match check (exact / partial / none). (6) Position categories (Top 3 / Top 10 / Top 20 / Top 50 / Top 100 / Beyond). (7) CSV export. (8) History snapshot (last 20 sessions, localStorage). (9) Shareable URL. (10) Ranking factors reference card. (11) Per-keyword difficulty score. (12) Intent classification (informational / commercial / transactional).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All estimation runs locally in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "crawl-budget-estimator",
  name: "Crawl Budget Estimator",
  description:
    "Estimate Googlebot crawl budget from site metrics and get prioritized optimization recommendations. Heuristic crawl rate, efficiency %, time-to-full-crawl, score visualization, comparison mode, site size presets, CSV export, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "crawl budget", "googlebot", "crawl rate",
    "crawl efficiency", "seo crawler", "ttfb",
    "faceted nav", "duplicate content", "crawl errors",
  ],
  icon: "gauge",
  requiresNetwork: false,
  seo: {
    title: "Crawl Budget Estimator — Googlebot Heuristics + Recommendations | UnQTools",
    faq: [
      {
        q: "How does the crawl budget estimator work?",
        a: "Enter your site metrics — total pages, average page size, server response time, crawl errors %, duplicate content %, and faceted-nav URL count. The tool estimates the effective crawl budget using a faceted-nav penalty, computes a heuristic crawl rate (pages/min), crawl efficiency %, and time to full crawl, then generates prioritized recommendations.",
      },
      {
        q: "What formula is used?",
        a: "Effective budget = totalPages × (1 − duplicatePct/100) × (1 − facetPenalty), where facetPenalty = min(facetUrlCount/totalPages, 0.5). Crawl rate (pages/min) = 60000 / (avgServerResponseMs + avgPageSizeKb/10). Efficiency = budget / totalPages × 100. These are heuristics, not Google's actual algorithm.",
      },
      {
        q: "What recommendations does the tool suggest?",
        a: "Six rules: canonical tags for duplicate content, robots.txt blocks for faceted nav params, TTFB optimization, image/Brotli compression for large pages, GSC crawl error fixes, and internal-linking improvements when efficiency is below 70%.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Input validation. (2) Crawl budget formula with faceted-nav penalty. (3) Crawl rate estimation (pages/min). (4) Crawl efficiency %. (5) Time-to-full-crawl estimate. (6) Recommendation generator (6 rules). (7) Score visualization 0-100 with color. (8) Text report renderer. (9) CSV renderer. (10) Copy + Download .txt + Download CSV. (11) History (localStorage, last 20). (12) Shareable URL. (13) Site size presets (small/medium/large/enterprise). (14) Comparison mode (current vs optimized inputs).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All calculations run locally in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

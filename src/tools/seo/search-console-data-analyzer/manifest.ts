import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "search-console-data-analyzer",
  name: "Search Console Data Analyzer",
  description:
    "Analyze Google Search Console CSV exports (URL, Query, Clicks, Impressions, CTR, Position). Aggregate by URL and query, identify top pages/queries, find high-impression low-CTR opportunities, striking-distance keywords (positions 5-15), low-position high-impression pages, high-position low-impression pages, generate optimization recommendations, summary stats, filters, copy + download .txt + download CSV, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "search console", "gsc", "google search console",
    "search analytics", "ctr analysis", "position analysis",
    "keyword opportunities", "striking distance",
    "seo analyzer", "gsc export",
  ],
  icon: "bar-chart-3",
  requiresNetwork: false,
  seo: {
    title: "Search Console Data Analyzer — GSC CSV Insights | UnQTools",
    faq: [
      {
        q: "How does the Search Console Data Analyzer work?",
        a: "Paste your Google Search Console CSV export (columns: URL, Query, Clicks, Impressions, CTR, Position). The tool parses each row, aggregates by URL and by query, then identifies opportunities: high-impression low-CTR queries (CTR < 2% with > 1000 impressions — improve titles/meta), striking-distance keywords (positions 5-15 — close to page 1), low-position high-impression pages (page 2+ opportunities), and high-position low-impression pages (page 1 with low volume to expand).",
      },
      {
        q: "What columns does the CSV need?",
        a: "Header row with case-insensitive column names: URL, Query, Clicks, Impressions, CTR (percentage, e.g. 3.0), Position (average SERP position, e.g. 8.5). If the CTR column is missing, the tool calculates CTR = clicks / impressions × 100 automatically.",
      },
      {
        q: "What recommendations does it generate?",
        a: "Four rule-based recommendations: (1) high-impression low-CTR → improve title tag and meta description; (2) low-position high-impression → improve content depth; (3) striking-distance keywords → add internal links + optimize; (4) high-position low-impression → expand content with related keywords.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) CSV parser with case-insensitive header detection. (2) Record validator (numeric checks, position > 0). (3) URL aggregator (per-page totals + averages). (4) Query aggregator (per-query totals + averages). (5) Top pages list (by clicks). (6) Top queries list (by clicks). (7) High-impression low-CTR finder. (8) Striking-distance keyword finder (positions 5-15). (9) Low-position high-impression finder. (10) High-position low-impression finder. (11) Recommendation generator. (12) Text report. (13) CSV export. (14) Copy + Download .txt + Download CSV. (15) History (localStorage, last 20). (16) Shareable URL. (17) Filter by opportunity type. (18) Summary stats. (19) CTR calculator (when CTR column missing).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, aggregation, and recommendation logic runs locally in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

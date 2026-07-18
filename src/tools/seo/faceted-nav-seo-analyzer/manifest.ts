import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "faceted-nav-seo-analyzer",
  name: "Faceted Nav SEO Analyzer",
  description:
    "Analyze faceted navigation URLs for SEO issues: duplicate content risk, parameter bloat, and crawl waste. Groups URLs by base path, counts parameter combinations, detects >10-combination bloat, flags duplicate-content (same params, different order), and generates canonical + robots.txt recommendations. 100% client-side, 15 extra features.",
  category: "seo",
  keywords: [
    "faceted navigation", "facet nav", "url parameters",
    "duplicate content", "canonical", "robots.txt",
    "crawl budget", "seo audit", "parameter bloat",
  ],
  icon: "filter",
  requiresNetwork: false,
  seo: {
    title: "Faceted Nav SEO Analyzer — Duplicate Content + Parameter Bloat | UnQTools",
    faq: [
      {
        q: "How does the faceted nav analyzer work?",
        a: "Paste faceted URLs (one per line). The tool parses each URL, strips the query string to detect the base path, groups URLs by base path, counts unique parameter combinations per base path, flags paths with >10 combinations as 'parameter bloat', and detects duplicate-content risk when the same parameter values appear in different orders. Each URL then receives a canonical recommendation (self-canonical, canonical-to-base, or block in robots.txt).",
      },
      {
        q: "What is duplicate-content risk in faceted nav?",
        a: "Two URLs that share the same base path and the same set of query parameter key-value pairs (even if the parameters appear in different order) produce identical or near-identical content. Search engines may treat these as duplicates and split ranking signals. The analyzer detects this and recommends a canonical-to-base strategy.",
      },
      {
        q: "What canonical recommendations does it generate?",
        a: "Three modes: (1) self-canonical for unique, indexable URLs; (2) canonical-to-base when duplicate-content risk is detected on a base path (point all variations back to the parameterless base URL); (3) block in robots.txt when parameter bloat exceeds 10 combinations per base path (block crawling of those parameter combinations).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) URL parsing with parameter extraction. (2) Base-path grouping (without query string). (3) Parameter combination counter per base path. (4) Parameter bloat detection (>10 combinations). (5) Duplicate-content risk detection (same params, different order). (6) Canonical recommendation generator (3 modes). (7) Robots.txt block suggestions (Disallow rules). (8) URL parameter table (param name → distinct values count). (9) Text report rendering. (10) CSV export (url, base_path, params, recommendation). (11) Copy + Download .txt + Download CSV. (12) History (localStorage, max 20). (13) Shareable URL (encode URLs in hash). (14) Filter by recommendation type. (15) Summary stats (total URLs, base paths, params, recommendations).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All URL parsing, grouping, and recommendation logic runs locally in your browser. History is stored in localStorage on this device only. No network calls.",
      },
    ],
  },
  status: "done",
};

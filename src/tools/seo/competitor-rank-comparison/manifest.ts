import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "competitor-rank-comparison",
  name: "Competitor Rank Comparison",
  description:
    "Compare your keyword rankings against competitors (up to 5). Side-by-side table, opportunity detection (where you rank worse), keyword overlap, avg position per domain, winner per keyword, export CSV, copy report, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "competitor rank", "rank comparison", "serp comparison",
    "competitor analysis", "opportunity detection", "keyword overlap",
    "winner per keyword", "seo competitors",
  ],
  icon: "swords",
  requiresNetwork: false,
  seo: {
    title: "Competitor Rank Comparison — Side-by-Side SERP Analysis | UnQTools",
    faq: [
      {
        q: "How does the comparison work?",
        a: "Provide your domain, up to 5 competitor domains, and a shared keyword list with positions for each domain. The tool builds a side-by-side ranking table, detects opportunities (keywords where you rank worse than a competitor), computes keyword overlap, average position per domain, and identifies the winner per keyword.",
      },
      {
        q: "What input format does it accept?",
        a: "CSV with header `keyword,your_domain,competitor1,competitor2,…`. Each row has the keyword followed by positions for each domain (1-100, blank = not ranking). Or use a domain:position pair format per row.",
      },
      {
        q: "What counts as an opportunity?",
        a: "Any keyword where you either don't rank (position 0 or blank) but at least one competitor does, or where your position is worse (higher number) than a competitor's. Each opportunity includes the competitor you're losing to and the gap.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Multi-competitor support (up to 5). (2) Side-by-side ranking table. (3) Opportunity detection (you rank worse). (4) Keyword overlap analysis. (5) Stats per domain (avg position, keyword count, top 10 count). (6) Export CSV. (7) Copy report. (8) History snapshot (localStorage, last 20). (9) Shareable URL. (10) Winner per keyword identification. (11) Gap calculation. (12) Domain ranking leaderboard.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All comparison runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

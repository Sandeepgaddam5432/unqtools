import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "rank-change-visualizer",
  name: "Rank Change Visualizer",
  description:
    "Visualize ranking changes over time from pasted rank history. Compute per-keyword changes, build a timeline, identify biggest gains/drops, average position trend, stats table, export markdown, copy report, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "rank change", "ranking timeline", "rank history", "seo visualization",
    "biggest gains", "biggest drops", "position trend", "rank report",
    "markdown export", "rank diff",
  ],
  icon: "line-chart",
  requiresNetwork: false,
  seo: {
    title: "Rank Change Visualizer — Timeline + Biggest Gains & Drops | UnQTools",
    faq: [
      {
        q: "How does the visualizer work?",
        a: "Paste rank history rows (date, keyword, position). The tool computes per-keyword changes between consecutive entries, builds a date-by-keyword timeline, identifies the biggest gains and drops, computes the average position trend across dates, and renders a stats table. All in-browser — no API.",
      },
      {
        q: "What input format does it accept?",
        a: "CSV-style rows with a header row `date,keyword,position` (or `keyword,position,date`). Headerless rows in the order `date,keyword,position` are also accepted. Dates must be `yyyy-mm-dd`.",
      },
      {
        q: "How are gains and drops calculated?",
        a: "For each keyword, we sort entries by date and compute the change between the first and last entry. A positive change means your position number dropped (you climbed the SERPs). The biggest gains / biggest drops lists show the top 10 keywords by absolute change.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Date-by-keyword timeline view. (2) Biggest gains list (top 10). (3) Biggest drops list (top 10). (4) Average position trend per date. (5) Keyword filter. (6) Date range filter. (7) Full stats table. (8) Markdown export. (9) Copy report. (10) History snapshot (last 20 sessions, localStorage). (11) Shareable URL. (12) CSV export of the timeline.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All computation runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

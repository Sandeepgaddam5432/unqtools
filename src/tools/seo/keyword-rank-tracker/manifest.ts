import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "keyword-rank-tracker",
  name: "Keyword Rank Tracker",
  description:
    "Track keyword rankings over time — import keyword + position + date, compute rank changes, best/worst positions, average position, generate chart data, export CSV, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "keyword rank", "rank tracker", "serp rank", "position tracking",
    "rank change", "average position", "best position", "rank history",
    "csv import", "seo tracking",
  ],
  icon: "trending-up",
  requiresNetwork: false,
  seo: {
    title: "Keyword Rank Tracker — Track SERP Positions Over Time | UnQTools",
    faq: [
      {
        q: "How does this rank tracker work?",
        a: "You enter keyword + position + date rows (or paste a CSV). The tracker stores history per keyword, computes the latest rank change (+/- vs previous entry), best/worst positions, and the average position. Everything stays in your browser — there is no live SERP API.",
      },
      {
        q: "What CSV format does the importer accept?",
        a: "Either headerless rows in the order `keyword,position,date` or a CSV with a header row containing columns named keyword/position/date (date, rank, url columns are also recognized). The parser auto-detects the format.",
      },
      {
        q: "How are rank changes calculated?",
        a: "Each keyword's history is sorted by date ascending. The change is the previous entry's position minus the latest entry's position — a positive number means you climbed the SERPs (your position number went down).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Add/remove keywords. (2) Full position history per keyword. (3) Rank change (+/-) vs previous entry. (4) Best/worst position per keyword. (5) Average position per keyword. (6) CSV import. (7) CSV export. (8) Chart-ready data (sorted date/position pairs). (9) History snapshot in localStorage (last 20 sessions). (10) Shareable URL with keyword+position+date payload. (11) Bulk keyword filter. (12) Stats summary (keywords tracked, total entries, best mover, biggest drop).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All rank data lives in your browser. History is stored in localStorage on this device only and never uploaded.",
      },
    ],
  },
  status: "done",
};

import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "local-rank-tracker",
  name: "Local Rank Tracker",
  description:
    "Track local SEO rankings across keywords and locations. Build a keyword x location tracking matrix, compute visibility scores (weighted local pack 60% + organic 40%), categorize positions (top pack / below pack / page 1 / page 2 / off-page), averages per keyword and per location, best/worst combos, CSV template generator, copy + download .txt + download CSV, history (localStorage), shareable URL, filters, summary stats. 100% client-side.",
  category: "seo",
  keywords: [
    "local seo", "rank tracker", "local rank",
    "local pack", "local rankings", "geo rank",
    "rank tracking", "keyword position",
  ],
  icon: "map-pin",
  requiresNetwork: false,
  seo: {
    title: "Local Rank Tracker — Local Pack & Organic Positions | UnQTools",
    faq: [
      {
        q: "How does the local rank tracker work?",
        a: "Enter your keywords and locations (one per line). The tool builds a tracking matrix of every keyword x location combination. Provide manual entries as CSV (keyword,location,local_pack_pos,organic_pos,date) or generate an empty tracking template you can fill in over time. For each entry, the tool computes a weighted visibility score combining local-pack position (60%) and organic position (40%).",
      },
      {
        q: "How is the visibility score calculated?",
        a: "Position 1 = 100 points, position 2 = 90, position 3 = 80, ... down to position 10 = 10, and positions beyond 10 (or unranked) = 0. The final visibility score is 60% local pack + 40% organic. So a #1 local pack (#100) and #5 organic (#60) = 60 + 24 = 84.",
      },
      {
        q: "What position categories are used?",
        a: "Local pack: top pack (1-3) or below pack (4+). Organic: page 1 (1-10), page 2 (11-20), or off-page (> 20). The filter lets you isolate top-pack-only or page-1-only entries.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Keyword + location parsing. (2) Tracking matrix generation (keyword x location). (3) Weighted visibility score. (4) Position categorization. (5) Average visibility per keyword. (6) Average visibility per location. (7) Best/worst performing combos. (8) Text report. (9) CSV export. (10) Copy + Download .txt + Download CSV. (11) History (localStorage, last 20). (12) Shareable URL. (13) Filter (top pack / page 1 / all). (14) Summary stats. (15) CSV tracking template generator.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, scoring, and reporting happens locally in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "content-gap-analyzer",
  name: "Content Gap Analyzer",
  description:
    "Compare your content against up to 3 competitors to find keyword gaps (in competitors but not in yours) and unique keywords (in yours but not in theirs). Includes overlap %, priority scoring, CSV/Markdown export. 100% client-side.",
  category: "seo",
  keywords: [
    "content gap", "keyword gap", "competitor analysis", "seo audit",
    "topical gap", "content strategy", "keyword overlap", "competitor research",
  ],
  icon: "git-compare",
  requiresNetwork: false,
  seo: {
    title: "Content Gap Analyzer — Competitor Keyword Comparison | UnQTools",
    faq: [
      {
        q: "What is a content gap?",
        a: "A content gap is a topic or keyword that your competitors rank for (or cover in their content) but you don't. Finding gaps helps you identify content opportunities — pages you should write or expand to capture traffic your competitors are getting.",
      },
      {
        q: "How many competitors can I compare?",
        a: "Up to 3 simultaneously. Comparing more than 3 dilutes the signal — the keywords all 3 competitors share that you don't have are the highest-priority gaps.",
      },
      {
        q: "How is priority calculated?",
        a: "Priority is a 0-100 score. Each gap gets: (number of competitors covering it × 25) + min(25, total count across competitors). So a gap covered by all 3 competitors with high frequency scores near 100. A gap in only 1 competitor with count 1 scores ~26.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Multi-competitor comparison (up to 3). (2) Keyword overlap percentage. (3) Gap priority scoring (0-100). (4) Unique keyword detection (in yours not in competitors). (5) Shared keyword list. (6) Stop word filtering (English). (7) Custom exclude words. (8) CSV export. (9) Markdown report export. (10) Visual diff summary + history (localStorage, last 20) + shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All comparison runs locally — your content and competitor content never leave your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "backlink-gap-analyzer",
  name: "Backlink Gap Analyzer",
  description:
    "Find backlinks your competitors have but you don't. Multi-competitor support (up to 3), gap detection, opportunity scoring, shared backlinks, top opportunities sorted by DA, export CSV, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "backlink gap", "link gap", "competitor backlinks",
    "backlink opportunities", "link building gap", "competitor link analysis",
    "missing backlinks",
  ],
  icon: "gap",
  requiresNetwork: false,
  seo: {
    title: "Backlink Gap Analyzer — Find Competitor Backlinks You're Missing | UnQTools",
    faq: [
      {
        q: "How does the gap analysis work?",
        a: "Paste your backlinks and up to 3 competitors' backlinks (CSV or JSON). The tool finds domains linking to competitors but not to you, scores each opportunity by DA and the number of competitors linking to it, and sorts the best opportunities to the top.",
      },
      {
        q: "How is opportunity score calculated?",
        a: "Each gap backlink gets a score 0-100: base = DA × 0.6, plus 20 if 2 competitors link to it, plus 30 if all 3 link to it (consensus = stronger signal). The score helps prioritize outreach targets.",
      },
      {
        q: "What input format does it accept?",
        a: "CSV with header `url,anchor,source_domain,da,link_type` (or any subset) or JSON array of objects. Each competitor gets its own panel.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Multi-competitor support (up to 3). (2) Gap detection (you don't, competitor does). (3) Opportunity scoring. (4) Shared backlinks (all domains link). (5) Stats per competitor. (6) CSV export. (7) Top opportunities sorted. (8) History (localStorage, last 20). (9) Shareable URL. (10) Domain-authority sort. (11) Per-competitor unique count. (12) Domain overlap matrix.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All analysis runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

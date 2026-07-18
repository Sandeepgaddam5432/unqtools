import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "lost-new-backlink-tracker",
  name: "Lost & New Backlink Tracker",
  description:
    "Track lost and new backlinks by comparing two data exports. Compute diff (new, lost, kept), percentage change, anchor text analysis for new/lost, export CSV, copy report, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "lost backlinks", "new backlinks", "backlink diff",
    "backlink comparison", "backlink tracker", "lost link alert",
    "new link alert", "backlink export",
  ],
  icon: "git-compare",
  requiresNetwork: false,
  seo: {
    title: "Lost & New Backlink Tracker — Compare Backlink Exports | UnQTools",
    faq: [
      {
        q: "How does the diff work?",
        a: "Paste your previous backlink export and current export (CSV or JSON). The tool identifies backlinks present in both (kept), only in previous (lost), and only in current (new). The diff is computed by URL — case-insensitive, trailing slash normalized.",
      },
      {
        q: "What input format does it accept?",
        a: "CSV with header `url,anchor,source_domain,da,link_type` (any subset works) or JSON array of objects. Both previous and current panels accept the same format.",
      },
      {
        q: "How is percentage change calculated?",
        a: "New % = new_count / previous_total × 100. Lost % = lost_count / previous_total × 100. Net change = new_count − lost_count.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Diff calculation (new/lost/kept). (2) New backlinks list. (3) Lost backlinks list. (4) Kept backlinks list. (5) Stats (counts). (6) Percentage change. (7) CSV export. (8) Copy report. (9) History (localStorage, last 20). (10) Shareable URL. (11) Anchor text analysis for new/lost. (12) Top movers by DA.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All diffing runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

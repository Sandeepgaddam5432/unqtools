import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "backlink-profile-analyzer",
  name: "Backlink Profile Analyzer",
  description:
    "Analyze imported backlink data (CSV/JSON). Total backlinks, unique domains, anchor distribution, dofollow/nofollow ratio, link-type distribution, top referring domains, top anchor texts, toxic link flagging (low DA), CSV/JSON import, report export, history, shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "backlink analysis", "backlink profile", "anchor text", "dofollow",
    "nofollow", "domain authority", "referring domains", "toxic links",
  ],
  icon: "link",
  requiresNetwork: false,
  seo: {
    title: "Backlink Profile Analyzer — CSV/JSON Import, Toxic Flagging | UnQTools",
    faq: [
      {
        q: "How do I import my backlink data?",
        a: "Paste your backlink data as CSV or JSON. CSV requires columns: url, anchor, source_domain, da, link_type (dofollow/nofollow). JSON should be an array of objects with the same fields. Export from Ahrefs, Semrush, Moz, or Search Console and paste here.",
      },
      {
        q: "What does the analyzer compute?",
        a: "Total backlinks, unique referring domains, dofollow vs nofollow ratio, anchor text distribution (top 20), top referring domains (by count), domain authority distribution (low/medium/high), link-type breakdown, and a toxic-link flag list (DA < 20).",
      },
      {
        q: "How is a backlink flagged as toxic?",
        a: "Any backlink with Domain Authority (DA) below 20 is flagged as potentially toxic. You can adjust this threshold in the UI. Low-DA links from spammy sites can hurt your rankings — review flagged links in Google Search Console and consider disavowing them.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) CSV import. (2) JSON import. (3) Anchor text analysis (top 20 + distribution). (4) Dofollow/nofollow ratio. (5) Domain authority distribution. (6) Top referring domains. (7) Top anchor texts. (8) Export report as CSV. (9) History (localStorage, last 20). (10) Shareable URL. (11) Toxic link flagging (configurable DA threshold).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing and analysis runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

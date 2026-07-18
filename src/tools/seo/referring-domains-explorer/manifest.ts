import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "referring-domains-explorer",
  name: "Referring Domains Explorer",
  description:
    "Explore referring domains from imported backlink data. Extract unique referring domains, link count per domain, top domains ranking, domain authority estimate, TLD distribution, anchor text per domain. CSV export, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "referring domains", "backlinks", "domain explorer",
    "link profile", "domain authority", "tld distribution",
    "backlink audit",
  ],
  icon: "globe",
  requiresNetwork: false,
  seo: {
    title: "Referring Domains Explorer — Extract Unique Domains | UnQTools",
    faq: [
      {
        q: "What does the Referring Domains Explorer do?",
        a: "Paste backlink data (source URL, target URL, optional anchor and DA) and the tool extracts unique referring domains, ranks them by link count, estimates domain authority, computes TLD distribution, and lists anchors per domain. No network calls — all parsing happens in your browser.",
      },
      {
        q: "How is domain authority estimated when I don't provide DA values?",
        a: "We use a transparent heuristic: .gov and .edu domains get 80, common TLDs (.com/.org/.net/.io/.co) get 50, suspicious TLDs (.xyz/.top/.online) get 15, and other TLDs default to 30. When you provide DA values in your CSV, we average them per domain and use that instead.",
      },
      {
        q: "What input format does it accept?",
        a: "CSV with header (source_url, target_url, anchor, da) or headerless rows in that same column order. Tab-separated values also work.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Unique domain extraction. (2) Link count per domain. (3) Top domains ranking. (4) Algorithmic DA estimate. (5) TLD distribution. (6) Anchor text per domain. (7) CSV export. (8) Plain-text report copy. (9) History (localStorage, last 20). (10) Shareable URL — encode input in fragment.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All extraction runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

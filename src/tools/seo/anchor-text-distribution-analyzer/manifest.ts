import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "anchor-text-distribution-analyzer",
  name: "Anchor Text Distribution Analyzer",
  description:
    "Analyze anchor text distribution from backlink data. Categorize anchors as exact/partial match, branded, generic, naked URL, or image. Compute distribution %, warn on over-optimization, and export. 100% client-side.",
  category: "seo",
  keywords: [
    "anchor text", "backlink analysis", "link profile",
    "over-optimization", "penguin", "exact match", "branded anchor",
  ],
  icon: "link-2",
  requiresNetwork: false,
  seo: {
    title: "Anchor Text Distribution Analyzer — Link Profile Audit | UnQTools",
    faq: [
      {
        q: "What is anchor text distribution?",
        a: "It's the breakdown of anchor text categories across your backlinks: exact match (whole anchor = keyword), partial match (anchor contains keyword), branded (anchor contains brand name), generic ('click here', 'read more'), naked URL, and image. A natural link profile is heavily branded with low exact-match.",
      },
      {
        q: "What's a healthy anchor text distribution?",
        a: "Rough benchmarks: 30-60% branded, 5-20% naked URL, 5-20% generic, 5-20% partial match, 0-10% exact match, 0-20% image. Exact match anchors above 10-30% risk a Google Penguin-style over-optimization flag. Branded anchors should dominate.",
      },
      {
        q: "How do I get my backlink data?",
        a: "Export from Google Search Console (Links → Top linking sites → Export), Ahrefs (Site Explorer → Backlinks → Export), Semrush (Backlink Analytics → Export), or Majestic. Most tools export CSV — copy the URL + anchor columns and paste them here as 'URL | anchor' or 'URL\\tanchor' (one per line).",
      },
      {
        q: "Why does over-optimization matter?",
        a: "Google's Penguin algorithm (2012, integrated into core 2016) targets sites with unnatural anchor text profiles — particularly excessive exact-match anchors. A profile that's 60% exact-match for 'best running shoes' looks manipulated, not earned. Diversify by building more branded and naked-URL anchors.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Six-way categorization (exact/partial/branded/generic/naked/image). (2) Distribution chart data with colors. (3) Over-optimization warning (>50% exact match). (4) Low-branded-ratio warning. (5) Dedup of identical URL+anchor pairs. (6) Stats per category. (7) CSV export. (8) Top 10 anchors by frequency. (9) History (localStorage, last 20). (10) Shareable URL — encode form in fragment.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All categorization and analysis runs locally. History is stored in localStorage on this device only. We don't fetch your backlinks — you paste them.",
      },
    ],
  },
  status: "done",
};

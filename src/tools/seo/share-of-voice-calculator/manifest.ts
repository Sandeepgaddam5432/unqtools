import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "share-of-voice-calculator",
  name: "Share of Voice Calculator",
  description:
    "Calculate SEO Share of Voice from keyword rankings + search volumes. Visibility score (0-100), position weighting (top 3 > top 10), competitor comparison, weighted by volume, bulk input, export CSV, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "share of voice", "sov", "visibility score", "seo visibility",
    "competitor comparison", "rank weighted", "search volume weighted",
    "market share seo",
  ],
  icon: "pie-chart",
  requiresNetwork: false,
  seo: {
    title: "Share of Voice Calculator — SEO Visibility Score | UnQTools",
    faq: [
      {
        q: "What is SEO Share of Voice?",
        a: "Share of Voice (SOV) is the percentage of total search visibility your domain captures across a keyword set. We weight each keyword by its search volume and apply a position-based click-through curve (top 3 get the lion's share, top 10 still counts, beyond 50 contributes nothing).",
      },
      {
        q: "How is the visibility score computed?",
        a: "For each keyword, your visibility contribution = search_volume × position_weight(your_position). Position weights follow an industry-standard CTR curve: position 1 = 1.00, position 2 = 0.85, position 3 = 0.70, positions 4-10 = 0.50 down to 0.20, positions 11-50 = 0.05 down to 0.01, beyond 50 = 0. Your SOV % = your_visibility / sum(all_competitors_visibility).",
      },
      {
        q: "How do I compare competitors?",
        a: "Add competitor rows alongside yours: `keyword,your_position,competitor_a_position,competitor_b_position,search_volume`. The calculator computes per-competitor SOV, weighted visibility, and a side-by-side comparison.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) SOV % calculation per domain. (2) Visibility score 0-100. (3) Competitor comparison (up to 5). (4) Search-volume weighting. (5) Position-based weighting (top 3 > top 10). (6) Bulk keyword input. (7) Per-keyword visibility breakdown. (8) Stats summary (avg position, total volume tracked). (9) CSV export. (10) History snapshot (last 20 sessions, localStorage). (11) Shareable URL. (12) Leader identification per keyword.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All SOV calculation runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

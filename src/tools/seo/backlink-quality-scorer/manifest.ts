import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "backlink-quality-scorer",
  name: "Backlink Quality & Toxicity Scorer",
  description:
    "Score backlinks for quality and toxicity from imported data. Quality score 0-100, toxicity flag (spam score, low DA, exact-match anchor), categorize (good/suspicious/toxic), stats per category, top toxic links, DA distribution, bulk import, CSV export, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "backlink quality", "toxic backlinks", "spam score",
    "backlink audit", "link quality score", "toxicity check",
    "backlink scorer", "disavow list",
  ],
  icon: "shield-alert",
  requiresNetwork: false,
  seo: {
    title: "Backlink Quality & Toxicity Scorer — Score 0-100 | UnQTools",
    faq: [
      {
        q: "How does the quality scorer work?",
        a: "Each backlink is scored 0-100 based on domain authority, spam score, anchor text type (branded vs exact-match), link type (dofollow vs nofollow), and topical relevance proxies. The score combines into a quality number, and a separate toxicity flag is set when spam score is high, DA is very low, or the anchor is exact-match commercial.",
      },
      {
        q: "How is the toxicity flag set?",
        a: "A backlink is flagged toxic when ANY of: spam score ≥ 60, DA < 10, or anchor is exact-match commercial keyword. It's flagged suspicious when spam score ≥ 30, DA < 25, or anchor is over-optimized (keyword-rich but not branded). Otherwise it's good.",
      },
      {
        q: "What input format does it accept?",
        a: "CSV with header `url,anchor,source_domain,da,spam_score,link_type` (or JSON array of objects). The parser auto-detects format and tolerates missing columns.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Quality score 0-100. (2) Toxicity detection (spam score, low DA, exact-match anchor). (3) Categories: good / suspicious / toxic. (4) Stats per category. (5) Bulk import (CSV or JSON). (6) CSV export. (7) Top toxic links list. (8) History (localStorage, last 20). (9) Shareable URL. (10) DA distribution histogram. (11) Anchor type classification (branded / exact / partial / generic). (12) Per-link recommendation.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All scoring runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

/**
 * Keyword Density Analyzer (SEO 13) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "keyword-density-analyzer-seo",
  name: "Keyword Density Analyzer (SEO 13)",
  description: "Analyze keyword density in content. Single, 2-word, 3-word phrase frequency with stopword filtering.",
  category: "network-security",
  keywords: ["keyword density", "content analysis", "seo density", "phrase frequency"],
  icon: "BarChart3",
  requiresNetwork: false,
  seo: {
    title: "Keyword Density Analyzer (SEO 13) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Analyze keyword density in content. Single, 2-word, 3-word phrase frequency with stopword filtering." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Single-word density, (2) (2) 2-word phrase density, (3) (3) 3-word phrase density, (4) (4) Stopword filtering (5 languages), (5) (5) Stemming, (6) (6) Position weighting, (7) (7) Title/H1/H2/body analysis, (8) (8) Ideal density recommendations, (9) (9) Bulk content analysis, (10) (10) CSV export, (11) (11) Copy report, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};

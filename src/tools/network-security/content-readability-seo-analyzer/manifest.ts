/**
 * Content Readability & SEO Score Analyzer — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "content-readability-seo-analyzer",
  name: "Content Readability & SEO Score Analyzer",
  description: "Analyze content readability (Flesch-Kincaid, Gunning Fog) and SEO score. Recommendations for improvement.",
  category: "network-security",
  keywords: ["readability", "flesch kincaid", "gunning fog", "seo score"],
  icon: "Gauge",
  requiresNetwork: false,
  seo: {
    title: "Content Readability & SEO Score Analyzer — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Analyze content readability (Flesch-Kincaid, Gunning Fog) and SEO score. Recommendations for improvement." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Flesch Reading Ease, (2) (2) Flesch-Kincaid Grade, (3) (3) Gunning Fog Index, (4) (4) SMOG, (5) (5) Coleman-Liau, (6) (6) Average sentence length, (7) (7) Complex word percentage, (8) (8) SEO score (0-100), (9) (9) Keyword density check, (10) (10) Meta description length, (11) (11) Title tag check, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};

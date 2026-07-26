/**
 * SEO Content Scorecard Audit — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "seo-content-scorecard-audit",
  name: "SEO Content Scorecard Audit",
  description:
    "Unified, transparent on-page SEO audit of pasted content or HTML — combining title/meta, headings, keyword coverage, content depth, links, images/alt, schema, and readability into a prioritized, evidence-backed scorecard. 100% client-side.",
  category: "seo",
  keywords: ["seo content audit tool", "on-page seo checker", "content score tool free", "seo scorecard", "content quality audit"],
  icon: "BarChart3",
  requiresNetwork: false,
  seo: {
    title: "SEO Content Scorecard & Audit — Transparent, Prioritized, Exportable | UnQTools",
    faq: [
      { q: "What does the SEO Content Scorecard audit?", a: "It scores 8 transparent sub-areas — title/meta, headings, keyword coverage, content depth, internal/external links, images/alt, schema/structured data, and readability. Each sub-score shows the rule and the evidence, not a black-box number." },
      { q: "How is the overall score calculated?", a: "Each sub-area is weighted: title/meta 15%, headings 15%, keyword coverage 20%, content depth 15%, links 10%, images/alt 10%, schema 10%, readability 5%. The overall score is the weighted sum. We surface every rule so you can see exactly why points were lost." },
      { q: "What extras does this tool include?", a: "Extras: (1) Overall score dial + 8 sub-score bars, (2) Prioritized fix list (high/medium/low) with click-to-locate evidence, (3) Competitor benchmark mode (paste competitor content to set targets), (4) Title/meta + headings extraction, (5) Internal/external link counter, (6) Image + alt-text audit, (7) JSON-LD schema detector, (8) Readability (Flesch-Kincaid), (9) HTML/text stripping, (10) Re-audit history (IndexedDB), (11) PDF/HTML report export, (12) Shareable preset, (13) Boilerplate stripping for pasted HTML, (14) Multi-language tokenization." },
      { q: "Does the tool fetch live URLs?", a: "No — the core audit runs on pasted content only, fully offline. Fetching a live URL would be an optional, clearly-flagged network feature; we keep the score guidance, not a ranking guarantee." },
    ],
  },
  status: "done",
};

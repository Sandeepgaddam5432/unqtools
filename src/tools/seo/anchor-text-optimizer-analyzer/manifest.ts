/**
 * Anchor Text Optimizer — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "anchor-text-optimizer-analyzer",
  name: "Anchor Text Optimizer",
  description: "Analyze and optimize anchor text distribution for SEO. Detect over-optimization, branded vs exact-match ratios.",
  category: "seo",
  keywords: ["anchor text", "anchor text optimizer", "seo anchor", "link anchor"],
  icon: "Link",
  requiresNetwork: false,
  seo: {
    title: "Anchor Text Optimizer — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Analyze and optimize anchor text distribution for SEO. Detect over-optimization, branded vs exact-match ratios." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Anchor text distribution analysis, (2) (2) Branded vs exact-match ratio, (3) (3) Over-optimization detection, (4) (4) Penguin penalty risk score, (5) (5) CSV import/export, (6) (6) Bulk URL+anchor pairs, (7) (7) Top anchor text frequency, (8) (8) Internal vs external link split, (9) (9) Naked URL detection, (10) (10) LSI keyword suggestions, (11) (11) Copy report, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};

/**
 * Disclaimer Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "disclaimer-generator",
  name: "Disclaimer Generator",
  description: "Generate legal disclaimers for websites, apps, and content. Affiliate, medical, legal, fitness, financial.",
  category: "network-security",
  keywords: ["disclaimer generator", "legal disclaimer", "website disclaimer", "liability disclaimer"],
  icon: "FileText",
  requiresNetwork: false,
  seo: {
    title: "Disclaimer Generator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generate legal disclaimers for websites, apps, and content. Affiliate, medical, legal, fitness, financial." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) General disclaimer, (2) (2) Affiliate disclosure, (3) (3) Medical disclaimer, (4) (4) Legal disclaimer, (5) (5) Fitness disclaimer, (6) (6) Financial disclaimer, (7) (7) Email disclaimer, (8) (8) App disclaimer, (9) (9) Custom fields (company, website, jurisdiction), (10) (10) Copy HTML, (11) (11) Export as .txt, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};

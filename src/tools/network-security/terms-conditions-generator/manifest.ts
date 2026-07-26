/**
 * Terms & Conditions Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "terms-conditions-generator",
  name: "Terms & Conditions Generator",
  description: "Generate Terms & Conditions for websites, apps, and SaaS. Customizable for different jurisdictions.",
  category: "network-security",
  keywords: ["terms and conditions", "terms of service", "legal terms", "tos generator"],
  icon: "FileText",
  requiresNetwork: false,
  seo: {
    title: "Terms & Conditions Generator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generate Terms & Conditions for websites, apps, and SaaS. Customizable for different jurisdictions." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Website ToS, (2) (2) App ToS, (3) (3) SaaS ToS, (4) (4) E-commerce ToS, (5) (5) User obligations, (6) (6) IP rights, (7) (7) Limitation of liability, (8) (8) Termination clause, (9) (9) Governing law, (10) (10) Copy HTML, (11) (11) Export as .txt, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};

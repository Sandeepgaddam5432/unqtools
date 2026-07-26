/**
 * Privacy Policy Generator (GDPR/CCPA) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "privacy-policy-generator",
  name: "Privacy Policy Generator (GDPR/CCPA)",
  description: "Generate GDPR/CCPA-compliant privacy policies. Customizable for websites, apps, and SaaS.",
  category: "network-security",
  keywords: ["privacy policy", "gdpr", "ccpa", "privacy generator"],
  icon: "FileText",
  requiresNetwork: false,
  seo: {
    title: "Privacy Policy Generator (GDPR/CCPA) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generate GDPR/CCPA-compliant privacy policies. Customizable for websites, apps, and SaaS." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) GDPR-compliant policy, (2) (2) CCPA-compliant policy, (3) (3) Data collection disclosure, (4) (4) Cookie usage, (5) (5) Third-party services, (6) (6) User rights, (7) (7) Data retention, (8) (8) Contact info, (9) (9) Custom company fields, (10) (10) Copy HTML, (11) (11) Export as .txt, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};

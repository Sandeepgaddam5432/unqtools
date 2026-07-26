/**
 * Cookie Consent Banner Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "cookie-consent-banner-generator",
  name: "Cookie Consent Banner Generator",
  description: "Generate GDPR/CCPA cookie consent banners. Pure HTML/CSS/JS, no dependencies. Customizable themes.",
  category: "network-security",
  keywords: ["cookie consent", "gdpr banner", "ccpa banner", "cookie banner"],
  icon: "Cookie",
  requiresNetwork: false,
  seo: {
    title: "Cookie Consent Banner Generator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generate GDPR/CCPA cookie consent banners. Pure HTML/CSS/JS, no dependencies. Customizable themes." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) GDPR-compliant banner, (2) (2) CCPA-compliant banner, (3) (3) Pure HTML/CSS/JS output, (4) (4) Theme customization, (5) (5) Granular consent (analytics/marketing), (6) (6) Consent storage (localStorage), (7) (7) Re-consent mechanism, (8) (8) Multi-language support, (9) (9) Position (top/bottom/floating), (10) (10) Copy HTML+CSS+JS, (11) (11) Preview live, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};

/**
 * API Authentication Header Builder — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "api-auth-header-builder",
  name: "API Authentication Header Builder",
  description: "Build API authentication headers: Bearer, Basic, API Key, HMAC, AWS Sig v4.",
  category: "developer",
  keywords: ["api auth", "authentication header", "bearer token", "basic auth"],
  icon: "KeyRound",
  requiresNetwork: false,
  seo: {
    title: "API Authentication Header Builder — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Build API authentication headers: Bearer, Basic, API Key, HMAC, AWS Sig v4." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "live",
};

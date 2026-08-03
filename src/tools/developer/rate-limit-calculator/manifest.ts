/**
 * Rate Limit & Retry-After Calculator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "rate-limit-calculator",
  name: "Rate Limit & Retry-After Calculator",
  description: "Calculate rate limits, retry-after delays, backoff strategies. Token bucket.",
  category: "developer",
  keywords: ["rate limit", "retry after", "backoff", "throttle"],
  icon: "Gauge",
  requiresNetwork: false,
  seo: {
    title: "Rate Limit & Retry-After Calculator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Calculate rate limits, retry-after delays, backoff strategies. Token bucket." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "planned",
};

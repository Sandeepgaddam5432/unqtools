/**
 * HTTP Security Headers Test — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "http-security-headers-test",
  name: "HTTP Security Headers Test",
  description: "Test HTTP security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy).",
  category: "network-security",
  keywords: ["security headers", "http headers", "csp test", "hsts test", "x-frame-options"],
  icon: "ShieldCheck",
  requiresNetwork: false,
  seo: {
    title: "HTTP Security Headers Test — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Test HTTP security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) CSP header check, (2) (2) HSTS header check, (3) (3) X-Frame-Options check, (4) (4) X-Content-Type-Options check, (5) (5) Referrer-Policy check, (6) (6) Permissions-Policy check, (7) (7) Cross-Origin headers, (8) (8) Grade A-F scoring, (9) (9) Improvement recommendations, (10) (10) Copy curl test command, (11) (11) Export report, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "planned",
};

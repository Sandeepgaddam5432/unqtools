import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "csp-evaluator",
  name: "CSP Evaluator",
  description:
    "Evaluate Content Security Policy headers for security weaknesses. Detect unsafe directives, missing protections, and bypass gadgets. 100% client-side analysis.",
  category: "network-security",
  keywords: [
    "csp",
    "content security policy",
    "header",
    "xss",
    "security header",
    "evaluator",
    "analyzer",
    "web security",
  ],
  icon: "shield-check",
  requiresNetwork: false,
  seo: {
    title: "CSP Evaluator — Analyze Content Security Policy | UnQTools",
    faq: [
      {
        q: "What is Content Security Policy (CSP)?",
        a: "CSP is an HTTP response header that lets site operators restrict the resources (scripts, styles, images, etc.) that a browser is allowed to load. It's a defense-in-depth mitigation for XSS and data injection attacks. Defined in CSP Level 3 (W3C).",
      },
      {
        q: "What does this evaluator check?",
        a: "It checks for unsafe directives (unsafe-inline, unsafe-eval), missing default-src fallback, wildcards that could allow bypasses, http: sources in script directives, deprecated directives, and missing reporting configuration. Each finding has a severity (high/medium/low/info).",
      },
      {
        q: "Is my CSP header sent anywhere?",
        a: "No. Analysis is done entirely in your browser using string parsing and pattern matching. Nothing is logged or transmitted. You can verify by disconnecting your internet — the tool still works.",
      },
      {
        q: "Should I use 'unsafe-inline'?",
        a: "No, ideally not. 'unsafe-inline' allows inline scripts and styles, which defeats much of CSP's XSS protection. Use nonces (per-request random values) or hashes instead. If you must use 'unsafe-inline' temporarily, add a TODO to migrate to nonces.",
      },
    ],
  },
  status: "done",
};

import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "csp-evaluator",
  name: "CSP Evaluator & Builder",
  description:
    "Evaluate Content Security Policy headers for security weaknesses, detect bypass gadgets, suggest strict CSP, generate nonces, compare two CSPs, and export to Nginx/Apache/meta-tag. 100% client-side.",
  category: "network-security",
  keywords: [
    "csp", "content security policy", "header", "xss", "security header",
    "evaluator", "analyzer", "web security", "nonce", "csp builder", "bypass",
  ],
  icon: "shield-check",
  requiresNetwork: false,
  seo: {
    title: "CSP Evaluator & Builder — Analyze, Compare, Generate | UnQTools",
    faq: [
      {
        q: "What is Content Security Policy (CSP)?",
        a: "CSP is an HTTP response header that lets site operators restrict the resources (scripts, styles, images) that a browser is allowed to load. It's a defense-in-depth mitigation for XSS and data injection attacks. Defined in CSP Level 3 (W3C).",
      },
      {
        q: "What does this evaluator check?",
        a: "It checks for: unsafe directives (unsafe-inline, unsafe-eval), missing default-src fallback, wildcards, http: sources in script directives, deprecated directives, missing base-uri/form-action/frame-ancestors/report-uri/upgrade-insecure-requests. It also detects known bypass gadgets (Angular on CDN, JSONP endpoints, data: URIs) and computes a 0-100 security score.",
      },
      {
        q: "What is a CSP bypass gadget?",
        a: "A bypass gadget is a script-hosting source that, when allowed in script-src, can be abused to execute arbitrary JavaScript despite CSP. Common gadgets: Angular on Google CDN (via $eval), Prototype.js, JSONP endpoints on jsdelivr/cdnjs, and data: URIs. Our tool detects these and recommends safer alternatives.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "Beyond standard evaluation, we ship: (1) CSP history (localStorage, last 20). (2) CSP builder — construct a CSP from directives with toggles. (3) CSP preset templates (Strict, Permissive, Report-only, WordPress, Next.js). (4) Source explanation — explain what each source ('self', 'unsafe-inline', data:, etc.) means and its risk level. (5) Score breakdown — see exactly how the score was computed. (6) Export to Nginx/Apache/meta-tag formats. (7) Directive reference — docs for all 15+ CSP directives. (8) Nonce generator — generate cryptographically secure nonces for CSP. (9) Shareable URL — encode CSP in fragment. (10) CSP comparison mode — diff two CSPs directive-by-directive.",
      },
      {
        q: "Should I use 'unsafe-inline'?",
        a: "No, ideally not. 'unsafe-inline' allows inline scripts and styles, which defeats much of CSP's XSS protection. Use nonces (per-request random values: 'nonce-XXX') or hashes ('sha256-...') instead. Our tool's 'suggestHashOrNonce' feature will recommend the right approach based on your current CSP.",
      },
      {
        q: "Is my CSP header sent anywhere?",
        a: "No. Analysis is done entirely in your browser using string parsing and pattern matching. Nothing is logged or transmitted. CSP history is stored in localStorage on your device only.",
      },
    ],
  },
  status: "done",
};

/**
 * CSP (Content Security Policy) Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "csp-generator",
  name: "CSP Generator",
  description:
    "Build a Content-Security-Policy header directive-by-directive and evaluate it live for XSS bypasses (unsafe-inline, wildcards, missing object-src/base-uri). Supports strict-dynamic + nonce/hash, Report-Only, reporting endpoints, Nginx/Apache/meta output, and paste-to-audit. 100% client-side.",
  category: "network-security",
  keywords: [
    "csp generator",
    "content security policy",
    "csp builder",
    "csp evaluator",
    "strict csp",
    "strict-dynamic",
    "nonce csp",
    "csp header",
    "xss protection",
    "report-only",
  ],
  icon: "Shield",
  requiresNetwork: false,
  seo: {
    title: "CSP Generator — Build a Strict, Bypass-Checked Content Security Policy | UnQTools",
    faq: [
      {
        q: "What is a Content Security Policy (CSP)?",
        a: "A Content Security Policy is an HTTP response header (or meta tag) that tells the browser which sources scripts, styles, images, fonts, frames and other resource types may load from. A well-built CSP is one of the most effective XSS mitigations available. It is defined per the W3C CSP Level 3 specification.",
      },
      {
        q: "Why does this tool also evaluate the policy I built?",
        a: "Because many 'CSP generators' ship policies that look complete but don't actually stop XSS — they allow 'unsafe-inline', broad wildcards like https:, or omit object-src/base-uri. This tool runs Google-CSP-Evaluator-style heuristics as you build, so you see XSS-bypass warnings the moment they appear, plus recommendations to move to nonce + strict-dynamic.",
      },
      {
        q: "What is the strict-dynamic + nonce pattern and should I use it?",
        a: "strict-dynamic (CSP3) lets a trusted script (loaded with a per-request nonce) load its own dependencies without an allowlist. It is the Google-recommended pattern because allowlist-based CSPs are routinely bypassed. This tool generates per-page nonces (base64, 128 bits) and SHA-256 hashes for inline scripts, with guidance for migrating off allowlists.",
      },
      {
        q: "Does Report-Only mode and reporting work in this tool?",
        a: "Yes. You can switch to Content-Security-Policy-Report-Only, configure report-to / report-uri endpoints, and the tool emits a Report-To header JSON object alongside the policy. Reports themselves are sent by browsers at runtime — this tool only builds the configuration; no report data ever reaches us.",
      },
      {
        q: "What extras does this tool include?",
        a: "(1) Live XSS-bypass evaluator with severity ratings. (2) Strict-CSP preset (nonce + strict-dynamic). (3) Per-directive plain-English docs. (4) Nginx, Apache, and HTML meta-tag output formats. (5) Report-Only toggle + report-to/report-uri config. (6) Paste-existing-CSP audit mode. (7) Nonce + SHA-256 hash generators for inline scripts. (8) Browser-support notes per directive (CSP2 vs CSP3). (9) Copy per output format. (10) Shareable URL encoding the policy config (no secrets — CSP is public). (11) Bypass-gadget detection for Angular/Prototype.js/JSONP. (12) Strict-CSP presets for SPA/SSR/static/API apps.",
      },
      {
        q: "Which directives does this builder support?",
        a: "All CSP3 fetch directives (default-src, script-src, style-src, img-src, font-src, connect-src, media-src, object-src, frame-src, child-src, worker-src, manifest-src, prefetch-src), plus frame-ancestors, base-uri, form-action, sandbox, upgrade-insecure-requests, require-trusted-types-for, trusted-types, report-uri, report-to, and the strict-dynamic / unsafe-hashes keywords.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Policy building, evaluation, nonce generation, and hashing all run in your browser. Shareable URLs encode the policy configuration in the fragment (#) which browsers do not transmit in HTTP requests. A CSP header is inherently public information — there are no secrets in it.",
      },
      {
        q: "What does the bypass-gadget detector look for?",
        a: "It flags known script-hosting sources that can be abused to bypass CSP when allowlisted in script-src: Angular on gstatic.com (via $eval), Prototype.js, JSONP endpoints on common CDNs (jsdelivr, cdnjs, gstatic), and data: URIs. For each gadget it suggests a safer alternative.",
      },
    ],
  },
  status: "done",
};

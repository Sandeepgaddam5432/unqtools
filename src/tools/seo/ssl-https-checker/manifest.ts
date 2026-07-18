import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ssl-https-checker",
  name: "SSL & HTTPS Checker",
  description:
    "Check SSL/HTTPS configuration from URL + HTML. Detect HTTPS protocol, mixed content (active/passive), validate HSTS header, estimate http→https redirect, generate recommendations. Honest disclaimer: this tool does NOT make live HTTPS requests. History (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "ssl", "https", "tls", "certificate", "hsts",
    "mixed content", "security headers", "redirect",
  ],
  icon: "lock",
  requiresNetwork: false,
  seo: {
    title: "SSL & HTTPS Checker — Mixed Content + HSTS | UnQTools",
    faq: [
      {
        q: "What does the SSL & HTTPS Checker actually check?",
        a: "Three things: (1) the URL protocol — HTTPS or HTTP, (2) mixed content in pasted HTML — active (scripts/stylesheets/iframes with http://) and passive (images/audio/video), (3) HSTS header from pasted Strict-Transport-Security value. The tool does NOT make live HTTPS requests or inspect TLS certificates — see the disclaimer below.",
      },
      {
        q: "Why can't this tool make live HTTPS requests?",
        a: "Two reasons: (1) Browsers block cross-origin HTTPS requests via CORS — we can't read another site's certificate or headers from your browser. (2) It would violate UnQTools' privacy-first principle (no network calls at runtime). To verify a live site's SSL cert and headers, use server-side tools like SSL Labs' SSL Test, securityheaders.com, or curl from your terminal.",
      },
      {
        q: "What is mixed content?",
        a: "When an HTTPS page loads resources (images, scripts, stylesheets) over HTTP. Active mixed content (scripts/stylesheets/iframes) is blocked by modern browsers — the page breaks. Passive mixed content (images/audio/video) is loaded but browsers show a 'Not Secure' warning. Both hurt SEO and user trust.",
      },
      {
        q: "What is HSTS and how do I configure it?",
        a: "HTTP Strict-Transport-Security (HSTS) tells browsers to only use HTTPS for your site for a specified duration. Configure it via the Strict-Transport-Security response header: max-age=31536000; includeSubDomains; preload. After 1 year of clean HSTS, you can submit to the HSTS preload list (hstspreload.org).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) HTTPS protocol detection. (2) Mixed content checker (active vs passive). (3) HSTS header validation. (4) Protocol analysis. (5) http→https redirect estimation. (6) SSL info display (from URL structure). (7) Recommendation engine. (8) Plain-text report copy. (9) Honest disclaimer about live checking. (10) History (localStorage, last 20). (11) Shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All analysis runs locally on the URL/HTML/header text you paste. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "affiliate-link-cloaker",
  name: "Affiliate Link Cloaker & Redirect Generator",
  description:
    "Cloak affiliate links into pretty URLs and generate redirect scripts (PHP, JavaScript, HTML meta refresh), plus .htaccess, nginx, and robots.txt rules. CSV import of slug/affiliate_url pairs, slug auto-generator from hostname, click-tracking parameter builder, URL-shortener compatibility check, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "affiliate link", "link cloaking", "affiliate redirect",
    "pretty url", "php redirect", "javascript redirect",
    "meta refresh", "htaccess redirect", "nginx rewrite",
    "robots.txt", "affiliate marketing",
  ],
  icon: "link",
  requiresNetwork: false,
  seo: {
    title: "Affiliate Link Cloaker — Redirect Scripts + .htaccess + nginx | UnQTools",
    faq: [
      {
        q: "How does the affiliate link cloaker work?",
        a: "Enter your base URL (e.g. https://example.com/go/) and a CSV of slug,affiliate_url pairs. The tool generates a pretty URL for each link (https://example.com/go/<slug>) and emits redirect scripts in three formats (PHP, JavaScript, HTML meta refresh), plus .htaccess RewriteRules, nginx rewrite rules, and a robots.txt Disallow line to keep /go/ out of search indexes.",
      },
      {
        q: "Which redirect types are generated?",
        a: "Three: PHP redirect (header Location + exit), JavaScript redirect (window.location.href), and HTML meta refresh (http-equiv=refresh content=0;url=...). Plus .htaccess RewriteRule per link, nginx rewrite per link, and a robots.txt block.",
      },
      {
        q: "How are slugs validated?",
        a: "Slugs must be unique across the batch and match ^[a-z0-9-]+$ (lowercase letters, digits, hyphens only). Affiliate URLs are validated as proper URLs with a hostname. Duplicate slugs and malformed URLs are flagged in the validation report.",
      },
      {
        q: "What extra features does this tool have?",
        a: "(1) CSV parser with field validation. (2) Pretty URL generator. (3) PHP redirect generator. (4) JavaScript redirect generator. (5) HTML meta-refresh generator. (6) .htaccess RewriteRule generator. (7) nginx rewrite generator. (8) robots.txt Disallow generator. (9) Link validation (URL format, slug uniqueness, slug format). (10) Click-tracking parameter builder (?src=newsletter). (11) Text report (all formats). (12) CSV export (slug, affiliate_url, pretty_url). (13) Download .txt / .csv / .htaccess / nginx.conf. (14) History (localStorage, max 20). (15) Shareable URL. (16) Slug auto-generator from URL hostname. (17) Summary stats. (18) URL-shortener compatibility check (≤30 chars).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, validation, and script generation runs locally in your browser. History is stored in localStorage on this device only. No affiliate URLs are transmitted.",
      },
    ],
  },
  status: "done",
};

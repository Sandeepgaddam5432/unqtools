import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "canonical-tag-generator",
  name: "Canonical Tag Generator",
  description:
    "Generate canonical link tags and check for common mistakes. URL normalization, pagination prev/next, hreflang integration, cross-domain warnings, batch processing. 100% client-side.",
  category: "seo",
  keywords: [
    "canonical", "link rel canonical", "duplicate content", "url normalization",
    "prev next", "pagination", "hreflang", "seo", "www", "https",
  ],
  icon: "link-2",
  requiresNetwork: false,
  seo: {
    title: "Canonical Tag Generator — URL Normalization | UnQTools",
    faq: [
      {
        q: "What is a canonical tag?",
        a: "The <link rel=\"canonical\" href=\"...\"> tag tells search engines which URL is the master version of a page. It's how you avoid duplicate content issues when the same content is reachable from multiple URLs (e.g. with/without trailing slash, query params, www/non-www).",
      },
      {
        q: "What common mistakes does this tool check for?",
        a: "Relative URLs (must be absolute), http vs https mismatch, www vs non-www inconsistency, trailing slash inconsistency, presence of query parameters that should be stripped, cross-domain canonical (which is valid but worth flagging).",
      },
      {
        q: "What URL normalization does this tool do?",
        a: "Lowercases the hostname, strips default ports (80 for http, 443 for https), removes duplicate slashes in the path (except after the protocol), and optionally strips common tracking query params (utm_*, gclid, fbclid).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) URL normalization (lowercase host, strip default port, remove duplicate slashes). (2) Pagination canonical (prev/next link tags). (3) Hreflang integration hint. (4) Cross-domain canonical warning. (5) Absolute URL check. (6) Trailing slash consistency check. (7) www vs non-www check. (8) History (localStorage, last 20). (9) Shareable URL — encode the form in the fragment. (10) Batch processing — paste multiple URLs.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Canonical tag generation is pure string/URL manipulation in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

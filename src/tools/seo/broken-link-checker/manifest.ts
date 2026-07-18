import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "broken-link-checker",
  name: "Broken Link Checker",
  description:
    "Check for broken links in HTML content. Extract all links, classify internal vs external, detect common issues (empty href, javascript:, # only, missing protocol, relative without base), show link report with stats. CSV export, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "broken links", "link checker", "href", "html links",
    "anchor text", "internal links", "external links",
  ],
  icon: "unlink",
  requiresNetwork: false,
  seo: {
    title: "Broken Link Checker — HTML Link Audit | UnQTools",
    faq: [
      {
        q: "What does the Broken Link Checker do?",
        a: "Paste HTML and the tool extracts every <a> tag, classifies the href (internal, external, anchor, mailto, tel, javascript, empty, or relative-without-base), detects common issues, and produces a link report with stats. It does NOT make HTTP requests to verify the links resolve — for that, use a server-side checker.",
      },
      {
        q: "What issues does it detect?",
        a: "Empty href (error), javascript: URLs (warning — not crawlable), anchor-only links like #section (warning — no link equity), external URLs without explicit protocol (error), URLs containing whitespace (error), and relative URLs when no base URL is provided (warning).",
      },
      {
        q: "Why do I need to provide a base URL?",
        a: "When your HTML uses relative URLs like /about or ../page.html, the tool needs a base URL to resolve them and determine whether they're internal or external. Without a base, relative URLs are flagged as 'relative-no-base'.",
      },
      {
        q: "Does it check if links actually work (return 200)?",
        a: "No. Making HTTP requests from a browser is blocked by CORS for most sites and would violate the privacy-first principle. This tool checks for syntactic and structural issues — not HTTP-level breakage. Use it as a pre-flight scan before running a server-side crawler.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Link extraction. (2) Internal vs external classification. (3) Issue detection (empty, JS, anchor-only, missing protocol, malformed). (4) Link count stats. (5) CSV export. (6) Plain-text report copy. (7) History (localStorage, last 20). (8) Shareable URL. (9) Anchor text per link. (10) Rel attribute + target blank extraction. (11) Top external domains list.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All HTML parsing runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

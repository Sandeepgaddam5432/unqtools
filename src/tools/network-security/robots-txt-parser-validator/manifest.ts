/**
 * robots.txt Parser & Validator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "robots-txt-parser-validator",
  name: "robots.txt Parser & Validator",
  description: "Parse and validate robots.txt files. Check allow/disallow rules, sitemap references, and crawl directives.",
  category: "network-security",
  keywords: ["robots txt", "robots parser", "robots validator", "crawl directives"],
  icon: "FileCode",
  requiresNetwork: false,
  seo: {
    title: "robots.txt Parser & Validator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Parse and validate robots.txt files. Check allow/disallow rules, sitemap references, and crawl directives." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) robots.txt parser, (2) (2) User-agent rules, (3) (3) Allow/Disallow validation, (4) (4) Sitemap detection, (5) (5) Crawl-delay, (6) (6) Rule conflict detection, (7) (7) URL test (is URL blocked?), (8) (8) Bulk URL test, (9) (9) Common misconfiguration warnings, (10) (10) Copy corrected robots.txt, (11) (11) Export file, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};

import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "broken-backlink-finder",
  name: "Broken Backlink Finder",
  description:
    "Find broken backlinks from imported data. Categorize HTTP status codes (2xx/3xx/4xx/5xx), detect broken links (404, 500, etc.), score reclamation opportunities, show anchors and source domains. CSV export, status code reference, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "broken backlinks", "broken links", "link reclamation",
    "404", "backlink audit", "dead links",
    "status code",
  ],
  icon: "link-off",
  requiresNetwork: false,
  seo: {
    title: "Broken Backlink Finder — Link Reclamation Opportunities | UnQTools",
    faq: [
      {
        q: "How does the Broken Backlink Finder work?",
        a: "Paste backlink data with URL + HTTP status code (and optional anchor + source). The tool categorizes each status code into 2xx/3xx/4xx/5xx, flags broken links (4xx/5xx), and scores each broken link for reclamation opportunity — 404/410 with anchor and source scores highest because they're the easiest to reclaim.",
      },
      {
        q: "What counts as a 'broken' backlink?",
        a: "Any URL returning a 4xx (client error) or 5xx (server error) status code. The exception is 429 (Too Many Requests / rate-limited), which is treated as temporary and not broken. 2xx and 3xx are healthy.",
      },
      {
        q: "How is the reclamation opportunity score calculated?",
        a: "Base 50 for any broken link. 404 adds +30, 410 adds +25, 5xx adds +10, 403 adds +5. Having an anchor text adds +10 (easier to recreate matching content). Having a source domain adds +10 (easier outreach). Capped at 100.",
      },
      {
        q: "What input format does it accept?",
        a: "CSV with header (url, status_code, anchor, source_url, source_domain) or headerless rows in that same column order.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Status code categorization (2xx/3xx/4xx/5xx). (2) Broken link detection (4xx/5xx, except 429). (3) Reclamation opportunity scoring (0-100). (4) Anchor text per broken link. (5) CSV export. (6) Plain-text report copy. (7) Stats summary. (8) History (localStorage, last 20). (9) Shareable URL. (10) Full status code reference (200/301/404/410/500/etc.).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All analysis runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

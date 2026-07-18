import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "meta-robots-tester",
  name: "Meta Robots & X-Robots-Tag Tester",
  description:
    "Test and analyze meta robots directives. Parse HTML meta tag or X-Robots-Tag header, validate directives (index/noindex/follow/nofollow/noarchive/nosnippet), detect conflicts, generate recommendations, output a fixed tag. Reference table, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "meta robots", "x-robots-tag", "noindex", "nofollow",
    "robots meta", "directive", "crawl directive",
  ],
  icon: "bot",
  requiresNetwork: false,
  seo: {
    title: "Meta Robots & X-Robots-Tag Tester — Directive Validator | UnQTools",
    faq: [
      {
        q: "What directives does the tester support?",
        a: "index, noindex, follow, nofollow, noarchive, nosnippet, notranslate, noimageindex, unavailable_after, max-snippet, max-image-preview, max-video-preview, all, none. Both the HTML meta tag and the HTTP X-Robots-Tag header are supported.",
      },
      {
        q: "How does it detect conflicts?",
        a: "It flags errors for mutually exclusive pairs (index+noindex, follow+nofollow, all+none) and warnings for redundant combinations (all + restrictive directives, none + permissive directives). It also validates unavailable_after requires a date and max-image-preview must be one of none/standard/large.",
      },
      {
        q: "What does the 'fixed tag' do?",
        a: "It generates a corrected <meta name='robots' content='...'> tag that resolves any conflicts by preferring the restrictive directive. For example, index+noindex becomes noindex, follow+nofollow becomes nofollow.",
      },
      {
        q: "What is the X-Robots-Tag header?",
        a: "An HTTP response header that applies the same directives as the meta tag. Useful for non-HTML files (PDFs, images) where you can't add a meta tag. Format: 'X-Robots-Tag: noindex, nofollow'.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Directive parsing for all 14 directives. (2) Conflict detection (index+noindex, all+none, etc.). (3) Recommendation engine. (4) X-Robots-Tag header support. (5) HTML meta tag auto-extraction. (6) Fixed tag generation. (7) Plain-text report copy. (8) Full directive reference table. (9) History (localStorage, last 20). (10) Shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

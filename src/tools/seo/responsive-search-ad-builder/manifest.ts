import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "responsive-search-ad-builder",
  name: "Responsive Search Ad Builder",
  description:
    "Build Google Responsive Search Ads (RSA) with up to 15 headlines (30 chars each) and 4 descriptions (90 chars each). Pin to positions, character counters, ad strength, desktop/mobile preview, and CSV export. 100% client-side.",
  category: "seo",
  keywords: [
    "rsa", "responsive search ad", "google ads", "sem", "ppc",
    "ad copy", "headline", "description", "search ad",
  ],
  icon: "megaphone",
  requiresNetwork: false,
  seo: {
    title: "Responsive Search Ad Builder — Google Ads RSA | UnQTools",
    faq: [
      {
        q: "What is a Responsive Search Ad (RSA)?",
        a: "Google's RSA ad format: you provide up to 15 headlines (30 chars each) and 4 descriptions (90 chars each). Google automatically tests combinations and shows the best-performing ones to each user. RSAs became the only search ad type in Google Ads in 2022.",
      },
      {
        q: "What character limits apply?",
        a: "Headlines: max 30 characters each, minimum 3 headlines required (max 15). Descriptions: max 90 characters each, minimum 2 required (max 4). Path fields (path1, path2): max 15 chars each, alphanumeric + hyphens only. The tool shows live character counters with warnings near the limit.",
      },
      {
        q: "What does pinning to a position mean?",
        a: "By default, Google mixes headlines/descriptions dynamically. Pinning forces a specific headline to always show in position 1, 2, or 3 (H1/H2/H3). Same for descriptions (D1/D2). Use sparingly — over-pinning reduces Google's ability to test and find the best combinations, which can hurt ad strength.",
      },
      {
        q: "What is 'ad strength' and how is it estimated?",
        a: "Ad Strength is Google's rating (Poor, Average, Good, Excellent) of how well your RSA is set up. It rewards: more headlines (12+ is excellent), more descriptions (all 4), unique keywords across headlines, and some pinning (but not too much). Our estimate is approximate — Google's exact algorithm isn't public.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Character counter for headlines (30) and descriptions (90). (2) Pin to position (H1-H3, D1-D2). (3) Ad strength estimator with score. (4) Desktop preview (3 headlines + 2 descriptions). (5) Mobile preview (2 headlines + 1 description). (6) Path fields (path1, path2) with validation. (7) Copy ad text. (8) Export as CSV. (9) Stats — headline count, description count. (10) History (localStorage, last 20) + shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All ad building and validation runs locally in your browser. History is stored in localStorage on this device only. We don't post ads to Google — copy the output into Google Ads Editor or your account.",
      },
    ],
  },
  status: "done",
};

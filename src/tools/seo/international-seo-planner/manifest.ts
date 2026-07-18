import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "international-seo-planner",
  name: "International SEO Planner",
  description:
    "Plan international SEO: choose ccTLD vs subdomain vs subdirectory strategy, generate hreflang tags, validate pairs, get x-default, and compare URL structures. 100% client-side — 17 extras including 20+ country ccTLD lookup, ISO validators, history, shareable URL.",
  category: "seo",
  keywords: [
    "international seo", "hreflang", "ccTLD",
    "subdomain", "subdirectory", "i18n seo",
    "x-default", "multilingual seo",
    "country targeting", "locale",
  ],
  icon: "globe",
  requiresNetwork: false,
  seo: {
    title: "International SEO Planner — ccTLD vs Subdomain vs Subdirectory + Hreflang | UnQTools",
    faq: [
      {
        q: "How does the international SEO planner work?",
        a: "Enter your main domain, target countries (one per line as 'Country:Code' e.g. 'Germany:DE'), pick a URL structure (ccTLD, subdomain, or subdirectory), and map each country to a language code. The planner generates URL structure per country, full hreflang tag set including x-default, and validates every pair.",
      },
      {
        q: "What URL structures are supported?",
        a: "Three strategies: ccTLD (example.fr, example.co.uk), subdomain (fr.example.com), and subdirectory (example.com/fr/). The tool also produces a side-by-side comparison table of pros/cons and SEO impact for each.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Country + language parser (one per line). (2) URL structure generator (3 strategies). (3) ccTLD lookup table (20+ countries). (4) Hreflang tag generator. (5) x-default generator. (6) Hreflang validation (missing self-reference, missing pairs, invalid codes). (7) Self-referencing hreflang recommendation. (8) Strategy comparison table. (9) Text report renderer. (10) CSV export. (11) Copy + Download .txt + Download CSV. (12) History (localStorage, max 20). (13) Shareable URL. (14) Filter by country. (15) Summary stats. (16) ISO 639-1 language validator. (17) ISO 3166-1 alpha-2 country validator.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, generation, and validation runs locally in your browser. History is stored in localStorage on this device only.",
      },
      {
        q: "How are hreflang pairs validated?",
        a: "Each country-language pair generates a URL. Validation checks that (a) every hreflang value is well-formed ('language-Region'), (b) language codes are valid ISO 639-1 2-letter codes, (c) region codes are valid ISO 3166-1 alpha-2 codes, and (d) every URL has a self-referencing hreflang tag pointing back to itself.",
      },
    ],
  },
  status: "done",
};

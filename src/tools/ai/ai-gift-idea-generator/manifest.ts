import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-gift-idea-generator",
  name: "AI Gift Idea Generator",
  description:
    "Generate personalized, ranked gift ideas from a recipient profile (relationship, age, interests, occasion, budget, and a 'gifts to avoid' anti-repeat list). Gift database with 60+ curated ideas spanning 6 recipients × 4 occasions × 5 interests, price tiers (low / mid / splurge), 'why this fits' reasoning per idea, and neutral shopping hints (category + search term) — never affiliate links. Save recipient profiles locally, history (last 20), shareable URL, copy/print/export. 100% client-side, no sign-up, no upload, optional BYO-key LLM polish.",
  category: "ai",
  keywords: [
    "gift idea generator", "ai gift finder", "personalized gift ideas",
    "gift advisor", "no signup gift generator", "private gift ideas",
    "birthday gift generator", "anniversary gift ideas",
    "holiday gift finder", "graduation gift ideas",
    "gift by interest", "gift budget tiers", "what to get someone who likes",
    "anti-repeat gift memory", "dreamgift alternative",
  ],
  icon: "gift",
  requiresNetwork: false,
  seo: {
    title: "AI Gift Idea Generator — Personalized, Private, No Affiliate | UnQTools",
    faq: [
      {
        q: "How does the gift idea generator work?",
        a: "Describe the recipient — relationship (partner, parent, friend, kid, or coworker), age, one or more interests (books, tech, sports, cooking, travel), occasion (birthday, anniversary, holiday, or graduation), and a budget tier (low, mid, or splurge). The tool matches the profile against a built-in gift database of 60+ curated ideas spanning 6 recipients × 4 occasions × 5 interests, ranks them by fit, and returns 10+ suggestions with price ranges, a 'why this fits' note, and a neutral shopping hint (category + search term). No affiliate links, no retailer steering.",
      },
      {
        q: "What is the 'gifts to avoid' anti-repeat list?",
        a: "You can list gifts you've already given this person (or things they don't like). The generator filters those out of the suggestions so you never repeat a past gift. The avoid-list is part of the recipient profile and is saved locally to your device — it stays year-over-year so each occasion surfaces fresh ideas.",
      },
      {
        q: "How are shopping hints neutral (non-affiliate)?",
        a: "Each suggestion ships with a category label and a plain-English search term — e.g. category 'kitchen gear', search term 'cast iron dutch oven 5qt'. You paste that search term into any retailer you trust (Amazon, Etsy, local shops, your neighborhood bookshop). UnQTools earns nothing from what you buy and never inserts an affiliate ID. We are not a store and we don't sell anything.",
      },
      {
        q: "What extra features does this tool have compared to other gift generators?",
        a: "(1) Recipient profile form (relationship, age, interests, occasion, budget). (2) Gift database 6 recipients × 4 occasions × 5 interests with 60+ curated ideas. (3) Budget tiers (low / mid / splurge) with per-idea price ranges. (4) Anti-repeat 'avoid' list filters past gifts. (5) Ranked suggestions with a 'why this fits' reason per idea. (6) Neutral shopping hints (category + search term), no affiliate links. (7) Save recipient profiles locally (localStorage, last 20). (8) History of generated idea-lists (last 20). (9) Shareable URL with profile encoded. (10) Experiences vs objects toggle. (11) DIY / group-gift mode hints. (12) Copy / download as plain text, Markdown, JSON, CSV. (13) Printable idea list. (14) Honesty disclaimer (ideas are suggestions, not endorsements). (15) Optional BYO-key LLM polish (OpenAI / Anthropic). (16) Regenerate for fresh permutations.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All gift matching, ranking, anti-repeat filtering, history, and saved profiles run locally in your browser. Personal details about your friends and family never leave this device — no account, no upload. The only network path is if you explicitly paste your own LLM API key and click 'Polish with LLM' — that request goes directly from your browser to your chosen LLM provider (OpenAI or Anthropic) and never touches UnQTools servers. Skip the LLM step for 100% offline use.",
      },
    ],
  },
  status: "done",
};

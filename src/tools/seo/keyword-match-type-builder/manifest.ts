import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "keyword-match-type-builder",
  name: "Keyword Match Type Builder",
  description:
    "Build Google Ads keyword match types — broad, phrase, exact, and negative — from a keyword list. Batch convert, dedup, stats per type, CSV export, and Google Ads reference. 100% client-side.",
  category: "seo",
  keywords: [
    "keyword match type", "google ads", "ppc", "broad match", "phrase match",
    "exact match", "negative keyword", "sem", "paid search",
  ],
  icon: "tags",
  requiresNetwork: false,
  seo: {
    title: "Keyword Match Type Builder — Google Ads Broad/Phrase/Exact | UnQTools",
    faq: [
      {
        q: "What are Google Ads keyword match types?",
        a: "Match types control how closely a user's search must match your keyword for your ad to show. Broad match (no symbol) = widest reach, least control. Phrase match (\"keyword\") = medium reach. Exact match ([keyword]) = tightest control. Negative keywords (-keyword) exclude searches.",
      },
      {
        q: "How is phrase match different from before 2021?",
        a: 'Google updated phrase match in February 2021. Now "running shoes" matches searches that include the meaning (not just the exact phrase). So "shoes for running" now matches. The syntax is still "quotes" — the matching behavior got broader and smarter.',
      },
      {
        q: "Should I use broad, phrase, or exact match?",
        a: "Start with exact match for high-intent keywords (conversions). Use phrase match for thematic groups. Use broad match sparingly — only with a strong negative keyword list and Smart Bidding. Most successful accounts use a mix weighted toward exact/phrase.",
      },
      {
        q: "What's a negative keyword?",
        a: "Negative keywords (-keyword) prevent your ad from showing on searches containing that term. Add '-free' if you sell paid products to avoid freebie seekers. Negative keywords can be broad (-free), phrase (-\"free trial\"), or exact (-[free shoes]) match — same syntax as positive keywords with a leading dash.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Batch convert — paste a list, get all match types at once. (2) Match type selector — pick broad/phrase/exact/negative or any combination. (3) Negative keyword support. (4) Dedup case-insensitively per type. (5) Stats per type (count for each). (6) CSV export. (7) Google Ads match type reference. (8) Copy per type. (9) History (localStorage, last 20). (10) Shareable URL — encode form state in fragment.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Match type formatting is pure string manipulation. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

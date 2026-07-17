import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "long-tail-keyword-generator",
  name: "Long-Tail Keyword Generator",
  description:
    "Generate long-tail keyword variations from seed keywords. Question modifiers (7 Ws), comparison, location, intent modifiers, bulk seed input, dedup, stats, CSV export, history. 100% client-side.",
  category: "seo",
  keywords: [
    "long-tail keywords", "keyword variations", "question keywords", "seo keywords",
    "keyword research", "seed keyword", "modifier", "content ideas",
  ],
  icon: "sprout",
  requiresNetwork: false,
  seo: {
    title: "Long-Tail Keyword Generator — Question + Intent Modifiers | UnQTools",
    faq: [
      {
        q: "What is a long-tail keyword?",
        a: "A long-tail keyword is a multi-word, specific search phrase (3+ words) like 'best SEO tools for small business'. They typically have lower search volume but much higher conversion intent. This tool expands seed keywords into many long-tail variants using question, comparison, location, and intent modifiers.",
      },
      {
        q: "Which modifier sets are included?",
        a: "Question (what, how, why, when, where, who, which), comparison (vs, or, compared, alternative), location (near me, in [city], USA, UK, etc.), and intent (best, top, cheap, free, affordable, how to, buy, review). You can toggle each set on/off.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Question modifiers (7 Ws). (2) Comparison modifiers (vs, or, compared). (3) Location modifiers. (4) Intent modifiers (best, top, cheap, free, how to, buy, review). (5) Bulk seed input (one per line). (6) Dedup. (7) Stats (variation count, modifier breakdown). (8) Export as CSV. (9) History (localStorage, last 20). (10) Shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Keyword generation runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

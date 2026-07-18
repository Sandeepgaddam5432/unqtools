import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "keyword-research-explorer",
  name: "Keyword Research Explorer",
  description:
    "Generate keyword suggestions from seed keywords. Synonyms, related terms, questions, comparisons, intent modifiers. Algorithmic volume & difficulty estimates, bulk seeds, dedup, sort, CSV export, history, shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "keyword research", "keyword suggestions", "seed keyword",
    "synonyms", "related keywords", "search volume estimate",
    "keyword difficulty", "long tail", "seo", "content ideas",
  ],
  icon: "search",
  requiresNetwork: false,
  seo: {
    title: "Keyword Research Explorer — Suggestions + Volume + Difficulty | UnQTools",
    faq: [
      {
        q: "How does this tool generate keyword suggestions?",
        a: "Each seed keyword is expanded using synonym lists, related-term modifiers, the 7 W question words, comparison modifiers (vs, or, alternative to), and commercial-intent modifiers (best, top, cheap, buy, review). The result is a deduped list of long-tail variants ready for SEO research.",
      },
      {
        q: "Where do the search volume estimates come from?",
        a: "There is no live API — volume is an algorithmic estimate derived from keyword length, word count, and intent signals (head terms with high commercial intent score higher). Treat the numbers as relative indicators, not absolute search counts.",
      },
      {
        q: "How is keyword difficulty estimated?",
        a: "Difficulty (0-100) is computed from keyword length, word count, presence of commercial-intent words (best, buy, cheap, price), brand-like tokens, and question/intent modifiers. Shorter commercial head terms score high; long-tail question variants score low.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Synonym variation generator. (2) Related-term expansion. (3) Question modifiers (7 Ws). (4) Comparison modifiers (vs, alternative). (5) Commercial-intent modifiers. (6) Algorithmic search-volume estimate. (7) Keyword difficulty score 0-100 with category (Easy/Medium/Hard). (8) Bulk seed input with dedup. (9) Sort by volume/difficulty/alphabetical. (10) CSV export. (11) History (localStorage, last 20). (12) Shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All keyword generation runs locally in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "keyword-density-analyzer",
  name: "Keyword Density Analyzer",
  description:
    "Analyze keyword density for 1-word, 2-word, and 3-word phrases. Top-20 results per category, stop-word filtering, custom exclude list, stuffing warnings (>3%), CSV export. 100% client-side.",
  category: "seo",
  keywords: [
    "keyword density", "keyword frequency", "phrase analysis",
    "stop words", "seo", "keyword stuffing", "content analysis",
  ],
  icon: "search",
  requiresNetwork: false,
  seo: {
    title: "Keyword Density Analyzer — 1/2/3-Word Phrase Frequency | UnQTools",
    faq: [
      {
        q: "What is keyword density?",
        a: "Keyword density is the percentage of times a keyword appears compared to the total words on a page. If 'shoes' appears 10 times in a 500-word article, the density is (10/500)*100 = 2%.",
      },
      {
        q: "What is the ideal keyword density?",
        a: "There's no magic number, but most SEOs agree 1-2% is natural for the primary keyword. Anything over 3% for a single term risks being flagged as 'keyword stuffing' — Google may demote the page. Focus on natural writing with related terms (LSI) rather than hitting a target.",
      },
      {
        q: "Why analyze 2-word and 3-word phrases?",
        a: "Long-tail phrases (2-3 words) often match real search queries better than single words. 'Running shoes' as a 2-word phrase tells you whether you're targeting an actual query vs. just the word 'running'. This tool shows top-20 for each phrase length.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 1-word, 2-word, and 3-word phrase analysis in one tool. (2) Stop word filtering (English). (3) Custom exclude-words list. (4) Stuffing warnings — flags phrases over 3% density. (5) Top-20 results per category. (6) CSV export of all results. (7) Keyword cloud data. (8) Total + unique word counts. (9) History (localStorage, last 20). (10) Shareable URL — encode text in the fragment.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All analysis runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

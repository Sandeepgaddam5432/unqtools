import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "content-readability-analyzer",
  name: "Content Readability Analyzer",
  description:
    "Analyze content readability with 6 formulas — Flesch Reading Ease, Flesch-Kincaid Grade, Gunning Fog, SMOG, Coleman-Liau, ARI. Includes syllable counter, passive voice detector, sentence length stats, reading time, and grade level. 100% client-side.",
  category: "seo",
  keywords: [
    "readability", "flesch", "kincaid", "gunning fog", "smog",
    "coleman-liau", "ari", "reading level", "grade level", "syllable count",
  ],
  icon: "book-open",
  requiresNetwork: false,
  seo: {
    title: "Content Readability Analyzer — 6 Readability Formulas | UnQTools",
    faq: [
      {
        q: "What readability formulas does this tool compute?",
        a: "Six: Flesch Reading Ease (0-100), Flesch-Kincaid Grade Level, Gunning Fog Index, SMOG Index, Coleman-Liau Index, and Automated Readability Index (ARI). A consensus average grade level is shown alongside each formula.",
      },
      {
        q: "How are syllables counted?",
        a: "We use a regex-based heuristic that strips silent 'e', counts vowel groups, and floors at 1 syllable. It's accurate for ~90% of English words — proper nouns and unusual plurals may be off by one. For perfect counts you'd need a dictionary lookup (we kept it dependency-free).",
      },
      {
        q: "How does the passive voice detector work?",
        a: "We look for common patterns: 'was/were/been + -ed/-en participle', 'has/have/had been + -ed', and 'is/are being + -ed'. Each match is listed so you can rewrite the sentence in active voice.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Six readability formulas at once (most tools show 2-3). (2) Consensus average grade across formulas. (3) Per-formula reading-level label. (4) Syllable counter per word. (5) Complex word highlighter (3+ syllables). (6) Passive voice detector. (7) Sentence length stats — flags sentences over 25 words. (8) Reading time (200 WPM) + speaking time (130 WPM). (9) History (localStorage, last 20). (10) Shareable URL — encode text in the fragment.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Readability analysis runs entirely in your browser using pure string and regex math. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

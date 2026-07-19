import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-grammar-correction-tool",
  name: "AI Grammar Correction Tool",
  description:
    "On-device, private grammar checker that catches subject-verb agreement, articles, tense, punctuation, capitalization, and common confusions (their/there/they're, your/you're, its/it's). Inline highlights by category, hover explanations, accept/dismiss, bulk accept-all-by-type, copy corrected text, diff view, readability score. Pure-JS rule engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "grammar checker", "grammar correction", "spelling checker",
    "private grammar", "offline grammar", "languagetool alternative",
    "grammarly alternative", "no login grammar",
  ],
  icon: "spell-check",
  requiresNetwork: false,
  seo: {
    title: "AI Grammar Correction — Private, On-Device, No Limits | UnQTools",
    faq: [
      {
        q: "How does the AI grammar correction tool work?",
        a: "Paste or type your text and the rule engine scans it as you type (debounced). Each issue is classified into one of six categories — grammar (subject-verb agreement), articles (a/an/the), punctuation, capitalization, common confusions (their/there/they're, your/you're, its/it's, to/too), and spelling — with a category color, the original text, a suggested fix, and a short explanation. Click accept to apply a single fix, dismiss to drop it, or use bulk 'accept all by type' to fix every issue in one category at once. The corrected text is copyable and downloadable.",
      },
      {
        q: "What grammar rules are covered?",
        a: "Six rule families: (1) Subject-verb agreement for is/are, was/were, has/have, do/does with simple pronoun detection. (2) Articles — a vs an based on the next word's phonetic start, missing 'the' before unique nouns, redundant articles. (3) Punctuation — double spaces, missing terminal periods, comma spacing, repeated punctuation. (4) Capitalization — sentence-start, the pronoun 'I', days/months. (5) Common confusions — their/there/they're, your/you're, its/it's, to/too, then/than, affect/effect, loose/lose. (6) Spelling — a 100+ common-misspelling dictionary.",
      },
      {
        q: "Can I accept all fixes of one category at once?",
        a: "Yes. Each category card has an 'Accept all' button that applies every suggestion in that category in a single pass, recalculates offsets, and re-runs the engine so any newly visible issues surface. You can also accept individual fixes one by one, dismiss false positives (they are stored in an ignore list for the session), or 'Reset to original' to start over.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Six-rule engine (grammar, articles, punctuation, capitalization, confusions, spelling). (2) Inline highlights by category with color legend. (3) Per-issue accept/dismiss. (4) Bulk accept-all-by-type. (5) Diff view showing original vs corrected. (6) Readability score (Flesch reading ease + grade level). (7) Passive-voice + wordiness flags. (8) Custom ignore list (session). (9) Statistics (issues per category, word count, sentence count). (10) Copy corrected text. (11) Download .txt or .doc-friendly HTML. (12) History (localStorage, last 20). (13) Shareable URL. (14) Sample text presets. (15) Optional BYO-key LLM enhancement.",
      },
      {
        q: "Is my text sent anywhere?",
        a: "No. All grammar checking, suggestions, and readability scoring run locally in your browser. Text never leaves this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};

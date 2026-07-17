import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "content-word-count",
  name: "Content Word Count & SEO Analyzer",
  description:
    "Real-time word, character, sentence, and paragraph counter. Includes reading time (200/250 WPM), speaking time (130 WPM), top-10 keyword density, sentence length distribution, paragraph stats, and a content SEO score. 100% client-side.",
  category: "seo",
  keywords: [
    "word count", "character count", "sentence count", "paragraph count",
    "reading time", "speaking time", "keyword density", "seo score",
    "content analyzer", "text statistics",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "Content Word Count & SEO Analyzer | UnQTools",
    faq: [
      {
        q: "What counts as a word?",
        a: "A word is any sequence of letters (a-z) and digits, case-insensitive. Hyphens, apostrophes inside words (don't) are kept; punctuation marks are stripped. Numbers and alphanumeric tokens (abc123) count as a single word.",
      },
      {
        q: "How is reading time calculated?",
        a: "Reading time = word count ÷ 200 WPM (the standard silent reading rate for adult English readers). We also show a 250 WPM variant for fast readers. Speaking time = word count ÷ 130 WPM (typical presentation pace).",
      },
      {
        q: "What is the SEO score?",
        a: "A 0-100 score based on common content SEO heuristics: word count >= 300, long-form (600+), at least 3 paragraphs, average sentence length 15-20 words, no sentence > 30 words, unique word ratio >= 50%, and reading time >= 1 minute. Each check is shown with a pass/fail.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Real-time counting as you type. (2) Dual reading time (200/250 WPM). (3) Speaking time at 130 WPM. (4) Top-10 keyword density with stop-word filtering. (5) Custom exclude-words list. (6) Sentence length distribution buckets. (7) Paragraph stats (avg sentences/words, longest). (8) Longest sentence highlight. (9) Content SEO score with detailed checks. (10) History (localStorage, last 20) + shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All counting and analysis runs in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

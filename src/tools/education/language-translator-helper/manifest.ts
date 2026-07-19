import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "language-translator-helper",
  name: "Language Translator Helper",
  description:
    "Language learning aid with a built-in phrase book (200+ phrases across 10 languages × 8 categories), conjugation tables (10 verbs × 6 tenses), number translator (1-100), and 3 practice modes (browse, flashcard, reverse-translation). Translation lookup, reverse translation, pronunciation guide (romanized for non-Latin scripts), search filter, difficulty marker per phrase, text/CSV renderers, copy + download, history (localStorage), and shareable URL. 100% client-side — no network.",
  category: "education",
  keywords: [
    "language", "translator", "translation", "phrasebook",
    "spanish", "french", "german", "italian", "portuguese",
    "hindi", "japanese", "chinese", "arabic",
    "conjugation", "verbs", "flashcards", "language learning",
  ],
  icon: "languages",
  requiresNetwork: false,
  seo: {
    title: "Language Translator Helper — Phrasebook + Conjugations | UnQTools",
    faq: [
      {
        q: "How does the language translator helper work?",
        a: "Pick a source and target language (10 supported), choose a phrase category (greetings, travel, food, numbers, time, emergencies, shopping, directions), and select a practice mode. The tool filters its built-in phrase book (200+ phrases) and shows source → target translations with romanized pronunciation for non-Latin scripts (Japanese, Chinese, Hindi, Arabic).",
      },
      {
        q: "Which languages are supported?",
        a: "Ten: English, Spanish, French, German, Italian, Portuguese, Hindi, Japanese, Chinese, and Arabic. For each phrase we ship the English source plus translations in the other 9 languages. Non-Latin scripts include romanized pronunciation guides (e.g. 'Konnichiwa' for こんにちは).",
      },
      {
        q: "What practice modes are available?",
        a: "Three: (1) Browse — view the full phrase list with source and target columns. (2) Flashcard — see the source, click to flip and reveal the target translation. (3) Reverse translation — see the target, type the source, and get instant feedback. You can also do reverse lookup (target → source) and free-text translation lookup.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 10 language presets. (2) 8 phrase category presets. (3) 200+ built-in phrases (all languages × categories). (4) Translation lookup (source → target). (5) Reverse translation (target → source). (6) Pronunciation guide (romanized for non-Latin). (7) Conjugation tables (10 verbs × 6 tenses × 6 pronouns). (8) Number translator (1-100 in all 10 languages). (9) Flashcard mode. (10) Reverse-translation practice mode. (11) Render as text phrasebook. (12) Render as CSV. (13) Copy + download .txt/.csv. (14) History (localStorage, last 20). (15) Shareable URL with settings encoded in hash. (16) Summary stats (by category, language pair). (17) Search filter across all phrases. (18) Difficulty marker per phrase (basic/intermediate/advanced).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All translations, conjugations, and number lookups come from a built-in client-side dataset. No translation API is called. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

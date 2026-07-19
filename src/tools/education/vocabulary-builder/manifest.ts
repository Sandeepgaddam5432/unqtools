import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "vocabulary-builder",
  name: "Vocabulary Builder & Study Modes",
  description:
    "Build vocabulary lists with word, definition, example sentence, synonyms, and antonyms. Study with browse, flashcard, and match-game modes. Multi-format parser (pipe, comma, JSON), word validator + normalizer, synonym/antonym parser + deduper, auto difficulty marker (1-5), search filter, alphabetical sorter, Fisher-Yates randomizer, flashcard deck builder, match-game pair generator + validator, text/CSV/JSON renderers, copy + multi-download, history (localStorage), shareable URL, summary stats, word frequency analyzer, and 4 vocab presets (SAT, GRE, TOEFL, elementary). 100% client-side — no network.",
  category: "education",
  keywords: [
    "vocabulary", "vocab", "words", "spelling",
    "sat", "gre", "toefl", "esl",
    "synonyms", "antonyms", "flashcards", "match game",
    "education", "learning", "language",
  ],
  icon: "book-open",
  requiresNetwork: false,
  seo: {
    title: "Vocabulary Builder & Study Modes — Flashcards + Match Game | UnQTools",
    faq: [
      {
        q: "How does the vocabulary builder work?",
        a: "Enter words one per line in pipe-separated format 'word|definition|example|synonyms|antonyms'. Synonyms and antonyms are comma-separated within their cell (e.g. 'happy,joyful,glad'). The tool validates each entry, auto-marks difficulty (1-5), and lets you study with three modes: browse (expandable list), flashcard (flip animation), or match-game (match words to definitions).",
      },
      {
        q: "What input formats are supported?",
        a: "Three: (1) pipe-separated 'word|definition|example|synonyms|antonyms' (synonyms/antonyms are comma-separated within the cell); (2) comma-separated 'word,definition' (minimal form); (3) JSON array of {word, definition, example?, synonyms?, antonyms?} objects. Only word + definition are required — the rest are optional.",
      },
      {
        q: "What study modes are available?",
        a: "Three: browse (filterable list with expandable cards showing full word info), flashcard (one word at a time, click to flip and reveal the definition + example), and match-game (4-6 word/definition pairs per round, click a word then click its matching definition to score). Match game validates each answer and tracks correct/incorrect pairs.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Multi-format word parser (pipe, comma, JSON). (2) Word validator + normalizer. (3) Synonym/antonym parser + deduper. (4) Auto difficulty marker (1-5 based on word length + definition complexity). (5) Search filter (case-insensitive across all fields). (6) Alphabetical sorter. (7) Fisher-Yates randomizer. (8) Flashcard deck builder. (9) Match-game pair generator + answer validator. (10) Text/CSV/JSON renderers. (11) Copy + multi-download (.txt, .csv, .json). (12) History (localStorage, last 20). (13) Shareable URL with words encoded in hash. (14) Summary stats (by difficulty, avg synonyms per word). (15) Word frequency analyzer (top 10 most common words across definitions/examples). (16) 4 vocabulary list presets (SAT, GRE, TOEFL, elementary).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, validation, difficulty marking, rendering, and game logic run locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};

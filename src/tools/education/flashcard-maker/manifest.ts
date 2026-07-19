import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "flashcard-maker",
  name: "Flashcard Maker & Study Mode",
  description:
    "Create flashcards from term/definition pairs and study them with flip animation, shuffle, sequential and simplified SM-2 spaced-repetition modes. Multi-format parser (pipe, comma, tab, JSON), deck validator, Fisher-Yates shuffler, mark known/unknown, session + summary stats, CSV/JSON/TXT export, history (localStorage), shareable URL, card search filter, reverse mode, per-card tags, per-card difficulty, and 4 deck presets (Spanish vocab, US states, multiplication tables, periodic table). 100% client-side — no network.",
  category: "education",
  keywords: [
    "flashcard", "flashcards", "study", "memorize",
    "spaced repetition", "sm-2", "quiz", "deck",
    "vocabulary", "learning", "education",
  ],
  icon: "layers",
  requiresNetwork: false,
  seo: {
    title: "Flashcard Maker & Study Mode — Flip, Shuffle, SM-2 Spaced Repetition | UnQTools",
    faq: [
      {
        q: "How does the flashcard maker work?",
        a: "Paste term/definition pairs (one per line, separated by | or tab or comma, or as JSON). The tool validates the deck, lets you study with a flip animation, and tracks known/unknown answers. You can study sequentially, shuffled, or with a simplified SM-2 spaced-repetition algorithm that adjusts each card's interval and ease factor based on your answers.",
      },
      {
        q: "What input formats are supported?",
        a: "Four formats: pipe-separated ('term|definition'), tab-separated ('term\\tdefinition'), comma-separated ('term,definition'), and newline-JSON (an array of {term, definition} objects). For pipe-separated lines you can also add a 3rd field for tags ('tag1,tag2') and a 4th field for difficulty ('easy|medium|hard').",
      },
      {
        q: "What study modes are available?",
        a: "Three: sequential (cards in order), shuffled (Fisher-Yates random order), and spaced-repetition-simplified (SM-2 algorithm — each card has an ease factor, interval and repetition count that updates based on whether you mark it known or unknown).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Multi-format card parser (pipe/comma/tab/JSON). (2) Deck validator. (3) Fisher-Yates shuffler. (4) Sequential iterator with prev/next. (5) Simplified SM-2 spaced repetition. (6) Session stats (correct, incorrect, accuracy %). (7) Summary stats (total cards, studied, accuracy). (8) Text/CSV/JSON renderers. (9) Copy + multi-download (txt, csv, json). (10) History (localStorage, last 20). (11) Shareable URL with deck encoded in hash. (12) Card search filter. (13) Reverse mode (definition→term). (14) Per-card tags. (15) Per-card difficulty (easy/medium/hard). (16) 4 deck presets (Spanish vocab, US states, multiplication tables, periodic table).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, shuffling, SM-2 updates, and rendering run locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};

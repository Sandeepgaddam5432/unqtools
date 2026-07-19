import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "spelling-bee-practice",
  name: "Spelling Bee Practice",
  description:
    "Practice spelling with text-to-speech pronunciation. Hear the word, type it, get instant feedback. 5 difficulty levels (elementary → spelling-bee) with 500+ built-in words, 3 practice modes (type-the-word, multiple choice, fill-in-blank), case-insensitive diacritic-aware validator, Fisher-Yates shuffler, WPM→TTS rate converter, hint generator (first letter + dashes), Levenshtein similar-word finder, multiple-choice distractor generator, fill-in-blank generator, phonetic pronunciation guide, word frequency marker, homophone detector, practice state machine, text/CSV renderers, copy + download, history (localStorage), and shareable URL. 100% client-side — no network.",
  category: "education",
  keywords: [
    "spelling", "spelling bee", "spelling practice",
    "vocabulary", "education", "learning", "tts", "text-to-speech",
    "elementary", "middle school", "high school", "college", "sat", "gre",
    "homophones", "phonetics",
  ],
  icon: "spell-check",
  requiresNetwork: false,
  seo: {
    title: "Spelling Bee Practice — Hear & Spell Words with TTS | UnQTools",
    faq: [
      {
        q: "How does the spelling bee practice tool work?",
        a: "Click 'Play word' to hear the word pronounced via your browser's Web Speech API (SpeechSynthesis). Type what you hear in the input field and press Submit. The tool compares your answer to the correct spelling (case-insensitive, with optional diacritic tolerance) and gives instant feedback. Use Next/Skip to advance through the queue and watch your live score.",
      },
      {
        q: "What difficulty levels and word lists are included?",
        a: "Five levels: Elementary (K-5), Middle School (6-8), High School (9-12), College/SAT/GRE, and Spelling Bee Champion. Each ships with 100+ curated words for a total of 500+ unique words across all levels. You can also paste your own custom word list (one per line).",
      },
      {
        q: "What practice modes are available?",
        a: "Three: (1) Type-the-word — hear the word, type it, get instant correct/incorrect feedback. (2) Multiple choice — hear the word, pick the correct spelling from 4 options (the distractors are generated via Levenshtein-distance similar-word finder, so they're tricky but plausible). (3) Fill-in-the-blank — see a sentence with the word replaced by '___', type the missing word.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 5 difficulty presets with 500+ built-in words. (2) 3 practice modes (type, multiple choice, fill-in-blank). (3) Case-insensitive diacritic-aware spelling validator. (4) Fisher-Yates shuffler for randomized sessions. (5) WPM→TTS rate converter (clamped 0.5-2.0). (6) Hint generator (first letter + dashes). (7) Levenshtein-distance similar-word finder. (8) Multiple-choice distractor generator with single-char swap fallback. (9) Fill-in-blank sentence generator. (10) Phonetic pronunciation guide (basic substitution rules). (11) Word frequency marker (common/rare). (12) Homophone detector (50+ pairs). (13) Practice state machine (idle→playing→answered→finished). (14) Summary stats (accuracy, avg time, hardest word). (15) Text + CSV renderers. (16) Copy + download .txt/.csv. (17) History (localStorage, last 20). (18) Shareable URL with words + settings encoded in hash.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All word lists, scoring, validation, and TTS calls run locally in your browser. The Web Speech API uses your device's built-in voice synthesis — no audio is sent to a server. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "geography-quiz",
  name: "Geography Quiz Maker",
  description:
    "Test your world geography with a built-in 150+ country database across 6 topics (capitals, currencies, languages, continents, populations, flag descriptions) and 8 regions (world + 7 continents). Generate multiple-choice or type-answer quizzes at 3 difficulty levels (easy = well-known countries, hard = obscure). Includes smart distractor generator (same-continent priority), case-insensitive fuzzy answer validator, score calculator, summary stats (accuracy, hardest region), text/HTML/CSV renderers (printable), country search/filter, flag description reference, history (localStorage), and shareable URL. 100% client-side — no network.",
  category: "education",
  keywords: [
    "geography", "geography quiz", "capitals",
    "countries", "world quiz", "trivia",
    "flags", "currencies", "languages",
    "continents", "education", "learning",
  ],
  icon: "globe",
  requiresNetwork: false,
  seo: {
    title: "Geography Quiz Maker — Capitals, Flags, Currencies, Languages | UnQTools",
    faq: [
      {
        q: "How does the Geography Quiz Maker work?",
        a: "Pick a topic (capitals, currencies, languages, continents, populations, or flag descriptions), a region (world or one of 7 continents), the number of questions, a difficulty level (easy/medium/hard), and the question type (multiple-choice or type-answer). The tool samples countries from the built-in 150+ country database, generates questions with smart same-continent distractors, scores your answers, and shows summary stats including the hardest region.",
      },
      {
        q: "What country data is included?",
        a: "A built-in database of 150+ countries, each with six attributes: capital city, currency code, primary official language, continent, approximate population (in millions), and a short text description of the national flag (colors, symbols, patterns). The database spans all 6 inhabited continents.",
      },
      {
        q: "How do difficulty levels work?",
        a: "Each country is tagged with a fame score (1 = well-known, 2 = medium, 3 = obscure). Easy mode restricts to fame-1 countries (US, France, Japan, etc.). Medium mode adds fame-2 countries (Nigeria, Peru, Sweden). Hard mode adds the obscure fame-3 countries (Tuvalu, Andorra, Bhutan) — making it a real challenge.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Built-in 150+ country database with 6 attributes each. (2) 6 quiz topics (capitals, currencies, languages, continents, populations, flag descriptions). (3) 8 region filters (world + 7 continents). (4) 3 difficulty levels (easy/medium/hard via fame scoring). (5) 2 question types (multiple-choice + type-answer). (6) Question generator per topic + region + difficulty. (7) Smart same-continent distractor generator. (8) Case-insensitive fuzzy answer validator (accepts 'washington dc' for 'Washington, D.C.', 'st.' for 'Saint'). (9) Score calculator with percentage. (10) Per-region breakdown. (11) Summary stats (accuracy, hardest region). (12) Text quiz renderer (printable). (13) HTML quiz renderer (printable). (14) CSV renderer (question, correct, options). (15) Copy + Download .txt / .html / .csv. (16) History (localStorage, last 20 quiz scores). (17) Shareable URL with settings in hash. (18) Country search/filter. (19) Flag description reference table.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. The entire country database lives in your browser. Quiz generation, scoring, and rendering all run locally. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};

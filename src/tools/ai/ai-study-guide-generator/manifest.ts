import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-study-guide-generator",
  name: "AI Study Guide Generator",
  description:
    "Transform notes or a textbook chapter into a structured study guide: overview, learning objectives, key terms with definitions, concept explanations, worked examples, and self-test questions (MCQ + short answer) with answers. Four output formats — outline, Q&A, summary sheet, and flashcards. Adjustable reading level (elementary → college) and depth (quick → comprehensive). Extractive summarization, key-term extraction via TF-style scoring, concept map outline, and spaced-repetition-ready export. History (last 20), favorites (localStorage), and shareable URL. 100% client-side — optional BYO-key LLM enhancement.",
  category: "ai",
  keywords: [
    "study guide generator", "notes to study guide", "study guide maker",
    "key terms extractor", "qa generator", "flashcard generator",
    "summary sheet", "extractive summarizer", "notebooklm alternative",
    "private study tool", "no login study guide", "online study guide",
  ],
  icon: "book-open",
  requiresNetwork: false,
  seo: {
    title: "AI Study Guide Generator — Notes to Structured Guide, Private | UnQTools",
    faq: [
      {
        q: "How does the AI Study Guide Generator work?",
        a: "Paste your notes or chapter text and the tool extracts sentences and terms using on-device extractive summarization (TF-style scoring) and key-term detection. You choose an output format — outline, Q&A, summary sheet, or flashcards — and a reading level (elementary, middle, high, college) and depth (quick, standard, comprehensive). The generator then assembles a structured study guide with overview, learning objectives, key terms with definitions, concept explanations, and self-test questions with answers.",
      },
      {
        q: "What output formats are available?",
        a: "Four formats: (1) Outline — a hierarchical topic → subtopic → key-point breakdown, ideal for review scanning. (2) Q&A — short-answer + multiple-choice self-test questions with toggleable answers. (3) Summary sheet — a one-page condensed overview with the top sentences and key terms. (4) Flashcards — front/back card pairs ready for spaced-repetition review (compatible with the AI Flashcard Q&A Generator format).",
      },
      {
        q: "How does reading level and depth control work?",
        a: "Reading level adjusts the maximum sentence length retained and the vocabulary complexity of generated questions — elementary keeps short, simple sentences; college retains longer technical sentences. Depth controls how many top sentences per section are retained (quick = 3, standard = 5, comprehensive = 8) and how many questions are generated (quick = 5, standard = 10, comprehensive = 15).",
      },
      {
        q: "Is my study material uploaded anywhere?",
        a: "No. All summarization, term extraction, and Q&A generation runs locally in your browser. Nothing is uploaded or logged by us. If you paste your own OpenAI or Anthropic API key (optional), the request goes directly from your browser to that provider — your key is stored only in localStorage on this device. Without a key, the on-device extractive engine produces a solid baseline guide fully offline.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 4 output formats (outline, Q&A, summary, flashcard). (2) 4 reading levels (elementary, middle, high, college). (3) 3 depth presets (quick, standard, comprehensive). (4) Extractive summarization (TF-style sentence scoring). (5) Key-term extraction with definitions from context. (6) MCQ + short-answer Q&A generation with answers. (7) Spaced-repetition-ready flashcard export (JSON). (8) Concept-map outline view. (9) Topic presets (12+). (10) Favorites (localStorage). (11) Copy + Download (text/Markdown/JSON/CSV). (12) Optional BYO-key LLM enhancement. (13) History (localStorage, last 20). (14) Shareable URL. (15) Collapsible sections in the UI.",
      },
    ],
  },
  status: "done",
};

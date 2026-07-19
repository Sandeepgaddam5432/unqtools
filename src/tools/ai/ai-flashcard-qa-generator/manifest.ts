import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-flashcard-qa-generator",
  name: "AI Flashcard Q&A Generator",
  description:
    "Paste notes or text and instantly get editable Q&A flashcards with cloze deletions, true/false, fill-in-the-blank, and multiple-choice variations. Built-in SM-2 spaced-repetition study mode with self-grading, difficulty tags, deck management, and export to Anki CSV, Quizlet, and JSON. Pure-JS template engine — optional BYO-key LLM. 100% client-side, no sign-up, no upload.",
  category: "ai",
  keywords: [
    "flashcard generator", "notes to flashcards", "anki card generator",
    "spaced repetition maker", "qa generator", "cloze deletion",
    "study cards", "no login flashcards", "sm-2 scheduler",
    "flashcard maker from notes",
  ],
  icon: "layers",
  requiresNetwork: false,
  seo: {
    title: "AI Flashcard Q&A Generator — Anki/CSV Export, SM-2 Study | UnQTools",
    faq: [
      {
        q: "How does the flashcard Q&A generator work?",
        a: "Paste your notes or any text. The tool splits the text into sentences, extracts key terms (capitalized nouns, definitions, numbers, and frequent terms), then expands five card-type templates (definition, true/false, fill-in-the-blank, multiple-choice, cloze) to produce a deck. Each card is editable — you can fix questions, rewrite answers, add tags, or delete cards that don't make sense. Cards include a 'grounded' flag based on sentence overlap so you know which ones came straight from your notes vs. heuristic inference.",
      },
      {
        q: "What is SM-2 spaced repetition and how does study mode work?",
        a: "SM-2 is the algorithm used by Anki and SuperMemo. Each card has an interval (days until next review), an easiness factor (how easy you find it), and a repetition count. When you self-grade a card (Again / Hard / Good / Easy), the scheduler updates those values and schedules the next review. 'Again' resets the card to today; 'Good' multiplies the interval by the easiness factor; 'Easy' multiplies by the easiness factor plus a bonus. Progress is saved in localStorage so you can resume across sessions.",
      },
      {
        q: "Can I export to Anki and Quizlet?",
        a: "Yes. The Anki CSV export uses the standard tab-separated format (front\\tback\\ttags) that Anki's File → Import accepts directly. The Quizlet CSV uses comma-separated front,back pairs. JSON export preserves all card metadata (id, type, difficulty, tags, SM-2 state) for re-importing into this tool. Cloze cards export with Anki's {{c1::...}} syntax.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Five card-type templates (definition, true/false, fill-in-the-blank, multiple-choice, cloze). (2) Key-term extraction from notes with frequency scoring. (3) Sentence-level grounding flags. (4) Editable cards (question, answer, tags, difficulty). (5) SM-2 spaced-repetition scheduler. (6) Study mode with flip + 4-button self-grading. (7) Deck shuffle + focus-weak-cards mode. (8) Difficulty tags (easy/medium/hard). (9) Anki CSV export. (10) Quizlet CSV export. (11) JSON export/import. (12) Deck management (merge multiple sources). (13) Per-card review stats. (14) History (localStorage, last 20). (15) Shareable URL. (16) Optional BYO-key LLM enhancement for higher-quality questions.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All text parsing, key-term extraction, template expansion, SM-2 scheduling, and export generation run locally in your browser. Your notes never leave this device. Decks and study progress are stored in localStorage on this device only. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};

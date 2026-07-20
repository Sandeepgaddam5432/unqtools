import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-text-simplifier-eli5",
  name: "AI Text Simplifier (ELI5)",
  description:
    "Simplify complex text to ELI5 (Explain Like I'm 5), grade-school, teen, or plain-professional reading levels. Pure-JS engine: jargon detector with inline plain-English glosses, sentence splitter for long sentences, synonym substitution toward grade-school vocabulary, Flesch–Kincaid reading-ease and grade-level before/after scores, preserve-exactly locks for numbers/dates/citations, side-by-side diff, history, share URL. Optional BYO-key LLM — key stays 100% client-side. 100% offline, nothing uploaded.",
  category: "ai",
  keywords: [
    "eli5", "text simplifier", "explain like i'm 5",
    "plain language rewriter", "reading level", "flesch-kincaid",
    "simplify text no login", "readability improver",
    "grade school reading", "plain english",
  ],
  icon: "baby",
  requiresNetwork: false,
  seo: {
    title: "AI Text Simplifier (ELI5) — Plain Language, Private, On-Device | UnQTools",
    faq: [
      {
        q: "How does the ELI5 text simplifier work?",
        a: "Paste dense text, pick a reading level (ELI5 / grade-school / teen / plain-professional), and the engine rewrites it locally: it detects jargon and shows a plain-English gloss inline, swaps denser synonyms for grade-school ones, splits sentences over 20 words into shorter ones, and preserves numbers, dates, dosages, and citations verbatim. You get a before/after Flesch reading-ease and grade-level score so you can see the improvement.",
      },
      {
        q: "What reading levels are supported?",
        a: "Four presets: (1) ELI5 — for very young readers, uses the simplest synonyms and splits every sentence over 12 words. (2) Grade-school — roughly grade 5, simple synonyms and split over 20 words. (3) Teen — roughly grade 8, medium-simple synonyms, split over 25 words. (4) Plain-professional — keeps the original vocabulary but adds glossary tooltips, no forced splits.",
      },
      {
        q: "What gets preserved exactly?",
        a: "The engine locks figures (e.g. 42, 3.14), dates (2024-03-15, March 15 2024), times, currency amounts ($1,200), percentages (40%), dosages (500mg), citations (Smith v. Jones, 2020; DOI: 10.xxxx), and URLs so they survive simplification unchanged. You can turn this off if you want full rewrites, but for legal, medical, or financial text you should keep it on.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Four reading levels (ELI5 / grade-school / teen / plain-professional). (2) Jargon dictionary with 80+ common dense words mapped to plain synonyms. (3) Inline glossary tooltips on detected jargon. (4) Sentence splitter (threshold per level). (5) Synonym substitution toward grade-school vocabulary. (6) Preserve-exactly locks for numbers/dates/citations/currency/percentages/dosages/URLs. (7) Flesch reading-ease + grade-level before/after scores. (8) Side-by-side original vs simplified diff. (9) Sentence-length + passive-voice highlights. (10) Bullet-ize option (turn paragraphs into bullet lists). (11) Sample text presets. (12) Statistics (word count, sentence count, long-sentence count, jargon count, improvement delta). (13) Copy/download simplified text. (14) History (localStorage, last 20). (15) Shareable URL. (16) Optional BYO-key LLM enhancement hook.",
      },
      {
        q: "Is my text sent anywhere?",
        a: "No. All simplification, glossary matching, readability scoring, and splitting run locally in your browser. Text never leaves this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose. Note: simplification can lose nuance in legal or medical text — always verify critical content against the original.",
      },
    ],
  },
  status: "done",
};

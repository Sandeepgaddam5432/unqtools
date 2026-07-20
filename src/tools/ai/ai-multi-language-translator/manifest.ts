import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-multi-language-translator",
  name: "AI Multi-Language Translator",
  description:
    "Translate text between 10 languages with a built-in 100+ phrase dictionary, translation memory, auto-detect, swap, batch mode, glossary, transliteration, and side-by-side output — 100% client-side. Optional BYO-key LLM for full-text neural translation. Nothing uploaded.",
  category: "ai",
  keywords: [
    "translator", "multi-language translator", "translate text",
    "translation memory", "phrasebook", "language translator",
    "on-device translator", "offline translator", "private translation",
  ],
  icon: "languages",
  requiresNetwork: false,
  seo: {
    title: "AI Multi-Language Translator — On-Device, 10 Languages, Private | UnQTools",
    faq: [
      {
        q: "How does the AI Multi-Language Translator work?",
        a: "The translator ships with a built-in phrasebook of 100+ common phrases across 10 languages (English, Spanish, French, German, Italian, Portuguese, Russian, Japanese, Chinese, Arabic). When you type text, the engine scans it for known phrases and substitutes them from the dictionary. Unrecognized segments fall back to your translation memory (phrases you've previously approved) or pass through verbatim. For full-text neural translation, paste your own LLM API key (OpenAI or Anthropic) and click 'Translate with LLM'.",
      },
      {
        q: "Which languages are supported?",
        a: "Ten languages with full phrasebook coverage: English (en), Spanish (es), French (fr), German (de), Italian (it), Portuguese (pt), Russian (ru), Japanese (ja), Chinese (zh), and Arabic (ar). The engine auto-detects the source language using script-based heuristics (Cyrillic → Russian, CJK → Chinese/Japanese, Arabic script → Arabic, Latin → scored against diacritics). You can override the detection at any time.",
      },
      {
        q: "What is translation memory and how do I use it?",
        a: "Translation memory is a per-device store of source→target phrase pairs you've explicitly approved. When the engine encounters a phrase it can't find in the built-in dictionary, it checks your translation memory. If a match exists, it uses your stored translation. You can add, list, and clear entries from the UI — all stored locally in localStorage, never uploaded.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Built-in 100+ phrase × 10 language dictionary. (2) Translation memory (localStorage, per device). (3) Auto-detect source language via script heuristics. (4) Swap source/target with one click. (5) Batch mode (translate multiple lines). (6) Side-by-side output. (7) Custom glossary / do-not-translate list. (8) Transliteration for Cyrillic and Arabic scripts. (9) Character + word counter. (10) RTL detection for Arabic. (11) Local history (last 20). (12) Shareable URL with source/target/text encoded. (13) Optional BYO-key LLM for full-text translation. (14) Sample phrases per language. (15) Honesty disclaimers per language pair.",
      },
      {
        q: "Is my text sent anywhere?",
        a: "No. All phrasebook matching, translation memory lookup, and auto-detection run locally in your browser. Your text and translation memory never leave this device. The only network call is if you paste your own LLM API key and click 'Translate with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};

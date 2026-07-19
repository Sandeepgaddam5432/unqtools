import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-emoji-translator",
  name: "AI Emoji Translator",
  description:
    "Translate text↔emoji in both directions with adjustable density (sparse/medium/dense), per-word alternative emoji picker, polysemy disambiguation, and Unicode + Discord/Slack shortcode output. Bundled 500+ word emoji lexicon. Pure-JS template engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "emoji translator", "text to emoji", "emoji to text",
    "emoji decoder", "emoji speak", "discord shortcode",
    "slack emoji", "emoji converter", "no login emoji",
  ],
  icon: "smile",
  requiresNetwork: false,
  seo: {
    title: "AI Emoji Translator — Text↔Emoji Both Directions, Private | UnQTools",
    faq: [
      {
        q: "How does the emoji translator work?",
        a: "Type or paste text and the tool replaces words with their matching emojis using a bundled 500+ word lexicon. Pick a density mode (sparse replaces only high-confidence matches, medium is balanced, dense replaces everything with a fallback), an output target (Unicode emoji, Discord :shortcode:, or Slack :shortcode:), and a translation mode (strict whole-word, loose substring, or ratio density-controlled). The reverse direction decodes emojis back to plain English.",
      },
      {
        q: "What are strict, loose, and ratio modes?",
        a: "Strict mode only matches whole dictionary words (case-insensitive, punctuation-stripped). Loose mode also matches common substrings and lemmatized forms (plurals, verb endings). Ratio mode applies a density target — it ranks candidate matches by confidence and replaces only the top N% per sentence, so output stays readable on dense passages.",
      },
      {
        q: "How does polysemy disambiguation work?",
        a: "Some words have multiple emoji meanings depending on context — 'bank' could be 🏦 (financial) or 🌊 (river). The tool inspects neighboring words for disambiguation cues ('money bank' → 🏦, 'river bank' → 🌊) and falls back to the most common meaning when no cue is present. Each translated word also shows 1–3 alternative emojis you can click to swap.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Bidirectional text↔emoji. (2) Three density modes (sparse/medium/dense). (3) Three translation modes (strict/loose/ratio). (4) Three output targets (Unicode, Discord shortcode, Slack shortcode). (5) Per-word alternative-emoji picker. (6) Polysemy disambiguation (context-aware). (7) 500+ word bundled emoji lexicon. (8) Discord/Slack shortcode round-trip. (9) Copy + Download (text/markdown/json). (10) History (localStorage, last 20). (11) Shareable URL. (12) Topic presets. (13) Inline word/emoji swap UI. (14) Confidence score per match. (15) Optional BYO-key LLM enhancement.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All lexicon lookups, disambiguation, density control, and shortcode rendering run locally in your browser. Text never leaves this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};

import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-bias-checker",
  name: "AI Bias Checker for Articles",
  description:
    "Detect framing, loaded language, political lean, and sensationalism in articles. Pure-JS lexicons (left/right lean, loaded verbs, subjective adjectives, weasel words, hedges, passive-evasion), multi-axis scoring (political, emotional, factual, one-sidedness), inline phrase highlighting with neutral-rewrite suggestions, fact-vs-opinion sentence tagging, missing-perspective checklist, clickbait detector, Flesch readability, Markdown/JSON/HTML export, optional BYO-key LLM enhancement. 100% client-side — text never uploaded.",
  category: "ai",
  keywords: [
    "bias checker", "media bias", "loaded language", "framing",
    "political lean", "article bias", "detect bias",
    "weasel words", "sensationalism", "fact vs opinion",
    "news bias", "subjectivity checker",
  ],
  icon: "scale",
  requiresNetwork: false,
  seo: {
    title: "AI Bias Checker for Articles — Loaded Language, Framing & Lean Detector | UnQTools",
    faq: [
      {
        q: "How does the AI bias checker work?",
        a: "Paste an article or news story. The tool tokenizes it into sentences and scans every phrase against built-in lexicons of loaded verbs, subjective adjectives, weasel words, hedges, passive-evasion patterns, left-leaning and right-leaning terms, and clickbait patterns. Each flagged phrase is highlighted inline, and sentences are tagged fact/opinion/mixed/neutral. The tool computes scores across five axes (political lean, emotional tone, factual density, one-sidedness, sensationalism) and offers a neutral-rewrite of the most loaded sentences.",
      },
      {
        q: "Does it judge whether the article's claims are true?",
        a: "No. Bias detection is about language patterns — not truth. The tool flags how something is said (emotive adjectives, missing attribution, framing) and is explicit in the UI that it does not fact-check the claims themselves. Verifying accuracy requires independent fact-checking; this tool only surfaces linguistic signals of bias and rates the text, not the outlet.",
      },
      {
        q: "How is political lean estimated?",
        a: "Lean is estimated from the relative frequency of left-leaning vs right-leaning loaded terms (e.g. 'progressive' vs 'woke', 'gun control' vs 'second amendment rights'). Confidence is reported alongside the lean label (left / lean-left / center / lean-right / right) and is lower when both sides appear or when total political vocabulary is sparse. The reasoning is shown so you can audit the call.",
      },
      {
        q: "Can I get a neutralized rewrite of the article?",
        a: "Yes. Each flagged phrase carries a suggested neutral replacement. Click 'Neutralize' on any sentence to apply suggestions, or use the 'Neutral rewrite' button to produce a full-text version with loaded terms replaced, subjective adjectives stripped, and weasel words rewritten with attribution placeholders. The rewrite is a starting point for editing, not a final polish.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 7 lexicon categories (left-lean, right-lean, loaded verbs, subjective adjectives, weasel words, hedges, absolutisms). (2) Passive-evasion detector ('mistakes were made'). (3) Clickbait pattern detector with 7 regex patterns + caps-density check. (4) Multi-axis scoring: political lean (−100 to +100 with confidence), emotional (0-100), factual (0-100), one-sidedness (0-100), sensationalism (0-100). (5) Inline phrase highlighting with category + suggestion. (6) Per-sentence fact/opinion/mixed/neutral tagging. (7) Missing-perspective checklist with detection cues. (8) Flesch readability + grade level. (9) One-click neutralize (single sentence) and full-text neutral rewrite. (10) Lean reasoning (human-readable explanation). (11) Sensationalism heatmap (per-sentence). (12) Export to Markdown, JSON, and highlighted HTML. (13) History (localStorage, last 20). (14) Shareable URL. (15) Optional BYO-key LLM enhancement (OpenAI/Anthropic) for nuance the offline lexicons miss.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All lexicon matching, scoring, highlighting, and neutral rewriting runs locally in your browser. The article text never leaves this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose (OpenAI or Anthropic).",
      },
    ],
  },
  status: "done",
};

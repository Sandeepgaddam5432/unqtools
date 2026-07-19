import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-article-headline-generator",
  name: "AI Article Headline Generator",
  description:
    "Generate 10+ scored, A/B-ready article headlines from a topic or draft. Pure-JS headline formula library (How-To, List, Question, Bold Statement, Number, Contrarian, Benefit, Curiosity, How-Long, Secret) × emotional triggers × power words. Scores each headline on length, power words, emotional resonance, clickability, and SERP pixel width. Style presets, A/B pair picker, meta-description pairing, clickbait warning, optional BYO-key LLM enhancement. 100% client-side — nothing uploaded.",
  category: "ai",
  keywords: [
    "headline generator", "blog title generator", "ai headline analyzer",
    "catchy title maker", "title generator", "blog headline",
    "headline scorer", "ab test headline", "ab testing headline",
  ],
  icon: "newspaper",
  requiresNetwork: false,
  seo: {
    title: "AI Article Headline Generator — Scored & A/B Ready, Private | UnQTools",
    faq: [
      {
        q: "How does the headline generator work?",
        a: "Enter a topic or paste a draft. The tool extracts keywords and runs them through a built-in headline formula library (10 formula families: How-To, List, Question, Bold Statement, Number, Contrarian, Benefit, Curiosity, How-Long, Secret) combined with emotional triggers and power words. Each resulting headline is scored on length, power-word density, emotional resonance, clickability, and SERP pixel width. You get 10+ variations ready for A/B testing.",
      },
      {
        q: "What does the score measure?",
        a: "Five sub-scores combined into a 0-100 total: (1) Length — sweet spot is 50-60 chars / 6-9 words for SERP display. (2) Power words — density of high-impact words from a 200+ word lexicon. (3) Emotional resonance — fraction of emotion-bearing words (curiosity, urgency, surprise, fear, joy). (4) Clickability — formula type bonus + number/curiosity triggers. (5) SERP pixel width — Google truncates titles around 580-600px; under that = full visibility.",
      },
      {
        q: "Does it warn about clickbait?",
        a: "Yes. A clickbait detector flags headlines with too many hype triggers ('shocking', 'you won't believe', excessive capitalization, more than 2 power words, etc.) and shows a 'deliver on the promise' nudge. The honesty layer is built in — clickbait scores higher on clickability but lower on trust signals.",
      },
      {
        q: "Can I use my own LLM API key for richer headlines?",
        a: "Yes. The tool builds an optimal prompt (topic + draft summary + style preferences + power-word list) and calls OpenAI or Anthropic with a key you paste — stored only in localStorage on this device. If no key is provided, the on-device formula engine produces solid, scored, A/B-ready headlines fully offline.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 10 headline formula families. (2) 200+ power-word lexicon. (3) 6 emotional-trigger categories. (4) 5-axis scoring (length, power, emotion, clickability, pixel width). (5) SERP pixel-width estimator (no canvas needed). (6) A/B pair picker that contrasts 2 headlines. (7) Meta-description pairing (155-char target). (8) Clickbait detector with 'deliver on the promise' nudge. (9) Style presets (informative, provocative, listicle, newsy, evergreen). (10) Sort by score / length / style. (11) Topic + draft keyword extractor. (12) Topic presets for quick starts. (13) Copy + Download (text/CSV/JSON/Markdown). (14) Optional BYO-key LLM enhancement. (15) History (localStorage, last 20). (16) Shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All keyword extraction, formula rendering, scoring, and pixel-width estimation run locally in your browser. Topics and drafts never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};

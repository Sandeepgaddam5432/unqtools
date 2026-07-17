import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "title-tag-optimizer",
  name: "Title Tag Optimizer",
  description:
    "Optimize title tags for SEO and CTR. Character count, pixel width (512px), keyword position, power words, CTR estimate, suggestions, A/B compare, SERP preview, history. 100% client-side.",
  category: "seo",
  keywords: [
    "title tag", "seo title", "serp title", "title optimizer", "ctr",
    "pixel width", "power words", "title length", "html title", "snippet",
  ],
  icon: "type",
  requiresNetwork: false,
  seo: {
    title: "Title Tag Optimizer — Length, Pixel Width, CTR | UnQTools",
    faq: [
      {
        q: "How long should a title tag be?",
        a: "Google's desktop title pixel budget is ~512-580px (about 50-60 characters depending on character widths). Anything wider gets truncated with an ellipsis. This tool measures both character count and estimated pixel width to flag truncation risk.",
      },
      {
        q: "What are power words and why do they matter?",
        a: "Power words (best, proven, ultimate, fast, free, exclusive, etc.) drive higher click-through rates by adding emotional pull. This tool detects the power words in your title so you can quickly improve weak titles.",
      },
      {
        q: "How is the CTR score calculated?",
        a: "Baseline 50 points, then bonuses for length sweet-spot (50-60), keyword near the front, presence of digits, power words, call-to-action verbs, questions, and brackets. Penalties for over-length or all-caps shouting. Score is heuristic — your real CTR depends on intent and ranking.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Character counter (60 recommended). (2) Pixel-width estimator (512px). (3) Keyword position analyzer. (4) Power-word detector. (5) CTR score estimation. (6) Suggestion generator. (7) A/B compare. (8) SERP preview. (9) History (localStorage, last 20). (10) Shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Title analysis runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

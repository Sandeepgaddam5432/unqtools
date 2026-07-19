import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-logical-fallacy-detector",
  name: "AI Logical Fallacy Detector — Reasoning Aid",
  description:
    "Detect informal logical fallacies in arguments, essays, debate transcripts. 23 fallacy patterns (ad hominem, strawman, slippery slope, false dichotomy, appeal to authority/emotion/popularity, red herring, tu quoque, no true scotsman, hasty generalization, post hoc, sunk cost, and more). Inline highlights, confidence per flag, plain-English explanations, steelman suggestion, encyclopedia with examples, sensitivity slider, history (localStorage), shareable URL. Pure-JS pattern engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "logical fallacy detector", "fallacy finder", "find fallacies in text",
    "ad hominem", "strawman", "slippery slope", "false dichotomy",
    "argument checker", "reasoning errors", "debate analyzer",
    "informal fallacies", "private fallacy tool",
  ],
  icon: "scan-search",
  requiresNetwork: false,
  seo: {
    title: "AI Logical Fallacy Detector — Inline Highlights + Explanations | UnQTools",
    faq: [
      {
        q: "How does the AI Logical Fallacy Detector work?",
        a: "Paste an argument, essay, or debate transcript and the pattern engine scans it for 23 common informal fallacies — ad hominem, strawman, slippery slope, false dichotomy, appeal to authority/emotion/popularity/tradition/fear, red herring, tu quoque, no true scotsman, hasty generalization, post hoc, circular reasoning, anecdotal evidence, equivocation, genetic fallacy, burden of proof, middle ground, sunk cost, guilt by association, composition, and bandwagon. Each flag highlights the offending span, names the fallacy, shows a confidence score, explains the flaw, and suggests a steelman rewrite. Adjust the sensitivity slider to trade recall for precision.",
      },
      {
        q: "Why use a pattern engine instead of an LLM?",
        a: "Research (Jin et al., 'Logical Fallacy Detection', ETH/arXiv) shows LLMs over- and under-flag fallacies and miss structural cues. A transparent pattern layer gives high-precision cues: each flag points at the exact phrasing that triggered it, has a known confidence, and never invents a fallacy out of thin air. You can still paste your own LLM API key (OpenAI/Anthropic) and click 'Analyze with LLM' for tougher context-dependent calls — that request goes from your browser directly to the provider.",
      },
      {
        q: "How does the sensitivity slider work?",
        a: "Three presets. Strict only keeps high-confidence matches (>= 0.55) — fewer flags, more precision, useful for formal debate prep. Balanced is the default (>= 0.45). Lenient (>= 0.30) shows every plausible cue including weaker ones — useful when you want a high-recall first pass. Every flag also lists 'why this might be a false positive' so you can judge each one on its merits.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 23 fallacy patterns with inline highlight + name + confidence. (2) Plain-English explanation per flag. (3) Steelman rewrite suggestion. (4) False-positive risk callout per flag. (5) Sensitivity slider (strict/balanced/lenient). (6) Built-in encyclopedia of all 23 fallacies with examples. (7) Markdown report export. (8) Per-category stats. (9) Sample arguments (ad, essay, debate). (10) Local history (last 20). (11) Shareable URL with text + sensitivity encoded. (12) Copy highlighted HTML. (13) Optional BYO-key LLM analysis (OpenAI/Anthropic). (14) Honesty disclaimers (fallacy detection is hard, context-sensitive, and a reasoning aid — not an arbiter of truth). (15) Deterministic — same input + sensitivity always produces the same flags.",
      },
      {
        q: "Is my argument text sent anywhere?",
        a: "No. All pattern detection, highlighting, scoring, and report generation run locally in your browser. Text never leaves this device. The only network call is if you paste your own LLM API key and click 'Analyze with LLM' — that request goes directly from your browser to the LLM provider you choose (OpenAI or Anthropic).",
      },
    ],
  },
  status: "done",
};

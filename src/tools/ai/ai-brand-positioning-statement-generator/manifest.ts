import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-brand-positioning-statement-generator",
  name: "AI Brand Positioning Statement Generator",
  description:
    "Generate classic brand positioning statements from structured inputs using Moore, April Dunford, Jobs-to-be-Done, and Geiger frameworks. Tone variants (concise, energetic, formal), auto-derived messaging pillars, elevator pitch, taglines, generic-differentiator sharpener, Markdown/JSON export, history (localStorage), shareable URL, optional BYO-key LLM polish. 100% client-side — your inputs never leave the browser.",
  category: "ai",
  keywords: [
    "positioning statement", "brand positioning", "positioning template",
    "messaging pillars", "elevator pitch", "tagline generator",
    "april dunford", "moore formula", "jobs to be done", "jtbd",
    "brand strategy", "value proposition", "differentiation",
  ],
  icon: "target",
  requiresNetwork: false,
  seo: {
    title: "AI Brand Positioning Statement Generator — Moore, Dunford, JTBD + Pillars | UnQTools",
    faq: [
      {
        q: "How does the positioning statement generator work?",
        a: "Fill in your brand name, category, target audience, customer need, key benefit, differentiator, and reason to believe. The tool assembles positioning statements from four proven frameworks (Geoffrey Moore's classic formula, April Dunford's declarative style, Jobs-to-be-Done, and the Geiger formula) and renders them in three tone variants (concise, energetic, formal). It also derives three messaging pillars, an elevator pitch, and five tagline options from the same inputs so your messaging stays consistent.",
      },
      {
        q: "Which positioning frameworks are supported?",
        a: "Four: (1) Moore — 'For [audience] who [need], [brand] is a [category] that [benefit], unlike alternatives, [differentiator], because [reason].' (2) April Dunford — declarative '[brand] is a [category] for [audience]…' style. (3) Jobs-to-be-Done — 'When [audience] want to [need], they hire [brand] to [benefit].' (4) Geiger — '[brand] helps [audience] achieve [benefit] by [differentiator].' Pick the framework that fits your market context; you can switch and regenerate instantly.",
      },
      {
        q: "What is the 'sharpen my differentiator' feature?",
        a: "Generic differentiators ('high quality', 'world-class', 'innovative') weaken positioning. The tool scans your differentiator against a built-in list of ~30 generic phrases and flags each one with a specificity prompt. Sharpened text wraps each generic phrase in [brackets] so you can rewrite it with a concrete proof point (e.g., 'high quality' → 'ISO 9001 certified'). This keeps your positioning defensible instead of interchangeable.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Four positioning frameworks (Moore, Dunford, JTBD, Geiger). (2) Three tone variants (concise, energetic, formal) generated per framework. (3) Auto-derived 3 messaging pillars. (4) Auto-derived elevator pitch. (5) Five auto-derived taglines. (6) Generic-differentiator sharpener with ~30-phrase detector. (7) Live preview as you type. (8) Inline field hints + sample values per field. (9) Validation warnings (missing fields, short benefit, generic wording). (10) Markdown one-pager export. (11) JSON export. (12) Copy individual asset button. (13) History (localStorage, last 20). (14) Shareable URL with all inputs encoded. (15) Optional BYO-key LLM polish (OpenAI/Anthropic).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All template assembly, pillar/pitch/tagline derivation, generic-phrase detection, and Markdown/JSON export run locally in your browser. Your brand inputs never leave this device. The only network call is if you paste your own LLM API key and click 'Polish with LLM' — that request goes directly from your browser to the LLM provider you choose (OpenAI or Anthropic).",
      },
    ],
  },
  status: "done",
};

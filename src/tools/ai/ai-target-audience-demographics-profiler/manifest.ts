import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-target-audience-demographics-profiler",
  name: "AI Target Audience Demographics Profiler",
  description:
    "Profile your target audience with a complete ICP + persona: demographics, psychographics, goals, pains, channels, messaging angles, objections, buying triggers, and a named day-in-the-life. Built-in audience template library by product category (B2B SaaS, consumer app, e-commerce, marketplace, media, dev tool, education, healthcare, finance, etc.). Multiple segments + ICP scoring. Export persona card + ICP checklist as Markdown/JSON. 100% client-side — optional BYO-key LLM polish. Nothing uploaded.",
  category: "ai",
  keywords: [
    "target audience generator", "icp generator", "customer persona tool",
    "audience demographics", "buyer persona generator",
    "ideal customer profile", "marketing persona",
    "audience profiler", "persona demographics",
    "audience research", "segment persona",
  ],
  icon: "users",
  requiresNetwork: false,
  seo: {
    title: "AI Target Audience Demographics Profiler — ICP + Persona, Private | UnQTools",
    faq: [
      {
        q: "How does the target audience profiler work?",
        a: "Describe your product in 1–3 sentences, pick a category (B2B SaaS, consumer app, e-commerce, marketplace, media, dev tool, education, healthcare, finance, etc.), and the tool synthesizes a structured profile: demographics (age, gender, income, location, education), psychographics (values, lifestyle, interests), goals, pains, channels (where to reach them), messaging angles, objections, and buying triggers. Each persona includes a name, role, day-in-the-life, and a quote. Everything runs locally — nothing is uploaded.",
      },
      {
        q: "Can I generate multiple segments and an ICP?",
        a: "Yes. The tool produces 1–3 segments per run (e.g., primary, secondary, tertiary). Each segment gets its own persona card. The ICP (ideal customer profile) panel scores segments against five criteria — fit, urgency, budget, accessibility, and expansion — to identify your best-fit segment. You can override the score per segment if your real-world data disagrees.",
      },
      {
        q: "What categories does the audience template library cover?",
        a: "Ten categories: B2B SaaS, consumer app, e-commerce, marketplace, media / content, dev tool, education, healthcare, finance / fintech, and non-profit / community. Each category has bundled defaults for age range, income, top channels, top pains, top goals, common objections, and buying triggers — all of which the tool weaves into a persona. You can also pick 'generic' for any product.",
      },
      {
        q: "Can I use my own LLM API key for richer personas?",
        a: "Yes. With a key (OpenAI or Anthropic, stored only in localStorage on this device) you can ask the LLM to expand the day-in-the-life narrative, surface additional objections, or rewrite messaging angles in your brand voice. The LLM only enriches the locally-generated structure — it never invents the demographics from scratch. Without a key, the on-device template engine produces a complete, exportable persona fully offline.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 10-category audience template library. (2) Demographics + psychographics + goals + pains. (3) Named persona with day-in-the-life + quote. (4) Channels, messaging angles, objections, buying triggers. (5) Multiple segments (1–3) per run. (6) ICP scoring across 5 criteria. (7) ICP checklist (Markdown export). (8) Persona card export (Markdown + JSON). (9) Honesty label: hypothesis to validate, not real market data. (10) Anti-stereotype safeguards (no demographic determinism in pains/triggers). (11) Tone selector (formal / casual / data-driven). (12) Product presets for quick starts. (13) Save personas locally (last 20). (14) Shareable URL with product + category encoded. (15) Optional BYO-key LLM polish for narrative + messaging.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All category matching, persona synthesis, ICP scoring, and export rendering run locally in your browser. Your product description never leaves this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose (OpenAI or Anthropic).",
      },
    ],
  },
  status: "done",
};

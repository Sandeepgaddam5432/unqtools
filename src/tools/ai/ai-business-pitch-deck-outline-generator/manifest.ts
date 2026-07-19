import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-business-pitch-deck-outline-generator",
  name: "AI Business Pitch Deck Outline Generator",
  description:
    "Generate a structured, investor-ready pitch deck outline — the canonical 10–12 slides (Problem, Solution, Market, Product, Traction, Business Model, GTM, Competition, Team, Financials, Ask) with per-slide talking points, what investors look for, and common pitfalls. Deck-type presets (pre-seed, seed, Series A, sales deck), narrative-arc check (problem→solution→why-now→why-you), use-of-funds + milestones guidance, speaker-notes mode, Markdown export, history (localStorage), shareable URL, optional BYO-key LLM polish. 100% client-side — your startup data never leaves the browser.",
  category: "ai",
  keywords: [
    "pitch deck", "pitch deck outline", "investor pitch", "startup deck",
    "deck template", "pitch deck structure", "vc pitch", "fundraising deck",
    "series a deck", "seed deck", "sales deck", "slide outline",
  ],
  icon: "presentation",
  requiresNetwork: false,
  seo: {
    title: "AI Pitch Deck Outline Generator — Investor-Ready Structure, Private | UnQTools",
    faq: [
      {
        q: "How does the pitch deck outline generator work?",
        a: "Enter your company name, industry, funding stage (pre-seed, seed, Series A, or sales deck), target raise, and a few sentences on problem/solution/audience. The tool assembles the canonical investor-deck slide sequence (Problem, Solution, Market, Product, Traction, Business Model, GTM, Competition, Team, Financials, Ask) with per-slide talking points, 'what investors look for' notes, and common pitfalls. It also runs a narrative-arc check (problem→solution→why-now→why-you) and suggests a use-of-funds breakdown + milestones based on your stage and target raise. Output is tool-agnostic — drop the outline into Pitch, Google Slides, Keynote, PowerPoint, or whatever you build the actual deck in.",
      },
      {
        q: "Which pitch deck formats are supported?",
        a: "Four deck-type presets shape slide order and depth: pre-seed (lean, 10 slides, founder-heavy), seed (11 slides, traction-emerging), Series A (12 slides, metrics + GTM heavy), and sales deck (reorders to lead with customer value, replaces Financials with Pricing/Packages). The canonical slide set covers Problem, Solution, Market, Product, Traction, Business Model, GTM, Competition, Team, Financials, Ask. You can switch presets and regenerate instantly.",
      },
      {
        q: "What is the narrative-arc check?",
        a: "After generating the outline, the tool checks your narrative across four canonical investor questions: (1) Problem — is the problem concrete and quantified? (2) Solution — does the solution map to the problem? (3) Why now — is the timing/shift explicit? (4) Why you — is the team's credibility clear? Each check returns ok / weak / missing so you know where to tighten the story before you build slides.",
      },
      {
        q: "Does this tool design my slides?",
        a: "No — by design. Design comes after story. This tool generates the outline and talking points, the *narrative spine* of your deck. The 10x bar here is to focus on the thing that matters first (structure + narrative) rather than auto-design. Drop the exported Markdown into Pitch, Gamma, Google Slides, Keynote, PowerPoint, or your designer's tool of choice once the story is locked.",
      },
      {
        q: "What extra features does this tool have compared to other pitch-deck tools?",
        a: "(1) Four deck-type presets (pre-seed, seed, Series A, sales deck) shaping slide order and depth. (2) Canonical 10–12 slide sequence per preset. (3) Per-slide talking points (3–5 bullets each). (4) Per-slide 'what investors look for' notes. (5) Per-slide common pitfalls to avoid. (6) Narrative-arc check (problem→solution→why-now→why-you). (7) Auto-derived use-of-funds breakdown (% per category with rationale). (8) Auto-derived milestones for the raise period. (9) Speaker-notes mode (per-slide 30–60 second talk track). (10) Live outline preview as you type. (11) Validation warnings (missing problem, missing target raise, overlong ask, etc.). (12) Markdown export (drop into any tool). (13) JSON export (round-trips inputs + output). (14) One-click copy per slide. (15) History (localStorage, last 20). (16) Shareable URL with all inputs encoded. (17) Optional BYO-key LLM polish (OpenAI / Anthropic) with JSON-schema-validated response parsing.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All slide-template assembly, narrative-arc checking, use-of-funds derivation, milestone suggestion, Markdown/JSON export, history, and share-URL encoding run locally in your browser. Your startup data — including fundraising targets and traction numbers — never leaves this device. The only network call is if you paste your own LLM API key and click 'Polish with LLM' — that request goes directly from your browser to the LLM provider you choose (OpenAI or Anthropic).",
      },
    ],
  },
  status: "done",
};

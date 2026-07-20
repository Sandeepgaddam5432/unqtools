import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-user-persona-creator",
  name: "AI User Persona Creator",
  description:
    "Generate distinct, structured UX personas from a product description and audience notes. Each persona gets demographics, goals, pains, behaviors, motivations, frustrations, preferred channels, a quote, a day-in-the-life, an empathy map (says/thinks/does/feels), and jobs-to-be-done framing. Multiple persona variants (2-4) with bias-aware, confidence-flagged output. Export to Markdown, copy, download, history (localStorage, last 20), and shareable URL. 100% client-side. Optional BYO-key LLM enhancement — your product and research notes never leave the browser unless you choose to call your own provider.",
  category: "ai",
  keywords: [
    "user persona generator", "persona creator", "ux persona",
    "buyer persona", "ai persona", "persona maker",
    "no login persona generator", "private persona generator",
    "empathy map", "jobs to be done", "jtbd",
    "day in the life", "audience research",
  ],
  icon: "users",
  requiresNetwork: false,
  seo: {
    title: "AI User Persona Creator — UX Personas, Empathy Map, JTBD | UnQTools",
    faq: [
      {
        q: "How does the AI user persona creator work?",
        a: "Pick a product type (B2B SaaS, B2C mobile, e-commerce, marketplace, content/media, education, fintech, or healthtech), describe your product, and paste any audience notes or research. The tool generates 1-4 distinct personas, each with demographics, goals, pains, behaviors, motivations, frustrations, preferred channels, a quote, a day-in-the-life, an empathy map (says/thinks/does/feels), and jobs-to-be-done framing. Generation is deterministic per input — tweak the description or audience to regenerate variants.",
      },
      {
        q: "How is this different from ChatGPT or HubSpot Make My Persona?",
        a: "No login, no credit cap, no cloud upload. The tool runs entirely in your browser, drawing on per-product-type template banks (occupations, industries, goals, pains, behaviors, motivations, frustrations, channels, taglines). Every persona is flagged with a 'confidence' level (low/medium/high) and an explicit list of assumptions so the team knows what to validate with real user interviews. The optional BYO-key LLM step is just for richer text — never required.",
      },
      {
        q: "Are the personas reliable enough to ship decisions on?",
        a: "No — and the tool is honest about it. AI personas are hypotheses to validate, not facts. Each persona's confidence level and assumptions list flag what was inferred vs grounded in your input. When the audience or product description is short, demographics are templated from the product type — that produces a 'low' confidence score. Always pair generated personas with 5-8 real user interviews before relying on them for roadmap or messaging decisions.",
      },
      {
        q: "What extra features does this tool have?",
        a: "(1) 8 product types with per-type template banks (occupations, industries, goals, pains, behaviors, motivations, frustrations, channels, taglines). (2) 1-4 distinct personas per generation, deterministic per input. (3) Demographics (age, gender, occupation, industry, location, income, education, household). (4) Goals / pains / behaviors / motivations / frustrations lists. (5) Preferred channels. (6) Tech-savviness rating. (7) First-person quote in the persona's voice. (8) Day-in-the-life timeline (4 moments). (9) Empathy map (says/thinks/does/feels). (10) Jobs-to-be-done framing (functional/emotional/social). (11) Scenario narrative. (12) Confidence level + explicit assumptions. (13) Audience presets (founders, PMs, indie shoppers, students, remote workers, freelancers, SMB owners, fitness). (14) Per-persona Markdown export. (15) Combined Markdown export for all personas. (16) Stats (by confidence, by tech savviness, avg goals, distinct roles). (17) Local history (localStorage, last 20). (18) Shareable URL with full input encoded. (19) Bias-aware: explicit assumptions, deterministic generation, mixed-gender name banks. (20) Optional BYO-key LLM enhancement.",
      },
      {
        q: "Is my product or research data sent anywhere?",
        a: "No. All persona generation runs locally in your browser — your product description, audience notes, and research paste never leave this device. The only network path is if you explicitly paste your own LLM API key and click 'Enhance with LLM' — that request goes directly to your chosen LLM provider (OpenAI or Anthropic) and never touches UnQTools servers. Skip the LLM step for 100% offline use.",
      },
    ],
  },
  status: "done",
};

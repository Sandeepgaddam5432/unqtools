import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-essay-outline-generator",
  name: "AI Essay Outline Generator",
  description:
    "Generate thesis-driven essay outlines from a topic. Five essay types (argumentative, expository, narrative, compare-contrast, persuasive) with thesis variants, hook suggestions, section topic sentences, evidence/citation slots, counterargument + rebuttal (argumentative), and word-count estimates per section. Pure-JS template engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "essay outline", "essay outline generator", "thesis generator",
    "argumentative essay", "expository essay", "narrative essay",
    "compare contrast essay", "persuasive essay", "essay structure",
    "no login essay outline",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "AI Essay Outline Generator — Thesis-Driven, Private | UnQTools",
    faq: [
      {
        q: "How does the essay outline generator work?",
        a: "Enter your topic and pick an essay type (argumentative, expository, narrative, compare-contrast, or persuasive) plus a length (short ~500w, standard ~1000w, long ~2000w, extended ~3000w+). The tool extracts topic keywords, drafts 1–3 thesis variants, generates a hook, then builds a hierarchical outline: introduction, body sections each with a topic sentence and 2–4 evidence/citation slots, optional counterargument + rebuttal (argumentative only), and a conclusion with a closing thought. Word-count estimates are computed per section so you can hit your target length.",
      },
      {
        q: "How are the five essay types different?",
        a: "Argumentative essays include a counterargument + rebuttal section and a thesis that takes a debatable stance. Expository essays explain/inform without taking sides — sections walk through definitions, causes, effects, and examples. Narrative essays follow a story arc (setup, inciting incident, rising action, climax, falling action, resolution). Compare-contrast essays use either block or point-by-point structure with explicit comparison cues. Persuasive essays motivate the reader to act, with an urgency section and a clear call to action.",
      },
      {
        q: "What are evidence and citation slots?",
        a: "Each body section includes 2–4 evidence placeholders marked [EVIDENCE] and citation markers marked [CITE] that you fill in with your real sources. The outline is a scaffold — it tells you what kind of evidence each section needs (a statistic, a quote, an example, a study) but you must supply the actual sources. This is honesty-first: we don't fabricate citations.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Five essay-type templates (argumentative, expository, narrative, compare-contrast, persuasive). (2) Four length presets with per-section word-count estimates. (3) 1–3 thesis variants per outline. (4) Hook suggestions (question, quote, statistic, anecdote, definition). (5) Section topic sentences auto-generated. (6) Evidence + citation slot markers per section. (7) Counterargument + rebuttal (argumentative). (8) Compare-contrast structure selector (block / point-by-point). (9) Reorder sections. (10) Expand any section for deeper sub-points. (11) Conclusion with closing thought. (12) Copy + Download (text/Markdown/JSON). (13) History (localStorage, last 20). (14) Shareable URL. (15) Sample topic presets. (16) Optional BYO-key LLM enhancement.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All topic parsing, keyword extraction, template rendering, and word-count estimation run locally in your browser. Topics never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};

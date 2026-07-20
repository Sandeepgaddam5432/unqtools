import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-thesis-statement-generator",
  name: "AI Thesis Statement Generator",
  description:
    "Generate strong, arguable thesis statements from a topic, stance, and essay type. Four essay types (argumentative, analytical, expository, compare-contrast) with 5+ thesis variations per input, supporting-point scaffolds, counter-argument prompts, and rubric-based strength scores (clarity, specificity, arguability). Pure-JS engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "thesis statement", "thesis generator", "argumentative thesis",
    "essay thesis", "research paper thesis", "claim generator",
    "thesis maker", "no login thesis", "essay helper",
    "academic writing tool",
  ],
  icon: "graduation-cap",
  requiresNetwork: false,
  seo: {
    title: "AI Thesis Statement Generator — Arguable, Scored, Private | UnQTools",
    faq: [
      {
        q: "How does the thesis generator work?",
        a: "Enter your topic, your stance (for, against, or neutral), and pick an essay type (argumentative, analytical, expository, or compare-contrast). The engine extracts topic keywords, runs them through 5+ thesis templates per essay type, scores each variation on a rubric (clarity, specificity, arguability, scope), and returns the ranked set with supporting-point scaffolds and a counter-argument prompt for each.",
      },
      {
        q: "How are theses scored?",
        a: "Each thesis is graded on a transparent 0–100 rubric with four sub-scores: clarity (sentence structure, length, hedge words), specificity (named actors, concrete nouns, measurable qualifiers), arguability (presence of debatable verbs like 'should/ought/must' vs. factual statements), and scope (single claim, not too narrow or too broad). The composite score is the weighted average. Each thesis card shows the four sub-scores plus a one-line improvement tip.",
      },
      {
        q: "What are supporting-point scaffolds and counter-argument prompts?",
        a: "Every thesis comes with 3 supporting-point scaffolds — concrete claim templates you fill in with evidence ('[EVIDENCE: study] supports the claim because [REASONING]'). Each thesis also includes a counter-argument prompt that names the strongest likely objection, so you can address it in your essay. Scaffolds are structural; you must supply real evidence and citations.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Four essay-type templates (argumentative, analytical, expository, compare-contrast). (2) 5+ thesis variations per input. (3) Stance control (for/against/neutral). (4) Transparent rubric with 4 sub-scores + composite. (5) Supporting-point scaffolds per thesis. (6) Counter-argument prompts. (7) Improvement tips per thesis. (8) Scope-narrowing suggestions for broad topics. (9) Academic-level control (high school, undergraduate, graduate). (10) Citation-style hint (APA, MLA, Chicago, Harvard). (11) Outline-handoff link to the Essay Outline tool. (12) Copy + Download (text/Markdown/JSON). (13) History (localStorage, last 20). (14) Shareable URL. (15) 12 sample topic presets. (16) Topic keyword extraction. (17) Optional BYO-key LLM enhancement. (18) Refine-thesis chat prompt.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All topic parsing, keyword extraction, thesis templating, rubric scoring, and scaffold generation run locally in your browser. Your topic never leaves this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose. Always follow your institution's academic-integrity rules; theses are drafts to refine, not final work.",
      },
    ],
  },
  status: "done",
};

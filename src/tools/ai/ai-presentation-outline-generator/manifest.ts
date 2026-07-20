import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-presentation-outline-generator",
  name: "AI Presentation Outline Generator",
  description:
    "Generate slide-by-slide presentation outlines from a topic, audience, and goal. Six deck types (sales, training, conference, pitch, report, keynote) with narrative frameworks (problem-solution, hero's journey, pitch deck, lecture, report). Per-slide titles, bullets, speaker notes, and visual suggestions. Pure-JS template engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "presentation outline", "slide outline", "deck outline",
    "pitch deck outline", "presentation generator",
    "ai slide outline", "speaker notes", "no login deck",
    "keynote outline", "conference talk outline",
  ],
  icon: "presentation",
  requiresNetwork: false,
  seo: {
    title: "AI Presentation Outline Generator — Slide-by-Slide, Private | UnQTools",
    faq: [
      {
        q: "How does the presentation outline generator work?",
        a: "Enter your topic, audience, and goal, then pick a deck type (sales, training, conference, pitch, report, keynote) and a slide count (5–30). The tool extracts topic keywords, drafts a presentation thesis, then builds a slide-by-slide outline: each slide has a title, 3–5 bullet points, a speaker-notes paragraph, and a visual/chart suggestion. Per-slide time estimates are computed so you can hit your target talk length. Export to Markdown, plain text, or JSON for any deck tool.",
      },
      {
        q: "How do the deck types and narrative frameworks differ?",
        a: "Sales decks follow a problem → solution → demo → pricing → close arc. Training decks walk through learning objectives, concept slides, worked examples, practice, and recap. Conference talks use a hook → context → argument → evidence → takeaway structure. Pitch decks use the classic 10-slide investor sequence (problem, solution, market, product, traction, business model, team, competition, financials, ask). Report decks lead with the executive summary, then findings, methodology, and recommendations. Keynote decks use the hero's journey: ordinary world → call → trials → revelation → return.",
      },
      {
        q: "What are visual suggestions and speaker notes?",
        a: "Each slide includes a visual idea — a concrete suggestion for a chart, diagram, photo, or layout that fits the slide's content (e.g. 'Bar chart comparing Q1 vs Q2 revenue' or 'Screenshot of the dashboard'). Visuals are suggestions only; we do not generate images. Speaker notes are short paragraphs the presenter reads while the slide is on screen — they expand on the bullets and cue transitions. Both are scaffolds you can edit before presenting.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Six deck-type templates (sales, training, conference, pitch, report, keynote). (2) Five slide-count presets (lightning 5, short 10, standard 15, long 20, deep 30) with per-slide time estimates. (3) Three tone presets (formal, conversational, energetic). (4) Audience + goal inputs that shape slide language. (5) Per-slide title + bullets + speaker notes + visual suggestion. (6) Reorder slides (move up/down). (7) Regenerate / expand any single slide. (8) Presentation thesis generator with 1–3 variants. (9) Copy + Download (text/Markdown/JSON). (10) History (localStorage, last 20). (11) Shareable URL. (12) Sample topic presets. (13) Live word/time estimate. (14) Optional BYO-key LLM enhancement.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All topic parsing, keyword extraction, template rendering, and time estimation run locally in your browser. Topics and audiences never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose (OpenAI or Anthropic).",
      },
    ],
  },
  status: "done",
};

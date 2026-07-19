import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-analogies-generator",
  name: "AI Analogies Generator",
  description:
    "Explain any concept with tailored analogies across 10+ domains (cooking, sports, nature, technology, music, business, science, everyday life, kids, vehicles). Pure-JS analogy template engine with metaphor / simile / story styles, complexity levels, 'where it breaks down' honesty notes, explainer expansion, concept keyword extractor, audience presets, optional BYO-key LLM enhancement. 100% client-side — nothing uploaded.",
  category: "ai",
  keywords: [
    "analogy generator", "metaphor generator", "explain like analogy",
    "concept explainer", "metaphor maker", "simile generator",
    "analogy ai", "explain concept", "no login analogy",
  ],
  icon: "lightbulb",
  requiresNetwork: false,
  seo: {
    title: "AI Analogies Generator — Metaphor Maker, On-Device / Private | UnQTools",
    faq: [
      {
        q: "How does the analogies generator work?",
        a: "Enter a concept (e.g., 'DNS', 'quantum computing', 'compounding interest') and pick a domain (cooking, sports, nature, technology, music, business, science, everyday life, kids, vehicles). The tool extracts concept keywords and renders them into built-in analogy templates in your chosen style (metaphor, simile, or short story), producing 5–10+ variations. Each analogy comes with a 'where it breaks down' honesty note so you know its limits.",
      },
      {
        q: "What domains and styles are supported?",
        a: "10 domains × 3 styles (metaphor 'X is Y', simile 'X is like Y', short story 'Imagine…'). Complexity levels: simple (kid-friendly), standard (general audience), advanced (technical depth). Audience presets: kid, teen, expert, executive. Combined, this gives thousands of distinct analogy templates.",
      },
      {
        q: "Why does each analogy include a 'limitation' note?",
        a: "Because every analogy simplifies — and simplification can mislead if taken literally. The honesty note tells you exactly where the comparison breaks (e.g., 'unlike a recipe, code doesn't always run in order'). This avoids the classic analogy trap where the listener over-extends the metaphor.",
      },
      {
        q: "Can I use my own LLM API key for richer analogies?",
        a: "Yes. The tool builds an optimal prompt (concept + domain + style + complexity + audience) and calls OpenAI or Anthropic with a key you paste — stored only in localStorage on this device. If no key is provided, the on-device template engine produces solid baseline analogies fully offline.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 10 domain libraries (cooking, sports, nature, technology, music, business, science, everyday, kids, vehicles). (2) 3 analogy styles (metaphor, simile, story). (3) Complexity levels (simple/standard/advanced). (4) Audience presets (kid/teen/expert/executive). (5) Concept keyword extractor. (6) 'Where it breaks down' honesty notes per analogy. (7) Explainer expansion (full paragraph). (8) Copy + Download (text/JSON/Markdown). (9) Analogy quality scorer (0-100). (10) Domain randomizer for serendipity. (11) Optional BYO-key LLM enhancement. (12) History (localStorage, last 20). (13) Shareable URL. (14) Concept presets for quick starts. (15) Multi-domain batch generation.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All concept parsing, keyword extraction, template rendering, and honesty-note generation runs locally in your browser. Concepts never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};

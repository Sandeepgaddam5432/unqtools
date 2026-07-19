import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-fiction-story-generator",
  name: "AI Fiction Story Generator",
  description:
    "Generate fiction stories from a premise with genre (fantasy, sci-fi, mystery, romance, horror), tone (light/dark/comedic/dramatic/neutral), POV (first/third-limited/third-omniscient/second), and length controls. Six-stage plot arc (setup, inciting incident, rising action, climax, falling action, resolution), character sheets, story-bible for consistency, expand/regenerate/continue per section. Pure-JS template engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "fiction story generator", "ai story writer", "novel writing ai",
    "short story generator", "no login story generator",
    "fantasy story generator", "sci-fi story generator",
    "mystery story generator", "horror story generator",
  ],
  icon: "book-open",
  requiresNetwork: false,
  seo: {
    title: "AI Fiction Story Generator — Genre-Aware Plot Arc, Private | UnQTools",
    faq: [
      {
        q: "How does the AI fiction story generator work?",
        a: "Enter a premise (one or two sentences), pick a genre (fantasy, sci-fi, mystery, romance, horror), a tone (light, dark, comedic, dramatic, neutral), a point of view (first, third-limited, third-omniscient, second), and a length (flash ~250w, short ~750w, novelette ~1500w, novella ~3000w). The tool builds character sheets from your input, drafts a story-bible (characters, setting, themes, conflicts, plot points), then expands a six-stage plot arc — setup, inciting incident, rising action, climax, falling action, resolution — into prose paragraphs. Each stage uses genre-specific template beats so the result has a coherent beginning-middle-end structure. You can expand, regenerate, or continue any section.",
      },
      {
        q: "What is a story-bible and why does it matter?",
        a: "A story-bible is a compact reference document that captures the canonical facts of your story — character names and arcs, the setting, the central themes, the main conflict, and the ordered list of plot points. Long-form fiction tends to drift without one: the protagonist's eye color changes, the city's name shifts, the antagonist's motive contradicts itself. The story-bible is auto-generated from your premise and inputs, then displayed alongside the prose so you (or an LLM you bring your own key for) can consult it for consistency when continuing or expanding.",
      },
      {
        q: "Can I continue, expand, or regenerate sections?",
        a: "Yes. Each story section has three actions: Expand (adds another paragraph to that stage with deeper detail), Regenerate (re-rolls the template beats and prose for that stage), and Continue (appends a new paragraph that advances the plot using the story-bible's plot points). The plot arc is fixed (setup → inciting → rising → climax → falling → resolution) but within each stage you can iterate as much as you want. The result is exported as Markdown, plain text, or JSON.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Five genre templates (fantasy, sci-fi, mystery, romance, horror) with genre-specific plot beats. (2) Five tone presets (light, dark, comedic, dramatic, neutral). (3) Four POV options (first, third-limited, third-omniscient, second). (4) Four length presets with per-section word estimates. (5) Six-stage plot arc (setup, inciting, rising, climax, falling, resolution). (6) Character sheet input (name, role, description). (7) Setting field. (8) Auto-generated story-bible. (9) Auto-generated title. (10) Per-section expand / regenerate / continue. (11) Genre auto-detect from premise. (12) Sample premises per genre. (13) Copy + download (.txt/.md/.json). (14) History (localStorage, last 20). (15) Shareable URL. (16) Optional BYO-key LLM enhancement prompt builder.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All premise parsing, character parsing, template expansion, prose rendering, and story-bible generation runs locally in your browser. Premises, characters, and stories never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};

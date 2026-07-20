import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-svg-vector-art-generator",
  name: "AI SVG Vector Art Generator",
  description:
    "Generate clean, editable SVG vector art from a text prompt. Pure-JS parametric generator with five template families (geometric, mandala, pattern, landscape, icon), seeded randomization for reproducibility, color palette presets + custom colors, complexity control, live preview, built-in SVG optimizer + validator, and PNG / React-component export. Optional BYO-key LLM hook for richer art — key stays 100% client-side. 100% offline.",
  category: "ai",
  keywords: [
    "svg generator", "vector art", "text to svg", "ai svg",
    "mandala generator", "geometric art", "pattern generator",
    "svg no login", "svg no watermark", "vector icon generator",
    "recraft alternative", "svg genie alternative", "parametric svg",
  ],
  icon: "shapes",
  requiresNetwork: false,
  seo: {
    title: "AI SVG Vector Art Generator — Text to Clean Editable SVG, Private | UnQTools",
    faq: [
      {
        q: "How does the SVG vector art generator work?",
        a: "Pick a style (geometric, mandala, pattern, landscape, or icon), choose a color palette (8 presets or your own hex list), set a seed, complexity, and size, then click Generate. The tool builds SVG with real <path>, <polygon>, <circle>, and <line> elements — no embedded raster. A seeded mulberry32 PRNG makes every result reproducible: same seed → same art.",
      },
      {
        q: "Can I generate from a text prompt?",
        a: "Yes. The prompt parser looks for style keywords (mandala, mountain, heart, hex-tiles, chevron, etc.), complexity hints (simple / dense), and palette names (sunset, ocean, neon…). It converts a free-text prompt like 'dense neon mandala' into generator options. For complex illustrative prompts the on-device path is limited — switch to the BYO-key LLM hook for richer art.",
      },
      {
        q: "What extras does this tool have compared to others?",
        a: "(1) Five template families (geometric, mandala, pattern, landscape, icon). (2) Five pattern kinds (dots, hex-tiles, chevrons, waves, triangles). (3) Six icon shapes (heart, star, leaf, lightning, badge, hex-flower). (4) Eight color presets + custom hex input. (5) Seeded reproducibility (mulberry32 PRNG). (6) Complexity slider (1-10). (7) SVG minifier. (8) SVG validator (tag balance, viewBox, no embedded raster). (9) PNG raster export. (10) React-component export. (11) Local history (max 20). (12) Shareable URL with all options encoded. (13) Prompt → options heuristic parser. (14) Optional BYO-key LLM enhancement hook. (15) Honesty disclaimers about on-device limits.",
      },
      {
        q: "Are the SVGs clean and editable?",
        a: "Yes. Every output is hand-rolled from primitive SVG elements grouped under a single <svg> root with a proper viewBox and xmlns attribute. The validator checks for tag balance and flags any embedded raster. The minifier collapses whitespace and drops redundant attributes so the output is small enough to paste straight into HTML, Figma, or your editor.",
      },
      {
        q: "Is my prompt or art sent anywhere?",
        a: "No. All generation, validation, and minification run locally in your browser. The BYO-key LLM hook only fires if you paste an API key into the optional field, and even then the request goes directly from your browser to the model endpoint — nothing is logged or stored on our servers. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

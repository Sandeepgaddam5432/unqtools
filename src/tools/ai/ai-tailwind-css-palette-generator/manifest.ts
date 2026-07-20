import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-tailwind-css-palette-generator",
  name: "AI Tailwind CSS Palette Generator",
  description:
    "Generate a full Tailwind 50–950 color scale from one base hex/HSL, with perceptually-even OKLCH-style shading, color-harmony helpers (complementary, analogous, triadic, monochrome), WCAG contrast checks per shade pair, and copy-ready tailwind.config (v3 + v4) + CSS variables + JSON tokens. Brand + neutral + status set, presets, palette lock + randomize, save locally. 100% client-side — optional BYO-key LLM polish. Nothing uploaded.",
  category: "ai",
  keywords: [
    "tailwind color generator", "tailwind palette generator",
    "tailwind 50-950 generator", "color scale generator",
    "uicolors alternative", "tints.dev alternative", "coolors alternative",
    "oklch color generator", "tailwind config colors",
    "css color palette generator", "brand color generator",
  ],
  icon: "palette",
  requiresNetwork: false,
  seo: {
    title: "AI Tailwind CSS Palette Generator — Full 50–950 Scales, OKLCH, Private | UnQTools",
    faq: [
      {
        q: "How does the Tailwind palette generator work?",
        a: "Paste a base hex color (or pick one with the color input) and the tool generates a full 11-step Tailwind scale (50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950). Shades are produced in HSL/OKLCH-style perceptual space — we walk lightness from ~98% down to ~12% while keeping the hue and most of the chroma, then snap each step to its target lightness. The 500-step matches your input color as closely as the lightness target allows.",
      },
      {
        q: "Which harmonies and exports are supported?",
        a: "Four harmony helpers: complementary (180°), analogous (±30°), triadic (120° apart), and monochrome (same hue, varied chroma). You can export the palette three ways: (1) tailwind.config.js v3 object, (2) Tailwind v4 @theme CSS variables, and (3) raw JSON design tokens. Each export is one click to copy. Brand, neutral, and status (success/warning/danger/info) color sets are all generated from the same base so your whole system stays coherent.",
      },
      {
        q: "Can I check accessibility / contrast?",
        a: "Yes. Every shade pair is checked against white and black foregrounds using the WCAG 2.1 relative luminance formula. The preview shows which shades pass AA (4.5:1) and AAA (7:1) for body text, and which pass AA-Large (3:1). The component preview renders buttons, cards, and badges in the chosen palette so you can verify contrast in context. Always confirm in your own design before shipping to production.",
      },
      {
        q: "Can I use my own LLM API key for richer palettes?",
        a: "Yes. With a key (OpenAI or Anthropic, stored only in localStorage on this device) you can ask the LLM to suggest a base color from a vibe description like 'calm fintech app' or 'energetic fitness brand'. The base-color suggestion is then fed into the deterministic local shade engine — the LLM never generates shades itself, so output is always grounded. Without a key, the on-device presets and randomizer cover every common use case fully offline.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Full 11-step 50–950 Tailwind scales. (2) Perceptual HSL/OKLCH-style shade math. (3) Four harmony helpers (complementary, analogous, triadic, monochrome). (4) WCAG 2.1 contrast checks per shade vs white/black. (5) Brand + neutral + status color sets. (6) Three exports: tailwind.config v3, Tailwind v4 @theme CSS, JSON tokens. (7) Live component preview (buttons, cards, badges). (8) 12 curated base-color presets. (9) Palette lock + randomize. (10) Save palettes locally (last 20). (11) Shareable URL with encoded base color. (12) Optional BYO-key LLM vibe→color. (13) Dark-mode preview toggle. (14) Hex / HSL / RGB display per shade. (15) Honesty note: scales are a strong starting point — verify contrast in real designs.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All color math, harmony generation, contrast checks, and export rendering run locally in your browser. Your base color and palettes never leave this device. The only network call is if you paste your own LLM API key and click 'Suggest base from vibe' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};

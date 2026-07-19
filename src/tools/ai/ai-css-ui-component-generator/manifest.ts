import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-css-ui-component-generator",
  name: "AI CSS UI Component Generator",
  description:
    "Describe a UI component in plain English ('pricing card with toggle', 'navbar with search') and get clean, responsive HTML + CSS, Tailwind utility classes, or inline-styled markup with a live sandboxed preview. Built-in component template library (buttons, cards, modals, navbars, forms, alerts, badges, dropdowns, tabs, hero, footer, accordion, tooltip, progress, input) with theme controls (color, radius, font, dark mode), accessibility checks, refinement parser, variant generator, and component scorer. 100% client-side — optional BYO-key LLM enhancement.",
  category: "ai",
  keywords: [
    "css component generator", "ui component generator", "ai ui generator",
    "tailwind component generator", "html css generator", "v0 alternative",
    "component library", "ui snippet generator", "no login ui generator",
    "css template generator", "react component generator",
  ],
  icon: "layout-template",
  requiresNetwork: false,
  seo: {
    title: "AI CSS UI Component Generator — HTML / Tailwind / Inline, Live Preview | UnQTools",
    faq: [
      {
        q: "How does the AI CSS UI Component Generator work?",
        a: "Type a natural-language description like 'pricing card with toggle' or 'navbar with search and dark mode'. The tool extracts keywords, matches them against a built-in library of 15+ component types (button, card, modal, navbar, form, alert, badge, dropdown, tabs, hero, footer, accordion, tooltip, progress, input), and renders clean, responsive HTML + CSS. Each match includes a confidence score, and you can refine it ('make it dark, add shadow') via a follow-up parser.",
      },
      {
        q: "Which output targets are supported?",
        a: "Three: (1) Vanilla HTML + CSS in separate blocks, (2) Tailwind utility-class version, and (3) inline-styled HTML for email / no-CSS contexts. Each can be copied or downloaded separately, and the live preview (sandboxed iframe srcdoc) updates instantly as you tweak theme controls.",
      },
      {
        q: "Can I customize the look before exporting?",
        a: "Yes. Theme controls let you set primary color, border radius, font family, and dark-mode toggle. Changes are applied live to the generated component and re-rendered in the preview. Each component also has multiple variants (e.g., button: primary, secondary, outline, ghost, destructive, gradient) you can switch between.",
      },
      {
        q: "Can I use my own LLM API key for richer components?",
        a: "Yes. The tool builds an optimal prompt (description + theme + variant + target) and calls OpenAI or Anthropic with a key you paste — stored only in localStorage on this device. Without a key, the on-device template engine produces solid baseline components fully offline. Always review LLM output before shipping.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 15+ built-in component templates (button, card, modal, navbar, form, alert, badge, dropdown, tabs, hero, footer, accordion, tooltip, progress, input). (2) Natural-language keyword matcher with confidence score. (3) Three output targets (vanilla CSS / Tailwind / inline). (4) Live sandboxed iframe preview. (5) Theme controls (color, radius, font, dark mode). (6) Component variants per type. (7) Refinement parser ('make it dark, add shadow'). (8) Accessibility checker (aria, contrast, semantic checks). (9) Component quality scorer (0-100). (10) Copy / Download HTML, CSS, Tailwind, React JSX. (11) Optional BYO-key LLM enhancement. (12) History (localStorage, last 20). (13) Shareable URL. (14) Component presets for quick starts. (15) Tailwind class generator from inline CSS.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All keyword extraction, template matching, HTML/CSS generation, and theming runs locally in your browser. Descriptions never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};

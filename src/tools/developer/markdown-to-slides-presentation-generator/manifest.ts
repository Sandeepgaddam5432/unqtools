/**
 * Markdown to Slides (Presentation) Generator — Tool Manifest.
 * Tool #348 — Category 4 (Developer & Code).
 *
 * Pure-JS markdown splitter (on `---` or `## ` headings), HTML slide
 * deck generator (reveal.js-compatible markup), speaker notes extraction
 * from HTML comments, theme picker, live preview, present-mode controls,
 * and self-contained HTML export. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "markdown-to-slides-presentation-generator",
  name: "Markdown to Slides (Presentation) Generator",
  description:
    "Convert a Markdown document into an HTML slide deck — split on `---` or `## ` headings into slides, generate reveal.js-compatible HTML with theme picker, extract speaker notes from HTML comments, preview slides, and export a self-contained HTML file. Supports Marp-style directives, code highlighting hints, image embedding, and per-slide layouts. 100% client-side, zero install, zero upload.",
  category: "developer",
  keywords: [
    "markdown to slides", "markdown presentation", "marp online",
    "reveal.js editor", "markdown deck", "slides from markdown",
    "speaker notes", "presentation generator", "html slides",
    "self-contained html", "md to slides", "md to html",
  ],
  icon: "presentation",
  requiresNetwork: false,
  seo: {
    title: "Markdown to Slides (Presentation) Generator — Marp + reveal.js HTML | UnQTools",
    faq: [
      {
        q: "How does the Markdown to Slides generator work?",
        a: "Paste your Markdown in the editor — we split it into slides on `---` separators (Marp-style) or `## ` heading boundaries (reveal.js-style), apply the selected theme, extract speaker notes from HTML comments (`<!-- note: ... -->`), and generate a reveal.js-compatible HTML deck. Use arrow keys to navigate the live preview, then export a self-contained HTML file that runs offline.",
      },
      {
        q: "How do I split Markdown into slides?",
        a: "Two split modes are supported: (1) `---` separator (Marp convention) — each `---` on its own line starts a new slide. (2) `## ` headings — each H2 heading begins a new slide (useful for outline-driven decks). You can also use Marp directives like `<!-- _class: lead -->` or `<!-- _paginate: true -->` to control per-slide layout. HTML comments containing `note:` are extracted as speaker notes.",
      },
      {
        q: "Which themes are available?",
        a: "Eight built-in themes for the preview and exported HTML: default (white), black, league, beige, blood, night, serif, and solarized. Each theme controls background, fonts, and transition. The exported HTML is fully self-contained — no external CSS or JS dependencies, opens offline in any browser.",
      },
      {
        q: "How do speaker notes work?",
        a: "Any HTML comment in your Markdown that contains `note:` (e.g. `<!-- note: Remember to mention the Q1 numbers -->`) is extracted as the speaker note for that slide. Notes are emitted as `<aside class='notes'>` elements in the exported HTML (reveal.js convention) so they appear in presenter mode when the deck is opened in reveal.js, and they're listed in a 'Notes' panel in our preview.",
      },
      {
        q: "What extra features does this tool have versus Marp or reveal.js?",
        a: "(1) Two split modes (`---` or `## ` headings). (2) 8 built-in themes. (3) Speaker notes extraction from HTML comments. (4) Marp directive passthrough (`_class`, `_paginate`, `_backgroundColor`). (5) Live preview with arrow-key navigation. (6) Self-contained HTML export (no external deps, opens offline). (7) Per-slide title extraction. (8) Stats (slide count, total chars, notes count). (9) Code block syntax hints preserved. (10) Image embedding via Markdown image syntax. (11) Reveal.js fragment markers (`<!-- .element: class=\"fragment\" -->`). (12) History (localStorage, last 20). (13) Shareable URL with the source encoded. 100% client-side — no Node toolchain, no upload, no account.",
      },
    ],
  },
  status: "done",
};

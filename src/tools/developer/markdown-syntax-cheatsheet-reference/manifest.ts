/**
 * Markdown Syntax Cheatsheet & Reference — Tool Manifest.
 * Tool #349 — Category 4 (Developer & Code).
 *
 * A searchable, categorized Markdown cheatsheet covering 60+ syntax
 * elements across basic Markdown, GFM, CommonMark, and extended flavors
 * (alerts, task lists, footnotes, strikethrough, math, mermaid, etc.).
 * Each entry has source + rendered output + copy button + a flavor-support
 * matrix (CommonMark / GFM / GitLab / pandoc / Obsidian). Includes a live
 * scratch pad to test any snippet. 100% client-side — no network.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "markdown-syntax-cheatsheet-reference",
  name: "Markdown Syntax Cheatsheet & Reference",
  description:
    "A searchable Markdown syntax cheatsheet with 60+ entries across basic Markdown, GFM, CommonMark, and extended flavors (alerts, task lists, footnotes, strikethrough, math, mermaid, autolinks, emoji). Each card shows source + live rendered output + a flavor-support matrix (CommonMark / GFM / GitLab / pandoc / Obsidian) and a copy button. Scratch pad to test any snippet. 100% client-side — no network.",
  category: "developer",
  keywords: [
    "markdown cheatsheet", "markdown syntax", "github markdown reference",
    "gfm cheat sheet", "commonmark reference", "markdown reference",
    "markdown syntax guide", "markdown examples", "github flavored markdown",
    "markdown task list", "markdown footnote", "markdown alert",
    "markdown table syntax", "markdown strikethrough",
  ],
  icon: "book-open",
  requiresNetwork: false,
  seo: {
    title: "Markdown Syntax Cheatsheet & Reference — GFM, CommonMark, Extended | UnQTools",
    faq: [
      {
        q: "Which Markdown flavors does the cheatsheet cover?",
        a: "Basic Markdown (headings, emphasis, lists, links, images, code), GitHub-Flavored Markdown (GFM: strikethrough, task lists, tables, alerts, autolinks), CommonMark spec essentials, and extended flavors like MultiMarkdown/pandoc/Obsidian (footnotes, math, mermaid, definition lists, emoji shortcodes). Each entry is tagged with a flavor-support matrix so you can see exactly where a feature works.",
      },
      {
        q: "How many syntax entries are included?",
        a: "60+ entries across 10 categories: headings, emphasis, lists, links, images, code, tables, blockquotes, rules, and GFM/extended (alerts, task lists, footnotes, strikethrough, math, mermaid, autolinks, emoji, definition lists, raw HTML, escaping, comments, and more).",
      },
      {
        q: "Can I copy the example source from each card?",
        a: "Yes. Every card has a Copy button that copies the exact Markdown source to your clipboard. There is also a per-card 'rendered output' panel showing the live-rendered HTML so you can see exactly how each syntax element renders.",
      },
      {
        q: "Is there a sandbox where I can test my own Markdown?",
        a: "Yes — a scratch pad at the bottom of the page lets you type any Markdown and see it rendered live in real time. You can also deep-link to any card via its anchor (#h-headings, #gfm-alerts, etc.) and search across all entries with fuzzy matching.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 60+ syntax entries across 10 categories. (2) Searchable with fuzzy match. (3) Per-element live rendered output. (4) Flavor-support matrix (CommonMark/GFM/GitLab/pandoc/Obsidian). (5) Copy button per card. (6) Scratch pad to test any snippet. (7) Deep-link anchors per category. (8) Category filter chips. (9) History of recently viewed cards (localStorage, max 20). (10) Shareable URL with search + filter. (11) Light/dark rendered output. (12) Printable layout. 100% client-side — no tracking, works offline.",
      },
    ],
  },
  status: "done",
};

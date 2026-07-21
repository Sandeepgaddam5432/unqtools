/**
 * Markdown Live Editor & Previewer — Tool Manifest.
 * Tool #341 — Category 4 (Developer & Code).
 *
 * A split-pane editor that renders GitHub-Flavored Markdown to a live preview
 * as you type, with word/char/line/reading-time counts, autosave to
 * localStorage, shareable URL (compressed in hash), copy/download (.md/.html),
 * syntax-highlighted code blocks, dark mode, and zero network calls. 100%
 * client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "markdown-live-editor-previewer",
  name: "Markdown Live Editor & Previewer",
  description:
    "A split-pane markdown editor with instant GitHub-flavored live preview. Renders headings, bold, italic, lists, links, images, code blocks (with syntax highlighting), tables, blockquotes, and hr. Word/char/line/reading-time counts, autosave, dark mode, copy/download .md and .html, shareable URL. 100% client-side — your document never leaves the browser.",
  category: "developer",
  keywords: [
    "markdown editor", "markdown live preview", "markdown previewer",
    "gfm editor", "github markdown preview", "online markdown editor",
    "markdown to html", "markdown syntax highlighting", "split pane markdown",
    "markdown autosave", "markdown viewer",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "Markdown Live Editor & Previewer — GFM + Syntax Highlight | UnQTools",
    faq: [
      {
        q: "Which markdown features are supported?",
        a: "GitHub-Flavored Markdown: ATX headings (h1–h6), bold (** or __), italic (* or _), inline code, fenced code blocks with language-based syntax highlighting, unordered/ordered/nested lists, links, images, GFM tables, blockquotes, and horizontal rules. Raw HTML inside the document is escaped by default so the preview is always safe.",
      },
      {
        q: "Does anything get sent to a server?",
        a: "No. The parser, highlighter, and HTML export all run in your browser. There is no upload, no account, and no telemetry. Autosave writes to localStorage on this device only and the shareable URL encodes your content into the fragment hash — it is never transmitted when you copy the link.",
      },
      {
        q: "How does the shareable URL work for a large document?",
        a: "The document is URI-encoded into the fragment hash (#md=...). Because the hash is never sent to the server, this keeps your content private while still letting you bookmark or hand off a link. For very large documents the URL gets long; we cap the encoded payload and fall back to copying the markdown to your clipboard.",
      },
      {
        q: "How is syntax highlighting done for code blocks?",
        a: "We tokenize code by language family (javascript/typescript, python, sql, json, html/xml, css, bash/shell, and a generic fallback). Keywords, strings, comments, numbers, and booleans get distinct CSS classes so the preview looks like a code editor. Highlighting is pure string manipulation — no external library, no network.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Live split-pane preview as you type. (2) Pure-JS GFM parser covering 10+ block types. (3) Per-language syntax highlighting in fenced code blocks. (4) Word/char/line/reading-time stats. (5) Dark mode for the preview. (6) Autosave to localStorage (last 20 sessions). (7) Copy markdown / download .md / download .html (full standalone HTML document). (8) Shareable URL with content encoded in hash. (9) Sample document loader. (10) Clear/reset button. (11) Front-matter stripping. (12) Inline HTML escaping for safety. 100% client-side — your document never leaves the browser.",
      },
    ],
  },
  status: "done",
};

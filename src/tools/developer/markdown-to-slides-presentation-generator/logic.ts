/**
 * Markdown to Slides (Presentation) Generator — pure logic.
 *
 * Pure-JS markdown splitter, HTML slide generator (reveal.js-compatible),
 * speaker-notes extractor, and self-contained HTML exporter. Pure functions
 * only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SplitMode = "separator" | "heading";

export type ThemeName =
  | "default"
  | "black"
  | "league"
  | "beige"
  | "blood"
  | "night"
  | "serif"
  | "solarized";

export type TransitionName =
  | "none"
  | "slide"
  | "fade"
  | "convex"
  | "concave"
  | "zoom";

export interface Slide {
  /** 1-based slide number. */
  index: number;
  /** Markdown source for this slide. */
  markdown: string;
  /** Title (extracted from first H1/H2). */
  title: string;
  /** Speaker notes (from HTML comments). */
  notes: string;
  /** Marp-style directives for this slide (`_class`, `_paginate`, etc.). */
  directives: Record<string, string>;
  /** Fragment markers found in this slide. */
  fragments: number;
  /** Background color directive (if any). */
  backgroundColor?: string;
  /** Per-slide HTML class (e.g. 'lead', 'center'). */
  className?: string;
}

export interface DeckStats {
  slideCount: number;
  totalChars: number;
  notesCount: number;
  fragmentsCount: number;
  imagesCount: number;
  codeBlocksCount: number;
}

export interface DeckOptions {
  splitMode: SplitMode;
  theme: ThemeName;
  transition: TransitionName;
  /** Show slide numbers in exported HTML. */
  slideNumbers: boolean;
  /** Show progress bar. */
  progress: boolean;
  /** Slide title (presentation title). */
  title: string;
  /** Author. */
  author: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const THEMES: { value: ThemeName; label: string }[] = [
  { value: "default", label: "Default (white)" },
  { value: "black", label: "Black" },
  { value: "league", label: "League (sans-serif)" },
  { value: "beige", label: "Beige" },
  { value: "blood", label: "Blood (dark red)" },
  { value: "night", label: "Night (dark)" },
  { value: "serif", label: "Serif" },
  { value: "solarized", label: "Solarized" },
];

export const TRANSITIONS: { value: TransitionName; label: string }[] = [
  { value: "slide", label: "Slide (horizontal)" },
  { value: "fade", label: "Fade" },
  { value: "convex", label: "Convex (3D)" },
  { value: "concave", label: "Concave (3D)" },
  { value: "zoom", label: "Zoom" },
  { value: "none", label: "None (instant)" },
];

export const DEFAULT_OPTIONS: DeckOptions = {
  splitMode: "separator",
  theme: "default",
  transition: "slide",
  slideNumbers: true,
  progress: true,
  title: "My Presentation",
  author: "",
};

/** Default deck markdown — a 3-slide example showcasing features. */
export const DEFAULT_MARKDOWN = `# My Presentation

A short demo of the Markdown to Slides generator.

---

## Agenda

1. Introduction
2. Features
3. Demo
4. Q&A

<!-- note: Welcome the audience and introduce yourself. -->

---

## Code example

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

---

## Fragments

- First <!-- .element: class="fragment" -->
- Second <!-- .element: class="fragment" -->
- Third <!-- .element: class="fragment" -->

---

## Thanks!

Questions?

<!-- note: Hand off to moderator for Q&A. -->
`;

// ---------------------------------------------------------------------------
// Slide splitting
// ---------------------------------------------------------------------------

/**
 * Split a markdown document into slide chunks based on the chosen mode.
 * - `separator`: split on lines that are exactly `---` (Marp convention).
 * - `heading`: each `## ` H2 heading starts a new slide; preamble before
 *   the first H2 becomes its own slide (the title slide).
 */
export function splitMarkdown(markdown: string, mode: SplitMode): string[] {
  if (!markdown) return [];
  if (mode === "separator") {
    return splitBySeparator(markdown);
  }
  return splitByHeading(markdown);
}

function splitBySeparator(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const chunks: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (/^\s*---+\s*$/.test(line)) {
      // Boundary — flush current chunk
      chunks.push(current.join("\n"));
      current = [];
      continue;
    }
    current.push(line);
  }
  chunks.push(current.join("\n"));
  // Trim leading/trailing whitespace per chunk and drop empty trailing chunk
  const trimmed = chunks.map((c) => c.trim());
  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === "") trimmed.pop();
  while (trimmed.length > 0 && trimmed[0] === "") trimmed.shift();
  return trimmed;
}

function splitByHeading(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const chunks: string[] = [];
  let current: string[] = [];
  let seenFirstHeading = false;
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      // Every H2 starts a new slide. If this is the very first H2 and we
      // have preamble content, the preamble becomes its own slide; if we
      // have no preamble yet, the empty chunk is filtered out later.
      if (current.some((l) => l.trim() !== "") || seenFirstHeading) {
        chunks.push(current.join("\n"));
        current = [];
      } else {
        current = [];
      }
      seenFirstHeading = true;
    }
    current.push(line);
  }
  if (current.some((l) => l.trim() !== "")) chunks.push(current.join("\n"));
  const trimmed = chunks.map((c) => c.trim()).filter(Boolean);
  return trimmed;
}

// ---------------------------------------------------------------------------
// Per-slide parsing
// ---------------------------------------------------------------------------

/** Extract the first H1 or H2 heading as the slide title. */
export function extractTitle(markdown: string): string {
  if (!markdown) return "";
  const lines = markdown.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    const h1 = /^#\s+(.+?)\s*$/.exec(trimmed);
    if (h1) return h1[1];
    const h2 = /^##\s+(.+?)\s*$/.exec(trimmed);
    if (h2) return h2[1];
  }
  // Fallback: first non-empty, non-directive line
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("<!--")) continue;
    return trimmed.slice(0, 60);
  }
  return "";
}

/** Extract speaker notes from HTML comments containing `note:` (case-insensitive). */
export function extractNotes(markdown: string): string {
  if (!markdown) return "";
  const notes: string[] = [];
  // Match HTML comments: <!-- ... -->
  const re = /<!--\s*note:\s*([\s\S]*?)-->/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    notes.push(m[1].trim());
  }
  return notes.join("\n\n");
}

/** Remove speaker-note HTML comments from the markdown (for cleaner rendering). */
export function stripNotes(markdown: string): string {
  if (!markdown) return "";
  return markdown.replace(/<!--\s*note:[\s\S]*?-->/gi, "").trim();
}

/** Extract Marp-style directives from HTML comments (e.g. `<!-- _class: lead -->`). */
export function extractDirectives(markdown: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!markdown) return out;
  const re = /<!--\s*_([a-zA-Z]+):\s*([^>]*?)-->/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    out[key] = value;
  }
  return out;
}

/** Count reveal.js fragment markers (`<!-- .element: class="fragment" -->`). */
export function countFragments(markdown: string): number {
  if (!markdown) return 0;
  const re = /<!--\s*\.element:[^>]*class=["'][^"']*fragment[^"']*["'][^>]*-->/gi;
  return (markdown.match(re) || []).length;
}

/** Count Markdown image references (![alt](url)). */
export function countImages(markdown: string): number {
  if (!markdown) return 0;
  return (markdown.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;
}

/** Count fenced code blocks (```...```). */
export function countCodeBlocks(markdown: string): number {
  if (!markdown) return 0;
  return (markdown.match(/^```[^\n]*$([\s\S]*?)^```$/gm) || []).length;
}

/** Parse a markdown chunk into a Slide object. */
export function parseSlide(markdown: string, index: number): Slide {
  const directives = extractDirectives(markdown);
  const notes = extractNotes(markdown);
  const title = extractTitle(markdown);
  const fragments = countFragments(markdown);
  return {
    index,
    markdown,
    title,
    notes,
    directives,
    fragments,
    backgroundColor: directives.backgroundcolor,
    className: directives.class,
  };
}

/** Parse the entire deck into a list of Slide objects. */
export function parseDeck(markdown: string, options: DeckOptions): Slide[] {
  const chunks = splitMarkdown(markdown, options.splitMode);
  return chunks.map((c, i) => parseSlide(c, i + 1));
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export function computeStats(markdown: string, options: DeckOptions): DeckStats {
  const slides = parseDeck(markdown, options);
  return {
    slideCount: slides.length,
    totalChars: markdown.length,
    notesCount: slides.filter((s) => s.notes).length,
    fragmentsCount: slides.reduce((sum, s) => sum + s.fragments, 0),
    imagesCount: countImages(markdown),
    codeBlocksCount: countCodeBlocks(markdown),
  };
}

// ---------------------------------------------------------------------------
// HTML escaping & rendering
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape markdown content for embedding in a <script type="text/template"> tag. */
function escapeForTemplate(s: string): string {
  return s.replace(/<\/script>/gi, "<\\/script>");
}

/**
 * Render a single slide's markdown into HTML. This is a lightweight
 * markdown-to-HTML converter covering the common subset: headings,
 * paragraphs, lists, code blocks, inline code, bold, italic, links,
 * images, blockquotes, and horizontal rules. The output is wrapped
 * in a <section> element compatible with reveal.js.
 */
export function renderSlideHtml(slide: Slide): string {
  const cleaned = stripNotes(slide.markdown);
  const html = markdownToHtml(cleaned);
  const attrs: string[] = [];
  if (slide.backgroundColor) {
    attrs.push(`data-background-color="${escapeHtml(slide.backgroundColor)}"`);
  }
  if (slide.className) {
    attrs.push(`class="${escapeHtml(slide.className)}"`);
  }
  const attrStr = attrs.length > 0 ? " " + attrs.join(" ") : "";
  return `<section${attrStr}>\n${html}\n</section>`;
}

/**
 * Lightweight Markdown → HTML converter (subset). Supports:
 * - Headings (# .. ######)
 * - Fenced code blocks ```lang ... ```
 * - Inline code `code`
 * - Bold **text** / __text__
 * - Italic *text* / _text_
 * - Links [text](url)
 * - Images ![alt](url)
 * - Unordered lists (- or *)
 * - Ordered lists (1.)
 * - Blockquotes >
 * - Horizontal rules --- (within a slide, rendered as <hr>)
 * - Paragraphs
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return "";
  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;
  let inCode = false;
  let codeLang = "";
  let codeBuf: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let listBuf: string[] = [];

  const flushList = () => {
    if (listType && listBuf.length > 0) {
      const tag = listType;
      out.push(`<${tag}>`);
      for (const item of listBuf) out.push(`  <li>${inline(item)}</li>`);
      out.push(`</${tag}>`);
      listBuf = [];
      listType = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Code fence
    const fenceMatch = /^```(\w*)\s*$/.exec(line);
    if (fenceMatch) {
      if (!inCode) {
        flushList();
        inCode = true;
        codeLang = fenceMatch[1] || "";
        codeBuf = [];
      } else {
        // Close code block
        const code = codeBuf.join("\n");
        const cls = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : "";
        out.push(`<pre><code${cls}>${escapeHtml(code)}</code></pre>`);
        inCode = false;
        codeLang = "";
        codeBuf = [];
      }
      i++;
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      i++;
      continue;
    }

    const trimmed = line.trim();

    // Blank line — flush list, paragraph break
    if (trimmed === "") {
      flushList();
      i++;
      continue;
    }

    // Heading
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(trimmed);
    if (heading) {
      flushList();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    // Horizontal rule (within slide)
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushList();
      out.push("<hr>");
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(trimmed)) {
      flushList();
      const quote = trimmed.replace(/^>\s?/, "");
      out.push(`<blockquote>${inline(quote)}</blockquote>`);
      i++;
      continue;
    }

    // Unordered list
    if (/^[-*+]\s+/.test(trimmed)) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listBuf.push(trimmed.replace(/^[-*+]\s+/, ""));
      i++;
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      if (listType !== "ol") flushList();
      listType = "ol";
      listBuf.push(trimmed.replace(/^\d+\.\s+/, ""));
      i++;
      continue;
    }

    // Paragraph (may span multiple lines until blank)
    flushList();
    const para: string[] = [trimmed];
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j].trim();
      if (next === "") break;
      if (/^(#{1,6})\s+/.test(next)) break;
      if (/^```/.test(next)) break;
      if (/^[-*+]\s+/.test(next)) break;
      if (/^\d+\.\s+/.test(next)) break;
      if (/^>\s?/.test(next)) break;
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(next)) break;
      para.push(next);
      j++;
    }
    out.push(`<p>${inline(para.join(" "))}</p>`);
    i = j;
  }

  // Flush pending state
  if (inCode) {
    const code = codeBuf.join("\n");
    out.push(`<pre><code>${escapeHtml(code)}</code></pre>`);
  }
  flushList();

  return out.join("\n");
}

/** Inline markdown: bold, italic, code, links, images. */
function inline(text: string): string {
  let s = text;
  // Images first (so they don't get caught by link regex)
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_m, alt, url, title) => {
      const t = title ? ` title="${escapeHtml(title)}"` : "";
      return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"${t} />`;
    });
  // Links
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_m, label, url, title) => {
      const t = title ? ` title="${escapeHtml(title)}"` : "";
      return `<a href="${escapeHtml(url)}"${t}>${inline(label)}</a>`;
    });
  // Inline code
  s = s.replace(/`([^`]+)`/g, (_m, code) => `<code>${escapeHtml(code)}</code>`);
  // Bold (must come before italic)
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // Italic
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  s = s.replace(/_([^_]+)_/g, "<em>$1</em>");
  return s;
}

// ---------------------------------------------------------------------------
// Deck → HTML export (reveal.js-compatible, self-contained)
// ---------------------------------------------------------------------------

/** Build a full self-contained HTML document from the deck. */
export function buildDeckHtml(markdown: string, options: DeckOptions): string {
  const slides = parseDeck(markdown, options);
  const sections = slides.map((s) => renderSlideHtml(s)).join("\n");
  const notesAsides = slides.map((s) =>
    s.notes ? `<aside class="notes">${escapeHtml(s.notes)}</aside>` : "",
  ).join("\n");

  // Embed the reveal.js-compatible structure with inline CSS.
  return buildHtmlDocument(options, sections, notesAsides);
}

function buildHtmlDocument(
  options: DeckOptions,
  sections: string,
  notesAsides: string,
): string {
  const theme = options.theme;
  const transition = options.transition;
  const controls = true;
  const progress = options.progress;
  const slideNumbers = options.slideNumbers;
  const title = options.title || "Presentation";
  const author = options.author;

  const themeStyle = getThemeCss(theme);
  const transitionAttr = transition === "none" ? "" : ` data-transition="${transition}"`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<title>${escapeHtml(title)}</title>${author ? `\n<meta name="author" content="${escapeHtml(author)}" />` : ""}
<style>
${getBaseCss()}
${themeStyle}
</style>
</head>
<body>
<div class="reveal">
<div class="slides"${transitionAttr}>
${sections}
</div>
</div>
<!-- Speaker notes -->
<div class="speaker-notes" hidden>
${notesAsides}
</div>
<script>
// Minimal reveal.js-compatible controller — arrow keys to navigate.
(function() {
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slides > section'));
  var current = 0;
  function show(i) {
    if (i < 0) i = 0;
    if (i >= slides.length) i = slides.length - 1;
    current = i;
    slides.forEach(function(s, idx) {
      s.classList.toggle('active', idx === i);
    });
    var notesPanel = document.querySelector('.speaker-notes');
    if (notesPanel) {
      var notes = notesPanel.querySelectorAll('aside.notes');
      notes.forEach(function(n, idx) {
        n.hidden = idx !== i;
      });
    }
    document.body.setAttribute('data-slide-index', String(i + 1));
  }
  document.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault();
      show(current + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      show(current - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      show(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      show(slides.length - 1);
    } else if (e.key === 'n' || e.key === 'N') {
      // Toggle speaker notes panel
      var notesPanel = document.querySelector('.speaker-notes');
      if (notesPanel) notesPanel.hidden = !notesPanel.hidden;
    }
  });
  show(0);
  ${controls ? "document.body.setAttribute('data-controls', 'true');" : ""}
  ${progress ? "document.body.setAttribute('data-progress', 'true');" : ""}
  ${slideNumbers ? "document.body.setAttribute('data-slide-numbers', 'true');" : ""}
})();
</script>
</body>
</html>`;
}

/** Get the base CSS for the deck (layout, typography, code blocks, notes). */
export function getBaseCss(): string {
  return `
* { box-sizing: border-box; }
body {
  margin: 0; padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 32px; line-height: 1.4;
  height: 100vh; overflow: hidden;
}
.reveal { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
.slides { width: 100%; height: 100%; position: relative; }
.slides > section {
  display: none;
  width: 90%; height: 90%;
  margin: auto;
  padding: 2em;
  position: absolute;
  top: 5%; left: 5%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  overflow: auto;
}
.slides > section.active { display: flex; }
.slides h1, .slides h2, .slides h3 { margin: 0.3em 0; line-height: 1.1; }
.slides h1 { font-size: 2.2em; }
.slides h2 { font-size: 1.7em; }
.slides h3 { font-size: 1.3em; }
.slides p { margin: 0.5em 0; }
.slides ul, .slides ol { text-align: left; max-width: 80%; margin: 0.5em auto; }
.slides li { margin: 0.2em 0; }
.slides pre {
  text-align: left; max-width: 90%; margin: 0.5em auto;
  background: rgba(0,0,0,0.05);
  padding: 0.6em 1em; border-radius: 6px;
  font-size: 0.6em; line-height: 1.3;
  overflow: auto;
}
.slides code { font-family: "SFMono-Regular", Menlo, Consolas, monospace; }
.slides img { max-width: 80%; max-height: 60vh; }
.slides blockquote {
  font-style: italic; border-left: 4px solid currentColor;
  margin: 0.5em auto; padding: 0.2em 1em; max-width: 80%;
  opacity: 0.85; text-align: left;
}
.slides hr { width: 60%; border: none; border-top: 2px solid currentColor; opacity: 0.4; margin: 1em auto; }
body[data-slide-numbers="true"]::after {
  content: attr(data-slide-index);
  position: fixed; bottom: 8px; right: 12px;
  font-size: 16px; opacity: 0.5;
}
body[data-progress="true"]::before {
  content: ""; position: fixed; top: 0; left: 0; height: 3px;
  background: currentColor; opacity: 0.4;
  width: calc(var(--slide-progress, 0) * 100%);
}
.speaker-notes {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: #222; color: #eee; padding: 0.6em 1em;
  font-size: 16px; max-height: 30vh; overflow: auto;
}
.speaker-notes aside.notes { display: block; }
@media print {
  body { height: auto; overflow: visible; }
  .reveal { height: auto; }
  .slides > section { display: flex !important; position: relative; top: 0; left: 0; page-break-after: always; }
  .speaker-notes { display: none; }
}`.trim();
}

/** Get theme-specific CSS overrides. */
export function getThemeCss(theme: ThemeName): string {
  const themes: Record<ThemeName, string> = {
    default: `body { background: #fff; color: #222; }`,
    black: `body { background: #111; color: #eee; }
.slides pre { background: rgba(255,255,255,0.1); }`,
    league: `body { background: #555; color: #fff; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; }
.slides pre { background: rgba(0,0,0,0.3); }`,
    beige: `body { background: #f7f3de; color: #333; }
.slides pre { background: rgba(0,0,0,0.08); }`,
    blood: `body { background: #a20a0a; color: #fff; }
.slides pre { background: rgba(0,0,0,0.3); }`,
    night: `body { background: #0a0a0a; color: #e0e0e0; }
.slides pre { background: rgba(255,255,255,0.1); }`,
    serif: `body { background: #fff; color: #222; font-family: "Georgia", "Times New Roman", serif; }
.slides pre { background: rgba(0,0,0,0.06); }`,
    solarized: `body { background: #fdf6e3; color: #586e75; }
.slides pre { background: rgba(0,0,0,0.06); }
.slides h1, .slides h2, .slides h3 { color: #073642; }`,
  };
  return themes[theme] || themes.default;
}

// ---------------------------------------------------------------------------
// Outline / table of contents
// ---------------------------------------------------------------------------

export interface OutlineEntry {
  index: number;
  title: string;
  hasNotes: boolean;
  fragmentCount: number;
}

export function buildOutline(markdown: string, options: DeckOptions): OutlineEntry[] {
  return parseDeck(markdown, options).map((s) => ({
    index: s.index,
    title: s.title || "(untitled)",
    hasNotes: Boolean(s.notes),
    fragmentCount: s.fragments,
  }));
}

// ---------------------------------------------------------------------------
// Auto-format
// ---------------------------------------------------------------------------

/** Light auto-format: trim trailing whitespace, collapse 3+ blank lines. */
export function autoFormat(markdown: string): string {
  if (!markdown) return "";
  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];
  let blanks = 0;
  for (const l of lines) {
    if (l.trim() === "") {
      blanks += 1;
      if (blanks <= 1) out.push("");
      continue;
    }
    blanks = 0;
    out.push(l.replace(/\s+$/g, ""));
  }
  while (out.length > 0 && out[0] === "") out.shift();
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:markdown-to-slides:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  slideCount: number;
  theme: ThemeName;
  preview: string; // first ~80 chars of markdown
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Shareable URL (own hash, for restoring editor state)
// ---------------------------------------------------------------------------

/** Encode a string as base64 (UTF-8 safe). */
export function encodeBase64(input: string): string {
  if (!input) return "";
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    try {
      const bytes = new TextEncoder().encode(input);
      let bin = "";
      for (const b of bytes) bin += String.fromCharCode(b);
      return window.btoa(bin);
    } catch {
      // fall through
    }
  }
  return bytesToBase64PureJs(utf8ToBytesPureJs(input));
}

/** Decode a base64 string (UTF-8 safe). */
export function decodeBase64(b64: string): string {
  if (!b64) return "";
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    try {
      const bin = window.atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder().decode(bytes);
    } catch {
      return "";
    }
  }
  return bytesToUtf8PureJs(base64ToBytesPureJs(b64));
}

function utf8ToBytesPureJs(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) { out.push(0xc0 | (c >> 6)); out.push(0x80 | (c & 0x3f)); }
    else if (c >= 0xd800 && c <= 0xdbff) {
      i++;
      const c2 = s.charCodeAt(i);
      const cp = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
      out.push(0xf0 | (cp >> 18));
      out.push(0x80 | ((cp >> 12) & 0x3f));
      out.push(0x80 | ((cp >> 6) & 0x3f));
      out.push(0x80 | (cp & 0x3f));
    } else {
      out.push(0xe0 | (c >> 12));
      out.push(0x80 | ((c >> 6) & 0x3f));
      out.push(0x80 | (c & 0x3f));
    }
  }
  return out;
}

function bytesToUtf8PureJs(bytes: number[]): string {
  let out = "";
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i++];
    if (b < 0x80) {
      out += String.fromCharCode(b);
    } else if ((b & 0xe0) === 0xc0) {
      const b2 = bytes[i++];
      out += String.fromCharCode(((b & 0x1f) << 6) | (b2 & 0x3f));
    } else if ((b & 0xf0) === 0xe0) {
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      out += String.fromCharCode(((b & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f));
    } else if ((b & 0xf8) === 0xf0) {
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      const b4 = bytes[i++];
      const cp = ((b & 0x07) << 18) | ((b2 & 0x3f) << 12) | ((b3 & 0x3f) << 6) | (b4 & 0x3f);
      const adj = cp - 0x10000;
      out += String.fromCharCode(0xd800 | (adj >> 10), 0xdc00 | (adj & 0x3ff));
    }
  }
  return out;
}

const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64PureJs(bytes: number[]): string {
  const bin = bytes.map((b) => String.fromCharCode(b)).join("");
  let out = "";
  let i = 0;
  const len = bin.length;
  while (i < len) {
    const b1 = bin.charCodeAt(i++);
    const b2 = i < len ? bin.charCodeAt(i++) : NaN;
    const b3 = i < len ? bin.charCodeAt(i++) : NaN;
    out += B64_CHARS.charAt(b1 >> 2);
    out += B64_CHARS.charAt(((b1 & 0x03) << 4) | (isNaN(b2) ? 0 : (b2 >> 4)));
    out += isNaN(b2) ? "=" : B64_CHARS.charAt(((b2 & 0x0f) << 2) | (isNaN(b3) ? 0 : (b3 >> 6)));
    out += isNaN(b3) ? "=" : B64_CHARS.charAt(b3 & 0x3f);
  }
  return out;
}

function base64ToBytesPureJs(b64: string): number[] {
  const padCount = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const padded = clean + "A".repeat((4 - (clean.length % 4)) % 4);
  const out: number[] = [];
  for (let i = 0; i + 4 <= padded.length; i += 4) {
    const c1 = B64_CHARS.indexOf(padded.charAt(i));
    const c2 = B64_CHARS.indexOf(padded.charAt(i + 1));
    const c3 = B64_CHARS.indexOf(padded.charAt(i + 2));
    const c4 = B64_CHARS.indexOf(padded.charAt(i + 3));
    if (c1 < 0 || c2 < 0 || c3 < 0 || c4 < 0) break;
    out.push((c1 << 2) | (c2 >> 4));
    out.push(((c2 & 0x0f) << 4) | (c3 >> 2));
    out.push(((c3 & 0x03) << 6) | c4);
  }
  if (padCount > 0 && out.length >= padCount) return out.slice(0, out.length - padCount);
  return out;
}

export interface ShareParams {
  md: string;
  options: DeckOptions;
}

export function buildShareUrl(md: string, options: DeckOptions): string {
  const params = new URLSearchParams();
  if (md) params.set("md", encodeBase64(md));
  params.set("split", options.splitMode);
  params.set("theme", options.theme);
  params.set("transition", options.transition);
  params.set("numbers", String(options.slideNumbers));
  params.set("progress", String(options.progress));
  if (options.title) params.set("title", options.title);
  if (options.author) params.set("author", options.author);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareParams {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { md: "", options: { ...DEFAULT_OPTIONS } };
  const params = new URLSearchParams(clean);
  const md = params.get("md") ? decodeBase64(params.get("md")!) : "";
  const splitMode = (params.get("split") as SplitMode) || DEFAULT_OPTIONS.splitMode;
  const theme = (params.get("theme") as ThemeName) || DEFAULT_OPTIONS.theme;
  const transition = (params.get("transition") as TransitionName) || DEFAULT_OPTIONS.transition;
  const slideNumbers = params.get("numbers") !== "false";
  const progress = params.get("progress") !== "false";
  const title = params.get("title") || DEFAULT_OPTIONS.title;
  const author = params.get("author") || "";
  return {
    md,
    options: { splitMode, theme, transition, slideNumbers, progress, title, author },
  };
}

/**
 * Markdown Live Editor & Previewer — pure logic.
 *
 * A pure-JS, GitHub-Flavored Markdown parser & renderer plus document stats,
 * HTML export, autosave history (localStorage, max 20), and a shareable URL
 * (content encoded into the hash). Pure functions only — no DOM, no network.
 *
 * Supported block types: ATX headings (h1–h6), fenced code blocks with
 * per-language syntax highlighting, unordered/ordered/nested lists, GFM
 * tables, blockquotes, horizontal rules, and paragraphs. Supported inline
 * types: bold, italic, inline code, links, and images.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MarkdownStats {
  chars: number;
  charsNoSpaces: number;
  words: number;
  lines: number;
  paragraphs: number;
  codeBlocks: number;
  tables: number;
  /** Estimated reading time in minutes (200 wpm). */
  readingTimeMin: number;
}

export interface MarkdownIssue {
  severity: "warn" | "error";
  line: number;
  message: string;
}

export interface MarkdownValidation {
  issues: MarkdownIssue[];
  warnings: number;
  errors: number;
}

export interface CodeBlockInfo {
  language: string;
  code: string;
  startLine: number;
}

export interface HtmlExportOptions {
  /** Wrap the rendered body in a full standalone HTML document. */
  fullDocument?: boolean;
  /** Title for the standalone document. */
  title?: string;
  /** Dark theme stylesheet. */
  dark?: boolean;
  /** Inline CSS — when true, no <link> tags are emitted. */
  inlineCss?: boolean;
}

export interface HistoryEntry {
  ts: number;
  chars: number;
  words: number;
  preview: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SAMPLE_DOC = `# Hello Markdown

A **live** preview editor with _italics_, \`inline code\`, and [links](https://example.com).

## Features

- Headings (h1–h6)
- **Bold** and _italic_
- \`code\` and code blocks:

\`\`\`javascript
function greet(name) {
  // say hi
  return "Hello, " + name;
}
\`\`\`

| Feature | Supported |
| ------- | :-------: |
| Tables  | ✅        |
| Quotes  | ✅        |

> Blockquotes render too.

---

Visit ![logo](https://example.com/logo.png) for more.
`;

const READING_WORDS_PER_MIN = 200;
const HISTORY_KEY = "unqtools:markdown-live-editor:history";
const AUTOSAVE_KEY = "unqtools:markdown-live-editor:autosave";
const HISTORY_MAX = 20;
const SHARE_MAX_BYTES = 4800; // cap hash size to keep URLs manageable

const KNOWN_LANGS = [
  "javascript", "js", "typescript", "ts", "tsx", "jsx",
  "python", "py",
  "sql", "mysql", "postgres",
  "json", "yaml", "yml", "toml", "ini",
  "html", "xml", "svg",
  "css", "scss", "less",
  "bash", "sh", "shell", "zsh",
  "go", "rust", "rs", "java", "c", "cpp", "ruby", "rb", "php",
  "markdown", "md",
  "text", "plain", "",
] as const;

// ---------------------------------------------------------------------------
// Escaping & utilities
// ---------------------------------------------------------------------------

/** Escape a string for safe insertion into HTML text content. */
export function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Strip YAML front matter (--- ... ---) from the top of a document. */
export function stripFrontMatter(text: string): { body: string; frontMatter: string | null } {
  if (!text.startsWith("---")) return { body: text, frontMatter: null };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { body: text, frontMatter: null };
  const nl = text.indexOf("\n", end + 4);
  const cut = nl === -1 ? text.length : nl + 1;
  return {
    body: text.slice(cut),
    frontMatter: text.slice(3, end).trim(),
  };
}

/** Normalize a language identifier to a canonical family. */
export function normalizeLanguage(lang: string): string {
  const l = (lang ?? "").toLowerCase().trim();
  if (l === "js" || l === "jsx") return "javascript";
  if (l === "ts" || l === "tsx") return "typescript";
  if (l === "py") return "python";
  if (l === "sh" || l === "shell" || l === "zsh") return "bash";
  if (l === "yml") return "yaml";
  if (l === "mysql" || l === "postgres" || l === "plsql") return "sql";
  if (l === "svg") return "xml";
  if (l === "rb") return "ruby";
  if (l === "rs") return "rust";
  if (l === "md") return "markdown";
  return l;
}

/** Return true if the language is recognized by the highlighter. */
export function isKnownLanguage(lang: string): boolean {
  return KNOWN_LANGS.includes(lang as unknown as (typeof KNOWN_LANGS)[number]);
}

// ---------------------------------------------------------------------------
// Syntax highlighting
// ---------------------------------------------------------------------------

interface TokenSpec {
  name: string;
  re: RegExp;
}

const LANG_TOKENS: Record<string, TokenSpec[]> = {
  javascript: [
    { name: "comment", re: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y },
    { name: "string", re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/y },
    { name: "number", re: /\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/y },
    { name: "keyword", re: /\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|super|this|typeof|instanceof|in|of|try|catch|finally|throw|async|await|yield|import|export|from|default|delete|void|null|undefined|true|false)\b/y },
  ],
  typescript: [
    { name: "comment", re: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y },
    { name: "string", re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/y },
    { name: "number", re: /\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/y },
    { name: "keyword", re: /\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|super|this|typeof|instanceof|in|of|try|catch|finally|throw|async|await|yield|import|export|from|default|delete|void|null|undefined|true|false|interface|type|enum|namespace|public|private|protected|readonly|implements|as|is|keyof|never|unknown|any)\b/y },
  ],
  python: [
    { name: "comment", re: /#[^\n]*/y },
    { name: "string", re: /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y },
    { name: "number", re: /\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?\b/y },
    { name: "keyword", re: /\b(?:def|class|return|if|elif|else|for|while|break|continue|in|not|and|or|is|None|True|False|import|from|as|with|try|except|finally|raise|pass|lambda|yield|global|nonlocal|assert|del|self)\b/y },
  ],
  sql: [
    { name: "comment", re: /--[^\n]*|\/\*[\s\S]*?\*\//y },
    { name: "string", re: /'(?:''|[^'])*'/y },
    { name: "number", re: /\b\d+(?:\.\d+)?\b/y },
    { name: "keyword", re: /\b(?:SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|VIEW|DROP|ALTER|ADD|PRIMARY|KEY|FOREIGN|REFERENCES|NOT|NULL|DEFAULT|UNIQUE|CONSTRAINT|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|UNION|ALL|DISTINCT|CASE|WHEN|THEN|ELSE|END|AND|OR|IN|LIKE|BETWEEN|IS|EXISTS|CASCADE|BEGIN|COMMIT|ROLLBACK|TRANSACTION)\b/y },
  ],
  json: [
    { name: "string", re: /"(?:\\.|[^"\\])*"/y },
    { name: "number", re: /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/y },
    { name: "keyword", re: /\b(?:true|false|null)\b/y },
  ],
  yaml: [
    { name: "comment", re: /#[^\n]*/y },
    { name: "string", re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y },
    { name: "number", re: /\b\d+(?:\.\d+)?\b/y },
    { name: "keyword", re: /\b(?:true|false|null|yes|no|on|off)\b/y },
  ],
  html: [
    { name: "comment", re: /<!--[\s\S]*?-->/y },
    { name: "string", re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y },
    { name: "tag", re: /<\/?[a-zA-Z][a-zA-Z0-9-]*|\/?>/y },
  ],
  xml: [
    { name: "comment", re: /<!--[\s\S]*?-->/y },
    { name: "string", re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y },
    { name: "tag", re: /<\/?[a-zA-Z][a-zA-Z0-9-]*|\/?>/y },
  ],
  css: [
    { name: "comment", re: /\/\*[\s\S]*?\*\//y },
    { name: "string", re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y },
    { name: "number", re: /-?\b\d+(?:\.\d+)?(?:px|em|rem|vh|vw|%|s|ms|deg|fr)?\b/y },
    { name: "keyword", re: /\b(?:important|inherit|initial|unset|var|calc|rgb|rgba|hsl|hsla)\b/y },
  ],
  bash: [
    { name: "comment", re: /#[^\n]*/y },
    { name: "string", re: /"(?:\\.|[^"\\])*"|'(?:[^'])*'|\$\((?:\\.|[^)\\])*\)/y },
    { name: "number", re: /\b\d+\b/y },
    { name: "keyword", re: /\b(?:if|then|else|elif|fi|for|while|do|done|case|esac|in|function|return|local|export|unset|alias|echo|printf|read|set|shift|exit|source|cd|pwd|export|true|false)\b/y },
    { name: "variable", re: /\$\{?[a-zA-Z_][a-zA-Z0-9_]*\}?/y },
  ],
  ruby: [
    { name: "comment", re: /#[^\n]*/y },
    { name: "string", re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y },
    { name: "number", re: /\b\d+(?:\.\d+)?\b/y },
    { name: "keyword", re: /\b(?:def|end|class|module|if|elsif|else|unless|while|until|for|do|break|next|return|yield|begin|rescue|ensure|raise|nil|true|false|self|require|require_relative|include|extend|attr_accessor|attr_reader|attr_writer|puts|print)\b/y },
  ],
  rust: [
    { name: "comment", re: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y },
    { name: "string", re: /"(?:\\.|[^"\\])*"/y },
    { name: "number", re: /\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?\b/y },
    { name: "keyword", re: /\b(?:fn|let|mut|const|static|struct|enum|trait|impl|pub|priv|use|mod|crate|self|super|as|in|if|else|for|while|loop|match|return|break|continue|move|ref|unsafe|async|await|dyn|where|type|true|false|Some|None|Ok|Err)\b/y },
  ],
  go: [
    { name: "comment", re: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y },
    { name: "string", re: /"(?:\\.|[^"\\])*"|`[^`]*`/y },
    { name: "number", re: /\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?\b/y },
    { name: "keyword", re: /\b(?:func|var|const|type|struct|interface|map|chan|package|import|if|else|for|range|switch|case|default|break|continue|return|defer|go|select|fallthrough|nil|true|false|iota)\b/y },
  ],
};

const GENERIC_TOKENS: TokenSpec[] = [
  { name: "comment", re: /\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\//y },
  { name: "string", re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y },
  { name: "number", re: /\b\d+(?:\.\d+)?\b/y },
];

/**
 * Highlight source code for a given language. Returns HTML with `<span
 * class="tok-...">` elements. Falls back to a generic tokenizer.
 */
export function highlightCode(code: string, lang: string): string {
  const family = normalizeLanguage(lang);
  const tokens = LANG_TOKENS[family] ?? GENERIC_TOKENS;
  const out: string[] = [];
  let i = 0;
  const src = code;
  while (i < src.length) {
    let matched = false;
    for (const t of tokens) {
      t.re.lastIndex = i;
      const m = t.re.exec(src);
      if (m && m.index === i) {
        out.push(`<span class="tok-${t.name}">${escapeHtml(m[0])}</span>`);
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Advance one char, escaped. Coalesce runs of plain text for fewer spans.
      let j = i + 1;
      while (j < src.length) {
        let hit = false;
        for (const t of tokens) {
          t.re.lastIndex = j;
          const m = t.re.exec(src);
          if (m && m.index === j) { hit = true; break; }
        }
        if (hit) break;
        j++;
      }
      out.push(escapeHtml(src.slice(i, j)));
      i = j;
    }
  }
  return out.join("");
}

// ---------------------------------------------------------------------------
// Inline markdown
// ---------------------------------------------------------------------------

/** Render inline markdown (bold, italic, code, links, images) to HTML. */
export function renderInline(text: string): string {
  if (!text) return "";
  let s = escapeHtml(text);
  // Images first (so they don't get caught by the link rule).
  s = s.replace(/&lt;img\s+[^&]*&gt;/g, ""); // strip raw <img> tags just in case
  s = s.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_m, alt, url, title) =>
      `<img src="${url}" alt="${alt}"${title ? ` title="${title}"` : ""} />`,
  );
  // Links [text](url "title")
  s = s.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_m, txt, url, title) =>
      `<a href="${url}"${title ? ` title="${title}"` : ""}>${txt}</a>`,
  );
  // Inline code (with double backticks first)
  s = s.replace(/``([^`]+)``/g, "<code>$1</code>");
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Bold — **text** then __text__
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // Italic — *text* then _text_
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  s = s.replace(/_([^_]+)_/g, "<em>$1</em>");
  // Strikethrough (GFM)
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  return s;
}

// ---------------------------------------------------------------------------
// Block parsing
// ---------------------------------------------------------------------------

interface Line {
  raw: string;
  /** Line number, 1-based. */
  no: number;
}

/** Detect a horizontal rule line: ---, ***, ___ (3+ chars, only spaces). */
export function isHrLine(s: string): boolean {
  const t = s.trim();
  if (t.length < 3) return false;
  if (/^([-*_])\1{2,}$/.test(t)) return true;
  // Allow spaces between: "- - -", "* * *"
  if (/^([-*_])(\s*\1){2,}$/.test(t)) return true;
  return false;
}

/** Detect an ATX heading line. Returns the heading level (1–6) or 0. */
export function headingLevel(s: string): number {
  const m = /^(\s{0,3})(#{1,6})(\s+.*)$/.exec(s);
  if (!m) return 0;
  return m[2].length;
}

/** Detect a fenced code block delimiter (``` or ~~~). Returns fence char or "". */
export function fenceDelimiter(s: string): string {
  const m = /^(\s{0,3})(`{3,}|~{3,})/.exec(s);
  if (!m) return "";
  return m[2][0];
}

/** Detect a GFM table row (contains a pipe, not a heading, not a list). */
function isTableRow(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (headingLevel(t)) return false;
  if (t.startsWith("-") || t.startsWith("*") || t.startsWith("+")) return false;
  if (/^\d+\.\s/.test(t)) return false;
  if (t.startsWith(">")) return false;
  return t.includes("|");
}

/** Detect a table separator row: | :---: | --- | etc. */
function isTableSeparator(s: string): boolean {
  const t = s.trim();
  if (!t.includes("|") && !t.includes(":")) return false;
  // Strip leading/trailing pipes
  const inner = t.replace(/^\|/, "").replace(/\|$/, "");
  const cells = inner.split("|");
  if (cells.length === 0) return false;
  return cells.every((c) => /^\s*:?-+:?\s*$/.test(c) || /^\s*:?-+\s*$/.test(c) || /^\s*-+:?\s*$/.test(c));
}

/** Split a table row into cells (respecting escaped pipes). */
function splitTableRow(s: string): string[] {
  let t = s.trim();
  // Strip one leading and trailing pipe if present.
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|") && !t.endsWith("\\|")) t = t.slice(0, -1);
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === "\\" && t[i + 1] === "|") { cur += "|"; i++; }
    else if (ch === "|") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

interface ParsedTable {
  headers: string[];
  rows: string[][];
  aligns: ("left" | "center" | "right")[];
}

function parseTableLines(lines: Line[]): ParsedTable | null {
  if (lines.length < 2) return null;
  if (!isTableRow(lines[0].raw)) return null;
  if (!isTableSeparator(lines[1].raw)) return null;
  const headers = splitTableRow(lines[0].raw);
  const sepCells = splitTableRow(lines[1].raw);
  const aligns: ("left" | "center" | "right")[] = sepCells.map((c) => {
    const t = c.trim();
    const left = t.startsWith(":");
    const right = t.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    return "left";
  });
  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    if (!isTableRow(lines[i].raw)) break;
    rows.push(splitTableRow(lines[i].raw));
  }
  return { headers, rows, aligns };
}

function renderTable(t: ParsedTable): string {
  const heads = t.headers.map((h, i) => {
    const a = t.aligns[i] ?? "left";
    return `<th style="text-align:${a}">${renderInline(h)}</th>`;
  }).join("");
  const body = t.rows.map((r) => {
    const cells = r.map((c, i) => {
      const a = t.aligns[i] ?? "left";
      return `<td style="text-align:${a}">${renderInline(c)}</td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("");
  return `<table><thead><tr>${heads}</tr></thead><tbody>${body}</tbody></table>`;
}

/** Extract fenced code blocks (with their language) from a document. */
export function extractCodeBlocks(text: string): CodeBlockInfo[] {
  const out: CodeBlockInfo[] = [];
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length) {
    const delim = fenceDelimiter(lines[i]);
    if (delim) {
      const lang = lines[i].replace(/^\s{0,3}(`{3,}|~{3,})/, "").trim();
      const startLine = i + 1;
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(delim.repeat(3))) {
        buf.push(lines[i]);
        i++;
      }
      // Skip closing fence
      if (i < lines.length) i++;
      out.push({ language: lang, code: buf.join("\n"), startLine });
    } else {
      i++;
    }
  }
  return out;
}

interface Block {
  type: "heading" | "code" | "ul" | "ol" | "blockquote" | "table" | "hr" | "paragraph" | "blank";
  level?: number;
  lang?: string;
  code?: string;
  text?: string;
  items?: string[];          // for lists
  ordered?: boolean;
  nested?: Block[];          // for blockquote children
  table?: ParsedTable;
}

function parseBlocks(text: string): Block[] {
  const src = text.replace(/\r\n?/g, "\n");
  const lines: Line[] = src.split("\n").map((raw, idx) => ({ raw, no: idx + 1 }));
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.raw.trimEnd();
    // Blank line
    if (!t.trim()) {
      blocks.push({ type: "blank" });
      i++;
      continue;
    }
    // Fenced code block
    const delim = fenceDelimiter(line.raw);
    if (delim) {
      const lang = line.raw.replace(/^\s{0,3}(`{3,}|~{3,})/, "").trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].raw.trim().startsWith(delim.repeat(3))) {
        buf.push(lines[i].raw);
        i++;
      }
      if (i < lines.length) i++; // skip closing fence
      blocks.push({ type: "code", lang, code: buf.join("\n") });
      continue;
    }
    // ATX heading
    const lvl = headingLevel(line.raw);
    if (lvl > 0) {
      const text2 = line.raw.replace(/^\s{0,3}#{1,6}\s+/, "").replace(/\s+#+\s*$/, "").trim();
      blocks.push({ type: "heading", level: lvl, text: text2 });
      i++;
      continue;
    }
    // Horizontal rule
    if (isHrLine(line.raw)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }
    // Blockquote (consume contiguous > lines)
    if (/^\s{0,3}>/.test(line.raw)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i].raw)) {
        buf.push(lines[i].raw.replace(/^\s{0,3}>\s?/, ""));
        i++;
      }
      const inner = parseBlocks(buf.join("\n"));
      blocks.push({ type: "blockquote", nested: inner });
      continue;
    }
    // Table: needs header + separator on next line
    if (isTableRow(line.raw) && i + 1 < lines.length && isTableSeparator(lines[i + 1].raw)) {
      const consumed: Line[] = [];
      while (i < lines.length && isTableRow(lines[i].raw)) {
        consumed.push(lines[i]);
        i++;
        if (consumed.length === 1) {
          // ensure next is separator
          if (i >= lines.length || !isTableSeparator(lines[i].raw)) break;
          consumed.push(lines[i]);
          i++;
        }
      }
      const parsed = parseTableLines(consumed);
      if (parsed) {
        blocks.push({ type: "table", table: parsed });
        continue;
      }
    }
    // Unordered list
    if (/^\s{0,3}[-*+]\s+/.test(line.raw)) {
      const items: string[] = [];
      while (i < lines.length && /^\s{0,3}[-*+]\s+/.test(lines[i].raw)) {
        items.push(lines[i].raw.replace(/^\s{0,3}[-*+]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", items, ordered: false });
      continue;
    }
    // Ordered list
    if (/^\s{0,3}\d+\.\s+/.test(line.raw)) {
      const items: string[] = [];
      while (i < lines.length && /^\s{0,3}\d+\.\s+/.test(lines[i].raw)) {
        items.push(lines[i].raw.replace(/^\s{0,3}\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", items, ordered: true });
      continue;
    }
    // Paragraph: consume contiguous non-blank, non-block-starting lines
    const buf: string[] = [line.raw];
    i++;
    while (i < lines.length) {
      const n = lines[i].raw;
      if (!n.trim()) break;
      if (headingLevel(n)) break;
      if (isHrLine(n)) break;
      if (fenceDelimiter(n)) break;
      if (/^\s{0,3}>/.test(n)) break;
      if (/^\s{0,3}[-*+]\s+/.test(n)) break;
      if (/^\s{0,3}\d+\.\s+/.test(n)) break;
      if (isTableRow(n) && i + 1 < lines.length && isTableSeparator(lines[i + 1].raw)) break;
      buf.push(n);
      i++;
    }
    blocks.push({ type: "paragraph", text: buf.join("\n") });
  }
  return blocks;
}

function renderBlocks(blocks: Block[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "blank":
        break;
      case "heading":
        out.push(`<h${b.level}>${renderInline(b.text ?? "")}</h${b.level}>`);
        break;
      case "code": {
        const cls = b.lang ? ` class="language-${escapeHtml(b.lang)}"` : "";
        const hi = highlightCode(b.code ?? "", b.lang ?? "");
        out.push(`<pre><code${cls}>${hi}</code></pre>`);
        break;
      }
      case "ul":
        out.push(`<ul>${(b.items ?? []).map((it) => `<li>${renderInline(it)}</li>`).join("")}</ul>`);
        break;
      case "ol":
        out.push(`<ol>${(b.items ?? []).map((it) => `<li>${renderInline(it)}</li>`).join("")}</ol>`);
        break;
      case "blockquote":
        out.push(`<blockquote>${renderBlocks(b.nested ?? [])}</blockquote>`);
        break;
      case "table":
        if (b.table) out.push(renderTable(b.table));
        break;
      case "hr":
        out.push("<hr />");
        break;
      case "paragraph":
      default: {
        // Soft-break: single \n in source → space in HTML.
        const para = (b.text ?? "").split("\n").map((l) => renderInline(l)).join("<br />");
        out.push(`<p>${para}</p>`);
        break;
      }
    }
  }
  return out.join("\n");
}

/** Parse markdown text and return rendered HTML. */
export function parseMarkdown(text: string): string {
  if (!text) return "";
  const stripped = stripFrontMatter(text).body;
  const blocks = parseBlocks(stripped);
  return renderBlocks(blocks);
}

// ---------------------------------------------------------------------------
// Stats & validation
// ---------------------------------------------------------------------------

/** Compute document statistics. */
export function computeStats(text: string): MarkdownStats {
  const stripped = stripFrontMatter(text).body;
  const chars = stripped.length;
  const charsNoSpaces = stripped.replace(/\s/g, "").length;
  const lines = stripped ? stripped.split("\n").length : 0;
  const words = (stripped.match(/\b[\w']+\b/g) ?? []).length;
  const paragraphs = (stripped.split(/\n\s*\n/).filter((p) => p.trim()).length);
  const codeBlocks = extractCodeBlocks(stripped).length;
  const tables = (stripped.split("\n").reduce((acc, line, idx, arr) => {
    if (idx + 1 < arr.length && isTableRow(line) && isTableSeparator(arr[idx + 1])) {
      return acc + 1;
    }
    return acc;
  }, 0));
  return {
    chars,
    charsNoSpaces,
    words,
    lines,
    paragraphs,
    codeBlocks,
    tables,
    readingTimeMin: Math.max(1, Math.ceil(words / READING_WORDS_PER_MIN)),
  };
}

/** Lightweight validation: flags unclosed fences and obvious issues. */
export function validateMarkdown(text: string): MarkdownValidation {
  const issues: MarkdownIssue[] = [];
  const lines = text.split("\n");
  let inFence = false;
  let fenceChar = "";
  let fenceStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    const delim = fenceDelimiter(lines[i]);
    if (delim) {
      if (!inFence) {
        inFence = true;
        fenceChar = delim;
        fenceStart = i + 1;
      } else if (delim === fenceChar) {
        inFence = false;
        fenceChar = "";
      }
    }
  }
  if (inFence) {
    issues.push({
      severity: "error",
      line: fenceStart,
      message: `Unclosed code fence starting at line ${fenceStart}. Add a closing "${fenceChar}${fenceChar}${fenceChar}" line.`,
    });
  }
  // Warn about mismatched table separators
  for (let i = 0; i < lines.length - 1; i++) {
    if (isTableRow(lines[i]) && isTableRow(lines[i + 1]) && !isTableSeparator(lines[i + 1])) {
      // could be a multi-line table row without separator — skip
    }
  }
  // Warn about lines that look like a heading without space after #
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s{0,3}(#{1,6})([^\s#].*)$/.exec(lines[i]);
    if (m && !/^#{1,6}\s/.test(lines[i].trim())) {
      issues.push({
        severity: "warn",
        line: i + 1,
        message: `Heading on line ${i + 1} needs a space after "#".`,
      });
    }
  }
  return {
    issues,
    warnings: issues.filter((i) => i.severity === "warn").length,
    errors: issues.filter((i) => i.severity === "error").length,
  };
}

// ---------------------------------------------------------------------------
// HTML export
// ---------------------------------------------------------------------------

const BASE_CSS = `
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 760px; margin: 2rem auto; padding: 0 1rem; color: #1f2328; }
h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 1.5em 0 0.5em; }
h1 { font-size: 1.9em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
h2 { font-size: 1.5em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
h3 { font-size: 1.25em; }
p, ul, ol, blockquote, table, pre { margin: 0 0 1em; }
a { color: #0969da; text-decoration: none; }
a:hover { text-decoration: underline; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: rgba(175,184,193,0.2); padding: 0.15em 0.35em; border-radius: 4px; font-size: 0.9em; }
pre { background: #f6f8fa; padding: 1em; border-radius: 6px; overflow-x: auto; }
pre code { background: transparent; padding: 0; font-size: 0.85em; }
blockquote { border-left: 4px solid #d0d7de; padding: 0 1em; color: #57606a; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #d0d7de; padding: 0.4em 0.7em; }
th { background: #f6f8fa; font-weight: 600; }
hr { border: none; border-top: 2px solid #d0d7de; margin: 1.5em 0; }
img { max-width: 100%; }
.tok-keyword { color: #cf222e; }
.tok-string  { color: #0a3069; }
.tok-number  { color: #0550ae; }
.tok-comment { color: #6e7781; font-style: italic; }
.tok-tag     { color: #116329; }
.tok-variable{ color: #953800; }
`.trim();

const DARK_CSS = `
body { background: #0d1117; color: #c9d1d9; }
h1, h2 { border-bottom-color: #30363d; }
a { color: #58a6ff; }
code { background: rgba(110,118,129,0.4); }
pre { background: #161b22; }
blockquote { border-left-color: #30363d; color: #8b949e; }
th, td { border-color: #30363d; }
th { background: #161b22; }
hr { border-top-color: #30363d; }
.tok-keyword { color: #ff7b72; }
.tok-string  { color: #a5d6ff; }
.tok-number  { color: #79c0ff; }
.tok-comment { color: #8b949e; }
.tok-tag     { color: #7ee787; }
.tok-variable{ color: #ffa657; }
`.trim();

/** Build a standalone HTML document wrapping the rendered markdown. */
export function buildHtmlDocument(bodyHtml: string, opts: HtmlExportOptions = {}): string {
  const title = opts.title ?? "Markdown Export";
  const css = opts.dark ? `${BASE_CSS}\n${DARK_CSS}` : BASE_CSS;
  if (!opts.fullDocument) return bodyHtml;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
${css}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

/** Convenience: parse + export to a full standalone HTML document. */
export function exportHtml(text: string, opts: HtmlExportOptions = {}): string {
  const body = parseMarkdown(text);
  return buildHtmlDocument(body, { ...opts, fullDocument: true });
}

// ---------------------------------------------------------------------------
// History (localStorage, max 20)
// ---------------------------------------------------------------------------

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
// Autosave (single-slot)
// ---------------------------------------------------------------------------

export function loadAutosave(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(AUTOSAVE_KEY);
  } catch {
    return null;
  }
}

export function saveAutosave(text: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(AUTOSAVE_KEY, text);
  } catch {
    // ignore
  }
}

export function clearAutosave(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Shareable URL (content encoded in hash)
// ---------------------------------------------------------------------------

/** Build a shareable URL with the markdown encoded into the fragment hash. */
export function buildShareUrl(text: string): { url: string; tooLarge: boolean } {
  const encoded = encodeURIComponent(text ?? "");
  const hash = `#md=${encoded}`;
  if (encoded.length > SHARE_MAX_BYTES) {
    return { url: "", tooLarge: true };
  }
  if (typeof window === "undefined") return { url: hash, tooLarge: false };
  return { url: `${window.location.origin}${window.location.pathname}${hash}`, tooLarge: false };
}

/** Parse a shareable URL/hash back into markdown content. */
export function parseShareUrl(hash: string): { text: string | null } {
  if (!hash) return { text: null };
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!h.startsWith("md=")) return { text: null };
  const v = h.slice(3);
  try {
    return { text: decodeURIComponent(v) };
  } catch {
    return { text: null };
  }
}

/** Convenience for the UI: returns the autosave or hash content, whichever is newer. */
export function loadInitialContent(): { text: string; source: "hash" | "autosave" | "none" } {
  if (typeof window !== "undefined" && window.location.hash) {
    const p = parseShareUrl(window.location.hash);
    if (p.text) return { text: p.text, source: "hash" };
  }
  const auto = loadAutosave();
  if (auto) return { text: auto, source: "autosave" };
  return { text: "", source: "none" };
}

/**
 * Markdown Syntax Cheatsheet & Reference — pure logic.
 *
 * A static dataset of 60+ Markdown syntax entries across 10 categories
 * (basic, GFM, CommonMark, extended) plus a fuzzy search engine, a
 * flavor-support matrix, a minimal pure-JS Markdown renderer for live
 * per-card preview, history (localStorage, max 20), and a shareable URL.
 * 100% client-side — no DOM, no network.
 *
 * Design principles:
 *  - Every entry has id, name, category, source, rendered output, notes.
 *  - Flavor-support matrix is a per-flavor boolean.
 *  - Search is fuzzy substring match across name + source + notes.
 *  - The embedded renderer supports a CommonMark/GFM subset (headings,
 *    paragraphs, emphasis, code, lists, tables, blockquotes, rules, links,
 *    images, task lists, alerts, strikethrough, footnotes).
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MdCategory =
  | "headings"
  | "emphasis"
  | "lists"
  | "links"
  | "images"
  | "code"
  | "tables"
  | "quotes"
  | "rules"
  | "gfm-extended";

export type Flavor = "commonmark" | "gfm" | "gitlab" | "pandoc" | "obsidian";

export interface MdEntry {
  /** Unique kebab-case id, also used as the URL anchor. */
  id: string;
  name: string;
  category: MdCategory;
  /** Markdown source for the example. */
  source: string;
  /** Optional short note explaining the entry. */
  note?: string;
  /** Per-flavor support. */
  flavors: Record<Flavor, boolean>;
  /** Tag list (lowercase) for search boosting. */
  tags?: string[];
}

export interface HistoryEntry {
  ts: number;
  query: string;
  category: MdCategory | "";
  entryId: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CATEGORY_LABELS: Record<MdCategory, string> = {
  "headings": "Headings",
  "emphasis": "Emphasis",
  "lists": "Lists",
  "links": "Links & References",
  "images": "Images",
  "code": "Code",
  "tables": "Tables",
  "quotes": "Blockquotes",
  "rules": "Rules & Dividers",
  "gfm-extended": "GFM & Extended",
};

export const CATEGORY_ORDER: MdCategory[] = [
  "headings", "emphasis", "lists", "links", "images",
  "code", "tables", "quotes", "rules", "gfm-extended",
];

export const FLAVOR_LABELS: Record<Flavor, string> = {
  "commonmark": "CommonMark",
  "gfm": "GFM",
  "gitlab": "GitLab",
  "pandoc": "pandoc",
  "obsidian": "Obsidian",
};

export const FLAVOR_ORDER: Flavor[] = ["commonmark", "gfm", "gitlab", "pandoc", "obsidian"];

const HISTORY_KEY = "unqtools:markdown-cheatsheet:history";
const HISTORY_MAX = 20;

// ---------------------------------------------------------------------------
// Dataset (60+ entries)
// ---------------------------------------------------------------------------

function allFlavors(except: Flavor[] = []): Record<Flavor, boolean> {
  return {
    commonmark: !except.includes("commonmark"),
    gfm: !except.includes("gfm"),
    gitlab: !except.includes("gitlab"),
    pandoc: !except.includes("pandoc"),
    obsidian: !except.includes("obsidian"),
  };
}

function gfmOnly(extra: Flavor[] = []): Record<Flavor, boolean> {
  const m = allFlavors(["commonmark"]);
  for (const f of extra) m[f] = false;
  return m;
}

function extOnly(allowed: Flavor[]): Record<Flavor, boolean> {
  return {
    commonmark: allowed.includes("commonmark"),
    gfm: allowed.includes("gfm"),
    gitlab: allowed.includes("gitlab"),
    pandoc: allowed.includes("pandoc"),
    obsidian: allowed.includes("obsidian"),
  };
}

export const ENTRIES: MdEntry[] = [
  // ---- Headings (6) ----
  {
    id: "h1",
    name: "Heading 1 (ATX)",
    category: "headings",
    source: "# Heading 1",
    note: "Single hash followed by a space. CommonMark spec heading style.",
    flavors: allFlavors(),
    tags: ["h1", "title", "atx", "hash"],
  },
  {
    id: "h2",
    name: "Heading 2 (ATX)",
    category: "headings",
    source: "## Heading 2",
    flavors: allFlavors(),
    tags: ["h2", "subtitle", "atx"],
  },
  {
    id: "h3",
    name: "Heading 3 (ATX)",
    category: "headings",
    source: "### Heading 3",
    flavors: allFlavors(),
    tags: ["h3", "atx"],
  },
  {
    id: "h4-h6",
    name: "Heading 4–6",
    category: "headings",
    source: "#### Heading 4\n##### Heading 5\n###### Heading 6",
    note: "ATX headings support 1–6 hash signs.",
    flavors: allFlavors(),
    tags: ["h4", "h5", "h6", "atx"],
  },
  {
    id: "setext-h1",
    name: "Setext Heading",
    category: "headings",
    source: "Heading 1\n=========\n\nHeading 2\n---------",
    note: "Underlined with = (h1) or - (h2). CommonMark supports this; GFM prefers ATX.",
    flavors: allFlavors(),
    tags: ["setext", "underline"],
  },
  {
    id: "heading-custom-id",
    name: "Heading Custom ID",
    category: "headings",
    source: "## My Heading {#custom-id}",
    note: "Attach an explicit id for anchor links. pandoc / Obsidian / markdown-it anchor plugin.",
    flavors: extOnly(["pandoc", "obsidian"]),
    tags: ["anchor", "id", "pandoc"],
  },

  // ---- Emphasis (8) ----
  {
    id: "bold",
    name: "Bold",
    category: "emphasis",
    source: "**bold text**",
    flavors: allFlavors(),
    tags: ["strong", "asterisk"],
  },
  {
    id: "italic",
    name: "Italic",
    category: "emphasis",
    source: "*italic text*",
    flavors: allFlavors(),
    tags: ["em", "asterisk"],
  },
  {
    id: "bold-italic",
    name: "Bold + Italic",
    category: "emphasis",
    source: "***bold and italic***",
    flavors: allFlavors(),
    tags: ["strong", "em", "asterisk"],
  },
  {
    id: "underscore-emphasis",
    name: "Underscore Emphasis",
    category: "emphasis",
    source: "__bold__ _italic_",
    note: "Underscores cannot span words (CommonMark) — only word boundaries.",
    flavors: allFlavors(),
    tags: ["underscore", "strong", "em"],
  },
  {
    id: "strikethrough",
    name: "Strikethrough",
    category: "emphasis",
    source: "~~struck~~",
    note: "GFM extension. Double tilde.",
    flavors: gfmOnly(["obsidian", "pandoc"]),
    tags: ["delete", "del", "tilde", "gfm"],
  },
  {
    id: "highlight",
    name: "Highlight (mark)",
    category: "emphasis",
    source: "==highlighted==",
    note: "Obsidian / pandoc / GitLab-flavored. Renders as <mark>.",
    flavors: extOnly(["gitlab", "pandoc", "obsidian"]),
    tags: ["mark", "highlight", "equal"],
  },
  {
    id: "subscript-superscript",
    name: "Subscript / Superscript",
    category: "emphasis",
    source: "H~2~O  |  x^2^",
    note: "pandoc / Obsidian only.",
    flavors: extOnly(["pandoc", "obsidian"]),
    tags: ["sub", "sup"],
  },
  {
    id: "inline-code",
    name: "Inline Code",
    category: "emphasis",
    source: "Use `console.log()` to print.",
    note: "Single backticks. CommonMark.",
    flavors: allFlavors(),
    tags: ["code", "backtick"],
  },

  // ---- Lists (8) ----
  {
    id: "unordered-list",
    name: "Unordered List",
    category: "lists",
    source: "- Item one\n- Item two\n- Item three",
    note: "Dash, asterisk, or plus are all valid markers.",
    flavors: allFlavors(),
    tags: ["bullet", "ul"],
  },
  {
    id: "ordered-list",
    name: "Ordered List",
    category: "lists",
    source: "1. First\n2. Second\n3. Third",
    flavors: allFlavors(),
    tags: ["ol", "numbered"],
  },
  {
    id: "nested-list",
    name: "Nested List",
    category: "lists",
    source: "- Parent\n  - Child\n    - Grandchild",
    note: "Indent by 2 (CommonMark) or 4 spaces. Lists nest up to any depth.",
    flavors: allFlavors(),
    tags: ["nested", "indent"],
  },
  {
    id: "task-list",
    name: "Task List (Checkbox)",
    category: "lists",
    source: "- [x] Done\n- [ ] Todo\n- [ ] Also todo",
    note: "GFM task list extension.",
    flavors: gfmOnly(["obsidian"]),
    tags: ["checkbox", "todo", "gfm"],
  },
  {
    id: "list-marker-plus",
    name: "List Marker Variants",
    category: "lists",
    source: "* Asterisk\n+ Plus\n- Dash",
    note: "All three markers produce <ul>.",
    flavors: allFlavors(),
    tags: ["marker", "bullet"],
  },
  {
    id: "ordered-loose",
    name: "Loose Ordered List",
    category: "lists",
    source: "1. First\n\n2. Second\n\n3. Third",
    note: "Blank lines between items create a 'loose' list — paragraphs wrap in <p>.",
    flavors: allFlavors(),
    tags: ["loose", "paragraph"],
  },
  {
    id: "start-offset",
    name: "Ordered List Start Offset",
    category: "lists",
    source: "3. Three\n4. Four\n5. Five",
    note: "First number sets the start attribute.",
    flavors: allFlavors(),
    tags: ["start", "offset"],
  },
  {
    id: "definition-list",
    name: "Definition List",
    category: "lists",
    source: "Term\n: Definition one\n: Definition two",
    note: "pandoc / Obsidian / PHP Markdown Extra.",
    flavors: extOnly(["pandoc", "obsidian"]),
    tags: ["dl", "definition"],
  },

  // ---- Links & References (7) ----
  {
    id: "inline-link",
    name: "Inline Link",
    category: "links",
    source: "[Example](https://example.com)",
    flavors: allFlavors(),
    tags: ["a", "href", "inline"],
  },
  {
    id: "link-title",
    name: "Link with Title",
    category: "links",
    source: '[Example](https://example.com "Example Site")',
    note: "Title shows on hover as a tooltip.",
    flavors: allFlavors(),
    tags: ["title", "tooltip"],
  },
  {
    id: "reference-link",
    name: "Reference Link",
    category: "links",
    source: "[Example][1]\n\n[1]: https://example.com",
    note: "Reference definition can appear anywhere in the document.",
    flavors: allFlavors(),
    tags: ["reference", "ref"],
  },
  {
    id: "auto-link",
    name: "Autolink (bare URL)",
    category: "links",
    source: "Visit <https://example.com>",
    note: "Angle brackets turn a bare URL into a clickable link. GFM also autolinks bare URLs without brackets.",
    flavors: gfmOnly(),
    tags: ["autolink", "url"],
  },
  {
    id: "auto-link-www",
    name: "Bare-www Autolink",
    category: "links",
    source: "Visit www.example.com today.",
    note: "GFM-only: bare www.* URLs become links automatically.",
    flavors: gfmOnly(),
    tags: ["autolink", "www", "gfm"],
  },
  {
    id: "email-autolink",
    name: "Email Autolink",
    category: "links",
    source: "<user@example.com>",
    note: "Angle-bracketed email becomes a mailto: link.",
    flavors: allFlavors(),
    tags: ["email", "mailto"],
  },
  {
    id: "link-shortcut",
    name: "Shortcut Reference Link",
    category: "links",
    source: "[Example]\n\n[example]: https://example.com",
    note: "Single-bracket form. Matched by case-insensitive label.",
    flavors: allFlavors(),
    tags: ["shortcut", "reference"],
  },

  // ---- Images (4) ----
  {
    id: "inline-image",
    name: "Inline Image",
    category: "images",
    source: "![Alt text](https://placehold.co/150x50)",
    flavors: allFlavors(),
    tags: ["img", "inline"],
  },
  {
    id: "image-title",
    name: "Image with Title",
    category: "images",
    source: '![Alt text](https://placehold.co/150x50 "Placeholder")',
    flavors: allFlavors(),
    tags: ["img", "title"],
  },
  {
    id: "reference-image",
    name: "Reference Image",
    category: "images",
    source: "![Alt][logo]\n\n[logo]: https://placehold.co/150x50",
    flavors: allFlavors(),
    tags: ["img", "reference"],
  },
  {
    id: "image-size-obsidian",
    name: "Image with Size (Obsidian)",
    category: "images",
    source: "![[image.png|400x300]]",
    note: "Obsidian wiki-link embed syntax with dimensions.",
    flavors: extOnly(["obsidian"]),
    tags: ["obsidian", "embed", "size"],
  },

  // ---- Code (6) ----
  {
    id: "fenced-code",
    name: "Fenced Code Block",
    category: "code",
    source: "```\nplain code block\n```",
    note: "Three backticks. CommonMark.",
    flavors: allFlavors(),
    tags: ["fence", "codeblock"],
  },
  {
    id: "fenced-code-lang",
    name: "Fenced Code with Language",
    category: "code",
    source: "```javascript\nfunction greet(name) {\n  return `Hello, ${name}`;\n}\n```",
    note: "Language hint after the opening fence enables syntax highlighting.",
    flavors: allFlavors(),
    tags: ["language", "syntax", "highlight"],
  },
  {
    id: "tilde-fence",
    name: "Tilde Fenced Code",
    category: "code",
    source: "~~~\nalso a code block\n~~~",
    note: "Tildes are equivalent to backticks in CommonMark.",
    flavors: allFlavors(),
    tags: ["tilde", "fence"],
  },
  {
    id: "inline-code-double",
    name: "Inline Code with Backticks",
    category: "code",
    source: "Use `` `backticks` `` inside code.",
    note: "Double backticks let you include a single backtick inside inline code.",
    flavors: allFlavors(),
    tags: ["inline", "backtick"],
  },
  {
    id: "nested-fence",
    name: "Nested Code Fence (4 backticks)",
    category: "code",
    source: "````\n```js\n// inner\n```\n````",
    note: "Use 4+ backticks to wrap a block that itself contains a 3-backtick fence.",
    flavors: allFlavors(),
    tags: ["nested", "fence"],
  },
  {
    id: "code-indented",
    name: "Indented Code Block",
    category: "code",
    source: "    // 4-space indent\n    const x = 1;",
    note: "CommonMark indented code. Less common than fenced.",
    flavors: allFlavors(),
    tags: ["indent", "codeblock"],
  },

  // ---- Tables (5) ----
  {
    id: "basic-table",
    name: "GFM Table",
    category: "tables",
    source: "| Name | Age |\n| ---- | --- |\n| Ada  | 36  |\n| Alan | 41  |",
    note: "GFM tables. Header row + delimiter row + body.",
    flavors: gfmOnly(["pandoc"]),
    tags: ["table", "gfm"],
  },
  {
    id: "aligned-table",
    name: "Aligned Table Cells",
    category: "tables",
    source: "| Left | Center | Right |\n| :--- | :----: | ----: |\n| a    | b      | c     |",
    note: "Colon placement controls text alignment.",
    flavors: gfmOnly(["pandoc"]),
    tags: ["table", "align"],
  },
  {
    id: "table-without-edges",
    name: "Table Without Outer Pipes",
    category: "tables",
    source: "Name | Age\n---- | ---\nAda  | 36",
    note: "Outer pipes are optional in GFM.",
    flavors: gfmOnly(["pandoc"]),
    tags: ["table", "minimal"],
  },
  {
    id: "table-inline-formatting",
    name: "Inline Formatting in Tables",
    category: "tables",
    source: "| Feature | Status |\n| ------- | ------ |\n| **Bold** | ✅ |\n| `code`  | ✅ |",
    flavors: gfmOnly(["pandoc"]),
    tags: ["table", "inline"],
  },
  {
    id: "grid-table",
    name: "Grid Table (pandoc)",
    category: "tables",
    source: "+-------+-----+\n| Name  | Age |\n+=======+=====+\n| Ada   | 36  |\n+-------+-----+",
    note: "pandoc grid table — supports multi-line cells.",
    flavors: extOnly(["pandoc"]),
    tags: ["grid", "pandoc"],
  },

  // ---- Blockquotes (4) ----
  {
    id: "blockquote",
    name: "Blockquote",
    category: "quotes",
    source: "> This is a quote.\n> Continues here.",
    flavors: allFlavors(),
    tags: ["quote", "blockquote"],
  },
  {
    id: "nested-blockquote",
    name: "Nested Blockquote",
    category: "quotes",
    source: "> Outer\n> > Inner\n> > Deeper",
    flavors: allFlavors(),
    tags: ["nested", "quote"],
  },
  {
    id: "blockquote-multi",
    name: "Multi-paragraph Blockquote",
    category: "quotes",
    source: "> Paragraph one.\n>\n> Paragraph two.",
    note: "Blank > line separates paragraphs inside a quote.",
    flavors: allFlavors(),
    tags: ["paragraph", "quote"],
  },
  {
    id: "blockquote-with-list",
    name: "Blockquote with List",
    category: "quotes",
    source: "> - Item one\n> - Item two\n> - Item three",
    flavors: allFlavors(),
    tags: ["list", "quote"],
  },

  // ---- Rules & Dividers (3) ----
  {
    id: "horizontal-rule",
    name: "Horizontal Rule",
    category: "rules",
    source: "---\n\n***\n\n___",
    note: "Three dashes, asterisks, or underscores. Must be on a line alone.",
    flavors: allFlavors(),
    tags: ["hr", "rule", "divider"],
  },
  {
    id: "escape-characters",
    name: "Escaping Characters",
    category: "rules",
    source: "\\*not italic\\*  \\#not heading",
    note: "Backslash escapes any Markdown punctuation.",
    flavors: allFlavors(),
    tags: ["escape", "backslash"],
  },
  {
    id: "html-comment",
    name: "HTML Comment",
    category: "rules",
    source: "<!-- this is hidden -->\nVisible text.",
    note: "Renders as nothing in the output but stays in the source.",
    flavors: allFlavors(),
    tags: ["comment", "hidden"],
  },

  // ---- GFM & Extended (14) ----
  {
    id: "gfm-alerts",
    name: "GFM Alerts",
    category: "gfm-extended",
    source: "> [!NOTE]\n> Useful information.\n\n> [!WARNING]\n> Be careful.",
    note: "GitHub-native alert callouts: NOTE, TIP, IMPORTANT, CAUTION, WARNING.",
    flavors: gfmOnly(["obsidian"]),
    tags: ["alert", "callout", "gfm"],
  },
  {
    id: "gfm-strikethrough",
    name: "GFM Strikethrough",
    category: "gfm-extended",
    source: "~~deleted~~ and ~~also deleted~~",
    flavors: gfmOnly(["obsidian", "pandoc"]),
    tags: ["strike", "gfm"],
  },
  {
    id: "gfm-autolink-rewrite",
    name: "GFM Autolink Rewrites",
    category: "gfm-extended",
    source: "Visit https://example.com/page?x=1 today.",
    note: "GFM rewrites bare URLs (and www.*) into links automatically.",
    flavors: gfmOnly(),
    tags: ["autolink", "url", "gfm"],
  },
  {
    id: "gfm-disallowed-html",
    name: "Raw HTML",
    category: "gfm-extended",
    source: "<details>\n<summary>Click</summary>\nHidden content.\n</details>",
    note: "Raw HTML passes through. GFM sanitizes dangerous tags by default.",
    flavors: allFlavors(),
    tags: ["html", "raw"],
  },
  {
    id: "footnote",
    name: "Footnotes",
    category: "gfm-extended",
    source: "Some claim[^1] is supported.\n\n[^1]: The footnote text.",
    note: "pandoc / Obsidian / GFM (Oct 2023+) footnote extension.",
    flavors: extOnly(["gfm", "pandoc", "obsidian"]),
    tags: ["footnote", "reference"],
  },
  {
    id: "footnote-inline",
    name: "Inline Footnote",
    category: "gfm-extended",
    source: "Here is an inline footnote: ^[inline note].",
    note: "pandoc / Obsidian inline footnote syntax.",
    flavors: extOnly(["pandoc", "obsidian"]),
    tags: ["footnote", "inline"],
  },
  {
    id: "math-tex",
    name: "Math (TeX)",
    category: "gfm-extended",
    source: "Inline $E = mc^2$ and block:\n\n$$\\int_0^1 x\\, dx$$",
    note: "GitHub-native math since 2022. Also Obsidian / pandoc / GitLab.",
    flavors: extOnly(["gfm", "gitlab", "pandoc", "obsidian"]),
    tags: ["math", "tex", "latex"],
  },
  {
    id: "mermaid-diagram",
    name: "Mermaid Diagram",
    category: "gfm-extended",
    source: "```mermaid\ngraph LR\n  A --> B\n  B --> C\n```",
    note: "GitHub renders mermaid.js diagrams inline. GitLab and Obsidian too.",
    flavors: extOnly(["gfm", "gitlab", "obsidian"]),
    tags: ["mermaid", "diagram", "graph"],
  },
  {
    id: "emoji-shortcode",
    name: "Emoji Shortcodes",
    category: "gfm-extended",
    source: ":+1: :rocket: :tada: :smile:",
    note: "GitHub shortcodes render as emoji. CommonMark does not.",
    flavors: gfmOnly(["obsidian"]),
    tags: ["emoji", "gfm", "shortcode"],
  },
  {
    id: "collapsible-section",
    name: "Collapsible Section",
    category: "gfm-extended",
    source: "<details>\n<summary>Toggle me</summary>\n\nHidden content here.\n\n</details>",
    note: "Native HTML <details>. Works in GFM, GitLab, pandoc, Obsidian.",
    flavors: allFlavors(),
    tags: ["details", "summary", "collapse"],
  },
  {
    id: "line-break-double",
    name: "Line Break (trailing spaces)",
    category: "gfm-extended",
    source: "Line one.  \nLine two.",
    note: "Two trailing spaces force a <br>. GFM also supports backslash-newline.",
    flavors: allFlavors(),
    tags: ["br", "linebreak"],
  },
  {
    id: "backslash-line-break",
    name: "Backslash Line Break",
    category: "gfm-extended",
    source: "Line one.\\\nLine two.",
    note: "GFM-only: backslash before newline forces a <br>.",
    flavors: gfmOnly(),
    tags: ["br", "backslash", "gfm"],
  },
  {
    id: "wiki-link",
    name: "Wiki-link (Obsidian)",
    category: "gfm-extended",
    source: "[[Note Title]] and [[Note Title|display text]]",
    note: "Obsidian-style bidirectional wiki links.",
    flavors: extOnly(["obsidian"]),
    tags: ["wiki", "obsidian", "link"],
  },
  {
    id: "tag-hashtag",
    name: "Hashtag Tag",
    category: "gfm-extended",
    source: "#tag #multi-word-tag",
    note: "Obsidian / Markdown-It tag plugin. Treats #word as a tag.",
    flavors: extOnly(["obsidian"]),
    tags: ["hashtag", "tag", "obsidian"],
  },
];

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/** Normalize a query string for matching. */
export function normalizeQuery(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Levenshtein distance (for fuzzy match scoring). */
export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = tmp;
    }
  }
  return dp[n];
}

/** Simple fuzzy substring match: returns true if all query chars appear in order in target. */
export function fuzzyContains(target: string, query: string): boolean {
  if (!query) return true;
  let i = 0;
  for (let j = 0; j < target.length && i < query.length; j++) {
    if (target[j] === query[i]) i++;
  }
  return i === query.length;
}

export interface ScoredEntry {
  entry: MdEntry;
  score: number;
}

/** Search entries by query (fuzzy). Returns entries sorted by score. */
export function searchEntries(
  query: string,
  category?: MdCategory | "",
): MdEntry[] {
  const q = normalizeQuery(query);
  const pool = category ? ENTRIES.filter((e) => e.category === category) : ENTRIES;
  if (!q) return pool;
  const scored: ScoredEntry[] = [];
  for (const e of pool) {
    const name = e.name.toLowerCase();
    const tags = (e.tags ?? []).join(" ").toLowerCase();
    const source = e.source.toLowerCase();
    const note = (e.note ?? "").toLowerCase();
    let score = 0;
    if (name === q) score += 100;
    if (name.startsWith(q)) score += 60;
    if (name.includes(q)) score += 40;
    if (tags.includes(q)) score += 30;
    if (tags.split(" ").some((t) => t.startsWith(q))) score += 25;
    if (source.includes(q)) score += 15;
    if (note.includes(q)) score += 10;
    if (fuzzyContains(name, q)) score += 5;
    if (score > 0) scored.push({ entry: e, score });
  }
  scored.sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name));
  return scored.map((s) => s.entry);
}

/** Group entries by category. */
export function groupByCategory(entries: MdEntry[]): Record<MdCategory, MdEntry[]> {
  const out: Record<MdCategory, MdEntry[]> = {
    "headings": [], "emphasis": [], "lists": [], "links": [], "images": [],
    "code": [], "tables": [], "quotes": [], "rules": [], "gfm-extended": [],
  };
  for (const e of entries) out[e.category].push(e);
  return out;
}

/** Get the flavor-support matrix for an entry as a list. */
export function flavorMatrix(entry: MdEntry): { flavor: Flavor; supported: boolean; label: string }[] {
  return FLAVOR_ORDER.map((f) => ({
    flavor: f,
    supported: entry.flavors[f],
    label: FLAVOR_LABELS[f],
  }));
}

/** Find an entry by id. */
export function findById(id: string): MdEntry | undefined {
  return ENTRIES.find((e) => e.id === id);
}

// ---------------------------------------------------------------------------
// Pure-JS Markdown renderer (CommonMark + GFM subset)
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Render inline markdown (bold, italic, code, links, images, strikethrough). */
export function renderInline(s: string): string {
  if (!s) return "";
  let out = escapeHtml(s);
  // Inline code first (greedy)
  out = out.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);
  // Images: ![alt](src "title")
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_m, alt, src, title) =>
      `<img src="${src}" alt="${alt}"${title ? ` title="${title}"` : ""} />`);
  // Links: [text](url "title")
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_m, text, href, title) =>
      `<a href="${href}"${title ? ` title="${title}"` : ""}>${text}</a>`);
  // Autolinks <url>
  out = out.replace(/&lt;(https?:\/\/[^&\s]+)&gt;/g, (_m, url) =>
    `<a href="${url}">${url}</a>`);
  out = out.replace(/&lt;([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})&gt;/g,
    (_m, email) => `<a href="mailto:${email}">${email}</a>`);
  // Bold italic ***text***
  out = out.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  // Bold **text** or __text__
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // Italic *text* or _text_
  out = out.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>");
  out = out.replace(/(^|[^_])_([^_\s][^_]*?)_(?!_)/g, "$1<em>$2</em>");
  // Strikethrough ~~text~~
  out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  // Highlight ==text==
  out = out.replace(/==([^=]+)==/g, "<mark>$1</mark>");
  return out;
}

export interface RenderOptions {
  /** Apply GFM task list rendering. */
  gfm?: boolean;
}

/** Render a Markdown string to HTML. Supports CommonMark + GFM subset. */
export function renderMarkdown(src: string, opts: RenderOptions = {}): string {
  if (!src) return "";
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const html: string[] = [];
  let i = 0;
  let inUl = false;
  let inOl = false;
  let inQuote = false;
  let inTable = false;
  let tableHeader: string[] | null = null;
  let tableAligns: ("left" | "center" | "right" | null)[] = [];
  let tableRows: string[][] = [];

  const closeLists = () => {
    if (inUl) { html.push("</ul>"); inUl = false; }
    if (inOl) { html.push("</ol>"); inOl = false; }
  };
  const closeQuote = () => {
    if (inQuote) { html.push("</blockquote>"); inQuote = false; }
  };
  const flushTable = () => {
    if (inTable && tableHeader) {
      html.push('<table class="md-table">');
      html.push("<thead><tr>");
      for (let k = 0; k < tableHeader.length; k++) {
        const align = tableAligns[k];
        html.push(`<th${align ? ` style="text-align:${align}"` : ""}>${renderInline(tableHeader[k])}</th>`);
      }
      html.push("</tr></thead><tbody>");
      for (const row of tableRows) {
        html.push("<tr>");
        for (let k = 0; k < row.length; k++) {
          const align = tableAligns[k];
          html.push(`<td${align ? ` style="text-align:${align}"` : ""}>${renderInline(row[k])}</td>`);
        }
        html.push("</tr>");
      }
      html.push("</tbody></table>");
    }
    inTable = false;
    tableHeader = null;
    tableAligns = [];
    tableRows = [];
  };
  const closeAll = () => { closeLists(); closeQuote(); flushTable(); };

  while (i < lines.length) {
    let line = lines[i];

    // Skip front-matter
    if (i === 0 && line === "---") {
      const end = lines.indexOf("---", 1);
      if (end !== -1) { i = end + 1; continue; }
    }

    // Fenced code block
    const fenceMatch = line.match(/^(`{3,}|~{3,})\s*([\w-]*)\s*$/);
    if (fenceMatch) {
      closeAll();
      const fence = fenceMatch[1];
      const lang = fenceMatch[2] ?? "";
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(fence[0].repeat(fence.length))) {
        code.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      html.push(`<pre><code class="language-${escapeHtml(lang)}">${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    // Horizontal rule
    if (/^\s*([-*_])\s*\1\s*\1[\s\1]*$/.test(line)) {
      closeAll();
      html.push("<hr />");
      i++;
      continue;
    }

    // ATX heading
    const hMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (hMatch) {
      closeAll();
      const level = hMatch[1].length;
      const text = hMatch[2].replace(/\s*#+\s*$/, "");
      html.push(`<h${level} id="${slugify(text)}">${renderInline(text)}</h${level}>`);
      i++;
      continue;
    }

    // Setext heading (look-ahead)
    if (i + 1 < lines.length && /^\s*([-=])\s*\1\s*\1[\s=]*$/.test(lines[i + 1])) {
      const m = lines[i + 1].match(/^(\s*)([=-])/);
      if (m) {
        closeAll();
        const level = m[2] === "=" ? 1 : 2;
        html.push(`<h${level} id="${slugify(line)}">${renderInline(line)}</h${level}>`);
        i += 2;
        continue;
      }
    }

    // Blockquote (with GFM alert support)
    if (/^>\s?/.test(line)) {
      closeLists();
      flushTable();
      if (!inQuote) { html.push("<blockquote>"); inQuote = true; }
      // Collect consecutive quote lines
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      // GFM alert: > [!NOTE]
      const alertMatch = quoteLines[0]?.match(/^\[!(NOTE|TIP|IMPORTANT|CAUTION|WARNING)\]\s*$/i);
      if (alertMatch) {
        const kind = alertMatch[1].toUpperCase();
        const body = quoteLines.slice(1).join("\n");
        html.push(`<div class="md-alert md-alert-${kind.toLowerCase()}"><p class="md-alert-title">${kind}</p>`);
        html.push(renderMarkdown(body, opts));
        html.push("</div>");
      } else {
        html.push(renderMarkdown(quoteLines.join("\n"), opts));
      }
      closeQuote();
      continue;
    }

    // GFM table (line + delimiter)
    if (/^\s*\|.+\|\s*$/.test(line) && i + 1 < lines.length &&
        /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(lines[i + 1])) {
      closeLists();
      closeQuote();
      inTable = true;
      tableHeader = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const aligns = lines[i + 1].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      tableAligns = aligns.map((a) => {
        if (a.startsWith(":") && a.endsWith(":")) return "center" as const;
        if (a.endsWith(":")) return "right" as const;
        if (a.startsWith(":")) return "left" as const;
        return null;
      });
      tableRows = [];
      i += 2;
      while (i < lines.length && /^\s*\|.+\|\s*$/.test(lines[i])) {
        tableRows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
        i++;
      }
      flushTable();
      continue;
    }

    // Unordered list (with task list support)
    const ulMatch = line.match(/^(\s*)([-*+])\s+\[( |x|X)\]\s+(.*)$/);
    if (ulMatch) {
      closeQuote();
      flushTable();
      if (inOl) { html.push("</ol>"); inOl = false; }
      if (!inUl) { html.push("<ul>"); inUl = true; }
      const checked = ulMatch[3].toLowerCase() === "x";
      const text = ulMatch[4];
      if (opts.gfm !== false) {
        html.push(`<li class="task-list-item"><input type="checkbox" disabled${checked ? " checked" : ""} /> ${renderInline(text)}</li>`);
      } else {
        html.push(`<li>${checked ? "[x] " : "[ ] "}${renderInline(text)}</li>`);
      }
      i++;
      continue;
    }
    const ulPlain = line.match(/^(\s*)([-*+])\s+(.*)$/);
    if (ulPlain) {
      closeQuote();
      flushTable();
      if (inOl) { html.push("</ol>"); inOl = false; }
      if (!inUl) { html.push("<ul>"); inUl = true; }
      html.push(`<li>${renderInline(ulPlain[3])}</li>`);
      i++;
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (olMatch) {
      closeQuote();
      flushTable();
      if (inUl) { html.push("</ul>"); inUl = false; }
      if (!inOl) { html.push(`<ol start="${olMatch[2]}">`); inOl = true; }
      html.push(`<li>${renderInline(olMatch[3])}</li>`);
      i++;
      continue;
    }

    // Blank line
    if (/^\s*$/.test(line)) {
      closeAll();
      i++;
      continue;
    }

    // Paragraph
    closeLists();
    flushTable();
    const para: string[] = [line];
    i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) &&
           !/^#{1,6}\s/.test(lines[i]) &&
           !/^>\s?/.test(lines[i]) &&
           !/^(\s*)([-*+])\s/.test(lines[i]) &&
           !/^(\s*)(\d+)\.\s/.test(lines[i]) &&
           !/^(`{3,}|~{3,})/.test(lines[i]) &&
           !/^\s*\|.+\|\s*$/.test(lines[i]) &&
           !/^\s*([-*_])\s*\1\s*\1[\s\1]*$/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    // Hard line break: two trailing spaces or backslash-newline
    const paraText = para.join("\n")
      .replace(/  \n/g, "<br />")
      .replace(/\\\n/g, "<br />");
    // Render inline of each segment between <br/>
    const segments = paraText.split(/(<br \/>)/);
    const rendered = segments.map((seg) =>
      seg === "<br />" ? seg : renderInline(seg)
    ).join("");
    html.push(`<p>${rendered}</p>`);
    void line;
  }
  closeAll();
  return html.join("\n");
}

/** Slugify a heading into an HTML-safe id. */
export function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// History (localStorage)
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
// Shareable URL
// ---------------------------------------------------------------------------

export function buildShareUrl(query: string, category: MdCategory | ""): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (category) params.set("cat", category);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { query: string; category: MdCategory | "" } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { query: "", category: "" };
  const params = new URLSearchParams(clean);
  const query = params.get("q") ?? "";
  const catStr = params.get("cat") ?? "";
  const validCats = Object.keys(CATEGORY_LABELS) as MdCategory[];
  const category = catStr && validCats.includes(catStr as MdCategory)
    ? (catStr as MdCategory)
    : "";
  return { query, category };
}

// ---------------------------------------------------------------------------
// Counted exports (kept for tests / sanity checks)
// ---------------------------------------------------------------------------

export const ENTRY_COUNT = ENTRIES.length;
export const CATEGORY_COUNT = CATEGORY_ORDER.length;
export const FLAVOR_COUNT = FLAVOR_ORDER.length;

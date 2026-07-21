import { describe, it, expect, beforeEach } from "vitest";
import {
  ENTRIES,
  ENTRY_COUNT,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CATEGORY_COUNT,
  FLAVOR_LABELS,
  FLAVOR_ORDER,
  FLAVOR_COUNT,
  normalizeQuery,
  levenshtein,
  fuzzyContains,
  searchEntries,
  groupByCategory,
  flavorMatrix,
  findById,
  renderInline,
  renderMarkdown,
  slugify,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type MdCategory,
  type Flavor,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

describe("markdown-syntax-cheatsheet constants", () => {
  it("has 60+ entries", () => {
    expect(ENTRY_COUNT).toBeGreaterThanOrEqual(60);
    expect(ENTRIES.length).toBe(ENTRY_COUNT);
  });
  it("has 10 categories", () => {
    expect(CATEGORY_COUNT).toBe(10);
    expect(CATEGORY_ORDER).toHaveLength(10);
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(10);
  });
  it("has 5 flavors", () => {
    expect(FLAVOR_COUNT).toBe(5);
    expect(FLAVOR_ORDER).toEqual(["commonmark", "gfm", "gitlab", "pandoc", "obsidian"]);
    expect(Object.keys(FLAVOR_LABELS)).toHaveLength(5);
  });
  it("has unique ids", () => {
    const ids = ENTRIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("every entry has required fields", () => {
    for (const e of ENTRIES) {
      expect(typeof e.id).toBe("string");
      expect(e.id.length).toBeGreaterThan(0);
      expect(typeof e.name).toBe("string");
      expect(e.name.length).toBeGreaterThan(0);
      expect(CATEGORY_ORDER).toContain(e.category);
      expect(typeof e.source).toBe("string");
      expect(e.source.length).toBeGreaterThan(0);
      expect(e.flavors).toHaveProperty("commonmark");
      expect(e.flavors).toHaveProperty("gfm");
      expect(e.flavors).toHaveProperty("gitlab");
      expect(e.flavors).toHaveProperty("pandoc");
      expect(e.flavors).toHaveProperty("obsidian");
    }
  });
});

describe("markdown-syntax-cheatsheet normalizeQuery", () => {
  it("lowercases and trims", () => {
    expect(normalizeQuery("  Hello WORLD  ")).toBe("hello world");
  });
  it("collapses whitespace", () => {
    expect(normalizeQuery("a\tb\n\nc")).toBe("a b c");
  });
  it("handles empty", () => {
    expect(normalizeQuery("")).toBe("");
  });
});

describe("markdown-syntax-cheatsheet levenshtein", () => {
  it("computes edit distance", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("flaw", "lawn")).toBe(2);
  });
  it("returns 0 for identical strings", () => {
    expect(levenshtein("abc", "abc")).toBe(0);
  });
  it("returns length for empty target", () => {
    expect(levenshtein("abc", "")).toBe(3);
  });
});

describe("markdown-syntax-cheatsheet fuzzyContains", () => {
  it("matches subsequence", () => {
    expect(fuzzyContains("markdown cheatsheet", "mdshet")).toBe(true);
  });
  it("returns false for non-subsequence", () => {
    expect(fuzzyContains("markdown", "xyz")).toBe(false);
  });
  it("returns true for empty query", () => {
    expect(fuzzyContains("anything", "")).toBe(true);
  });
});

describe("markdown-syntax-cheatsheet searchEntries", () => {
  it("returns all entries for empty query", () => {
    expect(searchEntries("")).toHaveLength(ENTRIES.length);
  });
  it("matches by name", () => {
    const r = searchEntries("bold");
    expect(r.length).toBeGreaterThan(0);
    expect(r.some((e) => e.name.toLowerCase().includes("bold"))).toBe(true);
  });
  it("matches by tag", () => {
    const r = searchEntries("gfm");
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((e) =>
      (e.tags ?? []).some((t) => t.includes("gfm")) ||
      e.name.toLowerCase().includes("gfm") ||
      e.source.includes("gfm") ||
      (e.note ?? "").toLowerCase().includes("gfm")
    )).toBe(true);
  });
  it("filters by category", () => {
    const r = searchEntries("", "headings");
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((e) => e.category === "headings")).toBe(true);
  });
  it("returns empty for unmatched query", () => {
    expect(searchEntries("zzzznotreal")).toEqual([]);
  });
  it("ranks exact name match first", () => {
    const r = searchEntries("Bold");
    expect(r[0].name).toBe("Bold");
  });
});

describe("markdown-syntax-cheatsheet groupByCategory", () => {
  it("groups all entries", () => {
    const groups = groupByCategory(ENTRIES);
    const total = CATEGORY_ORDER.reduce((sum, c) => sum + groups[c].length, 0);
    expect(total).toBe(ENTRIES.length);
  });
  it("every entry is in its category bucket", () => {
    const groups = groupByCategory(ENTRIES);
    for (const e of ENTRIES) {
      expect(groups[e.category]).toContain(e);
    }
  });
});

describe("markdown-syntax-cheatsheet flavorMatrix", () => {
  it("returns 5 flavor cells", () => {
    const e = findById("bold")!;
    const m = flavorMatrix(e);
    expect(m).toHaveLength(5);
    expect(m.map((x) => x.flavor)).toEqual(FLAVOR_ORDER);
  });
  it("bold is supported everywhere", () => {
    const e = findById("bold")!;
    const m = flavorMatrix(e);
    expect(m.every((x) => x.supported)).toBe(true);
  });
  it("alerts are GFM-only", () => {
    const e = findById("gfm-alerts")!;
    const m = flavorMatrix(e);
    const gfm = m.find((x) => x.flavor === "gfm")!;
    const cm = m.find((x) => x.flavor === "commonmark")!;
    expect(gfm.supported).toBe(true);
    expect(cm.supported).toBe(false);
  });
});

describe("markdown-syntax-cheatsheet findById", () => {
  it("finds by id", () => {
    const e = findById("h1");
    expect(e).toBeDefined();
    expect(e?.name).toBe("Heading 1 (ATX)");
  });
  it("returns undefined for unknown id", () => {
    expect(findById("nope-not-real")).toBeUndefined();
  });
});

describe("markdown-syntax-cheatsheet renderInline", () => {
  it("renders bold", () => {
    expect(renderInline("**hi**")).toBe("<strong>hi</strong>");
  });
  it("renders italic", () => {
    expect(renderInline("*hi*")).toBe("<em>hi</em>");
  });
  it("renders inline code", () => {
    expect(renderInline("`code`")).toBe("<code>code</code>");
  });
  it("renders strikethrough", () => {
    expect(renderInline("~~del~~")).toBe("<del>del</del>");
  });
  it("renders links", () => {
    const out = renderInline("[ex](https://e.com)");
    expect(out).toContain('<a href="https://e.com">ex</a>');
  });
  it("escapes raw HTML", () => {
    const out = renderInline("<script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });
});

describe("markdown-syntax-cheatsheet renderMarkdown", () => {
  it("renders headings", () => {
    const out = renderMarkdown("# Hello");
    expect(out).toContain("<h1");
    expect(out).toContain("Hello");
  });
  it("renders h1-h6 levels", () => {
    const out = renderMarkdown("## H2");
    expect(out).toContain("<h2");
  });
  it("renders fenced code blocks", () => {
    const out = renderMarkdown("```js\nfoo()\n```");
    expect(out).toContain("<pre><code");
    expect(out).toContain("foo()");
  });
  it("renders unordered lists", () => {
    const out = renderMarkdown("- a\n- b");
    expect(out).toContain("<ul>");
    expect(out).toContain("<li>a</li>");
  });
  it("renders ordered lists with start", () => {
    const out = renderMarkdown("3. a\n4. b");
    expect(out).toContain('<ol start="3">');
  });
  it("renders task list items when gfm", () => {
    const out = renderMarkdown("- [x] done", { gfm: true });
    expect(out).toContain("task-list-item");
    expect(out).toContain("checkbox");
    expect(out).toContain("checked");
  });
  it("renders GFM alerts", () => {
    const out = renderMarkdown("> [!NOTE]\n> hi");
    expect(out).toContain("md-alert");
    expect(out).toContain("NOTE");
  });
  it("renders tables", () => {
    const out = renderMarkdown("| A | B |\n| - | - |\n| 1 | 2 |");
    expect(out).toContain("<table");
    expect(out).toContain("<th>A</th>");
    expect(out).toContain("<td>1</td>");
  });
  it("renders horizontal rules", () => {
    const out = renderMarkdown("---\n\n***");
    expect(out).toContain("<hr />");
  });
  it("renders blockquotes", () => {
    const out = renderMarkdown("> quoted");
    expect(out).toContain("<blockquote>");
    expect(out).toContain("quoted");
  });
  it("renders paragraphs", () => {
    const out = renderMarkdown("Hello world.");
    expect(out).toContain("<p>Hello world.</p>");
  });
  it("renders hard line break (trailing spaces)", () => {
    const out = renderMarkdown("line one.  \nline two.");
    expect(out).toContain("<br />");
  });
});

describe("markdown-syntax-cheatsheet slugify", () => {
  it("lowercases and dasherizes", () => {
    expect(slugify("Hello World!")).toBe("hello-world");
  });
  it("removes punctuation", () => {
    expect(slugify("Foo & Bar?!")).toBe("foo-bar");
  });
});

describe("markdown-syntax-cheatsheet history", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, query: "bold", category: "", entryId: "bold" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, query: `q${i}`, category: "", entryId: null });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, query: "x", category: "", entryId: null });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("markdown-syntax-cheatsheet shareable URL", () => {
  it("builds share URL without window", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("bold", "emphasis");
    expect(url).toContain("q=bold");
    expect(url).toContain("cat=emphasis");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("q=bold&cat=emphasis");
    expect(p.query).toBe("bold");
    expect(p.category).toBe("emphasis");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ query: "", category: "" });
  });
  it("filters unknown categories", () => {
    const p = parseShareUrl("q=bold&cat=unknown-cat");
    expect(p.category).toBe("");
  });
});

// Suppress unused-import lint
export type _Unused = MdCategory | Flavor;

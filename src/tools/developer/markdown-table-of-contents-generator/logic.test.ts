import { describe, it, expect, beforeEach } from "vitest";
import {
  PLATFORM_LABELS,
  DEFAULT_OPTIONS,
  MARKER_PATTERNS,
  stripEmoji,
  stripInlineMarkdown,
  slugify,
  parseHeadings,
  dedupeSlugs,
  parseAndDedupe,
  renderTocItem,
  renderToc,
  generateToc,
  findTocMarker,
  insertToc,
  removeToc,
  updateToc,
  computeStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Platform,
  type TocOptions,
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

function opts(overrides: Partial<TocOptions> = {}): TocOptions {
  return { ...DEFAULT_OPTIONS, ...overrides };
}

describe("toc-generator constants", () => {
  it("has 5 platform labels", () => {
    expect(Object.keys(PLATFORM_LABELS)).toHaveLength(5);
  });
  it("default options are sensible", () => {
    expect(DEFAULT_OPTIONS.platform).toBe("github");
    expect(DEFAULT_OPTIONS.minLevel).toBe(1);
    expect(DEFAULT_OPTIONS.maxLevel).toBe(6);
    expect(DEFAULT_OPTIONS.listStyle).toBe("bullet");
  });
  it("has 2 marker patterns", () => {
    expect(Object.keys(MARKER_PATTERNS)).toHaveLength(2);
    expect(MARKER_PATTERNS.bracket).toBeTruthy();
    expect(MARKER_PATTERNS.html).toBeTruthy();
  });
});

describe("toc-generator stripEmoji", () => {
  it("strips emoji from text", () => {
    expect(stripEmoji("Hello 🌍 World")).toBe("Hello  World");
  });
  it("leaves plain text alone", () => {
    expect(stripEmoji("Plain text")).toBe("Plain text");
  });
});

describe("toc-generator stripInlineMarkdown", () => {
  it("strips inline code backticks", () => {
    expect(stripInlineMarkdown("Hello `code` here")).toBe("Hello code here");
  });
  it("strips bold markers", () => {
    expect(stripInlineMarkdown("**bold** text")).toBe("bold text");
  });
  it("strips link syntax keeping text", () => {
    expect(stripInlineMarkdown("[link text](https://example.com)")).toBe("link text");
  });
  it("strips image syntax keeping alt", () => {
    expect(stripInlineMarkdown("![alt text](image.png)")).toBe("alt text");
  });
});

describe("toc-generator slugify (per-platform)", () => {
  it("github slug lowercases and dashes", () => {
    expect(slugify("Installation Guide", "github")).toBe("installation-guide");
  });
  it("github strips punctuation", () => {
    expect(slugify("API: Methods!", "github")).toBe("api-methods");
  });
  it("gitlab same as github for basic text", () => {
    expect(slugify("Hello World", "gitlab")).toBe("hello-world");
  });
  it("pandoc removes hyphens in original text", () => {
    expect(slugify("hello-world", "pandoc")).toBe("helloworld");
    expect(slugify("hello-world", "github")).toBe("hello-world");
  });
  it("bitbucket preserves underscores", () => {
    expect(slugify("hello_world", "bitbucket")).toBe("hello_world");
  });
  it("generic slug", () => {
    expect(slugify("Hello, World!", "generic")).toBe("hello-world");
  });
  it("handles emoji in heading (collapses double space to single dash)", () => {
    expect(slugify("Hello 🌍 World", "github")).toBe("hello-world");
  });
});

describe("toc-generator parseHeadings", () => {
  it("extracts ATX headings", () => {
    const md = "# Title\n## Section\n### Sub\n";
    const h = parseHeadings(md);
    expect(h).toHaveLength(3);
    expect(h[0].level).toBe(1);
    expect(h[0].text).toBe("Title");
    expect(h[1].level).toBe(2);
    expect(h[2].level).toBe(3);
  });
  it("extracts all six levels", () => {
    const md = "# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6\n";
    const h = parseHeadings(md);
    expect(h).toHaveLength(6);
    expect(h.map((x) => x.level)).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("skips headings inside ``` code fences", () => {
    const md = "# Real\n\n```bash\n# not a heading\n## also not\n```\n\n## Also real\n";
    const h = parseHeadings(md);
    expect(h).toHaveLength(2);
    expect(h[0].text).toBe("Real");
    expect(h[1].text).toBe("Also real");
  });
  it("skips headings inside ~~~ code fences", () => {
    const md = "# Real\n\n~~~python\n# not a heading\n~~~\n\n## Also real\n";
    const h = parseHeadings(md);
    expect(h).toHaveLength(2);
  });
  it("handles setext H1 with ===", () => {
    const md = "Title One\n=========\n\nSome content.\n";
    const h = parseHeadings(md);
    expect(h).toHaveLength(1);
    expect(h[0].level).toBe(1);
    expect(h[0].text).toBe("Title One");
  });
  it("handles setext H2 with ---", () => {
    const md = "Title Two\n---------\n";
    const h = parseHeadings(md);
    expect(h).toHaveLength(1);
    expect(h[0].level).toBe(2);
    expect(h[0].text).toBe("Title Two");
  });
  it("ignores closing # hashes after heading text", () => {
    const md = "## Heading ##\n";
    const h = parseHeadings(md);
    expect(h).toHaveLength(1);
    expect(h[0].text).toBe("Heading");
  });
  it("skips empty heading #", () => {
    const md = "#\n## Real\n";
    const h = parseHeadings(md);
    expect(h).toHaveLength(1);
    expect(h[0].text).toBe("Real");
  });
});

describe("toc-generator dedupeSlugs", () => {
  it("first occurrence has no suffix", () => {
    const raw = [{ level: 2 as const, text: "Examples", line: 0 }];
    const out = dedupeSlugs(raw, "github");
    expect(out[0].slug).toBe("examples");
    expect(out[0].dupIndex).toBe(0);
  });
  it("duplicate headings get -1, -2 suffixes", () => {
    const raw = [
      { level: 2 as const, text: "Examples", line: 0 },
      { level: 2 as const, text: "Examples", line: 5 },
      { level: 2 as const, text: "Examples", line: 10 },
    ];
    const out = dedupeSlugs(raw, "github");
    expect(out[0].slug).toBe("examples");
    expect(out[1].slug).toBe("examples-1");
    expect(out[2].slug).toBe("examples-2");
  });
  it("different headings don't interfere", () => {
    const raw = [
      { level: 2 as const, text: "Foo", line: 0 },
      { level: 2 as const, text: "Bar", line: 1 },
      { level: 2 as const, text: "Foo", line: 2 },
    ];
    const out = dedupeSlugs(raw, "github");
    expect(out[0].slug).toBe("foo");
    expect(out[1].slug).toBe("bar");
    expect(out[2].slug).toBe("foo-1");
  });
});

describe("toc-generator parseAndDedupe", () => {
  it("filters by min/max level", () => {
    const md = "# H1\n## H2\n### H3\n#### H4\n";
    const out = parseAndDedupe(md, opts({ minLevel: 2, maxLevel: 3 }));
    expect(out).toHaveLength(2);
    expect(out[0].level).toBe(2);
    expect(out[1].level).toBe(3);
  });
  it("skipFirst removes the first heading", () => {
    const md = "# H1\n## H2\n### H3\n";
    const out = parseAndDedupe(md, opts({ skipFirst: true }));
    expect(out).toHaveLength(2);
    expect(out[0].text).toBe("H2");
  });
  it("combines dedupe + filter", () => {
    const md = "# Title\n## Examples\n## Examples\n### Deep\n";
    const out = parseAndDedupe(md, opts({ minLevel: 2, maxLevel: 6 }));
    expect(out).toHaveLength(3);
    expect(out[0].slug).toBe("examples");
    expect(out[1].slug).toBe("examples-1");
    expect(out[2].slug).toBe("deep");
  });
});

describe("toc-generator renderTocItem / renderToc", () => {
  it("renders a bullet list item with anchor link (level 1, no indent)", () => {
    const h = { level: 1 as const, text: "Hello", slug: "hello", line: 0, dupIndex: 0 };
    const out = renderTocItem(h, opts());
    expect(out).toBe("- [Hello](#hello)");
  });
  it("renders an ordered list item (level 1, no indent)", () => {
    const h = { level: 1 as const, text: "Hello", slug: "hello", line: 0, dupIndex: 0 };
    const out = renderTocItem(h, opts({ listStyle: "ordered" }));
    expect(out).toBe("1. [Hello](#hello)");
  });
  it("indents level 2 with one unit (default minLevel 1)", () => {
    const h = { level: 2 as const, text: "Hello", slug: "hello", line: 0, dupIndex: 0 };
    const out = renderTocItem(h, opts());
    expect(out).toBe("  - [Hello](#hello)");
  });
  it("indents by level relative to minLevel", () => {
    const h = { level: 3 as const, text: "Sub", slug: "sub", line: 0, dupIndex: 0 };
    const out = renderTocItem(h, opts({ minLevel: 1 }));
    // level 3 - minLevel 1 = 2 indent units → 4 spaces
    expect(out).toBe("    - [Sub](#sub)");
  });
  it("emits <a name> anchor when option set", () => {
    const h = { level: 2 as const, text: "Hello", slug: "hello", line: 0, dupIndex: 0 };
    const out = renderTocItem(h, opts({ emitAnchors: true }));
    expect(out).toContain('<a name="hello"></a>');
  });
  it("renderToc joins items with newlines", () => {
    const headings = parseAndDedupe("# A\n## B\n", opts());
    const toc = renderToc(headings, opts());
    expect(toc).toContain("- [A](#a)");
    expect(toc).toContain("  - [B](#b)");
    expect(toc.split("\n")).toHaveLength(2);
  });
  it("renderToc returns empty for no headings", () => {
    expect(renderToc([], opts())).toBe("");
  });
});

describe("toc-generator generateToc", () => {
  it("end-to-end: markdown → toc", () => {
    const md = "# Project\n## Install\n## Usage\n### Advanced\n## License\n";
    const toc = generateToc(md, opts());
    expect(toc).toContain("- [Project](#project)");
    expect(toc).toContain("  - [Install](#install)");
    expect(toc).toContain("  - [Usage](#usage)");
    expect(toc).toContain("    - [Advanced](#advanced)");
    expect(toc).toContain("  - [License](#license)");
  });
  it("end-to-end with duplicates and code fence", () => {
    const md = "# Title\n\n```bash\n# not a heading\n```\n\n## Examples\n## Examples\n";
    const toc = generateToc(md, opts());
    expect(toc).toContain("[Title](#title)");
    expect(toc).toContain("[Examples](#examples)");
    expect(toc).toContain("[Examples](#examples-1)");
    expect(toc).not.toContain("not a heading");
  });
});

describe("toc-generator findTocMarker", () => {
  it("finds [TOC] marker", () => {
    const md = "Intro\n\n[TOC]\n\n## Section\n";
    const m = findTocMarker(md);
    expect(m).not.toBeNull();
    expect(m!.kind).toBe("bracket");
    expect(m!.line).toBe(2);
  });
  it("finds <!-- toc --> marker without close", () => {
    const md = "<!-- toc -->\n\n## Section\n";
    const m = findTocMarker(md);
    expect(m).not.toBeNull();
    expect(m!.kind).toBe("html");
    expect(m!.closeLine).toBeNull();
  });
  it("finds <!-- toc --> with <!-- tocstop -->", () => {
    const md = "<!-- toc -->\n- old\n<!-- tocstop -->\n\n## Section\n";
    const m = findTocMarker(md);
    expect(m).not.toBeNull();
    expect(m!.kind).toBe("html");
    expect(m!.closeLine).toBe(2);
  });
  it("returns null when no marker", () => {
    expect(findTocMarker("## Only a heading\n")).toBeNull();
  });
});

describe("toc-generator insertToc / updateToc / removeToc", () => {
  it("insertToc replaces [TOC] marker with rendered toc", () => {
    const md = "[TOC]\n\n## Install\n## Usage\n";
    const out = insertToc(md, opts());
    expect(out).toContain("[Install](#install)");
    expect(out).toContain("[Usage](#usage)");
    expect(out).not.toContain("[TOC]");
  });
  it("insertToc updates an existing html toc block", () => {
    const md = "<!-- toc -->\n- old item\n<!-- tocstop -->\n\n## New Section\n";
    const out = insertToc(md, opts());
    expect(out).toContain("[New Section](#new-section)");
    expect(out).not.toContain("old item");
    expect(out).toContain("<!-- toc -->");
    expect(out).toContain("<!-- tocstop -->");
  });
  it("insertToc prepends toc when no marker", () => {
    const md = "## Section\n";
    const out = insertToc(md, opts());
    expect(out).toContain("[Section](#section)");
    expect(out.indexOf("[Section](#section)")).toBeLessThan(out.lastIndexOf("## Section"));
  });
  it("updateToc is alias of insertToc", () => {
    const md = "[TOC]\n## A\n";
    expect(updateToc(md, opts())).toBe(insertToc(md, opts()));
  });
  it("removeToc removes [TOC] marker", () => {
    const md = "Intro\n[TOC]\n## A\n";
    const out = removeToc(md);
    expect(out).not.toContain("[TOC]");
    expect(out).toContain("Intro");
    expect(out).toContain("## A");
  });
  it("removeToc removes <!-- toc --> block", () => {
    const md = "<!-- toc -->\n- old\n<!-- tocstop -->\n## A\n";
    const out = removeToc(md);
    expect(out).not.toContain("<!-- toc -->");
    expect(out).not.toContain("old");
    expect(out).toContain("## A");
  });
  it("removeToc returns original when no marker", () => {
    const md = "## A\n";
    expect(removeToc(md)).toBe(md);
  });
  it("insertToc round-trips: insert then update keeps TOC current", () => {
    const md = "[TOC]\n## One\n";
    const inserted = insertToc(md, opts());
    const updated = insertToc(inserted + "\n## Two\n", opts());
    expect(updated).toContain("[One](#one)");
    expect(updated).toContain("[Two](#two)");
  });
});

describe("toc-generator computeStats", () => {
  it("counts headings by level", () => {
    const md = "# A\n## B\n## C\n### D\n";
    const stats = computeStats(md, opts());
    expect(stats.total).toBe(4);
    expect(stats.byLevel[1]).toBe(1);
    expect(stats.byLevel[2]).toBe(2);
    expect(stats.byLevel[3]).toBe(1);
    expect(stats.duplicates).toBe(0);
  });
  it("counts duplicates", () => {
    const md = "## A\n## A\n## A\n";
    const stats = computeStats(md, opts());
    expect(stats.total).toBe(3);
    expect(stats.duplicates).toBe(2);
  });
  it("respects depth filter", () => {
    const md = "# A\n## B\n### C\n";
    const stats = computeStats(md, opts({ minLevel: 2, maxLevel: 2 }));
    expect(stats.total).toBe(1);
    expect(stats.byLevel[2]).toBe(1);
  });
});

describe("toc-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, platform: "github", headingCount: 5, preview: "- [A](#a)" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, platform: "github", headingCount: 1, preview: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, platform: "github", headingCount: 1, preview: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("toc-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(opts({ platform: "gitlab", minLevel: 2, maxLevel: 4, listStyle: "ordered", skipFirst: true, emitAnchors: true }));
    expect(url).toContain("platform=gitlab");
    expect(url).toContain("min=2");
    expect(url).toContain("max=4");
    expect(url).toContain("list=ordered");
    expect(url).toContain("skipFirst=true");
    expect(url).toContain("anchors=true");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl(opts({ platform: "pandoc", minLevel: 2, maxLevel: 5, listStyle: "ordered", skipFirst: true, emitAnchors: true }));
    const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : url.replace(/^\?/, "");
    const p = parseShareUrl(hash);
    expect(p.platform).toBe("pandoc");
    expect(p.minLevel).toBe(2);
    expect(p.maxLevel).toBe(5);
    expect(p.listStyle).toBe("ordered");
    expect(p.skipFirst).toBe(true);
    expect(p.emitAnchors).toBe(true);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown platform", () => {
    const p = parseShareUrl("platform=bogus");
    expect(p.platform).toBeUndefined();
  });
  it("rejects invalid levels", () => {
    const p = parseShareUrl("min=9&max=0");
    expect(p.minLevel).toBeUndefined();
    expect(p.maxLevel).toBeUndefined();
  });
});

// Suppress unused-import lint
export type _Unused = Platform;

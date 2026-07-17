import { describe, it, expect, beforeEach } from "vitest";
import {
  stripHtml,
  extractHeadings,
  buildTree,
  countHeadings,
  countWordsPerHeading,
  detectIssues,
  renderMarkdownOutline,
  renderNumberedOutline,
  analyze,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  HEADING_LENGTH_MAX,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
});

describe("heading-structure-analyzer stripHtml", () => {
  it("returns empty for empty", () => {
    expect(stripHtml("")).toBe("");
  });
  it("strips inner tags", () => {
    expect(stripHtml("<b>Hello</b> <i>world</i>")).toBe("Hello world");
  });
  it("decodes common entities", () => {
    expect(stripHtml("Tom &amp; Jerry &lt;3")).toBe("Tom & Jerry <3");
  });
  it("decodes &nbsp;", () => {
    expect(stripHtml("a&nbsp;b")).toBe("a b");
  });
  it("collapses whitespace", () => {
    expect(stripHtml("a   b\n\nc")).toBe("a b c");
  });
});

describe("heading-structure-analyzer extractHeadings", () => {
  it("returns empty for empty html", () => {
    expect(extractHeadings("")).toEqual([]);
  });
  it("extracts H1-H6", () => {
    const html = "<h1>Title</h1><h2>Sub</h2><h3>Subsub</h3>";
    const out = extractHeadings(html);
    expect(out).toHaveLength(3);
    expect(out[0].level).toBe(1);
    expect(out[0].text).toBe("Title");
  });
  it("ignores non-heading tags", () => {
    expect(extractHeadings("<p>not a heading</p>")).toEqual([]);
  });
  it("strips inner HTML", () => {
    const out = extractHeadings("<h1>Hello <em>world</em></h1>");
    expect(out[0].text).toBe("Hello world");
  });
  it("assigns sequential positions", () => {
    const html = "<h1>A</h1><h2>B</h2><h3>C</h3>";
    const out = extractHeadings(html);
    expect(out[0].position).toBe(0);
    expect(out[1].position).toBe(1);
    expect(out[2].position).toBe(2);
  });
});

describe("heading-structure-analyzer buildTree", () => {
  it("returns empty for empty headings", () => {
    expect(buildTree([])).toEqual([]);
  });
  it("nests H2 under H1", () => {
    const headings = extractHeadings("<h1>A</h1><h2>B</h2><h2>C</h2>");
    const tree = buildTree(headings);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(2);
  });
  it("nests H3 under H2", () => {
    const headings = extractHeadings("<h1>A</h1><h2>B</h2><h3>C</h3>");
    const tree = buildTree(headings);
    expect(tree[0].children[0].children).toHaveLength(1);
  });
  it("returns roots when no nesting", () => {
    const headings = extractHeadings("<h2>A</h2><h2>B</h2>");
    const tree = buildTree(headings);
    expect(tree).toHaveLength(2);
  });
});

describe("heading-structure-analyzer countHeadings", () => {
  it("counts zero for empty", () => {
    const c = countHeadings([]);
    expect(c.total).toBe(0);
    expect(c.h1).toBe(0);
  });
  it("counts per level", () => {
    const c = countHeadings(extractHeadings("<h1>A</h1><h2>B</h2><h2>C</h2><h3>D</h3>"));
    expect(c.h1).toBe(1);
    expect(c.h2).toBe(2);
    expect(c.h3).toBe(1);
    expect(c.total).toBe(4);
  });
});

describe("heading-structure-analyzer countWordsPerHeading", () => {
  it("returns empty for empty", () => {
    expect(countWordsPerHeading([])).toEqual([]);
  });
  it("counts words", () => {
    const h = extractHeadings("<h1>Hello world</h1><h2>One</h2>");
    expect(countWordsPerHeading(h)).toEqual([2, 1]);
  });
});

describe("heading-structure-analyzer detectIssues", () => {
  it("flags multiple H1s", () => {
    const issues = detectIssues(extractHeadings("<h1>A</h1><h1>B</h1>"));
    expect(issues.some((i) => i.type === "multiple-h1")).toBe(true);
  });
  it("flags missing H1", () => {
    const issues = detectIssues(extractHeadings("<h2>A</h2>"));
    expect(issues.some((i) => i.type === "missing-h1")).toBe(true);
  });
  it("flags skipped levels", () => {
    const issues = detectIssues(extractHeadings("<h1>A</h1><h4>B</h4>"));
    expect(issues.some((i) => i.type === "skipped-level")).toBe(true);
  });
  it("flags long headings", () => {
    const longText = "x".repeat(HEADING_LENGTH_MAX + 10);
    const issues = detectIssues(extractHeadings(`<h1>${longText}</h1>`));
    expect(issues.some((i) => i.type === "long-heading")).toBe(true);
  });
  it("flags empty headings", () => {
    const issues = detectIssues(extractHeadings("<h1></h1>"));
    expect(issues.some((i) => i.type === "empty-heading")).toBe(true);
  });
  it("returns empty for clean structure", () => {
    const issues = detectIssues(extractHeadings("<h1>Title</h1><h2>Sub</h2><h3>Subsub</h3>"));
    expect(issues).toEqual([]);
  });
});

describe("heading-structure-analyzer renderMarkdownOutline", () => {
  it("renders tree as markdown", () => {
    const tree = buildTree(extractHeadings("<h1>Title</h1><h2>Sub</h2>"));
    const md = renderMarkdownOutline(tree);
    expect(md).toContain("# Title");
    expect(md).toContain("## Sub");
  });
  it("returns empty for empty tree", () => {
    expect(renderMarkdownOutline([])).toBe("");
  });
});

describe("heading-structure-analyzer renderNumberedOutline", () => {
  it("renders numbered outline", () => {
    const tree = buildTree(extractHeadings("<h1>Title</h1><h2>Sub</h2><h2>Sub2</h2>"));
    const out = renderNumberedOutline(tree);
    expect(out).toContain("1  # Title");
    expect(out).toContain("1.1  ## Sub");
    expect(out).toContain("1.2  ## Sub2");
  });
  it("returns empty for empty tree", () => {
    expect(renderNumberedOutline([])).toBe("");
  });
});

describe("heading-structure-analyzer analyze", () => {
  it("returns full analysis result", () => {
    const r = analyze("<h1>Title</h1><h2>Sub</h2><h3>Subsub</h3>");
    expect(r.headings).toHaveLength(3);
    expect(r.tree).toHaveLength(1);
    expect(r.counts.total).toBe(3);
    expect(r.issues).toEqual([]);
    expect(r.wordsPerHeading).toHaveLength(3);
  });
  it("handles empty input", () => {
    const r = analyze("");
    expect(r.headings).toEqual([]);
    expect(r.counts.total).toBe(0);
  });
});

describe("heading-structure-analyzer history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, totalHeadings: 5, issueCount: 1, snippet: "x" });
    saveHistory({ ts: 2, totalHeadings: 10, issueCount: 0, snippet: "y" });
    expect(loadHistory()).toHaveLength(2);
    expect(loadHistory()[0].totalHeadings).toBe(10);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, totalHeadings: 1, issueCount: 0, snippet: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, totalHeadings: 1, issueCount: 0, snippet: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("heading-structure-analyzer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("<h1>Test</h1>");
    expect(url).toContain("html=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to html", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("<h1>Test</h1>");
    const hash = url.replace(/^\?/, "#");
    const parsed = parseShareUrl(hash);
    expect(parsed.html).toBe("<h1>Test</h1>");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
});

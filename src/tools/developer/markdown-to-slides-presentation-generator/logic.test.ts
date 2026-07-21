import { describe, it, expect, beforeEach } from "vitest";
import {
  THEMES,
  TRANSITIONS,
  DEFAULT_OPTIONS,
  DEFAULT_MARKDOWN,
  splitMarkdown,
  extractTitle,
  extractNotes,
  stripNotes,
  extractDirectives,
  countFragments,
  countImages,
  countCodeBlocks,
  parseSlide,
  parseDeck,
  computeStats,
  markdownToHtml,
  renderSlideHtml,
  buildDeckHtml,
  getBaseCss,
  getThemeCss,
  buildOutline,
  autoFormat,
  loadHistory,
  saveHistory,
  clearHistory,
  encodeBase64,
  decodeBase64,
  buildShareUrl,
  parseShareUrl,
  type SplitMode,
  type ThemeName,
  type TransitionName,
  type DeckOptions,
  type HistoryEntry,
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

describe("slides constants", () => {
  it("has 8 themes", () => {
    expect(THEMES).toHaveLength(8);
    expect(THEMES.some((t) => t.value === "default")).toBe(true);
    expect(THEMES.some((t) => t.value === "black")).toBe(true);
    expect(THEMES.some((t) => t.value === "solarized")).toBe(true);
  });
  it("has 6 transitions", () => {
    expect(TRANSITIONS).toHaveLength(6);
    expect(TRANSITIONS.some((t) => t.value === "slide")).toBe(true);
    expect(TRANSITIONS.some((t) => t.value === "none")).toBe(true);
  });
  it("default options are sensible", () => {
    expect(DEFAULT_OPTIONS.splitMode).toBe("separator");
    expect(DEFAULT_OPTIONS.theme).toBe("default");
    expect(DEFAULT_OPTIONS.slideNumbers).toBe(true);
  });
  it("default markdown is non-empty", () => {
    expect(DEFAULT_MARKDOWN.length).toBeGreaterThan(100);
    expect(DEFAULT_MARKDOWN).toContain("---");
  });
});

describe("slides splitMarkdown (separator mode)", () => {
  it("splits on --- separator", () => {
    const md = "Slide 1\n\n---\n\nSlide 2\n\n---\n\nSlide 3";
    const chunks = splitMarkdown(md, "separator");
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toContain("Slide 1");
    expect(chunks[1]).toContain("Slide 2");
    expect(chunks[2]).toContain("Slide 3");
  });
  it("returns single chunk when no separator", () => {
    const chunks = splitMarkdown("Just one slide", "separator");
    expect(chunks).toHaveLength(1);
  });
  it("handles trailing separator", () => {
    const chunks = splitMarkdown("Slide 1\n\n---\n\n", "separator");
    expect(chunks).toHaveLength(1);
  });
  it("handles leading separator", () => {
    const chunks = splitMarkdown("---\n\nSlide 1", "separator");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain("Slide 1");
  });
  it("returns empty for empty input", () => {
    expect(splitMarkdown("", "separator")).toEqual([]);
  });
  it("accepts separators with extra dashes", () => {
    const chunks = splitMarkdown("A\n-----\nB", "separator");
    expect(chunks).toHaveLength(2);
  });
});

describe("slides splitMarkdown (heading mode)", () => {
  it("splits on ## headings", () => {
    const md = "Intro text\n\n## First\n\nContent 1\n\n## Second\n\nContent 2";
    const chunks = splitMarkdown(md, "heading");
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.some((c) => c.includes("First"))).toBe(true);
    expect(chunks.some((c) => c.includes("Second"))).toBe(true);
  });
  it("treats preamble before first ## as a slide", () => {
    const md = "Preamble\n\n## Heading\n\nBody";
    const chunks = splitMarkdown(md, "heading");
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toContain("Preamble");
    expect(chunks[1]).toContain("Heading");
  });
  it("returns empty for empty input", () => {
    expect(splitMarkdown("", "heading")).toEqual([]);
  });
});

describe("slides extractTitle", () => {
  it("extracts H1 title", () => {
    expect(extractTitle("# My Title\nBody")).toBe("My Title");
  });
  it("extracts H2 title when no H1", () => {
    expect(extractTitle("## Section Title\nBody")).toBe("Section Title");
  });
  it("falls back to first non-empty non-comment line", () => {
    expect(extractTitle("<!-- comment -->\nJust text here")).toBe("Just text here");
  });
  it("returns empty for empty input", () => {
    expect(extractTitle("")).toBe("");
  });
});

describe("slides extractNotes", () => {
  it("extracts a single note", () => {
    const md = "Slide content\n\n<!-- note: Remember to mention X -->";
    expect(extractNotes(md)).toBe("Remember to mention X");
  });
  it("extracts multiple notes joined by blank line", () => {
    const md = "<!-- note: First -->\n<!-- note: Second -->";
    expect(extractNotes(md)).toBe("First\n\nSecond");
  });
  it("is case-insensitive on note: keyword", () => {
    const md = "<!-- NOTE: Case insensitive -->";
    expect(extractNotes(md)).toBe("Case insensitive");
  });
  it("ignores non-note HTML comments", () => {
    const md = "<!-- regular comment -->\n<!-- note: only this one -->";
    expect(extractNotes(md)).toBe("only this one");
  });
  it("returns empty for no notes", () => {
    expect(extractNotes("No notes here")).toBe("");
  });
});

describe("slides stripNotes", () => {
  it("removes note comments", () => {
    const md = "Content\n<!-- note: secret -->\nMore";
    expect(stripNotes(md)).toBe("Content\n\nMore");
  });
  it("leaves regular comments", () => {
    const md = "Content\n<!-- regular comment -->\nMore";
    expect(stripNotes(md)).toContain("regular comment");
  });
});

describe("slides extractDirectives", () => {
  it("extracts _class directive", () => {
    const d = extractDirectives("<!-- _class: lead -->");
    expect(d.class).toBe("lead");
  });
  it("extracts _paginate directive", () => {
    const d = extractDirectives("<!-- _paginate: true -->");
    expect(d.paginate).toBe("true");
  });
  it("extracts _backgroundColor directive", () => {
    const d = extractDirectives("<!-- _backgroundColor: #ff0000 -->");
    expect(d.backgroundcolor).toBe("#ff0000");
  });
  it("extracts multiple directives", () => {
    const d = extractDirectives("<!-- _class: lead -->\n<!-- _paginate: true -->");
    expect(Object.keys(d)).toHaveLength(2);
  });
  it("returns empty for no directives", () => {
    expect(Object.keys(extractDirectives("no directives"))).toHaveLength(0);
  });
});

describe("slides countFragments", () => {
  it("counts fragment markers", () => {
    const md = "- A <!-- .element: class=\"fragment\" -->\n- B <!-- .element: class=\"fragment\" -->";
    expect(countFragments(md)).toBe(2);
  });
  it("returns 0 for no fragments", () => {
    expect(countFragments("- A\n- B")).toBe(0);
  });
  it("is case-insensitive", () => {
    const md = "- A <!-- .element: class=\"FRAGMENT\" -->";
    expect(countFragments(md)).toBe(1);
  });
});

describe("slides countImages", () => {
  it("counts markdown images", () => {
    const md = "![alt](a.png) and ![alt2](b.jpg)";
    expect(countImages(md)).toBe(2);
  });
  it("returns 0 for no images", () => {
    expect(countImages("just text")).toBe(0);
  });
});

describe("slides countCodeBlocks", () => {
  it("counts fenced code blocks", () => {
    const md = "```js\nconst x = 1;\n```\n\n```py\nx = 1\n```";
    expect(countCodeBlocks(md)).toBe(2);
  });
  it("returns 0 for no code blocks", () => {
    expect(countCodeBlocks("just text")).toBe(0);
  });
});

describe("slides parseSlide & parseDeck", () => {
  it("parseSlide extracts title, notes, directives", () => {
    const md = "## My Slide\n\nContent\n\n<!-- note: hello -->\n<!-- _class: lead -->";
    const slide = parseSlide(md, 1);
    expect(slide.index).toBe(1);
    expect(slide.title).toBe("My Slide");
    expect(slide.notes).toBe("hello");
    expect(slide.className).toBe("lead");
  });
  it("parseDeck parses multiple slides", () => {
    const md = "Slide 1\n\n---\n\n## Slide 2\n\nContent\n\n<!-- note: x -->";
    const deck = parseDeck(md, DEFAULT_OPTIONS);
    expect(deck).toHaveLength(2);
    expect(deck[0].index).toBe(1);
    expect(deck[1].index).toBe(2);
    expect(deck[1].notes).toBe("x");
  });
  it("parseDeck with heading mode", () => {
    const md = "Preamble\n\n## First\n\nBody 1\n\n## Second\n\nBody 2";
    const deck = parseDeck(md, { ...DEFAULT_OPTIONS, splitMode: "heading" });
    expect(deck.length).toBeGreaterThanOrEqual(2);
  });
});

describe("slides computeStats", () => {
  it("computes slide count and notes count", () => {
    const md = "Slide 1\n\n<!-- note: a -->\n\n---\n\nSlide 2\n\n<!-- note: b -->";
    const stats = computeStats(md, DEFAULT_OPTIONS);
    expect(stats.slideCount).toBe(2);
    expect(stats.notesCount).toBe(2);
  });
  it("counts images and code blocks across deck", () => {
    const md = "# Title\n\n![img](a.png)\n\n```\ncode\n```\n\n---\n\n## Slide 2\n\n![img2](b.png)";
    const stats = computeStats(md, DEFAULT_OPTIONS);
    expect(stats.imagesCount).toBe(2);
    expect(stats.codeBlocksCount).toBe(1);
  });
  it("returns zeros for empty input", () => {
    const stats = computeStats("", DEFAULT_OPTIONS);
    expect(stats.slideCount).toBe(0);
    expect(stats.totalChars).toBe(0);
  });
});

describe("slides markdownToHtml", () => {
  it("renders headings", () => {
    expect(markdownToHtml("# Title")).toContain("<h1>Title</h1>");
    expect(markdownToHtml("## Section")).toContain("<h2>Section</h2>");
  });
  it("renders paragraphs", () => {
    expect(markdownToHtml("Hello world")).toContain("<p>Hello world</p>");
  });
  it("renders bold and italic", () => {
    const html = markdownToHtml("**bold** and *italic*");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });
  it("renders inline code", () => {
    expect(markdownToHtml("Use `code` here")).toContain("<code>code</code>");
  });
  it("renders fenced code blocks", () => {
    const html = markdownToHtml("```js\nconst x = 1;\n```");
    expect(html).toContain("<pre><code");
    expect(html).toContain("language-js");
    expect(html).toContain("const x = 1;");
  });
  it("renders unordered lists", () => {
    const html = markdownToHtml("- One\n- Two\n- Three");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>One</li>");
    expect(html).toContain("<li>Two</li>");
    expect(html).toContain("<li>Three</li>");
  });
  it("renders ordered lists", () => {
    const html = markdownToHtml("1. First\n2. Second");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>First</li>");
  });
  it("renders links", () => {
    const html = markdownToHtml("[click](https://example.com)");
    expect(html).toContain('<a href="https://example.com"');
    expect(html).toContain(">click</a>");
  });
  it("renders images", () => {
    const html = markdownToHtml("![alt](img.png)");
    expect(html).toContain('<img src="img.png"');
    expect(html).toContain('alt="alt"');
  });
  it("renders blockquotes", () => {
    const html = markdownToHtml("> quoted text");
    expect(html).toContain("<blockquote>quoted text</blockquote>");
  });
  it("renders horizontal rules", () => {
    const html = markdownToHtml("before\n\n---\n\nafter");
    expect(html).toContain("<hr>");
  });
  it("escapes HTML-sensitive chars in code", () => {
    const html = markdownToHtml("```\n<div>foo</div>\n```");
    expect(html).toContain("&lt;div&gt;");
  });
});

describe("slides renderSlideHtml", () => {
  it("wraps content in <section>", () => {
    const slide = parseSlide("## Title\nContent", 1);
    const html = renderSlideHtml(slide);
    expect(html).toContain("<section");
    expect(html).toContain("<h2>Title</h2>");
  });
  it("includes data-background-color when directive set", () => {
    const slide = parseSlide("<!-- _backgroundColor: #ff0000 -->\nContent", 1);
    const html = renderSlideHtml(slide);
    expect(html).toContain('data-background-color="#ff0000"');
  });
  it("includes class when _class directive set", () => {
    const slide = parseSlide("<!-- _class: lead -->\nContent", 1);
    const html = renderSlideHtml(slide);
    expect(html).toContain('class="lead"');
  });
  it("strips note comments from rendered output", () => {
    const slide = parseSlide("Content\n<!-- note: secret -->", 1);
    const html = renderSlideHtml(slide);
    expect(html).not.toContain("secret");
  });
});

describe("slides buildDeckHtml", () => {
  it("produces a full HTML document", () => {
    const html = buildDeckHtml("# Title\n\nBody", DEFAULT_OPTIONS);
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
    expect(html).toContain("<title>");
  });
  it("includes all slides as <section>", () => {
    const md = "Slide 1\n\n---\n\n## Slide 2";
    const html = buildDeckHtml(md, DEFAULT_OPTIONS);
    const sectionCount = (html.match(/<section/g) || []).length;
    expect(sectionCount).toBe(2);
  });
  it("includes speaker notes asides", () => {
    const md = "Slide 1\n\n<!-- note: hello -->";
    const html = buildDeckHtml(md, DEFAULT_OPTIONS);
    expect(html).toContain('class="notes"');
    expect(html).toContain("hello");
  });
  it("includes navigation script", () => {
    const html = buildDeckHtml("Slide", DEFAULT_OPTIONS);
    expect(html).toContain("ArrowRight");
    expect(html).toContain("addEventListener");
  });
  it("uses selected theme", () => {
    const html = buildDeckHtml("Slide", { ...DEFAULT_OPTIONS, theme: "black" });
    expect(html).toContain("#111");
  });
  it("escapes HTML in title", () => {
    const html = buildDeckHtml("Slide", { ...DEFAULT_OPTIONS, title: "<script>x</script>" });
    expect(html).not.toContain("<title><script>x</script></title>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("slides getBaseCss & getThemeCss", () => {
  it("returns non-empty base CSS", () => {
    expect(getBaseCss().length).toBeGreaterThan(100);
    expect(getBaseCss()).toContain(".reveal");
  });
  it("returns per-theme CSS", () => {
    expect(getThemeCss("black")).toContain("#111");
    expect(getThemeCss("solarized")).toContain("#fdf6e3");
    expect(getThemeCss("night")).toContain("#0a0a0a");
  });
  it("falls back to default theme for unknown", () => {
    // @ts-expect-error testing unknown theme
    const css = getThemeCss("nonexistent");
    expect(css).toContain("#fff");
  });
});

describe("slides buildOutline", () => {
  it("builds outline with titles", () => {
    const md = "# Title\n\n---\n\n## Section A\n\n---\n\n## Section B";
    const outline = buildOutline(md, DEFAULT_OPTIONS);
    expect(outline).toHaveLength(3);
    expect(outline[0].title).toBe("Title");
    expect(outline[1].title).toBe("Section A");
  });
  it("marks slides with notes", () => {
    const md = "Slide 1\n\n<!-- note: x -->\n\n---\n\nSlide 2";
    const outline = buildOutline(md, DEFAULT_OPTIONS);
    expect(outline[0].hasNotes).toBe(true);
    expect(outline[1].hasNotes).toBe(false);
  });
});

describe("slides autoFormat", () => {
  it("trims trailing whitespace and collapses blank lines", () => {
    expect(autoFormat("a  \n\n\n\nb  ")).toBe("a\n\nb");
  });
  it("handles empty input", () => {
    expect(autoFormat("")).toBe("");
  });
});

describe("slides history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, slideCount: 3, theme: "black", preview: "Slide 1..." });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, slideCount: 1, theme: "default", preview: `entry ${i}` });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, slideCount: 1, theme: "default", preview: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("slides encodeBase64 / decodeBase64 round-trip", () => {
  it("round-trips ASCII text", () => {
    const enc = encodeBase64("Hello, world!");
    expect(decodeBase64(enc)).toBe("Hello, world!");
  });
  it("round-trips unicode", () => {
    const src = "# 你好 🚀 héllo";
    const enc = encodeBase64(src);
    expect(decodeBase64(enc)).toBe(src);
  });
  it("handles empty input", () => {
    expect(encodeBase64("")).toBe("");
    expect(decodeBase64("")).toBe("");
  });
});

describe("slides shareable URL", () => {
  it("builds share URL with all options", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("# My Deck", {
      ...DEFAULT_OPTIONS,
      theme: "black",
      transition: "fade",
    });
    expect(url).toContain("theme=black");
    expect(url).toContain("transition=fade");
    expect(url).toContain("split=separator");
    expect(url).toContain("md=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to markdown and options", () => {
    const md = "# Title\n\n---\n\n## Section";
    const opts: DeckOptions = {
      ...DEFAULT_OPTIONS,
      theme: "solarized",
      transition: "zoom",
      title: "My Talk",
    };
    const url = buildShareUrl(md, opts);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : `#${url.split("?")[1] ?? ""}`;
    const parsed = parseShareUrl(hash);
    expect(parsed.md).toBe(md);
    expect(parsed.options.theme).toBe("solarized");
    expect(parsed.options.transition).toBe("zoom");
    expect(parsed.options.title).toBe("My Talk");
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.md).toBe("");
    expect(p.options.theme).toBe("default");
  });
  it("uses defaults for missing params", () => {
    const p = parseShareUrl("md=abc");
    expect(p.options.theme).toBe("default");
    expect(p.options.splitMode).toBe("separator");
  });
});

// Suppress unused-import lint
export type _Unused = SplitMode | ThemeName | TransitionName | HistoryEntry;

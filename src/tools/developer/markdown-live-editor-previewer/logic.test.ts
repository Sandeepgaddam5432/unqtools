import { describe, it, expect, beforeEach } from "vitest";
import {
  SAMPLE_DOC,
  escapeHtml,
  stripFrontMatter,
  normalizeLanguage,
  isKnownLanguage,
  highlightCode,
  renderInline,
  isHrLine,
  headingLevel,
  fenceDelimiter,
  extractCodeBlocks,
  parseMarkdown,
  computeStats,
  validateMarkdown,
  buildHtmlDocument,
  exportHtml,
  loadHistory,
  saveHistory,
  clearHistory,
  loadAutosave,
  saveAutosave,
  clearAutosave,
  buildShareUrl,
  parseShareUrl,
  loadInitialContent,
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
  (globalThis as Record<string, unknown>).window = undefined;
});

describe("markdown-live-editor constants", () => {
  it("sample doc is non-empty and contains a code fence", () => {
    expect(SAMPLE_DOC.length).toBeGreaterThan(100);
    expect(SAMPLE_DOC).toContain("```");
  });
});

describe("markdown-live-editor escapeHtml", () => {
  it("escapes the five HTML metacharacters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });
  it("handles nullish input", () => {
    expect(escapeHtml(undefined as unknown as string)).toBe("");
  });
});

describe("markdown-live-editor stripFrontMatter", () => {
  it("returns body unchanged when no front matter", () => {
    const r = stripFrontMatter("# Hello\n");
    expect(r.body).toBe("# Hello\n");
    expect(r.frontMatter).toBeNull();
  });
  it("strips a leading front-matter block", () => {
    const r = stripFrontMatter("---\ntitle: Hi\n---\n# Body");
    expect(r.frontMatter).toBe("title: Hi");
    expect(r.body).toBe("# Body");
  });
  it("does not strip mid-document ---", () => {
    const r = stripFrontMatter("# Hi\n\n---\n");
    expect(r.frontMatter).toBeNull();
    expect(r.body).toBe("# Hi\n\n---\n");
  });
});

describe("markdown-live-editor normalizeLanguage", () => {
  it("maps js -> javascript", () => {
    expect(normalizeLanguage("js")).toBe("javascript");
    expect(normalizeLanguage("JS")).toBe("javascript");
  });
  it("maps ts/tsx -> typescript", () => {
    expect(normalizeLanguage("ts")).toBe("typescript");
    expect(normalizeLanguage("tsx")).toBe("typescript");
  });
  it("maps sh/shell/zsh -> bash", () => {
    expect(normalizeLanguage("sh")).toBe("bash");
    expect(normalizeLanguage("shell")).toBe("bash");
    expect(normalizeLanguage("zsh")).toBe("bash");
  });
  it("passes through unknown langs lowercased", () => {
    expect(normalizeLanguage("Kotlin")).toBe("kotlin");
  });
  it("isKnownLanguage accepts common langs", () => {
    expect(isKnownLanguage("js")).toBe(true);
    expect(isKnownLanguage("python")).toBe(true);
    expect(isKnownLanguage("kotlin")).toBe(false);
  });
});

describe("markdown-live-editor highlightCode", () => {
  it("wraps JS keywords in spans", () => {
    const html = highlightCode("const x = 1;", "javascript");
    expect(html).toContain('<span class="tok-keyword">const</span>');
    expect(html).toContain('<span class="tok-number">1</span>');
  });
  it("escapes HTML metacharacters in plain text", () => {
    const html = highlightCode("a < b && c > d", "");
    expect(html).toContain("&lt;");
    expect(html).toContain("&gt;");
    expect(html).toContain("&amp;");
  });
  it("highlights Python comments and strings", () => {
    const html = highlightCode('# hi\nx = "hello"', "python");
    expect(html).toContain('<span class="tok-comment"># hi</span>');
    expect(html).toContain('<span class="tok-string">&quot;hello&quot;</span>');
  });
  it("highlights JSON booleans and nulls", () => {
    const html = highlightCode('{"a": true, "b": null}', "json");
    expect(html).toContain('<span class="tok-keyword">true</span>');
    expect(html).toContain('<span class="tok-keyword">null</span>');
  });
  it("falls back to generic tokens for unknown langs", () => {
    const html = highlightCode('// hello\n"hi"', "kotlin");
    expect(html).toContain('<span class="tok-comment">');
    expect(html).toContain('<span class="tok-string">');
  });
});

describe("markdown-live-editor renderInline", () => {
  it("renders bold and italic", () => {
    expect(renderInline("**bold**")).toBe("<strong>bold</strong>");
    expect(renderInline("_it_")).toBe("<em>it</em>");
  });
  it("renders inline code", () => {
    expect(renderInline("use `x` now")).toBe("use <code>x</code> now");
  });
  it("renders links and images distinctly", () => {
    expect(renderInline("[t](https://x.io)")).toBe('<a href="https://x.io">t</a>');
    expect(renderInline("![a](https://x.io/y.png)")).toBe('<img src="https://x.io/y.png" alt="a" />');
  });
  it("escapes raw HTML in source text", () => {
    expect(renderInline("<script>x</script>")).toBe("&lt;script&gt;x&lt;/script&gt;");
  });
  it("supports GFM strikethrough", () => {
    expect(renderInline("~~done~~")).toBe("<del>done</del>");
  });
});

describe("markdown-live-editor block detection helpers", () => {
  it("isHrLine recognises ---, ***, ___", () => {
    expect(isHrLine("---")).toBe(true);
    expect(isHrLine("***")).toBe(true);
    expect(isHrLine("___")).toBe(true);
    expect(isHrLine("--")).toBe(false);
    expect(isHrLine("text")).toBe(false);
  });
  it("headingLevel returns 1–6 or 0", () => {
    expect(headingLevel("# H1")).toBe(1);
    expect(headingLevel("###### H6")).toBe(6);
    expect(headingLevel("####### too many")).toBe(0);
    expect(headingLevel("plain")).toBe(0);
  });
  it("fenceDelimiter returns the fence char or empty", () => {
    expect(fenceDelimiter("```js")).toBe("`");
    expect(fenceDelimiter("~~~")).toBe("~");
    expect(fenceDelimiter("not a fence")).toBe("");
  });
});

describe("markdown-live-editor parseMarkdown (blocks)", () => {
  it("renders an ATX heading", () => {
    expect(parseMarkdown("# Hello")).toBe("<h1>Hello</h1>");
  });
  it("renders a paragraph", () => {
    expect(parseMarkdown("Just a paragraph.")).toBe("<p>Just a paragraph.</p>");
  });
  it("renders an unordered list", () => {
    const html = parseMarkdown("- one\n- two\n- three");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<li>three</li>");
  });
  it("renders an ordered list", () => {
    const html = parseMarkdown("1. first\n2. second");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>first</li>");
  });
  it("renders a horizontal rule", () => {
    expect(parseMarkdown("---")).toBe("<hr />");
  });
  it("renders a blockquote", () => {
    const html = parseMarkdown("> hello\n> world");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<p>hello<br />world</p>");
  });
  it("renders a fenced code block with language class", () => {
    const html = parseMarkdown("```js\nconst x = 1;\n```");
    expect(html).toContain("<pre>");
    expect(html).toContain('class="language-js"');
    expect(html).toContain('<span class="tok-keyword">const</span>');
  });
  it("renders a GFM table with alignment", () => {
    const md = "| Name | Age |\n| :--- | ---: |\n| Ada | 36 |";
    const html = parseMarkdown(md);
    expect(html).toContain("<table>");
    expect(html).toContain("text-align:left");
    expect(html).toContain("text-align:right");
    expect(html).toContain('<th style="text-align:left">Name</th>');
    expect(html).toContain('<td style="text-align:right">36</td>');
  });
  it("renders a link inside a paragraph", () => {
    expect(parseMarkdown("see [docs](https://x.io)")).toBe('<p>see <a href="https://x.io">docs</a></p>');
  });
  it("renders an image inside a paragraph", () => {
    expect(parseMarkdown("![logo](https://x.io/l.png)")).toBe('<p><img src="https://x.io/l.png" alt="logo" /></p>');
  });
  it("renders a heading with trailing hashes stripped", () => {
    expect(parseMarkdown("## Title ##")).toBe("<h2>Title</h2>");
  });
  it("strips front matter before rendering", () => {
    const md = "---\ntitle: t\n---\n# Body";
    expect(parseMarkdown(md)).toBe("<h1>Body</h1>");
  });
  it("returns empty string for empty input", () => {
    expect(parseMarkdown("")).toBe("");
  });
});

describe("markdown-live-editor extractCodeBlocks", () => {
  it("extracts language and code from a fenced block", () => {
    const blocks = extractCodeBlocks("```python\nprint('hi')\n```");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe("python");
    expect(blocks[0].code).toBe("print('hi')");
    expect(blocks[0].startLine).toBe(1);
  });
  it("extracts multiple blocks", () => {
    const blocks = extractCodeBlocks("```\nx\n```\n\ntext\n\n```js\ny\n```");
    expect(blocks).toHaveLength(2);
    expect(blocks[1].language).toBe("js");
    expect(blocks[1].code).toBe("y");
  });
});

describe("markdown-live-editor computeStats", () => {
  it("counts characters and words", () => {
    const s = computeStats("hello world\n\nfoo");
    expect(s.chars).toBe(16);
    expect(s.words).toBe(3);
    expect(s.lines).toBe(3);
    expect(s.paragraphs).toBe(2);
    expect(s.readingTimeMin).toBeGreaterThanOrEqual(1);
  });
  it("counts code blocks and tables", () => {
    const md = "```js\nconst x = 1;\n```\n\n| a | b |\n| - | - |\n| 1 | 2 |";
    const s = computeStats(md);
    expect(s.codeBlocks).toBe(1);
    expect(s.tables).toBe(1);
  });
  it("handles empty input", () => {
    const s = computeStats("");
    expect(s.chars).toBe(0);
    expect(s.words).toBe(0);
    expect(s.lines).toBe(0);
  });
});

describe("markdown-live-editor validateMarkdown", () => {
  it("flags an unclosed fence as error", () => {
    const v = validateMarkdown("```js\nconst x = 1;\n");
    expect(v.errors).toBe(1);
    expect(v.issues[0].severity).toBe("error");
    expect(v.issues[0].message).toContain("Unclosed");
  });
  it("passes a clean document", () => {
    const v = validateMarkdown("# Hi\n\n- one\n- two\n");
    expect(v.errors).toBe(0);
  });
});

describe("markdown-live-editor buildHtmlDocument / exportHtml", () => {
  it("wraps body in a standalone HTML document", () => {
    const out = buildHtmlDocument("<p>hi</p>", { fullDocument: true, title: "Doc" });
    expect(out).toContain("<!DOCTYPE html>");
    expect(out).toContain("<title>Doc</title>");
    expect(out).toContain("<p>hi</p>");
  });
  it("returns body unchanged when fullDocument is false", () => {
    expect(buildHtmlDocument("<p>x</p>", { fullDocument: false })).toBe("<p>x</p>");
  });
  it("exportHtml parses and wraps", () => {
    const out = exportHtml("# Hi", { title: "Test" });
    expect(out).toContain("<!DOCTYPE html>");
    expect(out).toContain("<h1>Hi</h1>");
  });
  it("supports dark theme", () => {
    const out = exportHtml("# Hi", { dark: true });
    expect(out).toContain("background: #0d1117");
  });
});

describe("markdown-live-editor history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, chars: 10, words: 2, preview: "..." });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, chars: i, words: i, preview: `p${i}` });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, chars: 1, words: 1, preview: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("markdown-live-editor autosave (localStorage)", () => {
  it("saves and loads", () => {
    saveAutosave("# hello");
    expect(loadAutosave()).toBe("# hello");
  });
  it("clears", () => {
    saveAutosave("# hi");
    clearAutosave();
    expect(loadAutosave()).toBeNull();
  });
});

describe("markdown-live-editor shareable URL", () => {
  it("encodes content into the hash when window is undefined", () => {
    const r = buildShareUrl("# Hi\n");
    expect(r.tooLarge).toBe(false);
    expect(r.url).toContain("#md=");
    expect(r.url).toContain(encodeURIComponent("# Hi\n"));
  });
  it("parses content back from the hash", () => {
    const r = buildShareUrl("# Hi\n");
    const p = parseShareUrl(r.url.startsWith("#") ? r.url : r.url.slice(r.url.indexOf("#")));
    expect(p.text).toBe("# Hi\n");
  });
  it("returns null for an empty or non-md hash", () => {
    expect(parseShareUrl("")).toEqual({ text: null });
    expect(parseShareUrl("#foo=bar")).toEqual({ text: null });
  });
  it("flags too-large content", () => {
    const big = "x".repeat(6000);
    const r = buildShareUrl(big);
    expect(r.tooLarge).toBe(true);
    expect(r.url).toBe("");
  });
});

describe("markdown-live-editor loadInitialContent", () => {
  it("returns none when nothing is stored", () => {
    expect(loadInitialContent().source).toBe("none");
  });
  it("returns autosave content when no hash", () => {
    saveAutosave("# autosaved");
    const r = loadInitialContent();
    expect(r.source).toBe("autosave");
    expect(r.text).toBe("# autosaved");
  });
  it("prefers a share hash over autosave", () => {
    saveAutosave("# autosaved");
    (globalThis as Record<string, unknown>).window = {
      location: { hash: "#md=" + encodeURIComponent("# shared"), origin: "", pathname: "" },
    };
    const r = loadInitialContent();
    expect(r.source).toBe("hash");
    expect(r.text).toBe("# shared");
  });
});

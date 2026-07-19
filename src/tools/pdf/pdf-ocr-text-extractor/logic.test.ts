import { describe, it, expect, beforeEach } from "vitest";
import {
  OUTPUT_FORMATS,
  FORMAT_LABELS,
  FORMAT_EXTENSIONS,
  FORMAT_MIME,
  DEFAULT_OPTIONS,
  normalizePageRangeSpec,
  resolveAllRange,
  generatePageSeparator,
  formatPageHeader,
  preserveLineBreaks,
  collapseLineBreaks,
  normalizeText,
  isEmptyPage,
  filterEmptyPages,
  computeTextStats,
  scoreTextQuality,
  computeSummaryStats,
  renderPlainText,
  renderJson,
  escapeCsvField,
  renderCsvPerPage,
  renderMarkdown,
  renderOutput,
  getOutputFilename,
  searchText,
  analyzeKeywords,
  estimateReadingTime,
  detectLanguage,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type ExtractedPage,
  type OutputFormat,
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

function page(n: number, text: string): ExtractedPage {
  return { pageNumber: n, text, empty: !text.trim() };
}

describe("pdf-ocr constants", () => {
  it("has 4 output formats", () => {
    expect(OUTPUT_FORMATS).toHaveLength(4);
    expect(OUTPUT_FORMATS).toContain("plain-text");
    expect(OUTPUT_FORMATS).toContain("json");
    expect(OUTPUT_FORMATS).toContain("csv-per-page");
    expect(OUTPUT_FORMATS).toContain("markdown");
  });
  it("format labels cover every format", () => {
    for (const f of OUTPUT_FORMATS) expect(typeof FORMAT_LABELS[f]).toBe("string");
  });
  it("format extensions cover every format", () => {
    expect(FORMAT_EXTENSIONS["plain-text"]).toBe("txt");
    expect(FORMAT_EXTENSIONS["json"]).toBe("json");
    expect(FORMAT_EXTENSIONS["csv-per-page"]).toBe("csv");
    expect(FORMAT_EXTENSIONS["markdown"]).toBe("md");
  });
  it("format mime types cover every format", () => {
    for (const f of OUTPUT_FORMATS) expect(FORMAT_MIME[f]).toMatch(/^[a-z]+\/[a-z-]+$/);
  });
  it("has sensible default options", () => {
    expect(DEFAULT_OPTIONS.outputFormat).toBe("plain-text");
    expect(DEFAULT_OPTIONS.includePageNumbers).toBe(true);
    expect(DEFAULT_OPTIONS.preserveLineBreaks).toBe(true);
    expect(DEFAULT_OPTIONS.pageRange).toBe("all");
  });
});

describe("pdf-ocr normalizePageRangeSpec", () => {
  it("returns 'all' for empty", () => {
    expect(normalizePageRangeSpec("")).toBe("all");
    expect(normalizePageRangeSpec("   ")).toBe("all");
  });
  it("passes 'all' through", () => {
    expect(normalizePageRangeSpec("all")).toBe("all");
    expect(normalizePageRangeSpec("ALL")).toBe("all");
  });
  it("lowercases and collapses whitespace", () => {
    expect(normalizePageRangeSpec("  1-3,  5 , 8-10 ")).toBe("1-3, 5 , 8-10");
  });
});

describe("pdf-ocr resolveAllRange", () => {
  it("resolves 'all' to 1-N", () => {
    expect(resolveAllRange("all", 5)).toBe("1-5");
  });
  it("leaves explicit range unchanged", () => {
    expect(resolveAllRange("1-3, 5", 5)).toBe("1-3, 5");
  });
  it("handles zero-page edge case", () => {
    expect(resolveAllRange("all", 0)).toBe("1");
  });
});

describe("pdf-ocr page header / separator", () => {
  it("generatePageSeparator includes page number", () => {
    expect(generatePageSeparator(3, 10)).toContain("Page 3");
    expect(generatePageSeparator(3, 10)).toContain("of 10");
  });
  it("formatPageHeader formats correctly", () => {
    expect(formatPageHeader(2, 5)).toBe("Page 2 / 5");
    expect(formatPageHeader(2, 0)).toBe("Page 2");
  });
});

describe("pdf-ocr line-break handling", () => {
  it("preserveLineBreaks returns input unchanged", () => {
    expect(preserveLineBreaks("a\nb")).toBe("a\nb");
  });
  it("collapseLineBreaks collapses whitespace", () => {
    expect(collapseLineBreaks("a\n\n  b\t c")).toBe("a b c");
  });
  it("normalizeText toggles behavior", () => {
    expect(normalizeText("a\nb", true)).toBe("a\nb");
    expect(normalizeText("a\nb", false)).toBe("a b");
  });
});

describe("pdf-ocr empty-page detection", () => {
  it("isEmptyPage detects whitespace-only", () => {
    expect(isEmptyPage("")).toBe(true);
    expect(isEmptyPage("   \n\t ")).toBe(true);
    expect(isEmptyPage("hello")).toBe(false);
  });
  it("filterEmptyPages removes empty pages", () => {
    const pages = [page(1, "hello"), page(2, ""), page(3, "   "), page(4, "world")];
    expect(filterEmptyPages(pages)).toHaveLength(2);
    expect(filterEmptyPages(pages)[0].pageNumber).toBe(1);
    expect(filterEmptyPages(pages)[1].pageNumber).toBe(4);
  });
});

describe("pdf-ocr computeTextStats", () => {
  it("counts chars and words", () => {
    const s = computeTextStats("Hello world!\nFoo bar");
    expect(s.chars).toBe(20);
    expect(s.words).toBe(4);
    expect(s.lines).toBe(2);
  });
  it("counts chars without spaces", () => {
    const s = computeTextStats("a b c");
    expect(s.charsNoSpaces).toBe(3);
  });
  it("counts paragraphs separated by blank lines", () => {
    const s = computeTextStats("Para 1.\n\nPara 2.\n\nPara 3.");
    expect(s.paragraphs).toBe(3);
  });
  it("handles empty text", () => {
    const s = computeTextStats("");
    expect(s.chars).toBe(0);
    expect(s.words).toBe(0);
    expect(s.lines).toBe(0);
    expect(s.paragraphs).toBe(0);
  });
});

describe("pdf-ocr scoreTextQuality", () => {
  it("returns 0 for zero pages", () => {
    expect(scoreTextQuality(0, 0)).toBe(0);
  });
  it("returns 100 when all pages have text", () => {
    expect(scoreTextQuality(5, 5)).toBe(100);
  });
  it("returns 50 when half have text", () => {
    expect(scoreTextQuality(2, 4)).toBe(50);
  });
  it("clamps above 100", () => {
    expect(scoreTextQuality(10, 4)).toBe(100);
  });
});

describe("pdf-ocr computeSummaryStats", () => {
  it("aggregates across pages", () => {
    const pages = [page(1, "Hello world"), page(2, ""), page(3, "Foo bar baz")];
    const s = computeSummaryStats(pages);
    expect(s.totalPages).toBe(3);
    expect(s.extractedPages).toBe(2);
    expect(s.emptyPages).toBe(1);
    expect(s.totalChars).toBe(11 + 0 + 11);
    expect(s.totalWords).toBe(2 + 0 + 3);
    expect(s.avgCharsPerPage).toBe(Math.round((11 + 0 + 11) / 3));
    expect(s.qualityScore).toBe(67);
  });
  it("handles empty input", () => {
    const s = computeSummaryStats([]);
    expect(s.totalPages).toBe(0);
    expect(s.qualityScore).toBe(0);
  });
});

describe("pdf-ocr renderPlainText", () => {
  const opts = { pageRange: "all", outputFormat: "plain-text" as OutputFormat, includePageNumbers: true, preserveLineBreaks: true };
  it("renders page separators and body", () => {
    const text = renderPlainText([page(1, "Hello"), page(2, "World")], opts);
    expect(text).toContain("Page 1");
    expect(text).toContain("Page 2");
    expect(text).toContain("Hello");
    expect(text).toContain("World");
  });
  it("notes empty pages", () => {
    const text = renderPlainText([page(1, "")], opts);
    expect(text).toContain("No embedded text");
    expect(text).toContain("Tesseract");
  });
  it("omits page numbers when disabled", () => {
    const text = renderPlainText([page(1, "Hello")], { ...opts, includePageNumbers: false });
    expect(text).not.toContain("Page 1");
    expect(text).toContain("Hello");
  });
  it("collapses line breaks when disabled", () => {
    const text = renderPlainText([page(1, "a\nb")], { ...opts, preserveLineBreaks: false });
    expect(text).toContain("a b");
  });
});

describe("pdf-ocr renderJson", () => {
  const opts = { pageRange: "all", outputFormat: "json" as OutputFormat, includePageNumbers: true, preserveLineBreaks: true };
  it("produces valid JSON with pages array", () => {
    const json = renderJson([page(1, "Hello"), page(2, "")], opts);
    const parsed = JSON.parse(json);
    expect(parsed.totalPages).toBe(2);
    expect(parsed.pages).toHaveLength(2);
    expect(parsed.pages[0].text).toBe("Hello");
    expect(parsed.pages[0].charCount).toBe(5);
    expect(parsed.pages[1].empty).toBe(true);
  });
});

describe("pdf-ocr escapeCsvField", () => {
  it("does not quote plain text", () => {
    expect(escapeCsvField("hello")).toBe("hello");
  });
  it("quotes commas", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
  });
  it("quotes and escapes double quotes", () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });
  it("quotes newlines", () => {
    expect(escapeCsvField("a\nb")).toBe('"a\nb"');
  });
});

describe("pdf-ocr renderCsvPerPage", () => {
  const opts = { pageRange: "all", outputFormat: "csv-per-page" as OutputFormat, includePageNumbers: true, preserveLineBreaks: true };
  it("has header row", () => {
    const csv = renderCsvPerPage([], opts);
    expect(csv.split("\n")[0]).toBe("page,char_count,word_count,is_empty,text");
  });
  it("renders one row per page", () => {
    const csv = renderCsvPerPage([page(1, "Hello"), page(2, "Foo,bar")], opts);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("1,5,1,false");
    expect(lines[2]).toContain('"Foo,bar"');
  });
});

describe("pdf-ocr renderMarkdown", () => {
  const opts = { pageRange: "all", outputFormat: "markdown" as OutputFormat, includePageNumbers: true, preserveLineBreaks: true };
  it("renders H2 headings and code blocks", () => {
    const md = renderMarkdown([page(1, "Hello")], opts);
    expect(md).toContain("## Page 1 / 1");
    expect(md).toContain("```");
    expect(md).toContain("Hello");
  });
  it("uses blockquote for empty pages", () => {
    const md = renderMarkdown([page(1, "")], opts);
    expect(md).toContain("> _No embedded text");
  });
});

describe("pdf-ocr renderOutput dispatch", () => {
  it("dispatches to plain-text", () => {
    const opts = { pageRange: "all", outputFormat: "plain-text" as OutputFormat, includePageNumbers: false, preserveLineBreaks: true };
    expect(renderOutput([page(1, "x")], opts)).toContain("x");
  });
  it("dispatches to json", () => {
    const opts = { pageRange: "all", outputFormat: "json" as OutputFormat, includePageNumbers: false, preserveLineBreaks: true };
    expect(() => JSON.parse(renderOutput([page(1, "x")], opts))).not.toThrow();
  });
  it("dispatches to csv", () => {
    const opts = { pageRange: "all", outputFormat: "csv-per-page" as OutputFormat, includePageNumbers: false, preserveLineBreaks: true };
    expect(renderOutput([page(1, "x")], opts)).toContain("page,char_count");
  });
  it("dispatches to markdown", () => {
    const opts = { pageRange: "all", outputFormat: "markdown" as OutputFormat, includePageNumbers: false, preserveLineBreaks: true };
    expect(renderOutput([page(1, "x")], opts)).toContain("```");
  });
});

describe("pdf-ocr getOutputFilename", () => {
  it("strips .pdf and adds format extension", () => {
    expect(getOutputFilename("plain-text", "report.pdf")).toBe("report.txt");
    expect(getOutputFilename("json", "My Doc.pdf")).toBe("My_Doc.json");
    expect(getOutputFilename("csv-per-page", "data.pdf")).toBe("data.csv");
    expect(getOutputFilename("markdown", "notes.pdf")).toBe("notes.md");
  });
  it("handles missing extension", () => {
    expect(getOutputFilename("plain-text", "notes")).toBe("notes.txt");
  });
  it("falls back to 'output' for empty name", () => {
    expect(getOutputFilename("plain-text", "")).toBe("output.txt");
  });
});

describe("pdf-ocr searchText", () => {
  it("finds matches across pages", () => {
    const pages = [page(1, "Hello world"), page(2, "Hello again")];
    const r = searchText(pages, "hello");
    expect(r).toHaveLength(2);
    expect(r[0].pageNumber).toBe(1);
    expect(r[1].pageNumber).toBe(2);
    expect(r[0].snippet.toLowerCase()).toContain("hello");
  });
  it("returns empty for empty query", () => {
    expect(searchText([page(1, "x")], "")).toEqual([]);
  });
  it("adds ellipsis for context", () => {
    const long = "x".repeat(100) + "TARGET" + "y".repeat(100);
    const r = searchText([page(1, long)], "target");
    expect(r).toHaveLength(1);
    expect(r[0].snippet.startsWith("…")).toBe(true);
    expect(r[0].snippet.endsWith("…")).toBe(true);
  });
});

describe("pdf-ocr analyzeKeywords", () => {
  it("returns top N keywords excluding stop words", () => {
    const pages = [page(1, "the quick brown fox jumps over the lazy dog the fox")];
    const kw = analyzeKeywords(pages, 5);
    expect(kw.length).toBeGreaterThan(0);
    expect(kw[0].word).toBe("fox");
    expect(kw[0].count).toBe(2);
    expect(kw.find((k) => k.word === "the")).toBeUndefined();
  });
  it("respects topN cap", () => {
    const pages = [page(1, "alpha beta gamma delta epsilon zeta eta theta")];
    const kw = analyzeKeywords(pages, 3);
    expect(kw).toHaveLength(3);
  });
});

describe("pdf-ocr estimateReadingTime", () => {
  it("returns 0 for zero words", () => {
    expect(estimateReadingTime(0)).toBe(0);
  });
  it("returns at least 1 minute for non-zero words", () => {
    expect(estimateReadingTime(10)).toBe(1);
  });
  it("scales with word count", () => {
    expect(estimateReadingTime(500, 250)).toBe(2);
    expect(estimateReadingTime(750, 250)).toBe(3);
  });
});

describe("pdf-ocr detectLanguage", () => {
  it("detects English", () => {
    expect(detectLanguage("the quick brown fox jumps over the lazy dog and the cat is here")).toBe("en");
  });
  it("detects Spanish", () => {
    expect(detectLanguage("el gato es muy bonito y la casa es grande con los perros")).toBe("es");
  });
  it("detects French", () => {
    expect(detectLanguage("le chat est très beau et la maison est grande avec les amis")).toBe("fr");
  });
  it("returns unknown for empty", () => {
    expect(detectLanguage("")).toBe("unknown");
  });
});

describe("pdf-ocr history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, fileName: "a.pdf", pageCount: 5, extractedChars: 100, format: "plain-text" });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].fileName).toBe("a.pdf");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, fileName: `f${i}.pdf`, pageCount: 1, extractedChars: i, format: "json" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, fileName: "a.pdf", pageCount: 1, extractedChars: 1, format: "plain-text" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("pdf-ocr shareable URL", () => {
  it("builds share URL with non-default options", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ pageRange: "1-3", outputFormat: "json", includePageNumbers: false, preserveLineBreaks: true });
    expect(url).toContain("range=1-3");
    expect(url).toContain("format=json");
    expect(url).toContain("pageNumbers=0");
    expect(url).not.toContain("lineBreaks");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("range=1-3&format=json&pageNumbers=0&lineBreaks=0");
    expect(p.pageRange).toBe("1-3");
    expect(p.outputFormat).toBe("json");
    expect(p.includePageNumbers).toBe(false);
    expect(p.preserveLineBreaks).toBe(false);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown format", () => {
    const p = parseShareUrl("format=xml");
    expect(p.outputFormat).toBeUndefined();
  });
});

describe("pdf-ocr validateOptions", () => {
  it("accepts valid options", () => {
    const r = validateOptions({ pageRange: "1-3, 5", outputFormat: "json", includePageNumbers: true, preserveLineBreaks: false }, 10);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.pageRange).toBe("1-3, 5");
  });
  it("accepts 'all'", () => {
    const r = validateOptions({ pageRange: "all", outputFormat: "plain-text", includePageNumbers: true, preserveLineBreaks: true }, 10);
    expect(r.ok).toBe(true);
  });
  it("rejects unknown format", () => {
    const r = validateOptions({ pageRange: "all", outputFormat: "yaml" as OutputFormat, includePageNumbers: true, preserveLineBreaks: true }, 10);
    expect(r.ok).toBe(false);
  });
  it("rejects malformed range", () => {
    const r = validateOptions({ pageRange: "abc", outputFormat: "plain-text", includePageNumbers: true, preserveLineBreaks: true }, 10);
    expect(r.ok).toBe(false);
  });
});

/**
 * EPUB to PDF Converter — unit tests (pure logic).
 */
import { describe, it, expect } from "vitest";
import {
  pageDimensions, averageCharWidth, usableArea, pageGeometry, decodeEntities,
  htmlToText, parseOpfMetadata, buildChapter, generateToc, wrapParagraph,
  paginateText, concatenateChapters, estimatePageCount, validateOptions,
  buildTitlePage, formatLog, summarizeResult, nextProgress, batchToCsv,
  formatMetadata, compressionRatio, quickStats, type ConvertOptions, type BatchOutcome,
} from "./logic";

const baseOpts: ConvertOptions = { pageSize: "a4", margin: 50, fontSize: 12, fontFamily: "helvetica" };

describe("pageDimensions", () => {
  it("returns A4", () => { expect(pageDimensions("a4")).toEqual({ w: 595, h: 842 }); });
  it("returns Legal", () => { expect(pageDimensions("legal")).toEqual({ w: 612, h: 1008 }); });
});

describe("averageCharWidth", () => {
  it("scales with size", () => {
    expect(averageCharWidth("helvetica", 24)).toBeGreaterThan(averageCharWidth("helvetica", 12));
  });
});

describe("usableArea + pageGeometry", () => {
  it("subtracts margins", () => { expect(usableArea("a4", 50).w).toBe(495); });
  it("returns positive geometry", () => {
    const g = pageGeometry(baseOpts);
    expect(g.charsPerLine).toBeGreaterThan(0);
    expect(g.linesPerPage).toBeGreaterThan(0);
  });
});

describe("decodeEntities", () => {
  it("decodes named entities", () => {
    expect(decodeEntities("a&nbsp;b&amp;c&lt;d&gt;e&quot;f&#39;g")).toBe("a b&c<d>e\"f'g");
  });
  it("decodes numeric entities", () => {
    expect(decodeEntities("&#65;&#66;&#67;")).toBe("ABC");
  });
  it("decodes hex entities", () => {
    expect(decodeEntities("&#x41;&#x42;")).toBe("AB");
  });
});

describe("htmlToText", () => {
  it("strips tags", () => {
    expect(htmlToText("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });
  it("removes scripts and styles", () => {
    expect(htmlToText("<script>alert(1)</script><style>.x{}</style>ok")).toBe("ok");
  });
  it("converts <br> and <li>", () => {
    expect(htmlToText("a<br>b<ul><li>x</li></ul>")).toContain("\n");
    expect(htmlToText("<li>item</li>")).toContain("•");
  });
});

describe("parseOpfMetadata", () => {
  const opf = `<?xml version="1.0"?>
  <package><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>My Book</dc:title>
    <dc:creator>Jane Doe</dc:creator>
    <dc:language>en</dc:language>
    <dc:subject>Fiction</dc:subject>
    <dc:identifier>urn:isbn:123</dc:identifier>
  </metadata></package>`;
  it("extracts title", () => { expect(parseOpfMetadata(opf).title).toBe("My Book"); });
  it("extracts author", () => { expect(parseOpfMetadata(opf).author).toBe("Jane Doe"); });
  it("extracts language", () => { expect(parseOpfMetadata(opf).language).toBe("en"); });
  it("extracts subject", () => { expect(parseOpfMetadata(opf).subject).toBe("Fiction"); });
  it("extracts identifier", () => { expect(parseOpfMetadata(opf).identifier).toBe("urn:isbn:123"); });
  it("returns defaults when missing", () => {
    const m = parseOpfMetadata("<package></package>");
    expect(m.title).toBe("Untitled"); expect(m.author).toBe("Unknown"); expect(m.language).toBe("en");
  });
});

describe("buildChapter", () => {
  it("extracts title from h1", () => {
    const c = buildChapter(0, "ch1.xhtml", "<h1>Intro</h1><p>Body</p>");
    expect(c.title).toBe("Intro"); expect(c.text).toContain("Body"); expect(c.charCount).toBeGreaterThan(0);
  });
  it("falls back to filename when no heading", () => {
    const c = buildChapter(0, "OEBPS/ch1.html", "<p>body</p>");
    expect(c.title).toBe("ch1.html");
  });
});

describe("generateToc", () => {
  it("returns empty when no chapters", () => { expect(generateToc([])).toBe(""); });
  it("lists chapters with char counts", () => {
    const toc = generateToc([
      { index: 0, href: "a.xhtml", title: "A", text: "x", charCount: 5 },
      { index: 1, href: "b.xhtml", title: "B", text: "y", charCount: 10 },
    ]);
    expect(toc).toContain("01. A");
    expect(toc).toContain("02. B");
    expect(toc).toContain("(5 chars)");
  });
});

describe("wrapParagraph + paginateText", () => {
  it("wraps long paragraph", () => {
    expect(wrapParagraph("word ".repeat(50).trim(), 20).length).toBeGreaterThan(1);
  });
  it("paginates long text into multiple pages", () => {
    expect(paginateText("word ".repeat(5000), baseOpts).length).toBeGreaterThan(1);
  });
  it("returns at least 1 page for empty", () => {
    expect(paginateText("", baseOpts).length).toBe(1);
  });
});

describe("concatenateChapters", () => {
  it("joins chapters with headings", () => {
    const s = concatenateChapters([
      { index: 0, href: "a", title: "A", text: "body1", charCount: 5 },
      { index: 1, href: "b", title: "B", text: "body2", charCount: 5 },
    ]);
    expect(s).toContain("A"); expect(s).toContain("body1");
    expect(s).toContain("B"); expect(s).toContain("body2");
  });
});

describe("estimatePageCount", () => {
  it("returns positive", () => { expect(estimatePageCount("hi", baseOpts)).toBeGreaterThanOrEqual(1); });
});

describe("validateOptions", () => {
  it("accepts valid", () => { expect(validateOptions(baseOpts)).toEqual({ ok: true }); });
  it("rejects bad margin", () => { expect(validateOptions({ ...baseOpts, margin: -1 })).toHaveProperty("error"); });
});

describe("buildTitlePage", () => {
  it("includes title and conversion", () => {
    const s = buildTitlePage("T", "A", "EPUB", "PDF");
    expect(s).toContain("T"); expect(s).toContain("EPUB to PDF");
  });
});

describe("formatLog + summarizeResult", () => {
  it("formatLog numbers entries", () => { expect(formatLog(["a", "b"])).toBe("1. a\n2. b"); });
  it("summarizeResult shows pages", () => {
    const s = summarizeResult({ success: true, inputSize: 1, outputSize: 2, warnings: [], log: [], pageCount: 4 });
    expect(s).toContain("Pages: 4");
  });
});

describe("nextProgress", () => {
  it("0% at start", () => { expect(nextProgress(0, 5, "x").percent).toBe(0); });
  it("100% at end", () => { expect(nextProgress(5, 5, "x").percent).toBe(100); });
});

describe("batchToCsv", () => {
  it("emits header + rows", () => {
    const outcomes: BatchOutcome[] = [
      { id: "a", filename: "a.epub", success: true, pageCount: 5, outputSize: 100, chapters: 3, warnings: [], log: [] },
    ];
    const csv = batchToCsv(outcomes);
    expect(csv).toContain("Chapters"); expect(csv).toContain("a.epub");
  });
});

describe("formatMetadata", () => {
  it("includes opf metadata when provided", () => {
    const s = formatMetadata(baseOpts, { title: "T", author: "A", language: "fr", subject: "S", identifier: "I" });
    expect(s).toContain("Title: T"); expect(s).toContain("Language: fr");
  });
});

describe("compressionRatio", () => {
  it("smaller when output < input", () => { expect(compressionRatio(2000, 1000)).toBe("2.00:1 (smaller)"); });
  it("n/a when output 0", () => { expect(compressionRatio(10, 0)).toBe("n/a"); });
});

describe("quickStats", () => {
  it("counts chars/words/lines/pages/chapters", () => {
    const s = quickStats("a b\nc", 2, 3);
    expect(s.words).toBe(3); expect(s.chapters).toBe(3); expect(s.pages).toBe(2);
  });
});

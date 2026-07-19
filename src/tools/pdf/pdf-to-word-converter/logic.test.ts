import { describe, it, expect, beforeEach } from "vitest";
import {
  OUTPUT_FORMATS,
  FORMAT_EXTENSIONS,
  FORMAT_MIME,
  DEFAULT_OPTIONS,
  normalizePageRangeSpec,
  resolveAllRange,
  analyzeFontSizes,
  classifyHeadingLevel,
  detectParagraphs,
  formatBodyText,
  insertPageBreak,
  detectBoldItalic,
  detectTable,
  analyzeTextStructure,
  computeSummaryStats,
  escapeXml,
  escapeHtml,
  escapeMarkdown,
  renderPlainText,
  renderHtml,
  renderMarkdown,
  generateDocumentXml,
  generateContentTypesXml,
  generateRelsXml,
  crc32,
  utf8Encode,
  buildZip,
  buildDocxPackage,
  renderOutput,
  getOutputFilename,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type TextItem,
  type Paragraph,
  type PageBlock,
  type DocumentStructure,
  type ConvertOptions,
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

function ti(text: string, fontSize: number, pageNumber = 1, bold = false, italic = false): TextItem {
  return { text, fontSize, pageNumber, bold, italic };
}

function bodyParagraph(text: string, pageNumber = 1): Paragraph {
  return { level: "body", text, pageNumber };
}

function pageBlock(pageNumber: number, paragraphs: Paragraph[]): PageBlock {
  return { pageNumber, paragraphs };
}

function structure(pages: PageBlock[]): DocumentStructure {
  return { pages, bodyFontSize: 12, headingFontSizes: [24, 18, 14] };
}

describe("pdf2word constants", () => {
  it("has 4 output formats", () => {
    expect(OUTPUT_FORMATS).toHaveLength(4);
    expect(OUTPUT_FORMATS).toContain("docx");
    expect(OUTPUT_FORMATS).toContain("html");
    expect(OUTPUT_FORMATS).toContain("markdown");
    expect(OUTPUT_FORMATS).toContain("plain-text");
  });
  it("format extensions map correctly", () => {
    expect(FORMAT_EXTENSIONS["docx"]).toBe("docx");
    expect(FORMAT_EXTENSIONS["html"]).toBe("html");
    expect(FORMAT_EXTENSIONS["markdown"]).toBe("md");
    expect(FORMAT_EXTENSIONS["plain-text"]).toBe("txt");
  });
  it("format MIME types map correctly", () => {
    expect(FORMAT_MIME["docx"]).toContain("wordprocessingml");
    expect(FORMAT_MIME["html"]).toBe("text/html");
  });
  it("has sensible default options", () => {
    expect(DEFAULT_OPTIONS.outputFormat).toBe("docx");
    expect(DEFAULT_OPTIONS.includePageBreaks).toBe(true);
    expect(DEFAULT_OPTIONS.preserveHeadings).toBe(true);
  });
});

describe("pdf2word normalizePageRangeSpec", () => {
  it("returns 'all' for empty", () => {
    expect(normalizePageRangeSpec("")).toBe("all");
    expect(normalizePageRangeSpec("   ")).toBe("all");
  });
  it("passes 'all' through", () => {
    expect(normalizePageRangeSpec("ALL")).toBe("all");
  });
  it("lowercases and collapses whitespace", () => {
    expect(normalizePageRangeSpec("  1-3,  5 ")).toBe("1-3, 5");
  });
});

describe("pdf2word resolveAllRange", () => {
  it("resolves 'all' to 1-N", () => {
    expect(resolveAllRange("all", 7)).toBe("1-7");
  });
  it("leaves explicit range unchanged", () => {
    expect(resolveAllRange("1-3", 7)).toBe("1-3");
  });
});

describe("pdf2word analyzeFontSizes", () => {
  it("returns zeros for empty input", () => {
    expect(analyzeFontSizes([])).toEqual({ bodyFontSize: 0, headingFontSizes: [] });
  });
  it("picks body size by character count", () => {
    const items = [
      ti("Short heading", 24),
      ti("Long body text that should dominate the character count", 12),
      ti("More body text", 12),
    ];
    const r = analyzeFontSizes(items);
    expect(r.bodyFontSize).toBe(12);
    expect(r.headingFontSizes).toEqual([24]);
  });
  it("handles single-size input", () => {
    const items = [ti("Hello", 12), ti("World", 12)];
    const r = analyzeFontSizes(items);
    expect(r.bodyFontSize).toBe(12);
    expect(r.headingFontSizes).toEqual([]);
  });
  it("ignores items with zero font size", () => {
    const r = analyzeFontSizes([ti("x", 0)]);
    expect(r.bodyFontSize).toBe(0);
  });
});

describe("pdf2word classifyHeadingLevel", () => {
  it("classifies body for sizes near body", () => {
    expect(classifyHeadingLevel(12, 12)).toBe("body");
    expect(classifyHeadingLevel(13, 12)).toBe("body");
  });
  it("classifies h1 for largest heading size", () => {
    expect(classifyHeadingLevel(24, 12, [24, 18, 14])).toBe("h1");
  });
  it("classifies h2 for second-largest", () => {
    expect(classifyHeadingLevel(18, 12, [24, 18, 14])).toBe("h2");
  });
  it("classifies h3 for third-largest", () => {
    expect(classifyHeadingLevel(14, 12, [24, 18, 14])).toBe("h3");
  });
  it("falls back to ratio when no heading sizes given", () => {
    expect(classifyHeadingLevel(30, 12)).toBe("h1");
    expect(classifyHeadingLevel(20, 12)).toBe("h2");
    expect(classifyHeadingLevel(15, 12)).toBe("h3");
  });
  it("returns body for sizes below threshold", () => {
    expect(classifyHeadingLevel(11, 12, [24])).toBe("body");
  });
});

describe("pdf2word detectParagraphs", () => {
  it("groups consecutive items into one paragraph", () => {
    const items = [ti("Hello ", 12), ti("world", 12)];
    const paras = detectParagraphs(items, 12, [24, 18]);
    expect(paras).toHaveLength(1);
    expect(paras[0].text).toBe("Hello world");
    expect(paras[0].level).toBe("body");
  });
  it("splits when font size changes", () => {
    const items = [ti("Heading", 24), ti("Body text here", 12)];
    const paras = detectParagraphs(items, 12, [24]);
    expect(paras).toHaveLength(2);
    expect(paras[0].level).toBe("h1");
    expect(paras[1].level).toBe("body");
  });
  it("splits on double newlines", () => {
    const items = [ti("Para 1.\n\nPara 2.", 12)];
    const paras = detectParagraphs(items, 12, []);
    expect(paras.length).toBeGreaterThanOrEqual(2);
  });
  it("skips empty paragraphs", () => {
    const items = [ti("   ", 12), ti("Real", 12)];
    const paras = detectParagraphs(items, 12, []);
    expect(paras).toHaveLength(1);
    expect(paras[0].text).toBe("Real");
  });
});

describe("pdf2word formatBodyText", () => {
  it("collapses whitespace", () => {
    expect(formatBodyText("a\n\n  b\t c")).toBe("a b c");
  });
  it("handles empty input", () => {
    expect(formatBodyText("")).toBe("");
  });
});

describe("pdf2word insertPageBreak", () => {
  it("joins with markdown separator", () => {
    expect(insertPageBreak(["a", "b"], "markdown")).toContain("---");
  });
  it("joins with html separator", () => {
    const result = insertPageBreak(["a", "b"], "html");
    expect(result).toContain("page-break-after");
  });
});

describe("pdf2word detectBoldItalic", () => {
  it("detects bold", () => {
    expect(detectBoldItalic([ti("a", 12), ti("b", 12, 1, true)])).toEqual({ hasBold: true, hasItalic: false });
  });
  it("detects italic", () => {
    expect(detectBoldItalic([ti("a", 12, 1, false, true)])).toEqual({ hasBold: false, hasItalic: true });
  });
  it("returns false for plain text", () => {
    expect(detectBoldItalic([ti("a", 12)])).toEqual({ hasBold: false, hasItalic: false });
  });
});

describe("pdf2word detectTable", () => {
  it("returns false for small item sets", () => {
    expect(detectTable([ti("a", 12)])).toBe(false);
  });
  it("returns false for plain paragraphs without positional data", () => {
    expect(detectTable([ti("a", 12), ti("b", 12), ti("c", 12), ti("d", 12), ti("e", 12), ti("f", 12)])).toBe(false);
  });
});

describe("pdf2word analyzeTextStructure", () => {
  it("counts paragraphs, sentences, words, chars", () => {
    const s = analyzeTextStructure("Hello world. Foo bar baz!\n\nAnother paragraph.");
    expect(s.paragraphs).toBe(2);
    expect(s.sentences).toBe(3);
    expect(s.words).toBe(7);
    expect(s.chars).toBe("Hello world. Foo bar baz!\n\nAnother paragraph.".length);
  });
  it("handles empty text", () => {
    const s = analyzeTextStructure("");
    expect(s.paragraphs).toBe(0);
    expect(s.words).toBe(0);
  });
});

describe("pdf2word computeSummaryStats", () => {
  it("aggregates across pages", () => {
    const doc = structure([
      pageBlock(1, [
        { level: "h1", text: "Title", pageNumber: 1 },
        bodyParagraph("Hello world foo bar", 1),
      ]),
      pageBlock(2, [
        bodyParagraph("Second page text", 2),
      ]),
    ]);
    const s = computeSummaryStats(doc);
    expect(s.totalPages).toBe(2);
    expect(s.totalParagraphs).toBe(3);
    expect(s.totalHeadings).toBe(1);
    expect(s.totalWords).toBe(8);
    expect(s.avgWordsPerPage).toBe(4);
  });
  it("handles empty document", () => {
    const s = computeSummaryStats(structure([]));
    expect(s.totalPages).toBe(0);
    expect(s.totalParagraphs).toBe(0);
  });
});

describe("pdf2word escaping", () => {
  it("escapeXml escapes special chars", () => {
    expect(escapeXml("<>&\"'")).toBe("&lt;&gt;&amp;&quot;&apos;");
  });
  it("escapeHtml escapes <>&\"", () => {
    expect(escapeHtml('<a href="x">&')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;");
  });
  it("escapeMarkdown escapes special chars", () => {
    expect(escapeMarkdown("# Hello *world*")).toBe("\\# Hello \\*world\\*");
  });
});

describe("pdf2word renderPlainText", () => {
  const opts = (over: Partial<ConvertOptions> = {}): ConvertOptions => ({
    pageRange: "all", outputFormat: "plain-text", includePageBreaks: true, preserveHeadings: true, ...over,
  });
  it("renders headings with # prefix", () => {
    const doc = structure([pageBlock(1, [{ level: "h1", text: "Title", pageNumber: 1 }, bodyParagraph("Body", 1)])]);
    const out = renderPlainText(doc, opts());
    expect(out).toContain("# Title");
    expect(out).toContain("Body");
  });
  it("omits heading prefix when preserveHeadings is false", () => {
    const doc = structure([pageBlock(1, [{ level: "h1", text: "Title", pageNumber: 1 }])]);
    const out = renderPlainText(doc, opts({ preserveHeadings: false }));
    expect(out).not.toContain("# Title");
    expect(out).toContain("Title");
  });
});

describe("pdf2word renderHtml", () => {
  const opts = (over: Partial<ConvertOptions> = {}): ConvertOptions => ({
    pageRange: "all", outputFormat: "html", includePageBreaks: true, preserveHeadings: true, ...over,
  });
  it("produces a full HTML document", () => {
    const doc = structure([pageBlock(1, [bodyParagraph("Hello", 1)])]);
    const out = renderHtml(doc, opts());
    expect(out).toContain("<!DOCTYPE html>");
    expect(out).toContain("<p>Hello</p>");
    expect(out).toContain("</html>");
  });
  it("uses heading tags when preserveHeadings is on", () => {
    const doc = structure([pageBlock(1, [{ level: "h2", text: "Sub", pageNumber: 1 }])]);
    const out = renderHtml(doc, opts());
    expect(out).toContain("<h2>Sub</h2>");
  });
  it("inserts page break hr when enabled", () => {
    const doc = structure([pageBlock(1, [bodyParagraph("A", 1)]), pageBlock(2, [bodyParagraph("B", 2)])]);
    const out = renderHtml(doc, opts({ includePageBreaks: true }));
    expect(out).toContain("page-break-after");
  });
  it("escapes HTML special chars in text", () => {
    const doc = structure([pageBlock(1, [bodyParagraph("<script>x</script>", 1)])]);
    const out = renderHtml(doc, opts());
    expect(out).toContain("&lt;script&gt;");
    expect(out).not.toContain("<script>x</script>");
  });
});

describe("pdf2word renderMarkdown", () => {
  const opts = (over: Partial<ConvertOptions> = {}): ConvertOptions => ({
    pageRange: "all", outputFormat: "markdown", includePageBreaks: true, preserveHeadings: true, ...over,
  });
  it("renders h1/h2/h3 with # markers", () => {
    const doc = structure([pageBlock(1, [
      { level: "h1", text: "Big", pageNumber: 1 },
      { level: "h2", text: "Medium", pageNumber: 1 },
      { level: "h3", text: "Small", pageNumber: 1 },
    ])]);
    const out = renderMarkdown(doc, opts());
    expect(out).toContain("# Big");
    expect(out).toContain("## Medium");
    expect(out).toContain("### Small");
  });
  it("inserts --- page breaks when enabled", () => {
    const doc = structure([pageBlock(1, [bodyParagraph("A", 1)]), pageBlock(2, [bodyParagraph("B", 2)])]);
    const out = renderMarkdown(doc, opts({ includePageBreaks: true }));
    expect(out).toContain("---");
  });
});

describe("pdf2word generateDocumentXml", () => {
  const opts = (over: Partial<ConvertOptions> = {}): ConvertOptions => ({
    pageRange: "all", outputFormat: "docx", includePageBreaks: true, preserveHeadings: true, ...over,
  });
  it("produces valid XML with namespaces", () => {
    const doc = structure([pageBlock(1, [bodyParagraph("Hello", 1)])]);
    const xml = generateDocumentXml(doc, opts());
    expect(xml).toContain("<?xml");
    expect(xml).toContain("xmlns:w=");
    expect(xml).toContain("<w:body>");
    expect(xml).toContain("<w:t");
    expect(xml).toContain("Hello");
  });
  it("marks headings with outlineLvl", () => {
    const doc = structure([pageBlock(1, [{ level: "h1", text: "Title", pageNumber: 1 }])]);
    const xml = generateDocumentXml(doc, opts());
    expect(xml).toContain("<w:outlineLvl w:val=\"0\"");
    expect(xml).toContain("<w:b/>");
  });
  it("inserts page breaks between pages when enabled", () => {
    const doc = structure([pageBlock(1, [bodyParagraph("A", 1)]), pageBlock(2, [bodyParagraph("B", 2)])]);
    const xml = generateDocumentXml(doc, opts({ includePageBreaks: true }));
    expect(xml).toContain("<w:br w:type=\"page\"/>");
  });
  it("omits page breaks when disabled", () => {
    const doc = structure([pageBlock(1, [bodyParagraph("A", 1)]), pageBlock(2, [bodyParagraph("B", 2)])]);
    const xml = generateDocumentXml(doc, opts({ includePageBreaks: false }));
    expect(xml).not.toContain("w:br");
  });
  it("escapes XML special chars in text", () => {
    const doc = structure([pageBlock(1, [bodyParagraph("a < b & c > d", 1)])]);
    const xml = generateDocumentXml(doc, opts());
    expect(xml).toContain("&lt;");
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&gt;");
    expect(xml).not.toContain("a < b & c > d");
  });
});

describe("pdf2word generateContentTypesXml / generateRelsXml", () => {
  it("content types includes document.xml override", () => {
    const xml = generateContentTypesXml();
    expect(xml).toContain("<Types");
    expect(xml).toContain("word/document.xml");
    expect(xml).toContain("Override");
  });
  it("rels points to word/document.xml", () => {
    const xml = generateRelsXml();
    expect(xml).toContain("officeDocument");
    expect(xml).toContain("word/document.xml");
  });
});

describe("pdf2word crc32", () => {
  it("produces known values for known inputs", () => {
    // CRC-32 of empty input is 0
    expect(crc32(new Uint8Array(0))).toBe(0);
    // CRC-32 of "abc" is 0x352441C2
    expect(crc32(utf8Encode("abc"))).toBe(0x352441C2);
    // CRC-32 of "123456789" is 0xCBF43926
    expect(crc32(utf8Encode("123456789"))).toBe(0xCBF43926);
  });
  it("returns unsigned 32-bit value", () => {
    const crc = crc32(utf8Encode("test"));
    expect(crc).toBeGreaterThanOrEqual(0);
    expect(crc).toBeLessThanOrEqual(0xFFFFFFFF);
  });
});

describe("pdf2word utf8Encode", () => {
  it("encodes ASCII bytes", () => {
    expect(Array.from(utf8Encode("abc"))).toEqual([97, 98, 99]);
  });
  it("encodes multibyte UTF-8", () => {
    expect(Array.from(utf8Encode("€"))).toEqual([226, 130, 172]);
  });
});

describe("pdf2word buildZip", () => {
  it("starts with local file header signature", () => {
    const zip = buildZip([{ name: "a.txt", bytes: utf8Encode("hello") }]);
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
  });
  it("ends with EOCD signature", () => {
    const zip = buildZip([{ name: "a.txt", bytes: utf8Encode("hello") }]);
    const len = zip.length;
    expect(zip[len - 22]).toBe(0x50);
    expect(zip[len - 21]).toBe(0x4b);
    expect(zip[len - 20]).toBe(0x05);
    expect(zip[len - 19]).toBe(0x06);
  });
  it("contains the filename bytes", () => {
    const zip = buildZip([{ name: "hello.txt", bytes: utf8Encode("hi") }]);
    const text = new TextDecoder().decode(zip);
    expect(text).toContain("hello.txt");
  });
  it("handles multiple files", () => {
    const zip = buildZip([
      { name: "a.txt", bytes: utf8Encode("aaa") },
      { name: "b.txt", bytes: utf8Encode("bbb") },
    ]);
    const text = new TextDecoder().decode(zip);
    expect(text).toContain("a.txt");
    expect(text).toContain("b.txt");
    // 2 files → EOCD entries-on-disk = 2 (little-endian, EOCD is the last 22 bytes)
    const len = zip.length;
    // EOCD structure: 4 (sig) + 2 (disk) + 2 (disk w/ CD) + 2 (entries on disk) + 2 (total) ...
    // entries-on-disk is at offset 8 within the EOCD record
    const entriesOnDisk = zip[len - 22 + 8] | (zip[len - 22 + 9] << 8);
    const totalEntries = zip[len - 22 + 10] | (zip[len - 22 + 11] << 8);
    expect(entriesOnDisk).toBe(2);
    expect(totalEntries).toBe(2);
  });
  it("handles empty file list", () => {
    const zip = buildZip([]);
    const len = zip.length;
    // Just the EOCD record (22 bytes)
    expect(len).toBe(22);
    expect(zip[0]).toBe(0x50);
    expect(zip[2]).toBe(0x05);
    expect(zip[3]).toBe(0x06);
  });
});

describe("pdf2word buildDocxPackage", () => {
  it("produces a ZIP containing all three required parts", () => {
    const doc = structure([pageBlock(1, [bodyParagraph("Hello", 1)])]);
    const opts: ConvertOptions = {
      pageRange: "all", outputFormat: "docx", includePageBreaks: true, preserveHeadings: true,
    };
    const bytes = buildDocxPackage(doc, opts);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("[Content_Types].xml");
    expect(text).toContain("_rels/.rels");
    expect(text).toContain("word/document.xml");
  });
  it("includes the extracted text in the document.xml part", () => {
    const doc = structure([pageBlock(1, [bodyParagraph("Hello world", 1)])]);
    const bytes = buildDocxPackage(doc, {
      pageRange: "all", outputFormat: "docx", includePageBreaks: false, preserveHeadings: true,
    });
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("Hello world");
  });
});

describe("pdf2word renderOutput dispatch", () => {
  const doc = structure([pageBlock(1, [bodyParagraph("Hello", 1)])]);
  it("dispatches to plain-text", () => {
    const opts: ConvertOptions = { pageRange: "all", outputFormat: "plain-text", includePageBreaks: false, preserveHeadings: false };
    expect(renderOutput(doc, opts)).toContain("Hello");
  });
  it("dispatches to html", () => {
    const opts: ConvertOptions = { pageRange: "all", outputFormat: "html", includePageBreaks: false, preserveHeadings: false };
    expect(renderOutput(doc, opts)).toContain("<p>Hello</p>");
  });
  it("dispatches to markdown", () => {
    const opts: ConvertOptions = { pageRange: "all", outputFormat: "markdown", includePageBreaks: false, preserveHeadings: false };
    expect(renderOutput(doc, opts)).toContain("Hello");
  });
  it("dispatches to docx with placeholder text", () => {
    const opts: ConvertOptions = { pageRange: "all", outputFormat: "docx", includePageBreaks: false, preserveHeadings: false };
    expect(renderOutput(doc, opts)).toContain("DOCX");
  });
});

describe("pdf2word getOutputFilename", () => {
  it("strips .pdf and adds format extension", () => {
    expect(getOutputFilename("docx", "report.pdf")).toBe("report.docx");
    expect(getOutputFilename("html", "My Doc.pdf")).toBe("My_Doc.html");
    expect(getOutputFilename("markdown", "notes.pdf")).toBe("notes.md");
    expect(getOutputFilename("plain-text", "data.pdf")).toBe("data.txt");
  });
  it("handles missing extension", () => {
    expect(getOutputFilename("docx", "notes")).toBe("notes.docx");
  });
  it("falls back to 'output' for empty name", () => {
    expect(getOutputFilename("docx", "")).toBe("output.docx");
  });
});

describe("pdf2word history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, fileName: "a.pdf", pageCount: 5, paragraphCount: 10, headingCount: 2, format: "docx" });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].fileName).toBe("a.pdf");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, fileName: `f${i}.pdf`, pageCount: 1, paragraphCount: 1, headingCount: 0, format: "html" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, fileName: "a.pdf", pageCount: 1, paragraphCount: 1, headingCount: 0, format: "docx" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("pdf2word shareable URL", () => {
  it("builds share URL with non-default options", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ pageRange: "1-3", outputFormat: "html", includePageBreaks: false, preserveHeadings: true });
    expect(url).toContain("range=1-3");
    expect(url).toContain("format=html");
    expect(url).toContain("pageBreaks=0");
    expect(url).not.toContain("headings");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("range=1-3&format=html&pageBreaks=0&headings=0");
    expect(p.pageRange).toBe("1-3");
    expect(p.outputFormat).toBe("html");
    expect(p.includePageBreaks).toBe(false);
    expect(p.preserveHeadings).toBe(false);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown format", () => {
    const p = parseShareUrl("format=rtf");
    expect(p.outputFormat).toBeUndefined();
  });
});

describe("pdf2word validateOptions", () => {
  it("accepts valid options", () => {
    const r = validateOptions({ pageRange: "1-3, 5", outputFormat: "docx", includePageBreaks: true, preserveHeadings: true }, 10);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.pageRange).toBe("1-3, 5");
  });
  it("accepts 'all'", () => {
    const r = validateOptions({ pageRange: "all", outputFormat: "html", includePageBreaks: true, preserveHeadings: true }, 10);
    expect(r.ok).toBe(true);
  });
  it("rejects unknown format", () => {
    const r = validateOptions({ pageRange: "all", outputFormat: "rtf" as OutputFormat, includePageBreaks: true, preserveHeadings: true }, 10);
    expect(r.ok).toBe(false);
  });
  it("rejects malformed range", () => {
    const r = validateOptions({ pageRange: "abc", outputFormat: "docx", includePageBreaks: true, preserveHeadings: true }, 10);
    expect(r.ok).toBe(false);
  });
});

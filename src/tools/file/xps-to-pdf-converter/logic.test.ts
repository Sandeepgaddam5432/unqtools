/**
 * XPS to PDF Converter — unit tests (pure logic).
 */
import { describe, it, expect } from "vitest";
import {
  pageDimensions, xmlUnescape, extractGlyphsText, extractNumericAttr, parseXps,
  classifyPageSize, validateOptions, wrapParagraph, paginateText, buildTitlePage,
  formatLog, summarizeResult, nextProgress, batchToCsv, formatMetadata,
  compressionRatio, quickStats, type ConvertOptions, type BatchOutcome,
} from "./logic";

const baseOpts: ConvertOptions = { pageSize: "a4", margin: 50, fontSize: 12, fontFamily: "helvetica" };

describe("pageDimensions", () => {
  it("returns A4", () => { expect(pageDimensions("a4")).toEqual({ w: 595, h: 842 }); });
  it("returns Letter", () => { expect(pageDimensions("letter")).toEqual({ w: 612, h: 792 }); });
  it("returns Legal", () => { expect(pageDimensions("legal")).toEqual({ w: 612, h: 1008 }); });
});

describe("xmlUnescape", () => {
  it("unescapes ampersand last", () => { expect(xmlUnescape("a&amp;b")).toBe("a&b"); });
  it("unescapes angle brackets", () => { expect(xmlUnescape("&lt;x&gt;")).toBe("<x>"); });
  it("unescapes numeric", () => { expect(xmlUnescape("&#65;")).toBe("A"); });
  it("unescapes hex", () => { expect(xmlUnescape("&#x42;")).toBe("B"); });
});

describe("extractGlyphsText", () => {
  it("extracts UnicodeString values", () => {
    const xml = `<FixedPage><Glyphs UnicodeString="hello" FontUri="x"/><Glyphs UnicodeString="world" /></FixedPage>`;
    expect(extractGlyphsText(xml)).toEqual(["hello", "world"]);
  });
  it("returns empty when no Glyphs", () => {
    expect(extractGlyphsText("<FixedPage></FixedPage>")).toEqual([]);
  });
  it("unescapes entities in extracted text", () => {
    const xml = `<Glyphs UnicodeString="a&amp;b" />`;
    expect(extractGlyphsText(xml)).toEqual(["a&b"]);
  });
});

describe("extractNumericAttr", () => {
  it("extracts Width", () => {
    expect(extractNumericAttr('<FixedPage Width="595" Height="842">', "Width")).toBe(595);
  });
  it("returns null when absent", () => {
    expect(extractNumericAttr('<FixedPage>', "Width")).toBeNull();
  });
});

describe("parseXps", () => {
  const xml = `<?xml version="1.0"?>
<FixedDocument xmlns="http://schemas.microsoft.com/xps/2005/06">
  <Pages>
    <FixedPage Width="595" Height="842"><Canvas>
      <Glyphs UnicodeString="hello" FontUri="x" FontRenderingEmSize="12" OriginX="50" OriginY="50" />
    </Canvas></FixedPage>
    <FixedPage Width="595" Height="842"><Canvas>
      <Glyphs UnicodeString="world" FontUri="x" FontRenderingEmSize="12" OriginX="50" OriginY="50" />
    </Canvas></FixedPage>
  </Pages>
  <DocumentProperties>
    <Title>My Doc</Title>
    <Author>Author</Author>
    <Subject>Sub</Subject>
    <Keywords>k1,k2</Keywords>
  </DocumentProperties>
</FixedDocument>`;
  it("parses title and author", () => {
    const d = parseXps(xml);
    expect(d.title).toBe("My Doc"); expect(d.author).toBe("Author");
  });
  it("parses subject and keywords", () => {
    const d = parseXps(xml);
    expect(d.subject).toBe("Sub"); expect(d.keywords).toBe("k1,k2");
  });
  it("extracts 2 pages with text", () => {
    const d = parseXps(xml);
    expect(d.pages.length).toBe(2);
    expect(d.pages[0]!.lines).toEqual(["hello"]);
    expect(d.pages[1]!.lines).toEqual(["world"]);
  });
  it("warns when input is not FixedDocument", () => {
    const d = parseXps("<html></html>");
    expect(d.warnings.length).toBeGreaterThan(0);
  });
  it("uses defaults when properties missing", () => {
    const d = parseXps("<FixedDocument></FixedDocument>");
    expect(d.title).toBe("Untitled"); expect(d.author).toBe("Unknown");
  });
});

describe("classifyPageSize", () => {
  it("classifies A4", () => { expect(classifyPageSize(595, 842)).toBe("a4"); });
  it("classifies Letter", () => { expect(classifyPageSize(612, 792)).toBe("letter"); });
  it("classifies Legal", () => { expect(classifyPageSize(612, 1008)).toBe("legal"); });
  it("defaults to a4 for unknown", () => { expect(classifyPageSize(100, 200)).toBe("a4"); });
});

describe("validateOptions", () => {
  it("accepts valid", () => { expect(validateOptions(baseOpts)).toEqual({ ok: true }); });
  it("rejects bad margin", () => { expect(validateOptions({ ...baseOpts, margin: -1 })).toHaveProperty("error"); });
  it("rejects bad font size", () => { expect(validateOptions({ ...baseOpts, fontSize: 200 })).toHaveProperty("error"); });
});

describe("wrapParagraph + paginateText", () => {
  it("wraps", () => { expect(wrapParagraph("word ".repeat(50).trim(), 20).length).toBeGreaterThan(1); });
  it("paginates", () => { expect(paginateText("word ".repeat(5000), baseOpts).length).toBeGreaterThan(1); });
  it("returns 1 page for empty", () => { expect(paginateText("", baseOpts).length).toBe(1); });
});

describe("buildTitlePage", () => {
  it("includes title and source→target", () => {
    const s = buildTitlePage("T", "A", "XPS", "PDF");
    expect(s).toContain("T"); expect(s).toContain("XPS to PDF");
  });
});

describe("formatLog + summarizeResult", () => {
  it("formatLog numbers", () => { expect(formatLog(["a", "b"])).toBe("1. a\n2. b"); });
  it("summarizeResult", () => {
    const s = summarizeResult({ success: true, inputSize: 1, outputSize: 2, warnings: [], log: [], pageCount: 4 });
    expect(s).toContain("Pages: 4");
  });
});

describe("nextProgress", () => {
  it("0% start", () => { expect(nextProgress(0, 5, "x").percent).toBe(0); });
  it("100% end", () => { expect(nextProgress(5, 5, "x").percent).toBe(100); });
  it("clamps", () => { expect(nextProgress(20, 5, "x").percent).toBe(100); });
});

describe("batchToCsv", () => {
  it("emits header + rows", () => {
    const outcomes: BatchOutcome[] = [
      { id: "a", filename: "a.xps", success: true, pageCount: 1, outputSize: 10, warnings: [], log: [] },
    ];
    const csv = batchToCsv(outcomes);
    expect(csv).toContain("a.xps"); expect(csv).toContain("Pages");
  });
});

describe("formatMetadata", () => {
  it("includes XPS metadata when provided", () => {
    const s = formatMetadata(baseOpts, { pages: [], title: "T", author: "A", subject: "S", keywords: "K", warnings: [] });
    expect(s).toContain("Title: T"); expect(s).toContain("Keywords: K");
  });
});

describe("compressionRatio", () => {
  it("smaller", () => { expect(compressionRatio(2000, 1000)).toBe("2.00:1 (smaller)"); });
  it("n/a", () => { expect(compressionRatio(10, 0)).toBe("n/a"); });
});

describe("quickStats", () => {
  it("counts", () => {
    const s = quickStats("a b\nc", 2);
    expect(s.words).toBe(3); expect(s.pages).toBe(2);
  });
});

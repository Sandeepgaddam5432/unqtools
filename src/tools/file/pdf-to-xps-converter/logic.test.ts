/**
 * PDF to XPS Converter — unit tests (pure logic).
 */
import { describe, it, expect } from "vitest";
import {
  pageDimensions, xmlEscape, buildFixedPage, buildFixedDocument, paginateByLines,
  isWellFormedXml, validateOptions, formatLog, summarizeResult, nextProgress,
  batchToCsv, formatMetadata, compressionRatio, quickStats, XPS_NS,
  type ConvertOptions, type BatchOutcome,
} from "./logic";

const baseOpts: ConvertOptions = { pageSize: "a4", margin: 50, fontSize: 12, title: "T", author: "A" };

describe("pageDimensions", () => {
  it("returns A4", () => { expect(pageDimensions("a4")).toEqual({ w: 595, h: 842 }); });
  it("returns Letter", () => { expect(pageDimensions("letter")).toEqual({ w: 612, h: 792 }); });
  it("returns Legal", () => { expect(pageDimensions("legal")).toEqual({ w: 612, h: 1008 }); });
});

describe("xmlEscape", () => {
  it("escapes ampersand", () => { expect(xmlEscape("a&b")).toBe("a&amp;b"); });
  it("escapes angle brackets", () => { expect(xmlEscape("<x>")).toBe("&lt;x&gt;"); });
  it("escapes quotes", () => { expect(xmlEscape('"q"')).toBe("&quot;q&quot;"); });
  it("escapes apostrophes", () => { expect(xmlEscape("it's")).toBe("it&apos;s"); });
});

describe("buildFixedPage", () => {
  it("produces a FixedPage with Glyphs", () => {
    const s = buildFixedPage(["hello", "world"], baseOpts, 1, false);
    expect(s).toContain("FixedPage");
    expect(s).toContain("hello");
    expect(s).toContain("world");
    expect(s).toContain(XPS_NS);
  });
  it("includes page number when requested", () => {
    const s = buildFixedPage(["hi"], baseOpts, 5, true);
    expect(s).toContain('UnicodeString="5"');
  });
  it("omits page number when not requested", () => {
    const s = buildFixedPage(["hi"], baseOpts, 5, false);
    expect(s).not.toContain('OriginY="20"');
  });
});

describe("buildFixedDocument", () => {
  it("wraps pages in FixedDocument with properties", () => {
    const s = buildFixedDocument([["a"], ["b"]], baseOpts);
    expect(s).toContain("<?xml");
    expect(s).toContain("<FixedDocument");
    expect(s).toContain("<Title>T</Title>");
    expect(s).toContain("<Author>A</Author>");
    expect(s).toContain("FixedPage");
  });
  it("escapes special chars in metadata", () => {
    const s = buildFixedDocument([["a"]], { ...baseOpts, title: "A&B" });
    expect(s).toContain("A&amp;B");
  });
});

describe("paginateByLines", () => {
  it("returns at least 1 page", () => {
    expect(paginateByLines("", baseOpts).length).toBe(1);
  });
  it("splits long text into multiple pages", () => {
    const lines = Array.from({ length: 200 }, (_, i) => `line ${i}`);
    expect(paginateByLines(lines.join("\n"), baseOpts).length).toBeGreaterThan(1);
  });
});

describe("isWellFormedXml", () => {
  it("accepts valid xml", () => {
    const xml = `<?xml version="1.0"?><root><child>text</child></root>`;
    expect(isWellFormedXml(xml)).toBe(true);
  });
  it("accepts self-closing tags", () => {
    const xml = `<?xml version="1.0"?><root><child/></root>`;
    expect(isWellFormedXml(xml)).toBe(true);
  });
  it("rejects missing xml declaration", () => {
    expect(isWellFormedXml("<root></root>")).toBe(false);
  });
  it("rejects unbalanced tags", () => {
    expect(isWellFormedXml(`<?xml version="1.0"?><root><child></root>`)).toBe(false);
  });
});

describe("validateOptions", () => {
  it("accepts valid", () => { expect(validateOptions(baseOpts)).toEqual({ ok: true }); });
  it("rejects bad margin", () => { expect(validateOptions({ ...baseOpts, margin: -1 })).toHaveProperty("error"); });
  it("rejects bad font size", () => { expect(validateOptions({ ...baseOpts, fontSize: 200 })).toHaveProperty("error"); });
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
  it("clamps overflow", () => { expect(nextProgress(20, 5, "x").percent).toBe(100); });
});

describe("batchToCsv", () => {
  it("emits header + rows", () => {
    const outcomes: BatchOutcome[] = [
      { id: "a", filename: "a.pdf", success: true, pageCount: 1, outputSize: 10, warnings: [], log: [] },
    ];
    const csv = batchToCsv(outcomes);
    expect(csv).toContain("a.pdf"); expect(csv).toContain("Pages");
  });
});

describe("formatMetadata", () => {
  it("includes title and page size", () => {
    const s = formatMetadata(baseOpts);
    expect(s).toContain("Title: T"); expect(s).toContain("a4");
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

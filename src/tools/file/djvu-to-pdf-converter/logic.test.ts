/**
 * DjVu to PDF Converter — unit tests (pure logic).
 */
import { describe, it, expect } from "vitest";
import {
  pageDimensions, averageCharWidth, usableArea, pageGeometry, findTxtzChunk,
  extractAsciiFromBytes, ocrFallback, applyExtractionMode, wrapParagraph,
  paginateText, estimatePageCount, validateOptions, buildTitlePage, formatLog,
  summarizeResult, nextProgress, batchToCsv, formatMetadata, compressionRatio,
  quickStats, EXTRACTION_MODES, type ConvertOptions, type BatchOutcome,
} from "./logic";

const baseOpts: ConvertOptions = { pageSize: "a4", margin: 50, fontSize: 12, fontFamily: "helvetica" };

describe("pageDimensions", () => {
  it("returns A4 dims", () => { expect(pageDimensions("a4")).toEqual({ w: 595, h: 842 }); });
  it("returns Letter dims", () => { expect(pageDimensions("letter")).toEqual({ w: 612, h: 792 }); });
  it("returns Legal dims", () => { expect(pageDimensions("legal")).toEqual({ w: 612, h: 1008 }); });
});

describe("averageCharWidth", () => {
  it("varies by family", () => {
    expect(averageCharWidth("courier", 12)).not.toBe(averageCharWidth("times-roman", 12));
  });
});

describe("usableArea", () => {
  it("subtracts margins", () => {
    const u = usableArea("a4", 50);
    expect(u.w).toBe(495); expect(u.h).toBe(742);
  });
  it("clamps to 0", () => {
    expect(usableArea("a4", 9999).w).toBe(0);
  });
});

describe("pageGeometry", () => {
  it("returns positive geometry", () => {
    const g = pageGeometry(baseOpts);
    expect(g.charsPerLine).toBeGreaterThan(0);
    expect(g.linesPerPage).toBeGreaterThan(0);
  });
});

describe("findTxtzChunk", () => {
  it("finds TXTz marker", () => {
    const bytes = new Uint8Array([0, 0, 0x54, 0x58, 0x54, 0x7a, 0x41]);
    expect(findTxtzChunk(bytes)).toBe(2);
  });
  it("returns -1 when not present", () => {
    expect(findTxtzChunk(new Uint8Array([1, 2, 3, 4, 5]))).toBe(-1);
  });
});

describe("extractAsciiFromBytes", () => {
  it("keeps printable ASCII", () => {
    const s = extractAsciiFromBytes(new Uint8Array([0x48, 0x69, 0x21])); // Hi!
    expect(s).toBe("Hi!");
  });
  it("collapses long runs of newlines", () => {
    const s = extractAsciiFromBytes(new Uint8Array([0x41, 0x0A, 0x0A, 0x0A, 0x0A, 0x42]));
    expect(s).toBe("A\n\nB");
  });
});

describe("ocrFallback", () => {
  it("replaces non-printable with ?", () => {
    const s = ocrFallback(new Uint8Array([0x41, 0x01, 0x02, 0x42]));
    expect(s).toContain("?");
    expect(s).toContain("A"); expect(s).toContain("B");
  });
});

describe("applyExtractionMode", () => {
  it("plain mode finds TXTz chunk and extracts", () => {
    const bytes = new Uint8Array([0x54, 0x58, 0x54, 0x7a, 0x48, 0x69]);
    const r = applyExtractionMode(bytes, "plain");
    expect(r.text).toBe("Hi");
    expect(r.warnings.length).toBe(0);
  });
  it("layout mode preserves spaces", () => {
    const bytes = new Uint8Array([0x54, 0x58, 0x54, 0x7a, 0x48, 0x20, 0x20, 0x69]);
    const r = applyExtractionMode(bytes, "layout");
    expect(r.text).toContain("  ");
  });
  it("ocr-fallback warns when ? used", () => {
    const r = applyExtractionMode(new Uint8Array([0x41, 0x01, 0x42]), "ocr-fallback");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("falls back when no TXTz chunk", () => {
    const r = applyExtractionMode(new Uint8Array([0x41, 0x42, 0x43]), "plain");
    expect(r.warnings.some((w) => w.includes("TXTz"))).toBe(true);
    expect(r.text).toBe("ABC");
  });
});

describe("wrapParagraph", () => {
  it("wraps long paragraph", () => {
    const lines = wrapParagraph("word ".repeat(50).trim(), 20);
    expect(lines.length).toBeGreaterThan(1);
  });
  it("keeps short paragraph on one line", () => {
    expect(wrapParagraph("hi", 80)).toEqual(["hi"]);
  });
});

describe("paginateText", () => {
  it("returns at least one page", () => {
    expect(paginateText("hello", baseOpts).length).toBeGreaterThanOrEqual(1);
  });
  it("splits long text", () => {
    expect(paginateText("word ".repeat(5000), baseOpts).length).toBeGreaterThan(1);
  });
});

describe("estimatePageCount", () => {
  it("returns positive estimate", () => {
    expect(estimatePageCount("hello", baseOpts)).toBeGreaterThanOrEqual(1);
  });
});

describe("validateOptions", () => {
  it("accepts valid", () => { expect(validateOptions(baseOpts)).toEqual({ ok: true }); });
  it("rejects bad margin", () => {
    expect(validateOptions({ ...baseOpts, margin: -1 })).toHaveProperty("error");
  });
  it("rejects bad mode", () => {
    expect(validateOptions({ ...baseOpts, extractionMode: "bogus" as never })).toHaveProperty("error");
  });
});

describe("buildTitlePage", () => {
  it("contains title and conversion source→target", () => {
    const s = buildTitlePage("T", "A", "DjVu", "PDF");
    expect(s).toContain("T"); expect(s).toContain("by A"); expect(s).toContain("DjVu to PDF");
  });
});

describe("formatLog + summarizeResult", () => {
  it("formatLog numbers entries", () => {
    expect(formatLog(["a", "b"])).toBe("1. a\n2. b");
  });
  it("summarizeResult shows YES and pages", () => {
    const s = summarizeResult({ success: true, inputSize: 1, outputSize: 2, warnings: [], log: [], pageCount: 7 });
    expect(s).toContain("Success: YES"); expect(s).toContain("Pages: 7");
  });
});

describe("nextProgress", () => {
  it("0% at start", () => { expect(nextProgress(0, 5, "x").percent).toBe(0); });
  it("100% at end", () => { expect(nextProgress(5, 5, "x").percent).toBe(100); });
  it("clamps overflow", () => { expect(nextProgress(10, 5, "x").percent).toBe(100); });
});

describe("batchToCsv", () => {
  it("emits header + rows", () => {
    const outcomes: BatchOutcome[] = [
      { id: "a", filename: "a.djvu", success: true, pageCount: 1, outputSize: 10, warnings: [], log: [] },
    ];
    const csv = batchToCsv(outcomes);
    expect(csv.split("\n").length).toBe(2);
    expect(csv).toContain("a.djvu");
  });
});

describe("formatMetadata", () => {
  it("includes page size and extraction mode", () => {
    const s = formatMetadata({ ...baseOpts, extractionMode: "layout" });
    expect(s).toContain("a4"); expect(s).toContain("layout");
  });
});

describe("compressionRatio", () => {
  it("smaller when output < input", () => {
    expect(compressionRatio(2000, 1000)).toBe("2.00:1 (smaller)");
  });
  it("larger when output > input", () => {
    expect(compressionRatio(1000, 2000)).toBe("1:2.00 (larger)");
  });
  it("n/a when output is 0", () => {
    expect(compressionRatio(100, 0)).toBe("n/a");
  });
});

describe("quickStats", () => {
  it("counts chars/words/lines/pages", () => {
    const s = quickStats("a b\nc", 3);
    expect(s.chars).toBe(5); expect(s.words).toBe(3); expect(s.lines).toBe(2); expect(s.pages).toBe(3);
  });
});

describe("EXTRACTION_MODES", () => {
  it("lists 3 modes", () => {
    expect(EXTRACTION_MODES.length).toBe(3);
    expect(EXTRACTION_MODES).toContain("plain");
    expect(EXTRACTION_MODES).toContain("layout");
    expect(EXTRACTION_MODES).toContain("ocr-fallback");
  });
});

/**
 * MOBI to PDF Converter — unit tests (pure logic).
 */
import { describe, it, expect } from "vitest";
import {
  pageDimensions, averageCharWidth, usableArea, pageGeometry, isMobiFile,
  extractAscii, findExthOffset, extractExthMetadata, wrapParagraph, paginateText,
  estimatePageCount, estimateReadingTime, validateOptions, buildTitlePage,
  formatLog, summarizeResult, nextProgress, batchToCsv, formatMetadata,
  compressionRatio, quickStats, MOBI_MAGIC, type ConvertOptions, type BatchOutcome,
} from "./logic";

const baseOpts: ConvertOptions = { pageSize: "a4", margin: 50, fontSize: 12, fontFamily: "helvetica" };

describe("pageDimensions", () => {
  it("returns A4", () => { expect(pageDimensions("a4")).toEqual({ w: 595, h: 842 }); });
  it("returns Letter", () => { expect(pageDimensions("letter")).toEqual({ w: 612, h: 792 }); });
});

describe("averageCharWidth", () => {
  it("varies by family", () => {
    expect(averageCharWidth("courier", 12)).not.toBe(averageCharWidth("times-roman", 12));
  });
});

describe("usableArea + pageGeometry", () => {
  it("subtracts margins", () => { expect(usableArea("a4", 50).w).toBe(495); });
  it("returns positive geometry", () => {
    const g = pageGeometry(baseOpts);
    expect(g.charsPerLine).toBeGreaterThan(0); expect(g.linesPerPage).toBeGreaterThan(0);
  });
});

describe("isMobiFile", () => {
  it("validates magic bytes at offset 60", () => {
    const bytes = new Uint8Array(100);
    for (let i = 0; i < MOBI_MAGIC.length; i++) bytes[60 + i] = MOBI_MAGIC.charCodeAt(i);
    expect(isMobiFile(bytes)).toBe(true);
  });
  it("rejects short buffers", () => {
    expect(isMobiFile(new Uint8Array(10))).toBe(false);
  });
  it("rejects wrong magic", () => {
    const bytes = new Uint8Array(100);
    expect(isMobiFile(bytes)).toBe(false);
  });
});

describe("extractAscii", () => {
  it("keeps printable ASCII", () => {
    expect(extractAscii(new Uint8Array([0x48, 0x69, 0x21]))).toBe("Hi!");
  });
  it("collapses long newlines", () => {
    expect(extractAscii(new Uint8Array([0x41, 0x0A, 0x0A, 0x0A, 0x42]))).toBe("A\n\nB");
  });
});

describe("findExthOffset", () => {
  it("returns -1 for short buffer", () => {
    expect(findExthOffset(new Uint8Array(50))).toBe(-1);
  });
  it("finds EXTH magic in scan range", () => {
    const bytes = new Uint8Array(300);
    bytes[78] = 0; bytes[79] = 0; bytes[80] = 0; bytes[81] = 100; // rec0 offset = 100
    bytes[116] = 0x45; bytes[117] = 0x58; bytes[118] = 0x54; bytes[119] = 0x48; // "EXTH" at 100+16
    expect(findExthOffset(bytes)).toBe(116);
  });
});

describe("extractExthMetadata", () => {
  it("returns fallback when no EXTH", () => {
    const m = extractExthMetadata(new Uint8Array(200));
    expect(m.hasExth).toBe(false);
    expect(m.title).toBe("Untitled");
  });
  it("parses EXTH records when present", () => {
    const bytes = new Uint8Array(400);
    bytes[78] = 0; bytes[79] = 0; bytes[80] = 0; bytes[81] = 100; // rec0 = 100
    bytes[116] = 0x45; bytes[117] = 0x58; bytes[118] = 0x54; bytes[119] = 0x48; // EXTH at 116
    // count = 1 at offset 124
    bytes[124] = 0; bytes[125] = 0; bytes[126] = 0; bytes[127] = 1;
    // record at 128: type=100, len=4+4+5=13, data="Hello"
    bytes[128] = 0; bytes[129] = 0; bytes[130] = 0; bytes[131] = 100; // type 100 (title)
    bytes[132] = 0; bytes[133] = 0; bytes[134] = 0; bytes[135] = 13; // len
    bytes[136] = 0x48; bytes[137] = 0x65; bytes[138] = 0x6C; bytes[139] = 0x6C; bytes[140] = 0x6F; // "Hello"
    const m = extractExthMetadata(bytes);
    expect(m.hasExth).toBe(true);
    expect(m.title).toBe("Hello");
  });
});

describe("wrapParagraph + paginateText", () => {
  it("wraps long paragraph", () => {
    expect(wrapParagraph("word ".repeat(50).trim(), 20).length).toBeGreaterThan(1);
  });
  it("paginates long text", () => {
    expect(paginateText("word ".repeat(5000), baseOpts).length).toBeGreaterThan(1);
  });
  it("returns 1 page for empty", () => {
    expect(paginateText("", baseOpts).length).toBe(1);
  });
});

describe("estimatePageCount", () => {
  it("returns positive", () => { expect(estimatePageCount("hi", baseOpts)).toBeGreaterThanOrEqual(1); });
});

describe("estimateReadingTime", () => {
  it("returns at least 1 minute", () => {
    expect(estimateReadingTime("a b c")).toBeGreaterThanOrEqual(1);
  });
  it("scales with word count", () => {
    expect(estimateReadingTime("word ".repeat(2000))).toBeGreaterThan(estimateReadingTime("word ".repeat(100)));
  });
});

describe("validateOptions", () => {
  it("accepts valid", () => { expect(validateOptions(baseOpts)).toEqual({ ok: true }); });
  it("rejects bad margin", () => { expect(validateOptions({ ...baseOpts, margin: -1 })).toHaveProperty("error"); });
  it("rejects huge font size", () => { expect(validateOptions({ ...baseOpts, fontSize: 200 })).toHaveProperty("error"); });
});

describe("buildTitlePage", () => {
  it("includes title and conversion", () => {
    const s = buildTitlePage("T", "A", "MOBI", "PDF");
    expect(s).toContain("T"); expect(s).toContain("MOBI to PDF");
  });
});

describe("formatLog + summarizeResult", () => {
  it("formatLog numbers", () => { expect(formatLog(["a", "b"])).toBe("1. a\n2. b"); });
  it("summarizeResult", () => {
    const s = summarizeResult({ success: true, inputSize: 1, outputSize: 2, warnings: ["w"], log: [], pageCount: 4 });
    expect(s).toContain("Pages: 4"); expect(s).toContain("- w");
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
      { id: "a", filename: "a.mobi", success: true, pageCount: 1, outputSize: 10, warnings: [], log: [] },
    ];
    const csv = batchToCsv(outcomes);
    expect(csv).toContain("a.mobi");
  });
});

describe("formatMetadata", () => {
  it("includes EXTH flag when provided", () => {
    const s = formatMetadata(baseOpts, { title: "T", author: "A", publisher: "P", language: "en", hasExth: true });
    expect(s).toContain("EXTH header: found");
    expect(s).toContain("Publisher: P");
  });
});

describe("compressionRatio", () => {
  it("smaller", () => { expect(compressionRatio(2000, 1000)).toBe("2.00:1 (smaller)"); });
  it("larger", () => { expect(compressionRatio(1000, 2000)).toBe("1:2.00 (larger)"); });
  it("n/a", () => { expect(compressionRatio(10, 0)).toBe("n/a"); });
});

describe("quickStats", () => {
  it("counts everything including reading time", () => {
    const s = quickStats("a b c d e", 2);
    expect(s.words).toBe(5);
    expect(s.readingMinutes).toBeGreaterThanOrEqual(1);
  });
});

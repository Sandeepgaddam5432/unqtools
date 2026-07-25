/**
 * AZW3 to PDF Converter — unit tests (pure logic).
 */
import { describe, it, expect } from "vitest";
import {
  pageDimensions, averageCharWidth, usableArea, pageGeometry, wrapParagraph,
  cleanupText, detectChapters, generateToc, buildTitlePage, paginateText,
  estimatePageCount, validateOptions, buildLog, formatLog, summarizeResult,
  nextProgress, batchToCsv, formatMetadata, compressionRatio, quickStats,
  type ConvertOptions, type BatchOutcome,
} from "./logic";

const baseOpts: ConvertOptions = { pageSize: "a4", margin: 50, fontSize: 12, fontFamily: "helvetica" };

describe("pageDimensions", () => {
  it("returns A4 595×842", () => { expect(pageDimensions("a4")).toEqual({ w: 595, h: 842 }); });
  it("returns Letter 612×792", () => { expect(pageDimensions("letter")).toEqual({ w: 612, h: 792 }); });
  it("returns Legal 612×1008", () => { expect(pageDimensions("legal")).toEqual({ w: 612, h: 1008 }); });
});

describe("averageCharWidth", () => {
  it("is larger for courier than times", () => {
    expect(averageCharWidth("courier", 12)).toBeGreaterThan(averageCharWidth("times-roman", 12));
  });
  it("scales with font size", () => {
    expect(averageCharWidth("helvetica", 24)).toBeGreaterThan(averageCharWidth("helvetica", 12));
  });
});

describe("usableArea", () => {
  it("subtracts margins from both axes", () => {
    const u = usableArea("a4", 50);
    expect(u.w).toBe(495);
    expect(u.h).toBe(742);
  });
  it("clamps to zero with huge margins", () => {
    const u = usableArea("a4", 1000);
    expect(u.w).toBe(0);
    expect(u.h).toBe(0);
  });
});

describe("pageGeometry", () => {
  it("returns positive chars/line and lines/page", () => {
    const g = pageGeometry(baseOpts);
    expect(g.charsPerLine).toBeGreaterThan(0);
    expect(g.linesPerPage).toBeGreaterThan(0);
  });
});

describe("wrapParagraph", () => {
  it("wraps a long paragraph", () => {
    const text = "word ".repeat(50).trim();
    const lines = wrapParagraph(text, 20);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(20);
  });
  it("returns single line for short paragraph", () => {
    expect(wrapParagraph("hello world", 80)).toEqual(["hello world"]);
  });
});

describe("cleanupText", () => {
  it("replaces smart quotes", () => {
    expect(cleanupText("\u201Cfoo\u201D \u2018bar\u2019")).toBe('"foo" \'bar\'');
  });
  it("joins hyphenated line breaks", () => {
    expect(cleanupText("multi-\nline")).toBe("multiline");
  });
  it("collapses 3+ newlines to 2", () => {
    expect(cleanupText("a\n\n\n\nb")).toBe("a\n\nb");
  });
});

describe("detectChapters", () => {
  it("detects Chapter N headings", () => {
    const text = "Intro\n\nChapter 1\nFoo bar\n\nChapter 2\nBaz qux";
    const chs = detectChapters(text);
    expect(chs.length).toBe(2);
    expect(chs[0]!.title).toBe("Chapter 1");
    expect(chs[1]!.title).toBe("Chapter 2");
  });
  it("detects PART headings", () => {
    const chs = detectChapters("Part 1\nIntro");
    expect(chs.length).toBe(1);
  });
  it("detects all-caps headings", () => {
    const chs = detectChapters("INTRODUCTION\n\nbody text here");
    expect(chs.length).toBe(1);
  });
});

describe("generateToc", () => {
  it("returns empty string when no chapters", () => {
    expect(generateToc([])).toBe("");
  });
  it("lists chapters in order", () => {
    const toc = generateToc([
      { index: 1, title: "Chapter 1", charStart: 0, charEnd: 9, preview: "" },
      { index: 2, title: "Chapter 2", charStart: 100, charEnd: 109, preview: "" },
    ]);
    expect(toc).toContain("Table of Contents");
    expect(toc).toContain("01. Chapter 1");
    expect(toc).toContain("02. Chapter 2");
  });
});

describe("buildTitlePage", () => {
  it("includes title, author, and source→target", () => {
    const s = buildTitlePage("My Book", "Jane", "AZW3", "PDF");
    expect(s).toContain("My Book");
    expect(s).toContain("by Jane");
    expect(s).toContain("AZW3 to PDF");
  });
});

describe("paginateText", () => {
  it("returns at least one page for short text", () => {
    expect(paginateText("hello", baseOpts).length).toBeGreaterThanOrEqual(1);
  });
  it("splits long text into multiple pages", () => {
    const text = "word ".repeat(5000);
    expect(paginateText(text, baseOpts).length).toBeGreaterThan(1);
  });
});

describe("estimatePageCount", () => {
  it("estimates >= 1 page", () => {
    expect(estimatePageCount("hello", baseOpts)).toBeGreaterThanOrEqual(1);
  });
  it("grows with text length", () => {
    const small = estimatePageCount("hello", baseOpts);
    const large = estimatePageCount("word ".repeat(10000), baseOpts);
    expect(large).toBeGreaterThan(small);
  });
});

describe("validateOptions", () => {
  it("accepts valid options", () => { expect(validateOptions(baseOpts)).toEqual({ ok: true }); });
  it("rejects negative margin", () => {
    expect(validateOptions({ ...baseOpts, margin: -5 })).toHaveProperty("error");
  });
  it("rejects out-of-range font size", () => {
    expect(validateOptions({ ...baseOpts, fontSize: 200 })).toHaveProperty("error");
  });
});

describe("buildLog + formatLog", () => {
  it("produces 4 log entries", () => {
    const log = buildLog({ extracted: 1000, pages: 5, bytes: 2000, warnings: 0, source: "AZW3", target: "PDF" });
    expect(log.length).toBe(4);
    expect(log[0]).toContain("1000 chars");
  });
  it("formatLog numbers entries", () => {
    expect(formatLog(["a", "b"])).toBe("1. a\n2. b");
  });
});

describe("summarizeResult", () => {
  it("includes success, sizes, pages, warnings", () => {
    const s = summarizeResult({
      success: true, inputSize: 10, outputSize: 20, warnings: ["w"], log: ["a"], pageCount: 3,
    });
    expect(s).toContain("Success: YES");
    expect(s).toContain("Pages: 3");
    expect(s).toContain("- w");
  });
});

describe("nextProgress", () => {
  it("returns 0% at start", () => {
    const p = nextProgress(0, 10, "starting");
    expect(p.percent).toBe(0);
  });
  it("returns 100% when complete", () => {
    const p = nextProgress(10, 10, "done");
    expect(p.percent).toBe(100);
  });
  it("clamps >100% to 100", () => {
    const p = nextProgress(20, 10, "overflow");
    expect(p.percent).toBe(100);
  });
});

describe("batchToCsv", () => {
  it("emits header + rows", () => {
    const outcomes: BatchOutcome[] = [
      { id: "a", filename: "a.azw3", success: true, pageCount: 5, outputSize: 100, warnings: [], log: [] },
      { id: "b", filename: "b.azw3", success: false, pageCount: 0, outputSize: 0, warnings: ["err"], log: [] },
    ];
    const csv = batchToCsv(outcomes);
    expect(csv.split("\n").length).toBe(3);
    expect(csv).toContain("a.azw3");
    expect(csv).toContain("no");
  });
});

describe("formatMetadata", () => {
  it("includes title and author", () => {
    const s = formatMetadata({ ...baseOpts, title: "T", author: "A" });
    expect(s).toContain("Title: T");
    expect(s).toContain("Author: A");
  });
});

describe("compressionRatio", () => {
  it("returns ratio when output < input", () => {
    expect(compressionRatio(2000, 1000)).toBe("2.00:1 (smaller)");
  });
  it("returns inverted ratio when output > input", () => {
    expect(compressionRatio(1000, 2000)).toBe("1:2.00 (larger)");
  });
  it("returns n/a when output is 0", () => {
    expect(compressionRatio(1000, 0)).toBe("n/a");
  });
});

describe("quickStats", () => {
  it("counts chars, words, lines", () => {
    const s = quickStats("hello world\nfoo", 2);
    expect(s.chars).toBe(15);
    expect(s.words).toBe(3);
    expect(s.lines).toBe(2);
    expect(s.pages).toBe(2);
  });
});

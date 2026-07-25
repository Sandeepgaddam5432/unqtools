import { describe, it, expect } from "vitest";
import {
  process, estimateWidth, measurePerLine, toCsv, measureBatch, charWidthTable,
  autoFitFontSize, truncateToWidth, wrapToWidth, lineHeight, boxHeight,
  validateOptions, glyphFactorFor, FONT_MULTIPLIER, FONT_LABELS, PRESETS,
  ALL_FONTS,
} from "./logic";

const opts = { font: "arial" as const, fontSize: 16 };

describe("estimateWidth", () => {
  it("returns positive width for text", () => {
    expect(estimateWidth("hello", opts)).toBeGreaterThan(0);
  });
  it("returns 0 for empty string", () => {
    expect(estimateWidth("", opts)).toBe(0);
  });
  it("scales with font size", () => {
    const small = estimateWidth("hi", { font: "arial", fontSize: 8 });
    const large = estimateWidth("hi", { font: "arial", fontSize: 32 });
    expect(large).toBeGreaterThan(small);
  });
  it("applies bold factor", () => {
    const normal = estimateWidth("hi", { font: "arial", fontSize: 16 });
    const bold = estimateWidth("hi", { font: "arial", fontSize: 16, fontWeight: 700 });
    expect(bold).toBeGreaterThanOrEqual(normal);
  });
  it("applies italic factor", () => {
    const normal = estimateWidth("hi", { font: "arial", fontSize: 16 });
    const italic = estimateWidth("hi", { font: "arial", fontSize: 16, italic: true });
    expect(italic).toBeGreaterThanOrEqual(normal);
  });
  it("includes letter spacing", () => {
    const without = estimateWidth("abc", { font: "arial", fontSize: 16 });
    const withLs = estimateWidth("abc", { font: "arial", fontSize: 16, letterSpacing: 2 });
    expect(withLs).toBeGreaterThan(without);
  });
});

describe("process", () => {
  it("computes widthPerChar", () => {
    const r = process("hello", opts);
    expect(r.charCount).toBe(5);
    expect(r.widthPerChar).toBeCloseTo(r.width / 5, 5);
  });
  it("warns on empty input", () => {
    const r = process("", opts);
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.width).toBe(0);
  });
  it("counts surrogate pairs as 1 char", () => {
    const r = process("a😀b", opts);
    expect(r.charCount).toBe(3);
  });
});

describe("glyphFactorFor", () => {
  it("returns 0.6 for courier (monospace)", () => {
    expect(glyphFactorFor(0x41, "courier")).toBe(0.6);
  });
  it("returns larger factor for m vs i in arial", () => {
    expect(glyphFactorFor(0x6d, "arial")).toBeGreaterThan(glyphFactorFor(0x69, "arial"));
  });
  it("applies font multiplier for verdana", () => {
    expect(glyphFactorFor(0x61, "verdana")).toBeGreaterThan(glyphFactorFor(0x61, "arial"));
  });
});

describe("charWidthTable", () => {
  it("returns entry per char", () => {
    const table = charWidthTable("abc", opts);
    expect(table.length).toBe(3);
    expect(table[0]!.char).toBe("a");
    expect(table[0]!.widthPx).toBeGreaterThan(0);
  });
  it("handles surrogate pairs", () => {
    const table = charWidthTable("😀", opts);
    expect(table.length).toBe(1);
    expect(table[0]!.codePoint).toBe(0x1f600);
  });
});

describe("measurePerLine + toCsv", () => {
  it("measures each line independently", () => {
    const rows = measurePerLine("hello\nworld", opts);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.width).toBeGreaterThan(0);
  });
  it("generates CSV header", () => {
    const csv = toCsv(measurePerLine("hi", opts), ["hi"]);
    expect(csv.split("\n")[0]).toBe("Line,CharCount,WidthPx,WidthPerChar");
    expect(csv).toContain("hi");
  });
});

describe("measureBatch", () => {
  it("measures each input", () => {
    const results = measureBatch(["hello", "world"], opts);
    expect(results.length).toBe(2);
    expect(results[0]!.charCount).toBe(5);
  });
});

describe("autoFitFontSize", () => {
  it("returns smaller size for longer text", () => {
    const small = autoFitFontSize("hi", "arial", 100);
    const large = autoFitFontSize("hello world this is a long string", "arial", 100);
    expect(large).toBeLessThanOrEqual(small);
  });
  it("returns max size for short text", () => {
    expect(autoFitFontSize("", "arial", 100)).toBe(200);
  });
  it("never goes below 6", () => {
    expect(autoFitFontSize("a".repeat(1000), "arial", 50)).toBeGreaterThanOrEqual(6);
  });
});

describe("truncateToWidth", () => {
  it("returns text unchanged if it fits", () => {
    const out = truncateToWidth("hi", { font: "arial", fontSize: 16 }, 1000);
    expect(out).toBe("hi");
  });
  it("truncates and adds ellipsis", () => {
    const out = truncateToWidth("hello world this is too long", { font: "arial", fontSize: 16 }, 50);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThan("hello world this is too long".length + 1);
  });
});

describe("wrapToWidth", () => {
  it("wraps long text to multiple lines", () => {
    const lines = wrapToWidth("the quick brown fox jumps over the lazy dog", { font: "arial", fontSize: 16 }, 80);
    expect(lines.length).toBeGreaterThan(1);
  });
  it("keeps short text on one line", () => {
    const lines = wrapToWidth("hi", { font: "arial", fontSize: 16 }, 1000);
    expect(lines).toEqual(["hi"]);
  });
});

describe("lineHeight + boxHeight", () => {
  it("computes line height", () => {
    expect(lineHeight({ font: "arial", fontSize: 16 })).toBe(19);
  });
  it("computes box height for N lines", () => {
    expect(boxHeight(3, { font: "arial", fontSize: 16 })).toBe(57);
  });
});

describe("validateOptions", () => {
  it("accepts valid", () => { expect(validateOptions({ font: "arial", fontSize: 16 })).toEqual({ ok: true }); });
  it("rejects bad font", () => {
    expect(validateOptions({ font: "bogus" as never, fontSize: 16 })).toHaveProperty("error");
  });
  it("rejects out-of-range font size", () => {
    expect(validateOptions({ font: "arial", fontSize: 500 })).toHaveProperty("error");
  });
  it("rejects bad weight", () => {
    expect(validateOptions({ font: "arial", fontSize: 16, fontWeight: 350 })).toHaveProperty("error");
  });
});

describe("constants", () => {
  it("FONT_MULTIPLIER has 7 entries", () => { expect(Object.keys(FONT_MULTIPLIER).length).toBe(7); });
  it("FONT_LABELS has 7 entries", () => { expect(Object.keys(FONT_LABELS).length).toBe(7); });
  it("PRESETS has 6 entries", () => { expect(PRESETS.length).toBe(6); });
  it("ALL_FONTS has 7 entries", () => { expect(ALL_FONTS.length).toBe(7); });
});

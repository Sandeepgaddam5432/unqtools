import { describe, it, expect } from "vitest";
import { process, estimateWidth, measurePerLine, toCsv } from "./logic";

const opts = { font: "Arial", fontSize: 16 };

describe("estimateWidth", () => {
  it("returns positive width for text", () => {
    expect(estimateWidth("hello", opts)).toBeGreaterThan(0);
  });
  it("returns 0 for empty string", () => {
    expect(estimateWidth("", opts)).toBe(0);
  });
  it("scales with font size", () => {
    const small = estimateWidth("hi", { font: "Arial", fontSize: 8 });
    const large = estimateWidth("hi", { font: "Arial", fontSize: 32 });
    expect(large).toBeGreaterThan(small);
  });
  it("applies bold factor", () => {
    const normal = estimateWidth("hi", { font: "Arial", fontSize: 16 });
    const bold = estimateWidth("hi", { font: "Arial", fontSize: 16, fontWeight: 700 });
    expect(bold).toBeGreaterThanOrEqual(normal);
  });
});

describe("process", () => {
  it("computes widthPerChar", () => {
    const r = process("hello", opts);
    if ("error" in r) throw new Error("err");
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

describe("measurePerLine", () => {
  it("measures each line independently", () => {
    const rows = measurePerLine("hello\nworld", opts);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.width).toBeGreaterThan(0);
    expect(rows[1]!.width).toBeGreaterThan(0);
  });
});

describe("toCsv", () => {
  it("generates CSV header", () => {
    const csv = toCsv(measurePerLine("hi", opts), ["hi"]);
    expect(csv.split("\n")[0]).toBe("Line,CharCount,WidthPx,WidthPerChar");
    expect(csv).toContain("hi");
  });
});

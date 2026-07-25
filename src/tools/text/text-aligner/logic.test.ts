import { describe, it, expect } from "vitest";
import {
  process, previewLine, lineLengthStats, autoFitWidth, validateOptions,
  batchProcess, batchToCsv, fmt,
} from "./logic";

describe("process — left/right/center", () => {
  it("left-aligns with fill", () => {
    const r = process("hi", { width: 5, alignment: "left" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("hi   ");
  });
  it("right-aligns", () => {
    const r = process("hi", { width: 5, alignment: "right" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("   hi");
  });
  it("center-aligns (extra on right)", () => {
    const r = process("hi", { width: 5, alignment: "center" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(" hi  ");
  });
  it("supports custom fill char", () => {
    const r = process("hi", { width: 5, alignment: "left", fillChar: "-" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("hi---");
  });
});

describe("process — justify", () => {
  it("justifies single line with spaces", () => {
    const r = process("the quick fox", { width: 20, alignment: "justify", justifyLastLine: true });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("the     quick    fox");
    expect(r.output.length).toBe(20);
  });
  it("last line is left-aligned by default", () => {
    const r = process("short\nfinal line here", { width: 20, alignment: "justify" });
    if ("error" in r) throw new Error("err");
    const lines = r.output.split("\n");
    expect(lines[1]).toBe("final line here     ");
  });
  it("justifyLastLine option justifies final line", () => {
    const r = process("a b c", { width: 10, alignment: "justify", justifyLastLine: true });
    if ("error" in r) throw new Error("err");
    expect(r.output.length).toBe(10);
  });
  it("justify with single word falls back to left", () => {
    const r = process("hello", { width: 10, alignment: "justify" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("hello     ");
  });
});

describe("errors and edges", () => {
  it("errors on zero width", () => {
    expect("error" in process("hi", { width: 0, alignment: "left" })).toBe(true);
  });
  it("errors on width > 1000", () => {
    expect("error" in process("hi", { width: 2000, alignment: "left" })).toBe(true);
  });
  it("truncates lines longer than width", () => {
    const r = process("hello world", { width: 5, alignment: "left" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("hello");
    expect(r.truncatedLines).toBe(1);
  });
  it("handles multi-line input", () => {
    const r = process("a\nb\nc", { width: 3, alignment: "left" });
    if ("error" in r) throw new Error("err");
    expect(r.linesProcessed).toBe(3);
  });
  it("collects lineLengths", () => {
    const r = process("a\nbb\nccc", { width: 3, alignment: "left" });
    if ("error" in r) throw new Error("err");
    expect(r.lineLengths).toEqual([3, 3, 3]);
  });
});

describe("previewLine", () => {
  it("returns aligned single line", () => {
    expect(previewLine("hi", { width: 4, alignment: "right" })).toBe("  hi");
  });
});

describe("lineLengthStats", () => {
  it("computes min/max/avg", () => {
    const s = lineLengthStats([3, 5, 7]);
    expect(s.min).toBe(3);
    expect(s.max).toBe(7);
    expect(s.avg).toBeCloseTo(5, 5);
  });
  it("returns zeros for empty", () => {
    expect(lineLengthStats([])).toEqual({ min: 0, max: 0, avg: 0, total: 0 });
  });
});

describe("autoFitWidth", () => {
  it("returns longest line length", () => {
    expect(autoFitWidth("hi\nhello\nhey")).toBe(5);
  });
  it("returns 1 for empty", () => {
    expect(autoFitWidth("")).toBe(1);
  });
});

describe("validateOptions", () => {
  it("accepts valid options", () => {
    expect(validateOptions({ width: 10, alignment: "left" })).toEqual({ ok: true });
  });
  it("rejects non-positive width", () => {
    expect(validateOptions({ width: 0, alignment: "left" })).toHaveProperty("error");
  });
  it("rejects unknown alignment", () => {
    expect(validateOptions({ width: 10, alignment: "bogus" as never })).toHaveProperty("error");
  });
  it("rejects multi-char fill", () => {
    expect(validateOptions({ width: 10, alignment: "left", fillChar: "ab" })).toHaveProperty("error");
  });
});

describe("batchProcess / batchToCsv", () => {
  it("returns result per input", () => {
    const r = batchProcess(["hi", "hello"], { width: 10, alignment: "left" });
    expect(r).toHaveLength(2);
  });
  it("renders CSV with header", () => {
    const csv = batchToCsv(batchProcess(["hi"], { width: 10, alignment: "left" }));
    expect(csv.split("\n")[0]).toBe("index,linesProcessed,truncatedLines,output");
    expect(csv).toContain("hi");
  });
});

describe("fmt", () => {
  it("trims precision", () => {
    expect(fmt(1.23456, 2)).toBe("1.23");
  });
  it("em-dash for NaN", () => {
    expect(fmt(NaN)).toBe("—");
  });
});

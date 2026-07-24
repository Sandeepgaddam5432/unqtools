import { describe, it, expect } from "vitest";
import { process, previewLine } from "./logic";

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
});

describe("process — justify", () => {
  it("justifies single line with spaces", () => {
    const r = process("the quick fox", { width: 20, alignment: "justify", justifyLastLine: true });
    if ("error" in r) throw new Error("err");
    // 3 words: "the"(3) "quick"(5) "fox"(3) = 11 chars; 9 spaces in 2 gaps
    // base = 4, extra = 1 (first gap gets 5)
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
});

describe("errors and edges", () => {
  it("errors on zero width", () => {
    const r = process("hi", { width: 0, alignment: "left" });
    expect("error" in r).toBe(true);
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
});

describe("previewLine", () => {
  it("returns aligned single line", () => {
    expect(previewLine("hi", { width: 4, alignment: "right" })).toBe("  hi");
  });
});

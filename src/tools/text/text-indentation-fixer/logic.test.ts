import { describe, it, expect } from "vitest";
import { process, detectIndent } from "./logic";

describe("process — tabs to spaces", () => {
  it("converts tabs to spaces", () => {
    const r = process("\thello", { toStyle: "spaces", tabWidth: 4 });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("    hello");
  });
  it("respects tab stops at column boundaries", () => {
    const r = process("  \thello", { toStyle: "spaces", tabWidth: 4 });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("    hello");
  });
});

describe("process — spaces to tabs", () => {
  it("converts spaces to tabs", () => {
    const r = process("        hello", { toStyle: "tabs", tabWidth: 4 });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("\t\thello");
  });
  it("preserves partial space remainder", () => {
    const r = process("     hello", { toStyle: "tabs", tabWidth: 4 });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("\t hello");
  });
});

describe("process — normalize depth", () => {
  it("rounds to nearest indent unit", () => {
    // 6 spaces with tabWidth 4 — rounds to 1.5 → 2 (depth) → 8 spaces
    const r = process("      hello", { toStyle: "spaces", tabWidth: 4, normalizeDepth: "depth" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("        hello");
  });
});

describe("detectIndent", () => {
  it("detects tabs", () => {
    expect(detectIndent("\ta\n\t\tb").style).toBe("tabs");
  });
  it("detects spaces", () => {
    expect(detectIndent("    a\n        b").style).toBe("spaces");
  });
  it("detects mixed", () => {
    expect(detectIndent("\ta\n    b").style).toBe("mixed");
  });
});

describe("process — errors and edge", () => {
  it("errors on invalid tabWidth", () => {
    const r = process("hi", { toStyle: "spaces", tabWidth: 0 });
    expect("error" in r).toBe(true);
  });
  it("handles lines with no indent", () => {
    const r = process("hello\nworld", { toStyle: "spaces", tabWidth: 4 });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("hello\nworld");
  });
  it("warns on mixed indentation", () => {
    const r = process("  \t hello", { toStyle: "spaces", tabWidth: 4 });
    if ("error" in r) throw new Error("err");
    expect(r.mixedIndentLines).toBe(1);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

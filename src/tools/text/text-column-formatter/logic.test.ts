import { describe, it, expect } from "vitest";
import { process, toCsv } from "./logic";

describe("process — basic", () => {
  it("formats items into columns", () => {
    const r = process("a b c d", { columns: 2, width: 5, separator: "|", alignment: "left" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("a    |b    \nc    |d    ");
  });
  it("pads with custom fillChar", () => {
    const r = process("a b", { columns: 2, width: 4, separator: "|", alignment: "left", fillChar: "." });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("a...|b...");
  });
});

describe("alignment", () => {
  it("right-aligns", () => {
    const r = process("a b", { columns: 2, width: 4, separator: "|", alignment: "right" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("   a|   b");
  });
  it("center-aligns", () => {
    const r = process("a b", { columns: 2, width: 5, separator: "|", alignment: "center" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("  a  |  b  ");
  });
});

describe("errors", () => {
  it("errors on zero columns", () => {
    const r = process("a", { columns: 0, width: 5, separator: "|", alignment: "left" });
    expect("error" in r).toBe(true);
  });
  it("errors on zero width", () => {
    const r = process("a", { columns: 2, width: 0, separator: "|", alignment: "left" });
    expect("error" in r).toBe(true);
  });
  it("errors on empty separator", () => {
    const r = process("a", { columns: 2, width: 5, separator: "", alignment: "left" });
    expect("error" in r).toBe(true);
  });
});

describe("edge", () => {
  it("handles more rows than columns", () => {
    const r = process("a b c d e f", { columns: 3, width: 3, separator: " ", alignment: "left" });
    if ("error" in r) throw new Error("err");
    expect(r.rowsOutput).toBe(2);
  });
  it("warns on empty input", () => {
    const r = process("   ", { columns: 2, width: 5, separator: "|", alignment: "left" });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("truncates strings longer than width", () => {
    const r = process("hello", { columns: 1, width: 3, separator: "|", alignment: "left" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("hel");
  });
});

describe("toCsv", () => {
  it("generates CSV", () => {
    const csv = toCsv("a b c d", { columns: 2, width: 5, separator: "|", alignment: "left" });
    expect(csv).toBe("a,b\nc,d");
  });
});

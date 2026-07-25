import { describe, it, expect } from "vitest";
import { process, toCsv, toMarkdown, parseCsvLine, tokenize, validateOptions } from "./logic";

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

describe("border mode", () => {
  it("draws a border around the table", () => {
    const r = process("a b", { columns: 2, width: 3, separator: "", alignment: "left", border: true });
    if ("error" in r) throw new Error("err");
    expect(r.output).toContain("┌");
    expect(r.output).toContain("┐");
    expect(r.output).toContain("a");
  });
});

describe("header", () => {
  it("renders header above data", () => {
    const r = process("a b", { columns: 2, width: 4, separator: "|", alignment: "left", header: ["X", "Y"] });
    if ("error" in r) throw new Error("err");
    const lines = r.output.split("\n");
    expect(lines[0]).toContain("X");
    expect(lines[0]).toContain("Y");
  });
});

describe("CSV input", () => {
  it("parses CSV lines as input", () => {
    const r = process("a,b\nc,d", { columns: 2, width: 3, separator: "|", alignment: "left", csvInput: true });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("a  |b  \nc  |d  ");
  });
  it("supports custom delimiter", () => {
    const r = process("a;b\nc;d", { columns: 2, width: 3, separator: "|", alignment: "left", csvInput: true, csvDelimiter: ";" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("a  |b  \nc  |d  ");
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
  it("errors on empty separator without border", () => {
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
    expect(r.stats.truncated).toBe(1);
  });
  it("returns stats", () => {
    const r = process("a b c d", { columns: 2, width: 5, separator: "|", alignment: "left" });
    if ("error" in r) throw new Error("err");
    expect(r.stats.totalItems).toBe(4);
    expect(r.stats.rows).toBe(2);
    expect(r.stats.padded).toBeGreaterThan(0);
  });
});

describe("toCsv", () => {
  it("generates CSV", () => {
    const csv = toCsv("a b c d", { columns: 2, width: 5, separator: "|", alignment: "left" });
    expect(csv).toBe("a,b\nc,d");
  });
  it("escapes quotes and commas", () => {
    const csv = toCsv('a,b "x" c', { columns: 1, width: 5, separator: "|", alignment: "left" });
    expect(csv).toContain('"');
  });
  it("includes header when provided", () => {
    const csv = toCsv("a b", { columns: 2, width: 5, separator: "|", alignment: "left", header: ["X", "Y"] });
    expect(csv.split("\n")[0]).toBe("X,Y");
  });
});

describe("toMarkdown", () => {
  it("generates Markdown table", () => {
    const md = toMarkdown("a b", { columns: 2, width: 5, separator: "|", alignment: "left" });
    expect(md.split("\n")[0]).toContain("|");
    expect(md).toContain("---");
  });
});

describe("parseCsvLine", () => {
  it("parses simple line", () => {
    expect(parseCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted fields", () => {
    expect(parseCsvLine('a,"b,c",d')).toEqual(["a", "b,c", "d"]);
  });
  it("handles escaped quotes", () => {
    expect(parseCsvLine('"a""b"')).toEqual(['a"b']);
  });
});

describe("tokenize", () => {
  it("splits on whitespace by default", () => {
    expect(tokenize("a b c")).toEqual(["a", "b", "c"]);
  });
  it("parses CSV when csvInput is true", () => {
    expect(tokenize("a,b\nc,d", { csvInput: true })).toEqual(["a", "b", "c", "d"]);
  });
});

describe("validateOptions", () => {
  it("accepts valid options", () => {
    expect(validateOptions({ columns: 2, width: 5, separator: "|", alignment: "left" })).toEqual({ ok: true });
  });
  it("rejects too many columns", () => {
    expect("error" in validateOptions({ columns: 50, width: 5, separator: "|", alignment: "left" })).toBe(true);
  });
});

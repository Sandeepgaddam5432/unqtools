import { describe, it, expect } from "vitest";
import { process, batchToCsv } from "./logic";

describe("process — lines, exact", () => {
  it("removes exact duplicate lines", () => {
    const r = process("a\nb\na\nc", { mode: "lines", method: "exact" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("a\nb\nc");
    expect(r.duplicatesRemoved).toBe(1);
  });
  it("keeps order by default", () => {
    const r = process("c\nb\na\nc", { mode: "lines", method: "exact" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("c\nb\na");
  });
});

describe("process — words", () => {
  it("removes duplicate words", () => {
    const r = process("the cat the dog", { mode: "words", method: "exact" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("the cat dog");
    expect(r.duplicatesRemoved).toBe(1);
  });
});

describe("process — case-insensitive", () => {
  it("treats case variants as duplicates", () => {
    const r = process("Hello\nhello\nHELLO", { mode: "lines", method: "case-insensitive" });
    if ("error" in r) throw new Error("err");
    expect(r.outputCount).toBe(1);
  });
});

describe("process — fuzzy", () => {
  it("removes near-duplicates by threshold", () => {
    const r = process("apple\nappel\nbanana", { mode: "lines", method: "fuzzy", fuzzyThreshold: 0.5 });
    if ("error" in r) throw new Error("err");
    expect(r.outputCount).toBe(2);
  });
  it("errors on invalid threshold", () => {
    const r = process("x", { mode: "lines", method: "fuzzy", fuzzyThreshold: 1.5 });
    expect("error" in r).toBe(true);
  });
});

describe("process — sort", () => {
  it("sorts output when sortOutput", () => {
    const r = process("c\nb\na", { mode: "lines", method: "exact", sortOutput: true });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("a\nb\nc");
  });
});

describe("process — empty", () => {
  it("warns on empty input", () => {
    const r = process("", { mode: "lines", method: "exact" });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.inputCount).toBe(1); // "".split("\n") = [""]
  });
});

describe("batchToCsv", () => {
  it("generates CSV header", () => {
    const csv = batchToCsv([], []);
    expect(csv.split("\n")[0]).toBe("Label,InputCount,OutputCount,DuplicatesRemoved");
  });
});

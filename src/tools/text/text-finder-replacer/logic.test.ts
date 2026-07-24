import { describe, it, expect } from "vitest";
import { process, batchProcess, batchToCsv } from "./logic";

describe("process — literal", () => {
  it("replaces literal text", () => {
    const r = process("hello world", { find: "world", replace: "there" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("hello there");
    expect(r.matches).toBe(1);
  });
  it("is case-insensitive by default", () => {
    const r = process("Hello World", { find: "hello", replace: "hi" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("hi World");
    expect(r.matches).toBe(1);
  });
  it("respects caseSensitive flag", () => {
    const r = process("Hello hello", { find: "hello", replace: "x", caseSensitive: true });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("Hello x");
    expect(r.matches).toBe(1);
  });
});

describe("process — whole word", () => {
  it("matches whole words only", () => {
    const r = process("cat catalog cat", { find: "cat", replace: "dog", wholeWord: true });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("dog catalog dog");
    expect(r.matches).toBe(2);
  });
});

describe("process — regex", () => {
  it("supports regex patterns", () => {
    const r = process("a1 b2 c3", { find: "\\d", replace: "#", useRegex: true });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("a# b# c#");
    expect(r.matches).toBe(3);
  });
  it("supports capture group backrefs $1", () => {
    const r = process("hello", { find: "(h)(e)", replace: "$2$1", useRegex: true });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe("ehllo");
  });
  it("returns error on invalid regex", () => {
    const r = process("hi", { find: "(", replace: "x", useRegex: true });
    expect("error" in r).toBe(true);
  });
});

describe("process — edge", () => {
  it("errors on empty find", () => {
    const r = process("hi", { find: "", replace: "x" });
    expect("error" in r).toBe(true);
  });
  it("warns when no matches", () => {
    const r = process("hi", { find: "zzz", replace: "x" });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.matches).toBe(0);
  });
  it("tracks match line numbers", () => {
    const r = process("a\na\na", { find: "a", replace: "b" });
    if ("error" in r) throw new Error("err");
    expect(r.matchLines).toEqual([1, 2, 3]);
  });
});

describe("batchProcess", () => {
  it("processes multiple inputs", () => {
    const rows = batchProcess(["cat", "dog"], { find: "a", replace: "x" });
    expect(rows).toHaveLength(2);
    const out0 = rows[0]!.result;
    if ("error" in out0) throw new Error("err");
    expect(out0.output).toBe("cxt");
  });
});

describe("batchToCsv", () => {
  it("generates CSV with header", () => {
    const rows = batchProcess(["hi"], { find: "hi", replace: "yo" });
    const csv = batchToCsv(rows);
    expect(csv.split("\n")[0]).toBe("Input,Output,Matches");
    expect(csv).toContain("yo");
  });
});

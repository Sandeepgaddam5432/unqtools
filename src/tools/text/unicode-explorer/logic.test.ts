import { describe, it, expect } from "vitest";
import { process, toCsv } from "./logic";

describe("process — basic ASCII", () => {
  it("processes single ASCII char", () => {
    const r = process("A");
    expect(r.chars).toHaveLength(1);
    expect(r.chars[0]!.char).toBe("A");
    expect(r.chars[0]!.codePoint).toBe(65);
    expect(r.chars[0]!.hex).toBe("U+0041");
  });
  it("computes UTF-8 for ASCII", () => {
    const r = process("A");
    expect(r.chars[0]!.utf8).toBe("41");
  });
  it("computes UTF-8 for 2-byte char", () => {
    const r = process("é");
    expect(r.chars[0]!.utf8).toBe("C3 A9");
  });
  it("computes UTF-8 for 3-byte char", () => {
    const r = process("€");
    expect(r.chars[0]!.utf8).toBe("E2 82 AC");
  });
});

describe("process — emoji and surrogate pairs", () => {
  it("handles 4-byte emoji", () => {
    const r = process("😀");
    expect(r.chars).toHaveLength(1);
    expect(r.chars[0]!.codePoint).toBe(0x1f600);
    expect(r.chars[0]!.utf8).toBe("F0 9F 98 80");
  });
  it("counts surrogate pair as 1 char", () => {
    const r = process("a😀b");
    expect(r.chars).toHaveLength(3);
    expect(r.total).toBe(3);
  });
});

describe("process — naming", () => {
  it("names uppercase letters", () => {
    const r = process("Z");
    expect(r.chars[0]!.name).toContain("LATIN CAPITAL LETTER");
  });
  it("identifies block", () => {
    const r = process("A");
    expect(r.chars[0]!.block).toBe("Basic Latin");
  });
  it("identifies emoji block", () => {
    const r = process("😀");
    expect(r.chars[0]!.block).toBe("Emoticons");
  });
});

describe("process — edge", () => {
  it("warns on empty input", () => {
    const r = process("");
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.total).toBe(0);
  });
});

describe("toCsv", () => {
  it("generates CSV with header", () => {
    const csv = toCsv(process("AB"));
    expect(csv.split("\n")[0]).toBe("Char,CodePoint,Hex,UTF8,UTF16,UTF32,Name,Block,Category");
    expect(csv).toContain("U+0041");
  });
});

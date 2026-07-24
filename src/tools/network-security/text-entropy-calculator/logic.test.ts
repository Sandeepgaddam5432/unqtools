import { describe, it, expect } from "vitest";
import { process, toCsv } from "./logic";

describe("process — basic", () => {
  it("computes 0 entropy for empty input", () => {
    const r = process("");
    expect(r.shannonEntropy).toBe(0);
    expect(r.charCount).toBe(0);
  });
  it("computes 0 entropy for single repeated char", () => {
    const r = process("aaaa");
    expect(r.shannonEntropy).toBe(0);
  });
  it("computes 1 bit per char for 50/50 binary", () => {
    const r = process("0101");
    expect(r.shannonEntropy).toBeCloseTo(1, 3);
  });
  it("computes 2 bits per char for 4 unique equal chars", () => {
    const r = process("abcd");
    expect(r.shannonEntropy).toBeCloseTo(2, 3);
  });
});

describe("process — case sensitivity", () => {
  it("is case-sensitive by default", () => {
    const r = process("AaAa");
    expect(r.uniqueChars).toBe(2);
  });
  it("is case-insensitive when option set", () => {
    const r = process("AaAa", { caseSensitive: false });
    expect(r.uniqueChars).toBe(1);
  });
});

describe("process — frequency", () => {
  it("tracks top chars", () => {
    const r = process("aaabb");
    expect(r.topChars[0]!.char).toBe("a");
    expect(r.topChars[0]!.count).toBe(3);
    expect(r.topChars[1]!.count).toBe(2);
  });
  it("computes frequency", () => {
    const r = process("aab");
    expect(r.topChars[0]!.frequency).toBeCloseTo(2 / 3, 3);
  });
});

describe("process — randomness", () => {
  it("gives 100 for uniform distribution", () => {
    const r = process("abcd");
    expect(r.randomnessScore).toBe(100);
  });
  it("gives lower score for skewed distribution", () => {
    const r = process("aaaaabcd");
    expect(r.randomnessScore).toBeLessThan(100);
  });
  it("warns on small sample", () => {
    const r = process("ab");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("toCsv", () => {
  it("generates CSV with header", () => {
    const csv = toCsv(process("aaabb"));
    expect(csv.split("\n")[0]).toBe("Char,Count,Frequency");
    expect(csv).toContain('"a",3');
  });
});

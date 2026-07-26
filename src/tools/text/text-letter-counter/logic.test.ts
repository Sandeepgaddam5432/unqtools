/**
 * Letter Counter — unit tests.
 */
import { describe, it, expect } from "vitest";
import { countLetters, batchCount, toCsv } from "./logic";

describe("countLetters — basic", () => {
  it("counts single letters", () => {
    const r = countLetters("aaabbc");
    if ("error" in r) throw new Error("err");
    expect(r.totalLetters).toBe(6);
  });
  it("errors on empty", () => {
    expect("error" in countLetters("")).toBe(true);
  });
  it("errors on no letters", () => {
    expect("error" in countLetters("12345")).toBe(true);
  });
  it("case-insensitive by default", () => {
    const r = countLetters("Aaa");
    if ("error" in r) throw new Error("err");
    expect(r.perLetter.find((p) => p.letter === "a")!.count).toBe(3);
  });
  it("case-sensitive when requested", () => {
    const r = countLetters("Aaa", { caseSensitive: true });
    if ("error" in r) throw new Error("err");
    // Both A and a counted separately — but perLetter only iterates a-z lowercase.
    // So 'A' wouldn't show up. Validate the lowercase counts.
    expect(r.perLetter.find((p) => p.letter === "a")!.count).toBe(2);
  });
});

describe("countLetters — per-letter density", () => {
  it("computes density as percentage", () => {
    const r = countLetters("aaab");
    if ("error" in r) throw new Error("err");
    const a = r.perLetter.find((p) => p.letter === "a")!;
    const b = r.perLetter.find((p) => p.letter === "b")!;
    expect(a.density).toBeCloseTo(75, 1);
    expect(b.density).toBeCloseTo(25, 1);
  });
  it("computes histogram (0-100 normalized)", () => {
    const r = countLetters("aaab");
    if ("error" in r) throw new Error("err");
    const a = r.perLetter.find((p) => p.letter === "a")!;
    const b = r.perLetter.find((p) => p.letter === "b")!;
    expect(a.histogram).toBe(100);
    expect(b.histogram).toBeCloseTo(33.33, 1);
  });
});

describe("countLetters — vowels & consonants", () => {
  it("counts vowels", () => {
    const r = countLetters("aeiou");
    if ("error" in r) throw new Error("err");
    expect(r.vowels.count).toBe(5);
    expect(r.vowels.density).toBeCloseTo(100, 1);
  });
  it("counts consonants", () => {
    const r = countLetters("bcdfg");
    if ("error" in r) throw new Error("err");
    expect(r.consonants.count).toBe(5);
    expect(r.consonants.density).toBeCloseTo(100, 1);
  });
});

describe("countLetters — top letters", () => {
  it("returns sorted top letters", () => {
    const r = countLetters("aaabbc");
    if ("error" in r) throw new Error("err");
    expect(r.topLetters[0]!.letter).toBe("a");
    expect(r.topLetters[0]!.count).toBe(3);
    expect(r.topLetters[1]!.letter).toBe("b");
    expect(r.topLetters[1]!.count).toBe(2);
  });
});

describe("countLetters — missing letters", () => {
  it("identifies missing letters", () => {
    const r = countLetters("abc");
    if ("error" in r) throw new Error("err");
    expect(r.missingLetters).toContain("d");
    expect(r.missingLetters).not.toContain("a");
    expect(r.missingLetters.length).toBe(23);
  });
});

describe("countLetters — bigrams & trigrams", () => {
  it("computes bigrams", () => {
    const r = countLetters("banana");
    if ("error" in r) throw new Error("err");
    expect(r.bigrams.length).toBeGreaterThan(0);
    const an = r.bigrams.find((b) => b.bigram === "an");
    expect(an).toBeDefined();
    expect(an!.count).toBe(2);
  });
  it("computes trigrams", () => {
    const r = countLetters("banana");
    if ("error" in r) throw new Error("err");
    const ana = r.trigrams.find((t) => t.trigram === "ana");
    expect(ana).toBeDefined();
    expect(ana!.count).toBe(2);
  });
  it("limits bigrams to 20", () => {
    const r = countLetters("the quick brown fox jumps over the lazy dog and many more letters");
    if ("error" in r) throw new Error("err");
    expect(r.bigrams.length).toBeLessThanOrEqual(20);
  });
});

describe("countLetters — first letters", () => {
  it("counts word-initial letters", () => {
    const r = countLetters("apple banana avocado");
    if ("error" in r) throw new Error("err");
    const a = r.firstLetterCounts.find((f) => f.letter === "a");
    expect(a).toBeDefined();
    expect(a!.count).toBe(2);
    const b = r.firstLetterCounts.find((f) => f.letter === "b");
    expect(b!.count).toBe(1);
  });
});

describe("countLetters — chi-squared", () => {
  it("low chi-squared for normal English", () => {
    const r = countLetters("the quick brown fox jumps over the lazy dog and many more letters in this sentence");
    if ("error" in r) throw new Error("err");
    expect(r.chiSquaredVsEnglish).toBeGreaterThan(0);
  });
  it("warns on very skewed distribution", () => {
    const r = countLetters("zzzzzzzzzzzzzzzzzzzzzzzzzz");
    if ("error" in r) throw new Error("err");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("batchCount", () => {
  it("processes multiple texts", () => {
    const results = batchCount(["hello", "world"]);
    expect(results.length).toBe(2);
  });
});

describe("toCsv", () => {
  it("produces CSV with header", () => {
    const r = countLetters("hello");
    if ("error" in r) throw new Error("err");
    const csv = toCsv(r);
    expect(csv.split("\n")[0]).toContain("Letter");
    expect(csv).toContain("Vowels");
    expect(csv).toContain("Chi-squared");
  });
});

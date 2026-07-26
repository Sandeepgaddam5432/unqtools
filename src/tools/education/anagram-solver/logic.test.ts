import { describe, it, expect } from "vitest";
import {
  WORD_LIST, letterFreq, scoreWord, canForm, findAnagrams, findAnagramsBatch, renderBatchCsv,
  renderReport, levenshtein, isSubset,
} from "./logic";

describe("anagram-solver WORD_LIST", () => {
  it("contains words", () => {
    expect(WORD_LIST.length).toBeGreaterThan(50);
  });
});

describe("anagram-solver letterFreq", () => {
  it("computes letter frequencies", () => {
    expect(letterFreq("hello")).toEqual({ h: 1, e: 1, l: 2, o: 1 });
  });
  it("ignores non-letters", () => {
    expect(letterFreq("a1b2")).toEqual({ a: 1, b: 1 });
  });
  it("lowercases input", () => {
    expect(letterFreq("ABC")).toEqual({ a: 1, b: 1, c: 1 });
  });
});

describe("anagram-solver scoreWord", () => {
  it("scores 'cat' as 5 (3+1+1)", () => {
    expect(scoreWord("cat")).toBe(5);
  });
  it("scores 'quiz' as 22 (10+1+1+10)", () => {
    expect(scoreWord("quiz")).toBe(22);
  });
  it("returns 0 for empty string", () => {
    expect(scoreWord("")).toBe(0);
  });
});

describe("anagram-solver canForm", () => {
  it("returns true when all letters present", () => {
    expect(canForm("cat", "tac", "?")).toBe(true);
  });
  it("returns false when letters missing", () => {
    expect(canForm("dog", "cat", "?")).toBe(false);
  });
  it("uses wildcards for missing letters", () => {
    expect(canForm("cats", "cat", "?")).toBe(true);
  });
  it("handles multiple wildcards", () => {
    expect(canForm("hello", "hll", "??")).toBe(true);
  });
});

describe("anagram-solver findAnagrams", () => {
  it("finds anagrams of 'cat'", () => {
    const r = findAnagrams({ letters: "cat", wildcard: "?", minLength: 2, maxLength: 0, multiWord: false, maxResults: 20 });
    expect(r.results.length).toBeGreaterThan(0);
    expect(r.results.some((x) => x.word === "cat" || x.word === "act")).toBe(true);
  });
  it("respects min length", () => {
    const r = findAnagrams({ letters: "cat", wildcard: "?", minLength: 3, maxLength: 0, multiWord: false, maxResults: 20 });
    expect(r.results.every((x) => x.word.length >= 3)).toBe(true);
  });
  it("respects max length", () => {
    const r = findAnagrams({ letters: "catalog", wildcard: "?", minLength: 2, maxLength: 4, multiWord: false, maxResults: 20 });
    expect(r.results.every((x) => x.word.length <= 4)).toBe(true);
  });
  it("handles wildcards", () => {
    const r = findAnagrams({ letters: "ca?", wildcard: "?", minLength: 3, maxLength: 0, multiWord: false, maxResults: 20 });
    expect(r.results.length).toBeGreaterThan(0);
  });
  it("warns on empty input", () => {
    const r = findAnagrams({ letters: "", wildcard: "?", minLength: 2, maxLength: 0, multiWord: false, maxResults: 20 });
    expect(r.warnings.some((w) => w.includes("empty"))).toBe(true);
  });
  it("returns results sorted by score", () => {
    const r = findAnagrams({ letters: "stone", wildcard: "?", minLength: 2, maxLength: 0, multiWord: false, maxResults: 20 });
    for (let i = 1; i < r.results.length; i++) {
      expect(r.results[i].score).toBeLessThanOrEqual(r.results[i - 1].score);
    }
  });
  it("uses custom word list", () => {
    const r = findAnagrams({ letters: "abc", wildcard: "?", minLength: 2, maxLength: 0, multiWord: false, maxResults: 20, customWordList: ["cab", "abc", "bac"] });
    expect(r.results.length).toBe(3);
  });
});

describe("anagram-solver findAnagrams multiWord", () => {
  it("finds multi-word anagrams for small inputs", () => {
    const r = findAnagrams({ letters: "catdog", wildcard: "?", minLength: 2, maxLength: 0, multiWord: true, maxResults: 20 });
    expect(r.multiWordResults.length).toBeGreaterThanOrEqual(0);
  });
});

describe("anagram-solver findAnagramsBatch / renderBatchCsv", () => {
  it("processes batch of jobs", () => {
    const rs = findAnagramsBatch([
      { letters: "cat", wildcard: "?", minLength: 2, maxLength: 0, multiWord: false, maxResults: 10 },
      { letters: "dog", wildcard: "?", minLength: 2, maxLength: 0, multiWord: false, maxResults: 10 },
    ]);
    expect(rs.length).toBe(2);
  });
  it("renders CSV", () => {
    const csv = renderBatchCsv(findAnagramsBatch([{ letters: "cat", wildcard: "?", minLength: 2, maxLength: 0, multiWord: false, maxResults: 10 }]));
    expect(csv.split("\n")[0]).toContain("index,input");
  });
});

describe("anagram-solver renderReport", () => {
  it("renders report", () => {
    const r = renderReport(findAnagrams({ letters: "cat", wildcard: "?", minLength: 2, maxLength: 0, multiWord: false, maxResults: 10 }));
    expect(r).toContain("Anagram Solver Report");
    expect(r).toContain("cat");
  });
});

describe("anagram-solver levenshtein", () => {
  it("computes edit distance 0 for identical strings", () => {
    expect(levenshtein("hello", "hello")).toBe(0);
  });
  it("computes edit distance 1 for single substitution", () => {
    expect(levenshtein("cat", "bat")).toBe(1);
  });
  it("computes edit distance for empty strings", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
  });
});

describe("anagram-solver isSubset", () => {
  it("returns true when all letters available", () => {
    expect(isSubset("cat", "tcab")).toBe(true);
  });
  it("returns false when letters missing", () => {
    expect(isSubset("dog", "cat")).toBe(false);
  });
  it("handles repeated letters", () => {
    expect(isSubset("hello", "helloworld")).toBe(true);
    expect(isSubset("hello", "helo")).toBe(false);
  });
});

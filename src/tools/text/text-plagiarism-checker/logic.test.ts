/**
 * Plagiarism Checker — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  buildNgrams,
  jaccard,
  overlapCoefficient,
  checkPlagiarism,
  highlightHtml,
  resultToJson,
} from "./logic";

describe("buildNgrams", () => {
  it("builds unigrams when n=1", () => {
    const g = buildNgrams(["a", "b", "c"], 1);
    expect(g.size).toBe(3);
    expect(g.has("a")).toBe(true);
  });
  it("builds trigrams", () => {
    const g = buildNgrams(["a", "b", "c", "d"], 3);
    expect(g.size).toBe(2);
    expect(g.has("a b c")).toBe(true);
    expect(g.has("b c d")).toBe(true);
  });
  it("handles tokens shorter than n", () => {
    const g = buildNgrams(["a", "b"], 5);
    expect(g.size).toBe(0);
  });
});

describe("jaccard", () => {
  it("returns 1 for identical sets", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
  });
  it("returns 0 for disjoint sets", () => {
    expect(jaccard(new Set(["a"]), new Set(["b"]))).toBe(0);
  });
  it("returns 0 for two empty sets", () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });
  it("computes partial overlap", () => {
    const v = jaccard(new Set(["a", "b", "c"]), new Set(["a", "b", "d"]));
    // 2 shared, 4 union → 0.5
    expect(v).toBeCloseTo(0.5, 5);
  });
});

describe("overlapCoefficient", () => {
  it("returns 1 when smaller set is subset of larger", () => {
    expect(overlapCoefficient(new Set(["a", "b", "c"]), new Set(["a", "b"]))).toBe(1);
  });
  it("returns 0 when no overlap", () => {
    expect(overlapCoefficient(new Set(["a"]), new Set(["b"]))).toBe(0);
  });
});

describe("checkPlagiarism", () => {
  it("returns 100% similarity for identical text", () => {
    const text = "The quick brown fox jumps over the lazy dog.";
    const r = checkPlagiarism(text, text);
    expect(r.similarity).toBeCloseTo(1, 1);
    expect(r.similarityPercent).toBeGreaterThan(99);
    expect(r.sharedNgrams).toBeGreaterThan(0);
  });
  it("returns low similarity for unrelated texts", () => {
    const r = checkPlagiarism(
      "The cat sat on the mat in the kitchen.",
      "Quantum mechanics describes subatomic particle behavior.",
    );
    expect(r.similarity).toBeLessThan(0.2);
  });
  it("warns on empty source", () => {
    const r = checkPlagiarism("", "hello");
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.similarity).toBe(0);
  });
  it("warns on empty suspect", () => {
    const r = checkPlagiarism("hello", "");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("flags moderate similarity", () => {
    const a = "The quick brown fox jumps over the lazy dog. The dog barks.";
    const b = "The quick brown fox jumps over the lazy dog. The cat meows.";
    const r = checkPlagiarism(a, b);
    expect(r.similarityPercent).toBeGreaterThan(40);
    expect(r.matches.length).toBeGreaterThan(0);
  });
  it("respects case-sensitive option", () => {
    const a = "Hello world.";
    const b = "hello world.";
    const caseInsensitive = checkPlagiarism(a, b, { caseSensitive: false });
    const caseSensitive = checkPlagiarism(a, b, { caseSensitive: true });
    expect(caseInsensitive.similarity).toBeGreaterThan(caseSensitive.similarity);
  });
  it("highlights matched spans in both texts", () => {
    const a = "The quick brown fox jumps over the lazy dog.";
    const b = "I saw that the quick brown fox jumps over the lazy dog yesterday.";
    const r = checkPlagiarism(a, b, { minHighlightLength: 10 });
    expect(r.matches.length).toBeGreaterThan(0);
    const first = r.matches[0]!;
    expect(first.sourceText.length).toBeGreaterThan(0);
    expect(first.suspectText.length).toBeGreaterThan(0);
  });
  it("reports shared and total n-gram counts", () => {
    const r = checkPlagiarism("a b c d e", "a b c d e");
    expect(r.sharedNgrams).toBeGreaterThan(0);
    expect(r.totalNgrams).toBeGreaterThanOrEqual(r.sharedNgrams);
  });
});

describe("highlightHtml", () => {
  it("escapes & wraps matches in <mark>", () => {
    const html = highlightHtml("hello world", [{ start: 0, end: 5 }]);
    expect(html).toContain("<mark");
    expect(html).toContain("hello");
    expect(html).toContain("world");
    expect(html).not.toContain("<script");
  });
  it("escapes HTML special chars", () => {
    const html = highlightHtml("<b>bold</b>", []);
    expect(html).toContain("&lt;b&gt;");
  });
  it("handles no matches", () => {
    expect(highlightHtml("hello", [])).toBe("hello");
  });
});

describe("resultToJson", () => {
  it("produces valid JSON with similarity field", () => {
    const r = checkPlagiarism("a b c", "a b c");
    const parsed = JSON.parse(resultToJson(r));
    expect(parsed).toHaveProperty("similarity");
    expect(parsed).toHaveProperty("matches");
  });
});

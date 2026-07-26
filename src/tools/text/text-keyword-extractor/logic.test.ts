/**
 * Keyword Extractor — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  extractKeywords,
  computeIdf,
  keywordsToCsv,
  keywordsToJson,
} from "./logic";

describe("extractKeywords — basics", () => {
  it("returns empty for empty text", () => {
    const r = extractKeywords("");
    expect(r.keywords).toEqual([]);
    expect(r.totalTokens).toBe(0);
  });
  it("returns keywords ranked by score", () => {
    const r = extractKeywords("machine learning machine learning is the future of machine learning");
    expect(r.keywords.length).toBeGreaterThan(0);
    expect(r.keywords[0]!.word).toBe("machine");
    expect(r.keywords[0]!.score).toBe(100);
  });
  it("removes stop words by default", () => {
    const r = extractKeywords("the cat and the dog are friends");
    const stop = r.keywords.find((k) => k.word === "the" || k.word === "and" || k.word === "are");
    expect(stop).toBeUndefined();
  });
  it("respects minWordLength", () => {
    const r = extractKeywords("aa bb ccc dddd", { minWordLength: 3 });
    expect(r.keywords.find((k) => k.word === "aa")).toBeUndefined();
    expect(r.keywords.find((k) => k.word === "ccc")).toBeDefined();
  });
  it("includes bigrams by default", () => {
    const r = extractKeywords("data science data engineering data science");
    const bg = r.keywords.find((k) => k.isBigram);
    expect(bg).toBeDefined();
    expect(bg!.word).toContain(" ");
  });
  it("can disable bigrams", () => {
    const r = extractKeywords("data science data science", { includeBigrams: false });
    expect(r.keywords.find((k) => k.isBigram)).toBeUndefined();
  });
  it("respects topK limit", () => {
    const r = extractKeywords("alpha beta gamma delta epsilon zeta eta theta iota", { topK: 3, minWordLength: 3 });
    expect(r.keywords.length).toBeLessThanOrEqual(3);
  });
});

describe("extractKeywords — scoring", () => {
  it("gives higher score to more frequent words", () => {
    const r = extractKeywords("apple apple apple banana cherry");
    const apple = r.keywords.find((k) => k.word === "apple")!;
    const banana = r.keywords.find((k) => k.word === "banana")!;
    expect(apple.score).toBeGreaterThan(banana.score);
  });
  it("applies position boost to early words", () => {
    const text = "important thing at the start. " + "filler ".repeat(50) + "later important thing.";
    const r = extractKeywords(text, { topK: 20, minWordLength: 4, includeBigrams: false, extraStopWords: ["filler"] });
    const important = r.keywords.find((k) => k.word === "important");
    expect(important).toBeDefined();
    expect(important!.firstPosition).toBeLessThan(5);
  });
  it("uses IDF when corpus is provided", () => {
    const corpus = [
      ["apple", "banana", "cherry"],
      ["apple", "banana", "date"],
      ["apple", "fig", "grape"],
    ];
    const r = extractKeywords("apple fig cherry date", { includeBigrams: false, minWordLength: 3 }, corpus);
    const apple = r.keywords.find((k) => k.word === "apple")!;
    const fig = r.keywords.find((k) => k.word === "fig")!;
    expect(apple.idf).toBeLessThan(fig.idf);
  });
});

describe("extractKeywords — meta", () => {
  it("reports unique unigram and bigram counts", () => {
    const r = extractKeywords("alpha beta gamma alpha beta");
    expect(r.uniqueUnigrams).toBe(3);
    expect(r.uniqueBigrams).toBe(2);
  });
  it("warns when all words are filtered out", () => {
    const r = extractKeywords("a an the", { minWordLength: 1 });
    // 'a', 'an', 'the' are stop words → all filtered
    expect(r.warnings.some((w) => w.includes("filtered"))).toBe(true);
  });
});

describe("computeIdf", () => {
  it("returns higher idf for rare terms", () => {
    const idf = computeIdf([["a", "b"], ["a", "c"]]);
    expect(idf.get("b")!).toBeGreaterThan(idf.get("a")!);
  });
  it("handles empty corpus gracefully", () => {
    const idf = computeIdf([]);
    expect(idf.size).toBe(0);
  });
});

describe("exports", () => {
  it("keywordsToCsv produces header + rows", () => {
    const r = extractKeywords("machine learning machine learning");
    const csv = keywordsToCsv(r);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("keyword");
    expect(lines.length).toBe(r.keywords.length + 1);
  });
  it("keywordsToJson produces valid JSON", () => {
    const r = extractKeywords("alpha beta gamma");
    const parsed = JSON.parse(keywordsToJson(r));
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]).toHaveProperty("word");
    expect(parsed[0]).toHaveProperty("score");
  });
});

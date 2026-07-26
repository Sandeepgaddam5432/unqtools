/**
 * Word Cloud Data — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  tokenize,
  countFrequency,
  computeIdf,
  buildWordCloud,
  wordCloudToCsv,
  wordCloudToJson,
  buildCorpus,
} from "./logic";

describe("tokenize", () => {
  it("returns [] for empty input", () => {
    expect(tokenize("")).toEqual([]);
  });
  it("lowercases and strips punctuation", () => {
    expect(tokenize("Hello, WORLD! Hello...")).toEqual(["hello", "world", "hello"]);
  });
  it("handles unicode letters", () => {
    expect(tokenize("café résumé NAÏVE")).toEqual(["café", "résumé", "naïve"]);
  });
  it("keeps apostrophes inside words", () => {
    expect(tokenize("don't stop")).toEqual(["don't", "stop"]);
  });
});

describe("countFrequency", () => {
  it("counts duplicate tokens", () => {
    const f = countFrequency(["a", "b", "a", "c", "a"]);
    expect(f.get("a")).toBe(3);
    expect(f.get("b")).toBe(1);
    expect(f.get("c")).toBe(1);
  });
  it("returns empty map for empty input", () => {
    expect(countFrequency([]).size).toBe(0);
  });
});

describe("computeIdf", () => {
  it("gives unique terms higher idf than common terms", () => {
    const corpus = [
      ["apple", "banana", "cherry"],
      ["apple", "banana", "date"],
      ["apple", "fig", "grape"],
    ];
    const idf = computeIdf(corpus);
    expect(idf.get("apple")!).toBeLessThan(idf.get("fig")!);
    expect(idf.get("apple")!).toBeLessThan(idf.get("grape")!);
  });
  it("never returns zero for a present term", () => {
    const idf = computeIdf([["x", "y"], ["x"]]);
    expect(idf.get("x")!).toBeGreaterThan(0);
    expect(idf.get("y")!).toBeGreaterThan(0);
  });
});

describe("buildWordCloud", () => {
  it("returns empty word list for empty text", () => {
    const r = buildWordCloud("");
    expect(r.words).toEqual([]);
    expect(r.totalTokens).toBe(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("counts word frequencies and normalises weights", () => {
    const r = buildWordCloud("hello hello hello world world foo");
    const hello = r.words.find((w) => w.word === "hello");
    expect(hello?.count).toBe(3);
    expect(hello?.weight).toBe(100);
    const world = r.words.find((w) => w.word === "world");
    expect(world!.weight).toBeLessThan(100);
    expect(world!.weight).toBeGreaterThan(0);
  });
  it("removes stop words by default", () => {
    const r = buildWordCloud("the cat and the dog");
    const stop = r.words.find((w) => w.word === "the" || w.word === "and");
    expect(stop).toBeUndefined();
  });
  it("keeps stop words when disabled", () => {
    const r = buildWordCloud("the cat and the dog", { removeStopWords: false, minWordLength: 1 });
    expect(r.words.find((w) => w.word === "the")).toBeDefined();
  });
  it("respects minWordLength", () => {
    const r = buildWordCloud("a bb ccc dddd", { removeStopWords: false, minWordLength: 3 });
    expect(r.words.find((w) => w.word === "a")).toBeUndefined();
    expect(r.words.find((w) => w.word === "bb")).toBeUndefined();
    expect(r.words.find((w) => w.word === "ccc")).toBeDefined();
  });
  it("respects maxResults", () => {
    const r = buildWordCloud("a b c d e f g h i j", { removeStopWords: false, minWordLength: 1, maxResults: 3 });
    expect(r.words.length).toBe(3);
    expect(r.warnings.some((w) => w.includes("Truncated"))).toBe(true);
  });
  it("computes tf-idf when given a corpus", () => {
    const corpus = buildCorpus([
      "apple banana",
      "apple cherry",
      "apple date",
    ]);
    const r = buildWordCloud("apple banana cherry date", { removeStopWords: false, minWordLength: 1 }, corpus);
    const apple = r.words.find((w) => w.word === "apple")!;
    const date = r.words.find((w) => w.word === "date")!;
    expect(apple.idf).toBeLessThan(date.idf);
    expect(date.tfidf).toBeGreaterThan(apple.tfidf);
  });
  it("reports average word length", () => {
    const r = buildWordCloud("hello world foo", { removeStopWords: false, minWordLength: 1 });
    // lengths: 5, 5, 3 -> avg = 13/3 ≈ 4.333
    expect(r.averageWordLength).toBeCloseTo(4.33, 1);
  });
});

describe("exports", () => {
  it("wordCloudToCsv produces header + rows", () => {
    const r = buildWordCloud("hello world hello");
    const csv = wordCloudToCsv(r);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("word,count,tf,idf,tfidf,weight");
    expect(lines.length).toBe(r.words.length + 1);
  });
  it("wordCloudToJson produces valid JSON with text+value+weight", () => {
    const r = buildWordCloud("hello world hello");
    const parsed = JSON.parse(wordCloudToJson(r));
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]).toHaveProperty("text");
    expect(parsed[0]).toHaveProperty("value");
    expect(parsed[0]).toHaveProperty("weight");
  });
});

/**
 * Keyword Density Analyzer — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  stripHtml,
  extractTag,
  tokenize,
  stem,
  buildNgrams,
  fleschReadingEase,
  countSyllables,
  analyzeKeywordDensity,
  buildCsv,
  findOccurrences,
  getStopWords,
} from "./logic";

describe("stripHtml", () => {
  it("strips tags and decodes entities", () => {
    expect(stripHtml("<p>Hello&nbsp;world &amp; goodbye</p>")).toBe("Hello world & goodbye");
  });
  it("removes scripts and styles", () => {
    expect(stripHtml("<style>.a{}</style><script>x=1</script>Hi")).toBe("Hi");
  });
});

describe("extractTag", () => {
  it("extracts all matches of a tag", () => {
    const html = "<h2>First</h2><p>text</p><h2>Second</h2>";
    const r = extractTag(html, "h2");
    expect(r.length).toBe(2);
    expect(r[0]).toBe("First");
  });
  it("returns empty array when no match", () => {
    expect(extractTag("<p>hi</p>", "h1")).toEqual([]);
  });
});

describe("tokenize", () => {
  it("tokenizes lowercase words", () => {
    expect(tokenize("Hello, World 2026!")).toEqual(["hello", "world", "2026"]);
  });
  it("returns empty for empty string", () => {
    expect(tokenize("")).toEqual([]);
  });
});

describe("stem", () => {
  it("stems English plurals", () => {
    expect(stem("cats")).toBe("cat");
    expect(stem("running")).toBe("runn");
  });
  it("returns short words unchanged", () => {
    expect(stem("cat")).toBe("cat");
  });
  it("does not stem non-English", () => {
    expect(stem("gatos", "es")).toBe("gatos");
  });
});

describe("buildNgrams", () => {
  it("builds bigrams", () => {
    expect(buildNgrams(["a", "b", "c"], 2)).toEqual(["a b", "b c"]);
  });
  it("builds trigrams", () => {
    expect(buildNgrams(["a", "b", "c", "d"], 3)).toEqual(["a b c", "b c d"]);
  });
  it("returns empty when not enough tokens", () => {
    expect(buildNgrams(["a"], 2)).toEqual([]);
  });
});

describe("fleschReadingEase + countSyllables", () => {
  it("counts syllables", () => {
    expect(countSyllables("cat")).toBe(1);
    expect(countSyllables("running")).toBeGreaterThanOrEqual(2);
  });
  it("computes flesch score", () => {
    expect(fleschReadingEase("The cat sat on the mat.")).toBeGreaterThan(0);
    expect(fleschReadingEase("")).toBe(0);
  });
});

describe("analyzeKeywordDensity", () => {
  it("errors on empty input", () => {
    expect("error" in analyzeKeywordDensity("")).toBe(true);
  });
  it("returns word count + unigrams", () => {
    const r = analyzeKeywordDensity("running shoes running shoes running");
    if ("error" in r) throw new Error("should not error");
    expect(r.wordCount).toBeGreaterThan(0);
    expect(r.unigrams.length).toBeGreaterThan(0);
    expect(r.unigrams[0]!.term).toBe("running");
  });
  it("respects removeStopWords option", () => {
    const withStop = analyzeKeywordDensity("the cat and the dog", { removeStopWords: false });
    const without = analyzeKeywordDensity("the cat and the dog", { removeStopWords: true });
    if ("error" in withStop || "error" in without) throw new Error("should not error");
    expect(withStop.unigrams.some((u) => u.term === "the")).toBe(true);
    expect(without.unigrams.some((u) => u.term === "the")).toBe(false);
  });
  it("applies stemming when enabled", () => {
    const r = analyzeKeywordDensity("cat cats running runs", { useStemming: true, removeStopWords: false });
    if ("error" in r) throw new Error("should not error");
    // "cat" and "cats" should merge; "running" and "runs" should merge.
    const cat = r.unigrams.find((u) => u.term === "cat");
    expect(cat?.count).toBeGreaterThanOrEqual(2);
  });
  it("flags stuffing above threshold", () => {
    const r = analyzeKeywordDensity("shoes shoes shoes shoes shoes shoes shoes", { stuffingThreshold: 4, removeStopWords: false });
    if ("error" in r) throw new Error("should not error");
    expect(r.unigrams[0]!.flag).toBe("stuffing");
    expect(r.flags.length).toBeGreaterThan(0);
  });
  it("computes density percentages", () => {
    const r = analyzeKeywordDensity("apple apple orange", { removeStopWords: false });
    if ("error" in r) throw new Error("should not error");
    const apple = r.unigrams.find((u) => u.term === "apple");
    expect(apple?.density).toBeCloseTo(66.67, 1);
  });
  it("parses HTML and counts element tokens", () => {
    const html = `<html><head><title>Best Running Shoes</title></head><body><h1>Running Shoes</h1><p>running shoes for runners</p></body></html>`;
    const r = analyzeKeywordDensity(html, { removeStopWords: false });
    if ("error" in r) throw new Error("should not error");
    expect(r.elementCounts.title).toBeGreaterThan(0);
    expect(r.elementCounts.h1).toBeGreaterThan(0);
    expect(r.elementCounts.body).toBeGreaterThan(0);
  });
  it("returns bigrams and trigrams", () => {
    const r = analyzeKeywordDensity("best running shoes best running shoes best running shoes", { removeStopWords: false });
    if ("error" in r) throw new Error("should not error");
    expect(r.bigrams.some((b) => b.term === "running shoes")).toBe(true);
    expect(r.trigrams.some((t) => t.term === "best running shoes")).toBe(true);
  });
  it("respects topN limit", () => {
    const r = analyzeKeywordDensity("a b c d e f g h i j k l m n o p", { removeStopWords: false, topN: 5 });
    if ("error" in r) throw new Error("should not error");
    expect(r.unigrams.length).toBeLessThanOrEqual(5);
  });
  it("includes reading time", () => {
    const r = analyzeKeywordDensity("word ".repeat(500), { removeStopWords: false });
    if ("error" in r) throw new Error("should not error");
    expect(r.readingTimeMin).toBeGreaterThanOrEqual(1);
  });
});

describe("buildCsv", () => {
  it("produces a CSV with header", () => {
    const r = analyzeKeywordDensity("running shoes running", { removeStopWords: false });
    if ("error" in r) throw new Error("should not error");
    const csv = buildCsv(r);
    expect(csv.startsWith("type,term,count,density,flag")).toBe(true);
    expect(csv).toContain("unigram");
  });
});

describe("findOccurrences", () => {
  it("finds all occurrences", () => {
    const r = findOccurrences("running shoes for running runners", "running");
    expect(r.length).toBe(2);
  });
  it("returns empty for empty term", () => {
    expect(findOccurrences("text", "")).toEqual([]);
  });
  it("is case-insensitive", () => {
    const r = findOccurrences("Running shoes RUNNING", "running");
    expect(r.length).toBe(2);
  });
});

describe("getStopWords", () => {
  it("returns a set for each language", () => {
    expect(getStopWords("en").has("the")).toBe(true);
    expect(getStopWords("es").has("el")).toBe(true);
    expect(getStopWords("fr").has("le")).toBe(true);
  });
  it("returns a mutable copy", () => {
    const s = getStopWords("en");
    s.add("customword");
    const s2 = getStopWords("en");
    expect(s2.has("customword")).toBe(false);
  });
});

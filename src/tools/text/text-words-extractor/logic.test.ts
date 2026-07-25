import { describe, it, expect } from "vitest";
import { tokenizeWords, wordFrequency, buildNgrams, computeStats, extractWords, frequencyToCsv } from "./logic";

const defaultOpts = { minLength: 1, caseSensitive: false, ignoreStopWords: false, ngramSize: 1 };

describe("tokenizeWords", () => {
  it("splits on whitespace and punctuation", () => {
    expect(tokenizeWords("Hello, world! How are you?", defaultOpts)).toEqual(["hello", "world", "how", "are", "you"]);
  });
  it("handles empty input", () => {
    expect(tokenizeWords("", defaultOpts)).toEqual([]);
  });
  it("respects minLength filter", () => {
    expect(tokenizeWords("a bb ccc", { ...defaultOpts, minLength: 2 })).toEqual(["bb", "ccc"]);
  });
  it("case-sensitive preserves case", () => {
    expect(tokenizeWords("Hello hello", { ...defaultOpts, caseSensitive: true })).toEqual(["Hello", "hello"]);
  });
  it("filters stop words", () => {
    const words = tokenizeWords("the cat sat on the mat", { ...defaultOpts, ignoreStopWords: true });
    expect(words).toEqual(["cat", "sat", "mat"]);
  });
  it("handles apostrophes in contractions", () => {
    expect(tokenizeWords("don't stop", defaultOpts)).toContain("don't");
  });
});

describe("wordFrequency", () => {
  it("counts occurrences", () => {
    const f = wordFrequency(["a", "b", "a", "c", "a", "b"]);
    expect(f.find((e) => e.word === "a")!.count).toBe(3);
    expect(f.find((e) => e.word === "b")!.count).toBe(2);
    expect(f.find((e) => e.word === "c")!.count).toBe(1);
  });
  it("sorts by count descending", () => {
    const f = wordFrequency(["a", "b", "a", "c", "a", "b"]);
    expect(f[0]!.word).toBe("a");
  });
  it("handles empty input", () => {
    expect(wordFrequency([])).toEqual([]);
  });
});

describe("buildNgrams", () => {
  it("returns unigrams for n=1", () => {
    const g = buildNgrams(["a", "b", "a"], 1);
    expect(g.length).toBe(2);
  });
  it("builds bigrams for n=2", () => {
    const g = buildNgrams(["a", "b", "c"], 2);
    expect(g.map((e) => e.word)).toEqual(["a b", "b c"]);
  });
  it("handles insufficient words for n-gram", () => {
    expect(buildNgrams(["a"], 3)).toEqual([]);
  });
});

describe("computeStats", () => {
  it("returns zeros for empty input", () => {
    const s = computeStats([]);
    expect(s.totalWords).toBe(0);
    expect(s.avgWordLength).toBe(0);
  });
  it("computes total and unique counts", () => {
    const s = computeStats(["a", "b", "a", "cc"]);
    expect(s.totalWords).toBe(4);
    expect(s.uniqueWords).toBe(3);
    expect(s.totalChars).toBe(5);
  });
  it("computes avg word length", () => {
    const s = computeStats(["ab", "cd", "ef"]);
    expect(s.avgWordLength).toBe(2);
  });
  it("finds longest word", () => {
    const s = computeStats(["a", "bb", "ccc"]);
    expect(s.longestWord).toBe("ccc");
  });
});

describe("extractWords", () => {
  it("returns full result object", () => {
    const r = extractWords("the cat the dog", { ...defaultOpts, ignoreStopWords: false });
    expect(r.uniqueWords).toContain("the");
    expect(r.uniqueWords).toContain("cat");
    expect(r.frequency.length).toBe(3);
    expect(r.stats.totalWords).toBe(4);
  });
  it("respects ngramSize for ngrams", () => {
    const r = extractWords("a b c", { ...defaultOpts, ngramSize: 2 });
    expect(r.ngrams.map((e) => e.word)).toEqual(["a b", "b c"]);
  });
});

describe("frequencyToCsv", () => {
  it("generates CSV with header", () => {
    const csv = frequencyToCsv([{ word: "a", count: 3 }, { word: "b", count: 1 }]);
    expect(csv.split("\n")[0]).toBe("Word,Count");
    expect(csv).toContain("a,3");
    expect(csv).toContain("b,1");
  });
  it("quotes words containing commas", () => {
    const csv = frequencyToCsv([{ word: "a,b", count: 1 }]);
    expect(csv).toContain('"a,b"');
  });
});

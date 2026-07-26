/**
 * Abstract Generator — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  generateAbstract,
  generateAbstractBatch,
  splitSentences,
  tokenize,
  termFrequency,
  normalizeTf,
  toCsv,
  toJson,
  sampleText,
} from "./logic";

const SHORT = "This is a test sentence. This is another test sentence. A third sentence follows here. The fourth one concludes the paragraph. Finally, the last sentence wraps up.";

describe("splitSentences", () => {
  it("splits on . ! ?", () => {
    const s = splitSentences("Hello world. How are you? I am fine!");
    expect(s.length).toBe(3);
  });
  it("returns [] for empty input", () => {
    expect(splitSentences("")).toEqual([]);
  });
  it("returns single sentence when no terminator", () => {
    expect(splitSentences("just some words").length).toBe(1);
  });
});

describe("tokenize", () => {
  it("extracts lowercased word tokens", () => {
    expect(tokenize("Hello, World!")).toEqual(["hello", "world"]);
  });
  it("handles Unicode letters", () => {
    expect(tokenize("café résumé")).toEqual(["café", "résumé"]);
  });
  it("returns [] for punctuation only", () => {
    expect(tokenize("!!! ??? ...")).toEqual([]);
  });
});

describe("termFrequency & normalizeTf", () => {
  it("counts tokens, skipping stop words", () => {
    const tf = termFrequency(tokenize("the cat sat on the mat"), new Set(["the"]));
    expect(tf.get("cat")).toBe(1);
    expect(tf.get("the")).toBeUndefined();
  });
  it("normalizes by max frequency", () => {
    const tf = termFrequency(tokenize("cat cat dog"), new Set());
    const n = normalizeTf(tf);
    expect(n.get("cat")).toBeCloseTo(1);
    expect(n.get("dog")).toBeCloseTo(0.5);
  });
});

describe("generateAbstract — validation", () => {
  it("errors on empty text", () => {
    expect("error" in generateAbstract("")).toBe(true);
  });
  it("errors on whitespace-only text", () => {
    expect("error" in generateAbstract("   \n\t  ")).toBe(true);
  });
  it("errors on bad ratio (zero)", () => {
    expect("error" in generateAbstract(SHORT, { ratio: 0 })).toBe(true);
  });
  it("errors on bad ratio (>1)", () => {
    expect("error" in generateAbstract(SHORT, { ratio: 1.5 })).toBe(true);
  });
  it("errors when all sentences are filtered out by length", () => {
    expect("error" in generateAbstract(SHORT, { minSentenceLength: 100 })).toBe(true);
  });
});

describe("generateAbstract — basic output", () => {
  it("returns an abstract with selected sentences", () => {
    const r = generateAbstract(sampleText());
    if ("error" in r) throw new Error("err");
    expect(r.abstract.length).toBeGreaterThan(0);
    expect(r.selected.length).toBeGreaterThan(0);
  });
  it("respects sentenceCount option", () => {
    const r = generateAbstract(sampleText(), { sentenceCount: 2 });
    if ("error" in r) throw new Error("err");
    expect(r.selected.length).toBe(2);
  });
  it("respects ratio option", () => {
    const r = generateAbstract(sampleText(), { ratio: 0.4 });
    if ("error" in r) throw new Error("err");
    expect(r.selected.length).toBe(Math.round(r.totalSentences * 0.4));
  });
  it("keeps selected sentences in original reading order", () => {
    const r = generateAbstract(sampleText(), { sentenceCount: 3 });
    if ("error" in r) throw new Error("err");
    const idxs = r.selected.map((s) => s.index);
    const sorted = [...idxs].sort((a, b) => a - b);
    expect(idxs).toEqual(sorted);
  });
});

describe("generateAbstract — scoring", () => {
  it("ranked list is sorted descending by score", () => {
    const r = generateAbstract(sampleText());
    if ("error" in r) throw new Error("err");
    for (let i = 1; i < r.ranked.length; i++) {
      expect(r.ranked[i]!.score).toBeLessThanOrEqual(r.ranked[i - 1]!.score);
    }
  });
  it("keyword overlap boosts sentences containing the keyword", () => {
    const text = "Cats are great pets. Dogs are loyal companions. Birds can fly. Fish swim. Cats love naps.";
    const r = generateAbstract(text, { keywords: ["cats"], sentenceCount: 1 });
    if ("error" in r) throw new Error("err");
    expect(r.selected[0]!.text.toLowerCase()).toContain("cats");
  });
  it("title-bias boosts sentences echoing the title", () => {
    const r = generateAbstract(sampleText(), { title: "privacy preserving summarization", sentenceCount: 1 });
    if ("error" in r) throw new Error("err");
    expect(r.selected.length).toBe(1);
  });
});

describe("generateAbstract — filters & warnings", () => {
  it("filters very short sentences", () => {
    const text = "Hi there. This is a much longer sentence with many words. Ok.";
    const r = generateAbstract(text, { minSentenceLength: 5, sentenceCount: 5 });
    if ("error" in r) throw new Error("err");
    expect(r.totalSentences).toBe(3);
    // The short sentences "Hi there." and "Ok." should be filtered out
    expect(r.ranked.length).toBeLessThan(3);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("filters very long sentences", () => {
    const long = "Word ".repeat(80) + ".";
    const short = "Short sentence here.";
    const text = `${long} ${short}`;
    const r = generateAbstract(text, { minSentenceLength: 1, maxSentenceLength: 20, sentenceCount: 5 });
    if ("error" in r) throw new Error("err");
    expect(r.ranked.length).toBe(1);
  });
  it("warns when no keywords are supplied", () => {
    const r = generateAbstract(SHORT, { sentenceCount: 2 });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.some((w) => w.includes("focus keywords"))).toBe(true);
  });
  it("caps keep count at total sentences and warns", () => {
    const r = generateAbstract(SHORT, { sentenceCount: 999 });
    if ("error" in r) throw new Error("err");
    expect(r.selected.length).toBeLessThanOrEqual(r.totalSentences);
    expect(r.warnings.some((w) => w.includes("more sentences than available"))).toBe(true);
  });
});

describe("generateAbstract — stats", () => {
  it("reports total words and sentences", () => {
    const r = generateAbstract(sampleText(), { sentenceCount: 3 });
    if ("error" in r) throw new Error("err");
    expect(r.totalWords).toBeGreaterThan(0);
    expect(r.totalSentences).toBeGreaterThan(0);
    expect(r.avgSentenceLength).toBeGreaterThan(0);
  });
  it("achievedRatio is selected/total", () => {
    const r = generateAbstract(sampleText(), { sentenceCount: 3 });
    if ("error" in r) throw new Error("err");
    expect(r.achievedRatio).toBeCloseTo(r.selected.length / r.totalSentences, 5);
  });
  it("records per-sentence breakdown", () => {
    const r = generateAbstract(sampleText(), { sentenceCount: 3 });
    if ("error" in r) throw new Error("err");
    for (const s of r.ranked) {
      expect(s.breakdown).toHaveProperty("freq");
      expect(s.breakdown).toHaveProperty("position");
      expect(s.breakdown).toHaveProperty("keyword");
    }
  });
});

describe("generateAbstractBatch", () => {
  it("summarizes multiple documents", () => {
    const r = generateAbstractBatch([sampleText(), SHORT, "One sentence doc."], { sentenceCount: 1 });
    expect(r.results.length).toBeLessThanOrEqual(3);
    expect(r.results.length).toBeGreaterThanOrEqual(1);
  });
  it("warns on docs that error", () => {
    const r = generateAbstractBatch(["", sampleText()], { sentenceCount: 1 });
    expect(r.warnings.some((w) => w.includes("Doc 1"))).toBe(true);
    expect(r.results.length).toBe(1);
  });
});

describe("exporters", () => {
  it("toCsv has header and rows", () => {
    const r = generateAbstract(sampleText(), { sentenceCount: 2 });
    if ("error" in r) throw new Error("err");
    const csv = toCsv(r);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Rank");
    expect(lines.length).toBeGreaterThan(1);
  });
  it("toJson parses back with expected fields", () => {
    const r = generateAbstract(sampleText(), { sentenceCount: 2 });
    if ("error" in r) throw new Error("err");
    const json = JSON.parse(toJson(r));
    expect(json.abstract).toBeDefined();
    expect(Array.isArray(json.ranked)).toBe(true);
    expect(json.totalWords).toBeGreaterThan(0);
  });
});

describe("sampleText", () => {
  it("returns a multi-sentence string", () => {
    const s = sampleText();
    expect(s.length).toBeGreaterThan(100);
    expect(splitSentences(s).length).toBeGreaterThan(3);
  });
});

/**
 * Text Reducer — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  reduceText, splitSentences, extractKeywords, detectIMRaD, batchReduce, toCsv,
} from "./logic";

const SAMPLE = "The cat sat on the mat. The mat was very comfortable. Cats love comfortable mats. The dog barked loudly. Dogs are loyal animals. Both cats and dogs make great pets.";

describe("splitSentences", () => {
  it("splits on . ! ?", () => {
    expect(splitSentences("Hello. World! How?")).toHaveLength(3);
  });
  it("returns empty for empty input", () => {
    expect(splitSentences("")).toEqual([]);
  });
  it("handles single sentence", () => {
    expect(splitSentences("Just one.")).toEqual(["Just one."]);
  });
});

describe("extractKeywords", () => {
  it("extracts top keywords", () => {
    const k = extractKeywords("the cat sat on the mat cat mat", 3);
    expect(k.length).toBeLessThanOrEqual(3);
    expect(k[0]!.word).toBe("cat");
  });
  it("excludes stop words", () => {
    const k = extractKeywords("the and the cat", 3);
    expect(k.find((x) => x.word === "the")).toBeUndefined();
  });
});

describe("reduceText — basic", () => {
  it("errors on empty", () => {
    expect("error" in reduceText({ text: "" })).toBe(true);
  });
  it("returns full text for single sentence", () => {
    const r = reduceText({ text: "Just one sentence here." });
    if ("error" in r) throw new Error("err");
    expect(r.summary).toBe("Just one sentence here.");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("reduces multi-sentence text by ratio", () => {
    const r = reduceText({ text: SAMPLE, target: { type: "ratio", value: 0.3 } });
    if ("error" in r) throw new Error("err");
    expect(r.summaryWordCount).toBeLessThan(r.originalWordCount);
  });
  it("compression ratio < 1 for non-trivial reduction", () => {
    const r = reduceText({ text: SAMPLE, target: { type: "ratio", value: 0.3 } });
    if ("error" in r) throw new Error("err");
    expect(r.compressionRatio).toBeLessThan(1);
  });
});

describe("reduceText — target count", () => {
  it("selects exactly N sentences", () => {
    const r = reduceText({ text: SAMPLE, target: { type: "count", value: 2 } });
    if ("error" in r) throw new Error("err");
    expect(r.selectedSentences.length).toBe(2);
  });
  it("clamps to available sentences", () => {
    const r = reduceText({ text: SAMPLE, target: { type: "count", value: 100 } });
    if ("error" in r) throw new Error("err");
    expect(r.selectedSentences.length).toBeLessThanOrEqual(SAMPLE.split(".").length - 1);
  });
});

describe("reduceText — keyword preservation", () => {
  it("boosts sentences with keywords", () => {
    const r = reduceText({ text: SAMPLE, keywords: ["dog"], target: { type: "count", value: 2 } });
    if ("error" in r) throw new Error("err");
    const selectedText = r.selectedSentences.map((s) => s.sentence.toLowerCase()).join(" ");
    // The dog-related sentences should be preferred
    expect(selectedText).toContain("dog");
  });
});

describe("reduceText — sentence scoring", () => {
  it("every sentence has a score and reasons", () => {
    const r = reduceText({ text: SAMPLE, target: { type: "count", value: 3 } });
    if ("error" in r) throw new Error("err");
    for (const s of r.allSentences) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.reasons.length).toBeGreaterThan(0);
    }
  });
  it("headings get boost", () => {
    const r = reduceText({ text: "Introduction. This is a long detailed sentence about the topic that should be included." });
    if ("error" in r) throw new Error("err");
    const intro = r.allSentences.find((s) => s.sentence.trim() === "Introduction.");
    expect(intro?.isHeading).toBe(true);
  });
  it("sentences with numbers get boost", () => {
    const r = reduceText({ text: SAMPLE, target: { type: "count", value: 3 } });
    if ("error" in r) throw new Error("err");
    for (const s of r.allSentences) {
      if (s.hasNumber) expect(s.reasons).toContain("has data");
    }
  });
});

describe("detectIMRaD", () => {
  it("detects IMRaD markers", () => {
    const sentences = ["Introduction to the topic.", "We describe our methodology.", "The results showed significant effects.", "We conclude with implications."];
    const imrad = detectIMRaD(sentences);
    expect(imrad).not.toBeNull();
    expect(imrad!.length).toBeGreaterThanOrEqual(2);
  });
  it("returns null for non-IMRaD text", () => {
    const imrad = detectIMRaD(["The cat sat on the mat.", "It was a sunny day."]);
    expect(imrad).toBeNull();
  });
});

describe("reduceText — IMRaD result", () => {
  it("includes imradStructure in result", () => {
    const r = reduceText({ text: "Introduction to our study. We describe the methodology. Results show significant effects. We discuss implications." });
    if ("error" in r) throw new Error("err");
    expect(r.imradStructure).not.toBeNull();
  });
});

describe("batchReduce", () => {
  it("processes multiple texts", () => {
    const results = batchReduce([SAMPLE, "Just one. Two sentences here."]);
    expect(results.length).toBe(2);
  });
});

describe("toCsv", () => {
  it("produces CSV with header", () => {
    const r = reduceText({ text: SAMPLE, target: { type: "count", value: 2 } });
    if ("error" in r) throw new Error("err");
    const csv = toCsv(r);
    expect(csv.split("\n")[0]).toContain("Index");
    expect(csv).toContain("Score");
  });
});

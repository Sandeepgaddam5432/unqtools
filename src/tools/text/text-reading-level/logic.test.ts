/**
 * Reading Level Analyzer — unit tests.
 */
import { describe, it, expect } from "vitest";
import { analyzeReadingLevel, batchAnalyze, toCsv } from "./logic";

const EASY = "The cat sat on the mat. The dog ran fast. It was a good day. The sun was bright. We had fun.";
const HARD = "The multifaceted institutional apparatus necessitates comprehensive methodological considerations. Interdisciplinary frameworks require sophisticated analytical paradigms.";

describe("analyzeReadingLevel — basic", () => {
  it("errors on empty", () => {
    expect("error" in analyzeReadingLevel("")).toBe(true);
  });
  it("counts words and sentences", () => {
    const r = analyzeReadingLevel(EASY);
    if ("error" in r) throw new Error("err");
    expect(r.wordCount).toBeGreaterThan(0);
    expect(r.sentenceCount).toBe(5);
  });
  it("counts syllables", () => {
    const r = analyzeReadingLevel(EASY);
    if ("error" in r) throw new Error("err");
    expect(r.syllableCount).toBeGreaterThan(0);
  });
  it("counts letters (no spaces/punctuation)", () => {
    const r = analyzeReadingLevel("Hello world.");
    if ("error" in r) throw new Error("err");
    expect(r.characterCount).toBe(10);
  });
});

describe("analyzeReadingLevel — Flesch Reading Ease", () => {
  it("easy text has high Flesch score", () => {
    const r = analyzeReadingLevel(EASY);
    if ("error" in r) throw new Error("err");
    expect(r.fleschReadingEase).toBeGreaterThan(60);
  });
  it("hard text has low Flesch score", () => {
    const r = analyzeReadingLevel(HARD);
    if ("error" in r) throw new Error("err");
    expect(r.fleschReadingEase).toBeLessThan(40);
  });
  it("includes interpretation", () => {
    const r = analyzeReadingLevel(EASY);
    if ("error" in r) throw new Error("err");
    expect(r.fleschInterpretation.length).toBeGreaterThan(0);
  });
});

describe("analyzeReadingLevel — grade levels", () => {
  it("computes Flesch-Kincaid grade (finite)", () => {
    const r = analyzeReadingLevel(EASY);
    if ("error" in r) throw new Error("err");
    expect(Number.isFinite(r.fleschKincaidGrade)).toBe(true);
  });
  it("hard text has positive Flesch-Kincaid grade", () => {
    const r = analyzeReadingLevel(HARD);
    if ("error" in r) throw new Error("err");
    expect(r.fleschKincaidGrade).toBeGreaterThan(0);
  });
  it("computes Gunning Fog", () => {
    const r = analyzeReadingLevel(EASY);
    if ("error" in r) throw new Error("err");
    expect(r.gunningFog).toBeGreaterThan(0);
  });
  it("computes SMOG", () => {
    const r = analyzeReadingLevel(EASY);
    if ("error" in r) throw new Error("err");
    expect(r.smog).toBeGreaterThan(0);
  });
  it("hard text has positive Coleman-Liau", () => {
    const r = analyzeReadingLevel(HARD);
    if ("error" in r) throw new Error("err");
    expect(r.colemanLiau).toBeGreaterThan(0);
  });
  it("hard text has positive ARI", () => {
    const r = analyzeReadingLevel(HARD);
    if ("error" in r) throw new Error("err");
    expect(r.ari).toBeGreaterThan(0);
  });
  it("computes Linsear Write (finite)", () => {
    const r = analyzeReadingLevel(EASY);
    if ("error" in r) throw new Error("err");
    expect(Number.isFinite(r.linsearWrite)).toBe(true);
  });
  it("computes RIX", () => {
    const r = analyzeReadingLevel(EASY);
    if ("error" in r) throw new Error("err");
    expect(r.rix).toBeGreaterThanOrEqual(0);
  });
});

describe("analyzeReadingLevel — consensus grade", () => {
  it("consensus grade is average of formulas", () => {
    const r = analyzeReadingLevel(EASY);
    if ("error" in r) throw new Error("err");
    const expected = ([r.fleschKincaidGrade, r.gunningFog, r.smog, r.colemanLiau, r.ari, r.linsearWrite].reduce((a, b) => a + b, 0)) / 6;
    expect(r.consensusGrade).toBeCloseTo(expected, 1);
  });
  it("hard text has higher consensus grade than easy", () => {
    const easy = analyzeReadingLevel(EASY);
    const hard = analyzeReadingLevel(HARD);
    if ("error" in easy || "error" in hard) throw new Error("err");
    expect(hard.consensusGrade).toBeGreaterThan(easy.consensusGrade);
  });
});

describe("analyzeReadingLevel — reading time", () => {
  it("computes reading time at 200 wpm", () => {
    const r = analyzeReadingLevel(EASY);
    if ("error" in r) throw new Error("err");
    expect(r.readingTimeMin200).toBeGreaterThanOrEqual(1);
  });
  it("computes reading time at 250 wpm", () => {
    const r = analyzeReadingLevel(EASY);
    if ("error" in r) throw new Error("err");
    expect(r.readingTimeMin250).toBeGreaterThanOrEqual(1);
  });
});

describe("analyzeReadingLevel — per-sentence", () => {
  it("provides per-sentence breakdown", () => {
    const r = analyzeReadingLevel(EASY);
    if ("error" in r) throw new Error("err");
    expect(r.perSentence.length).toBe(5);
    expect(r.perSentence[0]!.words).toBeGreaterThan(0);
  });
});

describe("analyzeReadingLevel — complex words", () => {
  it("counts complex words (3+ syllables)", () => {
    const r = analyzeReadingLevel(HARD);
    if ("error" in r) throw new Error("err");
    expect(r.complexWordCount).toBeGreaterThan(0);
  });
});

describe("analyzeReadingLevel — suggestions & warnings", () => {
  it("provides suggestions", () => {
    const r = analyzeReadingLevel(EASY);
    if ("error" in r) throw new Error("err");
    expect(r.suggestions.length).toBeGreaterThan(0);
  });
  it("warns on very short text", () => {
    const r = analyzeReadingLevel("Short.");
    if ("error" in r) throw new Error("err");
    expect(r.warnings.some((w) => w.includes("short"))).toBe(true);
  });
});

describe("batchAnalyze", () => {
  it("processes multiple texts", () => {
    const results = batchAnalyze([EASY, HARD]);
    expect(results.length).toBe(2);
  });
});

describe("toCsv", () => {
  it("produces CSV with header", () => {
    const results = batchAnalyze([EASY]);
    const csv = toCsv(results);
    expect(csv.split("\n")[0]).toContain("Text");
    expect(csv).toContain("FleschEase");
  });
});

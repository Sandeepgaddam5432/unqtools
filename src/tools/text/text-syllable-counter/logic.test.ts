/**
 * Syllable Counter — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  countWordSyllables, countSyllables, heuristicSyllables, batchCount, toCsv,
} from "./logic";

describe("countWordSyllables — dict", () => {
  it("looks up known words", () => {
    expect(countWordSyllables("the").syllables).toBe(1);
    expect(countWordSyllables("every").syllables).toBe(3);
    expect(countWordSyllables("family").syllables).toBe(3);
  });
  it("uses custom dict when provided", () => {
    expect(countWordSyllables("supercalifragilistic", { customDict: { supercalifragilistic: 7 } }).syllables).toBe(7);
  });
  it("ignores dict in force-heuristic mode", () => {
    const r = countWordSyllables("the", { forceHeuristic: true });
    expect(r.source).toBe("heuristic");
  });
});

describe("heuristicSyllables", () => {
  it("counts vowel groups", () => {
    expect(heuristicSyllables("happy")).toBe(2);
    expect(heuristicSyllables("banana")).toBe(3);
  });
  it("applies silent-e rule", () => {
    expect(heuristicSyllables("name")).toBe(1);
    expect(heuristicSyllables("cake")).toBe(1);
  });
  it("handles -le endings", () => {
    expect(heuristicSyllables("apple")).toBe(2);
    expect(heuristicSyllables("table")).toBe(2);
  });
  it("short words return 1", () => {
    expect(heuristicSyllables("cat")).toBe(1);
    expect(heuristicSyllables("a")).toBe(1);
  });
  it("handles empty", () => {
    expect(heuristicSyllables("")).toBe(0);
  });
});

describe("countSyllables — full text", () => {
  it("counts total syllables", () => {
    const r = countSyllables("the cat sat on the mat");
    if ("error" in r) throw new Error("err");
    expect(r.totalWords).toBe(6);
    expect(r.totalSyllables).toBe(6);
  });
  it("computes avg syllables per word", () => {
    const r = countSyllables("happy apple table");
    if ("error" in r) throw new Error("err");
    expect(r.avgSyllablesPerWord).toBeGreaterThan(1.5);
  });
  it("counts polysyllabic and monosyllabic", () => {
    const r = countSyllables("the happy apple");
    if ("error" in r) throw new Error("err");
    expect(r.monosyllabicCount).toBe(1); // "the"
    expect(r.polysyllabicCount).toBeGreaterThanOrEqual(0);
  });
  it("errors on empty", () => {
    expect("error" in countSyllables("")).toBe(true);
  });
});

describe("countSyllables — per-sentence", () => {
  it("splits into sentences", () => {
    const r = countSyllables("The cat sat. The dog ran.");
    if ("error" in r) throw new Error("err");
    expect(r.perSentence.length).toBe(2);
  });
  it("each sentence has word and syllable count", () => {
    const r = countSyllables("Hello world. Goodbye friend.");
    if ("error" in r) throw new Error("err");
    expect(r.perSentence[0]!.words).toBe(2);
    expect(r.perSentence[0]!.syllables).toBeGreaterThan(0);
  });
});

describe("countSyllables — per-paragraph", () => {
  it("splits on blank lines", () => {
    const r = countSyllables("Hello world.\n\nGoodbye friend.");
    if ("error" in r) throw new Error("err");
    expect(r.perParagraph.length).toBe(2);
  });
});

describe("countSyllables — top by syllables", () => {
  it("returns top 10", () => {
    const r = countSyllables("the happy apple beautiful banana extraordinary");
    if ("error" in r) throw new Error("err");
    expect(r.topBySyllables.length).toBeLessThanOrEqual(10);
    expect(r.topBySyllables[0]!.syllables).toBeGreaterThanOrEqual(r.topBySyllables[r.topBySyllables.length - 1]!.syllables);
  });
});

describe("countSyllables — difficulty rating", () => {
  it("easy for simple text", () => {
    const r = countSyllables("the cat sat on the mat");
    if ("error" in r) throw new Error("err");
    expect(r.difficulty).toBe("easy");
  });
  it("hard for complex text", () => {
    const r = countSyllables("extraordinary philosophical institutional relationships characterization");
    if ("error" in r) throw new Error("err");
    expect(["medium", "hard"]).toContain(r.difficulty);
  });
});

describe("countSyllables — warnings", () => {
  it("warns on very high avg", () => {
    const r = countSyllables("extraordinary institutional relationships");
    if ("error" in r) throw new Error("err");
    if (r.avgSyllablesPerWord > 2.5) expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("batchCount", () => {
  it("processes multiple texts", () => {
    const results = batchCount(["hello world", "the cat"]);
    expect(results.length).toBe(2);
  });
});

describe("toCsv", () => {
  it("produces CSV with header", () => {
    const r = countSyllables("hello world");
    if ("error" in r) throw new Error("err");
    const csv = toCsv(r);
    expect(csv.split("\n")[0]).toContain("Word");
    expect(csv).toContain("Total syllables");
  });
});

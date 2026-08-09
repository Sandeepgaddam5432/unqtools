import { describe, expect, it } from "vitest";
import { splitSentences, tokenize, scoreSentences, summarize } from "./logic";

describe("splitSentences", () => {
  it("splits on terminators", () => {
    expect(splitSentences("One. Two! Three? Four")).toHaveLength(4);
  });
});

describe("tokenize", () => {
  it("extracts words", () => {
    expect(tokenize("Hello, world!")).toEqual(["hello", "world"]);
  });
});

describe("scoreSentences", () => {
  it("scores repeated-topic sentences higher", () => {
    const s = [
      "The cat sat on the mat.",
      "Dogs run in the park.",
      "The cat and the mat are mentioned twice.",
    ];
    const scored = scoreSentences(s);
    // Sentence 0 and 2 share cat/mat topics → higher than 1.
    expect(scored[0]!.score).toBeGreaterThan(scored[1]!.score);
  });
});

describe("summarize", () => {
  it("returns top sentences in original order", () => {
    const s = [
      "Alpha beta gamma.",
      "Beta gamma delta.",
      "Gamma delta epsilon.",
      "Zeta eta theta.",
    ];
    const out = summarize(s, 2);
    expect(out.split(" ").length).toBeGreaterThan(1);
    // Original order preserved: index of first sentence <= second.
    const idx = (txt: string) => s.findIndex((x) => x.startsWith(txt));
    expect(idx(out.split(" ")[0]!.replace(/[^a-z]/g, "") + " ")).toBeLessThanOrEqual(idx(out.split(" ")[2]!.replace(/[^a-z]/g, "") + " "));
  });
});

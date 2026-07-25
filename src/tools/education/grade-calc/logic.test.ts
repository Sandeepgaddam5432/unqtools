import { describe, it, expect } from "vitest";
import {
  calculateGrade,
  findBoundary,
  validateItem,
  sumWeights,
  letterForPercent,
  DEFAULT_BOUNDARIES,
  makeEmptyItem,
} from "./logic";

describe("grade-calc findBoundary", () => {
  it("returns A for 95%", () => {
    expect(findBoundary(95).letter).toBe("A");
  });

  it("returns F for 50%", () => {
    expect(findBoundary(50).letter).toBe("F");
  });

  it("returns C for 75%", () => {
    expect(findBoundary(75).letter).toBe("C");
  });

  it("returns B+ for 87% (boundary)", () => {
    expect(findBoundary(87).letter).toBe("B+");
  });
});

describe("grade-calc calculateGrade", () => {
  it("returns null for empty input", () => {
    expect(calculateGrade([])).toBeNull();
  });

  it("computes weighted average", () => {
    const r = calculateGrade([
      { name: "hw", score: 90, maxScore: 100, weight: 1 },
      { name: "exam", score: 80, maxScore: 100, weight: 2 },
    ]);
    expect(r).not.toBeNull();
    // (90 + 80*2) / 3 = 83.33
    expect(r!.weightedAverage).toBeCloseTo(83.33, 1);
  });

  it("normalizes scores with different max", () => {
    const r = calculateGrade([
      { name: "a", score: 9, maxScore: 10, weight: 1 },
      { name: "b", score: 18, maxScore: 20, weight: 1 },
    ]);
    expect(r).not.toBeNull();
    expect(r!.weightedAverage).toBeCloseTo(90, 0);
  });

  it("assigns letter grade", () => {
    const r = calculateGrade([{ name: "x", score: 95, maxScore: 100, weight: 1 }]);
    expect(r!.letterGrade).toBe("A");
    expect(r!.pass).toBe(true);
  });

  it("returns failing grade when score is low", () => {
    const r = calculateGrade([{ name: "x", score: 30, maxScore: 100, weight: 1 }]);
    expect(r!.letterGrade).toBe("F");
    expect(r!.pass).toBe(false);
  });

  it("returns null when all weights are 0", () => {
    const r = calculateGrade([{ name: "x", score: 90, maxScore: 100, weight: 0 }]);
    expect(r).toBeNull();
  });
});

describe("grade-calc validateItem", () => {
  it("rejects negative score", () => {
    expect(validateItem({ name: "x", score: -1, maxScore: 100, weight: 1 })).not.toBeNull();
  });

  it("rejects score > maxScore", () => {
    expect(validateItem({ name: "x", score: 110, maxScore: 100, weight: 1 })).not.toBeNull();
  });

  it("rejects zero maxScore", () => {
    expect(validateItem({ name: "x", score: 0, maxScore: 0, weight: 1 })).not.toBeNull();
  });

  it("accepts valid item", () => {
    expect(validateItem({ name: "x", score: 80, maxScore: 100, weight: 1 })).toBeNull();
  });
});

describe("grade-calc sumWeights", () => {
  it("sums positive weights", () => {
    expect(sumWeights([{ name: "a", score: 0, maxScore: 1, weight: 1 }, { name: "b", score: 0, maxScore: 1, weight: 2.5 }])).toBeCloseTo(3.5);
  });

  it("ignores zero weights", () => {
    expect(sumWeights([{ name: "a", score: 0, maxScore: 1, weight: 0 }, { name: "b", score: 0, maxScore: 1, weight: 3 }])).toBe(3);
  });
});

describe("grade-calc letterForPercent", () => {
  it("returns letters", () => {
    expect(letterForPercent(99)).toBe("A");
    expect(letterForPercent(85)).toBe("B");
    expect(letterForPercent(72)).toBe("C-");
  });
});

describe("grade-calc DEFAULT_BOUNDARIES", () => {
  it("includes A and F", () => {
    const letters = DEFAULT_BOUNDARIES.map((b) => b.letter);
    expect(letters).toContain("A");
    expect(letters).toContain("F");
  });

  it("makeEmptyItem returns 100 max", () => {
    expect(makeEmptyItem().maxScore).toBe(100);
  });
});

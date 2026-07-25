import { describe, it, expect } from "vitest";
import { validateInput, intersection, union, conditionalAGivenB, conditionalBGivenA, bayes, oddsFromProb, formatPct } from "./logic";

describe("validateInput", () => {
  it("passes valid input", () => {
    expect(validateInput({ pA: 0.5, pB: 0.4, pAB: 0.2 })).toEqual({ pA: 0.5, pB: 0.4, pAB: 0.2 });
  });
  it("allows missing pAB", () => {
    expect(validateInput({ pA: 0.5, pB: 0.4 })).toEqual({ pA: 0.5, pB: 0.4 });
  });
  it("errors on out-of-range P(A)", () => {
    expect(validateInput({ pA: 1.5, pB: 0.4 })).toHaveProperty("error");
  });
  it("errors when pAB exceeds min(pA, pB)", () => {
    expect(validateInput({ pA: 0.3, pB: 0.4, pAB: 0.5 })).toHaveProperty("error");
  });
  it("errors when pAB violates lower bound", () => {
    expect(validateInput({ pA: 0.9, pB: 0.9, pAB: 0.1 })).toHaveProperty("error");
  });
});

describe("intersection", () => {
  it("uses provided pAB", () => {
    expect(intersection({ pA: 0.5, pB: 0.4, pAB: 0.2 })).toBeCloseTo(0.2);
  });
  it("assumes independence when pAB missing", () => {
    expect(intersection({ pA: 0.5, pB: 0.4 })).toBeCloseTo(0.2);
  });
  it("is 0 when either is 0", () => {
    expect(intersection({ pA: 0, pB: 0.5 })).toBe(0);
  });
});

describe("union", () => {
  it("computes P(A) + P(B) - P(A∩B)", () => {
    expect(union({ pA: 0.5, pB: 0.4, pAB: 0.2 })).toBeCloseTo(0.7);
  });
  it("with independence: 0.5 + 0.4 - 0.2 = 0.7", () => {
    expect(union({ pA: 0.5, pB: 0.4 })).toBeCloseTo(0.7);
  });
  it("never exceeds 1 for valid input", () => {
    const u = union({ pA: 0.6, pB: 0.6, pAB: 0.4 });
    expect(u).toBeLessThanOrEqual(1);
  });
});

describe("conditionalAGivenB", () => {
  it("computes P(A|B) = P(A∩B)/P(B)", () => {
    expect(conditionalAGivenB({ pA: 0.5, pB: 0.4, pAB: 0.2 })).toBeCloseTo(0.5);
  });
  it("errors when P(B) = 0", () => {
    expect(conditionalAGivenB({ pA: 0.5, pB: 0 })).toHaveProperty("error");
  });
});

describe("conditionalBGivenA", () => {
  it("computes P(B|A) = P(A∩B)/P(A)", () => {
    expect(conditionalBGivenA({ pA: 0.5, pB: 0.4, pAB: 0.2 })).toBeCloseTo(0.4);
  });
  it("errors when P(A) = 0", () => {
    expect(conditionalBGivenA({ pA: 0, pB: 0.4 })).toHaveProperty("error");
  });
});

describe("bayes", () => {
  it("computes P(A|B) = P(B|A)*P(A)/P(B)", () => {
    expect(bayes(0.1, 0.05, 0.5)).toBeCloseTo(1.0);
  });
  it("errors when P(B) = 0", () => {
    expect(bayes(0.1, 0, 0.5)).toHaveProperty("error");
  });
  it("errors on invalid probability", () => {
    expect(bayes(2, 0.5, 0.5)).toHaveProperty("error");
  });
});

describe("oddsFromProb", () => {
  it("computes p/(1-p)", () => {
    expect(oddsFromProb(0.25)).toBeCloseTo(1 / 3);
    expect(oddsFromProb(0.5)).toBeCloseTo(1);
  });
  it("errors when p=1 (infinite odds)", () => {
    expect(oddsFromProb(1)).toHaveProperty("error");
  });
  it("errors on invalid probability", () => {
    expect(oddsFromProb(1.5)).toHaveProperty("error");
  });
});

describe("formatPct", () => {
  it("formats as percentage", () => {
    expect(formatPct(0.5)).toBe("50.00%");
    expect(formatPct(0.1234)).toBe("12.34%");
  });
});

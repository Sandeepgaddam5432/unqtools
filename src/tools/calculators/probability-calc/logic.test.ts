import { describe, it, expect } from "vitest";
import {
  validateInput, intersection, union, conditionalAGivenB, conditionalBGivenA,
  bayes, oddsFromProb, probFromOdds, complement, isIndependent,
  isMutuallyExclusive, summarize, summarizeBatch, permutations, combinations,
  binomialPmf, binomialCdf, formatPct, formatDec, summaryHeader, summaryToCsv,
  batchToCsv,
} from "./logic";

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
  it("errors on NaN", () => {
    expect(validateInput({ pA: NaN, pB: 0.5 })).toHaveProperty("error");
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

describe("oddsFromProb + probFromOdds", () => {
  it("computes p/(1-p)", () => {
    expect(oddsFromProb(0.25)).toBeCloseTo(1 / 3);
    expect(oddsFromProb(0.5)).toBeCloseTo(1);
  });
  it("errors when p=1", () => {
    expect(oddsFromProb(1)).toHaveProperty("error");
  });
  it("errors on invalid probability", () => {
    expect(oddsFromProb(1.5)).toHaveProperty("error");
  });
  it("inverts odds → prob", () => {
    expect(probFromOdds(1)).toBeCloseTo(0.5);
    expect(probFromOdds(3)).toBeCloseTo(0.75);
  });
  it("errors on negative odds", () => {
    expect(probFromOdds(-1)).toHaveProperty("error");
  });
});

describe("complement", () => {
  it("returns 1 − p", () => { expect(complement(0.3)).toBe(0.7); });
  it("errors on invalid", () => { expect(complement(1.5)).toHaveProperty("error"); });
});

describe("isIndependent + isMutuallyExclusive", () => {
  it("independent when pAB = pA·pB", () => {
    expect(isIndependent({ pA: 0.5, pB: 0.4 })).toBe(true);
  });
  it("not independent when pAB differs", () => {
    expect(isIndependent({ pA: 0.5, pB: 0.4, pAB: 0.1 })).toBe(false);
  });
  it("mutually exclusive when pAB = 0", () => {
    expect(isMutuallyExclusive({ pA: 0.5, pB: 0.4, pAB: 0 })).toBe(true);
  });
  it("not mutually exclusive when pAB > 0", () => {
    expect(isMutuallyExclusive({ pA: 0.5, pB: 0.4, pAB: 0.1 })).toBe(false);
  });
});

describe("summarize + summarizeBatch", () => {
  it("produces full summary", () => {
    const s = summarize({ pA: 0.5, pB: 0.4, pAB: 0.2 });
    expect(s.pA).toBe(0.5);
    expect(s.pAUB).toBeCloseTo(0.7);
    expect(s.pAGivenB).toBeCloseTo(0.5);
    expect(s.pNotA).toBe(0.5);
    // pAB = pA·pB = 0.2 → independent by definition
    expect(s.independent).toBe(true);
    expect(s.mutuallyExclusive).toBe(false);
    expect(s.oddsA).toBeCloseTo(1);
  });
  it("flags dependence when pAB ≠ pA·pB", () => {
    const s = summarize({ pA: 0.5, pB: 0.4, pAB: 0.1 });
    expect(s.independent).toBe(false);
  });
  it("handles pB=0 gracefully", () => {
    const s = summarize({ pA: 0.5, pB: 0 });
    expect(s.pAGivenB).toBeNull();
  });
  it("batch summarizes multiple", () => {
    const arr = summarizeBatch([{ pA: 0.5, pB: 0.4 }, { pA: 0.3, pB: 0.3 }]);
    expect(arr.length).toBe(2);
  });
});

describe("permutations + combinations", () => {
  it("nPr computes correctly", () => {
    expect(permutations(5, 2)).toBe(20);
  });
  it("nCr computes correctly", () => {
    expect(combinations(5, 2)).toBe(10);
    expect(combinations(10, 3)).toBe(120);
  });
  it("returns 0 when r > n", () => {
    expect(permutations(2, 5)).toBe(0);
    expect(combinations(2, 5)).toBe(0);
  });
  it("errors on non-integers", () => {
    expect(permutations(5.5, 2)).toHaveProperty("error");
    expect(combinations(5.5, 2)).toHaveProperty("error");
  });
});

describe("binomialPmf + binomialCdf", () => {
  it("computes P(X=k)", () => {
    const p = binomialPmf(10, 0.5, 5);
    if (typeof p !== "number") throw new Error("err");
    expect(p).toBeCloseTo(0.246, 2);
  });
  it("computes P(X≤k)", () => {
    const c = binomialCdf(10, 0.5, 0);
    if (typeof c !== "number") throw new Error("err");
    expect(c).toBeCloseTo(Math.pow(0.5, 10), 6);
  });
  it("errors on invalid p", () => {
    expect(binomialPmf(10, 1.5, 5)).toHaveProperty("error");
  });
  it("errors on out-of-range k", () => {
    expect(binomialPmf(10, 0.5, 11)).toHaveProperty("error");
  });
});

describe("formatters", () => {
  it("formatPct formats percentage", () => {
    expect(formatPct(0.5)).toBe("50.00%");
    expect(formatPct(0.1234)).toBe("12.34%");
  });
  it("formatDec formats decimal", () => {
    expect(formatDec(0.123456)).toBe("0.1235");
  });
});

describe("CSV helpers", () => {
  it("summaryHeader returns header", () => {
    expect(summaryHeader()).toContain("P(A)");
    expect(summaryHeader()).toContain("P(A∩B)");
  });
  it("summaryToCsv returns row", () => {
    const s = summarize({ pA: 0.5, pB: 0.4, pAB: 0.2 });
    const row = summaryToCsv(s);
    expect(row.split(",").length).toBe(10);
    expect(row).toContain("0.5");
  });
  it("batchToCsv emits header + rows", () => {
    const arr = summarizeBatch([{ pA: 0.5, pB: 0.4 }, { pA: 0.3, pB: 0.3 }]);
    const csv = batchToCsv(arr);
    expect(csv.split("\n").length).toBe(3);
  });
});

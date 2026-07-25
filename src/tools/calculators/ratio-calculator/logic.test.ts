import { describe, it, expect } from "vitest";
import {
  gcd, lcm, simplifyRatio, inverseRatio, scaleRatio, solveProportion,
  ratioToDecimal, ratioToPercentage, compareRatios, continuedFraction,
  partToWhole, simplifyBatch, batchToCsv, formatRatio, formatFraction,
  closestAspect, validateRatio, ASPECT_PRESETS,
} from "./logic";

describe("gcd + lcm", () => {
  it("computes gcd", () => {
    expect(gcd(12, 18)).toBe(6);
    expect(gcd(7, 13)).toBe(1);
  });
  it("handles 0", () => {
    expect(gcd(0, 5)).toBe(5);
    expect(gcd(0, 0)).toBe(1);
  });
  it("computes lcm", () => {
    expect(lcm(4, 6)).toBe(12);
    expect(lcm(0, 5)).toBe(0);
  });
});

describe("simplifyRatio", () => {
  it("reduces 12:18 to 2:3", () => {
    expect(simplifyRatio(12, 18)).toEqual({ a: 2, b: 3 });
  });
  it("handles 0:n", () => {
    expect(simplifyRatio(0, 5)).toEqual({ a: 0, b: 1 });
  });
  it("handles n:0", () => {
    expect(simplifyRatio(5, 0)).toEqual({ a: 1, b: 0 });
  });
  it("errors on 0:0", () => {
    expect(simplifyRatio(0, 0)).toHaveProperty("error");
  });
  it("errors on non-finite", () => {
    expect(simplifyRatio(NaN, 5)).toHaveProperty("error");
  });
  it("simplifies with negatives (gcd is positive)", () => {
    expect(simplifyRatio(-12, 18)).toEqual({ a: -2, b: 3 });
  });
});

describe("inverseRatio + scaleRatio", () => {
  it("inverts 2:3 → 3:2", () => {
    expect(inverseRatio(2, 3)).toEqual({ a: 3, b: 2 });
  });
  it("scales 2:3 by 4 → 8:12", () => {
    expect(scaleRatio(2, 3, 4)).toEqual({ a: 8, b: 12 });
  });
  it("errors on non-finite factor", () => {
    expect(scaleRatio(2, 3, NaN)).toHaveProperty("error");
  });
});

describe("solveProportion", () => {
  it("solves for a when a is null", () => {
    const r = solveProportion({ a: null, b: 4, c: 6, d: 8 });
    if ("error" in r) throw new Error("should not error");
    expect(r.solved).toEqual({ missing: "a", value: 3 });
  });
  it("solves for b when b is null", () => {
    const r = solveProportion({ a: 2, b: null, c: 6, d: 12 });
    if ("error" in r) throw new Error("should not error");
    expect(r.solved).toEqual({ missing: "b", value: 4 });
  });
  it("solves for c when c is null", () => {
    const r = solveProportion({ a: 2, b: 3, c: null, d: 9 });
    if ("error" in r) throw new Error("should not error");
    expect(r.solved).toEqual({ missing: "c", value: 6 });
  });
  it("solves for d when d is null", () => {
    const r = solveProportion({ a: 2, b: 3, c: 6, d: null });
    if ("error" in r) throw new Error("should not error");
    expect(r.solved).toEqual({ missing: "d", value: 9 });
  });
  it("errors when no term is missing", () => {
    expect(solveProportion({ a: 1, b: 2, c: 3, d: 4 })).toHaveProperty("error");
  });
  it("errors when multiple terms missing", () => {
    expect(solveProportion({ a: null, b: null, c: 3, d: 4 })).toHaveProperty("error");
  });
  it("errors on division by zero", () => {
    expect(solveProportion({ a: null, b: 0, c: 3, d: 4 })).toHaveProperty("error");
  });
});

describe("ratioToDecimal + ratioToPercentage", () => {
  it("returns a/b", () => {
    expect(ratioToDecimal(1, 2)).toBeCloseTo(0.5);
    expect(ratioToDecimal(3, 4)).toBeCloseTo(0.75);
  });
  it("errors on divide by zero", () => {
    expect(ratioToDecimal(1, 0)).toHaveProperty("error");
  });
  it("percentage converts 1:2 → 50.00%", () => {
    expect(ratioToPercentage(1, 2)).toBe("50.00%");
  });
  it("percentage errors on zero denominator", () => {
    expect(ratioToPercentage(1, 0)).toHaveProperty("error");
  });
});

describe("compareRatios", () => {
  it("returns -1 when left < right", () => {
    expect(compareRatios(1, 4, 1, 2)).toBe(-1);
  });
  it("returns 1 when left > right", () => {
    expect(compareRatios(3, 4, 1, 2)).toBe(1);
  });
  it("returns 0 when equal", () => {
    expect(compareRatios(1, 2, 2, 4)).toBe(0);
  });
  it("errors on zero denominator", () => {
    expect(compareRatios(1, 0, 1, 2)).toHaveProperty("error");
  });
});

describe("continuedFraction", () => {
  it("expands 355/113 to a few terms", () => {
    const cf = continuedFraction(355, 113);
    if (Array.isArray(cf)) {
      expect(cf[0]).toBe(3);
      expect(cf.length).toBeGreaterThan(2);
    } else throw new Error("err");
  });
  it("expands 1/2 to [0; 2]", () => {
    expect(continuedFraction(1, 2)).toEqual([0, 2]);
  });
  it("errors on zero denominator", () => {
    expect(continuedFraction(1, 0)).toHaveProperty("error");
  });
});

describe("partToWhole", () => {
  it("returns fractions and total", () => {
    const r = partToWhole(1, 3);
    if ("error" in r) throw new Error("err");
    expect(r.total).toBe(4);
    expect(r.aFraction).toBeCloseTo(0.25);
    expect(r.bFraction).toBeCloseTo(0.75);
  });
  it("errors on zero total", () => {
    expect(partToWhole(0, 0)).toHaveProperty("error");
  });
});

describe("simplifyBatch + batchToCsv", () => {
  it("simplifies multiple ratios", () => {
    const r = simplifyBatch([[12, 18], [3, 9]]);
    expect(r.length).toBe(2);
    expect(r[0]).toEqual({ a: 2, b: 3 });
    expect(r[1]).toEqual({ a: 1, b: 3 });
  });
  it("batchToCsv emits header + rows", () => {
    const ratios: [number, number][] = [[12, 18], [3, 9]];
    const csv = batchToCsv(ratios, simplifyBatch(ratios));
    expect(csv.split("\n")[0]).toBe("Input,Simplified,Decimal,Percentage");
    expect(csv).toContain("12:18");
    expect(csv).toContain("2:3");
  });
});

describe("formatRatio + formatFraction", () => {
  it("formats a:b", () => {
    expect(formatRatio(2, 3)).toBe("2:3");
  });
  it("formats a/b", () => {
    expect(formatFraction(2, 3)).toBe("2/3");
  });
});

describe("closestAspect", () => {
  it("finds 16:9 for 1920:1080", () => {
    const a = closestAspect(1920, 1080);
    expect(a?.label).toContain("16:9");
  });
  it("finds 4:3 for 800:600", () => {
    const a = closestAspect(800, 600);
    expect(a?.label).toContain("4:3");
  });
  it("returns null for zero denominator", () => {
    expect(closestAspect(1, 0)).toBeNull();
  });
});

describe("validateRatio", () => {
  it("accepts valid", () => { expect(validateRatio(2, 3)).toEqual({ ok: true }); });
  it("rejects NaN", () => { expect(validateRatio(NaN, 3)).toHaveProperty("error"); });
});

describe("constants", () => {
  it("ASPECT_PRESETS has 7 entries", () => {
    expect(ASPECT_PRESETS.length).toBe(7);
  });
});

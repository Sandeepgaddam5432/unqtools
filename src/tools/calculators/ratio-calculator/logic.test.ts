import { describe, it, expect } from "vitest";
import { gcd, simplifyRatio, solveProportion, ratioToDecimal, formatRatio } from "./logic";

describe("gcd", () => {
  it("computes gcd", () => {
    expect(gcd(12, 18)).toBe(6);
    expect(gcd(7, 13)).toBe(1);
  });
  it("handles 0", () => {
    expect(gcd(0, 5)).toBe(5);
    expect(gcd(0, 0)).toBe(1);
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

describe("ratioToDecimal", () => {
  it("returns a/b", () => {
    expect(ratioToDecimal(1, 2)).toBeCloseTo(0.5);
    expect(ratioToDecimal(3, 4)).toBeCloseTo(0.75);
  });
  it("errors on divide by zero", () => {
    expect(ratioToDecimal(1, 0)).toHaveProperty("error");
  });
});

describe("formatRatio", () => {
  it("formats a:b", () => {
    expect(formatRatio(2, 3)).toBe("2:3");
    expect(formatRatio(1, 4)).toBe("1:4");
  });
});

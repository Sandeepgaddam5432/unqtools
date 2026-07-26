/**
 * Standard Deviation Calculator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { computeStats, parseValues, statsToCsv } from "./logic";

const D1 = [2, 4, 4, 4, 5, 5, 7, 9];
const D2 = [1, 2, 3, 4, 5];

describe("computeStats — basic", () => {
  it("errors on empty input", () => {
    expect("error" in computeStats({ values: [] })).toBe(true);
  });
  it("errors on no valid values", () => {
    expect("error" in computeStats({ values: [NaN, Infinity] })).toBe(true);
  });
  it("computes count and sum", () => {
    const r = computeStats({ values: D2 });
    if ("error" in r) throw new Error("err");
    expect(r.count).toBe(5);
    expect(r.sum).toBe(15);
  });
  it("computes mean", () => {
    const r = computeStats({ values: D2 });
    if ("error" in r) throw new Error("err");
    expect(r.mean).toBe(3);
  });
  it("computes median (odd)", () => {
    const r = computeStats({ values: D2 });
    if ("error" in r) throw new Error("err");
    expect(r.median).toBe(3);
  });
  it("computes median (even)", () => {
    const r = computeStats({ values: [1, 2, 3, 4] });
    if ("error" in r) throw new Error("err");
    expect(r.median).toBe(2.5);
  });
});

describe("computeStats — modes & range", () => {
  it("finds the mode", () => {
    const r = computeStats({ values: D1 });
    if ("error" in r) throw new Error("err");
    expect(r.modes).toEqual([4]);
  });
  it("returns empty mode if all unique", () => {
    const r = computeStats({ values: D2 });
    if ("error" in r) throw new Error("err");
    expect(r.modes).toEqual([]);
  });
  it("range = max − min", () => {
    const r = computeStats({ values: D1 });
    if ("error" in r) throw new Error("err");
    expect(r.min).toBe(2);
    expect(r.max).toBe(9);
    expect(r.range).toBe(7);
  });
});

describe("computeStats — variance & std dev", () => {
  it("population variance of D2", () => {
    const r = computeStats({ values: D2 });
    if ("error" in r) throw new Error("err");
    expect(r.variancePop).toBe(2);
    expect(r.stdDevPop).toBeCloseTo(Math.sqrt(2), 6);
  });
  it("sample variance uses n-1", () => {
    const r = computeStats({ values: D2 });
    if ("error" in r) throw new Error("err");
    expect(r.varianceSample).toBe(2.5);
  });
  it("std dev (sample) = sqrt(variance sample)", () => {
    const r = computeStats({ values: D2 });
    if ("error" in r) throw new Error("err");
    expect(r.stdDevSample).toBeCloseTo(Math.sqrt(2.5), 6);
  });
});

describe("computeStats — quartiles & IQR", () => {
  it("computes Q1, Q2, Q3", () => {
    const r = computeStats({ values: D1 });
    if ("error" in r) throw new Error("err");
    expect(r.q1).toBeCloseTo(4, 5);
    expect(r.q2).toBeCloseTo(4.5, 5);
    expect(r.q3).toBeCloseTo(5.5, 5);
  });
  it("IQR = Q3 − Q1", () => {
    const r = computeStats({ values: D1 });
    if ("error" in r) throw new Error("err");
    expect(r.iqr).toBeCloseTo(r.q3 - r.q1, 5);
  });
});

describe("computeStats — outliers", () => {
  it("detects IQR outliers", () => {
    const r = computeStats({ values: [1, 2, 3, 4, 5, 100] });
    if ("error" in r) throw new Error("err");
    expect(r.outliersIqr).toContain(100);
  });
  it("detects z-score outliers", () => {
    const r = computeStats({ values: [1, 1, 1, 1, 1, 1, 1, 1, 1, 50], zThreshold: 2 });
    if ("error" in r) throw new Error("err");
    expect(r.outliersZ).toContain(50);
  });
});

describe("computeStats — shape metrics", () => {
  it("skewness near 0 for symmetric data", () => {
    const r = computeStats({ values: [1, 2, 3, 4, 5] });
    if ("error" in r) throw new Error("err");
    expect(Math.abs(r.skewness)).toBeLessThan(0.1);
  });
  it("kurtosis near 0 for normal-ish data (excess)", () => {
    const r = computeStats({ values: [1, 2, 3, 4, 5] });
    if ("error" in r) throw new Error("err");
    expect(r.kurtosis).toBeLessThan(2);
  });
});

describe("computeStats — derived metrics", () => {
  it("standard error = std / sqrt(n)", () => {
    const r = computeStats({ values: D2 });
    if ("error" in r) throw new Error("err");
    expect(r.standardError).toBeCloseTo(r.stdDevSample / Math.sqrt(5), 6);
  });
  it("CI95 contains the mean", () => {
    const r = computeStats({ values: D2 });
    if ("error" in r) throw new Error("err");
    expect(r.ci95Lower).toBeLessThan(r.mean);
    expect(r.ci95Upper).toBeGreaterThan(r.mean);
  });
  it("coefficient of variation positive for positive mean", () => {
    const r = computeStats({ values: D2 });
    if ("error" in r) throw new Error("err");
    expect(r.coefficientOfVariation).toBeGreaterThan(0);
  });
  it("geometric mean of [1,2,4,8] = sqrt4(64) = ~2.828", () => {
    const r = computeStats({ values: [1, 2, 4, 8] });
    if ("error" in r) throw new Error("err");
    expect(r.geometricMean).toBeCloseTo(2.828, 2);
  });
  it("harmonic mean of [1,2,4] = 12/7", () => {
    const r = computeStats({ values: [1, 2, 4] });
    if ("error" in r) throw new Error("err");
    expect(r.harmonicMean).toBeCloseTo(12 / 7, 4);
  });
  it("returns NaN for geometric mean of negative values", () => {
    const r = computeStats({ values: [-1, 2, 3] });
    if ("error" in r) throw new Error("err");
    expect(Number.isNaN(r.geometricMean)).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("computeStats — sums", () => {
  it("sum of squares", () => {
    const r = computeStats({ values: [1, 2, 3] });
    if ("error" in r) throw new Error("err");
    expect(r.sumOfSquares).toBe(14);
  });
  it("sum of squared deviations", () => {
    const r = computeStats({ values: [1, 2, 3] });
    if ("error" in r) throw new Error("err");
    expect(r.sumOfSquaredDeviations).toBeCloseTo(2, 6); // var pop * n = (2/3)*3
  });
});

describe("computeStats — trimmed mean", () => {
  it("trims 10% from each end", () => {
    // 10 values, trim 1 from each end
    const r = computeStats({ values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 100] });
    if ("error" in r) throw new Error("err");
    // trimmed: [2,3,4,5,6,7,8,9] mean = 5.5
    expect(r.trimmedMean10).toBeCloseTo(5.5, 5);
  });
});

describe("parseValues", () => {
  it("splits on whitespace and commas", () => {
    expect(parseValues("1, 2 3;4\n5")).toEqual([1, 2, 3, 4, 5]);
  });
  it("ignores non-numeric tokens", () => {
    expect(parseValues("1, two, 3")).toEqual([1, 3]);
  });
});

describe("statsToCsv", () => {
  it("produces CSV with header", () => {
    const r = computeStats({ values: D2 });
    if ("error" in r) throw new Error("err");
    const csv = statsToCsv(r);
    expect(csv.split("\n")[0]).toBe("Statistic,Value");
    expect(csv).toContain("Mean");
    expect(csv).toContain("Std Dev (sample)");
  });
});

/**
 * ARR Calculator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { calculateArr, projectionToCsv, arrSummaryText } from "./logic";

describe("calculateArr — validation", () => {
  it("errors on negative MRR", () => {
    expect("error" in calculateArr({ mrr: -1 })).toBe(true);
  });
  it("errors on non-finite MRR", () => {
    expect("error" in calculateArr({ mrr: Infinity })).toBe(true);
  });
  it("errors on negative previous MRR", () => {
    expect("error" in calculateArr({ mrr: 100, previousMrr: -10 })).toBe(true);
  });
  it("errors on churn rate out of range", () => {
    expect("error" in calculateArr({ mrr: 100, monthlyChurnRate: 1.5 })).toBe(true);
  });
  it("errors on net new MRR loss exceeding MRR", () => {
    expect("error" in calculateArr({ mrr: 100, netNewMrrPerMonth: -200 })).toBe(true);
  });
});

describe("calculateArr — core", () => {
  it("computes ARR = 12 × MRR", () => {
    const r = calculateArr({ mrr: 100 });
    if ("error" in r) throw new Error("should not error");
    expect(r.arr).toBe(1200);
    expect(r.quarterlyRecurringRevenue).toBe(300);
  });
  it("computes growth rate vs previous MRR", () => {
    const r = calculateArr({ mrr: 110, previousMrr: 100 });
    if ("error" in r) throw new Error("should not error");
    expect(r.growthRate).toBeCloseTo(0.1, 4);
  });
  it("computes CAGR when months are given", () => {
    const r = calculateArr({ mrr: 110, previousMrr: 100, monthsBetween: 12 });
    if ("error" in r) throw new Error("should not error");
    expect(r.cagr).toBeCloseTo(0.1, 4);
  });
  it("growthRate is null when previousMrr missing", () => {
    const r = calculateArr({ mrr: 100 });
    if ("error" in r) throw new Error("should not error");
    expect(r.growthRate).toBeNull();
    expect(r.cagr).toBeNull();
  });
  it("warns on negative growth", () => {
    const r = calculateArr({ mrr: 50, previousMrr: 100 });
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("Negative growth"))).toBe(true);
  });
});

describe("calculateArr — churn", () => {
  it("computes annual churn from monthly", () => {
    const r = calculateArr({ mrr: 100, monthlyChurnRate: 0.05 });
    if ("error" in r) throw new Error("should not error");
    // 1 - 0.95^12 ≈ 0.4596
    expect(r.annualChurnRate).toBeCloseTo(0.4596, 2);
  });
  it("warns on very high monthly churn", () => {
    const r = calculateArr({ mrr: 100, monthlyChurnRate: 0.15 });
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("high"))).toBe(true);
  });
  it("warns when annualised churn exceeds 50%", () => {
    const r = calculateArr({ mrr: 100, monthlyChurnRate: 0.06 });
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("unsustainable"))).toBe(true);
  });
});

describe("calculateArr — projection", () => {
  it("produces a 12-month projection", () => {
    const r = calculateArr({ mrr: 100, monthlyChurnRate: 0.02, netNewMrrPerMonth: 5 });
    if ("error" in r) throw new Error("should not error");
    expect(r.projection.length).toBe(12);
    expect(r.projection[0]!.month).toBe(1);
    expect(r.projection[11]!.month).toBe(12);
  });
  it("projection MRR grows when net new > churn", () => {
    const r = calculateArr({ mrr: 100, monthlyChurnRate: 0.02, netNewMrrPerMonth: 20 });
    if ("error" in r) throw new Error("should not error");
    expect(r.projection[11]!.mrr).toBeGreaterThan(100);
  });
  it("projection MRR shrinks when net new < churn", () => {
    const r = calculateArr({ mrr: 100, monthlyChurnRate: 0.1, netNewMrrPerMonth: 0 });
    if ("error" in r) throw new Error("should not error");
    expect(r.projection[11]!.mrr).toBeLessThan(100);
  });
});

describe("exports", () => {
  it("projectionToCsv produces header + 12 rows", () => {
    const r = calculateArr({ mrr: 100, monthlyChurnRate: 0.02, netNewMrrPerMonth: 5 });
    if ("error" in r) throw new Error("should not error");
    const csv = projectionToCsv(r);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Month");
    expect(lines.length).toBe(13);
  });
  it("arrSummaryText contains key metrics", () => {
    const r = calculateArr({ mrr: 100, previousMrr: 80, monthlyChurnRate: 0.02 });
    if ("error" in r) throw new Error("should not error");
    const text = arrSummaryText(r);
    expect(text).toContain("MRR");
    expect(text).toContain("ARR");
    expect(text).toContain("Growth rate");
    expect(text).toContain("Annual churn");
  });
});

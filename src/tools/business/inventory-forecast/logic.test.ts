import { describe, it, expect } from "vitest";
import {
  linearRegression,
  computeR2,
  forecast,
  suggestReorderPoint,
  classifyTrend,
  type UsagePoint,
} from "./logic";

const history: UsagePoint[] = [
  { period: "W1", units: 100 },
  { period: "W2", units: 110 },
  { period: "W3", units: 120 },
  { period: "W4", units: 130 },
];

describe("inventory-forecast linearRegression", () => {
  it("returns slope and intercept for linear data", () => {
    const { slope, intercept } = linearRegression(history);
    expect(slope).toBeCloseTo(10, 5);
    expect(intercept).toBeCloseTo(100, 5);
  });

  it("returns 0 slope for constant data", () => {
    const { slope } = linearRegression([
      { period: "1", units: 50 },
      { period: "2", units: 50 },
      { period: "3", units: 50 },
    ]);
    expect(slope).toBeCloseTo(0, 5);
  });

  it("handles empty input", () => {
    expect(linearRegression([])).toEqual({ slope: 0, intercept: 0 });
  });
});

describe("inventory-forecast computeR2", () => {
  it("returns 1 for perfectly linear data", () => {
    const { slope, intercept } = linearRegression(history);
    expect(computeR2(history, slope, intercept)).toBeCloseTo(1, 5);
  });

  it("returns < 1 for noisy data", () => {
    const noisy: UsagePoint[] = [
      { period: "1", units: 100 },
      { period: "2", units: 50 },
      { period: "3", units: 150 },
      { period: "4", units: 80 },
    ];
    const { slope, intercept } = linearRegression(noisy);
    expect(computeR2(noisy, slope, intercept)).toBeLessThan(1);
  });
});

describe("inventory-forecast forecast", () => {
  it("projects N future periods", () => {
    const r = forecast(history, 1000, 5);
    expect(r.isValid).toBe(true);
    expect(r.projected.length).toBe(5);
  });

  it("extrapolates rising trend correctly", () => {
    const r = forecast(history, 1000, 3);
    expect(r.projected[0]).toBeGreaterThan(130);
  });

  it("reports total projected usage", () => {
    const r = forecast(history, 1000, 3);
    expect(r.totalProjected).toBeGreaterThan(0);
  });

  it("computes average usage", () => {
    const r = forecast(history, 1000, 1);
    expect(r.averageUsage).toBeCloseTo(115, 0); // (100+110+120+130)/4
  });

  it("detects stockout period", () => {
    // current stock 200, projected usage rising from 140 -> 200 is enough to hit zero in 2 periods
    const r = forecast(history, 200, 10);
    expect(r.projectedStockoutPeriod).not.toBeNull();
    expect(r.projectedStockoutPeriod).toBeLessThanOrEqual(3);
  });

  it("returns null stockout if stock never hits zero", () => {
    const r = forecast(history, 100000, 3);
    expect(r.projectedStockoutPeriod).toBeNull();
  });

  it("rejects insufficient history", () => {
    const r = forecast([{ period: "1", units: 100 }], 1000, 3);
    expect(r.isValid).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it("rejects non-positive periods", () => {
    const r = forecast(history, 1000, 0);
    expect(r.isValid).toBe(false);
  });
});

describe("inventory-forecast suggestReorderPoint", () => {
  it("computes reorder point", () => {
    expect(suggestReorderPoint(10, 2, 5)).toBe(25);
  });

  it("handles zero safety stock", () => {
    expect(suggestReorderPoint(10, 3, 0)).toBe(30);
  });

  it("returns 0 for negative inputs", () => {
    expect(suggestReorderPoint(-1, 3, 0)).toBe(0);
  });
});

describe("inventory-forecast classifyTrend", () => {
  it("classifies rising", () => {
    expect(classifyTrend(5)).toBe("rising");
  });

  it("classifies falling", () => {
    expect(classifyTrend(-5)).toBe("falling");
  });

  it("classifies stable", () => {
    expect(classifyTrend(0.1)).toBe("stable");
  });
});

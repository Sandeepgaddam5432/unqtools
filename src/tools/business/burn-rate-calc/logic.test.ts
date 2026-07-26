import { describe, it, expect } from "vitest";
import {
  calcGrossBurn, calcNetBurn, calcRunwayMonths, calcCashZeroDate, linearTrend, planBurnRate,
  planBatch, renderBatchCsv, renderReport, getBurnRatePresets, formatCurrency, categorizeRunway,
} from "./logic";

describe("burn-rate-calc calcGrossBurn", () => {
  it("returns monthly expenses", () => {
    expect(calcGrossBurn(50_000)).toBe(50_000);
  });
  it("clamps negative to 0", () => {
    expect(calcGrossBurn(-100)).toBe(0);
  });
});

describe("burn-rate-calc calcNetBurn", () => {
  it("returns expenses - revenue", () => {
    expect(calcNetBurn(50_000, 30_000)).toBe(20_000);
  });
  it("returns negative when revenue exceeds expenses", () => {
    expect(calcNetBurn(50_000, 70_000)).toBe(-20_000);
  });
});

describe("burn-rate-calc calcRunwayMonths", () => {
  it("returns cash / netBurn", () => {
    expect(calcRunwayMonths(500_000, 25_000)).toBe(20);
  });
  it("returns Infinity when netBurn <= 0", () => {
    expect(calcRunwayMonths(500_000, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(calcRunwayMonths(500_000, -10_000)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("burn-rate-calc calcCashZeroDate", () => {
  it("returns a date in the future", () => {
    const start = new Date(Date.UTC(2025, 0, 1));
    const { date, iso } = calcCashZeroDate(12, start);
    expect(date.getTime()).toBeGreaterThan(start.getTime());
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("returns 'never' for infinite runway", () => {
    const { iso } = calcCashZeroDate(Number.POSITIVE_INFINITY);
    expect(iso).toBe("never");
  });
});

describe("burn-rate-calc linearTrend", () => {
  it("returns 0 for fewer than 2 values", () => {
    expect(linearTrend([5])).toBe(0);
    expect(linearTrend([])).toBe(0);
  });
  it("returns positive slope for increasing values", () => {
    expect(linearTrend([10, 20, 30, 40])).toBeCloseTo(10, 5);
  });
  it("returns negative slope for decreasing values", () => {
    expect(linearTrend([40, 30, 20, 10])).toBeCloseTo(-10, 5);
  });
});

describe("burn-rate-calc planBurnRate", () => {
  it("computes gross/net burn and runway", () => {
    const r = planBurnRate({ cashBalance: 1_000_000, monthlyExpenses: 100_000, monthlyRevenue: 30_000 });
    expect(r.grossBurn).toBe(100_000);
    expect(r.netBurn).toBe(70_000);
    expect(r.runwayMonths).toBeCloseTo(14.285, 2);
  });
  it("marks cash-positive when revenue exceeds expenses", () => {
    const r = planBurnRate({ cashBalance: 100_000, monthlyExpenses: 15_000, monthlyRevenue: 25_000 });
    expect(r.netBurn).toBe(-10_000);
    expect(Number.isFinite(r.runwayMonths)).toBe(false);
    expect(r.notes.some((n) => n.includes("cash positive"))).toBe(true);
  });
  it("warns on negative inputs", () => {
    const r = planBurnRate({ cashBalance: -100, monthlyExpenses: 50_000, monthlyRevenue: 30_000 });
    expect(r.warnings.some((w) => w.includes("negative"))).toBe(true);
  });
  it("computes trend with history", () => {
    const r = planBurnRate({
      cashBalance: 1_000_000, monthlyExpenses: 100_000, monthlyRevenue: 30_000,
      historicalExpenses: [80_000, 90_000, 100_000, 110_000],
      historicalRevenue: [10_000, 15_000, 22_000, 30_000],
    });
    expect(r.expenseTrend).toBeGreaterThan(0);
    expect(r.revenueTrend).toBeGreaterThan(0);
  });
  it("calculates burn rate percent", () => {
    const r = planBurnRate({ cashBalance: 1_000_000, monthlyExpenses: 100_000, monthlyRevenue: 30_000 });
    expect(r.burnRatePercent).toBeCloseTo(7, 0);
  });
});

describe("burn-rate-calc planBatch / renderBatchCsv", () => {
  it("plans batch of multiple inputs", () => {
    const rs = planBatch([
      { cashBalance: 500_000, monthlyExpenses: 50_000, monthlyRevenue: 10_000 },
      { cashBalance: 2_000_000, monthlyExpenses: 100_000, monthlyRevenue: 40_000 },
    ]);
    expect(rs.length).toBe(2);
  });
  it("renders CSV with header", () => {
    const csv = renderBatchCsv(planBatch([{ cashBalance: 500_000, monthlyExpenses: 50_000, monthlyRevenue: 10_000 }]));
    expect(csv.split("\n")[0]).toContain("index,gross_burn");
    expect(csv.split("\n")[1]).toContain("50000.00,40000.00");
  });
});

describe("burn-rate-calc renderReport", () => {
  it("renders report with all metrics", () => {
    const r = renderReport(planBurnRate({ cashBalance: 1_000_000, monthlyExpenses: 100_000, monthlyRevenue: 30_000 }));
    expect(r).toContain("Burn Rate Report");
    expect(r).toContain("Gross burn");
    expect(r).toContain("Net burn");
    expect(r).toContain("Runway");
  });
});

describe("burn-rate-calc getBurnRatePresets", () => {
  it("returns 4 presets", () => {
    expect(getBurnRatePresets().length).toBe(4);
  });
});

describe("burn-rate-calc formatCurrency", () => {
  it("formats USD", () => {
    expect(formatCurrency(50_000)).toMatch(/\$/);
  });
  it("returns dash for non-finite", () => {
    expect(formatCurrency(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("burn-rate-calc categorizeRunway", () => {
  it("categorises healthy runway", () => {
    expect(categorizeRunway(24).level).toBe("healthy");
  });
  it("categorises concerning runway", () => {
    expect(categorizeRunway(15).level).toBe("concerning");
  });
  it("categorises critical runway", () => {
    expect(categorizeRunway(8).level).toBe("critical");
    expect(categorizeRunway(3).level).toBe("critical");
  });
  it("categorises cash-positive", () => {
    expect(categorizeRunway(Number.POSITIVE_INFINITY).level).toBe("positive");
  });
});

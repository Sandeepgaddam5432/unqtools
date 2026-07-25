import { describe, it, expect } from "vitest";
import {
  calculateBreakEven,
  projectProfit,
  marginOfSafety,
  sensitivityTable,
  formatMoney,
  defaultInput,
} from "./logic";

describe("break-even-analyzer calculateBreakEven", () => {
  it("computes break-even units", () => {
    const r = calculateBreakEven({ fixedCosts: 1000, variableCostPerUnit: 5, pricePerUnit: 10 });
    expect(r.isValid).toBe(true);
    expect(r.breakEvenUnits).toBeCloseTo(200, 0);
  });

  it("computes break-even revenue", () => {
    const r = calculateBreakEven({ fixedCosts: 1000, variableCostPerUnit: 5, pricePerUnit: 10 });
    expect(r.breakEvenRevenue).toBeCloseTo(2000, 0);
  });

  it("computes contribution margin", () => {
    const r = calculateBreakEven({ fixedCosts: 1000, variableCostPerUnit: 5, pricePerUnit: 10 });
    expect(r.contributionMarginPerUnit).toBe(5);
  });

  it("computes contribution margin ratio", () => {
    const r = calculateBreakEven({ fixedCosts: 1000, variableCostPerUnit: 5, pricePerUnit: 10 });
    expect(r.contributionMarginRatio).toBeCloseTo(0.5, 2);
  });

  it("rejects price <= 0", () => {
    const r = calculateBreakEven({ fixedCosts: 1000, variableCostPerUnit: 5, pricePerUnit: 0 });
    expect(r.isValid).toBe(false);
  });

  it("flags when variable >= price", () => {
    const r = calculateBreakEven({ fixedCosts: 1000, variableCostPerUnit: 15, pricePerUnit: 10 });
    expect(r.isValid).toBe(false);
    expect(r.breakEvenUnits).toBe(Infinity);
  });

  it("rejects negative fixed costs", () => {
    const r = calculateBreakEven({ fixedCosts: -10, variableCostPerUnit: 5, pricePerUnit: 10 });
    expect(r.isValid).toBe(false);
  });
});

describe("break-even-analyzer projectProfit", () => {
  it("computes profit at given volume", () => {
    const p = projectProfit({ fixedCosts: 1000, variableCostPerUnit: 5, pricePerUnit: 10 }, 500);
    expect(p.revenue).toBe(5000);
    expect(p.totalCosts).toBe(3500);
    expect(p.profit).toBe(1500);
  });

  it("profit is 0 at break-even", () => {
    const p = projectProfit({ fixedCosts: 1000, variableCostPerUnit: 5, pricePerUnit: 10 }, 200);
    expect(p.profit).toBeCloseTo(0, 0);
  });

  it("computes margin percent", () => {
    const p = projectProfit({ fixedCosts: 1000, variableCostPerUnit: 5, pricePerUnit: 10 }, 500);
    expect(p.marginPercent).toBeCloseTo(30, 0);
  });
});

describe("break-even-analyzer marginOfSafety", () => {
  it("computes margin of safety", () => {
    expect(marginOfSafety(500, 200)).toBeCloseTo(60, 0);
  });

  it("returns 0 for non-positive actual", () => {
    expect(marginOfSafety(0, 100)).toBe(0);
  });
});

describe("break-even-analyzer sensitivityTable", () => {
  it("generates price sensitivity", () => {
    const table = sensitivityTable({ fixedCosts: 1000, variableCostPerUnit: 5, pricePerUnit: 10 }, "price", [10, 15, 20]);
    expect(table.length).toBe(3);
    expect(table[0].breakEvenUnits).toBeGreaterThan(table[2].breakEvenUnits);
  });

  it("generates volume sensitivity", () => {
    const table = sensitivityTable({ fixedCosts: 1000, variableCostPerUnit: 5, pricePerUnit: 10 }, "volume", [100, 200, 300]);
    expect(table.length).toBe(3);
    expect(table[0].profit).toBeLessThan(table[2].profit);
  });
});

describe("break-even-analyzer formatMoney", () => {
  it("formats USD", () => {
    expect(formatMoney(1500)).toBe("$1,500.00");
  });

  it("handles infinity", () => {
    expect(formatMoney(Infinity)).toBe("—");
  });
});

describe("break-even-analyzer defaultInput", () => {
  it("returns valid default", () => {
    const d = defaultInput();
    expect(d.fixedCosts).toBeGreaterThan(0);
    expect(d.pricePerUnit).toBeGreaterThan(d.variableCostPerUnit);
  });
});

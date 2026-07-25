import { describe, it, expect } from "vitest";
import {
  projectCashFlow,
  applyGrowth,
  computeRunway,
  formatMoney,
  defaultMonths,
  type MonthlyEntry,
} from "./logic";

describe("cash-flow-projector projectCashFlow", () => {
  it("computes net per month", () => {
    const r = projectCashFlow([{ month: "Jan", income: 5000, expenses: 4000 }]);
    expect(r.isValid).toBe(true);
    expect(r.netPerMonth[0]).toBe(1000);
  });

  it("computes cumulative balance", () => {
    const r = projectCashFlow([
      { month: "Jan", income: 1000, expenses: 500 },
      { month: "Feb", income: 1000, expenses: 500 },
    ], 1000);
    expect(r.cumulative[0]).toBe(1500);
    expect(r.cumulative[1]).toBe(2000);
  });

  it("computes totals", () => {
    const r = projectCashFlow(defaultMonths());
    expect(r.totalIncome).toBeGreaterThan(0);
    expect(r.totalExpenses).toBeGreaterThan(0);
    expect(r.totalNet).toBe(r.totalIncome - r.totalExpenses);
  });

  it("tracks lowest balance and month", () => {
    const r = projectCashFlow([
      { month: "Jan", income: 1000, expenses: 2000 }, // -1000
      { month: "Feb", income: 3000, expenses: 1000 }, // +2000
    ], 500);
    expect(r.lowestBalance).toBe(-500);
    expect(r.lowestMonth).toBe("Jan");
  });

  it("tracks peak balance", () => {
    const r = projectCashFlow([
      { month: "Jan", income: 5000, expenses: 1000 },
      { month: "Feb", income: 1000, expenses: 5000 },
    ], 0);
    expect(r.peakBalance).toBe(4000);
  });

  it("lists break-even (non-negative net) months", () => {
    const r = projectCashFlow([
      { month: "Jan", income: 1000, expenses: 500 },
      { month: "Feb", income: 500, expenses: 1000 },
    ]);
    expect(r.breakEvenMonths).toEqual(["Jan"]);
  });

  it("rejects empty input", () => {
    const r = projectCashFlow([]);
    expect(r.isValid).toBe(false);
  });

  it("rejects negative values", () => {
    const r = projectCashFlow([{ month: "Jan", income: -100, expenses: 0 }]);
    expect(r.isValid).toBe(false);
  });
});

describe("cash-flow-projector applyGrowth", () => {
  it("grows income and expenses", () => {
    const months = applyGrowth({ income: 1000, expenses: 500 }, 10, 5, 3);
    expect(months.length).toBe(3);
    expect(months[1].income).toBeCloseTo(1100, 0);
    expect(months[1].expenses).toBeCloseTo(525, 0);
  });

  it("handles 12+ months with year suffix", () => {
    const months = applyGrowth({ income: 1000, expenses: 500 }, 0, 0, 13);
    expect(months[12].month).toMatch(/Y2/);
  });
});

describe("cash-flow-projector computeRunway", () => {
  it("returns null when balance never hits 0", () => {
    const r = computeRunway([{ month: "Jan", income: 1000, expenses: 500 }], 1000);
    expect(r).toBeNull();
  });

  it("returns month index when balance hits 0", () => {
    const r = computeRunway([
      { month: "Jan", income: 0, expenses: 1000 },
      { month: "Feb", income: 0, expenses: 1000 },
    ], 1500);
    expect(r).toBe(2);
  });
});

describe("cash-flow-projector formatMoney", () => {
  it("formats as USD", () => {
    expect(formatMoney(1500)).toBe("$1,500.00");
  });

  it("handles infinity", () => {
    expect(formatMoney(Infinity)).toBe("—");
  });
});

describe("cash-flow-projector defaultMonths", () => {
  it("returns 6 months", () => {
    expect(defaultMonths().length).toBe(6);
  });
});

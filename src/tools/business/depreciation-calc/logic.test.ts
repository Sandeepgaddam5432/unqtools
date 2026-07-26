import { describe, it, expect } from "vitest";
import {
  straightLine,
  decliningBalance,
  sumOfYears,
  macrs,
  computeDepreciation,
  validateInputs,
  exportScheduleCSV,
  exportScheduleText,
  compareMethods,
  bookValueAtYear,
  section179,
  bonusDepreciationPercent,
  taxShield,
  perYearTaxShield,
  MACRS_RATES,
  type AssetInputs,
} from "./logic";

const baseInputs: AssetInputs = {
  cost: 10000,
  salvage: 1000,
  usefulLifeYears: 5,
  method: "straight-line",
};

describe("depreciation-calc straightLine", () => {
  it("computes equal annual depreciation", () => {
    const r = straightLine(baseInputs);
    // (10000 - 1000) / 5 = 1800 per year
    expect(r.schedule[0].depreciation).toBe(1800);
    expect(r.schedule.length).toBe(5);
  });
  it("ends at salvage value", () => {
    const r = straightLine(baseInputs);
    expect(r.finalBookValue).toBe(1000);
  });
});

describe("depreciation-calc decliningBalance", () => {
  it("depreciates more in early years", () => {
    const r = decliningBalance({ ...baseInputs, decliningRate: 2 });
    expect(r.schedule[0].depreciation).toBeGreaterThan(r.schedule[4].depreciation);
  });
  it("never goes below salvage value", () => {
    const r = decliningBalance({ ...baseInputs, decliningRate: 2 });
    expect(r.finalBookValue).toBeGreaterThanOrEqual(900); // approx salvage
  });
});

describe("depreciation-calc sumOfYears", () => {
  it("sum of depreciation equals cost - salvage", () => {
    const r = sumOfYears(baseInputs);
    expect(r.totalDepreciation).toBeCloseTo(9000, 1);
  });
  it("year 1 depreciation is highest", () => {
    const r = sumOfYears(baseInputs);
    expect(r.schedule[0].depreciation).toBeGreaterThan(r.schedule[1].depreciation);
  });
});

describe("depreciation-calc macrs", () => {
  it("uses 5-year class rates", () => {
    const r = macrs({ ...baseInputs, macrsClass: 5 });
    expect(r.schedule.length).toBe(MACRS_RATES[5].length);
  });
  it("year 1 rate is 20% for 5-year class", () => {
    const r = macrs({ ...baseInputs, macrsClass: 5, cost: 10000 });
    expect(r.schedule[0].depreciation).toBeCloseTo(2000, 0);
  });
  it("falls back to 5-year for unknown class", () => {
    const r = macrs({ ...baseInputs, macrsClass: 99 as unknown as number });
    expect(r.schedule.length).toBe(MACRS_RATES[5].length);
  });
});

describe("depreciation-calc computeDepreciation dispatch", () => {
  it("dispatches straight-line", () => {
    expect(computeDepreciation({ ...baseInputs, method: "straight-line" }).method).toBe("straight-line");
  });
  it("dispatches sum-of-years", () => {
    expect(computeDepreciation({ ...baseInputs, method: "sum-of-years" }).method).toBe("sum-of-years");
  });
});

describe("depreciation-calc validateInputs", () => {
  it("warns on zero cost", () => {
    expect(validateInputs({ ...baseInputs, cost: 0 }).some((w) => w.includes("Cost"))).toBe(true);
  });
  it("warns when salvage >= cost", () => {
    expect(validateInputs({ ...baseInputs, salvage: 10000 }).some((w) => w.includes("Salvage value"))).toBe(true);
  });
  it("warns on negative salvage", () => {
    expect(validateInputs({ ...baseInputs, salvage: -1 }).some((w) => w.includes("negative"))).toBe(true);
  });
  it("warns on unsupported MACRS class", () => {
    expect(validateInputs({ ...baseInputs, method: "macrs", macrsClass: 4 as unknown as number }).some((w) => w.includes("MACRS"))).toBe(true);
  });
  it("passes for valid inputs", () => {
    expect(validateInputs(baseInputs)).toEqual([]);
  });
});

describe("depreciation-calc exportScheduleCSV", () => {
  it("has header plus one row per year", () => {
    const csv = exportScheduleCSV(straightLine(baseInputs));
    const lines = csv.split("\n");
    expect(lines.length).toBe(6);
    expect(lines[0]).toContain("year,beginning_book_value");
  });
});

describe("depreciation-calc exportScheduleText", () => {
  it("includes method and totals", () => {
    const txt = exportScheduleText(straightLine(baseInputs));
    expect(txt).toContain("straight-line");
    expect(txt).toContain("Total depreciation:");
  });
});

describe("depreciation-calc compareMethods", () => {
  it("returns all 4 methods", () => {
    const arr = compareMethods(baseInputs);
    expect(arr.length).toBe(4);
    expect(arr.map((a) => a.method)).toContain("straight-line");
  });
});

describe("depreciation-calc bookValueAtYear", () => {
  it("returns ending BV for year N", () => {
    const r = straightLine(baseInputs);
    expect(bookValueAtYear(r, 1)).toBe(8200); // 10000 - 1800
  });
  it("returns final BV for out-of-range year", () => {
    const r = straightLine(baseInputs);
    expect(bookValueAtYear(r, 999)).toBe(1000);
  });
});

describe("depreciation-calc section179", () => {
  it("caps at limit", () => {
    expect(section179(2_000_000, 1_160_000)).toBe(1_160_000);
  });
  it("returns cost when under limit", () => {
    expect(section179(50_000, 1_160_000)).toBe(50_000);
  });
});

describe("depreciation-calc bonusDepreciationPercent", () => {
  it("returns 80% for 2023", () => {
    expect(bonusDepreciationPercent(2023)).toBe(0.8);
  });
  it("returns 60% for 2024", () => {
    expect(bonusDepreciationPercent(2024)).toBe(0.6);
  });
  it("returns 0 for years outside phase-down", () => {
    expect(bonusDepreciationPercent(2030)).toBe(0);
  });
});

describe("depreciation-calc taxShield", () => {
  it("multiplies total depreciation by tax rate", () => {
    const r = straightLine(baseInputs);
    expect(taxShield(r, 0.25)).toBeCloseTo(9000 * 0.25, 1);
  });
});

describe("depreciation-calc perYearTaxShield", () => {
  it("returns one shield per year", () => {
    const r = straightLine(baseInputs);
    const shields = perYearTaxShield(r, 0.25);
    expect(shields.length).toBe(5);
    expect(shields[0].shield).toBeCloseTo(1800 * 0.25, 1);
  });
});

describe("depreciation-calc MACRS_RATES sanity", () => {
  it("has rates for 3,5,7,10,15,20-year classes", () => {
    expect(Object.keys(MACRS_RATES).map(Number).sort((a, b) => a - b)).toEqual([3, 5, 7, 10, 15, 20]);
  });
});

import { describe, it, expect } from "vitest";
import {
  getAllTaxSystems,
  getTaxSystemById,
  getTaxSystemsByCountry,
  taxableIncome,
  calculateTax,
  marginalRate,
  computeBreakdown,
  multiYearProjection,
  validateInputs,
  exportBreakdownCSV,
  exportBreakdownText,
  monthlyTakeHome,
  compareSystems,
  effectiveRate,
  TAX_SYSTEMS,
} from "./logic";

describe("tax-calculator-pro getAllTaxSystems / getTaxSystemById", () => {
  it("returns at least 3 systems", () => {
    expect(getAllTaxSystems().length).toBeGreaterThanOrEqual(3);
  });
  it("finds US system by id", () => {
    expect(getTaxSystemById("us-2024-single")?.country).toBe("US");
  });
  it("returns null for unknown", () => {
    expect(getTaxSystemById("nope")).toBeNull();
  });
});

describe("tax-calculator-pro getTaxSystemsByCountry", () => {
  it("filters by country", () => {
    const uk = getTaxSystemsByCountry("UK");
    expect(uk.length).toBeGreaterThanOrEqual(1);
  });
});

describe("tax-calculator-pro taxableIncome", () => {
  it("subtracts deductions", () => {
    expect(taxableIncome(50000, 10000)).toBe(40000);
  });
  it("floors at 0", () => {
    expect(taxableIncome(5000, 10000)).toBe(0);
  });
});

describe("tax-calculator-pro calculateTax", () => {
  it("returns 0 for zero taxable income", () => {
    expect(calculateTax(0, TAX_SYSTEMS[0].brackets)).toBe(0);
  });
  it("progressive tax: $20k US single 2024", () => {
    // 11600 @ 10% = 1160; 8400 @ 12% = 1008; total = 2168
    const sys = getTaxSystemById("us-2024-single")!;
    expect(calculateTax(20000, sys.brackets)).toBeCloseTo(2168, 0);
  });
  it("top bracket handles Infinity", () => {
    const sys = getTaxSystemById("us-2024-single")!;
    const tax = calculateTax(1_000_000, sys.brackets);
    expect(tax).toBeGreaterThan(300000);
  });
});

describe("tax-calculator-pro marginalRate", () => {
  it("returns correct bracket rate", () => {
    const sys = getTaxSystemById("us-2024-single")!;
    expect(marginalRate(20000, sys.brackets)).toBe(0.12);
  });
  it("returns 0 for zero income", () => {
    const sys = getTaxSystemById("us-2024-single")!;
    expect(marginalRate(0, sys.brackets)).toBe(0.1); // first bracket rate
  });
});

describe("tax-calculator-pro computeBreakdown", () => {
  it("computes effective rate and after-tax income", () => {
    const sys = getTaxSystemById("us-2024-single")!;
    const b = computeBreakdown(sys, 100000);
    expect(b.grossIncome).toBe(100000);
    expect(b.deductions).toBe(sys.standardDeduction);
    expect(b.afterTaxIncome).toBe(100000 - b.totalTax);
    expect(b.effectiveRate).toBeGreaterThan(0);
    expect(b.effectiveRate).toBeLessThan(0.5);
  });
  it("applies credits to reduce tax", () => {
    const sys = getTaxSystemById("us-2024-single")!;
    const without = computeBreakdown(sys, 100000, 0, 0);
    const withCredit = computeBreakdown(sys, 100000, 0, 2000);
    expect(withCredit.totalTax).toBeLessThan(without.totalTax);
  });
  it("floors tax at 0 when credits exceed tax", () => {
    const sys = getTaxSystemById("us-2024-single")!;
    const b = computeBreakdown(sys, 15000, 0, 100000);
    expect(b.totalTax).toBe(0);
  });
  it("perBracket breakdown has entries", () => {
    const sys = getTaxSystemById("uk-2024")!;
    const b = computeBreakdown(sys, 60000);
    expect(b.perBracket.length).toBeGreaterThan(0);
  });
});

describe("tax-calculator-pro multiYearProjection", () => {
  it("projects N years with growth", () => {
    const sys = getTaxSystemById("us-2024-single")!;
    const proj = multiYearProjection(sys, 100000, 5, 0.03);
    expect(proj.length).toBe(5);
    expect(proj[1].income).toBeGreaterThan(proj[0].income);
  });
});

describe("tax-calculator-pro validateInputs", () => {
  it("warns on negative income", () => {
    expect(validateInputs(-100, 0, 0).some((w) => w.includes("negative"))).toBe(true);
  });
  it("warns when credits exceed gross income", () => {
    expect(validateInputs(50000, 0, 60000).some((w) => w.includes("exceed"))).toBe(true);
  });
  it("passes for valid inputs", () => {
    expect(validateInputs(50000, 5000, 1000)).toEqual([]);
  });
});

describe("tax-calculator-pro exportBreakdownCSV", () => {
  it("has header plus rows", () => {
    const sys = getTaxSystemById("us-2024-single")!;
    const csv = exportBreakdownCSV(computeBreakdown(sys, 100000));
    const lines = csv.split("\n");
    expect(lines[0]).toContain("field,value");
    expect(lines.length).toBeGreaterThan(5);
  });
});

describe("tax-calculator-pro exportBreakdownText", () => {
  it("includes system name and key stats", () => {
    const sys = getTaxSystemById("uk-2024")!;
    const txt = exportBreakdownText(computeBreakdown(sys, 60000), sys.name);
    expect(txt).toContain("UK Income Tax");
    expect(txt).toContain("Gross income:");
    expect(txt).toContain("Effective rate:");
  });
});

describe("tax-calculator-pro monthlyTakeHome", () => {
  it("divides after-tax income by 12", () => {
    const sys = getTaxSystemById("us-2024-single")!;
    const b = computeBreakdown(sys, 120000);
    expect(monthlyTakeHome(b)).toBeCloseTo(b.afterTaxIncome / 12, 2);
  });
});

describe("tax-calculator-pro compareSystems", () => {
  it("compares multiple systems for same income", () => {
    const r = compareSystems(100000, ["us-2024-single", "uk-2024"]);
    expect(r.length).toBe(2);
    expect(r[0].system).toContain("US");
  });
  it("skips unknown system ids", () => {
    const r = compareSystems(100000, ["us-2024-single", "nope"]);
    expect(r.length).toBe(1);
  });
});

describe("tax-calculator-pro effectiveRate", () => {
  it("returns tax / gross", () => {
    expect(effectiveRate(20000, 100000)).toBe(0.2);
  });
  it("returns 0 for zero gross", () => {
    expect(effectiveRate(1000, 0)).toBe(0);
  });
});

describe("tax-calculator-pro TAX_SYSTEMS sanity", () => {
  it("each system has at least 3 brackets", () => {
    expect(TAX_SYSTEMS.every((s) => s.brackets.length >= 3)).toBe(true);
  });
});

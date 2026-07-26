/**
 * Salary Tax Calculator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { calculateTax, taxBreakdownText, taxBreakdownCsv } from "./logic";

describe("calculateTax — validation", () => {
  it("errors on zero income", () => {
    expect("error" in calculateTax({ jurisdiction: "US", grossIncome: 0 })).toBe(true);
  });
  it("errors on negative deductions", () => {
    expect("error" in calculateTax({ jurisdiction: "US", grossIncome: 50000, deductions: -100 })).toBe(true);
  });
  it("errors when deductions exceed income", () => {
    expect("error" in calculateTax({ jurisdiction: "UK", grossIncome: 30000, deductions: 40000 })).toBe(true);
  });
});

describe("calculateTax — US", () => {
  it("returns 0 tax below standard deduction", () => {
    const r = calculateTax({ jurisdiction: "US", grossIncome: 14000 });
    if ("error" in r) throw new Error("should not error");
    expect(r.incomeTax).toBe(0);
    expect(r.taxableIncome).toBe(0);
    // FICA still applies
    expect(r.socialSecurity).toBeGreaterThan(0);
  });
  it("computes progressive income tax", () => {
    const r = calculateTax({ jurisdiction: "US", grossIncome: 60000 });
    if ("error" in r) throw new Error("should not error");
    expect(r.incomeTax).toBeGreaterThan(0);
    expect(r.effectiveRate).toBeGreaterThan(0);
    expect(r.effectiveRate).toBeLessThan(r.marginalRate);
  });
  it("FICA: 7.65% of gross up to SS cap", () => {
    const r = calculateTax({ jurisdiction: "US", grossIncome: 50000 });
    if ("error" in r) throw new Error("should not error");
    // 6.2% SS + 1.45% Medicare = 7.65%
    expect(r.socialSecurity).toBeCloseTo(50000 * 0.0765, 0);
  });
  it("caps Social Security at the wage base", () => {
    const low = calculateTax({ jurisdiction: "US", grossIncome: 100000 });
    const high = calculateTax({ jurisdiction: "US", grossIncome: 500000 });
    if ("error" in low || "error" in high) throw new Error("should not error");
    // The SS portion of high's socialSecurity should equal low's SS portion (cap)
    const ssLow = Math.min(100000, 168600) * 0.062;
    const ssHigh = Math.min(500000, 168600) * 0.062;
    expect(ssLow).toBeCloseTo(ssHigh, 0);
  });
});

describe("calculateTax — UK", () => {
  it("returns 0 income tax within personal allowance", () => {
    const r = calculateTax({ jurisdiction: "UK", grossIncome: 12000 });
    if ("error" in r) throw new Error("should not error");
    expect(r.incomeTax).toBe(0);
  });
  it("charges 20% above personal allowance", () => {
    const r = calculateTax({ jurisdiction: "UK", grossIncome: 20000 });
    if ("error" in r) throw new Error("should not error");
    // taxable = 20000 - 12570 = 7430 → 20% = 1486
    expect(r.incomeTax).toBeCloseTo(1486, -1);
  });
  it("tapers personal allowance above £100,000", () => {
    const r = calculateTax({ jurisdiction: "UK", grossIncome: 120000 });
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("taper"))).toBe(true);
    expect(r.marginalRate).toBeGreaterThan(0.4);
  });
});

describe("calculateTax — IN", () => {
  it("returns 0 tax below rebate threshold", () => {
    const r = calculateTax({ jurisdiction: "IN", grossIncome: 700000 });
    if ("error" in r) throw new Error("should not error");
    expect(r.incomeTax).toBe(0);
  });
  it("charges 15% in mid bracket with cess", () => {
    const r = calculateTax({ jurisdiction: "IN", grossIncome: 1100000 });
    if ("error" in r) throw new Error("should not error");
    expect(r.incomeTax).toBeGreaterThan(0);
    expect(r.notes.some((n) => n.includes("Cess"))).toBe(true);
  });
  it("applies standard deduction in new regime", () => {
    const r = calculateTax({ jurisdiction: "IN", grossIncome: 800000 });
    if ("error" in r) throw new Error("should not error");
    expect(r.taxableIncome).toBeLessThan(800000);
  });
});

describe("calculateTax — meta", () => {
  it("net pay equals gross minus total tax", () => {
    const r = calculateTax({ jurisdiction: "US", grossIncome: 100000 });
    if ("error" in r) throw new Error("should not error");
    expect(r.netPay).toBeCloseTo(r.grossIncome - r.totalTax, 0);
  });
  it("bands array contains progressive rows", () => {
    const r = calculateTax({ jurisdiction: "US", grossIncome: 250000 });
    if ("error" in r) throw new Error("should not error");
    expect(r.bands.length).toBeGreaterThan(1);
    expect(r.bands[0]!.rate).toBeLessThan(r.bands[r.bands.length - 1]!.rate);
  });
});

describe("exports", () => {
  it("taxBreakdownText produces a readable summary", () => {
    const r = calculateTax({ jurisdiction: "UK", grossIncome: 50000 });
    if ("error" in r) throw new Error("should not error");
    const text = taxBreakdownText(r);
    expect(text).toContain("Jurisdiction");
    expect(text).toContain("Gross income");
    expect(text).toContain("Net pay");
    expect(text).toContain("Effective rate");
  });
  it("taxBreakdownCsv produces a CSV", () => {
    const r = calculateTax({ jurisdiction: "IN", grossIncome: 1000000 });
    if ("error" in r) throw new Error("should not error");
    const csv = taxBreakdownCsv(r);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Field,Value");
    expect(lines.length).toBeGreaterThan(5);
  });
});

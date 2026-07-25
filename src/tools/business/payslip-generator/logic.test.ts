import { describe, it, expect } from "vitest";
import {
  computePayslip,
  computeBracketTax,
  formatMoney,
  renderPayslip,
  validatePayslipInput,
  computePayslipBatch,
  computeStats,
  lineItemsToCsv,
  CURRENCIES,
  SAMPLE_BRACKETS,
} from "./logic";

describe("computePayslip", () => {
  it("computes net pay with flat tax", () => {
    const r = computePayslip({ grossSalary: 5000, taxRate: 20, deductions: [{ name: "Insurance", amount: 200 }], allowances: [{ name: "Travel", amount: 100 }] });
    if ("error" in r) throw new Error("should not error");
    expect(r.gross).toBe(5000);
    expect(r.taxAmount).toBe(1000);
    expect(r.totalDeductions).toBe(200);
    expect(r.totalAllowances).toBe(100);
    expect(r.net).toBe(3900);
  });
  it("handles no deductions/allowances", () => {
    const r = computePayslip({ grossSalary: 4000, taxRate: 10, deductions: [], allowances: [] });
    if ("error" in r) throw new Error("should not error");
    expect(r.net).toBe(3600);
  });
  it("errors on negative gross", () => {
    expect(computePayslip({ grossSalary: -1, taxRate: 10, deductions: [], allowances: [] })).toHaveProperty("error");
  });
  it("errors on out-of-range tax rate", () => {
    expect(computePayslip({ grossSalary: 1000, taxRate: 150, deductions: [], allowances: [] })).toHaveProperty("error");
  });
  it("errors on negative deduction", () => {
    expect(computePayslip({ grossSalary: 1000, taxRate: 10, deductions: [{ name: "X", amount: -5 }], allowances: [] })).toHaveProperty("error");
  });
  it("computes effective tax rate", () => {
    const r = computePayslip({ grossSalary: 1000, taxRate: 25, deductions: [], allowances: [] });
    if ("error" in r) throw new Error("should not error");
    expect(r.effectiveTaxRate).toBe(25);
  });
  it("supports progressive brackets", () => {
    const r = computePayslip({
      grossSalary: 30000,
      taxBrackets: [
        { upTo: 10000, rate: 10 },
        { upTo: 30000, rate: 20 },
        { upTo: Infinity, rate: 30 },
      ],
      deductions: [],
      allowances: [],
    });
    if ("error" in r) throw new Error("should not error");
    // 10k × 10% + 20k × 20% = 1000 + 4000 = 5000
    expect(r.taxAmount).toBe(5000);
    expect(r.net).toBe(25000);
  });
  it("supports overtime hours", () => {
    const r = computePayslip({
      grossSalary: 1000, // base for 40h
      hoursWorked: 50,
      overtimeThreshold: 40,
      overtimeMultiplier: 1.5,
      taxRate: 0,
      deductions: [],
      allowances: [],
    });
    if ("error" in r) throw new Error("should not error");
    // base rate = 1000/40 = 25/h. Overtime = 10h × 25 × 1.5 = 375
    expect(r.overtimePay).toBe(375);
    expect(r.gross).toBe(1375);
  });
  it("supports YTD tracking", () => {
    const r = computePayslip({
      grossSalary: 5000,
      taxRate: 20,
      deductions: [],
      allowances: [],
      ytdGross: 45000,
      ytdTaxPaid: 9000,
    });
    if ("error" in r) throw new Error("should not error");
    expect(r.ytdGross).toBe(50000);
    expect(r.ytdTax).toBe(10000);
    expect(r.ytdNet).toBe(40000);
  });
});

describe("computeBracketTax", () => {
  it("computes progressive tax correctly", () => {
    const tax = computeBracketTax(50000, SAMPLE_BRACKETS);
    // 11k×10% + (44725-11000)×12% + (50000-44725)×22%
    // = 1100 + 4047 + 1160.5 = 6307.5
    expect(tax).toBeCloseTo(6307.5, 1);
  });
  it("returns 0 for zero income", () => {
    expect(computeBracketTax(0, SAMPLE_BRACKETS)).toBe(0);
  });
});

describe("formatMoney", () => {
  it("formats with $ and 2 decimals", () => {
    expect(formatMoney(99.5)).toContain("99.50");
  });
  it("supports EUR", () => {
    expect(formatMoney(50, "EUR")).toContain("50");
  });
});

describe("renderPayslip", () => {
  it("includes key sections", () => {
    const input = { grossSalary: 5000, taxRate: 20, deductions: [{ name: "Ins", amount: 200 }], allowances: [{ name: "Travel", amount: 100 }] };
    const r = computePayslip(input);
    if ("error" in r) throw new Error("should not error");
    const text = renderPayslip(input, r);
    expect(text).toContain("PAYSLIP");
    expect(text).toContain("Gross");
    expect(text).toContain("Net pay");
    expect(text).toContain("Ins");
  });
  it("includes YTD section when ytd provided", () => {
    const input = { grossSalary: 5000, taxRate: 20, deductions: [], allowances: [], ytdGross: 10000, ytdTaxPaid: 2000 };
    const r = computePayslip(input);
    if ("error" in r) throw new Error("should not error");
    const text = renderPayslip(input, r);
    expect(text).toContain("Year-to-date");
  });
});

describe("validatePayslipInput", () => {
  it("accepts valid input", () => {
    expect(validatePayslipInput({ grossSalary: 1000, taxRate: 10, deductions: [], allowances: [] })).toEqual({ ok: true });
  });
  it("rejects both taxRate and brackets", () => {
    expect("error" in validatePayslipInput({ grossSalary: 1000, taxRate: 10, taxBrackets: SAMPLE_BRACKETS, deductions: [], allowances: [] })).toBe(true);
  });
  it("rejects bad bracket rate", () => {
    expect("error" in validatePayslipInput({ grossSalary: 1000, taxBrackets: [{ upTo: 1000, rate: 150 }], deductions: [], allowances: [] })).toBe(true);
  });
});

describe("computePayslipBatch", () => {
  it("processes multiple inputs", () => {
    const results = computePayslipBatch([
      { grossSalary: 1000, taxRate: 10, deductions: [], allowances: [] },
      { grossSalary: -1, taxRate: 10, deductions: [], allowances: [] },
    ]);
    expect(results.length).toBe(2);
    expect("error" in results[0]!).toBe(false);
    expect("error" in results[1]!).toBe(true);
  });
});

describe("computeStats", () => {
  it("returns stats", () => {
    const s = computeStats({ grossSalary: 1000, taxRate: 10, deductions: [{ name: "X", amount: 50 }], allowances: [{ name: "Y", amount: 30 }] });
    expect(s.lineItemCount).toBe(2);
    expect(s.hasBrackets).toBe(false);
  });
});

describe("lineItemsToCsv", () => {
  it("generates CSV with header", () => {
    const csv = lineItemsToCsv([{ name: "Insurance", amount: 200 }], "deduction");
    expect(csv.split("\n")[0]).toBe("Name,Amount,Kind");
    expect(csv).toContain("Insurance");
    expect(csv).toContain("deduction");
  });
});

describe("CURRENCIES", () => {
  it("contains multiple currencies", () => {
    expect(CURRENCIES.length).toBeGreaterThanOrEqual(5);
  });
});

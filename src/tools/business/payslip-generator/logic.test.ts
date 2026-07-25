import { describe, it, expect } from "vitest";
import { computePayslip, formatMoney, renderPayslip } from "./logic";

describe("computePayslip", () => {
  it("computes net pay", () => {
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
});

describe("formatMoney", () => {
  it("formats with $ and 2 decimals", () => {
    expect(formatMoney(99.5)).toBe("$99.50");
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
});

import { describe, it, expect } from "vitest";
import { computeMonthlyPayment, calculatePaymentPlan, scheduleToCsv, formatCurrency } from "./logic";

describe("computeMonthlyPayment", () => {
  it("computes payment with zero interest", () => {
    expect(computeMonthlyPayment(1200, 0, 12)).toBe(100);
  });
  it("computes payment with interest", () => {
    const p = computeMonthlyPayment(1200, 0.01, 12);
    expect(p).toBeGreaterThan(100);
    expect(p).toBeLessThan(110);
  });
  it("returns 0 for invalid total", () => {
    expect(computeMonthlyPayment(0, 0.01, 12)).toBe(0);
  });
  it("returns 0 for invalid months", () => {
    expect(computeMonthlyPayment(1200, 0.01, 0)).toBe(0);
  });
});

describe("calculatePaymentPlan", () => {
  it("errors on zero total", () => {
    expect(calculatePaymentPlan({ totalAmount: 0, months: 12, annualRatePct: 0 })).toHaveProperty("error");
  });
  it("errors on zero months", () => {
    expect(calculatePaymentPlan({ totalAmount: 1000, months: 0, annualRatePct: 0 })).toHaveProperty("error");
  });
  it("errors on non-integer months", () => {
    expect(calculatePaymentPlan({ totalAmount: 1000, months: 12.5, annualRatePct: 0 })).toHaveProperty("error");
  });
  it("errors on too many months", () => {
    expect(calculatePaymentPlan({ totalAmount: 1000, months: 1000, annualRatePct: 0 })).toHaveProperty("error");
  });
  it("computes zero-interest plan", () => {
    const r = calculatePaymentPlan({ totalAmount: 1200, months: 12, annualRatePct: 0 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.monthlyPayment).toBe(100);
    expect(r.totalInterest).toBe(0);
    expect(r.totalPaid).toBe(1200);
    expect(r.schedule.length).toBe(12);
    expect(r.schedule[11]!.balance).toBe(0);
  });
  it("computes plan with interest", () => {
    const r = calculatePaymentPlan({ totalAmount: 10000, months: 12, annualRatePct: 12 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.totalInterest).toBeGreaterThan(0);
    expect(r.totalPaid).toBeGreaterThan(10000);
  });
  it("schedule ends with zero balance", () => {
    const r = calculatePaymentPlan({ totalAmount: 5000, months: 24, annualRatePct: 6 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.schedule[r.schedule.length - 1]!.balance).toBeLessThanOrEqual(0.01);
  });
  it("monthly payment * months >= total (with interest)", () => {
    const r = calculatePaymentPlan({ totalAmount: 5000, months: 12, annualRatePct: 10 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.monthlyPayment * 12).toBeGreaterThanOrEqual(5000);
  });
});

describe("scheduleToCsv", () => {
  it("generates CSV with header", () => {
    const r = calculatePaymentPlan({ totalAmount: 1200, months: 3, annualRatePct: 0 });
    if ("error" in r) throw new Error("Should not error");
    const csv = scheduleToCsv(r.schedule);
    expect(csv.split("\n")[0]).toBe("Month,Payment,Interest,Principal,Balance");
    expect(csv.split("\n").length).toBe(4);
  });
});

describe("formatCurrency", () => {
  it("formats USD", () => {
    expect(formatCurrency(1234.5)).toContain("1,234.50");
  });
  it("falls back on invalid currency", () => {
    expect(formatCurrency(100, "en-US", "XYZ")).toContain("100");
  });
});

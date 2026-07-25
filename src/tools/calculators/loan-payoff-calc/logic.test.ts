import { describe, it, expect } from "vitest";
import { computeMonthlyPayment, calculateLoanPayoff, scheduleToCsv, formatCurrency } from "./logic";

describe("computeMonthlyPayment", () => {
  it("computes payment for standard loan", () => {
    const p = computeMonthlyPayment(10000, 0.01, 12);
    expect(p).toBeGreaterThan(800);
    expect(p).toBeLessThan(900);
  });
  it("handles zero interest", () => {
    expect(computeMonthlyPayment(12000, 0, 12)).toBe(1000);
  });
  it("returns 0 for invalid principal", () => {
    expect(computeMonthlyPayment(0, 0.01, 12)).toBe(0);
  });
  it("returns 0 for invalid months", () => {
    expect(computeMonthlyPayment(10000, 0.01, 0)).toBe(0);
  });
});

describe("calculateLoanPayoff", () => {
  it("errors on zero principal", () => {
    expect(calculateLoanPayoff({ principal: 0, annualRatePct: 5, tenureMonths: 12 })).toHaveProperty("error");
  });
  it("errors on zero tenure", () => {
    expect(calculateLoanPayoff({ principal: 10000, annualRatePct: 5, tenureMonths: 0 })).toHaveProperty("error");
  });
  it("computes full payoff schedule", () => {
    const r = calculateLoanPayoff({ principal: 10000, annualRatePct: 6, tenureMonths: 12 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.actualMonths).toBe(12);
    expect(r.schedule.length).toBe(12);
    expect(r.schedule[11]!.balance).toBeLessThanOrEqual(0.01);
  });
  it("interest saved is 0 when no extra payments", () => {
    const r = calculateLoanPayoff({ principal: 10000, annualRatePct: 6, tenureMonths: 12 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.interestSaved).toBe(0);
  });
  it("shortens loan with extra payments", () => {
    const r = calculateLoanPayoff({ principal: 10000, annualRatePct: 6, tenureMonths: 12, extraMonthly: 500 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.actualMonths).toBeLessThan(12);
    expect(r.interestSaved).toBeGreaterThan(0);
  });
  it("handles one-time prepayment", () => {
    const r = calculateLoanPayoff({ principal: 10000, annualRatePct: 6, tenureMonths: 12, oneTimePrepayment: { month: 3, amount: 5000 } });
    if ("error" in r) throw new Error("Should not error");
    expect(r.actualMonths).toBeLessThan(12);
  });
  it("sums principal+interest to total paid approximately", () => {
    const r = calculateLoanPayoff({ principal: 10000, annualRatePct: 6, tenureMonths: 12 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.totalPaid).toBeGreaterThan(r.totalInterest + 9999);
  });
});

describe("scheduleToCsv", () => {
  it("generates CSV with header", () => {
    const r = calculateLoanPayoff({ principal: 10000, annualRatePct: 6, tenureMonths: 3 });
    if ("error" in r) throw new Error("Should not error");
    const csv = scheduleToCsv(r.schedule);
    expect(csv.split("\n")[0]).toBe("Month,Payment,Interest,Principal,Extra,Balance");
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

/**
 * EMI Calculator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { calculateEmi, computeEmi, formatCurrency, scheduleToCsv } from "./logic";

describe("computeEmi", () => {
  it("returns 0 for zero principal", () => {
    expect(computeEmi(0, 0.01, 12)).toBe(0);
  });

  it("returns 0 for zero tenure", () => {
    expect(computeEmi(100000, 0.01, 0)).toBe(0);
  });

  it("handles zero-interest loan (linear)", () => {
    // 120000 over 12 months at 0% = 10000 per month
    expect(computeEmi(120000, 0, 12)).toBe(10000);
  });

  it("matches standard EMI formula", () => {
    // 100000 at 12% annual (1% monthly) for 12 months
    // EMI = 100000 * 0.01 * (1.01)^12 / ((1.01)^12 - 1) ≈ 8884.88
    const emi = computeEmi(100000, 0.01, 12);
    expect(emi).toBeCloseTo(8884.88, 1);
  });
});

describe("calculateEmi", () => {
  it("errors on zero principal", () => {
    expect("error" in calculateEmi({ principal: 0, annualRatePct: 10, tenureMonths: 12 })).toBe(
      true,
    );
  });

  it("errors on zero tenure", () => {
    expect("error" in calculateEmi({ principal: 100000, annualRatePct: 10, tenureMonths: 0 })).toBe(
      true,
    );
  });

  it("returns correct EMI and totals for a simple loan", () => {
    const r = calculateEmi({ principal: 100000, annualRatePct: 12, tenureMonths: 12 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.emi).toBeCloseTo(8884.88, 1);
    expect(r.schedule.length).toBe(12);
    expect(r.actualMonths).toBe(12);
    // Total payment ≈ EMI × 12
    expect(r.totalPayment).toBeCloseTo(r.emi * 12, 0);
    // Final balance must be 0 (or very close)
    expect(r.schedule[r.schedule.length - 1]!.balance).toBeLessThan(1);
  });

  it("schedule sums to total payment exactly (last-row rounding)", () => {
    const r = calculateEmi({ principal: 250000, annualRatePct: 8.5, tenureMonths: 60 });
    if ("error" in r) throw new Error("Should not error");
    const sumInterest = r.schedule.reduce((s, row) => s + row.interest, 0);
    const sumPrincipal = r.schedule.reduce((s, row) => s + row.principal, 0);
    // Allow 1 cent tolerance per row × 60 rows
    expect(Math.abs(sumInterest - r.totalInterest)).toBeLessThan(0.6);
    expect(Math.abs(sumPrincipal + sumInterest - r.totalPayment)).toBeLessThan(0.6);
  });

  it("zero-interest loan produces linear amortization", () => {
    const r = calculateEmi({ principal: 120000, annualRatePct: 0, tenureMonths: 12 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.emi).toBe(10000);
    expect(r.totalInterest).toBe(0);
    expect(r.totalPayment).toBe(120000);
    // Each month principal = emi, interest = 0
    for (const row of r.schedule) {
      expect(row.interest).toBe(0);
      expect(row.principal).toBe(10000);
    }
  });

  it("one-time prepayment reduces total interest and months", () => {
    const baseline = calculateEmi({ principal: 500000, annualRatePct: 10, tenureMonths: 60 });
    const withPrepay = calculateEmi({
      principal: 500000,
      annualRatePct: 10,
      tenureMonths: 60,
      oneTimePrepayment: { month: 12, amount: 100000 },
    });
    if ("error" in baseline || "error" in withPrepay) throw new Error("Should not error");
    expect(withPrepay.totalInterest).toBeLessThan(baseline.totalInterest);
    expect(withPrepay.actualMonths).toBeLessThan(baseline.actualMonths);
    expect(withPrepay.interestSaved).toBeGreaterThan(0);
    expect(withPrepay.monthsSaved).toBeGreaterThan(0);
  });

  it("recurring extra payment reduces total interest", () => {
    const baseline = calculateEmi({ principal: 500000, annualRatePct: 10, tenureMonths: 60 });
    const withRecurring = calculateEmi({
      principal: 500000,
      annualRatePct: 10,
      tenureMonths: 60,
      recurringExtra: 2000,
    });
    if ("error" in baseline || "error" in withRecurring) throw new Error("Should not error");
    expect(withRecurring.totalInterest).toBeLessThan(baseline.totalInterest);
    expect(withRecurring.actualMonths).toBeLessThan(baseline.actualMonths);
  });

  it("schedule ends with zero balance", () => {
    const r = calculateEmi({ principal: 1000000, annualRatePct: 9, tenureMonths: 240 });
    if ("error" in r) throw new Error("Should not error");
    const last = r.schedule[r.schedule.length - 1]!;
    expect(last.balance).toBeLessThan(1);
  });
});

describe("formatCurrency", () => {
  it("formats INR with Indian grouping", () => {
    expect(formatCurrency(100000, "en-IN", "INR")).toMatch(/1,00,000/);
  });

  it("formats USD with Western grouping", () => {
    expect(formatCurrency(100000, "en-US", "USD")).toMatch(/100,000/);
  });
});

describe("scheduleToCsv", () => {
  it("produces valid CSV with header", () => {
    const r = calculateEmi({ principal: 100000, annualRatePct: 12, tenureMonths: 12 });
    if ("error" in r) throw new Error("Should not error");
    const csv = scheduleToCsv(r.schedule, "monthly");
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Month");
    expect(lines[0]).toContain("EMI");
    expect(lines.length).toBe(13); // 1 header + 12 months
  });

  it("yearly grouping produces 1 row per year", () => {
    const r = calculateEmi({ principal: 100000, annualRatePct: 12, tenureMonths: 60 });
    if ("error" in r) throw new Error("Should not error");
    const csv = scheduleToCsv(r.schedule, "yearly");
    const lines = csv.split("\n");
    expect(lines.length).toBe(6); // 1 header + 5 years
    expect(lines[0]).toContain("Year");
  });
});

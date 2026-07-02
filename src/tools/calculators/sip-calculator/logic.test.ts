/**
 * SIP Calculator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { calculateSip, sipClosedForm, formatCurrency, formatCompact } from "./logic";

describe("calculateSip — validation", () => {
  it("errors on zero monthly investment", () => {
    expect("error" in calculateSip({ monthlyInvestment: 0, annualReturnPct: 12, years: 10 })).toBe(
      true,
    );
  });

  it("errors on zero years", () => {
    expect(
      "error" in calculateSip({ monthlyInvestment: 5000, annualReturnPct: 12, years: 0 }),
    ).toBe(true);
  });

  it("errors on years > 100", () => {
    expect(
      "error" in calculateSip({ monthlyInvestment: 5000, annualReturnPct: 12, years: 150 }),
    ).toBe(true);
  });
});

describe("calculateSip — basic math", () => {
  it("matches closed-form formula for non-step-up SIP", () => {
    const P = 10000;
    const annualRate = 12;
    const years = 10;
    const r = annualRate / 100 / 12;
    const n = years * 12;
    const expected = sipClosedForm(P, r, n);
    const result = calculateSip({ monthlyInvestment: P, annualReturnPct: annualRate, years });
    if ("error" in result) throw new Error("Should not error");
    expect(result.futureValue).toBeCloseTo(expected, 0);
  });

  it("computes total invested correctly", () => {
    const result = calculateSip({ monthlyInvestment: 5000, annualReturnPct: 12, years: 10 });
    if ("error" in result) throw new Error("Should not error");
    // 5000 × 12 × 10 = 600000
    expect(result.totalInvested).toBe(600000);
  });

  it("computes returns as futureValue - totalInvested", () => {
    const result = calculateSip({ monthlyInvestment: 5000, annualReturnPct: 12, years: 10 });
    if ("error" in result) throw new Error("Should not error");
    expect(result.totalReturns).toBeCloseTo(result.futureValue - result.totalInvested, 2);
  });

  it("computes wealth ratio as futureValue / totalInvested", () => {
    const result = calculateSip({ monthlyInvestment: 5000, annualReturnPct: 12, years: 10 });
    if ("error" in result) throw new Error("Should not error");
    expect(result.wealthRatio).toBeCloseTo(result.futureValue / result.totalInvested, 2);
  });

  it("yearlyBreakdown has one row per year", () => {
    const result = calculateSip({ monthlyInvestment: 5000, annualReturnPct: 12, years: 15 });
    if ("error" in result) throw new Error("Should not error");
    expect(result.yearlyBreakdown.length).toBe(15);
  });

  it("first year investedThisYear equals 12 × monthly", () => {
    const result = calculateSip({ monthlyInvestment: 5000, annualReturnPct: 12, years: 5 });
    if ("error" in result) throw new Error("Should not error");
    expect(result.yearlyBreakdown[0]!.investedThisYear).toBe(60000);
  });
});

describe("calculateSip — step-up", () => {
  it("step-up SIP produces higher corpus than flat SIP", () => {
    const flat = calculateSip({ monthlyInvestment: 5000, annualReturnPct: 12, years: 15 });
    const stepUp = calculateSip({
      monthlyInvestment: 5000,
      annualReturnPct: 12,
      years: 15,
      stepUpPct: 10,
    });
    if ("error" in flat || "error" in stepUp) throw new Error("Should not error");
    expect(stepUp.futureValue).toBeGreaterThan(flat.futureValue);
    expect(stepUp.totalInvested).toBeGreaterThan(flat.totalInvested);
  });

  it("step-up SIP invests more each year", () => {
    const result = calculateSip({
      monthlyInvestment: 5000,
      annualReturnPct: 12,
      years: 5,
      stepUpPct: 10,
    });
    if ("error" in result) throw new Error("Should not error");
    // Year 1: 5000 × 12 = 60000
    // Year 2: 5500 × 12 = 66000
    expect(result.yearlyBreakdown[0]!.investedThisYear).toBe(60000);
    expect(result.yearlyBreakdown[1]!.investedThisYear).toBe(66000);
  });
});

describe("calculateSip — inflation adjustment", () => {
  it("inflation-adjusted value is less than nominal when inflation > 0", () => {
    const result = calculateSip({
      monthlyInvestment: 5000,
      annualReturnPct: 12,
      years: 20,
      inflationPct: 6,
    });
    if ("error" in result) throw new Error("Should not error");
    expect(result.realFutureValue).toBeDefined();
    expect(result.realFutureValue!).toBeLessThan(result.futureValue);
  });

  it("real value equals nominal when inflation is 0", () => {
    const result = calculateSip({
      monthlyInvestment: 5000,
      annualReturnPct: 12,
      years: 10,
      inflationPct: 0,
    });
    if ("error" in result) throw new Error("Should not error");
    expect(result.realFutureValue).toBeUndefined();
  });
});

describe("sipClosedForm", () => {
  it("returns simple sum when rate is 0", () => {
    expect(sipClosedForm(5000, 0, 120)).toBe(600000);
  });

  it("matches well-known SIP value for 10k/mo @12% for 10y", () => {
    // Known value: 10000/mo @ 12% for 10 years ≈ 23,23,376 (very common Indian finance example)
    const v = sipClosedForm(10000, 0.01, 120);
    expect(v).toBeGreaterThan(2_300_000);
    expect(v).toBeLessThan(2_350_000);
  });
});

describe("formatting helpers", () => {
  it("formatCurrency formats INR", () => {
    expect(formatCurrency(100000, "en-IN", "INR")).toMatch(/₹/);
  });

  it("formatCompact produces compact notation", () => {
    const out = formatCompact(1500000, "en-IN", "INR");
    expect(out.length).toBeLessThan(formatCurrency(1500000, "en-IN", "INR").length);
  });
});

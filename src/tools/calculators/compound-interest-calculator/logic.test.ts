/**
 * Compound Interest Calculator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { calculateCompoundInterest, breakdownToCsv, formatMoney, getN, type CompoundingFrequency } from "./logic";

describe("getN", () => {
  it("returns correct N for each frequency", () => {
    expect(getN("daily")).toBe(365);
    expect(getN("weekly")).toBe(52);
    expect(getN("monthly")).toBe(12);
    expect(getN("quarterly")).toBe(4);
    expect(getN("annually")).toBe(1);
    expect(getN("continuously")).toBe(Infinity);
  });
  it("returns custom N when provided", () => {
    expect(getN("custom", 6)).toBe(6);
  });
  it("defaults custom to 1 when not provided", () => {
    expect(getN("custom")).toBe(1);
  });
});

describe("calculateCompoundInterest — basic", () => {
  it("errors on negative principal", () => {
    expect("error" in calculateCompoundInterest({ principal: -100, annualRatePct: 5, years: 10 })).toBe(true);
  });
  it("errors on too-high rate", () => {
    expect("error" in calculateCompoundInterest({ principal: 1000, annualRatePct: 2000, years: 10 })).toBe(true);
  });
  it("errors on too-many years", () => {
    expect("error" in calculateCompoundInterest({ principal: 1000, annualRatePct: 5, years: 300 })).toBe(true);
  });
  it("computes simple compound interest", () => {
    // $1000 at 10% for 2 years, compounded annually
    // A = 1000 * (1.1)^2 = 1210
    const r = calculateCompoundInterest({ principal: 1000, annualRatePct: 10, years: 2, compounding: "annually" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.finalAmount).toBeCloseTo(1210, 0);
    expect(r.totalInterest).toBeCloseTo(210, 0);
  });
  it("computes monthly compounding", () => {
    // $1000 at 12% for 1 year, compounded monthly
    // A = 1000 * (1 + 0.01)^12 ≈ 1126.83
    const r = calculateCompoundInterest({ principal: 1000, annualRatePct: 12, years: 1, compounding: "monthly" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.finalAmount).toBeCloseTo(1126.83, -1); // ~10 tolerance
  });
  it("computes continuous compounding", () => {
    // $1000 at 10% for 1 year, continuous
    // A = 1000 * e^0.1 ≈ 1105.17
    const r = calculateCompoundInterest({ principal: 1000, annualRatePct: 10, years: 1, compounding: "continuously" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.finalAmount).toBeCloseTo(1105.17, -1);
  });
});

describe("calculateCompoundInterest — contributions", () => {
  it("adds regular contributions", () => {
    const r = calculateCompoundInterest({
      principal: 1000, annualRatePct: 5, years: 5, compounding: "monthly",
      contributionAmount: 100, contributionFrequency: "monthly",
    });
    if ("error" in r) throw new Error("Should not error");
    // Should have total contributions of 100 * 12 * 5 = 6000
    expect(r.totalContributions).toBeCloseTo(6000, -2);
    // Final amount should be more than principal + contributions
    expect(r.finalAmount).toBeGreaterThan(7000);
  });
});

describe("calculateCompoundInterest — APY", () => {
  it("computes effective annual rate (APY)", () => {
    const r = calculateCompoundInterest({ principal: 1000, annualRatePct: 12, years: 1, compounding: "monthly" });
    if ("error" in r) throw new Error("Should not error");
    // APY = (1 + 0.12/12)^12 - 1 ≈ 12.68%
    expect(r.effectiveAnnualRate).toBeCloseTo(12.68, 1);
  });
});

describe("calculateCompoundInterest — Rule of 72", () => {
  it("estimates doubling time", () => {
    const r = calculateCompoundInterest({ principal: 1000, annualRatePct: 8, years: 1, compounding: "annually" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.ruleOf72Years).toBeCloseTo(9, 0); // 72/8 = 9
  });
  it("returns Infinity for 0% rate", () => {
    const r = calculateCompoundInterest({ principal: 1000, annualRatePct: 0, years: 1, compounding: "annually" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.ruleOf72Years).toBe(Infinity);
  });
});

describe("calculateCompoundInterest — inflation", () => {
  it("computes inflation-adjusted real value", () => {
    const r = calculateCompoundInterest({
      principal: 1000, annualRatePct: 10, years: 10, compounding: "annually",
      inflationRatePct: 3,
    });
    if ("error" in r) throw new Error("Should not error");
    expect(r.realValue).toBeLessThan(r.finalAmount);
  });
});

describe("calculateCompoundInterest — tax", () => {
  it("applies tax on interest", () => {
    const r = calculateCompoundInterest({
      principal: 1000, annualRatePct: 10, years: 1, compounding: "annually",
      taxRatePct: 30,
    });
    if ("error" in r) throw new Error("Should not error");
    // Interest ≈ 100, tax = 30% = 30, after-tax = 1000 + 100 - 30 = 1070
    expect(r.totalTax).toBeCloseTo(30, 0);
    expect(r.afterTaxAmount).toBeCloseTo(1070, 0);
  });
});

describe("calculateCompoundInterest — breakdown", () => {
  it("generates year-by-year breakdown", () => {
    const r = calculateCompoundInterest({ principal: 1000, annualRatePct: 10, years: 5, compounding: "annually" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.breakdown.length).toBe(5);
    expect(r.breakdown[0]!.year).toBe(1);
    expect(r.breakdown[4]!.year).toBe(5);
  });
});

describe("calculateCompoundInterest — warnings", () => {
  it("warns on 0% rate", () => {
    const r = calculateCompoundInterest({ principal: 1000, annualRatePct: 0, years: 5, compounding: "annually" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.warnings.some((w) => w.includes("0%"))).toBe(true);
  });
  it("warns on negative rate", () => {
    const r = calculateCompoundInterest({ principal: 1000, annualRatePct: -2, years: 5, compounding: "annually" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.warnings.some((w) => w.includes("Negative"))).toBe(true);
  });
});

describe("breakdownToCsv", () => {
  it("generates CSV with header", () => {
    const r = calculateCompoundInterest({ principal: 1000, annualRatePct: 10, years: 2, compounding: "annually" });
    if ("error" in r) throw new Error("Should not error");
    const csv = breakdownToCsv(r.breakdown);
    expect(csv.split("\n")[0]).toBe("Year,StartBalance,Contributions,Interest,EndBalance,TotalContributions,TotalInterest,RealValue");
    expect(csv.split("\n").length).toBe(3); // header + 2 years
  });
});

describe("formatMoney", () => {
  it("formats USD", () => {
    expect(formatMoney(1234.56, "USD")).toContain("1,234.56");
  });
  it("formats INR", () => {
    const s = formatMoney(100000, "INR", "en-IN");
    expect(s).toContain("1,00,000");
  });
});

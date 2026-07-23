/**
 * Simple Interest Calculator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { calculateSimpleInterest, breakdownToCsv, formatMoney } from "./logic";

describe("calculateSimpleInterest — solve for SI", () => {
  it("computes SI = P*R*T/100", () => {
    // 1000 @ 5% for 2 years → 100
    const r = calculateSimpleInterest({ solveFor: "si", principal: 1000, rate: 5, time: 2 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.interest).toBe(100);
    expect(r.amount).toBe(1100);
  });
  it("handles fractional years", () => {
    const r = calculateSimpleInterest({ solveFor: "si", principal: 1000, rate: 10, time: 1.5 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.interest).toBe(150);
  });
  it("errors when inputs missing", () => {
    expect("error" in calculateSimpleInterest({ solveFor: "si", principal: 1000, rate: 5 })).toBe(true);
  });
  it("errors on negative principal", () => {
    expect("error" in calculateSimpleInterest({ solveFor: "si", principal: -100, rate: 5, time: 2 })).toBe(true);
  });
});

describe("calculateSimpleInterest — solve for P", () => {
  it("solves principal from SI, R, T", () => {
    // SI=100, R=5, T=2 → P = 100*100/(5*2) = 1000
    const r = calculateSimpleInterest({ solveFor: "principal", interest: 100, rate: 5, time: 2 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.principal).toBe(1000);
  });
  it("errors when rate or time is 0", () => {
    expect("error" in calculateSimpleInterest({ solveFor: "principal", interest: 100, rate: 0, time: 2 })).toBe(true);
  });
});

describe("calculateSimpleInterest — solve for R", () => {
  it("solves rate from SI, P, T", () => {
    // SI=100, P=1000, T=2 → R = 100*100/(1000*2) = 5
    const r = calculateSimpleInterest({ solveFor: "rate", interest: 100, principal: 1000, time: 2 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.rate).toBe(5);
  });
});

describe("calculateSimpleInterest — solve for T", () => {
  it("solves time from SI, P, R", () => {
    // SI=100, P=1000, R=5 → T = 100*100/(1000*5) = 2
    const r = calculateSimpleInterest({ solveFor: "time", interest: 100, principal: 1000, rate: 5 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.time).toBe(2);
  });
});

describe("calculateSimpleInterest — extras", () => {
  it("computes per-year/month/day interest", () => {
    const r = calculateSimpleInterest({ solveFor: "si", principal: 1200, rate: 12, time: 1 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.perYear).toBe(144);
    expect(r.perMonth).toBe(12);
    expect(r.perDay).toBeCloseTo(144 / 365, 1);
  });
  it("generates yearly breakdown", () => {
    const r = calculateSimpleInterest({ solveFor: "si", principal: 1000, rate: 10, time: 3 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.breakdown.length).toBe(3);
    expect(r.breakdown[0]!.interest).toBe(100);
    expect(r.breakdown[2]!.cumulativeInterest).toBe(300);
  });
  it("handles partial year in breakdown", () => {
    const r = calculateSimpleInterest({ solveFor: "si", principal: 1000, rate: 10, time: 2.5 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.breakdown.length).toBe(3); // 2 full + 1 partial
    expect(r.breakdown[2]!.period).toContain("partial");
  });
  it("compares with compound interest", () => {
    const r = calculateSimpleInterest({ solveFor: "si", principal: 1000, rate: 10, time: 2, compoundFreq: 1 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.compoundInterestComparison).toBeDefined();
    // CI = 1000 * (1.1)^2 - 1000 = 210
    expect(r.compoundInterestComparison!.interest).toBe(210);
    expect(r.compoundInterestComparison!.difference).toBe(10); // 210 - 200 = 10
  });
  it("computes inflation-adjusted value", () => {
    const r = calculateSimpleInterest({ solveFor: "si", principal: 1000, rate: 10, time: 2, inflationRate: 5 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.inflationAdjusted).toBeDefined();
    expect(r.inflationAdjusted!.realValue).toBeLessThan(r.amount);
  });
});

describe("breakdownToCsv", () => {
  it("generates CSV with header", () => {
    const r = calculateSimpleInterest({ solveFor: "si", principal: 1000, rate: 10, time: 2 });
    if ("error" in r) throw new Error("Should not error");
    const csv = breakdownToCsv(r.breakdown);
    expect(csv.split("\n")[0]).toBe("Period,Interest,CumulativeInterest,Balance");
    expect(csv.split("\n").length).toBe(3);
  });
});

describe("formatMoney", () => {
  it("formats USD", () => { expect(formatMoney(1500, "USD")).toContain("1,500"); });
});

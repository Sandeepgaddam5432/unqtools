/**
 * Mortgage Calculator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { calculateMortgage, mortgageScheduleToCsv, formatCurrency } from "./logic";

const BASE = {
  homePrice: 400_000,
  downPaymentPct: 20,
  annualInterestRatePct: 6.5,
  termYears: 30,
  propertyTaxAnnual: 6000,
  homeInsuranceAnnual: 1200,
  hoaAnnual: 0,
  pmiRatePct: 0.5,
} as const;

describe("calculateMortgage — validation", () => {
  it("errors on zero home price", () => {
    expect("error" in calculateMortgage({ ...BASE, homePrice: 0 })).toBe(true);
  });

  it("errors on down payment >= 100%", () => {
    expect("error" in calculateMortgage({ ...BASE, downPaymentPct: 100 })).toBe(true);
  });

  it("errors on term > 50 years", () => {
    expect("error" in calculateMortgage({ ...BASE, termYears: 60 })).toBe(true);
  });
});

describe("calculateMortgage — basic math", () => {
  it("computes correct loan amount (home − down payment)", () => {
    const r = calculateMortgage(BASE);
    if ("error" in r) throw new Error("Should not error");
    expect(r.loanAmount).toBe(320_000); // 400k − 20% × 400k
    expect(r.downPayment).toBe(80_000);
  });

  it("monthly P&I matches standard amortization formula", () => {
    const r = calculateMortgage(BASE);
    if ("error" in r) throw new Error("Should not error");
    // $320k @ 6.5% / 30y → ~$2022.62/mo
    expect(r.monthlyPI).toBeCloseTo(2022.62, 1);
  });

  it("schedule ends with zero balance", () => {
    const r = calculateMortgage(BASE);
    if ("error" in r) throw new Error("Should not error");
    expect(r.schedule[r.schedule.length - 1]!.balance).toBeLessThan(1);
  });

  it("schedule has 360 months for a 30-year loan", () => {
    const r = calculateMortgage(BASE);
    if ("error" in r) throw new Error("Should not error");
    expect(r.actualMonths).toBe(360);
  });
});

describe("calculateMortgage — PMI", () => {
  it("no PMI when down payment >= 20%", () => {
    const r = calculateMortgage(BASE);
    if ("error" in r) throw new Error("Should not error");
    expect(r.monthlyBreakdown.pmi).toBe(0);
    expect(r.totalPmiPaid).toBe(0);
    expect(r.pmiDropMonth).toBeNull();
  });

  it("PMI required when down payment < 20%", () => {
    const r = calculateMortgage({ ...BASE, downPaymentPct: 10 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.monthlyBreakdown.pmi).toBeGreaterThan(0);
    expect(r.totalPmiPaid).toBeGreaterThan(0);
  });

  it("PMI drops off when LTV reaches 78%", () => {
    const r = calculateMortgage({ ...BASE, downPaymentPct: 10 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.pmiDropMonth).not.toBeNull();
    // Verify no PMI in schedule after drop-off month
    const dropMonth = r.pmiDropMonth!;
    for (let i = dropMonth; i < r.schedule.length; i++) {
      expect(r.schedule[i]!.pmi).toBe(0);
    }
  });

  it("PMI drop-off happens earlier with extra payments", () => {
    const baseline = calculateMortgage({ ...BASE, downPaymentPct: 10 });
    const withExtra = calculateMortgage({ ...BASE, downPaymentPct: 10, extraMonthly: 200 });
    if ("error" in baseline || "error" in withExtra) throw new Error("Should not error");
    expect(withExtra.pmiDropMonth!).toBeLessThan(baseline.pmiDropMonth!);
    expect(withExtra.totalPmiPaid).toBeLessThan(baseline.totalPmiPaid);
  });
});

describe("calculateMortgage — extra payments", () => {
  it("extra payments reduce total interest and term", () => {
    const baseline = calculateMortgage(BASE);
    const withExtra = calculateMortgage({ ...BASE, extraMonthly: 200 });
    if ("error" in baseline || "error" in withExtra) throw new Error("Should not error");
    expect(withExtra.totalInterest).toBeLessThan(baseline.totalInterest);
    expect(withExtra.actualMonths).toBeLessThan(baseline.actualMonths);
    expect(withExtra.interestSaved).toBeGreaterThan(0);
    expect(withExtra.monthsSaved).toBeGreaterThan(0);
  });

  it("one-time extra payment at year 5 reduces interest", () => {
    const baseline = calculateMortgage(BASE);
    const withLump = calculateMortgage({ ...BASE, oneTimeExtra: { month: 60, amount: 20_000 } });
    if ("error" in baseline || "error" in withLump) throw new Error("Should not error");
    expect(withLump.totalInterest).toBeLessThan(baseline.totalInterest);
    expect(withLump.actualMonths).toBeLessThan(baseline.actualMonths);
  });
});

describe("calculateMortgage — PITI breakdown", () => {
  it("monthly total includes P&I + tax + insurance + PMI + HOA", () => {
    const r = calculateMortgage({ ...BASE, downPaymentPct: 10, hoaAnnual: 1200 });
    if ("error" in r) throw new Error("Should not error");
    const b = r.monthlyBreakdown;
    expect(b.total).toBeCloseTo(
      b.principalAndInterest + b.propertyTax + b.homeInsurance + b.pmi + b.hoa,
      2,
    );
  });
});

describe("mortgageScheduleToCsv", () => {
  it("produces monthly CSV with header", () => {
    const r = calculateMortgage(BASE);
    if ("error" in r) throw new Error("Should not error");
    const csv = mortgageScheduleToCsv(r.schedule, "monthly");
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Month");
    expect(lines.length).toBe(361);
  });

  it("produces yearly CSV with 30 rows for 30-year mortgage", () => {
    const r = calculateMortgage(BASE);
    if ("error" in r) throw new Error("Should not error");
    const csv = mortgageScheduleToCsv(r.schedule, "yearly");
    const lines = csv.split("\n");
    expect(lines.length).toBe(31); // 1 header + 30 years
  });
});

describe("formatCurrency", () => {
  it("formats USD", () => {
    expect(formatCurrency(1234.56, "en-US", "USD")).toContain("$");
  });
});

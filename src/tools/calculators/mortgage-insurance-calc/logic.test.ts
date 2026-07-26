import { describe, it, expect } from "vitest";
import {
  calcLtv,
  monthlyPayment,
  conventionalPmiRate,
  fhaAnnualMipRate,
  fhaUpfrontMip,
  vaFundingFee,
  computeMortgageInsurance,
  pmiCancellationYear,
  validateInputs,
  fmtUSD,
  refinanceBreakeven,
  ltvRiskLabel,
  compareLoanTypes,
} from "./logic";

describe("calcLtv", () => {
  it("computes 80% LTV with 20% down", () => {
    expect(calcLtv(500000, 100000)).toBeCloseTo(80, 5);
  });
  it("handles 100% financing", () => {
    expect(calcLtv(400000, 0)).toBe(100);
  });
  it("returns 0 for zero home price", () => {
    expect(calcLtv(0, 0)).toBe(0);
  });
});

describe("monthlyPayment", () => {
  it("computes standard 30yr mortgage", () => {
    const p = monthlyPayment(400000, 7, 30);
    expect(p).toBeGreaterThan(2650);
    expect(p).toBeLessThan(2670);
  });
  it("handles zero interest", () => {
    expect(monthlyPayment(120000, 0, 10)).toBeCloseTo(1000, 2);
  });
  it("returns 0 for zero principal", () => {
    expect(monthlyPayment(0, 5, 30)).toBe(0);
  });
});

describe("conventionalPmiRate", () => {
  it("returns higher rate for higher LTV", () => {
    expect(conventionalPmiRate(95, 700)).toBeGreaterThan(conventionalPmiRate(80, 700));
  });
  it("discounts high credit scores", () => {
    expect(conventionalPmiRate(90, 780)).toBeLessThan(conventionalPmiRate(90, 620));
  });
  it("returns lowest rate below 75% LTV", () => {
    expect(conventionalPmiRate(60, 760)).toBeLessThan(0.3);
  });
});

describe("fhaAnnualMipRate", () => {
  it("returns 0.55 for 30yr >95% LTV", () => {
    expect(fhaAnnualMipRate(30, 96.5)).toBe(0.55);
  });
  it("returns 0.5 for 30yr ≤95% LTV", () => {
    expect(fhaAnnualMipRate(30, 90)).toBe(0.5);
  });
  it("returns 0.15 for 15yr ≤90% LTV", () => {
    expect(fhaAnnualMipRate(15, 85)).toBe(0.15);
  });
});

describe("fhaUpfrontMip", () => {
  it("computes 1.75% of loan by default", () => {
    expect(fhaUpfrontMip(400000)).toBe(7000);
  });
  it("accepts custom percentage", () => {
    expect(fhaUpfrontMip(400000, 1.5)).toBe(6000);
  });
});

describe("vaFundingFee", () => {
  it("waives fee for disabled veterans", () => {
    expect(vaFundingFee(400000, 0, true, true)).toBe(0);
  });
  it("charges 2.3% first-time use, 0% down", () => {
    expect(vaFundingFee(400000, 0, true, false)).toBe(9200);
  });
  it("charges 3.3% subsequent use, 0% down", () => {
    expect(vaFundingFee(400000, 0, false, false)).toBe(13200);
  });
  it("reduces with 10%+ down", () => {
    expect(vaFundingFee(400000, 10, true, false)).toBe(5000);
  });
});

describe("computeMortgageInsurance", () => {
  it("returns 0 monthly MI when LTV < 80% (conventional)", () => {
    const r = computeMortgageInsurance({
      homePrice: 500000,
      downPayment: 150000,
      loanType: "conventional",
      term: 30,
      creditScore: 750,
    });
    expect(r.monthlyMI).toBe(0);
    expect(r.notes.join(" ")).toMatch(/no pmi/i);
  });
  it("computes conventional PMI when LTV > 80%", () => {
    const r = computeMortgageInsurance({
      homePrice: 500000,
      downPayment: 50000,
      loanType: "conventional",
      term: 30,
      creditScore: 700,
    });
    expect(r.monthlyMI).toBeGreaterThan(0);
    expect(r.cancellable).toBe(true);
  });
  it("computes FHA MIP including upfront", () => {
    const r = computeMortgageInsurance({
      homePrice: 400000,
      downPayment: 14000,
      loanType: "fha",
      term: 30,
      creditScore: 660,
    });
    expect(r.monthlyMI).toBeGreaterThan(0);
    expect(r.upfrontMI).toBeGreaterThan(5000);
  });
  it("computes VA funding fee", () => {
    const r = computeMortgageInsurance({
      homePrice: 500000,
      downPayment: 0,
      loanType: "va",
      term: 30,
      creditScore: 720,
      vaFirstUse: true,
      vaDisabled: false,
    });
    expect(r.upfrontMI).toBeGreaterThan(0);
    expect(r.monthlyMI).toBe(0);
  });
  it("builds 5-year schedule", () => {
    const r = computeMortgageInsurance({
      homePrice: 400000,
      downPayment: 40000,
      loanType: "conventional",
      term: 30,
      creditScore: 700,
    });
    expect(r.schedule).toHaveLength(5);
    expect(r.schedule[4].cumulativeMI).toBeGreaterThan(r.schedule[0].cumulativeMI);
  });
});

describe("pmiCancellationYear", () => {
  it("estimates cancellation year", () => {
    const y = pmiCancellationYear(500000, 25000, 7, 30);
    expect(y).toBeGreaterThan(2);
    expect(y).toBeLessThan(30);
  });
});

describe("validateInputs", () => {
  it("flags negative down payment", () => {
    expect(validateInputs({ homePrice: 500000, downPayment: -1000 })).toContain(
      "Down payment cannot be negative",
    );
  });
  it("flags down ≥ home price", () => {
    expect(validateInputs({ homePrice: 500000, downPayment: 600000 })).toContain(
      "Down payment must be less than home price",
    );
  });
  it("flags invalid credit score", () => {
    expect(validateInputs({ creditScore: 100 })).toContain("Credit score must be 300-850");
  });
  it("passes valid input", () => {
    expect(validateInputs({ homePrice: 500000, downPayment: 100000, creditScore: 700 })).toHaveLength(0);
  });
});

describe("fmtUSD", () => {
  it("formats currency", () => {
    expect(fmtUSD(1234.5)).toMatch(/\$\d/);
  });
  it("returns dash for non-finite", () => {
    expect(fmtUSD(NaN)).toBe("—");
  });
});

describe("refinanceBreakeven", () => {
  it("computes months to recover closing costs", () => {
    expect(refinanceBreakeven(4000, 200)).toBe(20);
  });
  it("returns Infinity for no savings", () => {
    expect(refinanceBreakeven(4000, 0)).toBe(Infinity);
  });
});

describe("ltvRiskLabel", () => {
  it("labels low LTV", () => {
    expect(ltvRiskLabel(70).label).toBe("Low");
  });
  it("labels high LTV", () => {
    expect(ltvRiskLabel(98).label).toBe("High");
  });
  it("labels underwater", () => {
    expect(ltvRiskLabel(120).label).toBe("Underwater");
  });
});

describe("compareLoanTypes", () => {
  it("returns 3 results", () => {
    const cmp = compareLoanTypes({
      homePrice: 500000,
      downPayment: 25000,
      term: 30,
      creditScore: 700,
    });
    expect(cmp).toHaveLength(3);
    expect(cmp.map((c) => c.type).sort()).toEqual(["conventional", "fha", "va"]);
  });
});

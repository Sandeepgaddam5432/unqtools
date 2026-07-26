import { describe, it, expect } from "vitest";
import {
  getPeriodsPerYear, getFrequencies, calcPV, calcFV, calcPaymentFromPV, calcPaymentFromFV,
  planAnnuity, planBatch, renderBatchCsv, renderReport, getAnnuityPresets, formatCurrency,
  amortizationSchedule,
} from "./logic";

describe("annuity-calculator getPeriodsPerYear / getFrequencies", () => {
  it("returns 12 for monthly", () => {
    expect(getPeriodsPerYear("monthly")).toBe(12);
  });
  it("returns 4 for quarterly", () => {
    expect(getPeriodsPerYear("quarterly")).toBe(4);
  });
  it("returns 4 frequencies", () => {
    expect(getFrequencies().length).toBe(4);
  });
});

describe("annuity-calculator calcPV", () => {
  it("returns PV of ordinary annuity", () => {
    const pv = calcPV(100, 0.05 / 12, 12);
    expect(pv).toBeCloseTo(1168.14, 1);
  });
  it("returns payment * n when rate is 0", () => {
    expect(calcPV(100, 0, 12)).toBe(1200);
  });
  it("annuity-due has higher PV than ordinary", () => {
    const ordinary = calcPV(100, 0.05 / 12, 12, "ordinary");
    const due = calcPV(100, 0.05 / 12, 12, "annuity-due");
    expect(due).toBeGreaterThan(ordinary);
  });
});

describe("annuity-calculator calcFV", () => {
  it("returns FV of ordinary annuity", () => {
    const fv = calcFV(100, 0.05 / 12, 12);
    expect(fv).toBeCloseTo(1227.89, 0);
  });
  it("returns payment * n when rate is 0", () => {
    expect(calcFV(100, 0, 12)).toBe(1200);
  });
});

describe("annuity-calculator calcPaymentFromPV", () => {
  it("inverts calcPV", () => {
    const pv = calcPV(100, 0.05 / 12, 12);
    const pmt = calcPaymentFromPV(pv, 0.05 / 12, 12);
    expect(pmt).toBeCloseTo(100, 4);
  });
  it("returns pv / n when rate is 0", () => {
    expect(calcPaymentFromPV(1200, 0, 12)).toBe(100);
  });
});

describe("annuity-calculator calcPaymentFromFV", () => {
  it("inverts calcFV", () => {
    const fv = calcFV(100, 0.05 / 12, 12);
    const pmt = calcPaymentFromFV(fv, 0.05 / 12, 12);
    expect(pmt).toBeCloseTo(100, 4);
  });
});

describe("annuity-calculator planAnnuity", () => {
  it("solves for PV and FV given payment", () => {
    const r = planAnnuity({ annualRate: 0.06, termYears: 30, frequency: "monthly", type: "ordinary", paymentAmount: 500 });
    expect(r.presentValue).toBeGreaterThan(0);
    expect(r.futureValue).toBeGreaterThan(0);
    expect(r.solved.field).toBe("presentValue");
  });
  it("solves for payment given PV", () => {
    const r = planAnnuity({ annualRate: 0.07, termYears: 25, frequency: "monthly", type: "ordinary", presentValue: 200_000 });
    expect(r.paymentAmount).toBeGreaterThan(0);
    expect(r.solved.field).toBe("paymentAmount");
  });
  it("solves for payment given FV", () => {
    const r = planAnnuity({ annualRate: 0.05, termYears: 10, frequency: "monthly", type: "ordinary", futureValue: 50_000 });
    expect(r.paymentAmount).toBeGreaterThan(0);
    expect(r.solved.field).toBe("paymentAmount");
  });
  it("computes total periods correctly for monthly over 30 years", () => {
    const r = planAnnuity({ annualRate: 0.06, termYears: 30, frequency: "monthly", type: "ordinary", paymentAmount: 500 });
    expect(r.totalPeriods).toBe(360);
    expect(r.periodicRate).toBeCloseTo(0.06 / 12, 8);
  });
  it("notes annuity-due", () => {
    const r = planAnnuity({ annualRate: 0.06, termYears: 10, frequency: "annual", type: "annuity-due", paymentAmount: 1000 });
    expect(r.notes.some((n) => n.includes("annuity due"))).toBe(true);
  });
  it("warns on negative rate", () => {
    const r = planAnnuity({ annualRate: -0.05, termYears: 10, frequency: "annual", type: "ordinary", paymentAmount: 1000 });
    expect(r.warnings.some((w) => w.includes("Annual rate"))).toBe(true);
  });
});

describe("annuity-calculator planBatch / renderBatchCsv", () => {
  it("plans batch", () => {
    const rs = planBatch([
      { annualRate: 0.05, termYears: 10, frequency: "monthly", type: "ordinary", paymentAmount: 500 },
      { annualRate: 0.07, termYears: 25, frequency: "monthly", type: "ordinary", presentValue: 200_000 },
    ]);
    expect(rs.length).toBe(2);
  });
  it("renders CSV", () => {
    const csv = renderBatchCsv(planBatch([
      { annualRate: 0.05, termYears: 10, frequency: "monthly", type: "ordinary", paymentAmount: 500 },
    ]));
    expect(csv.split("\n")[0]).toContain("index,pv,fv");
  });
});

describe("annuity-calculator renderReport", () => {
  it("renders report", () => {
    const r = renderReport(planAnnuity({ annualRate: 0.06, termYears: 30, frequency: "monthly", type: "ordinary", paymentAmount: 500 }));
    expect(r).toContain("Annuity Calculation Report");
    expect(r).toContain("Present value");
    expect(r).toContain("Future value");
    expect(r).toContain("Payment per period");
  });
});

describe("annuity-calculator getAnnuityPresets", () => {
  it("returns 4 presets", () => {
    expect(getAnnuityPresets().length).toBe(4);
  });
});

describe("annuity-calculator formatCurrency", () => {
  it("formats USD with 2 decimals", () => {
    expect(formatCurrency(1234.567)).toMatch(/\$1,234\.57/);
  });
});

describe("annuity-calculator amortizationSchedule", () => {
  it("produces n rows", () => {
    const sched = amortizationSchedule(10_000, calcPaymentFromPV(10_000, 0.05 / 12, 12), 0.05 / 12, 12);
    expect(sched.length).toBe(12);
  });
  it("balance reaches near zero at end", () => {
    const pmt = calcPaymentFromPV(10_000, 0.05 / 12, 12);
    const sched = amortizationSchedule(10_000, pmt, 0.05 / 12, 12);
    expect(sched[11].balance).toBeLessThan(1);
  });
});

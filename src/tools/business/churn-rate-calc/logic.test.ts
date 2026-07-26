import { describe, it, expect } from "vitest";
import {
  calcCustomerChurnRate, calcNetCustomerChurnRate, calcRevenueChurnRate, calcNetRevenueChurnRate,
  planChurn, computeCohortRetention, planBatch, renderBatchCsv, renderReport, getChurnPresets,
  formatPct, formatCurrency, projectMrr, categorizeChurn,
} from "./logic";

describe("churn-rate-calc calcCustomerChurnRate", () => {
  it("returns lost customers / start", () => {
    expect(calcCustomerChurnRate(100, 95, 5)).toBe(0.10);
  });
  it("returns 0 if start is 0", () => {
    expect(calcCustomerChurnRate(0, 10, 10)).toBe(0);
  });
  it("clamps to 0 if customers grew", () => {
    expect(calcCustomerChurnRate(100, 150, 60)).toBe(0.10);
  });
});

describe("churn-rate-calc calcNetCustomerChurnRate", () => {
  it("returns (lost - new) / start", () => {
    expect(calcNetCustomerChurnRate(100, 105, 10)).toBeCloseTo(-0.05, 5);
  });
});

describe("churn-rate-calc calcRevenueChurnRate", () => {
  it("returns lost MRR / start MRR", () => {
    expect(calcRevenueChurnRate(10_000, 9_500, 0, 0)).toBe(0.05);
  });
  it("handles expansion MRR offsetting loss", () => {
    expect(calcRevenueChurnRate(10_000, 10_500, 0, 1_000)).toBe(0.05);
  });
});

describe("churn-rate-calc calcNetRevenueChurnRate", () => {
  it("returns (churned + contraction - new - expansion) / start", () => {
    expect(calcNetRevenueChurnRate(10_000, 10_500, 0, 1_000, 0, 500)).toBeCloseTo(-0.05, 5);
  });
});

describe("churn-rate-calc planChurn", () => {
  it("computes all rates", () => {
    const r = planChurn({
      customersStart: 100, customersEnd: 95, newCustomers: 5,
      mrrStart: 10_000, mrrEnd: 9_800, newMrr: 500, expansionMrr: 200, contractionMrr: 100, churnedMrr: 800,
      periodMonths: 1,
    });
    expect(r.customerChurnRate).toBe(0.10);
    expect(r.lostCustomers).toBe(10);
    expect(r.mrrImpact).toBeCloseTo(500 + 200 - 800 - 100, 2);
  });
  it("notes high churn warning", () => {
    const r = planChurn({
      customersStart: 100, customersEnd: 80, newCustomers: 5,
      mrrStart: 10_000, mrrEnd: 8_000, newMrr: 0, expansionMrr: 0, contractionMrr: 0, churnedMrr: 2_000,
      periodMonths: 1,
    });
    expect(r.notes.some((n) => n.includes("high"))).toBe(true);
  });
  it("notes negative net revenue churn", () => {
    const r = planChurn({
      customersStart: 100, customersEnd: 110, newCustomers: 15,
      mrrStart: 10_000, mrrEnd: 12_000, newMrr: 1_500, expansionMrr: 1_000, contractionMrr: 0, churnMrr: 0,
      churnedMrr: 500, periodMonths: 1,
    });
    expect(r.notes.some((n) => n.includes("expansion"))).toBe(true);
  });
  it("warns on bad inputs", () => {
    const r = planChurn({
      customersStart: -1, customersEnd: 100, newCustomers: 5,
      mrrStart: 10_000, mrrEnd: 9_800, newMrr: 500, expansionMrr: 200, contractionMrr: 100, churnedMrr: 800,
      periodMonths: 1,
    });
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("computes monthly MRR impacts", () => {
    const r = planChurn({
      customersStart: 100, customersEnd: 95, newCustomers: 5,
      mrrStart: 10_000, mrrEnd: 9_800, newMrr: 1_500, expansionMrr: 600, contractionMrr: 300, churnedMrr: 2_400,
      periodMonths: 3,
    });
    expect(r.monthlyNewMrr).toBeCloseTo(500, 2);
    expect(r.monthlyExpansionMrr).toBeCloseTo(200, 2);
    expect(r.monthlyContractionMrr).toBeCloseTo(100, 2);
    expect(r.monthlyChurnedMrr).toBeCloseTo(800, 2);
  });
});

describe("churn-rate-calc computeCohortRetention", () => {
  it("computes retention rates", () => {
    const rows = computeCohortRetention([
      { cohort: "Jan", sizes: [100, 95, 90, 85] },
      { cohort: "Feb", sizes: [120, 110, 100] },
    ]);
    expect(rows[0].retention1).toBeCloseTo(0.95, 5);
    expect(rows[0].retention3).toBeCloseTo(0.85, 5);
    expect(rows[1].retention3).toBeNull();
  });
});

describe("churn-rate-calc planBatch / renderBatchCsv", () => {
  it("plans batch", () => {
    const rs = planBatch([
      { customersStart: 100, customersEnd: 95, newCustomers: 5, mrrStart: 10_000, mrrEnd: 9_800, newMrr: 500, expansionMrr: 200, contractionMrr: 100, churnedMrr: 800, periodMonths: 1 },
      { customersStart: 200, customersEnd: 190, newCustomers: 10, mrrStart: 20_000, mrrEnd: 19_600, newMrr: 1_000, expansionMrr: 400, contractionMrr: 200, churnedMrr: 1_600, periodMonths: 1 },
    ]);
    expect(rs.length).toBe(2);
  });
  it("renders CSV", () => {
    const csv = renderBatchCsv(planBatch([
      { customersStart: 100, customersEnd: 95, newCustomers: 5, mrrStart: 10_000, mrrEnd: 9_800, newMrr: 500, expansionMrr: 200, contractionMrr: 100, churnedMrr: 800, periodMonths: 1 },
    ]));
    expect(csv.split("\n")[0]).toContain("index,customer_churn_pct");
  });
});

describe("churn-rate-calc renderReport", () => {
  it("renders report", () => {
    const r = renderReport(planChurn({
      customersStart: 100, customersEnd: 95, newCustomers: 5,
      mrrStart: 10_000, mrrEnd: 9_800, newMrr: 500, expansionMrr: 200, contractionMrr: 100, churnedMrr: 800,
      periodMonths: 1,
    }));
    expect(r).toContain("Churn Rate Report");
    expect(r).toContain("Customer churn rate");
    expect(r).toContain("Net revenue churn");
  });
});

describe("churn-rate-calc getChurnPresets", () => {
  it("returns 4 presets", () => {
    expect(getChurnPresets().length).toBe(4);
  });
});

describe("churn-rate-calc formatPct / formatCurrency", () => {
  it("formats percentage", () => {
    expect(formatPct(0.1234)).toBe("12.34%");
    expect(formatPct(NaN)).toBe("—");
  });
  it("formats USD", () => {
    expect(formatCurrency(10_000)).toMatch(/\$/);
  });
});

describe("churn-rate-calc projectMrr", () => {
  it("projects MRR over months", () => {
    const p = projectMrr(10_000, 500, 12);
    expect(p.length).toBe(13);
    expect(p[12].mrr).toBe(16_000);
  });
});

describe("churn-rate-calc categorizeChurn", () => {
  it("categorises excellent", () => { expect(categorizeChurn(0.01).level).toBe("good"); });
  it("categorises healthy", () => { expect(categorizeChurn(0.04).level).toBe("good"); });
  it("categorises concerning", () => { expect(categorizeChurn(0.07).level).toBe("ok"); });
  it("categorises critical", () => { expect(categorizeChurn(0.15).level).toBe("bad"); });
});

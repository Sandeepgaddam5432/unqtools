import { describe, it, expect } from "vitest";
import {
  daysBetween,
  isLongTerm,
  applyBrackets,
  primaryResidenceExclusion,
  computeCapitalGains,
  niit,
  stateCapitalGainsTax,
  exchange1031Eligibility,
  harvestLosses,
  validateInputs,
  fmtUSD,
  LT_BRACKETS,
  ST_BRACKETS,
} from "./logic";

describe("daysBetween", () => {
  it("computes day count", () => {
    expect(daysBetween("2023-01-01", "2024-01-01")).toBe(365);
  });
  it("handles leap year", () => {
    expect(daysBetween("2024-01-01", "2024-12-31")).toBe(365);
  });
  it("returns NaN for invalid dates", () => {
    expect(isNaN(daysBetween("garbage", "2024-01-01"))).toBe(true);
  });
});

describe("isLongTerm", () => {
  it(">365 days is long-term", () => {
    expect(isLongTerm("2022-01-01", "2023-01-02")).toBe(true);
  });
  it("≤365 days is short-term", () => {
    expect(isLongTerm("2024-01-01", "2024-12-31")).toBe(false);
  });
});

describe("applyBrackets", () => {
  it("applies progressive single brackets", () => {
    const brackets = LT_BRACKETS.single;
    // Taxable gain $50k on $0 base: 0% on first $47,025, 15% on remaining $2,975 → $446.25
    const tax = applyBrackets(brackets, 50000, 0);
    expect(tax).toBeCloseTo(446.25, 1);
  });
  it("applies 0% in the 0% bracket", () => {
    expect(applyBrackets(LT_BRACKETS.single, 40000, 0)).toBe(0);
  });
  it("applies 20% above top threshold", () => {
    const tax = applyBrackets(LT_BRACKETS.single, 1000000, 0);
    // 0% on 47025, 15% on (518900-47025)=471875, 20% on remaining 481100
    const expected = 471875 * 0.15 + 481100 * 0.2;
    expect(tax).toBeCloseTo(expected, 0);
  });
});

describe("primaryResidenceExclusion", () => {
  it("excludes up to $250k single after 2 years", () => {
    expect(primaryResidenceExclusion("single", 3, 200000)).toBe(200000);
    expect(primaryResidenceExclusion("single", 3, 400000)).toBe(250000);
  });
  it("excludes up to $500k MFJ", () => {
    expect(primaryResidenceExclusion("marriedJoint", 3, 600000)).toBe(500000);
  });
  it("returns 0 if owned <2 years", () => {
    expect(primaryResidenceExclusion("single", 1, 200000)).toBe(0);
  });
});

describe("computeCapitalGains — stocks", () => {
  it("computes long-term stock gain", () => {
    const r = computeCapitalGains({
      purchasePrice: 10000,
      salePrice: 30000,
      purchaseDate: "2020-01-01",
      saleDate: "2024-01-02",
      improvements: 0,
      sellingCosts: 500,
      filingStatus: "single",
      taxableIncome: 50000,
      assetType: "stocks",
    });
    expect(r.isLongTerm).toBe(true);
    expect(r.gain).toBe(19500);
    expect(r.federalTax).toBeGreaterThan(0);
  });
  it("computes short-term stock gain at ordinary rates", () => {
    const r = computeCapitalGains({
      purchasePrice: 10000,
      salePrice: 30000,
      purchaseDate: "2024-01-01",
      saleDate: "2024-06-01",
      improvements: 0,
      sellingCosts: 0,
      filingStatus: "single",
      taxableIncome: 100000,
      assetType: "stocks",
    });
    expect(r.isLongTerm).toBe(false);
    expect(r.federalTax).toBeGreaterThan(0);
  });
});

describe("computeCapitalGains — real estate", () => {
  it("applies Section 121 exclusion for primary residence", () => {
    const r = computeCapitalGains({
      purchasePrice: 300000,
      salePrice: 700000,
      purchaseDate: "2018-01-01",
      saleDate: "2024-01-02",
      improvements: 50000,
      sellingCosts: 40000,
      filingStatus: "single",
      taxableIncome: 80000,
      assetType: "realEstate",
      isPrimaryResidence: true,
      yearsOwnedAsPrimary: 5,
    });
    expect(r.exclusion).toBeGreaterThan(0);
    expect(r.taxableGain).toBeLessThan(r.gain);
  });
  it("applies depreciation recapture", () => {
    const r = computeCapitalGains({
      purchasePrice: 300000,
      salePrice: 500000,
      purchaseDate: "2018-01-01",
      saleDate: "2024-01-02",
      improvements: 0,
      sellingCosts: 0,
      filingStatus: "single",
      taxableIncome: 80000,
      assetType: "realEstate",
      depreciationRecapture: 50000,
    });
    expect(r.depreciationRecapture).toBe(50000);
    expect(r.federalTax).toBeGreaterThan(50000 * 0.25);
  });
});

describe("computeCapitalGains — collectibles & crypto", () => {
  it("collectibles use 28% flat LT rate", () => {
    const r = computeCapitalGains({
      purchasePrice: 1000,
      salePrice: 11000,
      purchaseDate: "2010-01-01",
      saleDate: "2024-01-02",
      improvements: 0,
      sellingCosts: 0,
      filingStatus: "single",
      taxableIncome: 50000,
      assetType: "collectibles",
    });
    // 28% of $10k = $2800 (plus no recapture/exclusion)
    expect(r.federalTax).toBeCloseTo(2800, 0);
  });
  it("crypto short-term uses ordinary rates", () => {
    const r = computeCapitalGains({
      purchasePrice: 1000,
      salePrice: 5000,
      purchaseDate: "2024-01-01",
      saleDate: "2024-06-01",
      improvements: 0,
      sellingCosts: 0,
      filingStatus: "single",
      taxableIncome: 80000,
      assetType: "crypto",
    });
    expect(r.federalTax).toBeGreaterThan(0);
    expect(r.notes.join(" ")).toMatch(/ordinary/i);
  });
});

describe("niit", () => {
  it("returns 0 below threshold", () => {
    expect(niit(150000, "single", 50000)).toBe(0);
  });
  it("applies 3.8% on excess over threshold", () => {
    // MAGI 250k single, $50k investment income → 3.8% of $50k = $1900
    expect(niit(250000, "single", 50000)).toBe(1900);
  });
  it("uses higher MFJ threshold", () => {
    expect(niit(240000, "marriedJoint", 50000)).toBe(0);
  });
});

describe("stateCapitalGainsTax", () => {
  it("CA charges 13.3%", () => {
    expect(stateCapitalGainsTax("CA", 10000)).toBeCloseTo(1330, 0);
  });
  it("TX/FL have no state tax", () => {
    expect(stateCapitalGainsTax("TX", 10000)).toBe(0);
    expect(stateCapitalGainsTax("FL", 10000)).toBe(0);
  });
});

describe("exchange1031Eligibility", () => {
  it("eligible for real estate within 180 days", () => {
    const r = exchange1031Eligibility("realEstate", 60);
    expect(r.eligible).toBe(true);
    expect(r.identifyDeadline).toBe(45);
    expect(r.closeDeadline).toBe(180);
  });
  it("ineligible after 180 days", () => {
    expect(exchange1031Eligibility("realEstate", 200).eligible).toBe(false);
  });
  it("ineligible for non-real-estate", () => {
    expect(exchange1031Eligibility("stocks", 30).eligible).toBe(false);
  });
});

describe("harvestLosses", () => {
  it("offsets gains with losses", () => {
    const r = harvestLosses(10000, 4000);
    expect(r.netGain).toBe(6000);
    expect(r.deductibleLoss).toBe(0);
  });
  it("deducts up to $3k ordinary income", () => {
    const r = harvestLosses(0, 5000);
    expect(r.netGain).toBe(-5000);
    expect(r.deductibleLoss).toBe(3000);
    expect(r.carryover).toBe(2000);
  });
  it("carries over remaining loss", () => {
    const r = harvestLosses(0, 10000);
    expect(r.carryover).toBe(7000);
  });
});

describe("validateInputs", () => {
  it("flags negative purchase price", () => {
    expect(validateInputs({ purchasePrice: -1 })).toContain("Purchase price must be ≥ 0");
  });
  it("flags sale before purchase", () => {
    expect(validateInputs({ purchaseDate: "2024-06-01", saleDate: "2024-01-01" })).toContain(
      "Sale date must be after purchase date",
    );
  });
  it("flags invalid dates", () => {
    expect(validateInputs({ purchaseDate: "abc", saleDate: "2024-01-01" })).toContain(
      "Invalid date format",
    );
  });
  it("passes valid input", () => {
    expect(
      validateInputs({
        purchasePrice: 100,
        salePrice: 200,
        purchaseDate: "2020-01-01",
        saleDate: "2024-01-01",
      }),
    ).toHaveLength(0);
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

describe("ST_BRACKETS", () => {
  it("has brackets for all filing statuses", () => {
    expect(ST_BRACKETS.single.length).toBeGreaterThan(0);
    expect(ST_BRACKETS.marriedJoint.length).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from "vitest";
import {
  computeStampDuty,
  computeDuty,
  getBrackets,
  UK_BRACKETS,
  formatCurrency,
  validateInput,
  rateCard,
  compareJurisdictions,
  additionalFees,
  type Jurisdiction,
} from "./logic";

describe("getBrackets", () => {
  it("returns UK residential brackets", () => {
    const b = getBrackets("uk", "residential");
    expect(b).toBe(UK_BRACKETS);
    expect(b.length).toBeGreaterThan(0);
  });
  it("returns first-time buyer brackets for UK", () => {
    const b = getBrackets("uk", "firstTime");
    expect(b[0].ratePct).toBe(0);
    expect(b[0].upTo).toBe(425000);
  });
  it("returns investor (additional) brackets with higher rates", () => {
    const b = getBrackets("uk", "investor");
    expect(b[0].ratePct).toBeGreaterThan(UK_BRACKETS[0].ratePct);
  });
  it("returns TX brackets with 0 rate", () => {
    const b = getBrackets("us-tx", "residential");
    expect(b[0].ratePct).toBe(0);
  });
});

describe("computeDuty", () => {
  it("returns 0 for price below first threshold", () => {
    const r = computeDuty(UK_BRACKETS, 100000);
    expect(r.duty).toBe(0);
  });
  it("computes progressive duty across brackets", () => {
    const r = computeDuty(UK_BRACKETS, 500000);
    // 0-125k=0; 125k-250k @2% = 2500; 250k-500k @5% = 12500 → 15000
    expect(r.duty).toBe(15000);
  });
  it("stops applying brackets beyond price", () => {
    const r = computeDuty(UK_BRACKETS, 200000);
    // 0-125k=0; 125k-200k @2% = 1500
    expect(r.duty).toBe(1500);
  });
  it("handles price = 0", () => {
    expect(computeDuty(UK_BRACKETS, 0).duty).toBe(0);
  });
  it("produces breakdown with cumulative brackets", () => {
    const r = computeDuty(UK_BRACKETS, 300000);
    expect(r.breakdown.length).toBeGreaterThanOrEqual(2);
    expect(r.breakdown[0].from).toBe(0);
  });
});

describe("computeStampDuty — UK", () => {
  it("first-time buyer pays £0 under £425k", () => {
    const r = computeStampDuty({
      jurisdiction: "uk",
      price: 300000,
      buyerType: "firstTime",
      propertyType: "residential",
    });
    expect(r.total).toBe(0);
  });
  it("residential buyer pays progressive duty", () => {
    const r = computeStampDuty({
      jurisdiction: "uk",
      price: 500000,
      buyerType: "residential",
      propertyType: "residential",
    });
    expect(r.total).toBe(15000);
  });
  it("investor pays higher rate", () => {
    const r = computeStampDuty({
      jurisdiction: "uk",
      price: 300000,
      buyerType: "investor",
      propertyType: "residential",
    });
    // First-time = 0; investor pays 3% on first 250k, 8% on 250-300k = 7500+4000=11500
    expect(r.total).toBeGreaterThan(5000);
  });
  it("non-UK resident adds 2% surcharge", () => {
    const r = computeStampDuty({
      jurisdiction: "uk",
      price: 500000,
      buyerType: "nonResident",
      propertyType: "residential",
    });
    expect(r.surcharge).toBe(10000);
  });
});

describe("computeStampDuty — AU", () => {
  it("applies foreign buyer surcharge (NSW)", () => {
    const r = computeStampDuty({
      jurisdiction: "au-nsw",
      price: 1000000,
      buyerType: "residential",
      propertyType: "residential",
      foreignBuyer: true,
    });
    expect(r.surcharge).toBe(80000);
  });
  it("VIC has its own brackets", () => {
    const r = computeStampDuty({
      jurisdiction: "au-vic",
      price: 500000,
      buyerType: "residential",
      propertyType: "residential",
    });
    expect(r.total).toBeGreaterThan(20000);
  });
});

describe("computeStampDuty — IN", () => {
  it("female buyer gets 10% concession", () => {
    const base = computeStampDuty({
      jurisdiction: "in",
      price: 5000000,
      buyerType: "residential",
      propertyType: "residential",
      gender: "male",
    });
    const female = computeStampDuty({
      jurisdiction: "in",
      price: 5000000,
      buyerType: "residential",
      propertyType: "residential",
      gender: "female",
    });
    expect(female.concession).toBeGreaterThan(0);
    expect(female.total).toBeLessThan(base.total);
  });
  it("senior gets additional concession", () => {
    const r = computeStampDuty({
      jurisdiction: "in",
      price: 5000000,
      buyerType: "residential",
      propertyType: "residential",
      senior: true,
      gender: "male",
    });
    expect(r.concession).toBeGreaterThan(0);
  });
});

describe("computeStampDuty — US", () => {
  it("TX returns 0 duty with note", () => {
    const r = computeStampDuty({
      jurisdiction: "us-tx",
      price: 500000,
      buyerType: "residential",
      propertyType: "residential",
    });
    expect(r.total).toBe(0);
    expect(r.notes.join(" ")).toMatch(/no state/i);
  });
  it("FL flat 0.7%", () => {
    const r = computeStampDuty({
      jurisdiction: "us-fl",
      price: 200000,
      buyerType: "residential",
      propertyType: "residential",
    });
    expect(r.total).toBeCloseTo(1400, 0);
  });
});

describe("formatCurrency", () => {
  it("UK formats with £", () => {
    expect(formatCurrency(1500, "uk")).toMatch(/£/);
  });
  it("AU formats with A$", () => {
    expect(formatCurrency(1500, "au-nsw")).toMatch(/A\$/);
  });
  it("IN formats with ₹", () => {
    expect(formatCurrency(1500, "in")).toMatch(/₹/);
  });
  it("US formats with $", () => {
    expect(formatCurrency(1500, "us-ny")).toMatch(/^\$/);
  });
});

describe("validateInput", () => {
  it("flags negative price", () => {
    expect(validateInput({ price: -1, jurisdiction: "uk" })).toContain("Price must be ≥ 0");
  });
  it("flags missing jurisdiction", () => {
    expect(validateInput({ price: 100 })).toContain("Jurisdiction is required");
  });
  it("passes valid input", () => {
    expect(validateInput({ price: 100, jurisdiction: "uk" })).toHaveLength(0);
  });
});

describe("rateCard", () => {
  it("returns duty for each price point", () => {
    const r = rateCard("uk", [250000, 500000]);
    expect(r).toHaveLength(2);
    expect(r[0].duty).toBeGreaterThanOrEqual(0);
    expect(r[1].effectivePct).toBeGreaterThan(0);
  });
});

describe("compareJurisdictions", () => {
  it("compares multiple jurisdictions", () => {
    const r = compareJurisdictions(500000, ["uk", "us-ny", "us-tx"]);
    expect(r).toHaveLength(3);
    const tx = r.find((x) => x.jurisdiction === "us-tx");
    expect(tx?.duty).toBe(0);
  });
});

describe("additionalFees", () => {
  it("computes registration, legal, mortgage", () => {
    const r = additionalFees(500000, "uk");
    expect(r.registration).toBeGreaterThan(0);
    expect(r.legal).toBeGreaterThan(0);
    expect(r.mortgage).toBeGreaterThan(0);
    expect(r.total).toBe(r.registration + r.legal + r.mortgage);
  });
  it("floors registration at minimum", () => {
    const r = additionalFees(5000, "uk");
    expect(r.registration).toBeGreaterThanOrEqual(100);
  });
});

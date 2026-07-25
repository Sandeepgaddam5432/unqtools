import { describe, it, expect } from "vitest";
import { calculateDiscountRate, salePriceFromDiscount, originalPriceFromDiscount, formatCurrency, formatPct, resultToCsv } from "./logic";

describe("calculateDiscountRate", () => {
  it("computes 20% discount", () => {
    const r = calculateDiscountRate({ originalPrice: 100, salePrice: 80 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.discountRate).toBe(20);
    expect(r.savings).toBe(20);
    expect(r.salePercent).toBe(80);
  });
  it("computes 50% discount", () => {
    const r = calculateDiscountRate({ originalPrice: 200, salePrice: 100 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.discountRate).toBe(50);
  });
  it("handles 0% discount", () => {
    const r = calculateDiscountRate({ originalPrice: 100, salePrice: 100 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.discountRate).toBe(0);
    expect(r.savings).toBe(0);
  });
  it("handles 100% discount", () => {
    const r = calculateDiscountRate({ originalPrice: 100, salePrice: 0 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.discountRate).toBe(100);
  });
  it("errors on zero original", () => {
    expect(calculateDiscountRate({ originalPrice: 0, salePrice: 0 })).toHaveProperty("error");
  });
  it("errors on sale > original", () => {
    expect(calculateDiscountRate({ originalPrice: 50, salePrice: 100 })).toHaveProperty("error");
  });
  it("errors on negative inputs", () => {
    expect(calculateDiscountRate({ originalPrice: -10, salePrice: 5 })).toHaveProperty("error");
  });
  it("computes priceFraction correctly", () => {
    const r = calculateDiscountRate({ originalPrice: 100, salePrice: 75 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.priceFraction).toBe(0.75);
  });
});

describe("salePriceFromDiscount", () => {
  it("computes sale from 20% off $100", () => {
    const r = salePriceFromDiscount(100, 20);
    if ("error" in r) throw new Error("Should not error");
    expect(r.salePrice).toBe(80);
    expect(r.savings).toBe(20);
  });
  it("handles 0% discount", () => {
    const r = salePriceFromDiscount(100, 0);
    if ("error" in r) throw new Error("Should not error");
    expect(r.salePrice).toBe(100);
  });
  it("handles 100% discount", () => {
    const r = salePriceFromDiscount(100, 100);
    if ("error" in r) throw new Error("Should not error");
    expect(r.salePrice).toBe(0);
  });
  it("errors on out-of-range discount", () => {
    expect(salePriceFromDiscount(100, 150)).toHaveProperty("error");
  });
});

describe("originalPriceFromDiscount", () => {
  it("computes original from sale + 20% off", () => {
    const r = originalPriceFromDiscount(80, 20);
    if ("error" in r) throw new Error("Should not error");
    expect(r.originalPrice).toBe(100);
  });
  it("errors on 100% discount", () => {
    expect(originalPriceFromDiscount(0, 100)).toHaveProperty("error");
  });
});

describe("formatCurrency", () => {
  it("formats USD", () => {
    expect(formatCurrency(1234.5)).toContain("1,234.50");
  });
});

describe("formatPct", () => {
  it("formats percentage", () => {
    expect(formatPct(20)).toBe("20.00%");
  });
});

describe("resultToCsv", () => {
  it("generates CSV with header", () => {
    const r = calculateDiscountRate({ originalPrice: 100, salePrice: 80 });
    if ("error" in r) throw new Error("Should not error");
    const csv = resultToCsv(r);
    expect(csv.split("\n")[0]).toBe("Metric,Value");
    expect(csv).toContain("Discount Rate,20%");
  });
});

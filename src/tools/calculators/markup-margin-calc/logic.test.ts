import { describe, it, expect } from "vitest";
import { calculateMarkupMargin, priceFromMarkup, costFromMargin, formatCurrency, formatPct, resultToCsv } from "./logic";

describe("calculateMarkupMargin", () => {
  it("computes markup and margin for cost=100, price=150", () => {
    const r = calculateMarkupMargin({ cost: 100, price: 150 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.profit).toBe(50);
    expect(r.markupPercent).toBe(50);
    expect(r.marginPercent).toBeCloseTo(33.33, 1);
    expect(r.markupMultiplier).toBe(1.5);
  });
  it("handles breakeven (price = cost)", () => {
    const r = calculateMarkupMargin({ cost: 100, price: 100 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.profit).toBe(0);
    expect(r.markupPercent).toBe(0);
    expect(r.marginPercent).toBe(0);
  });
  it("handles loss (price < cost)", () => {
    const r = calculateMarkupMargin({ cost: 100, price: 80 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.profit).toBe(-20);
    expect(r.markupPercent).toBe(-20);
    expect(r.marginPercent).toBe(-25);
  });
  it("errors on zero cost", () => {
    expect(calculateMarkupMargin({ cost: 0, price: 100 })).toHaveProperty("error");
  });
  it("errors on zero price", () => {
    expect(calculateMarkupMargin({ cost: 100, price: 0 })).toHaveProperty("error");
  });
  it("errors on negative cost", () => {
    expect(calculateMarkupMargin({ cost: -10, price: 100 })).toHaveProperty("error");
  });
  it("errors on non-finite input", () => {
    expect(calculateMarkupMargin({ cost: Number.NaN, price: 100 })).toHaveProperty("error");
  });
});

describe("priceFromMarkup", () => {
  it("computes price from 50% markup on $100 cost", () => {
    const r = priceFromMarkup(100, 50);
    if ("error" in r) throw new Error("Should not error");
    expect(r.price).toBe(150);
    expect(r.profit).toBe(50);
  });
  it("handles 0% markup", () => {
    const r = priceFromMarkup(100, 0);
    if ("error" in r) throw new Error("Should not error");
    expect(r.price).toBe(100);
  });
  it("errors on markup below -100%", () => {
    expect(priceFromMarkup(100, -150)).toHaveProperty("error");
  });
  it("errors on non-finite", () => {
    expect(priceFromMarkup(Number.NaN, 50)).toHaveProperty("error");
  });
});

describe("costFromMargin", () => {
  it("computes cost from 33.33% margin on $150 price", () => {
    const r = costFromMargin(150, 33.33);
    if ("error" in r) throw new Error("Should not error");
    expect(r.cost).toBeCloseTo(100, 1);
  });
  it("errors on margin >= 100%", () => {
    expect(costFromMargin(100, 100)).toHaveProperty("error");
  });
  it("errors on negative margin", () => {
    expect(costFromMargin(100, -10)).toHaveProperty("error");
  });
});

describe("formatCurrency", () => {
  it("formats USD", () => {
    expect(formatCurrency(1234.5)).toContain("1,234.50");
  });
});

describe("formatPct", () => {
  it("formats percentage", () => {
    expect(formatPct(33.33)).toBe("33.33%");
  });
});

describe("resultToCsv", () => {
  it("generates CSV with header", () => {
    const r = calculateMarkupMargin({ cost: 100, price: 150 });
    if ("error" in r) throw new Error("Should not error");
    const csv = resultToCsv(r);
    expect(csv.split("\n")[0]).toBe("Metric,Value");
    expect(csv).toContain("Markup %,50%");
  });
});

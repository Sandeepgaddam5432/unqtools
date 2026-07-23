/**
 * Discount Calculator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { calculateDiscount, findOriginalFromDiscounted, calculateBogo, applyThresholdCoupon, markupMarkdown, formatMoney, historyToCsv } from "./logic";

describe("calculateDiscount — single percent", () => {
  it("applies 20% off $100", () => {
    const r = calculateDiscount({ originalPrice: 100, discounts: [{ type: "percent", value: 20 }] });
    if ("error" in r) throw new Error("Should not error");
    expect(r.finalPrice).toBe(80);
    expect(r.totalSavings).toBe(20);
    expect(r.effectiveDiscountPct).toBe(20);
  });
  it("100% off makes price 0", () => {
    const r = calculateDiscount({ originalPrice: 100, discounts: [{ type: "percent", value: 100 }] });
    if ("error" in r) throw new Error("Should not error");
    expect(r.finalPrice).toBe(0);
  });
  it("errors on negative percent", () => {
    expect("error" in calculateDiscount({ originalPrice: 100, discounts: [{ type: "percent", value: -10 }] })).toBe(true);
  });
  it("errors on percent > 100", () => {
    expect("error" in calculateDiscount({ originalPrice: 100, discounts: [{ type: "percent", value: 150 }] })).toBe(true);
  });
});

describe("calculateDiscount — single fixed", () => {
  it("applies $15 off $50", () => {
    const r = calculateDiscount({ originalPrice: 50, discounts: [{ type: "fixed", value: 15 }] });
    if ("error" in r) throw new Error("Should not error");
    expect(r.finalPrice).toBe(35);
  });
  it("fixed discount clamps to 0 if exceeds price", () => {
    const r = calculateDiscount({ originalPrice: 30, discounts: [{ type: "fixed", value: 50 }] });
    if ("error" in r) throw new Error("Should not error");
    expect(r.finalPrice).toBe(0);
  });
});

describe("calculateDiscount — stacked", () => {
  it("applies 20% then 10% sequentially", () => {
    const r = calculateDiscount({ originalPrice: 100, discounts: [{ type: "percent", value: 20 }, { type: "percent", value: 10 }] });
    if ("error" in r) throw new Error("Should not error");
    // 100 → 80 → 72
    expect(r.finalPrice).toBe(72);
    expect(r.totalSavings).toBe(28);
    expect(r.steps.length).toBe(2);
  });
  it("errors on more than 5 discounts", () => {
    const tooMany = Array(6).fill({ type: "percent", value: 5 });
    expect("error" in calculateDiscount({ originalPrice: 100, discounts: tooMany })).toBe(true);
  });
});

describe("calculateDiscount — with tax", () => {
  it("applies tax on discounted price", () => {
    const r = calculateDiscount({ originalPrice: 100, discounts: [{ type: "percent", value: 20 }], taxPercent: 10 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.finalPrice).toBe(80);
    expect(r.taxAmount).toBe(8);
    expect(r.grandTotal).toBe(88);
  });
  it("tax on original scales proportionally when taxOnOriginal", () => {
    const r = calculateDiscount({ originalPrice: 100, discounts: [{ type: "percent", value: 50 }], taxPercent: 10, taxOnOriginal: true });
    if ("error" in r) throw new Error("Should not error");
    // Original tax 10, ratio 50/100=0.5, so tax = 5
    expect(r.taxAmount).toBe(5);
    expect(r.grandTotal).toBe(55);
  });
});

describe("findOriginalFromDiscounted", () => {
  it("reverse calculates original", () => {
    // Final 80 after 20% off → original = 100
    const r = findOriginalFromDiscounted(80, 20);
    if ("error" in r) throw new Error("Should not error");
    expect(r.originalPrice).toBe(100);
    expect(r.savings).toBe(20);
  });
  it("errors on 100% discount", () => {
    expect("error" in findOriginalFromDiscounted(80, 100)).toBe(true);
  });
});

describe("calculateBogo", () => {
  it("buy 2 get 1 free for quantity 3", () => {
    const r = calculateBogo({ unitPrice: 10, quantity: 3, buyCount: 2, freeCount: 1 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.paidUnits).toBe(2);
    expect(r.freeUnits).toBe(1);
    expect(r.totalPaid).toBe(20);
    expect(r.totalSaved).toBe(10);
  });
  it("buy 1 get 1 free for quantity 5", () => {
    const r = calculateBogo({ unitPrice: 10, quantity: 5, buyCount: 1, freeCount: 1 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.paidUnits).toBe(3);
    expect(r.freeUnits).toBe(2);
  });
  it("no free units if quantity < cycle", () => {
    const r = calculateBogo({ unitPrice: 10, quantity: 2, buyCount: 3, freeCount: 1 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.freeUnits).toBe(0);
    expect(r.paidUnits).toBe(2);
  });
  it("errors on invalid quantity", () => {
    expect("error" in calculateBogo({ unitPrice: 10, quantity: 1.5, buyCount: 1, freeCount: 1 })).toBe(true);
  });
});

describe("applyThresholdCoupon", () => {
  it("applies coupon when threshold met", () => {
    const r = applyThresholdCoupon(60, 10, 50);
    if ("error" in r) throw new Error("Should not error");
    expect(r.couponApplied).toBe(true);
    expect(r.discounted).toBe(50);
  });
  it("does not apply when threshold not met", () => {
    const r = applyThresholdCoupon(40, 10, 50);
    if ("error" in r) throw new Error("Should not error");
    expect(r.couponApplied).toBe(false);
    expect(r.discounted).toBe(40);
  });
});

describe("markupMarkdown", () => {
  it("marks up by 25%", () => {
    const r = markupMarkdown(100, 25, "markup");
    if ("error" in r) throw new Error("Should not error");
    expect(r.finalPrice).toBe(125);
  });
  it("marks down by 25%", () => {
    const r = markupMarkdown(100, 25, "markdown");
    if ("error" in r) throw new Error("Should not error");
    expect(r.finalPrice).toBe(75);
  });
});

describe("formatMoney", () => {
  it("formats USD", () => { expect(formatMoney(50.5, "USD")).toContain("50.50"); });
});

describe("historyToCsv", () => {
  it("generates CSV", () => {
    const csv = historyToCsv([{ ts: 1700000000000, original: 100, final: 80, savings: 20, discounts: "20% off" }]);
    expect(csv).toContain("OriginalPrice");
    expect(csv).toContain("20");
  });
});

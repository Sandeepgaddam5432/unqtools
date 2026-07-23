/**
 * Tip Calculator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { calculateTip, suggestTipPercent, compareTips, formatMoney, historyToCsv } from "./logic";

describe("calculateTip — basic", () => {
  it("computes 18% tip on $50", () => {
    const r = calculateTip({ subtotal: 50, tipPercent: 18 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.tipAmount).toBe(9);
    expect(r.grandTotal).toBe(59);
    expect(r.taxAmount).toBe(0);
  });
  it("errors on negative subtotal", () => {
    expect("error" in calculateTip({ subtotal: -10, tipPercent: 15 })).toBe(true);
  });
  it("errors on negative tip percent", () => {
    expect("error" in calculateTip({ subtotal: 50, tipPercent: -5 })).toBe(true);
  });
  it("errors on unrealistic tip percent", () => {
    expect("error" in calculateTip({ subtotal: 50, tipPercent: 250 })).toBe(true);
  });
  it("errors on invalid split count", () => {
    expect("error" in calculateTip({ subtotal: 50, tipPercent: 15, splitCount: 0 })).toBe(true);
    expect("error" in calculateTip({ subtotal: 50, tipPercent: 15, splitCount: 1.5 })).toBe(true);
  });
});

describe("calculateTip — tax + tip on tax", () => {
  it("computes tax separately", () => {
    const r = calculateTip({ subtotal: 100, tipPercent: 20, taxPercent: 8.5 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.taxAmount).toBe(8.5);
    expect(r.tipAmount).toBe(20); // tip on subtotal only
    expect(r.grandTotal).toBe(128.5);
  });
  it("tips on subtotal+tax when tipOnTax=true", () => {
    const r = calculateTip({ subtotal: 100, tipPercent: 20, taxPercent: 8.5, tipOnTax: true });
    if ("error" in r) throw new Error("Should not error");
    // tip on 108.5 = 21.7
    expect(r.tipAmount).toBe(21.7);
  });
});

describe("calculateTip — split", () => {
  it("splits between 4 people", () => {
    const r = calculateTip({ subtotal: 100, tipPercent: 20, splitCount: 4 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.perPerson.subtotal).toBe(25);
    expect(r.perPerson.tip).toBe(5);
    expect(r.perPerson.total).toBe(30);
  });
});

describe("calculateTip — rounding", () => {
  it("rounds up to nearest dollar", () => {
    const r = calculateTip({ subtotal: 47.5, tipPercent: 18, rounding: "up", roundingIncrement: 1 });
    if ("error" in r) throw new Error("Should not error");
    // 47.5 + 8.55 = 56.05 → round up to 57
    expect(r.grandTotal).toBe(57);
    expect(r.roundingDelta).toBeGreaterThan(0);
  });
  it("rounds down to nearest dollar", () => {
    const r = calculateTip({ subtotal: 47.5, tipPercent: 18, rounding: "down", roundingIncrement: 1 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.grandTotal).toBe(56);
    expect(r.roundingDelta).toBeLessThan(0);
  });
  it("rounds to nearest quarter", () => {
    const r = calculateTip({ subtotal: 10, tipPercent: 18, rounding: "nearest", roundingIncrement: 0.25 });
    if ("error" in r) throw new Error("Should not error");
    // 10 + 1.8 = 11.8 → nearest quarter = 11.75
    expect(r.grandTotal).toBe(11.75);
  });
  it("computes effective tip percent after rounding", () => {
    const r = calculateTip({ subtotal: 47.5, tipPercent: 18, rounding: "up", roundingIncrement: 1 });
    if ("error" in r) throw new Error("Should not error");
    // effective = (8.55 + 0.95) / 47.5 * 100 ≈ 20%
    expect(r.effectiveTipPercent).toBeGreaterThan(18);
  });
});

describe("suggestTipPercent", () => {
  it("suggests 10% for poor service", () => {
    expect(suggestTipPercent("poor").percent).toBe(10);
  });
  it("suggests 22% for excellent service", () => {
    expect(suggestTipPercent("excellent").percent).toBe(22);
  });
  it("always returns a reason string", () => {
    expect(suggestTipPercent("ok").reason).toBeTruthy();
    expect(suggestTipPercent("good").reason).toBeTruthy();
  });
});

describe("compareTips", () => {
  it("returns 3 tip levels side-by-side", () => {
    const c = compareTips(100, [10, 15, 20]);
    expect(c.length).toBe(3);
    expect(c[0]!.tip).toBe(10);
    expect(c[2]!.total).toBe(120);
  });
});

describe("formatMoney", () => {
  it("formats USD", () => {
    expect(formatMoney(50, "USD")).toContain("50");
  });
  it("formats INR", () => {
    const s = formatMoney(1000, "INR", "en-IN");
    expect(s).toContain("1,000");
  });
  it("falls back gracefully for invalid currency", () => {
    const s = formatMoney(50, "INVALID");
    expect(s).toContain("50");
  });
});

describe("historyToCsv", () => {
  it("generates CSV with header", () => {
    const csv = historyToCsv([{ ts: 1700000000000, subtotal: 50, tipPercent: 18, tip: 9, total: 59, split: 1 }]);
    expect(csv.split("\n")[0]).toContain("Subtotal");
    expect(csv.split("\n")[1]).toContain("18");
  });
});

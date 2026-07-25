import { describe, it, expect } from "vitest";
import {
  calculateMarkup,
  markupFromTargetPrice,
  markupToMargin,
  marginToMarkup,
  formatMoney,
  defaultInput,
} from "./logic";

describe("markup-calc-adv calculateMarkup", () => {
  it("computes basic markup", () => {
    const r = calculateMarkup({ cost: 100, markupPercent: 50, taxPercent: 0, discountPercent: 0 });
    expect(r.isValid).toBe(true);
    expect(r.markupAmount).toBeCloseTo(50, 2);
    expect(r.preTaxPrice).toBeCloseTo(150, 2);
    expect(r.finalPrice).toBeCloseTo(150, 2);
  });

  it("applies tax correctly", () => {
    const r = calculateMarkup({ cost: 100, markupPercent: 50, taxPercent: 10, discountPercent: 0 });
    expect(r.taxAmount).toBeCloseTo(15, 2);
    expect(r.finalPrice).toBeCloseTo(165, 2);
  });

  it("applies discount before tax", () => {
    const r = calculateMarkup({ cost: 100, markupPercent: 50, taxPercent: 10, discountPercent: 20 });
    // preTax = 150, discounted = 120, tax = 12, final = 132
    expect(r.discountAmount).toBeCloseTo(30, 2);
    expect(r.discountedPrice).toBeCloseTo(120, 2);
    expect(r.taxAmount).toBeCloseTo(12, 2);
    expect(r.finalPrice).toBeCloseTo(132, 2);
  });

  it("computes gross margin", () => {
    const r = calculateMarkup({ cost: 100, markupPercent: 100, taxPercent: 0, discountPercent: 0 });
    // price = 200, margin = (200-100)/200 = 50%
    expect(r.grossMarginPercent).toBeCloseTo(50, 2);
  });

  it("computes profit", () => {
    const r = calculateMarkup({ cost: 50, markupPercent: 100, taxPercent: 0, discountPercent: 0 });
    expect(r.profit).toBeCloseTo(50, 2);
  });

  it("rejects negative cost", () => {
    const r = calculateMarkup({ cost: -10, markupPercent: 50, taxPercent: 0, discountPercent: 0 });
    expect(r.isValid).toBe(false);
  });

  it("rejects tax > 100", () => {
    const r = calculateMarkup({ cost: 100, markupPercent: 50, taxPercent: 150, discountPercent: 0 });
    expect(r.isValid).toBe(false);
  });

  it("rejects discount > 100", () => {
    const r = calculateMarkup({ cost: 100, markupPercent: 50, taxPercent: 0, discountPercent: 150 });
    expect(r.isValid).toBe(false);
  });
});

describe("markup-calc-adv markupFromTargetPrice", () => {
  it("computes required markup", () => {
    expect(markupFromTargetPrice(100, 150)).toBeCloseTo(50, 2);
  });

  it("returns 0 for non-positive cost", () => {
    expect(markupFromTargetPrice(0, 100)).toBe(0);
  });
});

describe("markup-calc-adv markupToMargin / marginToMarkup", () => {
  it("markup 100% → margin 50%", () => {
    expect(markupToMargin(100)).toBeCloseTo(50, 2);
  });

  it("markup 50% → margin 33.33%", () => {
    expect(markupToMargin(50)).toBeCloseTo(33.33, 1);
  });

  it("round-trips", () => {
    const markup = 75;
    const margin = markupToMargin(markup);
    expect(marginToMarkup(margin)).toBeCloseTo(markup, 2);
  });

  it("margin 50% → markup 100%", () => {
    expect(marginToMarkup(50)).toBeCloseTo(100, 2);
  });

  it("margin 100% → Infinity", () => {
    expect(marginToMarkup(100)).toBe(Infinity);
  });
});

describe("markup-calc-adv formatMoney", () => {
  it("formats as USD", () => {
    expect(formatMoney(12.5)).toBe("$12.50");
  });

  it("handles non-finite values", () => {
    expect(formatMoney(Infinity)).toBe("—");
  });
});

describe("markup-calc-adv defaultInput", () => {
  it("returns sensible defaults", () => {
    const d = defaultInput();
    expect(d.cost).toBe(100);
    expect(d.markupPercent).toBeGreaterThan(0);
  });
});

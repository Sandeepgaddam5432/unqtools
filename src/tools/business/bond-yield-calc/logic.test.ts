import { describe, it, expect } from "vitest";
import {
  calcCurrentYield, calcBondPrice, calcYTM, planBond, planBatch, renderBatchCsv, renderReport,
  getBondPresets, formatCurrency, formatPct, macaulayDuration, modifiedDuration,
} from "./logic";

describe("bond-yield-calc calcCurrentYield", () => {
  it("returns annualCoupon / marketPrice", () => {
    expect(calcCurrentYield(50, 1000)).toBe(0.05);
  });
  it("returns 0 for non-positive price", () => {
    expect(calcCurrentYield(50, 0)).toBe(0);
  });
});

describe("bond-yield-calc calcBondPrice", () => {
  it("returns par + total coupons when ytm is 0", () => {
    expect(calcBondPrice(1000, 50, 0, 10)).toBe(1500);
  });
  it("returns par when coupon = ytm * par", () => {
    // 5% coupon, 5% ytm, 10 periods → price = par
    const price = calcBondPrice(1000, 50, 0.05, 10);
    expect(price).toBeCloseTo(1000, 0);
  });
  it("returns > par when coupon > ytm", () => {
    // 5% coupon, 4% ytm → premium
    const price = calcBondPrice(1000, 50, 0.04, 10);
    expect(price).toBeGreaterThan(1000);
  });
});

describe("bond-yield-calc calcYTM", () => {
  it("returns 0 for non-positive price", () => {
    expect(calcYTM(1000, 50, 0, 10)).toBe(0);
  });
  it("inverts calcBondPrice", () => {
    const price = calcBondPrice(1000, 50, 0.05, 10);
    const ytm = calcYTM(1000, 50, price, 10);
    expect(ytm).toBeCloseTo(0.05, 4);
  });
  it("returns higher YTM for discount bond", () => {
    const ytmPar = calcYTM(1000, 50, 1000, 10);
    const ytmDiscount = calcYTM(1000, 50, 900, 10);
    expect(ytmDiscount).toBeGreaterThan(ytmPar);
  });
});

describe("bond-yield-calc planBond", () => {
  it("computes current yield and YTM", () => {
    const r = planBond({ parValue: 1000, couponRate: 0.05, yearsToMaturity: 10, marketPrice: 95, priceIsPercent: true, frequency: 2 });
    expect(r.currentYield).toBeCloseTo(0.0526, 3);
    expect(r.ytm).toBeGreaterThan(0.05);
  });
  it("identifies discount bond", () => {
    const r = planBond({ parValue: 1000, couponRate: 0.05, yearsToMaturity: 10, marketPrice: 95, priceIsPercent: true, frequency: 2 });
    expect(r.tradingStatus).toBe("discount");
    expect(r.notes.some((n) => n.includes("discount"))).toBe(true);
  });
  it("identifies premium bond", () => {
    const r = planBond({ parValue: 1000, couponRate: 0.06, yearsToMaturity: 10, marketPrice: 105, priceIsPercent: true, frequency: 2 });
    expect(r.tradingStatus).toBe("premium");
  });
  it("identifies par bond", () => {
    const r = planBond({ parValue: 1000, couponRate: 0.05, yearsToMaturity: 10, marketPrice: 100, priceIsPercent: true, frequency: 2 });
    expect(r.tradingStatus).toBe("par");
  });
  it("computes absolute price from percent", () => {
    const r = planBond({ parValue: 1000, couponRate: 0.05, yearsToMaturity: 10, marketPrice: 95, priceIsPercent: true, frequency: 2 });
    expect(r.marketPriceDollars).toBe(950);
  });
  it("computes absolute price directly", () => {
    const r = planBond({ parValue: 1000, couponRate: 0.05, yearsToMaturity: 10, marketPrice: 950, priceIsPercent: false, frequency: 2 });
    expect(r.marketPriceDollars).toBe(950);
  });
  it("builds yield curve", () => {
    const r = planBond({ parValue: 1000, couponRate: 0.05, yearsToMaturity: 10, marketPrice: 100, priceIsPercent: true, frequency: 2 });
    expect(r.yieldCurve.length).toBeGreaterThan(0);
    expect(r.yieldCurve[0].price).toBeLessThan(r.yieldCurve[r.yieldCurve.length - 1].price);
  });
  it("warns on bad inputs", () => {
    const r = planBond({ parValue: -100, couponRate: 0.05, yearsToMaturity: 10, marketPrice: 100, priceIsPercent: true, frequency: 2 });
    expect(r.warnings.some((w) => w.includes("Par value"))).toBe(true);
  });
});

describe("bond-yield-calc planBatch / renderBatchCsv", () => {
  it("plans batch", () => {
    const rs = planBatch([
      { parValue: 1000, couponRate: 0.05, yearsToMaturity: 10, marketPrice: 95, priceIsPercent: true, frequency: 2 as const },
      { parValue: 1000, couponRate: 0.04, yearsToMaturity: 5, marketPrice: 1050, priceIsPercent: false, frequency: 2 as const },
    ]);
    expect(rs.length).toBe(2);
  });
  it("renders CSV", () => {
    const csv = renderBatchCsv(planBatch([
      { parValue: 1000, couponRate: 0.05, yearsToMaturity: 10, marketPrice: 95, priceIsPercent: true, frequency: 2 as const },
    ]));
    expect(csv.split("\n")[0]).toContain("index,market_price");
  });
});

describe("bond-yield-calc renderReport", () => {
  it("renders report", () => {
    const r = renderReport(planBond({ parValue: 1000, couponRate: 0.05, yearsToMaturity: 10, marketPrice: 95, priceIsPercent: true, frequency: 2 }));
    expect(r).toContain("Bond Yield Report");
    expect(r).toContain("Current yield");
    expect(r).toContain("Yield to maturity");
  });
});

describe("bond-yield-calc getBondPresets", () => {
  it("returns 4 presets", () => {
    expect(getBondPresets().length).toBe(4);
  });
});

describe("bond-yield-calc formatCurrency / formatPct", () => {
  it("formats USD", () => {
    expect(formatCurrency(1234.567)).toMatch(/\$1,234\.57/);
  });
  it("formats percent with 3 decimals", () => {
    expect(formatPct(0.0526)).toBe("5.260%");
    expect(formatPct(NaN)).toBe("—");
  });
});

describe("bond-yield-calc macaulayDuration", () => {
  it("returns positive duration", () => {
    const d = macaulayDuration(1000, 50, 0.05, 10, 2);
    expect(d).toBeGreaterThan(0);
  });
  it("returns (n+1)/2/freq when ytm is 0", () => {
    const d = macaulayDuration(1000, 50, 0, 10, 2);
    expect(d).toBeCloseTo((11 / 2) / 2, 5);
  });
});

describe("bond-yield-calc modifiedDuration", () => {
  it("returns macaulay / (1 + ytm/freq)", () => {
    const mac = 5;
    const md = modifiedDuration(mac, 0.025, 2); // ytm 5% annual, 2 periods
    expect(md).toBeCloseTo(5 / (1 + 0.025), 4);
  });
  it("returns macaulay when ytm is 0", () => {
    expect(modifiedDuration(5, 0, 2)).toBe(5);
  });
});

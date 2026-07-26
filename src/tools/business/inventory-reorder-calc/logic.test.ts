import { describe, it, expect } from "vitest";
import {
  leadTimeDemand,
  safetyStock,
  reorderPoint,
  economicOrderQuantity,
  computeReorder,
  normCdfTail,
  validateInputs,
  zScoreFromServiceLevel,
  exportReorderCSV,
  exportReorderText,
  shouldReorder,
  forecastStockoutDay,
  sensitivityAnalysis,
  annualFromDaily,
  totalCostForQ,
  type ReorderInputs,
} from "./logic";

const baseInputs: ReorderInputs = {
  avgDailyDemand: 20,
  leadTimeDays: 7,
  zScore: 1.65,
  demandStdDev: 5,
  unitCost: 10,
  orderingCost: 50,
  holdingCostRate: 0.2,
  annualDemand: 7300,
  currentStock: 200,
};

describe("inventory-reorder-calc leadTimeDemand", () => {
  it("multiplies demand × lead time", () => {
    expect(leadTimeDemand(20, 7)).toBe(140);
  });
});

describe("inventory-reorder-calc safetyStock", () => {
  it("applies z × σ × √LT", () => {
    // 1.65 × 5 × √7 ≈ 21.84
    expect(safetyStock(1.65, 5, 7)).toBeCloseTo(21.84, 1);
  });
  it("returns 0 for zero std dev", () => {
    expect(safetyStock(1.65, 0, 7)).toBe(0);
  });
});

describe("inventory-reorder-calc reorderPoint", () => {
  it("sums lead time demand and safety stock", () => {
    const rop = reorderPoint(20, 7, 1.65, 5);
    expect(rop).toBeCloseTo(140 + 21.84, 1);
  });
});

describe("inventory-reorder-calc economicOrderQuantity", () => {
  it("applies EOQ formula", () => {
    // √(2 × 7300 × 50 / (10 × 0.2)) = √(730000 / 2) = √365000 ≈ 604.15
    expect(economicOrderQuantity(7300, 50, 10, 0.2)).toBeCloseTo(604.15, 1);
  });
  it("returns 0 when holding rate is 0", () => {
    expect(economicOrderQuantity(7300, 50, 10, 0)).toBe(0);
  });
});

describe("inventory-reorder-calc computeReorder", () => {
  it("returns all expected fields", () => {
    const r = computeReorder(baseInputs);
    expect(r.leadTimeDemand).toBe(140);
    expect(r.safetyStock).toBeGreaterThan(0);
    expect(r.reorderPoint).toBeGreaterThan(r.leadTimeDemand);
    expect(r.eoq).toBeGreaterThan(0);
    expect(r.totalInventoryCost).toBeGreaterThan(0);
  });
  it("total cost = holding + ordering", () => {
    const r = computeReorder(baseInputs);
    expect(r.totalInventoryCost).toBeCloseTo(r.annualHoldingCost + r.annualOrderingCost, 2);
  });
  it("optimal orders per year = annual demand / EOQ", () => {
    const r = computeReorder(baseInputs);
    expect(r.optimalOrdersPerYear).toBeCloseTo(baseInputs.annualDemand / r.eoq, 2);
  });
});

describe("inventory-reorder-calc normCdfTail", () => {
  it("returns ~5% for z=1.65", () => {
    expect(normCdfTail(1.65)).toBeCloseTo(0.05, 1);
  });
  it("returns ~1% for z=2.33", () => {
    expect(normCdfTail(2.33)).toBeCloseTo(0.01, 1);
  });
  it("returns 0.5 for z=0", () => {
    expect(normCdfTail(0)).toBeCloseTo(0.5, 1);
  });
});

describe("inventory-reorder-calc validateInputs", () => {
  it("warns on zero demand", () => {
    expect(validateInputs({ ...baseInputs, avgDailyDemand: 0 }).some((w) => w.includes("demand"))).toBe(true);
  });
  it("warns on invalid holding rate", () => {
    expect(validateInputs({ ...baseInputs, holdingCostRate: 1.5 }).some((w) => w.includes("Holding"))).toBe(true);
  });
  it("warns on negative current stock", () => {
    expect(validateInputs({ ...baseInputs, currentStock: -10 }).some((w) => w.includes("stock"))).toBe(true);
  });
  it("passes for valid inputs", () => {
    expect(validateInputs(baseInputs)).toEqual([]);
  });
});

describe("inventory-reorder-calc zScoreFromServiceLevel", () => {
  it("returns 1.65 for 95%", () => {
    expect(zScoreFromServiceLevel(95)).toBeCloseTo(1.65, 2);
  });
  it("returns 2.33 for 99%", () => {
    expect(zScoreFromServiceLevel(99)).toBeCloseTo(2.33, 2);
  });
  it("interpolates for unknown service level", () => {
    const z = zScoreFromServiceLevel(97);
    expect(z).toBeGreaterThan(1.65);
    expect(z).toBeLessThan(2.33);
  });
});

describe("inventory-reorder-calc exportReorderCSV", () => {
  it("has header plus rows", () => {
    const csv = exportReorderCSV(computeReorder(baseInputs));
    const lines = csv.split("\n");
    expect(lines.length).toBeGreaterThan(5);
    expect(lines[0]).toContain("metric,value");
  });
});

describe("inventory-reorder-calc exportReorderText", () => {
  it("includes reorder point", () => {
    const txt = exportReorderText(computeReorder(baseInputs));
    expect(txt).toContain("Reorder point:");
    expect(txt).toContain("EOQ:");
  });
});

describe("inventory-reorder-calc shouldReorder", () => {
  it("returns true when stock <= ROP", () => {
    expect(shouldReorder(100, 150)).toBe(true);
  });
  it("returns false when stock > ROP", () => {
    expect(shouldReorder(200, 150)).toBe(false);
  });
});

describe("inventory-reorder-calc forecastStockoutDay", () => {
  it("returns positive day when stock exceeds lead time demand", () => {
    expect(forecastStockoutDay(300, 20, 140)).toBe(Math.floor((300 - 140) / 20));
  });
  it("returns Infinity when demand is 0", () => {
    expect(forecastStockoutDay(300, 0, 140)).toBe(Infinity);
  });
});

describe("inventory-reorder-calc sensitivityAnalysis", () => {
  it("returns 3 scenarios", () => {
    const s = sensitivityAnalysis(baseInputs);
    expect(s.length).toBe(3);
    expect(s[0].scenario).toContain("−20%");
  });
  it("ROP scales with demand", () => {
    const s = sensitivityAnalysis(baseInputs);
    expect(s[2].rop).toBeGreaterThan(s[1].rop);
  });
});

describe("inventory-reorder-calc annualFromDaily", () => {
  it("multiplies daily demand by days open", () => {
    expect(annualFromDaily(20, 365)).toBe(7300);
  });
});

describe("inventory-reorder-calc totalCostForQ", () => {
  it("returns higher cost for non-EOQ quantities", () => {
    const eoq = economicOrderQuantity(7300, 50, 10, 0.2);
    const optimalCost = totalCostForQ(eoq, 7300, 50, 10, 0.2);
    const otherCost = totalCostForQ(eoq * 2, 7300, 50, 10, 0.2);
    expect(otherCost).toBeGreaterThan(optimalCost);
  });
});

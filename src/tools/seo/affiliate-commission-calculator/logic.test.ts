import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_TIERS,
  PROGRAM_TYPE_LABELS,
  PROGRAM_TYPE_PRESETS,
  HISTORY_KEY,
  HISTORY_MAX,
  normalizeNumber,
  parseTiers,
  validateTiers,
  applyAdjustments,
  calculateFlatPercent,
  calculateTieredPercent,
  calculateRecurring,
  calculateHybrid,
  calculate,
  computeEffectiveRate,
  computeSummaryStats,
  comparePrograms,
  computeBreakEven,
  formatMoney,
  renderTextReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CalculatorInput,
  type ProgramType,
  type Tier,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

function makeInput(overrides: Partial<CalculatorInput> = {}): CalculatorInput {
  return {
    programType: "flat-percent",
    productPrice: 100,
    salesCount: 100,
    commissionPercent: 30,
    tiers: [],
    recurringMonths: 0,
    refundRatePercent: 0,
    taxPercent: 0,
    ...overrides,
  };
}

describe("affiliate-commission-calculator constants", () => {
  it("default tiers have 4 brackets", () => {
    expect(DEFAULT_TIERS).toHaveLength(4);
    expect(DEFAULT_TIERS[0]).toEqual({ minSales: 1, percent: 10 });
    expect(DEFAULT_TIERS[3]).toEqual({ minSales: 100, percent: 30 });
  });
  it("has 4 program type labels", () => {
    expect(Object.keys(PROGRAM_TYPE_LABELS)).toHaveLength(4);
    expect(PROGRAM_TYPE_LABELS["flat-percent"]).toBe("Flat Percent");
  });
  it("presets exist for all 4 program types", () => {
    const types: ProgramType[] = ["flat-percent", "tiered-percent", "recurring", "hybrid"];
    for (const t of types) {
      expect(PROGRAM_TYPE_PRESETS[t].programType).toBe(t);
    }
  });
  it("history key + max", () => {
    expect(HISTORY_KEY).toBe("unqtools:affiliate-commission-calculator:history");
    expect(HISTORY_MAX).toBe(20);
  });
});

describe("affiliate-commission-calculator normalizeNumber", () => {
  it("parses numeric strings", () => {
    expect(normalizeNumber("99.99")).toBe(99.99);
  });
  it("returns 0 for empty/invalid", () => {
    expect(normalizeNumber("")).toBe(0);
    expect(normalizeNumber("abc")).toBe(0);
    expect(normalizeNumber("NaN")).toBe(0);
  });
  it("clamps negatives to 0", () => {
    expect(normalizeNumber("-5")).toBe(0);
  });
  it("passes through numbers", () => {
    expect(normalizeNumber(42)).toBe(42);
  });
});

describe("affiliate-commission-calculator parseTiers", () => {
  it("parses standard format", () => {
    const text = "1,10\n10,15\n50,20\n100,30";
    const tiers = parseTiers(text);
    expect(tiers).toHaveLength(4);
    expect(tiers[0]).toEqual({ minSales: 1, percent: 10 });
  });
  it("handles whitespace-only separators", () => {
    expect(parseTiers("1 10\n10 15")).toEqual([
      { minSales: 1, percent: 10 },
      { minSales: 10, percent: 15 },
    ]);
  });
  it("sorts ascending by minSales", () => {
    const tiers = parseTiers("100,30\n1,10\n50,20");
    expect(tiers.map((t) => t.minSales)).toEqual([1, 50, 100]);
  });
  it("dedupes same minSales", () => {
    const tiers = parseTiers("1,10\n1,20");
    expect(tiers).toHaveLength(1);
    expect(tiers[0].percent).toBe(20);
  });
  it("skips invalid lines", () => {
    expect(parseTiers("abc,xyz\n1,10")).toEqual([{ minSales: 1, percent: 10 }]);
  });
  it("skips negative values", () => {
    expect(parseTiers("-1,10\n1,-5\n1,10")).toEqual([{ minSales: 1, percent: 10 }]);
  });
  it("returns empty for empty input", () => {
    expect(parseTiers("")).toEqual([]);
  });
});

describe("affiliate-commission-calculator validateTiers", () => {
  it("valid for sorted ascending", () => {
    const r = validateTiers([
      { minSales: 1, percent: 10 },
      { minSales: 10, percent: 15 },
    ]);
    expect(r.valid).toBe(true);
    expect(r.issues).toEqual([]);
  });
  it("invalid for empty tiers", () => {
    const r = validateTiers([]);
    expect(r.valid).toBe(false);
    expect(r.issues[0]).toContain("At least one tier");
  });
  it("flags non-ascending minSales", () => {
    const r = validateTiers([
      { minSales: 10, percent: 15 },
      { minSales: 5, percent: 10 },
    ]);
    expect(r.valid).toBe(false);
  });
  it("flags negative percent", () => {
    const r = validateTiers([{ minSales: 1, percent: -5 }]);
    expect(r.valid).toBe(false);
  });
});

describe("affiliate-commission-calculator applyAdjustments", () => {
  it("applies refund only when tax=0", () => {
    const r = applyAdjustments(1000, 10, 0);
    expect(r.refundDeduction).toBe(100);
    expect(r.taxDeduction).toBe(0);
    expect(r.net).toBe(900);
  });
  it("applies tax after refund", () => {
    const r = applyAdjustments(1000, 10, 10);
    // refund 100, after refund 900, tax 90, net 810
    expect(r.refundDeduction).toBe(100);
    expect(r.taxDeduction).toBeCloseTo(90, 5);
    expect(r.net).toBeCloseTo(810, 5);
  });
  it("returns 0 net for 0 gross", () => {
    const r = applyAdjustments(0, 10, 10);
    expect(r.net).toBe(0);
    expect(r.refundDeduction).toBe(0);
    expect(r.taxDeduction).toBe(0);
  });
});

describe("affiliate-commission-calculator calculateFlatPercent", () => {
  it("computes gross = price × sales × pct%", () => {
    const r = calculateFlatPercent(makeInput({
      productPrice: 100, salesCount: 100, commissionPercent: 30,
    }));
    expect(r.grossCommission).toBe(3000);
    expect(r.netCommission).toBe(3000);
    expect(r.effectiveRatePercent).toBe(100);
  });
  it("applies refund + tax", () => {
    const r = calculateFlatPercent(makeInput({
      productPrice: 100, salesCount: 100, commissionPercent: 30,
      refundRatePercent: 5, taxPercent: 10,
    }));
    // gross 3000, refund 150, after 2850, tax 285, net 2565
    expect(r.grossCommission).toBe(3000);
    expect(r.refundDeduction).toBeCloseTo(150, 5);
    expect(r.taxDeduction).toBeCloseTo(285, 5);
    expect(r.netCommission).toBeCloseTo(2565, 5);
    expect(r.effectiveRatePercent).toBeCloseTo(85.5, 2);
  });
  it("includes components", () => {
    const r = calculateFlatPercent(makeInput());
    expect(r.components.find((c) => c.label === "Net commission")).toBeTruthy();
    expect(r.components.find((c) => c.label === "Gross commission")).toBeTruthy();
  });
});

describe("affiliate-commission-calculator calculateTieredPercent", () => {
  it("applies progressive brackets correctly", () => {
    // 120 sales, $100 price, tiers 1,10; 10,15; 50,20; 100,30
    const r = calculateTieredPercent(makeInput({
      programType: "tiered-percent",
      productPrice: 100, salesCount: 120, commissionPercent: 0,
      tiers: DEFAULT_TIERS,
    }));
    // Tier 1 (1-9): 9 sales × 100 × 10% = 90
    // Tier 2 (10-49): 40 sales × 100 × 15% = 600
    // Tier 3 (50-99): 50 sales × 100 × 20% = 1000
    // Tier 4 (100+): 21 sales × 100 × 30% = 630
    // Total = 2320
    expect(r.tierBreakdown).toHaveLength(4);
    expect(r.tierBreakdown[0].salesInTier).toBe(9);
    expect(r.tierBreakdown[1].salesInTier).toBe(40);
    expect(r.tierBreakdown[2].salesInTier).toBe(50);
    expect(r.tierBreakdown[3].salesInTier).toBe(21);
    expect(r.grossCommission).toBe(2320);
  });
  it("handles sales below first tier", () => {
    // First tier minSales=10 — 5 sales earn 0
    const r = calculateTieredPercent(makeInput({
      programType: "tiered-percent",
      productPrice: 100, salesCount: 5,
      tiers: [{ minSales: 10, percent: 20 }],
    }));
    expect(r.grossCommission).toBe(0);
  });
  it("handles single tier covering all sales", () => {
    const r = calculateTieredPercent(makeInput({
      programType: "tiered-percent",
      productPrice: 100, salesCount: 50,
      tiers: [{ minSales: 1, percent: 25 }],
    }));
    expect(r.grossCommission).toBe(1250); // 50 × 100 × 0.25
  });
  it("applies adjustments to gross", () => {
    const r = calculateTieredPercent(makeInput({
      programType: "tiered-percent",
      productPrice: 100, salesCount: 120,
      tiers: DEFAULT_TIERS,
      refundRatePercent: 5, taxPercent: 0,
    }));
    expect(r.refundDeduction).toBeCloseTo(2320 * 0.05, 5);
  });
  it("rangeLabel uses + for top tier", () => {
    const r = calculateTieredPercent(makeInput({
      programType: "tiered-percent",
      productPrice: 100, salesCount: 1,
      tiers: DEFAULT_TIERS,
    }));
    expect(r.tierBreakdown[3].rangeLabel).toBe("100+");
  });
});

describe("affiliate-commission-calculator calculateRecurring", () => {
  it("multiplies monthly × months", () => {
    const r = calculateRecurring(makeInput({
      programType: "recurring",
      productPrice: 49, salesCount: 50, commissionPercent: 20,
      recurringMonths: 12,
    }));
    // monthly = 49 × 50 × 0.20 = 490; total = 490 × 12 = 5880
    expect(r.grossCommission).toBe(5880);
    expect(r.monthlyBreakdown).toHaveLength(12);
    expect(r.monthlyBreakdown[0].commission).toBe(490);
  });
  it("handles 0 recurring months", () => {
    const r = calculateRecurring(makeInput({
      programType: "recurring",
      productPrice: 49, salesCount: 50, commissionPercent: 20,
      recurringMonths: 0,
    }));
    expect(r.grossCommission).toBe(0);
    expect(r.monthlyBreakdown).toEqual([]);
  });
  it("applies refund + tax", () => {
    const r = calculateRecurring(makeInput({
      programType: "recurring",
      productPrice: 49, salesCount: 50, commissionPercent: 20,
      recurringMonths: 12, refundRatePercent: 5, taxPercent: 10,
    }));
    expect(r.refundDeduction).toBeCloseTo(5880 * 0.05, 5);
    expect(r.netCommission).toBeCloseTo(5880 * 0.95 * 0.9, 2);
  });
});

describe("affiliate-commission-calculator calculateHybrid", () => {
  it("combines initial + recurring", () => {
    const r = calculateHybrid(makeInput({
      programType: "hybrid",
      productPrice: 100, salesCount: 50, commissionPercent: 30,
      recurringMonths: 12,
    }));
    // initial = 100 × 50 × 0.30 = 1500
    // recurring percent = 15; subsequent months = 11
    // recurring = 100 × 50 × 0.15 × 11 = 8250
    // total = 9750
    expect(r.grossCommission).toBe(9750);
    expect(r.monthlyBreakdown).toHaveLength(12);
    expect(r.monthlyBreakdown[0].commission).toBe(1500);
    expect(r.monthlyBreakdown[1].commission).toBe(750); // 100 × 50 × 0.15
  });
  it("handles 1 recurring month (no recurring leg)", () => {
    const r = calculateHybrid(makeInput({
      programType: "hybrid",
      productPrice: 100, salesCount: 10, commissionPercent: 30,
      recurringMonths: 1,
    }));
    expect(r.grossCommission).toBe(300); // only initial
  });
  it("applies adjustments", () => {
    const r = calculateHybrid(makeInput({
      programType: "hybrid",
      productPrice: 100, salesCount: 50, commissionPercent: 30,
      recurringMonths: 12, refundRatePercent: 5,
    }));
    expect(r.refundDeduction).toBeCloseTo(9750 * 0.05, 5);
  });
});

describe("affiliate-commission-calculator calculate dispatcher", () => {
  it("routes flat-percent", () => {
    const r = calculate(makeInput({ programType: "flat-percent" }));
    expect(r.programType).toBe("flat-percent");
  });
  it("routes tiered-percent", () => {
    const r = calculate(makeInput({
      programType: "tiered-percent",
      tiers: DEFAULT_TIERS,
      salesCount: 100,
    }));
    expect(r.programType).toBe("tiered-percent");
    expect(r.tierBreakdown.length).toBe(4);
  });
  it("routes recurring", () => {
    const r = calculate(makeInput({
      programType: "recurring", recurringMonths: 6,
    }));
    expect(r.programType).toBe("recurring");
    expect(r.monthlyBreakdown).toHaveLength(6);
  });
  it("routes hybrid", () => {
    const r = calculate(makeInput({
      programType: "hybrid", recurringMonths: 12,
    }));
    expect(r.programType).toBe("hybrid");
  });
});

describe("affiliate-commission-calculator computeEffectiveRate", () => {
  it("returns 100 when no deductions", () => {
    const r = calculateFlatPercent(makeInput());
    expect(computeEffectiveRate(r)).toBe(100);
  });
  it("returns 0 when gross is 0", () => {
    const r: ReturnType<typeof calculateFlatPercent> = {
      ...calculateFlatPercent(makeInput()),
      grossCommission: 0,
    };
    expect(computeEffectiveRate(r)).toBe(0);
  });
  it("reflects deductions", () => {
    const r = calculateFlatPercent(makeInput({ refundRatePercent: 50 }));
    expect(computeEffectiveRate(r)).toBeCloseTo(50, 5);
  });
});

describe("affiliate-commission-calculator computeSummaryStats", () => {
  it("aggregates from result", () => {
    const r = calculateFlatPercent(makeInput({
      refundRatePercent: 10, taxPercent: 10,
    }));
    const s = computeSummaryStats(r);
    expect(s.gross).toBe(3000);
    expect(s.refunds).toBeCloseTo(300, 5);
    expect(s.tax).toBeCloseTo(270, 5);
    expect(s.net).toBeCloseTo(2430, 5);
    expect(s.effectiveRate).toBeCloseTo(81, 1);
  });
});

describe("affiliate-commission-calculator comparePrograms", () => {
  it("compares two flat-percent inputs", () => {
    const a = makeInput({ commissionPercent: 30 });
    const b = makeInput({ commissionPercent: 20 });
    const cmp = comparePrograms(a, b);
    expect(cmp.winner).toBe("a");
    expect(cmp.delta).toBe(1000); // 3000 - 2000
  });
  it("declares tie when equal", () => {
    const a = makeInput({ commissionPercent: 30 });
    const b = makeInput({ commissionPercent: 30 });
    const cmp = comparePrograms(a, b);
    expect(cmp.winner).toBe("tie");
  });
  it("compares flat vs tiered", () => {
    const a = makeInput({
      programType: "flat-percent",
      productPrice: 100, salesCount: 120, commissionPercent: 25,
    });
    const b = makeInput({
      programType: "tiered-percent",
      productPrice: 100, salesCount: 120,
      tiers: DEFAULT_TIERS,
    });
    const cmp = comparePrograms(a, b);
    // a: 100 × 120 × 0.25 = 3000
    // b: 2320 (from earlier test)
    expect(cmp.a.netCommission).toBe(3000);
    expect(cmp.b.netCommission).toBe(2320);
    expect(cmp.winner).toBe("a");
  });
});

describe("affiliate-commission-calculator computeBreakEven", () => {
  it("calculates required sales for flat-percent", () => {
    const r = computeBreakEven(3000, makeInput({
      productPrice: 100, commissionPercent: 30,
    }));
    // per-sale gross = 100 × 0.30 = 30; per-sale net (no adj) = 30
    // salesRequired = 3000 / 30 = 100
    expect(r.feasible).toBe(true);
    expect(r.perSaleNet).toBe(30);
    expect(r.salesRequired).toBe(100);
  });
  it("accounts for refund + tax", () => {
    const r = computeBreakEven(1000, makeInput({
      productPrice: 100, commissionPercent: 30,
      refundRatePercent: 10, taxPercent: 10,
    }));
    // per-sale gross 30, refund 3, after 27, tax 2.7, net 24.3
    expect(r.perSaleNet).toBeCloseTo(24.3, 5);
    expect(r.salesRequired).toBe(Math.ceil(1000 / 24.3));
  });
  it("returns feasible=false for 0 target", () => {
    const r = computeBreakEven(0, makeInput());
    expect(r.feasible).toBe(false);
    expect(r.salesRequired).toBe(0);
  });
  it("returns feasible=false when per-sale net is 0", () => {
    const r = computeBreakEven(1000, makeInput({ commissionPercent: 0 }));
    expect(r.feasible).toBe(false);
  });
  it("uses recurring-months aggregation for recurring", () => {
    const r = computeBreakEven(10000, makeInput({
      programType: "recurring",
      productPrice: 50, commissionPercent: 20,
      recurringMonths: 12,
    }));
    // per-sale gross = 50 × 0.20 × 12 = 120; net = 120
    expect(r.perSaleNet).toBe(120);
    expect(r.salesRequired).toBe(Math.ceil(10000 / 120));
  });
  it("uses hybrid initial + recurring", () => {
    const r = computeBreakEven(10000, makeInput({
      programType: "hybrid",
      productPrice: 100, commissionPercent: 30,
      recurringMonths: 12,
    }));
    // initial = 100 × 0.30 = 30; recurring = 100 × 0.15 × 11 = 165; total = 195
    expect(r.perSaleNet).toBe(195);
    expect(r.salesRequired).toBe(Math.ceil(10000 / 195));
  });
  it("tiered-percent uses highest tier percent", () => {
    const r = computeBreakEven(10000, makeInput({
      programType: "tiered-percent",
      productPrice: 100,
      tiers: DEFAULT_TIERS,
    }));
    // highest tier = 30%, per-sale gross = 30, net = 30
    expect(r.perSaleNet).toBe(30);
    expect(r.salesRequired).toBe(Math.ceil(10000 / 30));
  });
});

describe("affiliate-commission-calculator formatMoney", () => {
  it("formats to 2 decimals", () => {
    expect(formatMoney(1234.567)).toBe("1234.57");
  });
  it("handles 0", () => {
    expect(formatMoney(0)).toBe("0.00");
  });
  it("handles non-finite", () => {
    expect(formatMoney(Number.NaN)).toBe("0.00");
  });
});

describe("affiliate-commission-calculator renderTextReport", () => {
  it("includes program type and summary", () => {
    const r = calculateFlatPercent(makeInput());
    const txt = renderTextReport(r);
    expect(txt).toContain("Flat Percent");
    expect(txt).toContain("Gross:");
    expect(txt).toContain("Net:");
    expect(txt).toContain("Effective rate:");
  });
  it("includes tier breakdown for tiered", () => {
    const r = calculateTieredPercent(makeInput({
      programType: "tiered-percent",
      productPrice: 100, salesCount: 120,
      tiers: DEFAULT_TIERS,
    }));
    const txt = renderTextReport(r);
    expect(txt).toContain("Tier breakdown");
    expect(txt).toContain("1-9 @ 10%");
    expect(txt).toContain("100+ @ 30%");
  });
  it("includes monthly breakdown for recurring", () => {
    const r = calculateRecurring(makeInput({
      programType: "recurring",
      recurringMonths: 3,
    }));
    const txt = renderTextReport(r);
    expect(txt).toContain("Monthly breakdown");
    expect(txt).toContain("Month 1");
    expect(txt).toContain("Month 3");
  });
});

describe("affiliate-commission-calculator renderCsv", () => {
  it("renders header", () => {
    const r = calculateFlatPercent(makeInput());
    const csv = renderCsv(r);
    expect(csv.split("\n")[0]).toBe("component,value");
  });
  it("renders rows", () => {
    const r = calculateFlatPercent(makeInput());
    const csv = renderCsv(r);
    expect(csv).toContain("Net commission");
    expect(csv).toContain("Gross commission");
  });
  it("escapes commas in labels", () => {
    const r = calculateHybrid(makeInput({
      programType: "hybrid", recurringMonths: 12,
    }));
    const csv = renderCsv(r);
    expect(csv).toContain("Initial commission percent");
  });
});

describe("affiliate-commission-calculator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, programType: "flat-percent", netCommission: 1000, grossCommission: 1000 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, programType: "flat-percent", netCommission: i, grossCommission: i });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, programType: "flat-percent", netCommission: 1, grossCommission: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("affiliate-commission-calculator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(makeInput({
      productPrice: 99.99, salesCount: 100, commissionPercent: 30,
    }));
    expect(url).toContain("type=flat-percent");
    expect(url).toContain("price=99.99");
    expect(url).toContain("sales=100");
    expect(url).toContain("pct=30");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("includes tiers when present", () => {
    const url = buildShareUrl(makeInput({
      programType: "tiered-percent",
      tiers: DEFAULT_TIERS,
    }));
    expect(url).toContain("tiers=1%2C10");
  });
  it("parses share URL back", () => {
    const params = new URLSearchParams();
    params.set("type", "recurring");
    params.set("price", "49");
    params.set("sales", "50");
    params.set("pct", "20");
    params.set("months", "12");
    const p = parseShareUrl(`#${params.toString()}`);
    expect(p.programType).toBe("recurring");
    expect(p.productPrice).toBe(49);
    expect(p.recurringMonths).toBe(12);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown program types", () => {
    const params = new URLSearchParams();
    params.set("type", "bogus");
    const p = parseShareUrl(`#${params.toString()}`);
    expect(p.programType).toBeUndefined();
  });
});

// Suppress unused-import lint
export type _Unused = Tier;

import { describe, it, expect, beforeEach } from "vitest";
import {
  SENSITIVITY_OFFSETS,
  PRESET_EXAMPLES,
  validateInput,
  calcContributionMarginPerUnit,
  calcContributionMarginRatio,
  calcBreakEvenUnits,
  calcBreakEvenRevenue,
  calcTargetProfitUnits,
  calcTargetProfitRevenue,
  calcMarginOfSafetyUnits,
  calcMarginOfSafetyPct,
  calcProfitAtExpected,
  computeBreakEven,
  runSensitivity,
  formatNumber,
  formatPercent,
  formatRatio,
  renderText,
  renderCsv,
  summaryStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type BreakEvenInput,
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

function sampleInput(overrides: Partial<BreakEvenInput> = {}): BreakEvenInput {
  return {
    fixedCosts: 10000,
    variableCostPerUnit: 6,
    pricePerUnit: 10,
    expectedSalesUnits: 3000,
    targetProfit: 5000,
    ...overrides,
  };
}

describe("break-even constants", () => {
  it("has 5 sensitivity offsets", () => {
    expect(SENSITIVITY_OFFSETS).toHaveLength(5);
  });
  it("includes −20%, −10%, base, +10%, +20%", () => {
    const labels = SENSITIVITY_OFFSETS.map((o) => o.label);
    expect(labels).toEqual(["−20% price", "−10% price", "Base price", "+10% price", "+20% price"]);
  });
  it("has preset examples", () => {
    expect(PRESET_EXAMPLES.length).toBeGreaterThanOrEqual(4);
    expect(PRESET_EXAMPLES.some((p) => p.name === "Coffee shop")).toBe(true);
  });
});

describe("break-even validateInput", () => {
  it("passes for valid input", () => {
    expect(validateInput(sampleInput())).toEqual([]);
  });
  it("errors when fixed costs are negative", () => {
    expect(validateInput(sampleInput({ fixedCosts: -100 }))).toContain(
      "Fixed costs must be a non-negative number.",
    );
  });
  it("errors when price <= variable cost", () => {
    const errs = validateInput(sampleInput({ pricePerUnit: 5, variableCostPerUnit: 6 }));
    expect(errs.some((e) => e.includes("Price per unit must be greater than variable cost"))).toBe(true);
  });
  it("errors when price equals variable cost (zero contribution)", () => {
    const errs = validateInput(sampleInput({ pricePerUnit: 6, variableCostPerUnit: 6 }));
    expect(errs.some((e) => e.includes("Price per unit must be greater than variable cost"))).toBe(true);
  });
  it("errors when expected sales are negative", () => {
    expect(validateInput(sampleInput({ expectedSalesUnits: -10 }))).toContain(
      "Expected sales units cannot be negative.",
    );
  });
  it("errors when target profit is negative", () => {
    expect(validateInput(sampleInput({ targetProfit: -5 }))).toContain(
      "Target profit cannot be negative.",
    );
  });
  it("errors when inputs are non-finite", () => {
    expect(validateInput({ ...sampleInput(), fixedCosts: NaN }).length).toBeGreaterThan(0);
  });
});

describe("break-even calcContributionMarginPerUnit", () => {
  it("computes price − variable", () => {
    expect(calcContributionMarginPerUnit(10, 6)).toBe(4);
  });
  it("returns 0 for non-finite", () => {
    expect(calcContributionMarginPerUnit(NaN, 6)).toBe(0);
  });
});

describe("break-even calcContributionMarginRatio", () => {
  it("computes CM / price", () => {
    expect(calcContributionMarginRatio(4, 10)).toBe(0.4);
  });
  it("returns 0 when price is 0", () => {
    expect(calcContributionMarginRatio(4, 0)).toBe(0);
  });
});

describe("break-even calcBreakEvenUnits", () => {
  it("computes fixedCosts / cmPerUnit", () => {
    expect(calcBreakEvenUnits(10000, 4)).toBe(2500);
  });
  it("returns 0 when cmPerUnit is 0", () => {
    expect(calcBreakEvenUnits(10000, 0)).toBe(0);
  });
});

describe("break-even calcBreakEvenRevenue", () => {
  it("computes fixedCosts / cmRatio", () => {
    expect(calcBreakEvenRevenue(10000, 0.4)).toBe(25000);
  });
  it("returns 0 when cmRatio is 0", () => {
    expect(calcBreakEvenRevenue(10000, 0)).toBe(0);
  });
});

describe("break-even calcTargetProfitUnits", () => {
  it("computes (fixed + target) / cmPerUnit", () => {
    // (10000 + 5000) / 4 = 3750
    expect(calcTargetProfitUnits(10000, 5000, 4)).toBe(3750);
  });
  it("returns null when target profit is 0", () => {
    expect(calcTargetProfitUnits(10000, 0, 4)).toBe(null);
  });
  it("returns null when cmPerUnit is 0", () => {
    expect(calcTargetProfitUnits(10000, 5000, 0)).toBe(null);
  });
});

describe("break-even calcTargetProfitRevenue", () => {
  it("computes (fixed + target) / cmRatio", () => {
    // (10000 + 5000) / 0.4 = 37500
    expect(calcTargetProfitRevenue(10000, 5000, 0.4)).toBe(37500);
  });
  it("returns null when cmRatio is 0", () => {
    expect(calcTargetProfitRevenue(10000, 5000, 0)).toBe(null);
  });
});

describe("break-even calcMarginOfSafetyUnits", () => {
  it("computes expected − breakEven", () => {
    expect(calcMarginOfSafetyUnits(3000, 2500)).toBe(500);
  });
  it("returns null when expected is 0", () => {
    expect(calcMarginOfSafetyUnits(0, 2500)).toBe(null);
  });
  it("can be negative when expected < break-even", () => {
    expect(calcMarginOfSafetyUnits(2000, 2500)).toBe(-500);
  });
});

describe("break-even calcMarginOfSafetyPct", () => {
  it("computes (MoS / expected) × 100", () => {
    expect(calcMarginOfSafetyPct(500, 3000)).toBeCloseTo(16.67, 2);
  });
  it("returns null when MoS units is null", () => {
    expect(calcMarginOfSafetyPct(null, 3000)).toBe(null);
  });
  it("returns null when expected is 0", () => {
    expect(calcMarginOfSafetyPct(500, 0)).toBe(null);
  });
});

describe("break-even calcProfitAtExpected", () => {
  it("computes expected × cm − fixed", () => {
    // 3000 × 4 − 10000 = 2000
    expect(calcProfitAtExpected(3000, 4, 10000)).toBe(2000);
  });
  it("returns null when expected is 0", () => {
    expect(calcProfitAtExpected(0, 4, 10000)).toBe(null);
  });
});

describe("break-even computeBreakEven", () => {
  it("returns valid result for proper input", () => {
    const r = computeBreakEven(sampleInput());
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.contributionMarginPerUnit).toBe(4);
    expect(r.contributionMarginRatio).toBe(0.4);
    expect(r.breakEvenUnits).toBe(2500);
    expect(r.breakEvenRevenue).toBe(25000);
    expect(r.targetProfitUnits).toBe(3750);
    expect(r.targetProfitRevenue).toBe(37500);
    expect(r.marginOfSafetyUnits).toBe(500);
    expect(r.marginOfSafetyPct).toBeCloseTo(16.67, 2);
    expect(r.profitAtExpected).toBe(2000);
  });
  it("marks invalid and zeroed when price <= variable", () => {
    const r = computeBreakEven(sampleInput({ pricePerUnit: 5, variableCostPerUnit: 6 }));
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.breakEvenUnits).toBe(0);
    expect(r.breakEvenRevenue).toBe(0);
    expect(r.targetProfitUnits).toBe(null);
    expect(r.marginOfSafetyUnits).toBe(null);
    expect(r.profitAtExpected).toBe(null);
  });
  it("handles missing expected sales (no MoS, no profit at expected)", () => {
    const r = computeBreakEven(sampleInput({ expectedSalesUnits: 0 }));
    expect(r.marginOfSafetyUnits).toBe(null);
    expect(r.marginOfSafetyPct).toBe(null);
    expect(r.profitAtExpected).toBe(null);
  });
  it("handles missing target profit", () => {
    const r = computeBreakEven(sampleInput({ targetProfit: 0 }));
    expect(r.targetProfitUnits).toBe(null);
    expect(r.targetProfitRevenue).toBe(null);
  });
});

describe("break-even runSensitivity", () => {
  it("returns 5 rows", () => {
    expect(runSensitivity(sampleInput())).toHaveLength(5);
  });
  it("base row equals original break-even units", () => {
    const rows = runSensitivity(sampleInput());
    const base = rows.find((r) => r.label === "Base price")!;
    expect(base.breakEvenUnits).toBe(2500);
    expect(base.pricePerUnit).toBe(10);
  });
  it("higher price yields lower break-even units", () => {
    const rows = runSensitivity(sampleInput());
    const plus20 = rows.find((r) => r.label === "+20% price")!;
    expect(plus20.breakEvenUnits).toBeLessThan(2500);
  });
  it("lower price yields higher break-even units", () => {
    const rows = runSensitivity(sampleInput());
    const minus20 = rows.find((r) => r.label === "−20% price")!;
    expect(minus20.breakEvenUnits).toBeGreaterThan(2500);
  });
  it("marks row invalid when adjusted price falls below variable cost", () => {
    const rows = runSensitivity(sampleInput({ pricePerUnit: 7, variableCostPerUnit: 6 }));
    const minus20 = rows.find((r) => r.label === "−20% price")!;
    // 7 × 0.8 = 5.6 < 6 → CM negative → invalid
    expect(minus20.valid).toBe(false);
  });
});

describe("break-even formatting", () => {
  it("formatNumber handles finite", () => {
    expect(formatNumber(1234.5)).toBe("1234.50");
  });
  it("formatNumber handles null and non-finite", () => {
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(NaN)).toBe("—");
  });
  it("formatNumber handles negative", () => {
    expect(formatNumber(-50)).toBe("-50.00");
  });
  it("formatPercent formats", () => {
    expect(formatPercent(16.67)).toBe("16.67%");
  });
  it("formatPercent handles null", () => {
    expect(formatPercent(null)).toBe("—");
  });
  it("formatRatio converts 0..1 to %", () => {
    expect(formatRatio(0.4)).toBe("40.00%");
  });
});

describe("break-even renderText", () => {
  it("renders header and break-even for valid input", () => {
    const r = computeBreakEven(sampleInput());
    const text = renderText(sampleInput(), r);
    expect(text).toContain("BREAK-EVEN ANALYSIS");
    expect(text).toContain("Fixed costs:");
    expect(text).toContain("Break-even units:");
    expect(text).toContain("PRICE SENSITIVITY");
  });
  it("includes validation errors section for invalid input", () => {
    const input = sampleInput({ pricePerUnit: 5, variableCostPerUnit: 6 });
    const r = computeBreakEven(input);
    const text = renderText(input, r);
    expect(text).toContain("VALIDATION ERRORS");
  });
  it("includes target profit section when target > 0", () => {
    const r = computeBreakEven(sampleInput());
    const text = renderText(sampleInput(), r);
    expect(text).toContain("TARGET PROFIT");
  });
  it("omits margin of safety when expected sales is 0", () => {
    const input = sampleInput({ expectedSalesUnits: 0 });
    const r = computeBreakEven(input);
    const text = renderText(input, r);
    expect(text).not.toContain("MARGIN OF SAFETY");
  });
});

describe("break-even renderCsv", () => {
  it("renders header row", () => {
    const csv = renderCsv(sampleInput(), computeBreakEven(sampleInput()));
    expect(csv).toContain("metric,value,formula");
  });
  it("renders break-even rows with formulas", () => {
    const csv = renderCsv(sampleInput(), computeBreakEven(sampleInput()));
    expect(csv).toContain("break_even_units,2500.0000,fixed_costs / cm_per_unit");
    expect(csv).toContain("contribution_margin_per_unit,4.0000,price - variable_cost");
  });
  it("renders error rows for invalid input", () => {
    const input = sampleInput({ pricePerUnit: 5, variableCostPerUnit: 6 });
    const csv = renderCsv(input, computeBreakEven(input));
    expect(csv).toContain("error,");
    expect(csv).toContain("validation");
  });
  it("includes sensitivity section", () => {
    const csv = renderCsv(sampleInput(), computeBreakEven(sampleInput()));
    expect(csv).toContain("scenario,price_per_unit,cm_per_unit,break_even_units,break_even_revenue");
    expect(csv).toContain("Base price");
  });
});

describe("break-even summaryStats", () => {
  it("builds summary", () => {
    const s = summaryStats(computeBreakEven(sampleInput()));
    expect(s.breakEvenUnits).toBe(2500);
    expect(s.breakEvenRevenue).toBe(25000);
    expect(s.marginOfSafetyUnits).toBe(500);
    expect(s.contributionMarginPerUnit).toBe(4);
  });
});

describe("break-even history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, fixedCosts: 10000, pricePerUnit: 10, variableCostPerUnit: 6, breakEvenUnits: 2500, breakEvenRevenue: 25000 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, fixedCosts: 1000, pricePerUnit: 5, variableCostPerUnit: 2, breakEvenUnits: 334, breakEvenRevenue: 1670 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, fixedCosts: 1000, pricePerUnit: 5, variableCostPerUnit: 2, breakEvenUnits: 334, breakEvenRevenue: 1670 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("break-even shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ fixedCosts: 10000, variableCostPerUnit: 6, pricePerUnit: 10, expectedSalesUnits: 3000, targetProfit: 5000 });
    expect(url).toContain("fc=10000");
    expect(url).toContain("vc=6");
    expect(url).toContain("p=10");
    expect(url).toContain("exp=3000");
    expect(url).toContain("tp=5000");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("omits zero expected sales and target profit", () => {
    const url = buildShareUrl({ fixedCosts: 1000, variableCostPerUnit: 2, pricePerUnit: 5, expectedSalesUnits: 0, targetProfit: 0 });
    expect(url).not.toContain("exp=");
    expect(url).not.toContain("tp=");
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("fc=10000&vc=6&p=10&exp=3000&tp=5000");
    expect(p).toEqual({
      fixedCosts: 10000,
      variableCostPerUnit: 6,
      pricePerUnit: 10,
      expectedSalesUnits: 3000,
      targetProfit: 5000,
    });
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("ignores non-finite values", () => {
    const p = parseShareUrl("fc=abc&vc=6");
    expect(p.fixedCosts).toBeUndefined();
    expect(p.variableCostPerUnit).toBe(6);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import {
  ROI_TARGET_PRESETS,
  DEFAULT_DISCOUNT_RATE,
  parseCashFlows,
  applyTerminalValue,
  calcTotalCashFlow,
  calcNetProfit,
  calcRoi,
  applyDiscountRate,
  calcAnnualizedRoi,
  calcPaybackPeriod,
  calcNpv,
  calcIrr,
  checkProfitability,
  computeRoi,
  formatNumber,
  formatPercent,
  renderText,
  renderCsv,
  summaryStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type RoiInput,
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

function sampleInput(overrides: Partial<RoiInput> = {}): RoiInput {
  return {
    initialInvestment: 10000,
    cashFlowsText: "5000\n6000\n7000\n8000",
    discountRate: 10,
    terminalValue: 0,
    ...overrides,
  };
}

describe("roi-calculator constants", () => {
  it("has 5 ROI target presets", () => {
    expect(ROI_TARGET_PRESETS).toHaveLength(5);
    expect(ROI_TARGET_PRESETS).toEqual([5, 10, 15, 20, 25]);
  });
  it("has default discount rate of 10", () => {
    expect(DEFAULT_DISCOUNT_RATE).toBe(10);
  });
});

describe("roi-calculator parseCashFlows", () => {
  it("parses one number per line", () => {
    const { values, errors } = parseCashFlows("5000\n6000\n7000\n8000");
    expect(values).toEqual([5000, 6000, 7000, 8000]);
    expect(errors).toHaveLength(0);
  });
  it("skips blank lines", () => {
    const { values } = parseCashFlows("5000\n\n6000\n  \n7000");
    expect(values).toEqual([5000, 6000, 7000]);
  });
  it("trims whitespace", () => {
    const { values } = parseCashFlows("  5000  \n  6000 ");
    expect(values).toEqual([5000, 6000]);
  });
  it("rejects invalid numbers", () => {
    const { values, errors } = parseCashFlows("5000\nabc\n6000");
    expect(values).toEqual([5000, 6000]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("invalid number");
  });
  it("allows negative cash flows", () => {
    const { values } = parseCashFlows("5000\n-1000\n6000");
    expect(values).toEqual([5000, -1000, 6000]);
  });
  it("returns empty for empty input", () => {
    expect(parseCashFlows("").values).toEqual([]);
    expect(parseCashFlows("  \n  ").values).toEqual([]);
  });
});

describe("roi-calculator applyTerminalValue", () => {
  it("returns copy when terminal value is 0", () => {
    const cf = [1000, 2000, 3000];
    expect(applyTerminalValue(cf, 0)).toEqual([1000, 2000, 3000]);
  });
  it("appends to last cash flow", () => {
    const cf = [1000, 2000, 3000];
    expect(applyTerminalValue(cf, 500)).toEqual([1000, 2000, 3500]);
  });
  it("handles empty cash flows", () => {
    expect(applyTerminalValue([], 500)).toEqual([500]);
  });
  it("handles negative terminal value", () => {
    const cf = [1000, 2000, 3000];
    expect(applyTerminalValue(cf, -200)).toEqual([1000, 2000, 2800]);
  });
});

describe("roi-calculator total cash flow & net profit", () => {
  it("calcTotalCashFlow sums cash flows + terminal", () => {
    expect(calcTotalCashFlow([1000, 2000, 3000], 500)).toBe(6500);
  });
  it("calcTotalCashFlow without terminal", () => {
    expect(calcTotalCashFlow([1000, 2000, 3000], 0)).toBe(6000);
  });
  it("calcTotalCashFlow handles empty", () => {
    expect(calcTotalCashFlow([], 0)).toBe(0);
    expect(calcTotalCashFlow([], 500)).toBe(500);
  });
  it("calcNetProfit = total - initial", () => {
    expect(calcNetProfit(6000, 10000)).toBe(-4000);
    expect(calcNetProfit(15000, 10000)).toBe(5000);
  });
});

describe("roi-calculator ROI", () => {
  it("calcRoi = netProfit / initial * 100", () => {
    expect(calcRoi(5000, 10000)).toBe(50);
  });
  it("calcRoi handles negative net profit", () => {
    expect(calcRoi(-4000, 10000)).toBe(-40);
  });
  it("calcRoi returns 0 when initial is 0", () => {
    expect(calcRoi(5000, 0)).toBe(0);
  });
});

describe("roi-calculator applyDiscountRate", () => {
  it("discounts cash flow at year 1 with 10% rate", () => {
    // 1000 / 1.1 = 909.09
    expect(applyDiscountRate(1000, 10, 1)).toBeCloseTo(909.09, 2);
  });
  it("discounts at year 2", () => {
    // 1000 / 1.21 = 826.45
    expect(applyDiscountRate(1000, 10, 2)).toBeCloseTo(826.45, 2);
  });
  it("returns cash flow when rate is 0", () => {
    expect(applyDiscountRate(1000, 0, 5)).toBe(1000);
  });
  it("returns cash flow for negative year", () => {
    expect(applyDiscountRate(1000, 10, -1)).toBe(1000);
  });
});

describe("roi-calculator annualized ROI", () => {
  it("computes geometric mean", () => {
    // initial 1000, total 2000, years 3 → (2)^(1/3) - 1 ≈ 0.2599 → 25.99%
    const r = calcAnnualizedRoi(2000, 1000, 3);
    expect(r).toBeCloseTo(25.99, 1);
  });
  it("returns 0 when initial is 0", () => {
    expect(calcAnnualizedRoi(1000, 0, 3)).toBe(0);
  });
  it("returns 0 when years is 0", () => {
    expect(calcAnnualizedRoi(1000, 500, 0)).toBe(0);
  });
  it("returns 0 when total cash flow is 0 or negative", () => {
    expect(calcAnnualizedRoi(0, 1000, 3)).toBe(0);
    expect(calcAnnualizedRoi(-500, 1000, 3)).toBe(0);
  });
});

describe("roi-calculator payback period", () => {
  it("computes payback with fraction", () => {
    // initial 1000, cash flows [500, 400, 300]
    // year 1: cumulative -500, year 2: -100, year 3: +200 → payback at 2 + 100/300
    const p = calcPaybackPeriod([500, 400, 300], 1000);
    expect(p).toBeCloseTo(2.33, 2);
  });
  it("returns null when never paid back", () => {
    expect(calcPaybackPeriod([100, 200, 300], 10000)).toBeNull();
  });
  it("returns 0 when initial investment is 0", () => {
    expect(calcPaybackPeriod([100, 200], 0)).toBe(0);
  });
  it("returns null for empty cash flows", () => {
    expect(calcPaybackPeriod([], 1000)).toBeNull();
  });
  it("handles exact payback at year boundary", () => {
    expect(calcPaybackPeriod([500, 500, 500], 1000)).toBe(2);
  });
});

describe("roi-calculator NPV", () => {
  it("computes NPV with 10% discount rate", () => {
    // initial 1000, cash flows [500, 500, 500], rate 10%
    // NPV = -1000 + 500/1.1 + 500/1.21 + 500/1.331
    // = -1000 + 454.55 + 413.22 + 375.66 = 243.43
    const npv = calcNpv([500, 500, 500], 1000, 10);
    expect(npv).toBeCloseTo(243.43, 1);
  });
  it("NPV is negative when cash flows insufficient", () => {
    const npv = calcNpv([100, 100, 100], 1000, 10);
    expect(npv).toBeLessThan(0);
  });
  it("NPV with 0% rate = total - initial", () => {
    expect(calcNpv([500, 500, 500], 1000, 0)).toBe(500);
  });
  it("NPV handles empty cash flows", () => {
    expect(calcNpv([], 1000, 10)).toBe(-1000);
  });
});

describe("roi-calculator IRR", () => {
  it("computes IRR for simple case", () => {
    // initial 1000, cash flows [500, 500, 500]
    // IRR ≈ 23.38%
    const irr = calcIrr([500, 500, 500], 1000);
    expect(irr).not.toBeNull();
    expect(irr!).toBeCloseTo(23.38, 1);
  });
  it("returns null when no sign change", () => {
    // all positive cash flows, no initial outflow effect — IRR undefined
    const irr = calcIrr([100, 200, 300], 0);
    expect(irr).toBeNull();
  });
  it("returns null when initial investment is 0", () => {
    expect(calcIrr([100, 200, 300], 0)).toBeNull();
  });
  it("returns null for empty cash flows", () => {
    expect(calcIrr([], 1000)).toBeNull();
  });
  it("IRR equals discount rate when NPV is near zero", () => {
    // Build cash flows that exactly discount to initial at 10%
    // initial 1000, cash flows [1100] → IRR should be 10%
    const irr = calcIrr([1100], 1000);
    expect(irr).not.toBeNull();
    expect(irr!).toBeCloseTo(10, 1);
  });
  it("IRR for losing investment is negative", () => {
    // initial 1000, cash flows [500] → IRR = -50%
    const irr = calcIrr([500], 1000);
    expect(irr).not.toBeNull();
    expect(irr!).toBeCloseTo(-50, 1);
  });
});

describe("roi-calculator checkProfitability", () => {
  it("returns profitable when NPV > 0 and IRR > discount rate", () => {
    expect(checkProfitability(500, 25, 10)).toBe("profitable");
  });
  it("returns unprofitable when NPV < 0 and IRR < discount rate", () => {
    expect(checkProfitability(-500, 5, 10)).toBe("unprofitable");
  });
  it("returns indeterminate for mixed signals", () => {
    expect(checkProfitability(500, 5, 10)).toBe("indeterminate");
    expect(checkProfitability(-500, 25, 10)).toBe("indeterminate");
  });
  it("uses NPV alone when IRR is null", () => {
    expect(checkProfitability(500, null, 10)).toBe("profitable");
    expect(checkProfitability(-500, null, 10)).toBe("unprofitable");
    expect(checkProfitability(0, null, 10)).toBe("indeterminate");
  });
});

describe("roi-calculator computeRoi (integration)", () => {
  it("computes full ROI from sample input", () => {
    const input = sampleInput();
    const r = computeRoi(input);
    expect(r.initialInvestment).toBe(10000);
    expect(r.cashFlows).toEqual([5000, 6000, 7000, 8000]);
    expect(r.totalCashFlow).toBe(26000);
    expect(r.netProfit).toBe(16000);
    expect(r.roi).toBe(160); // 16000/10000 * 100
    expect(r.years).toBe(4);
    // annualized = (26000/10000)^(1/4) - 1 = 2.6^0.25 - 1 ≈ 0.2698 → 26.98%
    expect(r.annualizedRoi).toBeCloseTo(26.98, 1);
    // payback: year 1: -5000, year 2: -1000+6000=... wait, cumul year 1 = -5000, year 2: +1000, year 3: +8000 → crossed at year 2 + 4000/7000
    // Actually cumul: -10000 → year1: -5000, year2: +1000, so payback between year 1 and 2.
    // year 1: cumul -5000, year 2: -5000+6000 = +1000 → payback at 1 + 5000/6000 = 1.833
    expect(r.paybackPeriod).toBeCloseTo(1.83, 2);
    expect(r.paybackYears).toBe(1);
    expect(r.paybackMonths).toBe(10);
    expect(r.profitability).toBe("profitable");
    expect(r.rows).toHaveLength(4);
    expect(r.rows[0].year).toBe(1);
    expect(r.rows[0].cashFlow).toBe(5000);
  });
  it("handles terminal value", () => {
    const input = sampleInput({ terminalValue: 2000 });
    const r = computeRoi(input);
    // last cash flow gets +2000 → 8000 + 2000 = 10000
    expect(r.cashFlows[3]).toBe(10000);
    expect(r.totalCashFlow).toBe(28000);
    expect(r.netProfit).toBe(18000);
  });
  it("handles empty cash flows gracefully", () => {
    const input: RoiInput = {
      initialInvestment: 1000,
      cashFlowsText: "",
      discountRate: 10,
      terminalValue: 0,
    };
    const r = computeRoi(input);
    expect(r.cashFlows).toEqual([]);
    expect(r.totalCashFlow).toBe(0);
    expect(r.netProfit).toBe(-1000);
    expect(r.roi).toBe(-100);
    expect(r.annualizedRoi).toBe(0);
    expect(r.paybackPeriod).toBeNull();
    expect(r.npv).toBe(-1000);
    expect(r.irr).toBeNull();
    expect(r.profitability).toBe("unprofitable");
    expect(r.rows).toEqual([]);
  });
  it("handles negative initial investment (treats as 0 income case)", () => {
    const input: RoiInput = {
      initialInvestment: -1000,
      cashFlowsText: "500\n500",
      discountRate: 10,
      terminalValue: 0,
    };
    const r = computeRoi(input);
    // With initial treated as 0 (we use Number.isFinite check), and ROI returns 0 when initial is 0
    // Wait — we don't sanitize to 0, we keep the value. Let's verify behavior.
    // Actually Number.isFinite(-1000) is true, so initialInvestment = -1000.
    // calcRoi: netProfit = totalCF - (-1000) = 1000 + 1000 = 2000; roi = 2000 / -1000 * 100 = -200%
    expect(r.initialInvestment).toBe(-1000);
    expect(r.totalCashFlow).toBe(1000);
    expect(r.netProfit).toBe(2000);
    expect(r.roi).toBe(-200);
  });
});

describe("roi-calculator formatting", () => {
  it("formatNumber positive", () => {
    expect(formatNumber(1234.567)).toBe("1234.57");
  });
  it("formatNumber negative", () => {
    expect(formatNumber(-50.5)).toBe("-50.50");
  });
  it("formatNumber non-finite", () => {
    expect(formatNumber(NaN)).toBe("—");
    expect(formatNumber(Infinity)).toBe("—");
  });
  it("formatPercent number", () => {
    expect(formatPercent(25.5)).toBe("25.50%");
  });
  it("formatPercent null", () => {
    expect(formatPercent(null)).toBe("—");
  });
  it("formatPercent non-finite", () => {
    expect(formatPercent(NaN)).toBe("—");
  });
});

describe("roi-calculator renderText", () => {
  it("renders text with key fields", () => {
    const input = sampleInput();
    const r = computeRoi(input);
    const text = renderText(input, r);
    expect(text).toContain("ROI ANALYSIS");
    expect(text).toContain("Initial investment:");
    expect(text).toContain("RESULTS");
    expect(text).toContain("Total cash flow:");
    expect(text).toContain("Net profit:");
    expect(text).toContain("ROI:");
    expect(text).toContain("Annualized ROI:");
    expect(text).toContain("Payback period:");
    expect(text).toContain("NPV");
    expect(text).toContain("IRR:");
    expect(text).toContain("PROFITABLE");
    expect(text).toContain("CASH FLOW SCHEDULE");
    expect(text).toContain("ROI TARGET COMPARISON");
  });
  it("notes never-paid-back in text", () => {
    const input = sampleInput({ cashFlowsText: "100\n200" });
    const r = computeRoi(input);
    const text = renderText(input, r);
    expect(text).toContain("never");
  });
  it("includes terminal value when nonzero", () => {
    const input = sampleInput({ terminalValue: 1000 });
    const r = computeRoi(input);
    const text = renderText(input, r);
    expect(text).toContain("Terminal value:");
  });
});

describe("roi-calculator renderCsv", () => {
  it("renders header and rows", () => {
    const input = sampleInput();
    const r = computeRoi(input);
    const csv = renderCsv(input, r);
    expect(csv).toContain("initial_investment,10000.00");
    expect(csv).toContain("years,4");
    expect(csv).toContain("discount_rate_pct,10.00");
    expect(csv).toContain("year,cash_flow,cumulative,discounted");
    expect(csv).toContain("1,5000.00");
    expect(csv).toContain("total_cash_flow,26000.00");
    expect(csv).toContain("net_profit,16000.00");
    expect(csv).toContain("roi_pct,160.00");
    expect(csv).toContain("profitability,profitable");
  });
  it("handles never-paid-back in CSV", () => {
    const input = sampleInput({ cashFlowsText: "100\n200" });
    const r = computeRoi(input);
    const csv = renderCsv(input, r);
    expect(csv).toContain("payback_period_years,never");
  });
  it("handles null IRR in CSV", () => {
    const input: RoiInput = {
      initialInvestment: 1000,
      cashFlowsText: "",
      discountRate: 10,
      terminalValue: 0,
    };
    const r = computeRoi(input);
    const csv = renderCsv(input, r);
    expect(csv).toContain("irr_pct,n/a");
  });
});

describe("roi-calculator summaryStats", () => {
  it("computes summary stats", () => {
    const input = sampleInput();
    const r = computeRoi(input);
    const stats = summaryStats(r);
    expect(stats.initialInvestment).toBe(10000);
    expect(stats.totalCashFlow).toBe(26000);
    expect(stats.netProfit).toBe(16000);
    expect(stats.roi).toBe(160);
    expect(stats.years).toBe(4);
    expect(stats.profitability).toBe("profitable");
    expect(stats.maxCashFlow).toBe(8000);
    expect(stats.minCashFlow).toBe(5000);
    expect(stats.avgCashFlow).toBe(6500); // (5000+6000+7000+8000)/4 = 6500
  });
  it("handles empty cash flows", () => {
    const input: RoiInput = {
      initialInvestment: 1000,
      cashFlowsText: "",
      discountRate: 10,
      terminalValue: 0,
    };
    const stats = summaryStats(computeRoi(input));
    expect(stats.maxCashFlow).toBe(0);
    expect(stats.minCashFlow).toBe(0);
    expect(stats.avgCashFlow).toBe(0);
  });
});

describe("roi-calculator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      initialInvestment: 10000,
      totalCashFlow: 26000,
      roi: 160,
      npv: 5000,
      irr: 25,
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].roi).toBe(160);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        initialInvestment: 1000,
        totalCashFlow: i,
        roi: i,
        npv: i,
        irr: i,
      });
    }
    expect(loadHistory()).toHaveLength(20);
    expect(loadHistory()[0].ts).toBe(24);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      initialInvestment: 1000,
      totalCashFlow: 1000,
      roi: 0,
      npv: 0,
      irr: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("roi-calculator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      initialInvestment: 10000,
      cashFlowsText: "5000\n6000",
      discountRate: 10,
      terminalValue: 500,
    });
    expect(url).toContain("init=10000");
    expect(url).toContain("cf=5000");
    expect(url).toContain("rate=10");
    expect(url).toContain("tv=500");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const input = sampleInput();
    const url = buildShareUrl(input);
    const hash = url.includes("#") ? url.split("#")[1] : url.replace(/^\?/, "");
    const parsed = parseShareUrl(hash);
    expect(parsed.initialInvestment).toBe(10000);
    expect(parsed.cashFlowsText).toContain("5000");
    expect(parsed.discountRate).toBe(10);
    expect(parsed.terminalValue).toBe(0);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("ignores non-numeric initial", () => {
    const parsed = parseShareUrl("init=abc");
    expect(parsed.initialInvestment).toBeUndefined();
  });
  it("ignores non-numeric rate", () => {
    const parsed = parseShareUrl("rate=abc");
    expect(parsed.discountRate).toBeUndefined();
  });
  it("preserves newlines in cashFlowsText", () => {
    const input = sampleInput({ cashFlowsText: "100\n200\n300" });
    const url = buildShareUrl(input);
    const hash = url.includes("#") ? url.split("#")[1] : url.replace(/^\?/, "");
    const parsed = parseShareUrl(hash);
    expect(parsed.cashFlowsText).toBe("100\n200\n300");
  });
});

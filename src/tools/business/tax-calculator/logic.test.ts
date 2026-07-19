import { describe, it, expect, beforeEach } from "vitest";
import {
  TAX_TYPES,
  COUNTRIES,
  FILING_STATUSES,
  TAX_YEARS,
  TAX_TYPE_LABELS,
  COUNTRY_LABELS,
  FILING_STATUS_LABELS,
  COUNTRY_CURRENCY,
  US_STATE_SALES_TAX,
  VAT_RATES,
  DEFAULT_SALES_TAX_RATE,
  getIncomeBrackets,
  getLongTermCapitalGainsBrackets,
  applyDeductions,
  calculateProgressive,
  findMarginalRate,
  effectiveRate,
  calculateIncomeTax,
  calculateSalesTax,
  calculateVAT,
  calculateCapitalGains,
  computeTax,
  formatCurrency,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  summaryStats,
  type TaxInput,
  type TaxType,
  type Country,
  type FilingStatus,
  type TaxYear,
  type CurrencySymbol,
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

function sampleInput(overrides: Partial<TaxInput> = {}): TaxInput {
  return {
    taxType: "income",
    country: "US",
    income: 100000,
    purchaseAmount: 0,
    filingStatus: "single",
    taxYear: 2026,
    deductions: 0,
    stateOrRegion: "",
    capitalGainsHoldingYears: 0,
    ...overrides,
  };
}

describe("tax-calculator constants", () => {
  it("has 4 tax types", () => {
    expect(TAX_TYPES).toHaveLength(4);
    expect(TAX_TYPES).toContain("income");
    expect(TAX_TYPES).toContain("sales");
    expect(TAX_TYPES).toContain("vat");
    expect(TAX_TYPES).toContain("capital-gains");
  });
  it("has 7 countries", () => {
    expect(COUNTRIES).toHaveLength(7);
    expect(COUNTRIES).toContain("US");
    expect(COUNTRIES).toContain("UK");
    expect(COUNTRIES).toContain("IN");
    expect(COUNTRIES).toContain("DE");
    expect(COUNTRIES).toContain("FR");
    expect(COUNTRIES).toContain("CA");
    expect(COUNTRIES).toContain("AU");
  });
  it("has 3 filing statuses", () => {
    expect(FILING_STATUSES).toHaveLength(3);
    expect(FILING_STATUSES).toContain("single");
    expect(FILING_STATUSES).toContain("married-jointly");
    expect(FILING_STATUSES).toContain("head-of-household");
  });
  it("has 3 tax years", () => {
    expect(TAX_YEARS).toHaveLength(3);
    expect(TAX_YEARS).toEqual([2024, 2025, 2026]);
  });
  it("has labels for all tax types", () => {
    expect(Object.keys(TAX_TYPE_LABELS)).toHaveLength(4);
    expect(TAX_TYPE_LABELS["income"]).toBe("Income Tax");
  });
  it("has labels for all countries", () => {
    expect(Object.keys(COUNTRY_LABELS)).toHaveLength(7);
    expect(COUNTRY_LABELS["US"]).toBe("United States");
  });
  it("has labels for all filing statuses", () => {
    expect(Object.keys(FILING_STATUS_LABELS)).toHaveLength(3);
    expect(FILING_STATUS_LABELS["married-jointly"]).toBe("Married Filing Jointly");
  });
  it("maps each country to a currency", () => {
    expect(COUNTRY_CURRENCY["US"]).toBe("$");
    expect(COUNTRY_CURRENCY["UK"]).toBe("£");
    expect(COUNTRY_CURRENCY["IN"]).toBe("₹");
    expect(COUNTRY_CURRENCY["DE"]).toBe("€");
    expect(COUNTRY_CURRENCY["CA"]).toBe("C$");
    expect(COUNTRY_CURRENCY["AU"]).toBe("A$");
  });
  it("has US state sales tax table with default 7%", () => {
    expect(DEFAULT_SALES_TAX_RATE).toBe(7);
    expect(US_STATE_SALES_TAX["CA"]).toBe(7.25);
    expect(US_STATE_SALES_TAX["NY"]).toBe(8);
    expect(US_STATE_SALES_TAX["TX"]).toBe(6.25);
    expect(US_STATE_SALES_TAX["OR"]).toBe(0);
  });
  it("has VAT rates for non-US countries", () => {
    expect(VAT_RATES["UK"]).toBe(20);
    expect(VAT_RATES["DE"]).toBe(19);
    expect(VAT_RATES["FR"]).toBe(20);
    expect(VAT_RATES["IN"]).toBe(18);
    expect(VAT_RATES["CA"]).toBe(5);
    expect(VAT_RATES["AU"]).toBe(10);
  });
});

describe("tax-calculator getIncomeBrackets", () => {
  it("returns US 2026 single brackets matching task spec", () => {
    const b = getIncomeBrackets("US", 2026, "single");
    expect(b).toHaveLength(7);
    expect(b[0]).toEqual({ from: 0, to: 11600, rate: 10 });
    expect(b[1]).toEqual({ from: 11600, to: 47150, rate: 12 });
    expect(b[2]).toEqual({ from: 47150, to: 100525, rate: 22 });
    expect(b[3]).toEqual({ from: 100525, to: 191950, rate: 24 });
    expect(b[4]).toEqual({ from: 191950, to: 243725, rate: 32 });
    expect(b[5]).toEqual({ from: 243725, to: 609350, rate: 35 });
    expect(b[6]).toEqual({ from: 609350, to: null, rate: 37 });
  });
  it("returns US 2026 married-jointly brackets", () => {
    const b = getIncomeBrackets("US", 2026, "married-jointly");
    expect(b).toHaveLength(7);
    expect(b[0].to).toBe(23200);
    expect(b[6].rate).toBe(37);
  });
  it("returns US 2026 head-of-household brackets", () => {
    const b = getIncomeBrackets("US", 2026, "head-of-household");
    expect(b).toHaveLength(7);
    expect(b[0].to).toBe(16550);
  });
  it("returns different brackets for 2024 vs 2026 (US single)", () => {
    const b2024 = getIncomeBrackets("US", 2024, "single");
    const b2026 = getIncomeBrackets("US", 2026, "single");
    expect(b2024[0].to).not.toBe(b2026[0].to);
    // Both have a finite `to` (first bracket), so safe to compare as numbers.
    expect(b2024[0].to as number).toBeLessThan(b2026[0].to as number);
  });
  it("returns UK brackets matching task spec", () => {
    const b = getIncomeBrackets("UK", 2026, "single");
    expect(b).toHaveLength(4);
    expect(b[0]).toEqual({ from: 0, to: 12570, rate: 0 });
    expect(b[1]).toEqual({ from: 12570, to: 50270, rate: 20 });
    expect(b[2]).toEqual({ from: 50270, to: 125140, rate: 40 });
    expect(b[3]).toEqual({ from: 125140, to: null, rate: 45 });
  });
  it("returns India FY 2025-26 brackets matching task spec", () => {
    const b = getIncomeBrackets("IN", 2026, "single");
    expect(b).toHaveLength(6);
    expect(b[0]).toEqual({ from: 0, to: 300000, rate: 0 });
    expect(b[1]).toEqual({ from: 300000, to: 700000, rate: 5 });
    expect(b[2]).toEqual({ from: 700000, to: 1000000, rate: 10 });
    expect(b[3]).toEqual({ from: 1000000, to: 1200000, rate: 15 });
    expect(b[4]).toEqual({ from: 1200000, to: 1500000, rate: 20 });
    expect(b[5]).toEqual({ from: 1500000, to: null, rate: 30 });
  });
  it("returns DE/FR/CA/AU brackets", () => {
    expect(getIncomeBrackets("DE", 2026, "single").length).toBeGreaterThan(0);
    expect(getIncomeBrackets("FR", 2026, "single").length).toBeGreaterThan(0);
    expect(getIncomeBrackets("CA", 2026, "single").length).toBeGreaterThan(0);
    expect(getIncomeBrackets("AU", 2026, "single").length).toBeGreaterThan(0);
  });
});

describe("tax-calculator getLongTermCapitalGainsBrackets", () => {
  it("returns US LT CG brackets by filing status", () => {
    const b = getLongTermCapitalGainsBrackets("US", "single");
    expect(b).toHaveLength(3);
    expect(b[0].rate).toBe(0);
    expect(b[1].rate).toBe(15);
    expect(b[2].rate).toBe(20);
  });
  it("returns flat rate brackets for IN/DE/FR", () => {
    const inB = getLongTermCapitalGainsBrackets("IN", "single");
    expect(inB).toHaveLength(1);
    expect(inB[0].rate).toBe(12.5);
    const deB = getLongTermCapitalGainsBrackets("DE", "single");
    expect(deB[0].rate).toBe(26.375);
    const frB = getLongTermCapitalGainsBrackets("FR", "single");
    expect(frB[0].rate).toBe(30);
  });
});

describe("tax-calculator applyDeductions", () => {
  it("subtracts deductions from gross", () => {
    expect(applyDeductions(100000, 12000)).toBe(88000);
  });
  it("floors at 0 when deductions exceed gross", () => {
    expect(applyDeductions(100, 200)).toBe(0);
  });
  it("ignores non-positive deductions", () => {
    expect(applyDeductions(1000, 0)).toBe(1000);
    expect(applyDeductions(1000, -50)).toBe(1000);
  });
  it("ignores NaN deductions", () => {
    expect(applyDeductions(1000, NaN)).toBe(1000);
  });
});

describe("tax-calculator calculateProgressive", () => {
  it("calculates US single $100k income tax correctly", () => {
    // $100k income, US 2026 single
    // Bracket 1: $11,600 × 10% = $1,160
    // Bracket 2: ($47,150 - $11,600) × 12% = $35,550 × 12% = $4,266
    // Bracket 3: ($100,000 - $47,150) × 22% = $52,850 × 22% = $11,627
    // Total = $1,160 + $4,266 + $11,627 = $17,053
    const brackets = getIncomeBrackets("US", 2026, "single");
    const { tax, breakdown } = calculateProgressive(100000, brackets);
    expect(tax).toBe(17053);
    expect(breakdown).toHaveLength(3);
    expect(breakdown[0].tax).toBe(1160);
    expect(breakdown[1].tax).toBe(4266);
    expect(breakdown[2].tax).toBe(11627);
  });
  it("returns 0 tax for income at 0", () => {
    const brackets = getIncomeBrackets("US", 2026, "single");
    const { tax, breakdown } = calculateProgressive(0, brackets);
    expect(tax).toBe(0);
    expect(breakdown).toHaveLength(0);
  });
  it("handles income within first bracket only", () => {
    const brackets = getIncomeBrackets("US", 2026, "single");
    const { tax, breakdown } = calculateProgressive(10000, brackets);
    expect(tax).toBe(1000); // 10% of 10,000
    expect(breakdown).toHaveLength(1);
  });
  it("handles income exactly at bracket boundary", () => {
    const brackets = getIncomeBrackets("US", 2026, "single");
    // $11,600 exactly — fully in 10% bracket
    const { tax, breakdown } = calculateProgressive(11600, brackets);
    expect(tax).toBe(1160);
    expect(breakdown).toHaveLength(1);
  });
  it("handles top-bracket income (above last threshold)", () => {
    const brackets = getIncomeBrackets("US", 2026, "single");
    const { tax, breakdown } = calculateProgressive(1_000_000, brackets);
    // All 7 brackets used
    expect(breakdown).toHaveLength(7);
    expect(tax).toBeGreaterThan(0);
  });
  it("returns 0 for negative input", () => {
    const brackets = getIncomeBrackets("US", 2026, "single");
    const { tax, breakdown } = calculateProgressive(-1000, brackets);
    expect(tax).toBe(0);
    expect(breakdown).toHaveLength(0);
  });
  it("calculates India ₹12L income tax correctly", () => {
    // ₹12L, India FY25-26 new regime
    // 0-3L: 0%
    // 3L-7L: 5% on ₹4L = ₹20,000
    // 7L-10L: 10% on ₹3L = ₹30,000
    // 10L-12L: 15% on ₹2L = ₹30,000
    // Total = ₹80,000
    const brackets = getIncomeBrackets("IN", 2026, "single");
    const { tax, breakdown } = calculateProgressive(1200000, brackets);
    expect(breakdown).toHaveLength(4);
    expect(tax).toBe(80000);
  });
});

describe("tax-calculator findMarginalRate", () => {
  it("returns rate of highest entered bracket", () => {
    const brackets = getIncomeBrackets("US", 2026, "single");
    expect(findMarginalRate(10000, brackets)).toBe(10);
    expect(findMarginalRate(50000, brackets)).toBe(22);
    expect(findMarginalRate(250000, brackets)).toBe(35);
    expect(findMarginalRate(1_000_000, brackets)).toBe(37);
  });
  it("returns 0 for income at 0", () => {
    const brackets = getIncomeBrackets("US", 2026, "single");
    expect(findMarginalRate(0, brackets)).toBe(0);
  });
});

describe("tax-calculator effectiveRate", () => {
  it("computes effective rate as tax/gross × 100", () => {
    expect(effectiveRate(17053, 100000)).toBe(17.05);
  });
  it("returns 0 for non-positive gross", () => {
    expect(effectiveRate(1000, 0)).toBe(0);
    expect(effectiveRate(1000, -100)).toBe(0);
  });
});

describe("tax-calculator calculateIncomeTax", () => {
  it("computes US 2026 single income tax with no deductions", () => {
    const input = sampleInput({ income: 100000 });
    const result = calculateIncomeTax(input);
    expect(result.totalTax).toBe(17053);
    expect(result.effectiveRate).toBe(17.05);
    expect(result.marginalRate).toBe(22);
    expect(result.netAmount).toBe(82947);
    expect(result.brackets).toHaveLength(3);
    expect(result.currencySymbol).toBe("$");
  });
  it("applies deductions before computing", () => {
    const input = sampleInput({ income: 100000, deductions: 12000 });
    const result = calculateIncomeTax(input);
    expect(result.taxableAmount).toBe(88000);
    // Recompute expected: 88000 - 47150 = 40850 in 22% bracket = 8987
    // Plus 11600 @ 10% = 1160 + 35550 @ 12% = 4266 = 5426
    // Total = 5426 + 8987 = 14413
    expect(result.totalTax).toBe(14413);
  });
  it("includes UK in notes", () => {
    const input = sampleInput({ country: "UK", income: 100000 });
    const result = calculateIncomeTax(input);
    expect(result.currencySymbol).toBe("£");
    expect(result.notes.some((n) => n.includes("UK"))).toBe(true);
  });
  it("handles India income tax", () => {
    const input = sampleInput({ country: "IN", income: 1200000 });
    const result = calculateIncomeTax(input);
    expect(result.currencySymbol).toBe("₹");
    expect(result.totalTax).toBe(80000);
  });
});

describe("tax-calculator calculateSalesTax", () => {
  it("calculates sales tax with US state lookup", () => {
    const input = sampleInput({
      taxType: "sales",
      country: "US",
      purchaseAmount: 100,
      stateOrRegion: "CA",
    });
    const result = calculateSalesTax(input);
    expect(result.totalTax).toBe(7.25); // CA 7.25%
    expect(result.netAmount).toBe(107.25);
    expect(result.effectiveRate).toBe(7.25);
    expect(result.notes[0]).toContain("CA");
  });
  it("falls back to default 7% for unknown state", () => {
    const input = sampleInput({
      taxType: "sales",
      country: "US",
      purchaseAmount: 100,
      stateOrRegion: "XX",
    });
    const result = calculateSalesTax(input);
    expect(result.totalTax).toBe(7);
    expect(result.notes[0]).toContain("unknown state");
  });
  it("uses default 7% when no state given", () => {
    const input = sampleInput({
      taxType: "sales",
      country: "US",
      purchaseAmount: 200,
      stateOrRegion: "",
    });
    const result = calculateSalesTax(input);
    expect(result.totalTax).toBe(14);
  });
  it("uses default 7% for non-US countries", () => {
    const input = sampleInput({
      taxType: "sales",
      country: "UK",
      purchaseAmount: 100,
    });
    const result = calculateSalesTax(input);
    expect(result.totalTax).toBe(7);
  });
  it("handles OR state with 0% rate", () => {
    const input = sampleInput({
      taxType: "sales",
      country: "US",
      purchaseAmount: 100,
      stateOrRegion: "OR",
    });
    const result = calculateSalesTax(input);
    expect(result.totalTax).toBe(0);
  });
});

describe("tax-calculator calculateVAT", () => {
  it("calculates UK VAT at 20%", () => {
    const input = sampleInput({
      taxType: "vat",
      country: "UK",
      purchaseAmount: 100,
    });
    const result = calculateVAT(input);
    expect(result.totalTax).toBe(20);
    expect(result.netAmount).toBe(120);
    expect(result.effectiveRate).toBe(20);
  });
  it("calculates DE VAT at 19%", () => {
    const input = sampleInput({
      taxType: "vat",
      country: "DE",
      purchaseAmount: 100,
    });
    const result = calculateVAT(input);
    expect(result.totalTax).toBe(19);
  });
  it("calculates IN GST at 18%", () => {
    const input = sampleInput({
      taxType: "vat",
      country: "IN",
      purchaseAmount: 1000,
    });
    const result = calculateVAT(input);
    expect(result.totalTax).toBe(180);
  });
  it("uses default 7% for US with note", () => {
    const input = sampleInput({
      taxType: "vat",
      country: "US",
      purchaseAmount: 100,
    });
    const result = calculateVAT(input);
    expect(result.totalTax).toBe(7);
    expect(result.notes.some((n) => n.includes("no federal VAT"))).toBe(true);
  });
});

describe("tax-calculator calculateCapitalGains", () => {
  it("computes US LT capital gains with progressive brackets", () => {
    const input = sampleInput({
      taxType: "capital-gains",
      country: "US",
      income: 100000,
      capitalGainsHoldingYears: 2, // long-term
    });
    const result = calculateCapitalGains(input);
    // US LT brackets single: 0% to $47,025, 15% to $518,900, 20% above
    // $100k: 0% on $47,025 = $0; 15% on ($100,000 - $47,025) = 15% × $52,975 = $7,946.25
    expect(result.totalTax).toBe(7946.25);
    expect(result.brackets).toHaveLength(2);
    expect(result.notes[0]).toContain("long-term");
  });
  it("computes US ST capital gains as ordinary income", () => {
    const input = sampleInput({
      taxType: "capital-gains",
      country: "US",
      income: 100000,
      capitalGainsHoldingYears: 1, // short-term
    });
    const result = calculateCapitalGains(input);
    expect(result.totalTax).toBe(17053); // same as ordinary income tax
    expect(result.notes[0]).toContain("short-term");
  });
  it("computes IN LT capital gains at flat 12.5%", () => {
    const input = sampleInput({
      taxType: "capital-gains",
      country: "IN",
      income: 100000,
      capitalGainsHoldingYears: 2,
    });
    const result = calculateCapitalGains(input);
    expect(result.totalTax).toBe(12500); // 12.5% of 100,000
    expect(result.brackets).toHaveLength(1);
    expect(result.brackets[0].rate).toBe(12.5);
  });
  it("computes FR capital gains at flat 30%", () => {
    const input = sampleInput({
      taxType: "capital-gains",
      country: "FR",
      income: 10000,
      capitalGainsHoldingYears: 5,
    });
    const result = calculateCapitalGains(input);
    expect(result.totalTax).toBe(3000); // 30% of 10,000
  });
  it("computes AU LT capital gains with 50% discount", () => {
    const input = sampleInput({
      taxType: "capital-gains",
      country: "AU",
      income: 200000,
      capitalGainsHoldingYears: 2,
    });
    const result = calculateCapitalGains(input);
    // 50% discount: taxable = 100,000
    // AU brackets: 0% to 18,200, 16% to 45,000, 30% to 135,000, 37% to 190,000, 45% above
    // 0% on 18,200 = 0
    // 16% on (45,000 - 18,200) = 16% × 26,800 = 4,288
    // 30% on (100,000 - 45,000) = 30% × 55,000 = 16,500
    // Total = 0 + 4288 + 16500 = 20,788
    expect(result.totalTax).toBe(20788);
    expect(result.notes.some((n) => n.includes("50% CGT discount"))).toBe(true);
  });
  it("applies deductions to the gain", () => {
    const input = sampleInput({
      taxType: "capital-gains",
      country: "FR",
      income: 10000,
      deductions: 2000,
      capitalGainsHoldingYears: 2,
    });
    const result = calculateCapitalGains(input);
    // Taxable = 8000, 30% = 2400
    expect(result.taxableAmount).toBe(8000);
    expect(result.totalTax).toBe(2400);
  });
});

describe("tax-calculator computeTax (dispatch)", () => {
  it("dispatches to income", () => {
    const result = computeTax(sampleInput({ taxType: "income", income: 50000 }));
    expect(result.taxType).toBe("income");
    expect(result.totalTax).toBeGreaterThan(0);
  });
  it("dispatches to sales", () => {
    const result = computeTax(sampleInput({ taxType: "sales", purchaseAmount: 100, stateOrRegion: "CA" }));
    expect(result.taxType).toBe("sales");
    expect(result.totalTax).toBe(7.25);
  });
  it("dispatches to vat", () => {
    const result = computeTax(sampleInput({ taxType: "vat", country: "UK", purchaseAmount: 100 }));
    expect(result.taxType).toBe("vat");
    expect(result.totalTax).toBe(20);
  });
  it("dispatches to capital-gains", () => {
    const result = computeTax(sampleInput({ taxType: "capital-gains", country: "IN", income: 100000, capitalGainsHoldingYears: 2 }));
    expect(result.taxType).toBe("capital-gains");
    expect(result.totalTax).toBe(12500);
  });
});

describe("tax-calculator formatCurrency", () => {
  it("formats positive number", () => {
    expect(formatCurrency(1234.5, "$")).toBe("$1234.50");
  });
  it("formats negative number", () => {
    expect(formatCurrency(-50, "€")).toBe("-€50.00");
  });
  it("supports multi-char symbols", () => {
    expect(formatCurrency(100, "A$")).toBe("A$100.00");
    expect(formatCurrency(100, "C$")).toBe("C$100.00");
  });
});

describe("tax-calculator renderText", () => {
  it("renders text with key fields", () => {
    const input = sampleInput({ income: 100000 });
    const result = computeTax(input);
    const text = renderText(result);
    expect(text).toContain("INCOME TAX");
    expect(text).toContain("United States");
    expect(text).toContain("Gross amount:");
    expect(text).toContain("Total tax:");
    expect(text).toContain("Effective rate:");
    expect(text).toContain("Marginal rate:");
    expect(text).toContain("Bracket");
    expect(text).toContain("Notes:");
  });
  it("renders sales tax result", () => {
    const input = sampleInput({ taxType: "sales", purchaseAmount: 100, stateOrRegion: "NY" });
    const result = computeTax(input);
    const text = renderText(result);
    expect(text).toContain("SALES TAX");
    expect(text).toContain("NY");
  });
});

describe("tax-calculator renderCsv", () => {
  it("renders CSV with bracket rows and metadata", () => {
    const input = sampleInput({ income: 100000 });
    const result = computeTax(input);
    const csv = renderCsv(result);
    expect(csv).toContain("bracket_index,rate_percent,taxable_from,taxable_to,taxable_amount,tax_amount");
    expect(csv).toContain("tax_type,income");
    expect(csv).toContain("country,US");
    expect(csv).toContain("currency,$");
    expect(csv).toContain(`total_tax,${result.totalTax.toFixed(2)}`);
    expect(csv).toContain("effective_rate,17.05");
  });
});

describe("tax-calculator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      taxType: "income",
      country: "US",
      grossAmount: 100000,
      totalTax: 17053,
      currencySymbol: "$",
      effectiveRate: 17.05,
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].totalTax).toBe(17053);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        taxType: "income",
        country: "US",
        grossAmount: i,
        totalTax: i,
        currencySymbol: "$",
        effectiveRate: 0,
      });
    }
    expect(loadHistory()).toHaveLength(20);
    // Most recent first
    expect(loadHistory()[0].ts).toBe(24);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      taxType: "income",
      country: "US",
      grossAmount: 100000,
      totalTax: 17053,
      currencySymbol: "$",
      effectiveRate: 17.05,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("tax-calculator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ taxType: "income", income: 100000 });
    expect(url).toContain("type=income");
    expect(url).toContain("income=100000");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const input = sampleInput({ income: 100000, deductions: 5000 });
    const url = buildShareUrl(input);
    const hash = url.includes("#") ? url.split("#")[1] : url.replace(/^\?/, "");
    const parsed = parseShareUrl(hash);
    expect(parsed.taxType).toBe("income");
    expect(parsed.country).toBe("US");
    expect(parsed.income).toBe(100000);
    expect(parsed.filingStatus).toBe("single");
    expect(parsed.taxYear).toBe(2026);
    expect(parsed.deductions).toBe(5000);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown tax type", () => {
    const parsed = parseShareUrl("type=wealth");
    expect(parsed.taxType).toBeUndefined();
  });
  it("filters unknown country", () => {
    const parsed = parseShareUrl("country=MX");
    expect(parsed.country).toBeUndefined();
  });
  it("filters unknown filing status", () => {
    const parsed = parseShareUrl("status=widow");
    expect(parsed.filingStatus).toBeUndefined();
  });
  it("filters invalid tax year", () => {
    const parsed = parseShareUrl("year=2030");
    expect(parsed.taxYear).toBeUndefined();
  });
  it("ignores non-numeric income", () => {
    const parsed = parseShareUrl("income=abc");
    expect(parsed.income).toBeUndefined();
  });
});

describe("tax-calculator summaryStats", () => {
  it("computes summary stats from result", () => {
    const input = sampleInput({ income: 100000 });
    const result = computeTax(input);
    const stats = summaryStats(result);
    expect(stats.grossAmount).toBe(100000);
    expect(stats.totalTax).toBe(17053);
    expect(stats.netAmount).toBe(82947);
    expect(stats.effectiveRate).toBe(17.05);
    expect(stats.marginalRate).toBe(22);
    expect(stats.bracketCount).toBe(3);
    expect(stats.taxType).toBe("income");
    expect(stats.country).toBe("US");
  });
  it("summary stats for sales tax", () => {
    const input = sampleInput({ taxType: "sales", purchaseAmount: 100, stateOrRegion: "CA" });
    const result = computeTax(input);
    const stats = summaryStats(result);
    expect(stats.totalTax).toBe(7.25);
    expect(stats.bracketCount).toBe(1); // single rate
    expect(stats.taxType).toBe("sales");
  });
});

// Suppress unused-import lint
export type _Unused = TaxType | Country | FilingStatus | TaxYear | CurrencySymbol;

/**
 * Tax Calculator — pure logic.
 *
 * Calculate income tax (progressive brackets), sales tax (US state),
 * VAT (country rate), and capital gains (LT/ST). Pure functions only.
 */

// ---- Types ----

export type TaxType = "income" | "sales" | "vat" | "capital-gains";
export type Country = "US" | "UK" | "IN" | "DE" | "FR" | "CA" | "AU";
export type FilingStatus = "single" | "married-jointly" | "head-of-household";
export type TaxYear = 2024 | 2025 | 2026;

export type CurrencySymbol = "$" | "€" | "£" | "₹" | "¥" | "A$" | "C$";

export interface Bracket {
  from: number;
  to: number | null; // null = open-ended top
  rate: number; // percent (e.g. 10 = 10%)
}

export interface BracketBreakdown {
  bracketIndex: number;
  rate: number;
  taxableFrom: number;
  taxableTo: number | null;
  taxableAmount: number;
  tax: number;
}

export interface TaxInput {
  taxType: TaxType;
  country: Country;
  income: number;
  purchaseAmount: number;
  filingStatus: FilingStatus;
  taxYear: TaxYear;
  deductions: number;
  stateOrRegion: string;
  capitalGainsHoldingYears: number;
}

export interface TaxResult {
  taxType: TaxType;
  country: Country;
  currencySymbol: CurrencySymbol;
  grossAmount: number;
  deductions: number;
  taxableAmount: number;
  totalTax: number;
  netAmount: number;
  effectiveRate: number;
  marginalRate: number;
  brackets: BracketBreakdown[];
  notes: string[];
}

export interface TaxHistoryEntry {
  ts: number;
  taxType: TaxType;
  country: Country;
  grossAmount: number;
  totalTax: number;
  currencySymbol: CurrencySymbol;
  effectiveRate: number;
}

export interface TaxSummaryStats {
  grossAmount: number;
  deductions: number;
  taxableAmount: number;
  totalTax: number;
  netAmount: number;
  effectiveRate: number;
  marginalRate: number;
  bracketCount: number;
  taxType: TaxType;
  country: Country;
}

// ---- Constants / Presets ----

export const TAX_TYPES: TaxType[] = ["income", "sales", "vat", "capital-gains"];
export const COUNTRIES: Country[] = ["US", "UK", "IN", "DE", "FR", "CA", "AU"];
export const FILING_STATUSES: FilingStatus[] = ["single", "married-jointly", "head-of-household"];
export const TAX_YEARS: TaxYear[] = [2024, 2025, 2026];

export const TAX_TYPE_LABELS: Record<TaxType, string> = {
  "income": "Income Tax",
  "sales": "Sales Tax",
  "vat": "VAT / GST",
  "capital-gains": "Capital Gains Tax",
};

export const COUNTRY_LABELS: Record<Country, string> = {
  "US": "United States",
  "UK": "United Kingdom",
  "IN": "India",
  "DE": "Germany",
  "FR": "France",
  "CA": "Canada",
  "AU": "Australia",
};

export const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  "single": "Single",
  "married-jointly": "Married Filing Jointly",
  "head-of-household": "Head of Household",
};

export const COUNTRY_CURRENCY: Record<Country, CurrencySymbol> = {
  "US": "$",
  "UK": "£",
  "IN": "₹",
  "DE": "€",
  "FR": "€",
  "CA": "C$",
  "AU": "A$",
};

export const CURRENCY_PRESETS: CurrencySymbol[] = ["$", "€", "£", "₹", "¥", "A$", "C$"];

/** US state sales tax rates (%). Default fallback is 7%. */
export const US_STATE_SALES_TAX: Record<string, number> = {
  "AL": 4,
  "AK": 0,
  "AZ": 5.6,
  "AR": 6.5,
  "CA": 7.25,
  "CO": 2.9,
  "CT": 6.35,
  "DE": 0,
  "FL": 6,
  "GA": 4,
  "HI": 4,
  "ID": 6,
  "IL": 6.25,
  "IN": 7,
  "IA": 6,
  "KS": 6.5,
  "KY": 6,
  "LA": 4.45,
  "ME": 5.5,
  "MD": 6,
  "MA": 6.25,
  "MI": 6,
  "MN": 6.875,
  "MS": 7,
  "MO": 4.225,
  "MT": 0,
  "NE": 5.5,
  "NV": 6.85,
  "NH": 0,
  "NJ": 6.625,
  "NM": 5.125,
  "NY": 8,
  "NC": 4.75,
  "ND": 5,
  "OH": 5.75,
  "OK": 4.5,
  "OR": 0,
  "PA": 6,
  "RI": 7,
  "SC": 6,
  "SD": 4.2,
  "TN": 7,
  "TX": 6.25,
  "UT": 4.85,
  "VT": 6,
  "VA": 4.3,
  "WA": 6.5,
  "WV": 6,
  "WI": 5,
  "WY": 4,
};

export const DEFAULT_SALES_TAX_RATE = 7;

/** VAT / GST rates per country (%). US has no federal VAT — uses sales tax instead. */
export const VAT_RATES: Record<Country, number> = {
  "US": 0, // n/a — use sales tax
  "UK": 20,
  "IN": 18, // GST
  "DE": 19,
  "FR": 20,
  "CA": 5, // GST (federal)
  "AU": 10, // GST
};

// ---- Income tax brackets ----

// US 2026 (canonical from task spec)
const US_2026_BRACKETS: Record<FilingStatus, Bracket[]> = {
  "single": [
    { from: 0, to: 11600, rate: 10 },
    { from: 11600, to: 47150, rate: 12 },
    { from: 47150, to: 100525, rate: 22 },
    { from: 100525, to: 191950, rate: 24 },
    { from: 191950, to: 243725, rate: 32 },
    { from: 243725, to: 609350, rate: 35 },
    { from: 609350, to: null, rate: 37 },
  ],
  "married-jointly": [
    { from: 0, to: 23200, rate: 10 },
    { from: 23200, to: 94300, rate: 12 },
    { from: 94300, to: 201050, rate: 22 },
    { from: 201050, to: 383900, rate: 24 },
    { from: 383900, to: 487450, rate: 32 },
    { from: 487450, to: 731200, rate: 35 },
    { from: 731200, to: null, rate: 37 },
  ],
  "head-of-household": [
    { from: 0, to: 16550, rate: 10 },
    { from: 16550, to: 63100, rate: 12 },
    { from: 63100, to: 100500, rate: 22 },
    { from: 100500, to: 191950, rate: 24 },
    { from: 191950, to: 243700, rate: 32 },
    { from: 243700, to: 609350, rate: 35 },
    { from: 609350, to: null, rate: 37 },
  ],
};

// US 2025 (≈3% lower thresholds than 2026)
const US_2025_BRACKETS: Record<FilingStatus, Bracket[]> = {
  "single": [
    { from: 0, to: 11257, rate: 10 },
    { from: 11257, to: 45797, rate: 12 },
    { from: 45797, to: 97604, rate: 22 },
    { from: 97604, to: 186328, rate: 24 },
    { from: 186328, to: 236551, rate: 32 },
    { from: 236551, to: 591631, rate: 35 },
    { from: 591631, to: null, rate: 37 },
  ],
  "married-jointly": [
    { from: 0, to: 22514, rate: 10 },
    { from: 22514, to: 91594, rate: 12 },
    { from: 91594, to: 195208, rate: 22 },
    { from: 195208, to: 372656, rate: 24 },
    { from: 372656, to: 473102, rate: 32 },
    { from: 473102, to: 709262, rate: 35 },
    { from: 709262, to: null, rate: 37 },
  ],
  "head-of-household": [
    { from: 0, to: 16054, rate: 10 },
    { from: 16054, to: 61207, rate: 12 },
    { from: 61207, to: 97485, rate: 22 },
    { from: 97485, to: 186328, rate: 24 },
    { from: 186328, to: 236551, rate: 32 },
    { from: 236551, to: 591631, rate: 35 },
    { from: 591631, to: null, rate: 37 },
  ],
};

// US 2024 (≈6% lower than 2026)
const US_2024_BRACKETS: Record<FilingStatus, Bracket[]> = {
  "single": [
    { from: 0, to: 10926, rate: 10 },
    { from: 10926, to: 44442, rate: 12 },
    { from: 44442, to: 94675, rate: 22 },
    { from: 94675, to: 180534, rate: 24 },
    { from: 180534, to: 229247, rate: 32 },
    { from: 229247, to: 574146, rate: 35 },
    { from: 574146, to: null, rate: 37 },
  ],
  "married-jointly": [
    { from: 0, to: 21852, rate: 10 },
    { from: 21852, to: 88884, rate: 12 },
    { from: 88884, to: 189350, rate: 22 },
    { from: 189350, to: 361068, rate: 24 },
    { from: 361068, to: 458494, rate: 32 },
    { from: 458494, to: 688292, rate: 35 },
    { from: 688292, to: null, rate: 37 },
  ],
  "head-of-household": [
    { from: 0, to: 15577, rate: 10 },
    { from: 15577, to: 59364, rate: 12 },
    { from: 59364, to: 94334, rate: 22 },
    { from: 94334, to: 180534, rate: 24 },
    { from: 180534, to: 229247, rate: 32 },
    { from: 229247, to: 574146, rate: 35 },
    { from: 574146, to: null, rate: 37 },
  ],
};

// UK 2026-27
const UK_BRACKETS: Bracket[] = [
  { from: 0, to: 12570, rate: 0 },
  { from: 12570, to: 50270, rate: 20 },
  { from: 50270, to: 125140, rate: 40 },
  { from: 125140, to: null, rate: 45 },
];

// India FY 2025-26 (new regime)
const IN_BRACKETS: Bracket[] = [
  { from: 0, to: 300000, rate: 0 },
  { from: 300000, to: 700000, rate: 5 },
  { from: 700000, to: 1000000, rate: 10 },
  { from: 1000000, to: 1200000, rate: 15 },
  { from: 1200000, to: 1500000, rate: 20 },
  { from: 1500000, to: null, rate: 30 },
];

// Germany 2024
const DE_BRACKETS: Bracket[] = [
  { from: 0, to: 11604, rate: 0 },
  { from: 11604, to: 17005, rate: 14 },
  { from: 17005, to: 66760, rate: 24 },
  { from: 66760, to: 277825, rate: 42 },
  { from: 277825, to: null, rate: 45 },
];

// France 2024
const FR_BRACKETS: Bracket[] = [
  { from: 0, to: 11294, rate: 0 },
  { from: 11294, to: 28797, rate: 11 },
  { from: 28797, to: 82341, rate: 30 },
  { from: 82341, to: 177106, rate: 41 },
  { from: 177106, to: null, rate: 45 },
];

// Canada Federal 2024
const CA_BRACKETS: Bracket[] = [
  { from: 0, to: 55867, rate: 15 },
  { from: 55867, to: 111733, rate: 20.5 },
  { from: 111733, to: 173205, rate: 26 },
  { from: 173205, to: 246752, rate: 29 },
  { from: 246752, to: null, rate: 33 },
];

// Australia 2024-25
const AU_BRACKETS: Bracket[] = [
  { from: 0, to: 18200, rate: 0 },
  { from: 18200, to: 45000, rate: 16 },
  { from: 45000, to: 135000, rate: 30 },
  { from: 135000, to: 190000, rate: 37 },
  { from: 190000, to: null, rate: 45 },
];

// US long-term capital gains brackets (2026, single)
const US_LT_CG_BRACKETS: Record<FilingStatus, Bracket[]> = {
  "single": [
    { from: 0, to: 47025, rate: 0 },
    { from: 47025, to: 518900, rate: 15 },
    { from: 518900, to: null, rate: 20 },
  ],
  "married-jointly": [
    { from: 0, to: 94050, rate: 0 },
    { from: 94050, to: 1033500, rate: 15 },
    { from: 1033500, to: null, rate: 20 },
  ],
  "head-of-household": [
    { from: 0, to: 63000, rate: 0 },
    { from: 63000, to: 551350, rate: 15 },
    { from: 551350, to: null, rate: 20 },
  ],
};

/** Country-specific long-term capital gains flat rate (where applicable). */
const LT_CG_FLAT_RATE: Partial<Record<Country, number>> = {
  "IN": 12.5,
  "DE": 26.375,
  "FR": 30,
};

// ---- Bracket lookup ----

/** Get income tax brackets for a country/year/filing status. */
export function getIncomeBrackets(
  country: Country,
  year: TaxYear,
  status: FilingStatus,
): Bracket[] {
  if (country === "US") {
    if (year === 2024) return US_2024_BRACKETS[status];
    if (year === 2025) return US_2025_BRACKETS[status];
    return US_2026_BRACKETS[status];
  }
  if (country === "UK") return UK_BRACKETS;
  if (country === "IN") return IN_BRACKETS;
  if (country === "DE") return DE_BRACKETS;
  if (country === "FR") return FR_BRACKETS;
  if (country === "CA") return CA_BRACKETS;
  if (country === "AU") return AU_BRACKETS;
  return US_2026_BRACKETS.single;
}

/** Get long-term capital gains brackets for US or fallback flat rate. */
export function getLongTermCapitalGainsBrackets(
  country: Country,
  status: FilingStatus,
): Bracket[] {
  if (country === "US") return US_LT_CG_BRACKETS[status];
  const flatRate = LT_CG_FLAT_RATE[country];
  if (flatRate !== undefined) {
    return [{ from: 0, to: null, rate: flatRate }];
  }
  // UK / CA / AU — use discount model (taxed at income tax rate on a portion).
  // We return the income brackets; computeCapitalGains handles the discount.
  if (country === "UK") return UK_BRACKETS;
  if (country === "CA") return CA_BRACKETS;
  if (country === "AU") return AU_BRACKETS;
  return US_LT_CG_BRACKETS.single;
}

// ---- Calculations ----

/** Subtract deductions from gross income. Floors at 0. */
export function applyDeductions(gross: number, deductions: number): number {
  const d = Number.isFinite(deductions) && deductions > 0 ? deductions : 0;
  return Math.max(0, round2(gross - d));
}

/** Calculate progressive tax on a taxable amount given brackets. */
export function calculateProgressive(taxable: number, brackets: Bracket[]): {
  tax: number;
  breakdown: BracketBreakdown[];
} {
  const t = Math.max(0, taxable);
  const breakdown: BracketBreakdown[] = [];
  let totalTax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const b = brackets[i];
    if (t <= b.from) break;
    const upper = b.to === null ? t : Math.min(t, b.to);
    const taxableInBracket = round2(upper - b.from);
    if (taxableInBracket <= 0) continue;
    const taxInBracket = round2(taxableInBracket * b.rate / 100);
    totalTax += taxInBracket;
    breakdown.push({
      bracketIndex: i,
      rate: b.rate,
      taxableFrom: b.from,
      taxableTo: b.to,
      taxableAmount: taxableInBracket,
      tax: taxInBracket,
    });
  }
  return { tax: round2(totalTax), breakdown };
}

/** Find the marginal tax rate (rate of the highest bracket entered). */
export function findMarginalRate(taxable: number, brackets: Bracket[]): number {
  const t = Math.max(0, taxable);
  let rate = 0;
  for (const b of brackets) {
    if (t > b.from) rate = b.rate;
    else break;
  }
  return rate;
}

/** Compute effective tax rate: tax / gross × 100. */
export function effectiveRate(tax: number, gross: number): number {
  if (!Number.isFinite(gross) || gross <= 0) return 0;
  return round2((tax / gross) * 100);
}

/** Income tax calculator. */
export function calculateIncomeTax(input: TaxInput): TaxResult {
  const currencySymbol = COUNTRY_CURRENCY[input.country];
  const brackets = getIncomeBrackets(input.country, input.taxYear, input.filingStatus);
  const gross = Number.isFinite(input.income) ? input.income : 0;
  const deductions = Number.isFinite(input.deductions) && input.deductions > 0 ? input.deductions : 0;
  const taxable = applyDeductions(gross, deductions);
  const { tax, breakdown } = calculateProgressive(taxable, brackets);
  const marginal = findMarginalRate(taxable, brackets);
  const notes: string[] = [];
  notes.push(`${COUNTRY_LABELS[input.country]} income tax, year ${input.taxYear}, ${FILING_STATUS_LABELS[input.filingStatus]}.`);
  if (deductions > 0) notes.push(`Deductions of ${formatCurrency(deductions, currencySymbol)} applied.`);
  if (input.country === "UK") {
    notes.push("Note: UK personal allowance taper above £100k income is not modeled.");
  }
  if (input.country === "IN") {
    notes.push("Note: India new regime rebate u/s 87A (up to ₹25,000 for income ≤ ₹7L) is not modeled.");
  }
  return {
    taxType: "income",
    country: input.country,
    currencySymbol,
    grossAmount: round2(gross),
    deductions: round2(deductions),
    taxableAmount: round2(taxable),
    totalTax: tax,
    netAmount: round2(gross - tax),
    effectiveRate: effectiveRate(tax, gross),
    marginalRate: marginal,
    brackets: breakdown,
    notes,
  };
}

/** Sales tax calculator (US state lookup or default 7%). */
export function calculateSalesTax(input: TaxInput): TaxResult {
  const currencySymbol = COUNTRY_CURRENCY[input.country];
  const gross = Number.isFinite(input.purchaseAmount) ? input.purchaseAmount : 0;
  let rate = DEFAULT_SALES_TAX_RATE;
  let regionLabel = "default 7%";
  if (input.country === "US" && input.stateOrRegion) {
    const code = input.stateOrRegion.trim().toUpperCase().slice(0, 2);
    const found = US_STATE_SALES_TAX[code];
    if (found !== undefined) {
      rate = found;
      regionLabel = `US state ${code}`;
    } else {
      regionLabel = `unknown state "${input.stateOrRegion}" — default 7%`;
    }
  } else if (input.country !== "US") {
    regionLabel = `${COUNTRY_LABELS[input.country]} (using default 7%)`;
  }
  const tax = round2(gross * rate / 100);
  const breakdown: BracketBreakdown[] = [
    {
      bracketIndex: 0,
      rate,
      taxableFrom: 0,
      taxableTo: null,
      taxableAmount: round2(gross),
      tax,
    },
  ];
  const marginal = rate;
  const notes = [
    `Sales tax rate: ${rate}% (${regionLabel}).`,
    `No deduction applied — sales tax is on the purchase amount.`,
  ];
  return {
    taxType: "sales",
    country: input.country,
    currencySymbol,
    grossAmount: round2(gross),
    deductions: 0,
    taxableAmount: round2(gross),
    totalTax: tax,
    netAmount: round2(gross + tax),
    effectiveRate: rate,
    marginalRate: marginal,
    brackets: breakdown,
    notes,
  };
}

/** VAT calculator (country-specific rate). */
export function calculateVAT(input: TaxInput): TaxResult {
  const currencySymbol = COUNTRY_CURRENCY[input.country];
  const gross = Number.isFinite(input.purchaseAmount) ? input.purchaseAmount : 0;
  let rate: number;
  if (input.country === "US") {
    rate = DEFAULT_SALES_TAX_RATE;
  } else {
    rate = VAT_RATES[input.country];
  }
  const tax = round2(gross * rate / 100);
  const breakdown: BracketBreakdown[] = [
    {
      bracketIndex: 0,
      rate,
      taxableFrom: 0,
      taxableTo: null,
      taxableAmount: round2(gross),
      tax,
    },
  ];
  const notes: string[] = [];
  if (input.country === "US") {
    notes.push("US has no federal VAT — using default sales tax rate (7%).");
    notes.push("Switch tax type to 'Sales Tax' for per-state lookup.");
  } else {
    notes.push(`${COUNTRY_LABELS[input.country]} ${rate}% ${rate === 18 ? "GST" : rate === 5 ? "GST (federal)" : rate === 10 ? "GST" : "VAT"} applied to net amount.`);
    notes.push("Note: this computes VAT added to a net price. To extract VAT from a gross price, divide by (1 + rate/100).");
  }
  return {
    taxType: "vat",
    country: input.country,
    currencySymbol,
    grossAmount: round2(gross),
    deductions: 0,
    taxableAmount: round2(gross),
    totalTax: tax,
    netAmount: round2(gross + tax),
    effectiveRate: rate,
    marginalRate: rate,
    brackets: breakdown,
    notes,
  };
}

/** Capital gains calculator (long-term vs short-term). */
export function calculateCapitalGains(input: TaxInput): TaxResult {
  const currencySymbol = COUNTRY_CURRENCY[input.country];
  const grossGain = Number.isFinite(input.income) ? input.income : 0;
  const deductions = Number.isFinite(input.deductions) && input.deductions > 0 ? input.deductions : 0;
  const holdingYears = Number.isFinite(input.capitalGainsHoldingYears) ? input.capitalGainsHoldingYears : 0;
  const isLongTerm = holdingYears > 1;
  const taxable = applyDeductions(grossGain, deductions);
  let tax = 0;
  let breakdown: BracketBreakdown[] = [];
  let marginal = 0;
  let appliedRate = 0;
  const notes: string[] = [];

  if (input.country === "US") {
    if (isLongTerm) {
      const ltBrackets = US_LT_CG_BRACKETS[input.filingStatus];
      const r = calculateProgressive(taxable, ltBrackets);
      tax = r.tax;
      breakdown = r.breakdown;
      marginal = findMarginalRate(taxable, ltBrackets);
      appliedRate = marginal;
      notes.push(`US long-term capital gains (held ${holdingYears} years > 1yr).`);
      notes.push(`Filing status: ${FILING_STATUS_LABELS[input.filingStatus]}.`);
    } else {
      // short-term = ordinary income
      const incomeBrackets = getIncomeBrackets(input.country, input.taxYear, input.filingStatus);
      const r = calculateProgressive(taxable, incomeBrackets);
      tax = r.tax;
      breakdown = r.breakdown;
      marginal = findMarginalRate(taxable, incomeBrackets);
      appliedRate = marginal;
      notes.push(`US short-term capital gains (held ${holdingYears} years ≤ 1yr) — taxed as ordinary income.`);
    }
  } else if (input.country === "UK") {
    // UK CGT: LT (>1yr... technically all gains are CGT, but rates differ)
    // For simplicity: 10% (basic) / 20% (higher) — modeled on the gain itself
    if (isLongTerm) {
      // Approximate: 10% on first £50,270 of (income + gain), 20% above
      const r = calculateProgressive(taxable, [
        { from: 0, to: 50270, rate: 10 },
        { from: 50270, to: null, rate: 20 },
      ]);
      tax = r.tax;
      breakdown = r.breakdown;
      marginal = findMarginalRate(taxable, r.breakdown.length > 0 ? [{ from: 0, to: 50270, rate: 10 }, { from: 50270, to: null, rate: 20 }] : []);
      appliedRate = marginal;
      notes.push(`UK CGT — 10% basic rate / 20% higher rate on gains above personal allowance.`);
    } else {
      // Short-term property/BTC gains: 18% / 24%
      const r = calculateProgressive(taxable, [
        { from: 0, to: 50270, rate: 18 },
        { from: 50270, to: null, rate: 24 },
      ]);
      tax = r.tax;
      breakdown = r.breakdown;
      marginal = findMarginalRate(taxable, [{ from: 0, to: 50270, rate: 18 }, { from: 50270, to: null, rate: 24 }]);
      appliedRate = marginal;
      notes.push(`UK short-term (residential property) CGT — 18% / 24%.`);
    }
    notes.push("Note: UK £3,000 annual exempt amount not modeled.");
  } else if (input.country === "IN") {
    // India: LT 12.5% (listed equity >1yr, >₹1.25L exempt); ST 20% (equity <12mo) or income rate
    if (isLongTerm) {
      appliedRate = 12.5;
      tax = round2(taxable * 12.5 / 100);
      breakdown = [{
        bracketIndex: 0,
        rate: 12.5,
        taxableFrom: 0,
        taxableTo: null,
        taxableAmount: round2(taxable),
        tax,
      }];
      marginal = 12.5;
      notes.push(`India LT capital gains — 12.5% on listed equity/securities held > 12 months.`);
    } else {
      appliedRate = 20;
      tax = round2(taxable * 20 / 100);
      breakdown = [{
        bracketIndex: 0,
        rate: 20,
        taxableFrom: 0,
        taxableTo: null,
        taxableAmount: round2(taxable),
        tax,
      }];
      marginal = 20;
      notes.push(`India ST capital gains — 20% on listed equity held ≤ 12 months.`);
    }
    notes.push("Note: ₹1.25L annual exemption on listed equity LT gains not modeled.");
  } else if (input.country === "DE") {
    if (isLongTerm) {
      appliedRate = 26.375;
      tax = round2(taxable * 26.375 / 100);
      breakdown = [{
        bracketIndex: 0,
        rate: 26.375,
        taxableFrom: 0,
        taxableTo: null,
        taxableAmount: round2(taxable),
        tax,
      }];
      marginal = 26.375;
      notes.push(`Germany LT capital gains — flat 26.375% (incl. solidarity surcharge).`);
    } else {
      // ST = ordinary income
      const incomeBrackets = DE_BRACKETS;
      const r = calculateProgressive(taxable, incomeBrackets);
      tax = r.tax;
      breakdown = r.breakdown;
      marginal = findMarginalRate(taxable, incomeBrackets);
      appliedRate = marginal;
      notes.push(`Germany ST capital gains — taxed as ordinary income.`);
    }
  } else if (input.country === "FR") {
    // France: flat 30% PFU for both
    appliedRate = 30;
    tax = round2(taxable * 30 / 100);
    breakdown = [{
      bracketIndex: 0,
      rate: 30,
      taxableFrom: 0,
      taxableTo: null,
      taxableAmount: round2(taxable),
      tax,
    }];
    marginal = 30;
    notes.push(`France flat 30% PFU (prélèvement forfaitaire unique) on capital gains.`);
  } else if (input.country === "CA") {
    // Canada: 50% inclusion rate (LT and ST same; LT designation only)
    const inclusionRate = 0.5;
    const included = round2(taxable * inclusionRate);
    const incomeBrackets = CA_BRACKETS;
    const r = calculateProgressive(included, incomeBrackets);
    tax = r.tax;
    breakdown = r.breakdown.map((b) => ({
      ...b,
      taxableAmount: round2(b.taxableAmount),
      // Show original gain portion in taxableFrom/to for transparency
    }));
    marginal = findMarginalRate(included, incomeBrackets);
    appliedRate = marginal * inclusionRate;
    notes.push(`Canada capital gains — 50% inclusion rate (${formatCurrency(included, currencySymbol)} of ${formatCurrency(taxable, currencySymbol)} taxed at income rate).`);
    notes.push(`Effective rate on full gain: ${effectiveRate(tax, taxable).toFixed(2)}%.`);
  } else if (input.country === "AU") {
    // Australia: 50% CGT discount for LT (>12mo)
    if (isLongTerm) {
      const discount = 0.5;
      const included = round2(taxable * (1 - discount));
      const incomeBrackets = AU_BRACKETS;
      const r = calculateProgressive(included, incomeBrackets);
      tax = r.tax;
      breakdown = r.breakdown;
      marginal = findMarginalRate(included, incomeBrackets);
      appliedRate = marginal * (1 - discount);
      notes.push(`Australia LT capital gains — 50% CGT discount (${formatCurrency(included, currencySymbol)} of ${formatCurrency(taxable, currencySymbol)} taxed at income rate).`);
    } else {
      const incomeBrackets = AU_BRACKETS;
      const r = calculateProgressive(taxable, incomeBrackets);
      tax = r.tax;
      breakdown = r.breakdown;
      marginal = findMarginalRate(taxable, incomeBrackets);
      appliedRate = marginal;
      notes.push(`Australia ST capital gains — taxed as ordinary income (no discount).`);
    }
  }

  if (deductions > 0) {
    notes.push(`Deductions of ${formatCurrency(deductions, currencySymbol)} applied to the gain.`);
  }

  return {
    taxType: "capital-gains",
    country: input.country,
    currencySymbol,
    grossAmount: round2(grossGain),
    deductions: round2(deductions),
    taxableAmount: round2(taxable),
    totalTax: round2(tax),
    netAmount: round2(grossGain - tax),
    effectiveRate: effectiveRate(tax, grossGain),
    marginalRate: marginal,
    brackets: breakdown,
    notes,
  };
}

/** Compute tax based on input (dispatch by taxType). */
export function computeTax(input: TaxInput): TaxResult {
  switch (input.taxType) {
    case "income": return calculateIncomeTax(input);
    case "sales": return calculateSalesTax(input);
    case "vat": return calculateVAT(input);
    case "capital-gains": return calculateCapitalGains(input);
  }
}

// ---- Formatting ----

/** Format a number as currency string. */
export function formatCurrency(amount: number, symbol: CurrencySymbol): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  return `${sign}${symbol}${abs.toFixed(2)}`;
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- Renderers ----

/** Render tax result as plain text. */
export function renderText(result: TaxResult): string {
  const cur = (n: number) => formatCurrency(n, result.currencySymbol);
  const L: string[] = [];
  L.push("=".repeat(60));
  L.push(`${TAX_TYPE_LABELS[result.taxType].toUpperCase()} — ${COUNTRY_LABELS[result.country]}`);
  L.push("=".repeat(60));
  L.push("");
  L.push(`Gross amount:    ${cur(result.grossAmount)}`);
  if (result.deductions > 0) {
    L.push(`Deductions:      -${cur(result.deductions)}`);
  }
  L.push(`Taxable amount:  ${cur(result.taxableAmount)}`);
  L.push(`Total tax:       ${cur(result.totalTax)}`);
  L.push(`Net amount:      ${cur(result.netAmount)}`);
  L.push(`Effective rate:  ${result.effectiveRate.toFixed(2)}%`);
  L.push(`Marginal rate:   ${result.marginalRate.toFixed(2)}%`);
  L.push("");

  if (result.brackets.length > 0) {
    L.push("-".repeat(60));
    L.push("Bracket".padEnd(10) + "Rate".padStart(8) + "Taxable".padStart(22) + "Tax".padStart(20));
    L.push("-".repeat(60));
    result.brackets.forEach((b) => {
      const fromStr = cur(b.taxableFrom);
      const toStr = b.taxableTo === null ? "+" : ` to ${cur(b.taxableTo)}`;
      const bracketLabel = `${fromStr}${toStr}`.slice(0, 30);
      L.push(
        bracketLabel.padEnd(30) +
        `${b.rate}%`.padStart(8) +
        cur(b.taxableAmount).padStart(12) +
        cur(b.tax).padStart(10),
      );
    });
    L.push("-".repeat(60));
  }

  if (result.notes.length > 0) {
    L.push("");
    L.push("Notes:");
    for (const n of result.notes) L.push(`  • ${n}`);
  }
  return L.join("\n");
}

/** Render tax result as CSV. */
export function renderCsv(result: TaxResult): string {
  const lines: string[] = [];
  lines.push("bracket_index,rate_percent,taxable_from,taxable_to,taxable_amount,tax_amount");
  for (const b of result.brackets) {
    lines.push([
      String(b.bracketIndex),
      String(b.rate),
      b.taxableFrom.toFixed(2),
      b.taxableTo === null ? "" : b.taxableTo.toFixed(2),
      b.taxableAmount.toFixed(2),
      b.tax.toFixed(2),
    ].join(","));
  }
  lines.push("");
  lines.push(`tax_type,${result.taxType}`);
  lines.push(`country,${result.country}`);
  lines.push(`currency,${escapeCsv(result.currencySymbol)}`);
  lines.push(`gross_amount,${result.grossAmount.toFixed(2)}`);
  lines.push(`deductions,${result.deductions.toFixed(2)}`);
  lines.push(`taxable_amount,${result.taxableAmount.toFixed(2)}`);
  lines.push(`total_tax,${result.totalTax.toFixed(2)}`);
  lines.push(`net_amount,${result.netAmount.toFixed(2)}`);
  lines.push(`effective_rate,${result.effectiveRate}`);
  lines.push(`marginal_rate,${result.marginalRate}`);
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:tax-calculator:history";
const HISTORY_MAX = 20;

export function loadHistory(): TaxHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as TaxHistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: TaxHistoryEntry): TaxHistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---- Shareable URL ----

export function buildShareUrl(input: Partial<TaxInput>): string {
  const params = new URLSearchParams();
  if (input.taxType) params.set("type", input.taxType);
  if (input.country) params.set("country", input.country);
  if (input.income !== undefined) params.set("income", String(input.income));
  if (input.purchaseAmount !== undefined) params.set("purchase", String(input.purchaseAmount));
  if (input.filingStatus) params.set("status", input.filingStatus);
  if (input.taxYear) params.set("year", String(input.taxYear));
  if (input.deductions !== undefined) params.set("ded", String(input.deductions));
  if (input.stateOrRegion) params.set("state", input.stateOrRegion);
  if (input.capitalGainsHoldingYears !== undefined) params.set("hold", String(input.capitalGainsHoldingYears));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<TaxInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<TaxInput> = {};
  const type = params.get("type") as TaxType | null;
  if (type && TAX_TYPES.includes(type)) out.taxType = type;
  const country = params.get("country") as Country | null;
  if (country && COUNTRIES.includes(country)) out.country = country;
  const income = params.get("income");
  if (income !== null) {
    const n = Number(income);
    if (Number.isFinite(n)) out.income = n;
  }
  const purchase = params.get("purchase");
  if (purchase !== null) {
    const n = Number(purchase);
    if (Number.isFinite(n)) out.purchaseAmount = n;
  }
  const status = params.get("status") as FilingStatus | null;
  if (status && FILING_STATUSES.includes(status)) out.filingStatus = status;
  const year = params.get("year");
  if (year !== null) {
    const n = Number(year);
    if (n === 2024 || n === 2025 || n === 2026) out.taxYear = n as TaxYear;
  }
  const ded = params.get("ded");
  if (ded !== null) {
    const n = Number(ded);
    if (Number.isFinite(n)) out.deductions = n;
  }
  if (params.get("state")) out.stateOrRegion = params.get("state")!;
  const hold = params.get("hold");
  if (hold !== null) {
    const n = Number(hold);
    if (Number.isFinite(n)) out.capitalGainsHoldingYears = n;
  }
  return out;
}

// ---- Summary stats ----

export function summaryStats(result: TaxResult): TaxSummaryStats {
  return {
    grossAmount: result.grossAmount,
    deductions: result.deductions,
    taxableAmount: result.taxableAmount,
    totalTax: result.totalTax,
    netAmount: result.netAmount,
    effectiveRate: result.effectiveRate,
    marginalRate: result.marginalRate,
    bracketCount: result.brackets.length,
    taxType: result.taxType,
    country: result.country,
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Tax Calculator Pro — pure logic.
 * Brackets (US/UK/IN/AU), deductions, credits, effective rate, multi-year.
 */

export interface TaxBracket {
  upTo: number; // upper bound (exclusive). Infinity for the last bracket.
  rate: number; // 0..1
}

export interface TaxSystem {
  id: string;
  name: string;
  country: string;
  taxYear: number;
  brackets: TaxBracket[];
  standardDeduction: number;
  notes: string;
}

export const TAX_SYSTEMS: TaxSystem[] = [
  {
    id: "us-2024-single",
    name: "US Federal 2024 (Single)",
    country: "US",
    taxYear: 2024,
    brackets: [
      { upTo: 11600, rate: 0.1 },
      { upTo: 47150, rate: 0.12 },
      { upTo: 100525, rate: 0.22 },
      { upTo: 191950, rate: 0.24 },
      { upTo: 243725, rate: 0.32 },
      { upTo: 609350, rate: 0.35 },
      { upTo: Infinity, rate: 0.37 },
    ],
    standardDeduction: 14600,
    notes: "Single filer 2024 federal brackets. State tax not included.",
  },
  {
    id: "uk-2024",
    name: "UK Income Tax 2024-25 (England)",
    country: "UK",
    taxYear: 2024,
    brackets: [
      { upTo: 12570, rate: 0 },
      { upTo: 50270, rate: 0.2 },
      { upTo: 125140, rate: 0.4 },
      { upTo: Infinity, rate: 0.45 },
    ],
    standardDeduction: 0,
    notes: "Personal allowance £12,570. Scotland has different bands.",
  },
  {
    id: "in-2024-new",
    name: "India New Tax Regime 2024-25",
    country: "IN",
    taxYear: 2024,
    brackets: [
      { upTo: 300000, rate: 0 },
      { upTo: 700000, rate: 0.05 },
      { upTo: 1000000, rate: 0.1 },
      { upTo: 1200000, rate: 0.15 },
      { upTo: 1500000, rate: 0.2 },
      { upTo: Infinity, rate: 0.3 },
    ],
    standardDeduction: 75000,
    notes: "New regime default from AY 2024-25. Old regime has different slabs.",
  },
  {
    id: "au-2024",
    name: "Australia FY2024-25 (Resident)",
    country: "AU",
    taxYear: 2024,
    brackets: [
      { upTo: 18200, rate: 0 },
      { upTo: 45000, rate: 0.16 },
      { upTo: 135000, rate: 0.30 },
      { upTo: 190000, rate: 0.37 },
      { upTo: Infinity, rate: 0.45 },
    ],
    standardDeduction: 0,
    notes: "Excludes Medicare levy (2%) and LITO.",
  },
];

export function getAllTaxSystems(): TaxSystem[] {
  return [...TAX_SYSTEMS];
}

export function getTaxSystemById(id: string): TaxSystem | null {
  return TAX_SYSTEMS.find((t) => t.id === id) ?? null;
}

export function getTaxSystemsByCountry(country: string): TaxSystem[] {
  return TAX_SYSTEMS.filter((t) => t.country === country.toUpperCase());
}

/** Taxable income = max(0, grossIncome - deductions). */
export function taxableIncome(grossIncome: number, deductions: number): number {
  return Math.max(0, grossIncome - deductions);
}

/** Progressive tax calculation across brackets. */
export function calculateTax(taxableAmount: number, brackets: TaxBracket[]): number {
  if (taxableAmount <= 0) return 0;
  let tax = 0;
  let lower = 0;
  for (const b of brackets) {
    if (taxableAmount <= lower) break;
    const slab = Math.min(taxableAmount, b.upTo) - lower;
    if (slab > 0) tax += slab * b.rate;
    lower = b.upTo;
  }
  return tax;
}

/** Marginal rate = rate of the bracket the taxable income falls into. */
export function marginalRate(taxableAmount: number, brackets: TaxBracket[]): number {
  let lower = 0;
  for (const b of brackets) {
    if (taxableAmount >= lower && taxableAmount < b.upTo) return b.rate;
    lower = b.upTo;
  }
  // Falls in last bracket (taxableAmount >= last bracket's lower bound)
  return brackets[brackets.length - 1]?.rate ?? 0;
}

export interface TaxBreakdown {
  grossIncome: number;
  deductions: number;
  taxableIncome: number;
  taxBeforeCredits: number;
  credits: number;
  totalTax: number;
  afterTaxIncome: number;
  effectiveRate: number; // 0..1
  marginalRate: number; // 0..1
  perBracket: Array<{ range: string; rate: number; amount: number }>;
}

export function computeBreakdown(
  system: TaxSystem,
  grossIncome: number,
  extraDeductions = 0,
  credits = 0,
): TaxBreakdown {
  const deductions = system.standardDeduction + extraDeductions;
  const taxable = taxableIncome(grossIncome, deductions);
  const taxBeforeCredits = calculateTax(taxable, system.brackets);
  const totalTax = Math.max(0, taxBeforeCredits - credits);
  const afterTaxIncome = grossIncome - totalTax;
  const effectiveRate = grossIncome > 0 ? totalTax / grossIncome : 0;
  const marginal = marginalRate(taxable, system.brackets);
  const perBracket: Array<{ range: string; rate: number; amount: number }> = [];
  let lower = 0;
  for (const b of system.brackets) {
    if (taxable <= lower) break;
    const slab = Math.min(taxable, b.upTo) - lower;
    perBracket.push({
      range: `${lower.toLocaleString()} – ${b.upTo === Infinity ? "∞" : b.upTo.toLocaleString()}`,
      rate: b.rate,
      amount: slab > 0 ? slab * b.rate : 0,
    });
    lower = b.upTo;
  }
  return {
    grossIncome,
    deductions,
    taxableIncome: taxable,
    taxBeforeCredits,
    credits,
    totalTax,
    afterTaxIncome,
    effectiveRate,
    marginalRate: marginal,
    perBracket,
  };
}

/** Multi-year projection assuming flat income growth. */
export function multiYearProjection(
  system: TaxSystem,
  grossIncome: number,
  years: number,
  annualGrowthRate = 0.03,
  extraDeductions = 0,
  credits = 0,
): Array<{ year: number; income: number; tax: number; afterTax: number; effectiveRate: number }> {
  const out: Array<{ year: number; income: number; tax: number; afterTax: number; effectiveRate: number }> = [];
  let income = grossIncome;
  for (let i = 0; i < years; i++) {
    const b = computeBreakdown(system, income, extraDeductions, credits);
    out.push({ year: system.taxYear + i, income, tax: b.totalTax, afterTax: b.afterTaxIncome, effectiveRate: b.effectiveRate });
    income *= 1 + annualGrowthRate;
  }
  return out;
}

/** Validate inputs. */
export function validateInputs(grossIncome: number, extraDeductions: number, credits: number): string[] {
  const w: string[] = [];
  if (grossIncome < 0) w.push("Gross income cannot be negative.");
  if (extraDeductions < 0) w.push("Extra deductions cannot be negative.");
  if (credits < 0) w.push("Credits cannot be negative.");
  if (credits > grossIncome) w.push("Credits exceed gross income — likely an error.");
  return w;
}

/** Export breakdown as CSV. */
export function exportBreakdownCSV(b: TaxBreakdown): string {
  const header = ["field", "value"];
  const rows = [
    ["gross_income", b.grossIncome.toFixed(2)],
    ["deductions", b.deductions.toFixed(2)],
    ["taxable_income", b.taxableIncome.toFixed(2)],
    ["tax_before_credits", b.taxBeforeCredits.toFixed(2)],
    ["credits", b.credits.toFixed(2)],
    ["total_tax", b.totalTax.toFixed(2)],
    ["after_tax_income", b.afterTaxIncome.toFixed(2)],
    ["effective_rate", b.effectiveRate.toFixed(4)],
    ["marginal_rate", b.marginalRate.toFixed(4)],
    ["", ""],
    ["bracket_range", "rate", "amount"],
  ];
  const lines = [header.join(","), ...rows.map((r) => r.join(","))];
  for (const p of b.perBracket) {
    lines.push(`"${p.range}",${p.rate.toFixed(4)},${p.amount.toFixed(2)}`);
  }
  return lines.join("\n");
}

/** Export as plain text. */
export function exportBreakdownText(b: TaxBreakdown, systemName: string): string {
  return [
    `TAX BREAKDOWN — ${systemName}`,
    `Gross income:        ${b.grossIncome.toLocaleString()}`,
    `Deductions:          ${b.deductions.toLocaleString()}`,
    `Taxable income:      ${b.taxableIncome.toLocaleString()}`,
    `Tax before credits:  ${b.taxBeforeCredits.toLocaleString()}`,
    `Credits:             ${b.credits.toLocaleString()}`,
    `Total tax:           ${b.totalTax.toLocaleString()}`,
    `After-tax income:    ${b.afterTaxIncome.toLocaleString()}`,
    `Effective rate:      ${(b.effectiveRate * 100).toFixed(2)}%`,
    `Marginal rate:       ${(b.marginalRate * 100).toFixed(2)}%`,
    ``,
    `Per bracket:`,
    ...b.perBracket.map((p) => `  ${p.range}: ${(p.rate * 100).toFixed(1)}% → ${p.amount.toLocaleString()}`),
  ].join("\n");
}

/** Compute take-home monthly. */
export function monthlyTakeHome(b: TaxBreakdown): number {
  return b.afterTaxIncome / 12;
}

/** Compare two systems for the same gross income. */
export function compareSystems(grossIncome: number, systemIds: string[], extraDeductions = 0, credits = 0): Array<{ system: string; totalTax: number; effectiveRate: number }> {
  return systemIds
    .map((id) => {
      const sys = getTaxSystemById(id);
      if (!sys) return null;
      const b = computeBreakdown(sys, grossIncome, extraDeductions, credits);
      return { system: sys.name, totalTax: b.totalTax, effectiveRate: b.effectiveRate };
    })
    .filter((x): x is { system: string; totalTax: number; effectiveRate: number } => x !== null);
}

/** Effective rate from raw tax and gross. */
export function effectiveRate(tax: number, gross: number): number {
  return gross > 0 ? tax / gross : 0;
}

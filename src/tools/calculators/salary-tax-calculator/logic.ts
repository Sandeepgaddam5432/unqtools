/**
 * Salary Tax Calculator — pure logic.
 *
 * Computes income tax, national insurance / social security, net pay,
 * and effective rate for three jurisdictions (US federal, UK, India).
 * Brackets are simplified to the most recent public data and are not
 * a substitute for professional tax advice.
 *
 * Supported:
 *   • US: 2024 federal brackets, standard deduction, FICA (SS + Medicare)
 *   • UK: 2024/25 England bands, Personal Allowance, NI (Class 1, 8%)
 *   • IN: FY 2024-25 new regime slabs + standard deduction + cess
 */

export type Jurisdiction = "US" | "UK" | "IN";

export interface TaxInput {
  jurisdiction: Jurisdiction;
  /** Gross annual income in the local currency. */
  grossIncome: number;
  /** Age (affects some allowances, e.g. UK additional personal allowance). */
  age?: number;
  /** Pre-tax deductions (e.g. pension contributions, 401k). */
  deductions?: number;
}

export interface TaxBand {
  label: string;
  rate: number; // decimal (0.20 = 20%)
  from: number;
  to: number | null; // null = open-ended
  tax: number;
}

export interface TaxResult {
  jurisdiction: Jurisdiction;
  currency: string;
  grossIncome: number;
  taxableIncome: number;
  incomeTax: number;
  socialSecurity: number;
  totalTax: number;
  netPay: number;
  effectiveRate: number; // decimal
  marginalRate: number; // decimal
  bands: TaxBand[];
  notes: string[];
  warnings: string[];
}

const round = (n: number) => Math.round(n * 100) / 100;

function applyBands(taxable: number, bands: { rate: number; upTo: number | null }[]): TaxBand[] {
  const out: TaxBand[] = [];
  let remaining = taxable;
  let prevCap = 0;
  const labels = ["Starter", "Basic", "Mid", "Higher", "Top", "Additional"];
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i]!;
    const cap = b.upTo === null ? Infinity : b.upTo;
    const width = cap - prevCap;
    if (width <= 0) continue;
    const taxedHere = Math.min(remaining, width);
    if (taxedHere > 0) {
      out.push({
        label: labels[i] ?? `Band ${i + 1}`,
        rate: b.rate,
        from: prevCap,
        to: b.upTo,
        tax: round(taxedHere * b.rate),
      });
    }
    remaining -= taxedHere;
    prevCap = cap;
    if (remaining <= 0) break;
  }
  return out;
}

function marginalRate(taxable: number, bands: { rate: number; upTo: number | null }[]): number {
  let prevCap = 0;
  for (const b of bands) {
    const cap = b.upTo === null ? Infinity : b.upTo;
    if (taxable > prevCap && taxable <= cap) return b.rate;
    prevCap = cap;
  }
  return bands[bands.length - 1]?.rate ?? 0;
}

/** US 2024 federal brackets (single filer) + standard deduction + FICA. */
function calculateUs(input: TaxInput): TaxResult {
  const warnings: string[] = [];
  const stdDeduction = 14600; // 2024 single
  const preTax = input.deductions ?? 0;
  const taxableIncome = Math.max(0, input.grossIncome - stdDeduction - preTax);
  const bands = [
    { rate: 0.10, upTo: 11600 },
    { rate: 0.12, upTo: 47150 },
    { rate: 0.22, upTo: 100525 },
    { rate: 0.24, upTo: 191950 },
    { rate: 0.32, upTo: 243725 },
    { rate: 0.35, upTo: 609350 },
    { rate: 0.37, upTo: null },
  ];
  const applied = applyBands(taxableIncome, bands);
  const incomeTax = round(applied.reduce((s, b) => s + b.tax, 0));
  // FICA: Social Security 6.2% up to wage cap (2024: $168,600) + Medicare 1.45%
  const ssCap = 168600;
  const socialSecurity = round(Math.min(input.grossIncome, ssCap) * 0.062 + input.grossIncome * 0.0145);
  const totalTax = round(incomeTax + socialSecurity);
  const netPay = round(input.grossIncome - totalTax);
  const notes = [
    `Standard deduction (single, 2024): $${stdDeduction.toLocaleString()}`,
    `FICA: 6.2% Social Security (cap $${ssCap.toLocaleString()}) + 1.45% Medicare`,
  ];
  if (input.grossIncome > ssCap) notes.push("Above SS wage cap — marginal SS tax no longer applies.");
  return {
    jurisdiction: "US",
    currency: "USD",
    grossIncome: round(input.grossIncome),
    taxableIncome: round(taxableIncome),
    incomeTax,
    socialSecurity,
    totalTax,
    netPay,
    effectiveRate: totalTax / input.grossIncome,
    marginalRate: marginalRate(taxableIncome, bands),
    bands: applied,
    notes,
    warnings,
  };
}

/** UK 2024/25 England income tax + NI (Class 1 employee, primary threshold). */
function calculateUk(input: TaxInput): TaxResult {
  const warnings: string[] = [];
  const personalAllowance = 12570;
  // Personal allowance taper: reduce by £1 for every £2 over £100,000
  let pa = personalAllowance;
  if (input.grossIncome > 100000) {
    pa = Math.max(0, personalAllowance - (input.grossIncome - 100000) / 2);
  }
  const preTax = input.deductions ?? 0;
  const taxableIncome = Math.max(0, input.grossIncome - pa - preTax);
  const bands = [
    { rate: 0.20, upTo: 37700 },
    { rate: 0.40, upTo: 125140 - pa }, // higher-rate ceiling after PA
    { rate: 0.45, upTo: null },
  ];
  const applied = applyBands(taxableIncome, bands);
  const incomeTax = round(applied.reduce((s, b) => s + b.tax, 0));
  // NI Class 1: 8% on earnings between £12,570 and £702 (upper), then 2% above
  const niPrimary = 12570;
  const niUpper = 50270;
  let ni = 0;
  if (input.grossIncome > niPrimary) {
    const midBand = Math.min(input.grossIncome, niUpper) - niPrimary;
    ni += midBand * 0.08;
    if (input.grossIncome > niUpper) {
      ni += (input.grossIncome - niUpper) * 0.02;
    }
  }
  const socialSecurity = round(ni);
  const totalTax = round(incomeTax + socialSecurity);
  const netPay = round(input.grossIncome - totalTax);
  const notes = [
    `Personal Allowance: £${pa.toLocaleString()}${pa < personalAllowance ? " (tapered above £100,000)" : ""}`,
    "Income tax bands: 20% basic / 40% higher / 45% additional (England)",
    "NI Class 1: 8% primary, 2% above upper threshold",
  ];
  if (input.grossIncome > 100000) warnings.push("Personal Allowance tapered — marginal effective rate can exceed 45% in the taper zone.");
  return {
    jurisdiction: "UK",
    currency: "GBP",
    grossIncome: round(input.grossIncome),
    taxableIncome: round(taxableIncome),
    incomeTax,
    socialSecurity,
    totalTax,
    netPay,
    effectiveRate: totalTax / input.grossIncome,
    marginalRate: marginalRate(taxableIncome, bands),
    bands: applied,
    notes,
    warnings,
  };
}

/** India FY 2024-25 new regime. */
function calculateIn(input: TaxInput): TaxResult {
  const warnings: string[] = [];
  const stdDeduction = 75000; // new regime FY24-25
  const preTax = input.deductions ?? 0;
  const taxableIncome = Math.max(0, input.grossIncome - stdDeduction - preTax);
  const bands = [
    { rate: 0.00, upTo: 300000 },
    { rate: 0.05, upTo: 700000 },
    { rate: 0.10, upTo: 1000000 },
    { rate: 0.15, upTo: 1200000 },
    { rate: 0.20, upTo: 1500000 },
    { rate: 0.30, upTo: null },
  ];
  const applied = applyBands(taxableIncome, bands);
  let incomeTax = applied.reduce((s, b) => s + b.tax, 0);
  // Section 87A rebate: up to ₹25,000 if taxable income ≤ ₹7,00,000
  if (taxableIncome <= 700000) {
    incomeTax = Math.max(0, incomeTax - 25000);
  }
  // Health & Education Cess: 4% on tax
  const cess = incomeTax * 0.04;
  incomeTax = round(incomeTax + cess);
  const totalTax = incomeTax;
  const netPay = round(input.grossIncome - totalTax);
  const notes = [
    `Standard deduction (new regime): ₹${stdDeduction.toLocaleString("en-IN")}`,
    "Section 87A rebate: up to ₹25,000 if taxable income ≤ ₹7,00,000",
    "Health & Education Cess: 4% on income tax",
  ];
  return {
    jurisdiction: "IN",
    currency: "INR",
    grossIncome: round(input.grossIncome),
    taxableIncome: round(taxableIncome),
    incomeTax,
    socialSecurity: 0,
    totalTax,
    netPay,
    effectiveRate: totalTax / input.grossIncome,
    marginalRate: marginalRate(taxableIncome, bands),
    bands: applied,
    notes,
    warnings,
  };
}

export function calculateTax(input: TaxInput): TaxResult | { error: string } {
  if (!input.grossIncome || input.grossIncome <= 0) return { error: "Gross income must be greater than 0." };
  if (input.grossIncome > 1e9) return { error: "Gross income is unrealistically large." };
  if ((input.deductions ?? 0) < 0) return { error: "Deductions cannot be negative." };
  if ((input.deductions ?? 0) > input.grossIncome) return { error: "Deductions cannot exceed gross income." };

  switch (input.jurisdiction) {
    case "US": return calculateUs(input);
    case "UK": return calculateUk(input);
    case "IN": return calculateIn(input);
    default: return { error: "Unsupported jurisdiction." };
  }
}

/** Format a tax result as a plain-text breakdown. */
export function taxBreakdownText(r: TaxResult): string {
  const fmt = (n: number) => `${r.currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const lines: string[] = [];
  lines.push(`Jurisdiction: ${r.jurisdiction}`);
  lines.push(`Gross income: ${fmt(r.grossIncome)}`);
  lines.push(`Taxable income: ${fmt(r.taxableIncome)}`);
  lines.push(`Income tax: ${fmt(r.incomeTax)}`);
  if (r.socialSecurity > 0) lines.push(`Social security: ${fmt(r.socialSecurity)}`);
  lines.push(`Total tax: ${fmt(r.totalTax)}`);
  lines.push(`Net pay: ${fmt(r.netPay)}`);
  lines.push(`Effective rate: ${(r.effectiveRate * 100).toFixed(2)}%`);
  lines.push(`Marginal rate: ${(r.marginalRate * 100).toFixed(2)}%`);
  lines.push("");
  lines.push("Band breakdown:");
  for (const b of r.bands) {
    lines.push(`  ${b.label}: ${(b.rate * 100).toFixed(0)}% on ${fmt(b.from)}–${b.to === null ? "∞" : fmt(b.to)} = ${fmt(b.tax)}`);
  }
  lines.push("");
  for (const n of r.notes) lines.push(`• ${n}`);
  for (const w of r.warnings) lines.push(`⚠️ ${w}`);
  return lines.join("\n");
}

/** Convert a tax result to CSV. */
export function taxBreakdownCsv(r: TaxResult): string {
  const lines = ["Field,Value"];
  lines.push(`Jurisdiction,${r.jurisdiction}`);
  lines.push(`Currency,${r.currency}`);
  lines.push(`Gross income,${r.grossIncome}`);
  lines.push(`Taxable income,${r.taxableIncome}`);
  lines.push(`Income tax,${r.incomeTax}`);
  lines.push(`Social security,${r.socialSecurity}`);
  lines.push(`Total tax,${r.totalTax}`);
  lines.push(`Net pay,${r.netPay}`);
  lines.push(`Effective rate,${(r.effectiveRate * 100).toFixed(2)}%`);
  lines.push(`Marginal rate,${(r.marginalRate * 100).toFixed(2)}%`);
  return lines.join("\n");
}

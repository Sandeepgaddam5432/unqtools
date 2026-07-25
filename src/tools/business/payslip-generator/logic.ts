/**
 * Payslip Generator — gross/net pay, tax brackets, deductions, allowances.
 *
 * Supports flat-rate or bracketed tax, multiple deductions/allowances,
 * overtime calculation, year-to-date tracking, multi-currency, and
 * detailed breakdown exports.
 */

export type Currency = "USD" | "EUR" | "GBP" | "INR" | "JPY" | "AUD" | "CAD" | "CNY";

export interface TaxBracket {
  /** Upper bound of this bracket (exclusive). Use Infinity for the top bracket. */
  upTo: number;
  /** Marginal rate as a percent (0-100). */
  rate: number;
}

export interface LineItem {
  name: string;
  amount: number;
}

export interface PayslipInput {
  grossSalary: number;
  /** Flat tax rate (0-100). Mutually exclusive with brackets. */
  taxRate?: number;
  /** Progressive tax brackets. Mutually exclusive with taxRate. */
  taxBrackets?: TaxBracket[];
  deductions: LineItem[];
  allowances: LineItem[];
  /** Hours worked (for overtime calc). */
  hoursWorked?: number;
  /** Regular hours threshold for overtime. */
  overtimeThreshold?: number;
  /** Overtime multiplier (e.g. 1.5). */
  overtimeMultiplier?: number;
  /** Overtime hours (pre-computed). */
  overtimeHours?: number;
  /** Year-to-date gross (for YTD net calc). */
  ytdGross?: number;
  /** Year-to-date tax already paid. */
  ytdTaxPaid?: number;
  currency?: Currency;
}

export interface PayslipResult {
  gross: number;
  taxAmount: number;
  effectiveTaxRate: number;
  totalDeductions: number;
  totalAllowances: number;
  overtimePay: number;
  net: number;
  ytdGross: number;
  ytdTax: number;
  ytdNet: number;
  currency: Currency;
  formula: string;
}

export interface PayslipStats {
  durationMs: number;
  lineItemCount: number;
  hasOvertime: boolean;
  hasBrackets: boolean;
}

const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Compute progressive tax from brackets. */
export function computeBracketTax(income: number, brackets: TaxBracket[]): number {
  let tax = 0;
  let remaining = income;
  let lastBound = 0;
  const sorted = [...brackets].sort((a, b) => a.upTo - b.upTo);
  for (const b of sorted) {
    if (remaining <= 0) break;
    const bracketWidth = b.upTo - lastBound;
    const taxableInBracket = Math.min(remaining, bracketWidth);
    tax += taxableInBracket * (b.rate / 100);
    remaining -= taxableInBracket;
    lastBound = b.upTo;
  }
  return round(tax);
}

export function computePayslip(input: PayslipInput): PayslipResult | { error: string } {
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (input.grossSalary < 0) return { error: "Gross salary cannot be negative" };
  if (input.taxRate != null && (input.taxRate < 0 || input.taxRate > 100)) return { error: "Tax rate must be 0-100" };
  if (input.deductions.some((d) => d.amount < 0)) return { error: "Deductions cannot be negative" };
  if (input.allowances.some((a) => a.amount < 0)) return { error: "Allowances cannot be negative" };
  const currency = input.currency ?? "USD";

  // Overtime
  let overtimePay = 0;
  let gross = input.grossSalary;
  if (input.overtimeHours && input.overtimeHours > 0) {
    const baseRate = input.hoursWorked && input.hoursWorked > 0 ? input.grossSalary / input.hoursWorked : 0;
    const mult = input.overtimeMultiplier ?? 1.5;
    overtimePay = round(baseRate * input.overtimeHours * mult);
    gross = round(gross + overtimePay);
  } else if (input.hoursWorked && input.overtimeThreshold && input.hoursWorked > input.overtimeThreshold) {
    const baseRate = input.grossSalary / input.overtimeThreshold;
    const otHours = input.hoursWorked - input.overtimeThreshold;
    const mult = input.overtimeMultiplier ?? 1.5;
    overtimePay = round(baseRate * otHours * mult);
    gross = round(gross + overtimePay);
  }

  // Tax
  let taxAmount: number;
  if (input.taxBrackets && input.taxBrackets.length > 0) {
    taxAmount = computeBracketTax(gross, input.taxBrackets);
  } else {
    taxAmount = round(gross * ((input.taxRate ?? 0) / 100));
  }
  const effectiveTaxRate = gross > 0 ? round((taxAmount / gross) * 100) : 0;

  const totalDeductions = round(input.deductions.reduce((s, d) => s + d.amount, 0));
  const totalAllowances = round(input.allowances.reduce((s, a) => s + a.amount, 0));
  const net = round(gross - taxAmount - totalDeductions + totalAllowances);

  const ytdGross = round((input.ytdGross ?? 0) + gross);
  const ytdTax = round((input.ytdTaxPaid ?? 0) + taxAmount);
  const ytdNet = round(ytdGross - ytdTax);

  const end = typeof performance !== "undefined" ? performance.now() : Date.now();
  const _duration = end - start;
  void _duration;

  return {
    gross,
    taxAmount,
    effectiveTaxRate,
    totalDeductions,
    totalAllowances,
    overtimePay,
    net,
    ytdGross,
    ytdTax,
    ytdNet,
    currency,
    formula: "net = gross − tax − deductions + allowances",
  };
}

/** Compute statistics for a payslip. */
export function computeStats(input: PayslipInput): PayslipStats {
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  computePayslip(input);
  const end = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    durationMs: Math.max(0, end - start),
    lineItemCount: input.deductions.length + input.allowances.length,
    hasOvertime: (input.overtimeHours ?? 0) > 0 || ((input.hoursWorked ?? 0) > (input.overtimeThreshold ?? Infinity)),
    hasBrackets: (input.taxBrackets?.length ?? 0) > 0,
  };
}

/** Format currency using Intl. */
export function formatMoney(n: number, currency: Currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

/** Render payslip as a plain-text report. */
export function renderPayslip(input: PayslipInput, result: PayslipResult): string {
  const L: string[] = [];
  L.push("PAYSLIP", "=".repeat(40), "");
  L.push(`Gross salary:       ${formatMoney(result.gross, result.currency)}`);
  if (result.overtimePay > 0) L.push(`Overtime pay:       ${formatMoney(result.overtimePay, result.currency)}`);
  if (input.taxBrackets && input.taxBrackets.length > 0) {
    L.push(`Tax (bracketed):    ${formatMoney(result.taxAmount, result.currency)} (${result.effectiveTaxRate}% effective)`);
  } else {
    L.push(`Tax (${input.taxRate ?? 0}%):       ${formatMoney(result.taxAmount, result.currency)}`);
  }
  L.push("");
  L.push("Deductions:");
  for (const d of input.deductions) L.push(`  ${d.name}: ${formatMoney(d.amount, result.currency)}`);
  L.push(`  Total: ${formatMoney(result.totalDeductions, result.currency)}`);
  L.push("");
  L.push("Allowances:");
  for (const a of input.allowances) L.push(`  ${a.name}: ${formatMoney(a.amount, result.currency)}`);
  L.push(`  Total: ${formatMoney(result.totalAllowances, result.currency)}`);
  L.push("");
  if (input.ytdGross != null || input.ytdTaxPaid != null) {
    L.push("Year-to-date:");
    L.push(`  Gross: ${formatMoney(result.ytdGross, result.currency)}`);
    L.push(`  Tax:   ${formatMoney(result.ytdTax, result.currency)}`);
    L.push(`  Net:   ${formatMoney(result.ytdNet, result.currency)}`);
    L.push("");
  }
  L.push("-".repeat(40));
  L.push(`Net pay:             ${formatMoney(result.net, result.currency)}`);
  return L.join("\n");
}

/** Validate a payslip input. */
export function validatePayslipInput(input: PayslipInput): { ok: true } | { error: string } {
  if (input.grossSalary < 0) return { error: "Gross salary cannot be negative" };
  if (input.taxRate != null && input.taxBrackets && input.taxBrackets.length > 0) {
    return { error: "Cannot specify both taxRate and taxBrackets" };
  }
  if (input.taxBrackets) {
    for (const b of input.taxBrackets) {
      if (b.rate < 0 || b.rate > 100) return { error: `Bracket rate must be 0-100, got ${b.rate}` };
    }
  }
  return { ok: true };
}

/** Batch: compute payslips for multiple inputs. */
export function computePayslipBatch(inputs: PayslipInput[]): (PayslipResult | { error: string })[] {
  return inputs.map((i) => computePayslip(i));
}

/** Convert line items to CSV. */
export function lineItemsToCsv(items: LineItem[], kind: "deduction" | "allowance"): string {
  const lines = [`Name,Amount,Kind`];
  for (const i of items) {
    lines.push(`"${i.name}",${i.amount},${kind}`);
  }
  return lines.join("\n");
}

export const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "INR", label: "INR (₹)" },
  { value: "JPY", label: "JPY (¥)" },
  { value: "AUD", label: "AUD (A$)" },
  { value: "CAD", label: "CAD (C$)" },
  { value: "CNY", label: "CNY (¥)" },
];

/** Sample progressive tax brackets (US-style, simplified). */
export const SAMPLE_BRACKETS: TaxBracket[] = [
  { upTo: 11000, rate: 10 },
  { upTo: 44725, rate: 12 },
  { upTo: 95375, rate: 22 },
  { upTo: 182100, rate: 24 },
  { upTo: Infinity, rate: 32 },
];

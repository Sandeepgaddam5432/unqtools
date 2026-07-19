/**
 * Payroll Calculator — pure logic.
 *
 * Compute gross pay, deductions, and net pay for hourly and salaried
 * employees. Pure functions only — no DOM, no network.
 */

// ---- Types ----

export type PayFrequency = "weekly" | "bi-weekly" | "semi-monthly" | "monthly";
export type EmployeeType = "hourly" | "salaried";

export type CurrencySymbol = "$" | "€" | "£" | "₹" | "¥" | "A$" | "C$";

export interface PayrollInput {
  employeeName: string;
  payFrequency: PayFrequency;
  employeeType: EmployeeType;
  hourlyRate: number;
  hoursWorked: number;
  overtimeHours: number;
  overtimeRate: number; // multiplier (e.g. 1.5)
  annualSalary: number;
  federalTaxRate: number; // percent
  stateTaxRate: number; // percent
  socialSecurityRate: number; // percent
  medicareRate: number; // percent
  healthInsuranceDeduction: number; // flat amount per period
  retirementContribution: number; // percent (401k)
  payPeriod: string; // YYYY-MM-DD
  periodNumber: number; // period # within the year (1..N) for YTD
}

export interface DeductionLine {
  component: string;
  amount: number;
}

export interface PayrollResult {
  employeeName: string;
  payFrequency: PayFrequency;
  employeeType: EmployeeType;
  payPeriod: string;
  currencySymbol: CurrencySymbol;
  payPeriodsPerYear: number;
  hourlyRate: number;
  hoursWorked: number;
  overtimeHours: number;
  overtimeRate: number;
  annualSalary: number;
  regularPay: number;
  overtimePay: number;
  grossPay: number;
  deductions: DeductionLine[];
  totalDeductions: number;
  netPay: number;
  effectiveTaxRate: number; // percent (totalDeductions / grossPay × 100)
  ytdGross: number;
  ytdDeductions: number;
  ytdNet: number;
  notes: string[];
}

export interface PayrollHistoryEntry {
  ts: number;
  employeeName: string;
  payFrequency: PayFrequency;
  employeeType: EmployeeType;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  currencySymbol: CurrencySymbol;
  payPeriod: string;
}

export interface PayrollStats {
  gross: number;
  totalDeductions: number;
  net: number;
  effectiveTaxRate: number;
  hasOvertime: boolean;
  deductionCount: number;
}

// ---- Constants / presets ----

export const PAY_FREQUENCIES: PayFrequency[] = ["weekly", "bi-weekly", "semi-monthly", "monthly"];
export const EMPLOYEE_TYPES: EmployeeType[] = ["hourly", "salaried"];

export const PAY_FREQUENCY_LABELS: Record<PayFrequency, string> = {
  "weekly": "Weekly",
  "bi-weekly": "Bi-Weekly",
  "semi-monthly": "Semi-Monthly",
  "monthly": "Monthly",
};

export const EMPLOYEE_TYPE_LABELS: Record<EmployeeType, string> = {
  "hourly": "Hourly",
  "salaried": "Salaried",
};

export const PAY_PERIODS_PER_YEAR: Record<PayFrequency, number> = {
  "weekly": 52,
  "bi-weekly": 26,
  "semi-monthly": 24,
  "monthly": 12,
};

export const CURRENCY_SYMBOLS: CurrencySymbol[] = ["$", "€", "£", "₹", "¥", "A$", "C$"];

// Default tax/deduction rates (US 2024 reference values; verify before payroll filing)
export const DEFAULT_RATES = {
  federalTaxRate: 12,
  stateTaxRate: 5,
  socialSecurityRate: 6.2,
  medicareRate: 1.45,
  retirementContribution: 0,
  healthInsuranceDeduction: 0,
  overtimeRate: 1.5,
};

export const DEFAULT_INPUT: PayrollInput = {
  employeeName: "",
  payFrequency: "bi-weekly",
  employeeType: "hourly",
  hourlyRate: 25,
  hoursWorked: 80,
  overtimeHours: 0,
  overtimeRate: DEFAULT_RATES.overtimeRate,
  annualSalary: 60000,
  federalTaxRate: DEFAULT_RATES.federalTaxRate,
  stateTaxRate: DEFAULT_RATES.stateTaxRate,
  socialSecurityRate: DEFAULT_RATES.socialSecurityRate,
  medicareRate: DEFAULT_RATES.medicareRate,
  healthInsuranceDeduction: DEFAULT_RATES.healthInsuranceDeduction,
  retirementContribution: DEFAULT_RATES.retirementContribution,
  payPeriod: new Date().toISOString().slice(0, 10),
  periodNumber: 1,
};

// ---- Normalize / parse ----

export function normalizeEmployeeName(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

export function clampNonNegative(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function clampPercent(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

export function parsePeriodNumber(s: string, max: number): number {
  const n = Number(s);
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > max) return max;
  return Math.floor(n);
}

/** Validate a YYYY-MM-DD pay period string; returns true if valid. */
export function isValidPayPeriod(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return false;
  const d = new Date(s + "T00:00:00");
  return !Number.isNaN(d.getTime());
}

// ---- Core calculators ----

/** Compute hourly gross = regular + overtime. */
export function computeHourlyGross(
  hoursWorked: number,
  hourlyRate: number,
  overtimeHours: number,
  overtimeRate: number,
): { regularPay: number; overtimePay: number; gross: number } {
  const hw = clampNonNegative(hoursWorked);
  const hr = clampNonNegative(hourlyRate);
  const oh = clampNonNegative(overtimeHours);
  const orMul = clampNonNegative(overtimeRate) || 1;
  const regularPay = hw * hr;
  const overtimePay = oh * hr * orMul;
  return { regularPay, overtimePay, gross: regularPay + overtimePay };
}

/** Compute salaried gross per period = annual / periods per year. */
export function computeSalariedGross(annualSalary: number, frequency: PayFrequency): number {
  const annual = clampNonNegative(annualSalary);
  const periods = PAY_PERIODS_PER_YEAR[frequency];
  return annual / periods;
}

/** Federal tax = gross × fedRate/100. */
export function computeFederalTax(gross: number, fedRate: number): number {
  return gross * clampPercent(fedRate) / 100;
}

/** State tax = gross × stateRate/100. */
export function computeStateTax(gross: number, stateRate: number): number {
  return gross * clampPercent(stateRate) / 100;
}

/** Social Security = gross × ssRate/100. */
export function computeSocialSecurity(gross: number, ssRate: number): number {
  return gross * clampPercent(ssRate) / 100;
}

/** Medicare = gross × medicareRate/100. */
export function computeMedicare(gross: number, medicareRate: number): number {
  return gross * clampPercent(medicareRate) / 100;
}

/** 401k = gross × retirement/100. */
export function compute401k(gross: number, retirement: number): number {
  return gross * clampPercent(retirement) / 100;
}

/** Health insurance deduction (flat amount per period). */
export function computeHealthInsurance(amount: number): number {
  return clampNonNegative(amount);
}

/** Total deductions = sum of all deduction lines. */
export function sumDeductions(lines: DeductionLine[]): number {
  return lines.reduce((acc, l) => acc + l.amount, 0);
}

/** Effective tax rate = total deductions / gross × 100. */
export function computeEffectiveTaxRate(totalDeductions: number, gross: number): number {
  if (gross <= 0) return 0;
  return (totalDeductions / gross) * 100;
}

/** YTD estimate = per-period amount × periodNumber. */
export function computeYTD(perPeriod: number, periodNumber: number, maxPeriods: number): number {
  const p = parsePeriodNumber(String(periodNumber), maxPeriods);
  return perPeriod * p;
}

// ---- Compute full payroll ----

export function computePayroll(input: PayrollInput, currency: CurrencySymbol = "$"): PayrollResult {
  const notes: string[] = [];
  let regularPay = 0;
  let overtimePay = 0;
  let grossPay = 0;

  const periodsPerYear = PAY_PERIODS_PER_YEAR[input.payFrequency];

  if (input.employeeType === "hourly") {
    const r = computeHourlyGross(
      input.hoursWorked,
      input.hourlyRate,
      input.overtimeHours,
      input.overtimeRate,
    );
    regularPay = r.regularPay;
    overtimePay = r.overtimePay;
    grossPay = r.gross;
    if (overtimePay > 0) {
      notes.push(`Overtime: ${overtimeHoursDisplay(input.overtimeHours)} hrs × $${input.hourlyRate}/hr × ${input.overtimeRate}x`);
    }
  } else {
    grossPay = computeSalariedGross(input.annualSalary, input.payFrequency);
    notes.push(`Salaried: $${input.annualSalary.toLocaleString()} ÷ ${periodsPerYear} periods/yr`);
  }

  const federal = computeFederalTax(grossPay, input.federalTaxRate);
  const state = computeStateTax(grossPay, input.stateTaxRate);
  const ss = computeSocialSecurity(grossPay, input.socialSecurityRate);
  const medicare = computeMedicare(grossPay, input.medicareRate);
  const retirement401k = compute401k(grossPay, input.retirementContribution);
  const health = computeHealthInsurance(input.healthInsuranceDeduction);

  const deductions: DeductionLine[] = [
    { component: "Federal Tax", amount: round2(federal) },
    { component: "State Tax", amount: round2(state) },
    { component: "Social Security", amount: round2(ss) },
    { component: "Medicare", amount: round2(medicare) },
    { component: "401(k) Retirement", amount: round2(retirement401k) },
    { component: "Health Insurance", amount: round2(health) },
  ].filter((d) => d.amount > 0);

  const totalDeductions = round2(sumDeductions(deductions));
  const netPay = round2(grossPay - totalDeductions);
  const effectiveTaxRate = round2(computeEffectiveTaxRate(totalDeductions, grossPay));

  const periodNumber = parsePeriodNumber(String(input.periodNumber), periodsPerYear);
  const ytdGross = round2(computeYTD(grossPay, periodNumber, periodsPerYear));
  const ytdDeductions = round2(computeYTD(totalDeductions, periodNumber, periodsPerYear));
  const ytdNet = round2(computeYTD(netPay, periodNumber, periodsPerYear));

  if (input.employeeType === "hourly" && input.overtimeHours > 0) {
    notes.push(`Period gross includes ${input.overtimeHours} overtime hrs at ${input.overtimeRate}x rate.`);
  }
  if (input.retirementContribution > 0) {
    notes.push(`401(k): ${input.retirementContribution}% of gross deducted pre-tax (simplified).`);
  }
  notes.push("Rates are reference defaults — verify with payroll/HR before filing.");

  return {
    employeeName: normalizeEmployeeName(input.employeeName) || "Employee",
    payFrequency: input.payFrequency,
    employeeType: input.employeeType,
    payPeriod: input.payPeriod,
    currencySymbol: currency,
    payPeriodsPerYear: periodsPerYear,
    hourlyRate: input.hourlyRate,
    hoursWorked: input.hoursWorked,
    overtimeHours: input.overtimeHours,
    overtimeRate: input.overtimeRate,
    annualSalary: input.annualSalary,
    regularPay: round2(regularPay),
    overtimePay: round2(overtimePay),
    grossPay: round2(grossPay),
    deductions,
    totalDeductions,
    netPay,
    effectiveTaxRate,
    ytdGross,
    ytdDeductions,
    ytdNet,
    notes,
  };
}

// ---- Summary stats ----

export function summaryStats(result: PayrollResult): PayrollStats {
  return {
    gross: result.grossPay,
    totalDeductions: result.totalDeductions,
    net: result.netPay,
    effectiveTaxRate: result.effectiveTaxRate,
    hasOvertime: result.overtimePay > 0,
    deductionCount: result.deductions.length,
  };
}

// ---- Formatting ----

export function formatCurrency(amount: number, symbol: CurrencySymbol = "$"): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  return `${sign}${symbol}${abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercent(p: number): string {
  return `${round2(p).toFixed(2)}%`;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function overtimeHoursDisplay(n: number): string {
  return Number.isFinite(n) ? String(n) : "0";
}

// ---- Rendering ----

/** Render the payroll result as a plain-text pay stub. */
export function renderText(result: PayrollResult): string {
  const lines: string[] = [];
  lines.push("=".repeat(60));
  lines.push("                       PAY STUB");
  lines.push("=".repeat(60));
  lines.push(`Employee:    ${result.employeeName}`);
  lines.push(`Pay Period:  ${result.payPeriod || "—"}`);
  lines.push(`Type:        ${EMPLOYEE_TYPE_LABELS[result.employeeType]}`);
  lines.push(`Frequency:   ${PAY_FREQUENCY_LABELS[result.payFrequency]}`);
  lines.push(`Periods/yr:  ${result.payPeriodsPerYear}`);
  lines.push("-".repeat(60));
  lines.push("EARNINGS");
  if (result.employeeType === "hourly") {
    lines.push(`  Regular:    ${formatCurrency(result.regularPay, result.currencySymbol)}  (${result.hoursWorked} hrs @ ${formatCurrency(result.hourlyRate, result.currencySymbol)}/hr)`);
    if (result.overtimePay > 0) {
      lines.push(`  Overtime:   ${formatCurrency(result.overtimePay, result.currencySymbol)}  (${result.overtimeHours} hrs @ ${result.overtimeRate}x)`);
    }
  } else {
    lines.push(`  Salary:     ${formatCurrency(result.annualSalary, result.currencySymbol)}/yr ÷ ${result.payPeriodsPerYear}`);
  }
  lines.push(`  GROSS PAY:  ${formatCurrency(result.grossPay, result.currencySymbol)}`);
  lines.push("-".repeat(60));
  lines.push("DEDUCTIONS");
  if (result.deductions.length === 0) {
    lines.push("  (none)");
  } else {
    for (const d of result.deductions) {
      lines.push(`  ${d.component.padEnd(22)} ${formatCurrency(-d.amount, result.currencySymbol)}`);
    }
  }
  lines.push(`  ${"TOTAL DEDUCTIONS".padEnd(22)} ${formatCurrency(-result.totalDeductions, result.currencySymbol)}`);
  lines.push("-".repeat(60));
  lines.push(`  NET PAY:    ${formatCurrency(result.netPay, result.currencySymbol)}`);
  lines.push(`  Effective tax rate: ${formatPercent(result.effectiveTaxRate)}`);
  lines.push("-".repeat(60));
  lines.push("YEAR-TO-DATE (ESTIMATE)");
  lines.push(`  YTD Gross:        ${formatCurrency(result.ytdGross, result.currencySymbol)}`);
  lines.push(`  YTD Deductions:   ${formatCurrency(result.ytdDeductions, result.currencySymbol)}`);
  lines.push(`  YTD Net:          ${formatCurrency(result.ytdNet, result.currencySymbol)}`);
  lines.push("-".repeat(60));
  if (result.notes.length > 0) {
    for (const n of result.notes) {
      lines.push(`  • ${n}`);
    }
    lines.push("-".repeat(60));
  }
  lines.push("Generated by UnQTools Payroll Calculator — 100% client-side.");
  lines.push("=".repeat(60));
  return lines.join("\n");
}

/** Render the payroll result as a printable HTML pay stub. */
export function renderHtml(result: PayrollResult): string {
  const sym = result.currencySymbol;
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
  const rows = result.deductions.length === 0
    ? `<tr><td colspan="2" style="text-align:center;color:#888;">No deductions</td></tr>`
    : result.deductions.map((d) =>
      `<tr><td>${esc(d.component)}</td><td style="text-align:right;color:#c00;">-${formatCurrency(d.amount, sym)}</td></tr>`
    ).join("\n");
  const notesHtml = result.notes.length === 0
    ? ""
    : `<div class="notes"><strong>Notes:</strong><ul>${result.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></div>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Pay Stub — ${esc(result.employeeName)} — ${esc(result.payPeriod)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; max-width: 720px; margin: 32px auto; padding: 0 16px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .muted { color: #666; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  th { background: #f5f5f5; text-align: left; }
  .total td { font-weight: 700; border-top: 2px solid #333; border-bottom: none; }
  .net { font-size: 18px; color: #060; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 12px 0; font-size: 13px; }
  .grid div { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #eee; }
  .notes { margin-top: 16px; padding: 8px; background: #fafafa; border-radius: 6px; font-size: 11px; color: #555; }
  .notes ul { margin: 4px 0 0; padding-left: 18px; }
  header { border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 12px; }
  @media print { body { margin: 0; } .notes { display: none; } }
</style>
</head>
<body>
<header>
  <h1>Pay Stub</h1>
  <div class="muted">Generated ${new Date().toLocaleString()} — UnQTools Payroll Calculator</div>
</header>
<div class="grid">
  <div><span>Employee:</span><strong>${esc(result.employeeName)}</strong></div>
  <div><span>Pay Period:</span><strong>${esc(result.payPeriod)}</strong></div>
  <div><span>Type:</span>${EMPLOYEE_TYPE_LABELS[result.employeeType]}</div>
  <div><span>Frequency:</span>${PAY_FREQUENCY_LABELS[result.payFrequency]}</div>
  <div><span>Periods/yr:</span>${result.payPeriodsPerYear}</div>
  <div><span>Effective tax rate:</span>${formatPercent(result.effectiveTaxRate)}</div>
</div>
<h2 style="font-size:14px;margin:16px 0 4px;">Earnings</h2>
<table>
  ${result.employeeType === "hourly"
    ? `<tr><td>Regular</td><td style="text-align:right;">${formatCurrency(result.regularPay, sym)}</td></tr>
       ${result.overtimePay > 0 ? `<tr><td>Overtime</td><td style="text-align:right;">${formatCurrency(result.overtimePay, sym)}</td></tr>` : ""}`
    : `<tr><td>Salary (${result.payPeriodsPerYear} periods/yr)</td><td style="text-align:right;">${formatCurrency(result.annualSalary, sym)}/yr</td></tr>`
  }
  <tr class="total"><td>Gross Pay</td><td style="text-align:right;">${formatCurrency(result.grossPay, sym)}</td></tr>
</table>
<h2 style="font-size:14px;margin:16px 0 4px;">Deductions</h2>
<table>
  ${rows}
  <tr class="total"><td>Total Deductions</td><td style="text-align:right;color:#c00;">-${formatCurrency(result.totalDeductions, sym)}</td></tr>
</table>
<table>
  <tr class="total net"><td>Net Pay</td><td style="text-align:right;">${formatCurrency(result.netPay, sym)}</td></tr>
</table>
<h2 style="font-size:14px;margin:16px 0 4px;">Year-to-Date (Estimate)</h2>
<table>
  <tr><td>YTD Gross</td><td style="text-align:right;">${formatCurrency(result.ytdGross, sym)}</td></tr>
  <tr><td>YTD Deductions</td><td style="text-align:right;">${formatCurrency(result.ytdDeductions, sym)}</td></tr>
  <tr><td>YTD Net</td><td style="text-align:right;">${formatCurrency(result.ytdNet, sym)}</td></tr>
</table>
${notesHtml}
</body>
</html>`;
}

/** Render deductions + summary as CSV (component, amount). */
export function renderCsv(result: PayrollResult): string {
  const lines: string[] = ["component,amount"];
  lines.push(`${csv("Gross Pay")},${result.grossPay.toFixed(2)}`);
  if (result.employeeType === "hourly") {
    lines.push(`${csv("Regular Pay")},${result.regularPay.toFixed(2)}`);
    if (result.overtimePay > 0) {
      lines.push(`${csv("Overtime Pay")},${result.overtimePay.toFixed(2)}`);
    }
  }
  for (const d of result.deductions) {
    lines.push(`${csv(d.component)},${(-d.amount).toFixed(2)}`);
  }
  lines.push(`${csv("Total Deductions")},${(-result.totalDeductions).toFixed(2)}`);
  lines.push(`${csv("Net Pay")},${result.netPay.toFixed(2)}`);
  lines.push(`${csv("Effective Tax Rate %")},${result.effectiveTaxRate.toFixed(2)}`);
  lines.push(`${csv("YTD Gross")},${result.ytdGross.toFixed(2)}`);
  lines.push(`${csv("YTD Deductions")},${result.ytdDeductions.toFixed(2)}`);
  lines.push(`${csv("YTD Net")},${result.ytdNet.toFixed(2)}`);
  return lines.join("\n");
}

function csv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:payroll-calculator:history";
const HISTORY_MAX = 20;

export function loadHistory(): PayrollHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as PayrollHistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: PayrollHistoryEntry): PayrollHistoryEntry[] {
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

const SHARE_KEYS: (keyof PayrollInput)[] = [
  "employeeName", "payFrequency", "employeeType",
  "hourlyRate", "hoursWorked", "overtimeHours", "overtimeRate",
  "annualSalary",
  "federalTaxRate", "stateTaxRate", "socialSecurityRate", "medicareRate",
  "healthInsuranceDeduction", "retirementContribution",
  "payPeriod", "periodNumber",
];

export function buildShareUrl(input: PayrollInput, currency: CurrencySymbol = "$"): string {
  const params = new URLSearchParams();
  for (const k of SHARE_KEYS) {
    const v = input[k];
    if (v === undefined || v === "") continue;
    params.set(k, String(v));
  }
  if (currency !== "$") params.set("currency", currency);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { input: Partial<PayrollInput>; currency?: CurrencySymbol } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { input: {} };
  const params = new URLSearchParams(clean);
  const input: Partial<PayrollInput> = {};
  const numKeys = new Set<keyof PayrollInput>([
    "hourlyRate", "hoursWorked", "overtimeHours", "overtimeRate",
    "annualSalary",
    "federalTaxRate", "stateTaxRate", "socialSecurityRate", "medicareRate",
    "healthInsuranceDeduction", "retirementContribution", "periodNumber",
  ]);
  for (const k of SHARE_KEYS) {
    const v = params.get(k);
    if (v === null) continue;
    if (numKeys.has(k)) {
      const n = Number(v);
      if (Number.isFinite(n)) (input as Record<string, unknown>)[k] = n;
    } else {
      (input as Record<string, unknown>)[k] = v;
    }
  }
  // Validate enums
  if (input.payFrequency && !PAY_FREQUENCIES.includes(input.payFrequency)) {
    delete input.payFrequency;
  }
  if (input.employeeType && !EMPLOYEE_TYPES.includes(input.employeeType)) {
    delete input.employeeType;
  }
  let currency: CurrencySymbol | undefined;
  const c = params.get("currency");
  if (c && (CURRENCY_SYMBOLS as string[]).includes(c)) {
    currency = c as CurrencySymbol;
  }
  return { input, currency };
}

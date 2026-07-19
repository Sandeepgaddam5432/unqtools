/**
 * Loan Amortization Schedule — pure logic.
 *
 * Generate amortization schedules (monthly, bi-weekly, weekly), compute
 * per-payment interest/principal/balance, totals, payoff date, and
 * interest savings from extra payments. Pure functions only — no DOM,
 * no network.
 */

// ---- Types ----

export type PaymentFrequency = "monthly" | "bi-weekly" | "weekly";

export interface LoanInput {
  loanAmount: number;
  annualInterestRate: number; // percent, e.g. 6.5 for 6.5%
  loanTermYears: number;
  startDate: string; // YYYY-MM-DD
  paymentFrequency: PaymentFrequency;
  extraPayment: number; // additional payment per period, default 0
}

export interface PaymentRow {
  paymentNumber: number;
  date: string; // YYYY-MM-DD
  payment: number; // base payment (without extra)
  extraPayment: number;
  principal: number; // includes extra payment
  interest: number;
  balance: number; // remaining balance after this payment
}

export interface LoanResult {
  loanAmount: number;
  annualInterestRate: number;
  loanTermYears: number;
  startDate: string;
  paymentFrequency: PaymentFrequency;
  extraPayment: number;
  paymentsPerYear: number;
  totalPayments: number;
  periodicRate: number; // decimal per period
  payment: number; // base periodic payment
  schedule: PaymentRow[];
  totalInterest: number;
  totalPaid: number; // loanAmount + totalInterest
  payoffDate: string | null; // YYYY-MM-DD of last payment (may be earlier than scheduled end)
  actualPayments: number; // number of payments actually made (can be < totalPayments when extra payments end loan early)
  valid: boolean;
  errors: string[];
}

export interface YearSummaryRow {
  year: number; // 1-indexed calendar year from start
  paymentCount: number;
  totalPayment: number;
  totalPrincipal: number;
  totalInterest: number;
  endingBalance: number;
}

export interface SavingsAnalysis {
  withExtra: LoanResult;
  withoutExtra: LoanResult;
  interestSavings: number; // withoutExtra.totalInterest - withExtra.totalInterest
  monthsSaved: number; // difference in number of payments (converted to months)
  paymentsSaved: number; // raw difference in payment count
}

export interface LoanSummaryStats {
  payment: number;
  totalInterest: number;
  totalPaid: number;
  payoffDate: string | null;
  interestSavings: number;
  paymentsSaved: number;
  actualPayments: number;
  totalPayments: number;
}

export interface LoanHistoryEntry {
  ts: number;
  loanAmount: number;
  annualInterestRate: number;
  loanTermYears: number;
  paymentFrequency: PaymentFrequency;
  payment: number;
  totalInterest: number;
  extraPayment: number;
}

// ---- Constants / Presets ----

export const FREQUENCY_PAYMENTS_PER_YEAR: Record<PaymentFrequency, number> = {
  monthly: 12,
  "bi-weekly": 26,
  weekly: 52,
};

export const FREQUENCY_DAYS: Record<PaymentFrequency, number> = {
  monthly: 30, // approx — actual months vary; we use a 30/360 approximation for date math
  "bi-weekly": 14,
  weekly: 7,
};

export const FREQUENCY_LABELS: Record<PaymentFrequency, string> = {
  monthly: "Monthly",
  "bi-weekly": "Bi-weekly (every 2 weeks)",
  weekly: "Weekly",
};

/** Example presets for quick fills. */
export const PRESET_EXAMPLES: { name: string; input: LoanInput }[] = [
  {
    name: "30-yr mortgage",
    input: { loanAmount: 250000, annualInterestRate: 6.5, loanTermYears: 30, startDate: "2024-01-01", paymentFrequency: "monthly", extraPayment: 0 },
  },
  {
    name: "15-yr mortgage",
    input: { loanAmount: 200000, annualInterestRate: 5.5, loanTermYears: 15, startDate: "2024-01-01", paymentFrequency: "monthly", extraPayment: 0 },
  },
  {
    name: "Car loan",
    input: { loanAmount: 30000, annualInterestRate: 7.2, loanTermYears: 5, startDate: "2024-01-01", paymentFrequency: "monthly", extraPayment: 50 },
  },
  {
    name: "Student loan",
    input: { loanAmount: 40000, annualInterestRate: 4.5, loanTermYears: 10, startDate: "2024-01-01", paymentFrequency: "monthly", extraPayment: 0 },
  },
  {
    name: "Bi-weekly mortgage",
    input: { loanAmount: 250000, annualInterestRate: 6.5, loanTermYears: 30, startDate: "2024-01-01", paymentFrequency: "bi-weekly", extraPayment: 0 },
  },
];

// ---- Validation ----

export function validateInput(input: LoanInput): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(input.loanAmount) || input.loanAmount <= 0) {
    errors.push("Loan amount must be a positive number.");
  }
  if (!Number.isFinite(input.annualInterestRate) || input.annualInterestRate < 0) {
    errors.push("Annual interest rate must be a non-negative number.");
  }
  if (!Number.isFinite(input.loanTermYears) || input.loanTermYears <= 0) {
    errors.push("Loan term must be a positive number of years.");
  }
  if (!Number.isFinite(input.extraPayment) || input.extraPayment < 0) {
    errors.push("Extra payment must be a non-negative number.");
  }
  if (!FREQUENCY_PAYMENTS_PER_YEAR[input.paymentFrequency]) {
    errors.push("Payment frequency must be monthly, bi-weekly, or weekly.");
  }
  if (!input.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) {
    errors.push("Start date must be in YYYY-MM-DD format.");
  } else if (Number.isNaN(parseDate(input.startDate).getTime())) {
    errors.push("Start date is not a valid calendar date.");
  }
  return errors;
}

// ---- Date helpers ----

/** Parse YYYY-MM-DD into a Date at local midnight (no timezone shift).
 *  Returns Invalid Date when the date components don't roll over (e.g. month=13, day=45). */
export function parseDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return new Date(NaN);
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  // Verify the components match (JavaScript's Date normalizes out-of-range inputs).
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) {
    return new Date(NaN);
  }
  return dt;
}

/** Format a Date as YYYY-MM-DD. */
export function formatDate(d: Date): string {
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Add `days` to a Date, returning a new Date. */
export function addDays(d: Date, days: number): Date {
  const out = new Date(d.getTime());
  out.setDate(out.getDate() + days);
  return out;
}

/** Add `months` to a Date, returning a new Date (clamped to end of month if needed). */
export function addMonths(d: Date, months: number): Date {
  const out = new Date(d.getTime());
  const targetMonth = out.getMonth() + months;
  out.setMonth(targetMonth);
  return out;
}

// ---- Core calculations ----

/** Periodic interest rate (decimal per period). For monthly: annualRate/12/100. */
export function calcPeriodicRate(annualRatePct: number, frequency: PaymentFrequency): number {
  const ppy = FREQUENCY_PAYMENTS_PER_YEAR[frequency];
  return annualRatePct / 100 / ppy;
}

/** Total number of payments = years × payments per year. */
export function calcTotalPayments(loanTermYears: number, frequency: PaymentFrequency): number {
  const ppy = FREQUENCY_PAYMENTS_PER_YEAR[frequency];
  return Math.max(1, Math.round(loanTermYears * ppy));
}

/**
 * Standard amortization payment formula:
 *   payment = P × (r(1+r)^n) / ((1+r)^n − 1)
 * where P = principal, r = periodic rate (decimal), n = number of payments.
 *
 * If r is 0 (interest-free loan), payment = P / n.
 */
export function calcPayment(principal: number, periodicRate: number, numPayments: number): number {
  if (!Number.isFinite(principal) || principal <= 0) return 0;
  if (!Number.isFinite(numPayments) || numPayments <= 0) return 0;
  if (!Number.isFinite(periodicRate) || periodicRate === 0) return round2(principal / numPayments);
  const r = periodicRate;
  const n = numPayments;
  const factor = Math.pow(1 + r, n);
  const pmt = (principal * r * factor) / (factor - 1);
  return round2(pmt);
}

/** Interest portion of a single payment: balance × periodic rate. */
export function calcInterestPayment(balance: number, periodicRate: number): number {
  if (!Number.isFinite(balance) || balance <= 0) return 0;
  return round2(balance * periodicRate);
}

/**
 * Principal portion of a single payment: payment − interest + extraPayment.
 * Capped at remaining balance so the loan doesn't go negative.
 */
export function calcPrincipalPayment(
  payment: number,
  interest: number,
  extraPayment: number,
  balance: number,
): number {
  if (!Number.isFinite(balance) || balance <= 0) return 0;
  let principal = payment - interest + (Number.isFinite(extraPayment) ? extraPayment : 0);
  if (principal < 0) principal = 0;
  if (principal > balance) principal = balance;
  return round2(principal);
}

/** New balance after applying principal: max(0, balance − principal). */
export function applyPrincipal(balance: number, principal: number): number {
  if (!Number.isFinite(balance) || balance <= 0) return 0;
  return round2(Math.max(0, balance - principal));
}

/** Compute the next payment date given the previous date and frequency. */
export function nextPaymentDate(prevDate: Date, frequency: PaymentFrequency): Date {
  switch (frequency) {
    case "monthly": return addMonths(prevDate, 1);
    case "bi-weekly": return addDays(prevDate, FREQUENCY_DAYS["bi-weekly"]);
    case "weekly": return addDays(prevDate, FREQUENCY_DAYS.weekly);
    default: return addMonths(prevDate, 1);
  }
}

/**
 * Generate the full amortization schedule.
 * Stops early if balance reaches 0 (e.g. when extra payments retire the loan).
 */
export function generateSchedule(input: LoanInput): PaymentRow[] {
  const rows: PaymentRow[] = [];
  const principal = input.loanAmount;
  const rate = calcPeriodicRate(input.annualInterestRate, input.paymentFrequency);
  const n = calcTotalPayments(input.loanTermYears, input.paymentFrequency);
  const payment = calcPayment(principal, rate, n);
  let balance = principal;
  let date = parseDate(input.startDate);
  const extra = Number.isFinite(input.extraPayment) ? input.extraPayment : 0;

  for (let i = 1; i <= n; i++) {
    if (balance <= 0.005) break; // loan paid off
    const interest = calcInterestPayment(balance, rate);
    const principalPaid = calcPrincipalPayment(payment, interest, extra, balance);
    const newBalance = applyPrincipal(balance, principalPaid);
    rows.push({
      paymentNumber: i,
      date: formatDate(date),
      payment,
      extraPayment: extra > 0 ? extra : 0,
      principal: principalPaid,
      interest,
      balance: newBalance,
    });
    balance = newBalance;
    date = nextPaymentDate(date, input.paymentFrequency);
  }

  // If the final payment still leaves a tiny balance due to rounding, fold it into the last payment.
  if (rows.length > 0 && balance > 0.005) {
    const last = rows[rows.length - 1];
    last.principal = round2(last.principal + balance);
    last.balance = 0;
  }

  return rows;
}

/** Sum interest across a schedule. */
export function calcTotalInterest(schedule: PaymentRow[]): number {
  return round2(schedule.reduce((s, r) => s + r.interest, 0));
}

/** Total paid = principal + total interest. */
export function calcTotalPaid(loanAmount: number, totalInterest: number): number {
  return round2(loanAmount + totalInterest);
}

/** Payoff date = date of the last payment in the schedule. */
export function calcPayoffDate(schedule: PaymentRow[]): string | null {
  if (schedule.length === 0) return null;
  return schedule[schedule.length - 1].date;
}

/** Compute the full loan result from raw input. */
export function computeLoan(input: LoanInput): LoanResult {
  const errors = validateInput(input);
  const valid = errors.length === 0;

  if (!valid) {
    return {
      loanAmount: input.loanAmount,
      annualInterestRate: input.annualInterestRate,
      loanTermYears: input.loanTermYears,
      startDate: input.startDate,
      paymentFrequency: input.paymentFrequency,
      extraPayment: input.extraPayment,
      paymentsPerYear: FREQUENCY_PAYMENTS_PER_YEAR[input.paymentFrequency] ?? 0,
      totalPayments: 0,
      periodicRate: 0,
      payment: 0,
      schedule: [],
      totalInterest: 0,
      totalPaid: 0,
      payoffDate: null,
      actualPayments: 0,
      valid,
      errors,
    };
  }

  const ppy = FREQUENCY_PAYMENTS_PER_YEAR[input.paymentFrequency];
  const rate = calcPeriodicRate(input.annualInterestRate, input.paymentFrequency);
  const n = calcTotalPayments(input.loanTermYears, input.paymentFrequency);
  const payment = calcPayment(input.loanAmount, rate, n);
  const schedule = generateSchedule(input);
  const totalInterest = calcTotalInterest(schedule);
  const totalPaid = calcTotalPaid(input.loanAmount, totalInterest);
  const payoffDate = calcPayoffDate(schedule);

  return {
    loanAmount: input.loanAmount,
    annualInterestRate: input.annualInterestRate,
    loanTermYears: input.loanTermYears,
    startDate: input.startDate,
    paymentFrequency: input.paymentFrequency,
    extraPayment: input.extraPayment,
    paymentsPerYear: ppy,
    totalPayments: n,
    periodicRate: rate,
    payment,
    schedule,
    totalInterest,
    totalPaid,
    payoffDate,
    actualPayments: schedule.length,
    valid,
    errors,
  };
}

// ---- Interest savings analysis ----

/**
 * Compute savings from making extra payments:
 * - Run the loan WITH the extra payment.
 * - Run the loan WITHOUT the extra payment.
 * - interestSavings = withoutExtra.totalInterest − withExtra.totalInterest
 * - paymentsSaved = withoutExtra.actualPayments − withExtra.actualPayments
 * - monthsSaved = paymentsSaved converted to months based on frequency
 */
export function computeSavings(input: LoanInput): SavingsAnalysis {
  const withExtra = computeLoan(input);
  const withoutExtra = computeLoan({ ...input, extraPayment: 0 });
  const interestSavings = round2(withoutExtra.totalInterest - withExtra.totalInterest);
  const paymentsSaved = Math.max(0, withoutExtra.actualPayments - withExtra.actualPayments);
  const monthsPerPayment = 12 / FREQUENCY_PAYMENTS_PER_YEAR[input.paymentFrequency];
  const monthsSaved = Math.round(paymentsSaved * monthsPerPayment);
  return { withExtra, withoutExtra, interestSavings, monthsSaved, paymentsSaved };
}

// ---- Year-by-year summary ----

/**
 * Aggregate schedule rows into yearly buckets based on calendar year of payment date.
 */
export function yearByYearSummary(schedule: PaymentRow[]): YearSummaryRow[] {
  if (schedule.length === 0) return [];
  const map = new Map<number, YearSummaryRow>();
  for (const row of schedule) {
    const year = parseDate(row.date).getFullYear();
    if (Number.isNaN(year)) continue;
    if (!map.has(year)) {
      map.set(year, {
        year,
        paymentCount: 0,
        totalPayment: 0,
        totalPrincipal: 0,
        totalInterest: 0,
        endingBalance: 0,
      });
    }
    const entry = map.get(year)!;
    entry.paymentCount += 1;
    entry.totalPayment = round2(entry.totalPayment + row.payment + row.extraPayment);
    entry.totalPrincipal = round2(entry.totalPrincipal + row.principal);
    entry.totalInterest = round2(entry.totalInterest + row.interest);
    entry.endingBalance = row.balance;
  }
  return Array.from(map.values());
}

// ---- Formatting ----

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toFixed(2)}`;
}

export function formatPercent(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- Renderers ----

/** Render the amortization schedule as a plain-text table. */
export function renderText(input: LoanInput, r: LoanResult): string {
  const L: string[] = [];
  L.push("=".repeat(80));
  L.push("LOAN AMORTIZATION SCHEDULE");
  L.push("=".repeat(80));
  L.push("");
  L.push("INPUTS");
  L.push("-".repeat(80));
  L.push(`  Loan amount:           ${formatNumber(input.loanAmount)}`);
  L.push(`  Annual interest rate:  ${formatPercent(input.annualInterestRate)}`);
  L.push(`  Loan term (years):     ${formatNumber(input.loanTermYears)}`);
  L.push(`  Start date:            ${input.startDate}`);
  L.push(`  Payment frequency:     ${FREQUENCY_LABELS[input.paymentFrequency]}`);
  L.push(`  Extra payment/period:  ${formatNumber(input.extraPayment)}`);
  L.push("");

  if (!r.valid) {
    L.push("VALIDATION ERRORS");
    L.push("-".repeat(80));
    for (const e of r.errors) L.push(`  ! ${e}`);
    L.push("=".repeat(80));
    return L.join("\n");
  }

  L.push("SUMMARY");
  L.push("-".repeat(80));
  L.push(`  Periodic payment:      ${formatNumber(r.payment)}    (${FREQUENCY_LABELS[input.paymentFrequency]})`);
  L.push(`  Total payments:        ${r.actualPayments} of ${r.totalPayments} scheduled`);
  L.push(`  Total interest:        ${formatNumber(r.totalInterest)}`);
  L.push(`  Total paid:            ${formatNumber(r.totalPaid)}`);
  L.push(`  Payoff date:           ${r.payoffDate ?? "—"}`);
  L.push("");

  if (input.extraPayment > 0) {
    const savings = computeSavings(input);
    L.push("EXTRA PAYMENT SAVINGS");
    L.push("-".repeat(80));
    L.push(`  Interest saved:        ${formatNumber(savings.interestSavings)}`);
    L.push(`  Payments saved:        ${savings.paymentsSaved}    (~${savings.monthsSaved} months)`);
    L.push(`  Payoff without extra:  ${savings.withoutExtra.payoffDate ?? "—"}`);
    L.push("");
  }

  L.push("AMORTIZATION TABLE");
  L.push("-".repeat(80));
  L.push(`  ${"#".padEnd(5)} ${"Date".padEnd(12)} ${"Payment".padStart(12)} ${"Extra".padStart(10)} ${"Principal".padStart(12)} ${"Interest".padStart(12)} ${"Balance".padStart(14)}`);
  L.push("-".repeat(80));
  for (const row of r.schedule) {
    L.push(
      `  ${String(row.paymentNumber).padEnd(5)} ${row.date.padEnd(12)} ${formatNumber(row.payment).padStart(12)} ${formatNumber(row.extraPayment).padStart(10)} ${formatNumber(row.principal).padStart(12)} ${formatNumber(row.interest).padStart(12)} ${formatNumber(row.balance).padStart(14)}`,
    );
  }
  L.push("=".repeat(80));

  // year-by-year summary
  const yby = yearByYearSummary(r.schedule);
  if (yby.length > 0) {
    L.push("");
    L.push("YEAR-BY-YEAR SUMMARY");
    L.push("-".repeat(80));
    L.push(`  ${"Year".padEnd(6)} ${"#Pmts".padStart(6)} ${"Paid".padStart(14)} ${"Principal".padStart(14)} ${"Interest".padStart(14)} ${"End Balance".padStart(14)}`);
    L.push("-".repeat(80));
    for (const y of yby) {
      L.push(
        `  ${String(y.year).padEnd(6)} ${String(y.paymentCount).padStart(6)} ${formatNumber(y.totalPayment).padStart(14)} ${formatNumber(y.totalPrincipal).padStart(14)} ${formatNumber(y.totalInterest).padStart(14)} ${formatNumber(y.endingBalance).padStart(14)}`,
      );
    }
    L.push("=".repeat(80));
  }

  return L.join("\n");
}

/** Render the amortization schedule as CSV. */
export function renderCsv(input: LoanInput, r: LoanResult): string {
  const lines: string[] = [];
  lines.push("field,value");
  lines.push(`loan_amount,${num(input.loanAmount)}`);
  lines.push(`annual_interest_rate_pct,${num(input.annualInterestRate)}`);
  lines.push(`loan_term_years,${num(input.loanTermYears)}`);
  lines.push(`start_date,${escapeCsv(input.startDate)}`);
  lines.push(`payment_frequency,${escapeCsv(input.paymentFrequency)}`);
  lines.push(`extra_payment,${num(input.extraPayment)}`);
  if (r.valid) {
    lines.push(`periodic_rate,${num(r.periodicRate)}`);
    lines.push(`payments_per_year,${r.paymentsPerYear}`);
    lines.push(`total_payments_scheduled,${r.totalPayments}`);
    lines.push(`actual_payments,${r.actualPayments}`);
    lines.push(`periodic_payment,${num(r.payment)}`);
    lines.push(`total_interest,${num(r.totalInterest)}`);
    lines.push(`total_paid,${num(r.totalPaid)}`);
    lines.push(`payoff_date,${escapeCsv(r.payoffDate ?? "")}`);

    if (input.extraPayment > 0) {
      const savings = computeSavings(input);
      lines.push(`interest_savings,${num(savings.interestSavings)}`);
      lines.push(`payments_saved,${savings.paymentsSaved}`);
      lines.push(`months_saved,${savings.monthsSaved}`);
    }

    lines.push("");
    lines.push("payment_num,date,payment,extra_payment,principal,interest,balance");
    for (const row of r.schedule) {
      lines.push([
        String(row.paymentNumber),
        escapeCsv(row.date),
        num(row.payment),
        num(row.extraPayment),
        num(row.principal),
        num(row.interest),
        num(row.balance),
      ].join(","));
    }

    const yby = yearByYearSummary(r.schedule);
    if (yby.length > 0) {
      lines.push("");
      lines.push("year,payment_count,total_paid,total_principal,total_interest,ending_balance");
      for (const y of yby) {
        lines.push([
          String(y.year),
          String(y.paymentCount),
          num(y.totalPayment),
          num(y.totalPrincipal),
          num(y.totalInterest),
          num(y.endingBalance),
        ].join(","));
      }
    }
  } else {
    lines.push("");
    lines.push("error,validation");
    for (const e of r.errors) lines.push(`${escapeCsv(e)},validation`);
  }
  return lines.join("\n");
}

function num(n: number): string {
  if (!Number.isFinite(n)) return "";
  return n.toFixed(4);
}

// ---- Summary stats ----

/** Build a compact summary stats object from a result + savings analysis. */
export function summaryStats(r: LoanResult, savings?: SavingsAnalysis): LoanSummaryStats {
  return {
    payment: r.payment,
    totalInterest: r.totalInterest,
    totalPaid: r.totalPaid,
    payoffDate: r.payoffDate,
    interestSavings: savings ? savings.interestSavings : 0,
    paymentsSaved: savings ? savings.paymentsSaved : 0,
    actualPayments: r.actualPayments,
    totalPayments: r.totalPayments,
  };
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:loan-amortization-schedule:history";
const HISTORY_MAX = 20;

export function loadHistory(): LoanHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as LoanHistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: LoanHistoryEntry): LoanHistoryEntry[] {
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

export function buildShareUrl(input: Partial<LoanInput>): string {
  const params = new URLSearchParams();
  if (Number.isFinite(input.loanAmount)) params.set("amt", String(input.loanAmount));
  if (Number.isFinite(input.annualInterestRate)) params.set("rate", String(input.annualInterestRate));
  if (Number.isFinite(input.loanTermYears)) params.set("years", String(input.loanTermYears));
  if (input.startDate) params.set("start", input.startDate);
  if (input.paymentFrequency) params.set("freq", input.paymentFrequency);
  if (Number.isFinite(input.extraPayment) && (input.extraPayment ?? 0) > 0) {
    params.set("extra", String(input.extraPayment));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<LoanInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<LoanInput> = {};
  const amt = params.get("amt");
  if (amt !== null) {
    const n = Number(amt);
    if (Number.isFinite(n)) out.loanAmount = n;
  }
  const rate = params.get("rate");
  if (rate !== null) {
    const n = Number(rate);
    if (Number.isFinite(n)) out.annualInterestRate = n;
  }
  const years = params.get("years");
  if (years !== null) {
    const n = Number(years);
    if (Number.isFinite(n)) out.loanTermYears = n;
  }
  const start = params.get("start");
  if (start !== null && /^\d{4}-\d{2}-\d{2}$/.test(start)) out.startDate = start;
  const freq = params.get("freq");
  if (freq !== null && (freq === "monthly" || freq === "bi-weekly" || freq === "weekly")) {
    out.paymentFrequency = freq;
  }
  const extra = params.get("extra");
  if (extra !== null) {
    const n = Number(extra);
    if (Number.isFinite(n)) out.extraPayment = n;
  }
  return out;
}

// ---- Helpers ----

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Annuity Calculator — pure logic.
 * Present value, future value, payout amount, term, rate, payment frequency.
 */

export type PaymentFrequency = "monthly" | "quarterly" | "semiannual" | "annual";
export type AnnuityType = "ordinary" | "annuity-due";

export interface AnnuityInput {
  /** Annual interest rate as a decimal (e.g., 0.05 for 5%). */
  annualRate: number;
  /** Term in years. */
  termYears: number;
  /** Payment frequency. */
  frequency: PaymentFrequency;
  /** Annuity type. */
  type: AnnuityType;
  /** Either presentValue, futureValue, or paymentAmount — solve for the missing one. */
  presentValue?: number;
  futureValue?: number;
  paymentAmount?: number;
}

export interface AnnuityResult {
  input: AnnuityInput;
  periodsPerYear: number;
  totalPeriods: number;
  periodicRate: number;
  /** Solved value: presentValue, futureValue, or paymentAmount. */
  solved: { field: "presentValue" | "futureValue" | "paymentAmount"; value: number };
  presentValue: number;
  futureValue: number;
  paymentAmount: number;
  totalPayments: number;
  totalInterest: number;
  warnings: string[];
  notes: string[];
}

const PERIODS_PER_YEAR: Record<PaymentFrequency, number> = {
  monthly: 12, quarterly: 4, semiannual: 2, annual: 1,
};

export function getPeriodsPerYear(freq: PaymentFrequency): number {
  return PERIODS_PER_YEAR[freq];
}

export function getFrequencies(): PaymentFrequency[] {
  return ["monthly", "quarterly", "semiannual", "annual"];
}

/** Present value of an ordinary annuity: PV = PMT × [1 - (1+r)^-n] / r */
export function calcPV(payment: number, r: number, n: number, type: AnnuityType = "ordinary"): number {
  if (r === 0) return payment * n;
  const factor = (1 - Math.pow(1 + r, -n)) / r;
  return type === "ordinary" ? payment * factor : payment * factor * (1 + r);
}

/** Future value of an ordinary annuity: FV = PMT × [(1+r)^n - 1] / r */
export function calcFV(payment: number, r: number, n: number, type: AnnuityType = "ordinary"): number {
  if (r === 0) return payment * n;
  const factor = (Math.pow(1 + r, n) - 1) / r;
  return type === "ordinary" ? payment * factor : payment * factor * (1 + r);
}

/** Payment amount from PV: PMT = PV × r / [1 - (1+r)^-n] */
export function calcPaymentFromPV(pv: number, r: number, n: number, type: AnnuityType = "ordinary"): number {
  if (r === 0) return pv / n;
  const factor = (1 - Math.pow(1 + r, -n)) / r;
  return type === "ordinary" ? pv / factor : pv / (factor * (1 + r));
}

/** Payment amount from FV: PMT = FV × r / [(1+r)^n - 1] */
export function calcPaymentFromFV(fv: number, r: number, n: number, type: AnnuityType = "ordinary"): number {
  if (r === 0) return fv / n;
  const factor = (Math.pow(1 + r, n) - 1) / r;
  return type === "ordinary" ? fv / factor : fv / (factor * (1 + r));
}

export function planAnnuity(input: AnnuityInput): AnnuityResult {
  const warnings: string[] = [];
  const notes: string[] = [];

  if (input.annualRate < 0) warnings.push("Annual rate should be ≥ 0.");
  if (input.termYears <= 0) warnings.push("Term years must be > 0.");

  const periodsPerYear = PERIODS_PER_YEAR[input.frequency];
  const totalPeriods = input.termYears * periodsPerYear;
  const periodicRate = input.annualRate / periodsPerYear;

  let presentValue = input.presentValue ?? 0;
  let futureValue = input.futureValue ?? 0;
  let paymentAmount = input.paymentAmount ?? 0;
  let solvedField: "presentValue" | "futureValue" | "paymentAmount" = "presentValue";

  // Determine what to solve for
  if (input.paymentAmount !== undefined && input.futureValue === undefined && input.presentValue === undefined) {
    // Solve for both PV and FV from payment
    presentValue = calcPV(input.paymentAmount, periodicRate, totalPeriods, input.type);
    futureValue = calcFV(input.paymentAmount, periodicRate, totalPeriods, input.type);
    solvedField = "presentValue";
  } else if (input.presentValue !== undefined && input.paymentAmount === undefined) {
    // Solve for payment from PV
    paymentAmount = calcPaymentFromPV(input.presentValue, periodicRate, totalPeriods, input.type);
    futureValue = calcFV(paymentAmount, periodicRate, totalPeriods, input.type);
    solvedField = "paymentAmount";
  } else if (input.futureValue !== undefined && input.paymentAmount === undefined) {
    // Solve for payment from FV
    paymentAmount = calcPaymentFromFV(input.futureValue, periodicRate, totalPeriods, input.type);
    presentValue = calcPV(paymentAmount, periodicRate, totalPeriods, input.type);
    solvedField = "paymentAmount";
  } else if (input.presentValue !== undefined && input.futureValue !== undefined) {
    // Both PV and FV given — solve for payment (which satisfies both)
    // Use PV → payment, then verify FV
    paymentAmount = calcPaymentFromPV(input.presentValue, periodicRate, totalPeriods, input.type);
    solvedField = "paymentAmount";
  }

  const totalPayments = paymentAmount * totalPeriods;
  const totalInterest = futureValue - totalPayments > 0 ? futureValue - totalPayments : presentValue > 0 ? totalPayments - presentValue : 0;

  if (input.type === "annuity-due") notes.push("annuity due: payments made at the beginning of each period.");
  if (input.annualRate === 0) notes.push("Zero interest rate — payment = total / periods.");

  return {
    input, periodsPerYear, totalPeriods, periodicRate,
    solved: { field: solvedField, value: solvedField === "presentValue" ? presentValue : solvedField === "futureValue" ? futureValue : paymentAmount },
    presentValue, futureValue, paymentAmount, totalPayments, totalInterest, warnings, notes,
  };
}

export function planBatch(inputs: AnnuityInput[]): AnnuityResult[] {
  return inputs.map(planAnnuity);
}

export function renderBatchCsv(results: AnnuityResult[]): string {
  const lines: string[] = ["index,pv,fv,payment,total_payments,total_interest"];
  results.forEach((r, i) => {
    lines.push([
      String(i + 1), r.presentValue.toFixed(2), r.futureValue.toFixed(2), r.paymentAmount.toFixed(2),
      r.totalPayments.toFixed(2), r.totalInterest.toFixed(2),
    ].join(","));
  });
  return lines.join("\n");
}

export function renderReport(r: AnnuityResult): string {
  const lines: string[] = [];
  lines.push("Annuity Calculation Report");
  lines.push("===========================");
  lines.push(`Annual rate: ${(r.input.annualRate * 100).toFixed(3)}%`);
  lines.push(`Term: ${r.input.termYears} years (${r.totalPeriods} periods)`);
  lines.push(`Frequency: ${r.input.frequency} (${r.periodsPerYear}/year)`);
  lines.push(`Periodic rate: ${(r.periodicRate * 100).toFixed(5)}%`);
  lines.push(`Type: ${r.input.type === "ordinary" ? "Ordinary annuity (end of period)" : "Annuity due (beginning of period)"}`);
  lines.push("");
  lines.push(`Present value: $${r.presentValue.toFixed(2)}`);
  lines.push(`Future value: $${r.futureValue.toFixed(2)}`);
  lines.push(`Payment per period: $${r.paymentAmount.toFixed(2)}`);
  lines.push(`Total payments: $${r.totalPayments.toFixed(2)}`);
  lines.push(`Total interest: $${r.totalInterest.toFixed(2)}`);
  lines.push(`Solved field: ${r.solved.field}`);
  if (r.warnings.length) { lines.push(""); lines.push("Warnings:"); r.warnings.forEach((w) => lines.push(`  ! ${w}`)); }
  if (r.notes.length) { lines.push(""); lines.push("Notes:"); r.notes.forEach((n) => lines.push(`  • ${n}`)); }
  return lines.join("\n");
}

export const ANNUITY_PRESETS = [
  { id: "retirement", label: "Retirement annuity (30y, 6%)", annualRate: 0.06, termYears: 30, frequency: "monthly" as PaymentFrequency, type: "ordinary" as AnnuityType, paymentAmount: 500 },
  { id: "lottery", label: "Lottery payout (20y, 4%)", annualRate: 0.04, termYears: 20, frequency: "annual" as PaymentFrequency, type: "ordinary" as AnnuityType, presentValue: 1_000_000 },
  { id: "savings", label: "Savings goal (10y, 5%)", annualRate: 0.05, termYears: 10, frequency: "monthly" as PaymentFrequency, type: "ordinary" as AnnuityType, futureValue: 50_000 },
  { id: "mortgage-style", label: "Mortgage-style (25y, 7%)", annualRate: 0.07, termYears: 25, frequency: "monthly" as PaymentFrequency, type: "ordinary" as AnnuityType, presentValue: 200_000 },
];

export function getAnnuityPresets() { return [...ANNUITY_PRESETS]; }

export function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(amount);
}

/** Generate an amortization schedule (PV → payment breakdown per period). */
export function amortizationSchedule(pv: number, payment: number, r: number, n: number): { period: number; payment: number; interest: number; principal: number; balance: number }[] {
  const out: { period: number; payment: number; interest: number; principal: number; balance: number }[] = [];
  let balance = pv;
  for (let i = 1; i <= n; i++) {
    const interest = balance * r;
    const principal = payment - interest;
    balance = Math.max(0, balance - principal);
    out.push({ period: i, payment, interest, principal, balance });
  }
  return out;
}

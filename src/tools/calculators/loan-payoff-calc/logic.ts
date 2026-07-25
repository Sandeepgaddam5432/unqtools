/**
 * Loan Payoff Calculator — pure amortization with extra payments. No DOM access.
 *
 * Monthly payment: P · r · (1+r)^n / ((1+r)^n − 1)
 *  P = principal, r = monthly rate, n = tenure months
 * Extra payments reduce balance early, shortening the loan and saving interest.
 */

export interface LoanInput {
  principal: number;
  annualRatePct: number;
  tenureMonths: number;
  /** Extra payment applied every month. */
  extraMonthly?: number;
  /** One-time lump sum at the start of this 1-indexed month. */
  oneTimePrepayment?: { month: number; amount: number };
}

export interface PayoffRow {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  extra: number;
  balance: number;
}

export interface PayoffResult {
  monthlyPayment: number;
  actualMonths: number;
  totalInterest: number;
  totalPaid: number;
  interestSaved: number;
  monthsSaved: number;
  schedule: PayoffRow[];
}

const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Compute the standard monthly payment for a loan. */
export function computeMonthlyPayment(principal: number, monthlyRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  if (monthlyRate === 0) return principal / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * factor) / (factor - 1);
}

/** Compute baseline (no extra) totals for comparison. */
function computeBaseline(principal: number, monthlyRate: number, months: number): { totalInterest: number; actualMonths: number } {
  const payment = computeMonthlyPayment(principal, monthlyRate, months);
  if (payment === 0) return { totalInterest: 0, actualMonths: 0 };
  let balance = principal;
  let interest = 0;
  for (let i = 0; i < months; i++) {
    const intr = balance * monthlyRate;
    let principalPart = payment - intr;
    if (principalPart > balance) principalPart = balance;
    balance -= principalPart;
    interest += intr;
    if (balance <= 0.005) return { totalInterest: r2(interest), actualMonths: i + 1 };
  }
  return { totalInterest: r2(interest), actualMonths: months };
}

/** Calculate loan payoff with optional extra payments. */
export function calculateLoanPayoff(input: LoanInput): PayoffResult | { error: string } {
  const { principal, annualRatePct, tenureMonths } = input;
  if (principal <= 0) return { error: "Principal must be greater than 0." };
  if (tenureMonths <= 0) return { error: "Tenure must be greater than 0 months." };
  if (principal > 1e15) return { error: "Principal is unrealistically large." };

  const monthlyRate = annualRatePct / 100 / 12;
  const payment = computeMonthlyPayment(principal, monthlyRate, tenureMonths);
  if (payment === 0) return { error: "Could not compute monthly payment." };

  const baseline = computeBaseline(principal, monthlyRate, tenureMonths);
  const schedule: PayoffRow[] = [];
  let balance = principal;
  let totalInterest = 0;
  let totalPaid = 0;
  const extra = input.extraMonthly ?? 0;
  const oneTime = input.oneTimePrepayment;

  for (let month = 1; month <= tenureMonths; month++) {
    const interest = balance * monthlyRate;
    let principalPart = payment - interest;
    let extraThisMonth = 0;
    if (extra > 0 && balance > 0) {
      const e = Math.min(extra, balance - principalPart);
      if (e > 0) { extraThisMonth += e; principalPart += e; }
    }
    if (oneTime && oneTime.month === month && oneTime.amount > 0 && balance > 0) {
      const lump = Math.min(oneTime.amount, balance - principalPart);
      if (lump > 0) { extraThisMonth += lump; principalPart += lump; }
    }
    if (principalPart > balance) principalPart = balance;
    balance -= principalPart;
    totalInterest += interest;
    totalPaid += interest + principalPart;
    schedule.push({
      month,
      payment: r2(payment),
      interest: r2(interest),
      principal: r2(principalPart),
      extra: r2(extraThisMonth),
      balance: r2(Math.max(0, balance)),
    });
    if (balance <= 0.005) break;
  }

  return {
    monthlyPayment: r2(payment),
    actualMonths: schedule.length,
    totalInterest: r2(totalInterest),
    totalPaid: r2(totalPaid),
    interestSaved: r2(Math.max(0, baseline.totalInterest - totalInterest)),
    monthsSaved: Math.max(0, baseline.actualMonths - schedule.length),
    schedule,
  };
}

/** Format a number as currency. */
export function formatCurrency(amount: number, locale = "en-US", currency = "USD"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Convert schedule rows to CSV. */
export function scheduleToCsv(schedule: PayoffRow[]): string {
  const header = "Month,Payment,Interest,Principal,Extra,Balance";
  const rows = schedule.map((r) => `${r.month},${r.payment},${r.interest},${r.principal},${r.extra},${r.balance}`);
  return [header, ...rows].join("\n");
}

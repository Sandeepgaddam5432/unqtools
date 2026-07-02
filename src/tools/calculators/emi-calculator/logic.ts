/**
 * Loan / EMI Calculator — pure logic.
 *
 * Standard EMI formula:  emi = P · r · (1+r)^n / ((1+r)^n − 1)
 *   P = principal, r = monthly rate (annual% / 12 / 100), n = total months
 *
 * Edge cases handled:
 *  - r = 0  (zero-interest loan): emi = P / n
 *  - n = 0  (invalid): error
 *  - Final-month rounding so the schedule sums exactly to total payment.
 *  - Prepayments (one-time at month k + recurring extra per month): reduce
 *    principal early, recalculate remaining months at the same emi until
 *    balance clears.
 */

export interface EmiInput {
  principal: number;
  annualRatePct: number; // e.g. 9.5 for 9.5%
  tenureMonths: number;
  /** Optional one-time lump-sum prepayment at the start of this 1-indexed month. */
  oneTimePrepayment?: { month: number; amount: number };
  /** Optional extra amount added to every monthly payment. */
  recurringExtra?: number;
}

export interface AmortizationRow {
  month: number;
  emi: number;
  interest: number;
  principal: number;
  prepayment: number;
  balance: number;
  cumulativeInterest: number;
  cumulativePrincipal: number;
}

export interface EmiResult {
  emi: number;
  totalInterest: number;
  totalPayment: number;
  schedule: AmortizationRow[];
  /** Months actually paid (may be less than tenureMonths due to prepayment). */
  actualMonths: number;
  /** Interest saved vs. no-prepayment baseline. */
  interestSaved: number;
  /** Months saved vs. no-prepayment baseline. */
  monthsSaved: number;
}

/** Round to 2 decimal places using round-half-up. */
function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Compute EMI for given principal, monthly rate, months. Returns 0 if invalid. */
export function computeEmi(principal: number, monthlyRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  if (monthlyRate === 0) return principal / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * factor) / (factor - 1);
}

/** Compute baseline (no-prepayment) result for interest-saved comparison. */
function computeBaseline(
  principal: number,
  monthlyRate: number,
  months: number,
): { totalInterest: number; actualMonths: number } {
  const emi = computeEmi(principal, monthlyRate, months);
  if (emi === 0) return { totalInterest: 0, actualMonths: 0 };
  let balance = principal;
  let totalInterest = 0;
  for (let i = 0; i < months; i++) {
    const interest = balance * monthlyRate;
    let principalPart = emi - interest;
    if (principalPart > balance) principalPart = balance;
    balance -= principalPart;
    totalInterest += interest;
    if (balance <= 0.005) {
      return { totalInterest: r2(totalInterest), actualMonths: i + 1 };
    }
  }
  return { totalInterest: r2(totalInterest), actualMonths: months };
}

/** Build full amortization schedule with optional prepayments. */
export function calculateEmi(input: EmiInput): EmiResult | { error: string } {
  const { principal, annualRatePct, tenureMonths } = input;
  if (principal <= 0) return { error: "Principal must be greater than 0." };
  if (tenureMonths <= 0) return { error: "Tenure must be greater than 0 months." };
  if (principal > 1e15) return { error: "Principal is unrealistically large." };

  const monthlyRate = annualRatePct / 100 / 12;
  const emi = computeEmi(principal, monthlyRate, tenureMonths);
  if (emi === 0) return { error: "Could not compute EMI from these inputs." };

  const baseline = computeBaseline(principal, monthlyRate, tenureMonths);

  const schedule: AmortizationRow[] = [];
  let balance = principal;
  let totalInterest = 0;
  let totalPrincipal = 0;
  let cumulativeInterest = 0;
  let cumulativePrincipal = 0;
  const oneTime = input.oneTimePrepayment;
  const recurring = input.recurringExtra ?? 0;

  for (let month = 1; month <= tenureMonths; month++) {
    const interest = balance * monthlyRate;
    let principalPart = emi - interest;
    let prepaymentThisMonth = 0;

    // Apply recurring extra
    if (recurring > 0 && balance > 0) {
      const extra = Math.min(recurring, balance - principalPart);
      if (extra > 0) {
        prepaymentThisMonth += extra;
        principalPart += extra;
      }
    }

    // Apply one-time prepayment at the specified month
    if (oneTime && oneTime.month === month && oneTime.amount > 0 && balance > 0) {
      const lumpSum = Math.min(oneTime.amount, balance - principalPart);
      if (lumpSum > 0) {
        prepaymentThisMonth += lumpSum;
        principalPart += lumpSum;
      }
    }

    // Clamp to remaining balance
    if (principalPart > balance) principalPart = balance;
    balance -= principalPart;
    totalInterest += interest;
    totalPrincipal += principalPart;
    cumulativeInterest = totalInterest;
    cumulativePrincipal = totalPrincipal;

    schedule.push({
      month,
      emi: r2(emi),
      interest: r2(interest),
      principal: r2(principalPart),
      prepayment: r2(prepaymentThisMonth),
      balance: r2(Math.max(0, balance)),
      cumulativeInterest: r2(cumulativeInterest),
      cumulativePrincipal: r2(cumulativePrincipal),
    });

    if (balance <= 0.005) break;
  }

  const actualMonths = schedule.length;
  const totalPayment = totalInterest + totalPrincipal;

  return {
    emi: r2(emi),
    totalInterest: r2(totalInterest),
    totalPayment: r2(totalPayment),
    schedule,
    actualMonths,
    interestSaved: r2(Math.max(0, baseline.totalInterest - totalInterest)),
    monthsSaved: Math.max(0, baseline.actualMonths - actualMonths),
  };
}

/** Format a number as currency in a given locale + currency code. */
export function formatCurrency(amount: number, locale = "en-IN", currency = "INR"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Convert schedule rows to CSV (monthly or yearly grouping). */
export function scheduleToCsv(
  schedule: AmortizationRow[],
  grouping: "monthly" | "yearly" = "monthly",
): string {
  if (grouping === "monthly") {
    const header =
      "Month,EMI,Interest,Principal,Prepayment,Balance,Cumulative Interest,Cumulative Principal";
    const rows = schedule.map(
      (r) =>
        `${r.month},${r.emi},${r.interest},${r.principal},${r.prepayment},${r.balance},${r.cumulativeInterest},${r.cumulativePrincipal}`,
    );
    return [header, ...rows].join("\n");
  }
  // Yearly grouping: aggregate every 12 months
  const header = "Year,Total EMI,Total Interest,Total Principal,Total Prepayment,Ending Balance";
  const rows: string[] = [];
  for (let yearStart = 0; yearStart < schedule.length; yearStart += 12) {
    const yearRows = schedule.slice(yearStart, yearStart + 12);
    if (yearRows.length === 0) break;
    const year = Math.floor(yearStart / 12) + 1;
    const totalEmi = yearRows.reduce((s, r) => s + r.emi, 0);
    const totalInterest = yearRows.reduce((s, r) => s + r.interest, 0);
    const totalPrincipal = yearRows.reduce((s, r) => s + r.principal, 0);
    const totalPrepayment = yearRows.reduce((s, r) => s + r.prepayment, 0);
    const endingBalance = yearRows[yearRows.length - 1]!.balance;
    rows.push(
      `${year},${r2(totalEmi)},${r2(totalInterest)},${r2(totalPrincipal)},${r2(totalPrepayment)},${endingBalance}`,
    );
  }
  return [header, ...rows].join("\n");
}

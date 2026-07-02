/**
 * SIP Calculator — pure logic.
 *
 * Standard SIP future value formula:
 *   FV = P × [((1+r)^n − 1) / r] × (1+r)
 * where P = monthly investment, r = monthly rate, n = total months.
 * The (1+r) factor accounts for the fact that each installment is made at
 * the start of the month (annuity-due convention).
 *
 * For step-up SIPs (annual increase), we calculate by iterating month-by-month
 * because the closed-form for step-up is more complex.
 */

export interface SipInput {
  monthlyInvestment: number;
  annualReturnPct: number;
  years: number;
  /** Annual step-up percentage (e.g. 10 = 10% increase each year). */
  stepUpPct?: number;
  /** Optional inflation rate (annual %) to show real (inflation-adjusted) value. */
  inflationPct?: number;
}

export interface SipYearRow {
  year: number;
  investedThisYear: number;
  totalInvested: number;
  yearEndValue: number;
  returns: number;
}

export interface SipResult {
  totalInvested: number;
  futureValue: number;
  totalReturns: number;
  /** Inflation-adjusted future value (real purchasing power). */
  realFutureValue?: number;
  /** Wealth ratio (futureValue / totalInvested). */
  wealthRatio: number;
  /** Year-by-year breakdown. */
  yearlyBreakdown: SipYearRow[];
}

export function calculateSip(input: SipInput): SipResult | { error: string } {
  const { monthlyInvestment, annualReturnPct, years } = input;
  if (monthlyInvestment <= 0) return { error: "Monthly investment must be greater than 0." };
  if (years <= 0) return { error: "Duration must be greater than 0 years." };
  if (years > 100) return { error: "Duration cannot exceed 100 years." };

  const monthlyRate = annualReturnPct / 100 / 12;
  const stepUpPct = input.stepUpPct ?? 0;
  const inflationPct = input.inflationPct ?? 0;
  const totalMonths = Math.round(years * 12);

  // Iterate month-by-month to support annual step-up cleanly.
  let balance = 0;
  let totalInvested = 0;
  let currentMonthly = monthlyInvestment;
  const yearlyBreakdown: SipYearRow[] = [];

  for (let m = 1; m <= totalMonths; m++) {
    // Step up at the start of each year (except year 1)
    if (m > 1 && (m - 1) % 12 === 0) {
      currentMonthly = currentMonthly * (1 + stepUpPct / 100);
    }
    // Invest at start of month, then compound
    balance = (balance + currentMonthly) * (1 + monthlyRate);
    totalInvested += currentMonthly;

    // Capture year-end snapshot
    if (m % 12 === 0) {
      const year = m / 12;
      const prevInvested =
        yearlyBreakdown.length > 0 ? yearlyBreakdown[yearlyBreakdown.length - 1]!.totalInvested : 0;
      yearlyBreakdown.push({
        year,
        investedThisYear: r2(totalInvested - prevInvested),
        totalInvested: r2(totalInvested),
        yearEndValue: r2(balance),
        returns: r2(balance - totalInvested),
      });
    }
  }

  const futureValue = r2(balance);
  const totalReturns = r2(futureValue - totalInvested);
  const wealthRatio = r2(futureValue / totalInvested);

  let realFutureValue: number | undefined;
  if (inflationPct > 0) {
    // Real value = nominal / (1 + i)^years
    realFutureValue = r2(futureValue / Math.pow(1 + inflationPct / 100, years));
  }

  return {
    totalInvested: r2(totalInvested),
    futureValue,
    totalReturns,
    realFutureValue,
    wealthRatio,
    yearlyBreakdown,
  };
}

/** Closed-form SIP future value (no step-up). Used as a sanity check. */
export function sipClosedForm(
  monthlyInvestment: number,
  monthlyRate: number,
  months: number,
): number {
  if (monthlyRate === 0) return monthlyInvestment * months;
  const factor = Math.pow(1 + monthlyRate, months);
  return monthlyInvestment * ((factor - 1) / monthlyRate) * (1 + monthlyRate);
}

/** Round to 2 decimal places using round-half-up. */
function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Format currency. */
export function formatCurrency(amount: number, locale = "en-IN", currency = "INR"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format compact (e.g. ₹1.2L, ₹3.4Cr for INR). */
export function formatCompact(amount: number, locale = "en-IN", currency = "INR"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(amount);
}

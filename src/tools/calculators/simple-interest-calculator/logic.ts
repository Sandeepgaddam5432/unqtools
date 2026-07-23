/**
 * Simple Interest Calculator — pure logic.
 *
 * SI = P * R * T / 100
 * A = P + SI
 *
 * Solver modes: SI | P | R | T
 */

export type SiSolveFor = "si" | "principal" | "rate" | "time";

export interface SiInput {
  solveFor: SiSolveFor;
  principal?: number;
  rate?: number;        // annual %
  time?: number;        // years (can be fractional)
  interest?: number;    // SI (when solving for P/R/T)
  /** Optional: compounding frequency for CI comparison (1=annual, 12=monthly, 4=quarterly). */
  compoundFreq?: number;
  /** Optional: inflation rate % for inflation-adjusted future value. */
  inflationRate?: number;
}

export interface SiResult {
  principal: number;
  rate: number;
  time: number;
  interest: number;
  amount: number;
  perYear: number;
  perMonth: number;
  perDay: number;
  breakdown: { period: string; interest: number; cumulativeInterest: number; balance: number }[];
  compoundInterestComparison?: { interest: number; amount: number; difference: number };
  inflationAdjusted?: { realValue: number; lostToInflation: number };
  solved: SiSolveFor;
}

const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function calculateSimpleInterest(input: SiInput): SiResult | { error: string } {
  const { solveFor } = input;
  let principal: number | undefined = input.principal;
  let rate: number | undefined = input.rate;
  let time: number | undefined = input.time;
  let interest: number | undefined = input.interest;

  switch (solveFor) {
    case "si":
      if (principal === undefined || rate === undefined || time === undefined)
        return { error: "To solve for SI, provide principal, rate, and time." };
      interest = (principal * rate * time) / 100;
      break;
    case "principal":
      if (interest === undefined || rate === undefined || time === undefined)
        return { error: "To solve for principal, provide interest, rate, and time." };
      if (rate === 0 || time === 0) return { error: "Rate and time must be non-zero to solve for principal." };
      principal = (interest * 100) / (rate * time);
      break;
    case "rate":
      if (interest === undefined || principal === undefined || time === undefined)
        return { error: "To solve for rate, provide interest, principal, and time." };
      if (principal === 0 || time === 0) return { error: "Principal and time must be non-zero to solve for rate." };
      rate = (interest * 100) / (principal * time);
      break;
    case "time":
      if (interest === undefined || principal === undefined || rate === undefined)
        return { error: "To solve for time, provide interest, principal, and rate." };
      if (principal === 0 || rate === 0) return { error: "Principal and rate must be non-zero to solve for time." };
      time = (interest * 100) / (principal * rate);
      break;
  }

  // Validate
  if (principal! < 0) return { error: "Principal cannot be negative." };
  if (rate! < 0) return { error: "Rate cannot be negative." };
  if (time! < 0) return { error: "Time cannot be negative." };

  const finalInterest = interest!;
  const amount = principal! + finalInterest;
  const perYear = finalInterest / time!;
  const perMonth = perYear / 12;
  const perDay = finalInterest / (time! * 365);

  // Breakdown per year
  const fullYears = Math.floor(time!);
  const partialYear = time! - fullYears;
  const breakdown: SiResult["breakdown"] = [];
  let cumInterest = 0;
  for (let y = 1; y <= fullYears; y++) {
    cumInterest += perYear;
    breakdown.push({
      period: `Year ${y}`,
      interest: r2(perYear),
      cumulativeInterest: r2(cumInterest),
      balance: r2(principal! + cumInterest),
    });
  }
  if (partialYear > 0) {
    const partialInterest = perYear * partialYear;
    cumInterest += partialInterest;
    breakdown.push({
      period: `Year ${fullYears + 1} (partial ${r2(partialYear)} yr)`,
      interest: r2(partialInterest),
      cumulativeInterest: r2(cumInterest),
      balance: r2(principal! + cumInterest),
    });
  }

  // Optional CI comparison
  let compoundInterestComparison: SiResult["compoundInterestComparison"];
  if (input.compoundFreq && input.compoundFreq > 0) {
    const n = input.compoundFreq;
    const amountCI = principal! * Math.pow(1 + rate! / 100 / n, n * time!);
    const interestCI = amountCI - principal!;
    compoundInterestComparison = {
      interest: r2(interestCI),
      amount: r2(amountCI),
      difference: r2(interestCI - finalInterest),
    };
  }

  // Optional inflation-adjusted future value
  let inflationAdjusted: SiResult["inflationAdjusted"];
  if (input.inflationRate !== undefined && input.inflationRate >= 0) {
    const realValue = amount / Math.pow(1 + input.inflationRate / 100, time!);
    inflationAdjusted = {
      realValue: r2(realValue),
      lostToInflation: r2(amount - realValue),
    };
  }

  return {
    principal: r2(principal!),
    rate: r2(rate!),
    time: r2(time!),
    interest: r2(finalInterest),
    amount: r2(amount),
    perYear: r2(perYear),
    perMonth: r2(perMonth),
    perDay: r2(perDay),
    breakdown,
    compoundInterestComparison,
    inflationAdjusted,
    solved: solveFor,
  };
}

export function breakdownToCsv(breakdown: SiResult["breakdown"]): string {
  const lines = ["Period,Interest,CumulativeInterest,Balance"];
  for (const r of breakdown) {
    lines.push(`${r.period},${r.interest},${r.cumulativeInterest},${r.balance}`);
  }
  return lines.join("\n");
}

export function formatMoney(amount: number, currency = "USD", locale = "en-US"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

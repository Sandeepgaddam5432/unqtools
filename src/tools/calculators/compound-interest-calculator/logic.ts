/**
 * Compound Interest Calculator — pure logic.
 *
 * Formula: A = P * (1 + r/n)^(n*t)
 * With contributions: A = P*(1+r/n)^(n*t) + PMT * [((1+r/n)^(n*t) - 1) / (r/n)] * (startMultiplier)
 * Continuous: A = P * e^(r*t) + PMT * [(e^(r*t) - 1) / r] (when r > 0)
 */

export type CompoundingFrequency =
  | "daily" | "weekly" | "bi-weekly" | "monthly" | "quarterly"
  | "semi-annually" | "annually" | "continuously" | "custom";

export type ContributionFrequency = "monthly" | "quarterly" | "annually";

export interface CompoundInput {
  principal: number;
  annualRatePct: number; // e.g. 7 for 7%
  years: number;
  compounding: CompoundingFrequency;
  customN?: number; // for "custom" compounding
  contributionAmount?: number; // regular contribution
  contributionFrequency?: ContributionFrequency;
  contributionAtStart?: boolean; // annuity-due vs ordinary annuity
  inflationRatePct?: number;
  taxRatePct?: number; // tax on interest gains
}

export interface YearRow {
  year: number;
  startBalance: number;
  contributions: number;
  interest: number;
  endBalance: number;
  totalContributions: number;
  totalInterest: number;
  realValue: number; // inflation-adjusted
}

export interface CompoundResult {
  finalAmount: number;
  totalPrincipal: number;
  totalContributions: number;
  totalInterest: number;
  totalTax: number;
  afterTaxAmount: number;
  realValue: number; // inflation-adjusted final amount
  effectiveAnnualRate: number; // APY %
  ruleOf72Years: number;
  breakdown: YearRow[];
  simpleInterestComparison: number;
  warnings: string[];
}

const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function getN(freq: CompoundingFrequency, customN?: number): number {
  switch (freq) {
    case "daily": return 365;
    case "weekly": return 52;
    case "bi-weekly": return 26;
    case "monthly": return 12;
    case "quarterly": return 4;
    case "semi-annually": return 2;
    case "annually": return 1;
    case "continuously": return Infinity;
    case "custom": return customN ?? 1;
  }
}

function getContributionPeriodsPerYear(freq: ContributionFrequency): number {
  switch (freq) {
    case "monthly": return 12;
    case "quarterly": return 4;
    case "annually": return 1;
  }
}

export function calculateCompoundInterest(input: CompoundInput): CompoundResult | { error: string } {
  const { principal, annualRatePct, years } = input;
  if (principal < 0) return { error: "Principal cannot be negative." };
  if (annualRatePct < -100 || annualRatePct > 1000) return { error: "Annual rate must be between -100% and 1000%." };
  if (years < 0) return { error: "Years cannot be negative." };
  if (years > 200) return { error: "Years must be 200 or less." };

  const n = getN(input.compounding, input.customN);
  const r = annualRatePct / 100;
  const t = years;
  const warnings: string[] = [];

  // Calculate contributions per compounding period
  const contributionPerYear = input.contributionAmount ?? 0;
  const contributionFreq = input.contributionFrequency ?? "monthly";
  const contributionPeriodsPerYear = getContributionPeriodsPerYear(contributionFreq);
  const contributionPerPeriod = contributionPerYear; // already the per-period amount
  const contributionsPerCompoundingPeriod = contributionPeriodsPerYear / n;

  // Year-by-year breakdown
  const breakdown: YearRow[] = [];
  let balance = principal;
  let totalContributions = 0;
  let totalInterest = 0;

  for (let year = 1; year <= Math.ceil(t); year++) {
    const startBalance = balance;
    let yearContributions = 0;
    let yearInterest = 0;

    // For fractional last year, scale down
    const yearFraction = year <= Math.floor(t) ? 1 : (t - Math.floor(t));
    const periodsInYear = Math.floor(n * yearFraction);
    const contributionPeriodsInYear = Math.floor(contributionPeriodsPerYear * yearFraction);

    if (n === Infinity) {
      // Continuous compounding: A = P * e^(r*t)
      const continuousGrowth = Math.exp(r * yearFraction);
      const newBalanceFromPrincipal = balance * continuousGrowth;
      yearInterest = newBalanceFromPrincipal - balance - yearContributions;
      balance = newBalanceFromPrincipal;
      // Add contributions
      for (let cp = 0; cp < contributionPeriodsInYear; cp++) {
        const contributionGrowth = input.contributionAtStart
          ? Math.exp(r * yearFraction * (1 - cp / contributionPeriodsInYear))
          : Math.exp(r * yearFraction * ((contributionPeriodsInYear - 1 - cp) / contributionPeriodsInYear));
        const contributionFutureValue = contributionPerPeriod * contributionGrowth;
        balance += contributionFutureValue;
        yearContributions += contributionPerPeriod;
        yearInterest += contributionFutureValue - contributionPerPeriod;
      }
    } else {
      // Discrete compounding
      const periodRate = r / n;
      for (let p = 0; p < periodsInYear; p++) {
        // Add contribution at start or end of period
        if (input.contributionAtStart && contributionPerPeriod > 0) {
          // For simplicity, assume contributions happen at the start of compounding periods
          // proportional to how many contribution periods fall in this compounding period
          const contribThisPeriod = contributionPerPeriod * contributionsPerCompoundingPeriod;
          if (contribThisPeriod > 0) {
            balance += contribThisPeriod;
            yearContributions += contribThisPeriod;
            totalContributions += contribThisPeriod;
          }
        }
        // Compound
        const interestThisPeriod = balance * periodRate;
        balance += interestThisPeriod;
        yearInterest += interestThisPeriod;
        if (!input.contributionAtStart && contributionPerPeriod > 0 && p < contributionPeriodsInYear) {
          const contribThisPeriod = contributionPerPeriod * contributionsPerCompoundingPeriod;
          if (contribThisPeriod > 0) {
            balance += contribThisPeriod;
            yearContributions += contribThisPeriod;
            totalContributions += contribThisPeriod;
          }
        }
      }
    }

    totalInterest += yearInterest;
    breakdown.push({
      year,
      startBalance: r2(startBalance),
      contributions: r2(yearContributions),
      interest: r2(yearInterest),
      endBalance: r2(balance),
      totalContributions: r2(totalContributions),
      totalInterest: r2(totalInterest),
      realValue: r2(input.inflationRatePct ? balance / Math.pow(1 + input.inflationRatePct / 100, year) : balance),
    });
  }

  // Tax on interest
  const taxRate = (input.taxRatePct ?? 0) / 100;
  const totalTax = totalInterest * taxRate;
  const afterTaxAmount = principal + totalContributions + totalInterest - totalTax;

  // Effective annual rate (APY)
  const effectiveAnnualRate = n === Infinity
    ? (Math.exp(r) - 1) * 100
    : (Math.pow(1 + r / n, n) - 1) * 100;

  // Rule of 72
  const ruleOf72Years = r > 0 ? 72 / (annualRatePct) : Infinity;

  // Simple interest comparison
  const simpleInterest = principal * r * t + totalContributions * r * t / 2;

  // Real value (inflation-adjusted)
  const realValue = input.inflationRatePct
    ? balance / Math.pow(1 + input.inflationRatePct / 100, t)
    : balance;

  if (r === 0) warnings.push("Annual rate is 0% — no interest will accrue.");
  if (r < 0) warnings.push("Negative interest rate — balance will decrease over time.");

  return {
    finalAmount: r2(balance),
    totalPrincipal: r2(principal),
    totalContributions: r2(totalContributions),
    totalInterest: r2(totalInterest),
    totalTax: r2(totalTax),
    afterTaxAmount: r2(afterTaxAmount),
    realValue: r2(realValue),
    effectiveAnnualRate: r2(effectiveAnnualRate),
    ruleOf72Years: r > 0 ? r2(ruleOf72Years) : Infinity,
    breakdown,
    simpleInterestComparison: r2(simpleInterest),
    warnings,
  };
}

export function breakdownToCsv(breakdown: YearRow[]): string {
  const lines = ["Year,StartBalance,Contributions,Interest,EndBalance,TotalContributions,TotalInterest,RealValue"];
  for (const r of breakdown) {
    lines.push(`${r.year},${r.startBalance},${r.contributions},${r.interest},${r.endBalance},${r.totalContributions},${r.totalInterest},${r.realValue}`);
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

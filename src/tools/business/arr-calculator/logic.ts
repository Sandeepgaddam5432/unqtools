/**
 * ARR Calculator — pure logic.
 *
 * Annual Recurring Revenue (ARR) is the annualised version of MRR.
 * This module computes:
 *   • ARR from MRR (or quarterly revenue)
 *   • Growth rate (period-over-period or CAGR)
 *   • Churn impact (lost ARR over a period)
 *   • Forward projections (linear or compounding)
 *
 * All inputs are in your chosen currency unit; results inherit it.
 */

export interface ArrInput {
  /** Monthly Recurring Revenue. */
  mrr: number;
  /** Optional: prior-period MRR (for growth rate). */
  previousMrr?: number;
  /** Months of history used for growth calc. */
  monthsBetween?: number;
  /** Monthly churn rate (decimal, e.g. 0.02 = 2%). */
  monthlyChurnRate?: number;
  /** Net new MRR per month (logos + expansion - contraction - churn). */
  netNewMrrPerMonth?: number;
}

export interface ProjectionPoint {
  month: number;
  mrr: number;
  arr: number;
  churnedArr: number;
}

export interface ArrResult {
  mrr: number;
  arr: number;
  quarterlyRecurringRevenue: number;
  growthRate: number | null; // decimal, null when previousMrr missing
  cagr: number | null; // decimal
  monthlyChurnRate: number;
  annualChurnRate: number;
  projectedChurnedArr: number; // projected lost ARR over the next 12 months
  projection: ProjectionPoint[];
  warnings: string[];
}

const round = (n: number, digits = 2) => Math.round(n * Math.pow(10, digits)) / Math.pow(10, digits);

export function calculateArr(input: ArrInput): ArrResult | { error: string } {
  const { mrr } = input;
  if (!Number.isFinite(mrr) || mrr < 0) return { error: "MRR must be a non-negative finite number." };
  if ((input.previousMrr ?? 0) < 0) return { error: "Previous MRR cannot be negative." };
  if ((input.monthlyChurnRate ?? 0) < 0 || (input.monthlyChurnRate ?? 0) > 1) return { error: "Monthly churn rate must be between 0 and 1." };
  if ((input.netNewMrrPerMonth ?? 0) < 0 && Math.abs(input.netNewMrrPerMonth ?? 0) > mrr) {
    return { error: "Net new MRR loss cannot exceed current MRR." };
  }

  const warnings: string[] = [];
  const arr = mrr * 12;
  const quarterlyRecurringRevenue = mrr * 3;

  // Growth rate (period over period)
  let growthRate: number | null = null;
  let cagr: number | null = null;
  if (input.previousMrr !== undefined && input.previousMrr > 0) {
    growthRate = (mrr - input.previousMrr) / input.previousMrr;
    const months = input.monthsBetween ?? 12;
    if (months > 0 && mrr > 0) {
      // CAGR equivalent: (mrr/prev)^(12/months) - 1
      cagr = Math.pow(mrr / input.previousMrr, 12 / months) - 1;
    }
  }

  // Churn
  const monthlyChurnRate = input.monthlyChurnRate ?? 0;
  const annualChurnRate = 1 - Math.pow(1 - monthlyChurnRate, 12);

  // 12-month projection (compounding churn + net new MRR)
  const netNew = input.netNewMrrPerMonth ?? 0;
  const projection: ProjectionPoint[] = [];
  let currentMrr = mrr;
  let cumulativeChurnedArr = 0;
  for (let month = 1; month <= 12; month++) {
    const churnedThisMonth = currentMrr * monthlyChurnRate;
    cumulativeChurnedArr += churnedThisMonth * 12; // annualised churn loss
    currentMrr = (currentMrr - churnedThisMonth) + netNew;
    if (currentMrr < 0) currentMrr = 0;
    projection.push({
      month,
      mrr: round(currentMrr),
      arr: round(currentMrr * 12),
      churnedArr: round(cumulativeChurnedArr),
    });
  }
  const projectedChurnedArr = round(cumulativeChurnedArr);

  if (monthlyChurnRate > 0.1) warnings.push("Monthly churn > 10% — very high; review retention.");
  if (growthRate !== null && growthRate < 0) warnings.push("Negative growth — MRR declined since previous period.");
  if (netNew < 0) warnings.push("Net new MRR is negative — you're shrinking each month.");
  if (annualChurnRate > 0.5) warnings.push("Annualised churn > 50% — unsustainable.");

  return {
    mrr: round(mrr),
    arr: round(arr),
    quarterlyRecurringRevenue: round(quarterlyRecurringRevenue),
    growthRate: growthRate === null ? null : round(growthRate, 4),
    cagr: cagr === null ? null : round(cagr, 4),
    monthlyChurnRate: round(monthlyChurnRate, 4),
    annualChurnRate: round(annualChurnRate, 4),
    projectedChurnedArr,
    projection,
    warnings,
  };
}

/** Convert the projection to CSV. */
export function projectionToCsv(result: ArrResult): string {
  const lines = ["Month,MRR,ARR,Churned ARR (cumulative)"];
  for (const p of result.projection) {
    lines.push(`${p.month},${p.mrr},${p.arr},${p.churnedArr}`);
  }
  return lines.join("\n");
}

/** Format a summary as plain text. */
export function arrSummaryText(result: ArrResult): string {
  const lines: string[] = [];
  lines.push(`MRR: ${result.mrr}`);
  lines.push(`ARR: ${result.arr}`);
  lines.push(`QRR: ${result.quarterlyRecurringRevenue}`);
  if (result.growthRate !== null) lines.push(`Growth rate: ${(result.growthRate * 100).toFixed(2)}%`);
  if (result.cagr !== null) lines.push(`CAGR (annualised): ${(result.cagr * 100).toFixed(2)}%`);
  lines.push(`Monthly churn: ${(result.monthlyChurnRate * 100).toFixed(2)}%`);
  lines.push(`Annual churn: ${(result.annualChurnRate * 100).toFixed(2)}%`);
  lines.push(`Projected churned ARR (12mo): ${result.projectedChurnedArr}`);
  return lines.join("\n");
}

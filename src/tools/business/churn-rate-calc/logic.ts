/**
 * Churn Rate Calculator — pure logic.
 * Customer churn, revenue churn, cohort analysis, MRR impact, period selector.
 */

export interface ChurnInput {
  /** Customers at start of period. */
  customersStart: number;
  /** Customers at end of period. */
  customersEnd: number;
  /** New customers acquired during period. */
  newCustomers: number;
  /** MRR at start of period. */
  mrrStart: number;
  /** MRR at end of period. */
  mrrEnd: number;
  /** New MRR added during period. */
  newMrr: number;
  /** Expansion MRR (upgrades) during period. */
  expansionMrr: number;
  /** Contraction MRR (downgrades) during period. */
  contractionMrr: number;
  /** Churned MRR (lost from cancellations) during period. */
  churnedMrr: number;
  /** Period length in months. */
  periodMonths: number;
}

export interface ChurnResult {
  input: ChurnInput;
  customerChurnRate: number;
  netCustomerChurnRate: number;
  revenueChurnRate: number;
  netRevenueChurnRate: number;
  lostCustomers: number;
  lostMrr: number;
  monthlyChurnedMrr: number;
  monthlyNewMrr: number;
  monthlyExpansionMrr: number;
  monthlyContractionMrr: number;
  mrrImpact: number;
  warnings: string[];
  notes: string[];
}

export function calcCustomerChurnRate(customersStart: number, customersEnd: number, newCustomers: number): number {
  if (customersStart <= 0) return 0;
  const lostCustomers = customersStart + newCustomers - customersEnd;
  return Math.max(0, lostCustomers / customersStart);
}

export function calcNetCustomerChurnRate(customersStart: number, customersEnd: number, newCustomers: number): number {
  if (customersStart <= 0) return 0;
  const lostCustomers = customersStart + newCustomers - customersEnd;
  return (lostCustomers - newCustomers) / customersStart;
}

export function calcRevenueChurnRate(mrrStart: number, mrrEnd: number, newMrr: number, expansionMrr: number): number {
  if (mrrStart <= 0) return 0;
  const lostMrr = mrrStart + newMrr + expansionMrr - mrrEnd;
  return Math.max(0, lostMrr / mrrStart);
}

export function calcNetRevenueChurnRate(mrrStart: number, mrrEnd: number, newMrr: number, expansionMrr: number, contractionMrr: number, churnedMrr: number): number {
  if (mrrStart <= 0) return 0;
  return (churnedMrr + contractionMrr - newMrr - expansionMrr) / mrrStart;
}

export function planChurn(input: ChurnInput): ChurnResult {
  const warnings: string[] = [];
  const notes: string[] = [];

  if (input.customersStart < 0 || input.customersEnd < 0) warnings.push("Customer counts must be ≥ 0.");
  if (input.newCustomers < 0) warnings.push("New customers must be ≥ 0.");
  if (input.mrrStart < 0 || input.mrrEnd < 0) warnings.push("MRR values must be ≥ 0.");
  if (input.periodMonths <= 0) warnings.push("Period months must be > 0.");
  if (input.customersEnd > input.customersStart + input.newCustomers) {
    warnings.push("Customers at end exceeds start + new — check inputs (may indicate reactivated customers).");
  }

  const customerChurnRate = calcCustomerChurnRate(input.customersStart, input.customersEnd, input.newCustomers);
  const netCustomerChurnRate = calcNetCustomerChurnRate(input.customersStart, input.customersEnd, input.newCustomers);
  const revenueChurnRate = calcRevenueChurnRate(input.mrrStart, input.mrrEnd, input.newMrr, input.expansionMrr);
  const netRevenueChurnRate = calcNetRevenueChurnRate(input.mrrStart, input.mrrEnd, input.newMrr, input.expansionMrr, input.contractionMrr, input.churnedMrr);

  const lostCustomers = input.customersStart + input.newCustomers - input.customersEnd;
  const lostMrr = input.mrrStart + input.newMrr + input.expansionMrr - input.mrrEnd;

  const monthlyChurnedMrr = input.churnedMrr / input.periodMonths;
  const monthlyNewMrr = input.newMrr / input.periodMonths;
  const monthlyExpansionMrr = input.expansionMrr / input.periodMonths;
  const monthlyContractionMrr = input.contractionMrr / input.periodMonths;
  const mrrImpact = monthlyNewMrr + monthlyExpansionMrr - monthlyChurnedMrr - monthlyContractionMrr;

  if (customerChurnRate > 0.1) notes.push(`Customer churn ${(customerChurnRate * 100).toFixed(2)}% is high — SaaS benchmark is < 5%.`);
  if (netRevenueChurnRate < 0) notes.push("Net revenue churn is negative — you have net revenue expansion (NRR > 100%). Excellent.");
  if (netRevenueChurnRate > 0.05) notes.push(`Net revenue churn ${(netRevenueChurnRate * 100).toFixed(2)}% is above the 5% SaaS benchmark.`);
  if (input.expansionMrr > input.churnedMrr) notes.push("Expansion MRR exceeds churned MRR — strong land-and-expand motion.");

  return {
    input, customerChurnRate, netCustomerChurnRate, revenueChurnRate, netRevenueChurnRate,
    lostCustomers, lostMrr,
    monthlyChurnedMrr, monthlyNewMrr, monthlyExpansionMrr, monthlyContractionMrr, mrrImpact,
    warnings, notes,
  };
}

export interface CohortRow {
  cohort: string;
  startSize: number;
  month0: number;
  month1: number | null;
  month2: number | null;
  month3: number | null;
  retention1: number | null;
  retention2: number | null;
  retention3: number | null;
}

/** Compute retention rates from cohort data. */
export function computeCohortRetention(rows: { cohort: string; sizes: number[] }[]): CohortRow[] {
  return rows.map((r) => {
    const m0 = r.sizes[0] ?? 0;
    const m1 = r.sizes[1] ?? null;
    const m2 = r.sizes[2] ?? null;
    const m3 = r.sizes[3] ?? null;
    return {
      cohort: r.cohort, startSize: m0, month0: m0, month1: m1, month2: m2, month3: m3,
      retention1: m1 !== null && m0 > 0 ? m1 / m0 : null,
      retention2: m2 !== null && m0 > 0 ? m2 / m0 : null,
      retention3: m3 !== null && m0 > 0 ? m3 / m0 : null,
    };
  });
}

export function planBatch(inputs: ChurnInput[]): ChurnResult[] {
  return inputs.map(planChurn);
}

export function renderBatchCsv(results: ChurnResult[]): string {
  const lines: string[] = ["index,customer_churn_pct,revenue_churn_pct,net_revenue_churn_pct,mrr_impact"];
  results.forEach((r, i) => {
    lines.push([
      String(i + 1),
      (r.customerChurnRate * 100).toFixed(2),
      (r.revenueChurnRate * 100).toFixed(2),
      (r.netRevenueChurnRate * 100).toFixed(2),
      r.mrrImpact.toFixed(2),
    ].join(","));
  });
  return lines.join("\n");
}

export function renderReport(r: ChurnResult): string {
  const lines: string[] = [];
  lines.push("Churn Rate Report");
  lines.push("=================");
  lines.push(`Period: ${r.input.periodMonths} month(s)`);
  lines.push(`Customers: ${r.input.customersStart} → ${r.input.customersEnd} (new: ${r.input.newCustomers}, lost: ${r.lostCustomers})`);
  lines.push(`MRR: $${r.input.mrrStart.toFixed(0)} → $${r.input.mrrEnd.toFixed(0)}`);
  lines.push("");
  lines.push(`Customer churn rate: ${(r.customerChurnRate * 100).toFixed(2)}%`);
  lines.push(`Net customer churn rate: ${(r.netCustomerChurnRate * 100).toFixed(2)}%`);
  lines.push(`Revenue churn rate (gross): ${(r.revenueChurnRate * 100).toFixed(2)}%`);
  lines.push(`Net revenue churn rate: ${(r.netRevenueChurnRate * 100).toFixed(2)}%`);
  lines.push("");
  lines.push("Monthly MRR movements:");
  lines.push(`  New MRR: $${r.monthlyNewMrr.toFixed(2)} / month`);
  lines.push(`  Expansion MRR: $${r.monthlyExpansionMrr.toFixed(2)} / month`);
  lines.push(`  Contraction MRR: -$${r.monthlyContractionMrr.toFixed(2)} / month`);
  lines.push(`  Churned MRR: -$${r.monthlyChurnedMrr.toFixed(2)} / month`);
  lines.push(`  Net MRR impact: $${r.mrrImpact.toFixed(2)} / month`);
  if (r.warnings.length) { lines.push(""); lines.push("Warnings:"); r.warnings.forEach((w) => lines.push(`  ! ${w}`)); }
  if (r.notes.length) { lines.push(""); lines.push("Notes:"); r.notes.forEach((n) => lines.push(`  • ${n}`)); }
  return lines.join("\n");
}

export const CHURN_PRESETS = [
  { id: "saas-quarter", label: "SaaS quarter (3 months)", periodMonths: 3 },
  { id: "monthly", label: "Monthly check-in", periodMonths: 1 },
  { id: "annual", label: "Annual review", periodMonths: 12 },
  { id: "weekly", label: "Weekly (early-stage)", periodMonths: 0.25 },
];

export function getChurnPresets() { return [...CHURN_PRESETS]; }

export function formatPct(rate: number): string {
  if (!Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(2)}%`;
}

export function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

/** Project future MRR given current MRR and monthly impact. */
export function projectMrr(currentMrr: number, monthlyImpact: number, months: number): { month: number; mrr: number }[] {
  const out: { month: number; mrr: number }[] = [];
  for (let i = 0; i <= months; i++) {
    out.push({ month: i, mrr: currentMrr + monthlyImpact * i });
  }
  return out;
}

/** Categorise churn level. */
export function categorizeChurn(churnRate: number): { label: string; level: "good" | "ok" | "bad" } {
  if (churnRate < 0.02) return { label: "Excellent (<2%)", level: "good" };
  if (churnRate < 0.05) return { label: "Healthy (2–5%)", level: "good" };
  if (churnRate < 0.10) return { label: "Concerning (5–10%)", level: "ok" };
  return { label: "Critical (>10%)", level: "bad" };
}

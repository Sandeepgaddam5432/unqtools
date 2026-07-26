/**
 * Burn Rate Calculator — pure logic.
 * Gross/net burn, runway months, cash zero date, monthly expenses, revenue, trend analysis.
 */

export interface BurnRateInput {
  /** Current cash balance. */
  cashBalance: number;
  /** Monthly expenses (gross). */
  monthlyExpenses: number;
  /** Monthly revenue. */
  monthlyRevenue: number;
  /** Months of historical data for trend. */
  historyMonths?: number;
  /** Historical monthly expenses (oldest first). */
  historicalExpenses?: number[];
  /** Historical monthly revenue (oldest first). */
  historicalRevenue?: number[];
  /** Today's date (ISO string) — defaults to today. */
  asOfDate?: string;
}

export interface BurnRateResult {
  input: BurnRateInput;
  grossBurn: number;
  netBurn: number;
  runwayMonths: number;
  cashZeroDate: string;
  cashZeroDateISO: string;
  burnRatePercent: number;
  /** Average monthly expense over history. */
  avgMonthlyExpense: number;
  /** Average monthly revenue over history. */
  avgMonthlyRevenue: number;
  /** Trend slope of expenses (per month) — positive = increasing. */
  expenseTrend: number;
  /** Trend slope of revenue (per month) — positive = increasing. */
  revenueTrend: number;
  projectedRunwayMonths: number;
  warnings: string[];
  notes: string[];
}

/** Calculate gross burn = monthly expenses. */
export function calcGrossBurn(monthlyExpenses: number): number {
  return Math.max(0, monthlyExpenses);
}

/** Calculate net burn = monthly expenses - monthly revenue. */
export function calcNetBurn(monthlyExpenses: number, monthlyRevenue: number): number {
  return monthlyExpenses - monthlyRevenue;
}

/** Calculate runway in months given cash and net burn. */
export function calcRunwayMonths(cashBalance: number, netBurn: number): number {
  if (netBurn <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, cashBalance / netBurn);
}

/** Calculate the date when cash runs out, given a runway in months and a start date. */
export function calcCashZeroDate(runwayMonths: number, asOfDate: Date = new Date()): { date: Date; iso: string } {
  if (!Number.isFinite(runwayMonths)) return { date: new Date(Date.UTC(9999, 11, 31)), iso: "never" };
  const date = new Date(asOfDate.getTime());
  date.setMonth(date.getMonth() + Math.ceil(runwayMonths));
  return { date, iso: date.toISOString().slice(0, 10) };
}

/** Compute a simple linear regression slope for an array of values (per-period slope). */
export function linearTrend(values: number[]): number {
  if (values.length < 2) return 0;
  const n = values.length;
  const xs = Array.from({ length: n }, (_, i) => i);
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = values.reduce((s, y) => s + y, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (values[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export function planBurnRate(input: BurnRateInput): BurnRateResult {
  const warnings: string[] = [];
  const notes: string[] = [];

  if (input.cashBalance < 0) warnings.push("Cash balance is negative — check your inputs.");
  if (input.monthlyExpenses < 0) warnings.push("Monthly expenses should be ≥ 0.");
  if (input.monthlyRevenue < 0) warnings.push("Monthly revenue should be ≥ 0.");
  if (input.monthlyRevenue > input.monthlyExpenses) {
    notes.push("Revenue exceeds expenses — you are net cash positive. Runway is infinite.");
  }

  const grossBurn = calcGrossBurn(input.monthlyExpenses);
  const netBurn = calcNetBurn(input.monthlyExpenses, input.monthlyRevenue);
  const runwayMonths = calcRunwayMonths(input.cashBalance, netBurn);
  const asOf = input.asOfDate ? new Date(input.asOfDate) : new Date();
  const { date, iso } = calcCashZeroDate(runwayMonths, asOf);

  const histExp = input.historicalExpenses ?? [];
  const histRev = input.historicalRevenue ?? [];
  const avgMonthlyExpense = histExp.length > 0 ? histExp.reduce((s, x) => s + x, 0) / histExp.length : input.monthlyExpenses;
  const avgMonthlyRevenue = histRev.length > 0 ? histRev.reduce((s, x) => s + x, 0) / histRev.length : input.monthlyRevenue;
  const expenseTrend = linearTrend(histExp);
  const revenueTrend = linearTrend(histRev);

  // Projected runway accounting for trends: each month, net burn increases by (expenseTrend - revenueTrend)
  const burnTrend = expenseTrend - revenueTrend;
  let projectedRunwayMonths = runwayMonths;
  if (Number.isFinite(runwayMonths) && Math.abs(burnTrend) > 1e-9) {
    // Solve: cashBalance = netBurn * n + (burnTrend/2) * n * (n-1)
    // Quadratic: (burnTrend/2) * n^2 + (netBurn - burnTrend/2) * n - cashBalance = 0
    const a = burnTrend / 2;
    const b = netBurn - burnTrend / 2;
    const c = -input.cashBalance;
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const n1 = (-b + Math.sqrt(disc)) / (2 * a);
      const n2 = (-b - Math.sqrt(disc)) / (2 * a);
      const positiveRoots = [n1, n2].filter((n) => n > 0);
      if (positiveRoots.length > 0) projectedRunwayMonths = Math.min(...positiveRoots);
    }
  }

  if (expenseTrend > 0) notes.push(`Expenses are trending up by ${expenseTrend.toFixed(2)} per month.`);
  if (revenueTrend > 0) notes.push(`Revenue is trending up by ${revenueTrend.toFixed(2)} per month.`);
  if (revenueTrend > expenseTrend) notes.push("Revenue is growing faster than expenses — projected runway extends over time.");
  if (expenseTrend > revenueTrend && Number.isFinite(projectedRunwayMonths)) {
    notes.push(`With current trends, projected runway is ${projectedRunwayMonths.toFixed(1)} months (vs ${runwayMonths.toFixed(1)} flat).`);
  }

  const burnRatePercent = input.cashBalance > 0 ? (netBurn / input.cashBalance) * 100 : 0;

  return {
    input, grossBurn, netBurn, runwayMonths, cashZeroDate: iso, cashZeroDateISO: iso,
    burnRatePercent, avgMonthlyExpense, avgMonthlyRevenue, expenseTrend, revenueTrend,
    projectedRunwayMonths, warnings, notes,
  };
}

export function planBatch(inputs: BurnRateInput[]): BurnRateResult[] {
  return inputs.map(planBurnRate);
}

export function renderBatchCsv(results: BurnRateResult[]): string {
  const lines: string[] = ["index,gross_burn,net_burn,runway_months,cash_zero_date,burn_rate_pct"];
  results.forEach((r, i) => {
    lines.push([
      String(i + 1), r.grossBurn.toFixed(2), r.netBurn.toFixed(2),
      Number.isFinite(r.runwayMonths) ? r.runwayMonths.toFixed(2) : "inf",
      r.cashZeroDateISO, r.burnRatePercent.toFixed(2),
    ].join(","));
  });
  return lines.join("\n");
}

export function renderReport(r: BurnRateResult): string {
  const lines: string[] = [];
  lines.push("Burn Rate Report");
  lines.push("================");
  lines.push(`Cash balance: $${r.input.cashBalance.toFixed(2)}`);
  lines.push(`Monthly expenses: $${r.input.monthlyExpenses.toFixed(2)}`);
  lines.push(`Monthly revenue: $${r.input.monthlyRevenue.toFixed(2)}`);
  lines.push("");
  lines.push(`Gross burn: $${r.grossBurn.toFixed(2)} / month`);
  lines.push(`Net burn: $${r.netBurn.toFixed(2)} / month`);
  lines.push(`Runway: ${Number.isFinite(r.runwayMonths) ? r.runwayMonths.toFixed(1) + " months" : "infinite (cash-positive)"}`);
  lines.push(`Cash zero date: ${r.cashZeroDateISO}`);
  lines.push(`Burn rate (% of cash): ${r.burnRatePercent.toFixed(2)}% / month`);
  if (r.input.historicalExpenses && r.input.historicalExpenses.length > 0) {
    lines.push("");
    lines.push("Trend analysis:");
    lines.push(`  Average monthly expense: $${r.avgMonthlyExpense.toFixed(2)}`);
    lines.push(`  Average monthly revenue: $${r.avgMonthlyRevenue.toFixed(2)}`);
    lines.push(`  Expense trend: ${r.expenseTrend.toFixed(2)} / month`);
    lines.push(`  Revenue trend: ${r.revenueTrend.toFixed(2)} / month`);
    lines.push(`  Projected runway (with trend): ${Number.isFinite(r.projectedRunwayMonths) ? r.projectedRunwayMonths.toFixed(1) + " months" : "infinite"}`);
  }
  if (r.warnings.length) { lines.push(""); lines.push("Warnings:"); r.warnings.forEach((w) => lines.push(`  ! ${w}`)); }
  if (r.notes.length) { lines.push(""); lines.push("Notes:"); r.notes.forEach((n) => lines.push(`  • ${n}`)); }
  return lines.join("\n");
}

/** Quick presets for common startup scenarios. */
export const BURN_RATE_PRESETS = [
  { id: "pre-seed", label: "Pre-seed SaaS", cashBalance: 500_000, monthlyExpenses: 40_000, monthlyRevenue: 5_000 },
  { id: "seed", label: "Seed-stage SaaS", cashBalance: 2_000_000, monthlyExpenses: 100_000, monthlyRevenue: 30_000 },
  { id: "series-a", label: "Series A SaaS", cashBalance: 10_000_000, monthlyExpenses: 400_000, monthlyRevenue: 200_000 },
  { id: "bootstrap", label: "Bootstrapped (cash-positive)", cashBalance: 100_000, monthlyExpenses: 15_000, monthlyRevenue: 20_000 },
];

export function getBurnRatePresets() { return [...BURN_RATE_PRESETS]; }

/** Format a currency value. */
export function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

/** Categorise a runway as healthy / concerning / critical. */
export function categorizeRunway(runwayMonths: number): { label: string; level: "healthy" | "concerning" | "critical" | "positive" } {
  if (!Number.isFinite(runwayMonths)) return { label: "Cash-positive", level: "positive" };
  if (runwayMonths >= 18) return { label: "Healthy (18+ months)", level: "healthy" };
  if (runwayMonths >= 12) return { label: "Concerning (12–18 months)", level: "concerning" };
  if (runwayMonths >= 6) return { label: "Critical (6–12 months)", level: "critical" };
  return { label: "Urgent (<6 months)", level: "critical" };
}

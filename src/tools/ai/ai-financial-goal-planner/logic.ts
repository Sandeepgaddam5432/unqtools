/**
 * AI Financial Goal Planner — pure logic.
 *
 * Generates prioritized savings/investment roadmaps with compound-growth
 * projections, snowball/avalanche debt schedules, and milestones.
 * Pure functions only — no DOM, no network. The optional LLM call
 * (BYO API key) lives in ui.tsx because it touches the network.
 *
 * Honesty clause: educational tool only. Not financial, investment,
 * or tax advice. Projections use assumptions that may not hold.
 */

// ---------- Types ----------

export type GoalType =
  | "emergency-fund"
  | "debt-payoff"
  | "house"
  | "retirement"
  | "vacation"
  | "education"
  | "custom";

export type DebtStrategy = "snowball" | "avalanche";

export type CurrencyCode = "USD" | "EUR" | "GBP" | "INR" | "JPY" | "CAD" | "AUD";

export interface Goal {
  id: string;
  type: GoalType;
  name: string;
  targetAmount: number;
  currentAmount: number;
  timelineMonths: number;
  annualReturnRate: number; // 0.05 = 5%
  priority: number; // lower = higher priority
}

export interface Milestone {
  month: number;
  label: string;
  targetCumulative: number;
}

export interface ProjectionPoint {
  month: number;
  contributed: number;
  interest: number;
  balance: number;
}

export interface GoalPlan {
  goal: Goal;
  monthlyContribution: number;
  totalContributed: number;
  totalInterest: number;
  finalBalance: number;
  isAchievable: boolean;
  shortfall: number;
  milestones: Milestone[];
  projection: ProjectionPoint[];
  warnings: string[];
  formula: string;
}

export interface DebtItem {
  id: string;
  name: string;
  balance: number;
  interestRate: number; // annual %
  minimumPayment: number;
}

export interface DebtScheduleRow {
  month: number;
  debtId: string;
  debtName: string;
  payment: number;
  interest: number;
  principal: number;
  balanceAfter: number;
}

export interface DebtPayoffPlan {
  strategy: DebtStrategy;
  totalDebt: number;
  totalInterest: number;
  totalPaid: number;
  payoffMonths: number;
  schedule: DebtScheduleRow[];
  order: string[]; // debt IDs in payoff order
}

export interface RoadmapPlan {
  goals: GoalPlan[];
  totalMonthlyContribution: number;
  totalContributed: number;
  totalInterest: number;
  prioritizedOrder: string[]; // goal IDs in priority order
  debtPlan?: DebtPayoffPlan;
  currency: CurrencyCode;
  inflationRate: number;
  generatedAt: number;
}

export interface ScenarioCompare {
  a: RoadmapPlan;
  b: RoadmapPlan;
  deltaMonthly: number;
  deltaInterest: number;
  winner: "a" | "b" | "tie";
}

export interface HistoryEntry {
  ts: number;
  goalCount: number;
  totalMonthly: number;
  totalTarget: number;
  currency: CurrencyCode;
  label: string;
}

// ---------- Constants ----------

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  "emergency-fund": "Emergency Fund",
  "debt-payoff": "Debt Payoff",
  "house": "House Down Payment",
  "retirement": "Retirement",
  "vacation": "Vacation",
  "education": "Education",
  "custom": "Custom Goal",
};

export const GOAL_TYPE_DESCRIPTIONS: Record<GoalType, string> = {
  "emergency-fund": "3–6 months of living expenses set aside for unexpected costs.",
  "debt-payoff": "Eliminate high-interest consumer debt to free up cash flow.",
  "house": "Down payment for a home purchase, typically 5–20% of the price.",
  "retirement": "Long-term nest egg to fund life after you stop working.",
  "vacation": "Sinking fund for a planned trip or large discretionary expense.",
  "education": "Tuition or training fund for yourself or a family member.",
  "custom": "Any savings goal you define — name it and set the numbers.",
};

export const GOAL_TYPE_DEFAULTS: Record<GoalType, {
  targetAmount: number;
  timelineMonths: number;
  annualReturnRate: number;
}> = {
  "emergency-fund": { targetAmount: 15000, timelineMonths: 18, annualReturnRate: 0.04 },
  "debt-payoff": { targetAmount: 10000, timelineMonths: 24, annualReturnRate: 0.0 },
  "house": { targetAmount: 60000, timelineMonths: 60, annualReturnRate: 0.05 },
  "retirement": { targetAmount: 500000, timelineMonths: 360, annualReturnRate: 0.07 },
  "vacation": { targetAmount: 5000, timelineMonths: 12, annualReturnRate: 0.02 },
  "education": { targetAmount: 40000, timelineMonths: 120, annualReturnRate: 0.05 },
  "custom": { targetAmount: 10000, timelineMonths: 24, annualReturnRate: 0.04 },
};

export const CURRENCY_OPTIONS: { code: CurrencyCode; symbol: string; label: string }[] = [
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "INR", symbol: "₹", label: "Indian Rupee" },
  { code: "JPY", symbol: "¥", label: "Japanese Yen" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar" },
];

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  JPY: "¥",
  CAD: "C$",
  AUD: "A$",
};

export const DEBT_STRATEGY_LABELS: Record<DebtStrategy, string> = {
  snowball: "Snowball (smallest balance first)",
  avalanche: "Avalanche (highest interest first)",
};

export const GOAL_PRESETS: Omit<Goal, "id" | "priority">[] = [
  { type: "emergency-fund", name: "Emergency Fund", targetAmount: 15000, currentAmount: 3000, timelineMonths: 18, annualReturnRate: 0.04 },
  { type: "debt-payoff", name: "Pay Off Credit Card", targetAmount: 8000, currentAmount: 0, timelineMonths: 18, annualReturnRate: 0.0 },
  { type: "house", name: "House Down Payment", targetAmount: 60000, currentAmount: 12000, timelineMonths: 60, annualReturnRate: 0.05 },
  { type: "retirement", name: "Retirement Nest Egg", targetAmount: 500000, currentAmount: 50000, timelineMonths: 360, annualReturnRate: 0.07 },
  { type: "vacation", name: "Japan Trip", targetAmount: 5000, currentAmount: 500, timelineMonths: 12, annualReturnRate: 0.02 },
  { type: "education", name: "Kid's College", targetAmount: 80000, currentAmount: 10000, timelineMonths: 180, annualReturnRate: 0.05 },
];

export const DEFAULT_INFLATION_RATE = 0.03;

// ---------- Validation & normalization ----------

/** Round to 2 decimals (cents) — avoids float drift in money. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Clamp a number to non-negative. */
export function nonNeg(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Validate a goal. Returns warnings (empty = OK). */
export function validateGoal(g: Goal): string[] {
  const w: string[] = [];
  if (!g.name || !g.name.trim()) w.push("Goal has no name");
  if (!(g.targetAmount > 0)) w.push("Target amount must be greater than zero");
  if (g.currentAmount < 0) w.push("Current amount cannot be negative");
  if (g.currentAmount >= g.targetAmount) w.push("Goal already reached — current savings meet or exceed target");
  if (!(g.timelineMonths > 0)) w.push("Timeline must be at least 1 month");
  if (g.annualReturnRate < 0 || g.annualReturnRate > 0.5) w.push("Annual return rate should be between 0% and 50%");
  return w;
}

/** Validate a debt item. */
export function validateDebt(d: DebtItem): string[] {
  const w: string[] = [];
  if (!d.name || !d.name.trim()) w.push("Debt has no name");
  if (!(d.balance > 0)) w.push("Debt balance must be greater than zero");
  if (d.interestRate < 0 || d.interestRate > 100) w.push("Interest rate should be between 0% and 100%");
  if (!(d.minimumPayment > 0)) w.push("Minimum payment must be greater than zero");
  const monthlyRate = d.interestRate / 100 / 12;
  if (d.minimumPayment <= d.balance * monthlyRate) {
    w.push("Minimum payment does not cover first month's interest — debt will never be paid off");
  }
  return w;
}

// ---------- Core finance math ----------

/**
 * Monthly contribution required to reach `targetAmount` given current
 * savings, timeline (months), and monthly rate.
 *
 * Formula: PMT = (FV − PV·(1+r)^n) / [((1+r)^n − 1) / r]
 *   where r = monthly rate, n = months, FV = target, PV = current.
 *
 * Falls back to a simple linear payment when r = 0.
 */
export function computeMonthlyContribution(
  targetAmount: number,
  currentAmount: number,
  timelineMonths: number,
  annualReturnRate: number,
): number {
  const target = nonNeg(targetAmount);
  const current = nonNeg(currentAmount);
  const months = nonNeg(timelineMonths);
  if (months <= 0) return 0;
  const r = annualReturnRate / 12;
  const fvOfCurrent = current * Math.pow(1 + r, months);
  const remaining = target - fvOfCurrent;
  if (remaining <= 0) return 0;
  if (Math.abs(r) < 1e-9) {
    return remaining / months;
  }
  const factor = (Math.pow(1 + r, months) - 1) / r;
  return remaining / factor;
}

/**
 * Project month-by-month balance, contributions, and interest given
 * a monthly contribution, current savings, monthly rate, and months.
 *
 * Returns array of {month, contributed, interest, balance}.
 */
export function computeCompoundProjection(
  currentAmount: number,
  monthlyContribution: number,
  annualReturnRate: number,
  months: number,
): ProjectionPoint[] {
  const out: ProjectionPoint[] = [];
  const r = annualReturnRate / 12;
  let balance = nonNeg(currentAmount);
  let contributed = balance;
  let interest = 0;
  out.push({ month: 0, contributed: round2(contributed), interest: 0, balance: round2(balance) });
  for (let m = 1; m <= months; m++) {
    const interestThisMonth = balance * r;
    balance = balance + interestThisMonth + monthlyContribution;
    interest += interestThisMonth;
    contributed += monthlyContribution;
    out.push({
      month: m,
      contributed: round2(contributed),
      interest: round2(interest),
      balance: round2(balance),
    });
  }
  return out;
}

/**
 * Compute future value of a lump sum at monthly rate over n months.
 * A = P · (1 + r)^n
 */
export function futureValueLumpSum(principal: number, annualRate: number, months: number): number {
  const r = annualRate / 12;
  return principal * Math.pow(1 + r, months);
}

/**
 * Compute future value of a series of monthly contributions.
 * FV = PMT · [((1+r)^n − 1) / r]
 */
export function futureValueSeries(payment: number, annualRate: number, months: number): number {
  const r = annualRate / 12;
  if (Math.abs(r) < 1e-9) return payment * months;
  return payment * ((Math.pow(1 + r, months) - 1) / r);
}

/** Generate milestones at 25/50/75/100% of the target amount. */
export function generateMilestones(
  targetAmount: number,
  currentAmount: number,
  monthlyContribution: number,
  annualReturnRate: number,
): Milestone[] {
  const out: Milestone[] = [];
  const r = annualReturnRate / 12;
  let balance = nonNeg(currentAmount);
  const targets = [
    { pct: 0.25, label: "25% milestone" },
    { pct: 0.5, label: "50% milestone" },
    { pct: 0.75, label: "75% milestone" },
    { pct: 1.0, label: "Goal reached" },
  ];
  for (const t of targets) {
    const threshold = targetAmount * t.pct;
    if (balance >= threshold) {
      out.push({ month: 0, label: t.label, targetCumulative: round2(threshold) });
      continue;
    }
    // Solve: balance·(1+r)^m + PMT·[((1+r)^m − 1)/r] = threshold
    // Brute-force a month search up to 600 months (50 yr) — deterministic.
    let m = 0;
    let bal = balance;
    for (m = 1; m <= 600; m++) {
      bal = bal * (1 + r) + monthlyContribution;
      if (bal >= threshold) break;
    }
    if (m > 600) m = 600; // cap
    out.push({ month: m, label: t.label, targetCumulative: round2(threshold) });
  }
  return out;
}

/** Generate a complete plan for a single goal. */
export function generatePlan(goal: Goal): GoalPlan {
  const warnings = validateGoal(goal);
  const monthlyContribution = computeMonthlyContribution(
    goal.targetAmount,
    goal.currentAmount,
    goal.timelineMonths,
    goal.annualReturnRate,
  );
  const projection = computeCompoundProjection(
    goal.currentAmount,
    monthlyContribution,
    goal.annualReturnRate,
    goal.timelineMonths,
  );
  const last = projection[projection.length - 1];
  const finalBalance = last?.balance ?? 0;
  const totalContributed = last?.contributed ?? 0;
  const totalInterest = last?.interest ?? 0;
  const shortfall = Math.max(0, goal.targetAmount - finalBalance);
  const isAchievable = finalBalance >= goal.targetAmount - 0.5;
  if (!isAchievable && monthlyContribution > 0) {
    warnings.push(`Goal falls short by ${shortfall.toFixed(2)} — increase contribution or extend timeline`);
  }
  if (monthlyContribution > 0 && goal.targetAmount > 0 && monthlyContribution / goal.targetAmount > 0.5) {
    warnings.push("Monthly contribution exceeds 50% of target — likely unrealistic, consider extending the timeline");
  }
  const milestones = generateMilestones(
    goal.targetAmount,
    goal.currentAmount,
    monthlyContribution,
    goal.annualReturnRate,
  );
  const r = goal.annualReturnRate / 12;
  const formula = Math.abs(r) < 1e-9
    ? `PMT = (target − current) / months = (${goal.targetAmount.toFixed(2)} − ${goal.currentAmount.toFixed(2)}) / ${goal.timelineMonths}`
    : `PMT = (FV − PV·(1+r)^n) / [((1+r)^n − 1) / r], r=${(r * 100).toFixed(4)}%/mo, n=${goal.timelineMonths}mo`;
  return {
    goal,
    monthlyContribution: round2(monthlyContribution),
    totalContributed: round2(totalContributed),
    totalInterest: round2(totalInterest),
    finalBalance: round2(finalBalance),
    isAchievable,
    shortfall: round2(shortfall),
    milestones,
    projection,
    warnings,
    formula,
  };
}

/** Sort goals by priority (lower = first). Returns ordered IDs. */
export function prioritizeGoals(goals: Goal[]): string[] {
  return [...goals].sort((a, b) => a.priority - b.priority).map((g) => g.id);
}

/** Build a complete roadmap from goals and optional debts. */
export function buildRoadmap(
  goals: Goal[],
  debts: DebtItem[],
  strategy: DebtStrategy,
  currency: CurrencyCode = "USD",
  inflationRate: number = DEFAULT_INFLATION_RATE,
): RoadmapPlan {
  const plans = goals.map(generatePlan);
  const orderedIds = prioritizeGoals(goals);
  const orderedPlans = orderedIds
    .map((id) => plans.find((p) => p.goal.id === id)!)
    .filter(Boolean);
  const totalMonthly = orderedPlans.reduce((s, p) => s + p.monthlyContribution, 0);
  const totalContributed = orderedPlans.reduce((s, p) => s + p.totalContributed - p.goal.currentAmount, 0);
  const totalInterest = orderedPlans.reduce((s, p) => s + p.totalInterest, 0);
  const debtPlan = debts.length > 0 ? buildDebtSchedule(debts, strategy) : undefined;
  return {
    goals: orderedPlans,
    totalMonthlyContribution: round2(totalMonthly),
    totalContributed: round2(totalContributed),
    totalInterest: round2(totalInterest),
    prioritizedOrder: orderedIds,
    debtPlan,
    currency,
    inflationRate,
    generatedAt: Date.now(),
  };
}

// ---------- Debt schedules ----------

/** Order debts by strategy. */
export function orderDebts(debts: DebtItem[], strategy: DebtStrategy): DebtItem[] {
  if (strategy === "snowball") {
    return [...debts].sort((a, b) => a.balance - b.balance);
  }
  // avalanche: highest interest first
  return [...debts].sort((a, b) => b.interestRate - a.interestRate);
}

/**
 * Build a debt payoff schedule. Assumes a fixed extra payment is applied
 * to the first debt in `order`; once paid off, that payment rolls into
 * the next debt (snowball effect).
 *
 * @param extraPayment Additional amount beyond minimums applied to the
 *   target debt. Defaults to 0 (minimums only).
 */
export function buildDebtSchedule(
  debts: DebtItem[],
  strategy: DebtStrategy,
  extraPayment: number = 0,
): DebtPayoffPlan {
  if (debts.length === 0) {
    return {
      strategy,
      totalDebt: 0,
      totalInterest: 0,
      totalPaid: 0,
      payoffMonths: 0,
      schedule: [],
      order: [],
    };
  }
  const ordered = orderDebts(debts, strategy);
  const balances = new Map<string, number>();
  for (const d of ordered) balances.set(d.id, d.balance);
  const totalDebt = round2(debts.reduce((s, d) => s + d.balance, 0));
  const schedule: DebtScheduleRow[] = [];
  let totalInterest = 0;
  let totalPaid = 0;
  let month = 0;
  const maxMonths = 1200; // 100-year safety cap
  let idx = 0; // which debt is being accelerated
  while (idx < ordered.length && month < maxMonths) {
    month++;
    const target = ordered[idx];
    // Pay minimums on all debts
    for (const d of ordered) {
      const bal = balances.get(d.id)!;
      if (bal <= 0.005) continue;
      const monthlyRate = d.interestRate / 100 / 12;
      const interest = bal * monthlyRate;
      let payment = d.minimumPayment;
      if (d.id === target.id) payment += extraPayment;
      // Cap payment at remaining balance + interest
      const maxPayment = bal + interest;
      payment = Math.min(payment, maxPayment);
      const principal = payment - interest;
      const balanceAfter = Math.max(0, bal + interest - payment);
      balances.set(d.id, round2(balanceAfter));
      totalInterest += interest;
      totalPaid += payment;
      schedule.push({
        month,
        debtId: d.id,
        debtName: d.name,
        payment: round2(payment),
        interest: round2(interest),
        principal: round2(principal),
        balanceAfter: round2(balanceAfter),
      });
    }
    // Advance target if current target is paid off
    while (idx < ordered.length && (balances.get(ordered[idx].id) ?? 0) <= 0.005) {
      idx++;
    }
    // Check if all debts are paid
    const remaining = Array.from(balances.values()).reduce((s, b) => s + b, 0);
    if (remaining <= 0.005) break;
  }
  return {
    strategy,
    totalDebt,
    totalInterest: round2(totalInterest),
    totalPaid: round2(totalPaid),
    payoffMonths: month,
    schedule,
    order: ordered.map((d) => d.id),
  };
}

/** Compare two roadmaps (e.g., scenario A vs B). */
export function compareScenarios(a: RoadmapPlan, b: RoadmapPlan): ScenarioCompare {
  const deltaMonthly = round2(b.totalMonthlyContribution - a.totalMonthlyContribution);
  const deltaInterest = round2(b.totalInterest - a.totalInterest);
  let winner: "a" | "b" | "tie" = "tie";
  // Winner = lower total monthly contribution AND higher interest earned (or lower interest paid if debt)
  const scoreA = a.totalMonthlyContribution - a.totalInterest;
  const scoreB = b.totalMonthlyContribution - b.totalInterest;
  if (scoreA < scoreB) winner = "a";
  else if (scoreB < scoreA) winner = "b";
  return { a, b, deltaMonthly, deltaInterest, winner };
}

/** What-if: recompute monthly contribution under a different rate. */
export function whatIfRate(goal: Goal, newRate: number): number {
  return round2(
    computeMonthlyContribution(
      goal.targetAmount,
      goal.currentAmount,
      goal.timelineMonths,
      newRate,
    ),
  );
}

/** What-if: recompute monthly contribution under a different timeline. */
export function whatIfTimeline(goal: Goal, newMonths: number): number {
  return round2(
    computeMonthlyContribution(
      goal.targetAmount,
      goal.currentAmount,
      newMonths,
      goal.annualReturnRate,
    ),
  );
}

/** Inflation-adjusted future value (today's dollars). */
export function inflationAdjusted(futureAmount: number, annualInflation: number, months: number): number {
  const years = months / 12;
  return round2(futureAmount / Math.pow(1 + annualInflation, years));
}

// ---------- Formatting & rendering ----------

export function formatCurrency(amount: number, currency: CurrencyCode = "USD"): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  return `${sign}${symbol}${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPercent(rate: number, digits: number = 2): string {
  return `${(rate * 100).toFixed(digits)}%`;
}

export function formatMonth(m: number): string {
  if (m < 12) return `${m} mo`;
  const years = Math.floor(m / 12);
  const months = m % 12;
  return months > 0 ? `${years} yr ${months} mo` : `${years} yr`;
}

export function renderText(plan: RoadmapPlan): string {
  const lines: string[] = [];
  lines.push("FINANCIAL GOAL ROADMAP");
  lines.push(`Generated: ${new Date(plan.generatedAt).toISOString()}`);
  lines.push(`Currency: ${plan.currency}`);
  lines.push(`Total monthly contribution: ${formatCurrency(plan.totalMonthlyContribution, plan.currency)}`);
  lines.push(`Total new contributions: ${formatCurrency(plan.totalContributed, plan.currency)}`);
  lines.push(`Total projected interest: ${formatCurrency(plan.totalInterest, plan.currency)}`);
  lines.push("");
  lines.push("GOALS (in priority order):");
  for (const p of plan.goals) {
    lines.push("");
    lines.push(`  ${p.goal.name} [${GOAL_TYPE_LABELS[p.goal.type]}]`);
    lines.push(`    Target: ${formatCurrency(p.goal.targetAmount, plan.currency)}`);
    lines.push(`    Current: ${formatCurrency(p.goal.currentAmount, plan.currency)}`);
    lines.push(`    Timeline: ${formatMonth(p.goal.timelineMonths)}`);
    lines.push(`    Rate: ${formatPercent(p.goal.annualReturnRate)}`);
    lines.push(`    Monthly contribution: ${formatCurrency(p.monthlyContribution, plan.currency)}`);
    lines.push(`    Final balance: ${formatCurrency(p.finalBalance, plan.currency)}`);
    lines.push(`    Achievable: ${p.isAchievable ? "Yes" : "No — shortfall " + formatCurrency(p.shortfall, plan.currency)}`);
    lines.push(`    Formula: ${p.formula}`);
    if (p.warnings.length > 0) {
      lines.push(`    Warnings:`);
      for (const w of p.warnings) lines.push(`      - ${w}`);
    }
    if (p.milestones.length > 0) {
      lines.push(`    Milestones:`);
      for (const m of p.milestones) {
        lines.push(`      Month ${m.month} — ${m.label}: ${formatCurrency(m.targetCumulative, plan.currency)}`);
      }
    }
  }
  if (plan.debtPlan) {
    lines.push("");
    lines.push(`DEBT PAYOFF [${DEBT_STRATEGY_LABELS[plan.debtPlan.strategy]}]:`);
    lines.push(`  Total debt: ${formatCurrency(plan.debtPlan.totalDebt, plan.currency)}`);
    lines.push(`  Total interest paid: ${formatCurrency(plan.debtPlan.totalInterest, plan.currency)}`);
    lines.push(`  Total paid: ${formatCurrency(plan.debtPlan.totalPaid, plan.currency)}`);
    lines.push(`  Payoff time: ${formatMonth(plan.debtPlan.payoffMonths)}`);
  }
  lines.push("");
  lines.push("DISCLAIMER: Educational tool only. Not financial, investment, or tax advice.");
  lines.push("Projections use assumptions that may not hold. Consult a licensed professional.");
  return lines.join("\n");
}

export function renderMarkdown(plan: RoadmapPlan): string {
  const lines: string[] = [];
  lines.push("# Financial Goal Roadmap");
  lines.push("");
  lines.push(`**Generated:** ${new Date(plan.generatedAt).toLocaleString()}  `);
  lines.push(`**Currency:** ${plan.currency}  `);
  lines.push(`**Total monthly contribution:** ${formatCurrency(plan.totalMonthlyContribution, plan.currency)}  `);
  lines.push(`**Total new contributions:** ${formatCurrency(plan.totalContributed, plan.currency)}  `);
  lines.push(`**Total projected interest:** ${formatCurrency(plan.totalInterest, plan.currency)}  `);
  lines.push("");
  lines.push("## Goals (priority order)");
  lines.push("");
  for (const p of plan.goals) {
    lines.push(`### ${p.goal.name} — ${GOAL_TYPE_LABELS[p.goal.type]}`);
    lines.push("");
    lines.push(`| Field | Value |`);
    lines.push(`| --- | --- |`);
    lines.push(`| Target | ${formatCurrency(p.goal.targetAmount, plan.currency)} |`);
    lines.push(`| Current savings | ${formatCurrency(p.goal.currentAmount, plan.currency)} |`);
    lines.push(`| Timeline | ${formatMonth(p.goal.timelineMonths)} |`);
    lines.push(`| Annual return rate | ${formatPercent(p.goal.annualReturnRate)} |`);
    lines.push(`| Monthly contribution | ${formatCurrency(p.monthlyContribution, plan.currency)} |`);
    lines.push(`| Final balance | ${formatCurrency(p.finalBalance, plan.currency)} |`);
    lines.push(`| Achievable | ${p.isAchievable ? "✅ Yes" : "⚠️ No — shortfall " + formatCurrency(p.shortfall, plan.currency)} |`);
    lines.push("");
    if (p.warnings.length > 0) {
      lines.push(`> ⚠️ **Warnings:**`);
      for (const w of p.warnings) lines.push(`> - ${w}`);
      lines.push("");
    }
    if (p.milestones.length > 0) {
      lines.push(`**Milestones:**`);
      for (const m of p.milestones) {
        lines.push(`- Month ${m.month} — ${m.label}: ${formatCurrency(m.targetCumulative, plan.currency)}`);
      }
      lines.push("");
    }
    lines.push(`> Formula: \`${p.formula}\``);
    lines.push("");
  }
  if (plan.debtPlan) {
    lines.push(`## Debt Payoff — ${DEBT_STRATEGY_LABELS[plan.debtPlan.strategy]}`);
    lines.push("");
    lines.push(`| Metric | Value |`);
    lines.push(`| --- | --- |`);
    lines.push(`| Total debt | ${formatCurrency(plan.debtPlan.totalDebt, plan.currency)} |`);
    lines.push(`| Total interest paid | ${formatCurrency(plan.debtPlan.totalInterest, plan.currency)} |`);
    lines.push(`| Total paid | ${formatCurrency(plan.debtPlan.totalPaid, plan.currency)} |`);
    lines.push(`| Payoff time | ${formatMonth(plan.debtPlan.payoffMonths)} |`);
    lines.push("");
  }
  lines.push("---");
  lines.push("");
  lines.push("*Disclaimer: Educational tool only. Not financial, investment, or tax advice. Projections use assumptions that may not hold. Consult a licensed professional.*");
  return lines.join("\n");
}

export function renderJson(plan: RoadmapPlan): string {
  return JSON.stringify(plan, null, 2);
}

export function renderCsv(plan: RoadmapPlan): string {
  const lines: string[] = [];
  lines.push("goal_id,goal_name,type,target,current,timeline_months,annual_rate,monthly_contribution,final_balance,achievable,shortfall");
  for (const p of plan.goals) {
    lines.push([
      p.goal.id,
      escapeCsv(p.goal.name),
      p.goal.type,
      p.goal.targetAmount.toFixed(2),
      p.goal.currentAmount.toFixed(2),
      p.goal.timelineMonths,
      p.goal.annualReturnRate,
      p.monthlyContribution.toFixed(2),
      p.finalBalance.toFixed(2),
      p.isAchievable ? "yes" : "no",
      p.shortfall.toFixed(2),
    ].join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------- History (localStorage) ----------

const HISTORY_KEY = "unqtools:ai-financial-goal-planner:history";
const HISTORY_MAX = 20;

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
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

// ---------- Shareable URL ----------

export interface ShareState {
  currency: CurrencyCode;
  strategy: DebtStrategy;
  inflationRate: number;
  goals: Array<Omit<Goal, "id" | "priority">>;
  debts: Array<Omit<DebtItem, "id">>;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  params.set("currency", state.currency);
  params.set("strategy", state.strategy);
  params.set("inflation", String(state.inflationRate));
  params.set("goals", JSON.stringify(state.goals));
  if (state.debts.length > 0) params.set("debts", JSON.stringify(state.debts));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const currency = (params.get("currency") as CurrencyCode) ?? "USD";
  const strategy = (params.get("strategy") as DebtStrategy) ?? "avalanche";
  const inflationRate = Number(params.get("inflation") ?? DEFAULT_INFLATION_RATE);
  let goals: Array<Omit<Goal, "id" | "priority">> = [];
  let debts: Array<Omit<DebtItem, "id">> = [];
  try {
    const g = params.get("goals");
    if (g) {
      const parsed = JSON.parse(g);
      if (Array.isArray(parsed)) goals = parsed;
    }
  } catch {
    // ignore
  }
  try {
    const d = params.get("debts");
    if (d) {
      const parsed = JSON.parse(d);
      if (Array.isArray(parsed)) debts = parsed;
    }
  } catch {
    // ignore
  }
  return { currency, strategy, inflationRate, goals, debts };
}

// ---------- ID generation ----------

let _idCounter = 0;

export function makeId(prefix: string = "id"): string {
  _idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${_idCounter.toString(36)}`;
}

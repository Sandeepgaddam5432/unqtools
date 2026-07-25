/**
 * Cash Flow Projector — pure logic.
 * Project monthly cash flow: income - expenses per month.
 */

export interface MonthlyEntry {
  month: string; // e.g. "Jan", "2024-01"
  income: number;
  expenses: number;
}

export interface CashFlowResult {
  months: MonthlyEntry[];
  netPerMonth: number[];
  cumulative: number[];
  totalIncome: number;
  totalExpenses: number;
  totalNet: number;
  lowestBalance: number;
  lowestMonth: string | null;
  peakBalance: number;
  breakEvenMonths: string[];
  isValid: boolean;
  error?: string;
}

/** Validate and project monthly cash flow given a starting balance. */
export function projectCashFlow(months: MonthlyEntry[], startingBalance = 0): CashFlowResult {
  if (!Array.isArray(months) || months.length === 0) {
    return { months: [], netPerMonth: [], cumulative: [], totalIncome: 0, totalExpenses: 0, totalNet: 0, lowestBalance: 0, lowestMonth: null, peakBalance: 0, breakEvenMonths: [], isValid: false, error: "No months provided." };
  }
  for (const m of months) {
    if (!m.month || typeof m.month !== "string") {
      return { months: [], netPerMonth: [], cumulative: [], totalIncome: 0, totalExpenses: 0, totalNet: 0, lowestBalance: 0, lowestMonth: null, peakBalance: 0, breakEvenMonths: [], isValid: false, error: "Each month needs a label." };
    }
    if (m.income < 0 || m.expenses < 0) {
      return { months: [], netPerMonth: [], cumulative: [], totalIncome: 0, totalExpenses: 0, totalNet: 0, lowestBalance: 0, lowestMonth: null, peakBalance: 0, breakEvenMonths: [], isValid: false, error: `Negative value in ${m.month}.` };
    }
  }
  const netPerMonth = months.map((m) => m.income - m.expenses);
  const cumulative: number[] = [];
  let running = startingBalance;
  let lowestBalance = startingBalance;
  let lowestMonth: string | null = months.length > 0 ? months[0].month : null;
  let peakBalance = startingBalance;
  const breakEvenMonths: string[] = [];
  for (let i = 0; i < months.length; i++) {
    running += netPerMonth[i];
    cumulative.push(running);
    if (running < lowestBalance) {
      lowestBalance = running;
      lowestMonth = months[i].month;
    }
    if (running > peakBalance) peakBalance = running;
    if (netPerMonth[i] >= 0) breakEvenMonths.push(months[i].month);
  }
  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpenses = months.reduce((s, m) => s + m.expenses, 0);
  return {
    months,
    netPerMonth,
    cumulative,
    totalIncome,
    totalExpenses,
    totalNet: totalIncome - totalExpenses,
    lowestBalance,
    lowestMonth,
    peakBalance,
    breakEvenMonths,
    isValid: true,
  };
}

/** Apply growth rate to income, expense inflation to expenses. */
export function applyGrowth(
  base: { income: number; expenses: number },
  incomeGrowthPercent: number,
  expenseInflationPercent: number,
  months: number
): MonthlyEntry[] {
  const out: MonthlyEntry[] = [];
  let inc = base.income;
  let exp = base.expenses;
  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (let i = 0; i < months; i++) {
    out.push({ month: monthLabels[i % 12] + (months > 12 ? ` Y${Math.floor(i / 12) + 1}` : ""), income: Math.round(inc), expenses: Math.round(exp) });
    inc *= (1 + incomeGrowthPercent / 100);
    exp *= (1 + expenseInflationPercent / 100);
  }
  return out;
}

/** Compute runway: how many months until balance hits 0. */
export function computeRunway(months: MonthlyEntry[], startingBalance: number): number | null {
  let balance = startingBalance;
  for (let i = 0; i < months.length; i++) {
    balance += months[i].income - months[i].expenses;
    if (balance <= 0) return i + 1;
  }
  return null;
}

/** Format money. */
export function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

/** Default 6-month template. */
export function defaultMonths(): MonthlyEntry[] {
  return [
    { month: "Jan", income: 5000, expenses: 4000 },
    { month: "Feb", income: 5200, expenses: 4100 },
    { month: "Mar", income: 4800, expenses: 4500 },
    { month: "Apr", income: 5500, expenses: 4200 },
    { month: "May", income: 6000, expenses: 4800 },
    { month: "Jun", income: 6200, expenses: 5000 },
  ];
}

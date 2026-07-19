/**
 * Monthly Budget Planner — pure logic.
 *
 * Parse income / expense items, compute totals, variance, savings goal,
 * 50/30/20 rule check. Render as text and CSV. Pure functions only.
 */

// ---- Types ----

export type CurrencySymbol = "$" | "€" | "£" | "₹" | "¥" | "A$" | "C$";

export interface IncomeItem {
  source: string;
  amount: number;
}

export interface ExpenseItem {
  category: string;
  actual: number;
  budgeted: number;
}

export type VarianceStatus = "under" | "over" | "on-budget";

export interface CategoryVariance {
  category: string;
  actual: number;
  budgeted: number;
  variance: number; // budgeted - actual; positive = under, negative = over
  status: VarianceStatus;
}

export interface FiftyThirtyTwenty {
  needsActual: number;
  wantsActual: number;
  savingsActual: number;
  needsPct: number; // percent of income
  wantsPct: number;
  savingsPct: number;
  needsTarget: number; // 50
  wantsTarget: number; // 30
  savingsTarget: number; // 20
  needsOk: boolean;
  wantsOk: boolean;
  savingsOk: boolean;
}

export interface BudgetTotals {
  incomeItems: IncomeItem[];
  expenseItems: ExpenseItem[];
  totalIncome: number;
  totalExpensesActual: number;
  totalExpensesBudgeted: number;
  netIncome: number; // income - actual expenses
  savingsRate: number; // percent of income; 0 if no income
  totalVariance: number;
  variances: CategoryVariance[];
  savingsGoal: number;
  savingsGoalProgress: number; // percent; 0 if no goal
  fiftyThirtyTwenty: FiftyThirtyTwenty;
}

export interface BudgetInput {
  monthYear: string; // YYYY-MM
  incomeItemsText: string;
  expenseItemsText: string;
  savingsGoal: number;
  currencySymbol: CurrencySymbol;
}

export interface BudgetHistoryEntry {
  ts: number;
  monthYear: string;
  totalIncome: number;
  totalExpensesActual: number;
  netIncome: number;
  currencySymbol: CurrencySymbol;
}

// ---- Constants / Presets ----

export const CURRENCY_PRESETS: CurrencySymbol[] = ["$", "€", "£", "₹", "¥", "A$", "C$"];

/** 10 expense category presets. */
export const CATEGORY_PRESETS: string[] = [
  "Housing",
  "Transportation",
  "Food",
  "Utilities",
  "Insurance",
  "Healthcare",
  "Debt",
  "Entertainment",
  "Savings",
  "Other",
];

/** 50/30/20 classification of categories. */
export const NEEDS_CATEGORIES: ReadonlySet<string> = new Set([
  "Housing",
  "Transportation",
  "Food",
  "Utilities",
  "Insurance",
  "Healthcare",
  "Debt",
]);

export const WANTS_CATEGORIES: ReadonlySet<string> = new Set([
  "Entertainment",
  "Other",
]);

export const SAVINGS_CATEGORIES: ReadonlySet<string> = new Set([
  "Savings",
]);

export const FIFTY_THIRTY_TWENTY = {
  needs: 50,
  wants: 30,
  savings: 20,
} as const;

// ---- Parsing ----

/** Split CSV row honoring quoted values. */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(current); current = "";
    } else { current += ch; }
  }
  out.push(current);
  return out;
}

/** Parse `source,amount` lines. Returns parsed items + errors. */
export function parseIncomeItems(text: string): { items: IncomeItem[]; errors: string[] } {
  const items: IncomeItem[] = [];
  const errors: string[] = [];
  if (!text || !text.trim()) return { items, errors };

  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;
    const parts = splitCsvRow(line).map((s) => s.trim());
    if (parts.length < 2) {
      errors.push(`Line ${idx + 1}: needs source,amount`);
      return;
    }
    const [source, amountStr] = parts;
    const amount = Number(amountStr);
    if (!source) {
      errors.push(`Line ${idx + 1}: source is required`);
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      errors.push(`Line ${idx + 1}: invalid amount "${amountStr}"`);
      return;
    }
    items.push({ source, amount: round2(amount) });
  });
  return { items, errors };
}

/** Parse `category,actual,budgeted?` lines. Returns parsed items + errors. */
export function parseExpenseItems(text: string): { items: ExpenseItem[]; errors: string[] } {
  const items: ExpenseItem[] = [];
  const errors: string[] = [];
  if (!text || !text.trim()) return { items, errors };

  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;
    const parts = splitCsvRow(line).map((s) => s.trim());
    if (parts.length < 2) {
      errors.push(`Line ${idx + 1}: needs category,actual[,budgeted]`);
      return;
    }
    const [category, actualStr, budgetedStr] = parts;
    const actual = Number(actualStr);
    if (!category) {
      errors.push(`Line ${idx + 1}: category is required`);
      return;
    }
    if (!Number.isFinite(actual) || actual < 0) {
      errors.push(`Line ${idx + 1}: invalid actual "${actualStr}"`);
      return;
    }
    // budgeted defaults to actual when omitted
    const budgeted = budgetedStr === undefined || budgetedStr === ""
      ? actual
      : Number(budgetedStr);
    if (!Number.isFinite(budgeted) || budgeted < 0) {
      errors.push(`Line ${idx + 1}: invalid budgeted "${budgetedStr}"`);
      return;
    }
    items.push({
      category,
      actual: round2(actual),
      budgeted: round2(budgeted),
    });
  });
  return { items, errors };
}

// ---- Calculations ----

/** Total income. */
export function calcTotalIncome(items: IncomeItem[]): number {
  return round2(items.reduce((s, it) => s + it.amount, 0));
}

/** Total actual expenses. */
export function calcTotalExpensesActual(items: ExpenseItem[]): number {
  return round2(items.reduce((s, it) => s + it.actual, 0));
}

/** Total budgeted expenses. */
export function calcTotalExpensesBudgeted(items: ExpenseItem[]): number {
  return round2(items.reduce((s, it) => s + it.budgeted, 0));
}

/** Net income = income - actual expenses. */
export function calcNetIncome(totalIncome: number, totalExpensesActual: number): number {
  return round2(totalIncome - totalExpensesActual);
}

/** Savings rate = net / income * 100. Returns 0 when income is 0. */
export function calcSavingsRate(netIncome: number, totalIncome: number): number {
  if (!Number.isFinite(totalIncome) || totalIncome <= 0) return 0;
  return round2((netIncome / totalIncome) * 100);
}

/** Per-category variance: budgeted - actual. Positive = under budget. */
export function calcCategoryVariance(item: ExpenseItem): CategoryVariance {
  const variance = round2(item.budgeted - item.actual);
  let status: VarianceStatus = "on-budget";
  if (variance > 0) status = "under";
  else if (variance < 0) status = "over";
  return {
    category: item.category,
    actual: item.actual,
    budgeted: item.budgeted,
    variance,
    status,
  };
}

/** All category variances. */
export function calcAllVariances(items: ExpenseItem[]): CategoryVariance[] {
  return items.map(calcCategoryVariance);
}

/** Total variance = sum of per-category variances = total budgeted - total actual. */
export function calcTotalVariance(items: ExpenseItem[]): number {
  return round2(items.reduce((s, it) => s + (it.budgeted - it.actual), 0));
}

/** Savings goal progress: net income / goal * 100. Returns 0 when goal is 0. */
export function calcSavingsGoalProgress(netIncome: number, savingsGoal: number): number {
  if (!Number.isFinite(savingsGoal) || savingsGoal <= 0) return 0;
  return round2((netIncome / savingsGoal) * 100);
}

/** Classify an expense category into needs / wants / savings bucket. */
export function classifyCategory(category: string): "needs" | "wants" | "savings" {
  const norm = normalizeCategory(category);
  if (SAVINGS_CATEGORIES.has(norm)) return "savings";
  if (NEEDS_CATEGORIES.has(norm)) return "needs";
  if (WANTS_CATEGORIES.has(norm)) return "wants";
  // Unknown → wants (discretionary by default)
  return "wants";
}

/** 50/30/20 rule check given expense items and total income. */
export function checkFiftyThirtyTwenty(items: ExpenseItem[], totalIncome: number): FiftyThirtyTwenty {
  let needsActual = 0;
  let wantsActual = 0;
  let savingsActual = 0;
  for (const it of items) {
    const bucket = classifyCategory(it.category);
    if (bucket === "needs") needsActual += it.actual;
    else if (bucket === "wants") wantsActual += it.actual;
    else savingsActual += it.actual;
  }
  needsActual = round2(needsActual);
  wantsActual = round2(wantsActual);
  savingsActual = round2(savingsActual);

  const income = totalIncome > 0 ? totalIncome : 0;
  const pct = (amt: number) => (income > 0 ? round2((amt / income) * 100) : 0);

  const needsPct = pct(needsActual);
  const wantsPct = pct(wantsActual);
  const savingsPct = pct(savingsActual);

  return {
    needsActual,
    wantsActual,
    savingsActual,
    needsPct,
    wantsPct,
    savingsPct,
    needsTarget: FIFTY_THIRTY_TWENTY.needs,
    wantsTarget: FIFTY_THIRTY_TWENTY.wants,
    savingsTarget: FIFTY_THIRTY_TWENTY.savings,
    needsOk: needsPct <= FIFTY_THIRTY_TWENTY.needs,
    wantsOk: wantsPct <= FIFTY_THIRTY_TWENTY.wants,
    savingsOk: savingsPct >= FIFTY_THIRTY_TWENTY.savings,
  };
}

/** Compute the full budget from raw input. */
export function computeBudget(input: BudgetInput): BudgetTotals {
  const incomeItems = parseIncomeItems(input.incomeItemsText).items;
  const expenseItems = parseExpenseItems(input.expenseItemsText).items;

  const totalIncome = calcTotalIncome(incomeItems);
  const totalExpensesActual = calcTotalExpensesActual(expenseItems);
  const totalExpensesBudgeted = calcTotalExpensesBudgeted(expenseItems);
  const netIncome = calcNetIncome(totalIncome, totalExpensesActual);
  const savingsRate = calcSavingsRate(netIncome, totalIncome);
  const variances = calcAllVariances(expenseItems);
  const totalVariance = calcTotalVariance(expenseItems);
  const savingsGoal = Number.isFinite(input.savingsGoal) && input.savingsGoal > 0
    ? input.savingsGoal
    : 0;
  const savingsGoalProgress = calcSavingsGoalProgress(netIncome, savingsGoal);
  const fiftyThirtyTwenty = checkFiftyThirtyTwenty(expenseItems, totalIncome);

  return {
    incomeItems,
    expenseItems,
    totalIncome,
    totalExpensesActual,
    totalExpensesBudgeted,
    netIncome,
    savingsRate,
    totalVariance,
    variances,
    savingsGoal,
    savingsGoalProgress,
    fiftyThirtyTwenty,
  };
}

// ---- Formatting ----

/** Normalize a category name (keep original casing for display, but compare normalized). */
export function normalizeCategory(s: string): string {
  return (s || "").trim();
}

/** Format a number as currency string. */
export function formatCurrency(amount: number, symbol: CurrencySymbol): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  return `${sign}${symbol}${abs.toFixed(2)}`;
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- Renderers ----

/** Render the budget as a plain-text report. */
export function renderText(input: BudgetInput, totals: BudgetTotals): string {
  const cur = (n: number) => formatCurrency(n, input.currencySymbol);
  const L: string[] = [];
  L.push("=".repeat(60));
  L.push(`MONTHLY BUDGET — ${input.monthYear || "(no month)"}`);
  L.push("=".repeat(60));
  L.push("");

  L.push("INCOME");
  L.push("-".repeat(60));
  if (totals.incomeItems.length === 0) {
    L.push("  (no income items)");
  } else {
    for (const it of totals.incomeItems) {
      L.push(`  ${it.source.padEnd(40)} ${cur(it.amount).padStart(15)}`);
    }
  }
  L.push("-".repeat(60));
  L.push(`${"TOTAL INCOME".padEnd(42)} ${cur(totals.totalIncome).padStart(15)}`);
  L.push("");

  L.push("EXPENSES (actual vs budgeted)");
  L.push("-".repeat(60));
  L.push(`  ${"Category".padEnd(28)} ${"Actual".padStart(10)} ${"Budgeted".padStart(10)} ${"Variance".padStart(10)}`);
  L.push("-".repeat(60));
  if (totals.expenseItems.length === 0) {
    L.push("  (no expense items)");
  } else {
    for (const v of totals.variances) {
      const sign = v.variance > 0 ? "+" : "";
      L.push(
        `  ${v.category.padEnd(28)} ${cur(v.actual).padStart(10)} ${cur(v.budgeted).padStart(10)} ${sign}${cur(v.variance).padStart(9)}`,
      );
    }
  }
  L.push("-".repeat(60));
  L.push(`${"TOTAL ACTUAL".padEnd(42)} ${cur(totals.totalExpensesActual).padStart(15)}`);
  L.push(`${"TOTAL BUDGETED".padEnd(42)} ${cur(totals.totalExpensesBudgeted).padStart(15)}`);
  L.push(`${"TOTAL VARIANCE".padEnd(42)} ${cur(totals.totalVariance).padStart(15)}`);
  L.push("");

  L.push("SUMMARY");
  L.push("-".repeat(60));
  L.push(`${"Net income".padEnd(42)} ${cur(totals.netIncome).padStart(15)}`);
  L.push(`${"Savings rate".padEnd(42)} ${totals.savingsRate.toFixed(2).padStart(14)}%`);
  if (totals.savingsGoal > 0) {
    L.push(`${"Savings goal".padEnd(42)} ${cur(totals.savingsGoal).padStart(15)}`);
    L.push(`${"Savings goal progress".padEnd(42)} ${totals.savingsGoalProgress.toFixed(2).padStart(14)}%`);
  }
  L.push("");

  const ft = totals.fiftyThirtyTwenty;
  L.push("50/30/20 RULE CHECK");
  L.push("-".repeat(60));
  L.push(`  Needs   (target 50%): ${ft.needsPct.toFixed(1).padStart(5)}%  ${ft.needsActual > 0 ? "(" + cur(ft.needsActual) + ")" : ""}  ${ft.needsOk ? "OK" : "OVER"}`);
  L.push(`  Wants   (target 30%): ${ft.wantsPct.toFixed(1).padStart(5)}%  ${ft.wantsActual > 0 ? "(" + cur(ft.wantsActual) + ")" : ""}  ${ft.wantsOk ? "OK" : "OVER"}`);
  L.push(`  Savings (target 20%): ${ft.savingsPct.toFixed(1).padStart(5)}%  ${ft.savingsActual > 0 ? "(" + cur(ft.savingsActual) + ")" : ""}  ${ft.savingsOk ? "OK" : "UNDER"}`);
  L.push("=".repeat(60));
  return L.join("\n");
}

/** Render the budget as CSV (category, budgeted, actual, variance). */
export function renderCsv(input: BudgetInput, totals: BudgetTotals): string {
  const lines: string[] = [];
  lines.push(`month_year,${escapeCsv(input.monthYear)}`);
  lines.push(`currency,${escapeCsv(input.currencySymbol)}`);
  lines.push("");
  lines.push("type,label,amount");
  for (const it of totals.incomeItems) {
    lines.push(`income,${escapeCsv(it.source)},${it.amount.toFixed(2)}`);
  }
  lines.push(`income,TOTAL,${totals.totalIncome.toFixed(2)}`);
  lines.push("");
  lines.push("category,budgeted,actual,variance,status");
  for (const v of totals.variances) {
    lines.push([
      escapeCsv(v.category),
      v.budgeted.toFixed(2),
      v.actual.toFixed(2),
      v.variance.toFixed(2),
      v.status,
    ].join(","));
  }
  lines.push(`TOTAL,${totals.totalExpensesBudgeted.toFixed(2)},${totals.totalExpensesActual.toFixed(2)},${totals.totalVariance.toFixed(2)},`);
  lines.push("");
  lines.push(`net_income,${totals.netIncome.toFixed(2)}`);
  lines.push(`savings_rate_pct,${totals.savingsRate.toFixed(2)}`);
  if (totals.savingsGoal > 0) {
    lines.push(`savings_goal,${totals.savingsGoal.toFixed(2)}`);
    lines.push(`savings_goal_progress_pct,${totals.savingsGoalProgress.toFixed(2)}`);
  }
  const ft = totals.fiftyThirtyTwenty;
  lines.push(`needs_pct,${ft.needsPct.toFixed(2)}`);
  lines.push(`wants_pct,${ft.wantsPct.toFixed(2)}`);
  lines.push(`savings_pct,${ft.savingsPct.toFixed(2)}`);
  return lines.join("\n");
}

// ---- Summary stats ----

export interface BudgetSummaryStats {
  incomeCount: number;
  expenseCount: number;
  totalIncome: number;
  totalExpensesActual: number;
  totalExpensesBudgeted: number;
  netIncome: number;
  savingsRate: number;
  totalVariance: number;
  savingsGoal: number;
  savingsGoalProgress: number;
  overBudgetCount: number;
  underBudgetCount: number;
  largestExpenseCategory: string;
  largestExpenseAmount: number;
}

/** Build a compact summary stats object from totals. */
export function summaryStats(totals: BudgetTotals): BudgetSummaryStats {
  const over = totals.variances.filter((v) => v.status === "over");
  const under = totals.variances.filter((v) => v.status === "under");
  let largestExpenseCategory = "";
  let largestExpenseAmount = 0;
  for (const v of totals.variances) {
    if (v.actual > largestExpenseAmount) {
      largestExpenseAmount = v.actual;
      largestExpenseCategory = v.category;
    }
  }
  return {
    incomeCount: totals.incomeItems.length,
    expenseCount: totals.expenseItems.length,
    totalIncome: totals.totalIncome,
    totalExpensesActual: totals.totalExpensesActual,
    totalExpensesBudgeted: totals.totalExpensesBudgeted,
    netIncome: totals.netIncome,
    savingsRate: totals.savingsRate,
    totalVariance: totals.totalVariance,
    savingsGoal: totals.savingsGoal,
    savingsGoalProgress: totals.savingsGoalProgress,
    overBudgetCount: over.length,
    underBudgetCount: under.length,
    largestExpenseCategory,
    largestExpenseAmount,
  };
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:budget-planner:history";
const HISTORY_MAX = 20;

export function loadHistory(): BudgetHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as BudgetHistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: BudgetHistoryEntry): BudgetHistoryEntry[] {
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

// ---- Shareable URL ----

export function buildShareUrl(input: Partial<BudgetInput>): string {
  const params = new URLSearchParams();
  if (input.monthYear) params.set("m", input.monthYear);
  if (input.incomeItemsText) params.set("inc", input.incomeItemsText);
  if (input.expenseItemsText) params.set("exp", input.expenseItemsText);
  if (input.savingsGoal !== undefined && Number.isFinite(input.savingsGoal) && input.savingsGoal > 0) {
    params.set("goal", String(input.savingsGoal));
  }
  if (input.currencySymbol) params.set("cur", input.currencySymbol);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<BudgetInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<BudgetInput> = {};
  if (params.get("m")) out.monthYear = params.get("m")!;
  if (params.get("inc")) out.incomeItemsText = params.get("inc")!;
  if (params.get("exp")) out.expenseItemsText = params.get("exp")!;
  const goal = params.get("goal");
  if (goal !== null) {
    const n = Number(goal);
    if (Number.isFinite(n) && n >= 0) out.savingsGoal = n;
  }
  const cur = params.get("cur") as CurrencySymbol | null;
  if (cur && CURRENCY_PRESETS.includes(cur)) out.currencySymbol = cur;
  return out;
}

// ---- Helpers ----

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

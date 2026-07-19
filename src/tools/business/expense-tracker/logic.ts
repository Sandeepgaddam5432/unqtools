/**
 * Expense Tracker — pure logic.
 *
 * Track business expenses — categorize, total, generate reports.
 * Pure functions only — no DOM, no network.
 */

export type SortOption = "date" | "amount-desc" | "category";

export interface Expense {
  date: string;        // YYYY-MM-DD
  category: string;    // normalized (Title-case)
  description: string;
  amount: number;
  lineIndex: number;   // 1-based line number from input
}

export interface ParsedExpenses {
  expenses: Expense[];
  errors: string[];
}

export interface ExpenseInput {
  expensesText: string;
  dateRangeStart: string; // YYYY-MM-DD or ""
  dateRangeEnd: string;   // YYYY-MM-DD or ""
  currencySymbol: string;
  sort: SortOption;
}

export interface CategoryTotal {
  category: string;
  total: number;
  count: number;
  percentage: number;
  deductible: boolean;
}

export interface ExpenseStats {
  count: number;
  grandTotal: number;
  categoryCount: number;
  avgPerCategory: number;
  dailyAverage: number;
  topCategory: string | null;
  topCategoryTotal: number;
  topExpense: Expense | null;
  deductibleTotal: number;
  uniqueDates: number;
}

export interface CurrencyOption {
  code: string;
  symbol: string;
  label: string;
}

export const CURRENCY_PRESETS: CurrencyOption[] = [
  { code: "USD", symbol: "$", label: "US Dollar ($)" },
  { code: "EUR", symbol: "€", label: "Euro (€)" },
  { code: "GBP", symbol: "£", label: "British Pound (£)" },
  { code: "INR", symbol: "₹", label: "Indian Rupee (₹)" },
  { code: "JPY", symbol: "¥", label: "Japanese Yen (¥)" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar (A$)" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar (C$)" },
];

export const EXPENSE_CATEGORIES: string[] = [
  "Travel", "Meals", "Office", "Software", "Hardware",
  "Marketing", "Legal", "Training", "Other",
];

/** Categories typically tax-deductible for businesses. */
export const DEDUCTIBLE_CATEGORIES: string[] = [
  "Travel", "Meals", "Office", "Software", "Hardware",
  "Marketing", "Legal", "Training",
];

export const DEFAULT_INPUT: ExpenseInput = {
  expensesText: "",
  dateRangeStart: "",
  dateRangeEnd: "",
  currencySymbol: "$",
  sort: "date",
};

/** Title-case a category (so 'travel' / 'TRAVEL' → 'Travel'). */
export function normalizeCategory(s: string): string {
  const trimmed = (s || "").trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  // Match known preset case (so 'travel' → 'Travel', 'office' → 'Office')
  const preset = EXPENSE_CATEGORIES.find((c) => c.toLowerCase() === lower);
  if (preset) return preset;
  // Custom: title-case each word
  return lower.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Validate a date string in YYYY-MM-DD format (strict). */
export function isValidDate(s: string): boolean {
  if (!s) return false;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (mo < 1 || mo > 12) return false;
  if (d < 1 || d > 31) return false;
  // Build a date and verify it didn't roll over (e.g. Feb 30 → Mar 2)
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d
  );
}

/** Split a CSV row, supporting quoted fields with embedded commas. */
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

/** Parse a single expense line. Returns null on hard parse failure. */
export function parseExpenseLine(line: string, lineIndex: number): Expense | null {
  const fields = splitCsvRow(line);
  if (fields.length < 4) return null;
  const date = fields[0].trim();
  const category = normalizeCategory(fields[1]);
  const description = fields[2].trim();
  const amountStr = fields[3].trim();
  const amount = Number(amountStr);
  if (!date || !category || !Number.isFinite(amount)) return null;
  return { date, category, description, amount, lineIndex };
}

/** Parse the full expenses textarea. Collects errors instead of throwing. */
export function parseExpenses(text: string): ParsedExpenses {
  const expenses: Expense[] = [];
  const errors: string[] = [];
  if (!text || !text.trim()) return { expenses, errors };
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith("#")) continue; // comment line
    const lineIndex = i + 1;
    const fields = splitCsvRow(line);
    if (fields.length < 4) {
      errors.push(`Line ${lineIndex}: expected 4 fields (date,category,description,amount), got ${fields.length}`);
      continue;
    }
    const date = fields[0].trim();
    const category = normalizeCategory(fields[1]);
    const description = fields[2].trim();
    const amountStr = fields[3].trim();
    if (!isValidDate(date)) {
      errors.push(`Line ${lineIndex}: invalid date "${date}" (use YYYY-MM-DD)`);
      continue;
    }
    if (!category) {
      errors.push(`Line ${lineIndex}: empty category`);
      continue;
    }
    const amount = Number(amountStr);
    if (!Number.isFinite(amount)) {
      errors.push(`Line ${lineIndex}: invalid amount "${amountStr}"`);
      continue;
    }
    expenses.push({ date, category, description, amount, lineIndex });
  }
  return { expenses, errors };
}

/** Filter expenses by date range (inclusive). Empty bounds = open. */
export function filterByDateRange(
  expenses: Expense[],
  start: string,
  end: string,
): Expense[] {
  if (!start && !end) return expenses;
  return expenses.filter((e) => {
    if (start && e.date < start) return false;
    if (end && e.date > end) return false;
    return true;
  });
}

/** Group expenses by category. */
export function groupByCategory(expenses: Expense[]): Record<string, Expense[]> {
  const out: Record<string, Expense[]> = {};
  for (const e of expenses) {
    if (!out[e.category]) out[e.category] = [];
    out[e.category].push(e);
  }
  return out;
}

/** Compute per-category totals with count + percentage. */
export function computeCategoryTotals(expenses: Expense[]): CategoryTotal[] {
  const groups = groupByCategory(expenses);
  const grand = computeGrandTotal(expenses);
  const out: CategoryTotal[] = [];
  for (const [category, list] of Object.entries(groups)) {
    const total = list.reduce((s, e) => s + e.amount, 0);
    const percentage = grand > 0 ? (total / grand) * 100 : 0;
    out.push({
      category,
      total,
      count: list.length,
      percentage,
      deductible: DEDUCTIBLE_CATEGORIES.includes(category),
    });
  }
  out.sort((a, b) => b.total - a.total);
  return out;
}

/** Sum of all expense amounts. */
export function computeGrandTotal(expenses: Expense[]): number {
  return expenses.reduce((s, e) => s + e.amount, 0);
}

/** Find the highest-amount expense. */
export function findTopExpense(expenses: Expense[]): Expense | null {
  if (expenses.length === 0) return null;
  let top = expenses[0];
  for (const e of expenses) {
    if (e.amount > top.amount) top = e;
  }
  return top;
}

/** Average daily spend = grandTotal / uniqueDates. */
export function computeDailyAverage(expenses: Expense[]): number {
  if (expenses.length === 0) return 0;
  const dates = new Set(expenses.map((e) => e.date));
  if (dates.size === 0) return 0;
  return computeGrandTotal(expenses) / dates.size;
}

/** Percentage of grand total for a category. */
export function computeCategoryPercentage(category: string, expenses: Expense[]): number {
  const grand = computeGrandTotal(expenses);
  if (grand <= 0) return 0;
  const catTotal = expenses
    .filter((e) => e.category === category)
    .reduce((s, e) => s + e.amount, 0);
  return (catTotal / grand) * 100;
}

/** Sort expenses by the chosen option. */
export function sortExpenses(expenses: Expense[], sort: SortOption): Expense[] {
  const copy = [...expenses];
  if (sort === "date") {
    copy.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.lineIndex - b.lineIndex;
    });
  } else if (sort === "amount-desc") {
    copy.sort((a, b) => b.amount - a.amount || a.lineIndex - b.lineIndex);
  } else if (sort === "category") {
    copy.sort((a, b) => {
      if (a.category.toLowerCase() !== b.category.toLowerCase()) {
        return a.category.toLowerCase() < b.category.toLowerCase() ? -1 : 1;
      }
      return a.lineIndex - b.lineIndex;
    });
  }
  return copy;
}

/** Compute all summary stats in one pass. */
export function summaryStats(expenses: Expense[]): ExpenseStats {
  const grandTotal = computeGrandTotal(expenses);
  const groups = groupByCategory(expenses);
  const categoryCount = Object.keys(groups).length;
  const avgPerCategory = categoryCount > 0 ? grandTotal / categoryCount : 0;
  const dailyAverage = computeDailyAverage(expenses);
  const topExpense = findTopExpense(expenses);
  const dates = new Set(expenses.map((e) => e.date));
  let topCategory: string | null = null;
  let topCategoryTotal = 0;
  for (const [cat, list] of Object.entries(groups)) {
    const t = list.reduce((s, e) => s + e.amount, 0);
    if (t > topCategoryTotal) {
      topCategoryTotal = t;
      topCategory = cat;
    }
  }
  const deductibleTotal = expenses
    .filter((e) => DEDUCTIBLE_CATEGORIES.includes(e.category))
    .reduce((s, e) => s + e.amount, 0);
  return {
    count: expenses.length,
    grandTotal,
    categoryCount,
    avgPerCategory,
    dailyAverage,
    topCategory,
    topCategoryTotal,
    topExpense,
    deductibleTotal,
    uniqueDates: dates.size,
  };
}

/** Format a money value as a string with 2 decimals + currency symbol. */
export function formatMoney(amount: number, symbol: string = "$"): string {
  if (!Number.isFinite(amount)) return `${symbol}0.00`;
  return `${symbol}${amount.toFixed(2)}`;
}

/** Format a percentage with 1 decimal. */
export function formatPercentage(pct: number): string {
  if (!Number.isFinite(pct)) return "0.0%";
  return `${pct.toFixed(1)}%`;
}

/** Render as a plain text report — by category + by date + summary. */
export function renderText(input: ExpenseInput, expenses: Expense[]): string {
  if (expenses.length === 0) return "No expenses to report.";
  const symbol = input.currencySymbol || "$";
  const sorted = sortExpenses(expenses, input.sort);
  const stats = summaryStats(expenses);
  const categoryTotals = computeCategoryTotals(expenses);
  const lines: string[] = [];
  lines.push("=== Expense Report ===");
  if (input.dateRangeStart || input.dateRangeEnd) {
    lines.push(`Date range: ${input.dateRangeStart || "…"} to ${input.dateRangeEnd || "…"}`);
  }
  lines.push(`Currency: ${symbol}`);
  lines.push(`Sort: ${input.sort}`);
  lines.push("");
  lines.push("--- Summary ---");
  lines.push(`Total expenses:     ${stats.count}`);
  lines.push(`Grand total:        ${formatMoney(stats.grandTotal, symbol)}`);
  lines.push(`Unique categories:  ${stats.categoryCount}`);
  lines.push(`Avg per category:   ${formatMoney(stats.avgPerCategory, symbol)}`);
  lines.push(`Unique dates:       ${stats.uniqueDates}`);
  lines.push(`Daily average:      ${formatMoney(stats.dailyAverage, symbol)}`);
  if (stats.topCategory) {
    lines.push(`Top category:       ${stats.topCategory} (${formatMoney(stats.topCategoryTotal, symbol)})`);
  }
  if (stats.topExpense) {
    lines.push(`Top expense:        ${formatMoney(stats.topExpense.amount, symbol)} — ${stats.topExpense.description || "(no desc)"} [${stats.topExpense.date}]`);
  }
  lines.push(`Tax-deductible:     ${formatMoney(stats.deductibleTotal, symbol)}`);
  lines.push("");
  lines.push("--- By Category ---");
  for (const c of categoryTotals) {
    const ded = c.deductible ? " [deductible]" : "";
    lines.push(`${c.category}${ded}: ${formatMoney(c.total, symbol)} (${c.count} entries, ${formatPercentage(c.percentage)})`);
  }
  lines.push("");
  lines.push("--- By Date (sorted) ---");
  for (const e of sorted) {
    lines.push(`${e.date} | ${e.category} | ${e.description || "(no desc)"} | ${formatMoney(e.amount, symbol)}`);
  }
  return lines.join("\n");
}

/** Render as CSV (date, category, description, amount). */
export function renderCsv(expenses: Expense[]): string {
  const lines = ["date,category,description,amount"];
  for (const e of expenses) {
    lines.push([
      e.date,
      escapeCsv(e.category),
      escapeCsv(e.description),
      e.amount.toFixed(2),
    ].join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Suppress unused warning — escapeCsv is exported for tests via _escapeCsv.
export { escapeCsv as _escapeCsv };

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:expense-tracker:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  expensesText: string;
  expenseCount: number;
  grandTotal: number;
  currencySymbol: string;
}

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

// ---- Shareable URL ----

export function buildShareUrl(input: ExpenseInput): string {
  const params = new URLSearchParams();
  if (input.expensesText) params.set("expenses", input.expensesText);
  if (input.dateRangeStart) params.set("from", input.dateRangeStart);
  if (input.dateRangeEnd) params.set("to", input.dateRangeEnd);
  if (input.currencySymbol) params.set("cur", input.currencySymbol);
  if (input.sort && input.sort !== "date") params.set("sort", input.sort);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ExpenseInput {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { ...DEFAULT_INPUT };
  const params = new URLSearchParams(clean);
  const sortRaw = params.get("sort");
  const sort: SortOption =
    sortRaw === "amount-desc" || sortRaw === "category" ? sortRaw : "date";
  const cur = params.get("cur");
  const currencySymbol =
    cur && CURRENCY_PRESETS.some((c) => c.symbol === cur) ? cur : DEFAULT_INPUT.currencySymbol;
  return {
    expensesText: params.get("expenses") ?? "",
    dateRangeStart: params.get("from") ?? "",
    dateRangeEnd: params.get("to") ?? "",
    currencySymbol,
    sort,
  };
}

import { describe, it, expect, beforeEach } from "vitest";
import {
  CURRENCY_PRESETS,
  EXPENSE_CATEGORIES,
  DEDUCTIBLE_CATEGORIES,
  DEFAULT_INPUT,
  normalizeCategory,
  isValidDate,
  splitCsvRow,
  parseExpenseLine,
  parseExpenses,
  filterByDateRange,
  groupByCategory,
  computeCategoryTotals,
  computeGrandTotal,
  findTopExpense,
  computeDailyAverage,
  computeCategoryPercentage,
  sortExpenses,
  summaryStats,
  formatMoney,
  formatPercentage,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ExpenseInput,
  type SortOption,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

const SAMPLE_EXPENSES = `2026-07-13,Travel,Taxi to airport,45.50
2026-07-13,Meals,Client lunch,32.00
2026-07-14,Software,Annual subscription,199.99
2026-07-14,Travel,"Train, return ticket",68.25
2026-07-15,Office,Printer paper,12.49
2026-07-15,Marketing,Facebook ads,150.00
2026-07-16,Meals,Coffee meeting,8.75
2026-07-16,Other,Team gift,25.00`;

describe("expense-tracker constants", () => {
  it("has 7 currency presets", () => {
    expect(CURRENCY_PRESETS).toHaveLength(7);
  });
  it("has 9 expense category presets", () => {
    expect(EXPENSE_CATEGORIES).toHaveLength(9);
    expect(EXPENSE_CATEGORIES).toContain("Travel");
    expect(EXPENSE_CATEGORIES).toContain("Other");
  });
  it("has deductible categories (subset of presets)", () => {
    expect(DEDUCTIBLE_CATEGORIES.length).toBeGreaterThanOrEqual(5);
    for (const c of DEDUCTIBLE_CATEGORIES) {
      expect(EXPENSE_CATEGORIES).toContain(c);
    }
  });
  it("Other is NOT deductible", () => {
    expect(DEDUCTIBLE_CATEGORIES).not.toContain("Other");
  });
  it("has a default input", () => {
    expect(DEFAULT_INPUT.currencySymbol).toBe("$");
    expect(DEFAULT_INPUT.sort).toBe("date");
  });
});

describe("expense-tracker normalizeCategory", () => {
  it("matches preset case", () => {
    expect(normalizeCategory("travel")).toBe("Travel");
    expect(normalizeCategory("TRAVEL")).toBe("Travel");
    expect(normalizeCategory(" Travel ")).toBe("Travel");
  });
  it("title-cases custom categories", () => {
    expect(normalizeCategory("client entertainment")).toBe("Client Entertainment");
    expect(normalizeCategory("rent")).toBe("Rent");
  });
  it("returns empty for empty input", () => {
    expect(normalizeCategory("")).toBe("");
    expect(normalizeCategory("   ")).toBe("");
  });
});

describe("expense-tracker isValidDate", () => {
  it("accepts valid dates", () => {
    expect(isValidDate("2026-07-13")).toBe(true);
    expect(isValidDate("2024-02-29")).toBe(true); // leap year
  });
  it("rejects invalid dates", () => {
    expect(isValidDate("2025-02-29")).toBe(false); // not a leap year
    expect(isValidDate("2026-13-01")).toBe(false);
    expect(isValidDate("2026-07-32")).toBe(false);
    expect(isValidDate("2026/07/13")).toBe(false);
    expect(isValidDate("07-13-2026")).toBe(false);
    expect(isValidDate("")).toBe(false);
    expect(isValidDate("not-a-date")).toBe(false);
  });
});

describe("expense-tracker splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("handles escaped quotes", () => {
    expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]);
  });
  it("handles trailing/leading spaces preserved", () => {
    expect(splitCsvRow(" a , b ")).toEqual([" a ", " b "]);
  });
});

describe("expense-tracker parseExpenseLine", () => {
  it("parses a basic line", () => {
    const e = parseExpenseLine("2026-07-13,Travel,Taxi,45.50", 1);
    expect(e).toEqual({
      date: "2026-07-13",
      category: "Travel",
      description: "Taxi",
      amount: 45.5,
      lineIndex: 1,
    });
  });
  it("parses a quoted description with comma", () => {
    const e = parseExpenseLine('2026-07-14,Travel,"Train, return",68.25', 2);
    expect(e!.description).toBe("Train, return");
    expect(e!.amount).toBe(68.25);
  });
  it("normalizes category case", () => {
    const e = parseExpenseLine("2026-07-13,travel,Taxi,45.50", 1);
    expect(e!.category).toBe("Travel");
  });
  it("returns null for too few fields", () => {
    expect(parseExpenseLine("2026-07-13,Travel,Taxi", 1)).toBeNull();
  });
  it("returns null for invalid amount", () => {
    expect(parseExpenseLine("2026-07-13,Travel,Taxi,abc", 1)).toBeNull();
  });
});

describe("expense-tracker parseExpenses", () => {
  it("parses multiple valid lines", () => {
    const p = parseExpenses(SAMPLE_EXPENSES);
    expect(p.expenses).toHaveLength(8);
    expect(p.errors).toEqual([]);
  });
  it("skips blank lines and comments", () => {
    const p = parseExpenses("# comment\n\n2026-07-13,Travel,Taxi,10\n# another comment");
    expect(p.expenses).toHaveLength(1);
    expect(p.errors).toEqual([]);
  });
  it("collects errors but keeps valid rows", () => {
    const text = `2026-07-13,Travel,Taxi,45.50
bad-line
2026-07-14,Software,Sub,abc
2026-07-15,Office,Paper,12.49`;
    const p = parseExpenses(text);
    expect(p.expenses).toHaveLength(2);
    expect(p.errors.length).toBe(2);
    expect(p.errors[0]).toContain("Line 2");
    expect(p.errors[1]).toContain("invalid amount");
  });
  it("handles empty input", () => {
    const p = parseExpenses("");
    expect(p.expenses).toEqual([]);
    expect(p.errors).toEqual([]);
  });
  it("flags invalid date", () => {
    const p = parseExpenses("2026-13-99,Travel,Taxi,45");
    expect(p.expenses).toEqual([]);
    expect(p.errors.length).toBe(1);
    expect(p.errors[0]).toContain("invalid date");
  });
  it("flags empty category", () => {
    const p = parseExpenses("2026-07-13,,Taxi,45");
    expect(p.errors.length).toBe(1);
    expect(p.errors[0]).toContain("empty category");
  });
});

describe("expense-tracker filterByDateRange", () => {
  const parsed = parseExpenses(SAMPLE_EXPENSES).expenses;
  it("returns all when no bounds", () => {
    expect(filterByDateRange(parsed, "", "")).toHaveLength(8);
  });
  it("filters from start", () => {
    expect(filterByDateRange(parsed, "2026-07-15", "")).toHaveLength(4);
  });
  it("filters to end", () => {
    // 2026-07-13 (2) + 2026-07-14 (2) = 4 (inclusive)
    expect(filterByDateRange(parsed, "", "2026-07-14")).toHaveLength(4);
  });
  it("filters on both bounds inclusive", () => {
    expect(filterByDateRange(parsed, "2026-07-14", "2026-07-15")).toHaveLength(4);
  });
  it("returns empty when range excludes all", () => {
    expect(filterByDateRange(parsed, "2027-01-01", "2027-12-31")).toHaveLength(0);
  });
});

describe("expense-tracker groupByCategory", () => {
  it("groups expenses by category", () => {
    const parsed = parseExpenses(SAMPLE_EXPENSES).expenses;
    const groups = groupByCategory(parsed);
    expect(Object.keys(groups)).toContain("Travel");
    expect(Object.keys(groups)).toContain("Meals");
    expect(groups["Travel"]).toHaveLength(2);
    expect(groups["Meals"]).toHaveLength(2);
  });
  it("returns empty object for empty input", () => {
    expect(groupByCategory([])).toEqual({});
  });
});

describe("expense-tracker computeCategoryTotals", () => {
  const parsed = parseExpenses(SAMPLE_EXPENSES).expenses;
  const totals = computeCategoryTotals(parsed);

  it("returns one entry per category", () => {
    // Travel, Meals, Software, Office, Marketing, Other = 6 unique
    expect(totals).toHaveLength(6);
  });
  it("sorts by total descending", () => {
    for (let i = 1; i < totals.length; i++) {
      expect(totals[i].total).toBeLessThanOrEqual(totals[i - 1].total);
    }
  });
  it("computes correct count and total for Marketing", () => {
    const m = totals.find((t) => t.category === "Marketing")!;
    expect(m.count).toBe(1);
    expect(m.total).toBeCloseTo(150.0, 2);
  });
  it("sums Travel correctly", () => {
    const t = totals.find((x) => x.category === "Travel")!;
    expect(t.count).toBe(2);
    expect(t.total).toBeCloseTo(45.5 + 68.25, 2);
  });
  it("percentages sum to ~100", () => {
    const sum = totals.reduce((s, t) => s + t.percentage, 0);
    expect(sum).toBeCloseTo(100, 0);
  });
  it("marks deductible categories", () => {
    expect(totals.find((t) => t.category === "Travel")!.deductible).toBe(true);
    expect(totals.find((t) => t.category === "Other")!.deductible).toBe(false);
  });
  it("handles empty input", () => {
    expect(computeCategoryTotals([])).toEqual([]);
  });
});

describe("expense-tracker computeGrandTotal + topExpense + dailyAverage", () => {
  const parsed = parseExpenses(SAMPLE_EXPENSES).expenses;
  it("grand total sums all amounts", () => {
    const expected = 45.50 + 32.00 + 199.99 + 68.25 + 12.49 + 150.00 + 8.75 + 25.00;
    expect(computeGrandTotal(parsed)).toBeCloseTo(expected, 2);
  });
  it("top expense is the highest-amount one", () => {
    const top = findTopExpense(parsed)!;
    expect(top.amount).toBeCloseTo(199.99, 2);
    expect(top.description).toBe("Annual subscription");
  });
  it("findTopExpense returns null for empty", () => {
    expect(findTopExpense([])).toBeNull();
  });
  it("daily average = grandTotal / uniqueDates", () => {
    const grand = computeGrandTotal(parsed);
    const uniqueDates = 4; // 2026-07-13, 14, 15, 16
    expect(computeDailyAverage(parsed)).toBeCloseTo(grand / uniqueDates, 2);
  });
  it("daily average is 0 for empty", () => {
    expect(computeDailyAverage([])).toBe(0);
  });
});

describe("expense-tracker computeCategoryPercentage", () => {
  const parsed = parseExpenses(SAMPLE_EXPENSES).expenses;
  it("returns percentage for a known category", () => {
    const grand = computeGrandTotal(parsed);
    const expected = (150.0 / grand) * 100;
    expect(computeCategoryPercentage("Marketing", parsed)).toBeCloseTo(expected, 2);
  });
  it("returns 0 for empty list", () => {
    expect(computeCategoryPercentage("Travel", [])).toBe(0);
  });
  it("returns 0 for non-existent category", () => {
    expect(computeCategoryPercentage("Nonexistent", parsed)).toBe(0);
  });
});

describe("expense-tracker sortExpenses", () => {
  const parsed = parseExpenses(SAMPLE_EXPENSES).expenses;

  it("sorts by date ascending (default)", () => {
    const sorted = sortExpenses(parsed, "date");
    expect(sorted[0].date).toBe("2026-07-13");
    expect(sorted[sorted.length - 1].date).toBe("2026-07-16");
  });
  it("sorts by amount descending", () => {
    const sorted = sortExpenses(parsed, "amount-desc");
    expect(sorted[0].amount).toBeCloseTo(199.99, 2);
    expect(sorted[sorted.length - 1].amount).toBeCloseTo(8.75, 2);
  });
  it("sorts by category alphabetically", () => {
    const sorted = sortExpenses(parsed, "category");
    const cats = sorted.map((e) => e.category.toLowerCase());
    const sortedCats = [...cats].sort();
    expect(cats).toEqual(sortedCats);
  });
  it("does not mutate input", () => {
    const before = parsed.map((e) => e.lineIndex).join(",");
    sortExpenses(parsed, "amount-desc");
    expect(parsed.map((e) => e.lineIndex).join(",")).toBe(before);
  });
  it("handles empty input", () => {
    expect(sortExpenses([], "date")).toEqual([]);
  });
});

describe("expense-tracker summaryStats", () => {
  const parsed = parseExpenses(SAMPLE_EXPENSES).expenses;
  const stats = summaryStats(parsed);

  it("computes count and grand total", () => {
    expect(stats.count).toBe(8);
    expect(stats.grandTotal).toBeGreaterThan(540);
  });
  it("computes category count", () => {
    expect(stats.categoryCount).toBe(6); // Travel, Meals, Software, Office, Marketing, Other
  });
  it("computes avg per category", () => {
    expect(stats.avgPerCategory).toBeCloseTo(stats.grandTotal / 6, 2);
  });
  it("computes daily average", () => {
    expect(stats.dailyAverage).toBeCloseTo(stats.grandTotal / 4, 2);
  });
  it("finds top category", () => {
    expect(stats.topCategory).toBe("Software");
    expect(stats.topCategoryTotal).toBeCloseTo(199.99, 2);
  });
  it("finds top expense", () => {
    expect(stats.topExpense).not.toBeNull();
    expect(stats.topExpense!.amount).toBeCloseTo(199.99, 2);
  });
  it("computes deductible total", () => {
    // Other (25.00) is NOT deductible, so deductibleTotal = grandTotal - 25
    expect(stats.deductibleTotal).toBeCloseTo(stats.grandTotal - 25.00, 2);
  });
  it("counts unique dates", () => {
    expect(stats.uniqueDates).toBe(4);
  });
  it("handles empty input", () => {
    const s = summaryStats([]);
    expect(s.count).toBe(0);
    expect(s.grandTotal).toBe(0);
    expect(s.topCategory).toBeNull();
    expect(s.topExpense).toBeNull();
  });
});

describe("expense-tracker formatters", () => {
  it("formatMoney formats with symbol and 2 decimals", () => {
    expect(formatMoney(123.456, "$")).toBe("$123.46");
    expect(formatMoney(0, "€")).toBe("€0.00");
    expect(formatMoney(-50, "£")).toBe("£-50.00");
  });
  it("formatMoney defaults to $", () => {
    expect(formatMoney(10)).toBe("$10.00");
  });
  it("formatPercentage formats with 1 decimal", () => {
    expect(formatPercentage(33.333)).toBe("33.3%");
    expect(formatPercentage(0)).toBe("0.0%");
  });
});

describe("expense-tracker renderText + renderCsv", () => {
  const input: ExpenseInput = {
    expensesText: SAMPLE_EXPENSES,
    dateRangeStart: "",
    dateRangeEnd: "",
    currencySymbol: "$",
    sort: "date",
  };
  const parsed = parseExpenses(SAMPLE_EXPENSES).expenses;

  it("renderText has all sections", () => {
    const txt = renderText(input, parsed);
    expect(txt).toContain("=== Expense Report ===");
    expect(txt).toContain("--- Summary ---");
    expect(txt).toContain("--- By Category ---");
    expect(txt).toContain("--- By Date (sorted) ---");
  });
  it("renderText includes grand total", () => {
    const txt = renderText(input, parsed);
    expect(txt).toContain("Grand total:");
  });
  it("renderText includes top category", () => {
    const txt = renderText(input, parsed);
    expect(txt).toContain("Top category:");
    expect(txt).toContain("Software");
  });
  it("renderText marks deductible categories", () => {
    const txt = renderText(input, parsed);
    expect(txt).toContain("Travel [deductible]");
    expect(txt).toContain("Other:"); // Other not marked
    expect(txt).not.toContain("Other [deductible]");
  });
  it("renderText shows date range when provided", () => {
    const i2: ExpenseInput = { ...input, dateRangeStart: "2026-07-14", dateRangeEnd: "2026-07-15" };
    const txt = renderText(i2, parsed);
    expect(txt).toContain("Date range:");
    expect(txt).toContain("2026-07-14");
  });
  it("renderText returns placeholder for empty input", () => {
    const txt = renderText(input, []);
    expect(txt).toBe("No expenses to report.");
  });
  it("renderCsv has header", () => {
    const csv = renderCsv(parsed);
    expect(csv.split("\n")[0]).toBe("date,category,description,amount");
  });
  it("renderCsv has one row per expense", () => {
    const csv = renderCsv(parsed);
    expect(csv.split("\n").length).toBe(parsed.length + 1);
  });
  it("renderCsv escapes descriptions with commas", () => {
    const csv = renderCsv(parsed);
    expect(csv).toContain('"Train, return ticket"');
  });
});

describe("expense-tracker history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      expensesText: "2026-07-13,Travel,Taxi,45",
      expenseCount: 1,
      grandTotal: 45,
      currencySymbol: "$",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        expensesText: "2026-07-13,Travel,Taxi,45",
        expenseCount: 1,
        grandTotal: 45,
        currencySymbol: "$",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      expensesText: "2026-07-13,Travel,Taxi,45",
      expenseCount: 1,
      grandTotal: 45,
      currencySymbol: "$",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("expense-tracker shareable URL", () => {
  const input: ExpenseInput = {
    expensesText: "2026-07-13,Travel,Taxi,45.50",
    dateRangeStart: "2026-07-01",
    dateRangeEnd: "2026-07-31",
    currencySymbol: "€",
    sort: "amount-desc",
  };

  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(input);
    expect(url).toContain("expenses=");
    expect(url).toContain("from=2026-07-01");
    expect(url).toContain("to=2026-07-31");
    expect(url).toContain("cur=%E2%82%AC"); // € encoded
    expect(url).toContain("sort=amount-desc");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("parses share URL back", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(input);
    const parsed = parseShareUrl(url);
    expect(parsed.expensesText).toBe("2026-07-13,Travel,Taxi,45.50");
    expect(parsed.dateRangeStart).toBe("2026-07-01");
    expect(parsed.dateRangeEnd).toBe("2026-07-31");
    expect(parsed.currencySymbol).toBe("€");
    expect(parsed.sort).toBe("amount-desc");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.expensesText).toBe("");
    expect(p.sort).toBe("date");
  });

  it("falls back to defaults for missing params", () => {
    const p = parseShareUrl("expenses=2026-07-13,Travel,Taxi,45");
    expect(p.expensesText).toBe("2026-07-13,Travel,Taxi,45");
    expect(p.dateRangeStart).toBe("");
    expect(p.currencySymbol).toBe(DEFAULT_INPUT.currencySymbol);
    expect(p.sort).toBe("date");
  });

  it("sanitizes invalid sort to date", () => {
    const p = parseShareUrl("sort=bogus");
    expect(p.sort).toBe("date");
  });

  it("sanitizes invalid currency symbol to default", () => {
    const p = parseShareUrl("cur=XYZ");
    expect(p.currencySymbol).toBe(DEFAULT_INPUT.currencySymbol);
  });

  it("omits sort param when default", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ ...input, sort: "date" });
    expect(url).not.toContain("sort=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
});

// Suppress unused-import lint
export type _Unused = SortOption;

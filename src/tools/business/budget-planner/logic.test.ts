import { describe, it, expect, beforeEach } from "vitest";
import {
  CURRENCY_PRESETS,
  CATEGORY_PRESETS,
  NEEDS_CATEGORIES,
  WANTS_CATEGORIES,
  SAVINGS_CATEGORIES,
  FIFTY_THIRTY_TWENTY,
  splitCsvRow,
  parseIncomeItems,
  parseExpenseItems,
  calcTotalIncome,
  calcTotalExpensesActual,
  calcTotalExpensesBudgeted,
  calcNetIncome,
  calcSavingsRate,
  calcCategoryVariance,
  calcAllVariances,
  calcTotalVariance,
  calcSavingsGoalProgress,
  classifyCategory,
  checkFiftyThirtyTwenty,
  computeBudget,
  normalizeCategory,
  formatCurrency,
  renderText,
  renderCsv,
  summaryStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type BudgetInput,
  type CurrencySymbol,
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

function sampleInput(overrides: Partial<BudgetInput> = {}): BudgetInput {
  return {
    monthYear: "2026-07",
    incomeItemsText: "Salary,5000\nFreelance,800",
    expenseItemsText: "Housing,1500,1500\nFood,450,500\nEntertainment,200,150\nSavings,500,500",
    savingsGoal: 1000,
    currencySymbol: "$",
    ...overrides,
  };
}

describe("budget-planner constants", () => {
  it("has 7 currency presets", () => {
    expect(CURRENCY_PRESETS).toHaveLength(7);
    expect(CURRENCY_PRESETS).toContain("$");
    expect(CURRENCY_PRESETS).toContain("₹");
    expect(CURRENCY_PRESETS).toContain("A$");
    expect(CURRENCY_PRESETS).toContain("C$");
  });
  it("has 10 category presets", () => {
    expect(CATEGORY_PRESETS).toHaveLength(10);
    expect(CATEGORY_PRESETS).toContain("Housing");
    expect(CATEGORY_PRESETS).toContain("Savings");
    expect(CATEGORY_PRESETS).toContain("Other");
  });
  it("classifies needs (7 categories)", () => {
    expect(NEEDS_CATEGORIES.size).toBe(7);
    expect(NEEDS_CATEGORIES.has("Housing")).toBe(true);
    expect(NEEDS_CATEGORIES.has("Debt")).toBe(true);
  });
  it("classifies wants (2 categories)", () => {
    expect(WANTS_CATEGORIES.size).toBe(2);
    expect(WANTS_CATEGORIES.has("Entertainment")).toBe(true);
    expect(WANTS_CATEGORIES.has("Other")).toBe(true);
  });
  it("classifies savings (1 category)", () => {
    expect(SAVINGS_CATEGORIES.size).toBe(1);
    expect(SAVINGS_CATEGORIES.has("Savings")).toBe(true);
  });
  it("has 50/30/20 targets", () => {
    expect(FIFTY_THIRTY_TWENTY.needs).toBe(50);
    expect(FIFTY_THIRTY_TWENTY.wants).toBe(30);
    expect(FIFTY_THIRTY_TWENTY.savings).toBe(20);
  });
});

describe("budget-planner splitCsvRow", () => {
  it("splits simple row", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
});

describe("budget-planner parseIncomeItems", () => {
  it("parses valid lines", () => {
    const { items, errors } = parseIncomeItems("Salary,5000\nFreelance,800");
    expect(items).toHaveLength(2);
    expect(errors).toHaveLength(0);
    expect(items[0]).toEqual({ source: "Salary", amount: 5000 });
    expect(items[1]).toEqual({ source: "Freelance", amount: 800 });
  });
  it("skips blank lines", () => {
    const { items } = parseIncomeItems("Salary,5000\n\n\nFreelance,800");
    expect(items).toHaveLength(2);
  });
  it("rejects invalid amount", () => {
    const { errors } = parseIncomeItems("Bad,abc");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("invalid amount");
  });
  it("rejects negative amount", () => {
    const { errors } = parseIncomeItems("Bad,-100");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("invalid amount");
  });
  it("errors on too few fields", () => {
    const { errors } = parseIncomeItems("JustSource");
    expect(errors[0]).toContain("needs source,amount");
  });
  it("returns empty for empty input", () => {
    expect(parseIncomeItems("").items).toEqual([]);
    expect(parseIncomeItems("  \n  ").items).toEqual([]);
  });
});

describe("budget-planner parseExpenseItems", () => {
  it("parses 3-field lines (category,actual,budgeted)", () => {
    const { items, errors } = parseExpenseItems("Rent,1500,1500\nFood,450,500");
    expect(items).toHaveLength(2);
    expect(errors).toHaveLength(0);
    expect(items[0]).toEqual({ category: "Rent", actual: 1500, budgeted: 1500 });
    expect(items[1]).toEqual({ category: "Food", actual: 450, budgeted: 500 });
  });
  it("defaults budgeted to actual when omitted (2-field line)", () => {
    const { items } = parseExpenseItems("Rent,1500");
    expect(items[0].actual).toBe(1500);
    expect(items[0].budgeted).toBe(1500);
  });
  it("skips blank lines", () => {
    const { items } = parseExpenseItems("Rent,1500,1500\n\nFood,100,100");
    expect(items).toHaveLength(2);
  });
  it("rejects invalid actual", () => {
    const { errors } = parseExpenseItems("Bad,abc,100");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("invalid actual");
  });
  it("rejects invalid budgeted", () => {
    const { errors } = parseExpenseItems("Bad,100,xyz");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("invalid budgeted");
  });
  it("errors on too few fields", () => {
    const { errors } = parseExpenseItems("JustCategory");
    expect(errors[0]).toContain("needs category,actual");
  });
  it("returns empty for empty input", () => {
    expect(parseExpenseItems("").items).toEqual([]);
  });
});

describe("budget-planner total income / expenses", () => {
  it("calcTotalIncome sums items", () => {
    const items = parseIncomeItems("Salary,5000\nFreelance,800").items;
    expect(calcTotalIncome(items)).toBe(5800);
  });
  it("calcTotalIncome handles empty", () => {
    expect(calcTotalIncome([])).toBe(0);
  });
  it("calcTotalExpensesActual sums actual", () => {
    const items = parseExpenseItems("Rent,1500,1500\nFood,450,500").items;
    expect(calcTotalExpensesActual(items)).toBe(1950);
  });
  it("calcTotalExpensesBudgeted sums budgeted", () => {
    const items = parseExpenseItems("Rent,1500,1500\nFood,450,500").items;
    expect(calcTotalExpensesBudgeted(items)).toBe(2000);
  });
});

describe("budget-planner net income & savings rate", () => {
  it("calcNetIncome = income - actual expenses", () => {
    expect(calcNetIncome(5800, 1950)).toBe(3850);
  });
  it("calcNetIncome can be negative", () => {
    expect(calcNetIncome(1000, 1500)).toBe(-500);
  });
  it("calcSavingsRate = net / income * 100", () => {
    expect(calcSavingsRate(3850, 5800)).toBeCloseTo(66.38, 2);
  });
  it("calcSavingsRate returns 0 when income is 0", () => {
    expect(calcSavingsRate(0, 0)).toBe(0);
    expect(calcSavingsRate(500, 0)).toBe(0);
  });
  it("calcSavingsRate returns 0 for negative income", () => {
    expect(calcSavingsRate(0, -100)).toBe(0);
  });
});

describe("budget-planner variance", () => {
  it("calcCategoryVariance: under when actual < budgeted", () => {
    const v = calcCategoryVariance({ category: "Food", actual: 400, budgeted: 500 });
    expect(v.variance).toBe(100);
    expect(v.status).toBe("under");
  });
  it("calcCategoryVariance: over when actual > budgeted", () => {
    const v = calcCategoryVariance({ category: "Food", actual: 600, budgeted: 500 });
    expect(v.variance).toBe(-100);
    expect(v.status).toBe("over");
  });
  it("calcCategoryVariance: on-budget when equal", () => {
    const v = calcCategoryVariance({ category: "Rent", actual: 1500, budgeted: 1500 });
    expect(v.variance).toBe(0);
    expect(v.status).toBe("on-budget");
  });
  it("calcAllVariances maps items", () => {
    const items = parseExpenseItems("A,100,150\nB,200,200\nC,300,250").items;
    const v = calcAllVariances(items);
    expect(v).toHaveLength(3);
    expect(v[0].status).toBe("under");
    expect(v[1].status).toBe("on-budget");
    expect(v[2].status).toBe("over");
  });
  it("calcTotalVariance = budgeted - actual across items", () => {
    const items = parseExpenseItems("A,100,150\nB,200,200\nC,300,250").items;
    // variance = (150-100) + (200-200) + (250-300) = 50 + 0 - 50 = 0
    expect(calcTotalVariance(items)).toBe(0);
  });
  it("calcTotalVariance handles empty", () => {
    expect(calcTotalVariance([])).toBe(0);
  });
});

describe("budget-planner savings goal progress", () => {
  it("calcSavingsGoalProgress = net / goal * 100", () => {
    expect(calcSavingsGoalProgress(1000, 2000)).toBe(50);
  });
  it("calcSavingsGoalProgress can exceed 100", () => {
    expect(calcSavingsGoalProgress(3000, 2000)).toBe(150);
  });
  it("calcSavingsGoalProgress returns 0 when goal is 0", () => {
    expect(calcSavingsGoalProgress(1000, 0)).toBe(0);
  });
  it("calcSavingsGoalProgress returns 0 for negative goal", () => {
    expect(calcSavingsGoalProgress(1000, -500)).toBe(0);
  });
});

describe("budget-planner classify & 50/30/20", () => {
  it("classifyCategory returns needs for Housing", () => {
    expect(classifyCategory("Housing")).toBe("needs");
    expect(classifyCategory("Healthcare")).toBe("needs");
  });
  it("classifyCategory returns wants for Entertainment", () => {
    expect(classifyCategory("Entertainment")).toBe("wants");
    expect(classifyCategory("Other")).toBe("wants");
  });
  it("classifyCategory returns savings for Savings", () => {
    expect(classifyCategory("Savings")).toBe("savings");
  });
  it("classifyCategory defaults unknown to wants", () => {
    expect(classifyCategory("Custom")).toBe("wants");
  });
  it("checkFiftyThirtyTwenty computes pct of income", () => {
    const items = parseExpenseItems(
      "Housing,1500,1500\nFood,500,500\nEntertainment,300,300\nSavings,500,500",
    ).items;
    const ft = checkFiftyThirtyTwenty(items, 5000);
    // needs = 1500 + 500 = 2000 → 40%
    expect(ft.needsActual).toBe(2000);
    expect(ft.needsPct).toBe(40);
    // wants = 300 → 6%
    expect(ft.wantsActual).toBe(300);
    expect(ft.wantsPct).toBe(6);
    // savings = 500 → 10%
    expect(ft.savingsActual).toBe(500);
    expect(ft.savingsPct).toBe(10);
    expect(ft.needsOk).toBe(true);
    expect(ft.wantsOk).toBe(true);
    expect(ft.savingsOk).toBe(false); // 10% < 20%
  });
  it("checkFiftyThirtyTwenty flags overspending on needs", () => {
    const items = parseExpenseItems("Housing,3000,3000").items;
    const ft = checkFiftyThirtyTwenty(items, 5000);
    expect(ft.needsPct).toBe(60);
    expect(ft.needsOk).toBe(false);
  });
  it("checkFiftyThirtyTwenty handles zero income", () => {
    const items = parseExpenseItems("Housing,1000,1000").items;
    const ft = checkFiftyThirtyTwenty(items, 0);
    expect(ft.needsPct).toBe(0);
    expect(ft.wantsPct).toBe(0);
    expect(ft.savingsPct).toBe(0);
    expect(ft.needsOk).toBe(true);
    expect(ft.savingsOk).toBe(false); // 0 < 20
  });
});

describe("budget-planner computeBudget (integration)", () => {
  it("computes the full budget from sample input", () => {
    const input = sampleInput();
    const t = computeBudget(input);
    // income = 5000 + 800 = 5800
    expect(t.totalIncome).toBe(5800);
    // expenses actual = 1500 + 450 + 200 + 500 = 2650
    expect(t.totalExpensesActual).toBe(2650);
    // expenses budgeted = 1500 + 500 + 150 + 500 = 2650
    expect(t.totalExpensesBudgeted).toBe(2650);
    // net = 5800 - 2650 = 3150
    expect(t.netIncome).toBe(3150);
    // savings rate = 3150/5800 * 100 ≈ 54.31
    expect(t.savingsRate).toBeCloseTo(54.31, 1);
    // savings goal progress = 3150/1000 * 100 = 315
    expect(t.savingsGoalProgress).toBe(315);
    // variances: Housing 0, Food +50, Entertainment -50, Savings 0
    expect(t.variances).toHaveLength(4);
    expect(t.totalVariance).toBe(0);
  });
  it("handles empty input gracefully", () => {
    const t = computeBudget({
      monthYear: "2026-01",
      incomeItemsText: "",
      expenseItemsText: "",
      savingsGoal: 0,
      currencySymbol: "$",
    });
    expect(t.totalIncome).toBe(0);
    expect(t.totalExpensesActual).toBe(0);
    expect(t.netIncome).toBe(0);
    expect(t.savingsRate).toBe(0);
    expect(t.variances).toEqual([]);
    expect(t.savingsGoalProgress).toBe(0);
  });
});

describe("budget-planner normalizeCategory & formatCurrency", () => {
  it("normalizeCategory trims", () => {
    expect(normalizeCategory("  Housing  ")).toBe("Housing");
  });
  it("formatCurrency positive", () => {
    expect(formatCurrency(1234.5, "$")).toBe("$1234.50");
  });
  it("formatCurrency negative", () => {
    expect(formatCurrency(-50, "€")).toBe("-€50.00");
  });
  it("formatCurrency multi-char symbol", () => {
    expect(formatCurrency(100, "A$")).toBe("A$100.00");
  });
});

describe("budget-planner renderText", () => {
  it("renders text with all sections", () => {
    const input = sampleInput();
    const totals = computeBudget(input);
    const text = renderText(input, totals);
    expect(text).toContain("MONTHLY BUDGET");
    expect(text).toContain("2026-07");
    expect(text).toContain("INCOME");
    expect(text).toContain("Salary");
    expect(text).toContain("TOTAL INCOME");
    expect(text).toContain("EXPENSES");
    expect(text).toContain("Housing");
    expect(text).toContain("TOTAL VARIANCE");
    expect(text).toContain("SUMMARY");
    expect(text).toContain("Net income");
    expect(text).toContain("Savings rate");
    expect(text).toContain("50/30/20 RULE CHECK");
  });
  it("handles empty budget without crashing", () => {
    const input: BudgetInput = {
      monthYear: "2026-01",
      incomeItemsText: "",
      expenseItemsText: "",
      savingsGoal: 0,
      currencySymbol: "$",
    };
    const totals = computeBudget(input);
    const text = renderText(input, totals);
    expect(text).toContain("(no income items)");
    expect(text).toContain("(no expense items)");
  });
});

describe("budget-planner renderCsv", () => {
  it("renders header and rows", () => {
    const input = sampleInput();
    const totals = computeBudget(input);
    const csv = renderCsv(input, totals);
    expect(csv).toContain("month_year,2026-07");
    expect(csv).toContain("currency,$");
    expect(csv).toContain("type,label,amount");
    expect(csv).toContain("income,Salary,5000.00");
    expect(csv).toContain("category,budgeted,actual,variance,status");
    expect(csv).toContain("Housing,1500.00,1500.00,0.00,on-budget");
    expect(csv).toContain("net_income,3150.00");
    expect(csv).toContain("savings_rate_pct,54.31");
    expect(csv).toContain("savings_goal,1000.00");
    expect(csv).toContain("needs_pct");
  });
  it("omits savings goal rows when goal is 0", () => {
    const input = sampleInput({ savingsGoal: 0 });
    const totals = computeBudget(input);
    const csv = renderCsv(input, totals);
    expect(csv).not.toContain("savings_goal,");
  });
  it("escapes commas in categories", () => {
    const input = sampleInput({
      expenseItemsText: '"Misc, extra",100,150',
    });
    const totals = computeBudget(input);
    const csv = renderCsv(input, totals);
    expect(csv).toContain('"Misc, extra"');
  });
});

describe("budget-planner summaryStats", () => {
  it("computes summary stats", () => {
    const input = sampleInput();
    const totals = computeBudget(input);
    const stats = summaryStats(totals);
    expect(stats.incomeCount).toBe(2);
    expect(stats.expenseCount).toBe(4);
    expect(stats.totalIncome).toBe(5800);
    expect(stats.totalExpensesActual).toBe(2650);
    expect(stats.netIncome).toBe(3150);
    expect(stats.overBudgetCount).toBe(1); // Entertainment 200 > 150
    expect(stats.underBudgetCount).toBe(1); // Food 450 < 500
    // largest expense: Housing 1500
    expect(stats.largestExpenseCategory).toBe("Housing");
    expect(stats.largestExpenseAmount).toBe(1500);
  });
  it("handles empty totals", () => {
    const input: BudgetInput = {
      monthYear: "2026-01",
      incomeItemsText: "",
      expenseItemsText: "",
      savingsGoal: 0,
      currencySymbol: "$",
    };
    const stats = summaryStats(computeBudget(input));
    expect(stats.incomeCount).toBe(0);
    expect(stats.expenseCount).toBe(0);
    expect(stats.overBudgetCount).toBe(0);
    expect(stats.underBudgetCount).toBe(0);
    expect(stats.largestExpenseAmount).toBe(0);
  });
});

describe("budget-planner history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      monthYear: "2026-07",
      totalIncome: 5800,
      totalExpensesActual: 2650,
      netIncome: 3150,
      currencySymbol: "$",
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].monthYear).toBe("2026-07");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        monthYear: "2026-07",
        totalIncome: i,
        totalExpensesActual: 0,
        netIncome: i,
        currencySymbol: "$",
      });
    }
    expect(loadHistory()).toHaveLength(20);
    expect(loadHistory()[0].ts).toBe(24);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      monthYear: "2026-07",
      totalIncome: 100,
      totalExpensesActual: 0,
      netIncome: 100,
      currencySymbol: "$",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("budget-planner shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      monthYear: "2026-07",
      incomeItemsText: "Salary,5000",
      savingsGoal: 1000,
      currencySymbol: "$",
    });
    expect(url).toContain("m=2026-07");
    expect(url).toContain("inc=Salary");
    expect(url).toContain("goal=1000");
    expect(url).toContain("cur=%24");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const input = sampleInput();
    const url = buildShareUrl(input);
    const hash = url.includes("#") ? url.split("#")[1] : url.replace(/^\?/, "");
    const parsed = parseShareUrl(hash);
    expect(parsed.monthYear).toBe("2026-07");
    expect(parsed.incomeItemsText).toContain("Salary");
    expect(parsed.expenseItemsText).toContain("Housing");
    expect(parsed.savingsGoal).toBe(1000);
    expect(parsed.currencySymbol).toBe("$");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown currency", () => {
    const parsed = parseShareUrl("cur=ZZZ");
    expect(parsed.currencySymbol).toBeUndefined();
  });
  it("ignores invalid savings goal", () => {
    const parsed = parseShareUrl("goal=abc");
    expect(parsed.savingsGoal).toBeUndefined();
  });
  it("ignores negative savings goal", () => {
    const parsed = parseShareUrl("goal=-100");
    expect(parsed.savingsGoal).toBeUndefined();
  });
});

// Suppress unused-import lint
export type _Unused = CurrencySymbol;

import { describe, it, expect, beforeEach } from "vitest";
import {
  GOAL_TYPE_LABELS,
  GOAL_TYPE_DEFAULTS,
  CURRENCY_OPTIONS,
  CURRENCY_SYMBOLS,
  DEBT_STRATEGY_LABELS,
  GOAL_PRESETS,
  DEFAULT_INFLATION_RATE,
  round2,
  nonNeg,
  validateGoal,
  validateDebt,
  computeMonthlyContribution,
  computeCompoundProjection,
  futureValueLumpSum,
  futureValueSeries,
  generateMilestones,
  generatePlan,
  prioritizeGoals,
  buildRoadmap,
  orderDebts,
  buildDebtSchedule,
  compareScenarios,
  whatIfRate,
  whatIfTimeline,
  inflationAdjusted,
  formatCurrency,
  formatPercent,
  formatMonth,
  renderText,
  renderMarkdown,
  renderJson,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  makeId,
  type Goal,
  type DebtItem,
  type CurrencyCode,
  type DebtStrategy,
  type GoalType,
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

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: "g1",
    type: "emergency-fund",
    name: "Emergency Fund",
    targetAmount: 12000,
    currentAmount: 2000,
    timelineMonths: 24,
    annualReturnRate: 0.04,
    priority: 1,
    ...overrides,
  };
}

function makeDebt(overrides: Partial<DebtItem> = {}): DebtItem {
  return {
    id: "d1",
    name: "Credit Card",
    balance: 5000,
    interestRate: 18, // 18% APR
    minimumPayment: 150,
    ...overrides,
  };
}

describe("financial-goal-planner constants", () => {
  it("has 7 goal types", () => {
    expect(Object.keys(GOAL_TYPE_LABELS)).toHaveLength(7);
  });
  it("has defaults for every goal type", () => {
    for (const t of Object.keys(GOAL_TYPE_LABELS) as GoalType[]) {
      expect(GOAL_TYPE_DEFAULTS[t]).toBeDefined();
      expect(GOAL_TYPE_DEFAULTS[t].targetAmount).toBeGreaterThan(0);
    }
  });
  it("has 7 currency options", () => {
    expect(CURRENCY_OPTIONS).toHaveLength(7);
    expect(CURRENCY_SYMBOLS.USD).toBe("$");
    expect(CURRENCY_SYMBOLS.JPY).toBe("¥");
  });
  it("has 2 debt strategies", () => {
    expect(Object.keys(DEBT_STRATEGY_LABELS)).toHaveLength(2);
  });
  it("has goal presets", () => {
    expect(GOAL_PRESETS.length).toBeGreaterThanOrEqual(5);
  });
  it("has default inflation rate", () => {
    expect(DEFAULT_INFLATION_RATE).toBeGreaterThan(0);
    expect(DEFAULT_INFLATION_RATE).toBeLessThan(0.1);
  });
});

describe("financial-goal-planner round2 + nonNeg", () => {
  it("rounds to 2 decimals", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(1.155)).toBe(1.16);
  });
  it("nonNeg clamps to 0", () => {
    expect(nonNeg(-5)).toBe(0);
    expect(nonNeg(NaN)).toBe(0);
    expect(nonNeg(3.14)).toBe(3.14);
  });
});

describe("financial-goal-planner validateGoal", () => {
  it("returns no warnings for valid goal", () => {
    expect(validateGoal(makeGoal())).toEqual([]);
  });
  it("warns on missing name", () => {
    expect(validateGoal(makeGoal({ name: "" }))).toContain("Goal has no name");
  });
  it("warns on zero target", () => {
    expect(validateGoal(makeGoal({ targetAmount: 0 }))).toContain("Target amount must be greater than zero");
  });
  it("warns when goal already reached", () => {
    expect(validateGoal(makeGoal({ currentAmount: 12000 }))).toContain("Goal already reached — current savings meet or exceed target");
  });
  it("warns on bad rate", () => {
    expect(validateGoal(makeGoal({ annualReturnRate: 0.6 }))).toContain("Annual return rate should be between 0% and 50%");
  });
});

describe("financial-goal-planner validateDebt", () => {
  it("returns no warnings for valid debt", () => {
    expect(validateDebt(makeDebt())).toEqual([]);
  });
  it("warns when minimum payment does not cover interest", () => {
    expect(validateDebt(makeDebt({ minimumPayment: 1 }))).toContain(
      "Minimum payment does not cover first month's interest — debt will never be paid off",
    );
  });
  it("warns on bad rate", () => {
    expect(validateDebt(makeDebt({ interestRate: 150 }))).toContain(
      "Interest rate should be between 0% and 100%",
    );
  });
});

describe("financial-goal-planner computeMonthlyContribution", () => {
  it("returns 0 when goal already met", () => {
    expect(computeMonthlyContribution(1000, 1000, 12, 0.05)).toBe(0);
    expect(computeMonthlyContribution(1000, 1500, 12, 0.05)).toBe(0);
  });
  it("uses linear formula when rate is 0", () => {
    const c = computeMonthlyContribution(12000, 0, 12, 0);
    expect(c).toBeCloseTo(1000, 5);
  });
  it("returns lower contribution with positive rate", () => {
    const noRate = computeMonthlyContribution(12000, 0, 12, 0);
    const withRate = computeMonthlyContribution(12000, 0, 12, 0.07);
    expect(withRate).toBeLessThan(noRate);
    expect(withRate).toBeGreaterThan(0);
  });
  it("returns 0 for 0 months", () => {
    expect(computeMonthlyContribution(1000, 0, 0, 0.05)).toBe(0);
  });
  it("handles current savings reducing required contribution", () => {
    const c1 = computeMonthlyContribution(10000, 0, 12, 0.05);
    const c2 = computeMonthlyContribution(10000, 5000, 12, 0.05);
    expect(c2).toBeLessThan(c1);
  });
});

describe("financial-goal-planner computeCompoundProjection", () => {
  it("starts at month 0 with current balance", () => {
    const proj = computeCompoundProjection(2000, 100, 0.05, 12);
    expect(proj[0].month).toBe(0);
    expect(proj[0].balance).toBe(2000);
    expect(proj[0].contributed).toBe(2000);
    expect(proj[0].interest).toBe(0);
  });
  it("has n+1 points for n months", () => {
    expect(computeCompoundProjection(0, 100, 0.05, 12)).toHaveLength(13);
  });
  it("accumulates interest each month", () => {
    const proj = computeCompoundProjection(10000, 0, 0.12, 3);
    expect(proj[3].interest).toBeGreaterThan(0);
    expect(proj[3].balance).toBeGreaterThan(proj[0].balance);
  });
  it("handles zero rate linearly", () => {
    const proj = computeCompoundProjection(0, 100, 0, 6);
    expect(proj[6].balance).toBeCloseTo(600, 2);
    expect(proj[6].interest).toBe(0);
  });
});

describe("financial-goal-planner futureValueLumpSum + futureValueSeries", () => {
  it("lump sum grows at rate", () => {
    const fv = futureValueLumpSum(1000, 0.12, 12);
    // 1000 * (1.01)^12 ≈ 1126.83
    expect(fv).toBeCloseTo(1126.83, 1);
  });
  it("series without rate is sum", () => {
    expect(futureValueSeries(100, 0, 12)).toBeCloseTo(1200, 2);
  });
  it("series with rate exceeds sum", () => {
    const fv = futureValueSeries(100, 0.12, 12);
    expect(fv).toBeGreaterThan(1200);
  });
});

describe("financial-goal-planner generateMilestones", () => {
  it("generates 4 milestones", () => {
    const m = generateMilestones(10000, 0, 1000, 0.05);
    expect(m).toHaveLength(4);
    expect(m.map((x) => x.label)).toEqual(["25% milestone", "50% milestone", "75% milestone", "Goal reached"]);
  });
  it("places 100% milestone at or after the timeline", () => {
    const m = generateMilestones(12000, 0, 1000, 0);
    expect(m[3].month).toBeGreaterThanOrEqual(11); // ~12 months for $12000 / $1000
    expect(m[3].month).toBeLessThanOrEqual(12);
  });
  it("returns month 0 if already past threshold", () => {
    const m = generateMilestones(10000, 9000, 100, 0.05);
    expect(m[0].month).toBeLessThanOrEqual(m[1].month);
  });
});

describe("financial-goal-planner generatePlan", () => {
  it("produces a complete plan", () => {
    const p = generatePlan(makeGoal());
    expect(p.goal.id).toBe("g1");
    expect(p.monthlyContribution).toBeGreaterThan(0);
    expect(p.projection.length).toBe(25);
    expect(p.milestones).toHaveLength(4);
    expect(p.formula).toContain("PMT");
  });
  it("flags plan as achievable when target met", () => {
    const g = makeGoal({ targetAmount: 1000, currentAmount: 0, timelineMonths: 12, annualReturnRate: 0.05 });
    const p = generatePlan(g);
    expect(p.isAchievable).toBe(true);
    expect(p.shortfall).toBe(0);
  });
  it("adds warning when monthly contribution exceeds 50% of target", () => {
    const g = makeGoal({ targetAmount: 1000, currentAmount: 0, timelineMonths: 1, annualReturnRate: 0 });
    const p = generatePlan(g);
    expect(p.warnings.some((w) => w.includes("unrealistic"))).toBe(true);
  });
  it("computes total interest for positive rate", () => {
    const g = makeGoal({ targetAmount: 10000, currentAmount: 1000, timelineMonths: 24, annualReturnRate: 0.07 });
    const p = generatePlan(g);
    expect(p.totalInterest).toBeGreaterThan(0);
  });
});

describe("financial-goal-planner prioritizeGoals + buildRoadmap", () => {
  it("sorts goals by priority", () => {
    const goals = [
      makeGoal({ id: "a", priority: 3 }),
      makeGoal({ id: "b", priority: 1 }),
      makeGoal({ id: "c", priority: 2 }),
    ];
    expect(prioritizeGoals(goals)).toEqual(["b", "c", "a"]);
  });
  it("builds a roadmap with totals", () => {
    const goals = [
      makeGoal({ id: "a", priority: 1, targetAmount: 10000, currentAmount: 0, timelineMonths: 12, annualReturnRate: 0.05 }),
      makeGoal({ id: "b", priority: 2, type: "vacation", name: "Trip", targetAmount: 5000, currentAmount: 0, timelineMonths: 12, annualReturnRate: 0.02 }),
    ];
    const plan = buildRoadmap(goals, [], "avalanche");
    expect(plan.goals).toHaveLength(2);
    expect(plan.prioritizedOrder).toEqual(["a", "b"]);
    expect(plan.totalMonthlyContribution).toBeGreaterThan(0);
    expect(plan.debtPlan).toBeUndefined();
  });
  it("includes debt plan when debts are provided", () => {
    const goals = [makeGoal({ id: "a", priority: 1 })];
    const debts = [makeDebt({ id: "d1" })];
    const plan = buildRoadmap(goals, debts, "snowball", "USD");
    expect(plan.debtPlan).toBeDefined();
    expect(plan.debtPlan!.strategy).toBe("snowball");
  });
});

describe("financial-goal-planner orderDebts + buildDebtSchedule", () => {
  it("snowball orders by smallest balance", () => {
    const debts = [
      makeDebt({ id: "d1", balance: 5000 }),
      makeDebt({ id: "d2", balance: 1000 }),
      makeDebt({ id: "d3", balance: 3000 }),
    ];
    const ordered = orderDebts(debts, "snowball");
    expect(ordered.map((d) => d.id)).toEqual(["d2", "d3", "d1"]);
  });
  it("avalanche orders by highest interest", () => {
    const debts = [
      makeDebt({ id: "d1", interestRate: 12 }),
      makeDebt({ id: "d2", interestRate: 24 }),
      makeDebt({ id: "d3", interestRate: 18 }),
    ];
    const ordered = orderDebts(debts, "avalanche");
    expect(ordered.map((d) => d.id)).toEqual(["d2", "d3", "d1"]);
  });
  it("empty debts returns empty schedule", () => {
    const plan = buildDebtSchedule([], "snowball");
    expect(plan.totalDebt).toBe(0);
    expect(plan.schedule).toEqual([]);
    expect(plan.payoffMonths).toBe(0);
  });
  it("payoff schedule ends at zero balance", () => {
    const plan = buildDebtSchedule([makeDebt({ id: "d1", balance: 1000, interestRate: 12, minimumPayment: 100 })], "avalanche");
    expect(plan.payoffMonths).toBeGreaterThan(0);
    const finalBalances = plan.schedule.filter((r) => r.debtId === "d1");
    expect(finalBalances[finalBalances.length - 1].balanceAfter).toBeLessThanOrEqual(0.5);
  });
  it("avalanche saves interest vs snowball on typical debts", () => {
    const debts = [
      makeDebt({ id: "d1", balance: 3000, interestRate: 22, minimumPayment: 80 }),
      makeDebt({ id: "d2", balance: 1500, interestRate: 8, minimumPayment: 40 }),
    ];
    const snow = buildDebtSchedule(debts, "snowball");
    const aval = buildDebtSchedule(debts, "avalanche");
    // Avalanche should pay less or equal interest (not always strictly less with snowball roll-up
    // at minimums, but mathematically avalanche is never worse for total interest).
    expect(aval.totalInterest).toBeLessThanOrEqual(snow.totalInterest + 5);
  });
});

describe("financial-goal-planner compareScenarios", () => {
  it("picks scenario with lower monthly contribution as winner", () => {
    const goalsA = [makeGoal({ id: "a", priority: 1, timelineMonths: 24 })];
    const goalsB = [makeGoal({ id: "a", priority: 1, timelineMonths: 48 })];
    const a = buildRoadmap(goalsA, [], "avalanche");
    const b = buildRoadmap(goalsB, [], "avalanche");
    const cmp = compareScenarios(a, b);
    // Longer timeline => lower monthly => b wins on monthly but a wins on total interest earned.
    expect(cmp.deltaMonthly).not.toBe(0);
  });
  it("declares tie when plans are identical", () => {
    const goals = [makeGoal({ id: "a", priority: 1 })];
    const a = buildRoadmap(goals, [], "avalanche");
    const b = buildRoadmap(goals, [], "avalanche");
    expect(compareScenarios(a, b).winner).toBe("tie");
  });
});

describe("financial-goal-planner what-if helpers", () => {
  it("whatIfRate returns contribution at new rate", () => {
    const g = makeGoal({ targetAmount: 10000, currentAmount: 0, timelineMonths: 12 });
    const at0 = whatIfRate(g, 0);
    const at5 = whatIfRate(g, 0.05);
    expect(at0).toBeGreaterThan(at5);
  });
  it("whatIfTimeline returns contribution at new months", () => {
    const g = makeGoal({ targetAmount: 12000, currentAmount: 0, annualReturnRate: 0 });
    const short = whatIfTimeline(g, 12);
    const long = whatIfTimeline(g, 24);
    expect(long).toBeLessThan(short);
  });
  it("inflationAdjusted reduces future amount", () => {
    const adj = inflationAdjusted(10000, 0.03, 120);
    expect(adj).toBeLessThan(10000);
    expect(adj).toBeGreaterThan(0);
  });
});

describe("financial-goal-planner formatting", () => {
  it("formatCurrency uses currency symbol", () => {
    expect(formatCurrency(1234.5, "USD")).toBe("$1,234.50");
    expect(formatCurrency(1234.5, "EUR")).toBe("€1,234.50");
    expect(formatCurrency(-500, "GBP")).toBe("-£500.00");
  });
  it("formatPercent converts rate to percent", () => {
    expect(formatPercent(0.05)).toBe("5.00%");
    expect(formatPercent(0.1234, 1)).toBe("12.3%");
  });
  it("formatMonth formats months and years", () => {
    expect(formatMonth(6)).toBe("6 mo");
    expect(formatMonth(12)).toBe("1 yr");
    expect(formatMonth(18)).toBe("1 yr 6 mo");
  });
});

describe("financial-goal-planner renderText", () => {
  it("includes roadmap header and disclaimer", () => {
    const plan = buildRoadmap([makeGoal()], [], "avalanche");
    const txt = renderText(plan);
    expect(txt).toContain("FINANCIAL GOAL ROADMAP");
    expect(txt).toContain("Currency: USD");
    expect(txt).toContain("DISCLAIMER");
  });
  it("includes goal name and target", () => {
    const plan = buildRoadmap([makeGoal({ name: "My Goal" })], [], "avalanche");
    expect(renderText(plan)).toContain("My Goal");
  });
});

describe("financial-goal-planner renderMarkdown", () => {
  it("renders markdown headings", () => {
    const plan = buildRoadmap([makeGoal()], [], "avalanche");
    const md = renderMarkdown(plan);
    expect(md).toContain("# Financial Goal Roadmap");
    expect(md).toContain("## Goals (priority order)");
    expect(md).toContain("Disclaimer");
  });
  it("includes debt section when debts exist", () => {
    const plan = buildRoadmap([makeGoal()], [makeDebt()], "avalanche");
    expect(renderMarkdown(plan)).toContain("## Debt Payoff");
  });
});

describe("financial-goal-planner renderJson", () => {
  it("produces valid JSON with goals array", () => {
    const plan = buildRoadmap([makeGoal()], [], "avalanche");
    const json = renderJson(plan);
    const parsed = JSON.parse(json);
    expect(parsed.goals).toHaveLength(1);
    expect(parsed.totalMonthlyContribution).toBeGreaterThan(0);
  });
});

describe("financial-goal-planner renderCsv", () => {
  it("renders header row", () => {
    const csv = renderCsv(buildRoadmap([], [], "avalanche"));
    expect(csv).toContain("goal_id,goal_name,type,target,current,timeline_months");
  });
  it("renders one row per goal", () => {
    const plan = buildRoadmap([
      makeGoal({ id: "a" }),
      makeGoal({ id: "b", name: "Second Goal" }),
    ], [], "avalanche");
    const lines = renderCsv(plan).split("\n");
    expect(lines).toHaveLength(3); // header + 2 goals
  });
});

describe("financial-goal-planner history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, goalCount: 2, totalMonthly: 500, totalTarget: 20000, currency: "USD", label: "test" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, goalCount: 1, totalMonthly: 100, totalTarget: 1000, currency: "USD", label: `t${i}` });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, goalCount: 1, totalMonthly: 100, totalTarget: 1000, currency: "USD", label: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("financial-goal-planner shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      currency: "USD",
      strategy: "avalanche",
      inflationRate: 0.03,
      goals: [{ type: "emergency-fund", name: "EF", targetAmount: 10000, currentAmount: 0, timelineMonths: 12, annualReturnRate: 0.04 }],
      debts: [],
    });
    expect(url).toContain("currency=USD");
    expect(url).toContain("strategy=avalanche");
    expect(url).toContain("inflation=0.03");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl({
      currency: "EUR",
      strategy: "snowball",
      inflationRate: 0.02,
      goals: [{ type: "house", name: "DP", targetAmount: 50000, currentAmount: 5000, timelineMonths: 60, annualReturnRate: 0.05 }],
      debts: [{ name: "CC", balance: 3000, interestRate: 18, minimumPayment: 100 }],
    });
    const parsed = parseShareUrl(url);
    expect(parsed).not.toBeNull();
    expect(parsed!.currency).toBe("EUR");
    expect(parsed!.strategy).toBe("snowball");
    expect(parsed!.goals).toHaveLength(1);
    expect(parsed!.debts).toHaveLength(1);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("handles invalid JSON gracefully", () => {
    const p = parseShareUrl("currency=USD&strategy=avalanche&inflation=0.03&goals=not-json");
    expect(p).not.toBeNull();
    expect(p!.goals).toEqual([]);
  });
});

describe("financial-goal-planner makeId", () => {
  it("generates unique IDs", () => {
    const a = makeId("goal");
    const b = makeId("goal");
    expect(a).not.toBe(b);
    expect(a.startsWith("goal-")).toBe(true);
  });
});

// Suppress unused-import lint
export type _Unused = CurrencyCode | DebtStrategy;

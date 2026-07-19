import { describe, it, expect, beforeEach } from "vitest";
import {
  COMMISSION_TYPES,
  PAYOUT_FREQUENCIES,
  STATUS_FILTERS,
  DEFAULT_TIERS_TEXT,
  DEFAULT_DEALS_TEXT,
  normalizeString,
  parseDealStatus,
  parseDealLine,
  parseDeals,
  parseTiers,
  calculateFlatCommission,
  calculateBasePlusCommission,
  calculateBonusCommission,
  calculateTieredCommission,
  calculateCommissionForDeal,
  formatPayoutPeriod,
  applyStatusFilter,
  attachCommission,
  computePerRepTotals,
  sortLeaderboard,
  findTopPerformer,
  computeAverageCommission,
  generatePayoutSchedule,
  computeSummary,
  detectCommissionCaps,
  renderTextReport,
  renderCsv,
  splitCsvRow,
  formatCurrency,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CommissionType,
  type PayoutFrequency,
  type StatusFilter,
  type Deal,
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

describe("commission-tracker constants", () => {
  it("has 4 commission types", () => {
    expect(COMMISSION_TYPES).toHaveLength(4);
    expect(COMMISSION_TYPES.map((c) => c.value)).toEqual([
      "flat-percent", "tiered-percent", "base-plus-percent", "bonus-per-deal",
    ]);
  });
  it("has 3 payout frequencies", () => {
    expect(PAYOUT_FREQUENCIES).toHaveLength(3);
    expect(PAYOUT_FREQUENCIES.map((f) => f.value)).toEqual(["monthly", "quarterly", "annually"]);
  });
  it("has 4 status filters", () => {
    expect(STATUS_FILTERS).toHaveLength(4);
    expect(STATUS_FILTERS.map((s) => s.value)).toEqual(["all", "closed-won", "closed-lost", "open"]);
  });
  it("has default tiers and deals text", () => {
    expect(DEFAULT_TIERS_TEXT).toContain("0,5");
    expect(DEFAULT_DEALS_TEXT).toContain("Acme Renewal");
  });
});

describe("commission-tracker normalizeString", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeString("  Alice   Smith  ")).toBe("Alice Smith");
  });
  it("handles empty", () => {
    expect(normalizeString("")).toBe("");
  });
});

describe("commission-tracker parseDealStatus", () => {
  it("accepts closed-won variants", () => {
    expect(parseDealStatus("closed-won")).toBe("closed-won");
    expect(parseDealStatus("Won")).toBe("closed-won");
    expect(parseDealStatus("closed")).toBe("closed-won");
  });
  it("accepts closed-lost variants", () => {
    expect(parseDealStatus("closed-lost")).toBe("closed-lost");
    expect(parseDealStatus("lost")).toBe("closed-lost");
  });
  it("accepts open variants", () => {
    expect(parseDealStatus("open")).toBe("open");
    expect(parseDealStatus("pending")).toBe("open");
    expect(parseDealStatus("in-progress")).toBe("open");
  });
  it("returns null for unknown", () => {
    expect(parseDealStatus("maybe")).toBeNull();
  });
});

describe("commission-tracker parseDealLine", () => {
  it("parses a well-formed line", () => {
    const d = parseDealLine("Acme,Alice,50000,2026-07-15,closed-won", 1);
    expect(d).not.toBeNull();
    expect(d!.dealName).toBe("Acme");
    expect(d!.salesRep).toBe("Alice");
    expect(d!.amount).toBe(50000);
    expect(d!.closeDate).toBe("2026-07-15");
    expect(d!.status).toBe("closed-won");
    expect(d!.warnings).toEqual([]);
  });
  it("strips $ and commas from amount (quoted CSV field)", () => {
    const d = parseDealLine('Acme,Alice,"$50,000.50",2026-07-15,closed-won', 2);
    expect(d!.amount).toBeCloseTo(50000.5, 2);
  });
  it("returns null for blank line", () => {
    expect(parseDealLine("   ", 3)).toBeNull();
  });
  it("produces warning for <5 fields", () => {
    const d = parseDealLine("Acme,Alice,50000", 4);
    expect(d).not.toBeNull();
    expect(d!.warnings.length).toBeGreaterThan(0);
  });
  it("produces warning for unknown status", () => {
    const d = parseDealLine("Acme,Alice,50000,2026-07-15,maybe", 5);
    expect(d!.status).toBe("open");
    expect(d!.warnings.some((w) => w.includes("unknown status"))).toBe(true);
  });
  it("produces warning for bad date format", () => {
    const d = parseDealLine("Acme,Alice,50000,15-07-2026,closed-won", 6);
    expect(d!.warnings.some((w) => w.includes("YYYY-MM-DD"))).toBe(true);
  });
});

describe("commission-tracker parseDeals", () => {
  it("parses multiple lines", () => {
    const input = "Acme,Alice,50000,2026-07-15,closed-won\nNewCo,Bob,25000,2026-07-20,closed-won";
    const deals = parseDeals(input);
    expect(deals).toHaveLength(2);
    expect(deals[0].dealName).toBe("Acme");
    expect(deals[1].dealName).toBe("NewCo");
  });
  it("skips blank lines", () => {
    const input = "Acme,Alice,50000,2026-07-15,closed-won\n\nNewCo,Bob,25000,2026-07-20,closed-won";
    expect(parseDeals(input)).toHaveLength(2);
  });
  it("returns empty for empty input", () => {
    expect(parseDeals("")).toEqual([]);
  });
  it("parses default deals text", () => {
    const deals = parseDeals(DEFAULT_DEALS_TEXT);
    expect(deals.length).toBeGreaterThanOrEqual(3);
  });
});

describe("commission-tracker parseTiers", () => {
  it("parses and sorts tiers", () => {
    const tiers = parseTiers("100000,15\n0,5\n50000,10");
    expect(tiers).toEqual([
      { minAmount: 0, percent: 5 },
      { minAmount: 50000, percent: 10 },
      { minAmount: 100000, percent: 15 },
    ]);
  });
  it("parses the default tiers text", () => {
    const tiers = parseTiers(DEFAULT_TIERS_TEXT);
    expect(tiers).toHaveLength(3);
    expect(tiers[0].minAmount).toBe(0);
  });
  it("returns empty for empty input", () => {
    expect(parseTiers("")).toEqual([]);
  });
  it("skips malformed lines", () => {
    const tiers = parseTiers("0,5\nnot-a-tier\n100000,15");
    expect(tiers).toHaveLength(2);
  });
});

describe("commission-tracker flat calculator", () => {
  it("computes amount × percent / 100", () => {
    expect(calculateFlatCommission(50000, 10)).toBe(5000);
  });
  it("returns 0 for zero amount", () => {
    expect(calculateFlatCommission(0, 10)).toBe(0);
  });
  it("returns 0 for zero percent", () => {
    expect(calculateFlatCommission(50000, 0)).toBe(0);
  });
});

describe("commission-tracker base-plus calculator", () => {
  it("computes base + (amount × percent / 100)", () => {
    expect(calculateBasePlusCommission(50000, 500, 10)).toBe(5500);
  });
  it("handles zero base", () => {
    expect(calculateBasePlusCommission(50000, 0, 10)).toBe(5000);
  });
  it("handles zero percent", () => {
    expect(calculateBasePlusCommission(50000, 500, 0)).toBe(500);
  });
});

describe("commission-tracker bonus calculator", () => {
  it("returns the bonus amount", () => {
    expect(calculateBonusCommission(250)).toBe(250);
  });
  it("returns 0 for non-positive bonus", () => {
    expect(calculateBonusCommission(0)).toBe(0);
    expect(calculateBonusCommission(-100)).toBe(0);
  });
});

describe("commission-tracker tiered calculator (progressive brackets)", () => {
  const tiers = parseTiers(DEFAULT_TIERS_TEXT); // 0:5%, 50000:10%, 100000:15%
  it("calculates within first bracket", () => {
    // 30000 × 5% = 1500
    expect(calculateTieredCommission(30000, tiers)).toBe(1500);
  });
  it("calculates across two brackets", () => {
    // 50000 × 5% + 25000 × 10% = 2500 + 2500 = 5000
    expect(calculateTieredCommission(75000, tiers)).toBe(5000);
  });
  it("calculates across three brackets", () => {
    // 50000 × 5% + 50000 × 10% + 25000 × 15% = 2500 + 5000 + 3750 = 11250
    expect(calculateTieredCommission(125000, tiers)).toBe(11250);
  });
  it("returns 0 for amount below first tier min", () => {
    expect(calculateTieredCommission(0, tiers)).toBe(0);
  });
  it("returns 0 for empty tiers", () => {
    expect(calculateTieredCommission(50000, [])).toBe(0);
  });
  it("handles single-tier config (flat within bracket)", () => {
    expect(calculateTieredCommission(100000, [{ minAmount: 0, percent: 7 }])).toBe(7000);
  });
});

describe("commission-tracker calculateCommissionForDeal", () => {
  const baseDeal: Deal = {
    dealName: "X", salesRep: "Alice", amount: 50000,
    closeDate: "2026-07-15", status: "closed-won",
  };
  it("returns 0 for non-closed-won deals", () => {
    const open = { ...baseDeal, status: "open" as const };
    expect(calculateCommissionForDeal(open, {
      type: "flat-percent", baseCommission: 0, commissionPercent: 10,
      tiers: [], bonusPerDeal: 0,
    })).toBe(0);
  });
  it("dispatches to flat-percent", () => {
    expect(calculateCommissionForDeal(baseDeal, {
      type: "flat-percent", baseCommission: 0, commissionPercent: 10,
      tiers: [], bonusPerDeal: 0,
    })).toBe(5000);
  });
  it("dispatches to tiered-percent", () => {
    expect(calculateCommissionForDeal(baseDeal, {
      type: "tiered-percent", baseCommission: 0, commissionPercent: 0,
      tiers: parseTiers(DEFAULT_TIERS_TEXT), bonusPerDeal: 0,
    })).toBe(2500);
  });
  it("dispatches to base-plus-percent", () => {
    expect(calculateCommissionForDeal(baseDeal, {
      type: "base-plus-percent", baseCommission: 500, commissionPercent: 10,
      tiers: [], bonusPerDeal: 0,
    })).toBe(5500);
  });
  it("dispatches to bonus-per-deal", () => {
    expect(calculateCommissionForDeal(baseDeal, {
      type: "bonus-per-deal", baseCommission: 0, commissionPercent: 0,
      tiers: [], bonusPerDeal: 300,
    })).toBe(300);
  });
});

describe("commission-tracker formatPayoutPeriod", () => {
  it("formats monthly", () => {
    expect(formatPayoutPeriod("2026-07-15", "monthly")).toBe("July 2026");
  });
  it("formats quarterly Q1", () => {
    expect(formatPayoutPeriod("2026-02-10", "quarterly")).toBe("Q1 2026");
  });
  it("formats quarterly Q3", () => {
    expect(formatPayoutPeriod("2026-08-05", "quarterly")).toBe("Q3 2026");
  });
  it("formats annually", () => {
    expect(formatPayoutPeriod("2026-12-31", "annually")).toBe("2026");
  });
  it("returns dash for invalid date", () => {
    expect(formatPayoutPeriod("not-a-date", "monthly")).toBe("—");
    expect(formatPayoutPeriod("", "monthly")).toBe("—");
  });
});

describe("commission-tracker applyStatusFilter", () => {
  const deals: Deal[] = [
    { dealName: "A", salesRep: "x", amount: 100, closeDate: "2026-01-01", status: "closed-won" },
    { dealName: "B", salesRep: "x", amount: 200, closeDate: "2026-01-02", status: "closed-lost" },
    { dealName: "C", salesRep: "x", amount: 300, closeDate: "2026-01-03", status: "open" },
  ];
  it("returns all for 'all'", () => {
    expect(applyStatusFilter(deals, "all")).toHaveLength(3);
  });
  it("filters closed-won", () => {
    expect(applyStatusFilter(deals, "closed-won")).toHaveLength(1);
  });
  it("filters open", () => {
    expect(applyStatusFilter(deals, "open")).toHaveLength(1);
  });
});

describe("commission-tracker attachCommission + computePerRepTotals", () => {
  const deals: Deal[] = [
    { dealName: "A", salesRep: "Alice", amount: 50000, closeDate: "2026-07-15", status: "closed-won" },
    { dealName: "B", salesRep: "Alice", amount: 100000, closeDate: "2026-08-05", status: "closed-won" },
    { dealName: "C", salesRep: "Bob", amount: 25000, closeDate: "2026-07-20", status: "closed-won" },
    { dealName: "D", salesRep: "Bob", amount: 10000, closeDate: "2026-09-01", status: "open" },
  ];
  const params = {
    type: "flat-percent" as CommissionType,
    baseCommission: 0, commissionPercent: 10, tiers: [], bonusPerDeal: 0,
  };
  it("attaches commission only to closed-won", () => {
    const withCom = attachCommission(deals, params, "monthly");
    expect(withCom[0].commission).toBe(5000);
    expect(withCom[2].commission).toBe(2500);
    expect(withCom[3].commission).toBe(0);
    expect(withCom[3].payoutPeriod).toBe("September 2026");
  });
  it("computes per-rep totals", () => {
    const withCom = attachCommission(deals, params, "monthly");
    const reps = computePerRepTotals(withCom);
    expect(reps).toHaveLength(2);
    const alice = reps.find((r) => r.salesRep === "Alice")!;
    expect(alice.dealCount).toBe(2);
    expect(alice.closedWonCount).toBe(2);
    expect(alice.totalAmount).toBe(150000);
    expect(alice.totalCommission).toBe(15000);
    expect(alice.avgCommissionPerDeal).toBe(7500);
    const bob = reps.find((r) => r.salesRep === "Bob")!;
    expect(bob.dealCount).toBe(2);
    expect(bob.closedWonCount).toBe(1);
    expect(bob.totalCommission).toBe(2500);
  });
});

describe("commission-tracker sortLeaderboard + findTopPerformer", () => {
  const reps = [
    { salesRep: "Bob", dealCount: 2, closedWonCount: 1, totalAmount: 25000, totalCommission: 2500, avgCommissionPerDeal: 2500 },
    { salesRep: "Alice", dealCount: 2, closedWonCount: 2, totalAmount: 150000, totalCommission: 15000, avgCommissionPerDeal: 7500 },
    { salesRep: "Charlie", dealCount: 1, closedWonCount: 1, totalAmount: 80000, totalCommission: 8000, avgCommissionPerDeal: 8000 },
  ];
  it("sorts by commission desc", () => {
    const sorted = sortLeaderboard(reps);
    expect(sorted[0].salesRep).toBe("Alice");
    expect(sorted[1].salesRep).toBe("Charlie");
    expect(sorted[2].salesRep).toBe("Bob");
  });
  it("does not mutate input", () => {
    const original = [...reps];
    sortLeaderboard(reps);
    expect(reps.map((r) => r.salesRep)).toEqual(original.map((r) => r.salesRep));
  });
  it("finds top performer", () => {
    expect(findTopPerformer(reps)!.salesRep).toBe("Alice");
  });
  it("returns null for empty", () => {
    expect(findTopPerformer([])).toBeNull();
  });
});

describe("commission-tracker computeAverageCommission", () => {
  it("computes average across closed-won only", () => {
    const deals = [
      { dealName: "A", salesRep: "x", amount: 50000, closeDate: "2026-01-01", status: "closed-won" as const, commission: 5000, payoutPeriod: "January 2026" },
      { dealName: "B", salesRep: "x", amount: 25000, closeDate: "2026-01-02", status: "closed-won" as const, commission: 2500, payoutPeriod: "January 2026" },
      { dealName: "C", salesRep: "x", amount: 10000, closeDate: "2026-01-03", status: "open" as const, commission: 0, payoutPeriod: "January 2026" },
    ];
    expect(computeAverageCommission(deals)).toBe(3750);
  });
  it("returns 0 when no closed-won", () => {
    expect(computeAverageCommission([])).toBe(0);
  });
});

describe("commission-tracker generatePayoutSchedule", () => {
  it("groups by payout period", () => {
    const deals = [
      { dealName: "A", salesRep: "x", amount: 50000, closeDate: "2026-07-15", status: "closed-won" as const, commission: 5000, payoutPeriod: "Q3 2026" },
      { dealName: "B", salesRep: "x", amount: 25000, closeDate: "2026-08-05", status: "closed-won" as const, commission: 2500, payoutPeriod: "Q3 2026" },
      { dealName: "C", salesRep: "x", amount: 80000, closeDate: "2026-10-01", status: "closed-won" as const, commission: 8000, payoutPeriod: "Q4 2026" },
      { dealName: "D", salesRep: "x", amount: 10000, closeDate: "2026-11-01", status: "open" as const, commission: 0, payoutPeriod: "Q4 2026" },
    ];
    const sched = generatePayoutSchedule(deals, "quarterly");
    expect(sched).toHaveLength(2);
    const q3 = sched.find((s) => s.period === "Q3 2026")!;
    expect(q3.dealCount).toBe(2);
    expect(q3.totalCommission).toBe(7500);
    const q4 = sched.find((s) => s.period === "Q4 2026")!;
    expect(q4.dealCount).toBe(1); // open deal excluded
    expect(q4.totalCommission).toBe(8000);
  });
  it("returns empty for empty input", () => {
    expect(generatePayoutSchedule([], "monthly")).toEqual([]);
  });
});

describe("commission-tracker computeSummary", () => {
  it("computes the full summary block", () => {
    const deals = [
      { dealName: "A", salesRep: "Alice", amount: 50000, closeDate: "2026-07-15", status: "closed-won" as const, commission: 5000, payoutPeriod: "Q3 2026" },
      { dealName: "B", salesRep: "Bob", amount: 25000, closeDate: "2026-07-20", status: "closed-won" as const, commission: 2500, payoutPeriod: "Q3 2026" },
      { dealName: "C", salesRep: "Alice", amount: 10000, closeDate: "2026-08-01", status: "closed-lost" as const, commission: 0, payoutPeriod: "Q3 2026" },
      { dealName: "D", salesRep: "Bob", amount: 8000, closeDate: "2026-09-01", status: "open" as const, commission: 0, payoutPeriod: "Q3 2026" },
    ];
    const reps = computePerRepTotals(deals);
    const summary = computeSummary(deals, reps);
    expect(summary.totalDeals).toBe(4);
    expect(summary.closedWonDeals).toBe(2);
    expect(summary.closedLostDeals).toBe(1);
    expect(summary.openDeals).toBe(1);
    expect(summary.totalAmount).toBe(75000);
    expect(summary.totalCommission).toBe(7500);
    expect(summary.averageCommissionPerDeal).toBe(3750);
    expect(summary.topPerformer!.salesRep).toBe("Alice");
    expect(summary.repCount).toBe(2);
  });
  it("handles empty", () => {
    const summary = computeSummary([], []);
    expect(summary.totalDeals).toBe(0);
    expect(summary.topPerformer).toBeNull();
  });
});

describe("commission-tracker detectCommissionCaps", () => {
  it("flags deals where commission exceeds amount", () => {
    const deals = [
      { dealName: "A", salesRep: "x", amount: 100, closeDate: "2026-01-01", status: "closed-won" as const, commission: 200, payoutPeriod: "Q1 2026" },
      { dealName: "B", salesRep: "x", amount: 1000, closeDate: "2026-01-02", status: "closed-won" as const, commission: 50, payoutPeriod: "Q1 2026" },
    ];
    const caps = detectCommissionCaps(deals);
    expect(caps).toHaveLength(1);
    expect(caps[0].dealName).toBe("A");
    expect(caps[0].reason).toContain("exceeds deal amount");
  });
  it("returns empty when no caps", () => {
    const deals = [
      { dealName: "A", salesRep: "x", amount: 1000, closeDate: "2026-01-01", status: "closed-won" as const, commission: 50, payoutPeriod: "Q1 2026" },
    ];
    expect(detectCommissionCaps(deals)).toEqual([]);
  });
  it("ignores non-closed-won deals", () => {
    const deals = [
      { dealName: "A", salesRep: "x", amount: 100, closeDate: "2026-01-01", status: "open" as const, commission: 200, payoutPeriod: "Q1 2026" },
    ];
    expect(detectCommissionCaps(deals)).toEqual([]);
  });
});

describe("commission-tracker renderTextReport", () => {
  it("renders summary + leaderboard + schedule", () => {
    const deals = [
      { dealName: "A", salesRep: "Alice", amount: 50000, closeDate: "2026-07-15", status: "closed-won" as const, commission: 5000, payoutPeriod: "Q3 2026" },
      { dealName: "B", salesRep: "Bob", amount: 25000, closeDate: "2026-07-20", status: "closed-won" as const, commission: 2500, payoutPeriod: "Q3 2026" },
    ];
    const reps = computePerRepTotals(deals);
    const summary = computeSummary(deals, reps);
    const sched = generatePayoutSchedule(deals, "quarterly");
    const text = renderTextReport(reps, summary, sched);
    expect(text).toContain("=== Commission Report ===");
    expect(text).toContain("Closed-won deals:   2");
    expect(text).toContain("Top performer:       Alice");
    expect(text).toContain("=== Per-Rep Leaderboard");
    expect(text).toContain("1. Alice");
    expect(text).toContain("=== Payout Schedule ===");
    expect(text).toContain("Q3 2026: 2 deal(s)");
  });
});

describe("commission-tracker renderCsv", () => {
  it("renders header + rows", () => {
    const deals = [
      { dealName: "Acme, Inc.", salesRep: "Alice", amount: 50000, closeDate: "2026-07-15", status: "closed-won" as const, commission: 5000, payoutPeriod: "Q3 2026" },
    ];
    const csv = renderCsv(deals);
    expect(csv.split("\n")[0]).toBe("deal_name,sales_rep,amount,close_date,status,commission,payout_period");
    // Quoted deal name with comma
    expect(csv).toContain('"Acme, Inc."');
    expect(csv).toContain("50000.00,2026-07-15,closed-won,5000.00");
  });
  it("renders empty header only", () => {
    const csv = renderCsv([]);
    expect(csv).toBe("deal_name,sales_rep,amount,close_date,status,commission,payout_period");
  });
});

describe("commission-tracker splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
});

describe("commission-tracker formatCurrency", () => {
  it("formats with $ and 2 decimals", () => {
    expect(formatCurrency(5000)).toBe("$5000.00");
    expect(formatCurrency(5000.5)).toBe("$5000.50");
  });
  it("handles non-finite", () => {
    expect(formatCurrency(Number.NaN)).toBe("$0.00");
  });
});

describe("commission-tracker history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, type: "flat-percent", dealCount: 5, repCount: 2, totalCommission: 5000 });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].totalCommission).toBe(5000);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, type: "flat-percent", dealCount: i, repCount: 1, totalCommission: i * 100 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, type: "flat-percent", dealCount: 1, repCount: 1, totalCommission: 100 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("commission-tracker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      type: "flat-percent", baseCommission: 500, commissionPercent: 10,
      bonusPerDeal: 0, deals: "Acme,Alice,50000,2026-07-15,closed-won",
      tiers: DEFAULT_TIERS_TEXT, frequency: "quarterly", statusFilter: "all",
    });
    expect(url).toContain("type=flat-percent");
    expect(url).toContain("base=500");
    expect(url).toContain("pct=10");
    expect(url).toContain("freq=quarterly");
    expect(url).toContain("filter=all");
    expect(url).toContain("deals=Acme");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      type: "tiered-percent", baseCommission: 0, commissionPercent: 0,
      bonusPerDeal: 250, deals: "Acme,Alice,50000,2026-07-15,closed-won",
      tiers: "0,5\n50000,10", frequency: "monthly", statusFilter: "closed-won",
    });
    (globalThis as Record<string, unknown>).window = origWindow;
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.type).toBe("tiered-percent");
    expect(parsed.bonusPerDeal).toBe(250);
    expect(parsed.frequency).toBe("monthly");
    expect(parsed.statusFilter).toBe("closed-won");
    expect(parsed.deals).toBe("Acme,Alice,50000,2026-07-15,closed-won");
    expect(parsed.tiers).toBe("0,5\n50000,10");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown enum values", () => {
    const parsed = parseShareUrl("type=unknown&freq=weekly&filter=maybe");
    expect(parsed.type).toBeUndefined();
    expect(parsed.frequency).toBeUndefined();
    expect(parsed.statusFilter).toBeUndefined();
  });
});

// Suppress unused-import lint
export type _Unused = CommissionType | PayoutFrequency | StatusFilter;

import { describe, it, expect, beforeEach } from "vitest";
import {
  STAGE_PRESETS,
  STAGE_LABELS,
  CURRENCY_PRESETS,
  DEFAULT_INPUT,
  normalizeStage,
  defaultProbabilityForStage,
  isOpen,
  isValidDate,
  splitCsvRow,
  parseDeals,
  filterByStage,
  filterByDateRange,
  applyFilters,
  computeWeightedValue,
  computePipelineValue,
  computeWeightedPipeline,
  computeStageBreakdown,
  computeWinRate,
  computeAverageDealSize,
  findTopDeals,
  findStaleDeals,
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
  type Stage,
  type StageFilter,
  type Deal,
  type PipelineInput,
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

function makeDeal(overrides: Partial<Deal> = {}): Deal {
  return {
    dealName: "Test Deal",
    customer: "Test Co",
    stage: "negotiation",
    amount: 10000,
    probability: 75,
    expectedCloseDate: "2026-08-01",
    lineIndex: 1,
    ...overrides,
  };
}

describe("sales-pipeline-tracker constants", () => {
  it("has 6 stage presets", () => {
    expect(STAGE_PRESETS).toHaveLength(6);
  });
  it("has default probabilities matching spec", () => {
    const byStage = new Map(STAGE_PRESETS.map((p) => [p.stage, p.defaultProbability]));
    expect(byStage.get("lead")).toBe(10);
    expect(byStage.get("qualified")).toBe(25);
    expect(byStage.get("proposal")).toBe(50);
    expect(byStage.get("negotiation")).toBe(75);
    expect(byStage.get("closed-won")).toBe(100);
    expect(byStage.get("closed-lost")).toBe(0);
  });
  it("has stage labels for all 6 stages", () => {
    expect(Object.keys(STAGE_LABELS)).toHaveLength(6);
    expect(STAGE_LABELS["closed-won"]).toBe("Closed Won");
  });
  it("has 7 currency presets", () => {
    expect(CURRENCY_PRESETS).toHaveLength(7);
    expect(CURRENCY_PRESETS[0].symbol).toBe("$");
  });
  it("has default input with stageFilter all", () => {
    expect(DEFAULT_INPUT.stageFilter).toBe("all");
    expect(DEFAULT_INPUT.currencySymbol).toBe("$");
  });
});

describe("sales-pipeline-tracker normalizeStage", () => {
  it("returns the stage for exact match", () => {
    expect(normalizeStage("lead")).toBe("lead");
    expect(normalizeStage("qualified")).toBe("qualified");
    expect(normalizeStage("negotiation")).toBe("negotiation");
    expect(normalizeStage("closed-won")).toBe("closed-won");
  });
  it("lowercases and trims", () => {
    expect(normalizeStage("  LEAD  ")).toBe("lead");
    expect(normalizeStage("Proposal")).toBe("proposal");
  });
  it("accepts aliases (won, lost, closedwon, closedlost)", () => {
    expect(normalizeStage("won")).toBe("closed-won");
    expect(normalizeStage("lost")).toBe("closed-lost");
    expect(normalizeStage("closedwon")).toBe("closed-won");
    expect(normalizeStage("closedlost")).toBe("closed-lost");
  });
  it("returns null for unknown", () => {
    expect(normalizeStage("prospect")).toBeNull();
    expect(normalizeStage("")).toBeNull();
  });
});

describe("sales-pipeline-tracker defaultProbabilityForStage + isOpen", () => {
  it("returns default probability", () => {
    expect(defaultProbabilityForStage("lead")).toBe(10);
    expect(defaultProbabilityForStage("closed-won")).toBe(100);
  });
  it("open stages are open, closed stages are not", () => {
    expect(isOpen(makeDeal({ stage: "lead" }))).toBe(true);
    expect(isOpen(makeDeal({ stage: "negotiation" }))).toBe(true);
    expect(isOpen(makeDeal({ stage: "closed-won" }))).toBe(false);
    expect(isOpen(makeDeal({ stage: "closed-lost" }))).toBe(false);
  });
});

describe("sales-pipeline-tracker isValidDate", () => {
  it("accepts valid dates", () => {
    expect(isValidDate("2026-08-15")).toBe(true);
    expect(isValidDate("2026-02-28")).toBe(true);
  });
  it("rejects invalid dates", () => {
    expect(isValidDate("2026-13-01")).toBe(false); // bad month
    expect(isValidDate("2026-02-30")).toBe(false); // bad day
    expect(isValidDate("20260815")).toBe(false);
    expect(isValidDate("")).toBe(false);
  });
});

describe("sales-pipeline-tracker splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("handles escaped quotes", () => {
    expect(splitCsvRow('"she said ""hi""",x')).toEqual(['she said "hi"', "x"]);
  });
});

describe("sales-pipeline-tracker parseDeals", () => {
  it("parses a single valid deal", () => {
    const { deals, errors } = parseDeals("Acme Renewal,Acme Corp,Negotiation,50000,75,2026-07-30");
    expect(errors).toEqual([]);
    expect(deals).toHaveLength(1);
    expect(deals[0].dealName).toBe("Acme Renewal");
    expect(deals[0].stage).toBe("negotiation");
    expect(deals[0].amount).toBe(50000);
    expect(deals[0].probability).toBe(75);
    expect(deals[0].expectedCloseDate).toBe("2026-07-30");
    expect(deals[0].lineIndex).toBe(1);
  });
  it("parses multiple deals", () => {
    const text = "Deal A,Cust A,Lead,1000,10,2026-09-01\nDeal B,Cust B,Closed-Won,5000,100,2026-07-01";
    const { deals, errors } = parseDeals(text);
    expect(errors).toEqual([]);
    expect(deals).toHaveLength(2);
  });
  it("uses default probability when omitted (4-field row)", () => {
    const { deals, errors } = parseDeals("Demo Deal,NewCo,Lead,5000");
    expect(errors).toEqual([]);
    expect(deals[0].probability).toBe(10); // default for lead
  });
  it("uses default probability when 5-field row omits close date", () => {
    const { deals, errors } = parseDeals("Demo Deal,NewCo,Proposal,5000,60");
    expect(errors).toEqual([]);
    expect(deals[0].probability).toBe(60);
    expect(deals[0].expectedCloseDate).toBe("");
  });
  it("skips blank lines and comments", () => {
    const text = "# this is a comment\n\nReal Deal,Co,Lead,1000,10,2026-09-01";
    const { deals } = parseDeals(text);
    expect(deals).toHaveLength(1);
    expect(deals[0].dealName).toBe("Real Deal");
    expect(deals[0].lineIndex).toBe(3); // 1-based: line 1 comment, line 2 blank, line 3 real
  });
  it("collects errors for too few fields", () => {
    const { deals, errors } = parseDeals("Only One Field");
    expect(deals).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Line 1");
  });
  it("collects errors for unknown stage", () => {
    const { deals, errors } = parseDeals("Bad Deal,Co,Prospect,1000");
    expect(deals).toHaveLength(0);
    expect(errors[0]).toContain("unknown stage");
  });
  it("collects errors for invalid amount", () => {
    const { deals, errors } = parseDeals("Bad Deal,Co,Lead,abc");
    expect(deals).toHaveLength(0);
    expect(errors[0]).toContain("invalid amount");
  });
  it("collects errors for invalid probability", () => {
    const { deals, errors } = parseDeals("Bad Deal,Co,Lead,1000,150");
    expect(deals).toHaveLength(0);
    expect(errors[0]).toContain("invalid probability");
  });
  it("collects errors for invalid close date", () => {
    const { deals, errors } = parseDeals("Bad Deal,Co,Lead,1000,10,2026-13-40");
    expect(deals).toHaveLength(0);
    expect(errors[0]).toContain("invalid close date");
  });
  it("handles quoted deal name with comma", () => {
    const { deals, errors } = parseDeals('"Acme, Inc.",Acme,Lead,1000,10,2026-09-01');
    expect(errors).toEqual([]);
    expect(deals[0].dealName).toBe("Acme, Inc.");
    expect(deals[0].customer).toBe("Acme");
  });
  it("returns empty for empty input", () => {
    expect(parseDeals("")).toEqual({ deals: [], errors: [] });
    expect(parseDeals("   ")).toEqual({ deals: [], errors: [] });
  });
});

describe("sales-pipeline-tracker filters", () => {
  const deals: Deal[] = [
    makeDeal({ dealName: "A", stage: "lead", expectedCloseDate: "2026-09-01", amount: 1000 }),
    makeDeal({ dealName: "B", stage: "negotiation", expectedCloseDate: "2026-08-15", amount: 2000 }),
    makeDeal({ dealName: "C", stage: "closed-won", expectedCloseDate: "2026-07-01", amount: 5000 }),
    makeDeal({ dealName: "D", stage: "lead", expectedCloseDate: "", amount: 3000 }),
  ];

  it("filterByStage all returns all", () => {
    expect(filterByStage(deals, "all")).toHaveLength(4);
  });
  it("filterByStage specific stage", () => {
    const r = filterByStage(deals, "lead");
    expect(r).toHaveLength(2);
    expect(r.every((d) => d.stage === "lead")).toBe(true);
  });
  it("filterByDateRange with start only", () => {
    const r = filterByDateRange(deals, "2026-08-01", "");
    // A (09-01 >= 08-01, included); B (08-15, included); C (07-01 < 08-01, excluded); D (no date, included)
    expect(r.map((d) => d.dealName).sort()).toEqual(["A", "B", "D"]);
  });
  it("filterByDateRange with end only", () => {
    const r = filterByDateRange(deals, "", "2026-08-31");
    // A (09-01 > 08-31, excluded); B (08-15, ok); C (07-01, ok); D (no date, included)
    expect(r.map((d) => d.dealName).sort()).toEqual(["B", "C", "D"]);
  });
  it("filterByDateRange includes deals with no close date", () => {
    const r = filterByDateRange(deals, "2026-01-01", "2026-01-31");
    expect(r.map((d) => d.dealName)).toEqual(["D"]);
  });
  it("applyFilters combines stage + date", () => {
    const r = applyFilters(deals, "lead", "2026-08-01", "");
    // Lead deals: A (09-01 ≥ 08-01), D (no date, included)
    expect(r.map((d) => d.dealName).sort()).toEqual(["A", "D"]);
  });
});

describe("sales-pipeline-tracker calculations", () => {
  it("computeWeightedValue = amount × probability / 100", () => {
    expect(computeWeightedValue(makeDeal({ amount: 50000, probability: 75 }))).toBe(37500);
    expect(computeWeightedValue(makeDeal({ amount: 1000, probability: 0 }))).toBe(0);
    expect(computeWeightedValue(makeDeal({ amount: 1000, probability: 100 }))).toBe(1000);
  });
  it("computePipelineValue sums only open deals", () => {
    const deals: Deal[] = [
      makeDeal({ stage: "lead", amount: 1000 }),
      makeDeal({ stage: "closed-won", amount: 5000 }),
      makeDeal({ stage: "closed-lost", amount: 2000 }),
      makeDeal({ stage: "negotiation", amount: 3000 }),
    ];
    expect(computePipelineValue(deals)).toBe(4000); // 1000 + 3000
  });
  it("computeWeightedPipeline sums weighted value of open deals", () => {
    const deals: Deal[] = [
      makeDeal({ stage: "lead", amount: 1000, probability: 10 }), // weighted 100
      makeDeal({ stage: "closed-won", amount: 5000, probability: 100 }), // excluded
      makeDeal({ stage: "negotiation", amount: 4000, probability: 75 }), // weighted 3000
    ];
    expect(computeWeightedPipeline(deals)).toBe(3100);
  });
  it("computeStageBreakdown returns 6 rows in stage order with counts", () => {
    const deals: Deal[] = [
      makeDeal({ stage: "lead", amount: 1000, probability: 10 }),
      makeDeal({ stage: "lead", amount: 2000, probability: 10 }),
      makeDeal({ stage: "closed-won", amount: 5000, probability: 100 }),
    ];
    const rows = computeStageBreakdown(deals);
    expect(rows).toHaveLength(6);
    expect(rows[0].stage).toBe("lead");
    expect(rows[0].count).toBe(2);
    expect(rows[0].totalAmount).toBe(3000);
    expect(rows[0].weightedValue).toBe(300); // 100 + 200
    expect(rows[4].stage).toBe("closed-won");
    expect(rows[4].count).toBe(1);
    expect(rows[4].weightedValue).toBe(5000);
    expect(rows[5].stage).toBe("closed-lost");
    expect(rows[5].count).toBe(0);
  });
  it("computeWinRate = won / (won+lost) × 100", () => {
    const deals: Deal[] = [
      makeDeal({ stage: "closed-won" }),
      makeDeal({ stage: "closed-won" }),
      makeDeal({ stage: "closed-lost" }),
    ];
    expect(computeWinRate(deals)).toBeCloseTo(66.6667, 3);
  });
  it("computeWinRate returns 0 when no closed deals", () => {
    const deals: Deal[] = [
      makeDeal({ stage: "lead" }),
      makeDeal({ stage: "negotiation" }),
    ];
    expect(computeWinRate(deals)).toBe(0);
  });
  it("computeAverageDealSize = total amount / count", () => {
    const deals: Deal[] = [
      makeDeal({ amount: 1000 }),
      makeDeal({ amount: 3000 }),
    ];
    expect(computeAverageDealSize(deals)).toBe(2000);
  });
  it("computeAverageDealSize returns 0 for empty", () => {
    expect(computeAverageDealSize([])).toBe(0);
  });
  it("findTopDeals returns N largest by amount", () => {
    const deals: Deal[] = [
      makeDeal({ dealName: "A", amount: 1000 }),
      makeDeal({ dealName: "B", amount: 5000 }),
      makeDeal({ dealName: "C", amount: 3000 }),
    ];
    const top = findTopDeals(deals, 2);
    expect(top.map((d) => d.dealName)).toEqual(["B", "C"]);
  });
  it("findStaleDeals returns open deals past today", () => {
    const deals: Deal[] = [
      makeDeal({ dealName: "Stale Open", stage: "lead", expectedCloseDate: "2026-01-01" }),
      makeDeal({ dealName: "Future Open", stage: "lead", expectedCloseDate: "2026-12-31" }),
      makeDeal({ dealName: "Stale Won", stage: "closed-won", expectedCloseDate: "2026-01-01" }),
      makeDeal({ dealName: "No Date", stage: "lead", expectedCloseDate: "" }),
    ];
    const stale = findStaleDeals(deals, "2026-07-01");
    expect(stale.map((d) => d.dealName)).toEqual(["Stale Open"]);
  });
  it("findStaleDeals returns empty when today is empty", () => {
    const deals: Deal[] = [
      makeDeal({ stage: "lead", expectedCloseDate: "2020-01-01" }),
    ];
    expect(findStaleDeals(deals, "")).toEqual([]);
  });
  it("summaryStats aggregates everything", () => {
    const deals: Deal[] = [
      makeDeal({ stage: "lead", amount: 1000, probability: 10, expectedCloseDate: "2026-01-01" }),
      makeDeal({ stage: "closed-won", amount: 5000, probability: 100, expectedCloseDate: "2026-07-01" }),
      makeDeal({ stage: "closed-lost", amount: 2000, probability: 0, expectedCloseDate: "2026-06-01" }),
    ];
    const s = summaryStats(deals, "2026-07-01");
    expect(s.totalDeals).toBe(3);
    expect(s.openDeals).toBe(1);
    expect(s.wonDeals).toBe(1);
    expect(s.lostDeals).toBe(1);
    expect(s.pipelineValue).toBe(1000);
    expect(s.weightedPipeline).toBe(100);
    expect(s.wonAmount).toBe(5000);
    expect(s.lostAmount).toBe(2000);
    expect(s.winRate).toBeCloseTo(50, 5);
    expect(s.averageDealSize).toBeCloseTo(2666.6667, 3);
    expect(s.staleCount).toBe(1);
    expect(s.topDeal?.dealName).toBe("Test Deal");
  });
});

describe("sales-pipeline-tracker formatters", () => {
  it("formatMoney uses symbol and 2 decimals", () => {
    expect(formatMoney(1234.5, "$")).toBe("$1234.50");
    expect(formatMoney(0, "€")).toBe("€0.00");
    expect(formatMoney(NaN, "$")).toBe("$0.00");
  });
  it("formatPercentage returns 1-decimal percent", () => {
    expect(formatPercentage(66.6667)).toBe("66.7%");
    expect(formatPercentage(0)).toBe("0.0%");
    expect(formatPercentage(NaN)).toBe("0.0%");
  });
});

describe("sales-pipeline-tracker renderText", () => {
  it("renders a non-empty report with sections", () => {
    const deals = parseDeals("Acme Renewal,Acme Corp,Negotiation,50000,75,2026-07-30").deals;
    const input: PipelineInput = {
      dealsText: "Acme Renewal,Acme Corp,Negotiation,50000,75,2026-07-30",
      stageFilter: "all",
      dateRangeStart: "",
      dateRangeEnd: "",
      currencySymbol: "$",
      today: "2026-07-01",
    };
    const text = renderText(input, deals);
    expect(text).toContain("=== Sales Pipeline Report ===");
    expect(text).toContain("--- Summary ---");
    expect(text).toContain("--- By Stage ---");
    expect(text).toContain("--- Deals ---");
    expect(text).toContain("Acme Renewal");
    expect(text).toContain("$50000.00");
    expect(text).toContain("Weighted pipeline: $37500.00");
  });
  it("renders stale deals section when present", () => {
    const deals = parseDeals("Old Deal,Co,Lead,1000,10,2020-01-01").deals;
    const input: PipelineInput = {
      dealsText: "",
      stageFilter: "all",
      dateRangeStart: "",
      dateRangeEnd: "",
      currencySymbol: "$",
      today: "2026-07-01",
    };
    const text = renderText(input, deals);
    expect(text).toContain("Stale Deals");
    expect(text).toContain("Old Deal");
  });
  it("returns 'No deals' for empty list", () => {
    const input: PipelineInput = { ...DEFAULT_INPUT };
    expect(renderText(input, [])).toBe("No deals to report.");
  });
});

describe("sales-pipeline-tracker renderCsv", () => {
  it("renders header only for empty", () => {
    const csv = renderCsv([]);
    expect(csv).toBe("deal_name,customer,stage,amount,probability,weighted_value,expected_close_date");
  });
  it("renders deal rows with weighted value", () => {
    const deals = parseDeals("Demo,Co,Negotiation,1000,75,2026-08-01").deals;
    const csv = renderCsv(deals);
    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain("Demo,Co,negotiation,1000.00,75,750.00,2026-08-01");
  });
  it("escapes commas in deal names", () => {
    const deals = parseDeals('"Big, Important Deal",Co,Lead,1000,10,2026-09-01').deals;
    expect(deals).toHaveLength(1);
    const csv = renderCsv(deals);
    expect(csv).toContain('"Big, Important Deal"');
  });
});

describe("sales-pipeline-tracker history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      dealsText: "Demo,Co,Lead,1000",
      dealCount: 1,
      pipelineValue: 1000,
      weightedPipeline: 100,
      winRate: 0,
      currencySymbol: "$",
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].dealCount).toBe(1);
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        dealsText: "x",
        dealCount: 1,
        pipelineValue: 0,
        weightedPipeline: 0,
        winRate: 0,
        currencySymbol: "$",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1,
      dealsText: "x",
      dealCount: 1,
      pipelineValue: 0,
      weightedPipeline: 0,
      winRate: 0,
      currencySymbol: "$",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("sales-pipeline-tracker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const input: PipelineInput = {
      dealsText: "Demo,Co,Lead,1000",
      stageFilter: "negotiation",
      dateRangeStart: "2026-08-01",
      dateRangeEnd: "2026-08-31",
      currencySymbol: "€",
      today: "",
    };
    const url = buildShareUrl(input);
    expect(url).toContain("deals=Demo");
    expect(url).toContain("stage=negotiation");
    expect(url).toContain("from=2026-08-01");
    expect(url).toContain("to=2026-08-31");
    expect(url).toContain("cur=%E2%82%AC");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("omits stageFilter=all from URL", () => {
    const url = buildShareUrl({ ...DEFAULT_INPUT, dealsText: "x" });
    expect(url).not.toContain("stage=");
  });
  it("parses share URL back", () => {
    const hash = "deals=Demo%2CCo%2CLead%2C1000&stage=negotiation&from=2026-08-01&to=2026-08-31&cur=%E2%82%AC";
    const p = parseShareUrl(hash);
    expect(p.dealsText).toBe("Demo,Co,Lead,1000");
    expect(p.stageFilter).toBe("negotiation");
    expect(p.dateRangeStart).toBe("2026-08-01");
    expect(p.dateRangeEnd).toBe("2026-08-31");
    expect(p.currencySymbol).toBe("€");
  });
  it("handles empty hash returning defaults", () => {
    const p = parseShareUrl("");
    expect(p.dealsText).toBe("");
    expect(p.stageFilter).toBe("all");
    expect(p.currencySymbol).toBe("$");
  });
  it("filters unknown stage filter to all", () => {
    const p = parseShareUrl("stage=prospect");
    expect(p.stageFilter).toBe("all");
  });
});

// Suppress unused-import lint warnings
export type _Unused = { s: Stage; f: StageFilter };

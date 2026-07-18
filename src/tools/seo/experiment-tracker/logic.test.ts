import { describe, it, expect, beforeEach } from "vitest";
import {
  EXPERIMENT_TYPE_PRESETS,
  CONTROL_METRIC_PRESETS,
  SIGNIFICANCE_LABELS,
  RECOMMENDATION_LABELS,
  STATUS_LABELS,
  todayIso,
  normalizePage,
  isValidDate,
  splitCsvRow,
  parseMetricCsv,
  parseBeforeAfterCsv,
  computePageDelta,
  computePagePctChange,
  categorizePage,
  scorePage,
  scoreAllPages,
  computeAggregate,
  checkSignificance,
  computeStatus,
  generateRecommendation,
  computeConfidence,
  runExperiment,
  filterPages,
  computeSummaryStats,
  formatNumber,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ExperimentType,
  type ControlMetric,
  type ExperimentInput,
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

describe("experiment-tracker constants", () => {
  it("has 5 experiment type presets", () => {
    expect(Object.keys(EXPERIMENT_TYPE_PRESETS)).toHaveLength(5);
  });
  it("has 5 control metric presets", () => {
    expect(Object.keys(CONTROL_METRIC_PRESETS)).toHaveLength(5);
  });
  it("has labels for all significance types", () => {
    expect(Object.keys(SIGNIFICANCE_LABELS)).toHaveLength(3);
  });
  it("has labels for all recommendation types", () => {
    expect(Object.keys(RECOMMENDATION_LABELS)).toHaveLength(3);
  });
  it("has labels for all statuses", () => {
    expect(Object.keys(STATUS_LABELS)).toHaveLength(4);
  });
  it("each type preset has a label and hypothesis", () => {
    for (const key of Object.keys(EXPERIMENT_TYPE_PRESETS) as ExperimentType[]) {
      const p = EXPERIMENT_TYPE_PRESETS[key];
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.hypothesis.length).toBeGreaterThan(0);
    }
  });
});

describe("experiment-tracker date utils", () => {
  it("todayIso returns YYYY-MM-DD", () => {
    expect(isValidDate(todayIso())).toBe(true);
  });
  it("isValidDate accepts valid dates", () => {
    expect(isValidDate("2025-01-15")).toBe(true);
  });
  it("isValidDate rejects invalid formats", () => {
    expect(isValidDate("01/15/2025")).toBe(false);
    expect(isValidDate("")).toBe(false);
    expect(isValidDate("2025-13-01")).toBe(false);
  });
});

describe("experiment-tracker normalizePage", () => {
  it("trims whitespace", () => {
    expect(normalizePage("  /blog/post  ")).toBe("/blog/post");
  });
  it("collapses internal whitespace", () => {
    expect(normalizePage("  /blog   post  ")).toBe("/blog post");
  });
  it("handles empty", () => {
    expect(normalizePage("")).toBe("");
  });
});

describe("experiment-tracker splitCsvRow", () => {
  it("splits simple rows", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("handles escaped quotes", () => {
    expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]);
  });
});

describe("experiment-tracker parseMetricCsv", () => {
  it("parses simple CSV", () => {
    const m = parseMetricCsv("/page1,100\n/page2,200");
    expect(m.get("/page1")).toBe(100);
    expect(m.get("/page2")).toBe(200);
  });
  it("skips header row", () => {
    const m = parseMetricCsv("page,metric_value\n/page1,100");
    expect(m.size).toBe(1);
    expect(m.get("/page1")).toBe(100);
  });
  it("ignores blank lines", () => {
    const m = parseMetricCsv("/page1,100\n\n/page2,200");
    expect(m.size).toBe(2);
  });
  it("ignores rows with non-numeric values", () => {
    const m = parseMetricCsv("/page1,abc\n/page2,200");
    expect(m.size).toBe(1);
    expect(m.get("/page2")).toBe(200);
  });
  it("returns empty map for empty input", () => {
    expect(parseMetricCsv("").size).toBe(0);
  });
});

describe("experiment-tracker parseBeforeAfterCsv", () => {
  it("pairs rows by page name", () => {
    const before = "/page1,100\n/page2,200";
    const after = "/page1,150\n/page2,180";
    const pages = parseBeforeAfterCsv(before, after);
    expect(pages).toHaveLength(2);
    const p1 = pages.find((p) => p.page === "/page1")!;
    expect(p1.before).toBe(100);
    expect(p1.after).toBe(150);
  });
  it("skips pages missing in either dataset", () => {
    const before = "/page1,100\n/page2,200";
    const after = "/page1,150\n/page3,300";
    const pages = parseBeforeAfterCsv(before, after);
    expect(pages).toHaveLength(1);
    expect(pages[0].page).toBe("/page1");
  });
  it("returns empty for empty inputs", () => {
    expect(parseBeforeAfterCsv("", "")).toEqual([]);
  });
  it("sorts pages alphabetically", () => {
    const before = "/zebra,100\n/apple,200";
    const after = "/zebra,150\n/apple,250";
    const pages = parseBeforeAfterCsv(before, after);
    expect(pages[0].page).toBe("/apple");
    expect(pages[1].page).toBe("/zebra");
  });
});

describe("experiment-tracker computePageDelta & pctChange", () => {
  it("delta = after - before", () => {
    expect(computePageDelta({ page: "/p", before: 100, after: 150 })).toBe(50);
    expect(computePageDelta({ page: "/p", before: 200, after: 100 })).toBe(-100);
  });
  it("pctChange = (after - before) / before × 100", () => {
    expect(computePagePctChange({ page: "/p", before: 100, after: 150 })).toBeCloseTo(50);
    expect(computePagePctChange({ page: "/p", before: 200, after: 100 })).toBeCloseTo(-50);
  });
  it("pctChange = 0 when before is 0 (avoid divide by zero)", () => {
    expect(computePagePctChange({ page: "/p", before: 0, after: 100 })).toBe(0);
  });
});

describe("experiment-tracker categorizePage", () => {
  it("> 5% is winner", () => {
    expect(categorizePage(10)).toBe("winner");
    expect(categorizePage(5.01)).toBe("winner");
  });
  it("< -5% is loser", () => {
    expect(categorizePage(-10)).toBe("loser");
    expect(categorizePage(-5.01)).toBe("loser");
  });
  it("between -5% and 5% is neutral", () => {
    expect(categorizePage(0)).toBe("neutral");
    expect(categorizePage(5)).toBe("neutral");
    expect(categorizePage(-5)).toBe("neutral");
  });
});

describe("experiment-tracker scorePage", () => {
  it("scores a winner", () => {
    const r = scorePage({ page: "/p", before: 100, after: 120 });
    expect(r.delta).toBe(20);
    expect(r.pctChange).toBe(20);
    expect(r.category).toBe("winner");
  });
  it("scores a loser", () => {
    const r = scorePage({ page: "/p", before: 100, after: 80 });
    expect(r.delta).toBe(-20);
    expect(r.pctChange).toBe(-20);
    expect(r.category).toBe("loser");
  });
});

describe("experiment-tracker computeAggregate", () => {
  it("returns zeros for empty input", () => {
    const agg = computeAggregate([]);
    expect(agg.totalBefore).toBe(0);
    expect(agg.winners).toBe(0);
    expect(agg.losers).toBe(0);
    expect(agg.neutral).toBe(0);
  });
  it("computes totals and counts correctly", () => {
    const pages = [
      scorePage({ page: "/p1", before: 100, after: 120 }), // +20% winner
      scorePage({ page: "/p2", before: 200, after: 150 }), // -25% loser
      scorePage({ page: "/p3", before: 100, after: 102 }), // +2% neutral
    ];
    const agg = computeAggregate(pages);
    expect(agg.totalBefore).toBe(400);
    expect(agg.totalAfter).toBe(372);
    expect(agg.totalDelta).toBe(-28);
    expect(agg.winners).toBe(1);
    expect(agg.losers).toBe(1);
    expect(agg.neutral).toBe(1);
  });
  it("computes average % change", () => {
    const pages = [
      scorePage({ page: "/p1", before: 100, after: 110 }), // +10%
      scorePage({ page: "/p2", before: 100, after: 120 }), // +20%
    ];
    const agg = computeAggregate(pages);
    expect(agg.avgPctChange).toBe(15);
  });
  it("totalPctChange = 0 when totalBefore is 0", () => {
    const pages = [scorePage({ page: "/p1", before: 0, after: 100 })];
    const agg = computeAggregate(pages);
    expect(agg.totalPctChange).toBe(0);
  });
});

describe("experiment-tracker checkSignificance", () => {
  it("returns winning when winners > losers AND avgPctChange > 5", () => {
    const agg = { winners: 5, losers: 1, neutral: 1, avgPctChange: 10, totalBefore: 0, totalAfter: 0, totalDelta: 0, totalPctChange: 0 };
    expect(checkSignificance(agg)).toBe("winning");
  });
  it("returns losing when losers > winners AND avgPctChange < -5", () => {
    const agg = { winners: 1, losers: 5, neutral: 1, avgPctChange: -10, totalBefore: 0, totalAfter: 0, totalDelta: 0, totalPctChange: 0 };
    expect(checkSignificance(agg)).toBe("losing");
  });
  it("returns inconclusive when mixed", () => {
    const agg = { winners: 3, losers: 3, neutral: 1, avgPctChange: 0, totalBefore: 0, totalAfter: 0, totalDelta: 0, totalPctChange: 0 };
    expect(checkSignificance(agg)).toBe("inconclusive");
  });
  it("returns inconclusive when winners > losers but avgPctChange ≤ 5", () => {
    const agg = { winners: 5, losers: 1, neutral: 0, avgPctChange: 3, totalBefore: 0, totalAfter: 0, totalDelta: 0, totalPctChange: 0 };
    expect(checkSignificance(agg)).toBe("inconclusive");
  });
});

describe("experiment-tracker computeStatus", () => {
  it("returns planned when today < startDate", () => {
    expect(computeStatus("2099-01-01", "2099-02-01", "2025-01-01")).toBe("planned");
  });
  it("returns running when today is between start and end", () => {
    expect(computeStatus("2025-01-01", "2099-02-01", "2025-06-01")).toBe("running");
  });
  it("returns completed when today > endDate", () => {
    expect(computeStatus("2024-01-01", "2024-06-01", "2025-01-01")).toBe("completed");
  });
  it("returns planned when both dates invalid", () => {
    expect(computeStatus("", "", "2025-01-01")).toBe("planned");
  });
  it("returns running when only start date is valid and today ≥ start", () => {
    expect(computeStatus("2025-01-01", "", "2025-06-01")).toBe("running");
  });
});

describe("experiment-tracker generateRecommendation", () => {
  it("winning → roll-out", () => {
    expect(generateRecommendation("winning", "running")).toBe("roll-out");
    expect(generateRecommendation("winning", "completed")).toBe("roll-out");
  });
  it("losing → roll-back", () => {
    expect(generateRecommendation("losing", "running")).toBe("roll-back");
    expect(generateRecommendation("losing", "completed")).toBe("roll-back");
  });
  it("inconclusive running → extend-test", () => {
    expect(generateRecommendation("inconclusive", "running")).toBe("extend-test");
  });
  it("planned → extend-test", () => {
    expect(generateRecommendation("inconclusive", "planned")).toBe("extend-test");
  });
});

describe("experiment-tracker computeConfidence", () => {
  it("returns 0 for no pages and 0% change", () => {
    expect(computeConfidence(0, 0)).toBe(0);
  });
  it("returns 100 for 30+ pages and 20%+ change", () => {
    expect(computeConfidence(30, 20)).toBe(100);
    expect(computeConfidence(50, 50)).toBe(100);
  });
  it("scales with sample size", () => {
    const small = computeConfidence(5, 10);
    const large = computeConfidence(25, 10);
    expect(large).toBeGreaterThan(small);
  });
  it("scales with magnitude", () => {
    const small = computeConfidence(15, 2);
    const large = computeConfidence(15, 18);
    expect(large).toBeGreaterThan(small);
  });
});

describe("experiment-tracker runExperiment", () => {
  it("runs full pipeline", () => {
    const input: ExperimentInput = {
      name: "Title tag test",
      type: "title-tag",
      hypothesis: "Better titles increase CTR",
      startDate: "2025-01-01",
      endDate: "2099-12-31",
      pagesAffected: 3,
      controlMetric: "clicks",
      beforeData: "/p1,100\n/p2,200\n/p3,100",
      afterData: "/p1,120\n/p2,240\n/p3,110",
    };
    const result = runExperiment(input);
    expect(result.pages).toHaveLength(3);
    expect(result.aggregate.winners).toBe(3);
    expect(result.significance).toBe("winning");
    expect(result.status).toBe("running");
    expect(result.recommendation).toBe("roll-out");
    expect(result.confidence).toBeGreaterThan(0);
  });
  it("handles empty inputs", () => {
    const input: ExperimentInput = {
      name: "",
      type: "title-tag",
      hypothesis: "",
      startDate: "",
      endDate: "",
      pagesAffected: 0,
      controlMetric: "clicks",
      beforeData: "",
      afterData: "",
    };
    const result = runExperiment(input);
    expect(result.pages).toEqual([]);
    expect(result.significance).toBe("inconclusive");
    expect(result.status).toBe("planned");
  });
});

describe("experiment-tracker filterPages", () => {
  const pages = [
    scorePage({ page: "/p1", before: 100, after: 120 }), // winner
    scorePage({ page: "/p2", before: 100, after: 80 }),  // loser
    scorePage({ page: "/p3", before: 100, after: 101 }), // neutral
  ];
  it("returns all when mode='all'", () => {
    expect(filterPages(pages, "all")).toHaveLength(3);
  });
  it("returns only winners when mode='winners'", () => {
    const out = filterPages(pages, "winners");
    expect(out).toHaveLength(1);
    expect(out[0].page).toBe("/p1");
  });
  it("returns only losers when mode='losers'", () => {
    const out = filterPages(pages, "losers");
    expect(out).toHaveLength(1);
    expect(out[0].page).toBe("/p2");
  });
});

describe("experiment-tracker computeSummaryStats", () => {
  it("computes summary stats from result", () => {
    const input: ExperimentInput = {
      name: "Test",
      type: "content-change",
      hypothesis: "",
      startDate: "2025-01-01",
      endDate: "2099-12-31",
      pagesAffected: 2,
      controlMetric: "organic-traffic",
      beforeData: "/p1,100\n/p2,200",
      afterData: "/p1,120\n/p2,180",
    };
    const result = runExperiment(input);
    const stats = computeSummaryStats(result);
    expect(stats.totalPages).toBe(2);
    expect(stats.winners).toBe(1);
    expect(stats.losers).toBe(1);
    expect(stats.significance).toBe("inconclusive");
  });
});

describe("experiment-tracker formatNumber", () => {
  it("formats numbers with separators", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
  it("handles decimals", () => {
    expect(formatNumber(1234.56)).toBe("1,234.56");
  });
  it("handles non-finite as 0", () => {
    expect(formatNumber(Number.NaN)).toBe("0");
  });
});

describe("experiment-tracker renderText", () => {
  it("renders a full report", () => {
    const input: ExperimentInput = {
      name: "Title test",
      type: "title-tag",
      hypothesis: "Better titles",
      startDate: "2025-01-01",
      endDate: "2099-12-31",
      pagesAffected: 2,
      controlMetric: "clicks",
      beforeData: "/p1,100\n/p2,200",
      afterData: "/p1,120\n/p2,240",
    };
    const result = runExperiment(input);
    const text = renderText(input, result);
    expect(text).toContain("SEO EXPERIMENT TRACKER REPORT");
    expect(text).toContain("Title test");
    expect(text).toContain("Title Tag");
    expect(text).toContain("Significance: Winning");
    expect(text).toContain("Confidence:");
    expect(text).toContain("Recommendation: Roll out");
    expect(text).toContain("/p1");
  });
  it("renders empty input gracefully", () => {
    const input: ExperimentInput = {
      name: "",
      type: "title-tag",
      hypothesis: "",
      startDate: "",
      endDate: "",
      pagesAffected: 0,
      controlMetric: "clicks",
      beforeData: "",
      afterData: "",
    };
    const result = runExperiment(input);
    const text = renderText(input, result);
    expect(text).toContain("(unnamed)");
  });
});

describe("experiment-tracker renderCsv", () => {
  it("renders header", () => {
    const input: ExperimentInput = {
      name: "",
      type: "title-tag",
      hypothesis: "",
      startDate: "",
      endDate: "",
      pagesAffected: 0,
      controlMetric: "clicks",
      beforeData: "",
      afterData: "",
    };
    const result = runExperiment(input);
    expect(renderCsv(result)).toContain("page,before,after,delta,pct_change,category");
  });
  it("renders page rows", () => {
    const input: ExperimentInput = {
      name: "",
      type: "title-tag",
      hypothesis: "",
      startDate: "",
      endDate: "",
      pagesAffected: 1,
      controlMetric: "clicks",
      beforeData: "/p1,100",
      afterData: "/p1,150",
    };
    const result = runExperiment(input);
    const csv = renderCsv(result);
    expect(csv).toContain("/p1,100,150,50,50,winner");
  });
});

describe("experiment-tracker history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      name: "Test",
      type: "title-tag",
      controlMetric: "clicks",
      pages: 5,
      avgPctChange: 10,
      significance: "winning",
      recommendation: "roll-out",
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].name).toBe("Test");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        name: `T${i}`,
        type: "title-tag",
        controlMetric: "clicks",
        pages: 1,
        avgPctChange: 0,
        significance: "inconclusive",
        recommendation: "extend-test",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      name: "X",
      type: "title-tag",
      controlMetric: "clicks",
      pages: 1,
      avgPctChange: 0,
      significance: "inconclusive",
      recommendation: "extend-test",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("experiment-tracker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const input: ExperimentInput = {
      name: "Title test",
      type: "title-tag",
      hypothesis: "Hyp",
      startDate: "2025-01-01",
      endDate: "2025-02-01",
      pagesAffected: 10,
      controlMetric: "clicks",
      beforeData: "/p,100",
      afterData: "/p,120",
    };
    const url = buildShareUrl(input);
    expect(url).toContain("name=Title+test");
    expect(url).toContain("type=title-tag");
    expect(url).toContain("start=2025-01-01");
    expect(url).toContain("metric=clicks");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const input: ExperimentInput = {
      name: "Title test",
      type: "meta-description",
      hypothesis: "Hyp text",
      startDate: "2025-01-01",
      endDate: "2025-02-01",
      pagesAffected: 10,
      controlMetric: "impressions",
      beforeData: "/p,100",
      afterData: "/p,120",
    };
    const url = buildShareUrl(input);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.name).toBe("Title test");
    expect(parsed.type).toBe("meta-description");
    expect(parsed.startDate).toBe("2025-01-01");
    expect(parsed.pagesAffected).toBe(10);
    expect(parsed.controlMetric).toBe("impressions");
    expect(parsed.beforeData).toBe("/p,100");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown type values", () => {
    const parsed = parseShareUrl("name=X&type=invalid-type");
    expect(parsed.name).toBe("X");
    expect(parsed.type).toBeUndefined();
  });
  it("filters unknown metric values", () => {
    const parsed = parseShareUrl("metric=invalid-metric");
    expect(parsed.controlMetric).toBeUndefined();
  });
});

// Suppress unused-import lint
export type _Unused = ExperimentType | ControlMetric;

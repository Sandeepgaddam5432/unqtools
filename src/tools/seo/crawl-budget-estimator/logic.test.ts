import { describe, it, expect, beforeEach } from "vitest";
import {
  SITE_PRESETS,
  HISTORY_KEY,
  HISTORY_MAX,
  validateInputs,
  normalizeInputs,
  computeFacetPenalty,
  computeEstimate,
  generateRecommendations,
  scoreColor,
  formatTime,
  formatNumber,
  buildComparison,
  renderTextReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CrawlInputs,
  type SitePresetKey,
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

const sampleInputs: CrawlInputs = {
  totalPages: 5000,
  avgPageSizeKb: 850,
  avgServerResponseMs: 350,
  crawlErrorsPercent: 5,
  duplicateContentPercent: 15,
  facetUrlCount: 800,
};

describe("crawl-budget-estimator constants", () => {
  it("has 4 site presets", () => {
    expect(SITE_PRESETS).toHaveLength(4);
  });
  it("presets cover small/medium/large/enterprise", () => {
    const keys = SITE_PRESETS.map((p) => p.key);
    expect(keys).toEqual(["small", "medium", "large", "enterprise"]);
  });
  it("history key is set", () => {
    expect(HISTORY_KEY).toBe("unqtools:crawl-budget-estimator:history");
  });
  it("history max is 20", () => {
    expect(HISTORY_MAX).toBe(20);
  });
});

describe("crawl-budget-estimator validateInputs", () => {
  it("passes for valid inputs", () => {
    expect(validateInputs(sampleInputs)).toEqual({});
  });
  it("rejects zero totalPages", () => {
    const e = validateInputs({ ...sampleInputs, totalPages: 0 });
    expect(e.totalPages).toBeTruthy();
  });
  it("rejects negative page size", () => {
    const e = validateInputs({ ...sampleInputs, avgPageSizeKb: -10 });
    expect(e.avgPageSizeKb).toBeTruthy();
  });
  it("rejects crawlErrorsPercent > 100", () => {
    const e = validateInputs({ ...sampleInputs, crawlErrorsPercent: 150 });
    expect(e.crawlErrorsPercent).toBeTruthy();
  });
  it("rejects negative duplicateContentPercent", () => {
    const e = validateInputs({ ...sampleInputs, duplicateContentPercent: -5 });
    expect(e.duplicateContentPercent).toBeTruthy();
  });
  it("rejects unrealistic totalPages", () => {
    const e = validateInputs({ ...sampleInputs, totalPages: 100_000_000 });
    expect(e.totalPages).toBeTruthy();
  });
});

describe("crawl-budget-estimator normalizeInputs", () => {
  it("fills defaults and clamps", () => {
    const n = normalizeInputs({ totalPages: 100, avgPageSizeKb: 500, avgServerResponseMs: 200 });
    expect(n.crawlErrorsPercent).toBe(0);
    expect(n.duplicateContentPercent).toBe(0);
    expect(n.facetUrlCount).toBe(0);
    expect(n.dailyCrawlRequests).toBeUndefined();
  });
  it("clamps percentages to 0-100", () => {
    const n = normalizeInputs({ ...sampleInputs, crawlErrorsPercent: 200, duplicateContentPercent: -10 });
    expect(n.crawlErrorsPercent).toBe(100);
    expect(n.duplicateContentPercent).toBe(0);
  });
  it("preserves positive dailyCrawlRequests", () => {
    const n = normalizeInputs({ ...sampleInputs, dailyCrawlRequests: 1500 });
    expect(n.dailyCrawlRequests).toBe(1500);
  });
  it("drops zero/negative dailyCrawlRequests", () => {
    const n = normalizeInputs({ ...sampleInputs, dailyCrawlRequests: 0 });
    expect(n.dailyCrawlRequests).toBeUndefined();
  });
});

describe("crawl-budget-estimator computeFacetPenalty", () => {
  it("returns 0 when totalPages is 0", () => {
    expect(computeFacetPenalty(100, 0)).toBe(0);
  });
  it("computes ratio", () => {
    expect(computeFacetPenalty(800, 5000)).toBeCloseTo(0.16, 2);
  });
  it("caps at 0.5", () => {
    expect(computeFacetPenalty(5000, 100)).toBe(0.5);
  });
});

describe("crawl-budget-estimator computeEstimate", () => {
  it("computes effective budget with both penalties", () => {
    const est = computeEstimate(sampleInputs);
    // 5000 * 0.85 * (1 - 0.16) = 5000 * 0.85 * 0.84 = 3570
    expect(est.effectiveBudget).toBe(3570);
  });
  it("duplicate penalty is decimal", () => {
    const est = computeEstimate(sampleInputs);
    expect(est.duplicatePenalty).toBeCloseTo(0.15, 5);
  });
  it("facet penalty is computed", () => {
    const est = computeEstimate(sampleInputs);
    expect(est.facetPenalty).toBeCloseTo(0.16, 2);
  });
  it("crawl rate is positive", () => {
    const est = computeEstimate(sampleInputs);
    expect(est.crawlRatePerPageMin).toBeGreaterThan(0);
  });
  it("efficiency is 0-100", () => {
    const est = computeEstimate(sampleInputs);
    expect(est.efficiencyPercent).toBeGreaterThan(0);
    expect(est.efficiencyPercent).toBeLessThanOrEqual(100);
  });
  it("time to full crawl is positive", () => {
    const est = computeEstimate(sampleInputs);
    expect(est.timeToFullCrawlMin).toBeGreaterThan(0);
  });
  it("score is 0-100", () => {
    const est = computeEstimate(sampleInputs);
    expect(est.score).toBeGreaterThanOrEqual(0);
    expect(est.score).toBeLessThanOrEqual(100);
  });
  it("estimated daily crawl requests is positive", () => {
    const est = computeEstimate(sampleInputs);
    expect(est.estimatedDailyCrawlRequests).toBeGreaterThan(0);
  });
  it("handles zero total pages gracefully", () => {
    const est = computeEstimate({ ...sampleInputs, totalPages: 0 });
    expect(est.effectiveBudget).toBe(0);
    expect(est.efficiencyPercent).toBe(0);
  });
});

describe("crawl-budget-estimator generateRecommendations", () => {
  it("recommends canonical for >10% duplicate", () => {
    const recs = generateRecommendations(sampleInputs, computeEstimate(sampleInputs));
    expect(recs.some((r) => r.rule === "duplicate-content")).toBe(true);
  });
  it("recommends facet-nav block when ratio > 0.3", () => {
    const inputs = { ...sampleInputs, facetUrlCount: 2000 };
    const recs = generateRecommendations(inputs, computeEstimate(inputs));
    expect(recs.some((r) => r.rule === "facet-nav")).toBe(true);
  });
  it("recommends TTFB optimization when >500ms", () => {
    const inputs = { ...sampleInputs, avgServerResponseMs: 800 };
    const recs = generateRecommendations(inputs, computeEstimate(inputs));
    expect(recs.some((r) => r.rule === "ttfb")).toBe(true);
  });
  it("recommends page-size optimization when >1000KB", () => {
    const inputs = { ...sampleInputs, avgPageSizeKb: 1500 };
    const recs = generateRecommendations(inputs, computeEstimate(inputs));
    expect(recs.some((r) => r.rule === "page-size")).toBe(true);
  });
  it("recommends crawl-error fix when >5%", () => {
    const inputs = { ...sampleInputs, crawlErrorsPercent: 12 };
    const recs = generateRecommendations(inputs, computeEstimate(inputs));
    expect(recs.some((r) => r.rule === "crawl-errors")).toBe(true);
  });
  it("recommends internal linking when efficiency <70", () => {
    const inputs = { ...sampleInputs, duplicateContentPercent: 50, facetUrlCount: 3000 };
    const est = computeEstimate(inputs);
    const recs = generateRecommendations(inputs, est);
    expect(recs.some((r) => r.rule === "internal-linking")).toBe(true);
  });
  it("returns all-clear when no issues", () => {
    const inputs: CrawlInputs = {
      totalPages: 100,
      avgPageSizeKb: 400,
      avgServerResponseMs: 150,
      crawlErrorsPercent: 1,
      duplicateContentPercent: 5,
      facetUrlCount: 5,
    };
    const est = computeEstimate(inputs);
    const recs = generateRecommendations(inputs, est);
    expect(recs).toHaveLength(1);
    expect(recs[0].rule).toBe("all-clear");
  });
  it("marks high duplicate as critical", () => {
    const inputs = { ...sampleInputs, duplicateContentPercent: 40 };
    const recs = generateRecommendations(inputs, computeEstimate(inputs));
    const dup = recs.find((r) => r.rule === "duplicate-content")!;
    expect(dup.severity).toBe("critical");
  });
});

describe("crawl-budget-estimator scoreColor", () => {
  it("returns Excellent for >=80", () => {
    expect(scoreColor(85).label).toBe("Excellent");
    expect(scoreColor(85).color).toBe("emerald");
  });
  it("returns Good for 60-79", () => {
    expect(scoreColor(65).label).toBe("Good");
  });
  it("returns Fair for 40-59", () => {
    expect(scoreColor(50).label).toBe("Fair");
  });
  it("returns Poor for 20-39", () => {
    expect(scoreColor(30).label).toBe("Poor");
  });
  it("returns Critical for <20", () => {
    expect(scoreColor(10).label).toBe("Critical");
    expect(scoreColor(10).color).toBe("red");
  });
});

describe("crawl-budget-estimator formatTime", () => {
  it("formats minutes <60", () => {
    expect(formatTime(30)).toBe("30.0 min");
  });
  it("formats hours <24", () => {
    expect(formatTime(120)).toBe("2.0 hours");
  });
  it("formats days", () => {
    expect(formatTime(60 * 24 * 3)).toBe("3.0 days");
  });
  it("returns dash for infinity", () => {
    expect(formatTime(Infinity)).toBe("—");
  });
});

describe("crawl-budget-estimator formatNumber", () => {
  it("formats numbers <1000 as-is", () => {
    expect(formatNumber(999)).toBe("999");
  });
  it("formats thousands with K", () => {
    expect(formatNumber(5000)).toBe("5.0K");
  });
  it("formats millions with M", () => {
    expect(formatNumber(2_500_000)).toBe("2.50M");
  });
});

describe("crawl-budget-estimator buildComparison", () => {
  it("builds 5 comparison rows", () => {
    const optimized = { ...sampleInputs, avgServerResponseMs: 150, avgPageSizeKb: 400 };
    const rows = buildComparison(sampleInputs, optimized);
    expect(rows).toHaveLength(5);
    expect(rows[0].metric).toBe("Effective crawl budget");
  });
  it("optimized inputs improve score", () => {
    const optimized: CrawlInputs = {
      totalPages: 5000,
      avgPageSizeKb: 400,
      avgServerResponseMs: 150,
      crawlErrorsPercent: 1,
      duplicateContentPercent: 5,
      facetUrlCount: 100,
    };
    const rows = buildComparison(sampleInputs, optimized);
    const scoreRow = rows.find((r) => r.metric.startsWith("Score"))!;
    expect(scoreRow.delta).toContain("+");
  });
});

describe("crawl-budget-estimator renderTextReport", () => {
  it("includes input section", () => {
    const est = computeEstimate(sampleInputs);
    const recs = generateRecommendations(sampleInputs, est);
    const text = renderTextReport(sampleInputs, est, recs);
    expect(text).toContain("INPUTS");
    expect(text).toContain("Total pages:");
    expect(text).toContain("5.0K");
  });
  it("includes estimate section", () => {
    const est = computeEstimate(sampleInputs);
    const recs = generateRecommendations(sampleInputs, est);
    const text = renderTextReport(sampleInputs, est, recs);
    expect(text).toContain("ESTIMATES");
    expect(text).toContain("Crawl rate:");
    expect(text).toContain("Crawl efficiency:");
  });
  it("includes recommendations", () => {
    const est = computeEstimate(sampleInputs);
    const recs = generateRecommendations(sampleInputs, est);
    const text = renderTextReport(sampleInputs, est, recs);
    expect(text).toContain("RECOMMENDATIONS");
    expect(text).toContain("[WARNING]");
  });
});

describe("crawl-budget-estimator renderCsv", () => {
  it("has metric,value header", () => {
    const est = computeEstimate(sampleInputs);
    const recs = generateRecommendations(sampleInputs, est);
    const csv = renderCsv(sampleInputs, est, recs);
    expect(csv).toContain("metric,value");
  });
  it("includes total_pages row", () => {
    const est = computeEstimate(sampleInputs);
    const csv = renderCsv(sampleInputs, est, []);
    expect(csv).toContain("total_pages,5000");
  });
  it("includes recommendations section", () => {
    const est = computeEstimate(sampleInputs);
    const recs = generateRecommendations(sampleInputs, est);
    const csv = renderCsv(sampleInputs, est, recs);
    expect(csv).toContain("rule,severity,message");
    expect(csv).toContain("duplicate-content");
  });
});

describe("crawl-budget-estimator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const est = computeEstimate(sampleInputs);
    saveHistory({ ts: 1, inputs: sampleInputs, estimate: est, recommendationCount: 5 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    const est = computeEstimate(sampleInputs);
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, inputs: sampleInputs, estimate: est, recommendationCount: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    const est = computeEstimate(sampleInputs);
    saveHistory({ ts: 1, inputs: sampleInputs, estimate: est, recommendationCount: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("crawl-budget-estimator shareable URL", () => {
  it("builds share URL with all params when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(sampleInputs);
    expect(url).toContain("pages=5000");
    expect(url).toContain("size=850");
    expect(url).toContain("ttfb=350");
    expect(url).toContain("errors=5");
    expect(url).toContain("dup=15");
    expect(url).toContain("facet=800");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("pages=5000&size=850&ttfb=350&errors=5&dup=15&facet=800");
    expect(p.totalPages).toBe(5000);
    expect(p.avgPageSizeKb).toBe(850);
    expect(p.avgServerResponseMs).toBe(350);
    expect(p.crawlErrorsPercent).toBe(5);
    expect(p.duplicateContentPercent).toBe(15);
    expect(p.facetUrlCount).toBe(800);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("parses daily param", () => {
    const p = parseShareUrl("pages=100&size=500&ttfb=200&errors=0&dup=0&facet=0&daily=1500");
    expect(p.dailyCrawlRequests).toBe(1500);
  });
  it("ignores NaN params", () => {
    const p = parseShareUrl("pages=notanumber&size=500");
    expect(p.totalPages).toBeUndefined();
    expect(p.avgPageSizeKb).toBe(500);
  });
});

// Suppress unused-import lint
export type _Unused = SitePresetKey;

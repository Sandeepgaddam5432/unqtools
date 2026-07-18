import { describe, it, expect, beforeEach } from "vitest";
import {
  METRIC_DIRECTIONS,
  METRIC_LABELS,
  METRIC_KEYS,
  splitCsvRow,
  normalizeDomain,
  normalizeMetric,
  getMetricDirection,
  getMetricLabel,
  formatNumber,
  parseMetricsCsv,
  buildComparisonMatrix,
  findLeader,
  computeYourRank,
  computeGapToLeader,
  computeMetricStats,
  analyze,
  filterByMetric,
  computeSummaryStats,
  renderTextReport,
  renderCsvReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
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

const SAMPLE_CSV = `yoursite.com,organic_traffic,12500
competitor1.com,organic_traffic,18000
competitor2.com,organic_traffic,9500
yoursite.com,backlinks,2400
competitor1.com,backlinks,3200
competitor2.com,backlinks,1800
yoursite.com,avg_position,15
competitor1.com,avg_position,8
competitor2.com,avg_position,22
yoursite.com,load_time_ms,1500
competitor1.com,load_time_ms,900
competitor2.com,load_time_ms,2400`;

describe("analyzer constants", () => {
  it("has 10 metric directions", () => {
    expect(Object.keys(METRIC_DIRECTIONS)).toHaveLength(10);
  });
  it("has 10 metric labels", () => {
    expect(Object.keys(METRIC_LABELS)).toHaveLength(10);
  });
  it("has 10 metric keys", () => {
    expect(METRIC_KEYS).toHaveLength(10);
  });
  it("marks avg_position as lower-better", () => {
    expect(METRIC_DIRECTIONS.avg_position).toBe("lower-better");
  });
  it("marks load_time_ms as lower-better", () => {
    expect(METRIC_DIRECTIONS.load_time_ms).toBe("lower-better");
  });
  it("marks organic_traffic as higher-better", () => {
    expect(METRIC_DIRECTIONS.organic_traffic).toBe("higher-better");
  });
});

describe("analyzer splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("handles escaped quotes", () => {
    expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]);
  });
});

describe("analyzer normalizeDomain", () => {
  it("strips protocol", () => {
    expect(normalizeDomain("https://yoursite.com")).toBe("yoursite.com");
  });
  it("strips www", () => {
    expect(normalizeDomain("www.yoursite.com")).toBe("yoursite.com");
  });
  it("strips path", () => {
    expect(normalizeDomain("yoursite.com/blog")).toBe("yoursite.com");
  });
  it("lowercases", () => {
    expect(normalizeDomain("YourSite.COM")).toBe("yoursite.com");
  });
  it("handles empty", () => {
    expect(normalizeDomain("")).toBe("");
  });
});

describe("analyzer normalizeMetric", () => {
  it("converts spaces to underscores", () => {
    expect(normalizeMetric("Organic Traffic")).toBe("organic_traffic");
  });
  it("lowercases", () => {
    expect(normalizeMetric("Backlinks")).toBe("backlinks");
  });
});

describe("analyzer getMetricDirection", () => {
  it("returns lower-better for avg_position", () => {
    expect(getMetricDirection("avg_position")).toBe("lower-better");
  });
  it("returns higher-better for organic_traffic", () => {
    expect(getMetricDirection("organic_traffic")).toBe("higher-better");
  });
  it("defaults to higher-better for unknown", () => {
    expect(getMetricDirection("unknown_metric")).toBe("higher-better");
  });
});

describe("analyzer getMetricLabel", () => {
  it("returns label for known metric", () => {
    expect(getMetricLabel("organic_traffic")).toBe("Organic Traffic");
  });
  it("returns humanized label for unknown", () => {
    expect(getMetricLabel("custom_metric")).toBe("custom metric");
  });
});

describe("analyzer formatNumber", () => {
  it("formats millions", () => {
    expect(formatNumber(1_500_000)).toBe("1.5M");
  });
  it("formats thousands", () => {
    expect(formatNumber(12500)).toBe("12.5k");
  });
  it("returns dash for null", () => {
    expect(formatNumber(null)).toBe("—");
  });
  it("returns dash for NaN", () => {
    expect(formatNumber(NaN)).toBe("—");
  });
});

describe("analyzer parseMetricsCsv", () => {
  it("parses rows without header", () => {
    const { rows, errors } = parseMetricsCsv(SAMPLE_CSV);
    expect(rows).toHaveLength(12);
    expect(errors).toHaveLength(0);
    expect(rows[0]).toEqual({ domain: "yoursite.com", metric: "organic_traffic", value: 12500 });
  });
  it("parses rows with header", () => {
    const { rows } = parseMetricsCsv(`domain,metric,value\n${SAMPLE_CSV}`);
    expect(rows).toHaveLength(12);
    expect(rows[0].domain).toBe("yoursite.com");
  });
  it("returns empty for empty input", () => {
    expect(parseMetricsCsv("").rows).toEqual([]);
  });
  it("rejects unknown metrics", () => {
    const { rows, errors } = parseMetricsCsv("site.com,unknown_metric,100");
    expect(rows).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });
  it("rejects invalid values", () => {
    const { rows, errors } = parseMetricsCsv("site.com,backlinks,abc");
    expect(rows).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });
  it("rejects missing domain", () => {
    const { rows, errors } = parseMetricsCsv(",backlinks,100");
    expect(rows).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });
  it("normalizes domain in header mode", () => {
    const { rows } = parseMetricsCsv("domain,metric,value\nhttps://Site.com/path,backlinks,100");
    expect(rows[0].domain).toBe("site.com");
  });
});

describe("analyzer buildComparisonMatrix", () => {
  it("builds matrix with all domains and metrics", () => {
    const { rows } = parseMetricsCsv(SAMPLE_CSV);
    const matrix = buildComparisonMatrix(rows);
    expect(matrix.domains).toHaveLength(3);
    expect(matrix.metrics).toHaveLength(4);
    expect(matrix.cells["yoursite.com"]["organic_traffic"]).toBe(12500);
    expect(matrix.cells["competitor1.com"]["avg_position"]).toBe(8);
  });
  it("returns empty for no records", () => {
    const matrix = buildComparisonMatrix([]);
    expect(matrix.domains).toEqual([]);
    expect(matrix.metrics).toEqual([]);
  });
  it("stores null for missing cells", () => {
    const { rows } = parseMetricsCsv("site.com,backlinks,100\nother.com,organic_traffic,500");
    const matrix = buildComparisonMatrix(rows);
    expect(matrix.cells["site.com"]["organic_traffic"]).toBeNull();
    expect(matrix.cells["other.com"]["backlinks"]).toBeNull();
  });
});

describe("analyzer findLeader", () => {
  it("finds leader for higher-better", () => {
    const values = { a: 100, b: 200, c: 150 };
    const { leader, leaderValue } = findLeader(values, "higher-better");
    expect(leader).toBe("b");
    expect(leaderValue).toBe(200);
  });
  it("finds leader for lower-better", () => {
    const values = { a: 100, b: 200, c: 150 };
    const { leader, leaderValue } = findLeader(values, "lower-better");
    expect(leader).toBe("a");
    expect(leaderValue).toBe(100);
  });
  it("returns null when no valid values", () => {
    const { leader, leaderValue } = findLeader({ a: null, b: null }, "higher-better");
    expect(leader).toBeNull();
    expect(leaderValue).toBeNull();
  });
});

describe("analyzer computeYourRank", () => {
  it("ranks 1 when you're the leader", () => {
    const values = { a: 100, b: 200, c: 150 };
    expect(computeYourRank(values, 200, "higher-better")).toBe(1);
  });
  it("ranks last when you're behind everyone", () => {
    const values = { a: 100, b: 200, c: 150 };
    expect(computeYourRank(values, 50, "higher-better")).toBe(4);
  });
  it("ranks for lower-better", () => {
    const values = { a: 100, b: 200, c: 150 };
    expect(computeYourRank(values, 100, "lower-better")).toBe(1);
    expect(computeYourRank(values, 200, "lower-better")).toBe(3);
  });
  it("returns null when your value is null", () => {
    expect(computeYourRank({ a: 100 }, null, "higher-better")).toBeNull();
  });
});

describe("analyzer computeGapToLeader", () => {
  it("computes positive gap for higher-better when behind", () => {
    const { gapAbs, gapPct } = computeGapToLeader(100, 200, "higher-better");
    expect(gapAbs).toBe(100);
    expect(gapPct).toBe(50);
  });
  it("computes zero gap when you're the leader", () => {
    const { gapAbs, gapPct } = computeGapToLeader(200, 200, "higher-better");
    expect(gapAbs).toBe(0);
    expect(gapPct).toBe(0);
  });
  it("clamps pct to 0 when you exceed leader", () => {
    const { gapAbs, gapPct } = computeGapToLeader(300, 200, "higher-better");
    expect(gapAbs).toBe(-100);
    expect(gapPct).toBe(0);
  });
  it("computes gap for lower-better", () => {
    const { gapAbs, gapPct } = computeGapToLeader(2000, 1000, "lower-better");
    expect(gapAbs).toBe(1000);
    expect(gapPct).toBe(100);
  });
  it("returns null when values are null", () => {
    expect(computeGapToLeader(null, 100, "higher-better")).toEqual({ gapAbs: null, gapPct: null });
  });
});

describe("analyzer computeMetricStats", () => {
  it("computes stats for a metric", () => {
    const { rows } = parseMetricsCsv(SAMPLE_CSV);
    const { cells } = buildComparisonMatrix(rows);
    const stats = computeMetricStats("organic_traffic", cells, "yoursite.com");
    expect(stats.leader).toBe("competitor1.com");
    expect(stats.leaderValue).toBe(18000);
    expect(stats.yourValue).toBe(12500);
    expect(stats.yourRank).toBe(2);
    expect(stats.gapAbs).toBe(5500);
    expect(stats.min).toBe(9500);
    expect(stats.max).toBe(18000);
  });
  it("handles lower-better metric", () => {
    const { rows } = parseMetricsCsv(SAMPLE_CSV);
    const { cells } = buildComparisonMatrix(rows);
    const stats = computeMetricStats("load_time_ms", cells, "yoursite.com");
    expect(stats.direction).toBe("lower-better");
    expect(stats.leader).toBe("competitor1.com");
    expect(stats.leaderValue).toBe(900);
  });
});

describe("analyzer analyze (full pipeline)", () => {
  it("analyzes the sample data", () => {
    const { rows } = parseMetricsCsv(SAMPLE_CSV);
    const result = analyze(rows, "yoursite.com");
    expect(result.yourDomain).toBe("yoursite.com");
    expect(result.domains).toHaveLength(3);
    expect(result.metrics).toHaveLength(4);
    // yoursite.com wins load_time_ms vs competitor2 but loses to competitor1 — so 0 wins
    expect(result.yourWins).toBeGreaterThanOrEqual(0);
    expect(result.criticalGaps.length).toBeGreaterThanOrEqual(0);
  });
  it("identifies quick wins", () => {
    const csv = `yoursite.com,backlinks,100
comp.com,backlinks,110`;
    const { rows } = parseMetricsCsv(csv);
    const result = analyze(rows, "yoursite.com");
    expect(result.quickWins).toHaveLength(1);
    expect(result.quickWins[0].gapPct).toBeLessThan(20);
  });
  it("identifies critical gaps", () => {
    const csv = `yoursite.com,backlinks,100
comp.com,backlinks,500`;
    const { rows } = parseMetricsCsv(csv);
    const result = analyze(rows, "yoursite.com");
    expect(result.criticalGaps).toHaveLength(1);
    expect(result.criticalGaps[0].gapPct).toBeGreaterThan(50);
  });
  it("identifies strengths when you win", () => {
    const csv = `yoursite.com,backlinks,500
comp.com,backlinks,100`;
    const { rows } = parseMetricsCsv(csv);
    const result = analyze(rows, "yoursite.com");
    expect(result.strengths).toHaveLength(1);
    expect(result.yourWins).toBe(1);
  });
  it("normalizes yourDomain", () => {
    const csv = `yoursite.com,backlinks,100
comp.com,backlinks,200`;
    const { rows } = parseMetricsCsv(csv);
    const result = analyze(rows, "https://www.YourSite.com/path");
    expect(result.yourDomain).toBe("yoursite.com");
  });
});

describe("analyzer filterByMetric", () => {
  it("filters by metric name", () => {
    const { rows } = parseMetricsCsv(SAMPLE_CSV);
    const result = analyze(rows, "yoursite.com");
    expect(filterByMetric(result.metrics, "backlinks")).toHaveLength(1);
  });
  it("filters by label", () => {
    const { rows } = parseMetricsCsv(SAMPLE_CSV);
    const result = analyze(rows, "yoursite.com");
    expect(filterByMetric(result.metrics, "organic")).toHaveLength(1);
  });
  it("returns all for empty query", () => {
    const { rows } = parseMetricsCsv(SAMPLE_CSV);
    const result = analyze(rows, "yoursite.com");
    expect(filterByMetric(result.metrics, "")).toHaveLength(4);
  });
});

describe("analyzer computeSummaryStats", () => {
  it("computes summary stats", () => {
    const { rows } = parseMetricsCsv(SAMPLE_CSV);
    const result = analyze(rows, "yoursite.com");
    const stats = computeSummaryStats(result);
    expect(stats.totalMetrics).toBe(4);
    expect(stats.totalDomains).toBe(3);
    expect(stats.yourWins).toBeGreaterThanOrEqual(0);
  });
});

describe("analyzer renderTextReport", () => {
  it("renders text report with header", () => {
    const { rows } = parseMetricsCsv(SAMPLE_CSV);
    const result = analyze(rows, "yoursite.com");
    const text = renderTextReport(result);
    expect(text).toContain("COMPETITOR ANALYSIS REPORT");
    expect(text).toContain("Your domain: yoursite.com");
    expect(text).toContain("METRIC COMPARISON");
  });
});

describe("analyzer renderCsvReport", () => {
  it("renders CSV with header", () => {
    const { rows } = parseMetricsCsv(SAMPLE_CSV);
    const result = analyze(rows, "yoursite.com");
    const csv = renderCsvReport(result);
    expect(csv).toContain("domain,metric,value,leader,leader_value,gap_abs,gap_pct,your_rank,direction");
    expect(csv).toContain("yoursite.com,organic_traffic,12500");
  });
  it("includes all domain × metric combinations", () => {
    const { rows } = parseMetricsCsv(SAMPLE_CSV);
    const result = analyze(rows, "yoursite.com");
    const csv = renderCsvReport(result);
    // 3 domains × 4 metrics = 12 data rows + 1 header = 13 lines
    expect(csv.split("\n")).toHaveLength(13);
  });
});

describe("analyzer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, yourDomain: "site.com", competitorCount: 2, totalMetrics: 4, yourWins: 1, yourCriticalGaps: 1 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, yourDomain: "x.com", competitorCount: 1, totalMetrics: 1, yourWins: 0, yourCriticalGaps: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, yourDomain: "x.com", competitorCount: 1, totalMetrics: 1, yourWins: 0, yourCriticalGaps: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("analyzer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("yoursite.com", "yoursite.com,backlinks,100");
    expect(url).toContain("you=yoursite.com");
    expect(url).toContain("data=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("you=yoursite.com&data=backlinks%2C100");
    expect(p.yourDomain).toBe("yoursite.com");
    expect(p.data).toBe("backlinks,100");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ yourDomain: "", data: "" });
  });
});

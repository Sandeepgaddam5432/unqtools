import { describe, it, expect, beforeEach } from "vitest";
import {
  PLATFORMS,
  PLATFORM_LABELS,
  METRICS,
  METRIC_LABELS,
  DATE_GROUPINGS,
  DATE_GROUPING_LABELS,
  CSV_HEADER,
  BAR_WIDTH,
  LINE_GRID_W,
  LINE_GRID_H,
  normalizePlatform,
  isValidIsoDate,
  getIsoWeek,
  formatNumber,
  computeEngagementRate,
  getMetricValue,
  splitCsvRow,
  parseCsv,
  groupDate,
  filterByPlatform,
  groupMetrics,
  aggregateByPlatform,
  calculateGrowthRate,
  findBestPeriod,
  findWorstPeriod,
  computePeriodGrowth,
  renderAsciiBarChart,
  renderAsciiLineChart,
  renderKpiCard,
  renderKpiCards,
  analyzeFollowerTrend,
  computePlatformComparison,
  computeSummaryStats,
  renderCsv,
  renderTextDashboard,
  renderHtmlDashboard,
  renderMarkdownDashboard,
  buildDashboard,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Platform,
  type Metric,
  type DateGrouping,
  type PlatformFilter,
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

const SAMPLE_CSV = [
  "date,platform,followers,posts,engagement,impressions,reach",
  "2024-01-01,twitter,1200,5,180,5000,4200",
  "2024-01-08,twitter,1350,7,210,5600,4800",
  "2024-01-15,twitter,1500,6,240,6200,5300",
  "2024-01-01,instagram,3500,8,520,12000,10500",
  "2024-01-08,instagram,3800,10,610,14000,11800",
  "2024-01-15,instagram,4100,9,680,15500,13200",
].join("\n");

describe("analytics-dashboard constants", () => {
  it("has 6 platforms", () => {
    expect(PLATFORMS).toHaveLength(6);
  });
  it("has 6 platform labels", () => {
    expect(Object.keys(PLATFORM_LABELS)).toHaveLength(6);
  });
  it("has 6 metrics", () => {
    expect(METRICS).toHaveLength(6);
  });
  it("has 6 metric labels", () => {
    expect(Object.keys(METRIC_LABELS)).toHaveLength(6);
  });
  it("has 3 date groupings", () => {
    expect(DATE_GROUPINGS).toHaveLength(3);
  });
  it("has CSV_HEADER with 7 columns", () => {
    expect(CSV_HEADER).toHaveLength(7);
    expect(CSV_HEADER[0]).toBe("date");
  });
  it("bar chart width is 30", () => {
    expect(BAR_WIDTH).toBe(30);
  });
  it("line chart grid is 10×5", () => {
    expect(LINE_GRID_W).toBe(10);
    expect(LINE_GRID_H).toBe(5);
  });
});

describe("analytics-dashboard normalizePlatform", () => {
  it("normalizes known platforms", () => {
    expect(normalizePlatform("Twitter")).toBe("twitter");
    expect(normalizePlatform("INSTAGRAM")).toBe("instagram");
  });
  it("resolves aliases", () => {
    expect(normalizePlatform("x")).toBe("twitter");
    expect(normalizePlatform("ig")).toBe("instagram");
    expect(normalizePlatform("fb")).toBe("facebook");
    expect(normalizePlatform("yt")).toBe("youtube");
  });
  it("returns null for unknown", () => {
    expect(normalizePlatform("snapchat")).toBeNull();
    expect(normalizePlatform("")).toBeNull();
  });
});

describe("analytics-dashboard isValidIsoDate", () => {
  it("accepts valid ISO dates", () => {
    expect(isValidIsoDate("2024-01-15")).toBe(true);
    expect(isValidIsoDate("2024-12-31")).toBe(true);
  });
  it("rejects malformed", () => {
    expect(isValidIsoDate("2024-1-5")).toBe(false);
    expect(isValidIsoDate("01/15/2024")).toBe(false);
    expect(isValidIsoDate("not-a-date")).toBe(false);
  });
  it("rejects impossible calendar dates", () => {
    expect(isValidIsoDate("2024-13-01")).toBe(false);
    expect(isValidIsoDate("2024-02-30")).toBe(false);
  });
});

describe("analytics-dashboard getIsoWeek", () => {
  it("returns week 1 for Jan 1 2024", () => {
    const w = getIsoWeek(new Date("2024-01-01T00:00:00Z"));
    expect(w.week).toBe(1);
    expect(w.year).toBe(2024);
  });
  it("returns week 1 for Dec 30 2024 (Monday of ISO 2025-W01)", () => {
    const w = getIsoWeek(new Date("2024-12-30T00:00:00Z"));
    expect(w.week).toBe(1);
    expect(w.year).toBe(2025);
  });
  it("returns week 52 for Dec 25 2024 (Wednesday)", () => {
    const w = getIsoWeek(new Date("2024-12-25T00:00:00Z"));
    expect(w.week).toBe(52);
    expect(w.year).toBe(2024);
  });
});

describe("analytics-dashboard formatNumber", () => {
  it("formats thousands", () => {
    expect(formatNumber(1200)).toBe("1.2K");
  });
  it("formats millions", () => {
    expect(formatNumber(1_500_000)).toBe("1.50M");
  });
  it("formats small numbers", () => {
    expect(formatNumber(42)).toBe("42");
    expect(formatNumber(3.14)).toBe("3.14");
  });
  it("handles Infinity", () => {
    expect(formatNumber(Infinity)).toBe("—");
  });
});

describe("analytics-dashboard computeEngagementRate", () => {
  it("computes percentage", () => {
    expect(computeEngagementRate(180, 5000)).toBeCloseTo(3.6, 2);
  });
  it("returns 0 for zero impressions", () => {
    expect(computeEngagementRate(100, 0)).toBe(0);
  });
  it("returns 0 for negative impressions", () => {
    expect(computeEngagementRate(100, -5)).toBe(0);
  });
});

describe("analytics-dashboard getMetricValue", () => {
  const row = {
    date: "2024-01-01", platform: "twitter" as Platform,
    followers: 100, posts: 5, engagement: 50,
    impressions: 1000, reach: 800,
  };
  it("returns raw value for direct metrics", () => {
    expect(getMetricValue(row, "followers")).toBe(100);
    expect(getMetricValue(row, "posts")).toBe(5);
    expect(getMetricValue(row, "impressions")).toBe(1000);
  });
  it("computes engagement-rate", () => {
    expect(getMetricValue(row, "engagement-rate")).toBeCloseTo(5, 2);
  });
});

describe("analytics-dashboard splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("trims whitespace", () => {
    expect(splitCsvRow(" a , b , c ")).toEqual(["a", "b", "c"]);
  });
});

describe("analytics-dashboard parseCsv", () => {
  it("parses valid CSV with header", () => {
    const r = parseCsv(SAMPLE_CSV);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(6);
    expect(r.rows[0].platform).toBe("twitter");
    expect(r.rows[0].followers).toBe(1200);
  });
  it("parses CSV without header (skips header detection if first row not date)", () => {
    const csv = "2024-01-01,twitter,100,1,10,500,400\n2024-01-02,twitter,200,2,20,1000,800";
    const r = parseCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(2);
  });
  it("returns empty for empty input", () => {
    const r = parseCsv("");
    expect(r.rows).toEqual([]);
    expect(r.errors).toEqual([]);
  });
  it("collects errors for invalid rows", () => {
    const csv = [
      "date,platform,followers,posts,engagement,impressions,reach",
      "not-a-date,twitter,100,1,10,500,400",
      "2024-01-02,snapchat,200,2,20,1000,800",
      "2024-01-03,twitter,-5,2,20,1000,800",
      "2024-01-04,twitter,100,1,10,500,400",
    ].join("\n");
    const r = parseCsv(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toHaveLength(3);
    expect(r.errors[0].line).toBe(2);
    expect(r.errors[1].line).toBe(3);
    expect(r.errors[2].line).toBe(4);
  });
  it("reports column count mismatch", () => {
    const csv = "date,platform,followers,posts,engagement,impressions,reach\n2024-01-01,twitter,100,1,10,500";
    const r = parseCsv(csv);
    expect(r.rows).toHaveLength(0);
    expect(r.errors[0].message).toContain("7 columns");
  });
  it("accepts platform aliases", () => {
    const csv = "date,platform,followers,posts,engagement,impressions,reach\n2024-01-01,x,100,1,10,500,400\n2024-01-02,ig,200,2,20,1000,800";
    const r = parseCsv(csv);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].platform).toBe("twitter");
    expect(r.rows[1].platform).toBe("instagram");
  });
});

describe("analytics-dashboard groupDate", () => {
  it("daily returns the date unchanged", () => {
    expect(groupDate("2024-01-15", "daily")).toBe("2024-01-15");
  });
  it("monthly returns YYYY-MM", () => {
    expect(groupDate("2024-01-15", "monthly")).toBe("2024-01");
  });
  it("weekly returns YYYY-W##", () => {
    const key = groupDate("2024-01-15", "weekly");
    expect(key).toMatch(/^\d{4}-W\d{2}$/);
  });
});

describe("analytics-dashboard filterByPlatform", () => {
  const rows = parseCsv(SAMPLE_CSV).rows;
  it("returns all when filter is all", () => {
    expect(filterByPlatform(rows, "all")).toHaveLength(6);
  });
  it("filters by platform", () => {
    const filtered = filterByPlatform(rows, "twitter");
    expect(filtered).toHaveLength(3);
    expect(filtered.every((r) => r.platform === "twitter")).toBe(true);
  });
});

describe("analytics-dashboard groupMetrics", () => {
  const rows = parseCsv(SAMPLE_CSV).rows;
  it("groups by month with all platforms", () => {
    const g = groupMetrics(rows, "monthly", "followers", "all");
    expect(g).toHaveLength(1);
    expect(g[0].group).toBe("2024-01");
    expect(g[0].count).toBe(6);
  });
  it("groups by day for twitter", () => {
    const g = groupMetrics(rows, "daily", "followers", "twitter");
    expect(g).toHaveLength(3);
    expect(g[0].group).toBe("2024-01-01");
  });
  it("computes total and avg", () => {
    const g = groupMetrics(rows, "monthly", "engagement", "all");
    const total = 180 + 210 + 240 + 520 + 610 + 680;
    expect(g[0].total).toBe(total);
    expect(g[0].avg).toBeCloseTo(total / 6, 2);
  });
  it("handles engagement-rate metric", () => {
    const g = groupMetrics(rows, "monthly", "engagement-rate", "all");
    expect(g[0].total).toBeGreaterThan(0);
    expect(g[0].count).toBe(6);
  });
  it("returns empty for empty rows", () => {
    expect(groupMetrics([], "monthly", "followers", "all")).toEqual([]);
  });
  it("sorts groups chronologically", () => {
    const g = groupMetrics(rows, "daily", "followers", "all");
    const groups = g.map((x) => x.group);
    const sorted = [...groups].sort();
    expect(groups).toEqual(sorted);
  });
});

describe("analytics-dashboard aggregateByPlatform", () => {
  it("groups rows by platform and sorts by date", () => {
    const rows = parseCsv(SAMPLE_CSV).rows;
    const m = aggregateByPlatform(rows);
    expect(m.size).toBe(2);
    const tw = m.get("twitter")!;
    expect(tw[0].date).toBe("2024-01-01");
    expect(tw[2].date).toBe("2024-01-15");
  });
});

describe("analytics-dashboard calculateGrowthRate", () => {
  it("computes positive growth", () => {
    const g = calculateGrowthRate(150, 100);
    expect(g.rate).toBeCloseTo(50, 2);
    expect(g.direction).toBe("up");
  });
  it("computes negative growth", () => {
    const g = calculateGrowthRate(80, 100);
    expect(g.rate).toBeCloseTo(-20, 2);
    expect(g.direction).toBe("down");
  });
  it("detects flat", () => {
    const g = calculateGrowthRate(100, 100);
    expect(g.direction).toBe("flat");
  });
  it("handles previous=0 with positive current", () => {
    const g = calculateGrowthRate(50, 0);
    expect(g.rate).toBe(Infinity);
    expect(g.direction).toBe("up");
  });
});

describe("analytics-dashboard findBest/findWorstPeriod", () => {
  const rows = parseCsv(SAMPLE_CSV).rows;
  const groups = groupMetrics(rows, "daily", "followers", "all");
  it("finds best period (max total)", () => {
    const best = findBestPeriod(groups);
    expect(best).not.toBeNull();
    expect(best!.value).toBeGreaterThan(0);
  });
  it("finds worst period (min total)", () => {
    const worst = findWorstPeriod(groups);
    expect(worst).not.toBeNull();
  });
  it("best >= worst", () => {
    const best = findBestPeriod(groups)!;
    const worst = findWorstPeriod(groups)!;
    expect(best.value).toBeGreaterThanOrEqual(worst.value);
  });
  it("returns null for empty groups", () => {
    expect(findBestPeriod([])).toBeNull();
    expect(findWorstPeriod([])).toBeNull();
  });
});

describe("analytics-dashboard computePeriodGrowth", () => {
  it("computes growth between last two groups", () => {
    const groups = [
      { group: "2024-01", total: 100, avg: 100, count: 1 },
      { group: "2024-02", total: 150, avg: 150, count: 1 },
    ];
    const g = computePeriodGrowth(groups);
    expect(g.current).toBe(150);
    expect(g.previous).toBe(100);
    expect(g.rate).toBeCloseTo(50, 2);
    expect(g.direction).toBe("up");
  });
  it("returns flat for single group", () => {
    const g = computePeriodGrowth([{ group: "x", total: 100, avg: 100, count: 1 }]);
    expect(g.direction).toBe("flat");
  });
});

describe("analytics-dashboard renderAsciiBarChart", () => {
  it("renders chart with bars of width 30", () => {
    const rows = parseCsv(SAMPLE_CSV).rows;
    const groups = groupMetrics(rows, "monthly", "followers", "all");
    const chart = renderAsciiBarChart(groups, "followers");
    expect(chart).toContain("Followers");
    expect(chart).toContain("█");
    const barLine = chart.split("\n").find((l) => l.includes("█"))!;
    // bar between |...| is 30 chars
    const match = barLine.match(/\|([█░]+)\|/);
    expect(match).not.toBeNull();
    expect(match![1]).toHaveLength(30);
  });
  it("returns placeholder for empty", () => {
    expect(renderAsciiBarChart([], "followers")).toBe("(no data)");
  });
});

describe("analytics-dashboard renderAsciiLineChart", () => {
  it("renders 5-row grid", () => {
    const rows = parseCsv(SAMPLE_CSV).rows;
    const groups = groupMetrics(rows, "daily", "followers", "all");
    const chart = renderAsciiLineChart(groups, "followers");
    const lines = chart.split("\n");
    // header line + 5 grid lines + axis + labels = 8
    expect(lines.length).toBeGreaterThanOrEqual(7);
    expect(chart).toContain("●");
  });
  it("returns placeholder for empty", () => {
    expect(renderAsciiLineChart([], "followers")).toBe("(no data)");
  });
});

describe("analytics-dashboard renderKpiCard", () => {
  it("renders a card with label and value", () => {
    const card = renderKpiCard("Followers", 1200);
    expect(card).toContain("Followers");
    expect(card).toContain("1.2K");
    expect(card).toContain("┌");
    expect(card).toContain("└");
  });
  it("truncates long values", () => {
    const card = renderKpiCard("Label", "a-very-very-very-long-value-that-wont-fit-1234567890");
    const lines = card.split("\n");
    // every line should be 26 chars wide (│ + space + 22 + space + │)
    for (const l of lines) {
      expect(l.length).toBe(26);
    }
  });
});

describe("analytics-dashboard renderKpiCards", () => {
  it("renders multiple cards separated by newline", () => {
    const out = renderKpiCards([
      { label: "A", value: 1 },
      { label: "B", value: 2 },
    ]);
    expect(out).toContain("A");
    expect(out).toContain("B");
    expect(out.split("\n").length).toBe(8); // 4 lines per card × 2
  });
  it("returns placeholder for empty", () => {
    expect(renderKpiCards([])).toBe("(no KPIs)");
  });
});

describe("analytics-dashboard analyzeFollowerTrend", () => {
  it("detects improving trend", () => {
    const rows = parseCsv(SAMPLE_CSV).rows;
    const t = analyzeFollowerTrend(rows, "all");
    expect(t.trend).toBe("improving");
    expect(t.samples).toBeGreaterThan(0);
    expect(t.endValue).toBeGreaterThan(t.startValue);
  });
  it("detects declining trend", () => {
    const csv = [
      "date,platform,followers,posts,engagement,impressions,reach",
      "2024-01-01,twitter,1000,5,180,5000,4200",
      "2024-01-08,twitter,900,7,210,5600,4800",
      "2024-01-15,twitter,700,6,240,6200,5300",
    ].join("\n");
    const rows = parseCsv(csv).rows;
    const t = analyzeFollowerTrend(rows, "all");
    expect(t.trend).toBe("declining");
  });
  it("detects stable trend", () => {
    const csv = [
      "date,platform,followers,posts,engagement,impressions,reach",
      "2024-01-01,twitter,1000,5,180,5000,4200",
      "2024-01-08,twitter,1000,7,210,5600,4800",
      "2024-01-15,twitter,1000,6,240,6200,5300",
    ].join("\n");
    const rows = parseCsv(csv).rows;
    const t = analyzeFollowerTrend(rows, "all");
    expect(t.trend).toBe("stable");
  });
  it("handles empty rows", () => {
    const t = analyzeFollowerTrend([], "all");
    expect(t.trend).toBe("stable");
    expect(t.samples).toBe(0);
  });
});

describe("analytics-dashboard computePlatformComparison", () => {
  it("computes stats per platform", () => {
    const rows = parseCsv(SAMPLE_CSV).rows;
    const stats = computePlatformComparison(rows);
    expect(stats).toHaveLength(2);
    const ig = stats.find((s) => s.platform === "instagram")!;
    expect(ig.totalPosts).toBe(27); // 8 + 10 + 9
    expect(ig.lastFollowers).toBe(4100);
    expect(ig.engagementRate).toBeGreaterThan(0);
    expect(ig.followerGrowth.direction).toBe("up");
  });
  it("sorts by last followers desc", () => {
    const rows = parseCsv(SAMPLE_CSV).rows;
    const stats = computePlatformComparison(rows);
    expect(stats[0].lastFollowers).toBeGreaterThan(stats[1].lastFollowers);
  });
});

describe("analytics-dashboard computeSummaryStats", () => {
  it("computes summary", () => {
    const rows = parseCsv(SAMPLE_CSV).rows;
    const s = computeSummaryStats(rows);
    expect(s.totalPlatforms).toBe(2);
    expect(s.totalRows).toBe(6);
    expect(s.totalFollowers).toBe(1500 + 4100); // last per platform
    expect(s.totalPosts).toBe(5 + 7 + 6 + 8 + 10 + 9);
    expect(s.avgEngagementRate).toBeGreaterThan(0);
  });
  it("returns zeros for empty", () => {
    const s = computeSummaryStats([]);
    expect(s.totalPlatforms).toBe(0);
    expect(s.totalRows).toBe(0);
  });
});

describe("analytics-dashboard renderCsv", () => {
  it("renders header + rows", () => {
    const rows = parseCsv(SAMPLE_CSV).rows;
    const csv = renderCsv(rows);
    expect(csv.split("\n")[0]).toBe(CSV_HEADER.join(","));
    expect(csv.split("\n").length).toBe(7); // header + 6 rows
  });
  it("renders only header for empty", () => {
    expect(renderCsv([])).toBe(CSV_HEADER.join(","));
  });
});

describe("analytics-dashboard renderTextDashboard", () => {
  it("includes all major sections", () => {
    const rows = parseCsv(SAMPLE_CSV).rows;
    const b = buildDashboard(rows, "followers", "monthly", "all");
    const out = renderTextDashboard(
      b.summary, b.groups, "followers", "monthly", "all",
      b.growth, b.bestPeriod, b.worstPeriod, b.trend, b.platformComparison,
    );
    expect(out).toContain("SOCIAL MEDIA ANALYTICS DASHBOARD");
    expect(out).toContain("SUMMARY");
    expect(out).toContain("GROWTH");
    expect(out).toContain("BEST / WORST PERIOD");
    expect(out).toContain("FOLLOWER TREND");
    expect(out).toContain("PLATFORM COMPARISON");
  });
});

describe("analytics-dashboard renderHtmlDashboard", () => {
  it("produces valid HTML with inline CSS", () => {
    const rows = parseCsv(SAMPLE_CSV).rows;
    const b = buildDashboard(rows, "followers", "monthly", "all");
    const html = renderHtmlDashboard(
      b.summary, b.groups, "followers", "monthly", "all",
      b.growth, b.bestPeriod, b.worstPeriod, b.trend, b.platformComparison,
    );
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
    expect(html).toContain("style=");
    expect(html).toContain("Social Media Analytics Dashboard");
    expect(html).toContain("Platform Comparison");
  });
  it("escapes HTML in content", () => {
    const rows = parseCsv(SAMPLE_CSV).rows;
    const b = buildDashboard(rows, "followers", "monthly", "all");
    // Manually inject a malicious group label via render call
    const html = renderHtmlDashboard(
      b.summary,
      [{ group: "<script>alert(1)</script>", total: 10, avg: 10, count: 1 }],
      "followers", "monthly", "all",
      b.growth, b.bestPeriod, b.worstPeriod, b.trend, b.platformComparison,
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});

describe("analytics-dashboard renderMarkdownDashboard", () => {
  it("renders markdown with proper headings", () => {
    const rows = parseCsv(SAMPLE_CSV).rows;
    const b = buildDashboard(rows, "followers", "monthly", "all");
    const md = renderMarkdownDashboard(
      b.summary, b.groups, "followers", "monthly", "all",
      b.growth, b.bestPeriod, b.worstPeriod, b.trend, b.platformComparison,
    );
    expect(md).toContain("# 📊 Social Media Analytics Dashboard");
    expect(md).toContain("## Summary");
    expect(md).toContain("## Platform Comparison");
    expect(md).toContain("| Group | Total | Avg | Count |");
  });
});

describe("analytics-dashboard buildDashboard", () => {
  it("builds complete dashboard bundle", () => {
    const rows = parseCsv(SAMPLE_CSV).rows;
    const b = buildDashboard(rows, "followers", "monthly", "all");
    expect(b.summary.totalRows).toBe(6);
    expect(b.barChart).toContain("█");
    expect(b.lineChart).toContain("●");
    expect(b.kpiCards).toContain("Followers");
    expect(b.bestPeriod).not.toBeNull();
    expect(b.worstPeriod).not.toBeNull();
    expect(b.textDashboard).toContain("DASHBOARD");
    expect(b.htmlDashboard).toContain("<!DOCTYPE");
    expect(b.markdownDashboard).toContain("# 📊");
    expect(b.platformComparison.length).toBeGreaterThan(0);
    expect(b.trend.trend).toBe("improving");
  });
  it("handles empty rows", () => {
    const b = buildDashboard([], "followers", "monthly", "all");
    expect(b.summary.totalRows).toBe(0);
    expect(b.groups).toEqual([]);
    expect(b.bestPeriod).toBeNull();
    expect(b.worstPeriod).toBeNull();
  });
});

describe("analytics-dashboard history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      rowCount: 6,
      platformFilter: "all",
      metric: "followers",
      grouping: "monthly",
      totalFollowers: 5600,
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].totalFollowers).toBe(5600);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        rowCount: 1,
        platformFilter: "all",
        metric: "followers",
        grouping: "monthly",
        totalFollowers: i,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, rowCount: 1, platformFilter: "all",
      metric: "followers", grouping: "monthly", totalFollowers: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("analytics-dashboard shareable URL", () => {
  it("builds share URL with all params when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(SAMPLE_CSV, "followers", "monthly", "all");
    expect(url).toContain("data=");
    expect(url).toContain("metric=followers");
    expect(url).toContain("grouping=monthly");
    expect(url).toContain("platform=all");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const params = new URLSearchParams();
    params.set("data", SAMPLE_CSV);
    params.set("metric", "engagement");
    params.set("grouping", "weekly");
    params.set("platform", "twitter");
    const p = parseShareUrl(`#${params.toString()}`);
    expect(p.data).toBe(SAMPLE_CSV);
    expect(p.metric).toBe("engagement");
    expect(p.grouping).toBe("weekly");
    expect(p.platformFilter).toBe("twitter");
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.data).toBe("");
    expect(p.metric).toBe("followers");
    expect(p.grouping).toBe("monthly");
    expect(p.platformFilter).toBe("all");
  });
  it("filters unknown values to defaults", () => {
    const params = new URLSearchParams();
    params.set("metric", "unknown");
    params.set("grouping", "hourly");
    params.set("platform", "myspace");
    const p = parseShareUrl(`#${params.toString()}`);
    expect(p.metric).toBe("followers");
    expect(p.grouping).toBe("monthly");
    expect(p.platformFilter).toBe("all");
  });
});

// Suppress unused-import lint
export type _Unused = Platform | Metric | DateGrouping | PlatformFilter;

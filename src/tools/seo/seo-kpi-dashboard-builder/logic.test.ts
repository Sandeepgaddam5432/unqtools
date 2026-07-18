import { describe, it, expect, beforeEach } from "vitest";
import {
  KPI_TEMPLATES,
  TEMPLATE_LABELS,
  splitCsvRow,
  normalizeKpiName,
  formatNumber,
  parseKpiCsv,
  groupKpis,
  sortByDate,
  getLatestValue,
  inferKpiType,
  computeTargetProgress,
  computeTrend,
  classifyStatus,
  buildKpiGroups,
  filterByKpi,
  computeSummaryStats,
  generateBarChart,
  generateLineChart,
  renderKpiCard,
  renderTextDashboard,
  renderCsvDashboard,
  renderHtmlDashboard,
  renderMarkdownDashboard,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type KpiRecord,
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

const SAMPLE = `Organic Traffic,12500,15000,2026-01
Organic Traffic,13200,15000,2026-02
Keyword Rankings,85,100,2026-01
Keyword Rankings,92,100,2026-02
Backlinks,2400,3000,2026-01`;

describe("kpi-dashboard constants", () => {
  it("has 6 KPI templates", () => {
    expect(Object.keys(KPI_TEMPLATES)).toHaveLength(6);
  });
  it("has matching labels for each template", () => {
    for (const k of Object.keys(KPI_TEMPLATES)) {
      expect(TEMPLATE_LABELS[k]).toBeTruthy();
    }
  });
  it("templates contain valid CSV", () => {
    const { rows, errors } = parseKpiCsv(KPI_TEMPLATES.traffic);
    expect(rows.length).toBeGreaterThan(0);
    expect(errors).toHaveLength(0);
  });
});

describe("kpi-dashboard splitCsvRow", () => {
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

describe("kpi-dashboard normalizeKpiName", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeKpiName("  Organic   Traffic  ")).toBe("organic traffic");
  });
  it("handles empty", () => {
    expect(normalizeKpiName("")).toBe("");
  });
});

describe("kpi-dashboard formatNumber", () => {
  it("formats millions", () => {
    expect(formatNumber(1_500_000)).toBe("1.5M");
  });
  it("formats thousands", () => {
    expect(formatNumber(12500)).toBe("12.5k");
  });
  it("formats integers", () => {
    expect(formatNumber(85)).toBe("85");
  });
  it("formats floats", () => {
    expect(formatNumber(85.5)).toBe("85.50");
  });
  it("returns dash for NaN", () => {
    expect(formatNumber(NaN)).toBe("—");
  });
});

describe("kpi-dashboard parseKpiCsv", () => {
  it("parses rows without header", () => {
    const { rows, errors } = parseKpiCsv(SAMPLE);
    expect(rows).toHaveLength(5);
    expect(errors).toHaveLength(0);
    expect(rows[0]).toEqual({ kpi: "organic traffic", value: 12500, target: 15000, date: "2026-01" });
  });
  it("parses rows with header", () => {
    const { rows } = parseKpiCsv(`kpi,value,target,date\n${SAMPLE}`);
    expect(rows).toHaveLength(5);
    expect(rows[0].kpi).toBe("organic traffic");
  });
  it("returns empty for empty input", () => {
    expect(parseKpiCsv("").rows).toEqual([]);
  });
  it("reports errors for invalid rows", () => {
    const { rows, errors } = parseKpiCsv("Traffic,abc,100,2026-01");
    expect(rows).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });
  it("skips rows with missing KPI name", () => {
    const { rows, errors } = parseKpiCsv(",100,150,2026-01");
    expect(rows).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });
  it("skips rows with missing date", () => {
    const { rows, errors } = parseKpiCsv("Traffic,100,150,");
    expect(rows).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("kpi-dashboard groupKpis", () => {
  it("groups by KPI name", () => {
    const { rows } = parseKpiCsv(SAMPLE);
    const grouped = groupKpis(rows);
    expect(grouped.size).toBe(3);
    expect(grouped.get("organic traffic")).toHaveLength(2);
  });
  it("returns empty map for no records", () => {
    expect(groupKpis([]).size).toBe(0);
  });
});

describe("kpi-dashboard sortByDate", () => {
  it("sorts by date ascending", () => {
    const { rows } = parseKpiCsv(SAMPLE);
    const sorted = sortByDate(rows.filter((r) => r.kpi === "organic traffic"));
    expect(sorted[0].date).toBe("2026-01");
    expect(sorted[1].date).toBe("2026-02");
  });
});

describe("kpi-dashboard getLatestValue", () => {
  it("returns the latest record", () => {
    const { rows } = parseKpiCsv(SAMPLE);
    const latest = getLatestValue(rows.filter((r) => r.kpi === "organic traffic"));
    expect(latest).not.toBeNull();
    expect(latest!.date).toBe("2026-02");
    expect(latest!.value).toBe(13200);
  });
  it("returns null for empty", () => {
    expect(getLatestValue([])).toBeNull();
  });
});

describe("kpi-dashboard inferKpiType", () => {
  it("returns metric for 0 records", () => {
    expect(inferKpiType([])).toBe("metric");
  });
  it("returns metric for 1 record", () => {
    const r: KpiRecord = { kpi: "x", value: 1, target: 2, date: "2026-01" };
    expect(inferKpiType([r])).toBe("metric");
  });
  it("returns timeseries for multiple dates", () => {
    const { rows } = parseKpiCsv(SAMPLE);
    expect(inferKpiType(rows.filter((r) => r.kpi === "organic traffic"))).toBe("timeseries");
  });
  it("returns comparison for same date", () => {
    const rs: KpiRecord[] = [
      { kpi: "x", value: 1, target: 2, date: "2026-01" },
      { kpi: "x", value: 2, target: 2, date: "2026-01" },
    ];
    expect(inferKpiType(rs)).toBe("comparison");
  });
});

describe("kpi-dashboard computeTargetProgress", () => {
  it("computes progress percent", () => {
    expect(computeTargetProgress(750, 1000)).toBe(75);
  });
  it("handles > 100%", () => {
    expect(computeTargetProgress(1500, 1000)).toBe(150);
  });
  it("returns 0 for 0 target", () => {
    expect(computeTargetProgress(100, 0)).toBe(0);
  });
  it("returns 0 for invalid", () => {
    expect(computeTargetProgress(NaN, 100)).toBe(0);
  });
});

describe("kpi-dashboard computeTrend", () => {
  it("computes upward trend", () => {
    const { rows } = parseKpiCsv(SAMPLE);
    const trend = computeTrend(rows.filter((r) => r.kpi === "organic traffic"));
    expect(trend.direction).toBe("up");
    expect(trend.absChange).toBe(700);
    expect(trend.pctChange).toBeGreaterThan(0);
  });
  it("returns none for single record", () => {
    const trend = computeTrend([{ kpi: "x", value: 1, target: 2, date: "2026-01" }]);
    expect(trend.direction).toBe("none");
  });
  it("returns none for empty", () => {
    expect(computeTrend([]).direction).toBe("none");
  });
  it("handles zero previous", () => {
    const rs: KpiRecord[] = [
      { kpi: "x", value: 0, target: 2, date: "2026-01" },
      { kpi: "x", value: 100, target: 2, date: "2026-02" },
    ];
    const t = computeTrend(rs);
    expect(t.direction).toBe("up");
    expect(t.pctChange).toBe(100);
  });
  it("detects flat trend", () => {
    const rs: KpiRecord[] = [
      { kpi: "x", value: 100, target: 200, date: "2026-01" },
      { kpi: "x", value: 100, target: 200, date: "2026-02" },
    ];
    expect(computeTrend(rs).direction).toBe("flat");
  });
});

describe("kpi-dashboard classifyStatus", () => {
  it("on-track when >= target", () => {
    expect(classifyStatus(100, 100)).toBe("on-track");
    expect(classifyStatus(110, 100)).toBe("on-track");
  });
  it("behind when between 50% and 100%", () => {
    expect(classifyStatus(60, 100)).toBe("behind");
    expect(classifyStatus(99, 100)).toBe("behind");
  });
  it("critical when < 50%", () => {
    expect(classifyStatus(40, 100)).toBe("critical");
    expect(classifyStatus(0, 100)).toBe("critical");
  });
  it("no-target when target is 0 or invalid", () => {
    expect(classifyStatus(50, 0)).toBe("no-target");
    expect(classifyStatus(NaN, 100)).toBe("no-target");
  });
});

describe("kpi-dashboard buildKpiGroups", () => {
  it("builds groups from records", () => {
    const { rows } = parseKpiCsv(SAMPLE);
    const groups = buildKpiGroups(rows);
    expect(groups).toHaveLength(3);
    const traffic = groups.find((g) => g.kpi === "organic traffic");
    expect(traffic).toBeDefined();
    expect(traffic!.latest.value).toBe(13200);
    expect(traffic!.type).toBe("timeseries");
    expect(traffic!.trend.direction).toBe("up");
  });
  it("returns empty for no records", () => {
    expect(buildKpiGroups([])).toEqual([]);
  });
  it("sorts alphabetically", () => {
    const { rows } = parseKpiCsv(SAMPLE);
    const groups = buildKpiGroups(rows);
    expect(groups[0].kpi).toBe("backlinks");
    expect(groups[1].kpi).toBe("keyword rankings");
    expect(groups[2].kpi).toBe("organic traffic");
  });
});

describe("kpi-dashboard filterByKpi", () => {
  it("filters by substring", () => {
    const { rows } = parseKpiCsv(SAMPLE);
    const groups = buildKpiGroups(rows);
    expect(filterByKpi(groups, "traffic")).toHaveLength(1);
  });
  it("returns all for empty query", () => {
    const { rows } = parseKpiCsv(SAMPLE);
    const groups = buildKpiGroups(rows);
    expect(filterByKpi(groups, "")).toHaveLength(3);
  });
});

describe("kpi-dashboard computeSummaryStats", () => {
  it("computes stats", () => {
    const { rows } = parseKpiCsv(SAMPLE);
    const groups = buildKpiGroups(rows);
    const stats = computeSummaryStats(groups);
    expect(stats.totalKpis).toBe(3);
    expect(stats.onTrack).toBeGreaterThanOrEqual(0);
    expect(stats.avgProgress).toBeGreaterThan(0);
  });
  it("returns zeros for empty", () => {
    const stats = computeSummaryStats([]);
    expect(stats.totalKpis).toBe(0);
    expect(stats.avgProgress).toBe(0);
  });
});

describe("kpi-dashboard generateBarChart", () => {
  it("generates bar with filled blocks", () => {
    const bar = generateBarChart("traffic", 75, 30);
    expect(bar).toContain("█");
    expect(bar).toContain("░");
    expect(bar).toContain("75.0%");
  });
  it("full bar at 100%", () => {
    const bar = generateBarChart("x", 100, 30);
    expect(bar).not.toContain("░");
  });
  it("empty bar at 0%", () => {
    const bar = generateBarChart("x", 0, 30);
    expect(bar).not.toContain("█");
  });
});

describe("kpi-dashboard generateLineChart", () => {
  it("generates chart for multiple values", () => {
    const chart = generateLineChart([10, 20, 30, 40, 50]);
    expect(chart).toContain("min:");
    expect(chart).toContain("max:");
    expect(chart).toContain("●");
  });
  it("returns single value for one value", () => {
    expect(generateLineChart([42])).toBe("42");
  });
});

describe("kpi-dashboard renderKpiCard", () => {
  it("renders card with KPI name and value", () => {
    const { rows } = parseKpiCsv(SAMPLE);
    const groups = buildKpiGroups(rows);
    const card = renderKpiCard(groups[0]);
    expect(card).toContain(groups[0].kpi);
    expect(card).toContain("Value:");
    expect(card).toContain("Status:");
  });
});

describe("kpi-dashboard renderTextDashboard", () => {
  it("renders dashboard with header", () => {
    const { rows } = parseKpiCsv(SAMPLE);
    const groups = buildKpiGroups(rows);
    const stats = computeSummaryStats(groups);
    const text = renderTextDashboard(groups, stats);
    expect(text).toContain("SEO KPI DASHBOARD");
    expect(text).toContain("Total KPIs:");
  });
});

describe("kpi-dashboard renderCsvDashboard", () => {
  it("renders CSV with header", () => {
    const { rows } = parseKpiCsv(SAMPLE);
    const groups = buildKpiGroups(rows);
    const csv = renderCsvDashboard(groups);
    expect(csv).toContain("kpi,value,target,progress_pct,trend_direction,trend_pct,status,date");
    expect(csv).toContain("organic traffic");
  });
});

describe("kpi-dashboard renderHtmlDashboard", () => {
  it("renders HTML with inline CSS", () => {
    const { rows } = parseKpiCsv(SAMPLE);
    const groups = buildKpiGroups(rows);
    const stats = computeSummaryStats(groups);
    const html = renderHtmlDashboard(groups, stats);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<svg");
    expect(html).toContain("font-family");
  });
  it("escapes HTML in KPI name", () => {
    const rs: KpiRecord[] = [{ kpi: "<script>", value: 1, target: 2, date: "2026-01" }];
    const groups = buildKpiGroups(rs);
    const html = renderHtmlDashboard(groups, computeSummaryStats(groups));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("kpi-dashboard renderMarkdownDashboard", () => {
  it("renders markdown with table", () => {
    const { rows } = parseKpiCsv(SAMPLE);
    const groups = buildKpiGroups(rows);
    const stats = computeSummaryStats(groups);
    const md = renderMarkdownDashboard(groups, stats);
    expect(md).toContain("# SEO KPI Dashboard");
    expect(md).toContain("| KPI | Value | Target");
  });
});

describe("kpi-dashboard history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, totalKpis: 3, onTrack: 2, critical: 1, avgProgress: 75 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, totalKpis: 1, onTrack: 1, critical: 0, avgProgress: 100 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, totalKpis: 1, onTrack: 1, critical: 0, avgProgress: 100 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("kpi-dashboard shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("Organic Traffic,100,150,2026-01");
    expect(url).toContain("data=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const encoded = encodeURIComponent("Organic Traffic,100,150,2026-01");
    const p = parseShareUrl(`data=${encoded}`);
    expect(p.data).toBe("Organic Traffic,100,150,2026-01");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ data: "" });
  });
});

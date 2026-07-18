import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeKeyword,
  isValidDate,
  isValidPosition,
  splitCsvRow,
  parseInput,
  computeChanges,
  buildTimeline,
  averageTrend,
  filterByKeyword,
  filterByDateRange,
  computeStats,
  renderMarkdown,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type RankRow,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
});

describe("rank-change-visualizer normalizeKeyword", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeKeyword("  Best   SEO  ")).toBe("best seo");
  });
  it("handles empty", () => {
    expect(normalizeKeyword("")).toBe("");
  });
});

describe("rank-change-visualizer isValidDate", () => {
  it("accepts yyyy-mm-dd", () => { expect(isValidDate("2026-07-15")).toBe(true); });
  it("rejects bad format", () => { expect(isValidDate("15/07/2026")).toBe(false); });
  it("rejects empty", () => { expect(isValidDate("")).toBe(false); });
});

describe("rank-change-visualizer isValidPosition", () => {
  it("accepts positive", () => { expect(isValidPosition(5)).toBe(true); });
  it("accepts 0", () => { expect(isValidPosition(0)).toBe(true); });
  it("rejects negative", () => { expect(isValidPosition(-1)).toBe(false); });
  it("rejects NaN", () => { expect(isValidPosition(NaN)).toBe(false); });
});

describe("rank-change-visualizer splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
  it("handles escaped quotes", () => { expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]); });
});

describe("rank-change-visualizer parseInput", () => {
  it("parses headerless date,keyword,position", () => {
    const { rows, errors } = parseInput("2026-07-01,seo,5\n2026-07-08,seo,3");
    expect(rows).toHaveLength(2);
    expect(errors).toHaveLength(0);
  });
  it("parses with header", () => {
    const input = "date,keyword,position\n2026-07-01,seo,5";
    const { rows } = parseInput(input);
    expect(rows).toHaveLength(1);
    expect(rows[0].keyword).toBe("seo");
  });
  it("parses with reordered header (keyword,date,position)", () => {
    const input = "keyword,date,position\nseo,2026-07-01,5";
    const { rows } = parseInput(input);
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2026-07-01");
    expect(rows[0].keyword).toBe("seo");
    expect(rows[0].position).toBe(5);
  });
  it("returns empty for empty input", () => {
    expect(parseInput("")).toEqual({ rows: [], errors: [] });
  });
  it("collects errors for invalid rows", () => {
    const input = "2026-07-01,seo,5\nbad-date,seo,5";
    const { rows, errors } = parseInput(input);
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(1);
  });
});

describe("rank-change-visualizer computeChanges", () => {
  const rows: RankRow[] = [
    { date: "2026-07-01", keyword: "rising", position: 20 },
    { date: "2026-07-08", keyword: "rising", position: 5 },
    { date: "2026-07-01", keyword: "falling", position: 3 },
    { date: "2026-07-08", keyword: "falling", position: 18 },
  ];
  const changes = computeChanges(rows);
  it("groups by keyword", () => { expect(changes).toHaveLength(2); });
  it("computes first/last", () => {
    const rising = changes.find((c) => c.keyword === "rising");
    expect(rising?.firstPosition).toBe(20);
    expect(rising?.lastPosition).toBe(5);
  });
  it("computes change (first - last)", () => {
    const rising = changes.find((c) => c.keyword === "rising");
    expect(rising?.change).toBe(15);
    const falling = changes.find((c) => c.keyword === "falling");
    expect(falling?.change).toBe(-15);
  });
  it("computes best and worst", () => {
    const rising = changes.find((c) => c.keyword === "rising");
    expect(rising?.best).toBe(5);
    expect(rising?.worst).toBe(20);
  });
  it("returns empty for empty input", () => {
    expect(computeChanges([])).toEqual([]);
  });
});

describe("rank-change-visualizer buildTimeline", () => {
  const rows: RankRow[] = [
    { date: "2026-07-01", keyword: "seo", position: 10 },
    { date: "2026-07-08", keyword: "seo", position: 5 },
    { date: "2026-07-01", keyword: "marketing", position: 8 },
  ];
  const tl = buildTimeline(rows);
  it("returns sorted unique dates", () => {
    expect(tl.dates).toEqual(["2026-07-01", "2026-07-08"]);
  });
  it("returns sorted unique keywords", () => {
    expect(tl.keywords).toEqual(["marketing", "seo"]);
  });
  it("cells have values for each date+keyword", () => {
    expect(tl.cells).toHaveLength(2);
    expect(tl.cells[0].values["seo"]).toBe(10);
    expect(tl.cells[0].values["marketing"]).toBe(8);
    expect(tl.cells[1].values["seo"]).toBe(5);
    expect(tl.cells[1].values["marketing"]).toBeNull();
  });
  it("returns empty for empty input", () => {
    const empty = buildTimeline([]);
    expect(empty.dates).toEqual([]);
    expect(empty.keywords).toEqual([]);
  });
});

describe("rank-change-visualizer averageTrend", () => {
  it("computes average per date", () => {
    const rows: RankRow[] = [
      { date: "2026-07-01", keyword: "a", position: 10 },
      { date: "2026-07-01", keyword: "b", position: 6 },
      { date: "2026-07-08", keyword: "a", position: 5 },
    ];
    const trend = averageTrend(rows);
    expect(trend).toHaveLength(2);
    expect(trend[0].averagePosition).toBe(8);
    expect(trend[0].trackedKeywords).toBe(2);
    expect(trend[1].averagePosition).toBe(5);
  });
  it("returns empty for empty input", () => {
    expect(averageTrend([])).toEqual([]);
  });
});

describe("rank-change-visualizer filterByKeyword", () => {
  const rows: RankRow[] = [
    { date: "2026-07-01", keyword: "seo tools", position: 5 },
    { date: "2026-07-01", keyword: "marketing tips", position: 8 },
  ];
  it("filters by substring", () => {
    expect(filterByKeyword(rows, "seo")).toHaveLength(1);
  });
  it("returns all when empty query", () => {
    expect(filterByKeyword(rows, "")).toHaveLength(2);
  });
  it("is case-insensitive", () => {
    expect(filterByKeyword(rows, "SEO")).toHaveLength(1);
  });
});

describe("rank-change-visualizer filterByDateRange", () => {
  const rows: RankRow[] = [
    { date: "2026-06-01", keyword: "a", position: 5 },
    { date: "2026-07-01", keyword: "a", position: 4 },
    { date: "2026-08-01", keyword: "a", position: 3 },
  ];
  it("filters by start only", () => {
    expect(filterByDateRange(rows, { start: "2026-07-01", end: "" })).toHaveLength(2);
  });
  it("filters by end only", () => {
    expect(filterByDateRange(rows, { start: "", end: "2026-07-01" })).toHaveLength(2);
  });
  it("filters by both", () => {
    expect(filterByDateRange(rows, { start: "2026-07-01", end: "2026-07-31" })).toHaveLength(1);
  });
  it("returns all when no range", () => {
    expect(filterByDateRange(rows)).toHaveLength(3);
    expect(filterByDateRange(rows, { start: "", end: "" })).toHaveLength(3);
  });
});

describe("rank-change-visualizer computeStats", () => {
  const changes = computeChanges([
    { date: "2026-07-01", keyword: "rising", position: 20 },
    { date: "2026-07-08", keyword: "rising", position: 5 },
    { date: "2026-07-01", keyword: "falling", position: 3 },
    { date: "2026-07-08", keyword: "falling", position: 18 },
  ]);
  const stats = computeStats(changes);
  it("computes unique keywords", () => {
    expect(stats.uniqueKeywords).toBe(2);
  });
  it("computes total rows", () => {
    expect(stats.totalRows).toBe(4);
  });
  it("finds biggest gain", () => {
    expect(stats.biggestGains[0].keyword).toBe("rising");
    expect(stats.biggestGains[0].change).toBe(15);
  });
  it("finds biggest drop", () => {
    expect(stats.biggestDrops[0].keyword).toBe("falling");
    expect(stats.biggestDrops[0].change).toBe(-15);
  });
  it("computes overall average change", () => {
    expect(stats.overallAverageChange).toBe(0);
  });
  it("returns zeros for empty", () => {
    const s = computeStats([]);
    expect(s.uniqueKeywords).toBe(0);
    expect(s.biggestGains).toEqual([]);
  });
});

describe("rank-change-visualizer renderMarkdown", () => {
  const rows: RankRow[] = [
    { date: "2026-07-01", keyword: "seo", position: 10 },
    { date: "2026-07-08", keyword: "seo", position: 5 },
  ];
  const changes = computeChanges(rows);
  const timeline = buildTimeline(rows);
  const stats = computeStats(changes);
  const md = renderMarkdown(rows, changes, stats, timeline);
  it("has title", () => {
    expect(md).toContain("# Rank Change Report");
  });
  it("includes biggest gains section", () => {
    expect(md).toContain("## Biggest gains");
    expect(md).toContain("seo");
  });
  it("includes timeline section", () => {
    expect(md).toContain("## Timeline");
    expect(md).toContain("2026-07-01");
  });
});

describe("rank-change-visualizer renderCsv", () => {
  const rows: RankRow[] = [{ date: "2026-07-01", keyword: "seo", position: 10 }];
  const timeline = buildTimeline(rows);
  const csv = renderCsv(timeline);
  it("has header row", () => {
    expect(csv).toContain("date,seo");
  });
  it("has data row", () => {
    expect(csv).toContain("2026-07-01,10");
  });
});

describe("rank-change-visualizer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, totalRows: 10, uniqueKeywords: 5, overallAverageChange: 2.5 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, totalRows: 1, uniqueKeywords: 1, overallAverageChange: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, totalRows: 1, uniqueKeywords: 1, overallAverageChange: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("rank-change-visualizer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("2026-07-01,seo,5");
    expect(url).toContain("data=2026-07-01");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("data=2026-07-01%2Cseo%2C5");
    expect(p.data).toBe("2026-07-01,seo,5");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("").data).toBe("");
  });
});

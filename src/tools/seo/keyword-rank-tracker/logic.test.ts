import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeKeyword,
  isValidDate,
  isValidPosition,
  parseLine,
  splitCsvRow,
  parseCsv,
  addEntry,
  removeKeyword,
  buildHistory,
  filterHistory,
  sortHistory,
  computeStats,
  chartData,
  renderCsv,
  renderSummaryCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type RankEntry,
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

describe("keyword-rank-tracker normalizeKeyword", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeKeyword("  Best   SEO  ")).toBe("best seo");
  });
  it("handles empty", () => {
    expect(normalizeKeyword("")).toBe("");
  });
});

describe("keyword-rank-tracker isValidDate", () => {
  it("accepts yyyy-mm-dd", () => {
    expect(isValidDate("2026-07-15")).toBe(true);
  });
  it("rejects dd/mm/yyyy", () => {
    expect(isValidDate("15/07/2026")).toBe(false);
  });
  it("rejects empty", () => {
    expect(isValidDate("")).toBe(false);
  });
  it("rejects invalid month", () => {
    expect(isValidDate("2026-13-01")).toBe(false);
  });
});

describe("keyword-rank-tracker isValidPosition", () => {
  it("accepts positive integers", () => {
    expect(isValidPosition(1)).toBe(true);
    expect(isValidPosition(100)).toBe(true);
  });
  it("accepts 0 (not ranking)", () => {
    expect(isValidPosition(0)).toBe(true);
  });
  it("rejects negatives", () => {
    expect(isValidPosition(-1)).toBe(false);
  });
  it("rejects non-numbers", () => {
    expect(isValidPosition(NaN)).toBe(false);
    expect(isValidPosition(Infinity)).toBe(false);
  });
});

describe("keyword-rank-tracker splitCsvRow", () => {
  it("splits simple row", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("handles escaped quotes", () => {
    expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]);
  });
});

describe("keyword-rank-tracker parseLine", () => {
  it("parses a valid line", () => {
    const e = parseLine("best seo tools,5,2026-07-15");
    expect(e).toEqual({ keyword: "best seo tools", position: 5, date: "2026-07-15", url: undefined });
  });
  it("parses with url", () => {
    const e = parseLine("best seo tools,5,2026-07-15,https://example.com");
    expect(e?.url).toBe("https://example.com");
  });
  it("returns null for empty", () => {
    expect(parseLine("")).toBeNull();
  });
  it("returns null for comment lines", () => {
    expect(parseLine("# keyword,position,date")).toBeNull();
    expect(parseLine("// keyword,position,date")).toBeNull();
  });
  it("returns null for too few columns", () => {
    expect(parseLine("seo,5")).toBeNull();
  });
  it("returns null for invalid position", () => {
    expect(parseLine("seo,abc,2026-07-15")).toBeNull();
  });
  it("returns null for invalid date", () => {
    expect(parseLine("seo,5,not-a-date")).toBeNull();
  });
});

describe("keyword-rank-tracker parseCsv", () => {
  it("parses headerless rows", () => {
    const input = "seo,5,2026-07-01\nseo,3,2026-07-15";
    const { entries, errors } = parseCsv(input);
    expect(entries).toHaveLength(2);
    expect(errors).toHaveLength(0);
  });
  it("parses with header", () => {
    const input = "keyword,position,date\nseo,5,2026-07-01";
    const { entries } = parseCsv(input);
    expect(entries).toHaveLength(1);
    expect(entries[0].keyword).toBe("seo");
  });
  it("handles empty input", () => {
    expect(parseCsv("")).toEqual({ entries: [], errors: [] });
  });
  it("collects errors for invalid rows", () => {
    const input = "seo,5,2026-07-01\nseo,bad,2026-07-15";
    const { entries, errors } = parseCsv(input);
    expect(entries).toHaveLength(1);
    expect(errors).toHaveLength(1);
  });
});

describe("keyword-rank-tracker addEntry / removeKeyword", () => {
  it("adds entry to empty list", () => {
    const list = addEntry([], { keyword: "SEO", position: 5, date: "2026-07-01" });
    expect(list).toHaveLength(1);
    expect(list[0].keyword).toBe("seo");
  });
  it("rejects invalid position", () => {
    const list = addEntry([], { keyword: "SEO", position: -5, date: "2026-07-01" });
    expect(list).toHaveLength(0);
  });
  it("rejects invalid date", () => {
    const list = addEntry([], { keyword: "SEO", position: 5, date: "bad" });
    expect(list).toHaveLength(0);
  });
  it("removes all entries for a keyword", () => {
    const list: RankEntry[] = [
      { keyword: "seo", position: 5, date: "2026-07-01" },
      { keyword: "marketing", position: 8, date: "2026-07-01" },
    ];
    const out = removeKeyword(list, "SEO");
    expect(out).toHaveLength(1);
    expect(out[0].keyword).toBe("marketing");
  });
});

describe("keyword-rank-tracker buildHistory", () => {
  const entries: RankEntry[] = [
    { keyword: "seo", position: 10, date: "2026-07-01" },
    { keyword: "seo", position: 5, date: "2026-07-08" },
    { keyword: "seo", position: 7, date: "2026-07-15" },
    { keyword: "marketing", position: 3, date: "2026-07-01" },
  ];
  const hist = buildHistory(entries);
  it("groups by keyword", () => {
    expect(hist).toHaveLength(2);
  });
  it("sorts entries by date", () => {
    const seo = hist.find((h) => h.keyword === "seo");
    expect(seo?.entries.map((e) => e.date)).toEqual(["2026-07-01", "2026-07-08", "2026-07-15"]);
  });
  it("computes latest", () => {
    const seo = hist.find((h) => h.keyword === "seo");
    expect(seo?.latest).toBe(7);
  });
  it("computes previous", () => {
    const seo = hist.find((h) => h.keyword === "seo");
    expect(seo?.previous).toBe(5);
  });
  it("computes change (previous - latest)", () => {
    const seo = hist.find((h) => h.keyword === "seo");
    expect(seo?.change).toBe(-2); // 5 - 7 = -2 (dropped)
  });
  it("computes best", () => {
    const seo = hist.find((h) => h.keyword === "seo");
    expect(seo?.best).toBe(5);
  });
  it("computes worst", () => {
    const seo = hist.find((h) => h.keyword === "seo");
    expect(seo?.worst).toBe(10);
  });
  it("computes average", () => {
    const seo = hist.find((h) => h.keyword === "seo");
    expect(seo?.average).toBeCloseTo(7.3, 0);
  });
  it("returns empty for empty input", () => {
    expect(buildHistory([])).toEqual([]);
  });
});

describe("keyword-rank-tracker filterHistory", () => {
  const hist = buildHistory([
    { keyword: "seo tools", position: 5, date: "2026-07-01" },
    { keyword: "marketing tips", position: 8, date: "2026-07-01" },
  ]);
  it("filters by substring", () => {
    expect(filterHistory(hist, "seo")).toHaveLength(1);
    expect(filterHistory(hist, "seo")[0].keyword).toBe("seo tools");
  });
  it("returns all when query is empty", () => {
    expect(filterHistory(hist, "")).toHaveLength(2);
  });
  it("case-insensitive", () => {
    expect(filterHistory(hist, "SEO")).toHaveLength(1);
  });
});

describe("keyword-rank-tracker sortHistory", () => {
  const hist = buildHistory([
    { keyword: "alpha", position: 10, date: "2026-07-01" },
    { keyword: "beta", position: 3, date: "2026-07-01" },
    { keyword: "gamma", position: 7, date: "2026-07-01" },
  ]);
  it("sorts by keyword asc by default", () => {
    const out = sortHistory(hist);
    expect(out[0].keyword).toBe("alpha");
  });
  it("sorts by latest asc", () => {
    const out = sortHistory(hist, "latest", "asc");
    expect(out[0].keyword).toBe("beta");
  });
  it("sorts by latest desc", () => {
    const out = sortHistory(hist, "latest", "desc");
    expect(out[0].keyword).toBe("alpha");
  });
});

describe("keyword-rank-tracker computeStats", () => {
  it("returns zeros for empty", () => {
    const s = computeStats([]);
    expect(s.keywordsTracked).toBe(0);
    expect(s.bestMover).toBeNull();
  });
  it("computes best mover and biggest drop", () => {
    const hist = buildHistory([
      { keyword: "rising", position: 20, date: "2026-07-01" },
      { keyword: "rising", position: 5, date: "2026-07-15" },
      { keyword: "falling", position: 3, date: "2026-07-01" },
      { keyword: "falling", position: 18, date: "2026-07-15" },
    ]);
    const s = computeStats(hist);
    expect(s.bestMover?.keyword).toBe("rising");
    expect(s.bestMover?.change).toBe(15);
    expect(s.biggestDrop?.keyword).toBe("falling");
    expect(s.biggestDrop?.change).toBe(-15);
  });
  it("computes total entries", () => {
    const hist = buildHistory([
      { keyword: "a", position: 5, date: "2026-07-01" },
      { keyword: "a", position: 6, date: "2026-07-08" },
      { keyword: "b", position: 7, date: "2026-07-01" },
    ]);
    expect(computeStats(hist).totalEntries).toBe(3);
  });
});

describe("keyword-rank-tracker chartData", () => {
  it("builds chart points", () => {
    const hist = buildHistory([
      { keyword: "seo", position: 10, date: "2026-07-01" },
      { keyword: "seo", position: 5, date: "2026-07-08" },
    ]);
    const cd = chartData(hist);
    expect(cd).toHaveLength(1);
    expect(cd[0].points).toEqual([
      { x: "2026-07-01", y: 10 },
      { x: "2026-07-08", y: 5 },
    ]);
  });
  it("returns empty for empty input", () => {
    expect(chartData([])).toEqual([]);
  });
});

describe("keyword-rank-tracker renderCsv", () => {
  it("renders header", () => {
    const csv = renderCsv([]);
    expect(csv).toContain("keyword,position,date,url");
  });
  it("renders entries", () => {
    const csv = renderCsv([{ keyword: "seo", position: 5, date: "2026-07-01" }]);
    expect(csv).toContain("seo,5,2026-07-01");
  });
});

describe("keyword-rank-tracker renderSummaryCsv", () => {
  it("renders summary header", () => {
    const csv = renderSummaryCsv([]);
    expect(csv).toContain("keyword,latest,previous,change,best,worst,average,entries");
  });
  it("renders summary row", () => {
    const hist = buildHistory([
      { keyword: "seo", position: 10, date: "2026-07-01" },
      { keyword: "seo", position: 5, date: "2026-07-08" },
    ]);
    const csv = renderSummaryCsv(hist);
    expect(csv).toContain("seo,5,10,5,5,10");
  });
});

describe("keyword-rank-tracker history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, keywordsTracked: 5, totalEntries: 10, overallAverage: 7.5 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, keywordsTracked: 1, totalEntries: 1, overallAverage: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, keywordsTracked: 1, totalEntries: 1, overallAverage: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("keyword-rank-tracker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("seo,5,2026-07-01");
    expect(url).toContain("data=seo");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("data=seo%2C5%2C2026-07-01");
    expect(p.data).toBe("seo,5,2026-07-01");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("").data).toBe("");
  });
});

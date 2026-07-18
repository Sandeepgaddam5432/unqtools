import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeKeyword,
  normalizeLocation,
  parseKeywords,
  parseLocations,
  parseManualEntries,
  positionToScore,
  categorizeLocalPack,
  categorizeOrganic,
  computeVisibility,
  scoreEntry,
  scoreAll,
  generateMatrix,
  splitCsvRow,
  averagePerKeyword,
  averagePerLocation,
  bestAndWorstCombos,
  filterEntries,
  computeSummaryStats,
  renderText,
  renderCsv,
  generateTemplate,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  todayIso,
  type RankEntry,
  type FilterMode,
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

describe("local-rank-tracker normalize", () => {
  it("normalizes keywords lower-case + collapses whitespace", () => {
    expect(normalizeKeyword("  Pizza   DELIVERY  ")).toBe("pizza delivery");
  });
  it("handles empty keyword", () => {
    expect(normalizeKeyword("")).toBe("");
  });
  it("normalizes locations preserving case", () => {
    expect(normalizeLocation("  Austin,   TX  ")).toBe("Austin, TX");
  });
  it("handles empty location", () => {
    expect(normalizeLocation("")).toBe("");
  });
});

describe("local-rank-tracker parseKeywords / parseLocations", () => {
  it("parses newline-separated keywords", () => {
    expect(parseKeywords("pizza delivery\nplumbing services")).toEqual([
      "pizza delivery",
      "plumbing services",
    ]);
  });
  it("parses comma-separated keywords", () => {
    expect(parseKeywords("seo, marketing, tech")).toEqual(["seo", "marketing", "tech"]);
  });
  it("skips blank keyword lines", () => {
    expect(parseKeywords("seo\n\nmarketing")).toEqual(["seo", "marketing"]);
  });
  it("returns empty for empty keyword input", () => {
    expect(parseKeywords("")).toEqual([]);
  });
  it("parses locations one per line (preserves commas in line)", () => {
    expect(parseLocations("Austin, TX\nDallas, TX\nSeattle, WA")).toEqual([
      "Austin, TX",
      "Dallas, TX",
      "Seattle, WA",
    ]);
  });
  it("returns empty for empty location input", () => {
    expect(parseLocations("")).toEqual([]);
  });
});

describe("local-rank-tracker positionToScore", () => {
  it("position 1 = 100", () => {
    expect(positionToScore(1)).toBe(100);
  });
  it("position 2 = 90", () => {
    expect(positionToScore(2)).toBe(90);
  });
  it("position 10 = 10", () => {
    expect(positionToScore(10)).toBe(10);
  });
  it("position 11 = 0", () => {
    expect(positionToScore(11)).toBe(0);
  });
  it("position > 10 = 0", () => {
    expect(positionToScore(25)).toBe(0);
  });
  it("null = 0", () => {
    expect(positionToScore(null)).toBe(0);
  });
  it("0 = 0", () => {
    expect(positionToScore(0)).toBe(0);
  });
});

describe("local-rank-tracker categorize", () => {
  it("local pack 1-3 = top-pack", () => {
    expect(categorizeLocalPack(1)).toBe("top-pack");
    expect(categorizeLocalPack(2)).toBe("top-pack");
    expect(categorizeLocalPack(3)).toBe("top-pack");
  });
  it("local pack 4+ = below-pack", () => {
    expect(categorizeLocalPack(4)).toBe("below-pack");
    expect(categorizeLocalPack(10)).toBe("below-pack");
  });
  it("local pack null/0 = unranked", () => {
    expect(categorizeLocalPack(null)).toBe("unranked");
    expect(categorizeLocalPack(0)).toBe("unranked");
  });
  it("organic 1-10 = page-1", () => {
    expect(categorizeOrganic(1)).toBe("page-1");
    expect(categorizeOrganic(10)).toBe("page-1");
  });
  it("organic 11-20 = page-2", () => {
    expect(categorizeOrganic(11)).toBe("page-2");
    expect(categorizeOrganic(20)).toBe("page-2");
  });
  it("organic > 20 = off-page", () => {
    expect(categorizeOrganic(21)).toBe("off-page");
  });
  it("organic null = unranked", () => {
    expect(categorizeOrganic(null)).toBe("unranked");
  });
});

describe("local-rank-tracker computeVisibility", () => {
  it("position 1 local pack + position 5 organic", () => {
    // 100 * 0.6 + 60 * 0.4 = 60 + 24 = 84
    expect(computeVisibility(1, 5)).toBe(84);
  });
  it("null + null = 0", () => {
    expect(computeVisibility(null, null)).toBe(0);
  });
  it("position 3 local pack + null organic = 80*0.6 = 48", () => {
    expect(computeVisibility(3, null)).toBe(48);
  });
  it("null local pack + position 1 organic = 100*0.4 = 40", () => {
    expect(computeVisibility(null, 1)).toBe(40);
  });
});

describe("local-rank-tracker generateMatrix", () => {
  it("generates every keyword x location combo", () => {
    const matrix = generateMatrix(["pizza", "plumbing"], ["Austin, TX", "Dallas, TX"]);
    expect(matrix).toHaveLength(4);
    expect(matrix[0]).toEqual({
      keyword: "pizza",
      location: "Austin, TX",
      localPackPosition: null,
      organicPosition: null,
      date: matrix[0].date,
    });
  });
  it("uses provided date", () => {
    const matrix = generateMatrix(["kw"], ["loc"], "2024-01-15");
    expect(matrix[0].date).toBe("2024-01-15");
  });
  it("returns empty for empty input", () => {
    expect(generateMatrix([], [])).toEqual([]);
  });
});

describe("local-rank-tracker scoreEntry / scoreAll", () => {
  it("scores a single entry", () => {
    const entry: RankEntry = {
      keyword: "pizza",
      location: "Austin, TX",
      localPackPosition: 1,
      organicPosition: 5,
      date: "2024-01-01",
    };
    const scored = scoreEntry(entry);
    expect(scored.localPackScore).toBe(100);
    expect(scored.organicScore).toBe(60);
    expect(scored.visibilityScore).toBe(84);
    expect(scored.localPackCategory).toBe("top-pack");
    expect(scored.organicCategory).toBe("page-1");
  });
  it("scores multiple entries", () => {
    const entries: RankEntry[] = [
      { keyword: "a", location: "x", localPackPosition: 1, organicPosition: 1, date: "2024-01-01" },
      { keyword: "b", location: "y", localPackPosition: null, organicPosition: null, date: "2024-01-01" },
    ];
    const scored = scoreAll(entries);
    expect(scored).toHaveLength(2);
    expect(scored[0].visibilityScore).toBe(100);
    expect(scored[1].visibilityScore).toBe(0);
  });
});

describe("local-rank-tracker parseManualEntries", () => {
  it("parses CSV with header", () => {
    const csv = "keyword,location,local_pack_pos,organic_pos,date\npizza,Austin TX,1,5,2024-01-01";
    const entries = parseManualEntries(csv);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      keyword: "pizza",
      location: "Austin TX",
      localPackPosition: 1,
      organicPosition: 5,
      date: "2024-01-01",
    });
  });
  it("parses CSV without header", () => {
    const csv = "pizza,Austin TX,1,5,2024-01-01";
    const entries = parseManualEntries(csv);
    expect(entries).toHaveLength(1);
    expect(entries[0].keyword).toBe("pizza");
  });
  it("treats empty / dash positions as null", () => {
    const csv = "keyword,location,local_pack_pos,organic_pos,date\npizza,Austin TX,-,-,2024-01-01";
    const entries = parseManualEntries(csv);
    expect(entries[0].localPackPosition).toBeNull();
    expect(entries[0].organicPosition).toBeNull();
  });
  it("defaults date to today when missing", () => {
    const csv = "keyword,location,local_pack_pos,organic_pos\npizza,Austin TX,1,5";
    const entries = parseManualEntries(csv);
    expect(entries[0].date).toBe(todayIso());
  });
  it("handles quoted CSV values", () => {
    const csv = 'keyword,location,local_pack_pos,organic_pos,date\n"pizza, delivery",Austin TX,1,5,2024-01-01';
    const entries = parseManualEntries(csv);
    expect(entries[0].keyword).toBe("pizza, delivery");
  });
  it("returns empty for empty input", () => {
    expect(parseManualEntries("")).toEqual([]);
  });
});

describe("local-rank-tracker splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
});

describe("local-rank-tracker averagePerKeyword / averagePerLocation", () => {
  const entries = scoreAll([
    { keyword: "pizza", location: "Austin", localPackPosition: 1, organicPosition: 1, date: "d" },
    { keyword: "pizza", location: "Dallas", localPackPosition: 5, organicPosition: 10, date: "d" },
    { keyword: "plumbing", location: "Austin", localPackPosition: null, organicPosition: 15, date: "d" },
  ]);
  it("averages per keyword", () => {
    const avgs = averagePerKeyword(entries);
    expect(avgs).toHaveLength(2);
    const pizza = avgs.find((a) => a.keyword === "pizza")!;
    // pizza@Austin: LP=1,Org=1 -> vis=100; pizza@Dallas: LP=5,Org=10 -> 60*0.6 + 10*0.4 = 40
    // avg = (100 + 40) / 2 = 70
    expect(pizza.avgVisibility).toBe(70);
    expect(pizza.count).toBe(2);
    expect(pizza.topPackCount).toBe(1);
  });
  it("sorts by avgVisibility descending", () => {
    const avgs = averagePerKeyword(entries);
    expect(avgs[0].avgVisibility).toBeGreaterThanOrEqual(avgs[1].avgVisibility);
  });
  it("averages per location", () => {
    const avgs = averagePerLocation(entries);
    expect(avgs).toHaveLength(2);
    const austin = avgs.find((a) => a.location === "Austin")!;
    expect(austin.count).toBe(2);
  });
});

describe("local-rank-tracker bestAndWorstCombos", () => {
  it("finds best and worst", () => {
    const entries = scoreAll([
      { keyword: "a", location: "x", localPackPosition: 1, organicPosition: 1, date: "d" },
      { keyword: "b", location: "y", localPackPosition: null, organicPosition: null, date: "d" },
      { keyword: "c", location: "z", localPackPosition: 3, organicPosition: 5, date: "d" },
    ]);
    const { best, worst } = bestAndWorstCombos(entries);
    expect(best?.keyword).toBe("a");
    expect(worst?.keyword).toBe("b");
  });
  it("returns nulls for empty", () => {
    const { best, worst } = bestAndWorstCombos([]);
    expect(best).toBeNull();
    expect(worst).toBeNull();
  });
});

describe("local-rank-tracker filterEntries", () => {
  const entries = scoreAll([
    { keyword: "a", location: "x", localPackPosition: 1, organicPosition: 1, date: "d" },
    { keyword: "b", location: "y", localPackPosition: 5, organicPosition: 8, date: "d" },
    { keyword: "c", location: "z", localPackPosition: 2, organicPosition: 25, date: "d" },
  ]);
  it("mode 'all' returns all entries", () => {
    expect(filterEntries(entries, "all")).toHaveLength(3);
  });
  it("mode 'top-pack' returns only top-pack", () => {
    const filtered = filterEntries(entries, "top-pack");
    expect(filtered).toHaveLength(2);
    expect(filtered.every((e) => e.localPackCategory === "top-pack")).toBe(true);
  });
  it("mode 'page-1' returns only page-1 organic", () => {
    const filtered = filterEntries(entries, "page-1");
    expect(filtered).toHaveLength(2);
    expect(filtered.every((e) => e.organicCategory === "page-1")).toBe(true);
  });
});

describe("local-rank-tracker computeSummaryStats", () => {
  it("computes summary stats", () => {
    const entries = scoreAll([
      { keyword: "a", location: "x", localPackPosition: 1, organicPosition: 1, date: "d" },
      { keyword: "b", location: "y", localPackPosition: 5, organicPosition: 15, date: "d" },
      { keyword: "c", location: "z", localPackPosition: 2, organicPosition: 25, date: "d" },
    ]);
    const stats = computeSummaryStats(entries);
    expect(stats.totalTracked).toBe(3);
    expect(stats.topPackCount).toBe(2);
    expect(stats.page1Count).toBe(1);
    expect(stats.bestCombo?.keyword).toBe("a");
    expect(stats.worstCombo?.keyword).toBe("b");
  });
  it("returns zero stats for empty input", () => {
    const stats = computeSummaryStats([]);
    expect(stats.totalTracked).toBe(0);
    expect(stats.avgVisibility).toBe(0);
    expect(stats.bestCombo).toBeNull();
    expect(stats.worstCombo).toBeNull();
  });
});

describe("local-rank-tracker renderText", () => {
  it("renders a report", () => {
    const entries = scoreAll([
      { keyword: "pizza", location: "Austin, TX", localPackPosition: 1, organicPosition: 5, date: "2024-01-01" },
    ]);
    const text = renderText(entries);
    expect(text).toContain("LOCAL RANK TRACKER REPORT");
    expect(text).toContain("pizza");
    expect(text).toContain("Austin, TX");
    expect(text).toContain("Vis=84");
  });
  it("returns placeholder for empty input", () => {
    expect(renderText([])).toBe("(no entries)");
  });
});

describe("local-rank-tracker renderCsv", () => {
  it("renders header", () => {
    expect(renderCsv([])).toContain("keyword,location,local_pack_pos,organic_pos,visibility_score,date");
  });
  it("renders entries with empty positions as blank", () => {
    const entries = scoreAll([
      { keyword: "pizza", location: "Austin, TX", localPackPosition: null, organicPosition: null, date: "2024-01-01" },
    ]);
    const csv = renderCsv(entries);
    // Austin, TX contains comma -> quoted
    expect(csv).toContain('"Austin, TX"');
    expect(csv).toContain(",,0,2024-01-01");
  });
});

describe("local-rank-tracker generateTemplate", () => {
  it("generates a CSV template with header", () => {
    const template = generateTemplate(["pizza", "plumbing"], ["Austin, TX", "Dallas, TX"]);
    const lines = template.split("\n");
    expect(lines[0]).toBe("keyword,location,local_pack_pos,organic_pos,date");
    // 2 keywords x 2 locations = 4 rows + header = 5 lines
    expect(lines).toHaveLength(5);
    expect(template).toContain('"Austin, TX"');
  });
  it("returns only header for empty inputs", () => {
    const template = generateTemplate([], []);
    expect(template.split("\n")).toHaveLength(1);
  });
});

describe("local-rank-tracker history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, keywords: ["pizza"], locations: ["Austin"], totalEntries: 1, avgVisibility: 84 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, keywords: ["x"], locations: ["y"], totalEntries: 1, avgVisibility: 50 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, keywords: ["x"], locations: ["y"], totalEntries: 1, avgVisibility: 50 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("local-rank-tracker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("pizza\nplumbing", "Austin, TX", "csv-data");
    expect(url).toContain("kw=pizza");
    expect(url).toContain("loc=Austin");
    expect(url).toContain("csv=csv-data");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const params = new URLSearchParams();
    params.set("kw", "pizza\nplumbing");
    params.set("loc", "Austin, TX");
    params.set("csv", "csv-data");
    const p = parseShareUrl(`#${params.toString()}`);
    expect(p.keywords).toBe("pizza\nplumbing");
    expect(p.locations).toBe("Austin, TX");
    expect(p.manual).toBe("csv-data");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ keywords: "", locations: "", manual: "" });
  });
  it("handles hash without leading #", () => {
    const p = parseShareUrl("kw=pizza&loc=Austin");
    expect(p.keywords).toBe("pizza");
    expect(p.locations).toBe("Austin");
  });
});

// Suppress unused-import lint
export type _Unused = FilterMode;

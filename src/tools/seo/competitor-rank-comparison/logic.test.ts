import { describe, it, expect, beforeEach } from "vitest";
import {
  MAX_COMPETITORS,
  normalizeDomain,
  normalizeKeyword,
  splitCsvRow,
  parseInput,
  computeStats,
  findOpportunities,
  computeOverlap,
  compare,
  renderCsv,
  renderReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ComparisonRow,
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

describe("competitor-rank-comparison constants", () => {
  it("MAX_COMPETITORS is 5", () => {
    expect(MAX_COMPETITORS).toBe(5);
  });
});

describe("competitor-rank-comparison normalizeDomain", () => {
  it("strips protocol and www", () => {
    expect(normalizeDomain("https://www.example.com/path")).toBe("example.com");
  });
  it("handles empty", () => {
    expect(normalizeDomain("")).toBe("");
  });
});

describe("competitor-rank-comparison normalizeKeyword", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeKeyword("  Best   SEO  ")).toBe("best seo");
  });
});

describe("competitor-rank-comparison splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
});

describe("competitor-rank-comparison parseInput", () => {
  it("parses with header", () => {
    const input = "keyword,you,competitor\nseo,5,3";
    const { rows, domains } = parseInput(input, "you", ["competitor"]);
    expect(rows).toHaveLength(1);
    expect(domains).toEqual(["you", "competitor"]);
    expect(rows[0].positions["you"]).toBe(5);
  });
  it("parses headerless", () => {
    const input = "seo,5,3";
    const { rows } = parseInput(input, "you", ["competitor"]);
    expect(rows).toHaveLength(1);
    expect(rows[0].positions["you"]).toBe(5);
  });
  it("handles blanks (not ranking)", () => {
    const input = "seo,5,";
    const { rows } = parseInput(input, "you", ["competitor"]);
    expect(rows[0].positions["competitor"]).toBeUndefined();
  });
  it("skips comment lines", () => {
    const input = "# comment\nseo,5,3";
    const { rows } = parseInput(input, "you", ["competitor"]);
    expect(rows).toHaveLength(1);
  });
  it("returns empty for empty input", () => {
    expect(parseInput("", "you", [])).toEqual({ rows: [], domains: [], errors: [] });
  });
  it("limits competitors to 5", () => {
    const comps = ["a", "b", "c", "d", "e", "f", "g"];
    const { domains } = parseInput("seo,5,1,1,1,1,1,1", "you", comps);
    expect(domains.length).toBe(6); // you + 5
  });
  it("defaults yourDomain to 'you' when empty", () => {
    const { domains } = parseInput("seo,5", "", []);
    expect(domains[0]).toBe("you");
  });
});

describe("competitor-rank-comparison computeStats", () => {
  const rows: ComparisonRow[] = [
    { keyword: "a", positions: { you: 1, comp: 5 } },
    { keyword: "b", positions: { you: 10, comp: 2 } },
    { keyword: "c", positions: { you: 0, comp: 3 } },
  ];
  const stats = computeStats(rows, ["you", "comp"], "you");
  it("computes keyword count per domain", () => {
    const you = stats.find((s) => s.domain === "you");
    const comp = stats.find((s) => s.domain === "comp");
    expect(you?.keywordCount).toBe(2);
    expect(comp?.keywordCount).toBe(3);
  });
  it("computes wins", () => {
    const you = stats.find((s) => s.domain === "you");
    expect(you?.winsCount).toBe(1);
  });
  it("computes avg position", () => {
    const you = stats.find((s) => s.domain === "you");
    expect(you?.avgPosition).toBeCloseTo(5.5, 0);
  });
  it("computes top3 and top10 counts", () => {
    const you = stats.find((s) => s.domain === "you");
    expect(you?.top3Count).toBe(1);
    expect(you?.top10Count).toBe(2);
  });
  it("marks isYou correctly", () => {
    expect(stats.find((s) => s.domain === "you")?.isYou).toBe(true);
    expect(stats.find((s) => s.domain === "comp")?.isYou).toBe(false);
  });
});

describe("competitor-rank-comparison findOpportunities", () => {
  it("finds where you don't rank but competitor does", () => {
    const rows: ComparisonRow[] = [
      { keyword: "a", positions: { you: 0, comp: 3 } },
    ];
    const opps = findOpportunities(rows, "you", ["comp"]);
    expect(opps).toHaveLength(1);
    expect(opps[0].gap).toBe(100);
  });
  it("finds where you rank worse than competitor", () => {
    const rows: ComparisonRow[] = [
      { keyword: "a", positions: { you: 10, comp: 3 } },
    ];
    const opps = findOpportunities(rows, "you", ["comp"]);
    expect(opps).toHaveLength(1);
    expect(opps[0].gap).toBe(7);
  });
  it("ignores where you rank better", () => {
    const rows: ComparisonRow[] = [
      { keyword: "a", positions: { you: 2, comp: 5 } },
    ];
    expect(findOpportunities(rows, "you", ["comp"])).toHaveLength(0);
  });
  it("ignores where neither ranks", () => {
    const rows: ComparisonRow[] = [
      { keyword: "a", positions: { you: 0, comp: 0 } },
    ];
    expect(findOpportunities(rows, "you", ["comp"])).toHaveLength(0);
  });
  it("sorts by gap descending", () => {
    const rows: ComparisonRow[] = [
      { keyword: "a", positions: { you: 10, comp: 3 } },
      { keyword: "b", positions: { you: 20, comp: 1 } },
    ];
    const opps = findOpportunities(rows, "you", ["comp"]);
    expect(opps[0].gap).toBeGreaterThan(opps[1].gap);
  });
});

describe("competitor-rank-comparison computeOverlap", () => {
  it("counts keywords where all domains rank", () => {
    const rows: ComparisonRow[] = [
      { keyword: "a", positions: { you: 5, comp: 3 } },
      { keyword: "b", positions: { you: 0, comp: 3 } },
    ];
    expect(computeOverlap(rows, ["you", "comp"])).toBe(1);
  });
  it("returns 0 for empty", () => {
    expect(computeOverlap([], ["you"])).toBe(0);
  });
});

describe("competitor-rank-comparison compare", () => {
  const rows: ComparisonRow[] = [
    { keyword: "a", positions: { you: 5, comp: 3 } },
    { keyword: "b", positions: { you: 1, comp: 10 } },
  ];
  const result = compare(rows, ["you", "comp"], "you", ["comp"]);
  it("returns all fields", () => {
    expect(result.domains).toEqual(["you", "comp"]);
    expect(result.yourDomain).toBe("you");
    expect(result.competitors).toEqual(["comp"]);
    expect(result.stats).toHaveLength(2);
    expect(result.opportunities).toBeDefined();
    expect(result.overlap).toBe(2);
    expect(result.totalKeywords).toBe(2);
    expect(result.leaderboard).toBeDefined();
  });
  it("leaderboard sorted by wins desc", () => {
    expect(result.leaderboard[0].winsCount).toBeGreaterThanOrEqual(result.leaderboard[1].winsCount);
  });
  it("returns empty for empty input", () => {
    const empty = compare([], [], "you", []);
    expect(empty.totalKeywords).toBe(0);
  });
});

describe("competitor-rank-comparison renderCsv", () => {
  it("renders domain stats section", () => {
    const csv = renderCsv(compare([], ["you"], "you", []));
    expect(csv).toContain("# Domain stats");
    expect(csv).toContain("domain,is_you,keywords,avg_position,top3,top10,wins");
  });
  it("renders side-by-side section", () => {
    const csv = renderCsv(compare([], ["you"], "you", []));
    expect(csv).toContain("# Side-by-side rankings");
  });
  it("renders opportunities section", () => {
    const csv = renderCsv(compare([], ["you"], "you", []));
    expect(csv).toContain("# Opportunities");
  });
});

describe("competitor-rank-comparison renderReport", () => {
  it("renders report header", () => {
    const report = renderReport(compare([], ["you"], "you", []));
    expect(report).toContain("Competitor Rank Comparison Report");
  });
  it("includes your domain and competitors", () => {
    const report = renderReport(compare([], ["you"], "you", ["comp"]));
    expect(report).toContain("Your domain: you");
    expect(report).toContain("Competitors: comp");
  });
});

describe("competitor-rank-comparison history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, totalKeywords: 10, opportunities: 3, yourWins: 2 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, totalKeywords: 1, opportunities: 1, yourWins: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, totalKeywords: 1, opportunities: 1, yourWins: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("competitor-rank-comparison shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("seo,5,3", "you", ["comp"]);
    expect(url).toContain("data=seo");
    expect(url).toContain("you=you");
    expect(url).toContain("comp=comp");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("data=seo%2C5%2C3&you=you&comp=comp1%2Ccomp2");
    expect(p.data).toBe("seo,5,3");
    expect(p.you).toBe("you");
    expect(p.comp).toEqual(["comp1", "comp2"]);
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.data).toBe("");
    expect(p.you).toBe("");
    expect(p.comp).toEqual([]);
  });
});

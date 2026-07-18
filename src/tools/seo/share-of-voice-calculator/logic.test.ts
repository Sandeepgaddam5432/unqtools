import { describe, it, expect, beforeEach } from "vitest";
import {
  positionWeight,
  normalizeDomain,
  normalizeKeyword,
  parseRow,
  splitCsvRow,
  parseInput,
  computeRowVisibility,
  calculate,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SovInputRow,
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

describe("share-of-voice positionWeight", () => {
  it("position 1 = 1.0", () => { expect(positionWeight(1)).toBe(1.0); });
  it("position 2 = 0.85", () => { expect(positionWeight(2)).toBe(0.85); });
  it("position 3 = 0.70", () => { expect(positionWeight(3)).toBe(0.70); });
  it("position 10 = 0.20", () => { expect(positionWeight(10)).toBe(0.20); });
  it("position 11-20 = 0.05", () => { expect(positionWeight(15)).toBe(0.05); });
  it("position 51+ = 0", () => { expect(positionWeight(75)).toBe(0); });
  it("position 0 or invalid = 0", () => {
    expect(positionWeight(0)).toBe(0);
    expect(positionWeight(-1)).toBe(0);
  });
  it("monotonically decreasing 1-10", () => {
    let prev = Infinity;
    for (let i = 1; i <= 10; i++) {
      const w = positionWeight(i);
      expect(w).toBeLessThanOrEqual(prev);
      prev = w;
    }
  });
});

describe("share-of-voice normalizeDomain", () => {
  it("strips protocol", () => {
    expect(normalizeDomain("https://www.example.com/path")).toBe("example.com");
  });
  it("strips www", () => {
    expect(normalizeDomain("www.example.com")).toBe("example.com");
  });
  it("handles empty", () => {
    expect(normalizeDomain("")).toBe("");
  });
});

describe("share-of-voice normalizeKeyword", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeKeyword("  Best   SEO  ")).toBe("best seo");
  });
});

describe("share-of-voice splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
});

describe("share-of-voice parseRow", () => {
  it("parses with domain:position pairs", () => {
    const { row } = parseRow("seo,1000,you:5,competitor:3", []);
    expect(row?.keyword).toBe("seo");
    expect(row?.searchVolume).toBe(1000);
    expect(row?.positions["you"]).toBe(5);
    expect(row?.positions["competitor"]).toBe(3);
  });
  it("parses with separate domain list", () => {
    const { row } = parseRow("seo,1000,5,3", ["you", "competitor"]);
    expect(row?.positions["you"]).toBe(5);
    expect(row?.positions["competitor"]).toBe(3);
  });
  it("skips missing positions when using domain list", () => {
    const { row } = parseRow("seo,1000,5,", ["you", "competitor"]);
    expect(row?.positions["you"]).toBe(5);
    expect(row?.positions["competitor"]).toBeUndefined();
  });
  it("returns null for blank", () => {
    expect(parseRow("", []).row).toBeNull();
  });
  it("returns null for comment", () => {
    expect(parseRow("# comment", []).row).toBeNull();
  });
  it("errors on missing keyword", () => {
    expect(parseRow(",1000,you:5", []).error).toBeTruthy();
  });
  it("errors on invalid volume", () => {
    expect(parseRow("seo,abc,you:5", []).error).toBeTruthy();
  });
});

describe("share-of-voice parseInput", () => {
  it("parses headerless rows", () => {
    const input = "seo,1000,you:5,competitor:3\nmarketing,500,you:1,competitor:10";
    const { rows, errors } = parseInput(input);
    expect(rows).toHaveLength(2);
    expect(errors).toHaveLength(0);
  });
  it("extracts domains from header", () => {
    const input = "keyword,volume,you,competitor\nseo,1000,5,3";
    const { rows, domains } = parseInput(input);
    expect(domains).toContain("you");
    expect(domains).toContain("competitor");
    expect(rows[0].positions["you"]).toBe(5);
  });
  it("defaults to 'you' domain when none specified", () => {
    const { rows, domains } = parseInput("seo,1000,5");
    expect(domains).toContain("you");
    expect(rows[0].positions["you"]).toBe(5);
  });
  it("returns empty for empty input", () => {
    expect(parseInput("")).toEqual({ rows: [], domains: [], errors: [] });
  });
  it("collects errors", () => {
    const input = "seo,1000,you:5\nbad,xyz,you:5";
    const { rows, errors } = parseInput(input);
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(1);
  });
});

describe("share-of-voice computeRowVisibility", () => {
  it("computes visibility per domain", () => {
    const row: SovInputRow = { keyword: "seo", searchVolume: 1000, positions: { you: 1, competitor: 5 } };
    const { byDomain } = computeRowVisibility(row, ["you", "competitor"]);
    expect(byDomain.you).toBe(1000); // 1000 * 1.0
    expect(byDomain.competitor).toBe(450); // 1000 * 0.45
  });
  it("identifies leader", () => {
    const row: SovInputRow = { keyword: "seo", searchVolume: 1000, positions: { you: 1, competitor: 5 } };
    const { leader } = computeRowVisibility(row, ["you", "competitor"]);
    expect(leader).toBe("you");
  });
  it("returns null leader when no one ranks", () => {
    const row: SovInputRow = { keyword: "seo", searchVolume: 1000, positions: {} };
    const { leader } = computeRowVisibility(row, ["you"]);
    expect(leader).toBeNull();
  });
});

describe("share-of-voice calculate", () => {
  const rows: SovInputRow[] = [
    { keyword: "seo", searchVolume: 1000, positions: { you: 1, competitor: 5 } },
    { keyword: "marketing", searchVolume: 500, positions: { you: 10, competitor: 2 } },
  ];
  const result = calculate(rows, ["you", "competitor"]);
  it("returns domain results sorted by SOV", () => {
    expect(result.domains).toHaveLength(2);
    expect(result.domains[0].sovPercentage).toBeGreaterThanOrEqual(result.domains[1].sovPercentage);
  });
  it("computes total volume", () => {
    expect(result.totalVolume).toBe(1500);
  });
  it("computes total visibility", () => {
    expect(result.totalVisibility).toBeGreaterThan(0);
  });
  it("computes SOV percentages summing to ~100", () => {
    const sum = result.domains.reduce((acc, d) => acc + d.sovPercentage, 0);
    expect(Math.abs(sum - 100)).toBeLessThan(0.5);
  });
  it("computes visibility score 0-100", () => {
    for (const d of result.domains) {
      expect(d.visibilityScore).toBeGreaterThanOrEqual(0);
      expect(d.visibilityScore).toBeLessThanOrEqual(100);
    }
  });
  it("computes keyword counts", () => {
    expect(result.domains[0].keywordCount + result.domains[1].keywordCount).toBe(4);
  });
  it("computes top3 and top10 counts", () => {
    const you = result.domains.find((d) => d.domain === "you");
    expect(you?.top3Count).toBe(1);
    expect(you?.top10Count).toBe(2);
  });
  it("computes avg position", () => {
    const you = result.domains.find((d) => d.domain === "you");
    expect(you?.avgPosition).toBeCloseTo(5.5, 0);
  });
  it("returns empty for empty input", () => {
    expect(calculate([], [])).toEqual({ domains: [], keywords: [], totalVolume: 0, totalVisibility: 0, totalKeywords: 0 });
  });
  it("returns per-keyword breakdown with leader", () => {
    expect(result.keywords).toHaveLength(2);
    expect(result.keywords[0].leader).toBe("you");
    expect(result.keywords[1].leader).toBe("competitor");
  });
});

describe("share-of-voice renderCsv", () => {
  it("renders summary header", () => {
    const csv = renderCsv(calculate([], []));
    expect(csv).toContain("domain,total_visibility,sov_percentage");
  });
  it("renders per-keyword header", () => {
    const rows: SovInputRow[] = [{ keyword: "seo", searchVolume: 100, positions: { you: 1 } }];
    const csv = renderCsv(calculate(rows, ["you"]));
    expect(csv).toContain("# Per-keyword breakdown");
    expect(csv).toContain("keyword,search_volume,leader");
  });
});

describe("share-of-voice history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, totalKeywords: 5, totalVolume: 1000, topDomain: "you", topSov: 75 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, totalKeywords: 1, totalVolume: 1, topDomain: "you", topSov: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, totalKeywords: 1, totalVolume: 1, topDomain: "you", topSov: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("share-of-voice shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("seo,1000,you:5");
    expect(url).toContain("data=seo");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("data=seo%2C1000");
    expect(p.data).toBe("seo,1000");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("").data).toBe("");
  });
});

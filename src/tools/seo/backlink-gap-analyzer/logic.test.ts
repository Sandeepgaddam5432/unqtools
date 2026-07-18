import { describe, it, expect, beforeEach } from "vitest";
import {
  MAX_COMPETITORS,
  normalizeUrl,
  extractDomain,
  splitCsvRow,
  parseCsv,
  parseJson,
  parseAuto,
  opportunityScore,
  computeStats,
  analyze,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Backlink,
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

describe("backlink-gap-analyzer constants", () => {
  it("MAX_COMPETITORS is 3", () => {
    expect(MAX_COMPETITORS).toBe(3);
  });
});

describe("backlink-gap-analyzer normalizeUrl", () => {
  it("strips protocol and www", () => {
    expect(normalizeUrl("https://www.example.com/page")).toBe("example.com/page");
  });
  it("strips trailing slash", () => {
    expect(normalizeUrl("https://example.com/page/")).toBe("example.com/page");
  });
  it("lowercases", () => {
    expect(normalizeUrl("HTTPS://Example.COM/Path")).toBe("example.com/path");
  });
  it("handles empty", () => {
    expect(normalizeUrl("")).toBe("");
  });
});

describe("backlink-gap-analyzer extractDomain", () => {
  it("strips protocol", () => {
    expect(extractDomain("https://www.example.com/path")).toBe("example.com");
  });
  it("handles bare", () => {
    expect(extractDomain("example.com")).toBe("example.com");
  });
});

describe("backlink-gap-analyzer splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
});

describe("backlink-gap-analyzer parseCsv", () => {
  it("parses headerless", () => {
    const { backlinks, errors } = parseCsv("https://example.com/p1,click here,src.com,80,dofollow");
    expect(backlinks).toHaveLength(1);
    expect(errors).toHaveLength(0);
  });
  it("parses with header", () => {
    const input = "url,anchor,source_domain,da,link_type\nhttps://example.com/p1,click here,src.com,80,dofollow";
    const { backlinks } = parseCsv(input);
    expect(backlinks).toHaveLength(1);
  });
  it("handles empty input", () => {
    expect(parseCsv("")).toEqual({ backlinks: [], errors: [] });
  });
  it("collects errors for missing url", () => {
    const input = "url,anchor\n,click here";
    const { errors } = parseCsv(input);
    expect(errors).toHaveLength(1);
  });
});

describe("backlink-gap-analyzer parseJson", () => {
  it("parses array", () => {
    const input = '[{"url":"https://example.com","anchor":"x","source_domain":"src.com","da":80,"link_type":"dofollow"}]';
    const { backlinks } = parseJson(input);
    expect(backlinks).toHaveLength(1);
  });
  it("errors on non-array", () => {
    expect(parseJson('{"foo":1}').errors.length).toBeGreaterThan(0);
  });
  it("errors on invalid JSON", () => {
    expect(parseJson("not json").errors.length).toBeGreaterThan(0);
  });
});

describe("backlink-gap-analyzer parseAuto", () => {
  it("detects JSON", () => {
    expect(parseAuto('[{"url":"https://example.com","da":50}]').backlinks).toHaveLength(1);
  });
  it("detects CSV", () => {
    expect(parseAuto("https://example.com,x,src.com,50,dofollow").backlinks).toHaveLength(1);
  });
});

describe("backlink-gap-analyzer opportunityScore", () => {
  it("higher DA = higher score", () => {
    const low = opportunityScore(20, 1, 3);
    const high = opportunityScore(80, 1, 3);
    expect(high).toBeGreaterThan(low);
  });
  it("more competitors = higher score", () => {
    const one = opportunityScore(50, 1, 3);
    const two = opportunityScore(50, 2, 3);
    const three = opportunityScore(50, 3, 3);
    expect(two).toBeGreaterThan(one);
    expect(three).toBeGreaterThan(two);
  });
  it("is within 0-100", () => {
    expect(opportunityScore(100, 3, 3)).toBeLessThanOrEqual(100);
    expect(opportunityScore(0, 1, 3)).toBeGreaterThanOrEqual(0);
  });
  it("gives bonus when all competitors link", () => {
    const allThree = opportunityScore(50, 3, 3);
    const twoOfFour = opportunityScore(50, 2, 4);
    expect(allThree).toBeGreaterThan(twoOfFour);
  });
});

describe("backlink-gap-analyzer computeStats", () => {
  it("computes per-domain stats", () => {
    const yours: Backlink[] = [
      { url: "https://a.com/1", anchor: "x", sourceDomain: "src1.com", da: 50, linkType: "dofollow" },
      { url: "https://a.com/2", anchor: "x", sourceDomain: "src2.com", da: 70, linkType: "dofollow" },
    ];
    const stats = computeStats(yours, [{ name: "comp", backlinks: [] }]);
    expect(stats).toHaveLength(2);
    expect(stats[0].domain).toBe("you");
    expect(stats[0].totalBacklinks).toBe(2);
    expect(stats[0].uniqueDomains).toBe(2);
    expect(stats[0].averageDa).toBe(60);
    expect(stats[0].isYou).toBe(true);
  });
  it("handles empty input", () => {
    const stats = computeStats([], []);
    expect(stats[0].totalBacklinks).toBe(0);
  });
});

describe("backlink-gap-analyzer analyze", () => {
  const yours: Backlink[] = [
    { url: "https://a.com/1", anchor: "x", sourceDomain: "src1.com", da: 50, linkType: "dofollow" },
    { url: "https://a.com/2", anchor: "x", sourceDomain: "src2.com", da: 50, linkType: "dofollow" },
  ];
  const comp1: Backlink[] = [
    { url: "https://a.com/3", anchor: "x", sourceDomain: "src3.com", da: 80, linkType: "dofollow" }, // gap
    { url: "https://a.com/1", anchor: "x", sourceDomain: "src1.com", da: 50, linkType: "dofollow" }, // shared
  ];
  const comp2: Backlink[] = [
    { url: "https://a.com/3", anchor: "x", sourceDomain: "src3.com", da: 80, linkType: "dofollow" }, // gap (both link)
    { url: "https://a.com/4", anchor: "x", sourceDomain: "src4.com", da: 40, linkType: "dofollow" }, // gap (only comp2)
  ];
  const result = analyze(yours, [{ name: "comp1", backlinks: comp1 }, { name: "comp2", backlinks: comp2 }]);
  it("identifies gap opportunities", () => {
    expect(result.totalOpportunities).toBeGreaterThanOrEqual(2);
  });
  it("deduplicates opportunities by URL", () => {
    const c3Opportunities = result.opportunities.filter((o) => o.url === "https://a.com/3");
    expect(c3Opportunities).toHaveLength(1);
    expect(c3Opportunities[0].competitorCount).toBe(2);
  });
  it("scores higher when more competitors link", () => {
    const c3 = result.opportunities.find((o) => o.url === "https://a.com/3");
    const c4 = result.opportunities.find((o) => o.url === "https://a.com/4");
    expect(c3?.opportunityScore).toBeGreaterThan(c4?.opportunityScore ?? 0);
  });
  it("identifies shared backlinks", () => {
    expect(result.totalShared).toBeGreaterThanOrEqual(1);
    expect(result.sharedBacklinks.some((b) => b.url === "https://a.com/1")).toBe(true);
  });
  it("computes per-competitor gap counts", () => {
    // comp1: a.com/3 (gap), a.com/1 (shared with you, not counted) → 1 gap
    // comp2: a.com/3 (gap), a.com/4 (gap) → 2 gaps
    expect(result.byCompetitor.comp1).toBe(1);
    expect(result.byCompetitor.comp2).toBe(2);
  });
  it("computes stats", () => {
    expect(result.stats).toHaveLength(3);
  });
  it("returns empty for empty inputs", () => {
    const r = analyze([], []);
    expect(r.totalOpportunities).toBe(0);
    expect(r.totalShared).toBe(0);
  });
  it("sorts opportunities by score desc", () => {
    const scores = result.opportunities.map((o) => o.opportunityScore);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
  });
});

describe("backlink-gap-analyzer renderCsv", () => {
  it("renders stats section", () => {
    const csv = renderCsv(analyze([], []));
    expect(csv).toContain("# Stats");
    expect(csv).toContain("domain,is_you,total_backlinks");
  });
  it("renders opportunities section", () => {
    const csv = renderCsv(analyze([], []));
    expect(csv).toContain("# Opportunities");
  });
  it("renders shared section", () => {
    const csv = renderCsv(analyze([], []));
    expect(csv).toContain("# Shared backlinks");
  });
});

describe("backlink-gap-analyzer history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, opportunities: 5, shared: 2, topScore: 90 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, opportunities: 1, shared: 1, topScore: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, opportunities: 1, shared: 1, topScore: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("backlink-gap-analyzer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("you-data", [{ name: "comp1", data: "comp1-data" }]);
    expect(url).toContain("you=you-data");
    expect(url).toContain("c0_name=comp1");
    expect(url).toContain("c0_data=comp1-data");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("you=hello&c0_name=comp1&c0_data=data1&c1_name=comp2&c1_data=data2");
    expect(p.you).toBe("hello");
    expect(p.competitors).toHaveLength(2);
    expect(p.competitors[0].name).toBe("comp1");
    expect(p.competitors[0].data).toBe("data1");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ you: "", competitors: [] });
  });
});

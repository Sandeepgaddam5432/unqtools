import { describe, it, expect, beforeEach } from "vitest";
import {
  PLATFORMS,
  DEFAULT_NEGATIVE_KEYWORDS,
  BACKLINK_OPPORTUNITY_TEMPLATES,
  PLATFORM_LABELS,
  QUERY_TYPE_LABELS,
  parseList,
  buildBrandOrQuery,
  applyNegatives,
  getPlatform,
  buildUrl,
  generateBrandQueries,
  generateCompetitorQueries,
  generateNicheQueries,
  generateFounderQueries,
  generateBacklinkOpportunityQueries,
  generateAllQueries,
  filterByType,
  computeStats,
  renderText,
  renderCsv,
  splitCsvRow,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type MonitorInput,
  type QueryType,
  type Platform,
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

describe("brand-mention-monitor constants", () => {
  it("has 10 platforms", () => {
    expect(PLATFORMS).toHaveLength(10);
  });
  it("platforms have unique ids", () => {
    const ids = PLATFORMS.map((p) => p.platform);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("has 5 negative default keywords", () => {
    expect(DEFAULT_NEGATIVE_KEYWORDS.length).toBeGreaterThanOrEqual(5);
    expect(DEFAULT_NEGATIVE_KEYWORDS).toContain("coupon");
  });
  it("has backlink templates using {niche} or {competitor}", () => {
    expect(BACKLINK_OPPORTUNITY_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    expect(BACKLINK_OPPORTUNITY_TEMPLATES.some((t) => t.includes("{niche}"))).toBe(true);
  });
  it("has 10 platform labels", () => {
    expect(Object.keys(PLATFORM_LABELS)).toHaveLength(10);
  });
  it("has 5 query type labels", () => {
    expect(Object.keys(QUERY_TYPE_LABELS)).toHaveLength(5);
  });
});

describe("brand-mention-monitor parseList", () => {
  it("parses comma-separated", () => {
    expect(parseList("a, b, c")).toEqual(["a", "b", "c"]);
  });
  it("parses newline-separated", () => {
    expect(parseList("a\nb\nc")).toEqual(["a", "b", "c"]);
  });
  it("dedupes case-insensitive", () => {
    expect(parseList("Apple, apple, APPLE")).toEqual(["Apple"]);
  });
  it("trims whitespace", () => {
    expect(parseList("  apple  , banana ")).toEqual(["apple", "banana"]);
  });
  it("handles empty input", () => {
    expect(parseList("")).toEqual([]);
    expect(parseList(undefined)).toEqual([]);
  });
  it("handles array input", () => {
    expect(parseList(["a", "b", "a"])).toEqual(["a", "b"]);
  });
});

describe("brand-mention-monitor buildBrandOrQuery", () => {
  it("returns empty for empty brand", () => {
    expect(buildBrandOrQuery("", [])).toBe("");
  });
  it("returns single quoted brand for no aliases", () => {
    expect(buildBrandOrQuery("Apple", [])).toBe('"Apple"');
  });
  it("returns OR query with aliases", () => {
    expect(buildBrandOrQuery("Apple", ["Apple Inc", "Mac"])).toBe('("Apple" OR "Apple Inc" OR "Mac")');
  });
  it("filters falsy aliases", () => {
    expect(buildBrandOrQuery("Apple", ["", "Mac"])).toBe('("Apple" OR "Mac")');
  });
});

describe("brand-mention-monitor applyNegatives", () => {
  it("returns query as-is for no negatives", () => {
    expect(applyNegatives("foo", [])).toBe("foo");
  });
  it("appends negatives with -", () => {
    expect(applyNegatives("foo", ["coupon", "scam"])).toBe("foo -coupon -scam");
  });
  it("filters empty negatives", () => {
    expect(applyNegatives("foo", ["", "bar"])).toBe("foo -bar");
  });
  it("returns empty for empty query", () => {
    expect(applyNegatives("", ["x"])).toBe("");
  });
});

describe("brand-mention-monitor getPlatform + buildUrl", () => {
  it("returns platform info for known id", () => {
    const p = getPlatform("twitter");
    expect(p.label).toBe("Twitter / X");
  });
  it("throws for unknown platform", () => {
    expect(() => getPlatform("facebook" as Platform)).toThrow();
  });
  it("builds twitter url", () => {
    const url = buildUrl("twitter", "UnQTools");
    expect(url).toContain("twitter.com/search?q=");
    expect(url).toContain(encodeURIComponent("UnQTools"));
  });
  it("builds google alerts url", () => {
    const url = buildUrl("google-alerts", '"UnQTools"');
    expect(url).toContain("google.com/alerts");
    expect(url).toContain(encodeURIComponent('"UnQTools"'));
  });
  it("builds reddit url", () => {
    const url = buildUrl("reddit", "test");
    expect(url).toContain("reddit.com/search");
  });
});

describe("brand-mention-monitor generateBrandQueries", () => {
  const input: MonitorInput = {
    brandName: "UnQTools",
    brandAliases: ["UnQ Tools"],
  };
  it("generates queries for a brand", () => {
    const qs = generateBrandQueries(input);
    // 1 google-alerts + 6 social + 2 news = 9
    expect(qs).toHaveLength(9);
    expect(qs.every((q) => q.queryType === "brand")).toBe(true);
  });
  it("uses OR query for google alerts", () => {
    const qs = generateBrandQueries(input);
    const alert = qs.find((q) => q.platform === "google-alerts")!;
    expect(alert.query).toContain('"UnQTools"');
    expect(alert.query).toContain('"UnQ Tools"');
    expect(alert.query).toContain("OR");
  });
  it("includes negatives in google alerts query", () => {
    const qs = generateBrandQueries({ ...input, negativeKeywords: ["coupon"] });
    const alert = qs.find((q) => q.platform === "google-alerts")!;
    expect(alert.query).toContain("-coupon");
  });
  it("social platforms use OR query without negatives", () => {
    const qs = generateBrandQueries(input);
    const tw = qs.find((q) => q.platform === "twitter")!;
    expect(tw.query).toContain("OR");
    expect(tw.query).not.toContain("-coupon");
  });
  it("news platforms use plain brand name", () => {
    const qs = generateBrandQueries(input);
    const gn = qs.find((q) => q.platform === "google-news")!;
    expect(gn.query).toBe("UnQTools");
  });
  it("returns empty for empty brand", () => {
    expect(generateBrandQueries({ brandName: "" })).toEqual([]);
  });
});

describe("brand-mention-monitor generateCompetitorQueries", () => {
  it("generates queries per competitor", () => {
    const qs = generateCompetitorQueries({
      brandName: "X",
      competitorNames: ["CompA", "CompB"],
    });
    // 2 competitors × (1 google-alerts + 3 social) = 8
    expect(qs).toHaveLength(8);
    expect(qs.every((q) => q.queryType === "competitor")).toBe(true);
  });
  it("uses quoted competitor name in google alerts", () => {
    const qs = generateCompetitorQueries({
      brandName: "X",
      competitorNames: ["CompA"],
    });
    const alert = qs.find((q) => q.platform === "google-alerts")!;
    expect(alert.query).toBe('"CompA"');
  });
  it("returns empty for no competitors", () => {
    expect(generateCompetitorQueries({ brandName: "X" })).toEqual([]);
  });
});

describe("brand-mention-monitor generateNicheQueries", () => {
  it("generates 2 queries per niche (google-search + google-news)", () => {
    const qs = generateNicheQueries({
      brandName: "X",
      nicheKeywords: ["pdf tools", "online utilities"],
    });
    expect(qs).toHaveLength(4);
    expect(qs.every((q) => q.queryType === "niche")).toBe(true);
  });
  it("returns empty for no niches", () => {
    expect(generateNicheQueries({ brandName: "X" })).toEqual([]);
  });
});

describe("brand-mention-monitor generateFounderQueries", () => {
  it("generates 4 queries per founder (alerts + twitter + linkedin + youtube)", () => {
    const qs = generateFounderQueries({
      brandName: "X",
      founderNames: ["Sandeep Gaddam"],
    });
    expect(qs).toHaveLength(4);
    expect(qs.every((q) => q.queryType === "founder")).toBe(true);
  });
  it("uses quoted founder name in google alerts", () => {
    const qs = generateFounderQueries({
      brandName: "X",
      founderNames: ["Sandeep"],
    });
    const alert = qs.find((q) => q.platform === "google-alerts")!;
    expect(alert.query).toBe('"Sandeep"');
  });
  it("returns empty for no founders", () => {
    expect(generateFounderQueries({ brandName: "X" })).toEqual([]);
  });
});

describe("brand-mention-monitor generateBacklinkOpportunityQueries", () => {
  it("generates queries per niche using templates", () => {
    const qs = generateBacklinkOpportunityQueries({
      brandName: "X",
      nicheKeywords: ["pdf tools"],
    });
    // 8 templates, but one uses {competitor} so it's filtered out
    expect(qs.length).toBeGreaterThanOrEqual(7);
    expect(qs.every((q) => q.queryType === "backlink-opportunity")).toBe(true);
  });
  it("includes competitor templates when competitors provided", () => {
    const qs = generateBacklinkOpportunityQueries({
      brandName: "X",
      nicheKeywords: ["pdf tools"],
      competitorNames: ["SmallPDF"],
    });
    const comp = qs.find((q) => q.query.includes("SmallPDF"));
    expect(comp).toBeDefined();
  });
  it("substitutes {niche} in query", () => {
    const qs = generateBacklinkOpportunityQueries({
      brandName: "X",
      nicheKeywords: ["pdf tools"],
    });
    expect(qs.some((q) => q.query.includes("pdf tools"))).toBe(true);
  });
  it("returns empty for no niches", () => {
    expect(generateBacklinkOpportunityQueries({ brandName: "X" })).toEqual([]);
  });
});

describe("brand-mention-monitor generateAllQueries", () => {
  it("combines all query types", () => {
    const all = generateAllQueries({
      brandName: "UnQTools",
      brandAliases: ["UnQ Tools"],
      founderNames: ["Sandeep"],
      competitorNames: ["CompA"],
      nicheKeywords: ["pdf tools"],
    });
    // brand: 9, competitor: 4, niche: 2, founder: 4, backlink: 7+ (8 templates - 1 filtered)
    expect(all.length).toBeGreaterThanOrEqual(26);
    const types = new Set(all.map((q) => q.queryType));
    expect(types.size).toBe(5);
  });
  it("returns empty for empty input", () => {
    expect(generateAllQueries({ brandName: "" })).toEqual([]);
  });
});

describe("brand-mention-monitor filterByType", () => {
  const all = generateAllQueries({
    brandName: "X",
    nicheKeywords: ["pdf"],
    competitorNames: ["Y"],
  });
  it("returns all when type='all'", () => {
    expect(filterByType(all, "all").length).toBe(all.length);
  });
  it("filters by brand type", () => {
    const brand = filterByType(all, "brand");
    expect(brand.every((q) => q.queryType === "brand")).toBe(true);
  });
  it("filters by niche type", () => {
    const niche = filterByType(all, "niche");
    expect(niche.every((q) => q.queryType === "niche")).toBe(true);
  });
  it("returns empty for type with no queries", () => {
    expect(filterByType(all, "founder")).toEqual([]);
  });
});

describe("brand-mention-monitor computeStats", () => {
  it("computes total + byType + byPlatform", () => {
    const all = generateAllQueries({
      brandName: "X",
      nicheKeywords: ["pdf"],
      competitorNames: ["Y"],
    });
    const stats = computeStats(all);
    expect(stats.total).toBe(all.length);
    expect(stats.byType.brand).toBeGreaterThan(0);
    expect(stats.byType.niche).toBeGreaterThan(0);
    expect(stats.byType.competitor).toBeGreaterThan(0);
    expect(stats.byPlatform["google-search"]).toBeGreaterThan(0);
    expect(stats.uniqueSubjects).toBeGreaterThan(0);
  });
  it("returns zero for empty input", () => {
    const stats = computeStats([]);
    expect(stats.total).toBe(0);
    expect(stats.uniqueSubjects).toBe(0);
  });
});

describe("brand-mention-monitor renderText", () => {
  it("groups by query type", () => {
    const qs = generateBrandQueries({ brandName: "X" });
    const text = renderText(qs);
    expect(text).toContain("Brand");
    expect(text).toContain("Google Alerts");
    expect(text).toContain("Query:");
    expect(text).toContain("URL:");
  });
  it("returns empty string for empty input", () => {
    expect(renderText([])).toBe("");
  });
});

describe("brand-mention-monitor renderCsv", () => {
  it("renders header row", () => {
    const csv = renderCsv([]);
    expect(csv).toContain("query_type,platform,subject,query,url");
  });
  it("renders query rows", () => {
    const qs = generateBrandQueries({ brandName: "X" });
    const csv = renderCsv(qs);
    expect(csv).toContain("brand,google-alerts");
    expect(csv).toContain("brand,twitter");
  });
  it("escapes commas in queries", () => {
    const qs = generateBrandQueries({
      brandName: "X",
      brandAliases: ["Y"],
      negativeKeywords: ["a", "b"],
    });
    const csv = renderCsv(qs);
    // google alerts query has spaces and quotes which trigger CSV escaping
    expect(csv).toContain('"');
  });
});

describe("brand-mention-monitor splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
});

describe("brand-mention-monitor history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      brandName: "X",
      aliasCount: 1,
      competitorCount: 0,
      nicheCount: 0,
      founderCount: 0,
      totalQueries: 9,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        brandName: `X${i}`,
        aliasCount: 0,
        competitorCount: 0,
        nicheCount: 0,
        founderCount: 0,
        totalQueries: 1,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      brandName: "X",
      aliasCount: 0,
      competitorCount: 0,
      nicheCount: 0,
      founderCount: 0,
      totalQueries: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("brand-mention-monitor shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      brandName: "UnQTools",
      brandAliases: ["UnQ Tools"],
      nicheKeywords: ["pdf"],
    });
    expect(url).toContain("brand=UnQTools");
    expect(url).toContain("aliases=");
    expect(url).toContain("niches=pdf");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("brand=UnQTools&aliases=UnQ%20Tools&niches=pdf%2Conline");
    expect(p.brandName).toBe("UnQTools");
    expect(p.brandAliases).toEqual(["UnQ Tools"]);
    expect(p.nicheKeywords).toEqual(["pdf", "online"]);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("handles partial hash", () => {
    expect(parseShareUrl("brand=X")).toEqual({ brandName: "X" });
  });
});

// Suppress unused-import lint
export type _Unused = QueryType;

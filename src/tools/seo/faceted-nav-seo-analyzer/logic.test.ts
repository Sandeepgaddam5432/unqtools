import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  BLOAT_THRESHOLD,
  normalizeUrl,
  getBasePath,
  getParams,
  buildParamKey,
  parseUrl,
  parseUrlList,
  countCombinations,
  groupByBasePath,
  detectBloat,
  detectDuplicateContent,
  formatParams,
  generateCanonicalRecommendation,
  generateRobotsRules,
  buildParameterTable,
  filterByRecommendation,
  summarize,
  analyzeUrls,
  renderTextReport,
  renderCsv,
  renderRobotsTxt,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type RecommendationType,
  type ParsedUrl,
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

const U = (raw: string): ParsedUrl => {
  const p = parseUrl(raw);
  if (!p) throw new Error(`failed to parse: ${raw}`);
  return p;
};

describe("faceted-nav constants", () => {
  it("has stable history key", () => {
    expect(HISTORY_KEY).toBe("unqtools:faceted-nav-seo-analyzer:history");
  });
  it("caps history at 20", () => {
    expect(HISTORY_MAX).toBe(20);
  });
  it("uses bloat threshold 10", () => {
    expect(BLOAT_THRESHOLD).toBe(10);
  });
});

describe("faceted-nav normalizeUrl", () => {
  it("trims whitespace", () => {
    expect(normalizeUrl("  /a?b=1  ")).toBe("/a?b=1");
  });
  it("returns empty string for nullish", () => {
    expect(normalizeUrl("")).toBe("");
  });
});

describe("faceted-nav getBasePath", () => {
  it("strips query string", () => {
    expect(getBasePath("https://example.com/products?color=red")).toBe("https://example.com/products");
  });
  it("strips hash", () => {
    expect(getBasePath("/products#section")).toBe("/products");
  });
  it("returns URL unchanged when no query or hash", () => {
    expect(getBasePath("https://x.com/p")).toBe("https://x.com/p");
  });
  it("handles empty input", () => {
    expect(getBasePath("")).toBe("");
  });
  it("strips both query and hash (query first)", () => {
    expect(getBasePath("/p?a=1#x")).toBe("/p");
  });
  it("handles hash before query", () => {
    expect(getBasePath("/p#x?a=1")).toBe("/p");
  });
});

describe("faceted-nav getParams", () => {
  it("parses single param", () => {
    expect(getParams("/p?color=red")).toEqual({ color: "red" });
  });
  it("parses multiple params", () => {
    expect(getParams("/p?color=red&size=m")).toEqual({ color: "red", size: "m" });
  });
  it("decodes percent-encoded values", () => {
    expect(getParams("/p?q=hello%20world")).toEqual({ q: "hello world" });
  });
  it("decodes plus as space", () => {
    expect(getParams("/p?q=hello+world")).toEqual({ q: "hello world" });
  });
  it("returns empty for no query", () => {
    expect(getParams("/p")).toEqual({});
  });
  it("handles param without value", () => {
    expect(getParams("/p?flag")).toEqual({ flag: "" });
  });
  it("first occurrence wins for duplicate keys", () => {
    expect(getParams("/p?color=red&color=blue")).toEqual({ color: "red" });
  });
  it("stops at hash", () => {
    expect(getParams("/p?a=1#b=2")).toEqual({ a: "1" });
  });
});

describe("faceted-nav buildParamKey", () => {
  it("sorts keys alphabetically", () => {
    expect(buildParamKey({ size: "m", color: "red" })).toBe("color=red&size=m");
  });
  it("returns empty string for empty params", () => {
    expect(buildParamKey({})).toBe("");
  });
});

describe("faceted-nav parseUrl", () => {
  it("parses a complete URL", () => {
    const p = parseUrl("https://example.com/products?color=red&size=m");
    expect(p).not.toBeNull();
    expect(p!.basePath).toBe("https://example.com/products");
    expect(p!.params).toEqual({ color: "red", size: "m" });
    expect(p!.paramKey).toBe("color=red&size=m");
    expect(p!.paramCount).toBe(2);
  });
  it("returns null for blank input", () => {
    expect(parseUrl("")).toBeNull();
    expect(parseUrl("   ")).toBeNull();
  });
  it("returns null for URLs with embedded whitespace", () => {
    expect(parseUrl("not a url")).toBeNull();
  });
  it("handles URL without query", () => {
    const p = parseUrl("https://x.com/page");
    expect(p!.paramCount).toBe(0);
    expect(p!.paramKey).toBe("");
  });
});

describe("faceted-nav parseUrlList", () => {
  it("parses multiple lines", () => {
    const list = parseUrlList([
      "https://example.com/products?color=red&size=m",
      "https://example.com/products?color=red&size=l",
      "https://example.com/products?color=blue&size=m",
    ].join("\n"));
    expect(list).toHaveLength(3);
  });
  it("skips blank lines", () => {
    const list = parseUrlList("/a?x=1\n\n/a?x=2");
    expect(list).toHaveLength(2);
  });
  it("dedupes identical URLs", () => {
    const list = parseUrlList("/a?x=1\n/a?x=1");
    expect(list).toHaveLength(1);
  });
  it("returns empty for empty input", () => {
    expect(parseUrlList("")).toEqual([]);
  });
});

describe("faceted-nav countCombinations", () => {
  it("counts unique paramKeys", () => {
    const urls = [
      U("/p?color=red&size=m"),
      U("/p?size=m&color=red"), // same paramKey, different order
      U("/p?color=blue&size=m"),
    ];
    expect(countCombinations(urls)).toBe(2);
  });
  it("returns 0 for empty list", () => {
    expect(countCombinations([])).toBe(0);
  });
});

describe("faceted-nav groupByBasePath", () => {
  it("groups by base path", () => {
    const urls = [
      U("/p?color=red"),
      U("/p?color=blue"),
      U("/q?size=m"),
    ];
    const groups = groupByBasePath(urls);
    expect(groups).toHaveLength(2);
    const pGroup = groups.find((g) => g.basePath === "/p");
    expect(pGroup!.urls).toHaveLength(2);
    expect(pGroup!.combinationCount).toBe(2);
    expect(pGroup!.hasBloat).toBe(false);
    expect(pGroup!.hasDuplicateContentRisk).toBe(false);
  });
  it("detects duplicate-content risk", () => {
    const urls = [
      U("/p?color=red&size=m"),
      U("/p?size=m&color=red"), // same params, different order
    ];
    const groups = groupByBasePath(urls);
    expect(groups[0].hasDuplicateContentRisk).toBe(true);
    expect(groups[0].combinationCount).toBe(1);
  });
  it("detects parameter bloat when >10 combinations", () => {
    const urls: ParsedUrl[] = [];
    for (let i = 0; i < 12; i++) {
      urls.push(U(`/p?n=${i}`));
    }
    const groups = groupByBasePath(urls);
    expect(groups[0].hasBloat).toBe(true);
    expect(groups[0].combinationCount).toBe(12);
  });
  it("sorts groups by URL count desc", () => {
    const urls = [
      U("/a?x=1"),
      U("/b?y=1"),
      U("/b?y=2"),
    ];
    const groups = groupByBasePath(urls);
    expect(groups[0].basePath).toBe("/b");
    expect(groups[1].basePath).toBe("/a");
  });
  it("aggregates distinct parameter names per group", () => {
    const urls = [
      U("/p?color=red"),
      U("/p?size=m"),
      U("/p?brand=nike"),
    ];
    const groups = groupByBasePath(urls);
    expect(groups[0].paramNames).toEqual(["brand", "color", "size"]);
  });
});

describe("faceted-nav detectBloat & detectDuplicateContent", () => {
  it("detectBloat returns true above threshold", () => {
    const urls: ParsedUrl[] = [];
    for (let i = 0; i < 11; i++) urls.push(U(`/p?n=${i}`));
    const groups = groupByBasePath(urls);
    expect(detectBloat(groups[0])).toBe(true);
  });
  it("detectBloat returns false at-or-below threshold", () => {
    const urls: ParsedUrl[] = [];
    for (let i = 0; i < 10; i++) urls.push(U(`/p?n=${i}`));
    const groups = groupByBasePath(urls);
    expect(detectBloat(groups[0])).toBe(false);
  });
  it("detectDuplicateContent true when same params appear twice", () => {
    const urls = [
      U("/p?color=red&size=m"),
      U("/p?size=m&color=red"),
    ];
    const groups = groupByBasePath(urls);
    expect(detectDuplicateContent(groups[0])).toBe(true);
  });
  it("detectDuplicateContent false when all unique", () => {
    const urls = [
      U("/p?color=red"),
      U("/p?color=blue"),
    ];
    const groups = groupByBasePath(urls);
    expect(detectDuplicateContent(groups[0])).toBe(false);
  });
});

describe("faceted-nav formatParams", () => {
  it("formats params as 'k=v; k=v'", () => {
    expect(formatParams({ color: "red", size: "m" })).toBe("color=red; size=m");
  });
  it("returns empty for empty params", () => {
    expect(formatParams({})).toBe("");
  });
});

describe("faceted-nav generateCanonicalRecommendation", () => {
  it("recommends block-in-robots for bloated groups", () => {
    const urls: ParsedUrl[] = [];
    for (let i = 0; i < 12; i++) urls.push(U(`/p?n=${i}`));
    const groups = groupByBasePath(urls);
    const rec = generateCanonicalRecommendation(urls[0], groups[0]);
    expect(rec.recommendation).toBe("block-in-robots");
    expect(rec.reason).toContain("bloat");
  });
  it("recommends canonical-to-base for duplicate-content URLs", () => {
    const urls = [
      U("/p?color=red&size=m"),
      U("/p?size=m&color=red"),
    ];
    const groups = groupByBasePath(urls);
    const rec = generateCanonicalRecommendation(urls[0], groups[0]);
    expect(rec.recommendation).toBe("canonical-to-base");
    expect(rec.reason).toContain("Duplicate-content");
  });
  it("recommends self-canonical for unique URLs", () => {
    const urls = [
      U("/p?color=red"),
      U("/p?color=blue"),
    ];
    const groups = groupByBasePath(urls);
    const rec = generateCanonicalRecommendation(urls[0], groups[0]);
    expect(rec.recommendation).toBe("self-canonical");
  });
  it("recommends self-canonical for URL on group-with-duplicates-but-itself-unique", () => {
    const urls = [
      U("/p?color=red&size=m"),
      U("/p?size=m&color=red"), // duplicate
      U("/p?color=blue"), // unique
    ];
    const groups = groupByBasePath(urls);
    const blue = generateCanonicalRecommendation(urls[2], groups[0]);
    expect(blue.recommendation).toBe("self-canonical");
  });
});

describe("faceted-nav generateRobotsRules", () => {
  it("returns no rules when no bloat", () => {
    const urls = [U("/p?x=1")];
    const groups = groupByBasePath(urls);
    expect(generateRobotsRules(groups)).toEqual([]);
  });
  it("generates disallow rules for bloated groups", () => {
    const urls: ParsedUrl[] = [];
    for (let i = 0; i < 12; i++) urls.push(U(`/p?n=${i}`));
    const groups = groupByBasePath(urls);
    const rules = generateRobotsRules(groups);
    expect(rules).toHaveLength(1);
    expect(rules[0].userAgent).toBe("*");
    expect(rules[0].disallow.length).toBeGreaterThan(0);
    expect(rules[0].disallow.some((d) => d.includes("/p?*"))).toBe(true);
  });
});

describe("faceted-nav buildParameterTable", () => {
  it("aggregates distinct values per param name", () => {
    const urls = [
      U("/p?color=red&size=m"),
      U("/p?color=blue&size=m"),
      U("/p?color=red&size=l"),
    ];
    const table = buildParameterTable(urls);
    const colorRow = table.find((r) => r.name === "color");
    expect(colorRow!.distinctValuesCount).toBe(2);
    const sizeRow = table.find((r) => r.name === "size");
    expect(sizeRow!.distinctValuesCount).toBe(2);
  });
  it("returns empty for no params", () => {
    expect(buildParameterTable([U("/p"), U("/q")])).toEqual([]);
  });
  it("sorts by distinct value count desc", () => {
    const urls = [
      U("/p?a=1&b=1"),
      U("/p?a=1&b=2"),
      U("/p?a=1&b=3"),
    ];
    // a has 1 distinct value, b has 3 distinct values
    const table = buildParameterTable(urls);
    expect(table[0].name).toBe("b");
    expect(table[0].distinctValuesCount).toBe(3);
    expect(table[1].name).toBe("a");
    expect(table[1].distinctValuesCount).toBe(1);
  });
});

describe("faceted-nav filterByRecommendation", () => {
  it("filters by type", () => {
    const urls = [
      U("/p?color=red&size=m"),
      U("/p?size=m&color=red"),
      U("/q?color=blue"),
    ];
    const result = analyzeUrls(urls);
    const blocked = filterByRecommendation(result.recommendations, "canonical-to-base");
    expect(blocked.every((r) => r.recommendation === "canonical-to-base")).toBe(true);
  });
  it("returns all when type='all'", () => {
    const urls = [U("/p?x=1")];
    const result = analyzeUrls(urls);
    expect(filterByRecommendation(result.recommendations, "all")).toHaveLength(1);
  });
});

describe("faceted-nav summarize", () => {
  it("computes summary stats", () => {
    const urls = [
      U("/p?color=red&size=m"),
      U("/p?size=m&color=red"), // duplicate
      U("/q?x=1"), // unique
    ];
    const result = analyzeUrls(urls);
    const s = summarize(result);
    expect(s.totalUrls).toBe(3);
    expect(s.basePaths).toBe(2);
    expect(s.duplicateContentCount).toBe(1);
    expect(s.bloatCount).toBe(0);
    expect(s.recommendationsByType["canonical-to-base"]).toBe(2);
    expect(s.recommendationsByType["self-canonical"]).toBe(1);
  });
});

describe("faceted-nav analyzeUrls end-to-end", () => {
  it("produces a complete analysis result", () => {
    const urls = [
      U("https://example.com/products?color=red&size=m"),
      U("https://example.com/products?size=m&color=red"),
      U("https://example.com/products?color=blue"),
      U("https://example.com/blog?tag=seo"),
    ];
    const result = analyzeUrls(urls);
    expect(result.groups).toHaveLength(2);
    expect(result.recommendations).toHaveLength(4);
    expect(result.paramTable.length).toBeGreaterThan(0);
    expect(result.summary.totalUrls).toBe(4);
  });
  it("handles empty input", () => {
    const result = analyzeUrls([]);
    expect(result.summary.totalUrls).toBe(0);
    expect(result.groups).toEqual([]);
    expect(result.recommendations).toEqual([]);
  });
});

describe("faceted-nav renderTextReport", () => {
  it("renders header and key sections", () => {
    const urls = [U("/p?color=red&size=m")];
    const result = analyzeUrls(urls);
    const text = renderTextReport(result);
    expect(text).toContain("Faceted Nav SEO Analysis");
    expect(text).toContain("Total URLs:");
    expect(text).toContain("Base-path groups");
    expect(text).toContain("URL parameter table");
    expect(text).toContain("robots.txt suggestions");
  });
  it("shows bloat warning when bloated", () => {
    const urls: ParsedUrl[] = [];
    for (let i = 0; i < 12; i++) urls.push(U(`/p?n=${i}`));
    const result = analyzeUrls(urls);
    const text = renderTextReport(result);
    expect(text).toContain("[BLOAT]");
  });
  it("handles empty analysis", () => {
    const result = analyzeUrls([]);
    const text = renderTextReport(result);
    expect(text).toContain("Total URLs:        0");
  });
});

describe("faceted-nav renderCsv", () => {
  it("renders header row", () => {
    expect(renderCsv([])).toContain("url,base_path,params,recommendation,reason");
  });
  it("renders URL rows", () => {
    const urls = [U("/p?color=red")];
    const result = analyzeUrls(urls);
    const csv = renderCsv(result.recommendations);
    expect(csv).toContain("/p?color=red");
    expect(csv).toContain("self-canonical");
  });
  it("escapes commas in params", () => {
    const urls = [U("/p?q=a,b")];
    const result = analyzeUrls(urls);
    const csv = renderCsv(result.recommendations);
    // params contain comma → quoted
    expect(csv).toContain('"q=a,b"');
  });
});

describe("faceted-nav renderRobotsTxt", () => {
  it("returns note when no rules", () => {
    expect(renderRobotsTxt([])).toContain("No robots.txt blocking required");
  });
  it("renders User-agent and Disallow lines", () => {
    const urls: ParsedUrl[] = [];
    for (let i = 0; i < 12; i++) urls.push(U(`/p?n=${i}`));
    const groups = groupByBasePath(urls);
    const rules = generateRobotsRules(groups);
    const txt = renderRobotsTxt(rules);
    expect(txt).toContain("User-agent: *");
    expect(txt).toContain("Disallow: /p?*");
  });
});

describe("faceted-nav history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, urlCount: 5, basePathsCount: 2, duplicateGroups: 1, bloatGroups: 0 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, urlCount: 1, basePathsCount: 1, duplicateGroups: 0, bloatGroups: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, urlCount: 1, basePathsCount: 1, duplicateGroups: 0, bloatGroups: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("faceted-nav shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("/p?x=1\n/q?y=2");
    expect(url).toContain("urls=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const encoded = encodeURIComponent("/p?x=1\n/q?y=2");
    const p = parseShareUrl(`urls=${encoded}`);
    expect(p.urls).toBe("/p?x=1\n/q?y=2");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ urls: "" });
  });
  it("round-trips URLs through build/parse", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const input = "https://example.com/p?color=red&size=m\nhttps://example.com/p?color=blue";
    const url = buildShareUrl(input);
    const hash = url.startsWith("?") ? url.slice(1) : url.split("#")[1] || "";
    const p = parseShareUrl(hash);
    expect(p.urls).toBe(input);
    (globalThis as Record<string, unknown>).window = origWindow;
  });
});

// Suppress unused-import lint
export type _Unused = RecommendationType;

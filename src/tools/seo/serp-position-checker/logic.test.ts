import { describe, it, expect, beforeEach } from "vitest";
import {
  normalize,
  extractSlug,
  extractDomain,
  classifyIntent,
  urlMatch,
  estimateDifficulty,
  computeFactors,
  positionCategory,
  buildRecommendations,
  estimate,
  parseBulk,
  estimateBulk,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  RANKING_FACTORS_REFERENCE,
  type EstimateInput,
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

describe("serp-position-checker constants", () => {
  it("has 7 ranking factors in reference", () => {
    expect(RANKING_FACTORS_REFERENCE).toHaveLength(7);
  });
  it("factors reference includes URL match", () => {
    expect(RANKING_FACTORS_REFERENCE.some((f) => f.name === "URL match")).toBe(true);
  });
  it("factors weights sum close to 1", () => {
    const sum = RANKING_FACTORS_REFERENCE.reduce((acc, f) => acc + f.weight, 0);
    expect(sum).toBeGreaterThan(0.95);
    expect(sum).toBeLessThanOrEqual(1.0);
  });
});

describe("serp-position-checker normalize", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalize("  Best   SEO  ")).toBe("best seo");
  });
  it("handles empty", () => {
    expect(normalize("")).toBe("");
  });
});

describe("serp-position-checker extractSlug", () => {
  it("extracts last path segment", () => {
    expect(extractSlug("https://example.com/blog/best-seo-tools")).toBe("best-seo-tools");
  });
  it("strips query and hash", () => {
    expect(extractSlug("https://example.com/page?foo=bar")).toBe("page");
    expect(extractSlug("https://example.com/page#section")).toBe("page");
  });
  it("returns empty for root domain", () => {
    expect(extractSlug("https://example.com")).toBe("");
  });
  it("handles empty input", () => {
    expect(extractSlug("")).toBe("");
  });
});

describe("serp-position-checker extractDomain", () => {
  it("extracts domain without protocol", () => {
    expect(extractDomain("https://www.example.com/path")).toBe("example.com");
  });
  it("handles bare domain", () => {
    expect(extractDomain("example.com")).toBe("example.com");
  });
  it("returns empty for empty", () => {
    expect(extractDomain("")).toBe("");
  });
});

describe("serp-position-checker classifyIntent", () => {
  it("classifies informational", () => {
    expect(classifyIntent("what is seo")).toBe("informational");
    expect(classifyIntent("how to do seo")).toBe("informational");
  });
  it("classifies commercial", () => {
    expect(classifyIntent("best seo tools")).toBe("commercial");
    expect(classifyIntent("seo tool reviews")).toBe("commercial");
  });
  it("classifies transactional", () => {
    expect(classifyIntent("buy seo software")).toBe("transactional");
    expect(classifyIntent("cheap seo deal")).toBe("transactional");
  });
  it("defaults to informational", () => {
    expect(classifyIntent("random phrase here")).toBe("informational");
  });
});

describe("serp-position-checker urlMatch", () => {
  it("detects exact match", () => {
    expect(urlMatch("best seo tools", "https://example.com/best-seo-tools")).toBe("exact");
  });
  it("detects partial match", () => {
    expect(urlMatch("best seo tools", "https://example.com/best-tools")).toBe("partial");
  });
  it("detects no match", () => {
    expect(urlMatch("best seo tools", "https://example.com/blog/random-post")).toBe("none");
  });
  it("returns none for empty inputs", () => {
    expect(urlMatch("", "https://example.com/page")).toBe("none");
    expect(urlMatch("seo", "")).toBe("none");
  });
});

describe("serp-position-checker estimateDifficulty", () => {
  it("returns 0 for empty", () => {
    expect(estimateDifficulty("")).toBe(0);
  });
  it("head term = harder than long-tail", () => {
    const head = estimateDifficulty("seo");
    const long = estimateDifficulty("what is the best seo tool for small business owners");
    expect(long).toBeLessThan(head);
  });
  it("stays within 1-100", () => {
    const d = estimateDifficulty("extremely long low competition keyword phrase for testing only");
    expect(d).toBeGreaterThanOrEqual(1);
    expect(d).toBeLessThanOrEqual(100);
  });
  it("is deterministic", () => {
    expect(estimateDifficulty("seo tools")).toBe(estimateDifficulty("seo tools"));
  });
});

describe("serp-position-checker computeFactors", () => {
  const input: EstimateInput = {
    keyword: "best seo tools",
    url: "https://example.com/best-seo-tools",
    domainAuthority: 60,
    backlinks: 100,
    contentWords: 1500,
    titleHasKeyword: true,
    intentMatch: true,
  };
  const factors = computeFactors(input);
  it("returns 7 factors", () => {
    expect(factors).toHaveLength(7);
  });
  it("each factor has name, raw, weight, contribution, note", () => {
    for (const f of factors) {
      expect(f.name).toBeTruthy();
      expect(typeof f.raw).toBe("number");
      expect(typeof f.weight).toBe("number");
      expect(typeof f.contribution).toBe("number");
      expect(f.note).toBeTruthy();
    }
  });
  it("URL match factor scores high for exact match", () => {
    const urlFactor = factors.find((f) => f.name === "URL match");
    expect(urlFactor?.raw).toBeGreaterThan(80);
  });
  it("title tag factor scores 90 when keyword in title", () => {
    const titleFactor = factors.find((f) => f.name === "Title tag");
    expect(titleFactor?.raw).toBe(90);
  });
  it("weights sum to 1", () => {
    const sum = factors.reduce((acc, f) => acc + f.weight, 0);
    expect(sum).toBeCloseTo(1.0, 2);
  });
});

describe("serp-position-checker positionCategory", () => {
  it("Top 3", () => { expect(positionCategory(1)).toBe("Top 3"); expect(positionCategory(3)).toBe("Top 3"); });
  it("Top 10", () => { expect(positionCategory(5)).toBe("Top 10"); expect(positionCategory(10)).toBe("Top 10"); });
  it("Top 20", () => { expect(positionCategory(15)).toBe("Top 20"); expect(positionCategory(20)).toBe("Top 20"); });
  it("Top 50", () => { expect(positionCategory(30)).toBe("Top 50"); expect(positionCategory(50)).toBe("Top 50"); });
  it("Top 100", () => { expect(positionCategory(75)).toBe("Top 100"); expect(positionCategory(100)).toBe("Top 100"); });
  it("Beyond 100", () => { expect(positionCategory(101)).toBe("Beyond 100"); });
});

describe("serp-position-checker buildRecommendations", () => {
  it("returns recommendations for low-scoring factors", () => {
    const factors = [
      { name: "URL match", raw: 25, weight: 0.18, contribution: 0, note: "No keyword in URL" },
      { name: "Title tag", raw: 90, weight: 0.20, contribution: 0, note: "Good" },
    ];
    const recs = buildRecommendations(factors, "Top 50");
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.some((r) => r.includes("url match"))).toBe(true);
  });
  it("suggests long-tail for Beyond 100", () => {
    const recs = buildRecommendations([], "Beyond 100");
    expect(recs.some((r) => r.includes("long-tail"))).toBe(true);
  });
  it("suggests freshness for Top 10", () => {
    const recs = buildRecommendations([], "Top 10");
    expect(recs.some((r) => r.includes("freshness"))).toBe(true);
  });
});

describe("serp-position-checker estimate", () => {
  it("returns a result with all fields", () => {
    const r = estimate({
      keyword: "best seo tools",
      url: "https://example.com/best-seo-tools",
      domainAuthority: 70,
      backlinks: 200,
      contentWords: 2000,
      titleHasKeyword: true,
      intentMatch: true,
    });
    expect(r.keyword).toBe("best seo tools");
    expect(r.estimatedPosition).toBeGreaterThanOrEqual(1);
    expect(r.estimatedPosition).toBeLessThanOrEqual(101);
    expect(r.category).toBeTruthy();
    expect(r.difficulty).toBeGreaterThanOrEqual(1);
    expect(r.intent).toBeTruthy();
    expect(r.factors).toHaveLength(7);
    expect(r.recommendations.length).toBeGreaterThan(0);
    expect(r.urlMatch).toBe("exact");
  });
  it("stronger inputs yield better positions", () => {
    const weak = estimate({
      keyword: "best seo tools",
      url: "https://example.com/random",
      domainAuthority: 10,
      backlinks: 2,
      contentWords: 200,
      titleHasKeyword: false,
      intentMatch: false,
    });
    const strong = estimate({
      keyword: "best seo tools",
      url: "https://example.com/best-seo-tools",
      domainAuthority: 80,
      backlinks: 500,
      contentWords: 2500,
      titleHasKeyword: true,
      intentMatch: true,
    });
    expect(strong.estimatedPosition).toBeLessThan(weak.estimatedPosition);
  });
});

describe("serp-position-checker parseBulk", () => {
  it("parses keyword + url lines", () => {
    const input = "best seo tools,https://example.com/best-seo-tools\ncontent marketing,https://example.com/content";
    const out = parseBulk(input);
    expect(out).toHaveLength(2);
    expect(out[0].keyword).toBe("best seo tools");
    expect(out[0].url).toBe("https://example.com/best-seo-tools");
  });
  it("applies defaults for missing fields", () => {
    const out = parseBulk("seo", { domainAuthority: 50, backlinks: 30 });
    expect(out[0].domainAuthority).toBe(50);
    expect(out[0].backlinks).toBe(30);
    expect(out[0].contentWords).toBe(1000);
  });
  it("returns empty for empty input", () => {
    expect(parseBulk("")).toEqual([]);
  });
  it("skips blank lines", () => {
    expect(parseBulk("seo\n\nmarketing")).toHaveLength(2);
  });
});

describe("serp-position-checker estimateBulk", () => {
  it("returns results and byCategory counts", () => {
    const inputs = parseBulk("seo\nbest seo tools\nrandom long tail keyword phrase here");
    const result = estimateBulk(inputs);
    expect(result.total).toBe(3);
    expect(result.results).toHaveLength(3);
    expect(Object.keys(result.byCategory).length).toBeGreaterThan(0);
  });
  it("handles empty input", () => {
    const result = estimateBulk([]);
    expect(result.total).toBe(0);
    expect(result.results).toEqual([]);
  });
});

describe("serp-position-checker renderCsv", () => {
  it("renders header", () => {
    const csv = renderCsv(estimateBulk([]));
    expect(csv).toContain("keyword,url,estimated_position,category,difficulty,intent,url_match");
  });
  it("renders result rows", () => {
    const inputs = parseBulk("best seo tools,https://example.com/best-seo-tools");
    const csv = renderCsv(estimateBulk(inputs));
    expect(csv).toContain("best seo tools");
    expect(csv).toContain("https://example.com/best-seo-tools");
  });
});

describe("serp-position-checker history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, total: 5, top10: 2 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, total: 1, top10: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, total: 1, top10: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("serp-position-checker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("seo,https://example.com/seo");
    expect(url).toContain("data=seo");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("data=seo%2Chttps%3A%2F%2Fexample.com");
    expect(p.data).toBe("seo,https://example.com");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("").data).toBe("");
  });
});

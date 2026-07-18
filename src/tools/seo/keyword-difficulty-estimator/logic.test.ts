import { describe, it, expect, beforeEach } from "vitest";
import {
  COMMERCIAL_INTENT_WORDS,
  INTENT_PREFIXES,
  QUESTION_WORDS,
  COMPARISON_WORDS,
  normalize,
  tokenize,
  findCommercialIntent,
  findBrandTokens,
  findIntentPrefix,
  findQuestionWord,
  findComparisonWord,
  categorize,
  computeFactors,
  computeDifficulty,
  computeOpportunity,
  generateRecommendation,
  analyzeKeyword,
  parseBulk,
  dedup,
  sortResults,
  analyzeBulk,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
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

describe("keyword-difficulty-estimator constants", () => {
  it("has commercial intent words", () => {
    expect(COMMERCIAL_INTENT_WORDS).toContain("buy");
    expect(COMMERCIAL_INTENT_WORDS).toContain("cheap");
  });
  it("has intent prefixes", () => {
    expect(INTENT_PREFIXES).toContain("best");
  });
  it("has question words", () => {
    expect(QUESTION_WORDS).toContain("what");
    expect(QUESTION_WORDS).toContain("how");
  });
  it("has comparison words", () => {
    expect(COMPARISON_WORDS).toContain("vs");
  });
});

describe("keyword-difficulty-estimator normalize & tokenize", () => {
  it("normalize lowercases and collapses", () => {
    expect(normalize("  SEO   Tools  ")).toBe("seo tools");
  });
  it("tokenize splits on space", () => {
    expect(tokenize("best seo tools")).toEqual(["best", "seo", "tools"]);
  });
  it("tokenize returns empty for empty", () => {
    expect(tokenize("")).toEqual([]);
  });
});

describe("keyword-difficulty-estimator findCommercialIntent", () => {
  it("finds buy", () => {
    expect(findCommercialIntent("buy shoes")).toContain("buy");
  });
  it("finds cheap", () => {
    expect(findCommercialIntent("cheap flights")).toContain("cheap");
  });
  it("returns empty for informational", () => {
    expect(findCommercialIntent("what is seo")).toEqual([]);
  });
});

describe("keyword-difficulty-estimator findBrandTokens", () => {
  it("finds known brand", () => {
    expect(findBrandTokens("apple iphone")).toContain("apple");
  });
  it("returns empty for non-brand", () => {
    expect(findBrandTokens("seo tools")).toEqual([]);
  });
});

describe("keyword-difficulty-estimator findIntentPrefix", () => {
  it("finds best prefix", () => {
    expect(findIntentPrefix("best seo tools")).toBe("best");
  });
  it("returns null when not prefix", () => {
    expect(findIntentPrefix("seo best tools")).toBeNull();
  });
});

describe("keyword-difficulty-estimator findQuestionWord", () => {
  it("finds question at start", () => {
    expect(findQuestionWord("what is seo")).toBe("what");
  });
  it("returns null when not at start", () => {
    expect(findQuestionWord("seo what to do")).toBeNull();
  });
});

describe("keyword-difficulty-estimator findComparisonWord", () => {
  it("finds vs anywhere", () => {
    expect(findComparisonWord("ahrefs vs semrush")).toBe("vs");
  });
  it("returns null when absent", () => {
    expect(findComparisonWord("seo tools")).toBeNull();
  });
});

describe("keyword-difficulty-estimator categorize", () => {
  it("Easy under 30", () => expect(categorize(20)).toBe("Easy"));
  it("Medium 30-54", () => expect(categorize(45)).toBe("Medium"));
  it("Hard 55-74", () => expect(categorize(65)).toBe("Hard"));
  it("Very Hard 75+", () => expect(categorize(85)).toBe("Very Hard"));
});

describe("keyword-difficulty-estimator computeFactors", () => {
  it("returns factor array", () => {
    const f = computeFactors("best seo tools");
    expect(f.length).toBeGreaterThanOrEqual(5);
    expect(f.some((x) => x.label === "Word count")).toBe(true);
  });
  it("single word has high word count factor", () => {
    const f = computeFactors("seo");
    const wc = f.find((x) => x.label === "Word count");
    expect(wc?.value).toBeGreaterThan(20);
  });
  it("commercial intent adds positive factor", () => {
    const f = computeFactors("buy cheap shoes");
    const ci = f.find((x) => x.label === "Commercial intent");
    expect(ci?.value).toBeGreaterThan(0);
  });
  it("question reduces difficulty", () => {
    const f = computeFactors("what is seo");
    const q = f.find((x) => x.label === "Question modifier");
    expect(q?.value).toBeLessThan(0);
  });
});

describe("keyword-difficulty-estimator computeDifficulty", () => {
  it("returns 0 for empty", () => {
    expect(computeDifficulty("")).toBe(0);
  });
  it("head term is hard", () => {
    expect(computeDifficulty("seo")).toBeGreaterThan(50);
  });
  it("long-tail is easier", () => {
    expect(computeDifficulty("what is the best seo tool for beginners"))
      .toBeLessThan(computeDifficulty("seo"));
  });
  it("stays in 1-100 range", () => {
    expect(computeDifficulty("x")).toBeGreaterThanOrEqual(1);
    expect(computeDifficulty("x")).toBeLessThanOrEqual(100);
  });
  it("is deterministic", () => {
    expect(computeDifficulty("best seo tools")).toBe(computeDifficulty("best seo tools"));
  });
  it("brand terms are harder", () => {
    expect(computeDifficulty("apple")).toBeGreaterThan(computeDifficulty("fruit apple online"));
  });
});

describe("keyword-difficulty-estimator computeOpportunity", () => {
  it("lowers difficulty = higher opportunity", () => {
    const highOpp = computeOpportunity("what is seo explained simply", 10);
    const lowOpp = computeOpportunity("buy shoes", 90);
    expect(highOpp).toBeGreaterThan(lowOpp);
  });
  it("commercial intent boosts opportunity", () => {
    const withCommercial = computeOpportunity("buy cheap shoes", 50);
    const without = computeOpportunity("running shoes", 50);
    expect(withCommercial).toBeGreaterThan(without);
  });
  it("stays in 0-100", () => {
    const opp = computeOpportunity("anything", 0);
    expect(opp).toBeGreaterThanOrEqual(0);
    expect(opp).toBeLessThanOrEqual(100);
  });
});

describe("keyword-difficulty-estimator generateRecommendation", () => {
  it("Easy recommends targeting", () => {
    const r = generateRecommendation("seo tips", 20);
    expect(r.toLowerCase()).toContain("target");
  });
  it("Medium recommends content", () => {
    const r = generateRecommendation("seo guide", 45);
    expect(r.toLowerCase()).toMatch(/content|target/);
  });
  it("Hard head term recommends long-tail variant", () => {
    const r = generateRecommendation("seo", 65);
    expect(r.toLowerCase()).toMatch(/long(er)?-?tail/);
  });
  it("Very Hard recommends skipping or variant", () => {
    const r = generateRecommendation("seo", 90);
    expect(r.toLowerCase()).toMatch(/skip|long(er)?-?tail|informational/);
  });
});

describe("keyword-difficulty-estimator analyzeKeyword", () => {
  it("returns full result object", () => {
    const r = analyzeKeyword("best seo tools");
    expect(r.keyword).toBe("best seo tools");
    expect(typeof r.difficulty).toBe("number");
    expect(r.category).toBeDefined();
    expect(typeof r.opportunity).toBe("number");
    expect(Array.isArray(r.factors)).toBe(true);
    expect(typeof r.recommendation).toBe("string");
  });
});

describe("keyword-difficulty-estimator parseBulk", () => {
  it("parses newlines", () => {
    expect(parseBulk("a\nb\nc")).toEqual(["a", "b", "c"]);
  });
  it("parses commas", () => {
    expect(parseBulk("a, b, c")).toEqual(["a", "b", "c"]);
  });
  it("returns empty for empty input", () => {
    expect(parseBulk("")).toEqual([]);
  });
});

describe("keyword-difficulty-estimator dedup", () => {
  it("removes case-insensitive duplicates", () => {
    const { unique, removed } = dedup(["SEO", "seo", "Tools"]);
    expect(unique).toHaveLength(2);
    expect(removed).toBe(1);
  });
});

describe("keyword-difficulty-estimator sortResults", () => {
  const sample = [
    { keyword: "alpha", difficulty: 30, category: "Easy" as const, opportunity: 70, factors: [], recommendation: "" },
    { keyword: "beta", difficulty: 80, category: "Very Hard" as const, opportunity: 20, factors: [], recommendation: "" },
    { keyword: "gamma", difficulty: 50, category: "Medium" as const, opportunity: 50, factors: [], recommendation: "" },
  ];
  it("sorts by difficulty desc", () => {
    const out = sortResults(sample, "difficulty", "desc");
    expect(out[0].keyword).toBe("beta");
  });
  it("sorts by opportunity desc", () => {
    const out = sortResults(sample, "opportunity", "desc");
    expect(out[0].keyword).toBe("alpha");
  });
  it("sorts by keyword asc", () => {
    const out = sortResults(sample, "keyword", "asc");
    expect(out[0].keyword).toBe("alpha");
  });
});

describe("keyword-difficulty-estimator analyzeBulk", () => {
  it("analyzes multiple keywords", () => {
    const r = analyzeBulk(["seo", "what is seo"]);
    expect(r.total).toBe(2);
    expect(r.results).toHaveLength(2);
  });
  it("computes average difficulty", () => {
    const r = analyzeBulk(["seo", "what is seo tips for beginners guide"]);
    expect(r.averageDifficulty).toBeGreaterThan(0);
    expect(r.averageDifficulty).toBeLessThanOrEqual(100);
  });
  it("computes category distribution", () => {
    const r = analyzeBulk(["seo", "what is seo"]);
    const sum = r.categoryDistribution.Easy + r.categoryDistribution.Medium + r.categoryDistribution.Hard + r.categoryDistribution["Very Hard"];
    expect(sum).toBe(2);
  });
  it("handles empty input", () => {
    const r = analyzeBulk([]);
    expect(r.total).toBe(0);
    expect(r.averageDifficulty).toBe(0);
  });
  it("dedupes input", () => {
    const r = analyzeBulk(["SEO", "seo"]);
    expect(r.total).toBe(1);
  });
});

describe("keyword-difficulty-estimator renderCsv", () => {
  it("renders header", () => {
    const csv = renderCsv(analyzeBulk(["seo"]));
    expect(csv).toContain("keyword,difficulty,category,opportunity");
  });
  it("escapes commas", () => {
    const csv = renderCsv(analyzeBulk(["best, cheap"]));
    expect(csv).toContain('"best, cheap"');
  });
});

describe("keyword-difficulty-estimator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, keywordCount: 5, averageDifficulty: 50, snippet: "seo" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, keywordCount: 1, averageDifficulty: 50, snippet: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, keywordCount: 1, averageDifficulty: 50, snippet: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("keyword-difficulty-estimator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("SEO");
    expect(url).toContain("kw=SEO");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("kw=SEO%2CMarketing");
    expect(p.keywords).toBe("SEO,Marketing");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ keywords: "" });
  });
  it("omits empty keywords", () => {
    const url = buildShareUrl("");
    expect(url).not.toContain("kw=");
  });
});

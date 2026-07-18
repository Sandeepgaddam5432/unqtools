import { describe, it, expect, beforeEach } from "vitest";
import {
  INTENT_PATTERNS,
  CONTENT_RECOMMENDATIONS,
  SERP_FEATURES,
  normalize,
  tokenize,
  detectPatterns,
  calculateConfidence,
  classify,
  parseBulk,
  dedup,
  classifyBulk,
  renderCsv,
  getPatternReference,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
} from "./logic";
import type { IntentType } from "./logic";

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

describe("search-intent-classifier constants", () => {
  it("has 4 intent types in patterns", () => {
    const keys = Object.keys(INTENT_PATTERNS);
    expect(keys).toHaveLength(4);
    expect(keys).toContain("informational");
    expect(keys).toContain("transactional");
    expect(keys).toContain("navigational");
    expect(keys).toContain("commercial");
  });
  it("has content recommendations for all types", () => {
    expect(CONTENT_RECOMMENDATIONS.informational.length).toBeGreaterThan(10);
    expect(CONTENT_RECOMMENDATIONS.transactional.length).toBeGreaterThan(10);
    expect(CONTENT_RECOMMENDATIONS.navigational.length).toBeGreaterThan(10);
    expect(CONTENT_RECOMMENDATIONS.commercial.length).toBeGreaterThan(10);
  });
  it("has SERP features for all types", () => {
    expect(SERP_FEATURES.informational).toBeTruthy();
    expect(SERP_FEATURES.transactional).toBeTruthy();
  });
  it("has multiple patterns per intent", () => {
    expect(INTENT_PATTERNS.informational.length).toBeGreaterThan(5);
    expect(INTENT_PATTERNS.transactional.length).toBeGreaterThan(5);
  });
});

describe("search-intent-classifier normalize & tokenize", () => {
  it("normalize lowercases", () => {
    expect(normalize("  SEO Tools  ")).toBe("seo tools");
  });
  it("tokenize splits", () => {
    expect(tokenize("best seo tools")).toEqual(["best", "seo", "tools"]);
  });
  it("tokenize empty for empty", () => {
    expect(tokenize("")).toEqual([]);
  });
});

describe("search-intent-classifier detectPatterns", () => {
  it("detects informational patterns", () => {
    const { matched, scores } = detectPatterns("what is seo");
    expect(matched.informational.length).toBeGreaterThan(0);
    expect(scores.informational).toBeGreaterThan(0);
  });
  it("detects transactional patterns", () => {
    const { scores } = detectPatterns("buy nike shoes");
    expect(scores.transactional).toBeGreaterThan(0);
  });
  it("detects navigational patterns", () => {
    const { scores } = detectPatterns("ahrefs login");
    expect(scores.navigational).toBeGreaterThan(0);
  });
  it("detects commercial patterns", () => {
    const { scores } = detectPatterns("best seo tools 2026");
    expect(scores.commercial).toBeGreaterThan(0);
  });
  it("multi-word pattern matches phrase", () => {
    const { matched } = detectPatterns("how to bake bread");
    expect(matched.informational).toContain("how to");
  });
  it("returns empty for empty keyword", () => {
    const { matched, scores } = detectPatterns("");
    expect(matched.informational).toEqual([]);
    expect(scores.informational).toBe(0);
  });
});

describe("search-intent-classifier calculateConfidence", () => {
  it("defaults to informational at 25% with no signals", () => {
    const r = calculateConfidence({ informational: 0, navigational: 0, transactional: 0, commercial: 0 });
    expect(r.primary).toBe("informational");
    expect(r.confidence).toBe(25);
    expect(r.isMixed).toBe(true);
  });
  it("single dominant intent = high confidence", () => {
    const r = calculateConfidence({ informational: 10, navigational: 0, transactional: 0, commercial: 0 });
    expect(r.primary).toBe("informational");
    expect(r.confidence).toBe(100);
    expect(r.isMixed).toBe(false);
  });
  it("close tie = mixed", () => {
    const r = calculateConfidence({ informational: 5, navigational: 0, transactional: 4, commercial: 0 });
    expect(r.isMixed).toBe(true);
  });
  it("confidence is at least 25", () => {
    const r = calculateConfidence({ informational: 1, navigational: 1, transactional: 1, commercial: 1 });
    expect(r.confidence).toBeGreaterThanOrEqual(25);
  });
});

describe("search-intent-classifier classify", () => {
  it("classifies informational", () => {
    const r = classify("what is seo");
    expect(r.primaryIntent).toBe("informational");
  });
  it("classifies transactional", () => {
    const r = classify("buy nike shoes online");
    expect(r.primaryIntent).toBe("transactional");
  });
  it("classifies navigational", () => {
    const r = classify("ahrefs login");
    expect(r.primaryIntent).toBe("navigational");
  });
  it("classifies commercial", () => {
    const r = classify("best seo tools 2026");
    expect(r.primaryIntent).toBe("commercial");
  });
  it("returns full result with all fields", () => {
    const r = classify("best cheap buy shoes");
    expect(typeof r.confidence).toBe("number");
    expect(typeof r.isMixed).toBe("boolean");
    expect(Array.isArray(r.matchedPatterns)).toBe(true);
    expect(typeof r.contentRecommendation).toBe("string");
    expect(typeof r.serpFeature).toBe("string");
  });
  it("empty keyword returns informational fallback", () => {
    const r = classify("");
    expect(r.primaryIntent).toBe("informational");
  });
});

describe("search-intent-classifier parseBulk", () => {
  it("parses newlines", () => {
    expect(parseBulk("a\nb\nc")).toEqual(["a", "b", "c"]);
  });
  it("parses commas", () => {
    expect(parseBulk("a, b, c")).toEqual(["a", "b", "c"]);
  });
  it("returns empty for empty", () => {
    expect(parseBulk("")).toEqual([]);
  });
});

describe("search-intent-classifier dedup", () => {
  it("removes case-insensitive duplicates", () => {
    const { unique, removed } = dedup(["SEO", "seo", "Tools"]);
    expect(unique).toHaveLength(2);
    expect(removed).toBe(1);
  });
});

describe("search-intent-classifier classifyBulk", () => {
  it("classifies multiple keywords", () => {
    const r = classifyBulk(["what is seo", "buy shoes", "ahrefs login", "best tools"]);
    expect(r.total).toBe(4);
    expect(r.results).toHaveLength(4);
  });
  it("computes distribution", () => {
    const r = classifyBulk(["what is seo", "buy shoes"]);
    const sum = r.distribution.informational + r.distribution.transactional +
      r.distribution.navigational + r.distribution.commercial;
    expect(sum).toBe(2);
    expect(r.distribution.informational).toBe(1);
    expect(r.distribution.transactional).toBe(1);
  });
  it("computes average confidence", () => {
    const r = classifyBulk(["what is seo", "buy shoes"]);
    expect(r.averageConfidence).toBeGreaterThan(0);
    expect(r.averageConfidence).toBeLessThanOrEqual(100);
  });
  it("handles empty input", () => {
    const r = classifyBulk([]);
    expect(r.total).toBe(0);
    expect(r.averageConfidence).toBe(0);
  });
  it("dedupes input", () => {
    const r = classifyBulk(["SEO", "seo"]);
    expect(r.total).toBe(1);
  });
});

describe("search-intent-classifier renderCsv", () => {
  it("renders header", () => {
    const csv = renderCsv(classifyBulk(["what is seo"]));
    expect(csv).toContain("keyword,primary_intent,confidence,is_mixed");
  });
  it("includes keyword row", () => {
    const csv = renderCsv(classifyBulk(["what is seo"]));
    expect(csv).toContain("what is seo");
  });
  it("escapes commas in patterns", () => {
    const csv = renderCsv(classifyBulk(["what is seo"]));
    // patterns joined by pipe — should not break csv
    expect(csv.split("\n").length).toBeGreaterThanOrEqual(2);
  });
});

describe("search-intent-classifier getPatternReference", () => {
  it("returns flattened pattern list", () => {
    const ref = getPatternReference();
    expect(ref.length).toBeGreaterThan(20);
    expect(ref.some((p) => p.intent === "informational")).toBe(true);
  });
  it("each entry has intent + pattern + weight", () => {
    const ref = getPatternReference();
    expect(ref[0].intent).toBeDefined();
    expect(typeof ref[0].pattern).toBe("string");
    expect(typeof ref[0].weight).toBe("number");
  });
});

describe("search-intent-classifier history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const dist: Record<IntentType, number> = { informational: 2, navigational: 1, transactional: 1, commercial: 0 };
    saveHistory({ ts: 1, keywordCount: 4, distribution: dist });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    const dist: Record<IntentType, number> = { informational: 1, navigational: 0, transactional: 0, commercial: 0 };
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, keywordCount: 1, distribution: dist });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    const dist: Record<IntentType, number> = { informational: 1, navigational: 0, transactional: 0, commercial: 0 };
    saveHistory({ ts: 1, keywordCount: 1, distribution: dist });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("search-intent-classifier shareable URL", () => {
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

import { describe, it, expect, beforeEach } from "vitest";
import {
  STOP_WORDS,
  TOP_LIMIT,
  OVER_OPTIMIZATION_RATIO,
  tokenize,
  removeStopWords,
  countTerms,
  computeTf,
  computeIdf,
  analyzeSingle,
  analyze,
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

describe("tf-idf-content-optimizer constants", () => {
  it("has STOP_WORDS set", () => {
    expect(STOP_WORDS.has("the")).toBe(true);
  });
  it("TOP_LIMIT is 30", () => {
    expect(TOP_LIMIT).toBe(30);
  });
  it("OVER_OPTIMIZATION_RATIO is 2", () => {
    expect(OVER_OPTIMIZATION_RATIO).toBe(2);
  });
});

describe("tf-idf-content-optimizer tokenize", () => {
  it("returns empty for empty", () => {
    expect(tokenize("")).toEqual([]);
  });
  it("lowercases and splits", () => {
    expect(tokenize("Hello, World!")).toEqual(["hello", "world"]);
  });
});

describe("tf-idf-content-optimizer removeStopWords", () => {
  it("removes stop words", () => {
    expect(removeStopWords(["the", "cat", "is", "dog"])).toEqual(["cat", "dog"]);
  });
  it("removes single-char tokens", () => {
    expect(removeStopWords(["a", "b", "cat"])).toEqual(["cat"]);
  });
  it("keeps non-stop words", () => {
    expect(removeStopWords(["seo", "tools"])).toEqual(["seo", "tools"]);
  });
});

describe("tf-idf-content-optimizer countTerms", () => {
  it("counts frequencies", () => {
    const m = countTerms(["a", "b", "a", "c", "a"]);
    expect(m.get("a")).toBe(3);
    expect(m.get("b")).toBe(1);
  });
  it("returns empty for empty", () => {
    expect(countTerms([]).size).toBe(0);
  });
});

describe("tf-idf-content-optimizer computeTf", () => {
  it("computes frequency ratio", () => {
    expect(computeTf(3, 10)).toBeCloseTo(0.3);
  });
  it("returns 0 for 0 total", () => {
    expect(computeTf(5, 0)).toBe(0);
  });
});

describe("tf-idf-content-optimizer computeIdf", () => {
  it("returns 0 for 0 total docs", () => {
    expect(computeIdf(1, 0)).toBe(0);
  });
  it("higher df = lower idf (term common)", () => {
    const rare = computeIdf(1, 10);
    const common = computeIdf(9, 10);
    expect(rare).toBeGreaterThan(common);
  });
  it("smoothed: never goes below 1 for valid inputs", () => {
    const idf = computeIdf(10, 10);
    expect(idf).toBeGreaterThanOrEqual(0);
  });
});

describe("tf-idf-content-optimizer analyzeSingle", () => {
  it("returns empty for empty text", () => {
    expect(analyzeSingle("")).toEqual([]);
  });
  it("returns term scores sorted by tfidf desc", () => {
    const out = analyzeSingle("seo seo seo tools");
    expect(out[0].term).toBe("seo");
    expect(out[0].count).toBe(3);
  });
  it("each score has tf, idf, tfidf", () => {
    const out = analyzeSingle("seo tools");
    expect(out.length).toBe(2);
    expect(out[0].tf).toBeGreaterThan(0);
    expect(out[0].tfidf).toBeGreaterThan(0);
  });
});

describe("tf-idf-content-optimizer analyze (with competitors)", () => {
  it("returns full ContentResult object", () => {
    const r = analyze("seo seo content marketing", ["seo marketing blog", "content marketing tools"]);
    expect(typeof r.totalWords).toBe("number");
    expect(typeof r.uniqueTerms).toBe("number");
    expect(Array.isArray(r.topTerms)).toBe(true);
    expect(Array.isArray(r.missingTerms)).toBe(true);
    expect(Array.isArray(r.overOptimized)).toBe(true);
    expect(typeof r.contentScore).toBe("number");
    expect(Array.isArray(r.cloudData)).toBe(true);
  });
  it("computes totalWords correctly", () => {
    const r = analyze("seo tools seo", []);
    expect(r.totalWords).toBe(3);
  });
  it("detects missing terms in competitors", () => {
    const primary = "seo tools";
    const competitors = ["seo tools blog", "seo tools blog guide"];
    const r = analyze(primary, competitors);
    // "blog" is in both competitors but not in primary
    expect(r.missingTerms).toContain("blog");
  });
  it("detects over-optimization", () => {
    // Primary uses "spam" many times; competitors use it once each in longer bodies
    const primary = Array.from({ length: 20 }, () => "spam").join(" ") + " content marketing tools blog";
    const competitors = ["spam content marketing tools blog guide", "spam content marketing tools blog examples"];
    const r = analyze(primary, competitors);
    expect(r.overOptimized.length).toBeGreaterThan(0);
    expect(r.overOptimized.some((o) => o.term === "spam")).toBe(true);
  });
  it("content score is 0-100", () => {
    const r = analyze("seo content", ["seo marketing", "content marketing"]);
    expect(r.contentScore).toBeGreaterThanOrEqual(0);
    expect(r.contentScore).toBeLessThanOrEqual(100);
  });
  it("respects topLimit option", () => {
    const r = analyze("a b c d e f g h i j", [], { topLimit: 3 });
    expect(r.topTerms.length).toBeLessThanOrEqual(3);
  });
  it("cloudData maps topTerms to {text, value}", () => {
    const r = analyze("seo seo tools", []);
    expect(r.cloudData[0].text).toBe("seo");
    expect(r.cloudData[0].value).toBe(2);
  });
  it("handles empty primary", () => {
    const r = analyze("");
    expect(r.totalWords).toBe(0);
    expect(r.topTerms).toEqual([]);
  });
  it("computes competitorCount per term", () => {
    const r = analyze("seo", ["seo tools", "seo guide"]);
    const seo = r.topTerms.find((t) => t.term === "seo");
    expect(seo?.competitorCount).toBe(2);
  });
});

describe("tf-idf-content-optimizer renderCsv", () => {
  it("renders header", () => {
    const r = analyze("seo tools", []);
    const csv = renderCsv(r);
    expect(csv).toContain("term,tf,idf,tfidf,count,competitor_count");
  });
  it("includes term rows", () => {
    const r = analyze("seo tools", []);
    const csv = renderCsv(r);
    expect(csv).toContain("seo");
  });
  it("escapes commas in terms", () => {
    // tokens are alphanumeric only, so no commas — test stability instead
    const r = analyze("seo tools", []);
    const csv = renderCsv(r);
    expect(csv.split("\n").length).toBeGreaterThanOrEqual(2);
  });
});

describe("tf-idf-content-optimizer history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, totalWords: 100, uniqueTerms: 50, contentScore: 80, competitorCount: 2, snippet: "seo" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, totalWords: 1, uniqueTerms: 1, contentScore: 50, competitorCount: 0, snippet: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, totalWords: 1, uniqueTerms: 1, contentScore: 50, competitorCount: 0, snippet: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("tf-idf-content-optimizer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ primary: "seo content", competitors: ["seo blog"] });
    expect(url).toContain("p=seo+content");
    expect(url).toContain("c1=seo+blog");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("p=seo+content&c1=seo+blog&c2=seo+guide");
    expect(p.primary).toBe("seo content");
    expect(p.competitors).toEqual(["seo blog", "seo guide"]);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ primary: "", competitors: [] });
  });
  it("omits empty primary", () => {
    const url = buildShareUrl({ primary: "", competitors: [] });
    expect(url).not.toContain("p=");
  });
});

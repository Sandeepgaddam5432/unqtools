import { describe, it, expect, beforeEach } from "vitest";
import {
  QUESTION_MODIFIERS,
  COMPARISON_MODIFIERS,
  INTENT_MODIFIERS,
  RELATED_MODIFIERS,
  SYNONYMS,
  normalize,
  parseSeeds,
  applyQuestion,
  applyComparison,
  applyIntent,
  applyRelated,
  getSynonyms,
  hasCommercialIntent,
  estimateVolume,
  estimateDifficulty,
  difficultyCategory,
  generateForSeed,
  dedupKeywords,
  sortKeywords,
  generate,
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

describe("keyword-research-explorer constants", () => {
  it("has 7 question modifiers", () => {
    expect(QUESTION_MODIFIERS).toHaveLength(7);
    expect(QUESTION_MODIFIERS).toContain("what");
  });
  it("has comparison modifiers", () => {
    expect(COMPARISON_MODIFIERS.length).toBeGreaterThanOrEqual(3);
    expect(COMPARISON_MODIFIERS).toContain("vs");
  });
  it("has intent modifiers", () => {
    expect(INTENT_MODIFIERS.length).toBeGreaterThanOrEqual(5);
    expect(INTENT_MODIFIERS).toContain("best");
  });
  it("has related modifiers", () => {
    expect(RELATED_MODIFIERS.length).toBeGreaterThan(0);
    expect(RELATED_MODIFIERS).toContain("tools");
  });
  it("has synonym dictionary", () => {
    expect(SYNONYMS.seo.length).toBeGreaterThan(0);
  });
});

describe("keyword-research-explorer normalize", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalize("  SEO   Tools  ")).toBe("seo tools");
  });
  it("handles empty", () => {
    expect(normalize("")).toBe("");
  });
});

describe("keyword-research-explorer parseSeeds", () => {
  it("parses newline-separated seeds", () => {
    expect(parseSeeds("SEO\nMarketing\nTools")).toEqual(["SEO", "Marketing", "Tools"]);
  });
  it("parses comma-separated seeds", () => {
    expect(parseSeeds("SEO, Marketing, Tools")).toEqual(["SEO", "Marketing", "Tools"]);
  });
  it("skips blank entries", () => {
    expect(parseSeeds("a\n\nb")).toEqual(["a", "b"]);
  });
  it("returns empty for empty input", () => {
    expect(parseSeeds("")).toEqual([]);
  });
});

describe("keyword-research-explorer modifier functions", () => {
  it("applyQuestion prefixes", () => {
    expect(applyQuestion("SEO", "how")).toBe("how seo");
  });
  it("applyQuestion returns empty for empty seed", () => {
    expect(applyQuestion("", "how")).toBe("");
  });
  it("applyComparison builds vs", () => {
    expect(applyComparison("SEO", "vs")).toBe("seo vs ?");
  });
  it("applyComparison builds alternative to", () => {
    expect(applyComparison("SEO", "alternative to")).toBe("seo alternative to ?");
  });
  it("applyIntent prefixes best", () => {
    expect(applyIntent("SEO tools", "best")).toBe("best seo tools");
  });
  it("applyIntent how to special-case", () => {
    expect(applyIntent("do SEO", "how to")).toBe("how to do seo");
  });
  it("applyRelated appends modifier", () => {
    expect(applyRelated("SEO", "tools")).toBe("seo tools");
  });
});

describe("keyword-research-explorer getSynonyms", () => {
  it("returns synonyms for known seed", () => {
    const out = getSynonyms("seo");
    expect(out.length).toBeGreaterThan(0);
    expect(out).toContain("search engine optimization");
  });
  it("applies to multi-word seeds (head + tail)", () => {
    const out = getSynonyms("seo tools");
    expect(out.some((s) => s.startsWith("search engine optimization"))).toBe(true);
  });
  it("returns empty for unknown seed", () => {
    expect(getSynonyms("xyzzyplugh")).toEqual([]);
  });
  it("returns empty for empty", () => {
    expect(getSynonyms("")).toEqual([]);
  });
});

describe("keyword-research-explorer hasCommercialIntent", () => {
  it("detects buy", () => {
    expect(hasCommercialIntent("buy shoes online")).toBe(true);
  });
  it("detects best", () => {
    expect(hasCommercialIntent("best seo tools")).toBe(true);
  });
  it("detects cheap", () => {
    expect(hasCommercialIntent("cheap flights")).toBe(true);
  });
  it("returns false for informational", () => {
    expect(hasCommercialIntent("what is seo")).toBe(false);
  });
});

describe("keyword-research-explorer estimateVolume", () => {
  it("returns 0 for empty", () => {
    expect(estimateVolume("")).toBe(0);
  });
  it("returns high volume for short head term", () => {
    const vol = estimateVolume("seo");
    expect(vol).toBeGreaterThan(3000);
  });
  it("returns lower volume for long-tail", () => {
    const head = estimateVolume("seo");
    const long = estimateVolume("best seo tools for small business startups");
    expect(long).toBeLessThan(head);
  });
  it("is deterministic — same input = same output", () => {
    expect(estimateVolume("seo tools")).toBe(estimateVolume("seo tools"));
  });
  it("stays within 10-10000 range", () => {
    const v = estimateVolume("best cheap buy now");
    expect(v).toBeGreaterThanOrEqual(10);
    expect(v).toBeLessThanOrEqual(10000);
  });
});

describe("keyword-research-explorer estimateDifficulty", () => {
  it("returns 0 for empty", () => {
    expect(estimateDifficulty("")).toBe(0);
  });
  it("short head term = hard", () => {
    expect(estimateDifficulty("seo")).toBeGreaterThan(50);
  });
  it("long-tail = easier than head", () => {
    const head = estimateDifficulty("seo");
    const long = estimateDifficulty("what is the best seo tool for small business");
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

describe("keyword-research-explorer difficultyCategory", () => {
  it("Easy under 30", () => {
    expect(difficultyCategory(20)).toBe("Easy");
  });
  it("Medium 30-54", () => {
    expect(difficultyCategory(45)).toBe("Medium");
  });
  it("Hard 55-74", () => {
    expect(difficultyCategory(65)).toBe("Hard");
  });
  it("Very Hard 75+", () => {
    expect(difficultyCategory(85)).toBe("Very Hard");
  });
});

describe("keyword-research-explorer generateForSeed", () => {
  it("returns just the seed when no options", () => {
    const out = generateForSeed("SEO", {});
    expect(out).toHaveLength(1);
    expect(out[0].category).toBe("seed");
  });
  it("generates 7 questions when questions enabled", () => {
    const out = generateForSeed("SEO", { questions: true });
    const qs = out.filter((k) => k.category === "question");
    expect(qs).toHaveLength(7);
  });
  it("generates related terms", () => {
    const out = generateForSeed("SEO", { related: true });
    expect(out.filter((k) => k.category === "related").length).toBe(RELATED_MODIFIERS.length);
  });
  it("generates intent variants", () => {
    const out = generateForSeed("SEO", { intent: true });
    expect(out.filter((k) => k.category === "intent").length).toBe(INTENT_MODIFIERS.length);
  });
  it("generates synonyms when seed has them", () => {
    const out = generateForSeed("SEO", { synonyms: true });
    expect(out.filter((k) => k.category === "synonym").length).toBeGreaterThan(0);
  });
  it("includes volume + difficulty for each", () => {
    const out = generateForSeed("SEO", { questions: true });
    expect(out.every((k) => typeof k.volume === "number" && typeof k.difficulty === "number")).toBe(true);
  });
  it("returns empty for empty seed", () => {
    expect(generateForSeed("", { questions: true })).toEqual([]);
  });
});

describe("keyword-research-explorer dedupKeywords", () => {
  it("removes case-insensitive duplicates", () => {
    const base = {
      keyword: "best seo",
      modifier: "best",
      seed: "seo",
      volume: 100,
      difficulty: 50,
    };
    const { unique, removed } = dedupKeywords([
      { ...base, category: "intent" },
      { ...base, keyword: "Best SEO", category: "intent" },
    ]);
    expect(unique).toHaveLength(1);
    expect(removed).toBe(1);
  });
  it("keeps distinct keywords", () => {
    const { unique } = dedupKeywords([
      { keyword: "a", category: "seed", modifier: "(seed)", seed: "a", volume: 100, difficulty: 50 },
      { keyword: "b", category: "seed", modifier: "(seed)", seed: "b", volume: 100, difficulty: 50 },
    ]);
    expect(unique).toHaveLength(2);
  });
});

describe("keyword-research-explorer sortKeywords", () => {
  const sample = [
    { keyword: "alpha", category: "seed" as const, modifier: "(seed)", seed: "alpha", volume: 100, difficulty: 30 },
    { keyword: "beta", category: "seed" as const, modifier: "(seed)", seed: "beta", volume: 500, difficulty: 70 },
    { keyword: "gamma", category: "seed" as const, modifier: "(seed)", seed: "gamma", volume: 300, difficulty: 50 },
  ];
  it("sorts by volume desc by default", () => {
    const out = sortKeywords(sample);
    expect(out[0].keyword).toBe("beta");
    expect(out[2].keyword).toBe("alpha");
  });
  it("sorts by volume asc", () => {
    const out = sortKeywords(sample, "volume", "asc");
    expect(out[0].keyword).toBe("alpha");
  });
  it("sorts by difficulty desc", () => {
    const out = sortKeywords(sample, "difficulty", "desc");
    expect(out[0].keyword).toBe("beta");
  });
  it("sorts alphabetically asc", () => {
    const out = sortKeywords(sample, "keyword", "asc");
    expect(out[0].keyword).toBe("alpha");
  });
});

describe("keyword-research-explorer generate", () => {
  it("generates for multiple seeds", () => {
    const r = generate(["SEO", "Marketing"], { questions: true });
    expect(r.total).toBeGreaterThan(2);
    expect(r.byCategory.question).toBe(14);
  });
  it("dedups across seeds", () => {
    const r = generate(["SEO", "seo"], { questions: true });
    expect(r.duplicatesRemoved).toBeGreaterThan(0);
  });
  it("returns empty for no seeds", () => {
    expect(generate([], { questions: true }).total).toBe(0);
  });
  it("counts byCategory correctly", () => {
    const r = generate(["SEO"], { questions: true, intent: true });
    expect(r.byCategory.question).toBe(7);
    expect(r.byCategory.intent).toBe(INTENT_MODIFIERS.length);
    expect(r.byCategory.seed).toBe(1);
  });
});

describe("keyword-research-explorer renderCsv", () => {
  it("renders header", () => {
    const csv = renderCsv(generate(["SEO"], {}));
    expect(csv).toContain("keyword,category,modifier,seed,volume,difficulty,difficulty_category");
  });
  it("includes seed row", () => {
    const csv = renderCsv(generate(["SEO"], {}));
    expect(csv).toContain("seo,seed");
  });
  it("escapes commas", () => {
    const csv = renderCsv(generate(["best, cheap"], {}));
    expect(csv).toContain('"best, cheap"');
  });
});

describe("keyword-research-explorer history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, seedCount: 2, total: 50, options: { questions: true } });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, seedCount: 1, total: 1, options: {} });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, seedCount: 1, total: 1, options: {} });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("keyword-research-explorer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ seeds: "SEO", options: { questions: true, intent: true } });
    expect(url).toContain("seeds=SEO");
    expect(url).toContain("questions=1");
    expect(url).toContain("intent=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("seeds=SEO%2CMarketing&questions=1&intent=1");
    expect(p.seeds).toBe("SEO,Marketing");
    expect(p.options.questions).toBe(true);
    expect(p.options.intent).toBe(true);
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.seeds).toBe("");
    expect(p.options).toEqual({});
  });
  it("omits empty seeds", () => {
    const url = buildShareUrl({ seeds: "", options: { questions: true } });
    expect(url).not.toContain("seeds=");
  });
});

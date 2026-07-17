import { describe, it, expect, beforeEach } from "vitest";
import {
  QUESTION_MODIFIERS,
  COMPARISON_MODIFIERS,
  DEFAULT_LOCATION_MODIFIERS,
  INTENT_MODIFIERS,
  applyQuestionModifier,
  applyComparisonModifier,
  applyLocationModifier,
  applyIntentModifier,
  normalize,
  generateForSeed,
  parseSeeds,
  dedupKeywords,
  generate,
  renderCsv,
  renderList,
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

describe("long-tail-keyword-generator modifier constants", () => {
  it("has 7 question words", () => {
    expect(QUESTION_MODIFIERS).toHaveLength(7);
    expect(QUESTION_MODIFIERS).toContain("what");
    expect(QUESTION_MODIFIERS).toContain("how");
    expect(QUESTION_MODIFIERS).toContain("why");
  });
  it("has comparison modifiers", () => {
    expect(COMPARISON_MODIFIERS.length).toBeGreaterThanOrEqual(3);
    expect(COMPARISON_MODIFIERS).toContain("vs");
  });
  it("has location modifiers", () => {
    expect(DEFAULT_LOCATION_MODIFIERS.length).toBeGreaterThan(0);
    expect(DEFAULT_LOCATION_MODIFIERS).toContain("near me");
  });
  it("has intent modifiers", () => {
    expect(INTENT_MODIFIERS).toContain("best");
    expect(INTENT_MODIFIERS).toContain("how to");
  });
});

describe("long-tail-keyword-generator applyQuestionModifier", () => {
  it("prefixes seed with question word", () => {
    expect(applyQuestionModifier("SEO", "how")).toBe("how seo");
  });
  it("returns empty for empty seed", () => {
    expect(applyQuestionModifier("", "how")).toBe("");
  });
  it("lowercases", () => {
    expect(applyQuestionModifier("SEO TOOLS", "what")).toBe("what seo tools");
  });
});

describe("long-tail-keyword-generator applyComparisonModifier", () => {
  it("builds vs comparison", () => {
    expect(applyComparisonModifier("SEO", "vs")).toBe("seo vs ?");
  });
  it("builds alternative comparison", () => {
    expect(applyComparisonModifier("SEO", "alternative to")).toBe("seo alternative to ?");
  });
  it("returns empty for empty seed", () => {
    expect(applyComparisonModifier("", "vs")).toBe("");
  });
});

describe("long-tail-keyword-generator applyLocationModifier", () => {
  it("appends location", () => {
    expect(applyLocationModifier("SEO", "near me")).toBe("seo near me");
  });
  it("returns empty for empty seed", () => {
    expect(applyLocationModifier("", "near me")).toBe("");
  });
});

describe("long-tail-keyword-generator applyIntentModifier", () => {
  it("prefixes best", () => {
    expect(applyIntentModifier("SEO tools", "best")).toBe("best seo tools");
  });
  it("special handling for how to", () => {
    expect(applyIntentModifier("do SEO", "how to")).toBe("how to do seo");
  });
  it("returns empty for empty seed", () => {
    expect(applyIntentModifier("", "best")).toBe("");
  });
});

describe("long-tail-keyword-generator normalize", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalize("  SEO   Tools  ")).toBe("seo tools");
  });
  it("handles empty", () => {
    expect(normalize("")).toBe("");
  });
});

describe("long-tail-keyword-generator generateForSeed", () => {
  it("returns seed keyword when no modifiers enabled", () => {
    const out = generateForSeed("SEO", {});
    expect(out).toHaveLength(1);
    expect(out[0].keyword).toBe("seo");
    expect(out[0].category).toBe("seed");
  });
  it("generates 7 question variants", () => {
    const out = generateForSeed("SEO", { question: true });
    const qs = out.filter((k) => k.category === "question");
    expect(qs).toHaveLength(7);
  });
  it("generates all category variants when all enabled", () => {
    const out = generateForSeed("SEO", { question: true, comparison: true, location: true, intent: true });
    const cats = new Set(out.map((k) => k.category));
    expect(cats.has("question")).toBe(true);
    expect(cats.has("comparison")).toBe(true);
    expect(cats.has("location")).toBe(true);
    expect(cats.has("intent")).toBe(true);
  });
  it("uses custom location when provided", () => {
    const out = generateForSeed("SEO", { location: true, customLocation: "in Tokyo" });
    const locs = out.filter((k) => k.category === "location");
    expect(locs.some((k) => k.keyword === "seo in tokyo")).toBe(true);
  });
  it("returns empty for empty seed", () => {
    expect(generateForSeed("", { question: true })).toEqual([]);
  });
});

describe("long-tail-keyword-generator parseSeeds", () => {
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

describe("long-tail-keyword-generator dedupKeywords", () => {
  it("removes exact duplicates (case-insensitive)", () => {
    const { unique, removed } = dedupKeywords([
      { keyword: "best seo", modifier: "best", category: "intent", seed: "seo" },
      { keyword: "Best SEO", modifier: "best", category: "intent", seed: "seo" },
    ]);
    expect(unique).toHaveLength(1);
    expect(removed).toBe(1);
  });
  it("keeps distinct keywords", () => {
    const { unique } = dedupKeywords([
      { keyword: "a", modifier: "x", category: "intent", seed: "a" },
      { keyword: "b", modifier: "x", category: "intent", seed: "b" },
    ]);
    expect(unique).toHaveLength(2);
  });
});

describe("long-tail-keyword-generator generate", () => {
  it("generates variants for multiple seeds", () => {
    const r = generate(["SEO", "Marketing"], { question: true });
    expect(r.total).toBeGreaterThan(2);
    expect(r.byCategory.question).toBe(14);
  });
  it("dedups across seeds", () => {
    const r = generate(["SEO", "seo"], { question: true });
    expect(r.duplicatesRemoved).toBeGreaterThan(0);
  });
  it("returns empty for no seeds", () => {
    expect(generate([], { question: true }).total).toBe(0);
  });
  it("computes byCategory counts", () => {
    const r = generate(["SEO"], { question: true, intent: true });
    expect(r.byCategory.question).toBe(7);
    expect(r.byCategory.intent).toBe(INTENT_MODIFIERS.length);
    expect(r.byCategory.seed).toBe(1);
  });
});

describe("long-tail-keyword-generator renderCsv", () => {
  it("renders CSV header", () => {
    const csv = renderCsv(generate(["SEO"], {}));
    expect(csv).toContain("keyword,category,modifier,seed");
  });
  it("includes seed row", () => {
    const csv = renderCsv(generate(["SEO"], {}));
    expect(csv).toContain("seo,seed,(seed),seo");
  });
  it("escapes commas", () => {
    const csv = renderCsv(generate(["best, cheap"], {}));
    expect(csv).toContain('"best, cheap"');
  });
});

describe("long-tail-keyword-generator renderList", () => {
  it("renders plain list", () => {
    const list = renderList(generate(["SEO"], {}));
    expect(list).toContain("seo");
  });
  it("returns empty for no keywords", () => {
    expect(renderList(generate([], {}))).toBe("");
  });
});

describe("long-tail-keyword-generator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, seedCount: 2, total: 50, options: { question: true } });
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

describe("long-tail-keyword-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ seeds: "SEO", options: { question: true, intent: true } });
    expect(url).toContain("seeds=SEO");
    expect(url).toContain("question=1");
    expect(url).toContain("intent=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("seeds=SEO%2CMarketing&question=1&intent=1&customLocation=in+Tokyo");
    expect(p.seeds).toBe("SEO,Marketing");
    expect(p.options.question).toBe(true);
    expect(p.options.intent).toBe(true);
    expect(p.options.customLocation).toBe("in Tokyo");
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.seeds).toBe("");
    expect(p.options).toEqual({});
  });
  it("omits empty seeds", () => {
    const url = buildShareUrl({ seeds: "", options: { question: true } });
    expect(url).not.toContain("seeds=");
  });
});

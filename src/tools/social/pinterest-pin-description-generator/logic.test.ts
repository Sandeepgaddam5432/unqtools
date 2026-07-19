import { describe, it, expect, beforeEach } from "vitest";
import {
  PIN_CATEGORIES,
  DESCRIPTION_LENGTHS,
  CTA_TYPES,
  CATEGORY_LABELS,
  LENGTH_LABELS,
  CTA_LABELS,
  CATEGORY_OPENERS,
  CATEGORY_BODIES,
  CTA_TEMPLATES,
  CATEGORY_HASHTAGS,
  BOARD_NAME_TEMPLATES,
  LONG_TAIL_MODIFIERS,
  MAX_CHARS,
  MAX_TITLE_CHARS,
  LENGTH_RANGES,
  normalizeTopic,
  parseKeywords,
  pickAt,
  generatePinTitle,
  generateOpener,
  generateBody,
  generateCTA,
  generateHashtags,
  suggestLongTailKeywords,
  generateBoardName,
  computeKeywordDensities,
  checkMainKeywordInFirst100,
  scoreSeo,
  generatePin,
  generateVariations,
  computeSummaryStats,
  renderText,
  renderTextAll,
  renderCsv,
  renderCsvAll,
  splitCsvRow,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PinCategory,
  type DescriptionLength,
  type CTAType,
  type PinterestInput,
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

describe("pinterest constants", () => {
  it("has 10 pin categories", () => {
    expect(PIN_CATEGORIES).toHaveLength(10);
    expect(PIN_CATEGORIES).toContain("diy");
    expect(PIN_CATEGORIES).toContain("tech");
  });
  it("has 3 description lengths", () => {
    expect(DESCRIPTION_LENGTHS).toHaveLength(3);
    expect(DESCRIPTION_LENGTHS).toEqual(["short", "medium", "long"]);
  });
  it("has 4 CTA types", () => {
    expect(CTA_TYPES).toHaveLength(4);
    expect(CTA_TYPES).toContain("save");
  });
  it("has labels for every category", () => {
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(10);
    for (const c of PIN_CATEGORIES) expect(CATEGORY_LABELS[c]).toBeTruthy();
  });
  it("has labels for lengths and CTA types", () => {
    expect(Object.keys(LENGTH_LABELS)).toHaveLength(3);
    expect(Object.keys(CTA_LABELS)).toHaveLength(4);
  });
  it("has 3+ openers per category", () => {
    for (const c of PIN_CATEGORIES) {
      expect(CATEGORY_OPENERS[c].length).toBeGreaterThanOrEqual(3);
    }
  });
  it("has 2+ bodies per category", () => {
    for (const c of PIN_CATEGORIES) {
      expect(CATEGORY_BODIES[c].length).toBeGreaterThanOrEqual(2);
    }
  });
  it("has 3+ CTAs per type", () => {
    for (const t of CTA_TYPES) {
      expect(CTA_TEMPLATES[t].length).toBeGreaterThanOrEqual(3);
    }
  });
  it("has hashtag pools per category", () => {
    for (const c of PIN_CATEGORIES) {
      expect(CATEGORY_HASHTAGS[c].length).toBeGreaterThanOrEqual(3);
    }
  });
  it("has board name templates per category", () => {
    for (const c of PIN_CATEGORIES) {
      expect(BOARD_NAME_TEMPLATES[c].length).toBeGreaterThanOrEqual(3);
    }
  });
  it("has long-tail modifiers", () => {
    expect(LONG_TAIL_MODIFIERS.length).toBeGreaterThanOrEqual(10);
  });
  it("has correct char limits", () => {
    expect(MAX_CHARS).toBe(500);
    expect(MAX_TITLE_CHARS).toBe(100);
  });
  it("has correct length ranges", () => {
    expect(LENGTH_RANGES.short).toEqual({ min: 100, max: 200 });
    expect(LENGTH_RANGES.medium).toEqual({ min: 200, max: 400 });
    expect(LENGTH_RANGES.long).toEqual({ min: 400, max: 500 });
  });
});

describe("pinterest normalizeTopic", () => {
  it("collapses whitespace", () => {
    expect(normalizeTopic("  Easy   Pasta  ")).toBe("Easy Pasta");
  });
  it("handles empty", () => {
    expect(normalizeTopic("")).toBe("");
  });
  it("handles null input gracefully", () => {
    expect(normalizeTopic(null as unknown as string)).toBe("");
  });
});

describe("pinterest parseKeywords", () => {
  it("parses comma-separated", () => {
    expect(parseKeywords("pasta, recipe, italian")).toEqual(["pasta", "recipe", "italian"]);
  });
  it("trims and lowercases", () => {
    expect(parseKeywords(" Pasta ,  RECIPE ")).toEqual(["pasta", "recipe"]);
  });
  it("parses newline-separated", () => {
    expect(parseKeywords("pasta\nrecipe\nitalian")).toEqual(["pasta", "recipe", "italian"]);
  });
  it("returns empty for empty input", () => {
    expect(parseKeywords("")).toEqual([]);
  });
  it("skips blank entries", () => {
    expect(parseKeywords("pasta, , recipe")).toEqual(["pasta", "recipe"]);
  });
});

describe("pinterest pickAt", () => {
  it("returns element at modulo index", () => {
    expect(pickAt(["a", "b", "c"], 0)).toBe("a");
    expect(pickAt(["a", "b", "c"], 4)).toBe("b");
  });
  it("handles negative indices", () => {
    expect(pickAt(["a", "b", "c"], -1)).toBe("c");
  });
  it("throws on empty array", () => {
    expect(() => pickAt([], 0)).toThrow();
  });
});

describe("pinterest generatePinTitle", () => {
  it("includes topic", () => {
    const t = generatePinTitle("Easy Pasta Recipe", ["pasta", "italian"], 0);
    expect(t.toLowerCase()).toContain("easy pasta recipe");
  });
  it("uses keywords when no topic", () => {
    const t = generatePinTitle("", ["pasta"], 0);
    expect(t.toLowerCase()).toContain("pasta");
  });
  it("respects 100 char limit", () => {
    const t = generatePinTitle("A".repeat(200), ["keyword"], 0);
    expect(Array.from(t).length).toBeLessThanOrEqual(100);
  });
  it("returns fallback when no input", () => {
    expect(generatePinTitle("", [], 0)).toBe("Untitled Pin");
  });
});

describe("pinterest generateOpener", () => {
  it("returns opener for category", () => {
    const o = generateOpener("food", 0);
    expect(CATEGORY_OPENERS["food"]).toContain(o);
  });
  it("cycles for variations", () => {
    const o0 = generateOpener("diy", 0);
    const o1 = generateOpener("diy", 1);
    expect(o0).not.toBe(o1);
  });
});

describe("pinterest generateBody", () => {
  it("uses topic when present", () => {
    const b = generateBody("Pasta Recipe", "food", ["pasta", "italian"], "medium", 0);
    expect(b.toLowerCase()).toContain("pasta recipe");
  });
  it("uses keywords when no topic", () => {
    const b = generateBody("", "food", ["pasta"], "short", 0);
    expect(b.toLowerCase()).toContain("pasta");
  });
  it("longer descriptions include more keywords", () => {
    const short = generateBody("Topic", "food", ["pasta", "italian", "dinner", "easy"], "short", 0);
    const long = generateBody("Topic", "food", ["pasta", "italian", "dinner", "easy"], "long", 0);
    expect(long.length).toBeGreaterThan(short.length);
  });
});

describe("pinterest generateCTA", () => {
  it("returns a CTA for the type", () => {
    const c = generateCTA("save", 0);
    expect(CTA_TEMPLATES["save"]).toContain(c);
  });
  it("cycles for variations", () => {
    const a = generateCTA("click", 0);
    const b = generateCTA("click", 1);
    expect(a).not.toBe(b);
  });
});

describe("pinterest generateHashtags", () => {
  it("returns up to 5 hashtags", () => {
    const tags = generateHashtags("food", ["pasta", "italian"], 0);
    expect(tags.length).toBeGreaterThanOrEqual(2);
    expect(tags.length).toBeLessThanOrEqual(5);
  });
  it("includes category hashtags", () => {
    const tags = generateHashtags("beauty", [], 0);
    const match = tags.some((t) => CATEGORY_HASHTAGS["beauty"].includes(t));
    expect(match).toBe(true);
  });
  it("dedupes hashtags", () => {
    const tags = generateHashtags("food", ["recipe", "food"], 0);
    expect(new Set(tags).size).toBe(tags.length);
  });
});

describe("pinterest suggestLongTailKeywords", () => {
  it("returns empty for empty input", () => {
    expect(suggestLongTailKeywords([])).toEqual([]);
  });
  it("returns long-tail variations", () => {
    const lt = suggestLongTailKeywords(["pasta"]);
    expect(lt.length).toBeGreaterThan(0);
    expect(lt.every((k) => k.startsWith("pasta "))).toBe(true);
  });
  it("limits to 3 keywords × 3 modifiers", () => {
    const lt = suggestLongTailKeywords(["a", "b", "c", "d"]);
    // 3 keywords × 3 modifiers = 9, capped at 8
    expect(lt.length).toBeLessThanOrEqual(8);
  });
});

describe("pinterest generateBoardName", () => {
  it("returns a board name for the category", () => {
    const b = generateBoardName("diy", [], 0);
    expect(BOARD_NAME_TEMPLATES["diy"]).toContain(b);
  });
  it("includes main keyword when room", () => {
    const b = generateBoardName("diy", ["crafts"], 0);
    expect(b.toLowerCase()).toContain("crafts");
  });
});

describe("pinterest computeKeywordDensities", () => {
  it("returns empty for empty keywords", () => {
    expect(computeKeywordDensities("hello world", [])).toEqual([]);
  });
  it("counts single-word keyword occurrences", () => {
    const desc = "pasta recipe pasta dinner pasta";
    const d = computeKeywordDensities(desc, ["pasta"]);
    expect(d[0].count).toBe(3);
    expect(d[0].density).toBeGreaterThan(0);
  });
  it("counts multi-word phrase occurrences", () => {
    const desc = "easy pasta recipe and another pasta recipe here";
    const d = computeKeywordDensities(desc, ["pasta recipe"]);
    expect(d[0].count).toBe(2);
  });
  it("flags optimal density (1-3%)", () => {
    // 100 words total, "pasta" appears 2 times = density 2%
    const words = Array(98).fill("word").concat(["pasta", "pasta"]);
    const d = computeKeywordDensities(words.join(" "), ["pasta"]);
    expect(d[0].density).toBeGreaterThanOrEqual(1);
    expect(d[0].density).toBeLessThanOrEqual(3);
    expect(d[0].optimal).toBe(true);
  });
  it("flags non-optimal density", () => {
    // 100 words, "pasta" appears 10 times = density 10% — way too high
    const words = Array(90).fill("word").concat(Array(10).fill("pasta"));
    const d = computeKeywordDensities(words.join(" "), ["pasta"]);
    expect(d[0].optimal).toBe(false);
  });
});

describe("pinterest checkMainKeywordInFirst100", () => {
  it("returns true when keyword in first 100 chars", () => {
    expect(checkMainKeywordInFirst100("pasta recipe is amazing", "pasta")).toBe(true);
  });
  it("returns false when keyword not in first 100 chars", () => {
    const filler = "x".repeat(100);
    expect(checkMainKeywordInFirst100(`${filler} pasta`, "pasta")).toBe(false);
  });
  it("returns true when no main keyword", () => {
    expect(checkMainKeywordInFirst100("hello world", "")).toBe(true);
  });
});

describe("pinterest scoreSeo", () => {
  it("scores within 0-100", () => {
    const input: PinterestInput = {
      pinTopic: "Easy Pasta",
      pinCategory: "food",
      targetKeywords: "pasta, italian",
      includeCTA: true,
      includeHashtags: true,
      descriptionLength: "long",
      ctaType: "save",
    };
    const p = generatePin(input, 1);
    expect(p.seoScore).toBeGreaterThanOrEqual(0);
    expect(p.seoScore).toBeLessThanOrEqual(100);
  });
});

describe("pinterest generatePin", () => {
  const input: PinterestInput = {
    pinTopic: "Easy Pasta Recipe",
    pinCategory: "food",
    targetKeywords: "pasta, italian, dinner",
    includeCTA: true,
    includeHashtags: true,
    descriptionLength: "medium",
    ctaType: "save",
  };
  it("assembles a full pin", () => {
    const p = generatePin(input, 1);
    expect(p.variation).toBe(1);
    expect(p.pinTitle).toBeTruthy();
    expect(p.opener).toBeTruthy();
    expect(p.body).toBeTruthy();
    expect(p.cta).toBeTruthy();
    expect(p.hashtags.length).toBeGreaterThan(0);
    expect(p.boardName).toBeTruthy();
    expect(p.fullDescription).toContain(p.opener);
    expect(p.fullDescription).toContain(p.body);
    expect(p.charCount).toBeGreaterThan(0);
    expect(p.wordCount).toBeGreaterThan(0);
    expect(p.keywordCount).toBe(3);
  });
  it("respects 500 char limit", () => {
    const longInput: PinterestInput = {
      ...input,
      descriptionLength: "long",
      targetKeywords: "pasta, italian, dinner, easy, quick, family, weeknight, homemade, traditional, simple",
    };
    const p = generatePin(longInput, 1);
    expect(p.charCount).toBeLessThanOrEqual(500);
    expect(p.withinLimit).toBe(true);
  });
  it("respects includeCTA=false", () => {
    const p = generatePin({ ...input, includeCTA: false }, 1);
    expect(p.cta).toBe("");
  });
  it("respects includeHashtags=false", () => {
    const p = generatePin({ ...input, includeHashtags: false }, 1);
    expect(p.hashtags).toEqual([]);
    expect(p.hashtagCount).toBe(0);
  });
  it("computes keyword densities for target keywords", () => {
    const p = generatePin(input, 1);
    expect(p.keywordDensities).toHaveLength(3);
    expect(p.keywordDensities[0].keyword).toBe("pasta");
  });
  it("main keyword appears in first 100 chars", () => {
    const p = generatePin(input, 1);
    expect(p.mainKeywordInFirst100).toBe(true);
  });
  it("generates pin title within 100 chars", () => {
    const p = generatePin(input, 1);
    expect(Array.from(p.pinTitle).length).toBeLessThanOrEqual(100);
  });
  it("generates long-tail keyword suggestions", () => {
    const p = generatePin(input, 1);
    expect(p.longTailKeywords.length).toBeGreaterThan(0);
    expect(p.longTailKeywords[0]).toContain("pasta");
  });
});

describe("pinterest generateVariations", () => {
  const input: PinterestInput = {
    pinTopic: "Cozy Living Room Decor",
    pinCategory: "home-decor",
    targetKeywords: "home decor, living room, cozy",
    includeCTA: true,
    includeHashtags: false,
    descriptionLength: "medium",
    ctaType: "save",
  };
  it("generates 3 variations", () => {
    const v = generateVariations(input);
    expect(v).toHaveLength(3);
    expect(v[0].variation).toBe(1);
    expect(v[1].variation).toBe(2);
    expect(v[2].variation).toBe(3);
  });
  it("returns empty when no topic and no keywords", () => {
    expect(generateVariations({ ...input, pinTopic: "", targetKeywords: "" })).toEqual([]);
  });
  it("generates from keywords alone when no topic", () => {
    const v = generateVariations({ ...input, pinTopic: "" });
    expect(v).toHaveLength(3);
    expect(v[0].body.toLowerCase()).toContain("home decor");
  });
  it("variations differ", () => {
    const v = generateVariations(input);
    expect(v[0].opener).not.toBe(v[1].opener);
  });
});

describe("pinterest computeSummaryStats", () => {
  it("returns zero-stats for empty", () => {
    const s = computeSummaryStats([]);
    expect(s.totalVariations).toBe(0);
    expect(s.avgChars).toBe(0);
  });
  it("computes averages across variations", () => {
    const input: PinterestInput = {
      pinTopic: "Test Pin",
      pinCategory: "diy",
      targetKeywords: "diy, crafts",
      includeCTA: true,
      includeHashtags: true,
      descriptionLength: "medium",
      ctaType: "save",
    };
    const v = generateVariations(input);
    const s = computeSummaryStats(v);
    expect(s.totalVariations).toBe(3);
    expect(s.avgChars).toBeGreaterThan(0);
    expect(s.avgKeywords).toBeGreaterThan(0);
    expect(s.avgSeoScore).toBeGreaterThan(0);
  });
});

describe("pinterest renderText", () => {
  it("renders full pin with components", () => {
    const input: PinterestInput = {
      pinTopic: "Pasta",
      pinCategory: "food",
      targetKeywords: "pasta",
      includeCTA: true,
      includeHashtags: true,
      descriptionLength: "medium",
      ctaType: "save",
    };
    const p = generatePin(input, 1);
    const t = renderText(p);
    expect(t).toContain("Variation 1");
    expect(t).toContain("Pin Title:");
    expect(t).toContain("Board Name:");
    expect(t).toContain("Opener:");
    expect(t).toContain("Full Description:");
    expect(t).toContain("SEO Score:");
  });
  it("renderTextAll joins multiple variations", () => {
    const input: PinterestInput = {
      pinTopic: "Test",
      pinCategory: "diy",
      targetKeywords: "diy",
      includeCTA: true,
      includeHashtags: true,
      descriptionLength: "medium",
      ctaType: "save",
    };
    const v = generateVariations(input);
    const t = renderTextAll(v);
    expect(t).toContain("Variation 1");
    expect(t).toContain("Variation 2");
    expect(t).toContain("Variation 3");
    expect(t).toContain("---");
  });
});

describe("pinterest renderCsv", () => {
  it("renders header + rows", () => {
    const input: PinterestInput = {
      pinTopic: "Pasta",
      pinCategory: "food",
      targetKeywords: "pasta",
      includeCTA: true,
      includeHashtags: true,
      descriptionLength: "medium",
      ctaType: "save",
    };
    const p = generatePin(input, 1);
    const csv = renderCsv(p);
    expect(csv).toContain("component,value");
    expect(csv).toContain("variation,1");
    expect(csv).toContain("pin_title,");
    expect(csv).toContain("board_name,");
    expect(csv).toContain("seo_score,");
  });
  it("renderCsvAll stacks rows", () => {
    const input: PinterestInput = {
      pinTopic: "Test",
      pinCategory: "diy",
      targetKeywords: "diy",
      includeCTA: true,
      includeHashtags: true,
      descriptionLength: "medium",
      ctaType: "save",
    };
    const v = generateVariations(input);
    const csv = renderCsvAll(v);
    expect(csv.match(/variation,/g)?.length).toBe(3);
  });
  it("renders empty header for no variations", () => {
    const csv = renderCsvAll([]);
    expect(csv).toContain("component,value");
  });
});

describe("pinterest splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
});

describe("pinterest history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      pinTopic: "Pasta",
      pinCategory: "food",
      descriptionLength: "medium",
      keywordCount: 2,
      variationCount: 3,
      seoScore: 75,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        pinTopic: "T",
        pinCategory: "diy",
        descriptionLength: "short",
        keywordCount: 1,
        variationCount: 3,
        seoScore: 60,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      pinTopic: "T",
      pinCategory: "diy",
      descriptionLength: "short",
      keywordCount: 1,
      variationCount: 3,
      seoScore: 60,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("pinterest shareable URL", () => {
  const input: PinterestInput = {
    pinTopic: "Easy Pasta",
    pinCategory: "food",
    targetKeywords: "pasta, italian",
    includeCTA: true,
    includeHashtags: false,
    descriptionLength: "long",
    ctaType: "save",
  };
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(input);
    expect(url).toContain("topic=");
    expect(url).toContain("category=food");
    expect(url).toContain("keywords=");
    expect(url).toContain("length=long");
    expect(url).toContain("cta=true");
    expect(url).toContain("hashtags=false");
    expect(url).toContain("ctaType=save");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(input);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.pinTopic).toBe("Easy Pasta");
    expect(parsed.pinCategory).toBe("food");
    expect(parsed.targetKeywords).toBe("pasta, italian");
    expect(parsed.descriptionLength).toBe("long");
    expect(parsed.includeCTA).toBe(true);
    expect(parsed.includeHashtags).toBe(false);
    expect(parsed.ctaType).toBe("save");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("handles empty hash with defaults", () => {
    const parsed = parseShareUrl("");
    expect(parsed.pinTopic).toBe("");
    expect(parsed.pinCategory).toBe("diy");
    expect(parsed.descriptionLength).toBe("medium");
    expect(parsed.ctaType).toBe("save");
  });
  it("filters unknown category/length/ctaType", () => {
    const parsed = parseShareUrl("topic=t&category=unknown&length=invalid&ctaType=nope");
    expect(parsed.pinCategory).toBe("diy");
    expect(parsed.descriptionLength).toBe("medium");
    expect(parsed.ctaType).toBe("save");
  });
});

// Suppress unused-import lint
export type _Unused = PinCategory | DescriptionLength | CTAType | PinterestInput;

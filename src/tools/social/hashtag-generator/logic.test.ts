import { describe, it, expect, beforeEach } from "vitest";
import {
  PLATFORMS,
  HASHTAG_TYPES,
  PLATFORM_CONFIGS,
  PLATFORM_LABELS,
  HASHTAG_TYPE_LABELS,
  CATEGORY_LABELS,
  SPAM_HASHTAGS,
  TRENDING_NICHES,
  normalizeTopic,
  parseTopic,
  makeTag,
  capitalize,
  generateDirect,
  generateCompound,
  generateVariations,
  generateCommunity,
  generateTrending,
  generateBranded,
  generateNiche,
  generateAllHashtags,
  categorizeHashtag,
  filterSpamHashtags,
  filterInvalid,
  validateHashtag,
  generateMix,
  generate,
  analyzeDensity,
  computeStats,
  getTrendingForNiche,
  listTrendingNiches,
  renderText,
  renderCsv,
  splitCsvRow,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Platform,
  type GeneratorInput,
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

const baseInput: GeneratorInput = {
  topic: "javascript programming",
  platform: "instagram",
  count: 20,
  includeBranded: true,
  includeNiche: true,
  excludeGeneric: false,
  mixPopularNiche: true,
};

describe("hashtag-generator constants", () => {
  it("has 5 platforms", () => {
    expect(PLATFORMS).toHaveLength(5);
    expect(PLATFORMS).toContain("instagram");
    expect(PLATFORMS).toContain("youtube");
  });
  it("has 5 hashtag types", () => {
    expect(HASHTAG_TYPES).toHaveLength(5);
    expect(HASHTAG_TYPES).toContain("direct");
    expect(HASHTAG_TYPES).toContain("trending");
  });
  it("has platform configs for all platforms", () => {
    for (const p of PLATFORMS) {
      expect(PLATFORM_CONFIGS[p]).toBeDefined();
      expect(PLATFORM_CONFIGS[p].maxCount).toBeGreaterThan(0);
      expect(PLATFORM_CONFIGS[p].optimalCount).toBeGreaterThan(0);
      expect(PLATFORM_CONFIGS[p].maxChars).toBeGreaterThan(0);
    }
  });
  it("Instagram has 30 max hashtags", () => {
    expect(PLATFORM_CONFIGS.instagram.maxCount).toBe(30);
  });
  it("Instagram optimal is 10-20", () => {
    expect(PLATFORM_CONFIGS.instagram.optimalCount).toBeGreaterThanOrEqual(10);
    expect(PLATFORM_CONFIGS.instagram.optimalCount).toBeLessThanOrEqual(20);
  });
  it("Twitter optimal is 2-3", () => {
    expect(PLATFORM_CONFIGS.twitter.optimalCount).toBeGreaterThanOrEqual(2);
    expect(PLATFORM_CONFIGS.twitter.optimalCount).toBeLessThanOrEqual(3);
  });
  it("LinkedIn optimal is 3-5", () => {
    expect(PLATFORM_CONFIGS.linkedin.optimalCount).toBeGreaterThanOrEqual(3);
    expect(PLATFORM_CONFIGS.linkedin.optimalCount).toBeLessThanOrEqual(5);
  });
  it("TikTok optimal is 3-5", () => {
    expect(PLATFORM_CONFIGS.tiktok.optimalCount).toBeGreaterThanOrEqual(3);
    expect(PLATFORM_CONFIGS.tiktok.optimalCount).toBeLessThanOrEqual(5);
  });
  it("YouTube optimal is 3-5", () => {
    expect(PLATFORM_CONFIGS.youtube.optimalCount).toBeGreaterThanOrEqual(3);
    expect(PLATFORM_CONFIGS.youtube.optimalCount).toBeLessThanOrEqual(5);
  });
  it("has labels for all platforms, types, categories", () => {
    expect(Object.keys(PLATFORM_LABELS)).toHaveLength(5);
    expect(Object.keys(HASHTAG_TYPE_LABELS)).toHaveLength(5);
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(3);
  });
  it("has spam hashtag list", () => {
    expect(SPAM_HASHTAGS.length).toBeGreaterThanOrEqual(10);
    expect(SPAM_HASHTAGS).toContain("#like4like");
    expect(SPAM_HASHTAGS).toContain("#follow4follow");
  });
  it("has 10+ trending niches", () => {
    expect(Object.keys(TRENDING_NICHES).length).toBeGreaterThanOrEqual(10);
    expect(TRENDING_NICHES.javascript).toBeDefined();
    expect(TRENDING_NICHES.javascript.length).toBeGreaterThanOrEqual(5);
  });
});

describe("hashtag-generator normalizeTopic / parseTopic / makeTag / capitalize", () => {
  it("normalizes topic case and whitespace", () => {
    expect(normalizeTopic("  JavaScript   Programming  ")).toBe("javascript programming");
  });
  it("handles empty topic", () => {
    expect(normalizeTopic("")).toBe("");
  });
  it("parses topic into words (alphanumeric only)", () => {
    expect(parseTopic("JavaScript programming!")).toEqual(["javascript", "programming"]);
  });
  it("returns empty for empty topic", () => {
    expect(parseTopic("")).toEqual([]);
  });
  it("makes hashtag from base", () => {
    expect(makeTag("JavaScript")).toBe("#javascript");
  });
  it("strips non-alphanumeric in makeTag", () => {
    expect(makeTag("c++ programming!")).toBe("#cprogramming");
  });
  it("returns empty for empty base", () => {
    expect(makeTag("")).toBe("");
  });
  it("capitalizes first letter", () => {
    expect(capitalize("learn")).toBe("Learn");
  });
});

describe("hashtag-generator generateDirect", () => {
  it("generates direct tags for multi-word topic", () => {
    const tags = generateDirect("javascript programming");
    expect(tags).toContain("#javascript");
    expect(tags).toContain("#programming");
    expect(tags).toContain("#javascriptprogramming");
  });
  it("returns empty for empty topic", () => {
    expect(generateDirect("")).toEqual([]);
  });
  it("dedupes", () => {
    const tags = generateDirect("js js");
    expect(tags).toHaveLength(2); // #jsjs + #js
  });
});

describe("hashtag-generator generateCompound", () => {
  it("generates joined compound tag", () => {
    const tags = generateCompound("javascript programming");
    expect(tags).toContain("#javascriptprogramming");
  });
  it("generates pairwise compound tags", () => {
    const tags = generateCompound("javascript programming tips");
    expect(tags).toContain("#javascriptprogramming");
    expect(tags).toContain("#programmingtips");
  });
  it("returns empty for empty topic", () => {
    expect(generateCompound("")).toEqual([]);
  });
});

describe("hashtag-generator generateVariations", () => {
  it("generates variations with suffixes", () => {
    const tags = generateVariations("javascript");
    expect(tags.some((t) => t.endsWith("dev"))).toBe(true);
    expect(tags.some((t) => t.endsWith("tips"))).toBe(true);
    expect(tags.some((t) => t.endsWith("developer"))).toBe(true);
  });
  it("returns empty for empty topic", () => {
    expect(generateVariations("")).toEqual([]);
  });
  it("all variations start with #", () => {
    const tags = generateVariations("javascript");
    expect(tags.every((t) => t.startsWith("#"))).toBe(true);
  });
});

describe("hashtag-generator generateCommunity", () => {
  it("generates community tags with suffixes", () => {
    const tags = generateCommunity("javascript");
    expect(tags).toContain("#javascriptcommunity");
    expect(tags).toContain("#javascriptlovers");
    expect(tags).toContain("#javascriptworld");
  });
  it("returns empty for empty topic", () => {
    expect(generateCommunity("")).toEqual([]);
  });
});

describe("hashtag-generator generateTrending", () => {
  it("generates trending-style tags", () => {
    const tags = generateTrending("javascript");
    expect(tags.some((t) => t.includes("2026") || t.includes("2025"))).toBe(true);
    expect(tags.some((t) => t.includes("tips") || t.includes("hacks"))).toBe(true);
  });
  it("returns empty for empty topic", () => {
    expect(generateTrending("")).toEqual([]);
  });
});

describe("hashtag-generator generateBranded", () => {
  it("generates CamelCase branded tags", () => {
    const tags = generateBranded("javascript js");
    expect(tags.some((t) => /^#[A-Z]/.test(t))).toBe(true);
  });
  it("includes Learn prefix style", () => {
    const tags = generateBranded("javascript");
    expect(tags.some((t) => t.startsWith("#Learn"))).toBe(true);
  });
  it("includes Mastery suffix style", () => {
    const tags = generateBranded("javascript");
    expect(tags.some((t) => t.includes("Mastery"))).toBe(true);
  });
  it("returns empty for empty topic", () => {
    expect(generateBranded("")).toEqual([]);
  });
});

describe("hashtag-generator generateNiche", () => {
  it("generates niche tags with modifiers", () => {
    const tags = generateNiche("javascript");
    expect(tags.some((t) => t.includes("forbeginners") || t.includes("advanced"))).toBe(true);
    expect(tags.some((t) => t.includes("mastery") || t.includes("deepdive"))).toBe(true);
  });
  it("returns empty for empty topic", () => {
    expect(generateNiche("")).toEqual([]);
  });
});

describe("hashtag-generator generateAllHashtags", () => {
  it("combines all 5 types with categories", () => {
    const entries = generateAllHashtags("javascript programming");
    expect(entries.length).toBeGreaterThan(10);
    const types = new Set(entries.map((e) => e.type));
    expect(types.size).toBeGreaterThanOrEqual(4);
  });
  it("each entry has tag, type, category, estReach", () => {
    const entries = generateAllHashtags("javascript");
    for (const e of entries) {
      expect(e.tag.startsWith("#")).toBe(true);
      expect(["direct", "compound", "variations", "community", "trending"]).toContain(e.type);
      expect(["popular", "medium", "niche"]).toContain(e.category);
      expect(e.estReach).toBeGreaterThan(0);
    }
  });
  it("returns empty for empty topic", () => {
    expect(generateAllHashtags("")).toEqual([]);
  });
  it("dedupes by tag", () => {
    const entries = generateAllHashtags("javascript");
    const tags = entries.map((e) => e.tag);
    expect(new Set(tags).size).toBe(tags.length);
  });
});

describe("hashtag-generator categorizeHashtag", () => {
  it("categorizes short tags as popular (1M+)", () => {
    const { category, estReach } = categorizeHashtag("#javascript");
    expect(category).toBe("popular");
    expect(estReach).toBeGreaterThanOrEqual(1_000_000);
  });
  it("categorizes medium-length tags as medium (100K-1M)", () => {
    const { category, estReach } = categorizeHashtag("#javascriptcommunity");
    expect(category).toBe("medium");
    expect(estReach).toBeGreaterThanOrEqual(100_000);
    expect(estReach).toBeLessThan(1_000_000);
  });
  it("categorizes long tags as niche (10K-100K)", () => {
    const { category, estReach } = categorizeHashtag("#javascriptprogrammingcommunity");
    expect(category).toBe("niche");
    expect(estReach).toBeGreaterThanOrEqual(10_000);
    expect(estReach).toBeLessThan(100_000);
  });
  it("is deterministic — same tag returns same reach", () => {
    const a = categorizeHashtag("#javascript");
    const b = categorizeHashtag("#javascript");
    expect(a.estReach).toBe(b.estReach);
  });
});

describe("hashtag-generator filterSpamHashtags", () => {
  it("removes spam hashtags", () => {
    const entries = [
      { tag: "#javascript", type: "direct" as const, category: "popular" as const, estReach: 1_000_000 },
      { tag: "#like4like", type: "direct" as const, category: "popular" as const, estReach: 1_000_000 },
      { tag: "#follow4follow", type: "direct" as const, category: "popular" as const, estReach: 1_000_000 },
    ];
    const filtered = filterSpamHashtags(entries);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].tag).toBe("#javascript");
  });
  it("preserves non-spam entries", () => {
    const entries = [
      { tag: "#javascript", type: "direct" as const, category: "popular" as const, estReach: 1_000_000 },
      { tag: "#programming", type: "direct" as const, category: "popular" as const, estReach: 1_000_000 },
    ];
    expect(filterSpamHashtags(entries)).toHaveLength(2);
  });
});

describe("hashtag-generator filterInvalid", () => {
  it("removes hashtags exceeding platform char limit", () => {
    const longTag = "#javascriptprogrammingcommunityworldwide";
    const entries = [
      { tag: "#javascript", type: "direct" as const, category: "popular" as const, estReach: 1_000_000 },
      { tag: longTag, type: "compound" as const, category: "niche" as const, estReach: 10_000 },
    ];
    const filtered = filterInvalid(entries, "instagram"); // max 30 chars
    expect(filtered).toHaveLength(1);
    expect(filtered[0].tag).toBe("#javascript");
  });
});

describe("hashtag-generator validateHashtag", () => {
  it("accepts valid hashtag", () => {
    const r = validateHashtag("#javascript", "instagram");
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });
  it("rejects empty hashtag", () => {
    const r = validateHashtag("#", "instagram");
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it("rejects special characters", () => {
    const r = validateHashtag("#java-script!", "instagram");
    expect(r.valid).toBe(false);
  });
  it("rejects hashtags over 30 chars global limit", () => {
    const longTag = "#" + "a".repeat(35);
    const r = validateHashtag(longTag, "instagram");
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("30-char"))).toBe(true);
  });
});

describe("hashtag-generator generateMix", () => {
  it("produces a mix of categories in 30/40/30 ratio", () => {
    const entries = generateAllHashtags("javascript programming");
    const mixed = generateMix(entries, 10);
    expect(mixed).toHaveLength(10);
    const popular = mixed.filter((e) => e.category === "popular").length;
    const medium = mixed.filter((e) => e.category === "medium").length;
    const niche = mixed.filter((e) => e.category === "niche").length;
    expect(popular + medium + niche).toBe(10);
    // 30% of 10 = 3 popular, 40% = 4 medium, 30% = 3 niche (approx)
    expect(popular).toBeLessThanOrEqual(4);
    expect(medium).toBeLessThanOrEqual(5);
  });
  it("returns empty for count 0", () => {
    expect(generateMix(generateAllHashtags("js"), 0)).toEqual([]);
  });
});

describe("hashtag-generator generate (full pipeline)", () => {
  it("generates requested count for Instagram", () => {
    const entries = generate({ ...baseInput, count: 15 });
    expect(entries.length).toBeLessThanOrEqual(15);
    expect(entries.length).toBeGreaterThan(0);
  });
  it("caps at platform max (Instagram 30)", () => {
    const entries = generate({ ...baseInput, count: 50 });
    expect(entries.length).toBeLessThanOrEqual(30);
  });
  it("respects includeBranded=false", () => {
    const withBranded = generate({ ...baseInput, includeBranded: true, count: 30, mixPopularNiche: false });
    const withoutBranded = generate({ ...baseInput, includeBranded: false, count: 30, mixPopularNiche: false });
    expect(withBranded.length).toBeGreaterThanOrEqual(withoutBranded.length);
  });
  it("respects excludeGeneric=true", () => {
    const entries = generate({ ...baseInput, excludeGeneric: true });
    // No spam tags in output
    const spam = new Set(SPAM_HASHTAGS);
    expect(entries.every((e) => !spam.has(e.tag.toLowerCase()))).toBe(true);
  });
  it("respects mixPopularNiche=false (just takes top N)", () => {
    const entries = generate({ ...baseInput, mixPopularNiche: false, count: 10 });
    expect(entries.length).toBeLessThanOrEqual(10);
  });
  it("returns empty for empty topic", () => {
    expect(generate({ ...baseInput, topic: "" })).toEqual([]);
  });
});

describe("hashtag-generator analyzeDensity", () => {
  it("reports ok status when under optimal", () => {
    const r = analyzeDensity({ ...baseInput, count: 5 }, 5);
    expect(r.platform).toBe("instagram");
    expect(r.optimal).toBe(15);
    expect(r.max).toBe(30);
    expect(r.status).toBe("ok");
  });
  it("reports over-optimal status when between optimal and max", () => {
    const r = analyzeDensity({ ...baseInput, platform: "twitter", count: 5 }, 5);
    // Twitter optimal is 2-3
    expect(r.status).toBe("over-optimal");
  });
  it("reports over-max status when over max", () => {
    const r = analyzeDensity({ ...baseInput, platform: "twitter", count: 15 }, 15);
    // Twitter max is 10
    expect(r.status).toBe("over-max");
  });
  it("computes total hashtag chars", () => {
    const r = analyzeDensity({ ...baseInput, count: 5 }, 5);
    expect(r.totalHashtagChars).toBeGreaterThan(0);
  });
});

describe("hashtag-generator computeStats", () => {
  it("computes totals by category and type", () => {
    const entries = generateAllHashtags("javascript programming");
    const stats = computeStats(entries);
    expect(stats.total).toBe(entries.length);
    const catSum = stats.byCategory.popular + stats.byCategory.medium + stats.byCategory.niche;
    expect(catSum).toBe(entries.length);
    const typeSum = Object.values(stats.byType).reduce((a, b) => a + b, 0);
    expect(typeSum).toBe(entries.length);
  });
  it("returns zeros for empty input", () => {
    const stats = computeStats([]);
    expect(stats.total).toBe(0);
    expect(stats.byCategory.popular).toBe(0);
    expect(stats.byType.direct).toBe(0);
  });
});

describe("hashtag-generator trending niches", () => {
  it("gets trending hashtags for known niche", () => {
    const tags = getTrendingForNiche("javascript");
    expect(tags.length).toBeGreaterThanOrEqual(5);
    expect(tags).toContain("#javascript");
  });
  it("returns empty for unknown niche", () => {
    expect(getTrendingForNiche("nonexistentniche")).toEqual([]);
  });
  it("lists all trending niches sorted", () => {
    const list = listTrendingNiches();
    expect(list.length).toBeGreaterThanOrEqual(10);
    expect(list).toContain("javascript");
    // Verify sorted
    const sorted = [...list].sort();
    expect(list).toEqual(sorted);
  });
});

describe("hashtag-generator renderText", () => {
  it("renders text grouped by category", () => {
    const entries = generateAllHashtags("javascript programming");
    const text = renderText(entries);
    expect(text).toContain("=== Popular");
    expect(text).toContain("=== Medium");
    expect(text).toContain("=== Niche");
  });
  it("includes type and reach for each tag", () => {
    const entries = generateAllHashtags("javascript programming");
    const text = renderText(entries);
    expect(text).toMatch(/\[direct,/);
    expect(text).toMatch(/~\d/);
  });
  it("returns empty for empty input", () => {
    expect(renderText([])).toBe("");
  });
});

describe("hashtag-generator renderCsv", () => {
  it("renders CSV header", () => {
    const csv = renderCsv([], "instagram");
    expect(csv).toContain("hashtag,type,category,platform,est_reach");
  });
  it("renders entries", () => {
    const entries = generateAllHashtags("javascript").slice(0, 3);
    const csv = renderCsv(entries, "instagram");
    expect(csv).toContain("instagram");
    expect(csv.split("\n").length).toBe(4); // header + 3 rows
  });
});

describe("hashtag-generator splitCsvRow", () => {
  it("splits simple row", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("handles escaped quotes", () => {
    expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]);
  });
});

describe("hashtag-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, topic: "javascript",
      platform: "instagram", count: 20, totalHashtags: 20,
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].topic).toBe("javascript");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, topic: `topic ${i}`,
        platform: "instagram", count: 5, totalHashtags: 5,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, topic: "x",
      platform: "instagram", count: 5, totalHashtags: 5,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("hashtag-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(baseInput);
    expect(url).toContain("topic=javascript");
    expect(url).toContain("plat=instagram");
    expect(url).toContain("count=20");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl(baseInput);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : `#${url.slice(1)}`;
    const parsed = parseShareUrl(hash);
    expect(parsed.topic).toBe(baseInput.topic);
    expect(parsed.platform).toBe("instagram");
    expect(parsed.count).toBe(20);
    expect(parsed.includeBranded).toBe(true);
    expect(parsed.includeNiche).toBe(true);
    expect(parsed.excludeGeneric).toBe(false);
    expect(parsed.mixPopularNiche).toBe(true);
  });
  it("handles empty hash with defaults", () => {
    const parsed = parseShareUrl("");
    expect(parsed.topic).toBe("");
    expect(parsed.platform).toBe("instagram");
    expect(parsed.count).toBe(20);
    expect(parsed.includeBranded).toBe(true);
  });
  it("filters unknown platforms", () => {
    const parsed = parseShareUrl("topic=x&plat=instagram,unknown");
    // instagram stored as just "instagram" (no commas) — verify parsing
    expect(parsed.platform).toBe("instagram");
  });
  it("filters unknown platforms to default", () => {
    const parsed = parseShareUrl("topic=x&plat=unknownplatform");
    expect(parsed.platform).toBe("instagram");
  });
  it("clamps count to valid range", () => {
    const tooMany = parseShareUrl("topic=x&count=1000");
    expect(tooMany.count).toBeLessThanOrEqual(50);
    const tooFew = parseShareUrl("topic=x&count=0");
    expect(tooFew.count).toBeGreaterThanOrEqual(1);
  });
  it("parses boolean flags", () => {
    const parsed = parseShareUrl("topic=x&branded=0&niche=0&nogen=1&mix=0");
    expect(parsed.includeBranded).toBe(false);
    expect(parsed.includeNiche).toBe(false);
    expect(parsed.excludeGeneric).toBe(true);
    expect(parsed.mixPopularNiche).toBe(false);
  });
});

// Suppress unused-import lint for type-only re-exports
export type _Unused = Platform;

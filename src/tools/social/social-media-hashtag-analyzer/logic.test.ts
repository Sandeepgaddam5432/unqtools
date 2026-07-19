import { describe, it, expect, beforeEach } from "vitest";
import {
  PLATFORMS,
  PLATFORM_LABELS,
  RANK_METRICS,
  RANK_METRIC_LABELS,
  CATEGORY_LABELS,
  SATURATION_LABELS,
  POPULAR_THRESHOLD,
  NICHE_THRESHOLD,
  SATURATION_HIGH,
  SATURATION_MEDIUM,
  splitCsvRow,
  normalizeHashtag,
  parseHashtagLine,
  parseHashtags,
  computeEngagementPerPost,
  classifyHashtag,
  checkSaturation,
  filterByPlatform,
  filterByDateRange,
  filterByMinPostCount,
  aggregateByHashtag,
  aggregateByPlatform,
  computeSummary,
  rankHashtags,
  findTopPerformers,
  daysBetween,
  analyzeTrendForHashtag,
  analyzeAllTrends,
  analyzeDensity,
  findCoOccurrence,
  findBestCombos,
  recommendHashtags,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Platform,
  type RankMetric,
  type HashtagInput,
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

const SAMPLE_CSV = `hashtag,platform,post_count,avg_engagement,avg_reach,date
#SEO,instagram,15000,500,8000,2024-01-01
marketing,instagram,5000,300,4000,2024-01-01
seo,twitter,20000,250,6000,2024-01-02
growthhacking,linkedin,800,120,1500,2024-01-03
seo,instagram,18000,550,9000,2024-01-10
marketing,twitter,6000,200,3000,2024-01-12
ai,tiktok,500000,2000,50000,2024-01-15
ai,instagram,450000,1800,40000,2024-01-20
growthhacking,twitter,900,130,1600,2024-01-22
seo,linkedin,22000,400,7000,2024-02-01
ai,youtube,300000,1500,30000,2024-02-05
marketing,linkedin,5500,280,3500,2024-02-10`;

describe("hashtag-analyzer constants", () => {
  it("has 5 platforms", () => {
    expect(PLATFORMS).toHaveLength(5);
    expect(PLATFORMS).toContain("instagram");
    expect(PLATFORMS).toContain("youtube");
  });
  it("has 5 platform labels", () => {
    expect(Object.keys(PLATFORM_LABELS)).toHaveLength(5);
  });
  it("has 4 rank metrics", () => {
    expect(RANK_METRICS).toHaveLength(4);
    expect(RANK_METRICS).toContain("engagement");
    expect(RANK_METRICS).toContain("engagement_per_post");
  });
  it("has rank metric labels", () => {
    expect(Object.keys(RANK_METRIC_LABELS)).toHaveLength(4);
  });
  it("has 3 category labels", () => {
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(3);
  });
  it("has 3 saturation labels", () => {
    expect(Object.keys(SATURATION_LABELS)).toHaveLength(3);
  });
  it("has consistent thresholds", () => {
    expect(NICHE_THRESHOLD).toBeLessThan(POPULAR_THRESHOLD);
    expect(SATURATION_MEDIUM).toBeLessThan(SATURATION_HIGH);
    expect(POPULAR_THRESHOLD).toBe(SATURATION_MEDIUM);
  });
});

describe("hashtag-analyzer splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
  it("handles escaped quotes", () => { expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]); });
});

describe("hashtag-analyzer normalizeHashtag", () => {
  it("strips leading # and lowercases", () => {
    expect(normalizeHashtag("#SEO")).toBe("seo");
  });
  it("converts internal spaces to underscores", () => {
    expect(normalizeHashtag("#Social Media")).toBe("social_media");
  });
  it("handles empty input", () => {
    expect(normalizeHashtag("")).toBe("");
    expect(normalizeHashtag("#")).toBe("");
  });
  it("preserves underscores and digits", () => {
    expect(normalizeHashtag("#AI_2024")).toBe("ai_2024");
  });
});

describe("hashtag-analyzer parseHashtagLine", () => {
  it("parses a valid line with # prefix", () => {
    const { entry, error } = parseHashtagLine("#SEO,instagram,15000,500,8000,2024-01-01", 1);
    expect(error).toBeNull();
    expect(entry).not.toBeNull();
    expect(entry!.hashtag).toBe("seo");
    expect(entry!.platform).toBe("instagram");
    expect(entry!.postCount).toBe(15000);
    expect(entry!.avgEngagement).toBe(500);
    expect(entry!.avgReach).toBe(8000);
  });
  it("parses a valid line without # prefix", () => {
    const { entry, error } = parseHashtagLine("ai,tiktok,500000,2000,50000,2024-01-15", 1);
    expect(error).toBeNull();
    expect(entry!.hashtag).toBe("ai");
  });
  it("rejects unknown platform", () => {
    const { error } = parseHashtagLine("seo,mastodon,100,10,100,2024-01-01", 1);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("platform");
  });
  it("rejects invalid post count", () => {
    const { error } = parseHashtagLine("seo,instagram,abc,10,100,2024-01-01", 1);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("post_count");
  });
  it("rejects negative engagement", () => {
    const { error } = parseHashtagLine("seo,instagram,100,-10,100,2024-01-01", 1);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("avg_engagement");
  });
  it("rejects invalid date", () => {
    const { error } = parseHashtagLine("seo,instagram,100,10,100,01-01-2024", 1);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("date");
  });
  it("rejects too few fields", () => {
    const { error } = parseHashtagLine("seo,instagram,100", 1);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("6 fields");
  });
  it("returns null entry + null error for blank line", () => {
    const { entry, error } = parseHashtagLine("   ", 1);
    expect(entry).toBeNull();
    expect(error).toBeNull();
  });
  it("rejects empty hashtag", () => {
    const { error } = parseHashtagLine("#,instagram,100,10,100,2024-01-01", 1);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("hashtag");
  });
});

describe("hashtag-analyzer parseHashtags", () => {
  it("parses sample CSV skipping header", () => {
    const { entries, errors } = parseHashtags(SAMPLE_CSV);
    expect(entries).toHaveLength(12);
    expect(errors).toHaveLength(0);
  });
  it("handles input without header", () => {
    const { entries } = parseHashtags("ai,tiktok,500,20,500,2024-01-15");
    expect(entries).toHaveLength(1);
  });
  it("collects errors but keeps valid entries", () => {
    const csv = `seo,instagram,100,10,100,2024-01-01
bad-date,instagram,100,10,100,01-01-2024
ai,tiktok,500,20,500,2024-01-15`;
    const { entries, errors } = parseHashtags(csv);
    expect(entries).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(2);
  });
  it("returns empty for empty input", () => {
    const { entries, errors } = parseHashtags("");
    expect(entries).toEqual([]);
    expect(errors).toEqual([]);
  });
});

describe("hashtag-analyzer computeEngagementPerPost", () => {
  it("divides engagement by post count", () => {
    expect(computeEngagementPerPost({ avgEngagement: 500, postCount: 100 })).toBe(5);
  });
  it("returns 0 for zero post count", () => {
    expect(computeEngagementPerPost({ avgEngagement: 500, postCount: 0 })).toBe(0);
  });
  it("returns 0 for negative post count", () => {
    expect(computeEngagementPerPost({ avgEngagement: 500, postCount: -1 })).toBe(0);
  });
});

describe("hashtag-analyzer classifyHashtag", () => {
  it("returns popular for >= POPULAR_THRESHOLD", () => {
    expect(classifyHashtag(POPULAR_THRESHOLD)).toBe("popular");
    expect(classifyHashtag(50000)).toBe("popular");
  });
  it("returns medium for >= NICHE_THRESHOLD and < POPULAR_THRESHOLD", () => {
    expect(classifyHashtag(NICHE_THRESHOLD)).toBe("medium");
    expect(classifyHashtag(5000)).toBe("medium");
  });
  it("returns niche for < NICHE_THRESHOLD", () => {
    expect(classifyHashtag(NICHE_THRESHOLD - 1)).toBe("niche");
    expect(classifyHashtag(500)).toBe("niche");
    expect(classifyHashtag(0)).toBe("niche");
  });
});

describe("hashtag-analyzer checkSaturation", () => {
  it("returns high for >= SATURATION_HIGH", () => {
    expect(checkSaturation(SATURATION_HIGH)).toBe("high");
    expect(checkSaturation(500000)).toBe("high");
  });
  it("returns medium for >= SATURATION_MEDIUM and < SATURATION_HIGH", () => {
    expect(checkSaturation(SATURATION_MEDIUM)).toBe("medium");
    expect(checkSaturation(50000)).toBe("medium");
  });
  it("returns low for < SATURATION_MEDIUM", () => {
    expect(checkSaturation(SATURATION_MEDIUM - 1)).toBe("low");
    expect(checkSaturation(5000)).toBe("low");
  });
});

describe("hashtag-analyzer filterByPlatform", () => {
  const entries = parseHashtags(SAMPLE_CSV).entries;
  it("returns all for 'all'", () => {
    expect(filterByPlatform(entries, "all")).toHaveLength(12);
  });
  it("filters to single platform", () => {
    // Instagram has 4 entries: #SEO, marketing, seo (2nd), ai
    expect(filterByPlatform(entries, "instagram")).toHaveLength(4);
  });
  it("filters to tiktok", () => {
    expect(filterByPlatform(entries, "tiktok")).toHaveLength(1);
  });
});

describe("hashtag-analyzer filterByDateRange", () => {
  const entries = parseHashtags(SAMPLE_CSV).entries;
  it("filters by start", () => {
    // 2024-01-20, 2024-01-22, 2024-02-01, 2024-02-05, 2024-02-10 = 5 entries
    expect(filterByDateRange(entries, "2024-01-20")).toHaveLength(5);
  });
  it("filters by end", () => {
    // 2024-01-01 x2, 2024-01-02, 2024-01-03, 2024-01-10 = 5 entries
    expect(filterByDateRange(entries, undefined, "2024-01-10")).toHaveLength(5);
  });
  it("filters by both", () => {
    // 2024-01-10, 2024-01-12, 2024-01-15, 2024-01-20, 2024-01-22 = 5 entries
    expect(filterByDateRange(entries, "2024-01-10", "2024-01-22")).toHaveLength(5);
  });
  it("returns all when no filter", () => {
    expect(filterByDateRange(entries)).toHaveLength(12);
  });
});

describe("hashtag-analyzer filterByMinPostCount", () => {
  const entries = parseHashtags(SAMPLE_CSV).entries;
  it("returns all when min is 0 or invalid", () => {
    expect(filterByMinPostCount(entries, 0)).toHaveLength(12);
    expect(filterByMinPostCount(entries, -5)).toHaveLength(12);
  });
  it("filters to entries with postCount >= min", () => {
    expect(filterByMinPostCount(entries, 5000)).toHaveLength(10);
  });
  it("filters to high-volume only", () => {
    // ai entries (tiktok, instagram, youtube) = 3 with postCount >= 100000
    const filtered = filterByMinPostCount(entries, 100000);
    expect(filtered).toHaveLength(3);
    expect(filtered.every((e) => e.postCount >= 100000)).toBe(true);
  });
});

describe("hashtag-analyzer aggregateByHashtag", () => {
  const entries = parseHashtags(SAMPLE_CSV).entries;
  const stats = aggregateByHashtag(entries);
  it("returns one stat per unique hashtag", () => {
    expect(stats).toHaveLength(4);
    const hashtags = stats.map((s) => s.hashtag).sort();
    expect(hashtags).toEqual(["ai", "growthhacking", "marketing", "seo"]);
  });
  it("sums total posts across entries", () => {
    const seo = stats.find((s) => s.hashtag === "seo")!;
    expect(seo.totalPosts).toBe(15000 + 20000 + 18000 + 22000);
  });
  it("averages engagement across entries", () => {
    const seo = stats.find((s) => s.hashtag === "seo")!;
    expect(seo.avgEngagement).toBeCloseTo((500 + 250 + 550 + 400) / 4, 1);
  });
  it("computes total engagement", () => {
    const seo = stats.find((s) => s.hashtag === "seo")!;
    const expected = 15000 * 500 + 20000 * 250 + 18000 * 550 + 22000 * 400;
    expect(seo.totalEngagement).toBe(expected);
  });
  it("classifies categories correctly", () => {
    const ai = stats.find((s) => s.hashtag === "ai")!;
    expect(ai.category).toBe("popular");
    expect(ai.saturation).toBe("high");
    // growthhacking has 800 + 900 = 1700 total posts → medium category, low saturation
    const gh = stats.find((s) => s.hashtag === "growthhacking")!;
    expect(gh.category).toBe("medium");
    expect(gh.saturation).toBe("low");
  });
  it("tracks platforms", () => {
    const seo = stats.find((s) => s.hashtag === "seo")!;
    expect(seo.platforms.sort()).toEqual(["instagram", "linkedin", "twitter"]);
  });
});

describe("hashtag-analyzer aggregateByPlatform", () => {
  const entries = parseHashtags(SAMPLE_CSV).entries;
  const groups = aggregateByPlatform(entries);
  it("returns one group per platform present", () => {
    expect(groups).toHaveLength(5);
  });
  it("computes total posts per platform", () => {
    const ig = groups.find((g) => g.platform === "instagram")!;
    // #SEO(15000) + marketing(5000) + seo(18000) + ai(450000) = 488000
    expect(ig.totalPosts).toBe(15000 + 5000 + 18000 + 450000);
  });
  it("computes avg engagement per platform", () => {
    const ig = groups.find((g) => g.platform === "instagram")!;
    // (500 + 300 + 550 + 1800) / 4 = 787.5
    expect(ig.avgEngagement).toBeCloseTo((500 + 300 + 550 + 1800) / 4, 1);
  });
});

describe("hashtag-analyzer computeSummary", () => {
  const entries = parseHashtags(SAMPLE_CSV).entries;
  const summary = computeSummary(entries);
  it("computes total entries", () => {
    expect(summary.totalEntries).toBe(12);
  });
  it("computes unique hashtags", () => {
    expect(summary.uniqueHashtags).toBe(4);
  });
  it("computes total posts", () => {
    const total = entries.reduce((s, e) => s + e.postCount, 0);
    expect(summary.totalPosts).toBe(total);
  });
  it("computes avg engagement across entries", () => {
    const total = entries.reduce((s, e) => s + e.avgEngagement, 0) / entries.length;
    expect(summary.avgEngagement).toBeCloseTo(total, 1);
  });
  it("has byPlatform array", () => {
    expect(summary.byPlatform).toHaveLength(5);
  });
  it("returns zero stats for empty input", () => {
    const s = computeSummary([]);
    expect(s.totalEntries).toBe(0);
    expect(s.uniqueHashtags).toBe(0);
    expect(s.avgEngagement).toBe(0);
  });
});

describe("hashtag-analyzer rankHashtags", () => {
  const entries = parseHashtags(SAMPLE_CSV).entries;
  it("ranks by engagement descending", () => {
    const ranked = rankHashtags(entries, "engagement");
    expect(ranked).toHaveLength(12);
    expect(ranked[0].avgEngagement).toBeGreaterThanOrEqual(ranked[1].avgEngagement);
    expect(ranked[0].rank).toBe(1);
  });
  it("ranks by reach descending", () => {
    const ranked = rankHashtags(entries, "reach");
    expect(ranked[0].avgReach).toBeGreaterThanOrEqual(ranked[1].avgReach);
  });
  it("ranks by post count descending", () => {
    const ranked = rankHashtags(entries, "post_count");
    expect(ranked[0].postCount).toBeGreaterThanOrEqual(ranked[1].postCount);
  });
  it("ranks by engagement per post descending", () => {
    const ranked = rankHashtags(entries, "engagement_per_post");
    expect(ranked[0].engagementPerPost).toBeGreaterThanOrEqual(ranked[1].engagementPerPost);
  });
  it("enriches with totalEngagement and totalReach", () => {
    const ranked = rankHashtags(entries, "engagement");
    expect(ranked[0].totalEngagement).toBeGreaterThan(0);
    expect(ranked[0].totalReach).toBeGreaterThan(0);
  });
  it("assigns category and saturation", () => {
    const ranked = rankHashtags(entries, "engagement");
    const ai = ranked.find((r) => r.hashtag === "ai");
    expect(ai!.category).toBe("popular");
    expect(ai!.saturation).toBe("high");
  });
  it("assigns sequential ranks", () => {
    const ranked = rankHashtags(entries, "engagement");
    for (let i = 0; i < ranked.length; i++) {
      expect(ranked[i].rank).toBe(i + 1);
    }
  });
  it("handles empty input", () => {
    expect(rankHashtags([], "engagement")).toEqual([]);
  });
});

describe("hashtag-analyzer findTopPerformers", () => {
  const entries = parseHashtags(SAMPLE_CSV).entries;
  it("returns top N by engagement", () => {
    const top = findTopPerformers(entries, 3);
    expect(top).toHaveLength(3);
    expect(top[0].avgEngagement).toBeGreaterThanOrEqual(top[1].avgEngagement);
  });
  it("defaults to limit 10", () => {
    const top = findTopPerformers(entries);
    expect(top).toHaveLength(10);
  });
});

describe("hashtag-analyzer daysBetween", () => {
  it("counts days between two dates", () => {
    expect(daysBetween("2024-01-01", "2024-01-10")).toBe(9);
  });
  it("returns 0 for same date", () => {
    expect(daysBetween("2024-01-01", "2024-01-01")).toBe(0);
  });
  it("handles month boundaries", () => {
    expect(daysBetween("2024-01-01", "2024-02-01")).toBe(31);
  });
});

describe("hashtag-analyzer analyzeTrendForHashtag", () => {
  const entries = parseHashtags(SAMPLE_CSV).entries;
  it("returns trend analysis for known hashtag", () => {
    const t = analyzeTrendForHashtag(entries, "seo");
    expect(t).not.toBeNull();
    expect(t!.points.length).toBe(4);
  });
  it("returns null for unknown hashtag", () => {
    expect(analyzeTrendForHashtag(entries, "nonexistent")).toBeNull();
  });
  it("marks direction correctly", () => {
    const t = analyzeTrendForHashtag(entries, "seo");
    expect(["improving", "declining", "flat"]).toContain(t!.direction);
  });
  it("returns flat for single data point", () => {
    const single: HashtagInput[] = [
      { hashtag: "solo", platform: "instagram", postCount: 100, avgEngagement: 10, avgReach: 100, date: "2024-01-01" },
    ];
    const t = analyzeTrendForHashtag(single, "solo");
    expect(t!.direction).toBe("flat");
    expect(t!.points).toHaveLength(1);
  });
});

describe("hashtag-analyzer analyzeAllTrends", () => {
  const entries = parseHashtags(SAMPLE_CSV).entries;
  it("returns one trend per unique hashtag", () => {
    const trends = analyzeAllTrends(entries);
    expect(trends).toHaveLength(4);
  });
  it("sorts by improvement delta descending", () => {
    const trends = analyzeAllTrends(entries);
    for (let i = 1; i < trends.length; i++) {
      const dPrev = trends[i - 1].secondHalfAvg - trends[i - 1].firstHalfAvg;
      const dCurr = trends[i].secondHalfAvg - trends[i].firstHalfAvg;
      expect(dPrev).toBeGreaterThanOrEqual(dCurr);
    }
  });
  it("returns empty for empty input", () => {
    expect(analyzeAllTrends([])).toEqual([]);
  });
});

describe("hashtag-analyzer analyzeDensity", () => {
  const entries = parseHashtags(SAMPLE_CSV).entries;
  const density = analyzeDensity(entries);
  it("returns one analysis per unique hashtag", () => {
    expect(density).toHaveLength(4);
  });
  it("computes total posts", () => {
    const seo = density.find((d) => d.hashtag === "seo")!;
    expect(seo.totalPosts).toBe(75000);
  });
  it("sorts by posts per day descending", () => {
    for (let i = 1; i < density.length; i++) {
      expect(density[i - 1].postsPerDay).toBeGreaterThanOrEqual(density[i].postsPerDay);
    }
  });
  it("returns positive postsPerDay for multi-entry hashtags", () => {
    const seo = density.find((d) => d.hashtag === "seo")!;
    expect(seo.postsPerDay).toBeGreaterThan(0);
  });
});

describe("hashtag-analyzer findCoOccurrence", () => {
  it("finds hashtags on same date+platform", () => {
    const entries: HashtagInput[] = [
      { hashtag: "a", platform: "instagram", postCount: 100, avgEngagement: 10, avgReach: 100, date: "2024-01-01" },
      { hashtag: "b", platform: "instagram", postCount: 200, avgEngagement: 20, avgReach: 200, date: "2024-01-01" },
      { hashtag: "c", platform: "twitter", postCount: 300, avgEngagement: 30, avgReach: 300, date: "2024-01-01" },
    ];
    const co = findCoOccurrence(entries);
    // a+b co-occur (same date+platform); c is alone on twitter
    expect(co.length).toBe(1);
    expect(co[0].hashtags).toContain("a");
    expect(co[0].hashtags).toContain("b");
    expect(co[0].count).toBe(1);
  });
  it("counts multiple co-occurrences across dates", () => {
    const entries: HashtagInput[] = [
      { hashtag: "a", platform: "instagram", postCount: 100, avgEngagement: 10, avgReach: 100, date: "2024-01-01" },
      { hashtag: "b", platform: "instagram", postCount: 200, avgEngagement: 20, avgReach: 200, date: "2024-01-01" },
      { hashtag: "a", platform: "instagram", postCount: 100, avgEngagement: 10, avgReach: 100, date: "2024-01-02" },
      { hashtag: "b", platform: "instagram", postCount: 200, avgEngagement: 20, avgReach: 200, date: "2024-01-02" },
    ];
    const co = findCoOccurrence(entries);
    expect(co).toHaveLength(1);
    expect(co[0].count).toBe(2);
  });
  it("returns empty when no co-occurrence", () => {
    const entries: HashtagInput[] = [
      { hashtag: "a", platform: "instagram", postCount: 100, avgEngagement: 10, avgReach: 100, date: "2024-01-01" },
      { hashtag: "b", platform: "twitter", postCount: 200, avgEngagement: 20, avgReach: 200, date: "2024-01-01" },
    ];
    expect(findCoOccurrence(entries)).toEqual([]);
  });
  it("handles sample CSV", () => {
    const entries = parseHashtags(SAMPLE_CSV).entries;
    const co = findCoOccurrence(entries);
    // 2024-01-01+instagram has seo+marketing
    expect(co.length).toBeGreaterThan(0);
    const pair = co.find((c) => c.hashtags.includes("seo") && c.hashtags.includes("marketing"));
    expect(pair).toBeDefined();
  });
});

describe("hashtag-analyzer findBestCombos", () => {
  it("finds top combinations by avg engagement", () => {
    const entries: HashtagInput[] = [
      { hashtag: "a", platform: "instagram", postCount: 100, avgEngagement: 10, avgReach: 100, date: "2024-01-01" },
      { hashtag: "b", platform: "instagram", postCount: 200, avgEngagement: 20, avgReach: 200, date: "2024-01-01" },
      { hashtag: "c", platform: "instagram", postCount: 300, avgEngagement: 50, avgReach: 500, date: "2024-01-02" },
      { hashtag: "d", platform: "instagram", postCount: 400, avgEngagement: 60, avgReach: 600, date: "2024-01-02" },
    ];
    const combos = findBestCombos(entries, 2);
    expect(combos).toHaveLength(2);
    // The 2024-01-02 group should rank first (higher engagement)
    expect(combos[0].avgEngagement).toBe(55); // (50+60)/2
    expect(combos[0].hashtags.sort()).toEqual(["c", "d"]);
  });
  it("returns empty when no multi-hashtag groups", () => {
    const entries: HashtagInput[] = [
      { hashtag: "a", platform: "instagram", postCount: 100, avgEngagement: 10, avgReach: 100, date: "2024-01-01" },
    ];
    expect(findBestCombos(entries, 5)).toEqual([]);
  });
  it("respects limit", () => {
    const entries = parseHashtags(SAMPLE_CSV).entries;
    const combos = findBestCombos(entries, 1);
    expect(combos).toHaveLength(1);
  });
});

describe("hashtag-analyzer recommendHashtags", () => {
  const entries = parseHashtags(SAMPLE_CSV).entries;
  it("returns recommendations excluding the top hashtag", () => {
    const recs = recommendHashtags(entries, 3);
    expect(recs).toHaveLength(3);
    const stats = aggregateByHashtag(entries);
    expect(recs.every((r) => r.hashtag !== stats[0].hashtag)).toBe(true);
  });
  it("scores between 0 and 100", () => {
    const recs = recommendHashtags(entries, 10);
    for (const r of recs) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });
  it("sorts by score descending", () => {
    const recs = recommendHashtags(entries, 5);
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score);
    }
  });
  it("returns empty for empty input", () => {
    expect(recommendHashtags([], 5)).toEqual([]);
  });
  it("returns empty for single hashtag", () => {
    const single: HashtagInput[] = [
      { hashtag: "solo", platform: "instagram", postCount: 100, avgEngagement: 10, avgReach: 100, date: "2024-01-01" },
    ];
    expect(recommendHashtags(single, 5)).toEqual([]);
  });
  it("gives reason text", () => {
    const recs = recommendHashtags(entries, 3);
    for (const r of recs) {
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });
});

describe("hashtag-analyzer renderText", () => {
  const entries = parseHashtags(SAMPLE_CSV).entries;
  it("renders non-empty report", () => {
    const text = renderText(entries, "engagement");
    expect(text).toContain("=== Social Media Hashtag Report ===");
    expect(text).toContain("--- Summary ---");
    expect(text).toContain("--- By Platform ---");
    expect(text).toContain("Top 10 hashtags");
    expect(text).toContain("Category breakdown");
    expect(text).toContain("Saturation warnings");
    expect(text).toContain("Engagement trend");
    expect(text).toContain("Posting density");
    expect(text).toContain("Co-occurring hashtags");
    expect(text).toContain("Best hashtag combinations");
    expect(text).toContain("Recommended hashtags");
  });
  it("flags saturated hashtags in report", () => {
    const text = renderText(entries, "engagement");
    expect(text).toContain("high saturation");
  });
  it("returns 'No hashtag data' for empty input", () => {
    expect(renderText([], "engagement")).toBe("No hashtag data to report.");
  });
  it("includes metric name in header", () => {
    const text = renderText(entries, "reach");
    expect(text).toContain("Avg Reach");
  });
});

describe("hashtag-analyzer renderCsv", () => {
  const entries = parseHashtags(SAMPLE_CSV).entries;
  it("renders header", () => {
    const csv = renderCsv([], "engagement");
    expect(csv).toContain("hashtag,platform,post_count,avg_engagement,avg_reach,date,total_engagement,total_reach,engagement_per_post,category,saturation,rank");
  });
  it("renders entry rows", () => {
    const csv = renderCsv(entries, "engagement");
    expect(csv.split("\n").length).toBe(13); // header + 12 entries
  });
  it("includes rank 1 in first row", () => {
    const csv = renderCsv(entries, "engagement");
    const lines = csv.split("\n");
    expect(lines[1]).toContain(",1");
  });
});

describe("hashtag-analyzer history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      entryCount: 12,
      uniqueHashtags: 4,
      totalPosts: 1000000,
      avgEngagement: 500,
      preview: "ai",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, entryCount: 1, uniqueHashtags: 1, totalPosts: 1, avgEngagement: 1, preview: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, entryCount: 1, uniqueHashtags: 1, totalPosts: 1, avgEngagement: 1, preview: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("puts newest first", () => {
    saveHistory({ ts: 1, entryCount: 1, uniqueHashtags: 1, totalPosts: 1, avgEngagement: 1, preview: "old" });
    saveHistory({ ts: 2, entryCount: 2, uniqueHashtags: 2, totalPosts: 2, avgEngagement: 2, preview: "new" });
    const h = loadHistory();
    expect(h[0].preview).toBe("new");
    expect(h[1].preview).toBe("old");
  });
});

describe("hashtag-analyzer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      data: "ai,tiktok,500,20,500,2024-01-15",
      dateStart: "2024-01-01",
      dateEnd: "2024-02-01",
      platform: "tiktok",
      minPostCount: "100",
      metric: "reach",
    });
    expect(url).toContain("data=ai");
    expect(url).toContain("start=2024-01-01");
    expect(url).toContain("platform=tiktok");
    expect(url).toContain("min=100");
    expect(url).toContain("metric=reach");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("data=ai%2Ctiktok%2C500&start=2024-01-01&platform=tiktok&min=100&metric=reach");
    expect(p.data).toBe("ai,tiktok,500");
    expect(p.dateStart).toBe("2024-01-01");
    expect(p.platform).toBe("tiktok");
    expect(p.minPostCount).toBe("100");
    expect(p.metric).toBe("reach");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({
      data: "",
      dateStart: "",
      dateEnd: "",
      platform: "all",
      minPostCount: "",
      metric: "engagement",
    });
  });
  it("filters unknown platform", () => {
    const p = parseShareUrl("platform=mastodon");
    expect(p.platform).toBe("all");
  });
  it("filters unknown metric", () => {
    const p = parseShareUrl("metric=unknown");
    expect(p.metric).toBe("engagement");
  });
  it("omits default values when building", () => {
    const url = buildShareUrl({
      data: "",
      dateStart: "",
      dateEnd: "",
      platform: "all",
      minPostCount: "",
      metric: "engagement",
    });
    expect(url).not.toContain("platform=");
    expect(url).not.toContain("metric=");
  });
});

// Suppress unused-import lint
export type _Unused = Platform | RankMetric | HashtagInput;

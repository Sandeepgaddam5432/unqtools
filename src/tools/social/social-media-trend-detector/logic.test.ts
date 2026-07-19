import { describe, it, expect, beforeEach } from "vitest";
import {
  PLATFORMS,
  PLATFORM_LABELS,
  RANK_METRICS,
  RANK_METRIC_LABELS,
  TREND_TYPE_LABELS,
  LIFECYCLE_LABELS,
  URGENCY_LABELS,
  DEFAULT_TREND_THRESHOLD,
  DEFAULT_GROWTH_THRESHOLD,
  DEFAULT_LOOKBACK_DAYS,
  LIFECYCLE_HIGH_MENTIONS,
  LIFECYCLE_MID_MENTIONS,
  splitCsvRow,
  normalizeTopic,
  parseTrendLine,
  parseTrends,
  daysBetween,
  addDays,
  filterByPlatform,
  filterByDateRange,
  filterByTrendThreshold,
  aggregateByTopic,
  getLatestDate,
  computeGrowthRate,
  classifyTrend,
  computeAllGrowthRates,
  computeVelocity,
  predictLifecycle,
  scoreOpportunity,
  aggregateByPlatform,
  rankTrends,
  findEmergingTrends,
  findSustainedTrends,
  findDecliningTrends,
  findCrossPlatformTrends,
  recommendBestTime,
  computeSummary,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Platform,
  type RankMetric,
  type TrendInput,
  type TrendType,
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

// Sample CSV with multiple data points per topic over time.
// Latest date is 2024-01-15. With lookback=7, recent window is 2024-01-09..2024-01-15.
// Prior window is 2024-01-02..2024-01-08.
const SAMPLE_CSV = `date,topic,platform,mention_count,engagement_count
2024-01-02,ai_art,twitter,100,500
2024-01-03,ai_art,twitter,120,600
2024-01-05,ai_art,twitter,150,800
2024-01-09,ai_art,twitter,300,1500
2024-01-11,ai_art,twitter,400,2000
2024-01-15,ai_art,twitter,500,2500
2024-01-02,vr_gaming,twitter,50,200
2024-01-05,vr_gaming,twitter,55,210
2024-01-09,vr_gaming,twitter,60,240
2024-01-12,vr_gaming,twitter,65,260
2024-01-15,vr_gaming,twitter,70,280
2024-01-02,old_topic,twitter,2000,5000
2024-01-05,old_topic,twitter,1800,4500
2024-01-09,old_topic,twitter,800,2000
2024-01-12,old_topic,twitter,400,1000
2024-01-15,old_topic,twitter,200,500
2024-01-09,ai_art,instagram,200,1000
2024-01-12,ai_art,instagram,300,1500
2024-01-15,ai_art,instagram,400,2000
2024-01-09,vr_gaming,tiktok,80,400
2024-01-15,vr_gaming,tiktok,90,450`;

describe("trend-detector constants", () => {
  it("has 5 platforms", () => {
    expect(PLATFORMS).toHaveLength(5);
    expect(PLATFORMS).toContain("twitter");
    expect(PLATFORMS).toContain("youtube");
  });
  it("has 5 platform labels", () => {
    expect(Object.keys(PLATFORM_LABELS)).toHaveLength(5);
  });
  it("has 3 rank metrics", () => {
    expect(RANK_METRICS).toHaveLength(3);
    expect(RANK_METRICS).toContain("growth_rate");
  });
  it("has rank metric labels", () => {
    expect(Object.keys(RANK_METRIC_LABELS)).toHaveLength(3);
  });
  it("has 3 trend type labels", () => {
    expect(Object.keys(TREND_TYPE_LABELS)).toHaveLength(3);
  });
  it("has 3 lifecycle labels", () => {
    expect(Object.keys(LIFECYCLE_LABELS)).toHaveLength(3);
  });
  it("has 4 urgency labels", () => {
    expect(Object.keys(URGENCY_LABELS)).toHaveLength(4);
  });
  it("has consistent default thresholds", () => {
    expect(DEFAULT_TREND_THRESHOLD).toBeGreaterThan(0);
    expect(DEFAULT_GROWTH_THRESHOLD).toBeGreaterThan(0);
    expect(DEFAULT_LOOKBACK_DAYS).toBeGreaterThan(0);
    expect(LIFECYCLE_MID_MENTIONS).toBeLessThan(LIFECYCLE_HIGH_MENTIONS);
  });
});

describe("trend-detector splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
  it("handles escaped quotes", () => { expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]); });
});

describe("trend-detector normalizeTopic", () => {
  it("lowercases and trims", () => {
    expect(normalizeTopic("  AI Art  ")).toBe("ai_art");
  });
  it("converts spaces to underscores", () => {
    expect(normalizeTopic("VR Gaming Trends")).toBe("vr_gaming_trends");
  });
  it("handles empty input", () => {
    expect(normalizeTopic("")).toBe("");
  });
  it("preserves underscores and digits", () => {
    expect(normalizeTopic("Web3_2024")).toBe("web3_2024");
  });
});

describe("trend-detector parseTrendLine", () => {
  it("parses a valid line", () => {
    const { entry, error } = parseTrendLine("2024-01-01,ai_art,twitter,100,500", 1);
    expect(error).toBeNull();
    expect(entry).not.toBeNull();
    expect(entry!.topic).toBe("ai_art");
    expect(entry!.platform).toBe("twitter");
    expect(entry!.mentionCount).toBe(100);
    expect(entry!.engagementCount).toBe(500);
  });
  it("normalizes topic case and spaces", () => {
    const { entry } = parseTrendLine("2024-01-01,VR Gaming,twitter,50,200", 1);
    expect(entry!.topic).toBe("vr_gaming");
  });
  it("rejects bad date", () => {
    const { error } = parseTrendLine("01-01-2024,ai,twitter,100,500", 1);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("date");
  });
  it("rejects empty topic", () => {
    const { error } = parseTrendLine("2024-01-01,,twitter,100,500", 1);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("topic");
  });
  it("rejects unknown platform", () => {
    const { error } = parseTrendLine("2024-01-01,ai,mastodon,100,500", 1);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("platform");
  });
  it("rejects invalid mention count", () => {
    const { error } = parseTrendLine("2024-01-01,ai,twitter,abc,500", 1);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("mention_count");
  });
  it("rejects negative engagement", () => {
    const { error } = parseTrendLine("2024-01-01,ai,twitter,100,-5", 1);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("engagement_count");
  });
  it("rejects too few fields", () => {
    const { error } = parseTrendLine("2024-01-01,ai,twitter", 1);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("5 fields");
  });
  it("returns null entry + null error for blank line", () => {
    const { entry, error } = parseTrendLine("   ", 1);
    expect(entry).toBeNull();
    expect(error).toBeNull();
  });
});

describe("trend-detector parseTrends", () => {
  it("parses sample CSV skipping header", () => {
    const { entries, errors } = parseTrends(SAMPLE_CSV);
    // 9 ai_art + 7 vr_gaming + 5 old_topic = 21 entries
    expect(entries).toHaveLength(21);
    expect(errors).toHaveLength(0);
  });
  it("handles input without header", () => {
    const { entries } = parseTrends("2024-01-01,ai,twitter,100,500");
    expect(entries).toHaveLength(1);
  });
  it("collects errors but keeps valid entries", () => {
    const csv = `2024-01-01,ai,twitter,100,500
bad-date,ai,twitter,100,500
2024-01-02,vr,twitter,50,200`;
    const { entries, errors } = parseTrends(csv);
    expect(entries).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(2);
  });
  it("returns empty for empty input", () => {
    const { entries, errors } = parseTrends("");
    expect(entries).toEqual([]);
    expect(errors).toEqual([]);
  });
});

describe("trend-detector daysBetween & addDays", () => {
  it("counts days between two dates", () => {
    expect(daysBetween("2024-01-01", "2024-01-10")).toBe(9);
  });
  it("returns 0 for same date", () => {
    expect(daysBetween("2024-01-01", "2024-01-01")).toBe(0);
  });
  it("handles month boundaries", () => {
    expect(daysBetween("2024-01-01", "2024-02-01")).toBe(31);
  });
  it("addDays adds positive days", () => {
    expect(addDays("2024-01-01", 7)).toBe("2024-01-08");
  });
  it("addDays subtracts negative days", () => {
    expect(addDays("2024-01-15", -7)).toBe("2024-01-08");
  });
  it("addDays handles month boundaries", () => {
    expect(addDays("2024-01-31", 1)).toBe("2024-02-01");
  });
  it("addDays handles year boundaries", () => {
    expect(addDays("2024-12-31", 1)).toBe("2025-01-01");
  });
});

describe("trend-detector filterByPlatform", () => {
  const entries = parseTrends(SAMPLE_CSV).entries;
  it("returns all for 'all'", () => {
    expect(filterByPlatform(entries, "all")).toHaveLength(21);
  });
  it("filters to twitter", () => {
    // ai_art(6) + vr_gaming(5) + old_topic(5) = 16 twitter entries
    expect(filterByPlatform(entries, "twitter")).toHaveLength(16);
  });
  it("filters to instagram", () => {
    expect(filterByPlatform(entries, "instagram")).toHaveLength(3);
  });
});

describe("trend-detector filterByDateRange", () => {
  const entries = parseTrends(SAMPLE_CSV).entries;
  it("filters by start", () => {
    // dates >= 2024-01-09: ai_art(6) + vr_gaming(5) + old_topic(3) = 14
    expect(filterByDateRange(entries, "2024-01-09")).toHaveLength(14);
  });
  it("filters by end", () => {
    // dates <= 2024-01-05: ai_art(3) + vr_gaming(2) + old_topic(2) = 7
    expect(filterByDateRange(entries, undefined, "2024-01-05")).toHaveLength(7);
  });
  it("filters by both", () => {
    // dates 2024-01-09 to 2024-01-12: ai_art(4) + vr_gaming(3) + old_topic(2) = 9
    expect(filterByDateRange(entries, "2024-01-09", "2024-01-12")).toHaveLength(9);
  });
  it("returns all when no filter", () => {
    expect(filterByDateRange(entries)).toHaveLength(21);
  });
});

describe("trend-detector filterByTrendThreshold", () => {
  const entries = parseTrends(SAMPLE_CSV).entries;
  it("returns all when threshold is 0 or invalid", () => {
    expect(filterByTrendThreshold(entries, 0)).toHaveLength(21);
    expect(filterByTrendThreshold(entries, -5)).toHaveLength(21);
  });
  it("filters to topics with at least one entry >= threshold", () => {
    // old_topic has entries with 2000 mentions, ai_art has 500
    const filtered = filterByTrendThreshold(entries, 1000);
    const topics = new Set(filtered.map((e) => e.topic));
    expect(topics.has("old_topic")).toBe(true);
    expect(topics.has("ai_art")).toBe(false);
  });
});

describe("trend-detector aggregateByTopic", () => {
  const entries = parseTrends(SAMPLE_CSV).entries;
  const aggregates = aggregateByTopic(entries);
  it("returns one aggregate per unique topic", () => {
    expect(aggregates).toHaveLength(3);
    const topics = aggregates.map((a) => a.topic).sort();
    expect(topics).toEqual(["ai_art", "old_topic", "vr_gaming"]);
  });
  it("sums total mentions", () => {
    const ai = aggregates.find((a) => a.topic === "ai_art")!;
    expect(ai.totalMentions).toBe(100 + 120 + 150 + 300 + 400 + 500 + 200 + 300 + 400);
  });
  it("sums total engagement", () => {
    const ai = aggregates.find((a) => a.topic === "ai_art")!;
    expect(ai.totalEngagement).toBe(500 + 600 + 800 + 1500 + 2000 + 2500 + 1000 + 1500 + 2000);
  });
  it("counts data points", () => {
    const ai = aggregates.find((a) => a.topic === "ai_art")!;
    expect(ai.dataPoints).toBe(9);
  });
  it("tracks platforms", () => {
    const ai = aggregates.find((a) => a.topic === "ai_art")!;
    expect(ai.platforms.sort()).toEqual(["instagram", "twitter"]);
  });
  it("sorts by total mentions descending", () => {
    expect(aggregates[0].totalMentions).toBeGreaterThanOrEqual(aggregates[1].totalMentions);
  });
  it("returns empty for empty input", () => {
    expect(aggregateByTopic([])).toEqual([]);
  });
});

describe("trend-detector getLatestDate", () => {
  it("returns latest date", () => {
    const entries = parseTrends(SAMPLE_CSV).entries;
    expect(getLatestDate(entries)).toBe("2024-01-15");
  });
  it("returns null for empty input", () => {
    expect(getLatestDate([])).toBeNull();
  });
});

describe("trend-detector computeGrowthRate", () => {
  const entries = parseTrends(SAMPLE_CSV).entries;
  const lookback = 7;
  // latest = 2024-01-15
  // recent window: 2024-01-09..2024-01-15 (inclusive)
  // prior window: 2024-01-02..2024-01-08 (inclusive)
  it("computes growth for trending topic", () => {
    const g = computeGrowthRate(entries, "ai_art", lookback, "2024-01-15");
    // recent avg = (300+400+500+200+300+400)/6 = 350
    // prior avg = (100+120+150)/3 = 123.33
    expect(g.recentAvg).toBeCloseTo(350, 1);
    expect(g.priorAvg).toBeCloseTo(123.33, 1);
    expect(g.growthRate).toBeGreaterThan(100); // trending
    expect(g.type).toBe("trending");
    expect(g.hasData).toBe(true);
  });
  it("classifies stable topic", () => {
    const g = computeGrowthRate(entries, "vr_gaming", lookback, "2024-01-15");
    // recent: 60+65+70+80+90 = 365 / 5 = 73
    // prior: 50+55 = 105 / 2 = 52.5
    // growth = (73-52.5)/52.5 * 100 = ~39.05% — within default threshold of 50
    expect(g.type).toBe("stable");
  });
  it("classifies declining topic", () => {
    const g = computeGrowthRate(entries, "old_topic", lookback, "2024-01-15");
    expect(g.growthRate).toBeLessThan(0);
    expect(g.type).toBe("declining");
  });
  it("returns hasData=false for unknown topic", () => {
    const g = computeGrowthRate(entries, "nonexistent", lookback, "2024-01-15");
    expect(g.hasData).toBe(false);
    expect(g.growthRate).toBe(0);
  });
  it("returns growthRate=Infinity when prior=0 and recent>0", () => {
    const singleEntries: TrendInput[] = [
      { date: "2024-01-10", topic: "newtopic", platform: "twitter", mentionCount: 50, engagementCount: 100 },
      { date: "2024-01-15", topic: "newtopic", platform: "twitter", mentionCount: 80, engagementCount: 200 },
    ];
    const g = computeGrowthRate(singleEntries, "newtopic", 7, "2024-01-15");
    // recent window: 01-09..01-15 — both entries qualify → avg = (50+80)/2 = 65
    // prior window: 01-02..01-08 — no entries → 0
    expect(g.priorAvg).toBe(0);
    expect(g.recentAvg).toBe(65);
    expect(g.growthRate).toBe(Infinity);
    expect(g.type).toBe("trending");
  });
  it("returns growthRate=0 when both prior and recent are 0", () => {
    const zeroEntries: TrendInput[] = [
      { date: "2024-01-03", topic: "zero", platform: "twitter", mentionCount: 0, engagementCount: 0 },
      { date: "2024-01-12", topic: "zero", platform: "twitter", mentionCount: 0, engagementCount: 0 },
    ];
    const g = computeGrowthRate(zeroEntries, "zero", 7, "2024-01-15");
    expect(g.growthRate).toBe(0);
    expect(g.type).toBe("stable");
  });
});

describe("trend-detector classifyTrend", () => {
  it("returns trending for growth > threshold", () => {
    expect(classifyTrend(100, 50)).toBe("trending");
  });
  it("returns stable for growth within threshold", () => {
    expect(classifyTrend(30, 50)).toBe("stable");
    expect(classifyTrend(-30, 50)).toBe("stable");
    expect(classifyTrend(0, 50)).toBe("stable");
  });
  it("returns declining for growth < -threshold", () => {
    expect(classifyTrend(-100, 50)).toBe("declining");
  });
  it("classifies Infinity growth as trending", () => {
    expect(classifyTrend(Infinity, 50)).toBe("trending");
  });
  it("classifies -Infinity growth as declining", () => {
    expect(classifyTrend(-Infinity, 50)).toBe("declining");
  });
});

describe("trend-detector computeAllGrowthRates", () => {
  const entries = parseTrends(SAMPLE_CSV).entries;
  const all = computeAllGrowthRates(entries, 7);
  it("returns one analysis per topic", () => {
    expect(all).toHaveLength(3);
  });
  it("sorts by growth rate descending (Infinity first)", () => {
    for (let i = 1; i < all.length; i++) {
      const prev = Number.isFinite(all[i - 1].growthRate) ? all[i - 1].growthRate : Number.MAX_SAFE_INTEGER;
      const curr = Number.isFinite(all[i].growthRate) ? all[i].growthRate : Number.MAX_SAFE_INTEGER;
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });
  it("returns empty for empty input", () => {
    expect(computeAllGrowthRates([], 7)).toEqual([]);
  });
});

describe("trend-detector computeVelocity", () => {
  const entries = parseTrends(SAMPLE_CSV).entries;
  it("returns velocity analysis for known topic", () => {
    const v = computeVelocity(entries, "ai_art", 7);
    expect(v).toBeDefined();
    expect(["accelerating", "decelerating", "steady"]).toContain(v.direction);
  });
  it("returns steady for empty entries", () => {
    const v = computeVelocity([], "anything", 7);
    expect(v.direction).toBe("steady");
    expect(v.velocity).toBe(0);
  });
  it("detects accelerating growth", () => {
    // Build a topic where mentions are doubling in the second half of the recent window
    const accel: TrendInput[] = [
      { date: "2024-01-09", topic: "boom", platform: "twitter", mentionCount: 10, engagementCount: 10 },
      { date: "2024-01-11", topic: "boom", platform: "twitter", mentionCount: 12, engagementCount: 12 },
      { date: "2024-01-13", topic: "boom", platform: "twitter", mentionCount: 50, engagementCount: 50 },
      { date: "2024-01-15", topic: "boom", platform: "twitter", mentionCount: 100, engagementCount: 100 },
    ];
    const v = computeVelocity(accel, "boom", 7);
    expect(v.direction).toBe("accelerating");
    expect(v.velocity).toBeGreaterThan(0);
  });
  it("detects decelerating decline", () => {
    // Mentions dropping fast in recent half
    const decl: TrendInput[] = [
      { date: "2024-01-09", topic: "drop", platform: "twitter", mentionCount: 100, engagementCount: 100 },
      { date: "2024-01-11", topic: "drop", platform: "twitter", mentionCount: 80, engagementCount: 80 },
      { date: "2024-01-13", topic: "drop", platform: "twitter", mentionCount: 20, engagementCount: 20 },
      { date: "2024-01-15", topic: "drop", platform: "twitter", mentionCount: 5, engagementCount: 5 },
    ];
    const v = computeVelocity(decl, "drop", 7);
    expect(v.direction).toBe("decelerating");
    expect(v.velocity).toBeLessThan(0);
  });
});

describe("trend-detector predictLifecycle", () => {
  it("returns early for low mentions + positive growth", () => {
    expect(predictLifecycle(100, 100)).toBe("early");
    expect(predictLifecycle(Infinity, 10)).toBe("early");
  });
  it("returns late for high mentions + low growth", () => {
    expect(predictLifecycle(10, LIFECYCLE_HIGH_MENTIONS)).toBe("late");
    expect(predictLifecycle(-50, LIFECYCLE_HIGH_MENTIONS)).toBe("late");
  });
  it("returns late for high mentions + declining", () => {
    expect(predictLifecycle(-100, 10000)).toBe("late");
  });
  it("returns mid for medium mentions + moderate growth", () => {
    expect(predictLifecycle(50, 1000)).toBe("mid");
  });
  it("returns mid for high mentions + high growth", () => {
    expect(predictLifecycle(100, LIFECYCLE_HIGH_MENTIONS)).toBe("mid");
  });
});

describe("trend-detector scoreOpportunity", () => {
  it("returns 0 for non-positive growth", () => {
    expect(scoreOpportunity(-10, 100)).toBe(0);
    expect(scoreOpportunity(0, 100)).toBe(0);
  });
  it("scores between 0 and 100", () => {
    for (const g of [10, 50, 100, 200, 500, Infinity]) {
      for (const m of [0, 100, 1000, 10000, 100000]) {
        const score = scoreOpportunity(g, m);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    }
  });
  it("rewards high growth + low mentions", () => {
    const highOpp = scoreOpportunity(200, 100);
    const lowOpp = scoreOpportunity(200, 10000);
    expect(highOpp).toBeGreaterThan(lowOpp);
  });
  it("rewards growth rate up to cap", () => {
    const low = scoreOpportunity(50, 100);
    const high = scoreOpportunity(150, 100);
    expect(high).toBeGreaterThan(low);
  });
});

describe("trend-detector aggregateByPlatform", () => {
  const entries = parseTrends(SAMPLE_CSV).entries;
  const byPlatform = aggregateByPlatform(entries, 7, 50);
  it("returns one group per platform present", () => {
    expect(byPlatform).toHaveLength(3); // twitter, instagram, tiktok
  });
  it("computes trending count per platform", () => {
    const twitter = byPlatform.find((p) => p.platform === "twitter");
    expect(twitter!.trendingCount).toBeGreaterThanOrEqual(1);
    expect(twitter!.decliningCount).toBeGreaterThanOrEqual(1);
  });
  it("sorts by trending count descending", () => {
    for (let i = 1; i < byPlatform.length; i++) {
      expect(byPlatform[i - 1].trendingCount).toBeGreaterThanOrEqual(byPlatform[i].trendingCount);
    }
  });
});

describe("trend-detector rankTrends", () => {
  const entries = parseTrends(SAMPLE_CSV).entries;
  it("ranks by growth rate descending", () => {
    const ranked = rankTrends(entries, "growth_rate", 7, 50);
    expect(ranked).toHaveLength(3);
    expect(ranked[0].rank).toBe(1);
    // First should be trending (highest growth)
    expect(ranked[0].type).toBe("trending");
  });
  it("ranks by mentions descending", () => {
    const ranked = rankTrends(entries, "mentions", 7, 50);
    expect(ranked[0].totalMentions).toBeGreaterThanOrEqual(ranked[1].totalMentions);
  });
  it("ranks by engagement descending", () => {
    const ranked = rankTrends(entries, "engagement", 7, 50);
    expect(ranked[0].totalEngagement).toBeGreaterThanOrEqual(ranked[1].totalEngagement);
  });
  it("enriches with lifecycle + opportunity + velocity", () => {
    const ranked = rankTrends(entries, "growth_rate", 7, 50);
    for (const t of ranked) {
      expect(["early", "mid", "late"]).toContain(t.lifecycle);
      expect(t.opportunityScore).toBeGreaterThanOrEqual(0);
      expect(t.opportunityScore).toBeLessThanOrEqual(100);
      expect(["accelerating", "decelerating", "steady"]).toContain(t.velocityDirection);
    }
  });
  it("assigns sequential ranks", () => {
    const ranked = rankTrends(entries, "growth_rate", 7, 50);
    for (let i = 0; i < ranked.length; i++) {
      expect(ranked[i].rank).toBe(i + 1);
    }
  });
  it("handles empty input", () => {
    expect(rankTrends([], "growth_rate", 7, 50)).toEqual([]);
  });
});

describe("trend-detector findEmergingTrends", () => {
  const entries = parseTrends(SAMPLE_CSV).entries;
  it("returns trending topics with low mentions", () => {
    const emerging = findEmergingTrends(entries, 7, 50);
    for (const t of emerging) {
      expect(t.type).toBe("trending");
      expect(t.totalMentions).toBeLessThan(LIFECYCLE_HIGH_MENTIONS);
    }
  });
  it("includes ai_art (high growth, moderate mentions)", () => {
    const emerging = findEmergingTrends(entries, 7, 50);
    expect(emerging.some((t) => t.topic === "ai_art")).toBe(true);
  });
});

describe("trend-detector findSustainedTrends", () => {
  const entries = parseTrends(SAMPLE_CSV).entries;
  it("returns topics with high mentions and trending/stable", () => {
    const sustained = findSustainedTrends(entries, 7, 50);
    for (const t of sustained) {
      expect(t.totalMentions).toBeGreaterThanOrEqual(LIFECYCLE_HIGH_MENTIONS);
      expect(t.type === "trending" || t.type === "stable").toBe(true);
    }
  });
  it("excludes declining topics", () => {
    const sustained = findSustainedTrends(entries, 7, 50);
    expect(sustained.every((t) => t.type !== "declining")).toBe(true);
  });
});

describe("trend-detector findDecliningTrends", () => {
  const entries = parseTrends(SAMPLE_CSV).entries;
  it("returns only declining topics", () => {
    const declining = findDecliningTrends(entries, 7, 50);
    expect(declining.length).toBeGreaterThanOrEqual(1);
    for (const t of declining) {
      expect(t.type).toBe("declining");
      expect(t.growthRate).toBeLessThan(0);
    }
  });
  it("includes old_topic (clearly declining)", () => {
    const declining = findDecliningTrends(entries, 7, 50);
    expect(declining.some((t) => t.topic === "old_topic")).toBe(true);
  });
});

describe("trend-detector findCrossPlatformTrends", () => {
  const entries = parseTrends(SAMPLE_CSV).entries;
  it("returns topics trending on multiple platforms", () => {
    const cross = findCrossPlatformTrends(entries, 7, 50);
    expect(cross.length).toBeGreaterThan(0);
    for (const c of cross) {
      expect(c.platforms.length).toBeGreaterThanOrEqual(2);
    }
  });
  it("includes ai_art (twitter + instagram)", () => {
    const cross = findCrossPlatformTrends(entries, 7, 50);
    const ai = cross.find((c) => c.topic === "ai_art");
    expect(ai).toBeDefined();
    expect(ai!.platforms.sort()).toEqual(["instagram", "twitter"]);
  });
  it("sorts by trendingOn descending", () => {
    const cross = findCrossPlatformTrends(entries, 7, 50);
    for (let i = 1; i < cross.length; i++) {
      expect(cross[i - 1].trendingOn).toBeGreaterThanOrEqual(cross[i].trendingOn);
    }
  });
});

describe("trend-detector recommendBestTime", () => {
  it("recommends 'now' for early stage", () => {
    const rec = recommendBestTime("ai_art", "early");
    expect(rec.urgency).toBe("now");
    expect(rec.recommendation.length).toBeGreaterThan(0);
  });
  it("recommends 'soon' for mid stage", () => {
    const rec = recommendBestTime("topic", "mid");
    expect(rec.urgency).toBe("soon");
  });
  it("recommends 'later' for late stage", () => {
    const rec = recommendBestTime("topic", "late");
    expect(rec.urgency).toBe("later");
  });
});

describe("trend-detector computeSummary", () => {
  const entries = parseTrends(SAMPLE_CSV).entries;
  const summary = computeSummary(entries, 7, 50);
  it("computes total topics", () => {
    expect(summary.totalTopics).toBe(3);
  });
  it("computes total data points", () => {
    expect(summary.totalDataPoints).toBe(21);
  });
  it("computes trending + stable + declining counts", () => {
    expect(summary.trendingCount + summary.stableCount + summary.decliningCount).toBe(3);
    expect(summary.trendingCount).toBeGreaterThanOrEqual(1);
    expect(summary.decliningCount).toBeGreaterThanOrEqual(1);
  });
  it("computes avg growth rate (finite only)", () => {
    expect(Number.isFinite(summary.avgGrowthRate)).toBe(true);
  });
  it("has byPlatform array", () => {
    expect(summary.byPlatform.length).toBeGreaterThanOrEqual(1);
  });
  it("returns zero stats for empty input", () => {
    const s = computeSummary([], 7, 50);
    expect(s.totalTopics).toBe(0);
    expect(s.totalDataPoints).toBe(0);
    expect(s.trendingCount).toBe(0);
  });
});

describe("trend-detector renderText", () => {
  const entries = parseTrends(SAMPLE_CSV).entries;
  it("renders non-empty report", () => {
    const text = renderText(entries, "growth_rate", 7, 50);
    expect(text).toContain("=== Social Media Trend Detector Report ===");
    expect(text).toContain("--- Summary ---");
    expect(text).toContain("--- By Platform ---");
    expect(text).toContain("Top 10 trends");
    expect(text).toContain("Emerging trends");
    expect(text).toContain("Sustained trends");
    expect(text).toContain("Declining trends");
    expect(text).toContain("Cross-platform trends");
    expect(text).toContain("Best time to leverage");
  });
  it("returns 'No trend data' for empty input", () => {
    expect(renderText([], "growth_rate", 7, 50)).toBe("No trend data to report.");
  });
  it("includes metric name in header", () => {
    const text = renderText(entries, "mentions", 7, 50);
    expect(text).toContain("Total Mentions");
  });
  it("includes lookback and threshold info", () => {
    const text = renderText(entries, "growth_rate", 14, 30);
    expect(text).toContain("Lookback: 14 days");
    expect(text).toContain("Growth threshold: 30%");
  });
});

describe("trend-detector renderCsv", () => {
  const entries = parseTrends(SAMPLE_CSV).entries;
  it("renders header", () => {
    const csv = renderCsv([], "growth_rate", 7, 50);
    expect(csv).toContain("topic,total_mentions,total_engagement,recent_avg,prior_avg,growth_rate_percent,trend_type,lifecycle,opportunity_score,velocity,velocity_direction,platforms,rank");
  });
  it("renders entry rows", () => {
    const csv = renderCsv(entries, "growth_rate", 7, 50);
    expect(csv.split("\n").length).toBe(4); // header + 3 topics
  });
  it("includes rank 1 in first row", () => {
    const csv = renderCsv(entries, "growth_rate", 7, 50);
    const lines = csv.split("\n");
    expect(lines[1]).toContain(",1");
  });
  it("escapes topics with commas", () => {
    const entries: TrendInput[] = [
      { date: "2024-01-01", topic: "ai,art", platform: "twitter", mentionCount: 100, engagementCount: 500 },
      { date: "2024-01-15", topic: "ai,art", platform: "twitter", mentionCount: 200, engagementCount: 1000 },
    ];
    const csv = renderCsv(entries, "growth_rate", 7, 50);
    expect(csv).toContain('"ai,art"');
  });
});

describe("trend-detector history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      dataPointCount: 20,
      topicCount: 3,
      trendingCount: 1,
      decliningCount: 1,
      avgGrowthRate: 50.5,
      preview: "ai_art",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, dataPointCount: 1, topicCount: 1, trendingCount: 0, decliningCount: 0, avgGrowthRate: 0, preview: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, dataPointCount: 1, topicCount: 1, trendingCount: 0, decliningCount: 0, avgGrowthRate: 0, preview: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("puts newest first", () => {
    saveHistory({ ts: 1, dataPointCount: 1, topicCount: 1, trendingCount: 0, decliningCount: 0, avgGrowthRate: 0, preview: "old" });
    saveHistory({ ts: 2, dataPointCount: 2, topicCount: 2, trendingCount: 1, decliningCount: 0, avgGrowthRate: 10, preview: "new" });
    const h = loadHistory();
    expect(h[0].preview).toBe("new");
    expect(h[1].preview).toBe("old");
  });
});

describe("trend-detector shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      data: "2024-01-01,ai,twitter,100,500",
      dateStart: "2024-01-01",
      dateEnd: "2024-02-01",
      platform: "twitter",
      trendThreshold: "200",
      growthThreshold: "75",
      lookbackDays: "14",
      metric: "mentions",
    });
    expect(url).toContain("data=2024-01-01");
    expect(url).toContain("start=2024-01-01");
    expect(url).toContain("platform=twitter");
    expect(url).toContain("tth=200");
    expect(url).toContain("gth=75");
    expect(url).toContain("lb=14");
    expect(url).toContain("metric=mentions");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("data=2024-01-01&platform=twitter&tth=200&gth=75&lb=14&metric=mentions");
    expect(p.data).toBe("2024-01-01");
    expect(p.platform).toBe("twitter");
    expect(p.trendThreshold).toBe("200");
    expect(p.growthThreshold).toBe("75");
    expect(p.lookbackDays).toBe("14");
    expect(p.metric).toBe("mentions");
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.data).toBe("");
    expect(p.platform).toBe("all");
    expect(p.trendThreshold).toBe(String(DEFAULT_TREND_THRESHOLD));
    expect(p.growthThreshold).toBe(String(DEFAULT_GROWTH_THRESHOLD));
    expect(p.lookbackDays).toBe(String(DEFAULT_LOOKBACK_DAYS));
    expect(p.metric).toBe("growth_rate");
  });
  it("filters unknown platform", () => {
    const p = parseShareUrl("platform=mastodon");
    expect(p.platform).toBe("all");
  });
  it("filters unknown metric", () => {
    const p = parseShareUrl("metric=unknown");
    expect(p.metric).toBe("growth_rate");
  });
  it("omits default values when building", () => {
    const url = buildShareUrl({
      data: "",
      dateStart: "",
      dateEnd: "",
      platform: "all",
      trendThreshold: String(DEFAULT_TREND_THRESHOLD),
      growthThreshold: String(DEFAULT_GROWTH_THRESHOLD),
      lookbackDays: String(DEFAULT_LOOKBACK_DAYS),
      metric: "growth_rate",
    });
    expect(url).not.toContain("platform=");
    expect(url).not.toContain("tth=");
    expect(url).not.toContain("gth=");
    expect(url).not.toContain("lb=");
    expect(url).not.toContain("metric=");
  });
});

// Suppress unused-import lint
export type _Unused = Platform | RankMetric | TrendInput | TrendType;

import { describe, it, expect, beforeEach } from "vitest";
import {
  PLATFORMS,
  PLATFORM_LABELS,
  RANK_METRICS,
  RANK_METRIC_LABELS,
  PLATFORM_BENCHMARKS,
  splitCsvRow,
  parsePostLine,
  parsePosts,
  computeEngagementRate,
  computeTotalEngagement,
  filterByDateRange,
  filterByPlatform,
  rankPosts,
  aggregateByPlatform,
  computeSummary,
  analyzeTrend,
  findBestAndWorst,
  computePostingFrequency,
  daysBetween,
  suggestBestTimeSlot,
  predictGrowth,
  compareBenchmark,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Platform,
  type RankMetric,
  type PostInput,
  type HistoryEntry,
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

const SAMPLE_CSV = `date,platform,post_url,likes,comments,shares,saves,impressions
2024-01-01,twitter,https://twitter.com/x/status/1,100,10,5,3,5000
2024-01-05,instagram,https://instagram.com/p/abc,500,40,20,80,8000
2024-01-10,facebook,https://facebook.com/post/1,80,5,2,1,2000
2024-01-15,twitter,https://twitter.com/x/status/2,200,20,10,8,9000
2024-01-20,linkedin,https://linkedin.com/posts/1,150,30,15,40,4000
2024-01-25,tiktok,https://tiktok.com/@x/video/1,2000,150,300,500,50000
2024-02-01,youtube,https://youtube.com/watch?v=1,800,60,40,100,15000
2024-02-05,instagram,https://instagram.com/p/def,700,55,30,120,12000`;

describe("engagement-tracker constants", () => {
  it("has 6 platforms", () => {
    expect(PLATFORMS).toHaveLength(6);
    expect(PLATFORMS).toContain("twitter");
    expect(PLATFORMS).toContain("youtube");
  });
  it("has 6 platform labels", () => {
    expect(Object.keys(PLATFORM_LABELS)).toHaveLength(6);
  });
  it("has 5 rank metrics", () => {
    expect(RANK_METRICS).toHaveLength(5);
    expect(RANK_METRICS).toContain("engagement-rate");
  });
  it("has 5 metric labels", () => {
    expect(Object.keys(RANK_METRIC_LABELS)).toHaveLength(5);
  });
  it("has benchmarks for every platform", () => {
    for (const p of PLATFORMS) {
      expect(PLATFORM_BENCHMARKS[p]).toBeGreaterThan(0);
    }
    expect(PLATFORM_BENCHMARKS.tiktok).toBeGreaterThan(PLATFORM_BENCHMARKS.twitter);
  });
});

describe("engagement-tracker splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
  it("handles escaped quotes", () => { expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]); });
});

describe("engagement-tracker parsePostLine", () => {
  it("parses a valid line", () => {
    const { post, error } = parsePostLine("2024-01-01,twitter,https://x.com,100,10,5,3,5000", 1);
    expect(error).toBeNull();
    expect(post).not.toBeNull();
    expect(post!.platform).toBe("twitter");
    expect(post!.likes).toBe(100);
  });
  it("rejects bad date", () => {
    const { error } = parsePostLine("01-01-2024,twitter,https://x.com,100,10,5,3,5000", 1);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("date");
  });
  it("rejects unknown platform", () => {
    const { error } = parsePostLine("2024-01-01,mastodon,https://x.com,100,10,5,3,5000", 1);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("platform");
  });
  it("rejects negative likes", () => {
    const { error } = parsePostLine("2024-01-01,twitter,https://x.com,-5,10,5,3,5000", 1);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("likes");
  });
  it("rejects non-numeric impressions", () => {
    const { error } = parsePostLine("2024-01-01,twitter,https://x.com,100,10,5,3,abc", 1);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("impressions");
  });
  it("rejects too few fields", () => {
    const { error } = parsePostLine("2024-01-01,twitter,https://x.com,100,10", 1);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("8 fields");
  });
  it("returns null post + null error for blank line", () => {
    const { post, error } = parsePostLine("   ", 1);
    expect(post).toBeNull();
    expect(error).toBeNull();
  });
});

describe("engagement-tracker parsePosts", () => {
  it("parses sample CSV skipping header", () => {
    const { posts, errors } = parsePosts(SAMPLE_CSV);
    expect(posts).toHaveLength(8);
    expect(errors).toHaveLength(0);
  });
  it("handles blank lines", () => {
    const { posts } = parsePosts(SAMPLE_CSV + "\n\n\n");
    expect(posts).toHaveLength(8);
  });
  it("handles input without header", () => {
    const { posts } = parsePosts("2024-01-01,twitter,https://x.com,100,10,5,3,5000");
    expect(posts).toHaveLength(1);
  });
  it("collects errors but keeps valid posts", () => {
    const csv = `2024-01-01,twitter,https://x.com,100,10,5,3,5000
bad-date,twitter,https://x.com,100,10,5,3,5000
2024-02-01,instagram,https://x.com,200,20,10,5,8000`;
    const { posts, errors } = parsePosts(csv);
    expect(posts).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(2);
  });
  it("returns empty for empty input", () => {
    const { posts, errors } = parsePosts("");
    expect(posts).toEqual([]);
    expect(errors).toEqual([]);
  });
});

describe("engagement-tracker computeEngagementRate", () => {
  it("computes percent", () => {
    const rate = computeEngagementRate({ likes: 100, comments: 50, shares: 25, saves: 25, impressions: 10000 });
    expect(rate).toBeCloseTo(2.0, 5);
  });
  it("returns 0 when impressions is 0", () => {
    expect(computeEngagementRate({ likes: 10, comments: 0, shares: 0, saves: 0, impressions: 0 })).toBe(0);
  });
});

describe("engagement-tracker computeTotalEngagement", () => {
  it("sums all engagement", () => {
    expect(computeTotalEngagement({ likes: 100, comments: 50, shares: 25, saves: 25 })).toBe(200);
  });
});

describe("engagement-tracker filterByDateRange", () => {
  const posts = parsePosts(SAMPLE_CSV).posts;
  it("filters by start", () => {
    const f = filterByDateRange(posts, "2024-01-15");
    expect(f.length).toBe(5);
  });
  it("filters by end", () => {
    const f = filterByDateRange(posts, undefined, "2024-01-10");
    expect(f.length).toBe(3);
  });
  it("filters by both", () => {
    const f = filterByDateRange(posts, "2024-01-05", "2024-01-20");
    expect(f.length).toBe(4);
  });
  it("returns all when no filter", () => {
    expect(filterByDateRange(posts)).toHaveLength(8);
  });
});

describe("engagement-tracker filterByPlatform", () => {
  const posts = parsePosts(SAMPLE_CSV).posts;
  it("returns all for 'all'", () => {
    expect(filterByPlatform(posts, "all")).toHaveLength(8);
  });
  it("filters by single platform", () => {
    expect(filterByPlatform(posts, "twitter")).toHaveLength(2);
    expect(filterByPlatform(posts, "instagram")).toHaveLength(2);
  });
});

describe("engagement-tracker rankPosts", () => {
  const posts = parsePosts(SAMPLE_CSV).posts;
  it("ranks by engagement-rate descending", () => {
    const ranked = rankPosts(posts, "engagement-rate");
    expect(ranked).toHaveLength(8);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].engagementRate).toBeGreaterThanOrEqual(ranked[1].engagementRate);
  });
  it("ranks by total-engagement", () => {
    const ranked = rankPosts(posts, "total-engagement");
    expect(ranked[0].totalEngagement).toBeGreaterThanOrEqual(ranked[1].totalEngagement);
  });
  it("ranks by impressions", () => {
    const ranked = rankPosts(posts, "impressions");
    expect(ranked[0].impressions).toBeGreaterThanOrEqual(ranked[1].impressions);
  });
  it("ranks by likes", () => {
    const ranked = rankPosts(posts, "likes");
    expect(ranked[0].likes).toBeGreaterThanOrEqual(ranked[1].likes);
  });
  it("assigns sequential ranks", () => {
    const ranked = rankPosts(posts, "comments");
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it("computes engagementRate + totalEngagement fields", () => {
    const ranked = rankPosts(posts, "engagement-rate");
    expect(ranked[0]).toHaveProperty("engagementRate");
    expect(ranked[0]).toHaveProperty("totalEngagement");
  });
  it("handles empty input", () => {
    expect(rankPosts([], "engagement-rate")).toEqual([]);
  });
});

describe("engagement-tracker aggregateByPlatform", () => {
  const posts = parsePosts(SAMPLE_CSV).posts;
  it("aggregates by platform", () => {
    const agg = aggregateByPlatform(posts);
    expect(agg.length).toBe(6);
    const twitter = agg.find((a) => a.platform === "twitter")!;
    expect(twitter.postCount).toBe(2);
    expect(twitter.totalLikes).toBe(300);
  });
  it("sorts by total engagement descending", () => {
    const agg = aggregateByPlatform(posts);
    for (let i = 1; i < agg.length; i++) {
      expect(agg[i - 1].totalEngagement).toBeGreaterThanOrEqual(agg[i].totalEngagement);
    }
  });
  it("computes avg engagement rate", () => {
    const agg = aggregateByPlatform(posts);
    expect(agg[0].avgEngagementRate).toBeGreaterThan(0);
  });
});

describe("engagement-tracker computeSummary", () => {
  const posts = parsePosts(SAMPLE_CSV).posts;
  it("computes totals", () => {
    const s = computeSummary(posts);
    expect(s.totalPosts).toBe(8);
    expect(s.totalEngagement).toBeGreaterThan(0);
    expect(s.totalImpressions).toBeGreaterThan(0);
    expect(s.avgEngagementRate).toBeGreaterThan(0);
    expect(s.byPlatform.length).toBe(6);
  });
  it("returns zeros for empty", () => {
    const s = computeSummary([]);
    expect(s.totalPosts).toBe(0);
    expect(s.totalEngagement).toBe(0);
    expect(s.byPlatform).toEqual([]);
  });
});

describe("engagement-tracker analyzeTrend", () => {
  it("returns null for fewer than 2 posts", () => {
    expect(analyzeTrend([])).toBeNull();
    expect(analyzeTrend([parsePosts(SAMPLE_CSV).posts[0]])).toBeNull();
  });
  it("returns trend for valid input", () => {
    const posts = parsePosts(SAMPLE_CSV).posts;
    const t = analyzeTrend(posts);
    expect(t).not.toBeNull();
    expect(["improving", "declining", "flat"]).toContain(t!.direction);
    expect(typeof t!.firstHalfAvgRate).toBe("number");
    expect(typeof t!.secondHalfAvgRate).toBe("number");
  });
  it("detects improving trend", () => {
    const posts: PostInput[] = [
      { date: "2024-01-01", platform: "twitter", postUrl: "", likes: 10, comments: 0, shares: 0, saves: 0, impressions: 10000 },
      { date: "2024-01-02", platform: "twitter", postUrl: "", likes: 10, comments: 0, shares: 0, saves: 0, impressions: 10000 },
      { date: "2024-02-01", platform: "twitter", postUrl: "", likes: 500, comments: 100, shares: 50, saves: 50, impressions: 10000 },
      { date: "2024-02-02", platform: "twitter", postUrl: "", likes: 600, comments: 100, shares: 50, saves: 50, impressions: 10000 },
    ];
    const t = analyzeTrend(posts);
    expect(t!.direction).toBe("improving");
    expect(t!.deltaPp).toBeGreaterThan(0);
  });
  it("detects declining trend", () => {
    const posts: PostInput[] = [
      { date: "2024-01-01", platform: "twitter", postUrl: "", likes: 500, comments: 100, shares: 50, saves: 50, impressions: 10000 },
      { date: "2024-01-02", platform: "twitter", postUrl: "", likes: 600, comments: 100, shares: 50, saves: 50, impressions: 10000 },
      { date: "2024-02-01", platform: "twitter", postUrl: "", likes: 10, comments: 0, shares: 0, saves: 0, impressions: 10000 },
      { date: "2024-02-02", platform: "twitter", postUrl: "", likes: 10, comments: 0, shares: 0, saves: 0, impressions: 10000 },
    ];
    const t = analyzeTrend(posts);
    expect(t!.direction).toBe("declining");
    expect(t!.deltaPp).toBeLessThan(0);
  });
});

describe("engagement-tracker findBestAndWorst", () => {
  it("returns nulls for empty", () => {
    const r = findBestAndWorst([]);
    expect(r.best).toBeNull();
    expect(r.worst).toBeNull();
  });
  it("finds best and worst by engagement rate", () => {
    const posts = parsePosts(SAMPLE_CSV).posts;
    const r = findBestAndWorst(posts);
    expect(r.best).not.toBeNull();
    expect(r.worst).not.toBeNull();
    expect(r.best!.engagementRate).toBeGreaterThanOrEqual(r.worst!.engagementRate);
  });
});

describe("engagement-tracker computePostingFrequency", () => {
  it("handles empty", () => {
    const f = computePostingFrequency([]);
    expect(f.postsPerWeek).toBe(0);
    expect(f.posts).toBe(0);
  });
  it("computes posts per week", () => {
    const posts = parsePosts(SAMPLE_CSV).posts;
    const f = computePostingFrequency(posts);
    expect(f.posts).toBe(8);
    expect(f.postsPerWeek).toBeGreaterThan(0);
    expect(f.uniqueDays).toBe(8);
  });
});

describe("engagement-tracker daysBetween", () => {
  it("computes days", () => {
    expect(daysBetween("2024-01-01", "2024-01-08")).toBe(7);
  });
  it("handles same day", () => {
    expect(daysBetween("2024-01-01", "2024-01-01")).toBe(0);
  });
  it("returns 0 for invalid dates", () => {
    expect(daysBetween("bad", "2024-01-01")).toBe(0);
  });
});

describe("engagement-tracker suggestBestTimeSlot", () => {
  it("returns null for empty", () => {
    expect(suggestBestTimeSlot([])).toBeNull();
  });
  it("returns a day slot", () => {
    const posts = parsePosts(SAMPLE_CSV).posts;
    const slot = suggestBestTimeSlot(posts);
    expect(slot).not.toBeNull();
    expect(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]).toContain(slot!.slot);
    expect(slot!.avgEngagementRate).toBeGreaterThan(0);
  });
});

describe("engagement-tracker predictGrowth", () => {
  it("returns null for empty", () => {
    expect(predictGrowth([])).toBeNull();
  });
  it("returns a prediction", () => {
    const posts = parsePosts(SAMPLE_CSV).posts;
    const g = predictGrowth(posts);
    expect(g).not.toBeNull();
    expect(["improving", "declining", "flat"]).toContain(g!.trend);
    expect(["low", "medium", "high"]).toContain(g!.confidence);
    expect(g!.projectedRateNextPeriod).toBeGreaterThanOrEqual(0);
  });
});

describe("engagement-tracker compareBenchmark", () => {
  it("detects above benchmark", () => {
    const r = compareBenchmark("tiktok", 10);
    expect(r.status).toBe("above");
    expect(r.deltaPp).toBeGreaterThan(0);
  });
  it("detects below benchmark", () => {
    const r = compareBenchmark("tiktok", 0.1);
    expect(r.status).toBe("below");
  });
  it("detects on-par", () => {
    const r = compareBenchmark("twitter", PLATFORM_BENCHMARKS.twitter);
    expect(r.status).toBe("on-par");
  });
});

describe("engagement-tracker renderText", () => {
  it("renders report for posts", () => {
    const posts = parsePosts(SAMPLE_CSV).posts;
    const txt = renderText(posts, "engagement-rate");
    expect(txt).toContain("Social Media Engagement Report");
    expect(txt).toContain("Summary");
    expect(txt).toContain("Total posts: 8");
    expect(txt).toContain("By Platform");
    expect(txt).toContain("Top 5 posts");
    expect(txt).toContain("Bottom 3 posts");
  });
  it("renders empty message for no posts", () => {
    expect(renderText([], "engagement-rate")).toBe("No posts to report.");
  });
});

describe("engagement-tracker renderCsv", () => {
  it("renders header", () => {
    const csv = renderCsv([], "engagement-rate");
    expect(csv).toContain("date,platform,post_url,likes,comments,shares,saves,impressions,total_engagement,engagement_rate_percent,rank");
  });
  it("renders post rows", () => {
    const posts = parsePosts(SAMPLE_CSV).posts;
    const csv = renderCsv(posts, "engagement-rate");
    const lines = csv.split("\n");
    expect(lines.length).toBe(9); // header + 8 posts
    expect(csv).toContain("twitter");
    expect(csv).toContain("instagram");
  });
});

describe("engagement-tracker history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, postCount: 8, platformCount: 6, avgEngagementRate: 2.5, preview: "twitter" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, postCount: 1, platformCount: 1, avgEngagementRate: 1, preview: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, postCount: 1, platformCount: 1, avgEngagementRate: 1, preview: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("engagement-tracker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ posts: "csv,data", dateStart: "2024-01-01", dateEnd: "", platform: "twitter", metric: "likes" });
    expect(url).toContain("posts=csv%2Cdata");
    expect(url).toContain("start=2024-01-01");
    expect(url).toContain("platform=twitter");
    expect(url).toContain("metric=likes");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("omits default values from share URL", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ posts: "", dateStart: "", dateEnd: "", platform: "all", metric: "engagement-rate" });
    expect(url).toBe("?"); // empty params string
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("posts=csv%2Cdata&start=2024-01-01&platform=twitter&metric=likes");
    expect(p.posts).toBe("csv,data");
    expect(p.dateStart).toBe("2024-01-01");
    expect(p.platform).toBe("twitter");
    expect(p.metric).toBe("likes");
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.posts).toBe("");
    expect(p.platform).toBe("all");
    expect(p.metric).toBe("engagement-rate");
  });
  it("filters invalid platform", () => {
    const p = parseShareUrl("platform=mastodon");
    expect(p.platform).toBe("all");
  });
  it("filters invalid metric", () => {
    const p = parseShareUrl("metric=invalid");
    expect(p.metric).toBe("engagement-rate");
  });
});

// Suppress unused-import lint
export type _Unused = Platform | RankMetric | HistoryEntry;

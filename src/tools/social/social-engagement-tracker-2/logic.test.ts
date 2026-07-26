import { describe, it, expect } from "vitest";
import {
  getBenchmarkById,
  getAllBenchmarks,
  createPost,
  engagementRateByFollowers,
  engagementRateByReach,
  amplificationRate,
  conversationRate,
  saveRate,
  classifyEngagement,
  aggregateStats,
  forecastEngagement,
  validatePost,
  exportPostsCSV,
  movingAverage,
  compareToBenchmark,
  topPosts,
  bestPostingHour,
  buildSummary,
  BENCHMARKS,
  type EngagementPost,
} from "./logic";

function samplePost(overrides: Partial<EngagementPost> = {}): EngagementPost {
  return { ...createPost("instagram", 100, 20, 10, 5, 10000, 20000, Date.now()), ...overrides };
}

describe("social-engagement-tracker getBenchmarkById", () => {
  it("finds instagram benchmark", () => {
    expect(getBenchmarkById("instagram")?.avgEngagementRate).toBeGreaterThan(0);
  });
  it("returns null for unknown", () => {
    expect(getBenchmarkById("nope")).toBeNull();
  });
  it("returns at least 5 benchmarks", () => {
    expect(getAllBenchmarks().length).toBeGreaterThanOrEqual(5);
  });
});

describe("social-engagement-tracker createPost", () => {
  it("creates post with positive values", () => {
    const p = createPost("twitter", 50, 10, 5, 0, 5000, 8000);
    expect(p.likes).toBe(50);
    expect(p.followers).toBe(5000);
  });
  it("clamps negatives to zero", () => {
    const p = createPost("twitter", -10, -5, -2, -1, 5000, 8000);
    expect(p.likes).toBe(0);
    expect(p.comments).toBe(0);
  });
});

describe("social-engagement-tracker engagementRateByFollowers", () => {
  it("computes ER as percentage of followers", () => {
    const p = createPost("x", 50, 30, 20, 0, 10000, 0);
    // 100 / 10000 * 100 = 1%
    expect(engagementRateByFollowers(p)).toBe(1);
  });
  it("returns 0 for zero followers", () => {
    const p = createPost("x", 50, 0, 0, 0, 0, 0);
    expect(engagementRateByFollowers(p)).toBe(0);
  });
});

describe("social-engagement-tracker engagementRateByReach", () => {
  it("computes ERR as percentage of impressions", () => {
    const p = createPost("x", 50, 30, 20, 0, 0, 10000);
    // 100 / 10000 * 100 = 1%
    expect(engagementRateByReach(p)).toBe(1);
  });
  it("returns 0 for zero impressions", () => {
    const p = createPost("x", 50, 0, 0, 0, 0, 0);
    expect(engagementRateByReach(p)).toBe(0);
  });
});

describe("social-engagement-tracker amplificationRate", () => {
  it("computes shares / impressions", () => {
    const p = createPost("x", 0, 0, 50, 0, 0, 10000);
    expect(amplificationRate(p)).toBe(0.5);
  });
});

describe("social-engagement-tracker conversationRate", () => {
  it("computes comments / followers", () => {
    const p = createPost("x", 0, 100, 0, 0, 10000, 0);
    expect(conversationRate(p)).toBe(1);
  });
});

describe("social-engagement-tracker saveRate", () => {
  it("computes saves / impressions", () => {
    const p = createPost("x", 0, 0, 0, 100, 0, 5000);
    expect(saveRate(p)).toBe(2);
  });
});

describe("social-engagement-tracker classifyEngagement", () => {
  it("classifies great on Instagram", () => {
    expect(classifyEngagement(5, "instagram").label).toBe("Outstanding");
  });
  it("classifies below-average when very low", () => {
    expect(classifyEngagement(0.1, "instagram").label).toBe("Below average");
  });
  it("returns Unknown for unknown platform", () => {
    expect(classifyEngagement(5, "nope").label).toBe("Unknown");
  });
});

describe("social-engagement-tracker aggregateStats", () => {
  it("sums totals across posts", () => {
    const posts = [samplePost(), samplePost({ likes: 200 })];
    const a = aggregateStats(posts);
    expect(a.totalLikes).toBe(300);
  });
  it("returns zeros for empty array", () => {
    const a = aggregateStats([]);
    expect(a.totalLikes).toBe(0);
    expect(a.topPost).toBeNull();
  });
  it("finds top post by ER", () => {
    const low = createPost("instagram", 10, 0, 0, 0, 10000, 10000);
    const high = createPost("instagram", 500, 100, 50, 25, 10000, 20000);
    const a = aggregateStats([low, high]);
    expect(a.topPost?.id).toBe(high.id);
  });
});

describe("social-engagement-tracker forecastEngagement", () => {
  it("returns positive expected counts for valid inputs", () => {
    const f = forecastEngagement(10000, "instagram");
    expect(f.expected).toBeGreaterThan(0);
    expect(f.good).toBeGreaterThan(f.expected);
    expect(f.great).toBeGreaterThan(f.good);
  });
  it("returns zeros for unknown platform", () => {
    const f = forecastEngagement(10000, "nope");
    expect(f.expected).toBe(0);
  });
});

describe("social-engagement-tracker validatePost", () => {
  it("warns when impressions < total engagement", () => {
    const p = createPost("x", 100, 50, 50, 50, 1000, 100); // impr 100 < 250 total
    expect(validatePost(p).some((w) => w.includes("less than"))).toBe(true);
  });
  it("warns when followers <= 0", () => {
    const p = createPost("x", 0, 0, 0, 0, 0, 0);
    expect(validatePost(p).some((w) => w.includes("Followers"))).toBe(true);
  });
});

describe("social-engagement-tracker exportPostsCSV", () => {
  it("has header plus rows", () => {
    const posts = [samplePost(), samplePost()];
    const csv = exportPostsCSV(posts);
    const lines = csv.split("\n");
    expect(lines.length).toBe(3);
    expect(lines[0]).toContain("er_followers_pct");
  });
});

describe("social-engagement-tracker movingAverage", () => {
  it("returns one value per post", () => {
    const posts = [samplePost(), samplePost(), samplePost()];
    expect(movingAverage(posts, 2).length).toBe(3);
  });
  it("handles single post", () => {
    expect(movingAverage([samplePost()]).length).toBe(1);
  });
});

describe("social-engagement-tracker compareToBenchmark", () => {
  it("returns positive delta when above average", () => {
    const b = getBenchmarkById("instagram")!;
    const r = compareToBenchmark(b.avgEngagementRate + 1, "instagram");
    expect(r.delta).toBeGreaterThan(0);
    expect(r.multiplier).toBeGreaterThan(1);
  });
});

describe("social-engagement-tracker topPosts", () => {
  it("returns top N posts by ER", () => {
    const posts = [
      createPost("x", 10, 0, 0, 0, 10000, 10000),
      createPost("x", 500, 100, 50, 0, 10000, 20000),
      createPost("x", 50, 5, 0, 0, 10000, 8000),
    ];
    const top = topPosts(posts, 2);
    expect(top.length).toBe(2);
    expect(top[0].likes).toBe(500);
  });
});

describe("social-engagement-tracker bestPostingHour", () => {
  it("returns a number when posts exist", () => {
    const posts = [
      createPost("x", 10, 0, 0, 0, 10000, 10000, new Date("2025-01-01T09:00:00").getTime()),
      createPost("x", 500, 100, 50, 0, 10000, 20000, new Date("2025-01-01T18:00:00").getTime()),
    ];
    const h = bestPostingHour(posts);
    expect(h).toBe(18);
  });
  it("returns null for empty", () => {
    expect(bestPostingHour([])).toBeNull();
  });
});

describe("social-engagement-tracker buildSummary", () => {
  it("includes key stats", () => {
    const txt = buildSummary([samplePost()]);
    expect(txt).toContain("Posts:");
    expect(txt).toContain("Avg ER");
  });
  it("handles empty posts", () => {
    expect(buildSummary([])).toContain("Posts:           0");
  });
});

describe("social-engagement-tracker BENCHMARKS sanity", () => {
  it("every benchmark has positive rates", () => {
    expect(BENCHMARKS.every((b) => b.avgEngagementRate > 0 && b.goodEngagementRate > 0)).toBe(true);
  });
});

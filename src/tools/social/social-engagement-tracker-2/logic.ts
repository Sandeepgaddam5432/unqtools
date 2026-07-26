/**
 * Social Engagement Tracker — pure logic.
 * Engagement rate = (likes + comments + shares) / followers.
 * Benchmark comparison.
 */

export interface EngagementPost {
  id: string;
  platform: string;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  followers: number; // at time of post
  impressions: number;
  postedAt: number;
}

export interface PlatformBenchmark {
  id: string;
  name: string;
  goodEngagementRate: number; // %
  greatEngagementRate: number; // %
  avgEngagementRate: number; // %
  notes: string;
}

export const BENCHMARKS: PlatformBenchmark[] = [
  { id: "instagram", name: "Instagram", goodEngagementRate: 1.5, greatEngagementRate: 3.5, avgEngagementRate: 0.83, notes: "Carousels drive highest engagement." },
  { id: "tiktok", name: "TikTok", goodEngagementRate: 5.0, greatEngagementRate: 10.0, avgEngagementRate: 4.0, notes: "Views-driven; saves count heavily." },
  { id: "twitter", name: "Twitter / X", goodEngagementRate: 0.5, greatEngagementRate: 1.5, avgEngagementRate: 0.3, notes: "Replies and retweets dominate." },
  { id: "linkedin", name: "LinkedIn", goodEngagementRate: 2.0, greatEngagementRate: 5.0, avgEngagementRate: 1.5, notes: "Comments drive organic reach." },
  { id: "youtube", name: "YouTube", goodEngagementRate: 3.0, greatEngagementRate: 8.0, avgEngagementRate: 2.0, notes: "Like + comment + share per view." },
  { id: "facebook", name: "Facebook", goodEngagementRate: 0.5, greatEngagementRate: 1.5, avgEngagementRate: 0.25, notes: "Reach declining; shares matter most." },
];

export function getBenchmarkById(id: string): PlatformBenchmark | null {
  return BENCHMARKS.find((b) => b.id === id) ?? null;
}

export function getAllBenchmarks(): PlatformBenchmark[] {
  return [...BENCHMARKS];
}

export function createPost(
  platform: string,
  likes: number,
  comments: number,
  shares: number,
  saves: number,
  followers: number,
  impressions: number,
  postedAt = Date.now(),
): EngagementPost {
  return {
    id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    platform,
    likes: Math.max(0, likes),
    comments: Math.max(0, comments),
    shares: Math.max(0, shares),
    saves: Math.max(0, saves),
    followers: Math.max(0, followers),
    impressions: Math.max(0, impressions),
    postedAt,
  };
}

/** Engagement rate by followers (ER%): (likes + comments + shares) / followers × 100. */
export function engagementRateByFollowers(post: EngagementPost): number {
  if (post.followers <= 0) return 0;
  const total = post.likes + post.comments + post.shares + post.saves;
  return (total / post.followers) * 100;
}

/** Engagement rate by reach (ERR): (engagement) / impressions × 100. */
export function engagementRateByReach(post: EngagementPost): number {
  if (post.impressions <= 0) return 0;
  const total = post.likes + post.comments + post.shares + post.saves;
  return (total / post.impressions) * 100;
}

/** Amplification rate: shares / impressions × 100. */
export function amplificationRate(post: EngagementPost): number {
  if (post.impressions <= 0) return 0;
  return (post.shares / post.impressions) * 100;
}

/** Conversation rate: comments / followers × 100. */
export function conversationRate(post: EngagementPost): number {
  if (post.followers <= 0) return 0;
  return (post.comments / post.followers) * 100;
}

/** Save rate: saves / impressions × 100. */
export function saveRate(post: EngagementPost): number {
  if (post.impressions <= 0) return 0;
  return (post.saves / post.impressions) * 100;
}

/** Classify engagement vs platform benchmark. */
export function classifyEngagement(rate: number, platformId: string): { label: string; color: string } {
  const b = getBenchmarkById(platformId);
  if (!b) return { label: "Unknown", color: "gray" };
  if (rate >= b.greatEngagementRate) return { label: "Outstanding", color: "emerald" };
  if (rate >= b.goodEngagementRate) return { label: "Good", color: "blue" };
  if (rate >= b.avgEngagementRate) return { label: "Average", color: "amber" };
  return { label: "Below average", color: "red" };
}

/** Aggregate stats across multiple posts. */
export function aggregateStats(posts: EngagementPost[]): {
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  totalImpressions: number;
  avgEngagementRate: number;
  topPost: EngagementPost | null;
} {
  if (posts.length === 0) {
    return { totalLikes: 0, totalComments: 0, totalShares: 0, totalSaves: 0, totalImpressions: 0, avgEngagementRate: 0, topPost: null };
  }
  const totalLikes = posts.reduce((s, p) => s + p.likes, 0);
  const totalComments = posts.reduce((s, p) => s + p.comments, 0);
  const totalShares = posts.reduce((s, p) => s + p.shares, 0);
  const totalSaves = posts.reduce((s, p) => s + p.saves, 0);
  const totalImpressions = posts.reduce((s, p) => s + p.impressions, 0);
  const rates = posts.map((p) => engagementRateByFollowers(p));
  const avgEngagementRate = rates.reduce((s, r) => s + r, 0) / rates.length;
  const topPost = [...posts].sort((a, b) => engagementRateByFollowers(b) - engagementRateByFollowers(a))[0];
  return { totalLikes, totalComments, totalShares, totalSaves, totalImpressions, avgEngagementRate, topPost };
}

/** Forecast expected engagement for a follower count. */
export function forecastEngagement(followers: number, platformId: string): { expected: number; good: number; great: number } {
  const b = getBenchmarkById(platformId);
  if (!b) return { expected: 0, good: 0, great: 0 };
  return {
    expected: Math.round((b.avgEngagementRate / 100) * followers),
    good: Math.round((b.goodEngagementRate / 100) * followers),
    great: Math.round((b.greatEngagementRate / 100) * followers),
  };
}

/** Validate post inputs. */
export function validatePost(post: EngagementPost): string[] {
  const w: string[] = [];
  if (post.followers <= 0) w.push("Followers must be positive.");
  if (post.impressions < post.likes + post.comments + post.shares + post.saves) {
    w.push("Impressions are less than total engagement — likely measurement error.");
  }
  if (post.likes < 0 || post.comments < 0 || post.shares < 0 || post.saves < 0) {
    w.push("Engagement metrics cannot be negative.");
  }
  return w;
}

/** Export posts as CSV. */
export function exportPostsCSV(posts: EngagementPost[]): string {
  const header = ["id", "platform", "likes", "comments", "shares", "saves", "followers", "impressions", "er_followers_pct", "posted_at"];
  const rows = posts.map((p) =>
    [p.id, p.platform, p.likes, p.comments, p.shares, p.saves, p.followers, p.impressions, engagementRateByFollowers(p).toFixed(3), p.postedAt].join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

/** Compute 7-day moving average of engagement rate. */
export function movingAverage(posts: EngagementPost[], windowSize = 7): number[] {
  const sorted = [...posts].sort((a, b) => a.postedAt - b.postedAt);
  const rates = sorted.map((p) => engagementRateByFollowers(p));
  const result: number[] = [];
  for (let i = 0; i < rates.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const slice = rates.slice(start, i + 1);
    result.push(slice.reduce((s, r) => s + r, 0) / slice.length);
  }
  return result;
}

/** Compare to benchmark. */
export function compareToBenchmark(rate: number, platformId: string): { delta: number; multiplier: number } {
  const b = getBenchmarkById(platformId);
  if (!b) return { delta: 0, multiplier: 0 };
  const delta = rate - b.avgEngagementRate;
  const multiplier = b.avgEngagementRate > 0 ? rate / b.avgEngagementRate : 0;
  return { delta, multiplier };
}

/** Sort posts by engagement rate (high to low). */
export function topPosts(posts: EngagementPost[], n = 5): EngagementPost[] {
  return [...posts].sort((a, b) => engagementRateByFollowers(b) - engagementRateByFollowers(a)).slice(0, n);
}

/** Find best posting hour (by engagement rate). */
export function bestPostingHour(posts: EngagementPost[]): number | null {
  if (posts.length === 0) return null;
  const byHour: Record<number, EngagementPost[]> = {};
  for (const p of posts) {
    const h = new Date(p.postedAt).getHours();
    if (!byHour[h]) byHour[h] = [];
    byHour[h].push(p);
  }
  let bestHour = 0;
  let bestRate = -1;
  for (const [h, list] of Object.entries(byHour)) {
    const rates = list.map((p) => engagementRateByFollowers(p));
    const avg = rates.reduce((s, r) => s + r, 0) / rates.length;
    if (avg > bestRate) {
      bestRate = avg;
      bestHour = Number(h);
    }
  }
  return bestHour;
}

/** Build summary text. */
export function buildSummary(posts: EngagementPost[]): string {
  const a = aggregateStats(posts);
  return [
    `ENGAGEMENT SUMMARY`,
    `Posts:           ${posts.length}`,
    `Total likes:     ${a.totalLikes}`,
    `Total comments:  ${a.totalComments}`,
    `Total shares:    ${a.totalShares}`,
    `Total saves:     ${a.totalSaves}`,
    `Total impr.:     ${a.totalImpressions}`,
    `Avg ER (fol.):   ${a.avgEngagementRate.toFixed(2)}%`,
    a.topPost ? `Top post ER:     ${engagementRateByFollowers(a.topPost).toFixed(2)}%` : "",
  ].filter(Boolean).join("\n");
}

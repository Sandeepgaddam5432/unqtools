/**
 * Social Media Engagement Tracker — pure logic.
 *
 * Parse CSV of post metrics, compute engagement rates, rank, aggregate
 * per-platform, analyze trends, and render reports. Pure functions only —
 * no DOM, no network.
 */

export type Platform =
  | "twitter"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "tiktok"
  | "youtube";

export type RankMetric =
  | "engagement-rate"
  | "total-engagement"
  | "impressions"
  | "likes"
  | "comments";

export interface PostInput {
  date: string; // YYYY-MM-DD
  platform: Platform;
  postUrl: string;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  impressions: number;
}

export interface RankedPost extends PostInput {
  totalEngagement: number;
  engagementRate: number; // percent
  rank: number; // 1-based by chosen metric
}

export interface PlatformAggregate {
  platform: Platform;
  postCount: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  totalImpressions: number;
  totalEngagement: number;
  avgEngagementRate: number; // percent
}

export interface SummaryStats {
  totalPosts: number;
  totalEngagement: number;
  totalImpressions: number;
  avgEngagementRate: number; // percent
  byPlatform: PlatformAggregate[];
}

export interface TrendAnalysis {
  firstHalfAvgRate: number;
  secondHalfAvgRate: number;
  deltaPp: number; // percentage points
  direction: "improving" | "declining" | "flat";
}

export interface BestWorst {
  best: RankedPost | null;
  worst: RankedPost | null;
}

export interface PostingFrequency {
  postsPerWeek: number;
  totalDays: number;
  uniqueDays: number;
  posts: number;
}

export interface BestTimeSlot {
  slot: string;
  avgEngagementRate: number;
  postCount: number;
}

export interface GrowthPrediction {
  trend: "improving" | "declining" | "flat";
  projectedRateNextPeriod: number; // percent
  confidence: "low" | "medium" | "high";
}

export interface ParseError {
  line: number;
  message: string;
}

export interface ParseResult {
  posts: PostInput[];
  errors: ParseError[];
}

export const PLATFORMS: Platform[] = [
  "twitter", "instagram", "facebook", "linkedin", "tiktok", "youtube",
];

export const PLATFORM_LABELS: Record<Platform, string> = {
  twitter: "Twitter / X",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
};

export const RANK_METRICS: RankMetric[] = [
  "engagement-rate", "total-engagement", "impressions", "likes", "comments",
];

export const RANK_METRIC_LABELS: Record<RankMetric, string> = {
  "engagement-rate": "Engagement Rate",
  "total-engagement": "Total Engagement",
  "impressions": "Impressions",
  "likes": "Likes",
  "comments": "Comments",
};

/** Typical engagement-rate benchmarks (industry averages, percent). */
export const PLATFORM_BENCHMARKS: Record<Platform, number> = {
  twitter: 0.05,
  instagram: 0.7,
  facebook: 0.2,
  linkedin: 0.55,
  tiktok: 5.7,
  youtube: 3.5,
};

/** Split CSV row honoring quoted values (RFC 4180). */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(current); current = "";
    } else { current += ch; }
  }
  out.push(current);
  return out;
}

/** Parse a single CSV line into a PostInput. Returns null + error on failure. */
export function parsePostLine(line: string, lineNum: number): { post: PostInput | null; error: ParseError | null } {
  const trimmed = line.trim();
  if (!trimmed) return { post: null, error: null };
  const parts = splitCsvRow(trimmed);
  if (parts.length < 8) {
    return { post: null, error: { line: lineNum, message: `Expected 8 fields, got ${parts.length}` } };
  }
  const [date, platformStr, postUrl, likesStr, commentsStr, sharesStr, savesStr, impressionsStr] = parts;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { post: null, error: { line: lineNum, message: `Invalid date "${date}" (use YYYY-MM-DD)` } };
  }
  const platform = platformStr.toLowerCase().trim() as Platform;
  if (!PLATFORMS.includes(platform)) {
    return { post: null, error: { line: lineNum, message: `Unknown platform "${platformStr}"` } };
  }
  const likes = Number(likesStr);
  const comments = Number(commentsStr);
  const shares = Number(sharesStr);
  const saves = Number(savesStr);
  const impressions = Number(impressionsStr);
  for (const [name, val] of [["likes", likes], ["comments", comments], ["shares", shares], ["saves", saves], ["impressions", impressions]] as const) {
    if (!Number.isFinite(val) || val < 0) {
      return { post: null, error: { line: lineNum, message: `Invalid ${name} "${val}"` } };
    }
  }
  return {
    post: { date, platform, postUrl: postUrl.trim(), likes, comments, shares, saves, impressions },
    error: null,
  };
}

/** Parse the full CSV textarea. */
export function parsePosts(input: string): ParseResult {
  const posts: PostInput[] = [];
  const errors: ParseError[] = [];
  const lines = input.split(/\r?\n/);
  let lineNum = 0;
  for (const raw of lines) {
    lineNum++;
    if (!raw.trim()) continue;
    // Skip header line if present
    if (lineNum === 1 && /^date\s*,\s*platform/i.test(raw.trim())) continue;
    const { post, error } = parsePostLine(raw, lineNum);
    if (error) errors.push(error);
    if (post) posts.push(post);
  }
  return { posts, errors };
}

/** Engagement rate as percent. Returns 0 if impressions is 0. */
export function computeEngagementRate(p: { likes: number; comments: number; shares: number; saves: number; impressions: number }): number {
  if (!p.impressions || p.impressions <= 0) return 0;
  return ((p.likes + p.comments + p.shares + p.saves) / p.impressions) * 100;
}

/** Total engagement = likes + comments + shares + saves. */
export function computeTotalEngagement(p: { likes: number; comments: number; shares: number; saves: number }): number {
  return p.likes + p.comments + p.shares + p.saves;
}

/** Filter posts by date range (inclusive). */
export function filterByDateRange(posts: PostInput[], start?: string, end?: string): PostInput[] {
  if (!start && !end) return posts;
  return posts.filter((p) => {
    if (start && p.date < start) return false;
    if (end && p.date > end) return false;
    return true;
  });
}

/** Filter by platform. */
export function filterByPlatform(posts: PostInput[], platform: "all" | Platform): PostInput[] {
  if (platform === "all") return posts;
  return posts.filter((p) => p.platform === platform);
}

/** Rank posts by chosen metric (descending). Returns posts with rank assigned. */
export function rankPosts(posts: PostInput[], metric: RankMetric): RankedPost[] {
  const enriched = posts.map((p) => {
    const totalEngagement = computeTotalEngagement(p);
    const engagementRate = computeEngagementRate(p);
    return { ...p, totalEngagement, engagementRate };
  });
  enriched.sort((a, b) => {
    let av: number; let bv: number;
    switch (metric) {
      case "engagement-rate": av = a.engagementRate; bv = b.engagementRate; break;
      case "total-engagement": av = a.totalEngagement; bv = b.totalEngagement; break;
      case "impressions": av = a.impressions; bv = b.impressions; break;
      case "likes": av = a.likes; bv = b.likes; break;
      case "comments": av = a.comments; bv = b.comments; break;
      default: av = 0; bv = 0;
    }
    return bv - av;
  });
  return enriched.map((p, i) => ({ ...p, rank: i + 1 }));
}

/** Aggregate per platform. */
export function aggregateByPlatform(posts: PostInput[]): PlatformAggregate[] {
  const byPlatform = new Map<Platform, PostInput[]>();
  for (const p of posts) {
    if (!byPlatform.has(p.platform)) byPlatform.set(p.platform, []);
    byPlatform.get(p.platform)!.push(p);
  }
  const out: PlatformAggregate[] = [];
  for (const [platform, list] of byPlatform) {
    const totals = list.reduce(
      (acc, p) => {
        acc.likes += p.likes;
        acc.comments += p.comments;
        acc.shares += p.shares;
        acc.saves += p.saves;
        acc.impressions += p.impressions;
        return acc;
      },
      { likes: 0, comments: 0, shares: 0, saves: 0, impressions: 0 },
    );
    const totalEngagement = totals.likes + totals.comments + totals.shares + totals.saves;
    const avgEngagementRate = totals.impressions > 0 ? (totalEngagement / totals.impressions) * 100 : 0;
    out.push({
      platform,
      postCount: list.length,
      totalLikes: totals.likes,
      totalComments: totals.comments,
      totalShares: totals.shares,
      totalSaves: totals.saves,
      totalImpressions: totals.impressions,
      totalEngagement,
      avgEngagementRate,
    });
  }
  out.sort((a, b) => b.totalEngagement - a.totalEngagement);
  return out;
}

/** Compute summary stats. */
export function computeSummary(posts: PostInput[]): SummaryStats {
  const totals = posts.reduce(
    (acc, p) => {
      acc.likes += p.likes;
      acc.comments += p.comments;
      acc.shares += p.shares;
      acc.saves += p.saves;
      acc.impressions += p.impressions;
      return acc;
    },
    { likes: 0, comments: 0, shares: 0, saves: 0, impressions: 0 },
  );
  const totalEngagement = totals.likes + totals.comments + totals.shares + totals.saves;
  const avgEngagementRate = totals.impressions > 0 ? (totalEngagement / totals.impressions) * 100 : 0;
  return {
    totalPosts: posts.length,
    totalEngagement,
    totalImpressions: totals.impressions,
    avgEngagementRate,
    byPlatform: aggregateByPlatform(posts),
  };
}

/** Split posts into first half and second half (by date) and compute trend. */
export function analyzeTrend(posts: PostInput[]): TrendAnalysis | null {
  if (posts.length < 2) return null;
  const sorted = [...posts].sort((a, b) => a.date.localeCompare(b.date));
  const mid = Math.floor(sorted.length / 2);
  const first = sorted.slice(0, mid);
  const second = sorted.slice(mid);
  const avg = (list: PostInput[]): number => {
    if (list.length === 0) return 0;
    const s = computeSummary(list);
    return s.avgEngagementRate;
  };
  const firstHalfAvgRate = avg(first);
  const secondHalfAvgRate = avg(second);
  const deltaPp = secondHalfAvgRate - firstHalfAvgRate;
  const direction: TrendAnalysis["direction"] =
    Math.abs(deltaPp) < 0.05 ? "flat" : deltaPp > 0 ? "improving" : "declining";
  return { firstHalfAvgRate, secondHalfAvgRate, deltaPp, direction };
}

/** Find best and worst post by engagement rate. */
export function findBestAndWorst(posts: PostInput[]): BestWorst {
  const ranked = rankPosts(posts, "engagement-rate");
  if (ranked.length === 0) return { best: null, worst: null };
  return { best: ranked[0], worst: ranked[ranked.length - 1] };
}

/** Compute posting frequency (posts per week). */
export function computePostingFrequency(posts: PostInput[]): PostingFrequency {
  if (posts.length === 0) return { postsPerWeek: 0, totalDays: 0, uniqueDays: 0, posts: 0 };
  const dates = posts.map((p) => p.date).sort();
  const unique = new Set(dates);
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];
  const totalDays = Math.max(1, daysBetween(minDate, maxDate) + 1);
  const postsPerWeek = (posts.length / totalDays) * 7;
  return {
    postsPerWeek,
    totalDays,
    uniqueDays: unique.size,
    posts: posts.length,
  };
}

/** Days between two YYYY-MM-DD dates. */
export function daysBetween(start: string, end: string): number {
  const s = new Date(start + "T00:00:00Z").getTime();
  const e = new Date(end + "T00:00:00Z").getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return 0;
  return Math.round((e - s) / (1000 * 60 * 60 * 24));
}

/** Suggest best time to post based on day-of-week grouping (heuristic). */
export function suggestBestTimeSlot(posts: PostInput[]): BestTimeSlot | null {
  if (posts.length === 0) return null;
  const byDay = new Map<string, PostInput[]>();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (const p of posts) {
    const d = new Date(p.date + "T00:00:00Z");
    if (Number.isNaN(d.getTime())) continue;
    const day = dayNames[d.getUTCDay()];
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(p);
  }
  let best: BestTimeSlot | null = null;
  for (const [day, list] of byDay) {
    const s = computeSummary(list);
    const slot: BestTimeSlot = { slot: day, avgEngagementRate: s.avgEngagementRate, postCount: list.length };
    if (!best || slot.avgEngagementRate > best.avgEngagementRate) best = slot;
  }
  return best;
}

/** Predict audience growth based on trend. */
export function predictGrowth(posts: PostInput[]): GrowthPrediction | null {
  const trend = analyzeTrend(posts);
  if (!trend) return null;
  const projectedRateNextPeriod = Math.max(0, trend.secondHalfAvgRate + trend.deltaPp);
  const confidence: GrowthPrediction["confidence"] =
    posts.length >= 20 ? "high" : posts.length >= 8 ? "medium" : "low";
  return {
    trend: trend.direction,
    projectedRateNextPeriod,
    confidence,
  };
}

/** Compare a platform's avg engagement rate to its benchmark. */
export function compareBenchmark(platform: Platform, rate: number): { benchmark: number; deltaPp: number; status: "above" | "below" | "on-par" } {
  const benchmark = PLATFORM_BENCHMARKS[platform];
  const deltaPp = rate - benchmark;
  const status = Math.abs(deltaPp) < 0.05 ? "on-par" : deltaPp > 0 ? "above" : "below";
  return { benchmark, deltaPp, status };
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatRate(n: number): string {
  return n.toFixed(2) + "%";
}

/** Render text report. */
export function renderText(posts: PostInput[], metric: RankMetric): string {
  if (posts.length === 0) return "No posts to report.";
  const ranked = rankPosts(posts, metric);
  const summary = computeSummary(posts);
  const trend = analyzeTrend(posts);
  const freq = computePostingFrequency(posts);
  const bestSlot = suggestBestTimeSlot(posts);
  const growth = predictGrowth(posts);
  const lines: string[] = [];
  lines.push("=== Social Media Engagement Report ===");
  lines.push("");
  lines.push("--- Summary ---");
  lines.push(`Total posts: ${summary.totalPosts}`);
  lines.push(`Total engagement: ${summary.totalEngagement.toLocaleString()}`);
  lines.push(`Total impressions: ${summary.totalImpressions.toLocaleString()}`);
  lines.push(`Avg engagement rate: ${formatRate(summary.avgEngagementRate)}`);
  lines.push(`Posting frequency: ${freq.postsPerWeek.toFixed(2)} posts/week (${freq.posts} posts over ${freq.totalDays} days)`);
  if (bestSlot) {
    lines.push(`Best day to post: ${bestSlot.slot} (avg ${formatRate(bestSlot.avgEngagementRate)}, ${bestSlot.postCount} posts)`);
  }
  if (trend) {
    lines.push(`Trend: ${trend.direction} (first half ${formatRate(trend.firstHalfAvgRate)} → second half ${formatRate(trend.secondHalfAvgRate)}, ${trend.deltaPp >= 0 ? "+" : ""}${trend.deltaPp.toFixed(2)}pp)`);
  }
  if (growth) {
    lines.push(`Growth prediction: ${growth.trend} (projected next period ${formatRate(growth.projectedRateNextPeriod)}, confidence: ${growth.confidence})`);
  }
  lines.push("");
  lines.push("--- By Platform ---");
  for (const agg of summary.byPlatform) {
    const bench = compareBenchmark(agg.platform, agg.avgEngagementRate);
    lines.push(`${PLATFORM_LABELS[agg.platform]}: ${agg.postCount} posts, ${agg.totalEngagement.toLocaleString()} engagement, ${formatRate(agg.avgEngagementRate)} (benchmark ${formatRate(bench.benchmark)}, ${bench.status})`);
  }
  lines.push("");
  lines.push(`--- Top 5 posts by ${RANK_METRIC_LABELS[metric]} ---`);
  for (const p of ranked.slice(0, 5)) {
    lines.push(`#${p.rank} [${PLATFORM_LABELS[p.platform]}] ${p.date} — ${formatRate(p.engagementRate)} ER, ${p.totalEngagement.toLocaleString()} engagement, ${p.impressions.toLocaleString()} impressions — ${p.postUrl}`);
  }
  lines.push("");
  lines.push(`--- Bottom 3 posts by ${RANK_METRIC_LABELS[metric]} ---`);
  for (const p of ranked.slice(-3)) {
    lines.push(`#${p.rank} [${PLATFORM_LABELS[p.platform]}] ${p.date} — ${formatRate(p.engagementRate)} ER, ${p.totalEngagement.toLocaleString()} engagement — ${p.postUrl}`);
  }
  return lines.join("\n");
}

/** Render CSV report. */
export function renderCsv(posts: PostInput[], metric: RankMetric): string {
  const header = "date,platform,post_url,likes,comments,shares,saves,impressions,total_engagement,engagement_rate_percent,rank";
  const lines = [header];
  const ranked = rankPosts(posts, metric);
  for (const p of ranked) {
    lines.push([
      p.date,
      p.platform,
      escapeCsv(p.postUrl),
      p.likes,
      p.comments,
      p.shares,
      p.saves,
      p.impressions,
      p.totalEngagement,
      p.engagementRate.toFixed(4),
      p.rank,
    ].join(","));
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:social-media-engagement-tracker:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  postCount: number;
  platformCount: number;
  avgEngagementRate: number;
  preview: string; // first post URL or date
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---- Shareable URL ----

export interface ShareParams {
  posts: string;
  dateStart: string;
  dateEnd: string;
  platform: "all" | Platform;
  metric: RankMetric;
}

export function buildShareUrl(params: ShareParams): string {
  const p = new URLSearchParams();
  if (params.posts) p.set("posts", params.posts);
  if (params.dateStart) p.set("start", params.dateStart);
  if (params.dateEnd) p.set("end", params.dateEnd);
  if (params.platform && params.platform !== "all") p.set("platform", params.platform);
  if (params.metric && params.metric !== "engagement-rate") p.set("metric", params.metric);
  if (typeof window === "undefined") return `?${p.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${p.toString()}`;
}

export function parseShareUrl(hash: string): ShareParams {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { posts: "", dateStart: "", dateEnd: "", platform: "all", metric: "engagement-rate" };
  const params = new URLSearchParams(clean);
  const platformRaw = (params.get("platform") ?? "all") as "all" | Platform;
  const platform: "all" | Platform = platformRaw === "all" || PLATFORMS.includes(platformRaw as Platform) ? platformRaw : "all";
  const metricRaw = (params.get("metric") ?? "engagement-rate") as RankMetric;
  const metric: RankMetric = RANK_METRICS.includes(metricRaw) ? metricRaw : "engagement-rate";
  return {
    posts: params.get("posts") ?? "",
    dateStart: params.get("start") ?? "",
    dateEnd: params.get("end") ?? "",
    platform,
    metric,
  };
}

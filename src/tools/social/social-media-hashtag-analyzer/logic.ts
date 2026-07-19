/**
 * Social Media Hashtag Analyzer — pure logic.
 *
 * Parse CSV of hashtag metrics, aggregate per-hashtag and per-platform
 * stats, rank by multiple metrics, analyze trends, density, and
 * co-occurrence, recommend hashtags, find best combos, and flag saturated
 * hashtags. Pure functions only — no DOM, no network.
 */

export type Platform =
  | "instagram"
  | "twitter"
  | "linkedin"
  | "tiktok"
  | "youtube";

export type PlatformFilter = "all" | Platform;

export type RankMetric =
  | "engagement"
  | "reach"
  | "post_count"
  | "engagement_per_post";

export type HashtagCategory = "popular" | "medium" | "niche";

export type SaturationLevel = "low" | "medium" | "high";

export interface HashtagInput {
  hashtag: string;
  platform: Platform;
  postCount: number;
  avgEngagement: number;
  avgReach: number;
  date: string; // YYYY-MM-DD
}

export interface RankedHashtag extends HashtagInput {
  totalEngagement: number; // postCount * avgEngagement
  totalReach: number; // postCount * avgReach
  engagementPerPost: number; // avgEngagement / postCount (capped, 0 if no posts)
  category: HashtagCategory;
  saturation: SaturationLevel;
  rank: number; // 1-based by chosen metric
}

export interface HashtagStat {
  hashtag: string;
  entries: number;
  totalPosts: number;
  avgEngagement: number; // mean of avgEngagement values
  avgReach: number; // mean of avgReach values
  totalEngagement: number; // sum of postCount * avgEngagement
  totalReach: number; // sum of postCount * avgReach
  platforms: Platform[];
  category: HashtagCategory;
  saturation: SaturationLevel;
  engagementPerPost: number;
}

export interface PlatformGroup {
  platform: Platform;
  hashtags: HashtagInput[];
  totalPosts: number;
  avgEngagement: number;
  avgReach: number;
}

export interface SummaryStats {
  totalEntries: number;
  uniqueHashtags: number;
  totalPosts: number;
  avgEngagement: number;
  avgReach: number;
  byPlatform: PlatformGroup[];
}

export interface TrendPoint {
  date: string;
  avgEngagement: number;
  count: number;
}

export interface TrendAnalysis {
  hashtag: string;
  points: TrendPoint[];
  direction: "improving" | "declining" | "flat";
  firstHalfAvg: number;
  secondHalfAvg: number;
}

export interface DensityAnalysis {
  hashtag: string;
  postsPerDay: number;
  totalDays: number;
  totalPosts: number;
}

export interface CoOccurrence {
  hashtags: [string, string];
  count: number;
  avgEngagement: number;
}

export interface HashtagCombo {
  key: string;
  hashtags: string[];
  occurrences: number;
  avgEngagement: number;
  totalPosts: number;
}

export interface HashtagRecommendation {
  hashtag: string;
  score: number; // 0-100
  reason: string;
}

export interface ParseError {
  line: number;
  message: string;
}

export interface ParseResult {
  entries: HashtagInput[];
  errors: ParseError[];
}

export const PLATFORMS: Platform[] = [
  "instagram", "twitter", "linkedin", "tiktok", "youtube",
];

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  twitter: "Twitter / X",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
};

export const RANK_METRICS: RankMetric[] = [
  "engagement", "reach", "post_count", "engagement_per_post",
];

export const RANK_METRIC_LABELS: Record<RankMetric, string> = {
  "engagement": "Avg Engagement",
  "reach": "Avg Reach",
  "post_count": "Post Count",
  "engagement_per_post": "Engagement per Post",
};

export const CATEGORY_LABELS: Record<HashtagCategory, string> = {
  "popular": "Popular",
  "medium": "Medium",
  "niche": "Niche",
};

export const SATURATION_LABELS: Record<SaturationLevel, string> = {
  "low": "Low",
  "medium": "Medium",
  "high": "High",
};

// Thresholds (post counts).
export const POPULAR_THRESHOLD = 10000;
export const NICHE_THRESHOLD = 1000;
export const SATURATION_HIGH = 100000;
export const SATURATION_MEDIUM = 10000;

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

/** Normalize a hashtag: strip leading #, lowercase, trim, collapse spaces. */
export function normalizeHashtag(s: string): string {
  let out = (s || "").trim();
  if (out.startsWith("#")) out = out.slice(1);
  out = out.toLowerCase().replace(/\s+/g, "_");
  return out;
}

/** Parse a single CSV hashtag line. */
export function parseHashtagLine(line: string, lineNum: number): { entry: HashtagInput | null; error: ParseError | null } {
  const trimmed = line.trim();
  if (!trimmed) return { entry: null, error: null };
  const parts = splitCsvRow(trimmed);
  if (parts.length < 6) {
    return { entry: null, error: { line: lineNum, message: `Expected 6 fields, got ${parts.length}` } };
  }
  const [hashtagRaw, platformStr, postCountStr, avgEngagementStr, avgReachStr, date] = parts;
  const hashtag = normalizeHashtag(hashtagRaw);
  if (!hashtag) {
    return { entry: null, error: { line: lineNum, message: `Empty hashtag` } };
  }
  const platform = platformStr.toLowerCase().trim() as Platform;
  if (!PLATFORMS.includes(platform)) {
    return { entry: null, error: { line: lineNum, message: `Unknown platform "${platformStr}"` } };
  }
  const postCount = Number(postCountStr);
  const avgEngagement = Number(avgEngagementStr);
  const avgReach = Number(avgReachStr);
  for (const [name, val] of [["post_count", postCount], ["avg_engagement", avgEngagement], ["avg_reach", avgReach]] as const) {
    if (!Number.isFinite(val) || val < 0) {
      return { entry: null, error: { line: lineNum, message: `Invalid ${name} "${val}"` } };
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { entry: null, error: { line: lineNum, message: `Invalid date "${date}" (use YYYY-MM-DD)` } };
  }
  return {
    entry: { hashtag, platform, postCount, avgEngagement, avgReach, date },
    error: null,
  };
}

/** Parse the full CSV textarea. */
export function parseHashtags(input: string): ParseResult {
  const entries: HashtagInput[] = [];
  const errors: ParseError[] = [];
  const lines = input.split(/\r?\n/);
  let lineNum = 0;
  for (const raw of lines) {
    lineNum++;
    if (!raw.trim()) continue;
    if (lineNum === 1 && /^hashtag\s*,\s*platform/i.test(raw.trim())) continue;
    const { entry, error } = parseHashtagLine(raw, lineNum);
    if (error) errors.push(error);
    if (entry) entries.push(entry);
  }
  return { entries, errors };
}

/** Engagement per post = avgEngagement / postCount (0 if postCount is 0). */
export function computeEngagementPerPost(entry: { avgEngagement: number; postCount: number }): number {
  if (!entry.postCount || entry.postCount <= 0) return 0;
  return entry.avgEngagement / entry.postCount;
}

/** Classify hashtag by total posts (popular / medium / niche). */
export function classifyHashtag(totalPosts: number): HashtagCategory {
  if (totalPosts >= POPULAR_THRESHOLD) return "popular";
  if (totalPosts >= NICHE_THRESHOLD) return "medium";
  return "niche";
}

/** Check saturation level (high = too competitive). */
export function checkSaturation(totalPosts: number): SaturationLevel {
  if (totalPosts >= SATURATION_HIGH) return "high";
  if (totalPosts >= SATURATION_MEDIUM) return "medium";
  return "low";
}

/** Filter by platform. */
export function filterByPlatform<T extends HashtagInput>(entries: T[], platform: PlatformFilter): T[] {
  if (platform === "all") return entries;
  return entries.filter((e) => e.platform === platform);
}

/** Filter by date range (inclusive). */
export function filterByDateRange<T extends HashtagInput>(entries: T[], start?: string, end?: string): T[] {
  if (!start && !end) return entries;
  return entries.filter((e) => {
    if (start && e.date < start) return false;
    if (end && e.date > end) return false;
    return true;
  });
}

/** Filter to entries whose postCount >= min. */
export function filterByMinPostCount<T extends HashtagInput>(entries: T[], min: number): T[] {
  if (!Number.isFinite(min) || min <= 0) return entries;
  return entries.filter((e) => e.postCount >= min);
}

/** Aggregate per hashtag. */
export function aggregateByHashtag(entries: HashtagInput[]): HashtagStat[] {
  const map = new Map<string, HashtagInput[]>();
  for (const e of entries) {
    if (!map.has(e.hashtag)) map.set(e.hashtag, []);
    map.get(e.hashtag)!.push(e);
  }
  const out: HashtagStat[] = [];
  for (const [hashtag, list] of map) {
    const totalPosts = list.reduce((s, e) => s + e.postCount, 0);
    const avgEngagement = list.length > 0 ? list.reduce((s, e) => s + e.avgEngagement, 0) / list.length : 0;
    const avgReach = list.length > 0 ? list.reduce((s, e) => s + e.avgReach, 0) / list.length : 0;
    const totalEngagement = list.reduce((s, e) => s + e.postCount * e.avgEngagement, 0);
    const totalReach = list.reduce((s, e) => s + e.postCount * e.avgReach, 0);
    const platforms = Array.from(new Set(list.map((e) => e.platform)));
    out.push({
      hashtag,
      entries: list.length,
      totalPosts,
      avgEngagement,
      avgReach,
      totalEngagement,
      totalReach,
      platforms,
      category: classifyHashtag(totalPosts),
      saturation: checkSaturation(totalPosts),
      engagementPerPost: totalPosts > 0 ? totalEngagement / totalPosts : 0,
    });
  }
  out.sort((a, b) => b.totalEngagement - a.totalEngagement);
  return out;
}

/** Aggregate per platform. */
export function aggregateByPlatform(entries: HashtagInput[]): PlatformGroup[] {
  const map = new Map<Platform, HashtagInput[]>();
  for (const e of entries) {
    if (!map.has(e.platform)) map.set(e.platform, []);
    map.get(e.platform)!.push(e);
  }
  const out: PlatformGroup[] = [];
  for (const [platform, list] of map) {
    const totalPosts = list.reduce((s, e) => s + e.postCount, 0);
    const avgEngagement = list.length > 0 ? list.reduce((s, e) => s + e.avgEngagement, 0) / list.length : 0;
    const avgReach = list.length > 0 ? list.reduce((s, e) => s + e.avgReach, 0) / list.length : 0;
    out.push({ platform, hashtags: list, totalPosts, avgEngagement, avgReach });
  }
  out.sort((a, b) => b.totalPosts - a.totalPosts);
  return out;
}

/** Compute summary stats. */
export function computeSummary(entries: HashtagInput[]): SummaryStats {
  const totalPosts = entries.reduce((s, e) => s + e.postCount, 0);
  const avgEngagement = entries.length > 0 ? entries.reduce((s, e) => s + e.avgEngagement, 0) / entries.length : 0;
  const avgReach = entries.length > 0 ? entries.reduce((s, e) => s + e.avgReach, 0) / entries.length : 0;
  return {
    totalEntries: entries.length,
    uniqueHashtags: new Set(entries.map((e) => e.hashtag)).size,
    totalPosts,
    avgEngagement,
    avgReach,
    byPlatform: aggregateByPlatform(entries),
  };
}

/** Rank entries by chosen metric (descending). Returns entries with rank assigned. */
export function rankHashtags(entries: HashtagInput[], metric: RankMetric): RankedHashtag[] {
  const enriched = entries.map((e) => {
    const totalEngagement = e.postCount * e.avgEngagement;
    const totalReach = e.postCount * e.avgReach;
    const engagementPerPost = computeEngagementPerPost(e);
    const totalPosts = e.postCount; // for classifier
    return {
      ...e,
      totalEngagement,
      totalReach,
      engagementPerPost,
      category: classifyHashtag(totalPosts),
      saturation: checkSaturation(totalPosts),
      rank: 0,
    };
  });
  enriched.sort((a, b) => {
    let av: number; let bv: number;
    switch (metric) {
      case "engagement": av = a.avgEngagement; bv = b.avgEngagement; break;
      case "reach": av = a.avgReach; bv = b.avgReach; break;
      case "post_count": av = a.postCount; bv = b.postCount; break;
      case "engagement_per_post": av = a.engagementPerPost; bv = b.engagementPerPost; break;
      default: av = 0; bv = 0;
    }
    return bv - av;
  });
  return enriched.map((e, i) => ({ ...e, rank: i + 1 }));
}

/** Find top performers by engagement. */
export function findTopPerformers(entries: HashtagInput[], limit = 10): RankedHashtag[] {
  return rankHashtags(entries, "engagement").slice(0, limit);
}

/** Days between two YYYY-MM-DD dates. */
export function daysBetween(start: string, end: string): number {
  const s = new Date(start + "T00:00:00Z").getTime();
  const e = new Date(end + "T00:00:00Z").getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return 0;
  return Math.round((e - s) / (1000 * 60 * 60 * 24));
}

/** Analyze engagement-over-time trend for a single hashtag. */
export function analyzeTrendForHashtag(entries: HashtagInput[], hashtag: string): TrendAnalysis | null {
  const filtered = entries.filter((e) => e.hashtag === hashtag);
  if (filtered.length === 0) return null;
  const map = new Map<string, HashtagInput[]>();
  for (const e of filtered) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date)!.push(e);
  }
  const points: TrendPoint[] = [];
  for (const [date, list] of map) {
    const avg = list.reduce((s, e) => s + e.avgEngagement, 0) / list.length;
    points.push({ date, avgEngagement: avg, count: list.length });
  }
  points.sort((a, b) => a.date.localeCompare(b.date));
  if (points.length < 2) {
    return {
      hashtag,
      points,
      direction: "flat",
      firstHalfAvg: points[0]?.avgEngagement ?? 0,
      secondHalfAvg: points[0]?.avgEngagement ?? 0,
    };
  }
  const mid = Math.floor(points.length / 2);
  const first = points.slice(0, mid);
  const second = points.slice(mid);
  const firstHalfAvg = first.length > 0 ? first.reduce((s, p) => s + p.avgEngagement, 0) / first.length : 0;
  const secondHalfAvg = second.length > 0 ? second.reduce((s, p) => s + p.avgEngagement, 0) / second.length : 0;
  const delta = secondHalfAvg - firstHalfAvg;
  const direction: TrendAnalysis["direction"] =
    Math.abs(delta) < 0.01 * (firstHalfAvg || 1) ? "flat" : delta > 0 ? "improving" : "declining";
  return { hashtag, points, direction, firstHalfAvg, secondHalfAvg };
}

/** Analyze trends for all hashtags. */
export function analyzeAllTrends(entries: HashtagInput[]): TrendAnalysis[] {
  const hashtags = Array.from(new Set(entries.map((e) => e.hashtag)));
  const out: TrendAnalysis[] = [];
  for (const h of hashtags) {
    const t = analyzeTrendForHashtag(entries, h);
    if (t) out.push(t);
  }
  out.sort((a, b) => {
    const da = a.secondHalfAvg - a.firstHalfAvg;
    const db = b.secondHalfAvg - b.firstHalfAvg;
    return db - da;
  });
  return out;
}

/** Compute posting density (posts per day) per hashtag. */
export function analyzeDensity(entries: HashtagInput[]): DensityAnalysis[] {
  const map = new Map<string, HashtagInput[]>();
  for (const e of entries) {
    if (!map.has(e.hashtag)) map.set(e.hashtag, []);
    map.get(e.hashtag)!.push(e);
  }
  const out: DensityAnalysis[] = [];
  for (const [hashtag, list] of map) {
    const dates = list.map((e) => e.date).sort();
    const totalPosts = list.reduce((s, e) => s + e.postCount, 0);
    const totalDays = list.length > 1 ? Math.max(1, daysBetween(dates[0], dates[dates.length - 1]) + 1) : 1;
    out.push({ hashtag, postsPerDay: totalPosts / totalDays, totalDays, totalPosts });
  }
  out.sort((a, b) => b.postsPerDay - a.postsPerDay);
  return out;
}

/** Find co-occurring hashtags (appearing on same date + platform). */
export function findCoOccurrence(entries: HashtagInput[]): CoOccurrence[] {
  // Group by date+platform
  const groups = new Map<string, HashtagInput[]>();
  for (const e of entries) {
    const key = `${e.date}|${e.platform}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  const pairMap = new Map<string, { count: number; engagementSum: number }>();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    // Unique hashtags within this group
    const unique = Array.from(new Set(list.map((e) => e.hashtag)));
    if (unique.length < 2) continue;
    // Generate all pairs (sorted alphabetically for canonical key)
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const [a, b] = [unique[i], unique[j]].sort();
        const key = `${a}|${b}`;
        const existing = pairMap.get(key) ?? { count: 0, engagementSum: 0 };
        existing.count += 1;
        // Sum avg engagement for the entries that contain either hashtag in this group
        const groupEng = list
          .filter((e) => e.hashtag === a || e.hashtag === b)
          .reduce((s, e) => s + e.avgEngagement, 0);
        existing.engagementSum += groupEng;
        pairMap.set(key, existing);
      }
    }
  }
  const out: CoOccurrence[] = [];
  for (const [key, val] of pairMap) {
    const [a, b] = key.split("|") as [string, string];
    const avgEngagement = val.count > 0 ? val.engagementSum / (val.count * 2) : 0;
    out.push({ hashtags: [a, b], count: val.count, avgEngagement });
  }
  out.sort((a, b) => b.count - a.count || b.avgEngagement - a.avgEngagement);
  return out;
}

/** Find best hashtag combinations (top groups by avg engagement). */
export function findBestCombos(entries: HashtagInput[], limit = 5): HashtagCombo[] {
  const groups = new Map<string, HashtagInput[]>();
  for (const e of entries) {
    const key = `${e.date}|${e.platform}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  const out: HashtagCombo[] = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const hashtags = Array.from(new Set(list.map((e) => e.hashtag)));
    if (hashtags.length < 2) continue;
    const avgEngagement = list.reduce((s, e) => s + e.avgEngagement, 0) / list.length;
    const totalPosts = list.reduce((s, e) => s + e.postCount, 0);
    out.push({ key, hashtags, occurrences: list.length, avgEngagement, totalPosts });
  }
  out.sort((a, b) => b.avgEngagement - a.avgEngagement);
  return out.slice(0, limit);
}

/** Recommend hashtags similar to top performers. */
export function recommendHashtags(entries: HashtagInput[], limit = 5): HashtagRecommendation[] {
  const stats = aggregateByHashtag(entries);
  if (stats.length === 0) return [];
  const top = stats[0];
  const recommendations: HashtagRecommendation[] = [];
  for (const s of stats) {
    if (s.hashtag === top.hashtag) continue;
    // Score by similarity: same category + platforms overlap + engagement ratio
    let score = 0;
    const reasons: string[] = [];
    if (s.category === top.category) {
      score += 30;
      reasons.push(`same category (${s.category})`);
    }
    const overlap = s.platforms.filter((p) => top.platforms.includes(p)).length;
    if (overlap > 0) {
      score += overlap * 15;
      reasons.push(`${overlap} shared platform(s)`);
    }
    // Engagement ratio (how close to top performer)
    const ratio = top.avgEngagement > 0 ? Math.min(1, s.avgEngagement / top.avgEngagement) : 0;
    score += Math.round(ratio * 40);
    if (s.saturation === "low") {
      score += 10;
      reasons.push("low saturation (better discovery)");
    }
    if (s.saturation === "high") {
      score -= 20;
      reasons.push("high saturation (competitive)");
    }
    score = Math.max(0, Math.min(100, score));
    recommendations.push({
      hashtag: s.hashtag,
      score,
      reason: reasons.length > 0 ? reasons.join(", ") : "similar engagement profile",
    });
  }
  recommendations.sort((a, b) => b.score - a.score);
  return recommendations.slice(0, limit);
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2);
}

/** Render text report. */
export function renderText(entries: HashtagInput[], metric: RankMetric): string {
  if (entries.length === 0) return "No hashtag data to report.";
  const ranked = rankHashtags(entries, metric);
  const summary = computeSummary(entries);
  const stats = aggregateByHashtag(entries);
  const trends = analyzeAllTrends(entries);
  const density = analyzeDensity(entries);
  const coOccur = findCoOccurrence(entries);
  const combos = findBestCombos(entries, 3);
  const recs = recommendHashtags(entries, 3);
  const lines: string[] = [];
  lines.push("=== Social Media Hashtag Report ===");
  lines.push("");
  lines.push("--- Summary ---");
  lines.push(`Total entries: ${summary.totalEntries}`);
  lines.push(`Unique hashtags: ${summary.uniqueHashtags}`);
  lines.push(`Total posts: ${summary.totalPosts.toLocaleString()}`);
  lines.push(`Avg engagement: ${formatNum(summary.avgEngagement)}`);
  lines.push(`Avg reach: ${formatNum(summary.avgReach)}`);
  lines.push("");
  lines.push("--- By Platform ---");
  for (const g of summary.byPlatform) {
    lines.push(`${PLATFORM_LABELS[g.platform]}: ${g.hashtags.length} entries, ${g.totalPosts.toLocaleString()} posts, avg engagement ${formatNum(g.avgEngagement)}, avg reach ${formatNum(g.avgReach)}`);
  }
  lines.push("");
  lines.push(`--- Top 10 hashtags by ${RANK_METRIC_LABELS[metric]} ---`);
  for (const r of ranked.slice(0, 10)) {
    lines.push(`#${r.rank} ${r.hashtag} [${PLATFORM_LABELS[r.platform]}] ${r.date} — ${r.postCount.toLocaleString()} posts, ${formatNum(r.avgEngagement)} eng, ${formatNum(r.avgReach)} reach, ${formatNum(r.engagementPerPost)} eng/post (${CATEGORY_LABELS[r.category]}, sat: ${SATURATION_LABELS[r.saturation]})`);
  }
  lines.push("");
  lines.push("--- Category breakdown ---");
  const byCat = new Map<HashtagCategory, HashtagStat[]>();
  for (const s of stats) {
    if (!byCat.has(s.category)) byCat.set(s.category, []);
    byCat.get(s.category)!.push(s);
  }
  for (const cat of ["popular", "medium", "niche"] as HashtagCategory[]) {
    const list = byCat.get(cat) ?? [];
    lines.push(`${CATEGORY_LABELS[cat]}: ${list.length} hashtag(s), ${list.reduce((s, x) => s + x.totalPosts, 0).toLocaleString()} total posts`);
  }
  lines.push("");
  lines.push("--- Saturation warnings ---");
  const saturated = stats.filter((s) => s.saturation === "high");
  if (saturated.length === 0) {
    lines.push("No highly saturated hashtags detected.");
  } else {
    for (const s of saturated) {
      lines.push(`⚠ ${s.hashtag}: ${s.totalPosts.toLocaleString()} posts (high saturation — too competitive)`);
    }
  }
  lines.push("");
  lines.push("--- Engagement trend (top 5 hashtags) ---");
  for (const t of trends.slice(0, 5)) {
    lines.push(`${t.hashtag}: ${t.direction} (${formatNum(t.firstHalfAvg)} → ${formatNum(t.secondHalfAvg)}, ${t.points.length} data points)`);
  }
  lines.push("");
  lines.push("--- Posting density (top 5 hashtags) ---");
  for (const d of density.slice(0, 5)) {
    lines.push(`${d.hashtag}: ${d.postsPerDay.toFixed(2)} posts/day over ${d.totalDays} day(s) (${d.totalPosts.toLocaleString()} total posts)`);
  }
  lines.push("");
  lines.push("--- Co-occurring hashtags (top 5 pairs) ---");
  if (coOccur.length === 0) {
    lines.push("No co-occurring hashtags detected (need multiple hashtags on same date+platform).");
  } else {
    for (const c of coOccur.slice(0, 5)) {
      lines.push(`${c.hashtags[0]} + ${c.hashtags[1]}: ${c.count} co-occurrence(s), avg engagement ${formatNum(c.avgEngagement)}`);
    }
  }
  lines.push("");
  lines.push("--- Best hashtag combinations (top 3) ---");
  if (combos.length === 0) {
    lines.push("No multi-hashtag combinations found.");
  } else {
    for (const c of combos) {
      lines.push(`[${c.hashtags.join(", ")}] — ${c.occurrences} entries, avg engagement ${formatNum(c.avgEngagement)}, ${c.totalPosts.toLocaleString()} posts`);
    }
  }
  lines.push("");
  lines.push("--- Recommended hashtags (top 3) ---");
  if (recs.length === 0) {
    lines.push("No recommendations (need at least 2 unique hashtags).");
  } else {
    for (const r of recs) {
      lines.push(`${r.hashtag} (score ${r.score}/100): ${r.reason}`);
    }
  }
  return lines.join("\n");
}

/** Render CSV report. */
export function renderCsv(entries: HashtagInput[], metric: RankMetric): string {
  const header = "hashtag,platform,post_count,avg_engagement,avg_reach,date,total_engagement,total_reach,engagement_per_post,category,saturation,rank";
  const lines = [header];
  const ranked = rankHashtags(entries, metric);
  for (const r of ranked) {
    lines.push([
      escapeCsv(r.hashtag),
      r.platform,
      r.postCount,
      r.avgEngagement.toFixed(2),
      r.avgReach.toFixed(2),
      r.date,
      r.totalEngagement.toFixed(2),
      r.totalReach.toFixed(2),
      r.engagementPerPost.toFixed(4),
      r.category,
      r.saturation,
      r.rank,
    ].join(","));
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:social-media-hashtag-analyzer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  entryCount: number;
  uniqueHashtags: number;
  totalPosts: number;
  avgEngagement: number;
  preview: string;
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
  data: string;
  dateStart: string;
  dateEnd: string;
  platform: PlatformFilter;
  minPostCount: string;
  metric: RankMetric;
}

export function buildShareUrl(params: ShareParams): string {
  const p = new URLSearchParams();
  if (params.data) p.set("data", params.data);
  if (params.dateStart) p.set("start", params.dateStart);
  if (params.dateEnd) p.set("end", params.dateEnd);
  if (params.platform && params.platform !== "all") p.set("platform", params.platform);
  if (params.minPostCount) p.set("min", params.minPostCount);
  if (params.metric && params.metric !== "engagement") p.set("metric", params.metric);
  if (typeof window === "undefined") return `?${p.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${p.toString()}`;
}

export function parseShareUrl(hash: string): ShareParams {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { data: "", dateStart: "", dateEnd: "", platform: "all", minPostCount: "", metric: "engagement" };
  const params = new URLSearchParams(clean);
  const platformRaw = (params.get("platform") ?? "all") as PlatformFilter;
  const platform: PlatformFilter = platformRaw === "all" || PLATFORMS.includes(platformRaw as Platform) ? platformRaw : "all";
  const metricRaw = (params.get("metric") ?? "engagement") as RankMetric;
  const metric: RankMetric = RANK_METRICS.includes(metricRaw) ? metricRaw : "engagement";
  return {
    data: params.get("data") ?? "",
    dateStart: params.get("start") ?? "",
    dateEnd: params.get("end") ?? "",
    platform,
    minPostCount: params.get("min") ?? "",
    metric,
  };
}

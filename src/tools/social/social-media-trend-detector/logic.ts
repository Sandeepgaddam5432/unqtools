/**
 * Social Media Trend Detector — pure logic.
 *
 * Parse CSV of trend data (date+topic+platform+mention+engagement),
 * compute growth rates, classify trends, find emerging/sustained/declining
 * trends, compute velocity, predict lifecycle, score opportunities, and
 * detect cross-platform trends. Pure functions only — no DOM, no network.
 */

export type Platform =
  | "twitter"
  | "instagram"
  | "tiktok"
  | "linkedin"
  | "youtube";

export type PlatformFilter = "all" | Platform;

export type TrendType = "trending" | "stable" | "declining";

export type TrendLifecycle = "early" | "mid" | "late";

export type RankMetric = "growth_rate" | "mentions" | "engagement";

export type Urgency = "now" | "soon" | "later" | "missed";

export interface TrendInput {
  date: string; // YYYY-MM-DD
  topic: string;
  platform: Platform;
  mentionCount: number;
  engagementCount: number;
}

export interface TopicAggregate {
  topic: string;
  totalMentions: number;
  totalEngagement: number;
  dataPoints: number;
  platforms: Platform[];
  firstDate: string;
  lastDate: string;
  avgMentionsPerDay: number;
}

export interface GrowthAnalysis {
  topic: string;
  recentAvg: number;
  priorAvg: number;
  growthRate: number; // percent (can be Infinity)
  type: TrendType;
  hasData: boolean;
}

export interface VelocityAnalysis {
  topic: string;
  velocity: number; // acceleration of growth (difference of growth rates)
  direction: "accelerating" | "decelerating" | "steady";
}

export interface RankedTrend {
  topic: string;
  totalMentions: number;
  totalEngagement: number;
  recentAvg: number;
  priorAvg: number;
  growthRate: number;
  type: TrendType;
  lifecycle: TrendLifecycle;
  opportunityScore: number; // 0-100
  velocity: number;
  velocityDirection: "accelerating" | "decelerating" | "steady";
  platforms: Platform[];
  rank: number;
}

export interface PlatformTrends {
  platform: Platform;
  trendingCount: number;
  stableCount: number;
  decliningCount: number;
  totalMentions: number;
  topics: RankedTrend[];
}

export interface SummaryStats {
  totalTopics: number;
  totalDataPoints: number;
  trendingCount: number;
  stableCount: number;
  decliningCount: number;
  avgGrowthRate: number;
  byPlatform: PlatformTrends[];
}

export interface CrossPlatformTrend {
  topic: string;
  platforms: Platform[];
  totalMentions: number;
  avgGrowthRate: number;
  trendingOn: number;
}

export interface BestTimeToLeverage {
  topic: string;
  lifecycle: TrendLifecycle;
  urgency: Urgency;
  recommendation: string;
}

export interface ParseError {
  line: number;
  message: string;
}

export interface ParseResult {
  entries: TrendInput[];
  errors: ParseError[];
}

export const PLATFORMS: Platform[] = [
  "twitter", "instagram", "tiktok", "linkedin", "youtube",
];

export const PLATFORM_LABELS: Record<Platform, string> = {
  twitter: "Twitter / X",
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
};

export const RANK_METRICS: RankMetric[] = ["growth_rate", "mentions", "engagement"];

export const RANK_METRIC_LABELS: Record<RankMetric, string> = {
  "growth_rate": "Growth Rate",
  "mentions": "Total Mentions",
  "engagement": "Total Engagement",
};

export const TREND_TYPE_LABELS: Record<TrendType, string> = {
  "trending": "Trending",
  "stable": "Stable",
  "declining": "Declining",
};

export const LIFECYCLE_LABELS: Record<TrendLifecycle, string> = {
  "early": "Early",
  "mid": "Mid",
  "late": "Late",
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  "now": "Act now",
  "soon": "Soon",
  "later": "Later",
  "missed": "Missed",
};

export const DEFAULT_TREND_THRESHOLD = 100;
export const DEFAULT_GROWTH_THRESHOLD = 50;
export const DEFAULT_LOOKBACK_DAYS = 7;

// Lifecycle thresholds (in mentions).
export const LIFECYCLE_HIGH_MENTIONS = 5000;
export const LIFECYCLE_MID_MENTIONS = 500;

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

/** Normalize topic: lowercase, trim, collapse whitespace to underscores. */
export function normalizeTopic(s: string): string {
  return (s || "").trim().toLowerCase().replace(/\s+/g, "_");
}

/** Parse a single CSV trend line. */
export function parseTrendLine(line: string, lineNum: number): { entry: TrendInput | null; error: ParseError | null } {
  const trimmed = line.trim();
  if (!trimmed) return { entry: null, error: null };
  const parts = splitCsvRow(trimmed);
  if (parts.length < 5) {
    return { entry: null, error: { line: lineNum, message: `Expected 5 fields, got ${parts.length}` } };
  }
  const [date, topicRaw, platformStr, mentionCountStr, engagementCountStr] = parts;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { entry: null, error: { line: lineNum, message: `Invalid date "${date}" (use YYYY-MM-DD)` } };
  }
  const topic = normalizeTopic(topicRaw);
  if (!topic) {
    return { entry: null, error: { line: lineNum, message: `Empty topic` } };
  }
  const platform = platformStr.toLowerCase().trim() as Platform;
  if (!PLATFORMS.includes(platform)) {
    return { entry: null, error: { line: lineNum, message: `Unknown platform "${platformStr}"` } };
  }
  const mentionCount = Number(mentionCountStr);
  const engagementCount = Number(engagementCountStr);
  for (const [name, val] of [["mention_count", mentionCount], ["engagement_count", engagementCount]] as const) {
    if (!Number.isFinite(val) || val < 0) {
      return { entry: null, error: { line: lineNum, message: `Invalid ${name} "${val}"` } };
    }
  }
  return {
    entry: { date, topic, platform, mentionCount, engagementCount },
    error: null,
  };
}

/** Parse the full CSV textarea. */
export function parseTrends(input: string): ParseResult {
  const entries: TrendInput[] = [];
  const errors: ParseError[] = [];
  const lines = input.split(/\r?\n/);
  let lineNum = 0;
  for (const raw of lines) {
    lineNum++;
    if (!raw.trim()) continue;
    if (lineNum === 1 && /^date\s*,\s*topic/i.test(raw.trim())) continue;
    const { entry, error } = parseTrendLine(raw, lineNum);
    if (error) errors.push(error);
    if (entry) entries.push(entry);
  }
  return { entries, errors };
}

/** Days between two YYYY-MM-DD dates. */
export function daysBetween(start: string, end: string): number {
  const s = new Date(start + "T00:00:00Z").getTime();
  const e = new Date(end + "T00:00:00Z").getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return 0;
  return Math.round((e - s) / (1000 * 60 * 60 * 24));
}

/** Filter by platform. */
export function filterByPlatform<T extends TrendInput>(entries: T[], platform: PlatformFilter): T[] {
  if (platform === "all") return entries;
  return entries.filter((e) => e.platform === platform);
}

/** Filter by date range (inclusive). */
export function filterByDateRange<T extends TrendInput>(entries: T[], start?: string, end?: string): T[] {
  if (!start && !end) return entries;
  return entries.filter((e) => {
    if (start && e.date < start) return false;
    if (end && e.date > end) return false;
    return true;
  });
}

/** Filter to topics that have at least one entry with mention_count >= threshold. */
export function filterByTrendThreshold<T extends TrendInput>(entries: T[], threshold: number): T[] {
  if (!Number.isFinite(threshold) || threshold <= 0) return entries;
  const qualifyingTopics = new Set<string>();
  for (const e of entries) {
    if (e.mentionCount >= threshold) qualifyingTopics.add(e.topic);
  }
  return entries.filter((e) => qualifyingTopics.has(e.topic));
}

/** Aggregate per topic. */
export function aggregateByTopic(entries: TrendInput[]): TopicAggregate[] {
  const map = new Map<string, TrendInput[]>();
  for (const e of entries) {
    if (!map.has(e.topic)) map.set(e.topic, []);
    map.get(e.topic)!.push(e);
  }
  const out: TopicAggregate[] = [];
  for (const [topic, list] of map) {
    const dates = list.map((e) => e.date).sort();
    const totalMentions = list.reduce((s, e) => s + e.mentionCount, 0);
    const totalEngagement = list.reduce((s, e) => s + e.engagementCount, 0);
    const platforms = Array.from(new Set(list.map((e) => e.platform)));
    const span = dates.length > 1 ? Math.max(1, daysBetween(dates[0], dates[dates.length - 1]) + 1) : 1;
    out.push({
      topic,
      totalMentions,
      totalEngagement,
      dataPoints: list.length,
      platforms,
      firstDate: dates[0],
      lastDate: dates[dates.length - 1],
      avgMentionsPerDay: totalMentions / span,
    });
  }
  out.sort((a, b) => b.totalMentions - a.totalMentions);
  return out;
}

/** Get the latest date in the dataset (for computing "recent" window). */
export function getLatestDate(entries: TrendInput[]): string | null {
  if (entries.length === 0) return null;
  return entries.reduce((max, e) => (e.date > max ? e.date : max), entries[0].date);
}

/** Compute growth rate for a single topic.
 *  recentAvg = avg mention_count in [latestDate - lookbackDays + 1, latestDate]
 *  priorAvg  = avg mention_count in [latestDate - 2*lookbackDays + 1, latestDate - lookbackDays]
 */
export function computeGrowthRate(
  entries: TrendInput[],
  topic: string,
  lookbackDays: number,
  latestDate?: string | null,
): GrowthAnalysis {
  const latest = latestDate ?? getLatestDate(entries);
  if (!latest || entries.length === 0) {
    return { topic, recentAvg: 0, priorAvg: 0, growthRate: 0, type: "stable", hasData: false };
  }
  const topicEntries = entries.filter((e) => e.topic === topic);
  if (topicEntries.length === 0) {
    return { topic, recentAvg: 0, priorAvg: 0, growthRate: 0, type: "stable", hasData: false };
  }
  const lookback = Math.max(1, lookbackDays);
  const recentStart = addDays(latest, -(lookback - 1));
  const priorStart = addDays(latest, -(2 * lookback - 1));
  const priorEnd = addDays(latest, -lookback);

  const recent = topicEntries.filter((e) => e.date >= recentStart && e.date <= latest);
  const prior = topicEntries.filter((e) => e.date >= priorStart && e.date <= priorEnd);

  const recentAvg = recent.length > 0 ? recent.reduce((s, e) => s + e.mentionCount, 0) / recent.length : 0;
  const priorAvg = prior.length > 0 ? prior.reduce((s, e) => s + e.mentionCount, 0) / prior.length : 0;

  let growthRate: number;
  if (priorAvg === 0) {
    growthRate = recentAvg > 0 ? Infinity : 0;
  } else {
    growthRate = ((recentAvg - priorAvg) / priorAvg) * 100;
  }
  return {
    topic,
    recentAvg,
    priorAvg,
    growthRate,
    type: classifyTrend(growthRate, DEFAULT_GROWTH_THRESHOLD),
    hasData: true,
  };
}

/** Add N days to a YYYY-MM-DD date, returns YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return date;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Classify a growth rate into trending/stable/declining. */
export function classifyTrend(growthRate: number, growthThreshold: number): TrendType {
  if (!Number.isFinite(growthRate)) {
    // Infinity = explosive growth → trending
    return growthRate > 0 ? "trending" : "declining";
  }
  if (growthRate > growthThreshold) return "trending";
  if (growthRate < -growthThreshold) return "declining";
  return "stable";
}

/** Compute growth rates for all topics. */
export function computeAllGrowthRates(entries: TrendInput[], lookbackDays: number): GrowthAnalysis[] {
  const latest = getLatestDate(entries);
  const topics = Array.from(new Set(entries.map((e) => e.topic)));
  const out: GrowthAnalysis[] = [];
  for (const t of topics) {
    out.push(computeGrowthRate(entries, t, lookbackDays, latest));
  }
  // Sort: trending first by growth rate descending, then stable, then declining
  out.sort((a, b) => {
    const av = Number.isFinite(a.growthRate) ? a.growthRate : Number.MAX_SAFE_INTEGER;
    const bv = Number.isFinite(b.growthRate) ? b.growthRate : Number.MAX_SAFE_INTEGER;
    return bv - av;
  });
  return out;
}

/** Compute trend velocity (acceleration) for a topic.
 *  Split recent period into two halves; compute growth rate of each half.
 *  Velocity = recent_half_growth - older_half_growth.
 */
export function computeVelocity(
  entries: TrendInput[],
  topic: string,
  lookbackDays: number,
): VelocityAnalysis {
  const latest = getLatestDate(entries);
  if (!latest) {
    return { topic, velocity: 0, direction: "steady" };
  }
  const lookback = Math.max(1, lookbackDays);
  const recentStart = addDays(latest, -(lookback - 1));
  const midPoint = addDays(latest, -Math.floor(lookback / 2));

  const topicEntries = entries.filter((e) => e.topic === topic);
  const recentHalf = topicEntries.filter((e) => e.date > midPoint && e.date <= latest);
  const olderHalf = topicEntries.filter((e) => e.date >= recentStart && e.date <= midPoint);

  const recentAvg = recentHalf.length > 0 ? recentHalf.reduce((s, e) => s + e.mentionCount, 0) / recentHalf.length : 0;
  const olderAvg = olderHalf.length > 0 ? olderHalf.reduce((s, e) => s + e.mentionCount, 0) / olderHalf.length : 0;

  let velocity: number;
  if (olderAvg === 0) {
    velocity = recentAvg > 0 ? 100 : 0; // explosion if recent > 0
  } else {
    velocity = ((recentAvg - olderAvg) / olderAvg) * 100;
  }
  const direction: VelocityAnalysis["direction"] =
    !Number.isFinite(velocity) ? "accelerating"
      : Math.abs(velocity) < 5 ? "steady"
        : velocity > 0 ? "accelerating" : "decelerating";
  return { topic, velocity, direction };
}

/** Predict lifecycle stage based on growth rate + absolute mentions. */
export function predictLifecycle(growthRate: number, totalMentions: number): TrendLifecycle {
  const g = Number.isFinite(growthRate) ? growthRate : 1000;
  // Early: low mentions + high growth (just starting)
  if (totalMentions < LIFECYCLE_MID_MENTIONS && g > 0) return "early";
  // Late: high mentions + low/declining growth (peaked)
  if (totalMentions >= LIFECYCLE_HIGH_MENTIONS && g <= 0) return "late";
  if (totalMentions >= LIFECYCLE_HIGH_MENTIONS && g < 20) return "late";
  // Mid: everything else
  return "mid";
}

/** Score opportunity (0-100) — high growth + low absolute = best opportunity. */
export function scoreOpportunity(growthRate: number, totalMentions: number): number {
  const g = Number.isFinite(growthRate) ? growthRate : 1000;
  if (g <= 0) return 0; // not growing — no opportunity
  // Growth score (capped at 200% growth = 60 points)
  const growthScore = Math.min(60, (g / 200) * 60);
  // Mentions score (lower mentions = higher opportunity)
  // 0 mentions → 40 points; 10000 mentions → 0 points
  const mentionsScore = Math.max(0, 40 - Math.min(40, (totalMentions / 10000) * 40));
  return Math.round(growthScore + mentionsScore);
}

/** Aggregate trends per platform. */
export function aggregateByPlatform(
  entries: TrendInput[],
  lookbackDays: number,
  growthThreshold: number,
): PlatformTrends[] {
  const map = new Map<Platform, TrendInput[]>();
  for (const e of entries) {
    if (!map.has(e.platform)) map.set(e.platform, []);
    map.get(e.platform)!.push(e);
  }
  const out: PlatformTrends[] = [];
  for (const [platform, list] of map) {
    const aggregates = aggregateByTopic(list);
    const growthMap = new Map<string, GrowthAnalysis>();
    for (const g of computeAllGrowthRates(list, lookbackDays)) {
      growthMap.set(g.topic, g);
    }
    const topics: RankedTrend[] = aggregates.map((a) => {
      const g = growthMap.get(a.topic) ?? { recentAvg: 0, priorAvg: 0, growthRate: 0, type: "stable" as TrendType, hasData: false, topic: a.topic };
      const v = computeVelocity(list, a.topic, lookbackDays);
      const lifecycle = predictLifecycle(g.growthRate, a.totalMentions);
      return {
        topic: a.topic,
        totalMentions: a.totalMentions,
        totalEngagement: a.totalEngagement,
        recentAvg: g.recentAvg,
        priorAvg: g.priorAvg,
        growthRate: g.growthRate,
        type: classifyTrend(g.growthRate, growthThreshold),
        lifecycle,
        opportunityScore: scoreOpportunity(g.growthRate, a.totalMentions),
        velocity: v.velocity,
        velocityDirection: v.direction,
        platforms: a.platforms,
        rank: 0,
      };
    });
    let trendingCount = 0, stableCount = 0, decliningCount = 0, totalMentions = 0;
    for (const t of topics) {
      if (t.type === "trending") trendingCount++;
      else if (t.type === "declining") decliningCount++;
      else stableCount++;
      totalMentions += t.totalMentions;
    }
    out.push({ platform, trendingCount, stableCount, decliningCount, totalMentions, topics });
  }
  out.sort((a, b) => b.trendingCount - a.trendingCount || b.totalMentions - a.totalMentions);
  return out;
}

/** Rank trends by chosen metric. */
export function rankTrends(
  entries: TrendInput[],
  metric: RankMetric,
  lookbackDays: number,
  growthThreshold: number,
): RankedTrend[] {
  const aggregates = aggregateByTopic(entries);
  const growthMap = new Map<string, GrowthAnalysis>();
  for (const g of computeAllGrowthRates(entries, lookbackDays)) {
    growthMap.set(g.topic, g);
  }
  const ranked: RankedTrend[] = aggregates.map((a) => {
    const g = growthMap.get(a.topic) ?? { recentAvg: 0, priorAvg: 0, growthRate: 0, type: "stable" as TrendType, hasData: false, topic: a.topic };
    const v = computeVelocity(entries, a.topic, lookbackDays);
    const lifecycle = predictLifecycle(g.growthRate, a.totalMentions);
    return {
      topic: a.topic,
      totalMentions: a.totalMentions,
      totalEngagement: a.totalEngagement,
      recentAvg: g.recentAvg,
      priorAvg: g.priorAvg,
      growthRate: g.growthRate,
      type: classifyTrend(g.growthRate, growthThreshold),
      lifecycle,
      opportunityScore: scoreOpportunity(g.growthRate, a.totalMentions),
      velocity: v.velocity,
      velocityDirection: v.direction,
      platforms: a.platforms,
      rank: 0,
    };
  });
  ranked.sort((a, b) => {
    let av: number; let bv: number;
    switch (metric) {
      case "growth_rate":
        av = Number.isFinite(a.growthRate) ? a.growthRate : Number.MAX_SAFE_INTEGER;
        bv = Number.isFinite(b.growthRate) ? b.growthRate : Number.MAX_SAFE_INTEGER;
        break;
      case "mentions":
        av = a.totalMentions; bv = b.totalMentions; break;
      case "engagement":
        av = a.totalEngagement; bv = b.totalEngagement; break;
      default: av = 0; bv = 0;
    }
    return bv - av;
  });
  return ranked.map((t, i) => ({ ...t, rank: i + 1 }));
}

/** Find emerging trends: low absolute mentions + high growth rate. */
export function findEmergingTrends(
  entries: TrendInput[],
  lookbackDays: number,
  growthThreshold: number,
): RankedTrend[] {
  const ranked = rankTrends(entries, "growth_rate", lookbackDays, growthThreshold);
  return ranked.filter((t) =>
    t.type === "trending" && t.totalMentions < LIFECYCLE_HIGH_MENTIONS,
  );
}

/** Find sustained trends: high absolute mentions + trending or stable growth. */
export function findSustainedTrends(
  entries: TrendInput[],
  lookbackDays: number,
  growthThreshold: number,
): RankedTrend[] {
  const ranked = rankTrends(entries, "mentions", lookbackDays, growthThreshold);
  return ranked.filter((t) =>
    t.totalMentions >= LIFECYCLE_HIGH_MENTIONS && (t.type === "trending" || t.type === "stable"),
  );
}

/** Find declining trends: negative growth. */
export function findDecliningTrends(
  entries: TrendInput[],
  lookbackDays: number,
  growthThreshold: number,
): RankedTrend[] {
  const ranked = rankTrends(entries, "growth_rate", lookbackDays, growthThreshold);
  return ranked.filter((t) => t.type === "declining");
}

/** Find trends that are trending on multiple platforms simultaneously. */
export function findCrossPlatformTrends(
  entries: TrendInput[],
  lookbackDays: number,
  growthThreshold: number,
): CrossPlatformTrend[] {
  const byPlatform = aggregateByPlatform(entries, lookbackDays, growthThreshold);
  const topicMap = new Map<string, { platforms: Set<Platform>; trendingOn: number; totalMentions: number; growthSum: number; growthCount: number }>();
  for (const p of byPlatform) {
    for (const t of p.topics) {
      if (!topicMap.has(t.topic)) {
        topicMap.set(t.topic, { platforms: new Set(), trendingOn: 0, totalMentions: 0, growthSum: 0, growthCount: 0 });
      }
      const entry = topicMap.get(t.topic)!;
      entry.platforms.add(p.platform);
      entry.totalMentions += t.totalMentions;
      if (t.type === "trending") entry.trendingOn += 1;
      if (Number.isFinite(t.growthRate)) {
        entry.growthSum += t.growthRate;
        entry.growthCount += 1;
      }
    }
  }
  const out: CrossPlatformTrend[] = [];
  for (const [topic, info] of topicMap) {
    if (info.platforms.size >= 2 && info.trendingOn >= 1) {
      out.push({
        topic,
        platforms: Array.from(info.platforms),
        totalMentions: info.totalMentions,
        avgGrowthRate: info.growthCount > 0 ? info.growthSum / info.growthCount : 0,
        trendingOn: info.trendingOn,
      });
    }
  }
  out.sort((a, b) => b.trendingOn - a.trendingOn || b.avgGrowthRate - a.avgGrowthRate);
  return out;
}

/** Recommend best time to leverage a trend based on lifecycle. */
export function recommendBestTime(topic: string, lifecycle: TrendLifecycle): BestTimeToLeverage {
  switch (lifecycle) {
    case "early":
      return {
        topic,
        lifecycle,
        urgency: "now",
        recommendation: "Act now — trend is in early stage with high growth and low competition. Best window for maximum visibility.",
      };
    case "mid":
      return {
        topic,
        lifecycle,
        urgency: "soon",
        recommendation: "Leverage soon — trend is established and growing. Good window but competition is increasing.",
      };
    case "late":
      return {
        topic,
        lifecycle,
        urgency: "later",
        recommendation: "Trend is peaking or declining. Lower priority — consider waiting for the next cycle.",
      };
    default:
      return {
        topic,
        lifecycle,
        urgency: "missed",
        recommendation: "No action recommended at this time.",
      };
  }
}

/** Compute summary stats. */
export function computeSummary(
  entries: TrendInput[],
  lookbackDays: number,
  growthThreshold: number,
): SummaryStats {
  const ranked = rankTrends(entries, "growth_rate", lookbackDays, growthThreshold);
  let trendingCount = 0, stableCount = 0, decliningCount = 0;
  let finiteGrowthSum = 0, finiteGrowthCount = 0;
  for (const t of ranked) {
    if (t.type === "trending") trendingCount++;
    else if (t.type === "declining") decliningCount++;
    else stableCount++;
    if (Number.isFinite(t.growthRate)) {
      finiteGrowthSum += t.growthRate;
      finiteGrowthCount += 1;
    }
  }
  return {
    totalTopics: ranked.length,
    totalDataPoints: entries.length,
    trendingCount,
    stableCount,
    decliningCount,
    avgGrowthRate: finiteGrowthCount > 0 ? finiteGrowthSum / finiteGrowthCount : 0,
    byPlatform: aggregateByPlatform(entries, lookbackDays, growthThreshold),
  };
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatGrowth(n: number): string {
  if (!Number.isFinite(n)) return "∞%";
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2);
}

/** Render text report. */
export function renderText(
  entries: TrendInput[],
  metric: RankMetric,
  lookbackDays: number,
  growthThreshold: number,
): string {
  if (entries.length === 0) return "No trend data to report.";
  const ranked = rankTrends(entries, metric, lookbackDays, growthThreshold);
  const summary = computeSummary(entries, lookbackDays, growthThreshold);
  const emerging = findEmergingTrends(entries, lookbackDays, growthThreshold);
  const sustained = findSustainedTrends(entries, lookbackDays, growthThreshold);
  const declining = findDecliningTrends(entries, lookbackDays, growthThreshold);
  const cross = findCrossPlatformTrends(entries, lookbackDays, growthThreshold);
  const lines: string[] = [];
  lines.push("=== Social Media Trend Detector Report ===");
  lines.push(`Lookback: ${lookbackDays} days | Growth threshold: ${growthThreshold}%`);
  lines.push("");
  lines.push("--- Summary ---");
  lines.push(`Total topics: ${summary.totalTopics}`);
  lines.push(`Total data points: ${summary.totalDataPoints}`);
  lines.push(`Trending: ${summary.trendingCount} | Stable: ${summary.stableCount} | Declining: ${summary.decliningCount}`);
  lines.push(`Avg growth rate (finite only): ${formatGrowth(summary.avgGrowthRate)}`);
  lines.push("");
  lines.push("--- By Platform ---");
  for (const p of summary.byPlatform) {
    lines.push(`${PLATFORM_LABELS[p.platform]}: ${p.topics.length} topics, ${p.totalMentions.toLocaleString()} mentions, ${p.trendingCount} trending / ${p.stableCount} stable / ${p.decliningCount} declining`);
  }
  lines.push("");
  lines.push(`--- Top 10 trends by ${RANK_METRIC_LABELS[metric]} ---`);
  for (const t of ranked.slice(0, 10)) {
    lines.push(`#${t.rank} ${t.topic} — ${formatGrowth(t.growthRate)} growth, ${t.totalMentions.toLocaleString()} mentions, ${t.totalEngagement.toLocaleString()} engagement, ${TREND_TYPE_LABELS[t.type]} (${LIFECYCLE_LABELS[t.lifecycle]} stage, opp ${t.opportunityScore}/100, ${t.velocityDirection})`);
  }
  lines.push("");
  lines.push("--- Emerging trends (low mentions + high growth) ---");
  if (emerging.length === 0) {
    lines.push("No emerging trends detected.");
  } else {
    for (const t of emerging.slice(0, 5)) {
      lines.push(`${t.topic} — ${formatGrowth(t.growthRate)} growth, ${t.totalMentions.toLocaleString()} mentions, opp ${t.opportunityScore}/100`);
    }
  }
  lines.push("");
  lines.push("--- Sustained trends (high mentions + sustained growth) ---");
  if (sustained.length === 0) {
    lines.push("No sustained trends detected.");
  } else {
    for (const t of sustained.slice(0, 5)) {
      lines.push(`${t.topic} — ${formatGrowth(t.growthRate)} growth, ${t.totalMentions.toLocaleString()} mentions, ${LIFECYCLE_LABELS[t.lifecycle]} stage`);
    }
  }
  lines.push("");
  lines.push("--- Declining trends ---");
  if (declining.length === 0) {
    lines.push("No declining trends detected.");
  } else {
    for (const t of declining.slice(0, 5)) {
      lines.push(`${t.topic} — ${formatGrowth(t.growthRate)} growth, ${t.totalMentions.toLocaleString()} mentions`);
    }
  }
  lines.push("");
  lines.push("--- Cross-platform trends ---");
  if (cross.length === 0) {
    lines.push("No trends trending on multiple platforms.");
  } else {
    for (const c of cross.slice(0, 5)) {
      lines.push(`${c.topic} — trending on ${c.trendingOn} of ${c.platforms.length} platforms (${c.platforms.map((p) => PLATFORM_LABELS[p]).join(", ")}), ${c.totalMentions.toLocaleString()} mentions, avg growth ${formatGrowth(c.avgGrowthRate)}`);
    }
  }
  lines.push("");
  lines.push("--- Best time to leverage (top 5 opportunities) ---");
  const topOpps = [...ranked].sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 5);
  for (const t of topOpps) {
    const rec = recommendBestTime(t.topic, t.lifecycle);
    lines.push(`${t.topic} — ${URGENCY_LABELS[rec.urgency]}: ${rec.recommendation}`);
  }
  return lines.join("\n");
}

/** Render CSV report. */
export function renderCsv(
  entries: TrendInput[],
  metric: RankMetric,
  lookbackDays: number,
  growthThreshold: number,
): string {
  const header = "topic,total_mentions,total_engagement,recent_avg,prior_avg,growth_rate_percent,trend_type,lifecycle,opportunity_score,velocity,velocity_direction,platforms,rank";
  const lines = [header];
  const ranked = rankTrends(entries, metric, lookbackDays, growthThreshold);
  for (const t of ranked) {
    const growth = Number.isFinite(t.growthRate) ? t.growthRate.toFixed(2) : "Infinity";
    lines.push([
      escapeCsv(t.topic),
      t.totalMentions,
      t.totalEngagement,
      t.recentAvg.toFixed(2),
      t.priorAvg.toFixed(2),
      growth,
      t.type,
      t.lifecycle,
      t.opportunityScore,
      Number.isFinite(t.velocity) ? t.velocity.toFixed(2) : "Infinity",
      t.velocityDirection,
      escapeCsv(t.platforms.join("|")),
      t.rank,
    ].join(","));
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:social-media-trend-detector:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  dataPointCount: number;
  topicCount: number;
  trendingCount: number;
  decliningCount: number;
  avgGrowthRate: number;
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
  trendThreshold: string;
  growthThreshold: string;
  lookbackDays: string;
  metric: RankMetric;
}

export function buildShareUrl(params: ShareParams): string {
  const p = new URLSearchParams();
  if (params.data) p.set("data", params.data);
  if (params.dateStart) p.set("start", params.dateStart);
  if (params.dateEnd) p.set("end", params.dateEnd);
  if (params.platform && params.platform !== "all") p.set("platform", params.platform);
  if (params.trendThreshold && params.trendThreshold !== String(DEFAULT_TREND_THRESHOLD)) p.set("tth", params.trendThreshold);
  if (params.growthThreshold && params.growthThreshold !== String(DEFAULT_GROWTH_THRESHOLD)) p.set("gth", params.growthThreshold);
  if (params.lookbackDays && params.lookbackDays !== String(DEFAULT_LOOKBACK_DAYS)) p.set("lb", params.lookbackDays);
  if (params.metric && params.metric !== "growth_rate") p.set("metric", params.metric);
  if (typeof window === "undefined") return `?${p.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${p.toString()}`;
}

export function parseShareUrl(hash: string): ShareParams {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) {
    return {
      data: "",
      dateStart: "",
      dateEnd: "",
      platform: "all",
      trendThreshold: String(DEFAULT_TREND_THRESHOLD),
      growthThreshold: String(DEFAULT_GROWTH_THRESHOLD),
      lookbackDays: String(DEFAULT_LOOKBACK_DAYS),
      metric: "growth_rate",
    };
  }
  const params = new URLSearchParams(clean);
  const platformRaw = (params.get("platform") ?? "all") as PlatformFilter;
  const platform: PlatformFilter = platformRaw === "all" || PLATFORMS.includes(platformRaw as Platform) ? platformRaw : "all";
  const metricRaw = (params.get("metric") ?? "growth_rate") as RankMetric;
  const metric: RankMetric = RANK_METRICS.includes(metricRaw) ? metricRaw : "growth_rate";
  return {
    data: params.get("data") ?? "",
    dateStart: params.get("start") ?? "",
    dateEnd: params.get("end") ?? "",
    platform,
    trendThreshold: params.get("tth") ?? String(DEFAULT_TREND_THRESHOLD),
    growthThreshold: params.get("gth") ?? String(DEFAULT_GROWTH_THRESHOLD),
    lookbackDays: params.get("lb") ?? String(DEFAULT_LOOKBACK_DAYS),
    metric,
  };
}

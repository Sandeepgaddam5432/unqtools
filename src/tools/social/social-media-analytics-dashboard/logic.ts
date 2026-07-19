/**
 * Social Media Analytics Dashboard — pure logic.
 *
 * Parse social-media analytics CSV, group by date, aggregate metrics per
 * platform, render ASCII charts / KPI cards / HTML / Markdown dashboards.
 * Pure functions only — no DOM, no network.
 */

// ---- Types ----

export type Platform =
  | "twitter"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "tiktok"
  | "youtube";

export type Metric =
  | "followers"
  | "posts"
  | "engagement"
  | "impressions"
  | "reach"
  | "engagement-rate";

export type DateGrouping = "daily" | "weekly" | "monthly";

export type PlatformFilter = "all" | Platform;

export interface AnalyticsRow {
  date: string; // ISO YYYY-MM-DD
  platform: Platform;
  followers: number;
  posts: number;
  engagement: number;
  impressions: number;
  reach: number;
}

export interface ParseError {
  line: number;
  message: string;
}

export interface ParseResult {
  rows: AnalyticsRow[];
  errors: ParseError[];
}

export interface GroupedMetric {
  group: string; // date key, e.g. "2024-01" for monthly
  total: number;
  avg: number;
  count: number;
}

export interface GrowthRate {
  current: number;
  previous: number;
  rate: number; // percent
  direction: "up" | "down" | "flat";
}

export interface PeriodPerformance {
  group: string;
  value: number;
}

export interface PlatformStats {
  platform: Platform;
  rows: number;
  totalFollowers: number;
  avgFollowers: number;
  lastFollowers: number;
  totalPosts: number;
  totalEngagement: number;
  totalImpressions: number;
  totalReach: number;
  engagementRate: number; // percent
  followerGrowth: GrowthRate;
}

export interface SummaryStats {
  totalPlatforms: number;
  totalRows: number;
  totalFollowers: number; // sum of last followers per platform
  avgEngagementRate: number;
  totalImpressions: number;
  totalReach: number;
  totalEngagement: number;
  totalPosts: number;
}

export interface TrendAnalysis {
  trend: "improving" | "declining" | "stable";
  slope: number;
  startValue: number;
  endValue: number;
  samples: number;
}

export interface DashboardBundle {
  summary: SummaryStats;
  groups: GroupedMetric[];
  barChart: string;
  lineChart: string;
  kpiCards: string;
  bestPeriod: PeriodPerformance | null;
  worstPeriod: PeriodPerformance | null;
  growth: GrowthRate;
  platformComparison: PlatformStats[];
  trend: TrendAnalysis;
  textDashboard: string;
  htmlDashboard: string;
  markdownDashboard: string;
}

// ---- Constants ----

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

export const METRICS: Metric[] = [
  "followers", "posts", "engagement", "impressions", "reach", "engagement-rate",
];

export const METRIC_LABELS: Record<Metric, string> = {
  followers: "Followers",
  posts: "Posts",
  engagement: "Engagement",
  impressions: "Impressions",
  reach: "Reach",
  "engagement-rate": "Engagement Rate (%)",
};

export const DATE_GROUPINGS: DateGrouping[] = ["daily", "weekly", "monthly"];

export const DATE_GROUPING_LABELS: Record<DateGrouping, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export const SAMPLE_CSV = [
  "date,platform,followers,posts,engagement,impressions,reach",
  "2024-01-01,twitter,1200,5,180,5000,4200",
  "2024-01-08,twitter,1350,7,210,5600,4800",
  "2024-01-15,twitter,1500,6,240,6200,5300",
  "2024-01-01,instagram,3500,8,520,12000,10500",
  "2024-01-08,instagram,3800,10,610,14000,11800",
  "2024-01-15,instagram,4100,9,680,15500,13200",
].join("\n");

// ---- Helpers ----

export function normalizePlatform(s: string): Platform | null {
  const lower = (s || "").toLowerCase().trim();
  if (PLATFORMS.includes(lower as Platform)) return lower as Platform;
  // Common aliases
  const aliases: Record<string, Platform> = {
    x: "twitter",
    "twitter/x": "twitter",
    ig: "instagram",
    insta: "instagram",
    fb: "facebook",
    in: "linkedin",
    tt: "tiktok",
    yt: "youtube",
  };
  return aliases[lower] ?? null;
}

/** Validate ISO date YYYY-MM-DD. */
export function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Compute ISO week-of-year and year for a date. */
export function getIsoWeek(date: Date): { year: number; week: number } {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (target.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  target.setUTCDate(target.getUTCDate() - dayNum + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target.getTime() - firstThursday.getTime();
  const week = 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
  return { year: target.getUTCFullYear(), week };
}

/** Format a number with thousands separator. */
export function formatNumber(n: number): string {
  if (!isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(n % 1 === 0 ? 0 : 2);
}

/** Escape a CSV cell. */
function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Compute engagement rate (engagement / impressions × 100). */
export function computeEngagementRate(engagement: number, impressions: number): number {
  if (!impressions || impressions <= 0) return 0;
  return (engagement / impressions) * 100;
}

/** Get the numeric value of a metric for a row. */
export function getMetricValue(row: AnalyticsRow, metric: Metric): number {
  if (metric === "engagement-rate") {
    return computeEngagementRate(row.engagement, row.impressions);
  }
  return row[metric] as number;
}

// ---- CSV parser with validation ----

/** Split a CSV row respecting quoted values. */
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
  return out.map((s) => s.trim());
}

export const CSV_HEADER = ["date", "platform", "followers", "posts", "engagement", "impressions", "reach"];

/** Parse CSV input into rows + errors. */
export function parseCsv(input: string): ParseResult {
  const rows: AnalyticsRow[] = [];
  const errors: ParseError[] = [];
  if (!input || !input.trim()) return { rows, errors };

  const lines = input.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows, errors };

  // Detect & skip header
  let startIdx = 0;
  const firstCols = splitCsvRow(lines[0]).map((c) => c.toLowerCase());
  if (firstCols.length >= 7 && firstCols[0] === "date" && firstCols[1] === "platform") {
    startIdx = 1;
  }

  for (let i = startIdx; i < lines.length; i++) {
    const lineNum = i + 1;
    const cols = splitCsvRow(lines[i]);
    if (cols.length < 7) {
      errors.push({ line: lineNum, message: `Expected 7 columns, got ${cols.length}` });
      continue;
    }
    const [dateStr, platformStr, followersStr, postsStr, engagementStr, impressionsStr, reachStr] = cols;
    if (!isValidIsoDate(dateStr)) {
      errors.push({ line: lineNum, message: `Invalid date "${dateStr}" (use YYYY-MM-DD)` });
      continue;
    }
    const platform = normalizePlatform(platformStr);
    if (!platform) {
      errors.push({ line: lineNum, message: `Unknown platform "${platformStr}"` });
      continue;
    }
    const followers = Number(followersStr);
    const posts = Number(postsStr);
    const engagement = Number(engagementStr);
    const impressions = Number(impressionsStr);
    const reach = Number(reachStr);
    if ([followers, posts, engagement, impressions, reach].some((n) => !isFinite(n) || n < 0)) {
      errors.push({ line: lineNum, message: `Non-numeric or negative metric values` });
      continue;
    }
    rows.push({ date: dateStr, platform, followers, posts, engagement, impressions, reach });
  }

  return { rows, errors };
}

// ---- Date grouping ----

/** Compute the date-group key for a row's ISO date. */
export function groupDate(isoDate: string, grouping: DateGrouping): string {
  const d = new Date(isoDate + "T00:00:00Z");
  if (grouping === "daily") return isoDate;
  if (grouping === "monthly") return isoDate.slice(0, 7); // YYYY-MM
  // weekly — ISO year-week
  const { year, week } = getIsoWeek(d);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Filter rows by platform. */
export function filterByPlatform(rows: AnalyticsRow[], filter: PlatformFilter): AnalyticsRow[] {
  if (filter === "all") return rows;
  return rows.filter((r) => r.platform === filter);
}

/** Group rows by date key and compute metric stats per group. */
export function groupMetrics(
  rows: AnalyticsRow[],
  grouping: DateGrouping,
  metric: Metric,
  platformFilter: PlatformFilter = "all",
): GroupedMetric[] {
  const filtered = filterByPlatform(rows, platformFilter);
  const buckets = new Map<string, number[]>();
  for (const r of filtered) {
    const key = groupDate(r.date, grouping);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(getMetricValue(r, metric));
  }
  const out: GroupedMetric[] = [];
  for (const [group, values] of buckets) {
    const total = values.reduce((a, b) => a + b, 0);
    const avg = values.length ? total / values.length : 0;
    out.push({ group, total, avg, count: values.length });
  }
  out.sort((a, b) => a.group.localeCompare(b.group));
  return out;
}

/** Per-platform aggregator: group by platform. */
export function aggregateByPlatform(rows: AnalyticsRow[]): Map<Platform, AnalyticsRow[]> {
  const out = new Map<Platform, AnalyticsRow[]>();
  for (const r of rows) {
    if (!out.has(r.platform)) out.set(r.platform, []);
    out.get(r.platform)!.push(r);
  }
  for (const list of out.values()) list.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

// ---- Growth rate ----

/** Compute growth rate (period-over-period) in percent. */
export function calculateGrowthRate(current: number, previous: number): GrowthRate {
  let rate = 0;
  let direction: "up" | "down" | "flat" = "flat";
  if (previous === 0) {
    rate = current > 0 ? Infinity : 0;
    direction = current > 0 ? "up" : "flat";
  } else {
    rate = ((current - previous) / Math.abs(previous)) * 100;
    if (rate > 0.01) direction = "up";
    else if (rate < -0.01) direction = "down";
    else direction = "flat";
  }
  return { current, previous, rate, direction };
}

/** Find the best (max-total) period. */
export function findBestPeriod(groups: GroupedMetric[]): PeriodPerformance | null {
  if (groups.length === 0) return null;
  let best = groups[0];
  for (const g of groups) if (g.total > best.total) best = g;
  return { group: best.group, value: best.total };
}

/** Find the worst (min-total) period. */
export function findWorstPeriod(groups: GroupedMetric[]): PeriodPerformance | null {
  if (groups.length === 0) return null;
  let worst = groups[0];
  for (const g of groups) if (g.total < worst.total) worst = g;
  return { group: worst.group, value: worst.total };
}

/** Period-over-period growth between the last two groups. */
export function computePeriodGrowth(groups: GroupedMetric[]): GrowthRate {
  if (groups.length < 2) return calculateGrowthRate(0, 0);
  const last = groups[groups.length - 1];
  const prev = groups[groups.length - 2];
  return calculateGrowthRate(last.total, prev.total);
}

// ---- ASCII charts ----

export const BAR_WIDTH = 30;

/** Render a horizontal ASCII bar chart (30-char width). */
export function renderAsciiBarChart(groups: GroupedMetric[], metric: Metric): string {
  if (groups.length === 0) return "(no data)";
  const max = Math.max(...groups.map((g) => g.total), 1);
  const labelWidth = Math.max(...groups.map((g) => g.group.length), 8);
  const lines: string[] = [];
  lines.push(`${METRIC_LABELS[metric]} by ${groups.length} group(s) — max ${formatNumber(max)}`);
  for (const g of groups) {
    const filled = Math.round((g.total / max) * BAR_WIDTH);
    const empty = BAR_WIDTH - filled;
    const bar = "█".repeat(filled) + "░".repeat(empty);
    lines.push(
      `${g.group.padEnd(labelWidth)} |${bar}| ${formatNumber(g.total)}`,
    );
  }
  return lines.join("\n");
}

export const LINE_GRID_W = 10;
export const LINE_GRID_H = 5;

/** Render an ASCII line chart on a 10×5 grid. */
export function renderAsciiLineChart(groups: GroupedMetric[], metric: Metric): string {
  if (groups.length === 0) return "(no data)";
  // Bucket into 10 points
  const n = groups.length;
  const points: number[] = [];
  if (n <= LINE_GRID_W) {
    for (const g of groups) points.push(g.total);
    while (points.length < LINE_GRID_W) points.push(NaN);
  } else {
    for (let i = 0; i < LINE_GRID_W; i++) {
      const idx = Math.min(n - 1, Math.floor((i / (LINE_GRID_W - 1)) * (n - 1)));
      points.push(groups[idx].total);
    }
  }
  const validPoints = points.filter((p) => !isNaN(p));
  const max = Math.max(...validPoints, 1);
  const min = Math.min(...validPoints, 0);
  const span = max - min || 1;
  const grid: string[][] = Array.from({ length: LINE_GRID_H }, () =>
    Array.from({ length: LINE_GRID_W }, () => " "),
  );
  for (let x = 0; x < LINE_GRID_W; x++) {
    const v = points[x];
    if (isNaN(v)) continue;
    const norm = (v - min) / span;
    const y = LINE_GRID_H - 1 - Math.round(norm * (LINE_GRID_H - 1));
    grid[y][x] = "●";
    // draw connector line between consecutive points
    if (x > 0 && !isNaN(points[x - 1])) {
      const prevNorm = (points[x - 1] - min) / span;
      const prevY = LINE_GRID_H - 1 - Math.round(prevNorm * (LINE_GRID_H - 1));
      const lo = Math.min(prevY, y);
      const hi = Math.max(prevY, y);
      for (let yy = lo + 1; yy < hi; yy++) {
        if (grid[yy][x - 1] === " ") grid[yy][x - 1] = "│";
      }
    }
  }
  const lines: string[] = [];
  lines.push(`${METRIC_LABELS[metric]} trend (min ${formatNumber(min)} → max ${formatNumber(max)})`);
  for (let y = 0; y < LINE_GRID_H; y++) {
    const level = LINE_GRID_H - y;
    lines.push(`${level}|${grid[y].join("")}`);
  }
  lines.push(` +${"─".repeat(LINE_GRID_W)}`);
  lines.push(`  ${Array.from({ length: LINE_GRID_W }, (_, i) => String(i + 1).padStart(1)).join(" ")}`);
  return lines.join("\n");
}

// ---- KPI cards ----

/** Render a text KPI card (fixed 24-char inner width). */
export function renderKpiCard(label: string, value: string | number, suffix = ""): string {
  const v = typeof value === "number" ? formatNumber(value) : String(value);
  const innerLabel = label.length > 22 ? label.slice(0, 22) : label;
  const innerValue = (v + suffix).length > 22 ? (v + suffix).slice(0, 22) : (v + suffix);
  const top = "┌" + "─".repeat(24) + "┐";
  const mid1 = "│ " + innerLabel.padEnd(22) + " │";
  const mid2 = "│ " + innerValue.padEnd(22) + " │";
  const bot = "└" + "─".repeat(24) + "┘";
  return [top, mid1, mid2, bot].join("\n");
}

/** Render multiple KPI cards in a vertical stack. */
export function renderKpiCards(cards: { label: string; value: string | number; suffix?: string }[]): string {
  if (cards.length === 0) return "(no KPIs)";
  return cards.map((c) => renderKpiCard(c.label, c.value, c.suffix ?? "")).join("\n");
}

// ---- Trend analysis ----

/** Analyze follower growth trend (improving/declining/stable) using linear slope. */
export function analyzeFollowerTrend(
  rows: AnalyticsRow[],
  platformFilter: PlatformFilter = "all",
): TrendAnalysis {
  const filtered = filterByPlatform(rows, platformFilter);
  if (filtered.length === 0) {
    return { trend: "stable", slope: 0, startValue: 0, endValue: 0, samples: 0 };
  }
  // Group by date, sum followers
  const byDate = new Map<string, number>();
  for (const r of filtered) {
    byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.followers);
  }
  const dates = Array.from(byDate.keys()).sort();
  const values = dates.map((d) => byDate.get(d)!);
  const n = values.length;
  const startValue = values[0];
  const endValue = values[n - 1];
  // Simple linear regression slope
  const xs = dates.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (values[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  let trend: "improving" | "declining" | "stable" = "stable";
  // Threshold: slope > 1% of mean per step → improving; < -1% → declining
  const threshold = Math.abs(meanY) * 0.01;
  if (slope > threshold) trend = "improving";
  else if (slope < -threshold) trend = "declining";
  return { trend, slope, startValue, endValue, samples: n };
}

// ---- Platform comparison ----

/** Compute per-platform stats for a comparison table. */
export function computePlatformComparison(rows: AnalyticsRow[]): PlatformStats[] {
  const byPlatform = aggregateByPlatform(rows);
  const out: PlatformStats[] = [];
  for (const [platform, list] of byPlatform) {
    const totalFollowers = list.reduce((a, b) => a + b.followers, 0);
    const avgFollowers = list.length ? totalFollowers / list.length : 0;
    const lastFollowers = list.length ? list[list.length - 1].followers : 0;
    const firstFollowers = list.length ? list[0].followers : 0;
    const totalPosts = list.reduce((a, b) => a + b.posts, 0);
    const totalEngagement = list.reduce((a, b) => a + b.engagement, 0);
    const totalImpressions = list.reduce((a, b) => a + b.impressions, 0);
    const totalReach = list.reduce((a, b) => a + b.reach, 0);
    const engagementRate = totalImpressions ? (totalEngagement / totalImpressions) * 100 : 0;
    const followerGrowth = calculateGrowthRate(lastFollowers, firstFollowers);
    out.push({
      platform,
      rows: list.length,
      totalFollowers,
      avgFollowers,
      lastFollowers,
      totalPosts,
      totalEngagement,
      totalImpressions,
      totalReach,
      engagementRate,
      followerGrowth,
    });
  }
  out.sort((a, b) => b.lastFollowers - a.lastFollowers);
  return out;
}

// ---- Summary stats ----

/** Compute top-level summary stats. */
export function computeSummaryStats(rows: AnalyticsRow[]): SummaryStats {
  const platforms = new Set(rows.map((r) => r.platform));
  const byPlatform = aggregateByPlatform(rows);
  let totalFollowers = 0;
  let totalEngagement = 0;
  let totalImpressions = 0;
  let totalReach = 0;
  let totalPosts = 0;
  for (const list of byPlatform.values()) {
    if (list.length) totalFollowers += list[list.length - 1].followers;
    for (const r of list) {
      totalEngagement += r.engagement;
      totalImpressions += r.impressions;
      totalReach += r.reach;
      totalPosts += r.posts;
    }
  }
  const avgEngagementRate = totalImpressions ? (totalEngagement / totalImpressions) * 100 : 0;
  return {
    totalPlatforms: platforms.size,
    totalRows: rows.length,
    totalFollowers,
    avgEngagementRate,
    totalImpressions,
    totalReach,
    totalEngagement,
    totalPosts,
  };
}

// ---- Renderers ----

/** Re-export rows as CSV. */
export function renderCsv(rows: AnalyticsRow[]): string {
  const lines = [CSV_HEADER.join(",")];
  for (const r of rows) {
    lines.push([
      r.date,
      r.platform,
      r.followers,
      r.posts,
      r.engagement,
      r.impressions,
      r.reach,
    ].join(","));
  }
  return lines.join("\n");
}

/** Render a text dashboard combining all parts. */
export function renderTextDashboard(
  summary: SummaryStats,
  groups: GroupedMetric[],
  metric: Metric,
  grouping: DateGrouping,
  platformFilter: PlatformFilter,
  growth: GrowthRate,
  best: PeriodPerformance | null,
  worst: PeriodPerformance | null,
  trend: TrendAnalysis,
  platformComparison: PlatformStats[],
): string {
  const lines: string[] = [];
  lines.push("=".repeat(60));
  lines.push("  SOCIAL MEDIA ANALYTICS DASHBOARD");
  lines.push("=".repeat(60));
  lines.push("");
  lines.push("-- SUMMARY --");
  lines.push(`  Total platforms : ${summary.totalPlatforms}`);
  lines.push(`  Total rows      : ${summary.totalRows}`);
  lines.push(`  Total followers : ${formatNumber(summary.totalFollowers)}`);
  lines.push(`  Total posts     : ${formatNumber(summary.totalPosts)}`);
  lines.push(`  Avg engagement  : ${summary.avgEngagementRate.toFixed(2)}%`);
  lines.push(`  Total impress.  : ${formatNumber(summary.totalImpressions)}`);
  lines.push(`  Total reach     : ${formatNumber(summary.totalReach)}`);
  lines.push("");
  lines.push(
    `-- ${METRIC_LABELS[metric]} (${DATE_GROUPING_LABELS[grouping]}, platform: ${platformFilter}) --`,
  );
  lines.push(renderAsciiBarChart(groups, metric));
  lines.push("");
  lines.push(renderAsciiLineChart(groups, metric));
  lines.push("");
  lines.push("-- GROWTH (last vs previous period) --");
  lines.push(`  Current  : ${formatNumber(growth.current)}`);
  lines.push(`  Previous : ${formatNumber(growth.previous)}`);
  lines.push(`  Rate     : ${isFinite(growth.rate) ? growth.rate.toFixed(2) + "%" : "∞"}`);
  lines.push(`  Direction: ${growth.direction}`);
  lines.push("");
  lines.push("-- BEST / WORST PERIOD --");
  lines.push(best ? `  Best  : ${best.group} (${formatNumber(best.value)})` : "  Best  : (none)");
  lines.push(worst ? `  Worst : ${worst.group} (${formatNumber(worst.value)})` : "  Worst : (none)");
  lines.push("");
  lines.push("-- FOLLOWER TREND --");
  lines.push(`  Trend   : ${trend.trend.toUpperCase()}`);
  lines.push(`  Slope   : ${trend.slope.toFixed(2)} / period`);
  lines.push(`  Start   : ${formatNumber(trend.startValue)}`);
  lines.push(`  End     : ${formatNumber(trend.endValue)}`);
  lines.push(`  Samples : ${trend.samples}`);
  lines.push("");
  lines.push("-- PLATFORM COMPARISON --");
  lines.push(
    "platform".padEnd(10) +
    "rows".padStart(6) +
    "followers".padStart(12) +
    "posts".padStart(8) +
    "eng%".padStart(8) +
    "growth%".padStart(10),
  );
  for (const p of platformComparison) {
    lines.push(
      p.platform.padEnd(10) +
      String(p.rows).padStart(6) +
      formatNumber(p.lastFollowers).padStart(12) +
      String(p.totalPosts).padStart(8) +
      p.engagementRate.toFixed(1).padStart(8) +
      (isFinite(p.followerGrowth.rate) ? p.followerGrowth.rate.toFixed(1) : "∞").padStart(10),
    );
  }
  lines.push("");
  lines.push("=".repeat(60));
  return lines.join("\n");
}

/** Render an HTML dashboard with inline CSS (email-friendly). */
export function renderHtmlDashboard(
  summary: SummaryStats,
  groups: GroupedMetric[],
  metric: Metric,
  grouping: DateGrouping,
  platformFilter: PlatformFilter,
  growth: GrowthRate,
  best: PeriodPerformance | null,
  worst: PeriodPerformance | null,
  trend: TrendAnalysis,
  platformComparison: PlatformStats[],
): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const growthStr = isFinite(growth.rate) ? `${growth.rate.toFixed(2)}%` : "∞";
  const growthColor = growth.direction === "up" ? "#16a34a" : growth.direction === "down" ? "#dc2626" : "#6b7280";
  const trendColor = trend.trend === "improving" ? "#16a34a" : trend.trend === "declining" ? "#dc2626" : "#6b7280";

  const kpiCells = [
    { label: "Platforms", value: String(summary.totalPlatforms) },
    { label: "Followers", value: formatNumber(summary.totalFollowers) },
    { label: "Posts", value: formatNumber(summary.totalPosts) },
    { label: "Avg Eng. Rate", value: `${summary.avgEngagementRate.toFixed(2)}%` },
    { label: "Impressions", value: formatNumber(summary.totalImpressions) },
    { label: "Reach", value: formatNumber(summary.totalReach) },
  ].map((k) =>
    `<td style="padding:12px;border:1px solid #e5e7eb;text-align:center;background:#f9fafb;">
      <div style="font-size:11px;text-transform:uppercase;color:#6b7280;">${esc(k.label)}</div>
      <div style="font-size:18px;font-weight:bold;color:#111827;">${esc(k.value)}</div>
    </td>`,
  ).join("");

  const barRows = groups.map((g) => {
    const max = Math.max(...groups.map((x) => x.total), 1);
    const pct = Math.round((g.total / max) * 100);
    return `<tr>
      <td style="padding:4px 8px;border:1px solid #e5e7eb;font-family:monospace;">${esc(g.group)}</td>
      <td style="padding:4px 8px;border:1px solid #e5e7eb;">
        <div style="background:#3b82f6;height:14px;width:${pct}%;border-radius:3px;"></div>
      </td>
      <td style="padding:4px 8px;border:1px solid #e5e7eb;text-align:right;font-family:monospace;">${esc(formatNumber(g.total))}</td>
    </tr>`;
  }).join("");

  const compRows = platformComparison.map((p) =>
    `<tr>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;">${esc(PLATFORM_LABELS[p.platform])}</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;">${p.rows}</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;">${esc(formatNumber(p.lastFollowers))}</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;">${p.totalPosts}</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;">${p.engagementRate.toFixed(2)}%</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;color:${
        p.followerGrowth.direction === "up" ? "#16a34a" : p.followerGrowth.direction === "down" ? "#dc2626" : "#6b7280"
      };font-weight:bold;">${isFinite(p.followerGrowth.rate) ? p.followerGrowth.rate.toFixed(2) + "%" : "∞"}</td>
    </tr>`,
  ).join("");

  const bestStr = best ? `${esc(best.group)} (${esc(formatNumber(best.value))})` : "—";
  const worstStr = worst ? `${esc(worst.group)} (${esc(formatNumber(worst.value))})` : "—";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Social Media Analytics Dashboard</title></head>
<body style="margin:0;padding:20px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111827;">
  <div style="max-width:680px;margin:0 auto;">
    <h1 style="font-size:22px;margin:0 0 4px 0;color:#111827;">📊 Social Media Analytics Dashboard</h1>
    <p style="font-size:12px;color:#6b7280;margin:0 0 16px 0;">
      Metric: <strong>${esc(METRIC_LABELS[metric])}</strong> · Grouping: <strong>${esc(DATE_GROUPING_LABELS[grouping])}</strong> · Platform: <strong>${esc(platformFilter)}</strong>
    </p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr>${kpiCells}</tr>
    </table>

    <h2 style="font-size:16px;margin:16px 0 8px 0;color:#374151;">${esc(METRIC_LABELS[metric])} by ${esc(DATE_GROUPING_LABELS[grouping])}</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left;">Group</th>
          <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left;">Bar</th>
          <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>${barRows}</tbody>
    </table>

    <h2 style="font-size:16px;margin:20px 0 8px 0;color:#374151;">Growth &amp; Trend</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px;">
      <tr>
        <td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;">Period-over-period growth</td>
        <td style="padding:8px;border:1px solid #e5e7eb;color:${growthColor};font-weight:bold;">${growthStr} (${growth.direction})</td>
      </tr>
      <tr>
        <td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;">Follower trend</td>
        <td style="padding:8px;border:1px solid #e5e7eb;color:${trendColor};font-weight:bold;text-transform:uppercase;">${trend.trend} (slope ${trend.slope.toFixed(2)})</td>
      </tr>
      <tr>
        <td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;">Best period</td>
        <td style="padding:8px;border:1px solid #e5e7eb;color:#16a34a;font-weight:bold;">${bestStr}</td>
      </tr>
      <tr>
        <td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;">Worst period</td>
        <td style="padding:8px;border:1px solid #e5e7eb;color:#dc2626;font-weight:bold;">${worstStr}</td>
      </tr>
    </table>

    <h2 style="font-size:16px;margin:16px 0 8px 0;color:#374151;">Platform Comparison</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left;">Platform</th>
          <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;">Rows</th>
          <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;">Followers</th>
          <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;">Posts</th>
          <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;">Eng. %</th>
          <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;">Growth %</th>
        </tr>
      </thead>
      <tbody>${compRows}</tbody>
    </table>

    <p style="font-size:10px;color:#9ca3af;margin-top:20px;text-align:center;">
      Generated locally by UnQTools Social Media Analytics Dashboard · 100% client-side.
    </p>
  </div>
</body>
</html>`;
}

/** Render a Markdown dashboard. */
export function renderMarkdownDashboard(
  summary: SummaryStats,
  groups: GroupedMetric[],
  metric: Metric,
  grouping: DateGrouping,
  platformFilter: PlatformFilter,
  growth: GrowthRate,
  best: PeriodPerformance | null,
  worst: PeriodPerformance | null,
  trend: TrendAnalysis,
  platformComparison: PlatformStats[],
): string {
  const lines: string[] = [];
  lines.push("# 📊 Social Media Analytics Dashboard");
  lines.push("");
  lines.push(`> **Metric:** ${METRIC_LABELS[metric]} · **Grouping:** ${DATE_GROUPING_LABELS[grouping]} · **Platform:** ${platformFilter}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| KPI | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Platforms | ${summary.totalPlatforms} |`);
  lines.push(`| Total rows | ${summary.totalRows} |`);
  lines.push(`| Total followers | ${formatNumber(summary.totalFollowers)} |`);
  lines.push(`| Total posts | ${formatNumber(summary.totalPosts)} |`);
  lines.push(`| Avg engagement rate | ${summary.avgEngagementRate.toFixed(2)}% |`);
  lines.push(`| Total impressions | ${formatNumber(summary.totalImpressions)} |`);
  lines.push(`| Total reach | ${formatNumber(summary.totalReach)} |`);
  lines.push("");
  lines.push(`## ${METRIC_LABELS[metric]} by ${DATE_GROUPING_LABELS[grouping]}`);
  lines.push("");
  lines.push("| Group | Total | Avg | Count |");
  lines.push("| --- | --- | --- | --- |");
  for (const g of groups) {
    lines.push(`| ${g.group} | ${formatNumber(g.total)} | ${formatNumber(g.avg)} | ${g.count} |`);
  }
  lines.push("");
  lines.push("## ASCII Bar Chart");
  lines.push("");
  lines.push("```");
  lines.push(renderAsciiBarChart(groups, metric));
  lines.push("```");
  lines.push("");
  lines.push("## ASCII Line Chart");
  lines.push("");
  lines.push("```");
  lines.push(renderAsciiLineChart(groups, metric));
  lines.push("```");
  lines.push("");
  lines.push("## Growth & Trend");
  lines.push("");
  const growthStr = isFinite(growth.rate) ? `${growth.rate.toFixed(2)}%` : "∞";
  lines.push(`- **Period-over-period growth:** ${growthStr} (${growth.direction})`);
  lines.push(`- **Follower trend:** ${trend.trend.toUpperCase()} (slope ${trend.slope.toFixed(2)} / period)`);
  lines.push(`- **Best period:** ${best ? `${best.group} (${formatNumber(best.value)})` : "—"}`);
  lines.push(`- **Worst period:** ${worst ? `${worst.group} (${formatNumber(worst.value)})` : "—"}`);
  lines.push("");
  lines.push("## Platform Comparison");
  lines.push("");
  lines.push("| Platform | Rows | Followers | Posts | Eng. % | Growth % |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const p of platformComparison) {
    const g = isFinite(p.followerGrowth.rate) ? p.followerGrowth.rate.toFixed(2) + "%" : "∞";
    lines.push(
      `| ${PLATFORM_LABELS[p.platform]} | ${p.rows} | ${formatNumber(p.lastFollowers)} | ${p.totalPosts} | ${p.engagementRate.toFixed(2)}% | ${g} |`,
    );
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("_Generated locally by UnQTools · 100% client-side._");
  return lines.join("\n");
}

/** Build the full dashboard bundle from rows + options. */
export function buildDashboard(
  rows: AnalyticsRow[],
  metric: Metric,
  grouping: DateGrouping,
  platformFilter: PlatformFilter,
): DashboardBundle {
  const summary = computeSummaryStats(rows);
  const groups = groupMetrics(rows, grouping, metric, platformFilter);
  const barChart = renderAsciiBarChart(groups, metric);
  const lineChart = renderAsciiLineChart(groups, metric);
  const kpiCards = renderKpiCards([
    { label: "Platforms", value: summary.totalPlatforms },
    { label: "Followers", value: summary.totalFollowers },
    { label: "Avg Eng. %", value: summary.avgEngagementRate.toFixed(2) },
    { label: "Impressions", value: summary.totalImpressions },
    { label: "Reach", value: summary.totalReach },
  ]);
  const bestPeriod = findBestPeriod(groups);
  const worstPeriod = findWorstPeriod(groups);
  const growth = computePeriodGrowth(groups);
  const platformComparison = computePlatformComparison(rows);
  const trend = analyzeFollowerTrend(rows, platformFilter);
  const textDashboard = renderTextDashboard(
    summary, groups, metric, grouping, platformFilter,
    growth, bestPeriod, worstPeriod, trend, platformComparison,
  );
  const htmlDashboard = renderHtmlDashboard(
    summary, groups, metric, grouping, platformFilter,
    growth, bestPeriod, worstPeriod, trend, platformComparison,
  );
  const markdownDashboard = renderMarkdownDashboard(
    summary, groups, metric, grouping, platformFilter,
    growth, bestPeriod, worstPeriod, trend, platformComparison,
  );
  return {
    summary, groups, barChart, lineChart, kpiCards,
    bestPeriod, worstPeriod, growth, platformComparison, trend,
    textDashboard, htmlDashboard, markdownDashboard,
  };
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:social-media-analytics-dashboard:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  rowCount: number;
  platformFilter: PlatformFilter;
  metric: Metric;
  grouping: DateGrouping;
  totalFollowers: number;
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

export function buildShareUrl(
  data: string,
  metric: Metric,
  grouping: DateGrouping,
  platformFilter: PlatformFilter,
): string {
  const params = new URLSearchParams();
  if (data) params.set("data", data);
  if (metric) params.set("metric", metric);
  if (grouping) params.set("grouping", grouping);
  if (platformFilter) params.set("platform", platformFilter);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): {
  data: string;
  metric: Metric;
  grouping: DateGrouping;
  platformFilter: PlatformFilter;
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const fallback: { data: string; metric: Metric; grouping: DateGrouping; platformFilter: PlatformFilter } = {
    data: "",
    metric: "followers",
    grouping: "monthly",
    platformFilter: "all",
  };
  if (!clean) return fallback;
  const params = new URLSearchParams(clean);
  return {
    data: params.get("data") ?? "",
    metric: (METRICS.includes(params.get("metric") as Metric) ? params.get("metric") : "followers") as Metric,
    grouping: (DATE_GROUPINGS.includes(params.get("grouping") as DateGrouping) ? params.get("grouping") : "monthly") as DateGrouping,
    platformFilter: (platformFilterValid(params.get("platform")) ? params.get("platform") : "all") as PlatformFilter,
  };
}

function platformFilterValid(s: string | null): boolean {
  if (!s) return false;
  if (s === "all") return true;
  return PLATFORMS.includes(s as Platform);
}

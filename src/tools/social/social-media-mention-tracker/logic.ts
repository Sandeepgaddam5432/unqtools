/**
 * Social Media Mention Tracker — pure logic.
 *
 * Parse CSV of brand mentions, match brand names, compute sentiment,
 * aggregate per-platform, find top authors, estimate reach, analyze trends.
 * Pure functions only — no DOM, no network.
 */

export type Platform =
  | "twitter"
  | "reddit"
  | "linkedin"
  | "youtube"
  | "hackernews"
  | "producthunt";

export type Sentiment = -1 | 0 | 1;

export interface MentionInput {
  date: string; // YYYY-MM-DD
  platform: Platform;
  author: string;
  content: string;
  url: string;
  sentiment?: Sentiment; // user-provided; if undefined, computed via keywords
}

export interface MentionRecord extends MentionInput {
  computedSentiment: Sentiment;
  sentimentSource: "user" | "computed";
  reach: number; // estimated
  matchesBrand: boolean;
  matchedAlias: string | null;
}

export interface PlatformCount {
  platform: Platform;
  count: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  totalReach: number;
  avgReach: number;
}

export interface AuthorCount {
  author: string;
  count: number;
  totalReach: number;
  platforms: Platform[];
}

export interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
  avgScore: number; // -1..1
}

export interface SummaryStats {
  totalMentions: number;
  brandMentions: number;
  uniqueAuthors: number;
  totalReach: number;
  avgReach: number;
  byPlatform: PlatformCount[];
  sentiment: SentimentBreakdown;
}

export interface TrendPoint {
  date: string;
  count: number;
  avgSentiment: number;
}

export interface MentionVelocity {
  mentionsPerDay: number;
  totalDays: number;
  totalMentions: number;
}

export interface SentimentTrend {
  firstHalfAvg: number;
  secondHalfAvg: number;
  direction: "improving" | "declining" | "flat";
}

export interface AlertCheck {
  threshold: number; // mentions per day
  triggered: boolean;
  currentPerDay: number;
  maxDayCount: number;
  maxDayDate: string | null;
}

export interface ParseError {
  line: number;
  message: string;
}

export interface ParseResult {
  mentions: MentionInput[];
  errors: ParseError[];
}

export const PLATFORMS: Platform[] = [
  "twitter", "reddit", "linkedin", "youtube", "hackernews", "producthunt",
];

export const PLATFORM_LABELS: Record<Platform, string> = {
  twitter: "Twitter / X",
  reddit: "Reddit",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  hackernews: "Hacker News",
  producthunt: "Product Hunt",
};

/** Per-platform base reach heuristic (typical audience size). */
export const PLATFORM_BASE_REACH: Record<Platform, number> = {
  twitter: 800,
  reddit: 500,
  linkedin: 1500,
  youtube: 2500,
  hackernews: 2000,
  producthunt: 1200,
};

const POSITIVE_WORDS = [
  "great", "love", "amazing", "awesome", "excellent", "fantastic",
  "wonderful", "best", "good", "happy", "delighted", "perfect",
  "brilliant", "outstanding", "superb", "fabulous", "remarkable",
  "impressive", "stellar", "lovely", "enjoy", "enjoyed", "favorite",
  "recommend", "recommended", "win", "winner", "praise", "kudos",
  "thumbs up", "applaud",
];

const NEGATIVE_WORDS = [
  "bad", "hate", "terrible", "awful", "horrible", "worst",
  "disappointing", "disappointed", "poor", "broken", "buggy",
  "useless", "crash", "crashed", "fails", "failed", "failure",
  "annoying", "frustrated", "frustrating", "rip-off", "scam",
  "garbage", "trash", "rubbish", "meh", "miserable", "subpar",
  "lame", "overpriced",
];

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

/** Parse brand aliases from comma-separated string. */
export function parseAliases(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Build regex to match brand or any alias (case-insensitive, word-ish). */
export function buildBrandMatcher(brandName: string, aliases: string[]): { names: string[]; test: (s: string) => boolean; findMatch: (s: string) => string | null } {
  const names = [brandName.trim(), ...aliases].map((n) => n.trim()).filter(Boolean);
  const unique = Array.from(new Set(names.map((n) => n.toLowerCase())));
  return {
    names: unique,
    test: (s: string) => {
      if (unique.length === 0) return false;
      const lower = s.toLowerCase();
      return unique.some((n) => lower.includes(n));
    },
    findMatch: (s: string): string | null => {
      const lower = s.toLowerCase();
      for (const n of unique) {
        if (lower.includes(n)) return n;
      }
      return null;
    },
  };
}

/** Parse a single CSV mention line. */
export function parseMentionLine(line: string, lineNum: number): { mention: MentionInput | null; error: ParseError | null } {
  const trimmed = line.trim();
  if (!trimmed) return { mention: null, error: null };
  const parts = splitCsvRow(trimmed);
  if (parts.length < 5) {
    return { mention: null, error: { line: lineNum, message: `Expected 5-6 fields, got ${parts.length}` } };
  }
  const [date, platformStr, author, content, url, sentimentStr] = parts;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { mention: null, error: { line: lineNum, message: `Invalid date "${date}" (use YYYY-MM-DD)` } };
  }
  const platform = platformStr.toLowerCase().trim() as Platform;
  if (!PLATFORMS.includes(platform)) {
    return { mention: null, error: { line: lineNum, message: `Unknown platform "${platformStr}"` } };
  }
  let sentiment: Sentiment | undefined = undefined;
  if (sentimentStr !== undefined && sentimentStr.trim() !== "") {
    const n = Number(sentimentStr.trim());
    if (n !== -1 && n !== 0 && n !== 1) {
      return { mention: null, error: { line: lineNum, message: `Sentiment must be -1, 0, or 1 (got "${sentimentStr}")` } };
    }
    sentiment = n as Sentiment;
  }
  return {
    mention: {
      date,
      platform,
      author: author.trim(),
      content: content.trim(),
      url: url.trim(),
      sentiment,
    },
    error: null,
  };
}

/** Parse the full CSV textarea. */
export function parseMentions(input: string): ParseResult {
  const mentions: MentionInput[] = [];
  const errors: ParseError[] = [];
  const lines = input.split(/\r?\n/);
  let lineNum = 0;
  for (const raw of lines) {
    lineNum++;
    if (!raw.trim()) continue;
    if (lineNum === 1 && /^date\s*,\s*platform/i.test(raw.trim())) continue;
    const { mention, error } = parseMentionLine(raw, lineNum);
    if (error) errors.push(error);
    if (mention) mentions.push(mention);
  }
  return { mentions, errors };
}

/** Compute sentiment via keyword analysis. */
export function computeSentimentFromContent(content: string): Sentiment {
  if (!content) return 0;
  const lower = content.toLowerCase();
  let score = 0;
  for (const w of POSITIVE_WORDS) if (lower.includes(w)) score += 1;
  for (const w of NEGATIVE_WORDS) if (lower.includes(w)) score -= 1;
  if (score > 0) return 1;
  if (score < 0) return -1;
  return 0;
}

/** Filter mentions by date range (inclusive). */
export function filterByDateRange<T extends MentionInput>(mentions: T[], start?: string, end?: string): T[] {
  if (!start && !end) return mentions;
  return mentions.filter((m) => {
    if (start && m.date < start) return false;
    if (end && m.date > end) return false;
    return true;
  });
}

/** Filter by platform. */
export function filterByPlatform<T extends MentionInput>(mentions: T[], platforms: Platform[]): T[] {
  if (platforms.length === 0) return mentions;
  return mentions.filter((m) => platforms.includes(m.platform));
}

/** Enrich a mention with computed sentiment, reach, brand match. */
export function enrichMention(m: MentionInput, matcher: ReturnType<typeof buildBrandMatcher>): MentionRecord {
  const matchedAlias = matcher.findMatch(m.content + " " + m.author);
  const matchesBrand = matcher.test(m.content + " " + m.author);
  let computedSentiment: Sentiment;
  let sentimentSource: "user" | "computed";
  if (m.sentiment !== undefined) {
    computedSentiment = m.sentiment;
    sentimentSource = "user";
  } else {
    computedSentiment = computeSentimentFromContent(m.content);
    sentimentSource = "computed";
  }
  const reach = estimateReach(m.platform, m.author);
  return { ...m, computedSentiment, sentimentSource, reach, matchesBrand, matchedAlias };
}

/** Estimate reach based on platform + author (heuristic). */
export function estimateReach(platform: Platform, author: string): number {
  const base = PLATFORM_BASE_REACH[platform];
  // Hash author name to deterministic "follower count" multiplier between 0.5x and 5x
  let hash = 0;
  for (let i = 0; i < author.length; i++) {
    hash = (hash * 31 + author.charCodeAt(i)) | 0;
  }
  const multiplier = 0.5 + (Math.abs(hash) % 100) / 25; // 0.5 .. 4.5
  return Math.round(base * multiplier);
}

/** Search mentions for a query string. */
export function searchMentions(mentions: MentionRecord[], query: string): MentionRecord[] {
  if (!query.trim()) return mentions;
  const q = query.toLowerCase();
  return mentions.filter((m) =>
    m.content.toLowerCase().includes(q) ||
    m.author.toLowerCase().includes(q) ||
    m.url.toLowerCase().includes(q),
  );
}

/** Aggregate by platform. */
export function aggregateByPlatform(mentions: MentionRecord[]): PlatformCount[] {
  const map = new Map<Platform, MentionRecord[]>();
  for (const m of mentions) {
    if (!map.has(m.platform)) map.set(m.platform, []);
    map.get(m.platform)!.push(m);
  }
  const out: PlatformCount[] = [];
  for (const [platform, list] of map) {
    let positive = 0, neutral = 0, negative = 0, totalReach = 0;
    for (const m of list) {
      if (m.computedSentiment > 0) positive++;
      else if (m.computedSentiment < 0) negative++;
      else neutral++;
      totalReach += m.reach;
    }
    out.push({
      platform,
      count: list.length,
      positiveCount: positive,
      neutralCount: neutral,
      negativeCount: negative,
      totalReach,
      avgReach: list.length > 0 ? Math.round(totalReach / list.length) : 0,
    });
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}

/** Top authors by mention count. */
export function findTopAuthors(mentions: MentionRecord[], limit = 5): AuthorCount[] {
  const map = new Map<string, MentionRecord[]>();
  for (const m of mentions) {
    const key = m.author || "(unknown)";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  const out: AuthorCount[] = [];
  for (const [author, list] of map) {
    const platformSet = new Set<Platform>();
    let totalReach = 0;
    for (const m of list) { platformSet.add(m.platform); totalReach += m.reach; }
    out.push({ author, count: list.length, totalReach, platforms: Array.from(platformSet) });
  }
  out.sort((a, b) => b.count - a.count || b.totalReach - a.totalReach);
  return out.slice(0, limit);
}

/** Compute sentiment breakdown. */
export function computeSentimentBreakdown(mentions: MentionRecord[]): SentimentBreakdown {
  let positive = 0, neutral = 0, negative = 0, sum = 0;
  for (const m of mentions) {
    if (m.computedSentiment > 0) positive++;
    else if (m.computedSentiment < 0) negative++;
    else neutral++;
    sum += m.computedSentiment;
  }
  const avgScore = mentions.length > 0 ? sum / mentions.length : 0;
  return { positive, neutral, negative, avgScore };
}

/** Compute summary. */
export function computeSummary(mentions: MentionRecord[]): SummaryStats {
  const totalReach = mentions.reduce((acc, m) => acc + m.reach, 0);
  const authors = new Set(mentions.map((m) => m.author || "(unknown)"));
  const brandMentions = mentions.filter((m) => m.matchesBrand).length;
  return {
    totalMentions: mentions.length,
    brandMentions,
    uniqueAuthors: authors.size,
    totalReach,
    avgReach: mentions.length > 0 ? Math.round(totalReach / mentions.length) : 0,
    byPlatform: aggregateByPlatform(mentions),
    sentiment: computeSentimentBreakdown(mentions),
  };
}

/** Trend per day (sorted by date). */
export function computeTrend(mentions: MentionRecord[]): TrendPoint[] {
  const map = new Map<string, MentionRecord[]>();
  for (const m of mentions) {
    if (!map.has(m.date)) map.set(m.date, []);
    map.get(m.date)!.push(m);
  }
  const out: TrendPoint[] = [];
  for (const [date, list] of map) {
    const avg = list.reduce((acc, m) => acc + m.computedSentiment, 0) / list.length;
    out.push({ date, count: list.length, avgSentiment: avg });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/** Days between two YYYY-MM-DD dates. */
export function daysBetween(start: string, end: string): number {
  const s = new Date(start + "T00:00:00Z").getTime();
  const e = new Date(end + "T00:00:00Z").getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return 0;
  return Math.round((e - s) / (1000 * 60 * 60 * 24));
}

/** Compute mention velocity (mentions per day). */
export function computeVelocity(mentions: MentionRecord[]): MentionVelocity {
  if (mentions.length === 0) return { mentionsPerDay: 0, totalDays: 0, totalMentions: 0 };
  const dates = mentions.map((m) => m.date).sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];
  const totalDays = Math.max(1, daysBetween(minDate, maxDate) + 1);
  return {
    mentionsPerDay: mentions.length / totalDays,
    totalDays,
    totalMentions: mentions.length,
  };
}

/** Analyze sentiment trend (first half vs second half). */
export function analyzeSentimentTrend(mentions: MentionRecord[]): SentimentTrend | null {
  if (mentions.length < 2) return null;
  const sorted = [...mentions].sort((a, b) => a.date.localeCompare(b.date));
  const mid = Math.floor(sorted.length / 2);
  const first = sorted.slice(0, mid);
  const second = sorted.slice(mid);
  const avg = (list: MentionRecord[]): number => list.length === 0 ? 0 : list.reduce((a, m) => a + m.computedSentiment, 0) / list.length;
  const firstHalfAvg = avg(first);
  const secondHalfAvg = avg(second);
  const delta = secondHalfAvg - firstHalfAvg;
  const direction: SentimentTrend["direction"] =
    Math.abs(delta) < 0.1 ? "flat" : delta > 0 ? "improving" : "declining";
  return { firstHalfAvg, secondHalfAvg, direction };
}

/** Top mentions by reach. */
export function findTopMentionsByReach(mentions: MentionRecord[], limit = 10): MentionRecord[] {
  return [...mentions].sort((a, b) => b.reach - a.reach).slice(0, limit);
}

/** Check alert threshold (mentions per day). */
export function checkAlert(mentions: MentionRecord[], threshold: number): AlertCheck {
  if (mentions.length === 0 || threshold <= 0) {
    return { threshold, triggered: false, currentPerDay: 0, maxDayCount: 0, maxDayDate: null };
  }
  const velocity = computeVelocity(mentions);
  const trend = computeTrend(mentions);
  let maxDayCount = 0;
  let maxDayDate: string | null = null;
  for (const p of trend) {
    if (p.count > maxDayCount) {
      maxDayCount = p.count;
      maxDayDate = p.date;
    }
  }
  return {
    threshold,
    triggered: velocity.mentionsPerDay > threshold,
    currentPerDay: velocity.mentionsPerDay,
    maxDayCount,
    maxDayDate,
  };
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function sentimentLabel(s: Sentiment): string {
  return s > 0 ? "positive" : s < 0 ? "negative" : "neutral";
}

/** Render text report. */
export function renderText(mentions: MentionRecord[], brandName: string): string {
  if (mentions.length === 0) return "No mentions to report.";
  const summary = computeSummary(mentions);
  const topAuthors = findTopAuthors(mentions, 5);
  const topMentions = findTopMentionsByReach(mentions, 5);
  const velocity = computeVelocity(mentions);
  const sentimentTrend = analyzeSentimentTrend(mentions);
  const lines: string[] = [];
  lines.push("=== Social Media Mention Report ===");
  lines.push(`Brand: ${brandName || "(none)"}`);
  lines.push("");
  lines.push("--- Summary ---");
  lines.push(`Total mentions: ${summary.totalMentions}`);
  lines.push(`Brand matches: ${summary.brandMentions}`);
  lines.push(`Unique authors: ${summary.uniqueAuthors}`);
  lines.push(`Total estimated reach: ${summary.totalReach.toLocaleString()}`);
  lines.push(`Avg reach per mention: ${summary.avgReach.toLocaleString()}`);
  lines.push(`Mention velocity: ${velocity.mentionsPerDay.toFixed(2)} mentions/day over ${velocity.totalDays} day(s)`);
  lines.push(`Sentiment: ${summary.sentiment.positive} positive, ${summary.sentiment.neutral} neutral, ${summary.sentiment.negative} negative (avg score ${summary.sentiment.avgScore.toFixed(2)})`);
  if (sentimentTrend) {
    lines.push(`Sentiment trend: ${sentimentTrend.direction} (first half ${sentimentTrend.firstHalfAvg.toFixed(2)} → second half ${sentimentTrend.secondHalfAvg.toFixed(2)})`);
  }
  lines.push("");
  lines.push("--- By Platform ---");
  for (const p of summary.byPlatform) {
    lines.push(`${PLATFORM_LABELS[p.platform]}: ${p.count} mentions, ${p.totalReach.toLocaleString()} total reach, ${p.avgReach.toLocaleString()} avg reach (sentiment: +${p.positiveCount}/${p.neutralCount}/-${p.negativeCount})`);
  }
  lines.push("");
  lines.push("--- Top Authors ---");
  for (const a of topAuthors) {
    lines.push(`${a.author}: ${a.count} mentions, ${a.totalReach.toLocaleString()} reach (${a.platforms.map((p) => PLATFORM_LABELS[p]).join(", ")})`);
  }
  lines.push("");
  lines.push("--- Top Mentions by Reach ---");
  for (const m of topMentions) {
    lines.push(`[${PLATFORM_LABELS[m.platform]}] ${m.date} by ${m.author} (${m.reach.toLocaleString()} reach, ${sentimentLabel(m.computedSentiment)}) — ${m.content.slice(0, 80)}`);
  }
  return lines.join("\n");
}

/** Render CSV report. */
export function renderCsv(mentions: MentionRecord[]): string {
  const header = "date,platform,author,content,url,sentiment,reach,brand_match,sentiment_source";
  const lines = [header];
  for (const m of mentions) {
    lines.push([
      m.date,
      m.platform,
      escapeCsv(m.author),
      escapeCsv(m.content),
      escapeCsv(m.url),
      m.computedSentiment,
      m.reach,
      m.matchesBrand ? "yes" : "no",
      m.sentimentSource,
    ].join(","));
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:social-media-mention-tracker:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  brand: string;
  mentionCount: number;
  platformCount: number;
  avgSentiment: number;
  totalReach: number;
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
  brand: string;
  aliases: string;
  platforms: string; // comma-separated
  mentions: string;
  dateStart: string;
  dateEnd: string;
}

export function buildShareUrl(params: ShareParams): string {
  const p = new URLSearchParams();
  if (params.brand) p.set("brand", params.brand);
  if (params.aliases) p.set("aliases", params.aliases);
  if (params.platforms) p.set("platforms", params.platforms);
  if (params.mentions) p.set("mentions", params.mentions);
  if (params.dateStart) p.set("start", params.dateStart);
  if (params.dateEnd) p.set("end", params.dateEnd);
  if (typeof window === "undefined") return `?${p.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${p.toString()}`;
}

export function parseShareUrl(hash: string): ShareParams {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { brand: "", aliases: "", platforms: "", mentions: "", dateStart: "", dateEnd: "" };
  const params = new URLSearchParams(clean);
  return {
    brand: params.get("brand") ?? "",
    aliases: params.get("aliases") ?? "",
    platforms: params.get("platforms") ?? "",
    mentions: params.get("mentions") ?? "",
    dateStart: params.get("start") ?? "",
    dateEnd: params.get("end") ?? "",
  };
}

/** Parse comma-separated platforms from share URL. */
export function parsePlatformsParam(s: string): Platform[] {
  if (!s) return [];
  const list = s.split(",").map((p) => p.trim().toLowerCase() as Platform);
  return list.filter((p) => PLATFORMS.includes(p));
}

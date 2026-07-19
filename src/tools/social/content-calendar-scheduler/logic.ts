/**
 * Content Calendar Scheduler — pure logic.
 *
 * Plan monthly content calendars across platforms with frequency
 * presets, theme rotation, time slots, weekend exclusion, ICS export,
 * conflict detection, and summary stats. Pure functions only — no
 * DOM, no network.
 */

export type Platform =
  | "twitter"
  | "instagram"
  | "linkedin"
  | "facebook"
  | "tiktok"
  | "youtube";

export type PostingFrequency =
  | "daily"
  | "3x-week"
  | "weekly"
  | "bi-weekly";

export interface CalendarInput {
  year: number;
  month: number; // 1-12
  platforms: Platform[];
  postingFrequency: PostingFrequency;
  contentThemes: string[];
  includeWeekends: boolean;
  /** Per-platform start times, e.g. { twitter: "09:00" }. */
  startTimes: Partial<Record<Platform, string>>;
}

export interface ScheduledPost {
  /** ISO date: YYYY-MM-DD */
  date: string;
  platform: Platform;
  /** HH:MM (24h) */
  time: string;
  theme: string;
}

export interface PlatformSummary {
  platform: Platform;
  totalPosts: number;
  byTheme: Record<string, number>;
}

export interface ConflictRecord {
  /** ISO date */
  date: string;
  /** HH:MM */
  time: string;
  platforms: Platform[];
}

export interface CalendarResult {
  posts: ScheduledPost[];
  byPlatform: PlatformSummary[];
  conflicts: ConflictRecord[];
  gaps: string[]; // ISO dates with no posts
  summary: SummaryStats;
  themeBalance: ThemeBalance;
}

export interface SummaryStats {
  totalPosts: number;
  daysInMonth: number;
  scheduledDays: number;
  avgPostsPerDay: number;
  byPlatform: Record<Platform, number>;
  byTheme: Record<string, number>;
}

export interface ThemeBalance {
  balanced: boolean;
  themes: { theme: string; count: number; share: number }[];
  maxShare: number;
  minShare: number;
}

export const PLATFORMS: Platform[] = [
  "twitter",
  "instagram",
  "linkedin",
  "facebook",
  "tiktok",
  "youtube",
];

export const PLATFORM_LABELS: Record<Platform, string> = {
  twitter: "Twitter / X",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
};

export const FREQUENCIES: PostingFrequency[] = [
  "daily",
  "3x-week",
  "weekly",
  "bi-weekly",
];

export const FREQUENCY_LABELS: Record<PostingFrequency, string> = {
  "daily": "Daily (every day)",
  "3x-week": "3× per week (Mon/Wed/Fri)",
  "weekly": "Weekly (every Monday)",
  "bi-weekly": "Bi-weekly (every other Monday)",
};

/** Built-in best time to post per platform (engagement hint). */
export const BEST_TIME_TO_POST: Record<Platform, string> = {
  twitter: "09:00",
  instagram: "12:00",
  linkedin: "08:00",
  facebook: "13:00",
  tiktok: "19:00",
  youtube: "15:00",
};

/** Default per-platform start time when user omits an entry. */
export const DEFAULT_START_TIME: Record<Platform, string> = { ...BEST_TIME_TO_POST };

/** Theme presets to seed the textarea. */
export const THEME_PRESETS: string[] = [
  "Education",
  "Behind the Scenes",
  "Customer Story",
  "Industry News",
  "Product Highlight",
  "Tips & Tricks",
  "Inspirational",
  "Poll / Question",
];

/** Normalize a theme string. */
export function normalizeTheme(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Parse content themes textarea (one per line). */
export function parseThemes(input: string): string[] {
  if (!input) return [];
  return input
    .split(/\n+/)
    .map((s) => normalizeTheme(s))
    .filter(Boolean);
}

/** Parse per-platform start times textarea. Each line: `platform,time`. */
export function parseStartTimes(input: string): Partial<Record<Platform, string>> {
  const out: Partial<Record<Platform, string>> = {};
  if (!input) return out;
  for (const rawLine of input.split(/\n+/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const idx = line.indexOf(",");
    if (idx === -1) continue;
    const p = line.slice(0, idx).trim().toLowerCase();
    const t = line.slice(idx + 1).trim();
    if (!PLATFORMS.includes(p as Platform)) continue;
    if (!/^\d{1,2}:\d{2}$/.test(t)) continue;
    out[p as Platform] = t.padStart(5, "0");
  }
  return out;
}

/** Validate an HH:MM 24h time string. */
export function isValidTime(t: string): boolean {
  if (!/^\d{1,2}:\d{2}$/.test(t)) return false;
  const [h, m] = t.split(":").map((x) => parseInt(x, 10));
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

/** Normalize a time to HH:MM (zero-padded). Returns "" on invalid. */
export function normalizeTime(t: string): string {
  if (!t) return "";
  if (!/^\d{1,2}:\d{2}$/.test(t)) return "";
  const [h, m] = t.split(":").map((x) => parseInt(x, 10));
  if (h < 0 || h > 23 || m < 0 || m > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Number of days in a given month. */
export function daysInMonth(year: number, month: number): number {
  // month: 1-12
  if (month < 1 || month > 12) return 0;
  return new Date(year, month, 0).getDate();
}

/** Build the list of ISO dates (YYYY-MM-DD) for a month. */
export function listMonthDates(year: number, month: number): string[] {
  const out: string[] = [];
  const total = daysInMonth(year, month);
  for (let d = 1; d <= total; d++) {
    out.push(formatIsoDate(year, month, d));
  }
  return out;
}

/** Format an ISO date string YYYY-MM-DD. */
export function formatIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Parse an ISO date YYYY-MM-DD → Date (local midnight). */
export function parseIsoDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  const dt = new Date(y, mo - 1, d);
  if (isNaN(dt.getTime())) return null;
  return dt;
}

/** Day-of-week for an ISO date. 0 = Sunday ... 6 = Saturday. */
export function dayOfWeek(iso: string): number {
  const d = parseIsoDate(iso);
  return d ? d.getDay() : -1;
}

/** Is the given ISO date a weekend (Sat/Sun)? */
export function isWeekend(iso: string): boolean {
  const dow = dayOfWeek(iso);
  return dow === 0 || dow === 6;
}

/** Filter dates by weekend exclusion. */
export function filterWeekends(dates: string[], includeWeekends: boolean): string[] {
  if (includeWeekends) return dates;
  return dates.filter((d) => !isWeekend(d));
}

/**
 * Generate posting dates for a single platform given a frequency preset.
 * - daily: every day (after weekend filter)
 * - 3x-week: Mon, Wed, Fri
 * - weekly: every Monday
 * - bi-weekly: every other Monday (1st and 3rd Mondays)
 */
export function generatePlatformDates(
  allDates: string[],
  frequency: PostingFrequency,
  includeWeekends: boolean,
): string[] {
  const filtered = filterWeekends(allDates, includeWeekends);
  switch (frequency) {
    case "daily":
      return filtered;
    case "3x-week":
      return filtered.filter((d) => {
        const dow = dayOfWeek(d);
        return dow === 1 || dow === 3 || dow === 5; // Mon, Wed, Fri
      });
    case "weekly":
      return filtered.filter((d) => dayOfWeek(d) === 1); // Monday
    case "bi-weekly": {
      const mondays = filtered.filter((d) => dayOfWeek(d) === 1);
      // 1st and 3rd Mondays of the month
      return mondays.filter((_, i) => i === 0 || i === 2);
    }
    default:
      return filtered;
  }
}

/**
 * Rotate themes across a list of dates with a 7-day no-repeat rule.
 * If themes list is empty, returns the date list with empty themes.
 */
export function rotateThemes(dates: string[], themes: string[]): { date: string; theme: string }[] {
  if (themes.length === 0) {
    return dates.map((date) => ({ date, theme: "" }));
  }
  const out: { date: string; theme: string }[] = [];
  /** Map theme → last assigned ISO date. */
  const lastUsed = new Map<string, string>();
  let cursor = 0;
  for (const date of dates) {
    // Find first theme that hasn't been used in last 7 days
    let chosen = "";
    for (let i = 0; i < themes.length; i++) {
      const idx = (cursor + i) % themes.length;
      const candidate = themes[idx];
      const last = lastUsed.get(candidate);
      if (!last || daysBetween(last, date) >= 7) {
        chosen = candidate;
        cursor = (idx + 1) % themes.length;
        break;
      }
    }
    // If all themes recently used, fall back to cursor (allow repeat)
    if (!chosen) {
      chosen = themes[cursor];
      cursor = (cursor + 1) % themes.length;
    }
    lastUsed.set(chosen, date);
    out.push({ date, theme: chosen });
  }
  return out;
}

/** Whole-day difference between two ISO dates (b - a). */
export function daysBetween(aIso: string, bIso: string): number {
  const a = parseIsoDate(aIso);
  const b = parseIsoDate(bIso);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/** Resolve the start time for a platform. Falls back to DEFAULT_START_TIME. */
export function resolveTime(platform: Platform, startTimes: Partial<Record<Platform, string>>): string {
  const t = startTimes[platform];
  if (t && isValidTime(t)) return normalizeTime(t) ?? DEFAULT_START_TIME[platform];
  return DEFAULT_START_TIME[platform];
}

/** Build the full scheduled-post list for a single platform. */
export function buildPlatformPosts(
  platform: Platform,
  dates: string[],
  themes: { date: string; theme: string }[],
  startTimes: Partial<Record<Platform, string>>,
): ScheduledPost[] {
  const time = resolveTime(platform, startTimes);
  const themeMap = new Map(themes.map((t) => [t.date, t.theme]));
  return dates.map((date) => ({
    date,
    platform,
    time,
    theme: themeMap.get(date) ?? "",
  }));
}

/** Compute per-platform summaries. */
export function computePlatformSummaries(posts: ScheduledPost[]): PlatformSummary[] {
  const map = new Map<Platform, PlatformSummary>();
  for (const p of posts) {
    if (!map.has(p.platform)) {
      map.set(p.platform, { platform: p.platform, totalPosts: 0, byTheme: {} });
    }
    const s = map.get(p.platform)!;
    s.totalPosts += 1;
    const key = p.theme || "(untitled)";
    s.byTheme[key] = (s.byTheme[key] ?? 0) + 1;
  }
  return Array.from(map.values()).sort((a, b) =>
    PLATFORMS.indexOf(a.platform) - PLATFORMS.indexOf(b.platform),
  );
}

/** Detect conflicts: multiple platforms posting at same date + time. */
export function detectConflicts(posts: ScheduledPost[]): ConflictRecord[] {
  const buckets = new Map<string, Platform[]>();
  for (const p of posts) {
    const key = `${p.date}|${p.time}`;
    if (!buckets.has(key)) buckets.set(key, []);
    const arr = buckets.get(key)!;
    if (!arr.includes(p.platform)) arr.push(p.platform);
  }
  const out: ConflictRecord[] = [];
  for (const [key, platforms] of buckets) {
    if (platforms.length >= 2) {
      const [date, time] = key.split("|");
      out.push({ date, time, platforms });
    }
  }
  out.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.time < b.time ? -1 : 1;
  });
  return out;
}

/** Detect content gap days (dates with no scheduled posts). */
export function detectGaps(allDates: string[], posts: ScheduledPost[]): string[] {
  const used = new Set(posts.map((p) => p.date));
  return allDates.filter((d) => !used.has(d));
}

/** Compute summary stats. */
export function computeSummary(allDates: string[], posts: ScheduledPost[]): SummaryStats {
  const byPlatform = emptyPlatformCounts();
  const byTheme: Record<string, number> = {};
  for (const p of posts) {
    byPlatform[p.platform] += 1;
    const k = p.theme || "(untitled)";
    byTheme[k] = (byTheme[k] ?? 0) + 1;
  }
  const scheduledDays = new Set(posts.map((p) => p.date)).size;
  return {
    totalPosts: posts.length,
    daysInMonth: allDates.length,
    scheduledDays,
    avgPostsPerDay: allDates.length > 0
      ? Math.round((posts.length / allDates.length) * 100) / 100
      : 0,
    byPlatform,
    byTheme,
  };
}

/** Check theme balance — flags if max share exceeds min share by more than 50% of expected. */
export function checkThemeBalance(posts: ScheduledPost[]): ThemeBalance {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const p of posts) {
    const k = p.theme || "(untitled)";
    counts[k] = (counts[k] ?? 0) + 1;
    total += 1;
  }
  const themes = Object.keys(counts).map((theme) => ({
    theme,
    count: counts[theme],
    share: total > 0 ? Math.round((counts[theme] / total) * 1000) / 10 : 0,
  }));
  themes.sort((a, b) => b.count - a.count);
  const shares = themes.map((t) => t.share);
  const maxShare = shares.length > 0 ? Math.max(...shares) : 0;
  const minShare = shares.length > 0 ? Math.min(...shares) : 0;
  // Balanced if spread between max and min is less than 25 percentage points
  const balanced = themes.length <= 1 || (maxShare - minShare) <= 25;
  return { balanced, themes, maxShare, minShare };
}

function emptyPlatformCounts(): Record<Platform, number> {
  return { twitter: 0, instagram: 0, linkedin: 0, facebook: 0, tiktok: 0, youtube: 0 };
}

/** Build the full calendar result. */
export function buildCalendar(input: CalendarInput): CalendarResult {
  const allDates = listMonthDates(input.year, input.month);
  const themes = input.contentThemes.map(normalizeTheme).filter(Boolean);
  const posts: ScheduledPost[] = [];
  for (const platform of input.platforms) {
    const dates = generatePlatformDates(allDates, input.postingFrequency, input.includeWeekends);
    const rotated = rotateThemes(dates, themes);
    posts.push(...buildPlatformPosts(platform, dates, rotated, input.startTimes));
  }
  // Sort by date, then time, then platform order
  posts.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.time !== b.time) return a.time < b.time ? -1 : 1;
    return PLATFORMS.indexOf(a.platform) - PLATFORMS.indexOf(b.platform);
  });
  const byPlatform = computePlatformSummaries(posts);
  const conflicts = detectConflicts(posts);
  const gaps = detectGaps(allDates, posts);
  const summary = computeSummary(allDates, posts);
  const themeBalance = checkThemeBalance(posts);
  return { posts, byPlatform, conflicts, gaps, summary, themeBalance };
}

// ---- Renderers ----

/** Render posts as plain text calendar (per-day grouping). */
export function renderText(result: CalendarResult): string {
  if (result.posts.length === 0) return "";
  const lines: string[] = [];
  lines.push(`Content Calendar — ${result.summary.totalPosts} posts across ${result.byPlatform.length} platform(s)`);
  lines.push(`Avg: ${result.summary.avgPostsPerDay} posts/day · ${result.summary.scheduledDays}/${result.summary.daysInMonth} days scheduled`);
  if (result.conflicts.length > 0) {
    lines.push(`Conflicts: ${result.conflicts.length}`);
  }
  if (result.gaps.length > 0) {
    lines.push(`Gap days: ${result.gaps.length}`);
  }
  lines.push("");
  // Group by date
  const byDate = new Map<string, ScheduledPost[]>();
  for (const p of result.posts) {
    if (!byDate.has(p.date)) byDate.set(p.date, []);
    byDate.get(p.date)!.push(p);
  }
  for (const [date, list] of byDate) {
    lines.push(`── ${date} ──`);
    for (const p of list) {
      const themeStr = p.theme ? ` [${p.theme}]` : "";
      lines.push(`  ${p.time}  ${PLATFORM_LABELS[p.platform]}${themeStr}`);
    }
  }
  return lines.join("\n").trim();
}

/** Render posts as CSV (date, platform, time, theme). */
export function renderCsv(result: CalendarResult): string {
  const lines = ["date,platform,time,theme"];
  for (const p of result.posts) {
    lines.push([
      p.date,
      p.platform,
      p.time,
      escapeCsv(p.theme || ""),
    ].join(","));
  }
  return lines.join("\n");
}

/** Render posts as printable HTML. */
export function renderHtml(result: CalendarResult): string {
  if (result.posts.length === 0) {
    return "<!doctype html><html><body><p>No posts scheduled.</p></body></html>";
  }
  const byDate = new Map<string, ScheduledPost[]>();
  for (const p of result.posts) {
    if (!byDate.has(p.date)) byDate.set(p.date, []);
    byDate.get(p.date)!.push(p);
  }
  const rows = Array.from(byDate.entries()).map(([date, list]) => {
    const inner = list.map((p) =>
      `<tr><td>${escapeHtml(p.time)}</td><td>${escapeHtml(PLATFORM_LABELS[p.platform])}</td><td>${escapeHtml(p.theme || "")}</td></tr>`,
    ).join("");
    return `<tr class="date-row"><td colspan="3">${escapeHtml(date)}</td></tr>${inner}`;
  }).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Content Calendar</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 24px; }
  h1 { font-size: 18px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; font-size: 13px; text-align: left; }
  th { background: #f5f5f5; }
  .date-row td { background: #eef; font-weight: bold; }
  @media print { body { margin: 8px; } }
</style>
</head>
<body>
<h1>Content Calendar — ${result.summary.totalPosts} posts · ${result.summary.avgPostsPerDay}/day</h1>
<table>
<thead><tr><th>Time</th><th>Platform</th><th>Theme</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</body>
</html>`;
}

/** Render posts as Markdown. */
export function renderMarkdown(result: CalendarResult): string {
  if (result.posts.length === 0) return "";
  const lines: string[] = [];
  lines.push(`# Content Calendar`);
  lines.push("");
  lines.push(`- **Total posts:** ${result.summary.totalPosts}`);
  lines.push(`- **Scheduled days:** ${result.summary.scheduledDays}/${result.summary.daysInMonth}`);
  lines.push(`- **Avg posts/day:** ${result.summary.avgPostsPerDay}`);
  lines.push("");
  lines.push(`| Date | Time | Platform | Theme |`);
  lines.push(`| --- | --- | --- | --- |`);
  for (const p of result.posts) {
    lines.push(`| ${p.date} | ${p.time} | ${PLATFORM_LABELS[p.platform]} | ${p.theme || ""} |`);
  }
  return lines.join("\n");
}

/** Render ICS (iCalendar) — one VEVENT per scheduled post. */
export function renderIcs(result: CalendarResult, tzId = "America/New_York"): string {
  if (result.posts.length === 0) {
    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//UnQTools//Content Calendar//EN",
      "CALSCALE:GREGORIAN",
      "END:VCALENDAR",
    ].join("\r\n");
  }
  const now = new Date();
  const dtstamp = formatIcsDateTime(now);
  const events = result.posts.map((p) => {
    const [h, m] = p.time.split(":").map((x) => parseInt(x, 10));
    const start = formatIcsDateTimeFromDate(p.date, h, m);
    // 30-minute default duration
    const endH = (h + ((m + 30) >= 60 ? 1 : 0)) % 24;
    const endM = (m + 30) % 60;
    const end = formatIcsDateTimeFromDate(p.date, endH, endM);
    const title = `${PLATFORM_LABELS[p.platform]} post${p.theme ? ` — ${p.theme}` : ""}`;
    const uid = `${p.date}-${p.platform}-${p.time}@unqtools.local`;
    return [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeIcsText(title)}`,
      `DESCRIPTION:${escapeIcsText(`Platform: ${PLATFORM_LABELS[p.platform]}. Theme: ${p.theme || "general"}`)}`,
      "END:VEVENT",
    ].join("\r\n");
  }).join("\r\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//UnQTools//Content Calendar//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-TIMEZONE:${tzId}`,
    events,
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Format a Date object as UTC ICS timestamp: YYYYMMDDTHHMMSSZ. */
export function formatIcsDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Format an ISO date + hour + minute as ICS local timestamp: YYYYMMDDTHHMMSS. */
export function formatIcsDateTimeFromDate(isoDate: string, hour: number, minute: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${m[1]}${m[2]}${m[3]}T${pad(hour)}${pad(minute)}00`;
}

/** Escape text for ICS (commas, semicolons, newlines, backslashes). */
export function escapeIcsText(s: string): string {
  return (s || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Escape a value for CSV output. */
export function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Escape a value for HTML output. */
export function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:content-calendar-scheduler:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  year: number;
  month: number;
  platforms: Platform[];
  postingFrequency: PostingFrequency;
  themeCount: number;
  totalPosts: number;
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

export function buildShareUrl(input: CalendarInput): string {
  const params = new URLSearchParams();
  params.set("y", String(input.year));
  params.set("m", String(input.month));
  if (input.platforms.length > 0) params.set("p", input.platforms.join(","));
  params.set("freq", input.postingFrequency);
  params.set("wk", input.includeWeekends ? "1" : "0");
  if (input.contentThemes.length > 0) {
    params.set("themes", input.contentThemes.join("\n"));
  }
  const timeEntries = Object.entries(input.startTimes) as [Platform, string][];
  if (timeEntries.length > 0) {
    params.set("times", timeEntries.map(([p, t]) => `${p},${t}`).join("\n"));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): {
  year: number;
  month: number;
  platforms: Platform[];
  postingFrequency: PostingFrequency;
  contentThemes: string[];
  includeWeekends: boolean;
  startTimes: Partial<Record<Platform, string>>;
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const defaultOut = {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    platforms: [] as Platform[],
    postingFrequency: "3x-week" as PostingFrequency,
    contentThemes: [] as string[],
    includeWeekends: true,
    startTimes: {} as Partial<Record<Platform, string>>,
  };
  if (!clean) return defaultOut;
  const params = new URLSearchParams(clean);
  const y = parseInt(params.get("y") ?? "", 10);
  const m = parseInt(params.get("m") ?? "", 10);
  const platformsStr = params.get("p") ?? "";
  const platforms = platformsStr
    ? platformsStr.split(",").filter((p) => PLATFORMS.includes(p as Platform)) as Platform[]
    : [];
  const freq = params.get("freq");
  const themesStr = params.get("themes") ?? "";
  const themes = themesStr ? parseThemes(themesStr) : [];
  const timesStr = params.get("times") ?? "";
  const startTimes = timesStr ? parseStartTimes(timesStr) : {};
  return {
    year: Number.isFinite(y) && y >= 1900 ? y : defaultOut.year,
    month: Number.isFinite(m) && m >= 1 && m <= 12 ? m : defaultOut.month,
    platforms,
    postingFrequency: FREQUENCIES.includes(freq as PostingFrequency)
      ? (freq as PostingFrequency)
      : defaultOut.postingFrequency,
    contentThemes: themes,
    includeWeekends: params.get("wk") !== "0",
    startTimes,
  };
}

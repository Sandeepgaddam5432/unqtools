/**
 * Content Calendar Planner — pure logic.
 *
 * Generate monthly content calendars with topic / channel / content-type /
 * keyword assigned per posting day. Pure functions only — no DOM, no network.
 */

export type PostingFrequency = "daily" | "weekdays" | "3x-week" | "weekly";

export interface CalendarInputs {
  year: number;
  month: number; // 1-12
  topics: string[];
  channels: string[];
  contentTypeMix: Map<string, number>;
  postingFrequency: PostingFrequency;
  keywords: string[];
}

export interface ScheduledPost {
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // Mon, Tue, ...
  dayNumber: number; // 1-31
  topic: string;
  channel: string;
  contentType: string;
  keyword: string;
}

export interface ConflictWarning {
  date: string;
  topic: string;
  previousDate: string;
  daysApart: number;
}

export interface SummaryStats {
  totalPosts: number;
  byChannel: Record<string, number>;
  byContentType: Record<string, number>;
  uniqueTopics: number;
  uniqueKeywords: number;
}

export const CHANNEL_PRESETS: string[] = [
  "Blog", "YouTube", "LinkedIn", "Twitter", "Instagram", "Email", "Podcast",
];

export const FREQUENCY_PRESETS: { value: PostingFrequency; label: string }[] = [
  { value: "daily", label: "Daily (every day)" },
  { value: "weekdays", label: "Weekdays (Mon–Fri)" },
  { value: "3x-week", label: "3× a week (Mon/Wed/Fri)" },
  { value: "weekly", label: "Weekly (every Monday)" },
];

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const DEDUP_DAYS = 7;

// ---- Date helpers (UTC to avoid TZ issues in tests) ----

/** Format a date as YYYY-MM-DD. */
export function formatDate(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/** Parse a YYYY-MM-DD string back to a UTC Date. */
export function parseDate(s: string): Date {
  const parts = s.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return new Date(NaN);
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
}

/** Days between two YYYY-MM-DD dates (positive if b after a). */
export function daysBetween(a: string, b: string): number {
  const da = parseDate(a);
  const db = parseDate(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return Infinity;
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

/** Get the day-of-week short name for a YYYY-MM-DD string. */
export function dayNameFor(date: string): string {
  const d = parseDate(date);
  if (Number.isNaN(d.getTime())) return "";
  return DAY_NAMES[d.getUTCDay()];
}

// ---- Date list generator ----

/** Generate list of posting dates for the month based on frequency. */
export function generateDateList(
  year: number,
  month: number,
  freq: PostingFrequency,
): string[] {
  const out: string[] = [];
  if (month < 1 || month > 12) return out;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let day = 1; day <= lastDay; day++) {
    const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    let include = false;
    switch (freq) {
      case "daily": include = true; break;
      case "weekdays": include = dow >= 1 && dow <= 5; break;
      case "3x-week": include = dow === 1 || dow === 3 || dow === 5; break; // Mon/Wed/Fri
      case "weekly": include = dow === 1; break; // Monday
      default: include = false;
    }
    if (include) out.push(formatDate(year, month, day));
  }
  return out;
}

// ---- Content type mix ----

/** Parse content type mix from "blog:3, video:2, social:5, email:1" string. */
export function parseContentMix(input: string): Map<string, number> {
  const out = new Map<string, number>();
  if (!input) return out;
  for (const pair of input.split(/[,\n]+/)) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.lastIndexOf(":");
    if (colonIdx < 1) continue;
    const type = trimmed.slice(0, colonIdx).trim();
    const weight = parseInt(trimmed.slice(colonIdx + 1).trim(), 10);
    if (!type || Number.isNaN(weight) || weight <= 0) continue;
    out.set(type, weight);
  }
  return out;
}

/** Build a flat array of content types expanded by weight (deterministic). */
export function expandContentMix(mix: Map<string, number>): string[] {
  const out: string[] = [];
  for (const [type, w] of mix) {
    for (let i = 0; i < w; i++) out.push(type);
  }
  return out;
}

/** Pick a content type for index i (deterministic round-robin via expanded array). */
export function pickContentType(mix: Map<string, number>, index: number): string {
  const expanded = expandContentMix(mix);
  if (expanded.length === 0) return "";
  return expanded[index % expanded.length];
}

// ---- Topics & channels parsing ----

/** Parse topics (one per line). */
export function parseTopics(input: string): string[] {
  if (!input) return [];
  return input
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse channels (comma-separated). */
export function parseChannels(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---- Topic rotator with 7-day dedup ----

export interface DateTopic {
  date: string;
  topic: string;
}

/** Assign a topic for the post at `currentDate`, honoring dedup window. */
export function pickTopicForDate(
  topics: string[],
  currentDate: string,
  assigned: DateTopic[],
  index: number,
  dedupDays: number = DEDUP_DAYS,
): string {
  if (topics.length === 0) return "";
  if (topics.length === 1) return topics[0];

  const recentTopics = new Set<string>();
  for (const a of assigned) {
    const diff = daysBetween(a.date, currentDate);
    if (diff > 0 && diff < dedupDays) {
      recentTopics.add(a.topic);
    }
  }

  const startIdx = ((index % topics.length) + topics.length) % topics.length;
  for (let offset = 0; offset < topics.length; offset++) {
    const t = topics[(startIdx + offset) % topics.length];
    if (!recentTopics.has(t)) return t;
  }

  // All topics recently used — fall back to round-robin
  return topics[startIdx];
}

// ---- Calendar generation ----

export function generateCalendar(inputs: CalendarInputs): ScheduledPost[] {
  const dates = generateDateList(inputs.year, inputs.month, inputs.postingFrequency);
  const posts: ScheduledPost[] = [];
  const assignedTopics: DateTopic[] = [];

  dates.forEach((date, i) => {
    const d = parseDate(date);
    const dow = d.getUTCDay();
    const dayName = DAY_NAMES[dow];

    const topic = pickTopicForDate(inputs.topics, date, assignedTopics, i);
    const channel = inputs.channels.length > 0
      ? inputs.channels[i % inputs.channels.length]
      : "";
    const contentType = pickContentType(inputs.contentTypeMix, i);
    const keyword = inputs.keywords.length > 0
      ? inputs.keywords[i % inputs.keywords.length]
      : "";

    assignedTopics.push({ date, topic });

    posts.push({
      date,
      dayOfWeek: dayName,
      dayNumber: d.getUTCDate(),
      topic,
      channel,
      contentType,
      keyword,
    });
  });

  return posts;
}

// ---- Conflict detection ----

/** Detect posts with the same topic scheduled within dedupDays. */
export function detectConflicts(
  posts: ScheduledPost[],
  dedupDays: number = DEDUP_DAYS,
): ConflictWarning[] {
  const warnings: ConflictWarning[] = [];
  for (let i = 0; i < posts.length; i++) {
    if (!posts[i].topic) continue;
    for (let j = 0; j < i; j++) {
      if (posts[j].topic !== posts[i].topic) continue;
      const diff = daysBetween(posts[j].date, posts[i].date);
      if (diff > 0 && diff < dedupDays) {
        warnings.push({
          date: posts[i].date,
          topic: posts[i].topic,
          previousDate: posts[j].date,
          daysApart: diff,
        });
        break; // Only one warning per post
      }
    }
  }
  return warnings;
}

// ---- ICS calendar generator (iCalendar) ----

function escapeIcsText(s: string): string {
  return (s || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Generate an iCalendar (.ics) file content for the posts. */
export function generateIcs(
  posts: ScheduledPost[],
  calendarName: string = "Content Calendar",
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//UnQTools//Content Calendar Planner//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ];

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const dateStr = post.date.replace(/-/g, "");
    const summaryParts = [
      post.topic,
      [post.channel, post.contentType].filter(Boolean).join("/"),
    ].filter(Boolean);
    const summary = summaryParts.join(" — ");
    const descParts = [
      post.topic ? `Topic: ${post.topic}` : "",
      post.channel ? `Channel: ${post.channel}` : "",
      post.contentType ? `Content type: ${post.contentType}` : "",
      post.keyword ? `Target keyword: ${post.keyword}` : "",
    ].filter(Boolean);
    const description = descParts.join("\\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${dateStr}-${i}@unqtools.content-calendar`,
      `DTSTAMP:${dateStr}T000000Z`,
      `DTSTART;VALUE=DATE:${dateStr}`,
      `DTEND;VALUE=DATE:${dateStr}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

// ---- Renderers ----

/** Render posts as a plain-text table. */
export function renderText(posts: ScheduledPost[]): string {
  if (posts.length === 0) return "";
  const lines: string[] = [];
  lines.push(
    "Date        Day  Topic                                    Channel      Type      Keyword",
  );
  lines.push(
    "----------  ---  ---------------------------------------  -----------  --------  ----------------",
  );
  for (const p of posts) {
    lines.push(
      [
        p.date.padEnd(10),
        p.dayOfWeek.padEnd(3),
        p.topic.slice(0, 39).padEnd(39),
        p.channel.slice(0, 11).padEnd(11),
        p.contentType.slice(0, 8).padEnd(8),
        p.keyword,
      ].join("  "),
    );
  }
  return lines.join("\n");
}

/** Render posts as CSV. */
export function renderCsv(posts: ScheduledPost[]): string {
  const lines = ["date,day,topic,channel,content_type,keyword"];
  for (const p of posts) {
    lines.push([
      p.date,
      p.dayOfWeek,
      escapeCsv(p.topic),
      escapeCsv(p.channel),
      escapeCsv(p.contentType),
      escapeCsv(p.keyword),
    ].join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Split CSV row with quoted values. */
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

// ---- Summary stats ----

export function computeSummaryStats(posts: ScheduledPost[]): SummaryStats {
  const byChannel: Record<string, number> = {};
  const byContentType: Record<string, number> = {};
  const topics = new Set<string>();
  const keywords = new Set<string>();

  for (const p of posts) {
    if (p.channel) byChannel[p.channel] = (byChannel[p.channel] ?? 0) + 1;
    if (p.contentType) byContentType[p.contentType] = (byContentType[p.contentType] ?? 0) + 1;
    if (p.topic) topics.add(p.topic);
    if (p.keyword) keywords.add(p.keyword);
  }

  return {
    totalPosts: posts.length,
    byChannel,
    byContentType,
    uniqueTopics: topics.size,
    uniqueKeywords: keywords.size,
  };
}

// ---- Filter ----

export function filterByChannel(posts: ScheduledPost[], channel: string): ScheduledPost[] {
  if (!channel) return posts;
  return posts.filter((p) => p.channel === channel);
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:content-calendar-planner:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  year: number;
  month: number;
  frequency: PostingFrequency;
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

export interface ShareInputs {
  year: number;
  month: number;
  topics: string;
  channels: string;
  contentTypeMix: string;
  postingFrequency: PostingFrequency;
  keywords: string;
}

const VALID_FREQUENCIES: PostingFrequency[] = ["daily", "weekdays", "3x-week", "weekly"];

export function buildShareUrl(inputs: ShareInputs): string {
  const params = new URLSearchParams();
  params.set("year", String(inputs.year));
  params.set("month", String(inputs.month));
  if (inputs.topics) params.set("topics", inputs.topics);
  if (inputs.channels) params.set("channels", inputs.channels);
  if (inputs.contentTypeMix) params.set("mix", inputs.contentTypeMix);
  params.set("freq", inputs.postingFrequency);
  if (inputs.keywords) params.set("kw", inputs.keywords);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareInputs {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const now = new Date();
  const defaultResult: ShareInputs = {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    topics: "",
    channels: "",
    contentTypeMix: "",
    postingFrequency: "weekly",
    keywords: "",
  };
  if (!clean) return defaultResult;
  const params = new URLSearchParams(clean);
  const freqParam = params.get("freq") as PostingFrequency | null;
  const freq = freqParam && VALID_FREQUENCIES.includes(freqParam) ? freqParam : "weekly";
  const year = parseInt(params.get("year") ?? "", 10);
  const month = parseInt(params.get("month") ?? "", 10);
  return {
    year: Number.isNaN(year) ? defaultResult.year : year,
    month: Number.isNaN(month) || month < 1 || month > 12 ? defaultResult.month : month,
    topics: params.get("topics") ?? "",
    channels: params.get("channels") ?? "",
    contentTypeMix: params.get("mix") ?? "",
    postingFrequency: freq,
    keywords: params.get("kw") ?? "",
  };
}

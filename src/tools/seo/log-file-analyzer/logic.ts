/**
 * Server Log File Analyzer (SEO) — pure logic.
 *
 * Parses Apache/Nginx common + combined log format and extracts SEO
 * insights: Googlebot activity, status-code distribution, crawl
 * frequency, 404 broken URLs, multi-bot detection.
 *
 * Pure functions only — no DOM, no network.
 */

// ---- Types ----

export type BotFamily =
  | "googlebot"
  | "bingbot"
  | "yandex"
  | "baidu"
  | "duckduckgo"
  | "ahrefs"
  | "semrush"
  | "apple"
  | "other"
  | "human";

export type StatusCodeClass = "2xx" | "3xx" | "4xx" | "5xx" | "other";

export interface LogEntry {
  ip: string;
  timestamp: string;
  method: string;
  path: string;
  protocol: string;
  status: number;
  bytes: number;
  referer: string;
  userAgent: string;
  responseTimeMicros?: number;
  botFamily: BotFamily;
  botSubType?: string;
  raw: string;
  lineNumber: number;
}

export interface ParseError {
  line: number;
  raw: string;
  message: string;
}

export interface ParsedLog {
  entries: LogEntry[];
  errors: ParseError[];
  totalLines: number;
}

export interface BotStat {
  family: BotFamily;
  hits: number;
  percent: number;
}

export interface UrlCrawlStat {
  url: string;
  hits: number;
  statuses: Record<number, number>;
  bots: Record<string, number>;
  lastStatus: number;
}

export interface ResponseTimeStats {
  count: number;
  min: number;
  max: number;
  avg: number;
  p95: number;
  /** Average milliseconds (micros / 1000). */
  avgMs: number;
}

export interface LogSummary {
  totalRequests: number;
  googlebotHits: number;
  botHits: number;
  humanHits: number;
  botPercent: number;
  statusDistribution: Record<StatusCodeClass, number>;
  statusCounts: Record<number, number>;
  topBots: BotStat[];
  topCrawledUrls: UrlCrawlStat[];
  notFoundUrls: UrlCrawlStat[];
  uniqueUrls: number;
  parseErrors: number;
  responseTimes?: ResponseTimeStats;
  googlebot404s: number;
}

export interface HistoryEntry {
  ts: number;
  totalRequests: number;
  googlebotHits: number;
  notFoundUrls: number;
  uniqueUrls: number;
  botPercent: number;
}

// ---- Constants ----

export const HISTORY_KEY = "unqtools:log-file-analyzer:history";
export const HISTORY_MAX = 20;
export const TOP_URLS_LIMIT = 50;
export const TOP_BOTS_LIMIT = 10;

export const BOT_LABELS: Record<BotFamily, string> = {
  googlebot: "Googlebot",
  bingbot: "Bingbot",
  yandex: "YandexBot",
  baidu: "Baiduspider",
  duckduckgo: "DuckDuckBot",
  ahrefs: "AhrefsBot",
  semrush: "SemrushBot",
  apple: "Applebot",
  other: "Other Bot",
  human: "Human / Unknown",
};

interface BotPattern {
  family: BotFamily;
  /** Substring match (case-insensitive). */
  needle: string;
}

/** Order matters: more specific sub-type checks happen inside detectBot. */
export const BOT_PATTERNS: BotPattern[] = [
  { family: "googlebot", needle: "googlebot" },
  { family: "bingbot", needle: "bingbot" },
  { family: "yandex", needle: "yandexbot" },
  { family: "baidu", needle: "baiduspider" },
  { family: "duckduckgo", needle: "duckduckbot" },
  { family: "ahrefs", needle: "ahrefsbot" },
  { family: "semrush", needle: "semrushbot" },
  { family: "apple", needle: "applebot" },
];

// ---- Parsing ----

const MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

/** Parse a CLF timestamp like "10/Jul/2025:13:55:36 +0000" into an ISO string. */
export function parseTimestamp(raw: string): string {
  if (!raw) return "";
  // DD/Mon/YYYY:HH:MM:SS ±ZZZZ
  const m = raw.match(/^(\d{1,2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s*([+-]\d{4})?$/);
  if (!m) return raw;
  const [, d, mon, y, hh, mm, ss, tz] = m;
  const month = MONTHS[mon];
  if (!month) return raw;
  const tzStr = tz ?? "+0000";
  const tzFmt = `${tzStr.slice(0, 3)}:${tzStr.slice(3)}`;
  const iso = `${y}-${String(month).padStart(2, "0")}-${d.padStart(2, "0")}T${hh}:${mm}:${ss}${tzFmt}`;
  return iso;
}

const LOG_RE =
  /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"([^"]*)"\s+(\d+)\s+(\S+)(?:\s+"([^"]*)"\s+"([^"]*)")?(.*)?$/;

/** Parse a single log line into a LogEntry, or null on failure. */
export function parseLogLine(line: string, lineNumber = 0): LogEntry | null {
  if (!line) return null;
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const m = trimmed.match(LOG_RE);
  if (!m) return null;
  const [, ip, tsRaw, request, statusStr, bytesStr, referer, ua, trailing] = m;
  // Parse request "METHOD path protocol"
  const reqParts = (request ?? "").split(/\s+/);
  let method = "";
  let path = "";
  let protocol = "";
  if (reqParts.length === 1) {
    path = reqParts[0];
  } else if (reqParts.length === 2) {
    method = reqParts[0];
    path = reqParts[1];
  } else {
    method = reqParts[0];
    path = reqParts[1];
    protocol = reqParts.slice(2).join(" ");
  }
  const status = Number(statusStr);
  if (!Number.isFinite(status)) return null;
  let bytes = 0;
  if (bytesStr && bytesStr !== "-") {
    const n = Number(bytesStr);
    if (Number.isFinite(n)) bytes = n;
  }
  // Trailing part: look for trailing integer (response time %D in microseconds)
  let responseTimeMicros: number | undefined;
  if (trailing) {
    const tm = trailing.match(/(\d+)\s*$/);
    if (tm) {
      const n = Number(tm[1]);
      if (Number.isFinite(n) && n > 0) responseTimeMicros = n;
    }
  }
  const userAgent = ua ?? "";
  const { family, subType } = detectBot(userAgent);
  return {
    ip,
    timestamp: parseTimestamp(tsRaw),
    method,
    path,
    protocol,
    status,
    bytes,
    referer: referer ?? "",
    userAgent,
    responseTimeMicros,
    botFamily: family,
    botSubType: subType,
    raw: trimmed,
    lineNumber,
  };
}

/** Parse multi-line log input into entries + errors. */
export function parseLogs(input: string): ParsedLog {
  if (!input) return { entries: [], errors: [], totalLines: 0 };
  const lines = input.split(/\r?\n/);
  const entries: LogEntry[] = [];
  const errors: ParseError[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const entry = parseLogLine(raw, i + 1);
    if (entry) entries.push(entry);
    else errors.push({ line: i + 1, raw, message: "Unparseable log line" });
  }
  return { entries, errors, totalLines: lines.length };
}

// ---- Bot detection ----

/** Googlebot sub-type patterns (checked in order). */
const GOOGLEBOT_SUBTYPES: { subType: string; needle: string }[] = [
  { subType: "Googlebot-News", needle: "googlebot-news" },
  { subType: "Googlebot-Image", needle: "googlebot-image" },
  { subType: "Googlebot-Video", needle: "googlebot-video" },
  { subType: "Googlebot-Mobile", needle: "googlebot-mobile" },
  { subType: "AdsBot-Google", needle: "adsbot-google" },
  { subType: "Mediapartners-Google", needle: "mediapartners-google" },
];

/** Detect bot family and (for Googlebot) sub-type from a user-agent string. */
export function detectBot(userAgent: string): { family: BotFamily; subType?: string } {
  const ua = (userAgent ?? "").toLowerCase();
  if (!ua) return { family: "human" };
  if (ua.includes("googlebot") || ua.includes("adsbot-google") || ua.includes("mediapartners-google")) {
    for (const { subType, needle } of GOOGLEBOT_SUBTYPES) {
      if (ua.includes(needle)) return { family: "googlebot", subType };
    }
    return { family: "googlebot" };
  }
  for (const { family, needle } of BOT_PATTERNS) {
    if (ua.includes(needle)) return { family };
  }
  // Generic bot detection
  if (
    ua.includes("bot") ||
    ua.includes("spider") ||
    ua.includes("crawler") ||
    ua.includes("slurp") ||
    ua.includes("scan")
  ) {
    return { family: "other" };
  }
  return { family: "human" };
}

// ---- Status code classification ----

export function classifyStatus(status: number): StatusCodeClass {
  if (status >= 200 && status < 300) return "2xx";
  if (status >= 300 && status < 400) return "3xx";
  if (status >= 400 && status < 500) return "4xx";
  if (status >= 500 && status < 600) return "5xx";
  return "other";
}

// ---- Stats computations ----

/** Compute status-code class distribution. */
export function computeStatusDistribution(entries: LogEntry[]): Record<StatusCodeClass, number> {
  const dist: Record<StatusCodeClass, number> = {
    "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, "other": 0,
  };
  for (const e of entries) dist[classifyStatus(e.status)]++;
  return dist;
}

/** Compute status-code frequency counts. */
export function computeStatusCounts(entries: LogEntry[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const e of entries) {
    counts[e.status] = (counts[e.status] ?? 0) + 1;
  }
  return counts;
}

/** Compute per-bot hit counters. */
export function computeBotStats(entries: LogEntry[]): BotStat[] {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const e of entries) {
    counts[e.botFamily] = (counts[e.botFamily] ?? 0) + 1;
    total++;
  }
  const out: BotStat[] = (Object.keys(BOT_LABELS) as BotFamily[])
    .filter((f) => counts[f] !== undefined)
    .map((family) => ({
      family,
      hits: counts[family] ?? 0,
      percent: total > 0 ? Math.round(((counts[family] ?? 0) / total) * 1000) / 10 : 0,
    }));
  out.sort((a, b) => b.hits - a.hits);
  return out;
}

/** Compute per-URL crawl stats (optionally restricted to a bot family). */
export function computeUrlCrawlStats(
  entries: LogEntry[],
  family?: BotFamily,
): UrlCrawlStat[] {
  const map = new Map<string, UrlCrawlStat>();
  for (const e of entries) {
    if (family && e.botFamily !== family) continue;
    if (!e.path) continue;
    const url = e.path;
    if (!map.has(url)) {
      map.set(url, {
        url,
        hits: 0,
        statuses: {},
        bots: {},
        lastStatus: e.status,
      });
    }
    const s = map.get(url)!;
    s.hits++;
    s.statuses[e.status] = (s.statuses[e.status] ?? 0) + 1;
    s.bots[e.botFamily] = (s.bots[e.botFamily] ?? 0) + 1;
    s.lastStatus = e.status;
  }
  const arr = Array.from(map.values());
  arr.sort((a, b) => b.hits - a.hits);
  return arr;
}

/** Compute response-time stats from entries that have responseTimeMicros set. */
export function computeResponseTimeStats(entries: LogEntry[]): ResponseTimeStats | undefined {
  const times = entries
    .map((e) => e.responseTimeMicros)
    .filter((t): t is number => typeof t === "number" && t > 0)
    .sort((a, b) => a - b);
  if (times.length === 0) return undefined;
  const sum = times.reduce((a, b) => a + b, 0);
  const avg = sum / times.length;
  const p95Idx = Math.min(times.length - 1, Math.floor(times.length * 0.95));
  return {
    count: times.length,
    min: times[0],
    max: times[times.length - 1],
    avg: Math.round(avg * 10) / 10,
    p95: times[p95Idx],
    avgMs: Math.round(avg / 100) / 10,
  };
}

/** Find URLs Googlebot hit with a 404 status. */
export function findGooglebot404s(entries: LogEntry[]): UrlCrawlStat[] {
  const g404 = entries.filter((e) => e.botFamily === "googlebot" && e.status === 404);
  return computeUrlCrawlStats(g404);
}

/** Compute the full summary for parsed entries. */
export function summarize(entries: LogEntry[], errors: ParseError[] = []): LogSummary {
  const totalRequests = entries.length;
  const googlebotHits = entries.filter((e) => e.botFamily === "googlebot").length;
  const botHits = entries.filter((e) => e.botFamily !== "human").length;
  const humanHits = entries.filter((e) => e.botFamily === "human").length;
  const botPercent = totalRequests > 0
    ? Math.round((botHits / totalRequests) * 1000) / 10
    : 0;
  const statusDistribution = computeStatusDistribution(entries);
  const statusCounts = computeStatusCounts(entries);
  const topBots = computeBotStats(entries).slice(0, TOP_BOTS_LIMIT);
  const topCrawledUrls = computeUrlCrawlStats(
    entries.filter((e) => e.botFamily === "googlebot"),
  ).slice(0, TOP_URLS_LIMIT);
  const notFoundUrls = findGooglebot404s(entries).slice(0, TOP_URLS_LIMIT);
  const uniqueUrls = new Set(entries.map((e) => e.path).filter(Boolean)).size;
  const responseTimes = computeResponseTimeStats(entries);
  return {
    totalRequests,
    googlebotHits,
    botHits,
    humanHits,
    botPercent,
    statusDistribution,
    statusCounts,
    topBots,
    topCrawledUrls,
    notFoundUrls,
    uniqueUrls,
    parseErrors: errors.length,
    responseTimes,
    googlebot404s: notFoundUrls.length,
  };
}

// ---- Filtering ----

export type LogFilter = "all" | "googlebot" | Exclude<BotFamily, "human" | "other"> | "bots-only";

/** Filter entries by the selected bot filter. */
export function filterEntries(entries: LogEntry[], filter: LogFilter): LogEntry[] {
  if (filter === "all") return entries;
  if (filter === "googlebot") return entries.filter((e) => e.botFamily === "googlebot");
  if (filter === "bots-only") return entries.filter((e) => e.botFamily !== "human");
  return entries.filter((e) => e.botFamily === filter);
}

// ---- Rendering ----

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Format bytes human-readable. */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "-";
  if (n === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / Math.pow(1024, i);
  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

/** Format microseconds as a human-readable time string. */
export function formatMicros(micros: number): string {
  if (!Number.isFinite(micros) || micros < 0) return "-";
  if (micros < 1000) return `${micros} µs`;
  if (micros < 1_000_000) return `${(micros / 1000).toFixed(2)} ms`;
  return `${(micros / 1_000_000).toFixed(2)} s`;
}

/** Render a complete text report. */
export function renderTextReport(
  summary: LogSummary,
  entries: LogEntry[] = [],
  filter: LogFilter = "all",
): string {
  const lines: string[] = [];
  lines.push("=== Server Log Analysis Report ===");
  lines.push("");
  lines.push(`Filter: ${filter}`);
  lines.push(`Total requests: ${summary.totalRequests}`);
  lines.push(`Googlebot hits: ${summary.googlebotHits}`);
  lines.push(`Total bot hits: ${summary.botHits} (${summary.botPercent}%)`);
  lines.push(`Human/unknown: ${summary.humanHits}`);
  lines.push(`Unique URLs: ${summary.uniqueUrls}`);
  if (summary.parseErrors > 0) lines.push(`Parse errors: ${summary.parseErrors}`);
  lines.push("");
  lines.push("--- Status code distribution ---");
  (Object.keys(summary.statusDistribution) as StatusCodeClass[]).forEach((c) => {
    lines.push(`${c}: ${summary.statusDistribution[c]}`);
  });
  if (Object.keys(summary.statusCounts).length > 0) {
    lines.push("");
    lines.push("--- Top status codes ---");
    const sorted = Object.entries(summary.statusCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    for (const [code, n] of sorted) lines.push(`${code}: ${n}`);
  }
  if (summary.responseTimes) {
    lines.push("");
    lines.push("--- Response time stats (microseconds) ---");
    lines.push(`Count: ${summary.responseTimes.count}`);
    lines.push(`Min: ${summary.responseTimes.min} (${formatMicros(summary.responseTimes.min)})`);
    lines.push(`Max: ${summary.responseTimes.max} (${formatMicros(summary.responseTimes.max)})`);
    lines.push(`Avg: ${summary.responseTimes.avg} (${formatMicros(summary.responseTimes.avg)})`);
    lines.push(`P95: ${summary.responseTimes.p95} (${formatMicros(summary.responseTimes.p95)})`);
  }
  if (summary.topBots.length > 0) {
    lines.push("");
    lines.push("--- Bot hit counters ---");
    for (const b of summary.topBots) {
      lines.push(`${BOT_LABELS[b.family]}: ${b.hits} (${b.percent}%)`);
    }
  }
  if (summary.topCrawledUrls.length > 0) {
    lines.push("");
    lines.push("--- Top crawled URLs (Googlebot) ---");
    for (const u of summary.topCrawledUrls.slice(0, 20)) {
      lines.push(`${u.hits}x  ${u.url}  (last: ${u.lastStatus})`);
    }
  }
  if (summary.notFoundUrls.length > 0) {
    lines.push("");
    lines.push(`--- Googlebot 404s (${summary.googlebot404s} unique) ---`);
    for (const u of summary.notFoundUrls.slice(0, 50)) {
      lines.push(`${u.hits}x  ${u.url}`);
    }
  }
  if (entries.length > 0) {
    lines.push("");
    lines.push("--- Filtered entries (first 50) ---");
    for (const e of entries.slice(0, 50)) {
      const bot = e.botSubType ?? BOT_LABELS[e.botFamily];
      lines.push(`[${e.ip}] ${e.method} ${e.path} → ${e.status} (${bot})`);
    }
  }
  return lines.join("\n");
}

/** Render crawl stats as CSV (url, hits, last_status, primary_bot, family). */
export function renderCsv(summary: LogSummary): string {
  const lines = ["url,hits,last_status,primary_bot,family"];
  const all = [...summary.topCrawledUrls];
  if (all.length === 0) return lines.join("\n");
  for (const u of all) {
    const bots = Object.entries(u.bots).sort((a, b) => b[1] - a[1]);
    const primaryBot = bots[0]?.[0] ?? "";
    const family = primaryBot;
    lines.push([
      escapeCsv(u.url),
      u.hits,
      u.lastStatus,
      escapeCsv(primaryBot),
      escapeCsv(family),
    ].join(","));
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, HISTORY_MAX);
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

/** Encode a compact summary (not the full log, which may be huge) in the hash. */
export function buildShareUrl(summary: LogSummary): string {
  const params = new URLSearchParams();
  params.set("total", String(summary.totalRequests));
  params.set("gb", String(summary.googlebotHits));
  params.set("bots", String(summary.botHits));
  params.set("botpct", String(summary.botPercent));
  params.set("urls", String(summary.uniqueUrls));
  params.set("g404", String(summary.googlebot404s));
  params.set("s2", String(summary.statusDistribution["2xx"]));
  params.set("s3", String(summary.statusDistribution["3xx"]));
  params.set("s4", String(summary.statusDistribution["4xx"]));
  params.set("s5", String(summary.statusDistribution["5xx"]));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ShareSummary {
  totalRequests: number;
  googlebotHits: number;
  botHits: number;
  botPercent: number;
  uniqueUrls: number;
  googlebot404s: number;
  statusDistribution: Record<StatusCodeClass, number>;
}

export function parseShareUrl(hash: string): ShareSummary | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const total = Number(params.get("total") ?? "0");
  if (!Number.isFinite(total) || total <= 0) return null;
  const statusDistribution: Record<StatusCodeClass, number> = {
    "2xx": Number(params.get("s2") ?? "0") || 0,
    "3xx": Number(params.get("s3") ?? "0") || 0,
    "4xx": Number(params.get("s4") ?? "0") || 0,
    "5xx": Number(params.get("s5") ?? "0") || 0,
    "other": 0,
  };
  return {
    totalRequests: total,
    googlebotHits: Number(params.get("gb") ?? "0") || 0,
    botHits: Number(params.get("bots") ?? "0") || 0,
    botPercent: Number(params.get("botpct") ?? "0") || 0,
    uniqueUrls: Number(params.get("urls") ?? "0") || 0,
    googlebot404s: Number(params.get("g404") ?? "0") || 0,
    statusDistribution,
  };
}

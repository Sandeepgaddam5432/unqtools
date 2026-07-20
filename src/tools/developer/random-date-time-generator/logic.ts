/**
 * Random Date / Time Generator — pure logic.
 *
 * Generate random timestamps uniformly across a [start, end] range, format
 * them in any of eight formats (ISO 8601, Unix seconds, Unix ms, locale,
 * custom strftime-like, relative "time ago", date-only, time-only), across
 * any IANA timezone, with business-day filtering, uniqueness, sort, and
 * seeded reproducibility (mulberry32). Bulk export to plain text / CSV / JSON.
 *
 * Pure functions only — no DOM, no network. Safe to unit-test and to run
 * inside a Web Worker. All numeric state is unsigned 32-bit.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type OutputFormat =
  | "iso"
  | "unix-s"
  | "unix-ms"
  | "locale"
  | "custom"
  | "relative"
  | "date-only"
  | "time-only";

export type Granularity = "datetime" | "date" | "time";
export type SortMode = "none" | "asc" | "desc";

export interface Prng {
  /** Original numeric seed (uint32). */
  seed: number;
  /** Returns a 32-bit unsigned integer in [0, 2^32 - 1]. */
  nextUint32(): number;
  /** Returns a float in [0, 1). */
  next(): number;
}

export interface GenerateOptions {
  seed: number;
  count: number;
  startMs: number;
  endMs: number;
  format: OutputFormat;
  customPattern: string;
  timezone: string;
  granularity: Granularity;
  businessDaysOnly: boolean;
  unique: boolean;
  sort: SortMode;
}

export type GenerateResult =
  | { ok: true; formatted: string[]; raw: number[]; seed: number; stats: DateStats }
  | { ok: false; error: string };

export interface DateStats {
  count: number;
  minMs: number;
  maxMs: number;
  spanMs: number;
  spanDays: number;
}

export interface HistoryEntry {
  ts: number;
  seed: number;
  count: number;
  startMs: number;
  endMs: number;
  format: OutputFormat;
  preview: string;
}

export interface RangeValidation {
  ok: boolean;
  error?: string;
  startMs: number;
  endMs: number;
  swapped: boolean;
}

// ---------------------------------------------------------------------------
// Constants / option catalogs (UI drives off these)
// ---------------------------------------------------------------------------

export const OUTPUT_FORMATS: ReadonlyArray<{ value: OutputFormat; label: string }> = [
  { value: "iso", label: "ISO 8601 (UTC, e.g. 2025-01-15T13:45:00.000Z)" },
  { value: "unix-s", label: "Unix epoch seconds (e.g. 1736943900)" },
  { value: "unix-ms", label: "Unix epoch milliseconds (e.g. 1736943900000)" },
  { value: "locale", label: "Locale string (timezone-aware)" },
  { value: "custom", label: "Custom strftime-like pattern" },
  { value: "relative", label: "Relative 'time ago' (e.g. '3 hours ago')" },
  { value: "date-only", label: "Date only (YYYY-MM-DD, timezone-aware)" },
  { value: "time-only", label: "Time only (HH:MM:SS, timezone-aware)" },
];

export const GRANULARITIES: ReadonlyArray<{ value: Granularity; label: string }> = [
  { value: "datetime", label: "Date + Time (full precision)" },
  { value: "date", label: "Date only (whole days, midnight)" },
  { value: "time", label: "Time only (single day range)" },
];

export const TIMEZONES: ReadonlyArray<string> = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export const FORMAT_PATTERNS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "%Y-%m-%d %H:%M:%S", label: "2025-01-15 13:45:00" },
  { value: "%Y/%m/%d", label: "2025/01/15" },
  { value: "%d-%b-%Y", label: "15-Jan-2025" },
  { value: "%A, %B %d, %Y", label: "Wednesday, January 15, 2025" },
  { value: "%m/%d/%Y %I:%M %p", label: "01/15/2025 01:45 PM" },
  { value: "%Y-%m-%dT%H:%M:%S%z", label: "2025-01-15T13:45:00+0000" },
  { value: "%j day of %Y", label: "015 day of 2025" },
];

export const DEFAULT_OPTIONS: GenerateOptions = {
  seed: 1337,
  count: 10,
  startMs: Date.UTC(2020, 0, 1),
  endMs: Date.UTC(2025, 0, 1),
  format: "iso",
  customPattern: "%Y-%m-%d %H:%M:%S",
  timezone: "UTC",
  granularity: "datetime",
  businessDaysOnly: false,
  unique: false,
  sort: "none",
};

export const MAX_COUNT = 10000;

export const SAMPLE_SEED = 1337;

// ---------------------------------------------------------------------------
// PRNG (mulberry32)
// ---------------------------------------------------------------------------

/** Mulberry32 — fast, high quality, 32-bit state. */
export function mulberry32(seed: number): Prng {
  let state = seed >>> 0;
  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0);
  };
  return {
    seed: seed >>> 0,
    nextUint32,
    next: () => nextUint32() / 4294967296,
  };
}

/** Factory: returns a mulberry32 PRNG. (Single algorithm for simplicity & reproducibility.) */
export function createPrng(seed: number): Prng {
  return mulberry32(seed);
}

/** Single integer in [min, max] inclusive. */
export function nextIntInclusive(prng: Prng, min: number, max: number): number {
  if (max < min) [min, max] = [max, min];
  const range = max - min + 1;
  return min + Math.floor(prng.next() * range);
}

/** Single random timestamp (ms since epoch) in [startMs, endMs] inclusive. */
export function nextTimestamp(prng: Prng, startMs: number, endMs: number): number {
  if (endMs < startMs) [startMs, endMs] = [endMs, startMs];
  const span = endMs - startMs;
  // span can exceed 2^32, so sample with next() (float) for safety
  return Math.floor(startMs + prng.next() * (span + 1));
}

// ---------------------------------------------------------------------------
// Range validation
// ---------------------------------------------------------------------------

export function validateRange(startMs: number, endMs: number): RangeValidation {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return { ok: false, error: "Start and end must be valid timestamps.", startMs, endMs, swapped: false };
  }
  if (startMs === endMs) {
    return { ok: false, error: "Start and end are identical — range is empty.", startMs, endMs, swapped: false };
  }
  if (endMs < startMs) {
    return { ok: true, startMs: endMs, endMs: startMs, swapped: true };
  }
  return { ok: true, startMs, endMs, swapped: false };
}

// ---------------------------------------------------------------------------
// Date arithmetic helpers
// ---------------------------------------------------------------------------

/** Returns true if the given timestamp falls on a Saturday or Sunday in the chosen timezone. */
export function isWeekend(ms: number, timezone: string): boolean {
  try {
    const wd = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(new Date(ms));
    return wd === "Sat" || wd === "Sun";
  } catch {
    // Invalid timezone → fall back to UTC
    const day = new Date(ms).getUTCDay();
    return day === 0 || day === 6;
  }
}

/** Returns true if Mon-Fri in the chosen timezone. */
export function isBusinessDay(ms: number, timezone: string): boolean {
  return !isWeekend(ms, timezone);
}

/** Filter out weekends in the chosen timezone. */
export function filterBusinessDays(timestamps: number[], timezone: string): number[] {
  return timestamps.filter((t) => isBusinessDay(t, timezone));
}

/** Bucket a timestamp to the start of its day (UTC midnight). */
export function toDayBucket(ms: number): number {
  return Math.floor(ms / 86_400_000) * 86_400_000;
}

/** Bucket a timestamp to the start of its hour. */
export function toHourBucket(ms: number): number {
  return Math.floor(ms / 3_600_000) * 3_600_000;
}

/** Bucket a timestamp to the start of its minute. */
export function toMinuteBucket(ms: number): number {
  return Math.floor(ms / 60_000) * 60_000;
}

/** Bucket a timestamp to the start of its second. */
export function toSecondBucket(ms: number): number {
  return Math.floor(ms / 1_000) * 1_000;
}

/** Sort ascending (returns a new array). */
export function sortAsc(timestamps: number[]): number[] {
  return [...timestamps].sort((a, b) => a - b);
}

/** Sort descending (returns a new array). */
export function sortDesc(timestamps: number[]): number[] {
  return [...timestamps].sort((a, b) => b - a);
}

/** Remove duplicate timestamps. */
export function uniqueTimestamps(timestamps: number[]): number[] {
  return Array.from(new Set(timestamps));
}

/** Apply granularity: bucket to day / time-only and re-stamp within range. */
export function applyGranularity(ms: number, granularity: Granularity, baseDateMs: number): number {
  if (granularity === "date") return toDayBucket(ms);
  if (granularity === "time") {
    // Time-only: strip date, keep HH:MM:SS on the base date.
    const d = new Date(ms);
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    const s = d.getUTCSeconds();
    const base = new Date(baseDateMs);
    base.setUTCHours(h, m, s, 0);
    return base.getTime();
  }
  return ms;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const PAD2 = (n: number): string => String(n).padStart(2, "0");
const PAD3 = (n: number): string => String(n).padStart(3, "0");

/** Extract date/time parts in the given timezone using Intl. */
export function getParts(ms: number, timezone: string): Intl.DateTimeFormatPart[] {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", hour12: false, minute: "2-digit", second: "2-digit",
      weekday: "long",
    }).formatToParts(new Date(ms));
  } catch {
    // Invalid timezone → fall back to UTC
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", hour12: false, minute: "2-digit", second: "2-digit",
      weekday: "long",
    }).formatToParts(new Date(ms));
  }
}

interface DateParts {
  year: string;
  month: string; // 2-digit
  monthShort: string; // Jan, Feb, ...
  monthLong: string; // January, February, ...
  day: string;
  hour: string; // 24h, "00"-"23"
  minute: string;
  second: string;
  weekday: string; // Monday, Tuesday, ...
  weekdayShort: string; // Mon, Tue, ...
  yearShort: string; // 2-digit
  hour12: string; // 01-12
  ampm: string; // AM or PM
  tzOffset: string; // +0000
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WD_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WD_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Parse Intl parts into a usable structure for strftime. */
function partsToObject(ms: number, timezone: string): DateParts {
  const parts = getParts(ms, timezone);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const monthNum = parseInt(map.month ?? "1", 10) - 1;
  let hour24 = parseInt(map.hour ?? "0", 10);
  // Intl with hour12:false can return "24" for midnight; normalize.
  if (hour24 === 24) hour24 = 0;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const ampm = hour24 < 12 ? "AM" : "PM";
  // Compute weekday index in chosen timezone for short/long names.
  // map.weekday is e.g. "Monday" — find index.
  const wdLong = map.weekday ?? WD_LONG[new Date(ms).getUTCDay()];
  const wdIdx = WD_LONG.indexOf(wdLong);
  const wdShort = wdIdx >= 0 ? WD_SHORT[wdIdx] : wdLong.slice(0, 3);
  // Timezone offset in ±HHMM form
  let tzOffset = "+0000";
  try {
    const f = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "shortOffset" });
    const tzParts = f.formatToParts(new Date(ms));
    const tzPart = tzParts.find((p) => p.type === "timeZoneName");
    if (tzPart) {
      // e.g. "GMT+5:30", "GMT-4", "GMT"
      const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(tzPart.value);
      if (m) {
        const sign = m[1];
        const h = m[2].padStart(2, "0");
        const min = (m[3] ?? "00").padStart(2, "0");
        tzOffset = `${sign}${h}${min}`;
      }
    }
  } catch { /* ignore */ }
  return {
    year: map.year ?? "1970",
    month: map.month ?? "01",
    monthShort: MONTH_SHORT[monthNum] ?? "Jan",
    monthLong: MONTH_LONG[monthNum] ?? "January",
    day: map.day ?? "01",
    hour: PAD2(hour24),
    minute: map.minute ?? "00",
    second: map.second ?? "00",
    weekday: wdLong,
    weekdayShort: wdShort,
    yearShort: (map.year ?? "1970").slice(-2),
    hour12: PAD2(hour12),
    ampm,
    tzOffset,
  };
}

/** Compute day-of-year (1-366) for a timestamp in the chosen timezone. */
function dayOfYear(ms: number, timezone: string): number {
  const p = partsToObject(ms, timezone);
  const year = parseInt(p.year, 10);
  const month = parseInt(p.month, 10);
  const day = parseInt(p.day, 10);
  // Days from start of year to start of given month (non-leap baseline)
  const cum = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let doy = cum[month - 1] + day;
  // Leap year adjustment
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  if (leap && month > 2) doy += 1;
  return doy;
}

/** Custom strftime-like pattern formatter. Supports a curated token set. */
export function strftime(ms: number, pattern: string, timezone: string): string {
  const p = partsToObject(ms, timezone);
  const doy = dayOfYear(ms, timezone);
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "%" && i + 1 < pattern.length) {
      const token = pattern[++i];
      switch (token) {
        case "Y": out += p.year; break;
        case "y": out += p.yearShort; break;
        case "m": out += p.month; break;
        case "d": out += p.day; break;
        case "H": out += p.hour; break;
        case "M": out += p.minute; break;
        case "S": out += p.second; break;
        case "I": out += p.hour12; break;
        case "p": out += p.ampm; break;
        case "A": out += p.weekday; break;
        case "a": out += p.weekdayShort; break;
        case "B": out += p.monthLong; break;
        case "b": out += p.monthShort; break;
        case "j": out += PAD3(doy); break;
        case "z": out += p.tzOffset; break;
        case "%": out += "%"; break;
        default: out += `%${token}`;
      }
    } else {
      out += ch;
    }
  }
  return out;
}

/** Format a timestamp as a relative "time ago" string relative to `nowMs`. */
export function toRelative(ms: number, nowMs: number): string {
  const diff = nowMs - ms;
  const absDiff = Math.abs(diff);
  const future = diff < 0;
  const SEC = 1_000;
  const MIN = 60 * SEC;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;
  const MONTH = 30 * DAY;
  const YEAR = 365 * DAY;

  let qty: number;
  let unit: string;
  if (absDiff < MIN) { qty = Math.round(absDiff / SEC); unit = "second"; }
  else if (absDiff < HOUR) { qty = Math.round(absDiff / MIN); unit = "minute"; }
  else if (absDiff < DAY) { qty = Math.round(absDiff / HOUR); unit = "hour"; }
  else if (absDiff < WEEK) { qty = Math.round(absDiff / DAY); unit = "day"; }
  else if (absDiff < MONTH) { qty = Math.round(absDiff / WEEK); unit = "week"; }
  else if (absDiff < YEAR) { qty = Math.round(absDiff / MONTH); unit = "month"; }
  else { qty = Math.round(absDiff / YEAR); unit = "year"; }

  const plural = qty === 1 ? "" : "s";
  if (future) return `in ${qty} ${unit}${plural}`;
  if (qty === 0) return "just now";
  return `${qty} ${unit}${plural} ago`;
}

/** Top-level formatter: dispatch on `format`. */
export function formatDate(ms: number, format: OutputFormat, timezone: string, customPattern: string, nowMs?: number): string {
  const now = nowMs ?? Date.now();
  switch (format) {
    case "iso": return new Date(ms).toISOString();
    case "unix-s": return String(Math.floor(ms / 1000));
    case "unix-ms": return String(ms);
    case "locale": {
      try {
        return new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          year: "numeric", month: "short", day: "numeric",
          hour: "2-digit", minute: "2-digit", second: "2-digit",
          hour12: false,
        }).format(new Date(ms));
      } catch {
        return new Date(ms).toISOString();
      }
    }
    case "custom": return strftime(ms, customPattern, timezone);
    case "relative": return toRelative(ms, now);
    case "date-only": {
      try {
        return new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          year: "numeric", month: "2-digit", day: "2-digit",
        }).format(new Date(ms));
      } catch {
        return new Date(ms).toISOString().slice(0, 10);
      }
    }
    case "time-only": {
      try {
        return new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          hour: "2-digit", minute: "2-digit", second: "2-digit",
          hour12: false,
        }).format(new Date(ms));
      } catch {
        return new Date(ms).toISOString().slice(11, 19);
      }
    }
    default: return new Date(ms).toISOString();
  }
}

// ---------------------------------------------------------------------------
// Bulk generation
// ---------------------------------------------------------------------------

/**
 * Generate `count` random timestamps in [startMs, endMs] inclusive, applying
 * business-day filter, uniqueness, granularity, and sort as configured.
 *
 * Business-day filtering is rejection-based with a generous retry budget. If
 * the budget is exhausted (rare — e.g. range with very few business days and
 * a high count), the remaining slots are filled with non-unique business-day
 * picks and an error is *not* raised; the stats reflect what was produced.
 */
export function generateBatch(opts: GenerateOptions): GenerateResult {
  if (opts.count <= 0) return { ok: false, error: "Count must be greater than 0." };
  if (opts.count > MAX_COUNT) {
    return { ok: false, error: `Count ${opts.count} exceeds maximum of ${MAX_COUNT}.` };
  }
  const v = validateRange(opts.startMs, opts.endMs);
  if (!v.ok) return { ok: false, error: v.error ?? "Invalid range." };
  const startMs = v.startMs;
  const endMs = v.endMs;

  const prng = createPrng(opts.seed);
  const raw: number[] = [];
  const seen = new Set<number>();

  // Bucket key for uniqueness, dependent on granularity.
  const bucketKey = (t: number): number => {
    if (opts.granularity === "date") return toDayBucket(t);
    if (opts.granularity === "time") return toMinuteBucket(t);
    return toSecondBucket(t);
  };

  // Maximum possible unique buckets given the range and granularity.
  const spanMs = endMs - startMs + 1;
  const maxUnique = opts.granularity === "date"
    ? Math.floor(spanMs / 86_400_000) + 1
    : opts.granularity === "time"
      ? Math.floor(spanMs / 60_000) + 1
      : Math.floor(spanMs / 1_000) + 1;
  if (opts.unique && opts.count > maxUnique) {
    return { ok: false, error: `Cannot generate ${opts.count} unique ${opts.granularity} values from this range (max ${maxUnique}).` };
  }

  // Rejection sampling for business-day filter
  const maxAttempts = opts.businessDaysOnly ? opts.count * 50 + 200 : opts.count * 4 + 100;
  let attempts = 0;
  while (raw.length < opts.count && attempts < maxAttempts) {
    attempts++;
    let t = nextTimestamp(prng, startMs, endMs);
    if (opts.businessDaysOnly && !isBusinessDay(t, opts.timezone)) continue;
    if (opts.unique) {
      const k = bucketKey(t);
      if (seen.has(k)) continue;
      seen.add(k);
    }
    t = applyGranularity(t, opts.granularity, startMs);
    raw.push(t);
  }

  if (raw.length === 0) {
    return { ok: false, error: "Could not generate any timestamps with the current filters — try widening the range or disabling business-day-only." };
  }

  const sorted = opts.sort === "asc" ? sortAsc(raw)
    : opts.sort === "desc" ? sortDesc(raw)
    : raw;

  const formatted = sorted.map((t) => formatDate(t, opts.format, opts.timezone, opts.customPattern));
  const stats = computeStats(sorted);
  return { ok: true, formatted, raw: sorted, seed: opts.seed, stats };
}

/** Compute summary stats for an array of timestamps. */
export function computeStats(timestamps: number[]): DateStats {
  if (timestamps.length === 0) {
    return { count: 0, minMs: 0, maxMs: 0, spanMs: 0, spanDays: 0 };
  }
  let min = timestamps[0];
  let max = timestamps[0];
  for (const t of timestamps) {
    if (t < min) min = t;
    if (t > max) max = t;
  }
  const spanMs = max - min;
  return {
    count: timestamps.length,
    minMs: min,
    maxMs: max,
    spanMs,
    spanDays: spanMs / 86_400_000,
  };
}

// ---------------------------------------------------------------------------
// Output renderers
// ---------------------------------------------------------------------------

/** Render formatted strings as plain text (one per line). */
export function renderText(formatted: string[]): string {
  return formatted.join("\n");
}

/** Render formatted strings as CSV (index + value + raw ms). */
export function renderCsv(formatted: string[], raw: number[]): string {
  const lines = ["index,value,epoch_ms"];
  for (let i = 0; i < formatted.length; i++) {
    lines.push(`${i},${escapeCsv(formatted[i])},${raw[i] ?? ""}`);
  }
  return lines.join("\n");
}

/** Render as a JSON array of {value, epoch_ms}. */
export function renderJson(formatted: string[], raw: number[]): string {
  const arr = formatted.map((v, i) => ({ value: v, epoch_ms: raw[i] ?? null }));
  return JSON.stringify(arr, null, 2);
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:random-date-time-generator:history";
const HISTORY_MAX = 20;

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

// ---------------------------------------------------------------------------
// Shareable URL (config encoded in fragment — never sent to server)
// ---------------------------------------------------------------------------

export function buildShareUrl(opts: GenerateOptions): string {
  const params = new URLSearchParams();
  params.set("seed", String(opts.seed));
  params.set("n", String(opts.count));
  params.set("s", String(opts.startMs));
  params.set("e", String(opts.endMs));
  params.set("f", opts.format);
  params.set("p", opts.customPattern);
  params.set("tz", opts.timezone);
  params.set("g", opts.granularity);
  params.set("bd", opts.businessDaysOnly ? "1" : "0");
  params.set("u", opts.unique ? "1" : "0");
  params.set("so", opts.sort);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): GenerateOptions {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const base: GenerateOptions = { ...DEFAULT_OPTIONS };
  if (!clean) return base;
  const params = new URLSearchParams(clean);

  const seed = Number(params.get("seed"));
  if (Number.isFinite(seed)) base.seed = seed >>> 0;
  const n = Number(params.get("n"));
  if (Number.isFinite(n) && n > 0 && n <= MAX_COUNT) base.count = Math.floor(n);
  const s = Number(params.get("s"));
  if (Number.isFinite(s)) base.startMs = s;
  const e = Number(params.get("e"));
  if (Number.isFinite(e)) base.endMs = e;

  const f = params.get("f") as OutputFormat | null;
  if (f && (["iso", "unix-s", "unix-ms", "locale", "custom", "relative", "date-only", "time-only"] as OutputFormat[]).includes(f)) {
    base.format = f;
  }
  const p = params.get("p");
  if (p) base.customPattern = p;
  const tz = params.get("tz");
  if (tz) base.timezone = tz;
  const g = params.get("g") as Granularity | null;
  if (g && (["datetime", "date", "time"] as Granularity[]).includes(g)) {
    base.granularity = g;
  }
  if (params.get("bd") === "1") base.businessDaysOnly = true;
  if (params.get("bd") === "0") base.businessDaysOnly = false;
  if (params.get("u") === "1") base.unique = true;
  if (params.get("u") === "0") base.unique = false;
  const so = params.get("so") as SortMode | null;
  if (so && (["none", "asc", "desc"] as SortMode[]).includes(so)) {
    base.sort = so;
  }
  return base;
}

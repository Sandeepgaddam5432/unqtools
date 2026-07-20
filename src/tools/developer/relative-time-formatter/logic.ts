/**
 * Relative Time ("Time Ago") Formatter — pure logic.
 *
 * Turns a timestamp or two dates into a human "time ago" / "in X" phrase
 * across multiple locales (en, es, fr, de, ja) using Intl.RelativeTimeFormat
 * with auto unit selection and configurable thresholds. Also generates
 * copy-paste code snippets for Intl, Luxon, Day.js, and date-fns.
 *
 * Pure functions only — no DOM, no network. 100% client-side.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Locale = "en" | "es" | "fr" | "de" | "ja";
export type RtfNumeric = "always" | "auto";
export type RtfStyle = "long" | "short" | "narrow";
export type Unit =
  | "second"
  | "minute"
  | "hour"
  | "day"
  | "week"
  | "month"
  | "quarter"
  | "year";

/** Cutoff thresholds for unit selection. Each value is the upper bound (in
 *  the named unit) below which the *previous* unit is still used. */
export interface Thresholds {
  /** |diff| ≤ this seconds → "just now" / "now". */
  justNowSec: number;
  /** |diff| < this seconds → seconds unit. */
  minuteSec: number;
  /** |diff| < this minutes → minutes unit. */
  hourMin: number;
  /** |diff| < this hours → hours unit. */
  dayHour: number;
  /** |diff| < this days → days unit. */
  weekDay: number;
  /** |diff| < this days → weeks unit. */
  monthDay: number;
  /** |diff| < this months → months unit. */
  yearMonth: number;
}

export interface FormatOptions {
  locale: Locale;
  numeric: RtfNumeric;
  style: RtfStyle;
  thresholds: Thresholds;
}

export interface LocalePhrase {
  locale: Locale;
  phrase: string;
}

export interface Breakdown {
  totalMs: number;
  totalSeconds: number;
  totalMinutes: number;
  totalHours: number;
  totalDays: number;
  totalWeeks: number;
  years: number;
  months: number;
  weeks: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  direction: "past" | "future" | "now";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const LOCALES: ReadonlyArray<{ value: Locale; label: string }> = [
  { value: "en", label: "English (en)" },
  { value: "es", label: "Spanish (es)" },
  { value: "fr", label: "French (fr)" },
  { value: "de", label: "German (de)" },
  { value: "ja", label: "Japanese (ja)" },
];

export const NUMERIC_MODES: ReadonlyArray<{ value: RtfNumeric; label: string }> = [
  { value: "auto", label: "Auto (idiomatic: 'yesterday', 'now')" },
  { value: "always", label: "Always ('1 day ago', 'in 0 seconds')" },
];

export const STYLE_MODES: ReadonlyArray<{ value: RtfStyle; label: string }> = [
  { value: "long", label: "Long ('2 days ago')" },
  { value: "short", label: "Short ('2 days ago' / '2 hr. ago')" },
  { value: "narrow", label: "Narrow ('2d ago')" },
];

export const UNIT_ORDER: ReadonlyArray<Unit> = [
  "second", "minute", "hour", "day", "week", "month", "year",
];

export const DEFAULT_THRESHOLDS: Thresholds = {
  justNowSec: 45,
  minuteSec: 90,
  hourMin: 45,
  dayHour: 22,
  weekDay: 7,
  monthDay: 26,
  yearMonth: 11,
};

export const DEFAULT_OPTIONS: FormatOptions = {
  locale: "en",
  numeric: "auto",
  style: "long",
  thresholds: DEFAULT_THRESHOLDS,
};

/** Sample timestamps for quick previews. */
export const SAMPLE_DATES: ReadonlyArray<{ label: string; offsetMs: number }> = [
  { label: "10 seconds ago", offsetMs: -10_000 },
  { label: "2 minutes ago", offsetMs: -120_000 },
  { label: "3 hours ago", offsetMs: -3 * 3_600_000 },
  { label: "yesterday", offsetMs: -26 * 3_600_000 },
  { label: "5 days ago", offsetMs: -5 * 86_400_000 },
  { label: "2 weeks ago", offsetMs: -14 * 86_400_000 },
  { label: "3 months ago", offsetMs: -90 * 86_400_000 },
  { label: "2 years ago", offsetMs: -730 * 86_400_000 },
  { label: "in 30 seconds", offsetMs: 30_000 },
  { label: "in 2 hours", offsetMs: 2 * 3_600_000 },
  { label: "in 3 days", offsetMs: 3 * 86_400_000 },
  { label: "in 1 year", offsetMs: 365 * 86_400_000 },
];

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;
export const MS_PER_WEEK = 7 * MS_PER_DAY;
/** Average month length (30.4375 days) — matches Luxon's default. */
export const MS_PER_MONTH = 30.4375 * MS_PER_DAY;
/** Average year length (365.25 days) — matches Luxon's default. */
export const MS_PER_YEAR = 365.25 * MS_PER_DAY;

// ---------------------------------------------------------------------------
// Date input parsing
// ---------------------------------------------------------------------------

/** Parse a Date | number | string into a millisecond timestamp. */
export function parseDateInput(input: Date | number | string): number {
  if (input == null) throw new Error("Date input is null.");
  if (input instanceof Date) {
    const t = input.getTime();
    if (Number.isNaN(t)) throw new Error("Invalid Date object.");
    return t;
  }
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw new Error(`Invalid timestamp: ${input}`);
    return input;
  }
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) throw new Error("Empty date string.");
    // Strict YYYY-MM-DD → parse as local midnight (avoid UTC drift).
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/.exec(trimmed);
    if (m) {
      const year = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1;
      const day = parseInt(m[3], 10);
      const hour = m[4] ? parseInt(m[4], 10) : 0;
      const minute = m[5] ? parseInt(m[5], 10) : 0;
      const second = m[6] ? parseInt(m[6], 10) : 0;
      const d = new Date(year, month, day, hour, minute, second);
      if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${input}`);
      return d.getTime();
    }
    // Unix timestamp as string
    if (/^-?\d+$/.test(trimmed)) {
      const n = parseInt(trimmed, 10);
      if (Number.isFinite(n)) return n;
    }
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${input}`);
    return d.getTime();
  }
  throw new Error(`Unsupported date input: ${typeof input}`);
}

/** Convert a millisecond timestamp to an ISO-8601 local string for display. */
export function toIsoString(ms: number): string {
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

// ---------------------------------------------------------------------------
// Auto unit selection
// ---------------------------------------------------------------------------

/** Pick the best (unit, value) for a signed millisecond difference. */
export function pickUnit(
  diffMs: number,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): { unit: Unit; value: number } {
  const abs = Math.abs(diffMs);
  const sec = abs / MS_PER_SECOND;

  // "just now" zone — round to 0 seconds so Intl emits "now" / "ahora" / etc.
  if (sec <= thresholds.justNowSec) {
    return { unit: "second", value: 0 };
  }
  if (sec < thresholds.minuteSec) {
    return { unit: "second", value: Math.round(diffMs / MS_PER_SECOND) };
  }
  const min = abs / MS_PER_MINUTE;
  if (min < thresholds.hourMin) {
    return { unit: "minute", value: Math.round(diffMs / MS_PER_MINUTE) };
  }
  const hr = abs / MS_PER_HOUR;
  if (hr < thresholds.dayHour) {
    return { unit: "hour", value: Math.round(diffMs / MS_PER_HOUR) };
  }
  const day = abs / MS_PER_DAY;
  if (day < thresholds.weekDay) {
    return { unit: "day", value: Math.round(diffMs / MS_PER_DAY) };
  }
  if (day < thresholds.monthDay) {
    return { unit: "week", value: Math.round(diffMs / MS_PER_WEEK) };
  }
  const month = abs / MS_PER_MONTH;
  if (month < thresholds.yearMonth) {
    return { unit: "month", value: Math.round(diffMs / MS_PER_MONTH) };
  }
  const year = abs / MS_PER_YEAR;
  return { unit: "year", value: Math.round(diffMs / MS_PER_YEAR) };
}

// ---------------------------------------------------------------------------
// Intl.RelativeTimeFormat wrapper
// ---------------------------------------------------------------------------

const rtfCache = new Map<string, Intl.RelativeTimeFormat>();

function getRtf(locale: Locale, numeric: RtfNumeric, style: RtfStyle): Intl.RelativeTimeFormat {
  const key = `${locale}|${numeric}|${style}`;
  let rtf = rtfCache.get(key);
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric, style });
    rtfCache.set(key, rtf);
  }
  return rtf;
}

/** Format a date relative to `now` using Intl.RelativeTimeFormat. */
export function formatRelative(
  date: Date | number | string,
  now: Date | number | string = new Date(),
  options: Partial<FormatOptions> = {},
): string {
  const opts: FormatOptions = mergeOptions(options);
  const targetMs = parseDateInput(date);
  const nowMs = parseDateInput(now);
  const diff = targetMs - nowMs;
  const { unit, value } = pickUnit(diff, opts.thresholds);
  return getRtf(opts.locale, opts.numeric, opts.style).format(value, unit);
}

/** Format a date across multiple locales in one call. */
export function formatAcrossLocales(
  date: Date | number | string,
  locales: Locale[] = LOCALES.map((l) => l.value),
  now: Date | number | string = new Date(),
  options: Partial<FormatOptions> = {},
): LocalePhrase[] {
  const targetMs = parseDateInput(date);
  const nowMs = parseDateInput(now);
  const diff = targetMs - nowMs;
  return locales.map((locale) => {
    const opts: FormatOptions = mergeOptions({ ...options, locale });
    const { unit, value } = pickUnit(diff, opts.thresholds);
    const phrase = getRtf(locale, opts.numeric, opts.style).format(value, unit);
    return { locale, phrase };
  });
}

/** Format with explicit unit + value (no auto-selection). Useful when you
 *  want to force a specific unit such as "in 3 days" regardless of diff. */
export function formatWithUnit(
  value: number,
  unit: Unit,
  options: Partial<FormatOptions> = {},
): string {
  const opts: FormatOptions = mergeOptions(options);
  return getRtf(opts.locale, opts.numeric, opts.style).format(value, unit);
}

// ---------------------------------------------------------------------------
// Breakdown
// ---------------------------------------------------------------------------

/** Compute a full breakdown of the difference between two dates. */
export function computeBreakdown(
  date: Date | number | string,
  now: Date | number | string = new Date(),
): Breakdown {
  const targetMs = parseDateInput(date);
  const nowMs = parseDateInput(now);
  const diff = targetMs - nowMs;
  const abs = Math.abs(diff);
  const direction: Breakdown["direction"] =
    diff > 0 ? "future" : diff < 0 ? "past" : "now";

  const totalSeconds = abs / MS_PER_SECOND;
  const totalMinutes = abs / MS_PER_MINUTE;
  const totalHours = abs / MS_PER_HOUR;
  const totalDays = abs / MS_PER_DAY;
  const totalWeeks = abs / MS_PER_WEEK;

  // Calendar-style breakdown (largest-first, remainder carries down).
  const years = Math.floor(abs / MS_PER_YEAR);
  let rem = abs - years * MS_PER_YEAR;
  const months = Math.floor(rem / MS_PER_MONTH);
  rem -= months * MS_PER_MONTH;
  const weeks = Math.floor(rem / MS_PER_WEEK);
  rem -= weeks * MS_PER_WEEK;
  const days = Math.floor(rem / MS_PER_DAY);
  rem -= days * MS_PER_DAY;
  const hours = Math.floor(rem / MS_PER_HOUR);
  rem -= hours * MS_PER_HOUR;
  const minutes = Math.floor(rem / MS_PER_MINUTE);
  rem -= minutes * MS_PER_MINUTE;
  const seconds = Math.floor(rem / MS_PER_SECOND);

  return {
    totalMs: diff,
    totalSeconds,
    totalMinutes,
    totalHours,
    totalDays,
    totalWeeks,
    years,
    months,
    weeks,
    days,
    hours,
    minutes,
    seconds,
    direction,
  };
}

// ---------------------------------------------------------------------------
// Code snippet generators
// ---------------------------------------------------------------------------

const LUXON_LOCALE_MAP: Record<Locale, string> = {
  en: "en",
  es: "es",
  fr: "fr",
  de: "de",
  ja: "ja",
};

const DATE_FNS_LOCALE_MAP: Record<Locale, string> = {
  en: "enUS",
  es: "es",
  fr: "fr",
  de: "de",
  ja: "ja",
};

/** Generate the Intl.RelativeTimeFormat snippet. */
export function generateIntlSnippet(options: FormatOptions): string {
  const { locale, numeric, style } = options;
  return [
    `// Native Intl.RelativeTimeFormat — zero dependencies.`,
    `const rtf = new Intl.RelativeTimeFormat(${JSON.stringify(locale)}, {`,
    `  numeric: ${JSON.stringify(numeric)},`,
    `  style: ${JSON.stringify(style)},`,
    `});`,
    ``,
    `// 'value' is signed: negative = past, positive = future.`,
    `// 'unit' is one of: 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'.`,
    `const phrase = rtf.format(value, unit);`,
    `// e.g. rtf.format(-2, 'day')  → ${getRtf(locale, numeric, style).format(-2, "day")}`,
    `// e.g. rtf.format(3, 'hour')  → ${getRtf(locale, numeric, style).format(3, "hour")}`,
    `// e.g. rtf.format(0, 'second') → ${getRtf(locale, numeric, style).format(0, "second")}`,
  ].join("\n");
}

/** Generate the Luxon toRelative snippet. */
export function generateLuxonSnippet(options: FormatOptions): string {
  const locale = LUXON_LOCALE_MAP[options.locale];
  return [
    `// Luxon — install: npm i luxon`,
    `import { DateTime } from 'luxon';`,
    ``,
    `const dt = DateTime.fromMillis(targetMs);`,
    `const phrase = dt.toRelative({`,
    `  locale: ${JSON.stringify(locale)},`,
    `  base: DateTime.fromMillis(Date.now()), // optional reference 'now'`,
    `});`,
    `// e.g. '2 days ago', 'in 3 hours', 'now'`,
    `// Luxon auto-selects the unit internally (uses Intl.RelativeTimeFormat).`,
  ].join("\n");
}

/** Generate the Day.js relativeTime snippet. */
export function generateDayJsSnippet(options: FormatOptions): string {
  const locale = LUXON_LOCALE_MAP[options.locale];
  return [
    `// Day.js — install: npm i dayjs`,
    `import dayjs from 'dayjs';`,
    `import relativeTime from 'dayjs/plugin/relativeTime';`,
    `import '${locale === "en" ? "dayjs/locale/" + locale : "dayjs/locale/" + locale}';`,
    ``,
    `dayjs.extend(relativeTime);`,
    `dayjs.locale(${JSON.stringify(locale)});`,
    ``,
    `const phrase = dayjs(targetMs).fromNow();`,
    `// past  → 'a few seconds ago', '2 minutes ago', '2 days ago', …`,
    `// future → 'in a few seconds', 'in 2 minutes', 'in 2 days', …`,
    `// dayjs also offers .toNow() ('X ago') and .to(otherDayjs).`,
  ].join("\n");
}

/** Generate the date-fns formatDistance snippet. */
export function generateDateFnsSnippet(options: FormatOptions): string {
  const localeImport = DATE_FNS_LOCALE_MAP[options.locale];
  return [
    `// date-fns — install: npm i date-fns`,
    `import { formatDistance } from 'date-fns';`,
    `import { ${localeImport} } from 'date-fns/locale';`,
    ``,
    `const phrase = formatDistance(targetMs, Date.now(), {`,
    `  addSuffix: true,        // 'ago' / 'in' prefix`,
    `  includeSeconds: true,   // 'less than X seconds' for short diffs`,
    `  locale: ${localeImport},`,
    `});`,
    `// e.g. '2 days ago', 'in about 3 hours', 'less than 5 seconds ago'.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mergeOptions(partial: Partial<FormatOptions>): FormatOptions {
  const thresholds: Thresholds = {
    ...DEFAULT_THRESHOLDS,
    ...(partial.thresholds ?? {}),
  };
  return {
    locale: partial.locale ?? DEFAULT_OPTIONS.locale,
    numeric: partial.numeric ?? DEFAULT_OPTIONS.numeric,
    style: partial.style ?? DEFAULT_OPTIONS.style,
    thresholds,
  };
}

/** Return true if the given diff falls in the 'just now' zone. */
export function isJustNow(
  diffMs: number,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): boolean {
  return Math.abs(diffMs) / MS_PER_SECOND <= thresholds.justNowSec;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:relative-time-formatter:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  inputIso: string;
  nowIso: string;
  phrase: string;
  locale: Locale;
  numeric: RtfNumeric;
  style: RtfStyle;
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

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export function buildShareUrl(options: FormatOptions, inputIso: string, nowIso: string): string {
  const params = new URLSearchParams();
  params.set("l", options.locale);
  params.set("n", options.numeric);
  params.set("s", options.style);
  const t = options.thresholds;
  params.set("t", `${t.justNowSec},${t.minuteSec},${t.hourMin},${t.dayHour},${t.weekDay},${t.monthDay},${t.yearMonth}`);
  if (inputIso) params.set("d", inputIso);
  if (nowIso) params.set("r", nowIso);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { options: FormatOptions; inputIso: string; nowIso: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const opts: FormatOptions = {
    locale: DEFAULT_OPTIONS.locale,
    numeric: DEFAULT_OPTIONS.numeric,
    style: DEFAULT_OPTIONS.style,
    thresholds: { ...DEFAULT_THRESHOLDS },
  };
  let inputIso = "";
  let nowIso = "";
  if (!clean) return { options: opts, inputIso, nowIso };
  const params = new URLSearchParams(clean);

  const l = params.get("l");
  if (l && (LOCALES.map((x) => x.value) as readonly string[]).includes(l)) {
    opts.locale = l as Locale;
  }
  const n = params.get("n");
  if (n === "always" || n === "auto") opts.numeric = n;
  const s = params.get("s");
  if (s === "long" || s === "short" || s === "narrow") opts.style = s;

  const t = params.get("t");
  if (t) {
    const parts = t.split(",").map((x) => parseInt(x, 10));
    if (parts.length === 7 && parts.every((x) => Number.isFinite(x))) {
      const [
        justNowSec, minuteSec, hourMin, dayHour,
        weekDay, monthDay, yearMonth,
      ] = parts;
      opts.thresholds = {
        justNowSec, minuteSec, hourMin, dayHour, weekDay, monthDay, yearMonth,
      };
    }
  }
  inputIso = params.get("d") ?? "";
  nowIso = params.get("r") ?? "";
  return { options: opts, inputIso, nowIso };
}

// ---------------------------------------------------------------------------
// Export a combined snippet getter for the UI
// ---------------------------------------------------------------------------

export type SnippetLibrary = "intl" | "luxon" | "dayjs" | "date-fns";

export const SNIPPET_LIBRARIES: ReadonlyArray<{ value: SnippetLibrary; label: string; language: string }> = [
  { value: "intl", label: "Intl.RelativeTimeFormat", language: "javascript" },
  { value: "luxon", label: "Luxon", language: "javascript" },
  { value: "dayjs", label: "Day.js", language: "javascript" },
  { value: "date-fns", label: "date-fns", language: "javascript" },
];

export function getSnippet(library: SnippetLibrary, options: FormatOptions): string {
  switch (library) {
    case "intl": return generateIntlSnippet(options);
    case "luxon": return generateLuxonSnippet(options);
    case "dayjs": return generateDayJsSnippet(options);
    case "date-fns": return generateDateFnsSnippet(options);
  }
}

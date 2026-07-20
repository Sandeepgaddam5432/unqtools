/**
 * Week Number (ISO 8601) Calculator — pure logic.
 *
 * Calculate ISO 8601 week numbers (and US, Simple, Middle-Eastern
 * alternatives) for any date, plus the reverse lookup (year + week → date
 * range). Correct handling of week 53 and cross-year boundary cases.
 *
 * Pure functions only — no DOM, no network. 100% client-side.
 * Uses local-time date math (consistent within any single timezone).
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Convention = "iso" | "us" | "simple" | "islamic";

export interface WeekInfo {
  /** Input date as YYYY-MM-DD. */
  date: string;
  /** Week number (1-52 or 1-53). */
  week: number;
  /** Week-year (may differ from calendarYear at year boundaries). */
  weekYear: number;
  /** Calendar year of the input date. */
  calendarYear: number;
  /** Month 1-12. */
  month: number;
  /** Day 1-31. */
  day: number;
  /** ISO weekday 1-7 (1=Mon, 7=Sun). */
  weekday: number;
  /** Weekday name (English, e.g. "Monday"). */
  weekdayName: string;
  /** Start-of-week label for this convention. */
  startOfWeek: "Monday" | "Sunday" | "Saturday" | "January 1";
  /** Total weeks in the week-year (52 or 53). */
  totalWeeksInYear: number;
  /** True if this week is week 53. */
  isWeek53: boolean;
  /** True if the week spans two calendar years. */
  crossesYearBoundary: boolean;
  /** Plain-English summary. */
  summary: string;
}

export interface WeekRange {
  weekYear: number;
  week: number;
  convention: Convention;
  /** Start date (YYYY-MM-DD). */
  startDate: string;
  /** End date (YYYY-MM-DD). */
  endDate: string;
  /** Start Date object. */
  start: Date;
  /** End Date object. */
  end: Date;
  /** Number of days in the week (always 7). */
  daysInWeek: number;
  /** True if the week spans two calendar years. */
  crossesYearBoundary: boolean;
}

export interface WeekRow {
  week: number;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CONVENTIONS: ReadonlyArray<{
  value: Convention;
  label: string;
  startOfWeek: WeekInfo["startOfWeek"];
  description: string;
}> = [
  {
    value: "iso",
    label: "ISO 8601 (Mon-start, week 1 = first Thursday)",
    startOfWeek: "Monday",
    description: "International standard. Weeks run Monday→Sunday. Week 1 contains the year's first Thursday (equivalently Jan 4).",
  },
  {
    value: "us",
    label: "US (Sun-start, week 1 contains Jan 1)",
    startOfWeek: "Sunday",
    description: "North-American convention. Weeks run Sunday→Saturday. Week 1 is the Sun-Sat week containing January 1.",
  },
  {
    value: "simple",
    label: "Simple (Jan 1-7 = week 1)",
    startOfWeek: "January 1",
    description: "Naive bucketing. Week N = days (N-1)·7+1 to N·7 of the year. No partial weeks; no weekday rule.",
  },
  {
    value: "islamic",
    label: "Middle-Eastern (Sat-start, week 1 contains Jan 1)",
    startOfWeek: "Saturday",
    description: "Gulf / Middle-Eastern convention. Weeks run Saturday→Friday. Week 1 is the Sat-Fri week containing January 1.",
  },
];

export const WEEKDAY_NAMES: ReadonlyArray<string> = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

export const MONTH_NAMES: ReadonlyArray<string> = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const MS_PER_DAY = 86_400_000;
export const MS_PER_WEEK = 7 * MS_PER_DAY;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Parse Date | number | string → local Date. */
export function parseDateInput(input: Date | number | string): Date {
  if (input == null) throw new Error("Date input is null.");
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) throw new Error("Invalid Date object.");
    return new Date(input.getTime());
  }
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw new Error(`Invalid timestamp: ${input}`);
    return new Date(input);
  }
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) throw new Error("Empty date string.");
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/.exec(trimmed);
    if (m) {
      const d = new Date(
        parseInt(m[1], 10),
        parseInt(m[2], 10) - 1,
        parseInt(m[3], 10),
        m[4] ? parseInt(m[4], 10) : 0,
        m[5] ? parseInt(m[5], 10) : 0,
        m[6] ? parseInt(m[6], 10) : 0,
      );
      if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${input}`);
      return d;
    }
    if (/^-?\d+$/.test(trimmed)) {
      const n = parseInt(trimmed, 10);
      if (Number.isFinite(n)) return new Date(n);
    }
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${input}`);
    return d;
  }
  throw new Error(`Unsupported date input: ${typeof input}`);
}

/** Format a Date as YYYY-MM-DD (local time). */
export function formatDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Get ISO weekday (1=Mon..7=Sun). */
export function getIsoWeekday(date: Date): number {
  const d = date.getDay(); // 0=Sun..6=Sat
  return d === 0 ? 7 : d;
}

/** Get weekday name (English). */
export function getWeekdayName(date: Date): string {
  return WEEKDAY_NAMES[getIsoWeekday(date) - 1];
}

// ---------------------------------------------------------------------------
// ISO 8601 week logic
// ---------------------------------------------------------------------------

/** Compute the ISO 8601 week number and week-year for a date. */
export function getIsoWeekNumber(date: Date): { week: number; weekYear: number } {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const isoWeekday = getIsoWeekday(d);
  // Thursday of the ISO week containing d
  const thursday = new Date(d);
  thursday.setDate(d.getDate() + (4 - isoWeekday));
  const weekYear = thursday.getFullYear();
  // First Thursday on or after Jan 1 of weekYear (= Thursday of ISO week 1)
  const jan1 = new Date(weekYear, 0, 1);
  const jan1Iso = getIsoWeekday(jan1);
  const offset = (4 - jan1Iso + 7) % 7;
  const firstThursday = new Date(weekYear, 0, 1 + offset);
  const week = Math.floor((thursday.getTime() - firstThursday.getTime()) / MS_PER_WEEK) + 1;
  return { week, weekYear };
}

/** Number of ISO weeks in a given year (52 or 53). */
export function isoWeeksInYear(year: number): number {
  const jan1 = new Date(year, 0, 1);
  const jan1Day = jan1.getDay(); // 0=Sun..6=Sat
  // 53 weeks iff Jan 1 is Thursday (4) OR (leap and Jan 1 is Wednesday (3))
  if (jan1Day === 4 || (isLeapYear(year) && jan1Day === 3)) return 53;
  return 52;
}

/** ISO week → date range. */
export function isoWeekToDateRange(weekYear: number, week: number): { start: Date; end: Date } {
  const jan1 = new Date(weekYear, 0, 1);
  const jan1Iso = getIsoWeekday(jan1);
  const offset = (4 - jan1Iso + 7) % 7;
  const firstThursday = new Date(weekYear, 0, 1 + offset);
  // Monday of ISO week 1 = firstThursday - 3 days
  const week1Monday = new Date(firstThursday);
  week1Monday.setDate(firstThursday.getDate() - 3);
  const start = new Date(week1Monday);
  start.setDate(week1Monday.getDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

// ---------------------------------------------------------------------------
// US (Sun-start) week logic
// ---------------------------------------------------------------------------

export function getUsWeekNumber(date: Date): { week: number; weekYear: number } {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // Sunday starting the week containing d
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  const weekYear = sunday.getFullYear();
  // First Sunday on or after Jan 1 of weekYear
  const jan1 = new Date(weekYear, 0, 1);
  const jan1Day = jan1.getDay(); // 0=Sun..6=Sat
  const offset = (0 - jan1Day + 7) % 7;
  const firstSunday = new Date(weekYear, 0, 1 + offset);
  const week = Math.floor((sunday.getTime() - firstSunday.getTime()) / MS_PER_WEEK) + 1;
  return { week, weekYear };
}

export function usWeeksInYear(year: number): number {
  const jan1 = new Date(year, 0, 1);
  const jan1Day = jan1.getDay();
  // 53 weeks iff Jan 1 is Sunday (0) OR (leap and Jan 1 is Saturday (6))
  if (jan1Day === 0 || (isLeapYear(year) && jan1Day === 6)) return 53;
  return 52;
}

export function usWeekToDateRange(weekYear: number, week: number): { start: Date; end: Date } {
  const jan1 = new Date(weekYear, 0, 1);
  const jan1Day = jan1.getDay();
  const offset = (0 - jan1Day + 7) % 7;
  const firstSunday = new Date(weekYear, 0, 1 + offset);
  const start = new Date(firstSunday);
  start.setDate(firstSunday.getDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

// ---------------------------------------------------------------------------
// Simple (Jan 1-7 = week 1) week logic
// ---------------------------------------------------------------------------

export function getSimpleWeekNumber(date: Date): { week: number; weekYear: number } {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((d.getTime() - yearStart.getTime()) / MS_PER_DAY) + 1;
  const week = Math.ceil(dayOfYear / 7);
  return { week, weekYear: d.getFullYear() };
}

export function simpleWeeksInYear(year: number): number {
  // ceil(365/7) = 53, ceil(366/7) = 53
  return 53;
}

export function simpleWeekToDateRange(weekYear: number, week: number): { start: Date; end: Date } {
  const start = new Date(weekYear, 0, 1 + (week - 1) * 7);
  const end = new Date(weekYear, 0, 1 + (week - 1) * 7 + 6);
  return { start, end };
}

// ---------------------------------------------------------------------------
// Middle-Eastern (Sat-start) week logic
// ---------------------------------------------------------------------------

export function getIslamicWeekNumber(date: Date): { week: number; weekYear: number } {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // Saturday starting the week containing d.
  // Sat = 6, Sun = 0, Mon = 1, ..., Fri = 5.
  // daysSinceSat: Sat=0, Sun=1, Mon=2, Tue=3, Wed=4, Thu=5, Fri=6.
  const daysSinceSat = (d.getDay() + 1) % 7;
  const saturday = new Date(d);
  saturday.setDate(d.getDate() - daysSinceSat);
  const weekYear = saturday.getFullYear();
  // First Saturday on or after Jan 1 of weekYear
  const jan1 = new Date(weekYear, 0, 1);
  const jan1DaysSinceSat = (jan1.getDay() + 1) % 7;
  const offset = (0 - jan1DaysSinceSat + 7) % 7;
  const firstSaturday = new Date(weekYear, 0, 1 + offset);
  const week = Math.floor((saturday.getTime() - firstSaturday.getTime()) / MS_PER_WEEK) + 1;
  return { week, weekYear };
}

export function islamicWeeksInYear(year: number): number {
  const jan1 = new Date(year, 0, 1);
  const jan1Day = jan1.getDay();
  // 53 weeks iff Jan 1 is Saturday (6) OR (leap and Jan 1 is Friday (5))
  if (jan1Day === 6 || (isLeapYear(year) && jan1Day === 5)) return 53;
  return 52;
}

export function islamicWeekToDateRange(weekYear: number, week: number): { start: Date; end: Date } {
  const jan1 = new Date(weekYear, 0, 1);
  const jan1DaysSinceSat = (jan1.getDay() + 1) % 7;
  const offset = (0 - jan1DaysSinceSat + 7) % 7;
  const firstSaturday = new Date(weekYear, 0, 1 + offset);
  const start = new Date(firstSaturday);
  start.setDate(firstSaturday.getDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

// ---------------------------------------------------------------------------
// Dispatchers
// ---------------------------------------------------------------------------

export function getWeekNumber(date: Date, convention: Convention): WeekInfo {
  let r: { week: number; weekYear: number };
  let startOfWeek: WeekInfo["startOfWeek"];
  switch (convention) {
    case "iso": r = getIsoWeekNumber(date); startOfWeek = "Monday"; break;
    case "us": r = getUsWeekNumber(date); startOfWeek = "Sunday"; break;
    case "simple": r = getSimpleWeekNumber(date); startOfWeek = "January 1"; break;
    case "islamic": r = getIslamicWeekNumber(date); startOfWeek = "Saturday"; break;
  }
  const totalWeeksInYear = weeksInYear(r.weekYear, convention);
  const range = weekToDateRange(r.weekYear, r.week, convention);
  const weekday = getIsoWeekday(date);
  const weekdayName = WEEKDAY_NAMES[weekday - 1];
  const crossesYearBoundary = range.start.getFullYear() !== range.end.getFullYear();
  const isWeek53 = r.week === 53;
  const summary = buildSummary(date, r.week, r.weekYear, convention, totalWeeksInYear, isWeek53, crossesYearBoundary);

  return {
    date: formatDate(date),
    week: r.week,
    weekYear: r.weekYear,
    calendarYear: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    weekday,
    weekdayName,
    startOfWeek,
    totalWeeksInYear,
    isWeek53,
    crossesYearBoundary,
    summary,
  };
}

export function weeksInYear(year: number, convention: Convention): number {
  switch (convention) {
    case "iso": return isoWeeksInYear(year);
    case "us": return usWeeksInYear(year);
    case "simple": return simpleWeeksInYear(year);
    case "islamic": return islamicWeeksInYear(year);
  }
}

export function hasWeek53(year: number, convention: Convention): boolean {
  return weeksInYear(year, convention) === 53;
}

export function weekToDateRange(weekYear: number, week: number, convention: Convention): WeekRange {
  let pair: { start: Date; end: Date };
  switch (convention) {
    case "iso": pair = isoWeekToDateRange(weekYear, week); break;
    case "us": pair = usWeekToDateRange(weekYear, week); break;
    case "simple": pair = simpleWeekToDateRange(weekYear, week); break;
    case "islamic": pair = islamicWeekToDateRange(weekYear, week); break;
  }
  const crossesYearBoundary = pair.start.getFullYear() !== pair.end.getFullYear();
  return {
    weekYear,
    week,
    convention,
    startDate: formatDate(pair.start),
    endDate: formatDate(pair.end),
    start: pair.start,
    end: pair.end,
    daysInWeek: 7,
    crossesYearBoundary,
  };
}

// ---------------------------------------------------------------------------
// Year grid + current week
// ---------------------------------------------------------------------------

export function buildYearGrid(year: number, convention: Convention, now: Date = new Date()): WeekRow[] {
  const total = weeksInYear(year, convention);
  const current = getWeekNumber(now, convention);
  const rows: WeekRow[] = [];
  for (let w = 1; w <= total; w++) {
    const range = weekToDateRange(year, w, convention);
    rows.push({
      week: w,
      startDate: range.startDate,
      endDate: range.endDate,
      isCurrent: current.week === w && current.weekYear === year,
    });
  }
  return rows;
}

export function findCurrentWeek(now: Date = new Date(), convention: Convention = "iso"): WeekInfo {
  return getWeekNumber(now, convention);
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

function buildSummary(
  date: Date,
  week: number,
  weekYear: number,
  convention: Convention,
  totalWeeks: number,
  isWeek53: boolean,
  crossesYearBoundary: boolean,
): string {
  const convLabel = CONVENTIONS.find((c) => c.value === convention)?.label.split(" (")[0] ?? convention;
  const dateStr = formatDate(date);
  let s = `${dateStr} is ${convLabel} week ${week} of ${weekYear} (of ${totalWeeks}).`;
  if (weekYear !== date.getFullYear()) {
    s += ` Note: week-year ${weekYear} differs from calendar year ${date.getFullYear()}.`;
  }
  if (isWeek53) s += " This is a leap-week (week 53).";
  if (crossesYearBoundary) s += " This week spans two calendar years.";
  return s;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:week-number-iso-calculator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  dateIso: string;
  convention: Convention;
  week: number;
  weekYear: number;
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

export function buildShareUrl(convention: Convention, dateIso: string): string {
  const params = new URLSearchParams();
  params.set("c", convention);
  if (dateIso) params.set("d", dateIso);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { convention: Convention; dateIso: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const valid = CONVENTIONS.map((c) => c.value) as readonly Convention[];
  let convention: Convention = "iso";
  let dateIso = "";
  if (!clean) return { convention, dateIso };
  const params = new URLSearchParams(clean);
  const c = params.get("c");
  if (c && (valid as readonly string[]).includes(c)) convention = c as Convention;
  dateIso = params.get("d") ?? "";
  return { convention, dateIso };
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

export function renderYearGridCsv(year: number, convention: Convention, now: Date = new Date()): string {
  const rows = buildYearGrid(year, convention, now);
  const lines = ["week,start_date,end_date,is_current"];
  for (const r of rows) {
    lines.push([
      String(r.week),
      r.startDate,
      r.endDate,
      r.isCurrent ? "1" : "0",
    ].join(","));
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Sample dates
// ---------------------------------------------------------------------------

export const SAMPLE_DATES: ReadonlyArray<{ label: string; iso: string }> = [
  { label: "2014-12-29 (Mon, ISO W1 2015)", iso: "2014-12-29" },
  { label: "2015-01-01 (Thu, ISO W1 2015)", iso: "2015-01-01" },
  { label: "2015-12-31 (Thu, ISO W53 2015)", iso: "2015-12-31" },
  { label: "2016-01-01 (Fri, ISO W53 2015)", iso: "2016-01-01" },
  { label: "2020-12-31 (Thu, ISO W53 2020)", iso: "2020-12-31" },
  { label: "2021-01-01 (Fri, ISO W53 2020)", iso: "2021-01-01" },
  { label: "2017-01-01 (Sun, US W1 2017)", iso: "2017-01-01" },
  { label: "2011-01-01 (Sat, US W52 2010)", iso: "2011-01-01" },
  { label: "Today", iso: "today" },
];

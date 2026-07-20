/**
 * Day of the Week Finder — pure logic.
 *
 * Computes the weekday of any date using three independent methods
 * (Zeller's congruence, Sakamoto's algorithm, JavaScript Date) and
 * exposes rich date context: day-of-year, ISO week, days-until/since,
 * next/previous weekday, Nth weekday of month, recurring-weekday views
 * across a year range, and Doomsday-rule teaching steps.
 *
 * Pure functions only — no DOM, no network.
 */

export type WeekdayNum = 0 | 1 | 2 | 3 | 4 | 5 | 6;
// 0 = Sunday, 1 = Monday, ..., 6 = Saturday (JavaScript convention).

export const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
] as const;

export const WEEKDAY_SHORT = [
  "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat",
] as const;

export const MONTH_NAMES = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
] as const;

export const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export interface ParsedDate {
  year: number;
  month: number; // 0-11
  day: number;   // 1-31
  ok: boolean;
  error?: string;
}

export interface WeekdayResult {
  year: number;
  month: number; // 0-11
  day: number;
  weekday: WeekdayNum;
  weekdayName: string;
  weekdayShort: string;
  isoWeek: number;
  dayOfYear: number;
  daysUntilToday: number; // negative = past, positive = future
  isLeapYear: boolean;
  zeller: WeekdayNum;
  sakamoto: WeekdayNum;
  jsDate: WeekdayNum;
  allAgree: boolean;
  julianGregorianNote: string;
}

export interface NthWeekdayResult {
  date: Date | null;
  year: number;
  month: number;
  weekday: WeekdayNum;
  n: number;
  label: string; // e.g., "2nd Tuesday of November 2025"
}

export interface RecurringResult {
  year: number;
  date: Date;
  weekday: WeekdayNum;
  weekdayName: string;
  isoWeek: number;
}

export interface DoomsdayStep {
  title: string;
  detail: string;
  value: string;
}

export interface DoomsdayResult {
  anchorDay: WeekdayNum;
  anchorDayName: string;
  yearDoomsday: WeekdayNum;
  yearDoomsdayName: string;
  nearestAnchor: { month: number; day: number; label: string; date: Date };
  steps: DoomsdayStep[];
  targetWeekday: WeekdayNum;
}

// ---------------------------------------------------------------------------
// Parsing & validation
// ---------------------------------------------------------------------------

/** Parse a date string (YYYY-MM-DD) strictly. */
export function parseDate(input: string): ParsedDate {
  const s = (input || "").trim();
  if (!s) return { year: 0, month: 0, day: 0, ok: false, error: "Empty" };
  const m = /^(\d{1,4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (!m) return { year: 0, month: 0, day: 0, ok: false, error: "Use YYYY-MM-DD" };
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1; // 0-11
  const day = parseInt(m[3], 10);
  if (month < 0 || month > 11) {
    return { year, month, day, ok: false, error: "Month must be 1–12" };
  }
  if (day < 1 || day > 31) {
    return { year, month, day, ok: false, error: "Day must be 1–31" };
  }
  const daysIn = daysInMonth(year, month);
  if (day > daysIn) {
    return {
      year, month, day, ok: false,
      error: `${MONTH_NAMES[month]} ${year} has only ${daysIn} days`,
    };
  }
  // Range guard: JavaScript Date handles far past/future, but bound to ±100000 years.
  if (year < -99999 || year > 99999) {
    return { year, month, day, ok: false, error: "Year out of range" };
  }
  return { year, month, day, ok: true };
}

/** Format a Date as YYYY-MM-DD (zero-padded). */
export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Build a Date from year/month/day, treating them as local midnight. */
export function makeDate(year: number, month: number, day: number): Date {
  return new Date(year, month, day, 0, 0, 0, 0);
}

// ---------------------------------------------------------------------------
// Calendar math helpers
// ---------------------------------------------------------------------------

/** Is the given year a leap year (Gregorian)? */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/** Number of days in a given month (0-11) of a given year. */
export function daysInMonth(year: number, month: number): number {
  const dim = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 1 && isLeapYear(year)) return 29;
  return dim[month];
}

/** Day of year (1–366). */
export function getDayOfYear(year: number, month: number, day: number): number {
  let doy = day;
  for (let i = 0; i < month; i++) doy += daysInMonth(year, i);
  return doy;
}

/** Total days in a year (365 or 366). */
export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

/** ISO 8601 week number (1–53). Returns { year, week }. */
export function getIsoWeek(date: Date): { year: number; week: number } {
  // ISO week: Week 1 is the week containing the first Thursday.
  // Algorithm: find Thursday of the same week as `date`.
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Sun..6=Sat
  // ISO weekday: Mon=1..Sun=7
  const isoDay = day === 0 ? 7 : day;
  // Move to Thursday of the same ISO week.
  const thursday = new Date(d);
  thursday.setDate(d.getDate() + (4 - isoDay));
  const isoYear = thursday.getFullYear();
  // First Thursday of isoYear.
  const firstThursday = new Date(isoYear, 0, 4);
  const ftDay = firstThursday.getDay();
  const ftIso = ftDay === 0 ? 7 : ftDay;
  const firstThursdayWeek1 = new Date(firstThursday);
  firstThursdayWeek1.setDate(firstThursday.getDate() + (4 - ftIso));
  const diffMs = thursday.getTime() - firstThursdayWeek1.getTime();
  const week = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
  return { year: isoYear, week };
}

/** Difference in whole days between two Dates (b - a), ignoring time. */
export function dayDiff(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

// ---------------------------------------------------------------------------
// Weekday algorithms — three independent implementations
// ---------------------------------------------------------------------------

/**
 * Zeller's congruence (Gregorian).
 * Returns weekday in Zeller's convention: 0 = Saturday, 1 = Sunday, …, 6 = Friday.
 */
export function zellerWeekday(year: number, month: number, day: number): WeekdayNum {
  let m = month + 1; // 1-12
  let y = year;
  if (m < 3) {
    m += 12;
    y -= 1;
  }
  const K = y % 100;
  const J = Math.floor(y / 100);
  // Zeller's formula
  const h = (day + Math.floor((13 * (m + 1)) / 5) + K + Math.floor(K / 4) + Math.floor(J / 4) - 2 * J) % 7;
  // Zeller's h: 0=Sat, 1=Sun, 2=Mon, ..., 6=Fri
  // Convert to JS convention: 0=Sun, 1=Mon, ..., 6=Sat
  const adjusted = ((h - 1) % 7 + 7) % 7;
  return adjusted as WeekdayNum;
}

/**
 * Sakamoto's algorithm.
 * Returns weekday in JS convention: 0 = Sunday, 1 = Monday, …, 6 = Saturday.
 */
export function sakamotoWeekday(year: number, month: number, day: number): WeekdayNum {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  let y = year;
  if (month < 2) y -= 1; // month is 0-11; January (0) and February (1) → subtract 1
  const w = (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[month] + day) % 7;
  return ((w % 7) + 7) % 7 as WeekdayNum;
}

/** JavaScript Date#getDay() — third independent reference. */
export function jsDateWeekday(date: Date): WeekdayNum {
  return date.getDay() as WeekdayNum;
}

// ---------------------------------------------------------------------------
// Main: find weekday for a date
// ---------------------------------------------------------------------------

export function findDayOfWeek(parsed: ParsedDate): WeekdayResult {
  if (!parsed.ok) {
    throw new Error(parsed.error || "Invalid date");
  }
  const { year, month, day } = parsed;
  const date = makeDate(year, month, day);
  const zeller = zellerWeekday(year, month, day);
  const sakamoto = sakamotoWeekday(year, month, day);
  const js = jsDateWeekday(date);
  const weekday = js; // canonical
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysUntilToday = dayDiff(todayMid, date);
  const isoWeek = getIsoWeek(date);
  const doy = getDayOfYear(year, month, day);
  const note = julianGregorianNote(year);
  return {
    year, month, day,
    weekday,
    weekdayName: WEEKDAY_NAMES[weekday],
    weekdayShort: WEEKDAY_SHORT[weekday],
    isoWeek: isoWeek.week,
    dayOfYear: doy,
    daysUntilToday,
    isLeapYear: isLeapYear(year),
    zeller,
    sakamoto,
    jsDate: js,
    allAgree: zeller === sakamoto && sakamoto === js,
    julianGregorianNote: note,
  };
}

/**
 * Julian-vs-Gregorian historical note.
 * Most Catholic Europe switched in 1582; Britain/colonies in 1752.
 * Returns a short contextual string.
 */
export function julianGregorianNote(year: number): string {
  if (year < 1582) {
    return "Before the Gregorian reform (1582). We use the proleptic Gregorian calendar; in real history this date would have used the Julian calendar, which differs by an increasing number of days.";
  }
  if (year === 1582) {
    return "Transition year: Pope Gregory XIII introduced the Gregorian calendar in October 1582 (10 days were skipped). Dates 5–14 Oct 1582 did not exist in Catholic Europe. We compute proleptic Gregorian.";
  }
  if (year > 1582 && year < 1752) {
    return "After Gregorian introduction (1582) but before Britain/colonies adopted it (1752). Many countries still used Julian at this time — historical weekday may differ from local-calendar records.";
  }
  return "Gregorian calendar (standardized since 1582).";
}

// ---------------------------------------------------------------------------
// Next / previous specific weekday
// ---------------------------------------------------------------------------

/** Find the next date that falls on `targetWeekday` strictly after `from`. */
export function findNextWeekday(from: Date, targetWeekday: WeekdayNum): Date {
  const out = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const cur = out.getDay() as WeekdayNum;
  let delta = (targetWeekday - cur + 7) % 7;
  if (delta === 0) delta = 7;
  out.setDate(out.getDate() + delta);
  return out;
}

/** Find the previous date that fell on `targetWeekday` strictly before `from`. */
export function findPreviousWeekday(from: Date, targetWeekday: WeekdayNum): Date {
  const out = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const cur = out.getDay() as WeekdayNum;
  let delta = (cur - targetWeekday + 7) % 7;
  if (delta === 0) delta = 7;
  out.setDate(out.getDate() - delta);
  return out;
}

// ---------------------------------------------------------------------------
// Nth weekday of month (e.g., "2nd Tuesday")
// ---------------------------------------------------------------------------

export const ORDINAL_WORDS = [
  "1st", "2nd", "3rd", "4th", "5th",
] as const;

/** Find the Nth (1st–5th) occurrence of `weekday` in `month`/`year`. Returns null if N is too large. */
export function findNthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: WeekdayNum,
  n: number,
): NthWeekdayResult {
  if (n < 1 || n > 5) {
    throw new Error("n must be between 1 and 5");
  }
  // First day of the month.
  const first = makeDate(year, month, 1);
  const firstWeekday = first.getDay() as WeekdayNum;
  // Offset to first occurrence of the target weekday.
  const offset = (weekday - firstWeekday + 7) % 7;
  const dayOfMonth = 1 + offset + (n - 1) * 7;
  const dim = daysInMonth(year, month);
  if (dayOfMonth > dim) {
    return {
      date: null,
      year, month, weekday, n,
      label: `${ORDINAL_WORDS[n - 1]} ${WEEKDAY_NAMES[weekday]} of ${MONTH_NAMES[month]} ${year} (does not exist)`,
    };
  }
  const date = makeDate(year, month, dayOfMonth);
  return {
    date,
    year, month, weekday, n,
    label: `${ORDINAL_WORDS[n - 1]} ${WEEKDAY_NAMES[weekday]} of ${MONTH_NAMES[month]} ${year}`,
  };
}

// ---------------------------------------------------------------------------
// Recurring weekday view across a year range
// ---------------------------------------------------------------------------

/** For a fixed month/day, list the weekday across a range of years. */
export function recurringWeekdayAcrossYears(
  startYear: number,
  endYear: number,
  month: number,
  day: number,
): RecurringResult[] {
  if (endYear < startYear) {
    throw new Error("endYear must be >= startYear");
  }
  const out: RecurringResult[] = [];
  for (let y = startYear; y <= endYear; y++) {
    // Skip Feb 29 in non-leap years.
    if (month === 1 && day === 29 && !isLeapYear(y)) {
      continue;
    }
    const date = makeDate(y, month, day);
    const isoWeek = getIsoWeek(date);
    out.push({
      year: y,
      date,
      weekday: date.getDay() as WeekdayNum,
      weekdayName: WEEKDAY_NAMES[date.getDay() as WeekdayNum],
      isoWeek: isoWeek.week,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Doomsday rule (Conway's algorithm) — teaching mode
// ---------------------------------------------------------------------------

/** Century anchor day (Gregorian). Returns 0=Sun..6=Sat. */
export function centuryAnchor(year: number): WeekdayNum {
  const c = Math.floor(year / 100);
  return ((2 + 5 * (c % 4)) % 7) as WeekdayNum;
}

/** Doomsday for a given year (the weekday that all doomsday anchor dates fall on). */
export function yearDoomsday(year: number): WeekdayNum {
  const anchor = centuryAnchor(year);
  const y = year % 100;
  const a = Math.floor(y / 12);
  const b = y % 12;
  const c = Math.floor(b / 4);
  return ((anchor + a + b + c) % 7) as WeekdayNum;
}

/** Doomsday anchor dates (month 0-11, day). */
export const DOOMSDAY_ANCHORS: { month: number; day: number; label: string }[] = [
  { month: 0, day: 3, label: "Jan 3 (or Jan 4 in leap years)" },
  { month: 1, day: 28, label: "Feb 28 (or Feb 29 in leap years)" },
  { month: 2, day: 14, label: "Mar 14 (Pi Day)" },
  { month: 3, day: 4, label: "Apr 4 (4/4)" },
  { month: 4, day: 9, label: "May 9 (9-to-5)" },
  { month: 5, day: 6, label: "Jun 6 (6/6)" },
  { month: 6, day: 11, label: "Jul 11 (7-Eleven)" },
  { month: 7, day: 8, label: "Aug 8 (8/8)" },
  { month: 8, day: 5, label: "Sep 5 (9-to-5)" },
  { month: 9, day: 10, label: "Oct 10 (10/10)" },
  { month: 10, day: 7, label: "Nov 7 (7-Eleven)" },
  { month: 11, day: 12, label: "Dec 12 (12/12)" },
];

/** Find the closest doomsday anchor before (or on) the target date. */
export function findClosestAnchor(year: number, month: number, day: number): {
  month: number; day: number; label: string; date: Date;
} {
  const target = makeDate(year, month, day);
  let best = DOOMSDAY_ANCHORS[0];
  let bestDate = makeDate(year, best.month, best.day);
  let bestDiff = Math.abs(dayDiff(bestDate, target));
  for (const anchor of DOOMSDAY_ANCHORS) {
    let aDate = makeDate(year, anchor.month, anchor.day);
    // Adjust Jan/Feb anchors for leap years.
    if (anchor.month === 0 && isLeapYear(year) && anchor.day === 3) {
      aDate = makeDate(year, 0, 4);
    }
    if (anchor.month === 1 && isLeapYear(year) && anchor.day === 28) {
      aDate = makeDate(year, 1, 29);
    }
    const diff = Math.abs(dayDiff(aDate, target));
    if (diff < bestDiff) {
      best = anchor;
      bestDate = aDate;
      bestDiff = diff;
    }
  }
  return { ...best, date: bestDate };
}

/** Full Doomsday-rule teaching mode for a date. */
export function doomsdayRuleSteps(year: number, month: number, day: number): DoomsdayResult {
  const anchor = centuryAnchor(year);
  const doom = yearDoomsday(year);
  const closest = findClosestAnchor(year, month, day);
  const target = makeDate(year, month, day);
  const diff = dayDiff(closest.date, target);
  // Weekday of target = (doom + diff) mod 7
  const targetWeekday = (((doom + diff) % 7) + 7) % 7 as WeekdayNum;

  const steps: DoomsdayStep[] = [
    {
      title: "1. Century anchor day",
      detail: `For century ${Math.floor(year / 100)}00s, the anchor day is the weekday all doomsday dates in that century share.`,
      value: `${WEEKDAY_NAMES[anchor]} (computed as (2 + 5 × century mod 4) mod 7)`,
    },
    {
      title: "2. Year's doomsday",
      detail: "Take last two digits of year. doomsday = (anchor + floor(y/12) + (y mod 12) + floor((y mod 12)/4)) mod 7.",
      value: `${WEEKDAY_NAMES[doom]} (y=${year % 100})`,
    },
    {
      title: "3. Nearest anchor date",
      detail: "Pick the doomsday anchor date closest to the target.",
      value: `${closest.label} — ${WEEKDAY_NAMES[doom]}`,
    },
    {
      title: "4. Offset to target",
      detail: "Count days from the anchor to the target (negative if before).",
      value: `${diff >= 0 ? "+" : ""}${diff} day(s)`,
    },
    {
      title: "5. Final weekday",
      detail: "(doomsday + offset) mod 7 — verified against Zeller and Sakamoto.",
      value: WEEKDAY_NAMES[targetWeekday],
    },
  ];

  return {
    anchorDay: anchor,
    anchorDayName: WEEKDAY_NAMES[anchor],
    yearDoomsday: doom,
    yearDoomsdayName: WEEKDAY_NAMES[doom],
    nearestAnchor: closest,
    steps,
    targetWeekday,
  };
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

/** Render a WeekdayResult as plain-text summary. */
export function renderResultText(r: WeekdayResult): string {
  const lines: string[] = [
    `${r.weekdayName}, ${MONTH_NAMES[r.month]} ${r.day}, ${r.year}`,
    `ISO week: ${r.isoWeek}`,
    `Day of year: ${r.dayOfYear} of ${daysInYear(r.year)}`,
    `Leap year: ${r.isLeapYear ? "yes" : "no"}`,
    r.daysUntilToday === 0
      ? "Today"
      : r.daysUntilToday > 0
        ? `${r.daysUntilToday} day(s) from today`
        : `${-r.daysUntilToday} day(s) ago`,
    `Zeller: ${WEEKDAY_NAMES[r.zeller]} | Sakamoto: ${WEEKDAY_NAMES[r.sakamoto]} | JS: ${WEEKDAY_NAMES[r.jsDate]}`,
    r.allAgree ? "All three algorithms agree ✓" : "⚠ Algorithms disagree",
    r.julianGregorianNote,
  ];
  return lines.join("\n");
}

/** Render a recurring-weekday list as plain text. */
export function renderRecurringText(rows: RecurringResult[], month: number, day: number): string {
  const lines: string[] = [`Weekday of ${MONTH_NAMES[month]} ${day} across years:`];
  for (const r of rows) {
    lines.push(`${r.year}: ${r.weekdayName} (ISO week ${r.isoWeek})`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:day-of-the-week-finder:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  date: string;       // YYYY-MM-DD
  weekdayName: string;
  operation: string;  // human label
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

export type ShareOp = "single" | "next" | "previous" | "nth" | "recurring" | "doomsday";

export function buildShareUrl(
  op: ShareOp,
  params: {
    date?: string;
    targetWeekday?: number;
    nth?: number;
    startYear?: number;
    endYear?: number;
  },
): string {
  const sp = new URLSearchParams();
  sp.set("op", op);
  if (params.date) sp.set("d", params.date);
  if (params.targetWeekday !== undefined) sp.set("wd", String(params.targetWeekday));
  if (params.nth !== undefined) sp.set("n", String(params.nth));
  if (params.startYear !== undefined) sp.set("sy", String(params.startYear));
  if (params.endYear !== undefined) sp.set("ey", String(params.endYear));
  if (typeof window === "undefined") return `?${sp.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${sp.toString()}`;
}

export function parseShareUrl(hash: string): {
  op: ShareOp;
  date?: string;
  targetWeekday?: WeekdayNum;
  nth?: number;
  startYear?: number;
  endYear?: number;
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { op: "single" };
  const sp = new URLSearchParams(clean);
  const opRaw = sp.get("op") ?? "single";
  const validOps: ShareOp[] = ["single", "next", "previous", "nth", "recurring", "doomsday"];
  const op = validOps.includes(opRaw as ShareOp) ? (opRaw as ShareOp) : "single";
  const date = sp.get("d") ?? undefined;
  const wdRaw = sp.get("wd");
  const targetWeekday = wdRaw !== null ? (((parseInt(wdRaw, 10) % 7) + 7) % 7) as WeekdayNum : undefined;
  const nRaw = sp.get("n");
  const nth = nRaw !== null ? parseInt(nRaw, 10) : undefined;
  const syRaw = sp.get("sy");
  const startYear = syRaw !== null ? parseInt(syRaw, 10) : undefined;
  const eyRaw = sp.get("ey");
  const endYear = eyRaw !== null ? parseInt(eyRaw, 10) : undefined;
  return { op, date, targetWeekday, nth, startYear, endYear };
}

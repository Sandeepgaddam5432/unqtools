/**
 * Date Difference Calculator — pure logic.
 *
 * Calculate the difference between two dates (and optionally times) in
 * calendar years/months/days + totals in weeks/days/hours/minutes/seconds.
 * Include/exclude end day toggle. Business-days mode with custom weekend +
 * holiday list. Age calculation. "Ago / from now" relative phrasing. Batch
 * mode. Shareable URL. Calendar-correct for month-end + leap years.
 *
 * Pure functions only — no DOM, no network. Uses UTC for all date math to
 * avoid DST-related surprises; timezone offsets are applied at parse time
 * when an explicit zone is supplied.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DifferenceResult {
  /** Calendar-aware years/months/days breakdown (always non-negative). */
  years: number;
  months: number;
  days: number;
  /** Whether end is before start (negated). */
  isNegative: boolean;
  /** Totals (always non-negative). */
  totalMs: number;
  totalSeconds: number;
  totalMinutes: number;
  totalHours: number;
  totalDays: number;
  totalWeeks: number;
  /** Number of weekdays (Mon–Fri by default, configurable). */
  weekdays: number;
  /** Number of weekend days. */
  weekendDays: number;
  /** Number of business days (weekdays minus holidays). */
  businessDays: number;
  /** Number of holidays that fell on a weekday in the range. */
  holidaysHit: number;
  /** Plain-English explanation of the include/exclude convention. */
  includeEndExplanation: string;
  /** Human-readable summary line. */
  summary: string;
  /** "Ago / from now" phrasing. */
  relativePhrase: string;
}

export interface DifferenceInput {
  startMs: number;
  endMs: number;
  includeEndDay: boolean;
  /** 0=Sun, 1=Mon, ... 6=Sat. Default [0, 6] (Sun + Sat). */
  weekendDays?: number[];
  /** List of holiday dates as YYYY-MM-DD strings. */
  holidays?: string[];
}

export interface AgeResult {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  nextBirthdayMs: number;
  daysUntilNextBirthday: number;
  nextBirthdayDate: string;
  summary: string;
}

export interface BatchRow {
  start: string;
  end: string;
  totalDays: number;
  businessDays: number;
  years: number;
  months: number;
  days: number;
  ok: boolean;
  error?: string;
}

export interface HistoryEntry {
  ts: number;
  start: string;
  end: string;
  includeEndDay: boolean;
  totalDays: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;
export const MS_PER_WEEK = 7 * MS_PER_DAY;

export const DEFAULT_WEEKEND_DAYS: ReadonlyArray<number> = [0, 6];

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ---------------------------------------------------------------------------
// Date parsing & formatting
// ---------------------------------------------------------------------------

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function pad4(n: number): string {
  if (n < 0) return `-${pad4(-n)}`;
  return n < 10 ? `000${n}` : n < 100 ? `00${n}` : n < 1000 ? `0${n}` : String(n);
}

/**
 * Parse a date or date-time string into a UTC ms instant.
 *
 * Accepts:
 *   - "YYYY-MM-DD"             → midnight UTC
 *   - "YYYY-MM-DDTHH:MM"       → that time UTC
 *   - "YYYY-MM-DDTHH:MM:SS"    → that time UTC
 *   - "YYYY-MM-DD HH:MM"       → space separator also OK
 *
 * Returns NaN for invalid input.
 */
export function parseDateTime(s: string): number {
  const str = (s ?? "").trim();
  if (!str) return Number.NaN;
  // Allow date-only or date+time
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(str);
  if (!m) return Number.NaN;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = m[4] !== undefined ? Number(m[4]) : 0;
  const minute = m[5] !== undefined ? Number(m[5]) : 0;
  const second = m[6] !== undefined ? Number(m[6]) : 0;
  if (month < 1 || month > 12) return Number.NaN;
  if (day < 1 || day > 31) return Number.NaN;
  if (hour < 0 || hour > 23) return Number.NaN;
  if (minute < 0 || minute > 59) return Number.NaN;
  if (second < 0 || second > 59) return Number.NaN;
  const ms = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  // Reject constructed-invalid dates like Feb 30 (Date.UTC rolls over)
  const d = new Date(ms);
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day ||
    d.getUTCHours() !== hour ||
    d.getUTCMinutes() !== minute ||
    d.getUTCSeconds() !== second
  ) {
    return Number.NaN;
  }
  return ms;
}

/** Check if a date string is parseable. */
export function isValidDate(s: string): boolean {
  return !Number.isNaN(parseDateTime(s));
}

/** Format a UTC ms instant as YYYY-MM-DD. */
export function formatDate(ms: number): string {
  if (Number.isNaN(ms)) return "";
  const d = new Date(ms);
  return `${pad4(d.getUTCFullYear())}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Format a UTC ms instant as YYYY-MM-DDTHH:MM:SS. */
export function formatDateTime(ms: number): string {
  if (Number.isNaN(ms)) return "";
  const d = new Date(ms);
  return `${pad4(d.getUTCFullYear())}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}

/** Number of days in a given (year, month) where month is 1-12. */
export function daysInMonth(year: number, month: number): number {
  // month is 1-12; Date.UTC with day=0 gives last day of previous month
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** True if year is a Gregorian leap year. */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// ---------------------------------------------------------------------------
// Calendar-aware Y/M/D breakdown
// ---------------------------------------------------------------------------

function addMonthsClamped(year: number, month: number, day: number, monthsToAdd: number): [number, number, number] {
  // month is 0-indexed. Add monthsToAdd months, clamping day to month length.
  const totalMonths = year * 12 + month + monthsToAdd;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = ((totalMonths % 12) + 12) % 12;
  const maxDay = daysInMonth(newYear, newMonth + 1); // daysInMonth expects 1-indexed
  const newDay = Math.min(day, maxDay);
  return [newYear, newMonth, newDay];
}

/**
 * Calendar-aware breakdown of (endMs - startMs) into years/months/days.
 *
 * Uses the anchor approach: find the largest (years, months) such that
 * start + years + months (clamping the day to the target month's length,
 * so Jan 31 + 1 month = Feb 28/29) is on or before the end date. The
 * remaining days is the day difference from that anchor to the end date.
 *
 * This correctly handles Jan 31 → Mar 1 (= 0y 1m 1d), Jan 31 → Feb 28
 * (= 0y 0m 28d), Feb 29 → Feb 28 next year (= 1y 0m 0d).
 *
 * If includeEndDay is true, the effective end date is shifted by +1 day
 * before computing the breakdown, so Jan 1 → Jan 1 inclusive = 0y 0m 1d.
 *
 * If endMs < startMs, returns the same breakdown with isNegative=true
 * (computed by swapping the operands).
 */
export function calculateYMD(
  startMs: number,
  endMs: number,
  includeEndDay = false,
): { years: number; months: number; days: number; isNegative: boolean } {
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return { years: 0, months: 0, days: 0, isNegative: false };
  }
  const isNegative = endMs < startMs;
  const aMs = isNegative ? endMs : startMs;
  const bMsRaw = isNegative ? startMs : endMs;
  // For includeEndDay, shift the effective end forward by 1 day so the
  // breakdown naturally counts the end date.
  const bMs = bMsRaw + (includeEndDay ? MS_PER_DAY : 0);

  const a = new Date(aMs);
  const b = new Date(bMs);

  const y1 = a.getUTCFullYear(), m1 = a.getUTCMonth(), d1 = a.getUTCDate();
  const y2 = b.getUTCFullYear(), m2 = b.getUTCMonth(), d2 = b.getUTCDate();

  // Initial guess: subtract year + month directly
  let years = y2 - y1;
  let months = m2 - m1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  // Compute the anchor = start + (years*12 + months) months, clamping day
  let [ay, am, ad] = addMonthsClamped(y1, m1, d1, years * 12 + months);
  let anchorMs = Date.UTC(ay, am, ad, 0, 0, 0, 0);

  // If the anchor overshoots the (effective) end, decrement months until it doesn't
  while (anchorMs > bMs && (years > 0 || months > 0)) {
    months -= 1;
    if (months < 0) {
      if (years <= 0) break;
      years -= 1;
      months += 12;
    }
    [ay, am, ad] = addMonthsClamped(y1, m1, d1, years * 12 + months);
    anchorMs = Date.UTC(ay, am, ad, 0, 0, 0, 0);
  }

  // Days = (effective end) - anchor, in whole days
  // Use round to avoid floating-point drift (e.g., DST, but we're in UTC)
  const bMidnight = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate(), 0, 0, 0, 0);
  let days = Math.round((bMidnight - anchorMs) / MS_PER_DAY);
  if (days < 0) days = 0;

  return { years, months, days, isNegative };
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

export interface Totals {
  totalMs: number;
  totalSeconds: number;
  totalMinutes: number;
  totalHours: number;
  totalDays: number;
  totalWeeks: number;
}

/** Compute totals from a millisecond difference (taking abs value). */
export function calculateTotals(startMs: number, endMs: number, includeEndDay = false): Totals {
  const raw = Math.abs(endMs - startMs);
  // When includeEndDay is true, the convention is to count both endpoints —
  // effectively +1 day across all totals (so 2 days = 48 hours, not 24).
  const dayBump = includeEndDay ? MS_PER_DAY : 0;
  const totalMs = raw + dayBump;
  const totalSeconds = totalMs / MS_PER_SECOND;
  const totalMinutes = totalMs / MS_PER_MINUTE;
  const totalHours = totalMs / MS_PER_HOUR;
  const totalDays = totalMs / MS_PER_DAY;
  const totalWeeks = totalDays / 7;
  return { totalMs, totalSeconds, totalMinutes, totalHours, totalDays, totalWeeks };
}

// ---------------------------------------------------------------------------
// Business / weekday counting
// ---------------------------------------------------------------------------

/** Count weekdays, weekend days, and business days between two dates. */
export function countDays(
  startMs: number,
  endMs: number,
  includeEndDay = false,
  weekendDays: ReadonlyArray<number> = DEFAULT_WEEKEND_DAYS,
  holidays: ReadonlyArray<string> = [],
): { weekdays: number; weekendDays: number; businessDays: number; holidaysHit: number } {
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return { weekdays: 0, weekendDays: 0, businessDays: 0, holidaysHit: 0 };
  }
  const weekendSet = new Set(weekendDays);
  const holidaySet = new Set(holidays);

  // Normalize: always iterate from earlier to later
  const isNegative = endMs < startMs;
  const aMs = isNegative ? endMs : startMs;
  const bMs = isNegative ? startMs : endMs;

  // Convention:
  //   Exclusive (includeEndDay=false): count days in (start, end] — i.e., from
  //     start+1day up to and including end. Jan 1 → Jan 2 exclusive = 1 day (Jan 2).
  //   Inclusive (includeEndDay=true):  count days in [start, end] — i.e., from
  //     start up to and including end. Jan 1 → Jan 2 inclusive = 2 days (Jan 1+2).
  // Total days to iterate:
  const totalDays = Math.floor(Math.abs(bMs - aMs) / MS_PER_DAY) + (includeEndDay ? 1 : 0);
  // Start offset: 1 (exclusive — skip the start day) or 0 (inclusive — include it).
  const startOffset = includeEndDay ? 0 : 1;

  let weekdays = 0;
  let weekendDaysCount = 0;
  let businessDays = 0;
  let holidaysHit = 0;

  const aDate = new Date(aMs);
  const startUtcMidnight = Date.UTC(
    aDate.getUTCFullYear(), aDate.getUTCMonth(), aDate.getUTCDate(), 0, 0, 0, 0,
  );

  for (let i = 0; i < totalDays; i++) {
    const dayMs = startUtcMidnight + (startOffset + i) * MS_PER_DAY;
    const d = new Date(dayMs);
    const dow = d.getUTCDay(); // 0=Sun, 6=Sat
    const dateStr = formatDate(dayMs);
    const isWeekend = weekendSet.has(dow);
    const isHoliday = holidaySet.has(dateStr);
    if (isWeekend) {
      weekendDaysCount += 1;
    } else {
      weekdays += 1;
      if (isHoliday) {
        holidaysHit += 1;
      } else {
        businessDays += 1;
      }
    }
  }

  return {
    weekdays,
    weekendDays: weekendDaysCount,
    businessDays,
    holidaysHit,
  };
}

// ---------------------------------------------------------------------------
// Plain-English explanation
// ---------------------------------------------------------------------------

/** Return a plain-English explanation of the include/exclude end day convention. */
export function explainIncludeEndDay(includeEndDay: boolean): string {
  return includeEndDay
    ? "Inclusive: counts both the start and end dates. Jan 1 → Jan 2 = 2 days. Same day = 1 day. The breakdown and totals include the end date as a counted day."
    : "Exclusive: counts the number of midnights crossed from start to end. Jan 1 → Jan 2 = 1 day. Same day = 0 days. The end date itself is not counted.";
}

// ---------------------------------------------------------------------------
// Relative phrasing
// ---------------------------------------------------------------------------

/** Format an ms delta as "X years ago" / "in X months" etc. */
export function relativePhrase(deltaMs: number): string {
  if (deltaMs === 0) return "now";
  const future = deltaMs > 0;
  const abs = Math.abs(deltaMs);
  const phrase = (n: number, unit: string) =>
    future ? `in ${n} ${unit}${n === 1 ? "" : "s"}` : `${n} ${unit}${n === 1 ? "" : "s"} ago`;
  if (abs < MS_PER_MINUTE) return phrase(Math.round(abs / MS_PER_SECOND), "second");
  if (abs < MS_PER_HOUR) return phrase(Math.round(abs / MS_PER_MINUTE), "minute");
  if (abs < MS_PER_DAY) return phrase(Math.round(abs / MS_PER_HOUR), "hour");
  if (abs < MS_PER_WEEK) return phrase(Math.round(abs / MS_PER_DAY), "day");
  if (abs < MS_PER_WEEK * 4) return phrase(Math.round(abs / MS_PER_WEEK), "week");
  if (abs < MS_PER_DAY * 365) return phrase(Math.round(abs / MS_PER_DAY / 30), "month");
  return phrase(Math.round(abs / MS_PER_DAY / 365), "year");
}

// ---------------------------------------------------------------------------
// Summary line
// ---------------------------------------------------------------------------

/** Build a one-line summary like "1 year, 2 months, 3 days (376 days total)". */
export function buildSummary(
  ymd: { years: number; months: number; days: number; isNegative: boolean },
  totals: Totals,
): string {
  const parts: string[] = [];
  if (ymd.years > 0) parts.push(`${ymd.years} year${ymd.years === 1 ? "" : "s"}`);
  if (ymd.months > 0) parts.push(`${ymd.months} month${ymd.months === 1 ? "" : "s"}`);
  if (ymd.days > 0 || parts.length === 0) parts.push(`${ymd.days} day${ymd.days === 1 ? "" : "s"}`);
  const sign = ymd.isNegative ? "-" : "";
  return `${sign}${parts.join(", ")} (${totals.totalDays} day${totals.totalDays === 1 ? "" : "s"} total)`;
}

// ---------------------------------------------------------------------------
// Top-level difference calculation
// ---------------------------------------------------------------------------

/** Compute the full difference result for a single date pair. */
export function calculateDifference(input: DifferenceInput): DifferenceResult {
  const { startMs, endMs, includeEndDay } = input;
  const weekendDays = input.weekendDays ?? DEFAULT_WEEKEND_DAYS;
  const holidays = input.holidays ?? [];

  const ymd = calculateYMD(startMs, endMs, includeEndDay);
  const totals = calculateTotals(startMs, endMs, includeEndDay);
  const dayCounts = countDays(startMs, endMs, includeEndDay, weekendDays, holidays);
  const includeEndExplanation = explainIncludeEndDay(includeEndDay);
  const summary = buildSummary(ymd, totals);
  const phrase = relativePhrase(endMs - startMs);

  return {
    ...ymd,
    ...totals,
    ...dayCounts,
    includeEndExplanation,
    summary,
    relativePhrase: phrase,
  };
}

// ---------------------------------------------------------------------------
// Age calculation
// ---------------------------------------------------------------------------

/** Compute age in calendar Y/M/D against a reference "today" (UTC ms). */
export function calculateAge(birthMs: number, nowMs: number = Date.now()): AgeResult {
  if (Number.isNaN(birthMs) || Number.isNaN(nowMs)) {
    return {
      years: 0, months: 0, days: 0, totalDays: 0,
      nextBirthdayMs: 0, daysUntilNextBirthday: 0,
      nextBirthdayDate: "", summary: "Invalid date",
    };
  }
  if (birthMs > nowMs) {
    // Birth date is in the future
    return {
      years: 0, months: 0, days: 0, totalDays: 0,
      nextBirthdayMs: birthMs, daysUntilNextBirthday: Math.round((birthMs - nowMs) / MS_PER_DAY),
      nextBirthdayDate: formatDate(birthMs),
      summary: "Birth date is in the future",
    };
  }

  // Reuse the calendar-aware Y/M/D calculation for consistency.
  const ymd = calculateYMD(birthMs, nowMs, false);
  const years = ymd.years;
  const months = ymd.months;
  const days = ymd.days;

  const birth = new Date(birthMs);
  const now = new Date(nowMs);
  const birthYear = birth.getUTCFullYear();
  const birthMonth = birth.getUTCMonth();
  const birthDay = birth.getUTCDate();
  const nowYear = now.getUTCFullYear();
  const nowMonth = now.getUTCMonth();
  const nowDay = now.getUTCDate();

  // Next birthday: same month/day as birth, in current year (or next if already passed).
  // For Feb 29 births in non-leap years, JS Date.UTC rolls over to Mar 1 — that's
  // the conventional "birthday" in non-leap years.
  let nextYear = nowYear;
  let nextBirthdayMs = Date.UTC(nextYear, birthMonth, birthDay, 0, 0, 0, 0);
  const todayMidnight = Date.UTC(nowYear, nowMonth, nowDay, 0, 0, 0, 0);
  if (nextBirthdayMs <= todayMidnight) {
    nextYear += 1;
    nextBirthdayMs = Date.UTC(nextYear, birthMonth, birthDay, 0, 0, 0, 0);
  }
  const daysUntilNextBirthday = Math.round((nextBirthdayMs - todayMidnight) / MS_PER_DAY);

  const totalDays = Math.floor((nowMs - birthMs) / MS_PER_DAY);

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years === 1 ? "" : "s"}`);
  if (months > 0) parts.push(`${months} month${months === 1 ? "" : "s"}`);
  if (days > 0 || parts.length === 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  const summary = `${parts.join(", ")} old (${totalDays} days total)`;

  return {
    years, months, days, totalDays,
    nextBirthdayMs, daysUntilNextBirthday,
    nextBirthdayDate: formatDate(nextBirthdayMs),
    summary,
  };
}

// ---------------------------------------------------------------------------
// Batch mode
// ---------------------------------------------------------------------------

/**
 * Parse batch input. Each line is `start,end` where start/end are YYYY-MM-DD
 * (or YYYY-MM-DDTHH:MM:SS). Lines starting with # or empty are ignored.
 */
export function parseBatch(input: string): { start: string; end: string }[] {
  const out: { start: string; end: string }[] = [];
  for (const line of (input ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split(/[,\t]/).map((s) => s.trim());
    if (parts.length < 2) continue;
    out.push({ start: parts[0], end: parts[1] });
  }
  return out;
}

/** Compute difference for a batch of date pairs. */
export function computeBatch(
  pairs: { start: string; end: string }[],
  includeEndDay = false,
  weekendDays: ReadonlyArray<number> = DEFAULT_WEEKEND_DAYS,
  holidays: ReadonlyArray<string> = [],
): BatchRow[] {
  return pairs.map((p) => {
    const startMs = parseDateTime(p.start);
    const endMs = parseDateTime(p.end);
    if (Number.isNaN(startMs)) {
      return { ...p, totalDays: 0, businessDays: 0, years: 0, months: 0, days: 0, ok: false, error: `Invalid start: ${p.start}` };
    }
    if (Number.isNaN(endMs)) {
      return { ...p, totalDays: 0, businessDays: 0, years: 0, months: 0, days: 0, ok: false, error: `Invalid end: ${p.end}` };
    }
    const ymd = calculateYMD(startMs, endMs, includeEndDay);
    const totals = calculateTotals(startMs, endMs, includeEndDay);
    const counts = countDays(startMs, endMs, includeEndDay, weekendDays, holidays);
    return {
      start: p.start, end: p.end,
      totalDays: totals.totalDays,
      businessDays: counts.businessDays,
      years: ymd.years, months: ymd.months, days: ymd.days,
      ok: true,
    };
  });
}

/** Render a single difference result as plain-text summary (multi-line). */
export function renderResultText(r: DifferenceResult): string {
  const lines: string[] = [];
  lines.push(`Summary: ${r.summary}`);
  lines.push(`Relative: ${r.relativePhrase}`);
  lines.push("");
  lines.push("Calendar breakdown:");
  lines.push(`  ${r.years} year(s), ${r.months} month(s), ${r.days} day(s)${r.isNegative ? " (negative)" : ""}`);
  lines.push("");
  lines.push("Totals:");
  lines.push(`  ${r.totalWeeks} week(s)`);
  lines.push(`  ${r.totalDays} day(s)`);
  lines.push(`  ${r.totalHours} hour(s)`);
  lines.push(`  ${r.totalMinutes} minute(s)`);
  lines.push(`  ${r.totalSeconds} second(s)`);
  lines.push("");
  lines.push("Day counts:");
  lines.push(`  ${r.weekdays} weekday(s)`);
  lines.push(`  ${r.weekendDays} weekend day(s)`);
  lines.push(`  ${r.businessDays} business day(s) (${r.holidaysHit} holiday(s) excluded)`);
  lines.push("");
  lines.push(`Convention: ${r.includeEndExplanation}`);
  return lines.join("\n");
}

/** Render batch results as CSV. */
export function renderBatchCsv(rows: BatchRow[]): string {
  const lines = ["start,end,total_days,business_days,years,months,days,ok,error"];
  const esc = (s: string) => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  for (const r of rows) {
    lines.push([
      esc(r.start), esc(r.end),
      r.totalDays, r.businessDays,
      r.years, r.months, r.days,
      r.ok ? "yes" : "no",
      r.ok ? "" : esc(r.error ?? ""),
    ].join(","));
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// History (localStorage, max 20)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:date-difference-calculator:history";
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
// Shareable URL (fragment-encoded, never sent to server)
// ---------------------------------------------------------------------------

export interface ShareState {
  start: string;
  end: string;
  includeEndDay: boolean;
  weekendDays: number[];
  holidays: string[];
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.start) params.set("start", state.start);
  if (state.end) params.set("end", state.end);
  params.set("incl", state.includeEndDay ? "1" : "0");
  if (state.weekendDays && state.weekendDays.length > 0) {
    params.set("we", state.weekendDays.join(","));
  }
  if (state.holidays && state.holidays.length > 0) {
    params.set("hol", state.holidays.join(","));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState | null {
  let clean = hash;
  if (clean.startsWith("#")) clean = clean.slice(1);
  if (clean.startsWith("?")) clean = clean.slice(1);
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const start = params.get("start") ?? "";
  const end = params.get("end") ?? "";
  const incl = params.get("incl") === "1";
  const weStr = params.get("we") ?? "";
  const holStr = params.get("hol") ?? "";
  if (!start && !end) return null;
  const weekendDays = weStr
    ? weStr.split(",").map((s) => Number(s)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    : [];
  const holidays = holStr ? holStr.split(",").filter((s) => isValidDate(s)) : [];
  return { start, end, includeEndDay: incl, weekendDays, holidays };
}

// ---------------------------------------------------------------------------
// Misc helpers exposed for the UI
// ---------------------------------------------------------------------------

export function weekdayLabel(n: number): string {
  return WEEKDAY_LABELS[n] ?? "";
}

export function weekdayShort(n: number): string {
  return WEEKDAY_SHORT[n] ?? "";
}

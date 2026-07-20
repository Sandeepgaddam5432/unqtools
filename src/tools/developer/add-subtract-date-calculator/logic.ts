/**
 * Add / Subtract Date Calculator — pure logic.
 *
 * Add or subtract years, months, weeks, days, hours, minutes and seconds
 * from a starting date/time. Calendar-day or business-day mode with custom
 * weekend + holiday list. Month-end policy toggle (clamp vs overflow).
 * Repeat/series mode with table export. Timezone-aware shareable URL.
 *
 * Pure functions only — no DOM, no network. Uses UTC for all date math to
 * avoid DST-related surprises; timezone offsets are applied at parse time
 * when an explicit zone is supplied.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MonthEndPolicy = "clamp" | "overflow";
export type OperationMode = "add" | "subtract";
export type DateMode = "calendar" | "business";

export interface DateOffset {
  years?: number;
  months?: number;
  weeks?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
}

export interface AddSubtractInput {
  startMs: number;
  offset: DateOffset;
  mode: OperationMode;
  monthEndPolicy: MonthEndPolicy;
  dateMode: DateMode;
  /** 0=Sun, 1=Mon, ... 6=Sat. Default [0, 6] (Sun + Sat). */
  weekendDays?: ReadonlyArray<number>;
  /** List of holiday dates as YYYY-MM-DD strings. */
  holidays?: ReadonlyArray<string>;
}

export interface AddSubtractResult {
  /** Resulting UTC ms instant. */
  resultMs: number;
  /** Resulting ISO date (YYYY-MM-DD). */
  resultDate: string;
  /** Resulting ISO date-time (YYYY-MM-DDTHH:MM:SS). */
  resultDateTime: string;
  /** Weekday name (e.g. "Monday"). */
  weekday: string;
  /** Short weekday (e.g. "Mon"). */
  weekdayShort: string;
  /** Day-of-week, 0=Sun..6=Sat. */
  dayOfWeek: number;
  /** Plain-English summary of the operation. */
  summary: string;
  /** Relative phrasing like "in 3 weeks" / "5 days ago". */
  relativePhrase: string;
  /** Explanation of the month-end policy in effect. */
  monthEndExplanation: string;
  /** Explanation of the date mode (calendar vs business). */
  dateModeExplanation: string;
  /** Total elapsed milliseconds (always non-negative). */
  elapsedMs: number;
  /** Total elapsed days (always non-negative). */
  elapsedDays: number;
  /** Number of business days actually moved (business mode only). */
  businessDaysMoved: number;
  /** Number of weekend days skipped (business mode only). */
  weekendDaysSkipped: number;
  /** Number of holidays skipped (business mode only). */
  holidaysSkipped: number;
}

export interface SeriesRow {
  index: number;
  /** 1-based iteration number. */
  n: number;
  resultMs: number;
  resultDate: string;
  resultDateTime: string;
  weekday: string;
  /** For business mode: number of business days moved from previous row. */
  businessDaysMoved: number;
}

export interface HistoryEntry {
  ts: number;
  start: string;
  offset: DateOffset;
  mode: OperationMode;
  monthEndPolicy: MonthEndPolicy;
  dateMode: DateMode;
  result: string;
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

export const UNIT_LABELS: Record<keyof DateOffset, string> = {
  years: "year",
  months: "month",
  weeks: "week",
  days: "day",
  hours: "hour",
  minutes: "minute",
  seconds: "second",
};

export const UNIT_ORDER: (keyof DateOffset)[] = [
  "years", "months", "weeks", "days", "hours", "minutes", "seconds",
];

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
 *   - "YYYY-MM-DD"             -> midnight UTC
 *   - "YYYY-MM-DDTHH:MM"       -> that time UTC
 *   - "YYYY-MM-DDTHH:MM:SS"    -> that time UTC
 *   - "YYYY-MM-DD HH:MM"       -> space separator also OK
 *
 * Returns NaN for invalid input.
 */
export function parseDateTime(s: string): number {
  const str = (s ?? "").trim();
  if (!str) return Number.NaN;
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
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** True if year is a Gregorian leap year. */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Return weekday label (0=Sun..6=Sat). */
export function weekdayLabel(n: number): string {
  return WEEKDAY_LABELS[n] ?? "";
}

/** Return short weekday label (0=Sun..6=Sat). */
export function weekdayShort(n: number): string {
  return WEEKDAY_SHORT[n] ?? "";
}

// ---------------------------------------------------------------------------
// Calendar math: add months with clamp/overflow
// ---------------------------------------------------------------------------

/**
 * Add months to (year, month0, day) where month0 is 0-indexed.
 * clamp: if target day exceeds month length, clamp to last valid day.
 * overflow: roll extra days into the next month (Mar 1, 2, 3, ...).
 */
function addMonthsToYMD(
  year: number,
  month0: number,
  day: number,
  monthsToAdd: number,
  policy: MonthEndPolicy,
): { year: number; month0: number; day: number } {
  const totalMonths = year * 12 + month0 + monthsToAdd;
  let newYear = Math.floor(totalMonths / 12);
  let newMonth0 = ((totalMonths % 12) + 12) % 12;
  const maxDay = daysInMonth(newYear, newMonth0 + 1);
  if (day <= maxDay) {
    return { year: newYear, month0: newMonth0, day };
  }
  // day > maxDay: clamp or overflow
  if (policy === "clamp") {
    return { year: newYear, month0: newMonth0, day: maxDay };
  }
  // overflow: subtract maxDay from day, advance one month
  let remaining = day - maxDay;
  newMonth0 += 1;
  if (newMonth0 > 11) {
    newMonth0 = 0;
    newYear += 1;
  }
  while (remaining > 0) {
    const ml = daysInMonth(newYear, newMonth0 + 1);
    if (remaining <= ml) {
      return { year: newYear, month0: newMonth0, day: remaining };
    }
    remaining -= ml;
    newMonth0 += 1;
    if (newMonth0 > 11) {
      newMonth0 = 0;
      newYear += 1;
    }
  }
  // Should not reach here
  return { year: newYear, month0: newMonth0, day: 1 };
}

/**
 * Apply a DateOffset (years, months, weeks, days, hours, minutes, seconds)
 * to a UTC ms instant. Years+months use calendar math with monthEndPolicy;
 * weeks/days/hours/minutes/seconds are simple ms arithmetic.
 *
 * The signed offset is used (subtract mode negates the input before calling).
 */
export function applyOffset(
  startMs: number,
  offset: DateOffset,
  monthEndPolicy: MonthEndPolicy,
): number {
  if (Number.isNaN(startMs)) return Number.NaN;
  const start = new Date(startMs);
  let year = start.getUTCFullYear();
  let month0 = start.getUTCMonth();
  let day = start.getUTCDate();
  let hour = start.getUTCHours();
  let minute = start.getUTCMinutes();
  let second = start.getUTCSeconds();

  // 1. Years + months (calendar math)
  const yearMonths = (offset.years ?? 0) * 12 + (offset.months ?? 0);
  if (yearMonths !== 0) {
    const r = addMonthsToYMD(year, month0, day, yearMonths, monthEndPolicy);
    year = r.year;
    month0 = r.month0;
    day = r.day;
  }

  // 2. Weeks + days (ms arithmetic, exact days)
  const totalDays = (offset.weeks ?? 0) * 7 + (offset.days ?? 0);
  // 3. Hours + minutes + seconds
  const totalMs =
    totalDays * MS_PER_DAY +
    (offset.hours ?? 0) * MS_PER_HOUR +
    (offset.minutes ?? 0) * MS_PER_MINUTE +
    (offset.seconds ?? 0) * MS_PER_SECOND;

  // Reconstruct ms from the (possibly clamped) Y/M/D + original H/M/S + total ms
  return Date.UTC(year, month0, day, hour, minute, second, 0) + totalMs;
}

// ---------------------------------------------------------------------------
// Business-day walking
// ---------------------------------------------------------------------------

/**
 * Walk `count` business days forward (positive) or backward (negative)
 * from startMs, skipping weekend days and holidays.
 *
 * Returns the resulting ms instant plus stats: how many weekend days and
 * holidays were skipped, and how many business days were actually moved.
 *
 * Note: this operates at day granularity (midnight UTC). Any time-of-day
 * component from the start is preserved.
 */
export function walkBusinessDays(
  startMs: number,
  count: number,
  weekendDays: ReadonlyArray<number> = DEFAULT_WEEKEND_DAYS,
  holidays: ReadonlyArray<string> = [],
): { resultMs: number; businessDaysMoved: number; weekendDaysSkipped: number; holidaysSkipped: number } {
  if (Number.isNaN(startMs) || count === 0) {
    return { resultMs: startMs, businessDaysMoved: 0, weekendDaysSkipped: 0, holidaysSkipped: 0 };
  }
  const weekendSet = new Set(weekendDays);
  const holidaySet = new Set(holidays);
  const direction = count > 0 ? 1 : -1;
  const absCount = Math.abs(count);

  const startDate = new Date(startMs);
  // Preserve time-of-day across the walk.
  const hours = startDate.getUTCHours();
  const minutes = startDate.getUTCMinutes();
  const seconds = startDate.getUTCSeconds();
  let cursorDay = Date.UTC(
    startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), 0, 0, 0, 0,
  );

  let moved = 0;
  let weekendSkipped = 0;
  let holidaySkipped = 0;
  let steps = 0;
  // Safety cap to avoid infinite loops on pathological inputs.
  const maxSteps = absCount * 30 + 1000;

  while (moved < absCount && steps < maxSteps) {
    steps += 1;
    cursorDay += direction * MS_PER_DAY;
    const d = new Date(cursorDay);
    const dow = d.getUTCDay();
    const dateStr = formatDate(cursorDay);
    if (weekendSet.has(dow)) {
      weekendSkipped += 1;
      continue;
    }
    if (holidaySet.has(dateStr)) {
      holidaySkipped += 1;
      continue;
    }
    moved += 1;
  }

  // Restore time-of-day
  const resultMs = cursorDay + hours * MS_PER_HOUR + minutes * MS_PER_MINUTE + seconds * MS_PER_SECOND;
  return { resultMs, businessDaysMoved: moved, weekendDaysSkipped: weekendSkipped, holidaysSkipped: holidaySkipped };
}

// ---------------------------------------------------------------------------
// Plain-English explanations
// ---------------------------------------------------------------------------

export function explainMonthEndPolicy(policy: MonthEndPolicy): string {
  return policy === "clamp"
    ? "Clamp: when the target day exceeds the new month's length, the result is clamped to the last valid day of that month. Jan 31 + 1 month = Feb 28/29."
    : "Overflow: when the target day exceeds the new month's length, the extra days roll into the following month. Jan 31 + 1 month = Mar 3 (non-leap year).";
}

export function explainDateMode(mode: DateMode): string {
  return mode === "calendar"
    ? "Calendar-day mode: weeks/days are added as literal 24-hour periods. Every day counts, including weekends and holidays."
    : "Business-day mode: weeks/days are interpreted as business days (skipping weekends and any holidays you list). Years and months still use calendar math. Time-of-day is preserved.";
}

// ---------------------------------------------------------------------------
// Relative phrasing
// ---------------------------------------------------------------------------

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
// Offset formatting
// ---------------------------------------------------------------------------

/** Format a DateOffset as "1 year, 2 months, 3 days" (only non-zero units). */
export function formatOffset(offset: DateOffset): string {
  const parts: string[] = [];
  for (const unit of UNIT_ORDER) {
    const v = offset[unit];
    if (v !== undefined && v !== 0) {
      parts.push(`${v} ${UNIT_LABELS[unit]}${Math.abs(v) === 1 ? "" : "s"}`);
    }
  }
  return parts.length === 0 ? "0 days" : parts.join(", ");
}

/** True if all offset units are zero / undefined. */
export function isOffsetEmpty(offset: DateOffset): boolean {
  return UNIT_ORDER.every((u) => !offset[u]);
}

/** Build a one-line summary like "Add 1 month, 3 days to 2025-01-01 = 2025-02-04 (Tuesday)". */
export function buildSummary(
  start: string,
  offset: DateOffset,
  mode: OperationMode,
  result: string,
  weekday: string,
  dateMode: DateMode,
): string {
  const op = mode === "add" ? "Add" : "Subtract";
  const offsetStr = formatOffset(offset);
  const modeLabel = dateMode === "business" ? " (business days)" : "";
  return `${op} ${offsetStr}${modeLabel} ${mode === "add" ? "to" : "from"} ${start} = ${result} (${weekday})`;
}

// ---------------------------------------------------------------------------
// Top-level add/subtract calculation
// ---------------------------------------------------------------------------

/** Compute the full add/subtract result. */
export function calculateAddSubtract(input: AddSubtractInput): AddSubtractResult {
  const { startMs, offset, mode, monthEndPolicy, dateMode } = input;
  const weekendDays = input.weekendDays ?? DEFAULT_WEEKEND_DAYS;
  const holidays = input.holidays ?? [];

  if (Number.isNaN(startMs)) {
    return {
      resultMs: Number.NaN,
      resultDate: "",
      resultDateTime: "",
      weekday: "",
      weekdayShort: "",
      dayOfWeek: -1,
      summary: "Invalid start date",
      relativePhrase: "invalid",
      monthEndExplanation: explainMonthEndPolicy(monthEndPolicy),
      dateModeExplanation: explainDateMode(dateMode),
      elapsedMs: 0,
      elapsedDays: 0,
      businessDaysMoved: 0,
      weekendDaysSkipped: 0,
      holidaysSkipped: 0,
    };
  }

  // Negate the offset if subtracting.
  const signedOffset: DateOffset = mode === "subtract"
    ? {
        years: -(offset.years ?? 0),
        months: -(offset.months ?? 0),
        weeks: -(offset.weeks ?? 0),
        days: -(offset.days ?? 0),
        hours: -(offset.hours ?? 0),
        minutes: -(offset.minutes ?? 0),
        seconds: -(offset.seconds ?? 0),
      }
    : offset;

  let resultMs: number;
  let businessDaysMoved = 0;
  let weekendDaysSkipped = 0;
  let holidaysSkipped = 0;

  if (dateMode === "business") {
    // Years and months still use calendar math. Weeks + days use business-day walking.
    // First apply years + months via calendar math.
    const yearMonthsOffset: DateOffset = {
      years: signedOffset.years,
      months: signedOffset.months,
    };
    const afterYm = isOffsetEmpty(yearMonthsOffset)
      ? startMs
      : applyOffset(startMs, yearMonthsOffset, monthEndPolicy);

    // Then walk business days for weeks + days. Hours/min/sec apply after as ms.
    const businessDays = (signedOffset.weeks ?? 0) * 7 + (signedOffset.days ?? 0);
    const walked = walkBusinessDays(afterYm, businessDays, weekendDays, holidays);
    const subMs =
      (signedOffset.hours ?? 0) * MS_PER_HOUR +
      (signedOffset.minutes ?? 0) * MS_PER_MINUTE +
      (signedOffset.seconds ?? 0) * MS_PER_SECOND;
    resultMs = walked.resultMs + subMs;
    businessDaysMoved = walked.businessDaysMoved;
    weekendDaysSkipped = walked.weekendDaysSkipped;
    holidaysSkipped = walked.holidaysSkipped;
  } else {
    resultMs = applyOffset(startMs, signedOffset, monthEndPolicy);
  }

  const resultDate = formatDate(resultMs);
  const resultDateTime = formatDateTime(resultMs);
  const resultD = new Date(resultMs);
  const dow = resultD.getUTCDay();
  const weekday = weekdayLabel(dow);
  const wdShort = weekdayShort(dow);
  const elapsedMs = Math.abs(resultMs - startMs);
  const elapsedDays = elapsedMs / MS_PER_DAY;
  const phrase = relativePhrase(resultMs - startMs);
  const summary = buildSummary(
    formatDate(startMs), offset, mode, resultDate, weekday, dateMode,
  );

  return {
    resultMs,
    resultDate,
    resultDateTime,
    weekday,
    weekdayShort: wdShort,
    dayOfWeek: dow,
    summary,
    relativePhrase: phrase,
    monthEndExplanation: explainMonthEndPolicy(monthEndPolicy),
    dateModeExplanation: explainDateMode(dateMode),
    elapsedMs,
    elapsedDays,
    businessDaysMoved,
    weekendDaysSkipped,
    holidaysSkipped,
  };
}

// ---------------------------------------------------------------------------
// Series / repeat mode
// ---------------------------------------------------------------------------

export interface SeriesInput {
  startMs: number;
  offset: DateOffset;
  mode: OperationMode;
  monthEndPolicy: MonthEndPolicy;
  dateMode: DateMode;
  count: number;
  weekendDays?: ReadonlyArray<number>;
  holidays?: ReadonlyArray<string>;
}

/**
 * Generate a series of `count` results by repeatedly applying the offset.
 * Row N applies the offset N times to the start (1, 2, 3, ..., count).
 *
 * Each row's `businessDaysMoved` is the number of business days moved from
 * the previous row (or from start, for row 1). For calendar mode it's the
 * integer-day delta.
 */
export function generateSeries(input: SeriesInput): SeriesRow[] {
  const { startMs, offset, mode, monthEndPolicy, dateMode, count } = input;
  if (Number.isNaN(startMs) || count <= 0) return [];
  const weekendDays = input.weekendDays ?? DEFAULT_WEEKEND_DAYS;
  const holidays = input.holidays ?? [];
  const out: SeriesRow[] = [];

  // For each row, apply offset N times. Naive but correct; count is typically <1000.
  let prevMs = startMs;
  for (let n = 1; n <= count; n++) {
    // Compute by repeatedly applying from start to avoid drift.
    let currentMs = startMs;
    for (let i = 0; i < n; i++) {
      const r = calculateAddSubtract({
        startMs: currentMs,
        offset,
        mode,
        monthEndPolicy,
        dateMode,
        weekendDays,
        holidays,
      });
      currentMs = r.resultMs;
    }
    const resultDate = formatDate(currentMs);
    const resultDateTime = formatDateTime(currentMs);
    const d = new Date(currentMs);
    const dow = d.getUTCDay();
    let bdm = 0;
    if (dateMode === "business") {
      const businessDays = ((mode === "subtract" ? -1 : 1) * (offset.weeks ?? 0) * 7) +
        ((mode === "subtract" ? -1 : 1) * (offset.days ?? 0));
      bdm = Math.abs(businessDays);
    } else {
      bdm = Math.round(Math.abs(currentMs - prevMs) / MS_PER_DAY);
    }
    out.push({
      index: n - 1,
      n,
      resultMs: currentMs,
      resultDate,
      resultDateTime,
      weekday: weekdayLabel(dow),
      businessDaysMoved: bdm,
    });
    prevMs = currentMs;
  }
  return out;
}

/** Render series rows as CSV. */
export function renderSeriesCsv(rows: SeriesRow[]): string {
  const lines = ["n,date,datetime,weekday,business_days_moved"];
  for (const r of rows) {
    lines.push([
      r.n,
      r.resultDate,
      r.resultDateTime,
      r.weekday,
      r.businessDaysMoved,
    ].join(","));
  }
  return lines.join("\n");
}

/** Render a single result as plain-text summary (multi-line). */
export function renderResultText(r: AddSubtractResult): string {
  const lines: string[] = [];
  lines.push(`Summary: ${r.summary}`);
  lines.push(`Relative: ${r.relativePhrase}`);
  lines.push("");
  lines.push(`Result date: ${r.resultDate}`);
  lines.push(`Result datetime: ${r.resultDateTime}`);
  lines.push(`Weekday: ${r.weekday} (${r.weekdayShort})`);
  lines.push("");
  lines.push(`Elapsed: ${r.elapsedMs} ms (${r.elapsedDays} days)`);
  if (r.businessDaysMoved > 0 || r.weekendDaysSkipped > 0 || r.holidaysSkipped > 0) {
    lines.push(`Business days moved: ${r.businessDaysMoved}`);
    lines.push(`Weekend days skipped: ${r.weekendDaysSkipped}`);
    lines.push(`Holidays skipped: ${r.holidaysSkipped}`);
  }
  lines.push("");
  lines.push(`Month-end policy: ${r.monthEndExplanation}`);
  lines.push(`Date mode: ${r.dateModeExplanation}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Stepper helpers
// ---------------------------------------------------------------------------

/** Quick "Now" helper: current UTC ms. */
export function nowMs(): number {
  return Date.now();
}

/** Quick "Start of day" helper: midnight UTC of the given instant. */
export function startOfDay(ms: number): number {
  if (Number.isNaN(ms)) return Number.NaN;
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
}

/** Quick "End of day" helper: 23:59:59 UTC of the given instant. */
export function endOfDay(ms: number): number {
  if (Number.isNaN(ms)) return Number.NaN;
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 0);
}

// ---------------------------------------------------------------------------
// History (localStorage, max 20)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:add-subtract-date-calculator:history";
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
  startTime: string;
  offset: DateOffset;
  mode: OperationMode;
  monthEndPolicy: MonthEndPolicy;
  dateMode: DateMode;
  weekendDays: number[];
  holidays: string[];
  count: number;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.start) params.set("start", state.start);
  if (state.startTime) params.set("time", state.startTime);
  // Encode each non-zero offset unit.
  for (const u of UNIT_ORDER) {
    const v = state.offset[u];
    if (v !== undefined && v !== 0) params.set(u, String(v));
  }
  params.set("mode", state.mode);
  params.set("policy", state.monthEndPolicy);
  params.set("dmode", state.dateMode);
  if (state.weekendDays && state.weekendDays.length > 0) {
    params.set("we", state.weekendDays.join(","));
  }
  if (state.holidays && state.holidays.length > 0) {
    params.set("hol", state.holidays.join(","));
  }
  if (state.count && state.count > 0) params.set("count", String(state.count));
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
  const startTime = params.get("time") ?? "";
  if (!start && !startTime) {
    // Need at least one input
    const hasAnyOffset = UNIT_ORDER.some((u) => params.get(u) !== null);
    if (!hasAnyOffset) return null;
  }
  const offset: DateOffset = {};
  for (const u of UNIT_ORDER) {
    const raw = params.get(u);
    if (raw !== null) {
      const v = Number(raw);
      if (Number.isFinite(v)) offset[u] = v;
    }
  }
  const modeParam = params.get("mode");
  const mode: OperationMode = modeParam === "subtract" ? "subtract" : "add";
  const policyParam = params.get("policy");
  const monthEndPolicy: MonthEndPolicy = policyParam === "overflow" ? "overflow" : "clamp";
  const dmodeParam = params.get("dmode");
  const dateMode: DateMode = dmodeParam === "business" ? "business" : "calendar";
  const weStr = params.get("we") ?? "";
  const holStr = params.get("hol") ?? "";
  const weekendDays = weStr
    ? weStr.split(",").map((s) => Number(s)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    : [];
  const holidays = holStr ? holStr.split(",").filter((s) => isValidDate(s)) : [];
  const countRaw = params.get("count");
  const count = countRaw ? Math.max(0, Math.min(1000, Number(countRaw) || 0)) : 0;
  return { start, startTime, offset, mode, monthEndPolicy, dateMode, weekendDays, holidays, count };
}

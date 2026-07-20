/**
 * ISO 8601 Date Parser & Formatter — pure logic.
 *
 * Parse any ISO 8601 / RFC 3339 string into its components and render a date
 * into every ISO 8601 variant — calendar, week, ordinal, datetime, duration,
 * interval, recurring. Strict + lenient modes.
 *
 * Pure functions only — no DOM, no network. Uses JavaScript Date + custom
 * tokenizer; supports basic + extended format, comma OR dot decimals, Z or
 * explicit offset, negative/expanded years, leap seconds (:60), 24:00:00,
 * week 53. Offline, deterministic, side-effect-free except for the
 * localStorage history helpers (loadHistory/saveHistory/clearHistory) which
 * are intentionally impure for persistence.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type IsoKind =
  | "date"        // 2026-01-15
  | "time"        // 13:45:30
  | "datetime"    // 2026-01-15T13:45:30+02:00
  | "duration"    // P1Y2M10DT2H30M
  | "interval"    // 2026-01-15/2026-02-20
  | "recurring";  // R5/2026-01-15/P1W

export type CalendarStyle = "calendar" | "week" | "ordinal";

export interface ParseOptions {
  /** Strict mode rejects common-but-non-standard forms (comma decimals,
   *  leap seconds, 24:00:00, expanded years without sign). Default false. */
  strict?: boolean;
}

export interface FormatOptions {
  /** Use basic format (no separators). Default false (extended). */
  basic?: boolean;
  /** Omit the time portion entirely. Default false. */
  dateOnly?: boolean;
  /** Omit the date portion (time-only output). Default false. */
  timeOnly?: boolean;
  /** Include the UTC offset. Default true when an offset is known. */
  includeOffset?: boolean;
  /** Normalize +00:00 (and -00:00) to Z. Default true. */
  zForUtc?: boolean;
  /** Number of fractional-second digits to emit (0-9). 0 = omit. Default 0. */
  fractionalDigits?: number;
  /** Calendar style: emit as calendar / week / ordinal. Default calendar. */
  style?: CalendarStyle;
}

export interface ParsedDuration {
  years: number;
  months: number;
  weeks: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Sub-second nanoseconds (0-999_999_999). */
  nanos: number;
  /** True if the duration is prefixed with a minus sign. */
  negative: boolean;
}

export interface ParsedDate {
  kind: IsoKind;
  /** Calendar-year component (4 digits; expanded if >= 5). */
  year?: number;
  /** Month 1-12 (calendar dates only). */
  month?: number;
  /** Day of month 1-31 (calendar dates only). */
  day?: number;
  /** ISO week-numbering year (week dates only). */
  weekYear?: number;
  /** ISO week number 1-53 (week dates only). */
  week?: number;
  /** ISO weekday 1-7 (Mon-Sun) (week dates only). */
  weekDay?: number;
  /** Ordinal day 1-366 (ordinal dates only). */
  ordinalDay?: number;
  /** Hour 0-24 (24 = end-of-day, valid as 24:00:00). */
  hour?: number;
  /** Minute 0-59. */
  minute?: number;
  /** Second 0-60 (60 = leap second). */
  second?: number;
  /** Sub-second nanoseconds (0-999_999_999). */
  nanos?: number;
  /** UTC offset in minutes; null = unknown; undefined = no offset present. */
  offsetMinutes?: number | null;
  /** True when input used basic (separator-less) format. */
  basic?: boolean;
  /** For durations: the parsed duration. */
  duration?: ParsedDuration;
  /** For intervals: the start and end components. */
  start?: ParsedDate;
  end?: ParsedDate;
  /** For recurring: count (Infinity = unbounded), start, end. */
  count?: number;
  /** Original raw input, echoed back. */
  raw?: string;
}

export interface ValidationResult {
  valid: boolean;
  kind?: IsoKind;
  error?: string;
  parsed?: ParsedDate;
}

export interface AllFormats {
  calendar: string;
  calendarBasic: string;
  week: string;
  ordinal: string;
  time: string;
  dateTime: string;
  dateTimeBasic: string;
  dateTimeUtc: string;
  dateOnly: string;
  timeOnly: string;
}

export interface ComponentView {
  calendar: { year: number; month: number; day: number } | null;
  week: { weekYear: number; week: number; weekDay: number } | null;
  ordinal: { year: number; ordinalDay: number } | null;
  time: { hour: number; minute: number; second: number; nanos: number } | null;
  offset: { minutes: number | null; label: string } | null;
  weekday: string | null;
}

export interface CodeSnippets {
  js: string;
  python: string;
  java: string;
  go: string;
}

export interface HistoryEntry {
  ts: number;
  kind: IsoKind;
  strict: boolean;
  inputLength: number;
  /** First 60 chars of normalized input for preview only. */
  preview: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const KIND_LABELS: Record<IsoKind, string> = {
  date: "Calendar date",
  time: "Time",
  datetime: "Date and time",
  duration: "Duration",
  interval: "Interval",
  recurring: "Recurring interval",
};

export const ISO_EXAMPLES: ReadonlyArray<{ label: string; value: string; kind: IsoKind }> = [
  { label: "Calendar date (extended)", value: "2026-01-15", kind: "date" },
  { label: "Calendar date (basic)", value: "20260115", kind: "date" },
  { label: "Week date", value: "2026-W03-4", kind: "date" },
  { label: "Ordinal date", value: "2026-015", kind: "date" },
  { label: "Time", value: "13:45:30", kind: "time" },
  { label: "Time with fractional seconds", value: "13:45:30.5", kind: "time" },
  { label: "Time with comma decimal", value: "13:45:30,5", kind: "time" },
  { label: "Leap second", value: "23:59:60", kind: "time" },
  { label: "End of day", value: "24:00:00", kind: "time" },
  { label: "Date and time (UTC, Z)", value: "2026-01-15T13:45:30Z", kind: "datetime" },
  { label: "Date and time (offset)", value: "2026-01-15T13:45:30+02:00", kind: "datetime" },
  { label: "Basic datetime", value: "20260115T134530Z", kind: "datetime" },
  { label: "Negative year", value: "-0050-06-15", kind: "date" },
  { label: "Expanded year", value: "+12026-06-15", kind: "date" },
  { label: "Duration", value: "P1Y2M10DT2H30M15S", kind: "duration" },
  { label: "Duration (weeks)", value: "P6W", kind: "duration" },
  { label: "Duration (time only)", value: "PT2H30M", kind: "duration" },
  { label: "Negative duration", value: "-P1D", kind: "duration" },
  { label: "Interval (start/end)", value: "2026-01-15/2026-02-20", kind: "interval" },
  { label: "Interval (start/duration)", value: "2026-01-15/P1M", kind: "interval" },
  { label: "Recurring (5 times)", value: "R5/2026-01-15/P1W", kind: "recurring" },
  { label: "Recurring (unbounded)", value: "R/2026-01-15/P1W", kind: "recurring" },
];

const MS_PER_DAY = 86400000;
const MS_PER_HOUR = 3600000;
const MS_PER_MIN = 60000;
const MS_PER_SEC = 1000;
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_NAMES = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

// ---------------------------------------------------------------------------
// Small helpers (exported for tests)
// ---------------------------------------------------------------------------

export function pad2(n: number): string {
  return String(Math.abs(n)).padStart(2, "0");
}
export function pad3(n: number): string {
  return String(Math.abs(n)).padStart(3, "0");
}
export function pad4(n: number): string {
  const s = String(Math.abs(n));
  return s.length >= 4 ? s : s.padStart(4, "0");
}
export function padExpanded(n: number): string {
  // Expanded years must be at least 5 digits with explicit sign.
  const sign = n < 0 ? "-" : "+";
  const s = String(Math.abs(n)).padStart(5, "0");
  return `${sign}${s}`;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  // month is 1-12; Date.UTC(year, month, 0) gives last day of previous month.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

// ---------------------------------------------------------------------------
// Calendar ↔ week ↔ ordinal conversions
// ---------------------------------------------------------------------------

export function calendarToWeek(
  year: number,
  month: number,
  day: number,
): { weekYear: number; week: number; weekDay: number } {
  const d = new Date(Date.UTC(year, month - 1, day));
  const dow = d.getUTCDay() || 7; // Mon=1..Sun=7
  const thursday = new Date(d.getTime());
  thursday.setUTCDate(d.getUTCDate() + (4 - dow));
  const isoYear = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4.getTime());
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1));
  const week =
    Math.floor((thursday.getTime() - week1Monday.getTime()) / (7 * MS_PER_DAY)) + 1;
  return { weekYear: isoYear, week, weekDay: dow };
}

export function weekToCalendar(
  weekYear: number,
  week: number,
  weekDay: number,
): { year: number; month: number; day: number } {
  const jan4 = new Date(Date.UTC(weekYear, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4.getTime());
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1));
  const result = new Date(week1Monday.getTime());
  result.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7 + (weekDay - 1));
  return {
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
    day: result.getUTCDate(),
  };
}

export function calendarToOrdinal(year: number, month: number, day: number): number {
  const start = Date.UTC(year, 0, 1);
  const cur = Date.UTC(year, month - 1, day);
  return Math.floor((cur - start) / MS_PER_DAY) + 1;
}

export function ordinalToCalendar(
  year: number,
  ordinalDay: number,
): { year: number; month: number; day: number } {
  const start = Date.UTC(year, 0, 1);
  const ms = start + (ordinalDay - 1) * MS_PER_DAY;
  const d = new Date(ms);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

// ---------------------------------------------------------------------------
// Detect kind
// ---------------------------------------------------------------------------

export function detectKind(s: string): IsoKind {
  const v = (s || "").trim();
  if (!v) return "date";
  if (v.startsWith("R") || v.startsWith("r")) {
    if (/^R\d*\//i.test(v) || /^R\//i.test(v)) return "recurring";
  }
  if (v.startsWith("P") || v.startsWith("-P") || v.startsWith("+P")) return "duration";
  if (v.includes("/")) return "interval";
  if (v.includes("T") || v.includes(":")) return v.includes("T") ? "datetime" : "time";
  // Pure date string
  return "date";
}

// ---------------------------------------------------------------------------
// Parsing — internal helpers
// ---------------------------------------------------------------------------

function parseFractional(tok: string): number {
  // tok looks like ".5" or ",123" — return nanoseconds (0-999_999_999).
  const s = tok.replace(/^[.,]/, "");
  const padded = (s + "000000000").slice(0, 9);
  return parseInt(padded, 10);
}

function parseOffset(s: string, strict: boolean): number | null {
  if (s === "Z" || s === "z") return 0;
  // ±HH:MM, ±HHMM, ±HH
  const m = /^([+-])(\d{2})(?::?(\d{2}))?$/.exec(s);
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const h = parseInt(m[2], 10);
  const min = m[3] ? parseInt(m[3], 10) : 0;
  if (h > 23) return null;
  if (min > 59) return null;
  // In lenient mode accept -00:00 as "unknown offset"; in strict mode, treat
  // it as 0 (RFC 3339 says -00:00 == unknown but represents UTC).
  if (strict && sign < 0 && h === 0 && min === 0) return 0;
  return sign * (h * 60 + min);
}

function parseCalendarDate(
  s: string,
  strict: boolean,
): {
  year: number;
  month?: number;
  day?: number;
  weekYear?: number;
  week?: number;
  weekDay?: number;
  ordinalDay?: number;
  basic: boolean;
} {
  // Expanded year: ±YYYYY... (sign required, at least 5 digits in strict; in
  // lenient we accept ±YYYY too).
  const expanded = /^([+-])(\d{4,})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(s);
  const expandedBasic = /^([+-])(\d{4,})(\d{2})?(\d{2})?$/.exec(s);
  if (expanded || expandedBasic) {
    const m = expanded ?? expandedBasic!;
    const sign = m[1] === "-" ? -1 : 1;
    const yearDigits = m[2];
    const year = sign * parseInt(yearDigits, 10);
    if (strict && yearDigits.length < 5) {
      throw new Error(`Expanded year must have at least 5 digits in strict mode (got ${yearDigits.length}).`);
    }
    const month = m[3] ? parseInt(m[3], 10) : undefined;
    const day = m[4] ? parseInt(m[4], 10) : undefined;
    if (month !== undefined && (month < 1 || month > 12)) {
      throw new Error(`Month out of range: ${month}.`);
    }
    if (day !== undefined) {
      const dim = daysInMonth(Math.abs(year), month!);
      if (day < 1 || day > dim) throw new Error(`Day ${day} out of range for ${year}-${month}.`);
    }
    return { year, month, day, basic: !expanded };
  }

  // Week date: YYYY-Www-D
  const weekM = /^(\d{4})-W(\d{2})-(\d)$/.exec(s);
  const weekBasicM = /^(\d{4})W(\d{2})(\d)$/.exec(s);
  if (weekM || weekBasicM) {
    const m = weekM ?? weekBasicM!;
    const weekYear = parseInt(m[1], 10);
    const week = parseInt(m[2], 10);
    const weekDay = parseInt(m[3], 10);
    if (week < 1 || week > 53) throw new Error(`Week number out of range: ${week}.`);
    if (weekDay < 1 || weekDay > 7) throw new Error(`Weekday out of range: ${weekDay}.`);
    if (week === 53) {
      const maxWeek = weeksInYear(weekYear);
      if (week > maxWeek) throw new Error(`Year ${weekYear} has only ${maxWeek} ISO weeks.`);
    }
    return { year: weekYear, weekYear, week, weekDay, basic: !weekM };
  }

  // Ordinal date: YYYY-DDD
  const ordM = /^(\d{4})-(\d{3})$/.exec(s);
  const ordBasicM = /^(\d{4})(\d{3})$/.exec(s);
  if (ordM || ordBasicM) {
    const m = ordM ?? ordBasicM!;
    const year = parseInt(m[1], 10);
    const ordinalDay = parseInt(m[2], 10);
    const max = daysInYear(year);
    if (ordinalDay < 1 || ordinalDay > max) {
      throw new Error(`Ordinal day ${ordinalDay} out of range for ${year} (max ${max}).`);
    }
    return { year, ordinalDay, basic: !ordM };
  }

  // Calendar date extended: YYYY-MM-DD
  const calM = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (calM) {
    const year = parseInt(calM[1], 10);
    const month = parseInt(calM[2], 10);
    const day = parseInt(calM[3], 10);
    if (month < 1 || month > 12) throw new Error(`Month out of range: ${month}.`);
    const dim = daysInMonth(year, month);
    if (day < 1 || day > dim) throw new Error(`Day ${day} out of range for ${year}-${pad2(month)}.`);
    return { year, month, day, basic: false };
  }

  // Calendar date basic: YYYYMMDD
  const calBasicM = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (calBasicM) {
    const year = parseInt(calBasicM[1], 10);
    const month = parseInt(calBasicM[2], 10);
    const day = parseInt(calBasicM[3], 10);
    if (month < 1 || month > 12) throw new Error(`Month out of range: ${month}.`);
    const dim = daysInMonth(year, month);
    if (day < 1 || day > dim) throw new Error(`Day ${day} out of range for ${year}${pad2(month)}.`);
    return { year, month, day, basic: true };
  }

  // Year-month only: YYYY-MM
  const ymM = /^(\d{4})-(\d{2})$/.exec(s);
  if (ymM) {
    const year = parseInt(ymM[1], 10);
    const month = parseInt(ymM[2], 10);
    if (month < 1 || month > 12) throw new Error(`Month out of range: ${month}.`);
    return { year, month, basic: false };
  }

  // Year only: YYYY
  const yM = /^(\d{4})$/.exec(s);
  if (yM) {
    return { year: parseInt(yM[1], 10), basic: false };
  }

  throw new Error(`Unrecognised ISO 8601 date format: "${s}".`);
}

function parseTime(s: string, strict: boolean): {
  hour: number;
  minute: number;
  second: number;
  nanos: number;
  offsetMinutes: number | null;
  hasOffset: boolean;
  basic: boolean;
} {
  // s is everything after "T" or the whole time string
  // Match: HH[:MM[:SS[.fff]]] [Z | ±HH[:MM]]
  const m = /^(\d{2})(?::?(\d{2}))?(?::?(\d{2})(?:([.,])(\d+))?)?\s*(Z|z|[+-]\d{2}(?::?\d{2})?)?$/.exec(s);
  if (!m) throw new Error(`Invalid ISO 8601 time: "${s}".`);
  const hour = parseInt(m[1], 10);
  const minute = m[2] ? parseInt(m[2], 10) : 0;
  const second = m[3] ? parseInt(m[3], 10) : 0;
  const nanos = m[5] ? parseFractional(m[4] + m[5]) : 0;
  const basic = !m[2] || !s.includes(":");

  if (hour > 24) throw new Error(`Hour out of range: ${hour}.`);
  if (hour === 24 && (minute !== 0 || second !== 0 || nanos !== 0)) {
    throw new Error(`24:00 is valid only as 24:00:00 exactly (got ${pad2(hour)}:${pad2(minute)}:${pad2(second)}).`);
  }
  if (minute > 59) throw new Error(`Minute out of range: ${minute}.`);
  if (second > 60) throw new Error(`Second out of range: ${second}.`);
  if (second === 60 && strict) {
    // Leap second — only valid as 23:59:60 (or 23:59:60.x)
    if (hour !== 23 || minute !== 59) {
      throw new Error(`Leap second :60 only valid at 23:59:60 (got ${pad2(hour)}:${pad2(minute)}:60).`);
    }
  }
  if (m[4] === "," && strict) {
    throw new Error(`Comma decimal separator is non-standard in strict mode (use ".").`);
  }

  let offsetMinutes: number | null = null;
  let hasOffset = false;
  if (m[6]) {
    offsetMinutes = parseOffset(m[6], strict);
    if (offsetMinutes === null) throw new Error(`Invalid UTC offset: "${m[6]}".`);
    hasOffset = true;
  }
  return { hour, minute, second, nanos, offsetMinutes, hasOffset, basic };
}

export function weeksInYear(year: number): number {
  // A year has 53 weeks if Jan 1 is Thursday, OR (Jan 1 is Wednesday AND year is a leap year).
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dow = jan1.getUTCDay() || 7;
  if (dow === 4) return 53;
  if (dow === 3 && isLeapYear(year)) return 53;
  return 52;
}

// ---------------------------------------------------------------------------
// Duration parsing & formatting
// ---------------------------------------------------------------------------

export function parseDuration(s: string, opts?: ParseOptions): ParsedDuration {
  const strict = !!opts?.strict;
  const v = (s || "").trim();
  if (!v) throw new Error("Empty duration.");
  let negative = false;
  let body = v;
  if (body.startsWith("-")) { negative = true; body = body.slice(1); }
  else if (body.startsWith("+")) { body = body.slice(1); }
  if (!body.startsWith("P")) throw new Error(`Duration must start with "P" (got "${body}").`);
  body = body.slice(1);
  // Split on T
  const tIdx = body.indexOf("T");
  const datePart = tIdx >= 0 ? body.slice(0, tIdx) : body;
  const timePart = tIdx >= 0 ? body.slice(tIdx + 1) : "";
  if (tIdx >= 0 && !timePart) throw new Error(`"T" must be followed by time components.`);
  if (!datePart && !timePart) throw new Error(`Duration must have at least one component.`);

  const result: ParsedDuration = {
    years: 0, months: 0, weeks: 0, days: 0,
    hours: 0, minutes: 0, seconds: 0, nanos: 0,
    negative,
  };
  const seen = new Set<string>();

  type NumKey = "years" | "months" | "weeks" | "days" | "hours" | "minutes" | "seconds";
  const consume = (part: string, allow: ReadonlyArray<[string, NumKey]>) => {
    let rest = part;
    const re = /^(\d+(?:[.,]\d+)?)([A-Za-z])/;
    while (rest.length > 0) {
      const m = re.exec(rest);
      if (!m) throw new Error(`Invalid duration segment "${rest}".`);
      const valStr = m[1];
      const unit = m[2];
      const allowed = allow.find(([u]) => u === unit);
      if (!allowed) throw new Error(`Unit "${unit}" not allowed here (allowed: ${allow.map(([u]) => u).join(", ")}).`);
      if (seen.has(unit) && strict) {
        throw new Error(`Unit "${unit}" appears twice in strict mode.`);
      }
      seen.add(unit);
      const val = parseFloat(valStr.replace(",", "."));
      if (val < 0) throw new Error(`Duration component must be non-negative (got ${val}).`);
      const key = allowed[1];
      if (key === "seconds") {
        const intPart = Math.floor(val);
        const fracPart = val - intPart;
        result.seconds += intPart;
        result.nanos += Math.round(fracPart * 1e9);
      } else {
        if (strict && !Number.isInteger(val)) {
          throw new Error(`Fractional value for "${unit}" not allowed in strict mode.`);
        }
        result[key] += Math.floor(val);
      }
      rest = rest.slice(m[0].length);
    }
  };

  consume(datePart, [
    ["Y", "years"], ["M", "months"], ["W", "weeks"], ["D", "days"],
  ]);
  consume(timePart, [
    ["H", "hours"], ["M", "minutes"], ["S", "seconds"],
  ]);

  return result;
}

export function formatDuration(d: ParsedDuration, opts?: FormatOptions): string {
  const basic = !!opts?.basic;
  const parts: string[] = ["P"];
  const dateParts: string[] = [];
  if (d.years) dateParts.push(`${d.years}Y`);
  if (d.months) dateParts.push(`${d.months}M`);
  if (d.weeks) dateParts.push(`${d.weeks}W`);
  if (d.days) dateParts.push(`${d.days}D`);
  const timeParts: string[] = [];
  if (d.hours) timeParts.push(`${d.hours}H`);
  if (d.minutes) timeParts.push(`${d.minutes}M`);
  let seconds = d.seconds;
  let nanos = d.nanos;
  if (nanos >= 1e9) {
    seconds += Math.floor(nanos / 1e9);
    nanos = nanos % 1e9;
  }
  if (seconds || nanos) {
    let secStr = `${seconds}`;
    if (nanos) {
      const frac = String(nanos).padStart(9, "0").replace(/0+$/, "");
      secStr += `${basic ? "," : "."}${frac}`;
    }
    timeParts.push(`${secStr}S`);
  }
  parts.push(dateParts.join(""));
  if (timeParts.length > 0) {
    parts.push("T");
    parts.push(timeParts.join(""));
  }
  // Empty P with no components is invalid; emit P0D as a fallback.
  if (dateParts.length === 0 && timeParts.length === 0) parts.push("0D");
  const out = (d.negative ? "-" : "") + parts.join("");
  return out;
}

export function durationToSeconds(d: ParsedDuration): number {
  // Years and months are NOT convertible to seconds without a reference date.
  // Convert what we can: weeks*7 + days, hours, minutes, seconds.
  const total =
    d.weeks * 7 * 86400 +
    d.days * 86400 +
    d.hours * 3600 +
    d.minutes * 60 +
    d.seconds +
    d.nanos / 1e9;
  return d.negative ? -total : total;
}

export function normalizeDuration(d: ParsedDuration): ParsedDuration {
  // Carry overflow in time fields.
  let nanos = d.nanos;
  let seconds = d.seconds + Math.floor(nanos / 1e9);
  nanos = ((nanos % 1e9) + 1e9) % 1e9;
  let minutes = d.minutes + Math.floor(seconds / 60);
  seconds = ((seconds % 60) + 60) % 60;
  let hours = d.hours + Math.floor(minutes / 60);
  minutes = ((minutes % 60) + 60) % 60;
  let days = d.days + Math.floor(hours / 24);
  hours = ((hours % 24) + 24) % 24;
  // Don't carry days -> months/years (variable length).
  return {
    years: d.years, months: d.months, weeks: d.weeks, days,
    hours, minutes, seconds, nanos, negative: d.negative,
  };
}

// ---------------------------------------------------------------------------
// Top-level parser
// ---------------------------------------------------------------------------

export function parseIso8601(s: string, opts?: ParseOptions): ParsedDate {
  const strict = !!opts?.strict;
  const v = (s || "").trim();
  if (!v) throw new Error("Empty input.");
  const kind = detectKind(v);

  if (kind === "duration") {
    const duration = parseDuration(v, opts);
    return { kind, duration, raw: v };
  }

  if (kind === "interval") {
    return parseInterval(v, opts);
  }

  if (kind === "recurring") {
    return parseRecurring(v, opts);
  }

  if (kind === "datetime") {
    // Split date / time on "T" (case-insensitive) or single space.
    const tIdx = v.search(/[Tt ]/);
    if (tIdx < 0) throw new Error(`Missing time separator in datetime "${v}".`);
    const dateStr = v.slice(0, tIdx);
    const timeStr = v.slice(tIdx + 1);
    const dPart = parseCalendarDate(dateStr, strict);
    const tPart = parseTime(timeStr, strict);
    return {
      kind,
      year: dPart.year,
      month: dPart.month,
      day: dPart.day,
      weekYear: dPart.weekYear,
      week: dPart.week,
      weekDay: dPart.weekDay,
      ordinalDay: dPart.ordinalDay,
      hour: tPart.hour,
      minute: tPart.minute,
      second: tPart.second,
      nanos: tPart.nanos,
      offsetMinutes: tPart.hasOffset ? tPart.offsetMinutes : undefined,
      basic: dPart.basic && tPart.basic,
      raw: v,
    };
  }

  if (kind === "time") {
    const tPart = parseTime(v, strict);
    return {
      kind,
      hour: tPart.hour,
      minute: tPart.minute,
      second: tPart.second,
      nanos: tPart.nanos,
      offsetMinutes: tPart.hasOffset ? tPart.offsetMinutes : undefined,
      basic: tPart.basic,
      raw: v,
    };
  }

  // Pure date
  const dPart = parseCalendarDate(v, strict);
  return {
    kind,
    year: dPart.year,
    month: dPart.month,
    day: dPart.day,
    weekYear: dPart.weekYear,
    week: dPart.week,
    weekDay: dPart.weekDay,
    ordinalDay: dPart.ordinalDay,
    basic: dPart.basic,
    raw: v,
  };
}

export function parseInterval(s: string, opts?: ParseOptions): ParsedDate {
  const v = (s || "").trim();
  const slash = v.indexOf("/");
  if (slash < 0) throw new Error(`Interval must contain "/" separator.`);
  const a = v.slice(0, slash).trim();
  const b = v.slice(slash + 1).trim();
  if (!a || !b) throw new Error(`Interval has empty start or end.`);
  let start: ParsedDate;
  let end: ParsedDate;
  // start/duration or duration/end
  const aIsDur = /^[-+]?P/.test(a);
  const bIsDur = /^[-+]?P/.test(b);
  if (aIsDur && !bIsDur) {
    // duration/end
    const dur = parseDuration(a, opts);
    end = parseIso8601(b, opts);
    start = { kind: "duration", duration: dur, raw: a };
    return { kind: "interval", start, end, raw: v };
  }
  if (bIsDur && !aIsDur) {
    start = parseIso8601(a, opts);
    const dur = parseDuration(b, opts);
    end = { kind: "duration", duration: dur, raw: b };
    return { kind: "interval", start, end, raw: v };
  }
  if (aIsDur && bIsDur) throw new Error(`Interval cannot have both sides be durations.`);
  start = parseIso8601(a, opts);
  end = parseIso8601(b, opts);
  return { kind: "interval", start, end, raw: v };
}

export function parseRecurring(s: string, opts?: ParseOptions): ParsedDate {
  const v = (s || "").trim();
  // Rn/start/duration  OR  R/start/duration
  const m = /^R(\d*)\/(.+)$/.exec(v);
  if (!m) throw new Error(`Recurring interval must start with "Rn/" or "R/" (got "${v}").`);
  const countStr = m[1];
  const count = countStr === "" ? Infinity : parseInt(countStr, 10);
  if (countStr !== "" && count < 1) throw new Error(`Recurring count must be >= 1 (got ${count}).`);
  const rest = m[2];
  const slash = rest.indexOf("/");
  if (slash < 0) throw new Error(`Recurring interval must have start/duration after "Rn/".`);
  const startStr = rest.slice(0, slash).trim();
  const durStr = rest.slice(slash + 1).trim();
  if (!/^[-+]?P/.test(durStr)) {
    throw new Error(`Recurring interval must end with a duration (got "${durStr}").`);
  }
  const start = parseIso8601(startStr, opts);
  const duration = parseDuration(durStr, opts);
  return { kind: "recurring", count, start, duration, raw: v };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateIso8601(s: string, opts?: ParseOptions): ValidationResult {
  try {
    const parsed = parseIso8601(s, opts);
    return { valid: true, kind: parsed.kind, parsed };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

export function toMs(p: ParsedDate): number {
  if (p.kind === "duration" || p.kind === "interval" || p.kind === "recurring") {
    throw new Error(`toMs is only defined for date/time/datetime kinds (got ${p.kind}).`);
  }
  let year: number;
  let month: number;
  let day: number;
  if (p.weekYear !== undefined && p.week !== undefined && p.weekDay !== undefined) {
    const c = weekToCalendar(p.weekYear, p.week, p.weekDay);
    year = c.year; month = c.month; day = c.day;
  } else if (p.year !== undefined && p.ordinalDay !== undefined) {
    const c = ordinalToCalendar(p.year, p.ordinalDay);
    year = c.year; month = c.month; day = c.day;
  } else if (p.year !== undefined && p.month !== undefined && p.day !== undefined) {
    year = p.year; month = p.month; day = p.day;
  } else if (p.year !== undefined && p.month !== undefined) {
    year = p.year; month = p.month; day = 1;
  } else if (p.year !== undefined) {
    year = p.year; month = 1; day = 1;
  } else {
    // Time-only: anchor to 1970-01-01 (epoch).
    year = 1970; month = 1; day = 1;
  }
  let hour = p.hour ?? 0;
  let minute = p.minute ?? 0;
  let second = p.second ?? 0;
  // Treat 24:00:00 as 00:00:00 of next day. JS Date handles that via setUTCDate.
  if (hour === 24) {
    hour = 0;
    const d = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    d.setUTCDate(d.getUTCDate() + 1);
    // Apply offset
    let ms = d.getTime();
    if (p.offsetMinutes !== undefined && p.offsetMinutes !== null) {
      ms -= p.offsetMinutes * MS_PER_MIN;
    }
    return ms;
  }
  // Leap second: clamp 60 → 59 (Date can't represent leap seconds).
  if (second === 60) second = 59;
  const d = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  let ms = d.getTime();
  if (p.offsetMinutes !== undefined && p.offsetMinutes !== null) {
    ms -= p.offsetMinutes * MS_PER_MIN;
  }
  // Add nanoseconds as fractional ms (kept as a sub-ms precision loss in Date).
  if (p.nanos) {
    ms += Math.floor(p.nanos / 1e6);
  }
  return ms;
}

export function fromMs(ms: number, opts?: { offsetMinutes?: number | null }): ParsedDate {
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const hour = d.getUTCHours();
  const minute = d.getUTCMinutes();
  const second = d.getUTCSeconds();
  return {
    kind: "datetime",
    year, month, day,
    hour, minute, second,
    nanos: 0,
    offsetMinutes: opts?.offsetMinutes,
    basic: false,
    raw: new Date(ms).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatYear(year: number | undefined, basic: boolean): string {
  if (year === undefined) return "";
  if (year < 0 || year > 9999) return padExpanded(year);
  return pad4(year);
}

function formatOffset(
  offsetMinutes: number | null | undefined,
  zForUtc: boolean,
): string {
  if (offsetMinutes === undefined || offsetMinutes === null) return "";
  if (zForUtc && offsetMinutes === 0) return "Z";
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${pad2(h)}:${pad2(m)}`;
}

export function formatCalendarDate(p: ParsedDate, opts?: FormatOptions): string {
  const basic = !!opts?.basic;
  const sep = basic ? "" : "-";
  const year = formatYear(p.year, basic);
  let out = year;
  if (p.month !== undefined) {
    out += `${sep}${pad2(p.month)}`;
    if (p.day !== undefined) {
      out += `${sep}${pad2(p.day)}`;
    }
  }
  return out;
}

export function formatWeekDate(p: ParsedDate, opts?: FormatOptions): string {
  const basic = !!opts?.basic;
  // If we have a calendar date, convert.
  let weekYear = p.weekYear;
  let week = p.week;
  let weekDay = p.weekDay;
  if ((weekYear === undefined || week === undefined || weekDay === undefined) &&
      p.year !== undefined && p.month !== undefined && p.day !== undefined) {
    const w = calendarToWeek(p.year, p.month, p.day);
    weekYear = w.weekYear; week = w.week; weekDay = w.weekDay;
  }
  if (weekYear === undefined || week === undefined || weekDay === undefined) {
    throw new Error(`Cannot format week date: insufficient components.`);
  }
  if (basic) {
    return `${pad4(weekYear)}W${pad2(week)}${weekDay}`;
  }
  return `${pad4(weekYear)}-W${pad2(week)}-${weekDay}`;
}

export function formatOrdinalDate(p: ParsedDate, opts?: FormatOptions): string {
  const basic = !!opts?.basic;
  if (p.year === undefined) throw new Error(`Cannot format ordinal date: year missing.`);
  let ordinalDay = p.ordinalDay;
  if (ordinalDay === undefined && p.month !== undefined && p.day !== undefined) {
    ordinalDay = calendarToOrdinal(p.year, p.month, p.day);
  }
  if (ordinalDay === undefined) throw new Error(`Cannot format ordinal date: no day info.`);
  const sep = basic ? "" : "-";
  return `${formatYear(p.year, basic)}${sep}${pad3(ordinalDay)}`;
}

export function formatTime(p: ParsedDate, opts?: FormatOptions): string {
  if (p.hour === undefined) return "";
  const basic = !!opts?.basic;
  const sep = basic ? "" : ":";
  let out = `${pad2(p.hour)}${sep}${pad2(p.minute ?? 0)}`;
  if (p.second !== undefined || (p.nanos && p.nanos > 0)) {
    out += `${sep}${pad2(p.second ?? 0)}`;
    const fracDigits = opts?.fractionalDigits ?? 0;
    if (fracDigits > 0 && p.nanos) {
      const frac = String(p.nanos).padStart(9, "0").slice(0, fracDigits);
      out += `${basic ? "," : "."}${frac}`;
    } else if (fracDigits > 0) {
      const frac = "0".repeat(fracDigits);
      out += `${basic ? "," : "."}${frac}`;
    } else if (p.nanos && fracDigits === 0) {
      // Default: emit minimal-trailing-zero fractional seconds.
      const frac = String(p.nanos).padStart(9, "0").replace(/0+$/, "");
      if (frac) out += `${basic ? "," : "."}${frac}`;
    }
  }
  const includeOffset = opts?.includeOffset !== false;
  if (includeOffset && p.offsetMinutes !== undefined) {
    out += formatOffset(p.offsetMinutes, opts?.zForUtc !== false);
  }
  return out;
}

export function formatDateTime(p: ParsedDate, opts?: FormatOptions): string {
  if (opts?.timeOnly) return formatTime(p, opts);
  if (opts?.dateOnly) return formatDateByStyle(p, opts);
  const dateStr = formatDateByStyle(p, opts);
  const timeStr = formatTime(p, opts);
  if (!timeStr) return dateStr;
  return `${dateStr}T${timeStr}`;
}

function formatDateByStyle(p: ParsedDate, opts?: FormatOptions): string {
  const style = opts?.style ?? "calendar";
  if (style === "week") return formatWeekDate(p, opts);
  if (style === "ordinal") return formatOrdinalDate(p, opts);
  return formatCalendarDate(p, opts);
}

export function formatInterval(start: ParsedDate, end: ParsedDate, opts?: FormatOptions): string {
  const a = start.kind === "duration"
    ? formatDuration(start.duration!, opts)
    : formatDateTime(start, opts);
  const b = end.kind === "duration"
    ? formatDuration(end.duration!, opts)
    : formatDateTime(end, opts);
  return `${a}/${b}`;
}

export function formatRecurring(
  count: number,
  start: ParsedDate,
  duration: ParsedDuration,
  opts?: FormatOptions,
): string {
  const c = count === Infinity ? "" : String(count);
  const s = formatDateTime(start, opts);
  const d = formatDuration(duration, opts);
  return `R${c}/${s}/${d}`;
}

export function formatAll(p: ParsedDate, opts?: FormatOptions): AllFormats {
  const base: FormatOptions = { ...opts };
  const basicOpts: FormatOptions = { ...opts, basic: true };
  const utcOpts: FormatOptions = { ...opts, zForUtc: true };
  // For p with no offset (date-only), use Z for UTC output.
  const utcP: ParsedDate = { ...p, offsetMinutes: 0 };
  return {
    calendar: formatDateTime(p, { ...base, style: "calendar" }),
    calendarBasic: formatDateTime(p, { ...basicOpts, style: "calendar" }),
    week: formatDateTime(p, { ...base, style: "week" }),
    ordinal: formatDateTime(p, { ...base, style: "ordinal" }),
    time: formatTime(p, base),
    dateTime: formatDateTime(p, { ...base, style: "calendar" }),
    dateTimeBasic: formatDateTime(p, { ...basicOpts, style: "calendar" }),
    dateTimeUtc: formatDateTime(utcP, { ...utcOpts, style: "calendar" }),
    dateOnly: formatDateByStyle(p, { ...base }),
    timeOnly: formatTime(p, { ...base, includeOffset: false }),
  };
}

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

export function addDuration(p: ParsedDate, d: ParsedDuration): ParsedDate {
  if (p.kind === "duration" || p.kind === "interval" || p.kind === "recurring") {
    throw new Error(`addDuration is only defined for date/time/datetime kinds (got ${p.kind}).`);
  }
  // Convert to ms first (loses nanoseconds, but Date has no sub-ms precision).
  let ms = toMs(p);
  // Apply offset: toMs returns absolute UTC ms.
  // Add the absolute-time portion.
  ms += durationToSeconds(d) * 1000;
  // Apply year/month arithmetic on the local wall-clock.
  if (d.years !== 0 || d.months !== 0) {
    // Convert to UTC wall-clock components.
    const date = new Date(ms);
    let year = date.getUTCFullYear();
    let month = date.getUTCMonth();
    let day = date.getUTCDate();
    const totalMonths = year * 12 + month + (d.negative ? -1 : 1) * (d.years * 12 + d.months);
    year = Math.floor(totalMonths / 12);
    month = ((totalMonths % 12) + 12) % 12;
    // Clamp day to month-end.
    const dim = daysInMonth(year, month + 1);
    if (day > dim) day = dim;
    date.setUTCFullYear(year, month, day);
    ms = date.getTime();
  }
  return fromMs(ms, { offsetMinutes: p.offsetMinutes ?? null });
}

export function subtractDuration(p: ParsedDate, d: ParsedDuration): ParsedDate {
  const neg: ParsedDuration = { ...d, negative: !d.negative };
  return addDuration(p, neg);
}

// ---------------------------------------------------------------------------
// Component view
// ---------------------------------------------------------------------------

export function getComponents(p: ParsedDate): ComponentView {
  let calendar: { year: number; month: number; day: number } | null = null;
  let week: { weekYear: number; week: number; weekDay: number } | null = null;
  let ordinal: { year: number; ordinalDay: number } | null = null;

  if (p.weekYear !== undefined && p.week !== undefined && p.weekDay !== undefined) {
    week = { weekYear: p.weekYear, week: p.week, weekDay: p.weekDay };
    const c = weekToCalendar(p.weekYear, p.week, p.weekDay);
    calendar = { year: c.year, month: c.month, day: c.day };
    ordinal = { year: c.year, ordinalDay: calendarToOrdinal(c.year, c.month, c.day) };
  } else if (p.year !== undefined && p.ordinalDay !== undefined) {
    ordinal = { year: p.year, ordinalDay: p.ordinalDay };
    const c = ordinalToCalendar(p.year, p.ordinalDay);
    calendar = { year: c.year, month: c.month, day: c.day };
    const w = calendarToWeek(c.year, c.month, c.day);
    week = { weekYear: w.weekYear, week: w.week, weekDay: w.weekDay };
  } else if (p.year !== undefined && p.month !== undefined && p.day !== undefined) {
    calendar = { year: p.year, month: p.month, day: p.day };
    const w = calendarToWeek(p.year, p.month, p.day);
    week = { weekYear: w.weekYear, week: w.week, weekDay: w.weekDay };
    ordinal = { year: p.year, ordinalDay: calendarToOrdinal(p.year, p.month, p.day) };
  } else if (p.year !== undefined && p.month !== undefined) {
    calendar = { year: p.year, month: p.month, day: 1 };
  } else if (p.year !== undefined) {
    calendar = { year: p.year, month: 1, day: 1 };
  }

  const time = (p.hour !== undefined)
    ? { hour: p.hour, minute: p.minute ?? 0, second: p.second ?? 0, nanos: p.nanos ?? 0 }
    : null;

  const offset = (p.offsetMinutes !== undefined)
    ? { minutes: p.offsetMinutes, label: formatOffset(p.offsetMinutes, true) || "Z" }
    : null;

  let weekday: string | null = null;
  if (week) weekday = WEEKDAY_NAMES[week.weekDay - 1];

  return { calendar, week, ordinal, time, offset, weekday };
}

export function explain(p: ParsedDate): string {
  if (p.kind === "duration" && p.duration) {
    const d = normalizeDuration(p.duration);
    const parts: string[] = [];
    if (d.years) parts.push(`${d.years} year${d.years > 1 ? "s" : ""}`);
    if (d.months) parts.push(`${d.months} month${d.months > 1 ? "s" : ""}`);
    if (d.weeks) parts.push(`${d.weeks} week${d.weeks > 1 ? "s" : ""}`);
    if (d.days) parts.push(`${d.days} day${d.days > 1 ? "s" : ""}`);
    if (d.hours) parts.push(`${d.hours} hour${d.hours > 1 ? "s" : ""}`);
    if (d.minutes) parts.push(`${d.minutes} minute${d.minutes > 1 ? "s" : ""}`);
    if (d.seconds) parts.push(`${d.seconds} second${d.seconds > 1 ? "s" : ""}`);
    if (d.nanos) parts.push(`${d.nanos} ns`);
    return `${d.negative ? "Negative " : ""}duration of ${parts.join(", ") || "0 seconds"}.`;
  }
  if (p.kind === "interval" && p.start && p.end) {
    const a = p.start.kind === "duration" ? formatDuration(p.start.duration!) : formatDateTime(p.start);
    const b = p.end.kind === "duration" ? formatDuration(p.end.duration!) : formatDateTime(p.end);
    return `Interval from ${a} to ${b}.`;
  }
  if (p.kind === "recurring" && p.start && p.duration) {
    const c = p.count === Infinity ? "unbounded" : `${p.count}×`;
    return `Repeats ${c} starting ${formatDateTime(p.start)} every ${formatDuration(p.duration)}.`;
  }
  const c = getComponents(p);
  const parts: string[] = [];
  if (c.calendar) parts.push(`${c.calendar.year}-${pad2(c.calendar.month)}-${pad2(c.calendar.day)}`);
  if (c.week) parts.push(`ISO week ${c.week.weekYear}-W${pad2(c.week.week)}-${c.week.weekDay}`);
  if (c.ordinal) parts.push(`ordinal ${c.ordinal.year}-${pad3(c.ordinal.ordinalDay)}`);
  if (c.time) parts.push(`${pad2(c.time.hour)}:${pad2(c.time.minute)}:${pad2(c.time.second)}${c.time.nanos ? `.${String(c.time.nanos).padStart(9, "0").replace(/0+$/, "")}` : ""}`);
  if (c.offset) parts.push(`UTC${c.offset.label}`);
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------
// Code snippets
// ---------------------------------------------------------------------------

export function codeSnippets(p: ParsedDate): CodeSnippets {
  // Produce language-specific snippets that construct or reference the same
  // instant. For durations/intervals/recurring, focus on Temporal-style APIs.
  if (p.kind === "duration" && p.duration) {
    const d = formatDuration(p.duration);
    return {
      js: `// Temporal.Duration (TC39 Stage 3)\nimport { Temporal } from "@js-temporal/polyfill";\nconst d = Temporal.Duration.from("${d}");\nconsole.log(d.total("seconds"));`,
      python: `# Python: parse ISO 8601 duration\nfrom isodate import parse_duration\nd = parse_duration("${d}")\nprint(d.total_seconds())`,
      java: `// Java: java.time.Duration does NOT support years/months.\n// Use threeten-extra for PeriodDuration.\nimport org.threeten.extra.PeriodDuration;\nvar pd = PeriodDuration.parse("${d}");\nSystem.out.println(pd);`,
      go: `// Go: no stdlib ISO-8601 duration parser.\nimport "github.com/rickb777/date"\nd, _ := date.ParseDuration("${d}")\nfmt.Println(d)`,
    };
  }
  if (p.kind === "interval" && p.start && p.end) {
    const a = p.start.kind === "duration"
      ? formatDuration(p.start.duration!)
      : formatDateTime(p.start);
    const b = p.end.kind === "duration"
      ? formatDuration(p.end.duration!)
      : formatDateTime(p.end);
    return {
      js: `// Temporal.ZonedDateTime interval\nimport { Temporal } from "@js-temporal/polyfill";\nconst start = Temporal.Instant.from("${a}");\nconst end = Temporal.Instant.from("${b}");\nconst diff = start.until(end);`,
      python: `# Python: datetime + isodate interval\nfrom isodate import parse_datetime\nstart = parse_datetime("${a}")\nend = parse_datetime("${b}")\nprint((end - start).total_seconds())`,
      java: `// Java: interval via java.time.Instant\nimport java.time.Instant;\nvar start = Instant.parse("${a}");\nvar end = Instant.parse("${b}");\nSystem.out.println(java.time.Duration.between(start, end));`,
      go: `// Go: time.Time interval\nimport "time"\nstart, _ := time.Parse(time.RFC3339, "${a}")\nend, _ := time.Parse(time.RFC3339, "${b}")\nfmt.Println(end.Sub(start))`,
    };
  }
  if (p.kind === "recurring" && p.start && p.duration) {
    const s = formatDateTime(p.start);
    const d = formatDuration(p.duration);
    const c = p.count === Infinity ? "0" : String(p.count);
    return {
      js: `// Temporal: build a recurring schedule manually\nimport { Temporal } from "@js-temporal/polyfill";\nconst start = Temporal.Instant.from("${s}");\nconst dur = Temporal.Duration.from("${d}");\n// Repeat ${c === "0" ? "forever" : c + " times"} from start.\nlet cur = start;\nfor (let i = 0; i < ${c === "0" ? "Infinity" : c}; i++) {\n  console.log(cur.toString());\n  cur = cur.add(dur);\n}`,
      python: `# Python: RRule-style recurrence\nfrom datetime import datetime, timedelta\nfrom isodate import parse_duration\nstart = datetime.fromisoformat("${s}".replace("Z", "+00:00"))\nstep = parse_duration("${d}")\nfor i in range(${c === "0" ? "100" : c}):\n    print((start + i * step).isoformat())`,
      java: `// Java: recurrence loop\nimport java.time.Instant;\nimport java.time.Duration;\nvar start = Instant.parse("${s}");\nvar step = Duration.parse("${d}".replace("Y","").replace("M","").replace("D","D")); // Y/M need Period\nfor (int i = 0; i < ${c === "0" ? "100" : c}; i++) {\n  System.out.println(start.plus(step.multipliedBy(i)));\n}`,
      go: `// Go: recurrence loop\nimport "time"\nstart, _ := time.Parse(time.RFC3339, "${s}")\n// step must be computed from "${d}" manually\nfor i := 0; i < ${c === "0" ? "100" : c}; i++ {\n  fmt.Println(start.Add(time.Duration(i) * 24 * time.Hour))\n}`,
    };
  }
  // Date/time/datetime
  const iso = formatDateTime(p);
  return {
    js: `// JavaScript: native Date (loses sub-ms precision)\nconst d = new Date("${iso}");\nconsole.log(d.toISOString());\n// Better: Temporal\nimport { Temporal } from "@js-temporal/polyfill";\nconst t = Temporal.Instant.from("${iso}");`,
    python: `# Python: datetime.fromisoformat (3.7+; Z handling improved in 3.11)\nfrom datetime import datetime\nd = datetime.fromisoformat("${iso}".replace("Z", "+00:00"))\nprint(d.isoformat())`,
    java: `// Java: java.time.Instant or ZonedDateTime\nimport java.time.Instant;\nvar t = Instant.parse("${iso}");\nSystem.out.println(t);`,
    go: `// Go: time.Parse with RFC 3339 layout\nimport "time"\nt, _ := time.Parse(time.RFC3339, "${iso}")\nfmt.Println(t)`,
  };
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:iso-8601-parser:history";
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
// Shareable URL
// ---------------------------------------------------------------------------

export function buildShareUrl(input: string, strict: boolean): string {
  const params = new URLSearchParams();
  if (input) params.set("i", input);
  if (strict) params.set("strict", "1");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { input: string; strict: boolean } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { input: "", strict: false };
  const params = new URLSearchParams(clean);
  return {
    input: params.get("i") ?? "",
    strict: params.get("strict") === "1",
  };
}

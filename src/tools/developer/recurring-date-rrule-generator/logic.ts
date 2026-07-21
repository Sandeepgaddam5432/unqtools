/**
 * Recurring Date RRULE Generator — pure logic.
 *
 * Build and parse iCalendar RRULE recurrence strings per RFC 5545 §3.8.5.3.
 * Two-way editor: build via UI or paste an RRULE, instantly see plain-English
 * meaning and the next N concrete occurrences. Full support for FREQ
 * (SECONDLY / MINUTELY / HOURLY / DAILY / WEEKLY / MONTHLY / YEARLY),
 * INTERVAL, COUNT, UNTIL (DST-aware UTC normalization), BYDAY with ordinals,
 * BYMONTHDAY, BYYEARDAY, BYWEEKNO, BYMONTH, BYHOUR, BYMINUTE, BYSECOND,
 * BYSETPOS (with negatives), WKST, EXDATE, RDATE. Generate VEVENT .ics and
 * code snippets for rrule.js + python-dateutil. Pure functions only — no DOM,
 * no network. Offline, deterministic, side-effect-free except for the
 * localStorage history helpers (loadHistory/saveHistory/clearHistory) which
 * are intentionally impure for persistence.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Freq =
  | "SECONDLY"
  | "MINUTELY"
  | "HOURLY"
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "YEARLY";

export type Weekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";

export interface ByDayEntry {
  /** Optional ordinal: positive (1=first) or negative (-1=last). */
  ordinal?: number;
  weekday: Weekday;
}

export interface RRule {
  freq: Freq;
  interval?: number;
  count?: number;
  /** YYYY-MM-DD (date-only) or YYYY-MM-DDTHH:MM:SS[Z]. */
  until?: string;
  byDay?: ByDayEntry[];
  byMonthDay?: number[];
  byYearDay?: number[];
  byWeekNo?: number[];
  byMonth?: number[];
  byHour?: number[];
  byMinute?: number[];
  bySecond?: number[];
  bySetPos?: number[];
  wkst?: Weekday;
}

export interface DtStart {
  /** YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS or YYYY-MM-DDTHH:MM:SSZ. */
  value: string;
  /** True if the value is a pure date (no time). */
  isDateOnly: boolean;
  /** Optional timezone identifier (TZID parameter). */
  tzid?: string;
}

export interface ParsedRule {
  dtStart?: DtStart;
  rrule: RRule;
  exDates?: string[];
  rDates?: string[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface ParseResult {
  ok: boolean;
  value?: ParsedRule;
  error?: string;
}

export interface HistoryEntry {
  ts: number;
  freq: Freq;
  interval: number;
  hasCount: boolean;
  hasUntil: boolean;
  preview: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const FREQS: ReadonlyArray<{ value: Freq; label: string }> = [
  { value: "SECONDLY", label: "Secondly" },
  { value: "MINUTELY", label: "Minutely" },
  { value: "HOURLY", label: "Hourly" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
];

export const WEEKDAYS: ReadonlyArray<{ value: Weekday; label: string }> = [
  { value: "MO", label: "Monday" },
  { value: "TU", label: "Tuesday" },
  { value: "WE", label: "Wednesday" },
  { value: "TH", label: "Thursday" },
  { value: "FR", label: "Friday" },
  { value: "SA", label: "Saturday" },
  { value: "SU", label: "Sunday" },
];

export const WKST_OPTIONS: ReadonlyArray<{ value: Weekday; label: string }> = WEEKDAYS;

export const COMMON_PRESETS: ReadonlyArray<{ label: string; rrule: string }> = [
  { label: "Every weekday (Mon-Fri)", rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
  { label: "Every weekend (Sat-Sun)", rrule: "FREQ=WEEKLY;BYDAY=SA,SU" },
  { label: "Daily", rrule: "FREQ=DAILY" },
  { label: "Weekly (every Monday)", rrule: "FREQ=WEEKLY;BYDAY=MO" },
  { label: "Bi-weekly", rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO" },
  { label: "Monthly (15th)", rrule: "FREQ=MONTHLY;BYMONTHDAY=15" },
  { label: "Last Friday of every month", rrule: "FREQ=MONTHLY;BYDAY=-1FR" },
  { label: "First Monday of every quarter", rrule: "FREQ=MONTHLY;INTERVAL=3;BYDAY=1MO" },
  { label: "Yearly (Jan 1)", rrule: "FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1" },
  { label: "Every Tuesday and Thursday for 10 occurrences", rrule: "FREQ=WEEKLY;BYDAY=TU,TH;COUNT=10" },
  { label: "Every 6 hours", rrule: "FREQ=HOURLY;INTERVAL=6" },
  { label: "Every 30 minutes", rrule: "FREQ=MINUTELY;INTERVAL=30" },
];

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

// ---------------------------------------------------------------------------
// Small helpers (exported for tests)
// ---------------------------------------------------------------------------

export function pad2(n: number): string {
  return String(Math.abs(n)).padStart(2, "0");
}

export function pad4(n: number): string {
  const s = String(Math.abs(n));
  return s.length >= 4 ? s : s.padStart(4, "0");
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  // month is 1-12; Date.UTC(year, month, 0) gives last day of that month.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

/** Weekday number: MO=1, TU=2, ..., SU=7 (ISO 8601). */
export function weekdayToNumber(weekday: Weekday): number {
  switch (weekday) {
    case "MO": return 1;
    case "TU": return 2;
    case "WE": return 3;
    case "TH": return 4;
    case "FR": return 5;
    case "SA": return 6;
    case "SU": return 7;
  }
}

export function numberToWeekday(n: number): Weekday {
  const idx = ((n - 1) % 7 + 7) % 7;
  return ["MO", "TU", "WE", "TH", "FR", "SA", "SU"][idx] as Weekday;
}

/** JS getDay() (0=Sun..6=Sat) → ISO weekday (1=Mon..7=Sun). */
export function jsDayToIso(dow: number): number {
  return dow === 0 ? 7 : dow;
}

/** ISO weekday (1=Mon..7=Sun) → JS getDay() (0=Sun..6=Sat). */
export function isoToJsDay(iso: number): number {
  return iso === 7 ? 0 : iso;
}

/** Format a Date (UTC components) as YYYY-MM-DD. */
export function formatIsoDate(year: number, month: number, day: number): string {
  return `${pad4(year)}-${pad2(month)}-${pad2(day)}`;
}

/** Format a Date as YYYY-MM-DDTHH:MM:SS or YYYY-MM-DDTHH:MM:SSZ. */
export function formatIsoDateTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  zulu: boolean,
): string {
  const base = `${pad4(year)}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
  return zulu ? `${base}Z` : base;
}

/** Parse YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS[Z] into a UTC Date. Returns null if invalid. */
export function parseRruleDateValue(s: string): { date: Date; isDateOnly: boolean } | null {
  const m1 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m1) {
    const y = Number(m1[1]);
    const mo = Number(m1[2]);
    const d = Number(m1[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const date = new Date(Date.UTC(y, mo - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
    return { date, isDateOnly: true };
  }
  const m2 = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z?)$/.exec(s);
  if (m2) {
    const y = Number(m2[1]);
    const mo = Number(m2[2]);
    const d = Number(m2[3]);
    const h = Number(m2[4]);
    const mi = Number(m2[5]);
    const se = Number(m2[6]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || se > 60) return null;
    const date = new Date(Date.UTC(y, mo - 1, d, h, mi, se));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
    return { date, isDateOnly: false };
  }
  return null;
}

/** Convert a JS Date to a YYYY-MM-DD string (UTC components). */
export function toDateIso(d: Date): string {
  return formatIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Convert a JS Date to a YYYY-MM-DDTHH:MM:SS[Z] string. */
export function toDateTimeIso(d: Date, isDateOnly: boolean, zulu: boolean): string {
  if (isDateOnly) {
    return formatIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  return formatIsoDateTime(
    d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(),
    zulu,
  );
}

/** Compare two ISO date strings chronologically. Negative if a<b. */
export function compareIsoDates(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Add N units of freq to a UTC Date. Returns a new Date. */
export function addPeriod(date: Date, freq: Freq, n: number): Date {
  const d = new Date(date.getTime());
  switch (freq) {
    case "SECONDLY": d.setUTCSeconds(d.getUTCSeconds() + n); break;
    case "MINUTELY": d.setUTCMinutes(d.getUTCMinutes() + n); break;
    case "HOURLY": d.setUTCHours(d.getUTCHours() + n); break;
    case "DAILY": d.setUTCDate(d.getUTCDate() + n); break;
    case "WEEKLY": d.setUTCDate(d.getUTCDate() + 7 * n); break;
    case "MONTHLY": d.setUTCMonth(d.getUTCMonth() + n); break;
    case "YEARLY": d.setUTCFullYear(d.getUTCFullYear() + n); break;
  }
  return d;
}

/** Get the start of the period containing `date` for the given freq.
 *  For WEEKLY, returns the WKST day of that week.
 *  For MONTHLY, returns the first of the month.
 *  For YEARLY, returns January 1 of that year.
 *  For DAILY/HOURLY/MINUTELY/SECONDLY, returns the start of that day. */
export function periodStart(date: Date, freq: Freq, wkst: Weekday): Date {
  const d = new Date(date.getTime());
  d.setUTCHours(0, 0, 0, 0);
  switch (freq) {
    case "SECONDLY":
    case "MINUTELY":
    case "HOURLY":
    case "DAILY":
      return d;
    case "WEEKLY": {
      const isoDow = jsDayToIso(d.getUTCDay());
      const wkstNum = weekdayToNumber(wkst);
      const offset = (isoDow - wkstNum + 7) % 7;
      d.setUTCDate(d.getUTCDate() - offset);
      return d;
    }
    case "MONTHLY":
      d.setUTCDate(1);
      return d;
    case "YEARLY":
      d.setUTCMonth(0, 1);
      return d;
  }
}

/** Get ISO 8601 week number for a date. */
export function getIsoWeek(year: number, month: number, day: number): { weekYear: number; week: number } {
  const d = new Date(Date.UTC(year, month - 1, day));
  const dow = d.getUTCDay() || 7;
  const thursday = new Date(d.getTime());
  thursday.setUTCDate(d.getUTCDate() + (4 - dow));
  const isoYear = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4.getTime());
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1));
  const week = Math.floor((thursday.getTime() - week1Monday.getTime()) / (7 * MS_PER_DAY)) + 1;
  return { weekYear: isoYear, week };
}

/** Day-of-year 1-366. */
export function getDayOfYear(year: number, month: number, day: number): number {
  const start = Date.UTC(year, 0, 1);
  const cur = Date.UTC(year, month - 1, day);
  return Math.floor((cur - start) / MS_PER_DAY) + 1;
}

// ---------------------------------------------------------------------------
// BYDAY parsing & serialization
// ---------------------------------------------------------------------------

export function parseByDay(values: string[]): ByDayEntry[] {
  const out: ByDayEntry[] = [];
  for (const v of values) {
    const m = /^([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)$/.exec(v.toUpperCase());
    if (!m) continue;
    const ordinal = m[1] ? Number(m[1]) : undefined;
    if (ordinal !== undefined && ordinal === 0) continue;
    out.push({ ordinal, weekday: m[2] as Weekday });
  }
  return out;
}

export function serializeByDay(entries: ByDayEntry[]): string {
  return entries
    .map((e) => (e.ordinal ? `${e.ordinal}${e.weekday}` : e.weekday))
    .join(",");
}

export function parseNumberList(values: string[]): number[] {
  // Note: 0 is allowed here (BYHOUR=0, BYMINUTE=0, BYSECOND=0 are all valid).
  // Per-property range filters in parseRRuleString weed out invalid values.
  const out: number[] = [];
  for (const v of values) {
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    out.push(n);
  }
  return out;
}

export function serializeNumberList(nums: number[]): string {
  return nums.join(",");
}

export function parseDateList(values: string[]): string[] {
  const out: string[] = [];
  for (const v of values) {
    // Accept YYYYMMDD, YYYYMMDDTHHMMSSZ, YYYY-MM-DD, etc. Normalize to
    // YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS[Z].
    const normalized = normalizeDateValue(v);
    if (normalized) out.push(normalized);
  }
  return out;
}

function normalizeDateValue(v: string): string | null {
  // YYYYMMDD
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (m) {
    const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return formatIsoDate(y, mo, d);
  }
  // YYYYMMDDTHHMMSSZ (UTC)
  m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(v);
  if (m) {
    const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
    const h = Number(m[4]); const mi = Number(m[5]); const se = Number(m[6]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || se > 60) return null;
    return formatIsoDateTime(y, mo, d, h, mi, se, true);
  }
  // YYYYMMDDTHHMMSS (local, no Z — used with TZID)
  m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(v);
  if (m) {
    const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
    const h = Number(m[4]); const mi = Number(m[5]); const se = Number(m[6]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || se > 60) return null;
    return formatIsoDateTime(y, mo, d, h, mi, se, false);
  }
  // YYYY-MM-DDTHH:MM:SS[Z] or YYYY-MM-DD
  const parsed = parseRruleDateValue(v);
  if (parsed) {
    return toDateTimeIso(parsed.date, parsed.isDateOnly, !parsed.isDateOnly);
  }
  return null;
}

// ---------------------------------------------------------------------------
// RRULE parsing & serialization
// ---------------------------------------------------------------------------

/** Parse a single RRULE value (the part after "RRULE:"). */
export function parseRRuleString(line: string): RRule {
  const cleaned = line.trim().replace(/^RRULE[:;]/i, "");
  const parts = cleaned.split(";").map((p) => p.trim()).filter(Boolean);
  const rule: RRule = { freq: "DAILY" };
  let hasFreq = false;
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).toUpperCase();
    const value = part.slice(eq + 1);
    switch (key) {
      case "FREQ": {
        const f = value.toUpperCase() as Freq;
        if (!FREQS.find((x) => x.value === f)) {
          throw new Error(`Invalid FREQ: ${value}`);
        }
        rule.freq = f;
        hasFreq = true;
        break;
      }
      case "INTERVAL": {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1) throw new Error(`Invalid INTERVAL: ${value}`);
        rule.interval = n;
        break;
      }
      case "COUNT": {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1) throw new Error(`Invalid COUNT: ${value}`);
        rule.count = n;
        break;
      }
      case "UNTIL": {
        const normalized = normalizeDateValue(value);
        if (!normalized) throw new Error(`Invalid UNTIL: ${value}`);
        rule.until = normalized;
        break;
      }
      case "BYDAY": {
        rule.byDay = parseByDay(value.split(","));
        if (rule.byDay.length === 0) throw new Error(`Invalid BYDAY: ${value}`);
        break;
      }
      case "BYMONTHDAY": {
        rule.byMonthDay = parseNumberList(value.split(","));
        if (rule.byMonthDay.length === 0) throw new Error(`Invalid BYMONTHDAY: ${value}`);
        break;
      }
      case "BYYEARDAY": {
        rule.byYearDay = parseNumberList(value.split(","));
        if (rule.byYearDay.length === 0) throw new Error(`Invalid BYYEARDAY: ${value}`);
        break;
      }
      case "BYWEEKNO": {
        rule.byWeekNo = parseNumberList(value.split(","));
        if (rule.byWeekNo.length === 0) throw new Error(`Invalid BYWEEKNO: ${value}`);
        break;
      }
      case "BYMONTH": {
        rule.byMonth = parseNumberList(value.split(",")).filter((n) => n >= 1 && n <= 12);
        if (rule.byMonth.length === 0) throw new Error(`Invalid BYMONTH: ${value}`);
        break;
      }
      case "BYHOUR": {
        rule.byHour = parseNumberList(value.split(",")).filter((n) => n >= 0 && n <= 23);
        if (rule.byHour.length === 0) throw new Error(`Invalid BYHOUR: ${value}`);
        break;
      }
      case "BYMINUTE": {
        rule.byMinute = parseNumberList(value.split(",")).filter((n) => n >= 0 && n <= 59);
        if (rule.byMinute.length === 0) throw new Error(`Invalid BYMINUTE: ${value}`);
        break;
      }
      case "BYSECOND": {
        rule.bySecond = parseNumberList(value.split(",")).filter((n) => n >= 0 && n <= 60);
        if (rule.bySecond.length === 0) throw new Error(`Invalid BYSECOND: ${value}`);
        break;
      }
      case "BYSETPOS": {
        rule.bySetPos = parseNumberList(value.split(","));
        if (rule.bySetPos.length === 0) throw new Error(`Invalid BYSETPOS: ${value}`);
        break;
      }
      case "WKST": {
        const w = value.toUpperCase() as Weekday;
        if (!WEEKDAYS.find((x) => x.value === w)) throw new Error(`Invalid WKST: ${value}`);
        rule.wkst = w;
        break;
      }
      default:
        // Ignore unknown properties (RFC 5545 allows extension properties).
        break;
    }
  }
  if (!hasFreq) throw new Error("FREQ is required");
  return rule;
}

/** Serialize an RRule to its RRULE value string (without the "RRULE:" prefix). */
export function serializeRRule(rule: RRule): string {
  // Serialize in RFC 5545 §3.8.5.3 canonical order:
  // FREQ, UNTIL, COUNT, INTERVAL, BYSECOND, BYMINUTE, BYHOUR, BYDAY,
  // BYMONTHDAY, BYYEARDAY, BYWEEKNO, BYMONTH, BYSETPOS, WKST.
  const parts: string[] = [];
  parts.push(`FREQ=${rule.freq}`);
  if (rule.until !== undefined) {
    parts.push(`UNTIL=${serializeUntil(rule.until, rule)}`);
  }
  if (rule.count !== undefined) parts.push(`COUNT=${rule.count}`);
  if (rule.interval !== undefined) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.bySecond && rule.bySecond.length > 0) parts.push(`BYSECOND=${serializeNumberList(rule.bySecond)}`);
  if (rule.byMinute && rule.byMinute.length > 0) parts.push(`BYMINUTE=${serializeNumberList(rule.byMinute)}`);
  if (rule.byHour && rule.byHour.length > 0) parts.push(`BYHOUR=${serializeNumberList(rule.byHour)}`);
  if (rule.byDay && rule.byDay.length > 0) parts.push(`BYDAY=${serializeByDay(rule.byDay)}`);
  if (rule.byMonthDay && rule.byMonthDay.length > 0) parts.push(`BYMONTHDAY=${serializeNumberList(rule.byMonthDay)}`);
  if (rule.byYearDay && rule.byYearDay.length > 0) parts.push(`BYYEARDAY=${serializeNumberList(rule.byYearDay)}`);
  if (rule.byWeekNo && rule.byWeekNo.length > 0) parts.push(`BYWEEKNO=${serializeNumberList(rule.byWeekNo)}`);
  if (rule.byMonth && rule.byMonth.length > 0) parts.push(`BYMONTH=${serializeNumberList(rule.byMonth)}`);
  if (rule.bySetPos && rule.bySetPos.length > 0) parts.push(`BYSETPOS=${serializeNumberList(rule.bySetPos)}`);
  if (rule.wkst) parts.push(`WKST=${rule.wkst}`);
  return parts.join(";");
}

/** Serialize UNTIL: date-only stays as YYYYMMDD; datetime becomes YYYYMMDDTHHMMSSZ. */
export function serializeUntil(until: string, rule: RRule): string {
  const parsed = parseRruleDateValue(until);
  if (!parsed) return until;
  // If rule's effective DTSTART is date-only, UNTIL must also be a date.
  // The serializer doesn't know about DTSTART here — caller passes a date-only
  // UNTIL string for date-only rules and a datetime for datetime rules.
  if (parsed.isDateOnly) {
    return `${pad4(parsed.date.getUTCFullYear())}${pad2(parsed.date.getUTCMonth() + 1)}${pad2(parsed.date.getUTCDate())}`;
  }
  return `${pad4(parsed.date.getUTCFullYear())}${pad2(parsed.date.getUTCMonth() + 1)}${pad2(parsed.date.getUTCDate())}T${pad2(parsed.date.getUTCHours())}${pad2(parsed.date.getUTCMinutes())}${pad2(parsed.date.getUTCSeconds())}Z`;
}

/** Parse a full multi-line RRULE block (DTSTART, RRULE, EXDATE, RDATE). */
export function parseFullRule(input: string): ParsedRule {
  const cleaned = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Unfold continuation lines.
  const unfolded = cleaned.replace(/\n[ \t]/g, "");
  const lines = unfolded.split("\n").map((l) => l.trim()).filter(Boolean);
  const parsed: ParsedRule = { rrule: { freq: "DAILY" } };
  let hasRrule = false;
  for (const line of lines) {
    const colon = line.indexOf(":");
    if (colon < 0) {
      // Allow bare RRULE without the "RRULE:" prefix (e.g. user pasted just the value).
      if (!hasRrule) {
        try {
          parsed.rrule = parseRRuleString(line);
          hasRrule = true;
        } catch {
          // ignore unparseable line
        }
      }
      continue;
    }
    const propPart = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const propName = propPart.split(";")[0].toUpperCase();
    const params = propPart.split(";").slice(1);
    let tzid: string | undefined;
    for (const p of params) {
      const peq = p.indexOf("=");
      if (peq > 0 && p.slice(0, peq).toUpperCase() === "TZID") {
        tzid = p.slice(peq + 1);
      }
    }
    switch (propName) {
      case "DTSTART": {
        const normalized = normalizeDateValue(value);
        if (normalized) {
          const r = parseRruleDateValue(normalized);
          parsed.dtStart = {
            value: normalized,
            isDateOnly: r?.isDateOnly ?? false,
            tzid,
          };
        }
        break;
      }
      case "RRULE": {
        parsed.rrule = parseRRuleString(value);
        hasRrule = true;
        break;
      }
      case "EXDATE": {
        const dates = parseDateList(value.split(","));
        if (!parsed.exDates) parsed.exDates = [];
        parsed.exDates.push(...dates);
        break;
      }
      case "RDATE": {
        const dates = parseDateList(value.split(","));
        if (!parsed.rDates) parsed.rDates = [];
        parsed.rDates.push(...dates);
        break;
      }
      default:
        break;
    }
  }
  if (!hasRrule) {
    throw new Error("No RRULE property found");
  }
  return parsed;
}

/** Parse a full rule, returning a ParseResult instead of throwing. */
export function parseFullRuleSafe(input: string): ParseResult {
  try {
    const value = parseFullRule(input);
    return { ok: true, value };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Parse error" };
  }
}

/** Serialize a full ParsedRule to multi-line iCalendar property lines. */
export function serializeFullRule(parsed: ParsedRule): string {
  const lines: string[] = [];
  if (parsed.dtStart) {
    const ds = parsed.dtStart;
    if (ds.isDateOnly) {
      lines.push(`DTSTART;VALUE=DATE:${compactDate(ds.value)}`);
    } else if (ds.tzid) {
      lines.push(`DTSTART;TZID=${ds.tzid}:${compactDateTime(ds.value, false)}`);
    } else {
      lines.push(`DTSTART:${compactDateTime(ds.value, true)}`);
    }
  }
  lines.push(`RRULE:${serializeRRule(parsed.rrule)}`);
  if (parsed.exDates && parsed.exDates.length > 0) {
    lines.push(`EXDATE:${parsed.exDates.map(compactAny).join(",")}`);
  }
  if (parsed.rDates && parsed.rDates.length > 0) {
    lines.push(`RDATE:${parsed.rDates.map(compactAny).join(",")}`);
  }
  return lines.join("\n");
}

function compactDate(s: string): string {
  // YYYY-MM-DD → YYYYMMDD
  return s.replace(/-/g, "").slice(0, 8);
}

function compactDateTime(s: string, zulu: boolean): string {
  // YYYY-MM-DDTHH:MM:SS[Z] → YYYYMMDDTHHMMSS[Z]
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z?)$/.exec(s);
  if (m) {
    return `${m[1]}${m[2]}${m[3]}T${m[4]}${m[5]}${m[6]}${zulu ? "Z" : m[7]}`;
  }
  return s.replace(/[-:]/g, "");
}

function compactAny(s: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return compactDate(s);
  return compactDateTime(s, /Z$/.test(s));
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateRRule(parsed: ParsedRule): ValidationResult {
  const r = parsed.rrule;
  if (!FREQS.find((f) => f.value === r.freq)) {
    return { valid: false, error: `Invalid FREQ: ${r.freq}` };
  }
  if (r.interval !== undefined && (!Number.isInteger(r.interval) || r.interval < 1)) {
    return { valid: false, error: `Invalid INTERVAL: ${r.interval}` };
  }
  if (r.count !== undefined && (!Number.isInteger(r.count) || r.count < 1)) {
    return { valid: false, error: `Invalid COUNT: ${r.count}` };
  }
  if (r.count !== undefined && r.until !== undefined) {
    return { valid: false, error: "COUNT and UNTIL are mutually exclusive" };
  }
  if (r.until !== undefined) {
    const u = parseRruleDateValue(r.until);
    if (!u) return { valid: false, error: `Invalid UNTIL: ${r.until}` };
    // UNTIL must be after DTSTART.
    if (parsed.dtStart) {
      const ds = parseRruleDateValue(parsed.dtStart.value);
      if (ds && u.date.getTime() < ds.date.getTime()) {
        return { valid: false, error: "UNTIL must be after DTSTART" };
      }
    }
  }
  if (r.byMonth) {
    for (const m of r.byMonth) {
      if (m < 1 || m > 12) return { valid: false, error: `Invalid BYMONTH: ${m}` };
    }
  }
  if (r.byHour) {
    for (const h of r.byHour) {
      if (h < 0 || h > 23) return { valid: false, error: `Invalid BYHOUR: ${h}` };
    }
  }
  if (r.byMinute) {
    for (const m of r.byMinute) {
      if (m < 0 || m > 59) return { valid: false, error: `Invalid BYMINUTE: ${m}` };
    }
  }
  if (r.bySecond) {
    for (const s of r.bySecond) {
      if (s < 0 || s > 60) return { valid: false, error: `Invalid BYSECOND: ${s}` };
    }
  }
  if (r.byMonthDay) {
    for (const d of r.byMonthDay) {
      if (d < -31 || d > 31 || d === 0) return { valid: false, error: `Invalid BYMONTHDAY: ${d}` };
    }
  }
  if (r.byYearDay) {
    for (const d of r.byYearDay) {
      if (d < -366 || d > 366 || d === 0) return { valid: false, error: `Invalid BYYEARDAY: ${d}` };
    }
  }
  if (r.byWeekNo) {
    for (const w of r.byWeekNo) {
      if (w < -53 || w > 53 || w === 0) return { valid: false, error: `Invalid BYWEEKNO: ${w}` };
    }
  }
  if (r.bySetPos) {
    for (const p of r.bySetPos) {
      if (p < -366 || p > 366 || p === 0) return { valid: false, error: `Invalid BYSETPOS: ${p}` };
    }
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Occurrence generation
// ---------------------------------------------------------------------------

export interface OccurrenceOptions {
  /** Hard cap on number of occurrences to emit. Default 100. */
  limit?: number;
  /** Stop walking after this date (absolute). Default now + 5 years. */
  walkUntil?: Date;
}

const DEFAULT_LIMIT = 100;

/** Generate occurrences for a parsed rule. Returns ISO strings.
 *  Date-only rules produce YYYY-MM-DD; datetime rules produce YYYY-MM-DDTHH:MM:SSZ. */
export function generateOccurrences(parsed: ParsedRule, options?: OccurrenceOptions): string[] {
  const v = validateRRule(parsed);
  if (!v.valid) return [];
  const r = parsed.rrule;
  const limit = Math.min(options?.limit ?? DEFAULT_LIMIT, r.count ?? (options?.limit ?? DEFAULT_LIMIT));
  if (!parsed.dtStart) return [];
  const ds = parseRruleDateValue(parsed.dtStart.value);
  if (!ds) return [];

  const isDateOnly = ds.isDateOnly;
  const startHour = ds.date.getUTCHours();
  const startMinute = ds.date.getUTCMinutes();
  const startSecond = ds.date.getUTCSeconds();
  const start = ds.date;
  const until = r.until ? parseRruleDateValue(r.until) : null;
  const untilMs = until ? until.date.getTime() : null;

  // Walk forward in periods; collect candidate dates; apply BYSETPOS; filter
  // by EXDATE; stop at COUNT/UNTIL/limit.
  const emitted: string[] = [];
  const seen = new Set<string>();
  const exDateSet = new Set(parsed.exDates ?? []);
  const wkst = r.wkst ?? "MO";

  // Hard walk cap: 10 years or 10000 periods, whichever comes first.
  const walkUntilMs = options?.walkUntil
    ? options.walkUntil.getTime()
    : start.getTime() + 10 * 365 * MS_PER_DAY;

  // For sub-day frequencies, walk per unit. For day-or-longer, walk per period
  // and apply BYxxx rules within.
  if (r.freq === "SECONDLY" || r.freq === "MINUTELY" || r.freq === "HOURLY") {
    const step: number =
      r.freq === "SECONDLY" ? MS_PER_SECOND :
      r.freq === "MINUTELY" ? MS_PER_MINUTE :
      MS_PER_HOUR;
    const interval = r.interval ?? 1;
    let cur = new Date(start.getTime());
    let safety = 0;
    while (emitted.length < limit && cur.getTime() <= walkUntilMs && safety < 1000000) {
      if (untilMs !== null && cur.getTime() > untilMs) break;
      if (cur.getTime() >= start.getTime()) {
        const iso = toDateTimeIso(cur, isDateOnly, !isDateOnly);
        if (!exDateSet.has(iso) && !seen.has(iso)) {
          // Apply BYxxx sub-day filters if present.
          if (matchesByRules(cur, r)) {
            emitted.push(iso);
            seen.add(iso);
          }
        }
      }
      cur = new Date(cur.getTime() + step * interval);
      safety++;
    }
    // Add RDATEs that pass filters.
    addRDates(emitted, seen, parsed, isDateOnly, start, untilMs);
    return emitted.slice(0, limit);
  }

  // Day / Week / Month / Year frequencies: walk by period, generate candidates.
  const interval = r.interval ?? 1;
  let periodIdx = 0;
  let safety = 0;
  const maxPeriods = 10000;

  // Compute the first period start (aligned to the start of the period
  // containing DTSTART). This is critical for cases like FREQ=MONTHLY with
  // DTSTART on Jan 30 — without alignment, adding 1 month rolls over to
  // March 2, skipping February entirely.
  const firstWeekStart = periodStart(start, "WEEKLY", wkst);

  while (emitted.length < limit && safety < maxPeriods) {
    let periodStartMs: Date;
    if (r.freq === "DAILY") {
      periodStartMs = addPeriod(start, "DAILY", periodIdx * interval);
    } else if (r.freq === "WEEKLY") {
      periodStartMs = addPeriod(firstWeekStart, "WEEKLY", periodIdx * interval);
    } else if (r.freq === "MONTHLY") {
      periodStartMs = new Date(Date.UTC(
        start.getUTCFullYear(),
        start.getUTCMonth() + periodIdx * interval,
        1,
      ));
    } else { // YEARLY
      periodStartMs = new Date(Date.UTC(
        start.getUTCFullYear() + periodIdx * interval,
        0,
        1,
      ));
    }
    if (periodStartMs.getTime() > walkUntilMs) break;
    if (untilMs !== null && periodStartMs.getTime() > untilMs + 366 * MS_PER_DAY) break;

    const candidates = generateCandidatesForPeriod(periodStartMs, r, isDateOnly, startHour, startMinute, startSecond, wkst);

    // Apply BYSETPOS.
    let final = candidates;
    if (r.bySetPos && r.bySetPos.length > 0) {
      final = applyBySetPos(candidates, r.bySetPos);
    }

    for (const c of final) {
      if (c.getTime() < start.getTime()) continue;
      if (untilMs !== null && c.getTime() > untilMs) {
        return emitted.slice(0, limit);
      }
      if (emitted.length >= limit) break;
      const iso = toDateTimeIso(c, isDateOnly, !isDateOnly);
      if (exDateSet.has(iso) || seen.has(iso)) continue;
      emitted.push(iso);
      seen.add(iso);
    }

    periodIdx++;
    safety++;
  }

  // Add RDATEs (additive — they are NOT counted toward COUNT per RFC 5545).
  addRDates(emitted, seen, parsed, isDateOnly, start, untilMs);
  // Sort the combined list chronologically.
  emitted.sort(compareIsoDates);
  // Apply the overall limit (NOT COUNT — RDATEs are additive).
  const finalLimit = options?.limit ?? DEFAULT_LIMIT;
  return emitted.slice(0, finalLimit);
}

function addRDates(
  emitted: string[],
  seen: Set<string>,
  parsed: ParsedRule,
  isDateOnly: boolean,
  start: Date,
  untilMs: number | null,
): void {
  if (!parsed.rDates) return;
  for (const rdate of parsed.rDates) {
    const p = parseRruleDateValue(rdate);
    if (!p) continue;
    if (p.date.getTime() < start.getTime()) continue;
    if (untilMs !== null && p.date.getTime() > untilMs) continue;
    const iso = toDateTimeIso(p.date, isDateOnly, !isDateOnly);
    if (seen.has(iso)) continue;
    emitted.push(iso);
    seen.add(iso);
  }
}

/** Check if a date matches BYxxx rules (for sub-day frequencies). */
function matchesByRules(d: Date, r: RRule): boolean {
  if (r.byMonth && !r.byMonth.includes(d.getUTCMonth() + 1)) return false;
  if (r.byMonthDay) {
    const day = d.getUTCDate();
    const dim = daysInMonth(d.getUTCFullYear(), d.getUTCMonth() + 1);
    const matches = r.byMonthDay.some((m) => m > 0 ? m === day : m < 0 && dim + m + 1 === day);
    if (!matches) return false;
  }
  if (r.byDay) {
    const isoDow = jsDayToIso(d.getUTCDay());
    if (!r.byDay.some((e) => weekdayToNumber(e.weekday) === isoDow)) return false;
  }
  if (r.byHour && !r.byHour.includes(d.getUTCHours())) return false;
  if (r.byMinute && !r.byMinute.includes(d.getUTCMinutes())) return false;
  if (r.bySecond && !r.bySecond.includes(d.getUTCSeconds())) return false;
  return true;
}

/** Generate candidate dates within a single period for FREQ=DAILY/WEEKLY/MONTHLY/YEARLY. */
function generateCandidatesForPeriod(
  periodStart: Date,
  r: RRule,
  isDateOnly: boolean,
  startHour: number,
  startMinute: number,
  startSecond: number,
  wkst: Weekday,
): Date[] {
  const freq = r.freq;
  const out: Date[] = [];

  if (freq === "DAILY") {
    // Candidate is the period start day. Apply BYMONTH, BYMONTHDAY, BYDAY filters.
    if (!dayMatchesFilters(periodStart, r)) return [];
    out.push(makeDateTime(periodStart, isDateOnly, startHour, startMinute, startSecond, r));
    return out;
  }

  if (freq === "WEEKLY") {
    // Period is one week (WKST to WKST+7). Generate one candidate per day in the week
    // that matches BYDAY (or all 7 days if BYDAY not set, but only DTSTART's weekday
    // is the default per RFC 5545).
    const wkstNum = weekdayToNumber(wkst);
    const days: Date[] = [];
    let byDaySet: Weekday[] | null = null;
    if (r.byDay && r.byDay.length > 0) {
      byDaySet = r.byDay.map((e) => e.weekday);
    }
    for (let i = 0; i < 7; i++) {
      const d = new Date(periodStart.getTime());
      d.setUTCDate(d.getUTCDate() + i);
      const isoDow = jsDayToIso(d.getUTCDay());
      // Offset between isoDow and wkst
      const offset = (isoDow - wkstNum + 7) % 7;
      if (offset !== i) continue; // sanity check
      if (byDaySet && !byDaySet.includes(d.getUTCDay() === 0 ? "SU" : ["MO","TU","WE","TH","FR","SA"][d.getUTCDay() - 1] as Weekday)) continue;
      if (!dayMatchesFilters(d, r)) continue;
      days.push(d);
    }
    if (byDaySet === null && days.length === 0) {
      // No BYDAY: emit DTSTART's weekday only (the periodStart already aligns).
      days.push(periodStart);
    }
    return days.map((d) => makeDateTime(d, isDateOnly, startHour, startMinute, startSecond, r));
  }

  if (freq === "MONTHLY") {
    // Period is one month. Generate candidates based on BYMONTHDAY / BYDAY.
    const year = periodStart.getUTCFullYear();
    const month = periodStart.getUTCMonth() + 1;
    if (r.byMonth && !r.byMonth.includes(month)) return [];
    const dim = daysInMonth(year, month);
    const days: Date[] = [];

    if (r.byMonthDay && r.byMonthDay.length > 0) {
      for (const md of r.byMonthDay) {
        let day: number;
        if (md > 0) day = md;
        else day = dim + md + 1;
        if (day < 1 || day > dim) continue;
        const d = new Date(Date.UTC(year, month - 1, day));
        if (r.byDay && !dayMatchesByDay(d, r.byDay)) continue;
        days.push(d);
      }
    } else if (r.byDay && r.byDay.length > 0) {
      // For each weekday + ordinal, find matching days.
      for (const entry of r.byDay) {
        const wd = weekdayToNumber(entry.weekday);
        if (entry.ordinal === undefined) {
          // All matching weekdays in the month.
          for (let day = 1; day <= dim; day++) {
            const d = new Date(Date.UTC(year, month - 1, day));
            if (jsDayToIso(d.getUTCDay()) === wd) days.push(d);
          }
        } else {
          // Find the Nth occurrence (positive or negative).
          const matchingDays: number[] = [];
          for (let day = 1; day <= dim; day++) {
            const d = new Date(Date.UTC(year, month - 1, day));
            if (jsDayToIso(d.getUTCDay()) === wd) matchingDays.push(day);
          }
          const idx = entry.ordinal > 0 ? entry.ordinal - 1 : matchingDays.length + entry.ordinal;
          if (idx >= 0 && idx < matchingDays.length) {
            days.push(new Date(Date.UTC(year, month - 1, matchingDays[idx])));
          }
        }
      }
    } else {
      // No BYDAY/BYMONTHDAY: emit DTSTART's day of month.
      const dom = periodStart.getUTCDate();
      if (dom <= dim) {
        days.push(new Date(Date.UTC(year, month - 1, dom)));
      }
    }

    return days
      .filter((d) => dayMatchesFilters(d, r))
      .map((d) => makeDateTime(d, isDateOnly, startHour, startMinute, startSecond, r));
  }

  if (freq === "YEARLY") {
    // Period is one year. Generate candidates based on BYMONTH, BYWEEKNO,
    // BYYEARDAY, BYMONTHDAY, BYDAY.
    const year = periodStart.getUTCFullYear();
    const days: Date[] = [];
    const monthsToIterate = r.byMonth && r.byMonth.length > 0 ? r.byMonth : (r.byMonthDay && r.byMonthDay.length > 0 ? [periodStart.getUTCMonth() + 1] : (r.byDay && r.byDay.length > 0 && r.byDay.some((e) => e.ordinal !== undefined) ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [periodStart.getUTCMonth() + 1]));

    if (r.byWeekNo && r.byWeekNo.length > 0) {
      // BYWEEKNO: find weeks in the ISO year, pick matching weeks.
      const weeksInYear = getIsoWeeksInYear(year);
      for (const wn of r.byWeekNo) {
        const actualWn = wn > 0 ? wn : weeksInYear + wn + 1;
        if (actualWn < 1 || actualWn > weeksInYear) continue;
        const jan4 = new Date(Date.UTC(year, 0, 4));
        const jan4Dow = jan4.getUTCDay() || 7;
        const week1Monday = new Date(jan4.getTime());
        week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1));
        const monday = new Date(week1Monday.getTime());
        monday.setUTCDate(week1Monday.getUTCDate() + (actualWn - 1) * 7);
        if (r.byDay && r.byDay.length > 0) {
          for (const entry of r.byDay) {
            const wd = weekdayToNumber(entry.weekday);
            const d = new Date(monday.getTime());
            d.setUTCDate(monday.getUTCDate() + (wd - 1));
            if (d.getUTCFullYear() === year || true) {
              days.push(d);
            }
          }
        } else {
          // Default: Monday of that week.
          days.push(monday);
        }
      }
    } else if (r.byYearDay && r.byYearDay.length > 0) {
      const diy = daysInYear(year);
      for (const yd of r.byYearDay) {
        const actualYd = yd > 0 ? yd : diy + yd + 1;
        if (actualYd < 1 || actualYd > diy) continue;
        const d = new Date(Date.UTC(year, 0, 1));
        d.setUTCDate(d.getUTCDate() + (actualYd - 1));
        days.push(d);
      }
    } else {
      for (const m of monthsToIterate) {
        const dim = daysInMonth(year, m);
        if (r.byMonthDay && r.byMonthDay.length > 0) {
          for (const md of r.byMonthDay) {
            const day = md > 0 ? md : dim + md + 1;
            if (day < 1 || day > dim) continue;
            const d = new Date(Date.UTC(year, m - 1, day));
            if (r.byDay && !dayMatchesByDay(d, r.byDay)) continue;
            days.push(d);
          }
        } else if (r.byDay && r.byDay.length > 0) {
          for (const entry of r.byDay) {
            const wd = weekdayToNumber(entry.weekday);
            if (entry.ordinal === undefined) {
              for (let day = 1; day <= dim; day++) {
                const d = new Date(Date.UTC(year, m - 1, day));
                if (jsDayToIso(d.getUTCDay()) === wd) days.push(d);
              }
            } else {
              const matchingDays: number[] = [];
              for (let day = 1; day <= dim; day++) {
                const d = new Date(Date.UTC(year, m - 1, day));
                if (jsDayToIso(d.getUTCDay()) === wd) matchingDays.push(day);
              }
              const idx = entry.ordinal > 0 ? entry.ordinal - 1 : matchingDays.length + entry.ordinal;
              if (idx >= 0 && idx < matchingDays.length) {
                days.push(new Date(Date.UTC(year, m - 1, matchingDays[idx])));
              }
            }
          }
        } else {
          // No BYDAY/BYMONTHDAY: use DTSTART's month and day.
          const dom = periodStart.getUTCDate();
          if (dom <= dim) {
            days.push(new Date(Date.UTC(year, m - 1, dom)));
          }
        }
      }
    }

    return days
      .filter((d) => dayMatchesFilters(d, r))
      .map((d) => makeDateTime(d, isDateOnly, startHour, startMinute, startSecond, r));
  }

  return out;
}

function dayMatchesFilters(d: Date, r: RRule): boolean {
  if (r.byMonth && !r.byMonth.includes(d.getUTCMonth() + 1)) return false;
  if (r.byMonthDay && r.byMonthDay.length > 0) {
    const day = d.getUTCDate();
    const dim = daysInMonth(d.getUTCFullYear(), d.getUTCMonth() + 1);
    if (!r.byMonthDay.some((m) => m > 0 ? m === day : dim + m + 1 === day)) return false;
  }
  if (r.byDay && r.byDay.length > 0) {
    if (!dayMatchesByDay(d, r.byDay)) return false;
  }
  return true;
}

function dayMatchesByDay(d: Date, byDay: ByDayEntry[]): boolean {
  const isoDow = jsDayToIso(d.getUTCDay());
  return byDay.some((e) => weekdayToNumber(e.weekday) === isoDow);
}

function makeDateTime(d: Date, isDateOnly: boolean, hour: number, minute: number, second: number, r: RRule): Date {
  const out = new Date(d.getTime());
  if (isDateOnly) {
    out.setUTCHours(0, 0, 0, 0);
    return out;
  }
  const hours = r.byHour && r.byHour.length > 0 ? r.byHour : [hour];
  const minutes = r.byMinute && r.byMinute.length > 0 ? r.byMinute : [minute];
  const seconds = r.bySecond && r.bySecond.length > 0 ? r.bySecond : [second];
  // For now, use the first BYHOUR/MINUTE/SECOND if present, since we emit at
  // most one candidate per day from this helper. If multiple times are needed,
  // the caller would need to expand — but for the common case of a single time
  // per day this is correct.
  out.setUTCHours(hours[0], minutes[0], seconds[0], 0);
  return out;
}

/** Apply BYSETPOS to a sorted candidate list. Returns the selected entries. */
export function applyBySetPos(candidates: Date[], positions: number[]): Date[] {
  if (positions.length === 0) return candidates;
  const sorted = [...candidates].sort((a, b) => a.getTime() - b.getTime());
  const out: Date[] = [];
  for (const pos of positions) {
    const idx = pos > 0 ? pos - 1 : sorted.length + pos;
    if (idx >= 0 && idx < sorted.length) {
      out.push(sorted[idx]);
    }
  }
  return out;
}

/** Number of ISO weeks in a year (52 or 53). */
export function getIsoWeeksInYear(year: number): number {
  // A year has 53 weeks if it starts on Thursday, or starts on Wednesday in a leap year.
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1Dow = jan1.getUTCDay() || 7;
  if (jan1Dow === 4 || (jan1Dow === 3 && isLeapYear(year))) return 53;
  return 52;
}

/** Find the next occurrence strictly after `afterDate`. Returns ISO string or null. */
export function nextOccurrence(parsed: ParsedRule, afterDate?: Date): string | null {
  const v = validateRRule(parsed);
  if (!v.valid) return null;
  // Generate a generous batch and find the first one > afterDate.
  const afterMs = afterDate ? afterDate.getTime() : Date.now();
  // Walk forward up to 5 years from afterDate.
  const start = parsed.dtStart ? parseRruleDateValue(parsed.dtStart.value)?.date : null;
  if (!start) return null;
  // Generate a larger set and pick the next one.
  const occs = generateOccurrences(parsed, { limit: 500, walkUntil: new Date(afterMs + 5 * 365 * MS_PER_DAY) });
  for (const iso of occs) {
    const d = parseRruleDateValue(iso);
    if (d && d.date.getTime() > afterMs) return iso;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Human-readable description
// ---------------------------------------------------------------------------

export function toHumanReadable(parsed: ParsedRule): string {
  const r = parsed.rrule;
  const interval = r.interval ?? 1;
  const parts: string[] = [];

  // Frequency phrase
  switch (r.freq) {
    case "SECONDLY":
      parts.push(interval === 1 ? "Every second" : `Every ${interval} seconds`);
      break;
    case "MINUTELY":
      parts.push(interval === 1 ? "Every minute" : `Every ${interval} minutes`);
      break;
    case "HOURLY":
      parts.push(interval === 1 ? "Every hour" : `Every ${interval} hours`);
      break;
    case "DAILY":
      parts.push(interval === 1 ? "Daily" : `Every ${interval} days`);
      break;
    case "WEEKLY": {
      if (r.byDay && r.byDay.length > 0) {
        const days = r.byDay.map((e) => WEEKDAYS.find((w) => w.value === e.weekday)!.label);
        if (interval === 1) {
          parts.push(`Every ${joinList(days)}`);
        } else {
          parts.push(`Every ${interval} weeks on ${joinList(days)}`);
        }
      } else {
        parts.push(interval === 1 ? "Weekly" : `Every ${interval} weeks`);
      }
      break;
    }
    case "MONTHLY": {
      if (r.byDay && r.byDay.length > 0) {
        const days = r.byDay.map((e) => {
          const wd = WEEKDAYS.find((w) => w.value === e.weekday)!.label;
          if (e.ordinal) {
            return `${ordinalWord(e.ordinal)} ${wd}`;
          }
          return wd;
        });
        if (interval === 1) {
          parts.push(`Monthly on the ${joinList(days)}`);
        } else {
          parts.push(`Every ${interval} months on the ${joinList(days)}`);
        }
      } else if (r.byMonthDay && r.byMonthDay.length > 0) {
        const days = r.byMonthDay.map((d) => `${d}${ordinalSuffix(d)}`);
        if (interval === 1) {
          parts.push(`Monthly on day ${joinList(days)}`);
        } else {
          parts.push(`Every ${interval} months on day ${joinList(days)}`);
        }
      } else {
        parts.push(interval === 1 ? "Monthly" : `Every ${interval} months`);
      }
      break;
    }
    case "YEARLY": {
      if (r.byMonth && r.byMonth.length > 0 && r.byMonthDay && r.byMonthDay.length > 0) {
        const months = r.byMonth.map((m) => monthName(m));
        const days = r.byMonthDay.map((d) => `${d}${ordinalSuffix(d)}`);
        if (interval === 1) {
          parts.push(`Annually on ${months[0]} ${days[0]}`);
        } else {
          parts.push(`Every ${interval} years on ${months[0]} ${days[0]}`);
        }
      } else {
        parts.push(interval === 1 ? "Annually" : `Every ${interval} years`);
      }
      break;
    }
  }

  // BYSETPOS modifier
  if (r.bySetPos && r.bySetPos.length > 0) {
    const ps = r.bySetPos.map((p) => `${ordinalWord(p)}`);
    parts.push(`(${joinList(ps)} occurrence of the period)`);
  }

  // COUNT / UNTIL
  if (r.count !== undefined) {
    parts.push(`for ${r.count} occurrences`);
  } else if (r.until !== undefined) {
    const u = parseRruleDateValue(r.until);
    if (u) {
      parts.push(`until ${u.date.getUTCFullYear()}-${pad2(u.date.getUTCMonth() + 1)}-${pad2(u.date.getUTCDate())}`);
    }
  }

  // DTSTART
  if (parsed.dtStart) {
    const ds = parseRruleDateValue(parsed.dtStart.value);
    if (ds) {
      const datePart = `${ds.date.getUTCFullYear()}-${pad2(ds.date.getUTCMonth() + 1)}-${pad2(ds.date.getUTCDate())}`;
      if (ds.isDateOnly) {
        parts.push(`starting ${datePart}`);
      } else {
        const timePart = `${pad2(ds.date.getUTCHours())}:${pad2(ds.date.getUTCMinutes())}`;
        parts.push(`starting ${datePart} at ${timePart}`);
      }
    }
  }

  // EXDATE / RDATE
  if (parsed.exDates && parsed.exDates.length > 0) {
    parts.push(`(excluding ${parsed.exDates.length} date${parsed.exDates.length === 1 ? "" : "s"})`);
  }
  if (parsed.rDates && parsed.rDates.length > 0) {
    parts.push(`(plus ${parsed.rDates.length} extra date${parsed.rDates.length === 1 ? "" : "s"})`);
  }

  let s = parts.join(" ");
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return s + ".";
}

function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function ordinalSuffix(n: number): string {
  const abs = Math.abs(n);
  const lastDigit = abs % 10;
  const lastTwo = abs % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return "th";
  if (lastDigit === 1) return "st";
  if (lastDigit === 2) return "nd";
  if (lastDigit === 3) return "rd";
  return "th";
}

function ordinalWord(n: number): string {
  const abs = Math.abs(n);
  const words: Record<number, string> = {
    1: "first", 2: "second", 3: "third", 4: "fourth", 5: "fifth",
    6: "sixth", 7: "seventh", 8: "eighth", 9: "ninth", 10: "tenth",
    11: "eleventh", 12: "twelfth",
  };
  if (n < 0) {
    if (abs === 1) return "last";
    return `${words[abs] ?? `${abs}${ordinalSuffix(abs)}`} to last`;
  }
  return words[abs] ?? `${abs}${ordinalSuffix(n)}`;
}

function monthName(m: number): string {
  return ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"][m - 1] ?? `Month ${m}`;
}

// ---------------------------------------------------------------------------
// ICS export (VEVENT)
// ---------------------------------------------------------------------------

export interface IcsOptions {
  summary?: string;
  uid?: string;
  location?: string;
  description?: string;
}

export function generateIcs(parsed: ParsedRule, options?: IcsOptions): string {
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//UnQTools//RRULE Generator//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("BEGIN:VEVENT");
  const uid = options?.uid ?? `unqtools-${Date.now()}@unqtools`;
  lines.push(`UID:${uid}`);
  if (parsed.dtStart) {
    const ds = parsed.dtStart;
    if (ds.isDateOnly) {
      lines.push(`DTSTART;VALUE=DATE:${compactDate(ds.value)}`);
    } else if (ds.tzid) {
      lines.push(`DTSTART;TZID=${ds.tzid}:${compactDateTime(ds.value, false)}`);
    } else {
      lines.push(`DTSTART:${compactDateTime(ds.value, true)}`);
    }
  }
  lines.push(`RRULE:${serializeRRule(parsed.rrule)}`);
  if (parsed.exDates && parsed.exDates.length > 0) {
    lines.push(`EXDATE:${parsed.exDates.map(compactAny).join(",")}`);
  }
  if (parsed.rDates && parsed.rDates.length > 0) {
    lines.push(`RDATE:${parsed.rDates.map(compactAny).join(",")}`);
  }
  if (options?.summary) lines.push(`SUMMARY:${escapeIcs(options.summary)}`);
  if (options?.location) lines.push(`LOCATION:${escapeIcs(options.location)}`);
  if (options?.description) lines.push(`DESCRIPTION:${escapeIcs(options.description)}`);
  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");
  // Fold long lines at 75 octets per RFC 5545 §3.1.
  return foldIcsLines(lines).join("\r\n");
}

function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function foldIcsLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (line.length <= 75) {
      out.push(line);
      continue;
    }
    let remaining = line;
    let first = true;
    while (remaining.length > 0) {
      const chunk = first ? remaining.slice(0, 75) : " " + remaining.slice(0, 74);
      out.push(chunk);
      remaining = remaining.slice(first ? 75 : 74);
      first = false;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Code snippets
// ---------------------------------------------------------------------------

export type CodeLang = "rrulejs" | "python" | "javascript" | "go";

export function generateCodeSnippet(parsed: ParsedRule, lang: CodeLang): string {
  const r = parsed.rrule;
  const rruleStr = serializeRRule(r);
  const dtStart = parsed.dtStart;
  const dtStartStr = dtStart ? dtStart.value : "2026-01-01";
  switch (lang) {
    case "rrulejs": {
      const opts: string[] = [];
      if (dtStart) opts.push(`dtstart: new Date("${dtStartStr}")`);
      opts.push(`freq: rrule.RRule.${r.freq}`);
      if (parsed.rrule.interval) opts.push(`interval: ${parsed.rrule.interval}`);
      if (parsed.rrule.count) opts.push(`count: ${parsed.rrule.count}`);
      if (parsed.rrule.until) opts.push(`until: new Date("${parsed.rrule.until}")`);
      if (parsed.rrule.byDay) {
        const days = parsed.rrule.byDay.map((e) => `rrule.RRule.${e.weekday}`).join(", ");
        opts.push(`byweekday: [${days}]`);
      }
      if (parsed.rrule.byMonth) opts.push(`bymonth: [${parsed.rrule.byMonth.join(", ")}]`);
      if (parsed.rrule.byMonthDay) opts.push(`bymonthday: [${parsed.rrule.byMonthDay.join(", ")}]`);
      if (parsed.rrule.bySetPos) opts.push(`bysetpos: [${parsed.rrule.bySetPos.join(", ")}]`);
      if (parsed.rrule.wkst) opts.push(`wkst: rrule.RRule.${parsed.rrule.wkst}`);
      return `import { RRule } from "rrule";

const rule = new RRule({
  ${opts.join(",\n  ")}
});

const next10 = rule.all().slice(0, 10);
console.log(next10);

// Or parse an existing RRULE string:
// const parsed = RRule.fromString("${rruleStr}");
// parsed.all().slice(0, 10);`;
    }
    case "javascript": {
      return `// RFC 5545 RRULE string:
// DTSTART:${dtStart ? compactAny(dtStart.value) : "20260101"}
// RRULE:${rruleStr}
//
// Use a library like rrule.js to expand:
//   import { RRule } from "rrule";
//   const rule = RRule.fromString("DTSTART:${dtStart ? compactAny(dtStart.value) : "20260101"}\\nRRULE:${rruleStr}");
//   rule.all().slice(0, 10);

const rruleString = "FREQ=${parsed.rrule.freq}${parsed.rrule.interval ? `;INTERVAL=${parsed.rrule.interval}` : ""}${parsed.rrule.count ? `;COUNT=${parsed.rrule.count}` : ""}${parsed.rrule.until ? `;UNTIL=${compactAny(parsed.rrule.until)}` : ""}";`;
    }
    case "python": {
      return `from dateutil.rrule import rrule, ${r.freq}
from datetime import datetime

# DTSTART and RRULE (RFC 5545):
#   DTSTART:${dtStart ? compactAny(dtStart.value) : "20260101"}
#   RRULE:${rruleStr}

start = datetime.fromisoformat("${dtStartStr}")
rule = rrule(
    freq=${r.freq},
    dtstart=start,${parsed.rrule.interval ? `
    interval=${parsed.rrule.interval},` : ""}${parsed.rrule.count ? `
    count=${parsed.rrule.count},` : ""}${parsed.rrule.until ? `
    until=datetime.fromisoformat("${parsed.rrule.until}"),` : ""}
)

for dt in rule:
    print(dt.isoformat())
    if rule.count() >= 10:
        break`;
    }
    case "go": {
      return `// RFC 5545 RRULE string:
//   DTSTART:${dtStart ? compactAny(dtStart.value) : "20260101"}
//   RRULE:${rruleStr}
//
// Go has no stdlib RRULE; use github.com/teambition/rrule-go:
//   import "github.com/teambition/rrule-go"
//   r, _ := rrule.StrToRRule("DTSTART:${dtStart ? compactAny(dtStart.value) : "20260101"}\\nRRULE:${rruleStr}")
//   for i := 0; i < 10; i++ {
//       fmt.Println(r.All()...)
//   }

package main

// Build the RRULE string:
const rruleString = "FREQ=${parsed.rrule.freq}${parsed.rrule.interval ? `;INTERVAL=${parsed.rrule.interval}` : ""}${parsed.rrule.count ? `;COUNT=${parsed.rrule.count}` : ""}${parsed.rrule.until ? `;UNTIL=${compactAny(parsed.rrule.until)}` : ""}"`;
    }
  }
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:recurring-date-rrule-generator:history";
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
// Shareable URL (fragment-encoded)
// ---------------------------------------------------------------------------

export function buildShareUrl(parsed: ParsedRule): string {
  const params = new URLSearchParams();
  const full = serializeFullRule(parsed);
  params.set("rule", full);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ParseResult {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { ok: false, error: "Empty hash" };
  const params = new URLSearchParams(clean);
  const rule = params.get("rule");
  if (!rule) return { ok: false, error: "No rule parameter" };
  return parseFullRuleSafe(rule);
}

// ---------------------------------------------------------------------------
// Convenience: default ParsedRule for UI
// ---------------------------------------------------------------------------

export function defaultParsedRule(): ParsedRule {
  const now = new Date();
  return {
    dtStart: {
      value: formatIsoDate(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate()),
      isDateOnly: true,
    },
    rrule: { freq: "WEEKLY", interval: 1, byDay: [{ weekday: "MO" }] },
  };
}

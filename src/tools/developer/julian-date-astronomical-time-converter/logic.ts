/**
 * Julian Date & Astronomical Time Converter — pure logic.
 *
 * Convert between calendar date/time and astronomical Julian Date (JD),
 * Modified Julian Date (MJD), Reduced / Truncated / Dublin JD, Rata Die,
 * days since J2000.0, and the Unix epoch (s/ms). Supports a separate
 * mainframe ordinal "Julian date" form (YYDDD / YYYYDDD) so the two
 * distinct meanings are never confused.
 *
 * Calendar systems supported:
 *  - Proleptic Gregorian (ISO 8601 default)
 *  - Proleptic Julian (historical, pre-1582)
 *
 * Astronomical year numbering is used: year 0 = 1 BC, year −1 = 2 BC, …
 *
 * Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CalendarSystem = "gregorian" | "julian";

export type Mode = "calendar" | "jd" | "ordinal";

export interface CalendarParts {
  /** Astronomical year (year 0 = 1 BC). */
  year: number;
  /** 1-12. */
  month: number;
  /** 1-31. */
  day: number;
  /** 0-23. */
  hour: number;
  /** 0-59. */
  minute: number;
  /** 0-59 (integer seconds; fractional handled via `fraction`). */
  second: number;
  /** Optional fraction of a second [0,1). */
  fraction?: number;
}

export interface JulianConversion {
  ok: true;
  /** Julian Date (fractional, UT). */
  jd: number;
  /** Modified Julian Date (JD − 2400000.5). */
  mjd: number;
  /** Reduced JD (JD − 2400000). */
  rjd: number;
  /** Truncated JD (JD − 2440000.5). */
  tjd: number;
  /** Dublin JD (JD − 2415020). */
  djd: number;
  /** Rata Die (JD − 1721424.5). */
  rataDie: number;
  /** Days since J2000.0 epoch (JD − 2451545.0). */
  j2000: number;
  /** Unix seconds (BigInt; null when out of JS Date range). */
  unixSeconds: bigint | null;
  /** Unix milliseconds (BigInt; null when out of range). */
  unixMillis: bigint | null;
  /** Calendar parts in the requested calendar system (UT). */
  calendar: CalendarParts;
  /** Calendar system used. */
  calendarSystem: CalendarSystem;
  /** Weekday 0=Sun..6=Sat. */
  dayOfWeek: number;
  /** Weekday name. */
  weekday: string;
  /** Fraction of day [0,1) measured from local midnight UT. */
  fractionOfDay: number;
  /** ISO 8601 date string (Gregorian, may be BC) or null when out of range. */
  iso: string | null;
  /** Mode that produced this result. */
  mode: Mode;
}

export interface JulianError {
  ok: false;
  error: string;
}

export type ConvertResult = JulianConversion | JulianError;

export interface OrdinalResult {
  ok: true;
  /** 4-digit astronomical year. */
  year: number;
  /** Day-of-year 1..366. */
  dayOfYear: number;
  /** Calendar parts. */
  calendar: CalendarParts;
  /** JD for midnight UT of the ordinal date. */
  jd: number;
  /** Weekday name. */
  weekday: string;
  /** Original input interpreted (5- or 7-digit). */
  form: "YYDDD" | "YYYYDDD";
}

export interface OrdinalError {
  ok: false;
  error: string;
}

export type OrdinalConvertResult = OrdinalResult | OrdinalError;

export interface HistoryEntry {
  ts: number;
  mode: Mode;
  calendarSystem: CalendarSystem;
  inputPreview: string;
  jd: number;
}

// ---------------------------------------------------------------------------
// Constants & option catalogs
// ---------------------------------------------------------------------------

/** JD of the J2000.0 epoch (2000-01-01 12:00 TT ≈ 12:00 UTC for civil use). */
export const J2000_JD = 2_451_545.0;

/** JD offset for Modified JD: MJD = JD − 2400000.5. */
export const MJD_OFFSET = 2_400_000.5;

/** JD offset for Reduced JD: RJD = JD − 2400000. */
export const RJD_OFFSET = 2_400_000.0;

/** JD offset for Truncated JD (NASA): TJD = JD − 2440000.5. */
export const TJD_OFFSET = 2_440_000.5;

/** JD offset for Dublin JD: DJD = JD − 2415020. */
export const DJD_OFFSET = 2_415_020.0;

/** JD offset for Rata Die: RD = JD − 1721424.5 (day 1 = 0001-01-01 proleptic Gregorian). */
export const RATA_DIE_OFFSET = 1_721_424.5;

/** Unix epoch (1970-01-01 00:00 UTC) as JD. */
export const UNIX_EPOCH_JD = 2_440_587.5;

export const CALENDAR_SYSTEMS: ReadonlyArray<{ value: CalendarSystem; label: string; hint: string }> = [
  { value: "gregorian", label: "Proleptic Gregorian", hint: "ISO 8601 default. Gregorian rules extended backward. Use for modern and historical proleptic dates." },
  { value: "julian", label: "Proleptic Julian", hint: "Julian calendar (365.25-day leap cycle) used in the West before 1582-10-15." },
];

export const MODES: ReadonlyArray<{ value: Mode; label: string; hint: string }> = [
  { value: "calendar", label: "Calendar → JD", hint: "Enter a Gregorian/Julian date and time. Get JD, MJD, Rata Die, J2000, Unix epoch." },
  { value: "jd", label: "JD → Calendar", hint: "Enter a Julian Date (e.g. 2460684.5). Get the calendar date/time and related forms." },
  { value: "ordinal", label: "Ordinal YYDDD", hint: "Mainframe-style 'Julian date': YYDDD (5 digits) or YYYYDDD (7 digits). Not astronomical JD!" },
];

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Display precision levels for fractional output. */
export const PRECISION_LEVELS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0, label: "Integer" },
  { value: 3, label: "ms (3)" },
  { value: 6, label: "μs (6)" },
  { value: 9, label: "ns (9)" },
  { value: 12, label: "ps (12)" },
];

// Date's safe representable range (millisecond timestamps).
const MIN_DATE_MS = -8_640_000_000_000_000;
const MAX_DATE_MS = 8_640_000_000_000_000;
const MS_PER_DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Calendar arithmetic — proleptic Gregorian / Julian
// ---------------------------------------------------------------------------

/**
 * True if `year` is a leap year in the given calendar system.
 * Gregorian: divisible by 4, except centuries not divisible by 400.
 * Julian: divisible by 4 (year 0 IS a leap year under astronomical numbering).
 */
export function isLeapYear(year: number, system: CalendarSystem): boolean {
  if (system === "julian") {
    // Julian leap: every 4 years (no century exception). Year 0 is leap (mod 4 === 0).
    // Use Math.trunc so negative years behave correctly.
    return Math.trunc(year / 4) * 4 === year;
  }
  // Gregorian
  if (year % 400 === 0) return true;
  if (year % 100 === 0) return false;
  return year % 4 === 0;
}

/** Days in each month for a given year and calendar system. */
export function daysInMonth(year: number, month: number, system: CalendarSystem): number {
  const dim = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2 && isLeapYear(year, system)) return 29;
  return dim[month - 1] ?? 0;
}

/** Validate that CalendarParts form a real date in the given calendar system. */
export function validateCalendar(p: CalendarParts, system: CalendarSystem): string | null {
  if (!Number.isInteger(p.year)) return "Year must be an integer (use 0 for 1 BC).";
  if (!Number.isInteger(p.month) || p.month < 1 || p.month > 12) return "Month must be 1-12.";
  if (!Number.isInteger(p.day) || p.day < 1 || p.day > daysInMonth(p.year, p.month, system)) {
    return `Day must be 1-${daysInMonth(p.year, p.month, system)} for ${MONTHS[p.month - 1]} ${p.year} (${system}).`;
  }
  if (!Number.isInteger(p.hour) || p.hour < 0 || p.hour > 23) return "Hour must be 0-23.";
  if (!Number.isInteger(p.minute) || p.minute < 0 || p.minute > 59) return "Minute must be 0-59.";
  if (!Number.isInteger(p.second) || p.second < 0 || p.second > 59) return "Second must be 0-59.";
  if (p.fraction !== undefined && (p.fraction < 0 || p.fraction >= 1)) {
    return "Fraction of second must be in [0, 1).";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Calendar ↔ JD  (Meeus, Astronomical Algorithms, ch. 7)
// ---------------------------------------------------------------------------

/**
 * Calendar (Y,M,D,H,M,S,F) → JD (fractional).
 *
 * Uses Meeus' algorithm. JDN integer corresponds to noon of the date;
 * time-of-day fraction is added relative to the previous midnight (i.e.,
 * midnight = JDN − 0.5).
 *
 * Astronomical year numbering: year 0 = 1 BC.
 */
export function calendarToJd(p: CalendarParts, system: CalendarSystem): number {
  const { year, month, day, hour, minute, second, fraction = 0 } = p;
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  let jdn: number;
  if (system === "gregorian") {
    jdn = day
      + Math.floor((153 * m + 2) / 5)
      + 365 * y
      + Math.floor(y / 4)
      - Math.floor(y / 100)
      + Math.floor(y / 400)
      - 32045;
  } else {
    // Proleptic Julian — same y/m formula, no century correction, different offset.
    jdn = day
      + Math.floor((153 * m + 2) / 5)
      + 365 * y
      + Math.floor(y / 4)
      - 32083;
  }
  // Time of day as fraction [0,1) measured from midnight.
  const fracOfDay = (hour + minute / 60 + (second + fraction) / 3600) / 24;
  // JDN is at noon; subtract 0.5 to anchor at midnight, then add fraction.
  return jdn - 0.5 + fracOfDay;
}

/**
 * JD (fractional) → Calendar (Y,M,D,H,M,S,F) in the given calendar system.
 *
 * Inverse of `calendarToJd` (Meeus inverse, ch. 7).
 */
export function jdToCalendar(jd: number, system: CalendarSystem): CalendarParts {
  const Z = Math.floor(jd + 0.5);
  const F = jd + 0.5 - Z; // fraction of day [0,1) from noon

  let A: number;
  if (system === "gregorian") {
    const alpha = Math.floor((Z - 1_867_216.25) / 36_524.25);
    A = Z + 1 + alpha - Math.floor(alpha / 4);
  } else {
    // Julian: always pre-Gregorian branch.
    A = Z;
  }
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  const dayOfMonth = B - D - Math.floor(30.6001 * E);

  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;

  // F is the fraction of day measured from midnight [0,1) (per Meeus convention:
  // JD + 0.5 places the integer boundary at midnight, so F is the time-of-day
  // fraction). Convert to h:m:s.
  const totalSeconds = F * 86_400;
  const hour = Math.floor(totalSeconds / 3600);
  const minute = Math.floor((totalSeconds - hour * 3600) / 60);
  const secondFloat = totalSeconds - hour * 3600 - minute * 60;
  const second = Math.floor(secondFloat);
  const fraction = secondFloat - second;

  return { year, month, day: dayOfMonth, hour, minute, second, fraction };
}

// ---------------------------------------------------------------------------
// JD ↔ MJD / Reduced / Truncated / Dublin / Rata Die / J2000
// ---------------------------------------------------------------------------

export function jdToMjd(jd: number): number { return jd - MJD_OFFSET; }
export function mjdToJd(mjd: number): number { return mjd + MJD_OFFSET; }

export function jdToRjd(jd: number): number { return jd - RJD_OFFSET; }
export function rjdToJd(rjd: number): number { return rjd + RJD_OFFSET; }

export function jdToTjd(jd: number): number { return jd - TJD_OFFSET; }
export function tjdToJd(tjd: number): number { return tjd + TJD_OFFSET; }

export function jdToDjd(jd: number): number { return jd - DJD_OFFSET; }
export function djdToJd(djd: number): number { return djd + DJD_OFFSET; }

export function jdToRataDie(jd: number): number { return jd - RATA_DIE_OFFSET; }
export function rataDieToJd(rd: number): number { return rd + RATA_DIE_OFFSET; }

export function jdToJ2000(jd: number): number { return jd - J2000_JD; }
export function j2000ToJd(j2000: number): number { return j2000 + J2000_JD; }

// ---------------------------------------------------------------------------
// JD ↔ Unix epoch (s/ms)
// ---------------------------------------------------------------------------

/** JD → Unix milliseconds (BigInt). Returns null if out of JS Date range. */
export function jdToUnixMillis(jd: number): bigint | null {
  const ms = Math.round((jd - UNIX_EPOCH_JD) * MS_PER_DAY);
  if (!Number.isFinite(ms) || ms < MIN_DATE_MS || ms > MAX_DATE_MS) return null;
  return BigInt(ms);
}

/** JD → Unix seconds (BigInt). Returns null if out of JS Date range. */
export function jdToUnixSeconds(jd: number): bigint | null {
  const ms = jdToUnixMillis(jd);
  if (ms === null) return null;
  return ms / BigInt(1000);
}

/** Unix milliseconds (BigInt) → JD. */
export function unixMillisToJd(ms: bigint): number {
  return Number(ms) / MS_PER_DAY + UNIX_EPOCH_JD;
}

/** Unix seconds (BigInt) → JD. */
export function unixSecondsToJd(sec: bigint): number {
  return Number(sec * BigInt(1000)) / MS_PER_DAY + UNIX_EPOCH_JD;
}

// ---------------------------------------------------------------------------
// Weekday from JD
// ---------------------------------------------------------------------------

/**
 * Weekday from JD. JD 0 was a Monday (proleptic Julian). For any JD value:
 *   weekday = (JD + 1.5) mod 7  →  0=Sun..6=Sat
 * (JD 0.0 = Monday noon; adding 0.5 puts the boundary at midnight; +1 makes
 *  Sunday = 0 to match JS Date.)
 */
export function weekdayFromJd(jd: number): number {
  const w = Math.floor(jd + 1.5) % 7;
  return ((w % 7) + 7) % 7;
}

export function weekdayNameFromJd(jd: number): string {
  return WEEKDAYS[weekdayFromJd(jd)];
}

// ---------------------------------------------------------------------------
// Calendar → ISO 8601 (handles BC, out-of-range)
// ---------------------------------------------------------------------------

/** Render a CalendarParts as ISO 8601 string. Handles BC years (year ≤ 0). */
export function calendarToIso(p: CalendarParts): string {
  const pad = (n: number, w: number) => {
    const s = Math.abs(n).toString().padStart(w, "0");
    return n < 0 ? "-" + s : s;
  };
  const sign = p.year < 0 ? "-" : "";
  const yStr = sign + Math.abs(p.year).toString().padStart(4, "0");
  const mStr = pad(p.month, 2);
  const dStr = pad(p.day, 2);
  const hStr = pad(p.hour, 2);
  const miStr = pad(p.minute, 2);
  const sStr = pad(p.second, 2);
  let iso = `${yStr}-${mStr}-${dStr}T${hStr}:${miStr}:${sStr}`;
  if (p.fraction && p.fraction > 0) {
    const fracStr = p.fraction.toFixed(6).replace(/^0/, "").replace(/0+$/, "");
    if (fracStr.length > 1) iso += fracStr;
  }
  iso += "Z";
  return iso;
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/** Build a CalendarParts from individual numeric fields. */
export function makeCalendar(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  fraction = 0,
): CalendarParts {
  return { year, month, day, hour, minute, second, fraction };
}

/** Parse "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS" or "YYYY-MM-DD" into CalendarParts. */
export function parseCalendarString(s: string): CalendarParts | null {
  const m = /^(-?\d{1,6})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?)?$/.exec((s ?? "").trim());
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  const hour = m[4] ? parseInt(m[4], 10) : 0;
  const minute = m[5] ? parseInt(m[5], 10) : 0;
  let second = 0;
  let fraction = 0;
  if (m[6]) {
    if (m[6].includes(".")) {
      const [i, f] = m[6].split(".");
      second = parseInt(i, 10);
      fraction = parseFloat("0." + f);
    } else {
      second = parseInt(m[6], 10);
    }
  }
  return { year, month, day, hour, minute, second, fraction };
}

/** Parse a numeric JD string (allows leading sign, fractional). */
export function parseJd(s: string): number | null {
  const t = (s ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

// ---------------------------------------------------------------------------
// Main convert (calendar ↔ JD)
// ---------------------------------------------------------------------------

/**
 * Convert CalendarParts → JulianConversion in the given calendar system.
 */
export function convertCalendar(parts: CalendarParts, system: CalendarSystem): ConvertResult {
  const err = validateCalendar(parts, system);
  if (err) return { ok: false, error: err };
  const jd = calendarToJd(parts, system);
  return buildConversionFromJd(jd, system, parts, "calendar");
}

/**
 * Convert JD → JulianConversion in the given calendar system.
 */
export function convertFromJd(jd: number, system: CalendarSystem): ConvertResult {
  if (!Number.isFinite(jd)) return { ok: false, error: "JD must be a finite number." };
  const cal = jdToCalendar(jd, system);
  const vErr = validateCalendar(cal, system);
  if (vErr) {
    return { ok: false, error: `Reverse calendar invalid: ${vErr}` };
  }
  return buildConversionFromJd(jd, system, cal, "jd");
}

function buildConversionFromJd(
  jd: number,
  system: CalendarSystem,
  cal: CalendarParts,
  mode: Mode,
): JulianConversion {
  // Fraction of day measured from local midnight UT.
  const fractionOfDay = ((jd + 0.5) % 1 + 1) % 1;
  const dow = weekdayFromJd(jd);
  const iso = calendarToIso(cal);
  return {
    ok: true,
    jd,
    mjd: jdToMjd(jd),
    rjd: jdToRjd(jd),
    tjd: jdToTjd(jd),
    djd: jdToDjd(jd),
    rataDie: jdToRataDie(jd),
    j2000: jdToJ2000(jd),
    unixSeconds: jdToUnixSeconds(jd),
    unixMillis: jdToUnixMillis(jd),
    calendar: cal,
    calendarSystem: system,
    dayOfWeek: dow,
    weekday: WEEKDAYS[dow],
    fractionOfDay,
    iso,
    mode,
  };
}

// ---------------------------------------------------------------------------
// Ordinal (YYDDD / YYYYDDD)
// ---------------------------------------------------------------------------

/**
 * Parse an ordinal YYDDD or YYYYDDD string.
 * - YYDDD (5 digits): YY = 2-digit year. Pivot: 0..69 → 2000..2069, 70..99 → 1970..1999.
 * - YYYYDDD (7 digits): full 4-digit astronomical year.
 */
export function parseOrdinal(s: string): { form: "YYDDD" | "YYYYDDD"; year: number; dayOfYear: number } | null {
  const t = (s ?? "").trim().replace(/\D/g, "");
  if (t.length === 5) {
    const yy = parseInt(t.slice(0, 2), 10);
    const ddd = parseInt(t.slice(2, 5), 10);
    const year = yy < 70 ? 2000 + yy : 1900 + yy;
    return { form: "YYDDD", year, dayOfYear: ddd };
  }
  if (t.length === 7) {
    const yyyy = parseInt(t.slice(0, 4), 10);
    const ddd = parseInt(t.slice(4, 7), 10);
    return { form: "YYYYDDD", year: yyyy, dayOfYear: ddd };
  }
  return null;
}

/**
 * Convert an ordinal (YYYYDDD or YYDDD) to a calendar date and JD.
 * Uses the proleptic Gregorian calendar (matches ISO 8601 ordinal dates).
 */
export function convertOrdinal(s: string): OrdinalConvertResult {
  const parsed = parseOrdinal(s);
  if (!parsed) {
    return { ok: false, error: "Input must be 5 digits (YYDDD) or 7 digits (YYYYDDD)." };
  }
  const { year, dayOfYear, form } = parsed;
  if (dayOfYear < 1) {
    return { ok: false, error: "Day-of-year must be ≥ 1." };
  }
  const max = isLeapYear(year, "gregorian") ? 366 : 365;
  if (dayOfYear > max) {
    return { ok: false, error: `Day-of-year ${dayOfYear} exceeds ${max} for year ${year}.` };
  }
  let remaining = dayOfYear;
  let month = 1;
  let day = 1;
  for (let m = 1; m <= 12; m++) {
    const dim = daysInMonth(year, m, "gregorian");
    if (remaining <= dim) {
      month = m;
      day = remaining;
      break;
    }
    remaining -= dim;
  }
  const cal: CalendarParts = makeCalendar(year, month, day, 0, 0, 0, 0);
  const jd = calendarToJd(cal, "gregorian");
  const dow = weekdayFromJd(jd);
  return {
    ok: true,
    year,
    dayOfYear,
    calendar: cal,
    jd,
    weekday: WEEKDAYS[dow],
    form,
  };
}

/**
 * Convert a calendar date to its YYYYDDD ordinal form.
 */
export function calendarToOrdinal(year: number, month: number, day: number): string {
  let doy = day;
  for (let m = 1; m < month; m++) doy += daysInMonth(year, m, "gregorian");
  const y = Math.abs(year).toString().padStart(4, "0");
  const d = doy.toString().padStart(3, "0");
  return (year < 0 ? "-" : "") + `${y}${d}`;
}

// ---------------------------------------------------------------------------
// Current JD / MJD live readout
// ---------------------------------------------------------------------------

/** Get the current JD (fractional) based on the current UTC time. */
export function currentJd(now: Date = new Date()): number {
  return unixMillisToJd(BigInt(now.getTime()));
}

/** Get the current MJD based on the current UTC time. */
export function currentMjd(now: Date = new Date()): number {
  return jdToMjd(currentJd(now));
}

// ---------------------------------------------------------------------------
// Precision formatting
// ---------------------------------------------------------------------------

/** Format a fractional JD/MJD/etc with the requested decimal precision. */
export function formatFixed(value: number, precision: number): string {
  if (!Number.isFinite(value)) return String(value);
  return value.toFixed(precision);
}

/** Format a JulianConversion as a printable table of label/value rows. */
export function formatConversionTable(
  r: JulianConversion,
  precision: number,
): { label: string; value: string }[] {
  return [
    { label: "Julian Date (JD)", value: formatFixed(r.jd, precision) },
    { label: "Modified JD (MJD)", value: formatFixed(r.mjd, precision) },
    { label: "Reduced JD (RJD)", value: formatFixed(r.rjd, precision) },
    { label: "Truncated JD (TJD)", value: formatFixed(r.tjd, precision) },
    { label: "Dublin JD (DJD)", value: formatFixed(r.djd, precision) },
    { label: "Rata Die (RD)", value: formatFixed(r.rataDie, precision) },
    { label: "Days since J2000.0", value: formatFixed(r.j2000, precision) },
    { label: "Unix seconds", value: r.unixSeconds !== null ? r.unixSeconds.toString() : "out of range" },
    { label: "Unix milliseconds", value: r.unixMillis !== null ? r.unixMillis.toString() : "out of range" },
    { label: "Calendar system", value: r.calendarSystem === "gregorian" ? "Proleptic Gregorian" : "Proleptic Julian" },
    { label: "Date (Y-M-D)", value: `${r.calendar.year}-${String(r.calendar.month).padStart(2, "0")}-${String(r.calendar.day).padStart(2, "0")}` },
    { label: "Time (H:M:S)", value: `${String(r.calendar.hour).padStart(2, "0")}:${String(r.calendar.minute).padStart(2, "0")}:${String(r.calendar.second).padStart(2, "0")}` },
    { label: "Weekday", value: r.weekday },
    { label: "Fraction of day", value: formatFixed(r.fractionOfDay, precision) },
    { label: "ISO 8601", value: r.iso ?? "out of range" },
  ];
}

// ---------------------------------------------------------------------------
// History (localStorage, max 20)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:julian-date-astronomical-time-converter:history";
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

export function buildShareUrl(
  mode: Mode,
  input: string,
  calendarSystem: CalendarSystem,
  precision: number,
): string {
  const params = new URLSearchParams();
  params.set("mode", mode);
  if (input) params.set("input", input);
  if (calendarSystem !== "gregorian") params.set("cal", calendarSystem);
  if (precision !== 6) params.set("p", String(precision));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ShareParams {
  mode: Mode;
  input: string;
  calendarSystem: CalendarSystem;
  precision: number;
}

export function parseShareUrl(hash: string): ShareParams {
  let clean = hash;
  if (clean.startsWith("#")) clean = clean.slice(1);
  if (clean.startsWith("?")) clean = clean.slice(1);
  if (!clean) return { mode: "calendar", input: "", calendarSystem: "gregorian", precision: 6 };
  const params = new URLSearchParams(clean);
  const modeStr = params.get("mode");
  const calStr = params.get("cal");
  const pStr = params.get("p");
  const validModes: Mode[] = ["calendar", "jd", "ordinal"];
  const validCal: CalendarSystem[] = ["gregorian", "julian"];
  const mode: Mode = modeStr && validModes.includes(modeStr as Mode) ? (modeStr as Mode) : "calendar";
  const calendarSystem: CalendarSystem = calStr && validCal.includes(calStr as CalendarSystem) ? (calStr as CalendarSystem) : "gregorian";
  let precision = 6;
  if (pStr) {
    const n = parseInt(pStr, 10);
    if (!Number.isNaN(n) && n >= 0 && n <= 12) precision = n;
  }
  return {
    mode,
    input: params.get("input") ?? "",
    calendarSystem,
    precision,
  };
}

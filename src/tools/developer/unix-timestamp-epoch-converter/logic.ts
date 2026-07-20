/**
 * Unix Timestamp / Epoch Converter — pure logic.
 *
 * Convert between Unix/epoch timestamps and human-readable dates in both
 * directions. Auto-detects seconds / milliseconds / microseconds /
 * nanoseconds. Multi-epoch support: UNIX, JS ms, Windows FILETIME,
 * LDAP/NT, NTP, Cocoa/Apple (2001), Excel serial, Mongo ObjectId.
 * Outputs ISO 8601, RFC 2822, locale, day-of-week, relative time, UTC +
 * local. Batch convert. Start/end-of-period helpers. 2038 overflow
 * warning. BigInt-backed so μs/ns never lose digits.
 *
 * Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Unit = "s" | "ms" | "us" | "ns";

export type EpochKind =
  | "unix"        // any precision, since 1970-01-01 UTC
  | "filetime"    // Windows FILETIME: 100-ns since 1601-01-01 UTC
  | "ldap"        // LDAP/NT: 100-ns since 1601-01-01 UTC (same as FILETIME)
  | "ntp"         // NTP: seconds since 1900-01-01 UTC (32-bit wraps in 2036)
  | "cocoa"       // Apple/Cocoa: seconds since 2001-01-01 UTC
  | "excel"       // Excel serial date: days since 1899-12-30
  | "mongo";      // Mongo ObjectId first 4 bytes (hex string)

export interface UnitInfo {
  unit: Unit;
  label: string;
  digitHint: string;
}

export interface TimestampConversion {
  ok: true;
  /** Big-endian canonical Unix nanoseconds (always integer, never loses digits). */
  unixNs: bigint;
  /** Unix seconds (BigInt). */
  seconds: bigint;
  /** Unix milliseconds (BigInt). */
  millis: bigint;
  /** Unix microseconds (BigInt). */
  micros: bigint;
  /** Unix nanoseconds (BigInt). */
  nanos: bigint;
  /** Detected or specified input unit. */
  unit: Unit;
  /** Detected epoch kind (always "unix" unless caller overrode). */
  epoch: EpochKind;
  /** JS Date for ms-precision formatting (null if out of Date's representable range). */
  date: Date | null;
  iso: string;
  rfc2822: string;
  utc: string;
  local: string;
  localeDate: string;
  localeTime: string;
  weekday: string;
  weekdayLocal: string;
  relative: string;
  dayOfWeek: number; // 0=Sun..6=Sat (UTC)
  overflow2038: boolean;
}

export interface TimestampError {
  ok: false;
  error: string;
}

export type ConvertResult = TimestampConversion | TimestampError;

export interface BatchRow {
  input: string;
  ok: boolean;
  unit?: Unit;
  epoch?: EpochKind;
  iso?: string;
  utc?: string;
  local?: string;
  weekday?: string;
  relative?: string;
  error?: string;
}

export interface BatchResult {
  rows: BatchRow[];
  total: number;
  valid: number;
  invalid: number;
}

export interface HistoryEntry {
  ts: number;
  unit: Unit;
  epoch: EpochKind;
  inputPreview: string;
  iso: string;
}

export interface OverflowCheck {
  overflow: boolean;
  int32Seconds: number;
  boundary: number;
  boundaryIso: string;
  message: string | null;
}

// ---------------------------------------------------------------------------
// Constants / option catalogs
// ---------------------------------------------------------------------------

export const UNITS: ReadonlyArray<UnitInfo> = [
  { unit: "s", label: "Seconds", digitHint: "1-10 digits (e.g. 1736943900)" },
  { unit: "ms", label: "Milliseconds", digitHint: "11-13 digits (e.g. 1736943900000)" },
  { unit: "us", label: "Microseconds", digitHint: "14-16 digits (e.g. 1736943900000000)" },
  { unit: "ns", label: "Nanoseconds", digitHint: "17-19 digits (e.g. 1736943900000000000)" },
];

export const EPOCH_KINDS: ReadonlyArray<{ value: EpochKind; label: string; hint: string }> = [
  { value: "unix", label: "Unix epoch", hint: "Since 1970-01-01 UTC. Auto-detect precision." },
  { value: "filetime", label: "Windows FILETIME", hint: "100-ns intervals since 1601-01-01 UTC." },
  { value: "ldap", label: "LDAP/NT", hint: "100-ns intervals since 1601-01-01 UTC (same as FILETIME)." },
  { value: "ntp", label: "NTP", hint: "Seconds since 1900-01-01 UTC (32-bit wraps in 2036)." },
  { value: "cocoa", label: "Cocoa/Apple", hint: "Seconds since 2001-01-01 UTC." },
  { value: "excel", label: "Excel serial", hint: "Days since 1899-12-30 (1900 date system)." },
  { value: "mongo", label: "MongoDB ObjectId", hint: "First 4 bytes of a 24-char ObjectId hex (seconds since 1970)." },
];

export const UNIT_LABELS: Record<Unit, string> = {
  s: "Seconds",
  ms: "Milliseconds",
  us: "Microseconds",
  ns: "Nanoseconds",
};

export const UNIT_BADGE_COLOR: Record<Unit, string> = {
  s: "blue",
  ms: "emerald",
  us: "amber",
  ns: "violet",
};

// BigInt conversion factors (use BigInt(number) for safe-Number values, BigInt("...") for >2^53)
const NS_PER_S = BigInt(1_000_000_000);
const NS_PER_MS = BigInt(1_000_000);
const NS_PER_US = BigInt(1_000);
const NS_PER_100NS = BigInt(100);

// Epoch offsets (in their native units)
const FILETIME_OFFSET_100NS = BigInt("116444736000000000"); // 1601-01-01 → 1970-01-01 in 100-ns intervals
const NTP_OFFSET_S = BigInt(2_208_988_800); // 1900-01-01 → 1970-01-01 in seconds
const COCOA_OFFSET_S = BigInt(978_307_200); // 1970-01-01 → 2001-01-01 in seconds
const EXCEL_EPOCH_DAYS = BigInt(25_569); // 1899-12-30 → 1970-01-01 in days
const MS_PER_DAY = BigInt(86_400_000);

// 2038 boundary (signed 32-bit Unix seconds)
const INT32_MAX_S = BigInt(2_147_483_647);
const INT32_MAX_MS = BigInt(2_147_483_647_000);

// Date's safe representable range (millisecond timestamps)
const MIN_DATE_MS = -8_640_000_000_000_000;
const MAX_DATE_MS = 8_640_000_000_000_000;

// ---------------------------------------------------------------------------
// Unit detection + parsing
// ---------------------------------------------------------------------------

/** Detect the most-likely unit from the digit count of an integer string. */
export function detectUnit(raw: string): Unit {
  const s = (raw ?? "").trim();
  // Allow leading minus for pre-1970 dates
  const digits = s.replace(/^-/, "").replace(/\..*$/, "").replace(/[^0-9]/g, "");
  const len = digits.length;
  if (len <= 10) return "s";
  if (len <= 13) return "ms";
  if (len <= 16) return "us";
  return "ns";
}

/** Parse a numeric string into a BigInt (supports decimals → truncated to integer). */
export function parseBigInt(input: string): bigint | null {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s) return null;
  // Allow scientific notation? No — for epoch values direct integer / decimal only.
  const sign = s.startsWith("-") ? BigInt(-1) : BigInt(1);
  const cleaned = s.replace(/^[+-]/, "").replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  if (cleaned.includes(".")) {
    const [intPart] = cleaned.split(".");
    if (!intPart) return null; // purely fractional — not a valid epoch
    try {
      // Truncate fractional part (epoch inputs are integer-valued in their unit)
      return sign * BigInt(intPart);
    } catch {
      return null;
    }
  }
  try {
    return sign * BigInt(cleaned || "0");
  } catch {
    return null;
  }
}

/** Convert a value in the given unit to Unix nanoseconds (BigInt). */
export function toUnixNs(value: bigint, unit: Unit): bigint {
  switch (unit) {
    case "s": return value * NS_PER_S;
    case "ms": return value * NS_PER_MS;
    case "us": return value * NS_PER_US;
    case "ns": return value;
  }
}

/** Convert Unix nanoseconds back to the requested unit. */
export function fromUnixNs(ns: bigint, unit: Unit): bigint {
  switch (unit) {
    case "s": return ns / NS_PER_S;
    case "ms": return ns / NS_PER_MS;
    case "us": return ns / NS_PER_US;
    case "ns": return ns;
  }
}

// ---------------------------------------------------------------------------
// Multi-epoch converters
// ---------------------------------------------------------------------------

/** FILETIME (100-ns since 1601) → Unix nanoseconds. */
export function fileTimeToUnixNs(filetime: bigint): bigint {
  return (filetime - FILETIME_OFFSET_100NS) * NS_PER_100NS;
}

/** Unix nanoseconds → FILETIME. */
export function unixNsToFileTime(ns: bigint): bigint {
  return ns / NS_PER_100NS + FILETIME_OFFSET_100NS;
}

/** LDAP/NT (100-ns since 1601, same as FILETIME) → Unix ns. */
export function ldapToUnixNs(ldap: bigint): bigint {
  return fileTimeToUnixNs(ldap);
}

/** Unix ns → LDAP/NT. */
export function unixNsToLdap(ns: bigint): bigint {
  return unixNsToFileTime(ns);
}

/** NTP seconds (since 1900) → Unix ns. */
export function ntpToUnixNs(ntpSeconds: bigint): bigint {
  return (ntpSeconds - NTP_OFFSET_S) * NS_PER_S;
}

/** Unix ns → NTP seconds. */
export function unixNsToNtp(ns: bigint): bigint {
  return ns / NS_PER_S + NTP_OFFSET_S;
}

/** Cocoa/Apple seconds (since 2001) → Unix ns. */
export function cocoaToUnixNs(cocoa: bigint): bigint {
  return (cocoa + COCOA_OFFSET_S) * NS_PER_S;
}

/** Unix ns → Cocoa seconds. */
export function unixNsToCocoa(ns: bigint): bigint {
  return ns / NS_PER_S - COCOA_OFFSET_S;
}

/** Excel serial date (days since 1899-12-30) → Unix ns (truncated to ms boundary). */
export function excelSerialToUnixNs(serial: number): bigint {
  // serial may be fractional (days + fraction of day)
  const ms = Math.round((serial - 25569) * 86_400_000);
  return BigInt(ms) * NS_PER_MS;
}

/** Unix ms → Excel serial date (number with optional fractional day). */
export function unixMsToExcelSerial(ms: number): number {
  return ms / 86_400_000 + 25569;
}

/** Mongo ObjectId (24-char hex) → Unix seconds (BigInt). */
export function mongoObjectIdToUnixSeconds(objectId: string): bigint | null {
  const s = (objectId ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{24}$/.test(s)) return null;
  return BigInt("0x" + s.slice(0, 8));
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function pad4(n: number): string {
  if (n < 0) return `-${pad4(-n)}`;
  return n < 10 ? `000${n}` : n < 100 ? `00${n}` : n < 1000 ? `0${n}` : String(n);
}

/** Format a Date as RFC 2822 (e.g. "Wed, 15 Jan 2025 13:45:00 +0000"). */
export function formatRfc2822(date: Date): string {
  if (isNaN(date.getTime())) return "Invalid date";
  const wd = WEEKDAYS[date.getUTCDay()];
  const d = pad2(date.getUTCDate());
  const mo = MONTHS[date.getUTCMonth()];
  const y = date.getUTCFullYear();
  const h = pad2(date.getUTCHours());
  const mi = pad2(date.getUTCMinutes());
  const se = pad2(date.getUTCSeconds());
  return `${wd}, ${d} ${mo} ${y} ${h}:${mi}:${se} +0000`;
}

/** Format a Date as ISO 8601 (UTC, ms precision). */
export function formatIso(date: Date): string {
  if (isNaN(date.getTime())) return "Invalid date";
  try {
    return date.toISOString();
  } catch {
    return "Invalid date";
  }
}

/** Format a Date as a UTC string (e.g. "Wed, 15 Jan 2025 13:45:00 GMT"). */
export function formatUtc(date: Date): string {
  if (isNaN(date.getTime())) return "Invalid date";
  try {
    return date.toUTCString();
  } catch {
    return "Invalid date";
  }
}

/** Format a Date in the user's local time using Intl. */
export function formatLocal(date: Date): string {
  if (isNaN(date.getTime())) return "Invalid date";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "full",
      timeStyle: "long",
    }).format(date);
  } catch {
    return date.toString();
  }
}

/** Format a Date as a locale date string. */
export function formatLocaleDate(date: Date): string {
  if (isNaN(date.getTime())) return "Invalid date";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(date);
  } catch {
    return date.toDateString();
  }
}

/** Format a Date as a locale time string. */
export function formatLocaleTime(date: Date): string {
  if (isNaN(date.getTime())) return "Invalid date";
  try {
    return new Intl.DateTimeFormat(undefined, { timeStyle: "long" }).format(date);
  } catch {
    return date.toTimeString();
  }
}

/** Get UTC weekday name (short). */
export function formatWeekday(date: Date): string {
  if (isNaN(date.getTime())) return "Invalid date";
  return WEEKDAYS_FULL[date.getUTCDay()];
}

/** Get local weekday name (short). */
export function formatWeekdayLocal(date: Date): string {
  if (isNaN(date.getTime())) return "Invalid date";
  try {
    return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date);
  } catch {
    return WEEKDAYS_FULL[date.getDay()];
  }
}

/** Format a relative time string ("3 hours ago", "in 2 days"). */
export function formatRelative(ns: bigint, nowNs?: bigint): string {
  const ZERO = BigInt(0);
  const ONE = BigInt(1);
  const now = nowNs ?? BigInt(Date.now()) * NS_PER_MS;
  const diffSec = (now - ns) / NS_PER_S; // positive = past
  const absSec = diffSec < ZERO ? -diffSec : diffSec;
  const past = diffSec >= ZERO;

  const MIN = BigInt(60);
  const HOUR = BigInt(3_600);
  const DAY = BigInt(86_400);
  const MONTH = BigInt(2_592_000); // 30 days
  const YEAR = BigInt(31_536_000); // 365 days

  let phrase: string;
  if (absSec < MIN) {
    phrase = `${absSec} second${absSec === ONE ? "" : "s"}`;
  } else if (absSec < HOUR) {
    const m = absSec / MIN;
    phrase = `${m} minute${m === ONE ? "" : "s"}`;
  } else if (absSec < DAY) {
    const h = absSec / HOUR;
    phrase = `${h} hour${h === ONE ? "" : "s"}`;
  } else if (absSec < MONTH) {
    const d = absSec / DAY;
    phrase = `${d} day${d === ONE ? "" : "s"}`;
  } else if (absSec < YEAR) {
    const mo = absSec / MONTH;
    phrase = `${mo} month${mo === ONE ? "" : "s"}`;
  } else {
    const y = absSec / YEAR;
    phrase = `${y} year${y === ONE ? "" : "s"}`;
  }
  return past ? `${phrase} ago` : `in ${phrase}`;
}

// ---------------------------------------------------------------------------
// 2038 overflow check
// ---------------------------------------------------------------------------

/** Check if the given Unix seconds exceed the signed 32-bit boundary (Jan 19 2038). */
export function check2038Overflow(unixSeconds: bigint): OverflowCheck {
  const boundary = Number(INT32_MAX_S);
  const boundaryIso = "2038-01-19T03:14:07+00:00";
  const overflow = unixSeconds > INT32_MAX_S;
  return {
    overflow,
    int32Seconds: boundary,
    boundary,
    boundaryIso,
    message: overflow
      ? `Warning: ${unixSeconds.toString()} exceeds the signed 32-bit Unix seconds boundary (${INT32_MAX_S.toString()} = ${boundaryIso}). Legacy systems storing time as int32 will overflow.`
      : null,
  };
}

// ---------------------------------------------------------------------------
// Main conversion
// ---------------------------------------------------------------------------

/** Convert an input string to all representations. */
export function convert(
  input: string,
  unit: Unit | "auto" = "auto",
  epoch: EpochKind = "unix",
): ConvertResult {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return { ok: false, error: "Empty input" };

  let unixNs: bigint;

  if (epoch === "mongo") {
    const sec = mongoObjectIdToUnixSeconds(trimmed);
    if (sec === null) {
      return { ok: false, error: "Invalid MongoDB ObjectId — expected 24 hex characters" };
    }
    unixNs = sec * NS_PER_S;
  } else if (epoch === "excel") {
    const serial = Number(trimmed);
    if (!Number.isFinite(serial)) {
      return { ok: false, error: "Invalid Excel serial — expected a number" };
    }
    unixNs = excelSerialToUnixNs(serial);
  } else if (epoch === "filetime" || epoch === "ldap") {
    const v = parseBigInt(trimmed);
    if (v === null) return { ok: false, error: "Invalid FILETIME/LDAP — expected integer" };
    unixNs = fileTimeToUnixNs(v);
  } else if (epoch === "ntp") {
    const v = parseBigInt(trimmed);
    if (v === null) return { ok: false, error: "Invalid NTP timestamp — expected integer seconds" };
    unixNs = ntpToUnixNs(v);
  } else if (epoch === "cocoa") {
    const v = parseBigInt(trimmed);
    if (v === null) return { ok: false, error: "Invalid Cocoa timestamp — expected integer seconds" };
    unixNs = cocoaToUnixNs(v);
  } else {
    // unix
    const v = parseBigInt(trimmed);
    if (v === null) return { ok: false, error: "Invalid timestamp — expected a number" };
    const resolvedUnit = unit === "auto" ? detectUnit(trimmed) : unit;
    unixNs = toUnixNs(v, resolvedUnit);
  }

  const seconds = unixNs / NS_PER_S;
  const millis = unixNs / NS_PER_MS;
  const micros = unixNs / NS_PER_US;
  const nanos = unixNs;

  // Date only handles ms-precision Number — clamp to representable range
  const msClamped = Number(millis);
  const inDateRange = msClamped >= MIN_DATE_MS && msClamped <= MAX_DATE_MS && Number.isFinite(msClamped);
  const date = inDateRange ? new Date(msClamped) : null;
  const iso = date ? formatIso(date) : "(out of representable range)";
  const rfc2822 = date ? formatRfc2822(date) : "(out of representable range)";
  const utc = date ? formatUtc(date) : "(out of representable range)";
  const local = date ? formatLocal(date) : "(out of representable range)";
  const localeDate = date ? formatLocaleDate(date) : "(out of representable range)";
  const localeTime = date ? formatLocaleTime(date) : "(out of representable range)";
  const weekday = date ? formatWeekday(date) : "(out of representable range)";
  const weekdayLocal = date ? formatWeekdayLocal(date) : "(out of representable range)";
  const relative = formatRelative(unixNs);
  const dayOfWeek = date ? date.getUTCDay() : -1;

  const detectedUnit = unit === "auto" ? detectUnit(trimmed) : unit;
  const overflow = seconds > INT32_MAX_S;

  return {
    ok: true,
    unixNs,
    seconds,
    millis,
    micros,
    nanos,
    unit: detectedUnit,
    epoch,
    date,
    iso,
    rfc2822,
    utc,
    local,
    localeDate,
    localeTime,
    weekday,
    weekdayLocal,
    relative,
    dayOfWeek,
    overflow2038: overflow,
  };
}

// ---------------------------------------------------------------------------
// Date → timestamp (reverse conversion)
// ---------------------------------------------------------------------------

export interface DateInput {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  hour?: number;
  minute?: number;
  second?: number;
  ms?: number;
  timezone?: string; // IANA id, default UTC
}

/** Convert a date/time input to Unix nanoseconds. */
export function dateToUnixNs(input: DateInput): bigint {
  const ts = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour ?? 0,
    input.minute ?? 0,
    input.second ?? 0,
    input.ms ?? 0,
  );
  // For non-UTC zones, apply offset via Intl.formatToParts (works for IANA zones)
  if (input.timezone && input.timezone !== "UTC") {
    // Compute the offset for the given instant by formatting in the target zone
    const asDate = new Date(ts);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: input.timezone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).formatToParts(asDate);
    const map: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== "literal") map[p.type] = Number(p.value);
    }
    const localMs = Date.UTC(map.year, map.month - 1, map.day, map.hour % 24, map.minute, map.second, input.ms ?? 0);
    const offset = localMs - ts;
    return BigInt(ts - offset) * NS_PER_MS;
  }
  return BigInt(ts) * NS_PER_MS;
}

// ---------------------------------------------------------------------------
// Start / end-of-period helpers
// ---------------------------------------------------------------------------

/** Start of UTC day (ms). */
export function startOfDayMs(unixMs: number): number {
  return Math.floor(unixMs / 86_400_000) * 86_400_000;
}

/** End of UTC day (ms, inclusive last ms). */
export function endOfDayMs(unixMs: number): number {
  return startOfDayMs(unixMs) + 86_400_000 - 1;
}

/** Start of UTC month (ms). */
export function startOfMonthMs(unixMs: number): number {
  const d = new Date(unixMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/** End of UTC month (ms, inclusive). */
export function endOfMonthMs(unixMs: number): number {
  const d = new Date(unixMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - 1;
}

/** Start of UTC year (ms). */
export function startOfYearMs(unixMs: number): number {
  const d = new Date(unixMs);
  return Date.UTC(d.getUTCFullYear(), 0, 1);
}

/** End of UTC year (ms, inclusive). */
export function endOfYearMs(unixMs: number): number {
  const d = new Date(unixMs);
  return Date.UTC(d.getUTCFullYear() + 1, 0, 1) - 1;
}

// ---------------------------------------------------------------------------
// Batch conversion
// ---------------------------------------------------------------------------

const BATCH_MAX_ROWS = 10_000;

/** Parse a multi-line / CSV input into individual timestamp strings. */
export function parseBatchInput(input: string): string[] {
  if (!input) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of input.split(/[\r\n]+/)) {
    const cells = line.split(/[,\t;]+/);
    for (const cell of cells) {
      const trimmed = cell.trim();
      if (!trimmed) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      out.push(trimmed);
      if (out.length >= BATCH_MAX_ROWS) return out;
    }
  }
  return out;
}

/** Batch-convert a list of timestamp strings. */
export function batchConvert(
  inputs: string[],
  unit: Unit | "auto" = "auto",
  epoch: EpochKind = "unix",
): BatchResult {
  const rows: BatchRow[] = [];
  let valid = 0;
  let invalid = 0;
  for (const input of inputs) {
    const r = convert(input, unit, epoch);
    if (r.ok) {
      valid += 1;
      rows.push({
        input,
        ok: true,
        unit: r.unit,
        epoch: r.epoch,
        iso: r.iso,
        utc: r.utc,
        local: r.local,
        weekday: r.weekday,
        relative: r.relative,
      });
    } else {
      invalid += 1;
      rows.push({ input, ok: false, error: r.error });
    }
  }
  return { rows, total: rows.length, valid, invalid };
}

/** Render batch rows as CSV. */
export function renderBatchCsv(result: BatchResult): string {
  const lines = ["input,unit,iso,utc,weekday,relative"];
  for (const r of result.rows) {
    const cells = [
      escapeCsv(r.input),
      r.ok ? (r.unit ?? "") : "",
      r.ok ? escapeCsv(r.iso ?? "") : "",
      r.ok ? escapeCsv(r.utc ?? "") : "",
      r.ok ? escapeCsv(r.weekday ?? "") : "",
      r.ok ? escapeCsv(r.relative ?? "") : "",
    ];
    if (!r.ok) {
      cells[2] = escapeCsv(r.error ?? "error");
    }
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

/** Render batch rows as JSON. */
export function renderBatchJson(result: BatchResult): string {
  return JSON.stringify(result, null, 2);
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------------------------------------------------------------------------
// Code snippets (15+ languages)
// ---------------------------------------------------------------------------

export const CODE_SNIPPETS: ReadonlyArray<{ language: string; code: string }> = [
  {
    language: "JavaScript",
    code: "// Current Unix seconds\nconst seconds = Math.floor(Date.now() / 1000);\n// Current Unix milliseconds\nconst ms = Date.now();\n// Seconds → Date\nconst d = new Date(seconds * 1000);",
  },
  {
    language: "TypeScript",
    code: "const now: number = Math.floor(Date.now() / 1000);\nconst iso: string = new Date(now * 1000).toISOString();",
  },
  {
    language: "Python",
    code: "import time\nseconds = int(time.time())         # Unix seconds\nms = int(time.time() * 1000)       # Unix milliseconds\n# Seconds → datetime\nfrom datetime import datetime\ndt = datetime.utcfromtimestamp(seconds)",
  },
  {
    language: "Go",
    code: "import \"time\"\nnow := time.Now()\nseconds := now.Unix()             // Unix seconds\nms := now.UnixMilli()              // Unix milliseconds\nns := now.UnixNano()               // Unix nanoseconds\n// Seconds → time\nt := time.Unix(seconds, 0)",
  },
  {
    language: "Java",
    code: "long seconds = Instant.now().getEpochSecond();\nlong ms = System.currentTimeMillis();\n// Seconds → Instant\nInstant t = Instant.ofEpochSecond(seconds);",
  },
  {
    language: "C",
    code: "#include <time.h>\ntime_t seconds = time(NULL);   // Unix seconds\n// Seconds → struct tm (UTC)\nstruct tm *utc = gmtime(&seconds);",
  },
  {
    language: "C++",
    code: "#include <chrono>\nusing namespace std::chrono;\nauto now = system_clock::now();\nauto ms = duration_cast<milliseconds>(now.time_since_epoch()).count();\nauto sec = duration_cast<seconds>(now.time_since_epoch()).count();",
  },
  {
    language: "C#",
    code: "long seconds = DateTimeOffset.UtcNow.ToUnixTimeSeconds();\nlong ms = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();\n// Seconds → DateTime\nvar dt = DateTimeOffset.FromUnixTimeSeconds(seconds).UtcDateTime;",
  },
  {
    language: "PHP",
    code: "$seconds = time();                       // Unix seconds\n$ms = (int)(microtime(true) * 1000);     // Unix milliseconds\n// Seconds → string\necho date('c', $seconds);",
  },
  {
    language: "Ruby",
    code: "seconds = Time.now.to_i        # Unix seconds\nms = (Time.now.to_f * 1000).to_i\n# Seconds → Time\nt = Time.at(seconds)",
  },
  {
    language: "Rust",
    code: "use std::time::{SystemTime, UNIX_EPOCH};\nlet now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();\nlet seconds = now.as_secs();\nlet ms = now.as_millis();\nlet ns = now.as_nanos();",
  },
  {
    language: "Swift",
    code: "let seconds = Date().timeIntervalSince1970       // Double\nlet ms = Int(Date().timeIntervalSince1970 * 1000)\n// Seconds → Date\nlet d = Date(timeIntervalSince1970: seconds)",
  },
  {
    language: "Kotlin",
    code: "val seconds = System.currentTimeMillis() / 1000\nval ms = System.currentTimeMillis()\n// Seconds → Instant\nval t = java.time.Instant.ofEpochSecond(seconds)",
  },
  {
    language: "Dart",
    code: "final seconds = DateTime.now().millisecondsSinceEpoch ~/ 1000;\nfinal ms = DateTime.now().millisecondsSinceEpoch;\n// Seconds → DateTime\nfinal d = DateTime.fromMillisecondsSinceEpoch(seconds * 1000, isUtc: true);",
  },
  {
    language: "Bash",
    code: "# Unix seconds\nseconds=$(date +%s)\n# Unix milliseconds (GNU date)\nms=$(date +%s%3N)\n# Seconds → ISO 8601 (GNU date)\ndate -u -d @\"$seconds\" +%Y-%m-%dT%H:%M:%SZ",
  },
  {
    language: "Perl",
    code: "my $seconds = time();                  # Unix seconds\nmy $ms = int(Time::HiRes::time() * 1000);  # Unix milliseconds\n# Seconds → localtime\nmy @t = gmtime($seconds);",
  },
  {
    language: "Scala",
    code: "val seconds = System.currentTimeMillis() / 1000L\nval ms = System.currentTimeMillis()\n// Seconds → Instant\nval t = java.time.Instant.ofEpochSecond(seconds)",
  },
];

// ---------------------------------------------------------------------------
// History (localStorage, max 20)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:unix-timestamp-epoch-converter:history";
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

export function buildShareUrl(input: string, unit: Unit | "auto", epoch: EpochKind): string {
  const params = new URLSearchParams();
  if (input) params.set("ts", input);
  if (unit && unit !== "auto") params.set("unit", unit);
  if (epoch && epoch !== "unix") params.set("epoch", epoch);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { input: string; unit: Unit | "auto"; epoch: EpochKind } {
  let clean = hash;
  if (clean.startsWith("#")) clean = clean.slice(1);
  if (clean.startsWith("?")) clean = clean.slice(1);
  if (!clean) return { input: "", unit: "auto", epoch: "unix" };
  const params = new URLSearchParams(clean);
  const input = params.get("ts") ?? "";
  const unitStr = params.get("unit");
  const epochStr = params.get("epoch");
  const validUnits: Unit[] = ["s", "ms", "us", "ns"];
  const validEpochs: EpochKind[] = ["unix", "filetime", "ldap", "ntp", "cocoa", "excel", "mongo"];
  const unit: Unit | "auto" = unitStr && validUnits.includes(unitStr as Unit) ? (unitStr as Unit) : "auto";
  const epoch: EpochKind = epochStr && validEpochs.includes(epochStr as EpochKind) ? (epochStr as EpochKind) : "unix";
  return { input, unit, epoch };
}

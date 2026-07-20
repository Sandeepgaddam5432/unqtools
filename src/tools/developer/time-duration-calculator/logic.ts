/**
 * Time Duration Calculator — pure logic.
 *
 * Add / subtract / multiply / divide durations expressed in days, hours,
 * minutes and seconds. Compute the duration between two clock times (cross-
 * midnight aware). Totalize multiple time segments (timesheet rows with
 * breaks). Convert between HH:MM:SS, decimal hours, minutes and seconds.
 * Mixed-unit normalization (e.g. 75s -> 1m15s). 12/24h clock support.
 *
 * Pure functions only — no DOM, no network. Integer-second core math to
 * avoid float drift; the only float operations are decimal-hour conversion
 * and division results, which are returned as floats explicitly.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type TimeUnit = "days" | "hours" | "minutes" | "seconds";
export type Operation = "add" | "subtract" | "multiply" | "divide";

export interface DurationParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export interface DurationInput {
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
}

export interface TimesheetRow {
  start: string;
  end: string;
  /** Break duration in minutes (subtracted from the row total). */
  breakMinutes?: number;
  label?: string;
}

export interface TimesheetRowResult {
  start: string;
  end: string;
  breakMinutes: number;
  label: string;
  /** Net work duration in seconds (gross minus break). */
  netSeconds: number;
  /** Gross duration in seconds (before break). */
  grossSeconds: number;
  /** Crossed midnight flag. */
  crossedMidnight: boolean;
  /** Error message, if any. */
  error?: string;
}

export interface TimesheetTotal {
  rows: TimesheetRowResult[];
  totalSeconds: number;
  totalBreakSeconds: number;
  totalGrossSeconds: number;
  rowCount: number;
  errorCount: number;
}

export interface ArithmeticResult {
  /** Result in total seconds (integer). */
  totalSeconds: number;
  /** Normalized days/hours/minutes/seconds. */
  parts: DurationParts;
  /** Formatted HH:MM:SS (may exceed 24h, e.g. 49:30:00). */
  hms: string;
  /** Human-readable string e.g. "1 day, 2 hours, 3 minutes". */
  human: string;
  /** Decimal hours (float). */
  decimalHours: number;
  /** Plain-English operation summary. */
  summary: string;
}

export interface BetweenResult {
  /** Total seconds between the two clock times (always non-negative). */
  totalSeconds: number;
  parts: DurationParts;
  hms: string;
  human: string;
  decimalHours: number;
  /** True if the end time was on the next day (clock time went backwards). */
  crossedMidnight: boolean;
  summary: string;
}

export interface HistoryEntry {
  ts: number;
  mode: "arithmetic" | "between" | "timesheet";
  summary: string;
  totalSeconds: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
export const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

// ---------------------------------------------------------------------------
// Duration parsing & formatting
// ---------------------------------------------------------------------------

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Parse a duration input object into total integer seconds.
 * Negative values are supported (they contribute negatively to the total).
 */
export function durationToSeconds(input: DurationInput): number {
  const d = Math.trunc(input.days ?? 0);
  const h = Math.trunc(input.hours ?? 0);
  const m = Math.trunc(input.minutes ?? 0);
  const s = Math.trunc(input.seconds ?? 0);
  return d * SECONDS_PER_DAY + h * SECONDS_PER_HOUR + m * SECONDS_PER_MINUTE + s;
}

/**
 * Parse a flexible duration string into total seconds.
 *
 * Accepted formats:
 *   - "1d 2h 3m 4s"  (mixed units, any combination)
 *   - "1:30:00"      (HH:MM:SS)
 *   - "1:30"         (HH:MM or MM:SS — see flag below)
 *   - "90"           (raw seconds when allowBareSeconds=true)
 *   - "1.5h"         (decimal hours with unit suffix)
 *   - "0.5d"         (decimal days)
 *   - "90m"          (minutes with suffix)
 *
 * Returns NaN for unparseable input.
 */
export function parseDuration(input: string, opts?: { allowBareSeconds?: boolean }): number {
  const str = (input ?? "").trim();
  if (!str) return Number.NaN;

  // Format 1: HH:MM:SS or HH:MM or MM:SS
  const colonParts = str.split(":");
  if (colonParts.length === 2 || colonParts.length === 3) {
    if (colonParts.every((p) => /^\d+$/.test(p.trim()))) {
      const nums = colonParts.map((p) => Number(p.trim()));
      if (colonParts.length === 3) {
        // HH:MM:SS
        return nums[0] * SECONDS_PER_HOUR + nums[1] * SECONDS_PER_MINUTE + nums[2];
      }
      // 2 parts — assume HH:MM if first > 0 OR if MM:SS flag not set
      // Heuristic: if first number > 99, it's MM:SS; if < 24, it's HH:MM; otherwise HH:MM by default
      // For our use case, default to HH:MM (more common in timesheet contexts).
      return nums[0] * SECONDS_PER_HOUR + nums[1] * SECONDS_PER_MINUTE;
    }
  }

  // Format 2: Mixed units like "1d 2h 3m 4s" or "1.5h"
  const unitRegex = /(-?\d+(?:\.\d+)?)\s*([dhms])/gi;
  const matches = [...str.matchAll(unitRegex)];
  if (matches.length > 0) {
    let total = 0;
    for (const m of matches) {
      const value = Number(m[1]);
      const unit = m[2].toLowerCase();
      switch (unit) {
        case "d": total += value * SECONDS_PER_DAY; break;
        case "h": total += value * SECONDS_PER_HOUR; break;
        case "m": total += value * SECONDS_PER_MINUTE; break;
        case "s": total += value; break;
      }
    }
    return Math.trunc(total);
  }

  // Format 3: bare number — seconds (if allowed) or NaN
  if (/^-?\d+$/.test(str)) {
    if (opts?.allowBareSeconds) return Number(str);
    return Number.NaN;
  }

  return Number.NaN;
}

/**
 * Parse a clock time string into seconds-since-midnight.
 *
 * Accepted formats:
 *   - "HH:MM"           (24h)
 *   - "HH:MM:SS"        (24h)
 *   - "HH:MM AM" / "HH:MM PM"
 *   - "HH:MMam" / "HH:MMpm" (no space)
 *   - "h:mm AM/PM"      (1-2 digit hour)
 *
 * Returns NaN for invalid input. Range: 0 to 86399 inclusive.
 */
export function parseClockTime(input: string): number {
  const str = (input ?? "").trim().toLowerCase();
  if (!str) return Number.NaN;

  let isPM = false;
  let isAM = false;
  let cleaned = str;

  // Detect AM/PM suffix
  const ampmMatch = /\s*(am|pm)\s*$/.exec(cleaned);
  if (ampmMatch) {
    const suffix = ampmMatch[1];
    if (suffix === "pm") isPM = true;
    else isAM = true;
    cleaned = cleaned.slice(0, ampmMatch.index).trim();
  }

  // Also handle "8am" / "8pm" without colon (just hour)
  const hourOnlyMatch = /^(\d{1,2})$/.exec(cleaned);
  if (hourOnlyMatch && (isAM || isPM)) {
    let h = Number(hourOnlyMatch[1]);
    if (h < 0 || h > 23) return Number.NaN;
    if (isPM && h !== 12) h += 12;
    if (isAM && h === 12) h = 0;
    return h * SECONDS_PER_HOUR;
  }

  // Match HH:MM[:SS]
  const parts = cleaned.split(":");
  if (parts.length < 2 || parts.length > 3) return Number.NaN;
  if (!parts.every((p) => /^\d{1,2}$/.test(p))) return Number.NaN;

  const nums = parts.map((p) => Number(p));
  let h = nums[0];
  const m = nums[1];
  const s = nums[2] ?? 0;

  if (isAM || isPM) {
    if (h < 1 || h > 12) return Number.NaN;
    if (isPM && h !== 12) h += 12;
    if (isAM && h === 12) h = 0;
  } else {
    if (h < 0 || h > 23) return Number.NaN;
  }
  if (m < 0 || m > 59) return Number.NaN;
  if (s < 0 || s > 59) return Number.NaN;

  return h * SECONDS_PER_HOUR + m * SECONDS_PER_MINUTE + s;
}

/** True if a clock time string is parseable. */
export function isValidClockTime(input: string): boolean {
  return !Number.isNaN(parseClockTime(input));
}

/** Format seconds as HH:MM:SS. Hours can exceed 24 (e.g. "49:30:00"). */
export function formatHms(totalSeconds: number): string {
  if (Number.isNaN(totalSeconds)) return "";
  const sign = totalSeconds < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(totalSeconds));
  const h = Math.floor(abs / SECONDS_PER_HOUR);
  const m = Math.floor((abs % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const s = abs % SECONDS_PER_MINUTE;
  return `${sign}${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

/** Format seconds as a clock time HH:MM:SS wrapping at 24h (mod 86400). */
export function formatClockHms(totalSeconds: number): string {
  if (Number.isNaN(totalSeconds)) return "";
  const abs = ((Math.trunc(totalSeconds) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
  const h = Math.floor(abs / SECONDS_PER_HOUR);
  const m = Math.floor((abs % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const s = abs % SECONDS_PER_MINUTE;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

/** Format a seconds-since-midnight value as a 12-hour clock "h:mm AM/PM". */
export function format12h(secondsSinceMidnight: number): string {
  if (Number.isNaN(secondsSinceMidnight)) return "";
  const wrapped = ((Math.trunc(secondsSinceMidnight) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
  let h = Math.floor(wrapped / SECONDS_PER_HOUR);
  const m = Math.floor((wrapped % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const s = wrapped % SECONDS_PER_MINUTE;
  const ampm = h < 12 ? "AM" : "PM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return s > 0
    ? `${h}:${pad2(m)}:${pad2(s)} ${ampm}`
    : `${h}:${pad2(m)} ${ampm}`;
}

/** Format a seconds-since-midnight value as a 24-hour clock "HH:MM:SS". */
export function format24h(secondsSinceMidnight: number): string {
  return formatClockHms(secondsSinceMidnight);
}

/** Normalize total seconds into DurationParts (days/hours/minutes/seconds). */
export function normalizeDuration(totalSeconds: number): DurationParts {
  const sign = totalSeconds < 0 ? -1 : 1;
  const abs = Math.abs(Math.trunc(totalSeconds));
  const days = Math.floor(abs / SECONDS_PER_DAY);
  const hours = Math.floor((abs % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor((abs % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = abs % SECONDS_PER_MINUTE;
  return {
    days: sign * days,
    hours: sign * hours,
    minutes: sign * minutes,
    seconds: sign * seconds,
  };
}

/** Convert seconds to decimal hours (float). */
export function toDecimalHours(totalSeconds: number): number {
  return totalSeconds / SECONDS_PER_HOUR;
}

/** Convert decimal hours back to integer seconds (rounded to nearest second). */
export function fromDecimalHours(decimalHours: number): number {
  return Math.round(decimalHours * SECONDS_PER_HOUR);
}

/** Render a human-readable duration string e.g. "1 day, 2 hours, 3 minutes". */
export function formatHuman(totalSeconds: number): string {
  if (Number.isNaN(totalSeconds)) return "";
  if (totalSeconds === 0) return "0 seconds";
  const sign = totalSeconds < 0 ? "-" : "";
  const parts = normalizeDuration(totalSeconds);
  const absParts = {
    days: Math.abs(parts.days),
    hours: Math.abs(parts.hours),
    minutes: Math.abs(parts.minutes),
    seconds: Math.abs(parts.seconds),
  };
  const out: string[] = [];
  if (absParts.days > 0) out.push(`${absParts.days} day${absParts.days === 1 ? "" : "s"}`);
  if (absParts.hours > 0) out.push(`${absParts.hours} hour${absParts.hours === 1 ? "" : "s"}`);
  if (absParts.minutes > 0) out.push(`${absParts.minutes} minute${absParts.minutes === 1 ? "" : "s"}`);
  if (absParts.seconds > 0) out.push(`${absParts.seconds} second${absParts.seconds === 1 ? "" : "s"}`);
  if (out.length === 0) return "0 seconds";
  return `${sign}${out.join(", ")}`;
}

/** Format a duration compactly as "1d2h3m4s" (omitting zero units). */
export function formatCompact(totalSeconds: number): string {
  if (Number.isNaN(totalSeconds)) return "";
  if (totalSeconds === 0) return "0s";
  const sign = totalSeconds < 0 ? "-" : "";
  const parts = normalizeDuration(totalSeconds);
  const absParts = {
    days: Math.abs(parts.days),
    hours: Math.abs(parts.hours),
    minutes: Math.abs(parts.minutes),
    seconds: Math.abs(parts.seconds),
  };
  const out: string[] = [];
  if (absParts.days > 0) out.push(`${absParts.days}d`);
  if (absParts.hours > 0) out.push(`${absParts.hours}h`);
  if (absParts.minutes > 0) out.push(`${absParts.minutes}m`);
  if (absParts.seconds > 0) out.push(`${absParts.seconds}s`);
  if (out.length === 0) return "0s";
  return `${sign}${out.join("")}`;
}

// ---------------------------------------------------------------------------
// Arithmetic: add / subtract / multiply / divide
// ---------------------------------------------------------------------------

function buildArithmeticResult(
  totalSeconds: number,
  summary: string,
): ArithmeticResult {
  return {
    totalSeconds,
    parts: normalizeDuration(totalSeconds),
    hms: formatHms(totalSeconds),
    human: formatHuman(totalSeconds),
    decimalHours: toDecimalHours(totalSeconds),
    summary,
  };
}

/**
 * Add two durations together. Either accepts DurationInput objects or
 * precomputed seconds.
 */
export function addDurations(a: DurationInput | number, b: DurationInput | number): ArithmeticResult {
  const aSec = typeof a === "number" ? a : durationToSeconds(a);
  const bSec = typeof b === "number" ? b : durationToSeconds(b);
  const total = aSec + bSec;
  const aStr = formatCompact(aSec);
  const bStr = formatCompact(bSec);
  return buildArithmeticResult(total, `${aStr} + ${bStr} = ${formatCompact(total)} (${formatHms(total)})`);
}

/**
 * Subtract duration b from a. Result may be negative.
 */
export function subtractDurations(a: DurationInput | number, b: DurationInput | number): ArithmeticResult {
  const aSec = typeof a === "number" ? a : durationToSeconds(a);
  const bSec = typeof b === "number" ? b : durationToSeconds(b);
  const total = aSec - bSec;
  const aStr = formatCompact(aSec);
  const bStr = formatCompact(bSec);
  return buildArithmeticResult(total, `${aStr} - ${bStr} = ${formatCompact(total)} (${formatHms(total)})`);
}

/**
 * Multiply a duration by a scalar factor.
 */
export function multiplyDuration(a: DurationInput | number, factor: number): ArithmeticResult {
  const aSec = typeof a === "number" ? a : durationToSeconds(a);
  const total = Math.trunc(aSec * factor);
  const aStr = formatCompact(aSec);
  return buildArithmeticResult(total, `${aStr} × ${factor} = ${formatCompact(total)} (${formatHms(total)})`);
}

/**
 * Divide a duration by a scalar (returns fractional seconds preserved in
 * decimalHours but truncated to integer in totalSeconds).
 */
export function divideDuration(a: DurationInput | number, divisor: number): ArithmeticResult & { exactSeconds: number } {
  const aSec = typeof a === "number" ? a : durationToSeconds(a);
  if (divisor === 0) {
    return {
      ...buildArithmeticResult(0, "Division by zero"),
      exactSeconds: 0,
    };
  }
  const exact = aSec / divisor;
  const total = Math.trunc(exact);
  const aStr = formatCompact(aSec);
  const r = buildArithmeticResult(total, `${aStr} ÷ ${divisor} = ${formatCompact(total)} (exact: ${(exact / SECONDS_PER_HOUR).toFixed(4)}h)`);
  return { ...r, exactSeconds: exact };
}

/** Convenience: add two durations expressed as DurationInput objects. */
export function addInputs(a: DurationInput, b: DurationInput): ArithmeticResult {
  return addDurations(durationToSeconds(a), durationToSeconds(b));
}

/** Convenience: subtract duration b from a (both as DurationInput). */
export function subtractInputs(a: DurationInput, b: DurationInput): ArithmeticResult {
  return subtractDurations(durationToSeconds(a), durationToSeconds(b));
}

// ---------------------------------------------------------------------------
// Duration between two clock times (cross-midnight aware)
// ---------------------------------------------------------------------------

/**
 * Compute the duration between two clock times on the same day or wrapping
 * to the next day. If end < start (as seconds since midnight), we assume end
 * is on the next day (crossed midnight) and add 24h.
 *
 * `nextDay` flag forces end to be on the next day regardless of comparison.
 */
export function durationBetween(
  start: string,
  end: string,
  opts?: { nextDay?: boolean },
): BetweenResult {
  const startSec = parseClockTime(start);
  const endSec = parseClockTime(end);

  if (Number.isNaN(startSec) || Number.isNaN(endSec)) {
    return {
      totalSeconds: 0,
      parts: { days: 0, hours: 0, minutes: 0, seconds: 0 },
      hms: "",
      human: "",
      decimalHours: 0,
      crossedMidnight: false,
      summary: "Invalid clock time(s) provided.",
    };
  }

  let total = endSec - startSec;
  const crossedMidnight = opts?.nextDay === true || total < 0;
  if (crossedMidnight && total < 0) {
    total += SECONDS_PER_DAY;
  } else if (opts?.nextDay === true && total <= 0) {
    total += SECONDS_PER_DAY;
  }

  return {
    totalSeconds: total,
    parts: normalizeDuration(total),
    hms: formatHms(total),
    human: formatHuman(total),
    decimalHours: toDecimalHours(total),
    crossedMidnight,
    summary: `From ${start} to ${end}${crossedMidnight ? " (next day)" : ""}: ${formatHms(total)} (${formatHuman(total)}).`,
  };
}

// ---------------------------------------------------------------------------
// Timesheet calculator (multi-segment totaler with breaks)
// ---------------------------------------------------------------------------

/**
 * Compute a single timesheet row.
 * Returns gross seconds, net seconds (after break), and crossed-midnight flag.
 */
export function computeTimesheetRow(row: TimesheetRow): TimesheetRowResult {
  const startSec = parseClockTime(row.start);
  const endSec = parseClockTime(row.end);
  const breakMin = Math.max(0, Math.trunc(row.breakMinutes ?? 0));

  if (Number.isNaN(startSec) || Number.isNaN(endSec)) {
    return {
      start: row.start,
      end: row.end,
      breakMinutes: breakMin,
      label: row.label ?? "",
      netSeconds: 0,
      grossSeconds: 0,
      crossedMidnight: false,
      error: "Invalid clock time",
    };
  }

  let gross = endSec - startSec;
  const crossedMidnight = gross < 0;
  if (crossedMidnight) gross += SECONDS_PER_DAY;

  const breakSec = breakMin * SECONDS_PER_MINUTE;
  const net = Math.max(0, gross - breakSec);

  return {
    start: row.start,
    end: row.end,
    breakMinutes: breakMin,
    label: row.label ?? "",
    netSeconds: net,
    grossSeconds: gross,
    crossedMidnight,
  };
}

/**
 * Parse a textarea of timesheet rows.
 *
 * Format (one per line):
 *   "09:00 17:00 30 lunch"  (start end breakMin label...)
 *   "9:00 AM 5:00 PM 60"    (12h with AM/PM, 60-min break)
 *   "09:00 17:00"           (no break, no label)
 */
export function parseTimesheetRows(text: string): TimesheetRow[] {
  if (!text) return [];
  const out: TimesheetRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Strategy: tokenize on whitespace, but keep AM/PM attached to the
    // preceding time. We split on whitespace then re-merge tokens that are
    // AM/PM onto the previous token.
    const rawTokens = trimmed.split(/\s+/);
    const tokens: string[] = [];
    for (const t of rawTokens) {
      if ((t === "am" || t === "pm" || t === "AM" || t === "PM") && tokens.length > 0) {
        tokens[tokens.length - 1] = `${tokens[tokens.length - 1]} ${t}`;
      } else {
        tokens.push(t);
      }
    }

    if (tokens.length < 2) {
      out.push({ start: trimmed, end: "", breakMinutes: 0, label: "" });
      continue;
    }

    const start = tokens[0];
    const end = tokens[1];
    let breakMinutes = 0;
    let labelTokens: string[] = [];

    if (tokens.length >= 3 && /^\d+$/.test(tokens[2])) {
      breakMinutes = Number(tokens[2]);
      labelTokens = tokens.slice(3);
    } else {
      labelTokens = tokens.slice(2);
    }

    out.push({
      start,
      end,
      breakMinutes,
      label: labelTokens.join(" "),
    });
  }
  return out;
}

/** Compute totals for a list of timesheet rows. */
export function computeTimesheet(rows: ReadonlyArray<TimesheetRow>): TimesheetTotal {
  const results = rows.map(computeTimesheetRow);
  let totalSeconds = 0;
  let totalBreakSeconds = 0;
  let totalGrossSeconds = 0;
  let errorCount = 0;

  for (const r of results) {
    if (r.error) errorCount++;
    totalSeconds += r.netSeconds;
    totalBreakSeconds += r.breakMinutes * SECONDS_PER_MINUTE;
    totalGrossSeconds += r.grossSeconds;
  }

  return {
    rows: results,
    totalSeconds,
    totalBreakSeconds,
    totalGrossSeconds,
    rowCount: results.length,
    errorCount,
  };
}

/** Render timesheet rows as CSV. */
export function renderTimesheetCsv(total: TimesheetTotal): string {
  const lines = ["label,start,end,break_minutes,gross_seconds,net_seconds,crossed_midnight"];
  for (const r of total.rows) {
    lines.push([
      escapeCsv(r.label),
      r.start,
      r.end,
      String(r.breakMinutes),
      String(r.grossSeconds),
      String(r.netSeconds),
      r.crossedMidnight ? "1" : "0",
    ].join(","));
  }
  lines.push("");
  lines.push(`TOTALS,,,,${total.totalGrossSeconds},${total.totalSeconds},`);
  return lines.join("\n");
}

/** Render timesheet summary as plain text. */
export function renderTimesheetText(total: TimesheetTotal): string {
  const lines: string[] = [];
  lines.push(`Timesheet: ${total.rowCount} row(s), ${total.errorCount} error(s)`);
  lines.push("");
  for (const r of total.rows) {
    const flag = r.crossedMidnight ? " (next day)" : "";
    const err = r.error ? ` [ERROR: ${r.error}]` : "";
    const label = r.label ? ` ${r.label}` : "";
    lines.push(`${r.start} - ${r.end}${flag}${label}  →  gross ${formatHms(r.grossSeconds)} - ${r.breakMinutes}m break = net ${formatHms(r.netSeconds)}${err}`);
  }
  lines.push("");
  lines.push(`Gross total : ${formatHms(total.totalGrossSeconds)} (${formatHuman(total.totalGrossSeconds)})`);
  lines.push(`Break total : ${formatHms(total.totalBreakSeconds)} (${formatHuman(total.totalBreakSeconds)})`);
  lines.push(`Net total   : ${formatHms(total.totalSeconds)} (${formatHuman(total.totalSeconds)})`);
  lines.push(`Decimal hrs : ${toDecimalHours(total.totalSeconds).toFixed(3)}h`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// History (localStorage) — max 20
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:tdc:history";
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
// Shareable URL (fragment-encoded — never sent to server)
// ---------------------------------------------------------------------------

export interface ShareState {
  mode: "arithmetic" | "between" | "timesheet";
  op?: Operation;
  aDays?: number;
  aHours?: number;
  aMinutes?: number;
  aSeconds?: number;
  bDays?: number;
  bHours?: number;
  bMinutes?: number;
  bSeconds?: number;
  factor?: number;
  start?: string;
  end?: string;
  nextDay?: boolean;
  rows?: string;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  params.set("mode", state.mode);
  if (state.mode === "arithmetic" && state.op) {
    params.set("op", state.op);
    const a = `${state.aDays ?? 0}|${state.aHours ?? 0}|${state.aMinutes ?? 0}|${state.aSeconds ?? 0}`;
    params.set("a", a);
    if (state.op === "multiply" || state.op === "divide") {
      if (typeof state.factor === "number") params.set("f", String(state.factor));
    } else {
      const b = `${state.bDays ?? 0}|${state.bHours ?? 0}|${state.bMinutes ?? 0}|${state.bSeconds ?? 0}`;
      params.set("b", b);
    }
  } else if (state.mode === "between") {
    if (state.start) params.set("start", state.start);
    if (state.end) params.set("end", state.end);
    if (state.nextDay) params.set("nextDay", "1");
  } else if (state.mode === "timesheet") {
    if (state.rows) params.set("rows", state.rows);
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState> | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const mode = (params.get("mode") as ShareState["mode"] | null) ?? "arithmetic";
  const out: Partial<ShareState> = { mode };

  if (mode === "arithmetic") {
    const op = params.get("op") as Operation | null;
    if (op) out.op = op;
    const aStr = params.get("a");
    if (aStr) {
      const [d, h, m, s] = aStr.split("|").map(Number);
      out.aDays = d; out.aHours = h; out.aMinutes = m; out.aSeconds = s;
    }
    const bStr = params.get("b");
    if (bStr) {
      const [d, h, m, s] = bStr.split("|").map(Number);
      out.bDays = d; out.bHours = h; out.bMinutes = m; out.bSeconds = s;
    }
    const fStr = params.get("f");
    if (fStr !== null) out.factor = Number(fStr);
  } else if (mode === "between") {
    out.start = params.get("start") ?? undefined;
    out.end = params.get("end") ?? undefined;
    out.nextDay = params.get("nextDay") === "1";
  } else if (mode === "timesheet") {
    out.rows = params.get("rows") ?? undefined;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Round seconds to the nearest minute (for payroll rounding). */
export function roundToMinute(seconds: number): number {
  return Math.round(seconds / SECONDS_PER_MINUTE) * SECONDS_PER_MINUTE;
}

/** Floor seconds to the nearest minute (conservative payroll rounding). */
export function floorToMinute(seconds: number): number {
  return Math.floor(seconds / SECONDS_PER_MINUTE) * SECONDS_PER_MINUTE;
}

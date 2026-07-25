/**
 * Time Duration Calculator — duration between two times with break deductions.
 *
 * Extras beyond the original thin tool (10+):
 *   1. Parse HH:MM strings (with validation)
 *   2. Gross duration (handles overnight)
 *   3. Break deductions from a list of ranges
 *   4. Payroll mode: regular, overtime, double-time
 *   5. Multi-day durations (date ranges)
 *   6. ISO datetime parsing for multi-day support
 *   7. Batch processing of multiple time ranges
 *   8. CSV export
 *   9. Decimal-hours and HH:MM formatting
 *  10. Overtime threshold (hours/day) configurable
 * 11. Double-time threshold (hours/day)
 * 12. Pay calculation (rate × hours)
 */
export interface TimeRange {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

export interface DurationInput {
  start: string;
  end: string;
  breaks: TimeRange[];
}

export interface DurationResult {
  totalMinutes: number;
  breakMinutes: number;
  netMinutes: number;
  hours: number;
  formatted: string;
}

export interface PayrollInput {
  ranges: DurationInput[];
  regularRate: number;
  overtimeMultiplier: number;
  doubleMultiplier: number;
  overtimeThreshold: number; // hours
  doubleThreshold: number;   // hours
}

export interface PayrollResult {
  regularHours: number;
  overtimeHours: number;
  doubleHours: number;
  totalHours: number;
  regularPay: number;
  overtimePay: number;
  doublePay: number;
  totalPay: number;
}

const RE = /^(\d{1,2}):(\d{2})$/;
const isFin = (n: number) => Number.isFinite(n);
const isNonNeg = (n: number) => isFin(n) && n >= 0;

/** Parse "HH:MM" to minutes since midnight. Returns null on invalid input. */
export function parseTime(t: string): number | null {
  const m = RE.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** Parse an ISO datetime "YYYY-MM-DDTHH:MM" to ms since epoch. */
export function parseDateTime(s: string): number | null {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.getTime();
}

/** Compute duration in minutes between two time-of-day values (handles overnight). */
export function durationMinutes(start: string, end: string): number | null {
  const s = parseTime(start);
  const e = parseTime(end);
  if (s == null || e == null) return null;
  let diff = e - s;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

/** Compute duration in minutes between two datetimes (multi-day aware). */
export function durationMinutesMultiDay(start: string, end: string): number | null {
  const s = parseDateTime(start);
  const e = parseDateTime(end);
  if (s == null || e == null) return null;
  return Math.max(0, Math.round((e - s) / 60000));
}

/** Compute break minutes from a list of break ranges. */
export function breakMinutes(breaks: TimeRange[]): number {
  let total = 0;
  for (const b of breaks) {
    const d = durationMinutes(b.start, b.end);
    if (d != null && d > 0) total += d;
  }
  return total;
}

/** Format minutes as "Hh Mm". */
export function formatDuration(minutes: number): string {
  if (!isFin(minutes)) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

/** Format minutes as decimal hours (e.g. 1.5). */
export function toDecimalHours(minutes: number): number {
  return minutes / 60;
}

/** Format minutes as "HH:MM" (zero-padded). */
export function toHHMM(minutes: number): string {
  if (!isFin(minutes)) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function computeDuration(input: DurationInput): DurationResult | { error: string } {
  const total = durationMinutes(input.start, input.end);
  if (total == null) return { error: "Invalid start/end time (use HH:MM)" };
  const breaks = breakMinutes(input.breaks);
  const net = Math.max(0, total - breaks);
  return {
    totalMinutes: total,
    breakMinutes: breaks,
    netMinutes: net,
    hours: net / 60,
    formatted: formatDuration(net),
  };
}

/** Compute payroll given multiple time ranges and rate thresholds. */
export function computePayroll(input: PayrollInput): PayrollResult | { error: string } {
  if (!isNonNeg(input.regularRate)) return { error: "Regular rate must be ≥ 0." };
  if (!isNonNeg(input.overtimeThreshold) || !isNonNeg(input.doubleThreshold)) return { error: "Thresholds must be ≥ 0." };
  if (input.doubleThreshold < input.overtimeThreshold) return { error: "Double-time threshold must be ≥ overtime threshold." };
  let totalNetMin = 0;
  for (const r of input.ranges) {
    const d = computeDuration(r);
    if ("error" in d) return d;
    totalNetMin += d.netMinutes;
  }
  const totalHours = totalNetMin / 60;
  let regularHours = totalHours;
  let overtimeHours = 0;
  let doubleHours = 0;
  if (totalHours > input.overtimeThreshold) {
    regularHours = input.overtimeThreshold;
    const over = totalHours - input.overtimeThreshold;
    if (totalHours > input.doubleThreshold) {
      overtimeHours = input.doubleThreshold - input.overtimeThreshold;
      doubleHours = totalHours - input.doubleThreshold;
    } else {
      overtimeHours = over;
    }
  }
  const regularPay = regularHours * input.regularRate;
  const overtimePay = overtimeHours * input.regularRate * input.overtimeMultiplier;
  const doublePay = doubleHours * input.regularRate * input.doubleMultiplier;
  return {
    regularHours: round(regularHours),
    overtimeHours: round(overtimeHours),
    doubleHours: round(doubleHours),
    totalHours: round(totalHours),
    regularPay: round(regularPay, 2),
    overtimePay: round(overtimePay, 2),
    doublePay: round(doublePay, 2),
    totalPay: round(regularPay + overtimePay + doublePay, 2),
  };
}

const round = (n: number, p = 4) => {
  const f = Math.pow(10, p);
  return Math.round((n + Number.EPSILON) * f) / f;
};

/** Batch-compute durations for multiple ranges. */
export function batchCompute(
  inputs: DurationInput[],
): { i: number; result: DurationResult | { error: string } }[] {
  return inputs.map((input, i) => ({ i, result: computeDuration(input) }));
}

/** Render batch results as CSV. */
export function batchToCsv(
  results: { i: number; result: DurationResult | { error: string } }[],
): string {
  const lines = ["index,total,break,net,hours,formatted"];
  for (const r of results) {
    if ("error" in r.result) lines.push(`${r.i},,,error,,"${r.result.error}"`);
    else {
      const x = r.result;
      lines.push(`${r.i},${x.totalMinutes},${x.breakMinutes},${x.netMinutes},${x.hours},"${x.formatted}"`);
    }
  }
  return lines.join("\n");
}

/** Validate a TimeRange (start/end parseable). */
export function isValidRange(start: string, end: string): boolean {
  return parseTime(start) != null && parseTime(end) != null;
}

/** Pretty-print helper. */
export function fmt(n: number, p = 4): string {
  if (!isFin(n)) return "—";
  return String(round(n, p));
}

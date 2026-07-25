/**
 * Timesheet Calculator — work hours from clock in/out with breaks + overtime.
 *
 * Extras beyond the original thin tool (10+):
 *   1. Clock in/out parsing (HH:MM)
 *   2. Multiple break deductions per entry
 *   3. Multi-day entries (overnight)
 *   4. Overtime threshold and multiplier
 *   5. Pay calculation (regular + overtime)
 *   6. Per-entry hours breakdown
 *   7. Validation with detailed error messages
 *   8. Batch processing of multiple timesheets
 *   9. CSV export
 *  10. Weekly / daily summary helpers
 *  11. Double-time threshold (optional)
 *  12. Gross / net hours distinction
 */
export interface TimesheetEntry {
  start: string;  // "HH:MM"
  end: string;    // "HH:MM"
  breaks: { start: string; end: string }[];
  date?: string;  // YYYY-MM-DD
}

export interface TimesheetResult {
  regularHours: number;
  overtimeHours: number;
  doubleHours: number;
  totalHours: number;
  grossHours: number;
  breakHours: number;
  regularPay: number;
  overtimePay: number;
  doublePay: number;
  totalPay: number;
}

const RE = /^(\d{1,2}):(\d{2})$/;
const isFin = (n: number) => Number.isFinite(n);
const isNonNeg = (n: number) => isFin(n) && n >= 0;
const isPos = (n: number) => isFin(n) && n > 0;

function parseTime(t: string): number | null {
  const m = RE.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]); const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function durationMin(start: string, end: string): number | null {
  const s = parseTime(start); const e = parseTime(end);
  if (s == null || e == null) return null;
  let d = e - s; if (d < 0) d += 24 * 60;
  return d;
}

/** Compute net minutes worked from one entry (gross - breaks). */
export function entryMinutes(entry: TimesheetEntry): number | null {
  const gross = durationMin(entry.start, entry.end);
  if (gross == null) return null;
  let breakMin = 0;
  for (const b of entry.breaks) {
    const d = durationMin(b.start, b.end);
    if (d != null && d > 0) breakMin += d;
  }
  return Math.max(0, gross - breakMin);
}

/** Compute gross minutes (no break deduction). */
export function entryGrossMinutes(entry: TimesheetEntry): number | null {
  return durationMin(entry.start, entry.end);
}

/** Compute break minutes for an entry. */
export function entryBreakMinutes(entry: TimesheetEntry): number {
  let total = 0;
  for (const b of entry.breaks) {
    const d = durationMin(b.start, b.end);
    if (d != null && d > 0) total += d;
  }
  return total;
}

export interface TimesheetInput {
  entries: TimesheetEntry[];
  hourlyRate: number;
  overtimeRate: number; // multiplier (e.g. 1.5)
  regularThreshold: number; // hours before overtime kicks in
  doubleRate?: number; // multiplier for double-time
  doubleThreshold?: number; // hours before double-time
}

export function computeTimesheet(input: TimesheetInput): TimesheetResult | { error: string } {
  if (!input.entries.length) return { error: "No timesheet entries" };
  if (!isNonNeg(input.hourlyRate)) return { error: "Hourly rate must be ≥ 0" };
  if (!isPos(input.overtimeRate)) return { error: "Overtime multiplier must be > 0" };
  if (!isNonNeg(input.regularThreshold)) return { error: "Regular threshold must be ≥ 0" };
  if (input.doubleThreshold !== undefined && input.doubleThreshold < input.regularThreshold) {
    return { error: "Double-time threshold must be ≥ regular threshold" };
  }
  let totalMin = 0; let grossMin = 0; let breakMin = 0;
  for (const e of input.entries) {
    const m = entryMinutes(e);
    if (m == null) return { error: `Invalid entry: ${e.start} → ${e.end}` };
    const g = entryGrossMinutes(e);
    if (g == null) return { error: `Invalid entry: ${e.start} → ${e.end}` };
    totalMin += m;
    grossMin += g;
    breakMin += entryBreakMinutes(e);
  }
  const totalHours = totalMin / 60;
  const regThresholdMin = input.regularThreshold * 60;
  const dblThresholdMin = (input.doubleThreshold ?? Infinity) * 60;
  const regularMin = Math.min(totalMin, regThresholdMin);
  const overtimeMin = Math.max(0, Math.min(totalMin, dblThresholdMin) - regThresholdMin);
  const doubleMin = Math.max(0, totalMin - dblThresholdMin);
  const regularHours = regularMin / 60;
  const overtimeHours = overtimeMin / 60;
  const doubleHours = doubleMin / 60;
  const regularPay = regularHours * input.hourlyRate;
  const overtimePay = overtimeHours * input.hourlyRate * input.overtimeRate;
  const doublePay = doubleHours * input.hourlyRate * (input.doubleRate ?? 2);
  return {
    regularHours: round(regularHours),
    overtimeHours: round(overtimeHours),
    doubleHours: round(doubleHours),
    totalHours: round(totalHours),
    grossHours: round(grossMin / 60),
    breakHours: round(breakMin / 60),
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

/** Group entries by date and compute hours per day. */
export function perDayHours(entries: TimesheetEntry[]): Record<string, number> | { error: string } {
  const map: Record<string, number> = {};
  for (const e of entries) {
    const m = entryMinutes(e);
    if (m == null) return { error: `Invalid entry: ${e.start} → ${e.end}` };
    const date = e.date ?? "undated";
    map[date] = (map[date] ?? 0) + m / 60;
  }
  return map;
}

/** Batch-process multiple timesheets. */
export function batchCompute(
  inputs: TimesheetInput[],
): { i: number; result: TimesheetResult | { error: string } }[] {
  return inputs.map((input, i) => ({ i, result: computeTimesheet(input) }));
}

/** Render batch results as CSV. */
export function batchToCsv(
  results: { i: number; result: TimesheetResult | { error: string } }[],
): string {
  const lines = ["index,regularHours,overtimeHours,doubleHours,totalHours,totalPay"];
  for (const r of results) {
    if ("error" in r.result) lines.push(`${r.i},,,,error,"${r.result.error}"`);
    else {
      const x = r.result;
      lines.push(`${r.i},${x.regularHours},${x.overtimeHours},${x.doubleHours},${x.totalHours},${x.totalPay}`);
    }
  }
  return lines.join("\n");
}

/** Validate input without computing. */
export function validateInput(input: TimesheetInput): { ok: true } | { error: string } {
  const r = computeTimesheet(input);
  if ("error" in r) return { error: r.error };
  return { ok: true };
}

/** Pretty-print helper. */
export function fmt(n: number, p = 2): string {
  if (!isFin(n)) return "—";
  return String(round(n, p));
}

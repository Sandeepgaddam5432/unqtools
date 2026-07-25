/**
 * Timesheet Calculator — work hours from clock in/out with breaks + overtime.
 */
export interface TimesheetEntry {
  start: string;  // "HH:MM"
  end: string;    // "HH:MM"
  breaks: { start: string; end: string }[];
}

export interface TimesheetResult {
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  regularPay: number;
  overtimePay: number;
  totalPay: number;
}

const RE = /^(\d{1,2}):(\d{2})$/;

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

export interface TimesheetInput {
  entries: TimesheetEntry[];
  hourlyRate: number;
  overtimeRate: number; // multiplier (e.g. 1.5)
  regularThreshold: number; // hours per day/week before overtime kicks in
}

export function computeTimesheet(input: TimesheetInput): TimesheetResult | { error: string } {
  if (input.entries.length === 0) return { error: "No timesheet entries" };
  let totalMin = 0;
  for (const e of input.entries) {
    const m = entryMinutes(e);
    if (m == null) return { error: `Invalid entry: ${e.start} → ${e.end}` };
    totalMin += m;
  }
  const totalHours = totalMin / 60;
  const regThresholdMin = input.regularThreshold * 60;
  const regularMin = Math.min(totalMin, regThresholdMin);
  const overtimeMin = Math.max(0, totalMin - regThresholdMin);
  const regularHours = regularMin / 60;
  const overtimeHours = overtimeMin / 60;
  const regularPay = regularHours * input.hourlyRate;
  const overtimePay = overtimeHours * input.hourlyRate * input.overtimeRate;
  return {
    regularHours,
    overtimeHours,
    totalHours,
    regularPay,
    overtimePay,
    totalPay: regularPay + overtimePay,
  };
}

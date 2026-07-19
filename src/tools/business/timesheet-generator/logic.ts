/**
 * Timesheet Generator — pure logic.
 *
 * Parse clock-in/out entries into per-day worked hours, sum weekly totals,
 * apply overtime threshold + multiplier, and compute gross pay. Pure
 * functions only — no DOM, no network.
 */

// ---- Types ----

export type PayPeriodType = "weekly" | "bi-weekly" | "semi-monthly" | "monthly";

export interface TimeEntry {
  date: string;        // YYYY-MM-DD
  clockIn: string;     // HH:MM (24h)
  clockOut: string;    // HH:MM (24h)
  breakMinutes: number;
}

export interface ParsedLine {
  ok: boolean;
  entry: TimeEntry | null;
  error: string | null;
  raw: string;
  lineNo: number;
}

export interface EntryPay {
  entry: TimeEntry;
  workedHours: number;     // decimal hours (worked minus break)
  regularHours: number;    // portion counted as regular
  overtimeHours: number;   // portion counted as overtime
  regularPay: number;
  overtimePay: number;
  pay: number;             // regularPay + overtimePay
}

export interface TimesheetResult {
  employeeName: string;
  weekStartDate: string;
  payPeriodType: PayPeriodType;
  entries: EntryPay[];
  errors: ParsedLine[];
  totalWorkedHours: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalBreakMinutes: number;
  grossPay: number;
  hourlyRate: number;
  overtimeThreshold: number;
  overtimeRate: number;
  daysWorked: number;
  notes: string[];
}

export interface TimesheetStats {
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  grossPay: number;
  daysWorked: number;
  entryCount: number;
  errorCount: number;
  avgHoursPerDay: number;
  hasOvertime: boolean;
}

export interface TimesheetInput {
  employeeName: string;
  weekStartDate: string;
  payPeriodType: PayPeriodType;
  entriesText: string;
  hourlyRate: number;
  overtimeThreshold: number;
  overtimeRate: number;
}

export interface HistoryEntry {
  ts: number;
  employeeName: string;
  weekStartDate: string;
  payPeriodType: PayPeriodType;
  totalHours: number;
  grossPay: number;
  daysWorked: number;
}

// ---- Constants / presets ----

export const PAY_PERIOD_TYPES: PayPeriodType[] = [
  "weekly", "bi-weekly", "semi-monthly", "monthly",
];

export const PAY_PERIOD_LABELS: Record<PayPeriodType, string> = {
  "weekly": "Weekly",
  "bi-weekly": "Bi-Weekly",
  "semi-monthly": "Semi-Monthly",
  "monthly": "Monthly",
};

/** Periods per year — useful for downstream per-period extrapolation. */
export const PAY_PERIODS_PER_YEAR: Record<PayPeriodType, number> = {
  "weekly": 52,
  "bi-weekly": 26,
  "semi-monthly": 24,
  "monthly": 12,
};

/** Quick-select break durations (minutes). */
export const BREAK_PRESETS: number[] = [0, 30, 60, 90];

export const DEFAULT_OVERTIME_THRESHOLD = 40;
export const DEFAULT_OVERTIME_RATE = 1.5;
export const DEFAULT_HOURLY_RATE = 0; // optional — 0 means "hours only, no pay"

export const DEFAULT_INPUT: TimesheetInput = {
  employeeName: "",
  weekStartDate: isoMondayOfToday(),
  payPeriodType: "weekly",
  entriesText: "",
  hourlyRate: DEFAULT_HOURLY_RATE,
  overtimeThreshold: DEFAULT_OVERTIME_THRESHOLD,
  overtimeRate: DEFAULT_OVERTIME_RATE,
};

// ---- Helpers ----

export function normalizeEmployeeName(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

export function clampNonNegative(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function round4(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

/** Validate a YYYY-MM-DD date string. */
export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return false;
  const d = new Date(s + "T00:00:00");
  return !Number.isNaN(d.getTime());
}

/** Validate a 24h HH:MM time string. */
export function isValidTime(s: string): boolean {
  return /^\d{2}:\d{2}$/.test(s || "") && timeToMinutes(s || "0") !== -1;
}

/** Convert HH:MM → minutes since midnight. Returns -1 for invalid input. */
export function timeToMinutes(s: string): number {
  const m = (s || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return -1;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return -1;
  return h * 60 + min;
}

/** Convert minutes since midnight → HH:MM. */
export function minutesToTime(min: number): string {
  if (!Number.isFinite(min) || min < 0) min = 0;
  // Wrap around 24h if min exceeds 1440
  const wrapped = ((Math.floor(min) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Convert HH:MM → decimal hours. Returns 0 for invalid input. */
export function timeToHours(s: string): number {
  const min = timeToMinutes(s);
  if (min < 0) return 0;
  return min / 60;
}

/** Convert decimal hours → HH:MM. */
export function hoursToTime(hours: number): string {
  if (!Number.isFinite(hours) || hours < 0) hours = 0;
  return minutesToTime(hours * 60);
}

/** Format decimal hours as "Xh YYm" for human display. */
export function formatHoursHuman(hours: number): string {
  if (!Number.isFinite(hours) || hours < 0) hours = 0;
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** ISO date (YYYY-MM-DD) of the Monday of the current week. */
function isoMondayOfToday(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const d = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Add N days to a YYYY-MM-DD string; returns YYYY-MM-DD. */
export function addDays(dateStr: string, n: number): string {
  if (!isValidDate(dateStr)) return dateStr;
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---- Entry parsing ----

/** Parse a single line: `date,clock_in,clock_out,break_minutes`. */
export function parseEntryLine(line: string, lineNo: number = 1): ParsedLine {
  const raw = (line || "").trim();
  if (!raw) {
    return { ok: false, entry: null, error: "Empty line", raw, lineNo };
  }
  const parts = raw.split(",").map((p) => p.trim());
  if (parts.length < 4) {
    return { ok: false, entry: null, error: `Expected 4 fields (date,clock_in,clock_out,break_minutes) — got ${parts.length}`, raw, lineNo };
  }
  const [date, clockIn, clockOut, breakStr] = parts;
  if (!isValidDate(date)) {
    return { ok: false, entry: null, error: `Invalid date "${date}" (expected YYYY-MM-DD)`, raw, lineNo };
  }
  if (!isValidTime(clockIn)) {
    return { ok: false, entry: null, error: `Invalid clock-in "${clockIn}" (expected HH:MM 24h)`, raw, lineNo };
  }
  if (!isValidTime(clockOut)) {
    return { ok: false, entry: null, error: `Invalid clock-out "${clockOut}" (expected HH:MM 24h)`, raw, lineNo };
  }
  const breakMinutes = Number(breakStr);
  if (!Number.isFinite(breakMinutes) || breakMinutes < 0) {
    return { ok: false, entry: null, error: `Invalid break "${breakStr}" (expected non-negative minutes)`, raw, lineNo };
  }
  // Cross-field: clock-out must be after clock-in (no overnight shifts in this simple model)
  const inMin = timeToMinutes(clockIn);
  const outMin = timeToMinutes(clockOut);
  if (outMin <= inMin) {
    return { ok: false, entry: null, error: `clock-out (${clockOut}) must be after clock-in (${clockIn}) — overnight shifts not supported`, raw, lineNo };
  }
  // Break can't exceed worked span
  const spanMin = outMin - inMin;
  if (breakMinutes > spanMin) {
    return { ok: false, entry: null, error: `break (${breakMinutes} min) exceeds worked span (${spanMin} min)`, raw, lineNo };
  }
  return {
    ok: true,
    entry: { date, clockIn, clockOut, breakMinutes },
    error: null,
    raw,
    lineNo,
  };
}

/** Parse a multi-line entries block. Returns ParsedLine[] preserving order. */
export function parseEntries(text: string): ParsedLine[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const out: ParsedLine[] = [];
  let lineNo = 0;
  for (const line of lines) {
    lineNo += 1;
    if (!line.trim()) continue; // skip blank lines silently
    out.push(parseEntryLine(line, lineNo));
  }
  return out;
}

// ---- Core calculators ----

/** Per-entry worked hours = (clockOut - clockIn) - breakMinutes/60. */
export function computeWorkedHours(entry: TimeEntry): number {
  const inMin = timeToMinutes(entry.clockIn);
  const outMin = timeToMinutes(entry.clockOut);
  if (inMin < 0 || outMin < 0 || outMin <= inMin) return 0;
  const spanHours = (outMin - inMin) / 60;
  const breakHours = clampNonNegative(entry.breakMinutes) / 60;
  return Math.max(0, spanHours - breakHours);
}

/** Split weekly total into regular vs overtime hours. */
export function computeOvertime(
  totalHours: number,
  threshold: number,
): { regular: number; overtime: number } {
  const t = clampNonNegative(totalHours);
  const th = clampNonNegative(threshold);
  if (t <= th) return { regular: t, overtime: 0 };
  return { regular: th, overtime: t - th };
}

/** Compute regular pay = regularHours × rate. */
export function computeRegularPay(regularHours: number, hourlyRate: number): number {
  return clampNonNegative(regularHours) * clampNonNegative(hourlyRate);
}

/** Compute overtime pay = overtimeHours × rate × multiplier. */
export function computeOvertimePay(overtimeHours: number, hourlyRate: number, overtimeRate: number): number {
  const mul = clampNonNegative(overtimeRate) || 1;
  return clampNonNegative(overtimeHours) * clampNonNegative(hourlyRate) * mul;
}

/** Compute gross pay = regular pay + overtime pay. */
export function computeGrossPay(regularPay: number, overtimePay: number): number {
  return clampNonNegative(regularPay) + clampNonNegative(overtimePay);
}

/**
 * Distribute weekly regular/overtime totals across entries in date order.
 * First entries fill the threshold with regular hours; later entries
 * accumulate overtime. Returns per-entry pay breakdown.
 */
export function computeEntryPays(
  entries: TimeEntry[],
  hourlyRate: number,
  overtimeThreshold: number,
  overtimeRate: number,
): EntryPay[] {
  const rate = clampNonNegative(hourlyRate);
  const mul = clampNonNegative(overtimeRate) || 1;
  const th = clampNonNegative(overtimeThreshold);

  // Sort by date then clock-in for stable OT allocation
  const sorted = [...entries].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.clockIn.localeCompare(b.clockIn);
  });

  let remainingRegular = th;
  const out: EntryPay[] = [];
  for (const entry of sorted) {
    const worked = computeWorkedHours(entry);
    const regular = Math.min(worked, remainingRegular);
    const overtime = Math.max(0, worked - regular);
    remainingRegular = Math.max(0, remainingRegular - regular);
    const regularPay = regular * rate;
    const overtimePay = overtime * rate * mul;
    out.push({
      entry,
      workedHours: round4(worked),
      regularHours: round4(regular),
      overtimeHours: round4(overtime),
      regularPay: round2(regularPay),
      overtimePay: round2(overtimePay),
      pay: round2(regularPay + overtimePay),
    });
  }
  return out;
}

/** Compute the full timesheet result from input. */
export function computeTimesheet(input: TimesheetInput): TimesheetResult {
  const parsed = parseEntries(input.entriesText);
  const errors = parsed.filter((p) => !p.ok);
  const validEntries = parsed
    .filter((p): p is ParsedLine & { entry: TimeEntry } => p.ok && p.entry !== null)
    .map((p) => p.entry as TimeEntry);

  const notes: string[] = [];

  const entryPays = computeEntryPays(
    validEntries,
    input.hourlyRate,
    input.overtimeThreshold,
    input.overtimeRate,
  );

  const totalWorkedHours = entryPays.reduce((acc, e) => acc + e.workedHours, 0);
  const totalRegularHours = entryPays.reduce((acc, e) => acc + e.regularHours, 0);
  const totalOvertimeHours = entryPays.reduce((acc, e) => acc + e.overtimeHours, 0);
  const totalBreakMinutes = validEntries.reduce((acc, e) => acc + e.breakMinutes, 0);
  const grossPay = entryPays.reduce((acc, e) => acc + e.pay, 0);
  const daysWorked = new Set(validEntries.map((e) => e.date)).size;

  if (errors.length > 0) {
    notes.push(`${errors.length} entr${errors.length === 1 ? "y" : "ies"} could not be parsed — see errors above.`);
  }
  if (input.hourlyRate <= 0) {
    notes.push("No hourly rate set — pay values are 0. Set an hourly rate to compute pay.");
  }
  if (totalOvertimeHours > 0) {
    notes.push(`Overtime: ${round2(totalOvertimeHours)} hrs × ${input.hourlyRate}/hr × ${input.overtimeRate}x.`);
  }
  notes.push("Overtime is computed on the weekly total per FLSA-style rules — verify with HR/payroll before filing.");

  return {
    employeeName: normalizeEmployeeName(input.employeeName) || "Employee",
    weekStartDate: input.weekStartDate,
    payPeriodType: input.payPeriodType,
    entries: entryPays,
    errors,
    totalWorkedHours: round4(totalWorkedHours),
    totalRegularHours: round4(totalRegularHours),
    totalOvertimeHours: round4(totalOvertimeHours),
    totalBreakMinutes,
    grossPay: round2(grossPay),
    hourlyRate: clampNonNegative(input.hourlyRate),
    overtimeThreshold: clampNonNegative(input.overtimeThreshold),
    overtimeRate: clampNonNegative(input.overtimeRate) || 1,
    daysWorked,
    notes,
  };
}

/** Build a daily breakdown report (one row per unique date). */
export interface DailyBreakdownRow {
  date: string;
  entryCount: number;
  workedHours: number;
  regularHours: number;
  overtimeHours: number;
  breakMinutes: number;
  pay: number;
}

export function dailyBreakdown(result: TimesheetResult): DailyBreakdownRow[] {
  const map = new Map<string, DailyBreakdownRow>();
  for (const e of result.entries) {
    const d = e.entry.date;
    const row = map.get(d) ?? {
      date: d,
      entryCount: 0,
      workedHours: 0,
      regularHours: 0,
      overtimeHours: 0,
      breakMinutes: 0,
      pay: 0,
    };
    row.entryCount += 1;
    row.workedHours += e.workedHours;
    row.regularHours += e.regularHours;
    row.overtimeHours += e.overtimeHours;
    row.breakMinutes += e.entry.breakMinutes;
    row.pay += e.pay;
    map.set(d, row);
  }
  const out = Array.from(map.values());
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out.map((r) => ({
    ...r,
    workedHours: round4(r.workedHours),
    regularHours: round4(r.regularHours),
    overtimeHours: round4(r.overtimeHours),
    pay: round2(r.pay),
  }));
}

/** Compute summary stats from a TimesheetResult. */
export function summaryStats(result: TimesheetResult): TimesheetStats {
  const avg = result.daysWorked > 0 ? result.totalWorkedHours / result.daysWorked : 0;
  return {
    totalHours: round4(result.totalWorkedHours),
    regularHours: round4(result.totalRegularHours),
    overtimeHours: round4(result.totalOvertimeHours),
    grossPay: result.grossPay,
    daysWorked: result.daysWorked,
    entryCount: result.entries.length,
    errorCount: result.errors.length,
    avgHoursPerDay: round4(avg),
    hasOvertime: result.totalOvertimeHours > 0,
  };
}

// ---- Formatting ----

export function formatCurrency(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  return `${sign}$${abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatHoursDecimal(hours: number): string {
  return `${round2(hours).toFixed(2)} hrs`;
}

// ---- Rendering ----

/** Render the timesheet as plain text. */
export function renderText(result: TimesheetResult): string {
  const lines: string[] = [];
  lines.push("=".repeat(72));
  lines.push("                          TIMESHEET");
  lines.push("=".repeat(72));
  lines.push(`Employee:        ${result.employeeName}`);
  lines.push(`Week starting:   ${result.weekStartDate}`);
  lines.push(`Pay period:      ${PAY_PERIOD_LABELS[result.payPeriodType]}`);
  if (result.hourlyRate > 0) {
    lines.push(`Hourly rate:     $${result.hourlyRate.toFixed(2)}/hr`);
    lines.push(`Overtime:        ${result.overtimeThreshold} hrs threshold × ${result.overtimeRate}x`);
  }
  lines.push("-".repeat(72));
  lines.push("DAILY ENTRIES");
  lines.push("-".repeat(72));
  lines.push(
    "Date         In     Out    Break   Worked   Reg.    OT      Pay".padEnd(72),
  );
  for (const e of result.entries) {
    lines.push(
      [
        e.entry.date,
        e.entry.clockIn,
        e.entry.clockOut,
        `${e.entry.breakMinutes}m`,
        e.workedHours.toFixed(2),
        e.regularHours.toFixed(2),
        e.overtimeHours.toFixed(2),
        result.hourlyRate > 0 ? formatCurrency(e.pay) : "—",
      ].join("  ").padEnd(72),
    );
  }
  if (result.entries.length === 0) {
    lines.push("(no valid entries)");
  }
  lines.push("-".repeat(72));
  lines.push("WEEKLY SUMMARY");
  lines.push("-".repeat(72));
  lines.push(`  Days worked:       ${result.daysWorked}`);
  lines.push(`  Total break:       ${result.totalBreakMinutes} min`);
  lines.push(`  Total hours:       ${formatHoursDecimal(result.totalWorkedHours)}  (${formatHoursHuman(result.totalWorkedHours)})`);
  lines.push(`  Regular hours:     ${formatHoursDecimal(result.totalRegularHours)}`);
  if (result.totalOvertimeHours > 0) {
    lines.push(`  Overtime hours:    ${formatHoursDecimal(result.totalOvertimeHours)}`);
  }
  if (result.hourlyRate > 0) {
    lines.push(`  Gross pay:         ${formatCurrency(result.grossPay)}`);
  }
  if (result.errors.length > 0) {
    lines.push("-".repeat(72));
    lines.push("PARSE ERRORS");
    lines.push("-".repeat(72));
    for (const e of result.errors) {
      lines.push(`  Line ${e.lineNo}: ${e.error}`);
      lines.push(`    ${e.raw}`);
    }
  }
  if (result.notes.length > 0) {
    lines.push("-".repeat(72));
    for (const n of result.notes) lines.push(`  • ${n}`);
  }
  lines.push("=".repeat(72));
  lines.push("Generated by UnQTools Timesheet Generator — 100% client-side.");
  lines.push("=".repeat(72));
  return lines.join("\n");
}

/** Render the timesheet as CSV (date, clock_in, clock_out, break, hours, regular, overtime, pay). */
export function renderCsv(result: TimesheetResult): string {
  const lines: string[] = [
    "date,clock_in,clock_out,break_minutes,hours,regular_hours,overtime_hours,pay",
  ];
  for (const e of result.entries) {
    lines.push([
      e.entry.date,
      e.entry.clockIn,
      e.entry.clockOut,
      String(e.entry.breakMinutes),
      e.workedHours.toFixed(4),
      e.regularHours.toFixed(4),
      e.overtimeHours.toFixed(4),
      e.pay.toFixed(2),
    ].join(","));
  }
  lines.push("");
  lines.push(`# employee,${csv(result.employeeName)}`);
  lines.push(`# week_start,${result.weekStartDate}`);
  lines.push(`# pay_period,${result.payPeriodType}`);
  lines.push(`# hourly_rate,${result.hourlyRate.toFixed(2)}`);
  lines.push(`# overtime_threshold,${result.overtimeThreshold}`);
  lines.push(`# overtime_rate,${result.overtimeRate}`);
  lines.push(`# days_worked,${result.daysWorked}`);
  lines.push(`# total_break_minutes,${result.totalBreakMinutes}`);
  lines.push(`# total_hours,${result.totalWorkedHours.toFixed(4)}`);
  lines.push(`# regular_hours,${result.totalRegularHours.toFixed(4)}`);
  lines.push(`# overtime_hours,${result.totalOvertimeHours.toFixed(4)}`);
  lines.push(`# gross_pay,${result.grossPay.toFixed(2)}`);
  return lines.join("\n");
}

/** Render the timesheet as a printable HTML document with inline CSS. */
export function renderHtml(result: TimesheetResult): string {
  const esc = (s: string) => (s || "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
  const rows = result.entries.length === 0
    ? `<tr><td colspan="8" style="text-align:center;color:#888;">No valid entries</td></tr>`
    : result.entries.map((e) => `
      <tr>
        <td>${esc(e.entry.date)}</td>
        <td>${esc(e.entry.clockIn)}</td>
        <td>${esc(e.entry.clockOut)}</td>
        <td style="text-align:right;">${e.entry.breakMinutes}m</td>
        <td style="text-align:right;">${e.workedHours.toFixed(2)}</td>
        <td style="text-align:right;">${e.regularHours.toFixed(2)}</td>
        <td style="text-align:right;">${e.overtimeHours.toFixed(2)}</td>
        <td style="text-align:right;">${result.hourlyRate > 0 ? formatCurrency(e.pay) : "—"}</td>
      </tr>`.trim()).join("\n");
  const otRow = result.totalOvertimeHours > 0
    ? `<tr><td colspan="5" style="text-align:right;">Overtime hours:</td><td colspan="3" style="text-align:right;">${result.totalOvertimeHours.toFixed(2)}</td></tr>`
    : "";
  const grossRow = result.hourlyRate > 0
    ? `<tr class="total"><td colspan="7" style="text-align:right;">Gross Pay:</td><td style="text-align:right;">${formatCurrency(result.grossPay)}</td></tr>`
    : "";
  const notesHtml = result.notes.length === 0
    ? ""
    : `<div class="notes"><strong>Notes:</strong><ul>${result.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></div>`;
  const errHtml = result.errors.length === 0
    ? ""
    : `<div class="errors"><strong>Parse errors (${result.errors.length}):</strong><ul>${result.errors.map((e) => `<li>Line ${e.lineNo}: ${esc(e.error || "")} — <code>${esc(e.raw)}</code></li>`).join("")}</ul></div>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Timesheet — ${esc(result.employeeName)} — ${esc(result.weekStartDate)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; max-width: 820px; margin: 32px auto; padding: 0 16px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .muted { color: #666; font-size: 12px; }
  header { border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 12px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin: 12px 0; font-size: 13px; }
  .grid div { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #eee; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  th { background: #f5f5f5; text-align: left; }
  tr.total td { font-weight: 700; border-top: 2px solid #333; border-bottom: none; }
  .notes, .errors { margin-top: 16px; padding: 8px 12px; border-radius: 6px; font-size: 11px; }
  .notes { background: #fafafa; color: #555; }
  .errors { background: #fff5f5; color: #800; }
  .notes ul, .errors ul { margin: 4px 0 0; padding-left: 18px; }
  @media print { body { margin: 0; } .notes, .errors { display: none; } }
</style>
</head>
<body>
<header>
  <h1>Timesheet</h1>
  <div class="muted">Generated ${new Date().toLocaleString()} — UnQTools Timesheet Generator</div>
</header>
<div class="grid">
  <div><span>Employee:</span><strong>${esc(result.employeeName)}</strong></div>
  <div><span>Week starting:</span><strong>${esc(result.weekStartDate)}</strong></div>
  <div><span>Pay period:</span>${PAY_PERIOD_LABELS[result.payPeriodType]}</div>
  <div><span>Days worked:</span>${result.daysWorked}</div>
  ${result.hourlyRate > 0 ? `<div><span>Hourly rate:</span>$${result.hourlyRate.toFixed(2)}/hr</div>` : ""}
  ${result.hourlyRate > 0 ? `<div><span>Overtime:</span>${result.overtimeThreshold} hrs × ${result.overtimeRate}x</div>` : ""}
  <div><span>Total hours:</span>${result.totalWorkedHours.toFixed(2)} (${formatHoursHuman(result.totalWorkedHours)})</div>
  <div><span>Total break:</span>${result.totalBreakMinutes} min</div>
</div>
<table>
  <thead>
    <tr><th>Date</th><th>In</th><th>Out</th><th>Break</th><th>Hours</th><th>Reg.</th><th>OT</th><th>Pay</th></tr>
  </thead>
  <tbody>
    ${rows}
    <tr class="total"><td colspan="4" style="text-align:right;">Total hours:</td><td style="text-align:right;">${result.totalWorkedHours.toFixed(2)}</td><td style="text-align:right;">${result.totalRegularHours.toFixed(2)}</td><td style="text-align:right;">${result.totalOvertimeHours.toFixed(2)}</td><td></td></tr>
    ${otRow}
    ${grossRow}
  </tbody>
</table>
${notesHtml}
${errHtml}
</body>
</html>`;
}

function csv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:timesheet-generator:history";
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

// ---- Shareable URL ----

const SHARE_KEYS: (keyof TimesheetInput)[] = [
  "employeeName", "weekStartDate", "payPeriodType",
  "entriesText", "hourlyRate", "overtimeThreshold", "overtimeRate",
];

export function buildShareUrl(input: TimesheetInput): string {
  const params = new URLSearchParams();
  for (const k of SHARE_KEYS) {
    const v = input[k];
    if (v === undefined || v === "") continue;
    params.set(k, String(v));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<TimesheetInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const input: Partial<TimesheetInput> = {};
  const name: keyof TimesheetInput = "employeeName";
  void name;
  const strKeys = new Set<keyof TimesheetInput>(["employeeName", "weekStartDate", "payPeriodType", "entriesText"]);
  const numKeys = new Set<keyof TimesheetInput>(["hourlyRate", "overtimeThreshold", "overtimeRate"]);
  for (const k of SHARE_KEYS) {
    const v = params.get(k);
    if (v === null) continue;
    if (strKeys.has(k)) {
      (input as Record<string, unknown>)[k] = v;
    } else if (numKeys.has(k)) {
      const n = Number(v);
      if (Number.isFinite(n)) (input as Record<string, unknown>)[k] = n;
    }
  }
  // Validate enums
  if (input.payPeriodType && !PAY_PERIOD_TYPES.includes(input.payPeriodType)) {
    delete input.payPeriodType;
  }
  return input;
}

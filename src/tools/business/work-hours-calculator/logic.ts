/**
 * Work Hours Calculator — pure logic.
 *
 * Calculate work hours between two times — handles overnight shifts,
 * breaks, overtime, and pay. Pure functions only — no DOM, no network.
 */

export type TimeFormat = "12h" | "24h";

export interface WorkHoursInput {
  startTime: string;
  endTime: string;
  breakMinutes: number;
  overnightShift: boolean;
  hourlyRate: number;
  overtimeAfterHours: number;
  overtimeRateMultiplier: number;
  dateFormat: TimeFormat;
}

export interface WorkHoursResult {
  startMinutes: number | null;
  endMinutes: number | null;
  /** end - start in minutes, after overnight adjustment */
  spanMinutes: number;
  /** span - break, in minutes */
  workedMinutes: number;
  workedHours: number;
  regularMinutes: number;
  regularHours: number;
  overtimeMinutes: number;
  overtimeHours: number;
  regularPay: number;
  overtimePay: number;
  totalPay: number;
  /** totalPay / workedHours (when both > 0) */
  effectiveRate: number;
  isOvernight: boolean;
  hasRate: boolean;
  hasOvertime: boolean;
  errors: string[];
}

export interface WorkHoursStats {
  workedHours: number;
  regularHours: number;
  overtimeHours: number;
  totalPay: number;
  effectiveRate: number;
  hasRate: boolean;
  hasOvertime: boolean;
  isOvernight: boolean;
}

export interface ShiftPreset {
  id: string;
  label: string;
  start: string;
  end: string;
  breakMinutes: number;
  overnight: boolean;
}

export const SHIFT_PRESETS: ShiftPreset[] = [
  { id: "9to5", label: "9 AM – 5 PM (standard)", start: "09:00", end: "17:00", breakMinutes: 30, overnight: false },
  { id: "8to4", label: "8 AM – 4 PM (early)", start: "08:00", end: "16:00", breakMinutes: 30, overnight: false },
  { id: "10to6", label: "10 AM – 6 PM (late)", start: "10:00", end: "18:00", breakMinutes: 30, overnight: false },
  { id: "night22to6", label: "10 PM – 6 AM (night)", start: "22:00", end: "06:00", breakMinutes: 30, overnight: true },
  { id: "evening14to22", label: "2 PM – 10 PM (evening)", start: "14:00", end: "22:00", breakMinutes: 30, overnight: false },
  { id: "split6to14", label: "6 AM – 2 PM (morning)", start: "06:00", end: "14:00", breakMinutes: 30, overnight: false },
];

export const BREAK_PRESETS: number[] = [0, 15, 30, 60, 90];

export const DEFAULT_INPUT: WorkHoursInput = {
  startTime: "09:00",
  endTime: "17:00",
  breakMinutes: 30,
  overnightShift: false,
  hourlyRate: 0,
  overtimeAfterHours: 8,
  overtimeRateMultiplier: 1.5,
  dateFormat: "24h",
};

export const RATE_PRESETS: number[] = [0, 15, 20, 25, 30, 50];

/** Parse a time string into minutes since midnight. Supports 12h and 24h. */
export function parseTime(s: string): number | null {
  if (!s) return null;
  const raw = s.trim().toLowerCase();
  if (!raw) return null;

  // 12h formats: "9:30 am", "09:30am", "9am", "12:00 pm", "12 pm"
  const ampmMatch = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const meridiem = ampmMatch[3];
    if (h < 1 || h > 12) return null;
    if (m < 0 || m > 59) return null;
    if (meridiem === "am") {
      if (h === 12) h = 0; // 12 AM → 0
    } else {
      if (h !== 12) h += 12; // 1 PM – 11 PM → 13..23
    }
    return h * 60 + m;
  }

  // 24h formats: "9:30", "09:30", "9", "23:59"
  const h24Match = raw.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (h24Match) {
    const h = parseInt(h24Match[1], 10);
    const m = h24Match[2] ? parseInt(h24Match[2], 10) : 0;
    if (h < 0 || h > 23) return null;
    if (m < 0 || m > 59) return null;
    return h * 60 + m;
  }

  return null;
}

/** Format minutes since midnight as a string in 12h or 24h format. */
export function formatTime(minutes: number, fmt: TimeFormat): string {
  if (!Number.isFinite(minutes)) return "--:--";
  const m24 = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(m24 / 60);
  const m = m24 % 60;
  const mm = String(m).padStart(2, "0");
  if (fmt === "24h") {
    return `${String(h).padStart(2, "0")}:${mm}`;
  }
  // 12h
  const meridiem = h < 12 ? "AM" : "PM";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${mm} ${meridiem}`;
}

/** Detect whether the end time is before the start (i.e. overnight shift). */
export function detectOvernight(startMinutes: number, endMinutes: number): boolean {
  return endMinutes < startMinutes;
}

/** Compute the span (end - start) in minutes, applying overnight if needed. */
export function computeSpanMinutes(
  startMinutes: number | null,
  endMinutes: number | null,
  overnight: boolean,
): number {
  if (startMinutes === null || endMinutes === null) return 0;
  let end = endMinutes;
  if (overnight && end < startMinutes) end += 24 * 60;
  return end - startMinutes;
}

/** Compute worked minutes = span - break (clamped to >= 0). */
export function computeWorkedMinutes(spanMinutes: number, breakMinutes: number): number {
  const b = Math.max(0, breakMinutes || 0);
  return Math.max(0, spanMinutes - b);
}

/** Split worked minutes into regular + overtime using a daily threshold (in hours). */
export function computeOvertimeSplit(
  workedMinutes: number,
  overtimeAfterHours: number,
): { regularMinutes: number; overtimeMinutes: number } {
  const thresholdMin = Math.max(0, overtimeAfterHours) * 60;
  if (workedMinutes <= thresholdMin) {
    return { regularMinutes: workedMinutes, overtimeMinutes: 0 };
  }
  return { regularMinutes: thresholdMin, overtimeMinutes: workedMinutes - thresholdMin };
}

/** Compute regular pay + overtime pay + total pay. */
export function computePay(
  regularHours: number,
  overtimeHours: number,
  hourlyRate: number,
  multiplier: number,
): { regularPay: number; overtimePay: number; totalPay: number } {
  const rate = Math.max(0, hourlyRate || 0);
  const mult = Math.max(0, multiplier || 0);
  const regularPay = regularHours * rate;
  const overtimePay = overtimeHours * rate * mult;
  return { regularPay, overtimePay, totalPay: regularPay + overtimePay };
}

/** Compute the effective hourly rate = totalPay / workedHours. */
export function computeEffectiveRate(totalPay: number, workedHours: number): number {
  if (workedHours <= 0) return 0;
  return totalPay / workedHours;
}

/** Run the full calculation from a WorkHoursInput. */
export function calculate(input: WorkHoursInput): WorkHoursResult {
  const errors: string[] = [];
  const startMinutes = parseTime(input.startTime);
  const endMinutes = parseTime(input.endTime);
  if (startMinutes === null) errors.push(`Invalid start time: "${input.startTime}"`);
  if (endMinutes === null) errors.push(`Invalid end time: "${input.endTime}"`);

  const breakMinutes = Math.max(0, input.breakMinutes || 0);
  const hourlyRate = Math.max(0, input.hourlyRate || 0);
  const overtimeAfterHours = Math.max(0, input.overtimeAfterHours || 0);
  const multiplier = Math.max(0, input.overtimeRateMultiplier || 0);

  if (startMinutes !== null && endMinutes !== null) {
    const autoOvernight = detectOvernight(startMinutes, endMinutes);
    const effectiveOvernight = input.overnightShift || autoOvernight;
    const spanMinutes = computeSpanMinutes(startMinutes, endMinutes, effectiveOvernight);
    if (spanMinutes < 0) errors.push("Span is negative — end time before start time.");
    if (breakMinutes > spanMinutes && spanMinutes >= 0) {
      errors.push(`Break (${breakMinutes} min) is longer than the span (${spanMinutes} min).`);
    }
    const workedMinutes = computeWorkedMinutes(spanMinutes, breakMinutes);
    const workedHours = workedMinutes / 60;
    const { regularMinutes, overtimeMinutes } = computeOvertimeSplit(workedMinutes, overtimeAfterHours);
    const regularHours = regularMinutes / 60;
    const overtimeHours = overtimeMinutes / 60;
    const { regularPay, overtimePay, totalPay } = computePay(
      regularHours,
      overtimeHours,
      hourlyRate,
      multiplier,
    );
    const effectiveRate = computeEffectiveRate(totalPay, workedHours);
    return {
      startMinutes,
      endMinutes,
      spanMinutes,
      workedMinutes,
      workedHours,
      regularMinutes,
      regularHours,
      overtimeMinutes,
      overtimeHours,
      regularPay,
      overtimePay,
      totalPay,
      effectiveRate,
      isOvernight: effectiveOvernight,
      hasRate: hourlyRate > 0,
      hasOvertime: overtimeMinutes > 0,
      errors,
    };
  }

  return {
    startMinutes,
    endMinutes,
    spanMinutes: 0,
    workedMinutes: 0,
    workedHours: 0,
    regularMinutes: 0,
    regularHours: 0,
    overtimeMinutes: 0,
    overtimeHours: 0,
    regularPay: 0,
    overtimePay: 0,
    totalPay: 0,
    effectiveRate: 0,
    isOvernight: false,
    hasRate: hourlyRate > 0,
    hasOvertime: false,
    errors,
  };
}

/** Compute summary stats from a result. */
export function summaryStats(result: WorkHoursResult): WorkHoursStats {
  return {
    workedHours: result.workedHours,
    regularHours: result.regularHours,
    overtimeHours: result.overtimeHours,
    totalPay: result.totalPay,
    effectiveRate: result.effectiveRate,
    hasRate: result.hasRate,
    hasOvertime: result.hasOvertime,
    isOvernight: result.isOvernight,
  };
}

/** Format a money value as a string with 2 decimals. */
export function formatMoney(amount: number): string {
  if (!Number.isFinite(amount)) return "0.00";
  return amount.toFixed(2);
}

/** Format a hours value as a string with 2 decimals. */
export function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return "0.00";
  return hours.toFixed(2);
}

/** Render the calculation as a plain-text report. */
export function renderText(input: WorkHoursInput, result: WorkHoursResult): string {
  const fmt = input.dateFormat;
  const lines: string[] = [];
  lines.push("=== Work Hours Report ===");
  lines.push(`Start time:        ${result.startMinutes !== null ? formatTime(result.startMinutes, fmt) : "(invalid)"}`);
  lines.push(`End time:          ${result.endMinutes !== null ? formatTime(result.endMinutes, fmt) : "(invalid)"}`);
  lines.push(`Overnight shift:   ${result.isOvernight ? "yes" : "no"}`);
  lines.push(`Break (minutes):   ${Math.max(0, input.breakMinutes || 0)}`);
  lines.push(`Span (minutes):    ${result.spanMinutes}`);
  lines.push(`Worked (minutes):  ${result.workedMinutes}`);
  lines.push(`Worked hours:      ${formatHours(result.workedHours)}`);
  lines.push(`Regular hours:     ${formatHours(result.regularHours)}`);
  lines.push(`Overtime hours:    ${formatHours(result.overtimeHours)}`);
  if (result.hasRate) {
    lines.push(`Hourly rate:       ${formatMoney(input.hourlyRate)}`);
    lines.push(`OT threshold (h):  ${input.overtimeAfterHours}`);
    lines.push(`OT multiplier:     ${input.overtimeRateMultiplier}x`);
    lines.push(`Regular pay:       ${formatMoney(result.regularPay)}`);
    lines.push(`Overtime pay:      ${formatMoney(result.overtimePay)}`);
    lines.push(`Total pay:         ${formatMoney(result.totalPay)}`);
    lines.push(`Effective rate:    ${formatMoney(result.effectiveRate)}/hr`);
  }
  if (result.errors.length > 0) {
    lines.push("");
    lines.push("Errors:");
    for (const e of result.errors) lines.push(`  - ${e}`);
  }
  return lines.join("\n");
}

/** Render the calculation as CSV (component, value). */
export function renderCsv(input: WorkHoursInput, result: WorkHoursResult): string {
  const fmt = input.dateFormat;
  const lines: string[] = ["component,value"];
  lines.push(`start_time,${result.startMinutes !== null ? formatTime(result.startMinutes, fmt) : "(invalid)"}`);
  lines.push(`end_time,${result.endMinutes !== null ? formatTime(result.endMinutes, fmt) : "(invalid)"}`);
  lines.push(`overnight_shift,${result.isOvernight ? "yes" : "no"}`);
  lines.push(`break_minutes,${Math.max(0, input.breakMinutes || 0)}`);
  lines.push(`span_minutes,${result.spanMinutes}`);
  lines.push(`worked_minutes,${result.workedMinutes}`);
  lines.push(`worked_hours,${formatHours(result.workedHours)}`);
  lines.push(`regular_hours,${formatHours(result.regularHours)}`);
  lines.push(`overtime_hours,${formatHours(result.overtimeHours)}`);
  if (result.hasRate) {
    lines.push(`hourly_rate,${formatMoney(input.hourlyRate)}`);
    lines.push(`overtime_threshold_hours,${input.overtimeAfterHours}`);
    lines.push(`overtime_multiplier,${input.overtimeRateMultiplier}`);
    lines.push(`regular_pay,${formatMoney(result.regularPay)}`);
    lines.push(`overtime_pay,${formatMoney(result.overtimePay)}`);
    lines.push(`total_pay,${formatMoney(result.totalPay)}`);
    lines.push(`effective_rate,${formatMoney(result.effectiveRate)}`);
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Suppress unused warning — escapeCsv is exported via renderCsv consumers.
export { escapeCsv as _escapeCsv };

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:work-hours-calculator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  overnightShift: boolean;
  hourlyRate: number;
  overtimeAfterHours: number;
  overtimeRateMultiplier: number;
  dateFormat: TimeFormat;
  workedHours: number;
  totalPay: number;
}

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

export function buildShareUrl(input: WorkHoursInput): string {
  const params = new URLSearchParams();
  if (input.startTime) params.set("start", input.startTime);
  if (input.endTime) params.set("end", input.endTime);
  params.set("break", String(input.breakMinutes));
  params.set("overnight", input.overnightShift ? "1" : "0");
  if (input.hourlyRate > 0) params.set("rate", String(input.hourlyRate));
  params.set("otAfter", String(input.overtimeAfterHours));
  params.set("otMult", String(input.overtimeRateMultiplier));
  params.set("fmt", input.dateFormat);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): WorkHoursInput {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { ...DEFAULT_INPUT };
  const params = new URLSearchParams(clean);
  const dateFormat: TimeFormat = params.get("fmt") === "12h" ? "12h" : "24h";
  return {
    startTime: params.get("start") ?? DEFAULT_INPUT.startTime,
    endTime: params.get("end") ?? DEFAULT_INPUT.endTime,
    breakMinutes: parseNumParam(params.get("break"), DEFAULT_INPUT.breakMinutes),
    overnightShift: params.get("overnight") === "1",
    hourlyRate: parseNumParam(params.get("rate"), 0),
    overtimeAfterHours: parseNumParam(params.get("otAfter"), DEFAULT_INPUT.overtimeAfterHours),
    overtimeRateMultiplier: parseNumParam(params.get("otMult"), DEFAULT_INPUT.overtimeRateMultiplier),
    dateFormat,
  };
}

function parseNumParam(s: string | null, fallback: number): number {
  if (s === null || s === "") return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

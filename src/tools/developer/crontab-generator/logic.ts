/**
 * Crontab Generator — pure logic.
 *
 * Visual cron-expression builder for Unix 5-field, Quartz 6/7-field, and
 * AWS EventBridge cron. Includes presets, two-way builder↔expression
 * sync, plain-English description, validator, and a client-side next-N-runs
 * computation. Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CronFieldName =
  | "minute"
  | "hour"
  | "dayOfMonth"
  | "month"
  | "dayOfWeek";

export type CronMode =
  | "every"        // *
  | "everyN"       // */N
  | "specific"     // 1,5,10
  | "range"        // 1-5
  | "rangeStep";   // 1-10/2

export type CronSyntax = "unix" | "quartz" | "aws";

export interface CronFieldConfig {
  mode: CronMode;
  /** For everyN / rangeStep. */
  step?: number;
  /** For specific — sorted unique values. */
  values?: number[];
  /** For range / rangeStep. */
  rangeStart?: number;
  rangeEnd?: number;
}

export interface CronConfig {
  syntax: CronSyntax;
  minute: CronFieldConfig;
  hour: CronFieldConfig;
  dayOfMonth: CronFieldConfig;
  month: CronFieldConfig;
  dayOfWeek: CronFieldConfig;
  /** Optional Quartz seconds field (0–59). */
  seconds?: CronFieldConfig;
  /** Optional Quartz year field (e.g. 2026 or 2026-2030). */
  year?: CronFieldConfig;
  /** Optional command line shown after the expression. */
  command?: string;
}

export interface CronPreset {
  id: string;
  label: string;
  description: string;
  expression: string;
  syntax: CronSyntax;
}

export interface CronValidationError {
  field: CronFieldName | "seconds" | "year" | "general";
  severity: "error" | "warning";
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: CronValidationError[];
}

export interface CronDescription {
  text: string;
  /** Short summary, e.g. "Every 5 minutes". */
  short: string;
}

export interface NextRun {
  date: Date;
  /** ISO string for display + serialization. */
  iso: string;
}

export interface HistoryEntry {
  ts: number;
  expression: string;
  syntax: CronSyntax;
  description: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const FIELD_RANGES: Record<CronFieldName, { min: number; max: number }> = {
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  dayOfMonth: { min: 1, max: 31 },
  month: { min: 1, max: 12 },
  dayOfWeek: { min: 0, max: 7 }, // 0 and 7 both = Sunday
};

export const FIELD_LABELS: Record<CronFieldName, string> = {
  minute: "Minute",
  hour: "Hour",
  dayOfMonth: "Day of month",
  month: "Month",
  dayOfWeek: "Day of week",
};

export const FIELD_DESCRIPTIONS: Record<CronFieldName, string> = {
  minute: "0–59",
  hour: "0–23",
  dayOfMonth: "1–31",
  month: "1–12 (or JAN–DEC)",
  dayOfWeek: "0–6 (or SUN–SAT; 0 and 7 both = Sunday)",
};

export const MODE_LABELS: Record<CronMode, string> = {
  every: "Every (*)",
  everyN: "Every N (*/N)",
  specific: "Specific (list)",
  range: "Range (A-B)",
  rangeStep: "Stepped range (A-B/N)",
};

export const MONTH_NAMES: string[] = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

export const MONTH_LABELS: string[] = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Sunday=0, Monday=1, … Saturday=6. (0 and 7 both Sunday in cron.) */
export const WEEKDAY_NAMES: string[] = [
  "SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT",
];

export const WEEKDAY_LABELS: string[] = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

export const SYNTAX_LABELS: Record<CronSyntax, string> = {
  unix: "Unix 5-field",
  quartz: "Quartz 6/7-field",
  aws: "AWS EventBridge",
};

export const SYNTAX_DESCRIPTIONS: Record<CronSyntax, string> = {
  unix: "minute hour day-of-month month day-of-week — the standard crontab format on Linux/macOS.",
  quartz: "seconds minutes hours day-of-month month day-of-week [year] — used by Java schedulers (Spring, Quartz). Supports ?, L, W, #.",
  aws: "minutes hours day-of-month month day-of-week year — AWS EventBridge (CloudWatch Events). Day-of-month and day-of-week use AND semantics (opposite of Unix).",
};

// ---------------------------------------------------------------------------
// Presets (15+)
// ---------------------------------------------------------------------------

export const CRON_PRESETS: CronPreset[] = [
  { id: "every-minute", label: "Every minute", description: "Runs every single minute.", expression: "* * * * *", syntax: "unix" },
  { id: "every-5-minutes", label: "Every 5 minutes", description: "Runs at :00, :05, :10, :15, … every hour.", expression: "*/5 * * * *", syntax: "unix" },
  { id: "every-10-minutes", label: "Every 10 minutes", description: "Runs at :00, :10, :20, :30, :40, :50.", expression: "*/10 * * * *", syntax: "unix" },
  { id: "every-15-minutes", label: "Every 15 minutes", description: "Runs at :00, :15, :30, :45.", expression: "*/15 * * * *", syntax: "unix" },
  { id: "every-30-minutes", label: "Every 30 minutes", description: "Runs at :00 and :30.", expression: "*/30 * * * *", syntax: "unix" },
  { id: "hourly", label: "Hourly (at :00)", description: "Runs at the top of every hour.", expression: "0 * * * *", syntax: "unix" },
  { id: "every-6-hours", label: "Every 6 hours", description: "Runs at 00:00, 06:00, 12:00, 18:00.", expression: "0 */6 * * *", syntax: "unix" },
  { id: "daily-midnight", label: "Daily at midnight", description: "Runs once a day at 00:00.", expression: "0 0 * * *", syntax: "unix" },
  { id: "daily-noon", label: "Daily at noon", description: "Runs once a day at 12:00.", expression: "0 12 * * *", syntax: "unix" },
  { id: "twice-daily", label: "Twice daily", description: "Runs at 00:00 and 12:00.", expression: "0 0,12 * * *", syntax: "unix" },
  { id: "weekdays-midnight", label: "Weekdays at midnight", description: "Runs Monday–Friday at 00:00.", expression: "0 0 * * 1-5", syntax: "unix" },
  { id: "weekends-midnight", label: "Weekends at midnight", description: "Runs Saturday and Sunday at 00:00.", expression: "0 0 * * 0,6", syntax: "unix" },
  { id: "weekly-sunday", label: "Weekly (Sunday)", description: "Runs every Sunday at 00:00.", expression: "0 0 * * 0", syntax: "unix" },
  { id: "monthly-first", label: "Monthly (1st at midnight)", description: "Runs at 00:00 on the 1st of every month.", expression: "0 0 1 * *", syntax: "unix" },
  { id: "quarterly", label: "Quarterly (Jan/Apr/Jul/Oct)", description: "Runs at 00:00 on the 1st of January, April, July, October.", expression: "0 0 1 */3 *", syntax: "unix" },
  { id: "yearly", label: "Yearly (Jan 1)", description: "Runs at 00:00 on January 1st every year.", expression: "0 0 1 1 *", syntax: "unix" },
  { id: "business-hours-5min", label: "Every 5 min, business hours", description: "Every 5 minutes between 09:00 and 17:59, Monday–Friday.", expression: "*/5 9-17 * * 1-5", syntax: "unix" },
];

// ---------------------------------------------------------------------------
// Default config + helpers
// ---------------------------------------------------------------------------

export function defaultField(mode: CronMode = "every"): CronFieldConfig {
  return { mode };
}

export function defaultConfig(syntax: CronSyntax = "unix"): CronConfig {
  const base: CronConfig = {
    syntax,
    minute: defaultField("every"),
    hour: defaultField("every"),
    dayOfMonth: defaultField("every"),
    month: defaultField("every"),
    dayOfWeek: defaultField("every"),
    command: "",
  };
  if (syntax === "quartz") {
    base.seconds = defaultField("every");
  }
  return base;
}

/** Parse a single cron field token (e.g. star-slash-5, "1-5", "1,3,5", "*") into CronFieldConfig. */
export function parseField(token: string, field: CronFieldName): CronFieldConfig {
  const t = token.trim().toUpperCase();
  if (t === "*" || t === "?") return { mode: "every" };

  // Stepped range: A-B/N
  const rangeStepMatch = t.match(/^(\d+)-(\d+)\/(\d+)$/);
  if (rangeStepMatch) {
    const [, a, b, n] = rangeStepMatch;
    return {
      mode: "rangeStep",
      rangeStart: parseInt(a, 10),
      rangeEnd: parseInt(b, 10),
      step: parseInt(n, 10),
    };
  }

  // Every N: */N
  const everyNMatch = t.match(/^\*\/(\d+)$/);
  if (everyNMatch) {
    return { mode: "everyN", step: parseInt(everyNMatch[1], 10) };
  }

  // Range: A-B
  const rangeMatch = t.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const [, a, b] = rangeMatch;
    return {
      mode: "range",
      rangeStart: parseInt(a, 10),
      rangeEnd: parseInt(b, 10),
    };
  }

  // List: A,B,C (may include ranges, e.g. 1,3-5,7)
  if (t.includes(",")) {
    const parts = t.split(",");
    const values = new Set<number>();
    for (const p of parts) {
      const tr = p.trim();
      const subRange = tr.match(/^(\d+)-(\d+)$/);
      if (subRange) {
        const a = parseInt(subRange[1], 10);
        const b = parseInt(subRange[2], 10);
        for (let v = a; v <= b; v++) values.add(v);
      } else if (/^\d+$/.test(tr)) {
        values.add(parseInt(tr, 10));
      }
    }
    return {
      mode: "specific",
      values: Array.from(values).sort((x, y) => x - y),
    };
  }

  // Single value
  if (/^\d+$/.test(t)) {
    return { mode: "specific", values: [parseInt(t, 10)] };
  }

  // Month / weekday name → numeric
  const monthIdx = MONTH_NAMES.indexOf(t);
  if (monthIdx >= 0 && field === "month") {
    return { mode: "specific", values: [monthIdx + 1] };
  }
  const weekdayIdx = WEEKDAY_NAMES.indexOf(t);
  if (weekdayIdx >= 0 && field === "dayOfWeek") {
    return { mode: "specific", values: [weekdayIdx] };
  }

  // Unknown — fall back to every
  return { mode: "every" };
}

/** Render a single CronFieldConfig to its cron token. */
export function renderField(field: CronFieldName, cfg: CronFieldConfig): string {
  switch (cfg.mode) {
    case "every":
      return "*";
    case "everyN":
      return `*/${cfg.step ?? 1}`;
    case "specific": {
      const vals = cfg.values ?? [];
      if (vals.length === 0) return "*";
      return vals.join(",");
    }
    case "range":
      return `${cfg.rangeStart ?? 0}-${cfg.rangeEnd ?? 0}`;
    case "rangeStep":
      return `${cfg.rangeStart ?? 0}-${cfg.rangeEnd ?? 0}/${cfg.step ?? 1}`;
    default:
      return "*";
  }
}

/** Build the cron expression from a CronConfig. */
export function buildExpression(cfg: CronConfig): string {
  const fields: string[] = [];
  if (cfg.syntax === "quartz") {
    fields.push(renderField("minute", cfg.seconds ?? defaultField("every")));
  }
  fields.push(renderField("minute", cfg.minute));
  fields.push(renderField("hour", cfg.hour));
  fields.push(renderField("dayOfMonth", cfg.dayOfMonth));
  fields.push(renderField("month", cfg.month));
  fields.push(renderField("dayOfWeek", cfg.dayOfWeek));
  if (cfg.syntax === "quartz" && cfg.year) {
    fields.push(renderField("minute", cfg.year));
  }
  if (cfg.syntax === "aws") {
    // AWS adds a year field — defaults to * if not specified
    fields.push(renderField("minute", cfg.year ?? defaultField("every")));
  }
  return fields.join(" ");
}

/** Parse a cron expression string into a CronConfig (best-effort). */
export function parseExpression(expr: string): CronConfig {
  const trimmed = expr.trim().replace(/\s+/g, " ");
  const parts = trimmed.split(" ");
  // Capture optional trailing command (after the cron fields)
  const fieldCount = parts.length;
  let syntax: CronSyntax = "unix";
  let fieldParts: string[] = parts;
  let command = "";

  if (fieldCount >= 7) {
    syntax = "quartz";
  } else if (fieldCount === 6) {
    // Could be Quartz (6-field, no year) or AWS (6-field, with year)
    // Heuristic: if last field looks like a year (>= 1970) → AWS; otherwise quartz
    const last = parts[5];
    if (/^\d{4}$/.test(last) && parseInt(last, 10) >= 1970) {
      syntax = "aws";
    } else {
      syntax = "quartz";
    }
  } else {
    syntax = "unix";
  }

  let idx = 0;
  const cfg = defaultConfig(syntax);
  if (syntax === "quartz") {
    cfg.seconds = parseField(parts[idx++], "minute");
  }
  cfg.minute = parseField(parts[idx++], "minute");
  cfg.hour = parseField(parts[idx++], "hour");
  cfg.dayOfMonth = parseField(parts[idx++], "dayOfMonth");
  cfg.month = parseField(parts[idx++], "month");
  cfg.dayOfWeek = parseField(parts[idx++], "dayOfWeek");
  if (syntax === "quartz" && idx < parts.length) {
    cfg.year = parseField(parts[idx++], "minute");
  }
  if (syntax === "aws" && idx < parts.length) {
    cfg.year = parseField(parts[idx++], "minute");
  }
  cfg.command = command;
  return cfg;
}

// ---------------------------------------------------------------------------
// Apply preset
// ---------------------------------------------------------------------------

export function applyPreset(id: string): CronConfig | undefined {
  const preset = CRON_PRESETS.find((p) => p.id === id);
  if (!preset) return undefined;
  return parseExpression(preset.expression);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateFieldValue(
  field: CronFieldName,
  cfg: CronFieldConfig,
): CronValidationError[] {
  const out: CronValidationError[] = [];
  const range = FIELD_RANGES[field];

  // Normalize dayOfWeek: 7 is allowed (= Sunday = 0), but warn if both 0 and 7 used
  const isDow = field === "dayOfWeek";
  const max = isDow ? 6 : range.max;

  if (cfg.mode === "everyN") {
    const n = cfg.step ?? 1;
    if (n < 1 || n > range.max) {
      out.push({
        field,
        severity: "error",
        message: `${FIELD_LABELS[field]}: step ${n} out of range (must be 1–${range.max}).`,
      });
    }
  }
  if (cfg.mode === "range" || cfg.mode === "rangeStep") {
    const a = cfg.rangeStart ?? 0;
    const b = cfg.rangeEnd ?? 0;
    if (a > b) {
      out.push({
        field,
        severity: "error",
        message: `${FIELD_LABELS[field]}: range start ${a} is greater than end ${b}.`,
      });
    }
    if (a < range.min || b > max) {
      out.push({
        field,
        severity: "error",
        message: `${FIELD_LABELS[field]}: range ${a}-${b} outside valid bounds (${range.min}–${max}).`,
      });
    }
  }
  if (cfg.mode === "specific") {
    const vals = cfg.values ?? [];
    if (vals.length === 0) {
      out.push({
        field,
        severity: "warning",
        message: `${FIELD_LABELS[field]}: empty list — falling back to '*'.`,
      });
    }
    for (const v of vals) {
      if (isDow) {
        if (v !== 0 && v !== 7 && (v < 0 || v > 6)) {
          out.push({
            field,
            severity: "error",
            message: `${FIELD_LABELS[field]}: ${v} is not a valid weekday (0–6 or 7 for Sunday).`,
          });
        }
      } else if (v < range.min || v > range.max) {
        out.push({
          field,
          severity: "error",
          message: `${FIELD_LABELS[field]}: ${v} is out of range (${range.min}–${range.max}).`,
        });
      }
    }
  }
  return out;
}

export function validateConfig(cfg: CronConfig): ValidationResult {
  const errors: CronValidationError[] = [];

  for (const f of ["minute", "hour", "dayOfMonth", "month", "dayOfWeek"] as CronFieldName[]) {
    errors.push(...validateFieldValue(f, cfg[f]));
  }
  if (cfg.syntax === "quartz" && cfg.seconds) {
    const secErrors = validateFieldValue("minute", cfg.seconds).map((e) => ({
      ...e,
      field: "seconds" as const,
      message: e.message.replace("Minute", "Seconds"),
    }));
    errors.push(...secErrors);
  }

  // The classic gotcha: day-of-month + day-of-week OR semantics (Unix) / AND (AWS)
  const domRestricted = cfg.dayOfMonth.mode !== "every";
  const dowRestricted = cfg.dayOfWeek.mode !== "every";
  if (domRestricted && dowRestricted) {
    if (cfg.syntax === "unix" || cfg.syntax === "quartz") {
      errors.push({
        field: "general",
        severity: "warning",
        message:
          cfg.syntax === "unix"
            ? "Both day-of-month and day-of-week are restricted — in Unix cron this runs when EITHER matches (OR semantics), not both. If you wanted AND, use a separate check inside your script."
            : "Both day-of-month and day-of-week are restricted — Quartz requires '?' in one of them.",
      });
    } else if (cfg.syntax === "aws") {
      errors.push({
        field: "general",
        severity: "warning",
        message:
          "Both day-of-month and day-of-week are restricted — AWS EventBridge uses AND semantics (runs only when both match), which is the opposite of Unix cron. Use '?' in the field you don't care about.",
      });
    }
  }

  // AWS: '0 0 1 * ? *' is the canonical form — warn if both fields are *
  if (cfg.syntax === "aws" && !domRestricted && !dowRestricted) {
    errors.push({
      field: "general",
      severity: "warning",
      message: "AWS EventBridge: at least one of day-of-month / day-of-week should be '?' (no specific value). Currently both are '*'.",
    });
  }

  const valid = !errors.some((e) => e.severity === "error");
  return { valid, errors };
}

export function validateExpression(expr: string): ValidationResult {
  const parts = expr.trim().replace(/\s+/g, " ").split(" ");
  const expectedMin = 5;
  if (parts.length < expectedMin) {
    return {
      valid: false,
      errors: [{
        field: "general",
        severity: "error",
        message: `Expected at least 5 fields, got ${parts.length}.`,
      }],
    };
  }
  // Heuristic syntax detection
  let syntax: CronSyntax = "unix";
  if (parts.length >= 7) syntax = "quartz";
  else if (parts.length === 6) {
    syntax = /^\d{4}$/.test(parts[5]) && parseInt(parts[5], 10) >= 1970 ? "aws" : "quartz";
  }
  const cfg = parseExpression(expr);
  cfg.syntax = syntax;
  return validateConfig(cfg);
}

// ---------------------------------------------------------------------------
// Expand a field into the Set of values it represents
// ---------------------------------------------------------------------------

export function expandField(
  field: CronFieldName,
  cfg: CronFieldConfig,
): Set<number> {
  const range = FIELD_RANGES[field];
  const out = new Set<number>();

  // dayOfWeek: cron 7 → 0 (Sunday). We normalize to 0–6 internally.
  const isDow = field === "dayOfWeek";
  const max = isDow ? 6 : range.max;

  if (cfg.mode === "every") {
    for (let v = range.min; v <= max; v++) out.add(v);
    return out;
  }
  if (cfg.mode === "everyN") {
    const n = cfg.step ?? 1;
    for (let v = range.min; v <= max; v += n) out.add(v);
    return out;
  }
  if (cfg.mode === "specific") {
    for (let v of cfg.values ?? []) {
      if (isDow && v === 7) v = 0;
      out.add(v);
    }
    return out;
  }
  if (cfg.mode === "range") {
    const a = cfg.rangeStart ?? range.min;
    const b = cfg.rangeEnd ?? max;
    for (let v = a; v <= b; v++) {
      if (isDow && v === 7) out.add(0);
      else out.add(v);
    }
    return out;
  }
  if (cfg.mode === "rangeStep") {
    const a = cfg.rangeStart ?? range.min;
    const b = cfg.rangeEnd ?? max;
    const n = cfg.step ?? 1;
    for (let v = a; v <= b; v += n) {
      if (isDow && v === 7) out.add(0);
      else out.add(v);
    }
    return out;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Plain-English description
// ---------------------------------------------------------------------------

function describeField(field: CronFieldName, cfg: CronFieldConfig): string {
  const isDow = field === "dayOfWeek";
  const dowName = (v: number) => WEEKDAY_LABELS[v] ?? String(v);
  const monthName = (v: number) => MONTH_LABELS[v - 1] ?? String(v);

  switch (cfg.mode) {
    case "every":
      return field === "minute" ? "every minute"
        : field === "hour" ? "every hour"
        : field === "dayOfMonth" ? "every day"
        : field === "month" ? "every month"
        : "every day of the week";
    case "everyN": {
      const n = cfg.step ?? 1;
      if (field === "minute") return `every ${n} minute${n === 1 ? "" : "s"}`;
      if (field === "hour") return `every ${n} hour${n === 1 ? "" : "s"}`;
      return `every ${n} ${field}s`;
    }
    case "specific": {
      const vals = cfg.values ?? [];
      if (vals.length === 0) return "every";
      const fmt = (v: number) => {
        if (field === "month") return monthName(v).toLowerCase();
        if (isDow) return dowName(v).toLowerCase();
        return String(v);
      };
      if (vals.length === 1) return fmt(vals[0]);
      const last = vals[vals.length - 1];
      return `${vals.slice(0, -1).map(fmt).join(", ")} and ${fmt(last)}`;
    }
    case "range": {
      const a = cfg.rangeStart ?? 0;
      const b = cfg.rangeEnd ?? 0;
      const fmt = (v: number) => {
        if (field === "month") return monthName(v).toLowerCase();
        if (isDow) return dowName(v).toLowerCase();
        return String(v);
      };
      return `${fmt(a)} through ${fmt(b)}`;
    }
    case "rangeStep": {
      const a = cfg.rangeStart ?? 0;
      const b = cfg.rangeEnd ?? 0;
      const n = cfg.step ?? 1;
      return `every ${n} from ${a} to ${b}`;
    }
    default:
      return "every";
  }
}

export function describeConfig(cfg: CronConfig): CronDescription {
  const minute = cfg.minute;
  const hour = cfg.hour;
  const dom = cfg.dayOfMonth;
  const month = cfg.month;
  const dow = cfg.dayOfWeek;

  // Common patterns → shorter descriptions
  if (
    minute.mode === "everyN" && hour.mode === "every" &&
    dom.mode === "every" && month.mode === "every" && dow.mode === "every"
  ) {
    return {
      short: `Every ${minute.step ?? 1} minute${(minute.step ?? 1) === 1 ? "" : "s"}`,
      text: `Runs every ${minute.step ?? 1} minute${(minute.step ?? 1) === 1 ? "" : "s"}, every hour, every day.`,
    };
  }
  if (
    minute.mode === "specific" && (minute.values ?? []).length === 1 &&
    hour.mode === "every" && dom.mode === "every" && month.mode === "every" && dow.mode === "every"
  ) {
    return {
      short: `At minute ${minute.values![0]} of every hour`,
      text: `Runs at minute ${minute.values![0]} of every hour, every day.`,
    };
  }
  if (
    minute.mode === "specific" && (minute.values ?? []).length === 1 &&
    hour.mode === "specific" && (hour.values ?? []).length === 1 &&
    dom.mode === "every" && month.mode === "every" && dow.mode === "every"
  ) {
    const h = hour.values![0];
    const m = minute.values![0];
    const time = formatHourMinute(h, m);
    return {
      short: `Every day at ${time}`,
      text: `Runs every day at ${time}.`,
    };
  }
  if (
    minute.mode === "specific" && (minute.values ?? []).length === 1 &&
    hour.mode === "specific" && (hour.values ?? []).length === 1 &&
    dom.mode === "specific" && (dom.values ?? []).length === 1 &&
    month.mode === "every" && dow.mode === "every"
  ) {
    const time = formatHourMinute(hour.values![0], minute.values![0]);
    return {
      short: `Monthly on day ${dom.values![0]} at ${time}`,
      text: `Runs at ${time} on day ${dom.values![0]} of every month.`,
    };
  }

  // Generic fallback
  const parts: string[] = [];
  if (minute.mode !== "every") parts.push(`at minute ${describeField("minute", minute)}`);
  if (hour.mode !== "every") parts.push(`at hour ${describeField("hour", hour)}`);
  if (dom.mode !== "every") parts.push(`on day-of-month ${describeField("dayOfMonth", dom)}`);
  if (month.mode !== "every") parts.push(`in ${describeField("month", month)}`);
  if (dow.mode !== "every") parts.push(`on ${describeField("dayOfWeek", dow)}`);

  const text = parts.length === 0
    ? "Runs every minute of every hour, every day."
    : `Runs ${parts.join(", ")}.`;
  return { short: parts[0] ?? "Every minute", text };
}

export function describeExpression(expr: string): CronDescription {
  return describeConfig(parseExpression(expr));
}

function formatHourMinute(h: number, m: number): string {
  const hh = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? "AM" : "PM";
  const mm = String(m).padStart(2, "0");
  return `${hh}:${mm} ${ampm}`;
}

// ---------------------------------------------------------------------------
// Next-N-runs computation (standard Vixie cron algorithm)
// ---------------------------------------------------------------------------

/** Cron OR-semantics: when both day fields are restricted, match if EITHER matches. */
function dayMatches(cfg: CronConfig, date: Date): boolean {
  const domSet = expandField("dayOfMonth", cfg.dayOfMonth);
  const dowSet = expandField("dayOfWeek", cfg.dayOfWeek);
  const domStar = cfg.dayOfMonth.mode === "every";
  const dowStar = cfg.dayOfWeek.mode === "every";

  const dom = date.getDate();
  // JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat — same as cron's 0–6.
  const dow = date.getDay();

  if (domStar && dowStar) return true;
  if (!domStar && !dowStar) {
    // OR semantics
    return domSet.has(dom) || dowSet.has(dow);
  }
  if (!domStar) return domSet.has(dom);
  return dowSet.has(dow);
}

export function computeNextRuns(
  cfg: CronConfig,
  count = 5,
  base: Date = new Date(),
): NextRun[] {
  const result: NextRun[] = [];
  const minuteSet = expandField("minute", cfg.minute);
  const hourSet = expandField("hour", cfg.hour);
  const monthSet = expandField("month", cfg.month);

  // Start at the beginning of the next minute after `base`.
  const start = new Date(base.getTime() + 60 * 1000);
  start.setSeconds(0, 0);

  // Safety cap: scan at most 366 * 24 * 60 minutes (~1 year) to avoid infinite loops
  const maxIterations = 366 * 24 * 60;
  let iters = 0;

  while (result.length < count && iters < maxIterations) {
    iters++;

    // Month check
    if (!monthSet.has(start.getMonth() + 1)) {
      // Advance to first day of next month, 00:00
      start.setMonth(start.getMonth() + 1, 1);
      start.setHours(0, 0, 0, 0);
      continue;
    }

    // Day check (dom/dow OR semantics)
    if (!dayMatches(cfg, start)) {
      // Advance one day, reset to 00:00
      start.setDate(start.getDate() + 1);
      start.setHours(0, 0, 0, 0);
      continue;
    }

    // Hour check
    if (!hourSet.has(start.getHours())) {
      start.setHours(start.getHours() + 1, 0, 0, 0);
      continue;
    }

    // Minute check
    if (!minuteSet.has(start.getMinutes())) {
      start.setMinutes(start.getMinutes() + 1, 0, 0);
      continue;
    }

    // Match!
    result.push({ date: new Date(start), iso: start.toISOString() });
    // Advance by 1 minute for the next iteration
    start.setMinutes(start.getMinutes() + 1, 0, 0);
  }

  return result;
}

export function computeNextRunsFromExpression(
  expr: string,
  count = 5,
  base: Date = new Date(),
): NextRun[] {
  return computeNextRuns(parseExpression(expr), count, base);
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:crontab-generator:history";
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
  // Dedupe by expression+syntax (keep most recent)
  const prev = loadHistory().filter(
    (h) => !(h.expression === entry.expression && h.syntax === entry.syntax),
  );
  const next = [entry, ...prev].slice(0, HISTORY_MAX);
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
// Shareable deep-link to a cron expression
// ---------------------------------------------------------------------------

export function buildShareUrl(expression: string, syntax: CronSyntax = "unix"): string {
  const params = new URLSearchParams();
  params.set("cron", expression);
  if (syntax !== "unix") params.set("syntax", syntax);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { expression: string; syntax: CronSyntax } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { expression: "", syntax: "unix" };
  const params = new URLSearchParams(clean);
  const expression = (params.get("cron") ?? "").trim();
  const syntaxRaw = (params.get("syntax") ?? "unix").trim();
  const syntax: CronSyntax =
    syntaxRaw === "quartz" ? "quartz"
    : syntaxRaw === "aws" ? "aws"
    : "unix";
  return { expression, syntax };
}

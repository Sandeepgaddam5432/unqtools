/**
 * AI Cron Job Scheduler Builder — pure logic.
 *
 * Convert natural-language schedules to cron expressions (standard 5-field
 * and Quartz 6/7-field), explain any expression in plain English, validate
 * the syntax, compute the next N run times (timezone-aware via Intl), warn
 * about the DOM/DOW union gotcha, and emit crontab lines + systemd timer
 * snippets. Optional BYO-key LLM call lives in ui.tsx (touches network).
 *
 * Pure functions only — no DOM, no network.
 *
 * Honesty: the natural-language parser is rule-based and best-effort; it
 * handles common phrasings ("every 5 minutes", "daily at 9am", "every
 * Monday") but will miss unusual constructs. The on-device rules are weaker
 * than a BYO-key LLM for tricky phrasing. Run production servers in UTC and
 * always validate the schedule.
 */

// ---------- Types ----------

export type CronFlavor = "standard" | "quartz";

export interface ParsedField {
  /** Raw field text (e.g., star-slash-5, "1,15", "mon-fri"). */
  raw: string;
  /** Sorted unique list of integers this field will match. */
  values: number[];
}

export interface ParsedCron {
  flavor: CronFlavor;
  fields: string[];
  /** Parsed per-field integer lists; index order: [sec?], min, hour, dom, month, dow, [year?]. */
  parsed: ParsedField[];
  hasSeconds: boolean;
  hasYear: boolean;
  macro?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface NextRunResult {
  runs: Date[];
  truncated: boolean;
}

export interface UnionWarning {
  /** True when DOM and DOW are both restricted (not '*') — standard cron ORs them. */
  isUnion: boolean;
  explanation: string;
}

export interface HistoryEntry {
  ts: number;
  flavor: CronFlavor;
  expression: string;
  description: string;
  note?: string;
}

export interface ShareState {
  expression: string;
  flavor: CronFlavor;
  tz?: string;
  count?: number;
}

export interface LlmEnhancement {
  expression: string;
  explanation: string;
  alternatives: string[];
  suggestions: string[];
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-cron-job-scheduler-builder:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-cron-job-scheduler-builder:llm-key";

export const CRON_MACROS: Record<string, { flavor: CronFlavor; expr: string; label: string }> = {
  "@yearly": { flavor: "standard", expr: "0 0 1 1 *", label: "Once a year, midnight Jan 1" },
  "@annually": { flavor: "standard", expr: "0 0 1 1 *", label: "Once a year, midnight Jan 1" },
  "@monthly": { flavor: "standard", expr: "0 0 1 * *", label: "Once a month, midnight on the 1st" },
  "@weekly": { flavor: "standard", expr: "0 0 * * 0", label: "Once a week, midnight Sunday" },
  "@daily": { flavor: "standard", expr: "0 0 * * *", label: "Once a day, midnight" },
  "@midnight": { flavor: "standard", expr: "0 0 * * *", label: "Once a day, midnight" },
  "@hourly": { flavor: "standard", expr: "0 * * * *", label: "Once an hour, top of the hour" },
  "@reboot": { flavor: "standard", expr: "@reboot", label: "Once at system boot" },
};

export const FIELD_NAMES = ["minute", "hour", "day-of-month", "month", "day-of-week"] as const;
export const FIELD_NAMES_QUARTZ = ["second", "minute", "hour", "day-of-month", "month", "day-of-week", "year"] as const;

export const FIELD_RANGES: Record<string, [number, number]> = {
  second: [0, 59],
  minute: [0, 59],
  hour: [0, 23],
  "day-of-month": [1, 31],
  month: [1, 12],
  "day-of-week": [0, 6],
  year: [1970, 2100],
};

export const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export const DOW_NAMES: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

export const DOW_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTH_LABELS = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const COMMON_TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Sao_Paulo", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Moscow",
  "Africa/Cairo", "Asia/Dubai", "Asia/Kolkata", "Asia/Shanghai", "Asia/Tokyo",
  "Australia/Sydney", "Pacific/Auckland",
];

/** Common natural-language schedule presets users can click. */
export const NL_PRESETS: string[] = [
  "every minute",
  "every 5 minutes",
  "every 15 minutes",
  "every 30 minutes",
  "hourly",
  "every 2 hours",
  "daily at 9am",
  "daily at midnight",
  "daily at noon",
  "every weekday at 8am",
  "every weekday at 6pm",
  "every weekend at 10am",
  "every Monday at 9am",
  "every Friday at 5pm",
  "every Monday, Wednesday, Friday at 9am",
  "weekly on Sunday at midnight",
  "monthly on the 1st at midnight",
  "monthly on the 15th at 9am",
  "quarterly on the 1st of January, April, July, October at midnight",
  "yearly on January 1st at midnight",
];

// ---------- Field expansion ----------

function lc(s: string): string { return (s || "").toLowerCase(); }

function parseName(token: string, names: Record<string, number>): number | null {
  const v = names[lc(token)];
  return v === undefined ? null : v;
}

/**
 * Expand a single cron field token into the list of integers it matches.
 * Supports: star, n, a-b, a,b,c, star-slash-n, a-b-slash-n, a-slash-n,
 * and named months/days. Quartz-only modifiers L, ?, W, # are recognized
 * and skipped from numeric expansion (kept in raw for the explainer).
 */
export function expandField(
  raw: string,
  fieldName: string,
): number[] {
  const cleaned = (raw || "").trim();
  if (!cleaned) return [];
  const range = FIELD_RANGES[fieldName];
  if (!range) return [];

  // Quartz ? is treated like * (no specific value).
  if (cleaned === "?") {
    return listRange(range[0], range[1]);
  }
  // Quartz L (last) → return just the max (best-effort expansion).
  if (cleaned === "L") {
    return [range[1]];
  }
  // Quartz LW (last weekday) — approximate to last day (best-effort).
  if (cleaned === "LW") {
    return [range[1]];
  }
  // Quartz # (e.g., 0#3 = third Sunday). Best-effort: keep just the prefix.
  const hashMatch = cleaned.match(/^(\d+)#(\d+)$/);
  if (hashMatch) {
    return [parseInt(hashMatch[1], 10)];
  }
  // Quartz nW (nearest weekday) — approximate to n itself.
  const wMatch = cleaned.match(/^(\d+)W$/);
  if (wMatch) {
    return [parseInt(wMatch[1], 10)];
  }

  const out = new Set<number>();
  for (const part of cleaned.split(",")) {
    const [rangePart, stepPart] = part.split("/");
    const step = stepPart ? parseInt(stepPart, 10) : 1;
    if (!Number.isFinite(step) || step < 1) continue;
    let lo: number | null;
    let hi: number | null;
    if (rangePart === "*") {
      lo = range[0];
      hi = range[1];
    } else if (rangePart.includes("-")) {
      const [a, b] = rangePart.split("-");
      lo = resolveToken(a, fieldName);
      hi = resolveToken(b, fieldName);
      if (lo === null || hi === null) continue;
    } else {
      const v = resolveToken(rangePart, fieldName);
      if (v === null) continue;
      if (!stepPart) {
        out.add(v);
        continue;
      }
      lo = v;
      hi = range[1];
    }
    if (lo === null || hi === null) continue;
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return Array.from(out).sort((a, b) => a - b);
}

function resolveToken(token: string, fieldName: string): number | null {
  const t = (token || "").trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  if (fieldName === "month") return parseName(t, MONTH_NAMES);
  if (fieldName === "day-of-week") return parseName(t, DOW_NAMES);
  return null;
}

function listRange(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let v = lo; v <= hi; v++) out.push(v);
  return out;
}

// ---------- Parsing ----------

/** Split expression into macro or fields. Returns null on shape error. */
export function tokenize(expr: string): { macro?: string; fields: string[] } | null {
  const cleaned = (expr || "").trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  if (cleaned.startsWith("@")) {
    return { macro: cleaned, fields: [] };
  }
  const fields = cleaned.split(" ");
  if (fields.length < 5 || fields.length > 7) return null;
  return { fields };
}

/** Detect cron flavor (standard 5-field, Quartz 6-field, Quartz 7-field). */
export function detectFlavor(fieldCount: number): CronFlavor {
  return fieldCount >= 6 ? "quartz" : "standard";
}

/** Parse a cron expression into structured form. */
export function parseCron(expr: string): ParsedCron {
  const tok = tokenize(expr);
  if (!tok) {
    return {
      flavor: "standard",
      fields: [],
      parsed: [],
      hasSeconds: false,
      hasYear: false,
    };
  }
  if (tok.macro) {
    const macroExpr = CRON_MACROS[tok.macro];
    if (!macroExpr) {
      return {
        flavor: "standard",
        fields: [],
        parsed: [],
        hasSeconds: false,
        hasYear: false,
        macro: tok.macro,
      };
    }
    const inner = parseCron(macroExpr.expr);
    return { ...inner, macro: tok.macro };
  }
  const fields = tok.fields;
  const flavor = detectFlavor(fields.length);
  const hasSeconds = fields.length >= 6;
  const hasYear = fields.length === 7;

  // Build the field-name list aligned to the field positions.
  const names: string[] = [];
  if (hasSeconds) names.push("second");
  names.push("minute", "hour", "day-of-month", "month", "day-of-week");
  if (hasYear) names.push("year");

  const parsed: ParsedField[] = fields.map((f, i) => ({
    raw: f,
    values: expandField(f, names[i]),
  }));

  return { flavor, fields, parsed, hasSeconds, hasYear };
}

// ---------- Validation ----------

/** Validate a cron expression: shape, field ranges, named tokens, Quartz modifiers. */
export function validateCron(expr: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tok = tokenize(expr);
  if (!tok) {
    return { valid: false, errors: ["Expression must have 5 (standard) or 6–7 (Quartz) space-separated fields, or start with @ for a macro."], warnings };
  }
  if (tok.macro) {
    if (!CRON_MACROS[tok.macro]) {
      errors.push(`Unknown macro: ${tok.macro}. Known: ${Object.keys(CRON_MACROS).join(", ")}.`);
    }
    return { valid: errors.length === 0, errors, warnings };
  }
  const fields = tok.fields;
  const flavor = detectFlavor(fields.length);
  const hasSeconds = fields.length >= 6;
  const hasYear = fields.length === 7;
  const names: string[] = [];
  if (hasSeconds) names.push("second");
  names.push("minute", "hour", "day-of-month", "month", "day-of-week");
  if (hasYear) names.push("year");

  fields.forEach((f, i) => {
    const name = names[i];
    validateSingleField(f, name, flavor, errors, warnings);
  });

  // Quartz ? rule: ? allowed only in DOM and DOW.
  fields.forEach((f, i) => {
    if (f === "?" && nameForIndex(i, hasSeconds) !== "day-of-month" && nameForIndex(i, hasSeconds) !== "day-of-week") {
      errors.push(`'?' is only allowed in day-of-month and day-of-week fields (Quartz).`);
    }
  });

  // DOM/DOW union warning.
  const union = detectDomDowUnion(parseCron(expr));
  if (union.isUnion) warnings.push(union.explanation);

  return { valid: errors.length === 0, errors, warnings };
}

function nameForIndex(i: number, hasSeconds: boolean): string {
  const names = hasSeconds
    ? ["second", "minute", "hour", "day-of-month", "month", "day-of-week", "year"]
    : ["minute", "hour", "day-of-month", "month", "day-of-week", "year"];
  return names[i] ?? "";
}

function validateSingleField(
  raw: string,
  name: string,
  flavor: CronFlavor,
  errors: string[],
  _warnings: string[],
): void {
  if (!raw) {
    errors.push(`Field '${name}' is empty.`);
    return;
  }
  // Quartz-only modifiers.
  if (raw === "L" || raw === "LW" || raw === "?") return;
  if (/^\d+L$/.test(raw)) return; // e.g., 6L = last Friday
  if (/^\d+#\d+$/.test(raw)) return; // e.g., 0#3 = third Sunday
  if (/^\d+W$/.test(raw)) return; // nearest weekday
  const range = FIELD_RANGES[name];
  // Tokenize: split commas, then ranges, then steps.
  for (const part of raw.split(",")) {
    const [rangePart, stepPart] = part.split("/");
    if (stepPart !== undefined) {
      if (!/^\d+$/.test(stepPart)) {
        errors.push(`Field '${name}': step '${stepPart}' is not a positive integer.`);
        continue;
      }
    }
    if (rangePart === "*") continue;
    if (rangePart.includes("-")) {
      const [a, b] = rangePart.split("-");
      if (!checkToken(a, name, range, errors) || !checkToken(b, name, range, errors)) continue;
      const lo = resolveToken(a, name);
      const hi = resolveToken(b, name);
      if (lo !== null && hi !== null && lo > hi) {
        errors.push(`Field '${name}': range '${rangePart}' has start > end.`);
      }
    } else {
      checkToken(rangePart, name, range, errors);
    }
  }
  void flavor;
}

function checkToken(
  token: string,
  name: string,
  range: [number, number],
  errors: string[],
): boolean {
  if (/^\d+$/.test(token)) {
    const v = parseInt(token, 10);
    if (v < range[0] || v > range[1]) {
      errors.push(`Field '${name}': value ${v} is out of range [${range[0]}–${range[1]}].`);
      return false;
    }
    // 7 is allowed for DOW (Sunday) in some implementations.
    if (name === "day-of-week" && v === 7) return true;
    return true;
  }
  if (name === "month" || name === "day-of-week") {
    const map = name === "month" ? MONTH_NAMES : DOW_NAMES;
    if (lc(token) in map) return true;
    errors.push(`Field '${name}': unknown name '${token}'.`);
    return false;
  }
  errors.push(`Field '${name}': invalid token '${token}'.`);
  return false;
}

// ---------- DOM/DOW union detection ----------

export function detectDomDowUnion(parsed: ParsedCron): UnionWarning {
  const names = parsed.hasSeconds
    ? ["second", "minute", "hour", "day-of-month", "month", "day-of-week"]
    : ["minute", "hour", "day-of-month", "month", "day-of-week"];
  const domIdx = names.indexOf("day-of-month");
  const dowIdx = names.indexOf("day-of-week");
  const domRaw = parsed.fields[domIdx] ?? "*";
  const dowRaw = parsed.fields[dowIdx] ?? "*";
  const domRestricted = domRaw !== "*" && domRaw !== "?";
  const dowRestricted = dowRaw !== "*" && dowRaw !== "?";
  if (domRestricted && dowRestricted) {
    return {
      isUnion: true,
      explanation:
        "Both day-of-month and day-of-week are restricted. In standard cron this is an OR: the job runs when EITHER field matches (e.g., 'the 1st OR any Sunday'), not both. Use Quartz with '?' in one field if you want AND semantics.",
    };
  }
  return { isUnion: false, explanation: "" };
}

// ---------- Explanation (cron → English) ----------

/** Explain a cron expression in plain English. */
export function explainCron(expr: string): string {
  const parsed = parseCron(expr);
  if (parsed.macro && parsed.fields.length === 0) {
    const m = CRON_MACROS[parsed.macro];
    return m ? `${parsed.macro} — ${m.label}.` : `Unknown macro: ${parsed.macro}`;
  }
  const v = validateCron(expr);
  if (!v.valid) {
    return `Invalid expression: ${v.errors.join(" ")}`;
  }
  return explainParsed(parsed);
}

function explainParsed(p: ParsedCron): string {
  const names = p.hasSeconds
    ? ["second", "minute", "hour", "day-of-month", "month", "day-of-week"]
    : ["minute", "hour", "day-of-month", "month", "day-of-week"];
  const fieldsByName: Record<string, string> = {};
  names.forEach((n, i) => { fieldsByName[n] = p.fields[i] ?? "*"; });
  if (p.hasYear) fieldsByName["year"] = p.fields[p.fields.length - 1] ?? "*";

  const parts: string[] = [];
  parts.push(explainField(fieldsByName.minute, "minute"));
  parts.push(explainField(fieldsByName.hour, "hour"));
  parts.push(explainField(fieldsByName["day-of-month"], "day-of-month"));
  parts.push(explainField(fieldsByName.month, "month"));
  parts.push(explainField(fieldsByName["day-of-week"], "day-of-week"));
  if (p.hasSeconds) {
    parts.unshift(explainField(fieldsByName.second, "second"));
  }

  // Compose a natural sentence.
  return composeSentence(parts, fieldsByName, p);
}

function explainField(raw: string, name: string): string {
  if (raw === "*" || raw === "?") return `${name}: every`;
  // Step.
  const stepMatch = raw.match(/^\*\/(\d+)$/);
  if (stepMatch) return `${name}: every ${stepMatch[1]}`;
  const rangeStepMatch = raw.match(/^(\S+)-(\S+)\/(\d+)$/);
  if (rangeStepMatch) {
    return `${name}: every ${rangeStepMatch[3]} from ${rangeStepMatch[1]} to ${rangeStepMatch[2]}`;
  }
  // Range.
  if (raw.includes("-") && !raw.includes(",")) {
    const [a, b] = raw.split("-");
    return `${name}: from ${a} to ${b}`;
  }
  // List.
  if (raw.includes(",")) {
    return `${name}: ${raw.split(",").join(", ")}`;
  }
  if (raw === "L") return `${name}: last`;
  if (/^\d+L$/.test(raw)) return `${name}: last ${raw.slice(0, -1)}`;
  if (/^\d+W$/.test(raw)) return `${name}: nearest weekday to ${raw.slice(0, -1)}`;
  if (/^\d+#\d+$/.test(raw)) {
    const [d, n] = raw.split("#");
    return `${name}: ${ordinal(parseInt(n, 10))} occurrence of ${d}`;
  }
  return `${name}: ${raw}`;
}

function composeSentence(
  _parts: string[],
  fields: Record<string, string>,
  p: ParsedCron,
): string {
  const min = fields.minute ?? "*";
  const hr = fields.hour ?? "*";
  const dom = fields["day-of-month"] ?? "*";
  const mon = fields.month ?? "*";
  const dow = fields["day-of-week"] ?? "*";
  const sec = p.hasSeconds ? fields.second ?? "*" : "*";

  // Every N minutes / hours.
  const minStep = min.match(/^\*\/(\d+)$/);
  if (minStep && hr === "*" && (dom === "*" || dom === "?") && mon === "*" && (dow === "*" || dow === "?")) {
    return p.hasSeconds && sec !== "0" && sec !== "*"
      ? `At second ${sec} of every ${minStep[1]} minute(s).`
      : `Every ${minStep[1]} minute(s).`;
  }
  const hrStep = hr.match(/^\*\/(\d+)$/);
  if (hrStep && min === "0" && (dom === "*" || dom === "?") && mon === "*" && (dow === "*" || dow === "?")) {
    return `Every ${hrStep[1]} hour(s), on the hour.`;
  }

  // ---- Canonical named patterns (check these BEFORE the general "specific
  // time on specific X" patterns so yearly/monthly get their own copy). ----
  // Yearly: 0 0 1 1 *
  if (min === "0" && hr === "0" && dom === "1" && mon === "1" && (dow === "*" || dow === "?")) {
    return `At midnight on January 1st, every year.`;
  }
  // Monthly: 0 0 1 * *
  if (min === "0" && hr === "0" && dom === "1" && mon === "*" && (dow === "*" || dow === "?")) {
    return `At midnight on the 1st of every month.`;
  }
  // Weekly: 0 0 * * N
  if (min === "0" && hr === "0" && (dom === "*" || dom === "?") && mon === "*" && dow !== "*" && dow !== "?") {
    return `At midnight on ${dowLabel(dow)} every week.`;
  }
  // Daily: 0 0 * * *
  if (min === "0" && hr === "0" && (dom === "*" || dom === "?") && mon === "*" && (dow === "*" || dow === "?")) {
    return `At midnight every day.`;
  }
  // Hourly: 0 * * * * (canonical).
  if (min === "0" && hr === "*" && (dom === "*" || dom === "?") && mon === "*" && (dow === "*" || dow === "?")) {
    return `At the top of every hour.`;
  }
  // Every minute.
  if (min === "*" && hr === "*" && (dom === "*" || dom === "?") && mon === "*" && (dow === "*" || dow === "?")) {
    return `Every minute.`;
  }

  // Specific minute past every hour.
  if (min !== "*" && hr === "*" && (dom === "*" || dom === "?") && mon === "*" && (dow === "*" || dow === "?")) {
    return `At minute ${min} of every hour.`;
  }
  // Specific time daily (with midnight/noon special cases).
  if (min !== "*" && hr !== "*" && (dom === "*" || dom === "?") && mon === "*" && (dow === "*" || dow === "?")) {
    return `At ${formatTime(hr, min, p.hasSeconds ? sec : null)} every day.`;
  }
  // Specific time on weekdays.
  if (min !== "*" && hr !== "*" && dow === "1-5" && (dom === "*" || dom === "?") && mon === "*") {
    return `At ${formatTime(hr, min, p.hasSeconds ? sec : null)} on every weekday (Monday through Friday).`;
  }
  // Specific time on weekends.
  if (min !== "*" && hr !== "*" && (dow === "0,6" || dow === "6,0" || dow === "sat,sun" || dow === "sun,sat") && (dom === "*" || dom === "?") && mon === "*") {
    return `At ${formatTime(hr, min, p.hasSeconds ? sec : null)} on weekends (Saturday and Sunday).`;
  }
  // Specific time on specific DOW.
  if (min !== "*" && hr !== "*" && dow !== "*" && dow !== "?" && (dom === "*" || dom === "?") && mon === "*") {
    return `At ${formatTime(hr, min, p.hasSeconds ? sec : null)} on ${dowLabel(dow)}.`;
  }
  // Specific time on specific DOM.
  if (min !== "*" && hr !== "*" && dom !== "*" && dom !== "?" && (dow === "*" || dow === "?") && mon === "*") {
    return `At ${formatTime(hr, min, p.hasSeconds ? sec : null)} on the ${domDisplay(dom)} of every month.`;
  }
  // Specific time on specific month(s).
  if (min !== "*" && hr !== "*" && dom !== "*" && dom !== "?" && mon !== "*" && (dow === "*" || dow === "?")) {
    return `At ${formatTime(hr, min, p.hasSeconds ? sec : null)} on the ${domDisplay(dom)} of ${monthLabel(mon)}.`;
  }

  // Fallback: list each field.
  const segs: string[] = [];
  if (p.hasSeconds && sec !== "*") segs.push(`second ${sec}`);
  if (min !== "*") segs.push(`minute ${min}`);
  if (hr !== "*") segs.push(`hour ${hr}`);
  if (dom !== "*" && dom !== "?") segs.push(`day-of-month ${dom}`);
  if (mon !== "*") segs.push(`month ${monthLabel(mon)}`);
  if (dow !== "*" && dow !== "?") segs.push(`day-of-week ${dowLabel(dow)}`);
  if (p.hasYear && fields.year && fields.year !== "*") segs.push(`year ${fields.year}`);
  return `Runs when: ${segs.join(", ")}.`;
}

function formatTime(hr: string, min: string, sec: string | null): string {
  const h = parseInt(hr, 10);
  const m = parseInt(min, 10);
  if (Number.isFinite(h) && Number.isFinite(m)) {
    // Special-case midnight and noon.
    if (h === 0 && m === 0 && (!sec || sec === "0")) return "midnight";
    if (h === 12 && m === 0 && (!sec || sec === "0")) return "noon";
    const period = h < 12 ? "am" : "pm";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const base = `${h12}:${String(m).padStart(2, "0")}${period}`;
    if (sec && sec !== "0") return `${base}:${String(parseInt(sec, 10)).padStart(2, "0")}`;
    return base;
  }
  return `${hr}:${min}${sec && sec !== "0" ? `:${sec}` : ""}`;
}

/** Render a day-of-month token with ordinal ("1" → "1st", "15" → "15th"). */
function domDisplay(raw: string): string {
  if (raw.includes(",") || raw.includes("-") || raw.includes("/")) return raw;
  const v = parseInt(raw, 10);
  if (!Number.isFinite(v)) return raw;
  return `${v}${ordinalSuffix(v)}`;
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function dowLabel(raw: string): string {
  // Range like 1-5 → Monday through Friday.
  const rangeMatch = raw.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const a = parseInt(rangeMatch[1], 10) % 7;
    const b = parseInt(rangeMatch[2], 10) % 7;
    return `${DOW_LABELS[a]} through ${DOW_LABELS[b]}`;
  }
  // List.
  if (raw.includes(",")) {
    const items = raw.split(",").map((t) => {
      const v = resolveToken(t, "day-of-week");
      return v === null ? t : DOW_LABELS[v % 7];
    });
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return items.slice(0, -1).join(", ") + ", and " + items[items.length - 1];
  }
  const v = resolveToken(raw, "day-of-week");
  return v === null ? raw : DOW_LABELS[v % 7];
}

function monthLabel(raw: string): string {
  // Range like 1-3 → January through March.
  if (raw.includes("-") && !raw.includes(",")) {
    const [a, b] = raw.split("-");
    const av = resolveToken(a, "month");
    const bv = resolveToken(b, "month");
    if (av !== null && bv !== null) return `${MONTH_LABELS[av]} through ${MONTH_LABELS[bv]}`;
  }
  // List like 1,6 or jan,jun → January and June.
  if (raw.includes(",")) {
    const items = raw.split(",").map((t) => {
      const v = resolveToken(t, "month");
      return v === null ? t : MONTH_LABELS[v];
    });
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return items.slice(0, -1).join(", ") + ", and " + items[items.length - 1];
  }
  if (raw.includes("/")) {
    // Stepped month (e.g., */3) — leave raw.
    return raw;
  }
  const v = resolveToken(raw, "month");
  return v === null ? raw : MONTH_LABELS[v];
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ---------- Natural-language parsing ----------

export interface NlParseResult {
  expression: string;
  flavor: CronFlavor;
  confidence: "high" | "medium" | "low";
  note?: string;
}

/**
 * Best-effort natural-language → cron parser.
 * Handles common phrasings. Returns a low-confidence note when the input
 * does not match any known pattern.
 */
export function parseNaturalLanguage(input: string): NlParseResult {
  let s = (input || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return { expression: "", flavor: "standard", confidence: "low", note: "Empty input." };

  // Normalize "at midnight" / "at noon" to canonical time tokens so the
  // remaining regexes can stay focused on the HH[:MM][am|pm] shape.
  s = s.replace(/\bat midnight\b/g, "at 12:00am").replace(/\bat noon\b/g, "at 12:00pm");

  // ---- Macro / named shortcuts ----
  if (s === "every minute") return ok("* * * * *", "high");
  if (s === "every hour" || s === "hourly") return ok("0 * * * *", "high");
  if (s === "every day" || s === "daily") return ok("0 0 * * *", "high");
  if (s === "every day at midnight" || s === "daily at midnight" || s === "midnight") return ok("0 0 * * *", "high");
  if (s === "noon" || s === "daily at noon") return ok("0 12 * * *", "high");
  if (s === "every week" || s === "weekly") return ok("0 0 * * 0", "high");
  if (s === "every month" || s === "monthly") return ok("0 0 1 * *", "high");
  if (s === "every year" || s === "yearly" || s === "every year at midnight" || s === "annually") return ok("0 0 1 1 *", "high");
  if (s === "every weekend") return ok("0 0 * * 6,0", "high");
  if (s === "every weekday") return ok("0 0 * * 1-5", "high");
  if (s === "on reboot" || s === "at reboot") return okMacro("@reboot", "high");

  // ---- "every N minutes" ----
  let m = s.match(/^every (\d+) minutes?$/);
  if (m) return ok(`*/${m[1]} * * * *`, "high");

  // ---- "every N seconds" (Quartz only) ----
  m = s.match(/^every (\d+) seconds?$/);
  if (m) return okQuartz(`*/${m[1]} * * * * *`, "high", "Standard cron does not support seconds; emitted Quartz 6-field.");

  // ---- "every N hours" ----
  m = s.match(/^every (\d+) hours?$/);
  if (m) return ok(`0 */${m[1]} * * *`, "high");

  // ---- "every N days" ----
  m = s.match(/^every (\d+) days?$/);
  if (m) return ok(`0 0 */${m[1]} * *`, "high");

  // ---- "every N weeks" (cron has no native every-N-weeks; use DOW list with step note) ----
  m = s.match(/^every (\d+) weeks?$/);
  if (m) return ok(`0 0 * * 0`, "medium", `Cron has no native 'every ${m[1]} weeks' — runs weekly. Add a date check in your job.`);

  // ---- "every N months" ----
  m = s.match(/^every (\d+) months?$/);
  if (m) return ok(`0 0 1 */${m[1]} *`, "high");

  // ---- "every N years" ----
  m = s.match(/^every (\d+) years?$/);
  if (m) return ok(`0 0 1 1 */${m[1] === "1" ? "*" : `*/${m[1]}`}`, "medium", "Month-of-year stepping is a Quartz feature; some standard-cron implementations ignore it.");

  // ---- "daily at HH:MM" / "daily at Ham" / "daily at Hpm" ----
  m = s.match(/^daily at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (m) {
    const t = parseTime(m[1], m[2] ?? "0", m[3] ?? "");
    if (t) return ok(`${t.min} ${t.hour} * * *`, "high");
  }
  m = s.match(/^every day at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (m) {
    const t = parseTime(m[1], m[2] ?? "0", m[3] ?? "");
    if (t) return ok(`${t.min} ${t.hour} * * *`, "high");
  }
  // ---- "at HH:MM" / "at Ham" (defaults to every day) ----
  m = s.match(/^at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (m) {
    const t = parseTime(m[1], m[2] ?? "0", m[3] ?? "");
    if (t) return ok(`${t.min} ${t.hour} * * *`, "high");
  }

  // ---- "every weekday at HH:MM" ----
  m = s.match(/^every weekday at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (m) {
    const t = parseTime(m[1], m[2] ?? "0", m[3] ?? "");
    if (t) return ok(`${t.min} ${t.hour} * * 1-5`, "high");
  }
  // ---- "every weekend at HH:MM" ----
  m = s.match(/^every weekend at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (m) {
    const t = parseTime(m[1], m[2] ?? "0", m[3] ?? "");
    if (t) return ok(`${t.min} ${t.hour} * * 6,0`, "high");
  }

  // ---- "every <DayName> at HH:MM" ----
  m = s.match(/^every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?: at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/);
  if (m) {
    const dow = DOW_NAMES[m[1].slice(0, 3)];
    const t = m[2] ? parseTime(m[2], m[3] ?? "0", m[4] ?? "") : { min: 0, hour: 0 };
    if (t) return ok(`${t.min} ${t.hour} * * ${dow}`, "high");
  }

  // ---- "every Monday, Wednesday, Friday [at HH:MM]" ----
  m = s.match(/^every ((?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:,\s*(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))+)(?: and (monday|tuesday|wednesday|thursday|friday|saturday|sunday))?(?: at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/);
  if (m) {
    const days = m[1].split(/,\s*/);
    if (m[2]) days.push(m[2]);
    const dows = days.map((d) => DOW_NAMES[d.slice(0, 3)]).join(",");
    const t = m[3] ? parseTime(m[3], m[4] ?? "0", m[5] ?? "") : { min: 0, hour: 0 };
    if (t) return ok(`${t.min} ${t.hour} * * ${dows}`, "high");
  }

  // ---- "monthly on the Nth at HH:MM" ----
  m = s.match(/^monthly on the (\d{1,2})(?:st|nd|rd|th)?(?: at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/);
  if (m) {
    const dom = parseInt(m[1], 10);
    const t = m[2] ? parseTime(m[2], m[3] ?? "0", m[4] ?? "") : { min: 0, hour: 0 };
    if (t && dom >= 1 && dom <= 31) return ok(`${t.min} ${t.hour} ${dom} * *`, "high");
  }
  // ---- "on the Nth of every month at HH:MM" ----
  m = s.match(/^on the (\d{1,2})(?:st|nd|rd|th)? of every month(?: at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/);
  if (m) {
    const dom = parseInt(m[1], 10);
    const t = m[2] ? parseTime(m[2], m[3] ?? "0", m[4] ?? "") : { min: 0, hour: 0 };
    if (t && dom >= 1 && dom <= 31) return ok(`${t.min} ${t.hour} ${dom} * *`, "high");
  }

  // ---- "quarterly on the 1st of January, April, July, October at midnight" ----
  m = s.match(/^quarterly(?: on the (\d{1,2})(?:st|nd|rd|th)? of ([a-z]+(?:,\s*[a-z]+)*))?(?: at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/);
  if (m) {
    const monthsStr = m[2] ?? "january,april,july,october";
    const monthList = monthsStr.split(/,\s*/).map((mn) => MONTH_NAMES[mn.slice(0, 3)]).filter((v) => v !== undefined);
    if (monthList.length > 0) {
      const dom = m[1] ? parseInt(m[1], 10) : 1;
      const t = m[3] ? parseTime(m[3], m[4] ?? "0", m[5] ?? "") : { min: 0, hour: 0 };
      if (t && dom >= 1 && dom <= 31) return ok(`${t.min} ${t.hour} ${dom} ${monthList.join(",")} *`, "high");
    }
  }

  // ---- "yearly on January 1st at midnight" / "yearly on <Month> <Nth>" ----
  m = s.match(/^yearly on ([a-z]+) (\d{1,2})(?:st|nd|rd|th)?(?: at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/);
  if (m) {
    const month = MONTH_NAMES[m[1].slice(0, 3)];
    const dom = parseInt(m[2], 10);
    const t = m[3] ? parseTime(m[3], m[4] ?? "0", m[5] ?? "") : { min: 0, hour: 0 };
    if (month && t && dom >= 1 && dom <= 31) return ok(`${t.min} ${t.hour} ${dom} ${month} *`, "high");
  }

  // ---- "every Nth of <Month>" ----
  m = s.match(/^on the (\d{1,2})(?:st|nd|rd|th)? of ([a-z]+)(?: at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/);
  if (m) {
    const month = MONTH_NAMES[m[2].slice(0, 3)];
    const dom = parseInt(m[1], 10);
    const t = m[3] ? parseTime(m[3], m[4] ?? "0", m[5] ?? "") : { min: 0, hour: 0 };
    if (month && t && dom >= 1 && dom <= 31) return ok(`${t.min} ${t.hour} ${dom} ${month} *`, "high");
  }

  // ---- "every <Month> <Nth>" ----
  m = s.match(/^every ([a-z]+) (\d{1,2})(?:st|nd|rd|th)?(?: at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/);
  if (m) {
    const month = MONTH_NAMES[m[1].slice(0, 3)];
    const dom = parseInt(m[2], 10);
    const t = m[3] ? parseTime(m[3], m[4] ?? "0", m[5] ?? "") : { min: 0, hour: 0 };
    if (month && t && dom >= 1 && dom <= 31) return ok(`${t.min} ${t.hour} ${dom} ${month} *`, "high");
  }

  return { expression: "", flavor: "standard", confidence: "low", note: `Could not parse: "${input}". Try phrasing like 'every 5 minutes', 'daily at 9am', 'every Monday at 9am', or 'monthly on the 15th at noon'.` };
}

function parseTime(hStr: string, mStr: string, period: string): { min: number; hour: number } | null {
  let h = parseInt(hStr, 10);
  const min = parseInt(mStr, 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (period === "am" && h === 12) h = 0;
  if (period === "pm" && h < 12) h += 12;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { min, hour: h };
}

function ok(expr: string, conf: "high" | "medium" | "low", note?: string): NlParseResult {
  return { expression: expr, flavor: "standard", confidence: conf, note };
}
function okQuartz(expr: string, conf: "high" | "medium" | "low", note?: string): NlParseResult {
  return { expression: expr, flavor: "quartz", confidence: conf, note };
}
function okMacro(expr: string, conf: "high" | "medium" | "low"): NlParseResult {
  return { expression: expr, flavor: "standard", confidence: conf };
}

// ---------- Next-run calculator ----------

/**
 * Compute the next N run times for a cron expression, starting from
 * `fromDate` (defaults to now). Timezone is applied via Intl.DateTimeFormat
 * to extract local wall-clock fields for matching — this avoids timezone
 * surprises when the browser TZ differs from UTC.
 *
 * Iterates minute-by-minute (second-by-second if Quartz seconds are set) up
 * to a safety cap to avoid infinite loops on impossible schedules.
 */
export function computeNextRuns(
  expr: string,
  fromDate: Date = new Date(),
  count: number = 5,
  timezone?: string,
): NextRunResult {
  const parsed = parseCron(expr);
  if (parsed.fields.length === 0) return { runs: [], truncated: false };
  const v = validateCron(expr);
  if (!v.valid) return { runs: [], truncated: false };

  const names = parsed.hasSeconds
    ? ["second", "minute", "hour", "day-of-month", "month", "day-of-week"]
    : ["minute", "hour", "day-of-month", "month", "day-of-week"];
  const sets: Record<string, Set<number>> = {};
  names.forEach((n, i) => {
    const raw = parsed.fields[i] ?? "*";
    // Quartz '?' means 'no specific value' — treat as wildcard.
    const effective = raw === "?" ? "*" : raw;
    sets[n] = new Set(expandField(effective, n));
  });
  const yearSet: Set<number> | null = parsed.hasYear
    ? new Set(expandField(parsed.fields[parsed.fields.length - 1] ?? "*", "year"))
    : null;

  const union = detectDomDowUnion(parsed).isUnion;

  const out: Date[] = [];
  const cap = 50000; // safety cap on iterations
  const step = parsed.hasSeconds ? 1000 : 60_000;
  // Start at the next minute boundary after fromDate.
  const start = new Date(fromDate.getTime());
  if (parsed.hasSeconds) {
    start.setUTCMilliseconds(0);
  } else {
    start.setUTCSeconds(0, 0);
    start.setUTCMilliseconds(0);
    start.setTime(start.getTime() + 60_000);
  }

  let cursor = start.getTime();
  let i = 0;
  while (out.length < count && i < cap) {
    i++;
    const d = new Date(cursor);
    const local = toLocalFields(d, timezone);
    if (yearSet && !yearSet.has(local.year)) { cursor += step; continue; }
    if (!sets.month.has(local.month)) { cursor += step; continue; }
    if (!sets.hour.has(local.hour)) { cursor += step; continue; }
    if (parsed.hasSeconds && !sets.second.has(local.second)) { cursor += step; continue; }
    if (!sets.minute.has(local.minute)) { cursor += step; continue; }

    const domMatch = sets["day-of-month"].has(local.dom);
    const dowMatch = sets["day-of-week"].has(local.dow);
    let dayOk: boolean;
    if (union) {
      // OR semantics.
      dayOk = domMatch || dowMatch;
    } else {
      // If either field is '*' (wildcard), the restricted one wins.
      const domWild = parsed.fields[names.indexOf("day-of-month")] === "*"
        || parsed.fields[names.indexOf("day-of-month")] === "?";
      const dowWild = parsed.fields[names.indexOf("day-of-week")] === "*"
        || parsed.fields[names.indexOf("day-of-week")] === "?";
      if (domWild && dowWild) dayOk = true;
      else if (domWild) dayOk = dowMatch;
      else if (dowWild) dayOk = domMatch;
      else dayOk = domMatch && dowMatch;
    }
    if (!dayOk) { cursor += step; continue; }

    out.push(new Date(cursor));
    cursor += step;
  }

  return { runs: out, truncated: out.length < count };
}

interface LocalFields {
  year: number;
  month: number; // 1-12
  dom: number;
  hour: number;
  minute: number;
  second: number;
  dow: number; // 0=Sun
}

/** Extract wall-clock fields in the target timezone using Intl. */
function toLocalFields(d: Date, timezone?: string): LocalFields {
  const tz = timezone || (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC");
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
      weekday: "short",
    }).formatToParts(d);
    const map: Record<string, string> = {};
    for (const p of parts) map[p.type] = p.value;
    const year = parseInt(map.year, 10);
    const month = parseInt(map.month, 10);
    const dom = parseInt(map.day, 10);
    const hourRaw = parseInt(map.hour, 10);
    const hour = Number.isNaN(hourRaw) ? 0 : hourRaw === 24 ? 0 : hourRaw;
    const minute = parseInt(map.minute, 10);
    const second = parseInt(map.second, 10);
    const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dow = wdMap[map.weekday] ?? 0;
    return { year, month, dom, hour, minute, second, dow };
  } catch {
    // Fall back to UTC.
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      dom: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
      second: d.getUTCSeconds(),
      dow: d.getUTCDay(),
    };
  }
}

// ---------- Macros / format converters ----------

/** Expand a macro (@yearly etc.) to its 5-field expression. Returns null if not a macro. */
export function expandMacro(expr: string): string | null {
  const m = CRON_MACROS[expr.trim()];
  return m ? m.expr : null;
}

/** Convert a cron expression to a crontab line. */
export function cronToCrontabLine(expr: string, command: string = "/usr/local/bin/job.sh"): string {
  const parsed = parseCron(expr);
  if (parsed.macro && parsed.fields.length === 0) {
    return `${parsed.macro} ${command}`;
  }
  return `${expr.trim()} ${command}`;
}

/** Convert a cron expression to a systemd timer + service snippet. */
export function cronToSystemdTimer(expr: string, name: string = "myjob"): string {
  const parsed = parseCron(expr);
  const v = validateCron(expr);
  if (!v.valid) {
    return `# Invalid cron expression: ${v.errors.join(" ")}`;
  }
  // systemd does not support seconds or sub-minute intervals natively.
  if (parsed.hasSeconds) {
    return `# systemd timers do not support seconds; use a standard 5-field cron expression.\n# Expression: ${expr}`;
  }
  const names = ["minute", "hour", "day-of-month", "month", "day-of-week"];
  const fields = parsed.fields.slice(0, 5);
  // systemd OnCalendar uses day-of-week as mon..sun (3-letter, lowercase).
  const dowField = fields[4];
  const dowConverted = convertDowForSystemd(dowField);
  const calendar = fields.length === 5
    ? `*-*-${fields[2] !== "*" ? pad2(fields[2]) : "*"} ${fields[1] !== "*" ? pad2(fields[1]) : "*"}:${fields[0] !== "*" ? pad2(fields[0]) : "00"}:00`
    : "*-*-* *:*:00";
  return [
    `# /etc/systemd/system/${name}.timer`,
    `[Unit]`,
    `Description=Run ${name} on schedule (cron: ${expr})`,
    ``,
    `[Timer]`,
    `OnCalendar=${calendar}`,
    dowConverted !== "*" ? `OnCalendar=${dowConverted} *-*-* ${fields[1] !== "*" ? pad2(fields[1]) : "*"}:${fields[0] !== "*" ? pad2(fields[0]) : "00"}:00` : `# DOW field (${dowField}) folded into OnCalendar above`,
    `Persistent=true`,
    ``,
    `[Install]`,
    `WantedBy=timers.target`,
    ``,
    `# /etc/systemd/system/${name}.service`,
    `[Unit]`,
    `Description=${name} job`,
    ``,
    `[Service]`,
    `Type=oneshot`,
    `ExecStart=/usr/local/bin/${name}.sh`,
    ``,
    `# Enable:`,
    `#   systemctl enable --now ${name}.timer`,
  ].join("\n");
}

function convertDowForSystemd(raw: string): string {
  if (raw === "*" || raw === "?") return "*";
  const items: number[] = [];
  for (const part of raw.split(",")) {
    if (part.includes("-")) {
      const [a, b] = part.split("-");
      const av = resolveToken(a, "day-of-week");
      const bv = resolveToken(b, "day-of-week");
      if (av !== null && bv !== null) {
        for (let v = av; v <= bv; v++) items.push(v);
      }
    } else {
      const v = resolveToken(part, "day-of-week");
      if (v !== null) items.push(v);
    }
  }
  const labels = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return items.map((v) => labels[v % 7]).join(",");
}

function pad2(s: string): string {
  if (/^\d+$/.test(s)) return String(parseInt(s, 10)).padStart(2, "0");
  return s;
}

/** Format a Date for display, optionally in a specific timezone. */
export function formatRunDate(d: Date, timezone?: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZoneName: "short",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

/** List the supported timezones (the curated COMMON_TIMEZONES list + browser local). */
export function listTimezones(): string[] {
  const local = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const all = [...new Set([local, ...COMMON_TIMEZONES])];
  return all.sort();
}

// ---------- History (localStorage) ----------

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

// ---------- Shareable URL ----------

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.expression) params.set("expr", state.expression);
  if (state.flavor) params.set("flavor", state.flavor);
  if (state.tz) params.set("tz", state.tz);
  if (state.count !== undefined) params.set("count", String(state.count));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { expression: "", flavor: "standard" };
  const params = new URLSearchParams(clean);
  const flavor = (params.get("flavor") as CronFlavor) ?? "standard";
  const tz = params.get("tz") ?? undefined;
  const countRaw = params.get("count");
  const count = countRaw ? parseInt(countRaw, 10) : undefined;
  return {
    expression: params.get("expr") ?? "",
    flavor: flavor === "quartz" ? "quartz" : "standard",
    tz,
    count: Number.isFinite(count) ? count : undefined,
  };
}

// ---------- Optional BYO-key LLM prompt ----------

export function buildLlmPrompt(input: string): string {
  return [
    "You are a cron-expression expert. Convert the user's plain-English schedule",
    "to a cron expression (5-field standard, or 6/7-field Quartz if seconds/year",
    "are needed). Return JSON with this exact shape:",
    "",
    "{",
    '  "expression": "5-field-or-quartz-expression",',
    '  "explanation": "one-sentence plain-English description",',
    '  "alternatives": ["alternative-expression", ...],',
    '  "suggestions": ["any caveat or improvement", ...]',
    "}",
    "",
    "Rules:",
    "- Standard 5-field: minute hour day-of-month month day-of-week.",
    "- Use Quartz 6-field (with seconds) only if the user explicitly mentions seconds.",
    "- Flag the DOM/DOW union gotcha when both day-of-month and day-of-week are restricted.",
    "- Do not include markdown fences. Return raw JSON only.",
    "",
    `User input: ${input}`,
  ].join("\n");
}

export function renderLlmResult(raw: string): LlmEnhancement {
  const fallback: LlmEnhancement = {
    expression: "",
    explanation: "The LLM did not return parseable JSON.",
    alternatives: [],
    suggestions: [],
  };
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) return fallback;
    const obj = JSON.parse(raw.slice(start, end + 1)) as Partial<LlmEnhancement>;
    return {
      expression: obj.expression ?? "",
      explanation: obj.explanation ?? "",
      alternatives: Array.isArray(obj.alternatives) ? obj.alternatives : [],
      suggestions: Array.isArray(obj.suggestions) ? obj.suggestions : [],
    };
  } catch {
    return fallback;
  }
}

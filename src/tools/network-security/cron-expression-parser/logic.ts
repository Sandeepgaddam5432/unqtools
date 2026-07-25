/**
 * Cron Expression Parser — parse cron fields, describe, and compute next N runs.
 * Format: minute hour day-of-month month day-of-week
 */
export interface CronFields {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

export const FIELD_RANGES: Record<keyof CronFields, { min: number; max: number }> = {
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  dayOfMonth: { min: 1, max: 31 },
  month: { min: 1, max: 12 },
  dayOfWeek: { min: 0, max: 7 },
};

export const DAY_NAMES: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

export const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Parse a single cron field into a sorted list of integers. */
export function parseField(field: string, range: { min: number; max: number }, names?: Record<string, number>): number[] {
  if (!field || field === "*") {
    const out: number[] = [];
    for (let i = range.min; i <= range.max; i++) out.push(i);
    return out;
  }
  const out = new Set<number>();
  for (const part of field.split(",")) {
    let step = 1;
    const slashIdx = part.indexOf("/");
    let rangePart = part;
    if (slashIdx >= 0) {
      step = Number(part.slice(slashIdx + 1));
      rangePart = part.slice(0, slashIdx);
    }
    let lo = range.min, hi = range.max;
    if (rangePart !== "*") {
      const dashIdx = rangePart.indexOf("-");
      if (dashIdx >= 0) {
        lo = parseValue(rangePart.slice(0, dashIdx), names);
        hi = parseValue(rangePart.slice(dashIdx + 1), names);
      } else {
        lo = hi = parseValue(rangePart, names);
      }
    }
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return [...out].filter((v) => v >= range.min && v <= range.max).sort((a, b) => a - b);
}

function parseValue(s: string, names?: Record<string, number>): number {
  const lower = s.toLowerCase();
  if (names && names[lower] != null) return names[lower];
  return Number(s);
}

/** Parse a cron expression into CronFields. */
export function parseCron(expr: string): CronFields | { error: string } {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return { error: "Cron must have 5 fields" };
  return {
    minute: parts[0]!,
    hour: parts[1]!,
    dayOfMonth: parts[2]!,
    month: parts[3]!,
    dayOfWeek: parts[4]!,
  };
}

/** Describe a cron expression in plain English (best-effort). */
export function describeCron(expr: string): string {
  const parsed = parseCron(expr);
  if ("error" in parsed) return parsed.error;
  const min = parsed.minute === "*" ? "every minute" : `at minute ${parsed.minute}`;
  const hr = parsed.hour === "*" ? "every hour" : `at hour ${parsed.hour}`;
  const dom = parsed.dayOfMonth === "*" ? "every day" : `on day ${parsed.dayOfMonth}`;
  const mon = parsed.month === "*" ? "every month" : `in month ${parsed.month}`;
  const dow = parsed.dayOfWeek === "*" ? "" : `on weekday ${parsed.dayOfWeek}`;
  return `${min}, ${hr}, ${dom}, ${mon} ${dow}`.trim();
}

/** Compute the next N runs starting from `from` (Date). */
export function nextRuns(expr: string, from: Date, count = 3): Date[] | { error: string } {
  const parsed = parseCron(expr);
  if ("error" in parsed) return parsed;
  const minutes = parseField(parsed.minute, FIELD_RANGES.minute);
  const hours = parseField(parsed.hour, FIELD_RANGES.hour);
  const doms = parseField(parsed.dayOfMonth, FIELD_RANGES.dayOfMonth);
  const months = parseField(parsed.month, FIELD_RANGES.month);
  let dows = parseField(parsed.dayOfWeek, FIELD_RANGES.dayOfWeek);
  // Normalize 7 → 0 (Sunday)
  dows = dows.map((d) => (d === 7 ? 0 : d));
  const out: Date[] = [];
  const cur = new Date(from.getTime() + 60 * 1000);
  cur.setSeconds(0, 0);
  // Cap iterations to avoid infinite loops
  for (let i = 0; i < 500000 && out.length < count; i++) {
    if (months.includes(cur.getMonth() + 1) && doms.includes(cur.getDate()) && dows.includes(cur.getDay())) {
      if (hours.includes(cur.getHours()) && minutes.includes(cur.getMinutes())) {
        out.push(new Date(cur.getTime()));
      }
    }
    cur.setMinutes(cur.getMinutes() + 1);
  }
  return out;
}

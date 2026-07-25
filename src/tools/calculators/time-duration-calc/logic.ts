/**
 * Time Duration Calculator — duration between two times with break deductions.
 */
export interface TimeRange {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

export interface DurationInput {
  start: string;
  end: string;
  breaks: TimeRange[]; // break periods to deduct
}

export interface DurationResult {
  totalMinutes: number;     // gross
  breakMinutes: number;     // deducted
  netMinutes: number;       // total - break
  hours: number;            // net as decimal hours
  formatted: string;        // "Hh Mm"
}

const RE = /^(\d{1,2}):(\d{2})$/;

/** Parse "HH:MM" to minutes since midnight. Returns null on invalid input. */
export function parseTime(t: string): number | null {
  const m = RE.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** Compute duration in minutes between two time-of-day values (handles overnight). */
export function durationMinutes(start: string, end: string): number | null {
  const s = parseTime(start);
  const e = parseTime(end);
  if (s == null || e == null) return null;
  let diff = e - s;
  if (diff < 0) diff += 24 * 60; // overnight
  return diff;
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
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
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

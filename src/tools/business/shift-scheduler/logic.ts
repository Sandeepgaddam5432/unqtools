/**
 * Shift Scheduler — plan shifts, calculate coverage hours.
 */
export interface Shift {
  employee: string;
  start: string;  // "HH:MM"
  end: string;    // "HH:MM"
}

export interface CoverageSlot {
  startMin: number;
  endMin: number;
  count: number;
}

const RE = /^(\d{1,2}):(\d{2})$/;

export function parseTime(t: string): number | null {
  const m = RE.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]); const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function shiftMinutes(shift: Shift): { start: number; end: number } | { error: string } {
  const s = parseTime(shift.start); const e = parseTime(shift.end);
  if (s == null || e == null) return { error: `Invalid shift: ${shift.start} → ${shift.end}` };
  let end = e; if (end < s) end += 24 * 60;
  return { start: s, end };
}

/** Total hours across all shifts. */
export function totalHours(shifts: Shift[]): number | { error: string } {
  let total = 0;
  for (const s of shifts) {
    const m = shiftMinutes(s);
    if ("error" in m) return m;
    total += m.end - m.start;
  }
  return total / 60;
}

/** Compute coverage per minute and return summary slots. */
export function computeCoverage(shifts: Shift[]): CoverageSlot[] | { error: string } {
  const ranges: { start: number; end: number }[] = [];
  for (const s of shifts) {
    const m = shiftMinutes(s);
    if ("error" in m) return m;
    ranges.push(m);
  }
  if (ranges.length === 0) return [];
  const events: { time: number; delta: number }[] = [];
  for (const r of ranges) {
    events.push({ time: r.start, delta: 1 });
    events.push({ time: r.end, delta: -1 });
  }
  events.sort((a, b) => a.time - b.time || a.delta - b.delta);
  const slots: CoverageSlot[] = [];
  let count = 0;
  for (let i = 0; i < events.length - 1; i++) {
    count += events[i]!.delta;
    if (count > 0 && events[i]!.time < events[i + 1]!.time) {
      slots.push({ startMin: events[i]!.time, endMin: events[i + 1]!.time, count });
    }
  }
  return slots;
}

/** Format minutes as "HH:MM". */
export function formatTime(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

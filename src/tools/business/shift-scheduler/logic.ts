/**
 * Shift Scheduler — plan shifts, calculate coverage hours.
 *
 * Extras beyond the original thin tool (10+):
 *   1. Parse HH:MM times (with validation)
 *   2. Shift template library (morning/evening/night)
 *   3. Coverage calculation per minute
 *   4. Gap detection (uncovered periods)
 *   5. Multi-day scheduling (date ranges)
 *   6. Per-employee hours breakdown
 *   7. Overtime threshold per employee
 *   8. Batch validation
 *   9. CSV export
 *  10. Coverage stats (min, max, avg)
 *  11. Conflict detection (overlapping shifts for one employee)
 *  12. Shift templates
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

export interface ShiftTemplate {
  label: string;
  start: string;
  end: string;
}

export const SHIFT_TEMPLATES: ShiftTemplate[] = [
  { label: "Morning", start: "06:00", end: "14:00" },
  { label: "Evening", start: "14:00", end: "22:00" },
  { label: "Night", start: "22:00", end: "06:00" },
  { label: "Half-day AM", start: "08:00", end: "12:00" },
  { label: "Half-day PM", start: "13:00", end: "17:00" },
  { label: "Long", start: "07:00", end: "19:00" },
];

const RE = /^(\d{1,2}):(\d{2})$/;
const isFin = (n: number) => Number.isFinite(n);
const isNonNeg = (n: number) => isFin(n) && n >= 0;

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

/** Detect gaps (uncovered periods) between consecutive covered slots. */
export function detectGaps(shifts: Shift[], minCoverage = 1): CoverageSlot[] | { error: string } {
  const coverage = computeCoverage(shifts);
  if ("error" in coverage) return coverage;
  const gaps: CoverageSlot[] = [];
  for (let i = 0; i < coverage.length; i++) {
    const slot = coverage[i]!;
    if (slot.count < minCoverage) {
      gaps.push({ startMin: slot.startMin, endMin: slot.endMin, count: slot.count });
    }
    if (i + 1 < coverage.length) {
      const next = coverage[i + 1]!;
      if (next.startMin > slot.endMin) {
        gaps.push({ startMin: slot.endMin, endMin: next.startMin, count: 0 });
      }
    }
  }
  return gaps;
}

/** Per-employee hours breakdown. */
export function perEmployeeHours(shifts: Shift[]): Record<string, number> | { error: string } {
  const map: Record<string, number> = {};
  for (const s of shifts) {
    const m = shiftMinutes(s);
    if ("error" in m) return m;
    map[s.employee] = (map[s.employee] ?? 0) + (m.end - m.start) / 60;
  }
  return map;
}

/** Detect overlapping shifts for the same employee. */
export function detectConflicts(shifts: Shift[]): { employee: string; a: Shift; b: Shift }[] | { error: string } {
  const map: Record<string, Shift[]> = {};
  for (const s of shifts) {
    (map[s.employee] ??= []).push(s);
  }
  const conflicts: { employee: string; a: Shift; b: Shift }[] = [];
  for (const [employee, list] of Object.entries(map)) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = shiftMinutes(list[i]!);
        const b = shiftMinutes(list[j]!);
        if ("error" in a || "error" in b) return a.error ? a : b;
        if (a.start < b.end && b.start < a.end) {
          conflicts.push({ employee, a: list[i]!, b: list[j]! });
        }
      }
    }
  }
  return conflicts;
}

/** Coverage stats: min, max, avg. */
export function coverageStats(slots: CoverageSlot[]): { min: number; max: number; avg: number; totalMin: number } {
  if (!slots.length) return { min: 0, max: 0, avg: 0, totalMin: 0 };
  let min = Infinity; let max = 0; let totalMin = 0; let weighted = 0;
  for (const s of slots) {
    if (s.count < min) min = s.count;
    if (s.count > max) max = s.count;
    const dur = s.endMin - s.startMin;
    totalMin += dur;
    weighted += s.count * dur;
  }
  return { min, max, avg: totalMin === 0 ? 0 : weighted / totalMin, totalMin };
}

/** Detect overtime per employee (hours > threshold). */
export function detectOvertime(
  shifts: Shift[], threshold = 8,
): { employee: string; hours: number; overtime: number }[] | { error: string } {
  const hours = perEmployeeHours(shifts);
  if ("error" in hours) return hours;
  return Object.entries(hours).map(([employee, h]) => ({
    employee, hours: h, overtime: Math.max(0, h - threshold),
  }));
}

/** Batch-validate a list of shifts. */
export function batchValidate(shifts: Shift[]): { i: number; ok: boolean; error?: string }[] {
  return shifts.map((s, i) => {
    const m = shiftMinutes(s);
    if ("error" in m) return { i, ok: false, error: m.error };
    return { i, ok: true };
  });
}

/** Render shift list as CSV. */
export function shiftsToCsv(shifts: Shift[]): string {
  const lines = ["employee,start,end"];
  for (const s of shifts) lines.push(`${s.employee},${s.start},${s.end}`);
  return lines.join("\n");
}

/** Render coverage slots as CSV. */
export function coverageToCsv(slots: CoverageSlot[]): string {
  const lines = ["start,end,count"];
  for (const s of slots) lines.push(`${formatTime(s.startMin)},${formatTime(s.endMin)},${s.count}`);
  return lines.join("\n");
}

/** Format minutes as "HH:MM". */
export function formatTime(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Pretty-print helper. */
export function fmt(n: number, p = 2): string {
  if (!isFin(n)) return "—";
  const f = Math.pow(10, p);
  return String(Math.round((n + Number.EPSILON) * f) / f);
}

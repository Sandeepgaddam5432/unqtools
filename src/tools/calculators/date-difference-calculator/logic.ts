/**
 * Date Difference Calculator — pure logic.
 */

export interface DateDiffInput {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  /** Optional ISO date strings to exclude as holidays (only affects business-day counts). */
  holidays?: string[];
}

export interface DateDiffResult {
  totalDays: number;
  totalWeeks: number;
  totalWeekendDays: number;
  businessDays: number;
  /** Calendar difference: years + months + days breakdown. */
  years: number;
  months: number;
  days: number;
  /** Humanized relative time (e.g. "1 year, 2 months, 3 days"). */
  humanized: string;
  weekdayStart: string;
  weekdayEnd: string;
  isoWeekStart: number;
  isoWeekEnd: number;
  dayOfYearStart: number;
  dayOfYearEnd: number;
  daysRemainingInYearEnd: number;
  quarterStart: number;
  quarterEnd: number;
  halfYearStart: "H1" | "H2";
  halfYearEnd: "H1" | "H2";
  isLeapYearStart: boolean;
  perWeekBreakdown: { weekOf: string; days: number }[];
  direction: "past" | "future" | "same";
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / MS_PER_DAY);
}

function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((t.getTime() - firstThursday.getTime()) / MS_PER_DAY - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

export function calculateDateDiff(input: DateDiffInput): DateDiffResult | { error: string } {
  const start = parseDate(input.startDate);
  const end = parseDate(input.endDate);
  if (!start) return { error: "Start date must be in YYYY-MM-DD format." };
  if (!end) return { error: "End date must be in YYYY-MM-DD format." };

  const direction: DateDiffResult["direction"] = start.getTime() === end.getTime()
    ? "same" : start < end ? "future" : "past";

  const earlier = start <= end ? start : end;
  const later = start <= end ? end : start;

  // Calendar diff
  let years = later.getFullYear() - earlier.getFullYear();
  let months = later.getMonth() - earlier.getMonth();
  let days = later.getDate() - earlier.getDate();
  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(later.getFullYear(), later.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalMs = end.getTime() - start.getTime();
  const totalDays = Math.round(totalMs / MS_PER_DAY);
  const totalWeeks = totalDays / 7;

  // Business days + weekend days
  const holidaySet = new Set((input.holidays ?? []).filter(Boolean));
  let businessDays = 0;
  let weekendDays = 0;
  const cursor = new Date(earlier);
  cursor.setDate(cursor.getDate() + 1); // exclusive of start
  while (cursor <= later) {
    const day = cursor.getDay();
    const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    if (day === 0 || day === 6) weekendDays++;
    else if (holidaySet.has(dateStr)) { /* skip holiday */ }
    else businessDays++;
    cursor.setDate(cursor.getDate() + 1);
  }

  // Per-week breakdown
  const perWeekBreakdown: { weekOf: string; days: number }[] = [];
  const wkCursor = new Date(earlier);
  while (wkCursor <= later) {
    const weekStart = new Date(wkCursor);
    let count = 0;
    const wkEnd = new Date(wkCursor);
    wkEnd.setDate(wkEnd.getDate() + 6);
    const rangeEnd = wkEnd > later ? later : wkEnd;
    const iter = new Date(weekStart);
    while (iter <= rangeEnd) {
      count++;
      iter.setDate(iter.getDate() + 1);
    }
    const ws = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
    perWeekBreakdown.push({ weekOf: ws, days: count });
    wkCursor.setDate(wkCursor.getDate() + 7);
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years === 1 ? "" : "s"}`);
  if (months > 0) parts.push(`${months} month${months === 1 ? "" : "s"}`);
  if (days > 0 || parts.length === 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  const humanized = parts.join(", ");

  return {
    totalDays,
    totalWeeks: Math.round(totalWeeks * 100) / 100,
    totalWeekendDays: weekendDays,
    businessDays,
    years, months, days,
    humanized,
    weekdayStart: WEEKDAYS[start.getDay()]!,
    weekdayEnd: WEEKDAYS[end.getDay()]!,
    isoWeekStart: isoWeek(start),
    isoWeekEnd: isoWeek(end),
    dayOfYearStart: dayOfYear(start),
    dayOfYearEnd: dayOfYear(end),
    daysRemainingInYearEnd: (isLeapYear(end.getFullYear()) ? 366 : 365) - dayOfYear(end),
    quarterStart: Math.floor(start.getMonth() / 3) + 1,
    quarterEnd: Math.floor(end.getMonth() / 3) + 1,
    halfYearStart: start.getMonth() < 6 ? "H1" : "H2",
    halfYearEnd: end.getMonth() < 6 ? "H1" : "H2",
    isLeapYearStart: isLeapYear(start.getFullYear()),
    perWeekBreakdown,
    direction,
  };
}

export interface DateAddInput {
  startDate: string;
  days?: number;
  weeks?: number;
  months?: number;
  years?: number;
  businessDays?: number;
}

export function addToDate(input: DateAddInput): string | { error: string } {
  const start = parseDate(input.startDate);
  if (!start) return { error: "Start date must be in YYYY-MM-DD format." };
  const result = new Date(start);
  if (input.days) result.setDate(result.getDate() + input.days);
  if (input.weeks) result.setDate(result.getDate() + input.weeks * 7);
  if (input.months) result.setMonth(result.getMonth() + input.months);
  if (input.years) result.setFullYear(result.getFullYear() + input.years);
  if (input.businessDays) {
    let added = 0;
    while (added < input.businessDays) {
      result.setDate(result.getDate() + 1);
      const day = result.getDay();
      if (day !== 0 && day !== 6) added++;
    }
  }
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, "0")}-${String(result.getDate()).padStart(2, "0")}`;
}

export function dateDiffToCsv(result: DateDiffResult): string {
  const lines = ["WeekOf,DaysInWeek"];
  for (const w of result.perWeekBreakdown) {
    lines.push(`${w.weekOf},${w.days}`);
  }
  return lines.join("\n");
}

import { describe, it, expect, beforeEach } from "vitest";
import {
  MS_PER_SECOND,
  MS_PER_MINUTE,
  MS_PER_HOUR,
  MS_PER_DAY,
  MS_PER_WEEK,
  DEFAULT_WEEKEND_DAYS,
  parseDateTime,
  isValidDate,
  formatDate,
  formatDateTime,
  daysInMonth,
  isLeapYear,
  calculateYMD,
  calculateTotals,
  countDays,
  explainIncludeEndDay,
  relativePhrase,
  buildSummary,
  calculateDifference,
  calculateAge,
  parseBatch,
  computeBatch,
  renderResultText,
  renderBatchCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  weekdayLabel,
  weekdayShort,
  type DifferenceInput,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

describe("date-difference-calculator constants", () => {
  it("exposes correct ms-per-unit values", () => {
    expect(MS_PER_SECOND).toBe(1000);
    expect(MS_PER_MINUTE).toBe(60_000);
    expect(MS_PER_HOUR).toBe(3_600_000);
    expect(MS_PER_DAY).toBe(86_400_000);
    expect(MS_PER_WEEK).toBe(604_800_000);
  });
  it("defaults weekend to Saturday+Sunday", () => {
    expect(DEFAULT_WEEKEND_DAYS).toEqual([0, 6]);
  });
});

describe("date-difference-calculator parseDateTime", () => {
  it("parses YYYY-MM-DD as UTC midnight", () => {
    const ms = parseDateTime("2025-03-15");
    expect(Number.isNaN(ms)).toBe(false);
    const d = new Date(ms);
    expect(d.getUTCFullYear()).toBe(2025);
    expect(d.getUTCMonth()).toBe(2);
    expect(d.getUTCDate()).toBe(15);
    expect(d.getUTCHours()).toBe(0);
  });
  it("parses YYYY-MM-DDTHH:MM:SS", () => {
    const ms = parseDateTime("2025-03-15T14:30:45");
    const d = new Date(ms);
    expect(d.getUTCHours()).toBe(14);
    expect(d.getUTCMinutes()).toBe(30);
    expect(d.getUTCSeconds()).toBe(45);
  });
  it("parses YYYY-MM-DD HH:MM (space separator)", () => {
    const ms = parseDateTime("2025-03-15 14:30");
    expect(Number.isNaN(ms)).toBe(false);
    expect(new Date(ms).getUTCHours()).toBe(14);
  });
  it("returns NaN for invalid month", () => {
    expect(Number.isNaN(parseDateTime("2025-13-01"))).toBe(true);
  });
  it("returns NaN for Feb 30 (rolled over)", () => {
    expect(Number.isNaN(parseDateTime("2025-02-30"))).toBe(true);
  });
  it("returns NaN for empty/garbage", () => {
    expect(Number.isNaN(parseDateTime(""))).toBe(true);
    expect(Number.isNaN(parseDateTime("not-a-date"))).toBe(true);
  });
});

describe("date-difference-calculator isValidDate", () => {
  it("validates a parseable date", () => {
    expect(isValidDate("2025-03-15")).toBe(true);
  });
  it("rejects an invalid date", () => {
    expect(isValidDate("2025-02-30")).toBe(false);
  });
});

describe("date-difference-calculator formatDate / formatDateTime", () => {
  it("formats a UTC instant as YYYY-MM-DD", () => {
    const ms = Date.UTC(2025, 2, 15, 14, 30, 45);
    expect(formatDate(ms)).toBe("2025-03-15");
  });
  it("formats a UTC instant as YYYY-MM-DDTHH:MM:SS", () => {
    const ms = Date.UTC(2025, 2, 15, 14, 30, 45);
    expect(formatDateTime(ms)).toBe("2025-03-15T14:30:45");
  });
  it("returns empty string for NaN", () => {
    expect(formatDate(Number.NaN)).toBe("");
    expect(formatDateTime(Number.NaN)).toBe("");
  });
});

describe("date-difference-calculator daysInMonth / isLeapYear", () => {
  it("returns 28 for Feb in non-leap year", () => {
    expect(daysInMonth(2025, 2)).toBe(28);
  });
  it("returns 29 for Feb in leap year", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
  });
  it("returns 31 for January", () => {
    expect(daysInMonth(2025, 1)).toBe(31);
  });
  it("detects leap years correctly", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2025)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
  });
});

describe("date-difference-calculator calculateYMD", () => {
  it("same day exclusive = 0y 0m 0d", () => {
    const start = parseDateTime("2025-03-15");
    const end = parseDateTime("2025-03-15");
    expect(calculateYMD(start, end, false)).toEqual({ years: 0, months: 0, days: 0, isNegative: false });
  });
  it("same day inclusive = 0y 0m 1d", () => {
    const start = parseDateTime("2025-03-15");
    const end = parseDateTime("2025-03-15");
    expect(calculateYMD(start, end, true)).toEqual({ years: 0, months: 0, days: 1, isNegative: false });
  });
  it("Jan 1 → Feb 1 exclusive = 0y 1m 0d", () => {
    const start = parseDateTime("2025-01-01");
    const end = parseDateTime("2025-02-01");
    expect(calculateYMD(start, end, false)).toEqual({ years: 0, months: 1, days: 0, isNegative: false });
  });
  it("Jan 1 → Feb 1 inclusive = 0y 1m 1d", () => {
    const start = parseDateTime("2025-01-01");
    const end = parseDateTime("2025-02-01");
    expect(calculateYMD(start, end, true)).toEqual({ years: 0, months: 1, days: 1, isNegative: false });
  });
  it("Jan 1 → Jan 31 exclusive = 0y 0m 30d", () => {
    const start = parseDateTime("2025-01-01");
    const end = parseDateTime("2025-01-31");
    expect(calculateYMD(start, end, false)).toEqual({ years: 0, months: 0, days: 30, isNegative: false });
  });
  it("Jan 1 → next Jan 1 exclusive = 1y 0m 0d", () => {
    const start = parseDateTime("2025-01-01");
    const end = parseDateTime("2026-01-01");
    expect(calculateYMD(start, end, false)).toEqual({ years: 1, months: 0, days: 0, isNegative: false });
  });
  it("Jan 31 → Feb 28 (non-leap) = 0y 1m 0d (clamped — Jan 31 +1 month = Feb 28)", () => {
    // With the clamping convention (used by JS Date.setMonth and most users'
    // intuition), Jan 31 + 1 month lands on Feb 28 (last day of Feb), so this
    // counts as 1 full month.
    const start = parseDateTime("2025-01-31");
    const end = parseDateTime("2025-02-28");
    expect(calculateYMD(start, end, false)).toEqual({ years: 0, months: 1, days: 0, isNegative: false });
  });
  it("Jan 31 → Mar 1 (leap year) = 0y 1m 1d", () => {
    // Anchor approach: Jan 31 + 1 month = Feb 29 (clamped) → 1 day to Mar 1
    const start = parseDateTime("2024-01-31");
    const end = parseDateTime("2024-03-01");
    expect(calculateYMD(start, end, false)).toEqual({ years: 0, months: 1, days: 1, isNegative: false });
  });
  it("Feb 29 → Feb 28 next year = 1y 0m 0d", () => {
    const start = parseDateTime("2024-02-29");
    const end = parseDateTime("2025-02-28");
    expect(calculateYMD(start, end, false)).toEqual({ years: 1, months: 0, days: 0, isNegative: false });
  });
  it("Feb 29 → Mar 1 (leap year) = 0y 0m 1d", () => {
    const start = parseDateTime("2024-02-29");
    const end = parseDateTime("2024-03-01");
    expect(calculateYMD(start, end, false)).toEqual({ years: 0, months: 0, days: 1, isNegative: false });
  });
  it("handles end before start (isNegative=true)", () => {
    const start = parseDateTime("2025-02-01");
    const end = parseDateTime("2025-01-01");
    const r = calculateYMD(start, end, false);
    expect(r.isNegative).toBe(true);
    expect(r.years).toBe(0);
    expect(r.months).toBe(1);
    expect(r.days).toBe(0);
  });
  it("returns zeros for NaN inputs", () => {
    const r = calculateYMD(Number.NaN, Number.NaN, false);
    expect(r).toEqual({ years: 0, months: 0, days: 0, isNegative: false });
  });
});

describe("date-difference-calculator calculateTotals", () => {
  it("Jan 1 → Jan 2 exclusive = 1 day, 24 hours", () => {
    const start = parseDateTime("2025-01-01");
    const end = parseDateTime("2025-01-02");
    const t = calculateTotals(start, end, false);
    expect(t.totalDays).toBe(1);
    expect(t.totalHours).toBe(24);
    expect(t.totalMinutes).toBe(1440);
    expect(t.totalSeconds).toBe(86400);
    expect(t.totalWeeks).toBeCloseTo(1 / 7, 5);
  });
  it("Jan 1 → Jan 2 inclusive = 2 days, 48 hours", () => {
    const start = parseDateTime("2025-01-01");
    const end = parseDateTime("2025-01-02");
    const t = calculateTotals(start, end, true);
    expect(t.totalDays).toBe(2);
    expect(t.totalHours).toBe(48);
  });
  it("same day exclusive = 0 days, 0 hours", () => {
    const start = parseDateTime("2025-01-01");
    const end = parseDateTime("2025-01-01");
    const t = calculateTotals(start, end, false);
    expect(t.totalDays).toBe(0);
    expect(t.totalMs).toBe(0);
  });
  it("same day inclusive = 1 day, 24 hours", () => {
    const start = parseDateTime("2025-01-01");
    const end = parseDateTime("2025-01-01");
    const t = calculateTotals(start, end, true);
    expect(t.totalDays).toBe(1);
    expect(t.totalHours).toBe(24);
  });
  it("handles negative (end before start) using abs", () => {
    const start = parseDateTime("2025-01-02");
    const end = parseDateTime("2025-01-01");
    const t = calculateTotals(start, end, false);
    expect(t.totalDays).toBe(1);
  });
});

describe("date-difference-calculator countDays", () => {
  it("Monday → Friday exclusive = 4 weekdays, 0 weekend", () => {
    // 2025-03-10 is Monday, 2025-03-14 is Friday
    const start = parseDateTime("2025-03-10");
    const end = parseDateTime("2025-03-14");
    const r = countDays(start, end, false);
    expect(r.weekdays).toBe(4);
    expect(r.weekendDays).toBe(0);
    expect(r.businessDays).toBe(4);
    expect(r.holidaysHit).toBe(0);
  });
  it("Monday → Friday inclusive = 5 weekdays, 0 weekend", () => {
    const start = parseDateTime("2025-03-10");
    const end = parseDateTime("2025-03-14");
    const r = countDays(start, end, true);
    expect(r.weekdays).toBe(5);
    expect(r.weekendDays).toBe(0);
  });
  it("Friday → Monday exclusive = 1 weekday, 2 weekend days", () => {
    // 2025-03-14 is Friday, 2025-03-17 is Monday
    // (Fri, Mon] = Sat, Sun, Mon = 2 weekend + 1 weekday
    const start = parseDateTime("2025-03-14");
    const end = parseDateTime("2025-03-17");
    const r = countDays(start, end, false);
    expect(r.weekdays).toBe(1);
    expect(r.weekendDays).toBe(2);
  });
  it("excludes a holiday that falls on a weekday from business days", () => {
    // 2025-03-10 to 2025-03-14 — make Wed (2025-03-12) a holiday
    const start = parseDateTime("2025-03-10");
    const end = parseDateTime("2025-03-14");
    const r = countDays(start, end, true, [0, 6], ["2025-03-12"]);
    expect(r.weekdays).toBe(5);     // still 5 weekdays
    expect(r.holidaysHit).toBe(1);  // one of them is a holiday
    expect(r.businessDays).toBe(4); // 5 - 1 = 4
  });
  it("ignores holidays that fall on a weekend", () => {
    // 2025-03-15 is Saturday — make it a "holiday" but it's a weekend anyway
    const start = parseDateTime("2025-03-14");
    const end = parseDateTime("2025-03-17");
    const r = countDays(start, end, true, [0, 6], ["2025-03-15"]);
    expect(r.holidaysHit).toBe(0); // weekend, doesn't count as holiday
  });
  it("supports Middle East weekend (Fri+Sat)", () => {
    // 2025-03-10 (Mon) → 2025-03-16 (Sun), inclusive, Fri+Sat weekend
    // Days: Mon, Tue, Wed, Thu, Fri(we), Sat(we), Sun = 5 weekdays
    const start = parseDateTime("2025-03-10");
    const end = parseDateTime("2025-03-16");
    const r = countDays(start, end, true, [5, 6], []);
    expect(r.weekdays).toBe(5);
    expect(r.weekendDays).toBe(2);
  });
  it("returns zeros for NaN inputs", () => {
    const r = countDays(Number.NaN, Number.NaN, false);
    expect(r).toEqual({ weekdays: 0, weekendDays: 0, businessDays: 0, holidaysHit: 0 });
  });
});

describe("date-difference-calculator explainIncludeEndDay", () => {
  it("explains inclusive mode", () => {
    const s = explainIncludeEndDay(true);
    expect(s.toLowerCase()).toContain("inclusive");
    expect(s).toContain("2 days");
  });
  it("explains exclusive mode", () => {
    const s = explainIncludeEndDay(false);
    expect(s.toLowerCase()).toContain("exclusive");
    expect(s).toContain("1 day");
  });
});

describe("date-difference-calculator relativePhrase", () => {
  it("returns 'now' for zero delta", () => {
    expect(relativePhrase(0)).toBe("now");
  });
  it("returns future phrase for positive delta", () => {
    expect(relativePhrase(MS_PER_DAY)).toBe("in 1 day");
    expect(relativePhrase(MS_PER_DAY * 5)).toBe("in 5 days");
  });
  it("returns past phrase for negative delta", () => {
    expect(relativePhrase(-MS_PER_DAY)).toBe("1 day ago");
    expect(relativePhrase(-MS_PER_DAY * 3)).toBe("3 days ago");
  });
  it("uses minute unit for sub-hour deltas", () => {
    expect(relativePhrase(MS_PER_MINUTE * 5)).toBe("in 5 minutes");
  });
  it("uses year unit for multi-year deltas", () => {
    expect(relativePhrase(MS_PER_DAY * 365 * 3)).toBe("in 3 years");
  });
});

describe("date-difference-calculator buildSummary", () => {
  it("builds a single-day summary", () => {
    const s = buildSummary({ years: 0, months: 0, days: 1, isNegative: false }, { totalDays: 1 } as never);
    expect(s).toContain("1 day");
    expect(s).toContain("1 day total");
  });
  it("builds a multi-part summary", () => {
    const s = buildSummary({ years: 1, months: 2, days: 3, isNegative: false }, { totalDays: 426 } as never);
    expect(s).toContain("1 year");
    expect(s).toContain("2 months");
    expect(s).toContain("3 days");
    expect(s).toContain("426 days total");
  });
  it("prefixes with - for negative", () => {
    const s = buildSummary({ years: 0, months: 1, days: 0, isNegative: true }, { totalDays: 30 } as never);
    expect(s.startsWith("-")).toBe(true);
  });
});

describe("date-difference-calculator calculateDifference (integration)", () => {
  it("returns full result with all fields populated", () => {
    const input: DifferenceInput = {
      startMs: parseDateTime("2025-01-01"),
      endMs: parseDateTime("2025-03-15"),
      includeEndDay: false,
    };
    const r = calculateDifference(input);
    expect(r.years).toBe(0);
    expect(r.months).toBe(2);
    expect(r.days).toBe(14); // Jan 1 → Mar 15 = 2 months 14 days
    expect(r.isNegative).toBe(false);
    expect(r.totalDays).toBe(73); // 31 + 28 + 14
    expect(r.includeEndExplanation).toContain("Exclusive");
    expect(r.summary).toContain("2 months");
    expect(r.relativePhrase).toContain("in "); // future (end > start)
  });
  it("respects includeEndDay across all fields", () => {
    const a = calculateDifference({
      startMs: parseDateTime("2025-01-01"),
      endMs: parseDateTime("2025-01-02"),
      includeEndDay: false,
    });
    const b = calculateDifference({
      startMs: parseDateTime("2025-01-01"),
      endMs: parseDateTime("2025-01-02"),
      includeEndDay: true,
    });
    expect(b.totalDays).toBe(a.totalDays + 1);
    expect(b.days).toBe(a.days + 1);
  });
});

describe("date-difference-calculator calculateAge", () => {
  it("computes age in calendar Y/M/D", () => {
    const birth = parseDateTime("2000-01-01");
    const now = parseDateTime("2025-01-01");
    const r = calculateAge(birth, now);
    expect(r.years).toBe(25);
    expect(r.months).toBe(0);
    expect(r.days).toBe(0);
  });
  it("computes age with months and days", () => {
    const birth = parseDateTime("2000-01-15");
    const now = parseDateTime("2025-03-20");
    const r = calculateAge(birth, now);
    expect(r.years).toBe(25);
    expect(r.months).toBe(2);
    expect(r.days).toBe(5);
  });
  it("computes next birthday", () => {
    const birth = parseDateTime("2000-06-15");
    const now = parseDateTime("2025-03-15");
    const r = calculateAge(birth, now);
    expect(r.nextBirthdayDate).toBe("2025-06-15");
    expect(r.daysUntilNextBirthday).toBeGreaterThan(0);
  });
  it("handles future birth date", () => {
    const birth = parseDateTime("2050-01-01");
    const now = parseDateTime("2025-01-01");
    const r = calculateAge(birth, now);
    expect(r.years).toBe(0);
    expect(r.summary).toContain("future");
  });
  it("handles Feb 29 birth in non-leap year", () => {
    // Born Feb 29, 2000; now Mar 1, 2025 → 25 years, 0 months, 1 day
    // (since Feb 29, 2025 doesn't exist, next birthday is Mar 1, 2025 — actually
    //  our code uses Mar 1 as the birthday in non-leap years via Date.UTC rollover)
    const birth = parseDateTime("2000-02-29");
    const now = parseDateTime("2025-03-01");
    const r = calculateAge(birth, now);
    expect(r.years).toBe(25);
    expect(r.days).toBe(1); // 1 day past Feb 28 (clamped)
  });
});

describe("date-difference-calculator parseBatch", () => {
  it("parses comma-separated pairs", () => {
    const pairs = parseBatch("2025-01-01,2025-01-31\n2025-02-01,2025-02-28");
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toEqual({ start: "2025-01-01", end: "2025-01-31" });
  });
  it("skips blank lines and comments", () => {
    const pairs = parseBatch("# comment\n2025-01-01,2025-01-02\n\n# another\n2025-03-01,2025-03-15");
    expect(pairs).toHaveLength(2);
  });
  it("handles tab separator", () => {
    const pairs = parseBatch("2025-01-01\t2025-01-02");
    expect(pairs).toHaveLength(1);
  });
});

describe("date-difference-calculator computeBatch", () => {
  it("computes results for valid pairs", () => {
    const pairs = parseBatch("2025-01-01,2025-01-31");
    const rows = computeBatch(pairs, false);
    expect(rows).toHaveLength(1);
    expect(rows[0].ok).toBe(true);
    expect(rows[0].totalDays).toBe(30);
    expect(rows[0].days).toBe(30);
  });
  it("flags invalid rows with error message", () => {
    const pairs = parseBatch("not-a-date,2025-01-02");
    const rows = computeBatch(pairs, false);
    expect(rows[0].ok).toBe(false);
    expect(rows[0].error).toContain("Invalid");
  });
});

describe("date-difference-calculator renderResultText", () => {
  it("includes summary, totals, and convention", () => {
    const r = calculateDifference({
      startMs: parseDateTime("2025-01-01"),
      endMs: parseDateTime("2025-03-15"),
      includeEndDay: false,
    });
    const text = renderResultText(r);
    expect(text).toContain("Summary:");
    expect(text).toContain("Totals:");
    expect(text).toContain("Day counts:");
    expect(text).toContain("Convention:");
  });
});

describe("date-difference-calculator renderBatchCsv", () => {
  it("renders header + rows", () => {
    const pairs = parseBatch("2025-01-01,2025-01-31");
    const rows = computeBatch(pairs, false);
    const csv = renderBatchCsv(rows);
    expect(csv).toContain("start,end,total_days,business_days,years,months,days,ok,error");
    expect(csv).toContain("2025-01-01,2025-01-31");
    expect(csv).toContain(",yes,");
  });
});

describe("date-difference-calculator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, start: "2025-01-01", end: "2025-01-31", includeEndDay: false, totalDays: 30 });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].start).toBe("2025-01-01");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, start: "2025-01-01", end: "2025-01-02", includeEndDay: false, totalDays: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, start: "2025-01-01", end: "2025-01-02", includeEndDay: false, totalDays: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("date-difference-calculator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      start: "2025-01-01",
      end: "2025-03-15",
      includeEndDay: true,
      weekendDays: [0, 6],
      holidays: ["2025-01-01"],
    });
    expect(url).toContain("start=2025-01-01");
    expect(url).toContain("end=2025-03-15");
    expect(url).toContain("incl=1");
    expect(url).toContain("we=0%2C6");
    expect(url).toContain("hol=2025-01-01");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("start=2025-01-01&end=2025-03-15&incl=1&we=0,6&hol=2025-01-01");
    expect(p).not.toBeNull();
    expect(p!.start).toBe("2025-01-01");
    expect(p!.end).toBe("2025-03-15");
    expect(p!.includeEndDay).toBe(true);
    expect(p!.weekendDays).toEqual([0, 6]);
    expect(p!.holidays).toEqual(["2025-01-01"]);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("filters invalid holiday dates on parse", () => {
    const p = parseShareUrl("start=2025-01-01&end=2025-01-02&hol=2025-01-01,not-a-date");
    expect(p!.holidays).toEqual(["2025-01-01"]);
  });
});

describe("date-difference-calculator weekday helpers", () => {
  it("weekdayLabel returns full name", () => {
    expect(weekdayLabel(0)).toBe("Sunday");
    expect(weekdayLabel(1)).toBe("Monday");
    expect(weekdayLabel(6)).toBe("Saturday");
  });
  it("weekdayShort returns 3-letter name", () => {
    expect(weekdayShort(0)).toBe("Sun");
    expect(weekdayShort(3)).toBe("Wed");
  });
});

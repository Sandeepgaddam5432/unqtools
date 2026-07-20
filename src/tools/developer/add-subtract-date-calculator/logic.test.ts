import { describe, it, expect, beforeEach } from "vitest";
import {
  MS_PER_SECOND,
  MS_PER_MINUTE,
  MS_PER_HOUR,
  MS_PER_DAY,
  MS_PER_WEEK,
  DEFAULT_WEEKEND_DAYS,
  UNIT_LABELS,
  UNIT_ORDER,
  parseDateTime,
  isValidDate,
  formatDate,
  formatDateTime,
  daysInMonth,
  isLeapYear,
  weekdayLabel,
  weekdayShort,
  explainMonthEndPolicy,
  explainDateMode,
  relativePhrase,
  formatOffset,
  isOffsetEmpty,
  buildSummary,
  applyOffset,
  walkBusinessDays,
  calculateAddSubtract,
  generateSeries,
  renderSeriesCsv,
  renderResultText,
  nowMs,
  startOfDay,
  endOfDay,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type DateOffset,
  type AddSubtractInput,
  type SeriesInput,
  type ShareState,
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

describe("add-subtract-date-calculator constants", () => {
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
  it("exposes 7 unit labels in order", () => {
    expect(UNIT_ORDER).toEqual(["years", "months", "weeks", "days", "hours", "minutes", "seconds"]);
    expect(Object.keys(UNIT_LABELS)).toHaveLength(7);
  });
});

describe("add-subtract-date-calculator parseDateTime", () => {
  it("parses YYYY-MM-DD as UTC midnight", () => {
    const ms = parseDateTime("2025-03-15");
    expect(Number.isNaN(ms)).toBe(false);
    const d = new Date(ms);
    expect(d.getUTCFullYear()).toBe(2025);
    expect(d.getUTCMonth()).toBe(2);
    expect(d.getUTCDate()).toBe(15);
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

describe("add-subtract-date-calculator isValidDate / formatDate", () => {
  it("validates a parseable date", () => {
    expect(isValidDate("2025-03-15")).toBe(true);
  });
  it("rejects an invalid date", () => {
    expect(isValidDate("2025-02-30")).toBe(false);
  });
  it("formats a UTC instant as YYYY-MM-DD", () => {
    expect(formatDate(parseDateTime("2025-03-15T14:30:45"))).toBe("2025-03-15");
  });
  it("formats a UTC instant as YYYY-MM-DDTHH:MM:SS", () => {
    expect(formatDateTime(parseDateTime("2025-03-15T14:30:45"))).toBe("2025-03-15T14:30:45");
  });
  it("returns empty string for NaN", () => {
    expect(formatDate(Number.NaN)).toBe("");
    expect(formatDateTime(Number.NaN)).toBe("");
  });
});

describe("add-subtract-date-calculator daysInMonth / isLeapYear", () => {
  it("returns 28 for Feb 2025 (non-leap)", () => {
    expect(daysInMonth(2025, 2)).toBe(28);
  });
  it("returns 29 for Feb 2024 (leap)", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
  });
  it("returns 31 for Jan", () => {
    expect(daysInMonth(2025, 1)).toBe(31);
  });
  it("isLeapYear true for 2024", () => {
    expect(isLeapYear(2024)).toBe(true);
  });
  it("isLeapYear false for 1900 (century rule)", () => {
    expect(isLeapYear(1900)).toBe(false);
  });
  it("isLeapYear true for 2000 (400-year rule)", () => {
    expect(isLeapYear(2000)).toBe(true);
  });
});

describe("add-subtract-date-calculator weekday helpers", () => {
  it("returns correct weekday label", () => {
    expect(weekdayLabel(0)).toBe("Sunday");
    expect(weekdayLabel(1)).toBe("Monday");
    expect(weekdayLabel(6)).toBe("Saturday");
  });
  it("returns correct short weekday", () => {
    expect(weekdayShort(0)).toBe("Sun");
    expect(weekdayShort(3)).toBe("Wed");
  });
});

describe("add-subtract-date-calculator applyOffset (clamp policy)", () => {
  it("adds 1 day", () => {
    const start = parseDateTime("2025-01-01");
    const result = applyOffset(start, { days: 1 }, "clamp");
    expect(formatDate(result)).toBe("2025-01-02");
  });
  it("adds 1 month to Jan 31 -> Feb 28 (clamp)", () => {
    const start = parseDateTime("2025-01-31");
    const result = applyOffset(start, { months: 1 }, "clamp");
    expect(formatDate(result)).toBe("2025-02-28");
  });
  it("adds 1 month to Jan 31 in leap year -> Feb 29 (clamp)", () => {
    const start = parseDateTime("2024-01-31");
    const result = applyOffset(start, { months: 1 }, "clamp");
    expect(formatDate(result)).toBe("2024-02-29");
  });
  it("adds 1 year to Feb 29 2024 -> Feb 28 2025 (clamp)", () => {
    const start = parseDateTime("2024-02-29");
    const result = applyOffset(start, { years: 1 }, "clamp");
    expect(formatDate(result)).toBe("2025-02-28");
  });
  it("subtracts 1 month from Mar 31 -> Feb 28 (clamp, negative)", () => {
    const start = parseDateTime("2025-03-31");
    const result = applyOffset(start, { months: -1 }, "clamp");
    expect(formatDate(result)).toBe("2025-02-28");
  });
  it("adds 2 weeks", () => {
    const start = parseDateTime("2025-01-01");
    const result = applyOffset(start, { weeks: 2 }, "clamp");
    expect(formatDate(result)).toBe("2025-01-15");
  });
  it("adds hours + minutes + seconds", () => {
    const start = parseDateTime("2025-01-01T00:00:00");
    const result = applyOffset(start, { hours: 1, minutes: 30, seconds: 15 }, "clamp");
    expect(formatDateTime(result)).toBe("2025-01-01T01:30:15");
  });
  it("adds 1 year + 1 month + 1 day combo", () => {
    const start = parseDateTime("2025-01-15");
    const result = applyOffset(start, { years: 1, months: 1, days: 1 }, "clamp");
    expect(formatDate(result)).toBe("2026-02-16");
  });
});

describe("add-subtract-date-calculator applyOffset (overflow policy)", () => {
  it("adds 1 month to Jan 31 -> Mar 3 (overflow, non-leap)", () => {
    const start = parseDateTime("2025-01-31");
    const result = applyOffset(start, { months: 1 }, "overflow");
    expect(formatDate(result)).toBe("2025-03-03");
  });
  it("adds 1 month to Jan 31 in leap year -> Mar 2 (overflow: Feb has 29 days, 31-29=2)", () => {
    const start = parseDateTime("2024-01-31");
    const result = applyOffset(start, { months: 1 }, "overflow");
    expect(formatDate(result)).toBe("2024-03-02");
  });
  it("adds 1 month to Jan 30 -> Mar 2 (overflow: Feb has 28 days, 30-28=2)", () => {
    const start = parseDateTime("2025-01-30");
    const result = applyOffset(start, { months: 1 }, "overflow");
    expect(formatDate(result)).toBe("2025-03-02");
  });
  it("adds 1 year to Feb 29 2024 -> Mar 1 2025 (overflow: Feb 2025 has 28 days, 29-28=1)", () => {
    const start = parseDateTime("2024-02-29");
    const result = applyOffset(start, { years: 1 }, "overflow");
    expect(formatDate(result)).toBe("2025-03-01");
  });
  it("overflow differs from clamp for Jan 31 + 1 month", () => {
    const start = parseDateTime("2025-01-31");
    const clamped = applyOffset(start, { months: 1 }, "clamp");
    const overflowed = applyOffset(start, { months: 1 }, "overflow");
    expect(formatDate(clamped)).toBe("2025-02-28");
    expect(formatDate(overflowed)).toBe("2025-03-03");
  });
});

describe("add-subtract-date-calculator walkBusinessDays", () => {
  it("walks 1 business day forward from Monday", () => {
    // 2025-01-13 is Monday
    const start = parseDateTime("2025-01-13");
    const r = walkBusinessDays(start, 1);
    expect(formatDate(r.resultMs)).toBe("2025-01-14");
    expect(r.businessDaysMoved).toBe(1);
    expect(r.weekendDaysSkipped).toBe(0);
  });
  it("walks 5 business days forward from Monday (skips weekend)", () => {
    // 2025-01-13 is Monday -> +5 business days = next Monday 2025-01-20
    const start = parseDateTime("2025-01-13");
    const r = walkBusinessDays(start, 5);
    expect(formatDate(r.resultMs)).toBe("2025-01-20");
    expect(r.businessDaysMoved).toBe(5);
    expect(r.weekendDaysSkipped).toBe(2);
  });
  it("walks 10 business days forward from Friday", () => {
    // 2025-01-10 is Friday -> +10 business days = 2025-01-24 (Friday)
    const start = parseDateTime("2025-01-10");
    const r = walkBusinessDays(start, 10);
    expect(formatDate(r.resultMs)).toBe("2025-01-24");
    expect(r.businessDaysMoved).toBe(10);
    expect(r.weekendDaysSkipped).toBe(4);
  });
  it("walks backwards 5 business days", () => {
    // 2025-01-17 is Friday -> -5 business days = 2025-01-10 (Friday)
    const start = parseDateTime("2025-01-17");
    const r = walkBusinessDays(start, -5);
    expect(formatDate(r.resultMs)).toBe("2025-01-10");
  });
  it("skips holidays", () => {
    // 2025-01-13 Monday -> +1 with holiday on Tuesday 2025-01-14 -> lands Wed 2025-01-15
    const start = parseDateTime("2025-01-13");
    const r = walkBusinessDays(start, 1, [0, 6], ["2025-01-14"]);
    expect(formatDate(r.resultMs)).toBe("2025-01-15");
    expect(r.holidaysSkipped).toBe(1);
  });
  it("respects custom weekend days (Fri+Sat)", () => {
    // 2025-01-15 Wednesday -> +1 business day with Fri+Sat weekend
    // Wed -> Thu (Fri is weekend, skip)
    const start = parseDateTime("2025-01-15");
    const r = walkBusinessDays(start, 1, [5, 6]);
    expect(formatDate(r.resultMs)).toBe("2025-01-16");
  });
  it("returns start for zero count", () => {
    const start = parseDateTime("2025-01-13");
    const r = walkBusinessDays(start, 0);
    expect(r.resultMs).toBe(start);
    expect(r.businessDaysMoved).toBe(0);
  });
  it("preserves time-of-day", () => {
    const start = parseDateTime("2025-01-13T09:30:00");
    const r = walkBusinessDays(start, 1);
    expect(formatDateTime(r.resultMs)).toBe("2025-01-14T09:30:00");
  });
});

describe("add-subtract-date-calculator formatting helpers", () => {
  it("formatOffset lists non-zero units", () => {
    expect(formatOffset({ years: 1, days: 3 })).toBe("1 year, 3 days");
  });
  it("formatOffset pluralizes correctly", () => {
    expect(formatOffset({ years: 2, months: 1 })).toBe("2 years, 1 month");
  });
  it("formatOffset empty -> 0 days", () => {
    expect(formatOffset({})).toBe("0 days");
  });
  it("isOffsetEmpty true for empty", () => {
    expect(isOffsetEmpty({})).toBe(true);
    expect(isOffsetEmpty({ years: 0, days: 0 })).toBe(true);
  });
  it("isOffsetEmpty false for non-zero", () => {
    expect(isOffsetEmpty({ days: 1 })).toBe(false);
  });
});

describe("add-subtract-date-calculator explanations", () => {
  it("explains clamp policy", () => {
    const s = explainMonthEndPolicy("clamp");
    expect(s).toContain("Clamp");
    expect(s).toContain("Feb 28");
  });
  it("explains overflow policy", () => {
    const s = explainMonthEndPolicy("overflow");
    expect(s).toContain("Overflow");
    expect(s).toContain("Mar 3");
  });
  it("explains calendar mode", () => {
    expect(explainDateMode("calendar")).toContain("Calendar-day mode");
  });
  it("explains business mode", () => {
    expect(explainDateMode("business")).toContain("Business-day mode");
  });
});

describe("add-subtract-date-calculator relativePhrase", () => {
  it("returns 'now' for zero", () => {
    expect(relativePhrase(0)).toBe("now");
  });
  it("returns 'in X days' for future", () => {
    expect(relativePhrase(MS_PER_DAY * 3)).toBe("in 3 days");
  });
  it("returns 'X days ago' for past", () => {
    expect(relativePhrase(-MS_PER_DAY * 2)).toBe("2 days ago");
  });
  it("returns 'in X weeks' for 1-3 weeks", () => {
    expect(relativePhrase(MS_PER_WEEK * 2)).toBe("in 2 weeks");
  });
  it("singular vs plural", () => {
    expect(relativePhrase(MS_PER_DAY)).toBe("in 1 day");
    expect(relativePhrase(-MS_PER_DAY)).toBe("1 day ago");
  });
});

describe("add-subtract-date-calculator buildSummary", () => {
  it("builds add summary", () => {
    const s = buildSummary("2025-01-01", { months: 1 }, "add", "2025-02-01", "Saturday", "calendar");
    expect(s).toBe("Add 1 month to 2025-01-01 = 2025-02-01 (Saturday)");
  });
  it("builds subtract summary with business mode label", () => {
    const s = buildSummary("2025-01-01", { days: 5 }, "subtract", "2024-12-26", "Thursday", "business");
    expect(s).toBe("Subtract 5 days (business days) from 2025-01-01 = 2024-12-26 (Thursday)");
  });
});

describe("add-subtract-date-calculator calculateAddSubtract (calendar mode)", () => {
  it("adds 1 month to Jan 31 -> Feb 28 (clamp)", () => {
    const r = calculateAddSubtract({
      startMs: parseDateTime("2025-01-31"),
      offset: { months: 1 },
      mode: "add",
      monthEndPolicy: "clamp",
      dateMode: "calendar",
    });
    expect(r.resultDate).toBe("2025-02-28");
    expect(r.weekday).toBe("Friday");
    expect(r.summary).toContain("Add 1 month");
  });
  it("subtracts 30 days from 2025-02-01 -> 2025-01-02", () => {
    const r = calculateAddSubtract({
      startMs: parseDateTime("2025-02-01"),
      offset: { days: 30 },
      mode: "subtract",
      monthEndPolicy: "clamp",
      dateMode: "calendar",
    });
    expect(r.resultDate).toBe("2025-01-02");
  });
  it("handles invalid start (returns NaN-safe result)", () => {
    const r = calculateAddSubtract({
      startMs: Number.NaN,
      offset: { days: 1 },
      mode: "add",
      monthEndPolicy: "clamp",
      dateMode: "calendar",
    });
    expect(r.resultMs).toBeNaN();
    expect(r.summary).toBe("Invalid start date");
  });
  it("includes month-end + date-mode explanations", () => {
    const r = calculateAddSubtract({
      startMs: parseDateTime("2025-01-01"),
      offset: { days: 1 },
      mode: "add",
      monthEndPolicy: "overflow",
      dateMode: "calendar",
    });
    expect(r.monthEndExplanation).toContain("Overflow");
    expect(r.dateModeExplanation).toContain("Calendar-day mode");
  });
  it("adds hours + minutes + seconds with elapsed stats", () => {
    const r = calculateAddSubtract({
      startMs: parseDateTime("2025-01-01T00:00:00"),
      offset: { hours: 1, minutes: 30, seconds: 15 },
      mode: "add",
      monthEndPolicy: "clamp",
      dateMode: "calendar",
    });
    expect(r.resultDateTime).toBe("2025-01-01T01:30:15");
    expect(r.elapsedMs).toBe(MS_PER_HOUR + 30 * MS_PER_MINUTE + 15 * MS_PER_SECOND);
  });
});

describe("add-subtract-date-calculator calculateAddSubtract (business mode)", () => {
  it("adds 5 business days from Monday", () => {
    const r = calculateAddSubtract({
      startMs: parseDateTime("2025-01-13"),
      offset: { days: 5 },
      mode: "add",
      monthEndPolicy: "clamp",
      dateMode: "business",
    });
    expect(r.resultDate).toBe("2025-01-20");
    expect(r.businessDaysMoved).toBe(5);
    expect(r.weekendDaysSkipped).toBe(2);
  });
  it("adds 1 week = 7 business days in business mode", () => {
    // 2025-01-13 Monday + 7 business days = 2025-01-22 Wednesday
    const r = calculateAddSubtract({
      startMs: parseDateTime("2025-01-13"),
      offset: { weeks: 1 },
      mode: "add",
      monthEndPolicy: "clamp",
      dateMode: "business",
    });
    expect(r.resultDate).toBe("2025-01-22");
    expect(r.businessDaysMoved).toBe(7);
  });
  it("combines months + business days", () => {
    // 2025-01-13 + 1 month (calendar) + 5 business days
    // Feb 13 2025 is Thursday -> +5 business days = Feb 20 Thursday
    const r = calculateAddSubtract({
      startMs: parseDateTime("2025-01-13"),
      offset: { months: 1, days: 5 },
      mode: "add",
      monthEndPolicy: "clamp",
      dateMode: "business",
    });
    expect(r.resultDate).toBe("2025-02-20");
  });
});

describe("add-subtract-date-calculator generateSeries", () => {
  it("generates weekly series of 3", () => {
    const rows = generateSeries({
      startMs: parseDateTime("2025-01-01"),
      offset: { weeks: 1 },
      mode: "add",
      monthEndPolicy: "clamp",
      dateMode: "calendar",
      count: 3,
    });
    expect(rows).toHaveLength(3);
    expect(rows[0].n).toBe(1);
    expect(rows[0].resultDate).toBe("2025-01-08");
    expect(rows[1].resultDate).toBe("2025-01-15");
    expect(rows[2].resultDate).toBe("2025-01-22");
  });
  it("generates monthly series respecting month-end clamp", () => {
    const rows = generateSeries({
      startMs: parseDateTime("2025-01-31"),
      offset: { months: 1 },
      mode: "add",
      monthEndPolicy: "clamp",
      dateMode: "calendar",
      count: 3,
    });
    expect(rows[0].resultDate).toBe("2025-02-28");
    expect(rows[1].resultDate).toBe("2025-03-28"); // Feb 28 + 1m = Mar 28 (clamp, not Mar 31)
    expect(rows[2].resultDate).toBe("2025-04-28");
  });
  it("returns empty for count <= 0", () => {
    expect(generateSeries({
      startMs: parseDateTime("2025-01-01"),
      offset: { days: 1 },
      mode: "add",
      monthEndPolicy: "clamp",
      dateMode: "calendar",
      count: 0,
    })).toEqual([]);
  });
  it("includes weekday per row", () => {
    const rows = generateSeries({
      startMs: parseDateTime("2025-01-01"), // Wed
      offset: { weeks: 1 },
      mode: "add",
      monthEndPolicy: "clamp",
      dateMode: "calendar",
      count: 2,
    });
    expect(rows[0].weekday).toBe("Wednesday"); // Jan 8 is Wed
    expect(rows[1].weekday).toBe("Wednesday"); // Jan 15 is Wed
  });
  it("subtract mode generates decreasing dates", () => {
    const rows = generateSeries({
      startMs: parseDateTime("2025-01-15"),
      offset: { days: 7 },
      mode: "subtract",
      monthEndPolicy: "clamp",
      dateMode: "calendar",
      count: 2,
    });
    expect(rows[0].resultDate).toBe("2025-01-08");
    expect(rows[1].resultDate).toBe("2025-01-01");
  });
});

describe("add-subtract-date-calculator renderSeriesCsv / renderResultText", () => {
  it("renders CSV with header", () => {
    const csv = renderSeriesCsv([]);
    expect(csv).toContain("n,date,datetime,weekday,business_days_moved");
  });
  it("renders CSV rows", () => {
    const rows = generateSeries({
      startMs: parseDateTime("2025-01-01"),
      offset: { weeks: 1 },
      mode: "add",
      monthEndPolicy: "clamp",
      dateMode: "calendar",
      count: 2,
    });
    const csv = renderSeriesCsv(rows);
    expect(csv).toContain("1,2025-01-08");
    expect(csv).toContain("2,2025-01-15");
  });
  it("renders result text multi-line", () => {
    const r = calculateAddSubtract({
      startMs: parseDateTime("2025-01-01"),
      offset: { days: 1 },
      mode: "add",
      monthEndPolicy: "clamp",
      dateMode: "calendar",
    });
    const text = renderResultText(r);
    expect(text).toContain("Summary:");
    expect(text).toContain("Result date: 2025-01-02");
    expect(text).toContain("Weekday:");
    expect(text).toContain("Month-end policy:");
  });
});

describe("add-subtract-date-calculator stepper helpers", () => {
  it("nowMs returns finite number", () => {
    expect(Number.isFinite(nowMs())).toBe(true);
  });
  it("startOfDay returns midnight UTC", () => {
    const noon = parseDateTime("2025-01-15T12:30:45");
    const sod = startOfDay(noon);
    expect(formatDateTime(sod)).toBe("2025-01-15T00:00:00");
  });
  it("endOfDay returns 23:59:59 UTC", () => {
    const noon = parseDateTime("2025-01-15T12:30:45");
    const eod = endOfDay(noon);
    expect(formatDateTime(eod)).toBe("2025-01-15T23:59:59");
  });
  it("returns NaN for NaN input", () => {
    expect(Number.isNaN(startOfDay(Number.NaN))).toBe(true);
    expect(Number.isNaN(endOfDay(Number.NaN))).toBe(true);
  });
});

describe("add-subtract-date-calculator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      start: "2025-01-01",
      offset: { days: 1 },
      mode: "add",
      monthEndPolicy: "clamp",
      dateMode: "calendar",
      result: "2025-01-02",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        start: "2025-01-01",
        offset: { days: i },
        mode: "add",
        monthEndPolicy: "clamp",
        dateMode: "calendar",
        result: `2025-01-${String(i + 1).padStart(2, "0")}`,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      start: "2025-01-01",
      offset: { days: 1 },
      mode: "add",
      monthEndPolicy: "clamp",
      dateMode: "calendar",
      result: "2025-01-02",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("add-subtract-date-calculator shareable URL", () => {
  it("builds share URL with all params", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const state: ShareState = {
      start: "2025-01-31",
      startTime: "14:30",
      offset: { months: 1, days: 3 },
      mode: "add",
      monthEndPolicy: "clamp",
      dateMode: "calendar",
      weekendDays: [0, 6],
      holidays: ["2025-07-04"],
      count: 5,
    };
    const url = buildShareUrl(state);
    expect(url).toContain("start=2025-01-31");
    expect(url).toContain("time=14%3A30");
    expect(url).toContain("months=1");
    expect(url).toContain("days=3");
    expect(url).toContain("mode=add");
    expect(url).toContain("policy=clamp");
    expect(url).toContain("dmode=calendar");
    expect(url).toContain("we=0%2C6");
    expect(url).toContain("hol=2025-07-04");
    expect(url).toContain("count=5");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const state: ShareState = {
      start: "2025-01-31",
      startTime: "",
      offset: { months: 1 },
      mode: "subtract",
      monthEndPolicy: "overflow",
      dateMode: "business",
      weekendDays: [5, 6],
      holidays: ["2025-12-25"],
      count: 3,
    };
    const url = buildShareUrl(state);
    // Extract the query/hash portion (after #)
    const hash = url.substring(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed).not.toBeNull();
    expect(parsed!.start).toBe("2025-01-31");
    expect(parsed!.offset.months).toBe(1);
    expect(parsed!.mode).toBe("subtract");
    expect(parsed!.monthEndPolicy).toBe("overflow");
    expect(parsed!.dateMode).toBe("business");
    expect(parsed!.weekendDays).toEqual([5, 6]);
    expect(parsed!.holidays).toEqual(["2025-12-25"]);
    expect(parsed!.count).toBe(3);
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("#")).toBeNull();
  });
  it("defaults unknown mode/policy to safe values", () => {
    const parsed = parseShareUrl("start=2025-01-01&days=1");
    expect(parsed!.mode).toBe("add");
    expect(parsed!.monthEndPolicy).toBe("clamp");
    expect(parsed!.dateMode).toBe("calendar");
  });
  it("filters invalid weekend days and holidays", () => {
    const parsed = parseShareUrl("start=2025-01-01&days=1&we=0,7,abc&hol=2025-01-01,not-a-date");
    expect(parsed!.weekendDays).toEqual([0]);
    expect(parsed!.holidays).toEqual(["2025-01-01"]);
  });
  it("clamps count to 0..1000", () => {
    const parsed = parseShareUrl("start=2025-01-01&days=1&count=99999");
    expect(parsed!.count).toBe(1000);
  });
});

// Suppress unused-import lint
export type _Unused = DateOffset | AddSubtractInput | SeriesInput;

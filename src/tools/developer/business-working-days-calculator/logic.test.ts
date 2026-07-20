import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_WEEKEND_DAYS,
  MS_PER_DAY,
  WEEKEND_PRESETS,
  COUNTRY_HOLIDAY_PRESETS,
  parseDate,
  isValidDate,
  formatDate,
  weekdayLabel,
  weekdayShort,
  dayOfWeekOf,
  normalizeHolidays,
  parseHolidaysText,
  isWeekend,
  isHoliday,
  isBusinessDay,
  countBusinessDays,
  addBusinessDays,
  subtractBusinessDays,
  parseBatchRanges,
  computeBatch,
  renderBatchCsv,
  computeBatchCsv,
  loadHolidaySets,
  saveHolidaySet,
  deleteHolidaySet,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  renderCountText,
  renderAddText,
  applyHalfDays,
  type CountResult,
  type AddResult,
  type HolidaySet,
  type HistoryEntry,
  type HalfDayType,
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

describe("bwdc constants", () => {
  it("default weekend is Sat+Sun", () => {
    expect(DEFAULT_WEEKEND_DAYS).toEqual([0, 6]);
  });
  it("MS_PER_DAY is 86400000", () => {
    expect(MS_PER_DAY).toBe(86_400_000);
  });
  it("has 6 weekend presets", () => {
    expect(WEEKEND_PRESETS).toHaveLength(6);
  });
  it("fri-sat preset has days [5,6]", () => {
    const friSat = WEEKEND_PRESETS.find((p) => p.id === "fri-sat");
    expect(friSat?.days).toEqual([5, 6]);
  });
  it("none preset has empty days", () => {
    const none = WEEKEND_PRESETS.find((p) => p.id === "none");
    expect(none?.days).toEqual([]);
  });
  it("has 6 country presets", () => {
    expect(COUNTRY_HOLIDAY_PRESETS.length).toBeGreaterThanOrEqual(6);
  });
  it("us-2025 has 11 federal holidays", () => {
    const us = COUNTRY_HOLIDAY_PRESETS.find((p) => p.id === "us-2025");
    expect(us?.holidays).toHaveLength(11);
  });
});

describe("bwdc parseDate / isValidDate / formatDate", () => {
  it("parses YYYY-MM-DD", () => {
    const ms = parseDate("2025-01-15");
    expect(ms).not.toBeNaN();
    expect(formatDate(ms)).toBe("2025-01-15");
  });
  it("parses YYYY-MM-DDTHH:MM:SS", () => {
    const ms = parseDate("2025-01-15T09:30:00");
    expect(ms).not.toBeNaN();
  });
  it("rejects invalid date strings", () => {
    expect(parseDate("not-a-date")).toBeNaN();
    expect(parseDate("2025-13-01")).toBeNaN();
    expect(parseDate("2025-02-30")).toBeNaN();
    expect(parseDate("")).toBeNaN();
  });
  it("isValidDate returns true for valid dates", () => {
    expect(isValidDate("2025-01-15")).toBe(true);
    expect(isValidDate("2025-13-01")).toBe(false);
  });
  it("formatDate returns empty for NaN", () => {
    expect(formatDate(Number.NaN)).toBe("");
  });
});

describe("bwdc weekday helpers", () => {
  it("weekdayLabel returns full name", () => {
    expect(weekdayLabel(0)).toBe("Sunday");
    expect(weekdayLabel(1)).toBe("Monday");
    expect(weekdayLabel(6)).toBe("Saturday");
  });
  it("weekdayShort returns short name", () => {
    expect(weekdayShort(0)).toBe("Sun");
    expect(weekdayShort(3)).toBe("Wed");
  });
  it("dayOfWeekOf returns 0-6 for valid dates", () => {
    // 2025-01-15 is a Wednesday
    expect(dayOfWeekOf("2025-01-15")).toBe(3);
  });
  it("dayOfWeekOf returns -1 for invalid", () => {
    expect(dayOfWeekOf("invalid")).toBe(-1);
  });
});

describe("bwdc normalizeHolidays", () => {
  it("normalizes YYYY-MM-DD", () => {
    expect(normalizeHolidays(["2025-01-01", "2025-12-25"])).toEqual(["2025-01-01", "2025-12-25"]);
  });
  it("sorts output", () => {
    expect(normalizeHolidays(["2025-12-25", "2025-01-01"])).toEqual(["2025-01-01", "2025-12-25"]);
  });
  it("deduplicates", () => {
    expect(normalizeHolidays(["2025-01-01", "2025-01-01"])).toEqual(["2025-01-01"]);
  });
  it("accepts YYYY/M/D format", () => {
    expect(normalizeHolidays(["2025/1/1"])).toEqual(["2025-01-01"]);
  });
  it("accepts M/D/YYYY US-style", () => {
    expect(normalizeHolidays(["1/15/2025"])).toEqual(["2025-01-15"]);
  });
  it("accepts D-M-YYYY when day > 12", () => {
    expect(normalizeHolidays(["15-1-2025"])).toEqual(["2025-01-15"]);
  });
  it("rejects invalid strings", () => {
    expect(normalizeHolidays(["not-a-date", "2025-13-01"])).toEqual([]);
  });
  it("parses space-separated input string", () => {
    expect(normalizeHolidays("2025-01-01 2025-12-25")).toEqual(["2025-01-01", "2025-12-25"]);
  });
});

describe("bwdc parseHolidaysText", () => {
  it("parses newline-separated", () => {
    expect(parseHolidaysText("2025-01-01\n2025-12-25")).toEqual(["2025-01-01", "2025-12-25"]);
  });
  it("returns empty for empty input", () => {
    expect(parseHolidaysText("")).toEqual([]);
  });
});

describe("bwdc isWeekend / isHoliday / isBusinessDay", () => {
  it("isWeekend true for Sat with default weekend", () => {
    expect(isWeekend(6, DEFAULT_WEEKEND_DAYS)).toBe(true);
    expect(isWeekend(1, DEFAULT_WEEKEND_DAYS)).toBe(false);
  });
  it("isHoliday true for matching date", () => {
    expect(isHoliday("2025-01-01", ["2025-01-01"])).toBe(true);
    expect(isHoliday("2025-01-02", ["2025-01-01"])).toBe(false);
  });
  it("isBusinessDay false for weekend", () => {
    // 2025-01-11 is a Saturday
    expect(isBusinessDay("2025-01-11", DEFAULT_WEEKEND_DAYS, [])).toBe(false);
  });
  it("isBusinessDay false for holiday", () => {
    expect(isBusinessDay("2025-01-01", DEFAULT_WEEKEND_DAYS, ["2025-01-01"])).toBe(false);
  });
  it("isBusinessDay true for normal weekday", () => {
    // 2025-01-15 is a Wednesday
    expect(isBusinessDay("2025-01-15", DEFAULT_WEEKEND_DAYS, [])).toBe(true);
  });
  it("isBusinessDay false for invalid date", () => {
    expect(isBusinessDay("not-a-date", DEFAULT_WEEKEND_DAYS, [])).toBe(false);
  });
});

describe("bwdc countBusinessDays basic", () => {
  it("counts Mon-Fri inclusive as 5 business days", () => {
    // 2025-01-13 (Mon) to 2025-01-17 (Fri), includeStart=true includeEnd=true
    const r = countBusinessDays({
      start: "2025-01-13", end: "2025-01-17",
      includeEnd: true, includeStart: true,
    });
    expect(r.businessDays).toBe(5);
    expect(r.totalDays).toBe(5);
    expect(r.weekendDays).toBe(0);
  });
  it("counts Mon-Fri exclusive of end as 4 business days", () => {
    // default includeStart=true, includeEnd=false
    const r = countBusinessDays({
      start: "2025-01-13", end: "2025-01-17",
    });
    expect(r.businessDays).toBe(4);
    expect(r.totalDays).toBe(4);
  });
  it("counts Mon-Sun inclusive as 5 business days + 2 weekend", () => {
    const r = countBusinessDays({
      start: "2025-01-13", end: "2025-01-19",
      includeEnd: true,
    });
    expect(r.businessDays).toBe(5);
    expect(r.weekendDays).toBe(2);
    expect(r.totalDays).toBe(7);
  });
  it("single business day inclusive = 1", () => {
    const r = countBusinessDays({
      start: "2025-01-15", end: "2025-01-15",
      includeEnd: true,
    });
    expect(r.businessDays).toBe(1);
  });
  it("single weekend day inclusive = 0 business days", () => {
    const r = countBusinessDays({
      start: "2025-01-11", end: "2025-01-11",
      includeEnd: true,
    });
    expect(r.businessDays).toBe(0);
    expect(r.weekendDays).toBe(1);
  });
});

describe("bwdc countBusinessDays with holidays", () => {
  it("excludes holiday on a weekday", () => {
    // 2025-01-13 (Mon) to 2025-01-17 (Fri), 2025-01-15 (Wed) is a holiday
    const r = countBusinessDays({
      start: "2025-01-13", end: "2025-01-17",
      holidays: ["2025-01-15"],
      includeEnd: true,
    });
    expect(r.businessDays).toBe(4);
    expect(r.holidays).toBe(1);
  });
  it("holiday on weekend is not double-counted", () => {
    // 2025-01-13 (Mon) to 2025-01-19 (Sun), 2025-01-11 is a Sat holiday but out of range.
    // Use 2025-01-18 (Sat) as a holiday.
    const r = countBusinessDays({
      start: "2025-01-13", end: "2025-01-19",
      holidays: ["2025-01-18"],
      includeEnd: true,
    });
    expect(r.businessDays).toBe(5);
    expect(r.weekendDays).toBe(2);
    expect(r.holidaysOnWeekend).toBe(1);
    expect(r.holidays).toBe(0);
  });
});

describe("bwdc countBusinessDays with custom weekends", () => {
  it("Fri-Sat weekend counts Sunday as a business day", () => {
    // 2025-01-12 (Sun) to 2025-01-12 (Sun) with Fri-Sat weekend (5,6)
    const r = countBusinessDays({
      start: "2025-01-12", end: "2025-01-12",
      weekendDays: [5, 6],
      includeEnd: true,
    });
    expect(r.businessDays).toBe(1);
  });
  it("Fri-Sat weekend skips Friday", () => {
    // 2025-01-10 (Fri) is a weekend under Fri-Sat pattern
    const r = countBusinessDays({
      start: "2025-01-10", end: "2025-01-10",
      weekendDays: [5, 6],
      includeEnd: true,
    });
    expect(r.businessDays).toBe(0);
  });
  it("no-weekend pattern counts all days as business", () => {
    const r = countBusinessDays({
      start: "2025-01-11", end: "2025-01-12", // Sat, Sun
      weekendDays: [],
      includeEnd: true,
    });
    expect(r.businessDays).toBe(2);
    expect(r.weekendDays).toBe(0);
  });
});

describe("bwdc countBusinessDays reversed range", () => {
  it("reversed flag true when end < start", () => {
    const r = countBusinessDays({
      start: "2025-01-17", end: "2025-01-13",
      includeEnd: true,
    });
    expect(r.reversed).toBe(true);
    expect(r.businessDays).toBe(5);
  });
});

describe("bwdc countBusinessDays invalid dates", () => {
  it("returns zero result for invalid start", () => {
    const r = countBusinessDays({ start: "invalid", end: "2025-01-17" });
    expect(r.businessDays).toBe(0);
    expect(r.summary).toContain("Invalid");
  });
  it("returns zero result for invalid end", () => {
    const r = countBusinessDays({ start: "2025-01-13", end: "invalid" });
    expect(r.businessDays).toBe(0);
  });
});

describe("bwdc addBusinessDays", () => {
  it("adds 5 business days to a Monday → next Monday", () => {
    // 2025-01-13 (Mon) + 5 business days = 2025-01-20 (Mon)
    const r = addBusinessDays({ start: "2025-01-13", days: 5 });
    expect(r.resultDate).toBe("2025-01-20");
    expect(r.weekday).toBe("Monday");
    expect(r.businessDaysMoved).toBe(5);
  });
  it("adds 10 business days to a Monday → 14 calendar days later", () => {
    // 2025-01-13 (Mon) + 10 business days = 2025-01-27 (Mon)
    const r = addBusinessDays({ start: "2025-01-13", days: 10 });
    expect(r.resultDate).toBe("2025-01-27");
    expect(r.calendarDaysDelta).toBe(14);
  });
  it("adds 0 business days on a weekday returns same date", () => {
    const r = addBusinessDays({ start: "2025-01-15", days: 0 });
    expect(r.resultDate).toBe("2025-01-15");
  });
  it("adds 0 business days on a weekend returns next business day", () => {
    // 2025-01-11 is Saturday → next business day = 2025-01-13 (Mon)
    const r = addBusinessDays({ start: "2025-01-11", days: 0 });
    expect(r.resultDate).toBe("2025-01-13");
  });
  it("skips holidays when adding", () => {
    // 2025-01-13 (Mon) + 1 business day, but 2025-01-14 (Tue) is a holiday
    const r = addBusinessDays({
      start: "2025-01-13", days: 1,
      holidays: ["2025-01-14"],
    });
    expect(r.resultDate).toBe("2025-01-15");
    expect(r.holidaysSkipped).toBe(1);
  });
  it("invalid start returns empty result", () => {
    const r = addBusinessDays({ start: "invalid", days: 5 });
    expect(r.resultDate).toBe("");
    expect(r.summary).toContain("Invalid");
  });
});

describe("bwdc subtractBusinessDays", () => {
  it("subtracts 5 business days from a Friday → previous Friday", () => {
    // 2025-01-17 (Fri) - 5 business days = 2025-01-10 (Fri)
    const r = subtractBusinessDays({ start: "2025-01-17", days: 5 });
    expect(r.resultDate).toBe("2025-01-10");
    expect(r.weekday).toBe("Friday");
  });
  it("subtracts 10 business days from a Monday → 14 calendar days earlier", () => {
    // 2025-01-27 (Mon) - 10 business days = 2025-01-13 (Mon)
    const r = subtractBusinessDays({ start: "2025-01-27", days: 10 });
    expect(r.resultDate).toBe("2025-01-13");
    expect(r.calendarDaysDelta).toBe(-14);
  });
});

describe("bwdc batch ranges", () => {
  it("parseBatchRanges splits lines into start/end pairs", () => {
    const rows = parseBatchRanges("2025-01-13 2025-01-17\n2025-02-10 2025-02-14");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ start: "2025-01-13", end: "2025-01-17" });
  });
  it("parseBatchRanges supports 'to' separator", () => {
    const rows = parseBatchRanges("2025-01-13 to 2025-01-17");
    expect(rows[0]).toEqual({ start: "2025-01-13", end: "2025-01-17" });
  });
  it("parseBatchRanges supports '..' separator", () => {
    const rows = parseBatchRanges("2025-01-13..2025-01-17");
    expect(rows[0]).toEqual({ start: "2025-01-13", end: "2025-01-17" });
  });
  it("parseBatchRanges returns empty for empty input", () => {
    expect(parseBatchRanges("")).toEqual([]);
  });
  it("computeBatch returns business days per row", () => {
    const batch = computeBatch(
      [{ start: "2025-01-13", end: "2025-01-17" }],
      { includeEnd: true },
    );
    expect(batch[0].businessDays).toBe(5);
  });
  it("computeBatch returns error for invalid date", () => {
    const batch = computeBatch(
      [{ start: "invalid", end: "2025-01-17" }],
    );
    expect(batch[0].error).toBe("Invalid date format");
  });
  it("renderBatchCsv produces CSV with header", () => {
    const batch = computeBatch(
      [{ start: "2025-01-13", end: "2025-01-17" }],
      { includeEnd: true },
    );
    const csv = renderBatchCsv(batch);
    expect(csv.split("\n")[0]).toBe("start,end,business_days,total_days,weekends,holidays");
    expect(csv.split("\n")[1]).toBe("2025-01-13,2025-01-17,5,5,0,0");
  });
  it("computeBatchCsv is a one-shot convenience", () => {
    const csv = computeBatchCsv(
      [{ start: "2025-01-13", end: "2025-01-17" }],
      { includeEnd: true },
    );
    expect(csv).toContain("start,end,business_days");
    expect(csv).toContain("2025-01-13,2025-01-17,5,5,0,0");
  });
});

describe("bwdc saved holiday sets", () => {
  it("loads empty initially", () => {
    expect(loadHolidaySets()).toEqual([]);
  });
  it("saves and loads a set", () => {
    const next = saveHolidaySet("My Holidays", ["2025-01-01", "2025-12-25"]);
    expect(next).toHaveLength(1);
    expect(next[0].name).toBe("My Holidays");
    expect(next[0].holidays).toEqual(["2025-01-01", "2025-12-25"]);
    expect(loadHolidaySets()).toHaveLength(1);
  });
  it("ignores empty name", () => {
    saveHolidaySet("", ["2025-01-01"]);
    expect(loadHolidaySets()).toEqual([]);
  });
  it("deletes by id", () => {
    const next = saveHolidaySet("To Delete", ["2025-01-01"]);
    const id = next[0].id;
    deleteHolidaySet(id);
    expect(loadHolidaySets()).toEqual([]);
  });
  it("normalizes holidays on save", () => {
    const next = saveHolidaySet("Mixed", ["1/15/2025", "2025-12-25"]);
    expect(next[0].holidays).toEqual(["2025-01-15", "2025-12-25"]);
  });
});

describe("bwdc history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, mode: "count", summary: "test", businessDays: 5 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, mode: "count", summary: `t${i}`, businessDays: i });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, mode: "count", summary: "x", businessDays: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("bwdc shareable URL", () => {
  it("builds share URL for count mode when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      mode: "count",
      start: "2025-01-13",
      end: "2025-01-17",
      days: 0,
      weekendDays: [0, 6],
      holidays: ["2025-01-15"],
      includeEnd: true,
      includeStart: true,
    });
    expect(url).toContain("mode=count");
    expect(url).toContain("start=2025-01-13");
    expect(url).toContain("end=2025-01-17");
    expect(url).toContain("wk=0%2C6");
    expect(url).toContain("ie=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("builds share URL for add mode", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      mode: "add",
      start: "2025-01-13",
      end: "",
      days: 10,
      weekendDays: [0, 6],
      holidays: [],
      includeEnd: false,
      includeStart: true,
    });
    expect(url).toContain("mode=add");
    expect(url).toContain("days=10");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("mode=count&start=2025-01-13&end=2025-01-17&wk=0,6&hol=2025-01-15&ie=1&is=1");
    expect(p?.mode).toBe("count");
    expect(p?.start).toBe("2025-01-13");
    expect(p?.end).toBe("2025-01-17");
    expect(p?.weekendDays).toEqual([0, 6]);
    expect(p?.holidays).toEqual(["2025-01-15"]);
    expect(p?.includeEnd).toBe(true);
    expect(p?.includeStart).toBe(true);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("strips leading # from hash", () => {
    const p = parseShareUrl("#mode=add&start=2025-01-13&days=5");
    expect(p?.mode).toBe("add");
    expect(p?.days).toBe(5);
  });
  it("filters invalid weekend day numbers", () => {
    const p = parseShareUrl("wk=0,9,-1,6");
    expect(p?.weekendDays).toEqual([0, 6]);
  });
  it("filters invalid holiday dates", () => {
    const p = parseShareUrl("hol=2025-01-01,not-a-date");
    expect(p?.holidays).toEqual(["2025-01-01"]);
  });
});

describe("bwdc renderCountText / renderAddText", () => {
  it("renderCountText includes summary and stats", () => {
    const r = countBusinessDays({
      start: "2025-01-13", end: "2025-01-17",
      includeEnd: true,
    });
    const text = renderCountText(r);
    expect(text).toContain("business day");
    expect(text).toContain("Total calendar days");
    expect(text).toContain("Business days");
  });
  it("renderCountText includes breakdown for short ranges", () => {
    const r = countBusinessDays({
      start: "2025-01-13", end: "2025-01-15",
      includeEnd: true,
    });
    const text = renderCountText(r);
    expect(text).toContain("--- Day-by-day breakdown ---");
    expect(text).toContain("2025-01-13");
  });
  it("renderAddText includes result date", () => {
    const r = addBusinessDays({ start: "2025-01-13", days: 5 });
    const text = renderAddText(r);
    expect(text).toContain("Result date");
    expect(text).toContain("2025-01-20");
  });
});

describe("bwdc applyHalfDays", () => {
  it("full days with no half-day flags returns businessDays unchanged", () => {
    const r = countBusinessDays({
      start: "2025-01-13", end: "2025-01-17",
      includeEnd: true,
    });
    const d = applyHalfDays(r, {
      startHalf: "none", endHalf: "none",
      weekendDays: DEFAULT_WEEKEND_DAYS, holidays: [],
      start: "2025-01-13", end: "2025-01-17",
    });
    expect(d).toBe(5);
  });
  it("start-half subtracts 0.5", () => {
    const r = countBusinessDays({
      start: "2025-01-13", end: "2025-01-17",
      includeEnd: true,
    });
    const d = applyHalfDays(r, {
      startHalf: "start-pm", endHalf: "none",
      weekendDays: DEFAULT_WEEKEND_DAYS, holidays: [],
      start: "2025-01-13", end: "2025-01-17",
    });
    expect(d).toBe(4.5);
  });
  it("both halves subtract 1.0", () => {
    const r = countBusinessDays({
      start: "2025-01-13", end: "2025-01-17",
      includeEnd: true,
    });
    const d = applyHalfDays(r, {
      startHalf: "start-pm", endHalf: "end-am",
      weekendDays: DEFAULT_WEEKEND_DAYS, holidays: [],
      start: "2025-01-13", end: "2025-01-17",
    });
    expect(d).toBe(4);
  });
  it("half-day on weekend start has no effect", () => {
    const r = countBusinessDays({
      start: "2025-01-11", end: "2025-01-17", // Sat to Fri
      includeEnd: true,
    });
    const d = applyHalfDays(r, {
      startHalf: "start-pm", endHalf: "none",
      weekendDays: DEFAULT_WEEKEND_DAYS, holidays: [],
      start: "2025-01-11", end: "2025-01-17",
    });
    expect(d).toBe(5);
  });
  it("returns 0 when businessDays is 0", () => {
    const r: CountResult = {
      totalDays: 0, businessDays: 0, weekendDays: 0, holidays: 0,
      holidaysOnWeekend: 0, businessDaysDecimal: 0, breakdown: [],
      summary: "", reversed: false,
    };
    const d = applyHalfDays(r, {
      startHalf: "start-pm", endHalf: "end-am",
      weekendDays: DEFAULT_WEEKEND_DAYS, holidays: [],
      start: "2025-01-11", end: "2025-01-11",
    });
    expect(d).toBe(0);
  });
});

// Suppress unused-import lint for type-only imports
export type _Unused = CountResult | AddResult | HolidaySet | HistoryEntry | HalfDayType;

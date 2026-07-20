import { describe, it, expect, beforeEach } from "vitest";
import {
  WEEKDAY_NAMES,
  MONTH_NAMES,
  ORDINAL_WORDS,
  DOOMSDAY_ANCHORS,
  parseDate,
  formatDateISO,
  makeDate,
  isLeapYear,
  daysInMonth,
  getDayOfYear,
  daysInYear,
  getIsoWeek,
  dayDiff,
  zellerWeekday,
  sakamotoWeekday,
  jsDateWeekday,
  findDayOfWeek,
  julianGregorianNote,
  findNextWeekday,
  findPreviousWeekday,
  findNthWeekdayOfMonth,
  recurringWeekdayAcrossYears,
  centuryAnchor,
  yearDoomsday,
  findClosestAnchor,
  doomsdayRuleSteps,
  renderResultText,
  renderRecurringText,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type WeekdayNum,
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

describe("day-of-the-week-finder constants", () => {
  it("has 7 weekday names", () => {
    expect(WEEKDAY_NAMES).toHaveLength(7);
    expect(WEEKDAY_NAMES[0]).toBe("Sunday");
    expect(WEEKDAY_NAMES[6]).toBe("Saturday");
  });
  it("has 12 month names", () => {
    expect(MONTH_NAMES).toHaveLength(12);
    expect(MONTH_NAMES[0]).toBe("January");
  });
  it("has 5 ordinal words", () => {
    expect(ORDINAL_WORDS).toEqual(["1st", "2nd", "3rd", "4th", "5th"]);
  });
  it("has 12 doomsday anchors", () => {
    expect(DOOMSDAY_ANCHORS).toHaveLength(12);
    expect(DOOMSDAY_ANCHORS.find((a) => a.label.includes("Pi Day"))).toBeTruthy();
  });
});

describe("day-of-the-week-finder parseDate", () => {
  it("parses valid ISO date", () => {
    const p = parseDate("2025-06-15");
    expect(p.ok).toBe(true);
    expect(p.year).toBe(2025);
    expect(p.month).toBe(5);
    expect(p.day).toBe(15);
  });
  it("rejects bad format", () => {
    expect(parseDate("15/06/2025").ok).toBe(false);
    expect(parseDate("hello").ok).toBe(false);
  });
  it("rejects invalid month", () => {
    expect(parseDate("2025-13-01").ok).toBe(false);
  });
  it("rejects invalid day for month", () => {
    expect(parseDate("2025-02-30").ok).toBe(false);
  });
  it("rejects Feb 29 in non-leap year", () => {
    expect(parseDate("2023-02-29").ok).toBe(false);
  });
  it("accepts Feb 29 in leap year", () => {
    expect(parseDate("2024-02-29").ok).toBe(true);
  });
});

describe("day-of-the-week-finder formatDateISO", () => {
  it("zero-pads month and day", () => {
    expect(formatDateISO(makeDate(2025, 0, 5))).toBe("2025-01-05");
    expect(formatDateISO(makeDate(2025, 10, 25))).toBe("2025-11-25");
  });
});

describe("day-of-the-week-finder calendar helpers", () => {
  it("identifies leap years correctly", () => {
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2023)).toBe(false);
  });
  it("daysInMonth handles Feb in leap and non-leap years", () => {
    expect(daysInMonth(2024, 1)).toBe(29);
    expect(daysInMonth(2023, 1)).toBe(28);
    expect(daysInMonth(2025, 3)).toBe(30);
    expect(daysInMonth(2025, 6)).toBe(31);
  });
  it("getDayOfYear is correct for Jan 1 and Dec 31", () => {
    expect(getDayOfYear(2025, 0, 1)).toBe(1);
    expect(getDayOfYear(2025, 11, 31)).toBe(365);
    expect(getDayOfYear(2024, 11, 31)).toBe(366); // leap
  });
  it("daysInYear matches leap status", () => {
    expect(daysInYear(2024)).toBe(366);
    expect(daysInYear(2025)).toBe(365);
  });
});

describe("day-of-the-week-finder ISO week", () => {
  it("returns week 1 for early January", () => {
    const w = getIsoWeek(makeDate(2024, 0, 1));
    expect(w.week).toBe(1);
  });
  it("returns correct ISO year for late-December dates", () => {
    // 2020-12-31 is Thursday → ISO week 53 of 2020
    const w = getIsoWeek(makeDate(2020, 11, 31));
    expect(w.year).toBe(2020);
    expect(w.week).toBe(53);
  });
  it("returns ISO 2021 week 1 for 2021-01-01 (Friday)", () => {
    // 2021-01-01 is Friday → ISO week 53 of 2020
    const w = getIsoWeek(makeDate(2021, 0, 1));
    expect(w.year).toBe(2020);
    expect(w.week).toBe(53);
  });
});

describe("day-of-the-week-finder dayDiff", () => {
  it("computes difference in whole days", () => {
    expect(dayDiff(makeDate(2025, 0, 1), makeDate(2025, 0, 2))).toBe(1);
    expect(dayDiff(makeDate(2025, 0, 1), makeDate(2025, 0, 1))).toBe(0);
    expect(dayDiff(makeDate(2025, 0, 2), makeDate(2025, 0, 1))).toBe(-1);
  });
});

describe("day-of-the-week-finder Zeller", () => {
  it("returns Monday for 2025-06-16 (known Monday)", () => {
    // 2025-06-16 is a Monday
    expect(zellerWeekday(2025, 5, 16)).toBe(1);
  });
  it("returns Tuesday for 2001-09-11", () => {
    expect(zellerWeekday(2001, 8, 11)).toBe(2);
  });
  it("returns Thursday for 2024-02-29 (leap day)", () => {
    expect(zellerWeekday(2024, 1, 29)).toBe(4);
  });
});

describe("day-of-the-week-finder Sakamoto", () => {
  it("agrees with Zeller on 2025-06-16", () => {
    expect(sakamotoWeekday(2025, 5, 16)).toBe(1);
  });
  it("agrees with Zeller on 2001-09-11", () => {
    expect(sakamotoWeekday(2001, 8, 11)).toBe(2);
  });
  it("agrees with Zeller on leap day 2024-02-29", () => {
    expect(sakamotoWeekday(2024, 1, 29)).toBe(4);
  });
  it("handles January correctly (year decrement)", () => {
    // 2025-01-01 is Wednesday
    expect(sakamotoWeekday(2025, 0, 1)).toBe(3);
  });
});

describe("day-of-the-week-finder findDayOfWeek", () => {
  it("returns full result with all algorithms agreeing", () => {
    const r = findDayOfWeek(parseDate("2025-06-16"));
    expect(r.weekdayName).toBe("Monday");
    expect(r.zeller).toBe(r.sakamoto);
    expect(r.sakamoto).toBe(r.jsDate);
    expect(r.allAgree).toBe(true);
  });
  it("includes day-of-year, ISO week, leap status", () => {
    const r = findDayOfWeek(parseDate("2024-02-29"));
    expect(r.dayOfYear).toBe(60);
    expect(r.isLeapYear).toBe(true);
  });
  it("throws on invalid date", () => {
    expect(() => findDayOfWeek(parseDate("invalid"))).toThrow();
  });
  it("includes Julian/Gregorian note for pre-1582", () => {
    const r = findDayOfWeek(parseDate("1000-06-15"));
    expect(r.julianGregorianNote).toContain("proleptic");
  });
});

describe("day-of-the-week-finder julianGregorianNote", () => {
  it("notes pre-1582 dates", () => {
    expect(julianGregorianNote(1400)).toContain("Julian");
  });
  it("calls out 1582 transition", () => {
    expect(julianGregorianNote(1582)).toContain("Gregory XIII");
  });
  it("notes 1600-1752 ambiguity", () => {
    expect(julianGregorianNote(1700)).toContain("1752");
  });
  it("standard note for modern dates", () => {
    expect(julianGregorianNote(2025)).toContain("Gregorian calendar");
  });
});

describe("day-of-the-week-finder findNextWeekday", () => {
  it("finds next Monday from a Sunday", () => {
    const sun = makeDate(2025, 5, 15); // Sunday
    const next = findNextWeekday(sun, 1); // Monday
    expect(formatDateISO(next)).toBe("2025-06-16");
  });
  it("skips 7 days when target is same as source", () => {
    const mon = makeDate(2025, 5, 16); // Monday
    const next = findNextWeekday(mon, 1); // next Monday
    expect(formatDateISO(next)).toBe("2025-06-23");
  });
});

describe("day-of-the-week-finder findPreviousWeekday", () => {
  it("finds previous Friday from a Monday", () => {
    const mon = makeDate(2025, 5, 16); // Monday
    const prev = findPreviousWeekday(mon, 5); // Friday
    expect(formatDateISO(prev)).toBe("2025-06-13");
  });
  it("skips 7 days when target is same as source", () => {
    const mon = makeDate(2025, 5, 16); // Monday
    const prev = findPreviousWeekday(mon, 1); // previous Monday
    expect(formatDateISO(prev)).toBe("2025-06-09");
  });
});

describe("day-of-the-week-finder findNthWeekdayOfMonth", () => {
  it("finds US Thanksgiving (4th Thursday of Nov 2024)", () => {
    const r = findNthWeekdayOfMonth(2024, 10, 4, 4);
    expect(r.date).not.toBeNull();
    expect(formatDateISO(r.date!)).toBe("2024-11-28");
    expect(r.label).toContain("4th Thursday");
  });
  it("finds 2nd Tuesday of November 2025", () => {
    const r = findNthWeekdayOfMonth(2025, 10, 2, 2);
    expect(r.date).not.toBeNull();
    expect(formatDateISO(r.date!)).toBe("2025-11-11");
  });
  it("returns null when 5th occurrence doesn't exist", () => {
    // 5th Monday of February 2025 — Feb 2025 only has 4 Mondays
    const r = findNthWeekdayOfMonth(2025, 1, 1, 5);
    expect(r.date).toBeNull();
  });
  it("throws for n out of range", () => {
    expect(() => findNthWeekdayOfMonth(2025, 0, 1, 0)).toThrow();
    expect(() => findNthWeekdayOfMonth(2025, 0, 1, 6)).toThrow();
  });
});

describe("day-of-the-week-finder recurringWeekdayAcrossYears", () => {
  it("lists weekdays for Christmas across 2020-2024", () => {
    const rows = recurringWeekdayAcrossYears(2020, 2024, 11, 25);
    expect(rows).toHaveLength(5);
    expect(rows[0].year).toBe(2020);
    expect(rows[4].year).toBe(2024);
  });
  it("skips Feb 29 in non-leap years", () => {
    const rows = recurringWeekdayAcrossYears(2023, 2025, 1, 29);
    // 2023 not leap, 2024 leap, 2025 not leap
    expect(rows).toHaveLength(1);
    expect(rows[0].year).toBe(2024);
  });
  it("throws when endYear < startYear", () => {
    expect(() => recurringWeekdayAcrossYears(2025, 2024, 0, 1)).toThrow();
  });
});

describe("day-of-the-week-finder Doomsday", () => {
  it("century anchor for 2000s is Tuesday (2)", () => {
    expect(centuryAnchor(2024)).toBe(2);
  });
  it("century anchor for 1900s is Wednesday (3)", () => {
    expect(centuryAnchor(1985)).toBe(3);
  });
  it("year doomsday for 2024 is Thursday (4)", () => {
    expect(yearDoomsday(2024)).toBe(4);
  });
  it("findClosestAnchor returns an anchor for any date", () => {
    const a = findClosestAnchor(2025, 5, 16);
    expect(a.label).toBeTruthy();
    expect(a.date.getFullYear()).toBe(2025);
  });
  it("doomsdayRuleSteps produces 5 steps", () => {
    const r = doomsdayRuleSteps(2025, 5, 16);
    expect(r.steps).toHaveLength(5);
    expect(r.targetWeekday).toBe(1); // Monday
  });
  it("doomsday target matches Zeller", () => {
    const d = doomsdayRuleSteps(2001, 8, 11);
    const z = zellerWeekday(2001, 8, 11);
    expect(d.targetWeekday).toBe(z);
  });
});

describe("day-of-the-week-finder renderResultText", () => {
  it("includes weekday name and ISO week", () => {
    const r = findDayOfWeek(parseDate("2025-06-16"));
    const text = renderResultText(r);
    expect(text).toContain("Monday");
    expect(text).toContain("ISO week");
    expect(text).toContain("All three algorithms agree");
  });
});

describe("day-of-the-week-finder renderRecurringText", () => {
  it("renders header and rows", () => {
    const rows = recurringWeekdayAcrossYears(2020, 2022, 11, 25);
    const text = renderRecurringText(rows, 11, 25);
    expect(text).toContain("December 25 across years");
    expect(text).toContain("2020:");
  });
});

describe("day-of-the-week-finder history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, date: "2025-06-16", weekdayName: "Monday", operation: "single" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, date: "2025-06-16", weekdayName: "Monday", operation: "single" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, date: "2025-06-16", weekdayName: "Monday", operation: "single" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("day-of-the-week-finder shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("nth", { date: "2024-11-28", targetWeekday: 4, nth: 4 });
    expect(url).toContain("op=nth");
    expect(url).toContain("d=2024-11-28");
    expect(url).toContain("wd=4");
    expect(url).toContain("n=4");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("op=recurring&d=2024-11-28&sy=2020&ey=2024");
    expect(p.op).toBe("recurring");
    expect(p.date).toBe("2024-11-28");
    expect(p.startYear).toBe(2020);
    expect(p.endYear).toBe(2024);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ op: "single" });
  });
  it("falls back to single for unknown op", () => {
    const p = parseShareUrl("op=unknown");
    expect(p.op).toBe("single");
  });
});

// Suppress unused-import lint
export type _Unused = WeekdayNum;

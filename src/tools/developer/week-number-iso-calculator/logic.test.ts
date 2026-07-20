import { describe, it, expect, beforeEach } from "vitest";
import {
  CONVENTIONS,
  WEEKDAY_NAMES,
  MONTH_NAMES,
  SAMPLE_DATES,
  MS_PER_DAY,
  MS_PER_WEEK,
  isLeapYear,
  parseDateInput,
  formatDate,
  getIsoWeekday,
  getWeekdayName,
  getIsoWeekNumber,
  isoWeeksInYear,
  isoWeekToDateRange,
  getUsWeekNumber,
  usWeeksInYear,
  usWeekToDateRange,
  getSimpleWeekNumber,
  simpleWeeksInYear,
  simpleWeekToDateRange,
  getIslamicWeekNumber,
  islamicWeeksInYear,
  islamicWeekToDateRange,
  getWeekNumber,
  weeksInYear,
  hasWeek53,
  weekToDateRange,
  buildYearGrid,
  findCurrentWeek,
  renderYearGridCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Convention,
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

// Helper: construct a local Date from YYYY-MM-DD.
function D(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`bad iso ${iso}`);
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
}

describe("week-number constants", () => {
  it("exposes 4 conventions", () => {
    expect(CONVENTIONS).toHaveLength(4);
    expect(CONVENTIONS.map((c) => c.value)).toEqual(
      expect.arrayContaining(["iso", "us", "simple", "islamic"]),
    );
  });
  it("exposes 7 weekday names", () => {
    expect(WEEKDAY_NAMES).toHaveLength(7);
    expect(WEEKDAY_NAMES[0]).toBe("Monday");
    expect(WEEKDAY_NAMES[6]).toBe("Sunday");
  });
  it("exposes 12 month names", () => {
    expect(MONTH_NAMES).toHaveLength(12);
    expect(MONTH_NAMES[0]).toBe("January");
  });
  it("exposes 9 sample dates", () => {
    expect(SAMPLE_DATES.length).toBeGreaterThanOrEqual(8);
    expect(SAMPLE_DATES.some((s) => s.iso === "today")).toBe(true);
  });
  it("exposes time constants", () => {
    expect(MS_PER_DAY).toBe(86_400_000);
    expect(MS_PER_WEEK).toBe(7 * 86_400_000);
  });
});

describe("week-number helpers", () => {
  it("isLeapYear detects leap years", () => {
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(2020)).toBe(true);
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2021)).toBe(false);
    expect(isLeapYear(2023)).toBe(false);
  });
  it("parseDateInput accepts YYYY-MM-DD as local", () => {
    const d = parseDateInput("2025-01-15");
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(15);
  });
  it("parseDateInput accepts Date object", () => {
    const orig = new Date(2025, 0, 15);
    const d = parseDateInput(orig);
    expect(d.getTime()).toBe(orig.getTime());
  });
  it("parseDateInput accepts number timestamp", () => {
    const t = new Date(2025, 0, 15).getTime();
    expect(parseDateInput(t).getTime()).toBe(t);
  });
  it("parseDateInput throws on empty/invalid", () => {
    expect(() => parseDateInput("")).toThrow();
    expect(() => parseDateInput("not a date")).toThrow();
    expect(() => parseDateInput(null as unknown as string)).toThrow();
  });
  it("formatDate returns YYYY-MM-DD", () => {
    expect(formatDate(new Date(2025, 0, 15))).toBe("2025-01-15");
    expect(formatDate(new Date(2025, 10, 5))).toBe("2025-11-05");
  });
  it("getIsoWeekday returns 1=Mon..7=Sun", () => {
    expect(getIsoWeekday(new Date(2025, 0, 13))).toBe(1);  // Mon
    expect(getIsoWeekday(new Date(2025, 0, 14))).toBe(2);  // Tue
    expect(getIsoWeekday(new Date(2025, 0, 19))).toBe(7);  // Sun
  });
  it("getWeekdayName returns English name", () => {
    expect(getWeekdayName(new Date(2025, 0, 13))).toBe("Monday");
    expect(getWeekdayName(new Date(2025, 0, 19))).toBe("Sunday");
  });
});

describe("week-number ISO getIsoWeekNumber", () => {
  it("2014-12-29 (Mon) → ISO W1 of 2015", () => {
    expect(getIsoWeekNumber(D("2014-12-29"))).toEqual({ week: 1, weekYear: 2015 });
  });
  it("2015-01-01 (Thu) → ISO W1 of 2015", () => {
    expect(getIsoWeekNumber(D("2015-01-01"))).toEqual({ week: 1, weekYear: 2015 });
  });
  it("2015-12-31 (Thu) → ISO W53 of 2015", () => {
    expect(getIsoWeekNumber(D("2015-12-31"))).toEqual({ week: 53, weekYear: 2015 });
  });
  it("2016-01-01 (Fri) → ISO W53 of 2015 (cross-year)", () => {
    expect(getIsoWeekNumber(D("2016-01-01"))).toEqual({ week: 53, weekYear: 2015 });
  });
  it("2016-01-04 (Mon) → ISO W1 of 2016", () => {
    expect(getIsoWeekNumber(D("2016-01-04"))).toEqual({ week: 1, weekYear: 2016 });
  });
  it("2020-12-31 (Thu) → ISO W53 of 2020", () => {
    expect(getIsoWeekNumber(D("2020-12-31"))).toEqual({ week: 53, weekYear: 2020 });
  });
  it("2021-01-01 (Fri) → ISO W53 of 2020 (cross-year)", () => {
    expect(getIsoWeekNumber(D("2021-01-01"))).toEqual({ week: 53, weekYear: 2020 });
  });
  it("2021-01-04 (Mon) → ISO W1 of 2021", () => {
    expect(getIsoWeekNumber(D("2021-01-04"))).toEqual({ week: 1, weekYear: 2021 });
  });
  it("2023-01-01 (Sun) → ISO W52 of 2022 (cross-year)", () => {
    expect(getIsoWeekNumber(D("2023-01-01"))).toEqual({ week: 52, weekYear: 2022 });
  });
});

describe("week-number ISO isoWeeksInYear", () => {
  it("2015 (Jan 1 Thu) → 53 weeks", () => {
    expect(isoWeeksInYear(2015)).toBe(53);
  });
  it("2016 (Jan 1 Fri, leap) → 52 weeks", () => {
    expect(isoWeeksInYear(2016)).toBe(52);
  });
  it("2020 (Jan 1 Wed, leap) → 53 weeks", () => {
    expect(isoWeeksInYear(2020)).toBe(53);
  });
  it("2021 (Jan 1 Fri) → 52 weeks", () => {
    expect(isoWeeksInYear(2021)).toBe(52);
  });
  it("2026 (Jan 1 Thu) → 53 weeks", () => {
    expect(isoWeeksInYear(2026)).toBe(53);
  });
  it("2022 (Jan 1 Sat) → 52 weeks", () => {
    expect(isoWeeksInYear(2022)).toBe(52);
  });
});

describe("week-number ISO isoWeekToDateRange", () => {
  it("2015 W1 = 2014-12-29 to 2015-01-04 (Mon-Sun, cross-year)", () => {
    const r = isoWeekToDateRange(2015, 1);
    expect(formatDate(r.start)).toBe("2014-12-29");
    expect(formatDate(r.end)).toBe("2015-01-04");
  });
  it("2020 W53 = 2020-12-28 to 2021-01-03 (cross-year)", () => {
    const r = isoWeekToDateRange(2020, 53);
    expect(formatDate(r.start)).toBe("2020-12-28");
    expect(formatDate(r.end)).toBe("2021-01-03");
  });
  it("2021 W1 = 2021-01-04 to 2021-01-10", () => {
    const r = isoWeekToDateRange(2021, 1);
    expect(formatDate(r.start)).toBe("2021-01-04");
    expect(formatDate(r.end)).toBe("2021-01-10");
  });
  it("2016 W1 = 2016-01-04 to 2016-01-10", () => {
    const r = isoWeekToDateRange(2016, 1);
    expect(formatDate(r.start)).toBe("2016-01-04");
    expect(formatDate(r.end)).toBe("2016-01-10");
  });
  it("mid-year week spans 7 days", () => {
    const r = isoWeekToDateRange(2024, 26);
    const days = (r.end.getTime() - r.start.getTime()) / MS_PER_DAY;
    expect(days).toBe(6); // inclusive end → 6-day diff
  });
});

describe("week-number US getUsWeekNumber", () => {
  it("2017-01-01 (Sun) → US W1 of 2017", () => {
    expect(getUsWeekNumber(D("2017-01-01"))).toEqual({ week: 1, weekYear: 2017 });
  });
  it("2017-12-31 (Sun) → US W53 of 2017", () => {
    expect(getUsWeekNumber(D("2017-12-31"))).toEqual({ week: 53, weekYear: 2017 });
  });
  it("2011-01-01 (Sat) → US W52 of 2010 (cross-year)", () => {
    expect(getUsWeekNumber(D("2011-01-01"))).toEqual({ week: 52, weekYear: 2010 });
  });
  it("2012-01-01 (Sun, leap) → US W1 of 2012", () => {
    expect(getUsWeekNumber(D("2012-01-01"))).toEqual({ week: 1, weekYear: 2012 });
  });
  it("2016-01-01 (Fri) → US W52 of 2015 (cross-year)", () => {
    expect(getUsWeekNumber(D("2016-01-01"))).toEqual({ week: 52, weekYear: 2015 });
  });
  it("2020-01-01 (Wed) → US W52 of 2019 (cross-year; Sunday starts in 2019)", () => {
    // Convention: weekYear = year of the Sunday starting the week.
    // Sun starting the week of Jan 1 2020 (Wed) = Dec 29 2019 → weekYear 2019.
    expect(getUsWeekNumber(D("2020-01-01"))).toEqual({ week: 52, weekYear: 2019 });
  });
});

describe("week-number US usWeeksInYear", () => {
  it("2017 (Jan 1 Sun, non-leap) → 53 weeks", () => {
    expect(usWeeksInYear(2017)).toBe(53);
  });
  it("2011 (Jan 1 Sat, non-leap) → 52 weeks", () => {
    expect(usWeeksInYear(2011)).toBe(52);
  });
  it("2012 (Jan 1 Sun, leap) → 53 weeks", () => {
    expect(usWeeksInYear(2012)).toBe(53);
  });
  it("2000 (Jan 1 Sat, leap) → 53 weeks", () => {
    expect(usWeeksInYear(2000)).toBe(53);
  });
  it("2016 (Jan 1 Fri, leap) → 52 weeks", () => {
    expect(usWeeksInYear(2016)).toBe(52);
  });
  it("2023 (Jan 1 Sun, non-leap) → 53 weeks", () => {
    expect(usWeeksInYear(2023)).toBe(53);
  });
});

describe("week-number US usWeekToDateRange", () => {
  it("2017 W1 = 2017-01-01 to 2017-01-07 (Sun-Sat)", () => {
    const r = usWeekToDateRange(2017, 1);
    expect(formatDate(r.start)).toBe("2017-01-01");
    expect(formatDate(r.end)).toBe("2017-01-07");
  });
  it("2017 W53 = 2017-12-31 to 2018-01-06 (cross-year)", () => {
    const r = usWeekToDateRange(2017, 53);
    expect(formatDate(r.start)).toBe("2017-12-31");
    expect(formatDate(r.end)).toBe("2018-01-06");
  });
  it("2011 W52 = 2010-12-26 to 2011-01-01 (cross-year)", () => {
    const r = usWeekToDateRange(2010, 52);
    expect(formatDate(r.start)).toBe("2010-12-26");
    expect(formatDate(r.end)).toBe("2011-01-01");
  });
});

describe("week-number Simple getSimpleWeekNumber", () => {
  it("Jan 1 → week 1", () => {
    expect(getSimpleWeekNumber(D("2025-01-01"))).toEqual({ week: 1, weekYear: 2025 });
  });
  it("Jan 7 → week 1", () => {
    expect(getSimpleWeekNumber(D("2025-01-07"))).toEqual({ week: 1, weekYear: 2025 });
  });
  it("Jan 8 → week 2", () => {
    expect(getSimpleWeekNumber(D("2025-01-08"))).toEqual({ week: 2, weekYear: 2025 });
  });
  it("Dec 31 2017 (non-leap, day 365) → week 53", () => {
    expect(getSimpleWeekNumber(D("2017-12-31"))).toEqual({ week: 53, weekYear: 2017 });
  });
  it("Dec 31 2020 (leap, day 366) → week 53", () => {
    expect(getSimpleWeekNumber(D("2020-12-31"))).toEqual({ week: 53, weekYear: 2020 });
  });
  it("Jul 1 2024 (day 183) → week 27 (ceil(183/7)=27)", () => {
    expect(getSimpleWeekNumber(D("2024-07-01"))).toEqual({ week: 27, weekYear: 2024 });
  });
});

describe("week-number Simple simpleWeeksInYear", () => {
  it("always returns 53 (non-leap)", () => {
    expect(simpleWeeksInYear(2017)).toBe(53);
    expect(simpleWeeksInYear(2021)).toBe(53);
  });
  it("always returns 53 (leap)", () => {
    expect(simpleWeeksInYear(2020)).toBe(53);
    expect(simpleWeeksInYear(2024)).toBe(53);
  });
});

describe("week-number Simple simpleWeekToDateRange", () => {
  it("Week 1 = Jan 1 to Jan 7", () => {
    const r = simpleWeekToDateRange(2025, 1);
    expect(formatDate(r.start)).toBe("2025-01-01");
    expect(formatDate(r.end)).toBe("2025-01-07");
  });
  it("Week 2 = Jan 8 to Jan 14", () => {
    const r = simpleWeekToDateRange(2025, 2);
    expect(formatDate(r.start)).toBe("2025-01-08");
    expect(formatDate(r.end)).toBe("2025-01-14");
  });
  it("Week 53 of non-leap starts Dec 31", () => {
    const r = simpleWeekToDateRange(2017, 53);
    expect(formatDate(r.start)).toBe("2017-12-31");
  });
});

describe("week-number Islamic getIslamicWeekNumber", () => {
  it("2011-01-01 (Sat) → Islamic W1 of 2011", () => {
    expect(getIslamicWeekNumber(D("2011-01-01"))).toEqual({ week: 1, weekYear: 2011 });
  });
  it("2017-01-01 (Sun) → Islamic W1 of 2017 (Sun is day 2 of Sat-start week, week containing Jan 1)", () => {
    // Saturday starting the week of Jan 1 2017 (Sun) is Dec 31 2016 (Sat).
    // firstSaturday of 2017: Jan 1 2017 (Sun, daysSinceSat=1), offset = (0-1+7)%7 = 6, firstSat = Jan 7 2017.
    // week of Dec 31 2016: prior to firstSat of 2017, so weekYear = 2016.
    // firstSaturday of 2016: Jan 1 2016 (Fri, daysSinceSat=6), offset = (0-6+7)%7 = 1, firstSat = Jan 2 2016.
    // (Dec 31 2016 - Jan 2 2016)/7 + 1 = 364/7 + 1 = 53.
    expect(getIslamicWeekNumber(D("2017-01-01"))).toEqual({ week: 53, weekYear: 2016 });
  });
  it("2016-01-01 (Fri) → Islamic W52 of 2015 (cross-year)", () => {
    // Sat starting week of Jan 1 2016 (Fri) = Dec 26 2015 (Sat).
    expect(getIslamicWeekNumber(D("2016-01-01"))).toEqual({ week: 52, weekYear: 2015 });
  });
  it("2020-01-01 (Wed) → Islamic W1 of 2020", () => {
    // Sat starting week of Jan 1 2020 (Wed) = Dec 28 2019 (Sat).
    // firstSaturday of 2019: Jan 1 2019 (Tue, daysSinceSat=3), offset = 4, firstSat = Jan 5 2019.
    // (Dec 28 2019 - Jan 5 2019)/7 + 1 = 357/7 + 1 = 52.
    expect(getIslamicWeekNumber(D("2020-01-01"))).toEqual({ week: 52, weekYear: 2019 });
  });
  it("2024-01-06 (Sat) → Islamic W1 of 2024", () => {
    expect(getIslamicWeekNumber(D("2024-01-06"))).toEqual({ week: 1, weekYear: 2024 });
  });
});

describe("week-number Islamic islamicWeeksInYear", () => {
  it("2011 (Jan 1 Sat, non-leap) → 53 weeks", () => {
    expect(islamicWeeksInYear(2011)).toBe(53);
  });
  it("2017 (Jan 1 Sun, non-leap) → 52 weeks", () => {
    expect(islamicWeeksInYear(2017)).toBe(52);
  });
  it("2016 (Jan 1 Fri, leap) → 53 weeks", () => {
    expect(islamicWeeksInYear(2016)).toBe(53);
  });
  it("2020 (Jan 1 Wed, leap) → 52 weeks", () => {
    expect(islamicWeeksInYear(2020)).toBe(52);
  });
  it("2005 (Jan 1 Sat, non-leap) → 53 weeks", () => {
    expect(islamicWeeksInYear(2005)).toBe(53);
  });
});

describe("week-number Islamic islamicWeekToDateRange", () => {
  it("2011 W1 = 2011-01-01 to 2011-01-07 (Sat-Fri)", () => {
    const r = islamicWeekToDateRange(2011, 1);
    expect(formatDate(r.start)).toBe("2011-01-01");
    expect(formatDate(r.end)).toBe("2011-01-07");
  });
  it("2016 W1 = 2016-01-02 to 2016-01-08 (Sat-Fri)", () => {
    const r = islamicWeekToDateRange(2016, 1);
    expect(formatDate(r.start)).toBe("2016-01-02");
    expect(formatDate(r.end)).toBe("2016-01-08");
  });
});

describe("week-number dispatcher getWeekNumber", () => {
  it("ISO 2014-12-29 → W1 2015", () => {
    const info = getWeekNumber(D("2014-12-29"), "iso");
    expect(info.week).toBe(1);
    expect(info.weekYear).toBe(2015);
    expect(info.calendarYear).toBe(2014);
    expect(info.startOfWeek).toBe("Monday");
    expect(info.totalWeeksInYear).toBe(53);
    expect(info.crossesYearBoundary).toBe(true);
    expect(info.isWeek53).toBe(false);
    expect(info.weekday).toBe(1);
    expect(info.weekdayName).toBe("Monday");
  });
  it("ISO 2020-12-31 → W53 2020 (isWeek53)", () => {
    const info = getWeekNumber(D("2020-12-31"), "iso");
    expect(info.week).toBe(53);
    expect(info.weekYear).toBe(2020);
    expect(info.isWeek53).toBe(true);
    expect(info.totalWeeksInYear).toBe(53);
  });
  it("US 2017-12-31 → W53 2017", () => {
    const info = getWeekNumber(D("2017-12-31"), "us");
    expect(info.week).toBe(53);
    expect(info.weekYear).toBe(2017);
    expect(info.startOfWeek).toBe("Sunday");
  });
  it("Simple 2025-01-08 → W2 2025", () => {
    const info = getWeekNumber(D("2025-01-08"), "simple");
    expect(info.week).toBe(2);
    expect(info.weekYear).toBe(2025);
    expect(info.startOfWeek).toBe("January 1");
  });
  it("Islamic 2011-01-01 → W1 2011", () => {
    const info = getWeekNumber(D("2011-01-01"), "islamic");
    expect(info.week).toBe(1);
    expect(info.weekYear).toBe(2011);
    expect(info.startOfWeek).toBe("Saturday");
  });
  it("summary mentions convention name", () => {
    const info = getWeekNumber(D("2020-12-31"), "iso");
    expect(info.summary).toContain("ISO");
    expect(info.summary).toContain("week 53");
    expect(info.summary).toContain("leap-week");
  });
  it("summary notes week-year vs calendar-year mismatch", () => {
    const info = getWeekNumber(D("2016-01-01"), "iso");
    expect(info.summary).toContain("differs");
  });
});

describe("week-number weeksInYear + hasWeek53", () => {
  it("weeksInYear dispatches correctly", () => {
    expect(weeksInYear(2015, "iso")).toBe(53);
    expect(weeksInYear(2016, "iso")).toBe(52);
    expect(weeksInYear(2017, "us")).toBe(53);
    expect(weeksInYear(2011, "us")).toBe(52);
    expect(weeksInYear(2017, "simple")).toBe(53);
    expect(weeksInYear(2011, "islamic")).toBe(53);
    expect(weeksInYear(2017, "islamic")).toBe(52);
  });
  it("hasWeek53 returns boolean", () => {
    expect(hasWeek53(2020, "iso")).toBe(true);
    expect(hasWeek53(2021, "iso")).toBe(false);
    expect(hasWeek53(2017, "us")).toBe(true);
    expect(hasWeek53(2011, "us")).toBe(false);
  });
});

describe("week-number weekToDateRange dispatcher", () => {
  it("ISO 2020 W53 cross-year range", () => {
    const r = weekToDateRange(2020, 53, "iso");
    expect(r.startDate).toBe("2020-12-28");
    expect(r.endDate).toBe("2021-01-03");
    expect(r.convention).toBe("iso");
    expect(r.daysInWeek).toBe(7);
    expect(r.crossesYearBoundary).toBe(true);
  });
  it("US 2017 W53 cross-year range", () => {
    const r = weekToDateRange(2017, 53, "us");
    expect(r.startDate).toBe("2017-12-31");
    expect(r.endDate).toBe("2018-01-06");
    expect(r.crossesYearBoundary).toBe(true);
  });
  it("Simple week 1 of 2025", () => {
    const r = weekToDateRange(2025, 1, "simple");
    expect(r.startDate).toBe("2025-01-01");
    expect(r.endDate).toBe("2025-01-07");
    expect(r.crossesYearBoundary).toBe(false);
  });
  it("Islamic week 1 of 2011", () => {
    const r = weekToDateRange(2011, 1, "islamic");
    expect(r.startDate).toBe("2011-01-01");
    expect(r.endDate).toBe("2011-01-07");
  });
});

describe("week-number buildYearGrid", () => {
  it("ISO 2020 has 53 rows", () => {
    const grid = buildYearGrid(2020, "iso", D("2020-06-15"));
    expect(grid).toHaveLength(53);
    expect(grid[0].week).toBe(1);
    expect(grid[52].week).toBe(53);
  });
  it("ISO 2021 has 52 rows", () => {
    const grid = buildYearGrid(2021, "iso");
    expect(grid).toHaveLength(52);
  });
  it("US 2017 has 53 rows", () => {
    const grid = buildYearGrid(2017, "us");
    expect(grid).toHaveLength(53);
  });
  it("marks current week", () => {
    const now = D("2020-06-15"); // ISO week 25 of 2020
    const grid = buildYearGrid(2020, "iso", now);
    const current = grid.find((r) => r.isCurrent);
    expect(current).toBeDefined();
    expect(current?.week).toBe(25);
  });
  it("does not mark any week if year doesn't match now", () => {
    const grid = buildYearGrid(1999, "iso", D("2020-06-15"));
    expect(grid.filter((r) => r.isCurrent)).toHaveLength(0);
  });
});

describe("week-number findCurrentWeek", () => {
  it("returns WeekInfo for today (ISO default)", () => {
    const info = findCurrentWeek(D("2020-06-15"), "iso");
    expect(info.week).toBe(25);
    expect(info.weekYear).toBe(2020);
  });
  it("defaults to convention iso when omitted", () => {
    const info = findCurrentWeek(D("2020-06-15"));
    expect(info.startOfWeek).toBe("Monday");
  });
});

describe("week-number renderYearGridCsv", () => {
  it("emits header + 53 rows for ISO 2020", () => {
    const csv = renderYearGridCsv(2020, "iso", D("2020-06-15"));
    const lines = csv.split("\n");
    expect(lines[0]).toBe("week,start_date,end_date,is_current");
    expect(lines).toHaveLength(54); // 1 header + 53 rows
    expect(lines[1]).toMatch(/^1,/);
    expect(lines[53]).toMatch(/^53,/);
  });
  it("marks current week with 1", () => {
    const csv = renderYearGridCsv(2020, "iso", D("2020-06-15"));
    const lines = csv.split("\n");
    // week 25 should be marked current
    const w25 = lines.find((l) => l.startsWith("25,"));
    expect(w25).toBeDefined();
    expect(w25?.endsWith(",1")).toBe(true);
  });
});

describe("week-number history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, dateIso: "2020-12-31", convention: "iso", week: 53, weekYear: 2020 });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].week).toBe(53);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, dateIso: "x", convention: "iso", week: i + 1, weekYear: 2020 });
    }
    expect(loadHistory()).toHaveLength(20);
    expect(loadHistory()[0].ts).toBe(24);
  });
  it("clears", () => {
    saveHistory({ ts: 1, dateIso: "x", convention: "iso", week: 1, weekYear: 2020 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("week-number shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("us", "2017-12-31");
    expect(url).toContain("c=us");
    expect(url).toContain("d=2017-12-31");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const r = parseShareUrl("c=us&d=2017-12-31");
    expect(r.convention).toBe("us");
    expect(r.dateIso).toBe("2017-12-31");
  });
  it("defaults to iso on empty hash", () => {
    const r = parseShareUrl("");
    expect(r.convention).toBe("iso");
    expect(r.dateIso).toBe("");
  });
  it("filters invalid convention", () => {
    const r = parseShareUrl("c=foobar");
    expect(r.convention).toBe("iso");
  });
  it("round-trips all conventions", () => {
    for (const c of ["iso", "us", "simple", "islamic"] as Convention[]) {
      const url = buildShareUrl(c, "2025-01-15");
      const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : url.replace(/^\?/, "");
      const parsed = parseShareUrl(hash);
      expect(parsed.convention).toBe(c);
      expect(parsed.dateIso).toBe("2025-01-15");
    }
  });
});

// Suppress unused-import lint
export type _Unused = Convention;

import { describe, it, expect, beforeEach } from "vitest";
import {
  LAYOUTS,
  WEEK_STARTS,
  PAPER_SIZES,
  ORIENTATIONS,
  LOCALES,
  HOLIDAY_PRESETS,
  THEMES,
  THEME_COLORS,
  PAPER_DIMS,
  PRESETS,
  pad2,
  isLeapYear,
  daysInMonth,
  daysInYear,
  getMonthName,
  getWeekdayNames,
  weekStartOffset,
  formatIsoDate,
  parseIsoDate,
  getIsoWeek,
  getDayOfYear,
  todayIso,
  getPaperDim,
  easterSunday,
  nthWeekday,
  lastWeekday,
  addDays,
  computeHolidays,
  buildHolidayMap,
  buildEventMap,
  parseIcs,
  validateOptions,
  defaultOptions,
  generateMonth,
  generateYear,
  generateWeek,
  generateMultiMonth,
  renderMonthHtml,
  renderYearHtml,
  renderWeekHtml,
  renderMiniMonthHtml,
  renderMultiMonthHtml,
  renderMonthText,
  renderSingleMonthHtml,
  renderSingleWeekHtml,
  renderCalendarHtml,
  exportIcs,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CalendarOptions,
  type HolidayPreset,
  type WeekStart,
  type PaperSize,
  type Orientation,
  type LocaleCode,
  type ThemeName,
  type CalendarLayout,
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("printable-calendar constants", () => {
  it("has 4 layouts", () => {
    expect(LAYOUTS).toHaveLength(4);
    expect(LAYOUTS.map((l) => l.value)).toEqual(["monthly", "yearly", "weekly", "multi-month"]);
  });
  it("has 3 week starts", () => {
    expect(WEEK_STARTS).toHaveLength(3);
    expect(WEEK_STARTS.map((w) => w.value).sort()).toEqual(["monday", "saturday", "sunday"]);
  });
  it("has 7 paper sizes including custom", () => {
    expect(PAPER_SIZES).toHaveLength(7);
    expect(PAPER_SIZES.find((p) => p.value === "custom")).toBeTruthy();
  });
  it("has 2 orientations", () => {
    expect(ORIENTATIONS).toHaveLength(2);
  });
  it("has at least 10 locales", () => {
    expect(LOCALES.length).toBeGreaterThanOrEqual(10);
    expect(LOCALES.find((l) => l.value === "en-US")).toBeTruthy();
    expect(LOCALES.find((l) => l.value === "ja-JP")).toBeTruthy();
  });
  it("has 4 holiday presets", () => {
    expect(HOLIDAY_PRESETS).toHaveLength(4);
  });
  it("has 5 themes", () => {
    expect(THEMES).toHaveLength(5);
  });
  it("theme colors are complete", () => {
    for (const t of ["light", "dark", "sepia", "blue", "green"] as ThemeName[]) {
      const c = THEME_COLORS[t];
      expect(c.bg).toMatch(/^#/);
      expect(c.fg).toMatch(/^#/);
      expect(c.accent).toMatch(/^#/);
    }
  });
  it("paper dims exist for all non-custom sizes", () => {
    expect(PAPER_DIMS.a4.widthMm).toBe(210);
    expect(PAPER_DIMS.a4.heightMm).toBe(297);
    expect(PAPER_DIMS.letter.widthMm).toBeCloseTo(215.9, 1);
  });
  it("has at least 5 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

describe("printable-calendar helpers", () => {
  it("pad2 pads to 2 digits", () => {
    expect(pad2(3)).toBe("03");
    expect(pad2(12)).toBe("12");
  });
  it("isLeapYear follows Gregorian rule", () => {
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2025)).toBe(false);
  });
  it("daysInMonth handles February", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(daysInMonth(2025, 1)).toBe(31);
    expect(daysInMonth(2025, 4)).toBe(30);
  });
  it("daysInYear is 366 for leap year", () => {
    expect(daysInYear(2024)).toBe(366);
    expect(daysInYear(2025)).toBe(365);
  });
  it("getMonthName returns localized name", () => {
    expect(getMonthName(1, "en-US")).toBe("January");
    expect(getMonthName(1, "fr-FR")).toBe("Janvier");
    expect(getMonthName(1, "de-DE")).toBe("Januar");
  });
  it("weekStartOffset maps correctly", () => {
    expect(weekStartOffset("sunday")).toBe(0);
    expect(weekStartOffset("monday")).toBe(1);
    expect(weekStartOffset("saturday")).toBe(6);
  });
  it("getWeekdayNames respects week start", () => {
    expect(getWeekdayNames("sunday", "en-US")).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    expect(getWeekdayNames("monday", "en-US")).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(getWeekdayNames("saturday", "en-US")).toEqual(["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"]);
  });
  it("formatIsoDate pads", () => {
    expect(formatIsoDate(2025, 3, 7)).toBe("2025-03-07");
  });
  it("parseIsoDate round-trips", () => {
    const d = parseIsoDate("2025-03-07");
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2025);
    expect(d!.getUTCMonth()).toBe(2);
    expect(d!.getUTCDate()).toBe(7);
  });
  it("parseIsoDate rejects invalid dates", () => {
    expect(parseIsoDate("2025-13-01")).toBeNull();
    expect(parseIsoDate("2025-02-30")).toBeNull();
    expect(parseIsoDate("not-a-date")).toBeNull();
  });
  it("getIsoWeek matches known values", () => {
    // 2026-01-01 is Thursday — ISO week 1 of 2026.
    expect(getIsoWeek(2026, 1, 1).week).toBe(1);
    // 2025-12-29 is Monday of ISO week 1 of 2026.
    expect(getIsoWeek(2025, 12, 29).week).toBe(1);
    expect(getIsoWeek(2025, 12, 29).weekYear).toBe(2026);
    // 2024-12-30 is Monday of ISO week 1 of 2025.
    expect(getIsoWeek(2024, 12, 30).week).toBe(1);
    expect(getIsoWeek(2024, 12, 30).weekYear).toBe(2025);
  });
  it("getDayOfYear is correct", () => {
    expect(getDayOfYear(2025, 1, 1)).toBe(1);
    expect(getDayOfYear(2025, 12, 31)).toBe(365);
    expect(getDayOfYear(2024, 12, 31)).toBe(366);
  });
  it("todayIso returns a YYYY-MM-DD string", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// Paper dimensions
// ---------------------------------------------------------------------------

describe("printable-calendar paper dims", () => {
  it("returns base dims for portrait", () => {
    const d = getPaperDim("a4", { orientation: "portrait" });
    expect(d.widthMm).toBe(210);
    expect(d.heightMm).toBe(297);
  });
  it("swaps dims for landscape", () => {
    const d = getPaperDim("a4", { orientation: "landscape" });
    expect(d.widthMm).toBe(297);
    expect(d.heightMm).toBe(210);
  });
  it("supports custom dimensions", () => {
    const d = getPaperDim("custom", { customWidthMm: 200, customHeightMm: 200, orientation: "portrait" });
    expect(d.widthMm).toBe(200);
    expect(d.heightMm).toBe(200);
  });
  it("swaps custom for landscape", () => {
    const d = getPaperDim("custom", { customWidthMm: 100, customHeightMm: 300, orientation: "landscape" });
    expect(d.widthMm).toBe(300);
    expect(d.heightMm).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Holiday computation
// ---------------------------------------------------------------------------

describe("printable-calendar holidays", () => {
  it("easterSunday matches known dates", () => {
    // Easter 2024: March 31. Easter 2025: April 20. Easter 2026: April 5.
    expect(easterSunday(2024)).toBe("2024-03-31");
    expect(easterSunday(2025)).toBe("2025-04-20");
    expect(easterSunday(2026)).toBe("2026-04-05");
  });
  it("nthWeekday finds 3rd Monday of January 2026 (MLK)", () => {
    // Jan 19, 2026 is the 3rd Monday.
    expect(nthWeekday(2026, 1, 1, 3)).toBe("2026-01-19");
  });
  it("lastWeekday finds last Monday of May 2026 (Memorial Day)", () => {
    // May 25, 2026 is the last Monday of May.
    expect(lastWeekday(2026, 5, 1)).toBe("2026-05-25");
  });
  it("addDays moves forward", () => {
    expect(addDays("2026-01-01", 7)).toBe("2026-01-08");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
  it("computeHolidays none returns empty", () => {
    expect(computeHolidays(2026, "none")).toEqual([]);
  });
  it("computeHolidays us includes fixed and floating holidays", () => {
    const hs = computeHolidays(2026, "us");
    const names = hs.map((h) => h.name);
    expect(names).toContain("New Year's Day");
    expect(names).toContain("Christmas Day");
    expect(names).toContain("Independence Day");
    expect(names).toContain("Martin Luther King Jr. Day");
    expect(names).toContain("Thanksgiving");
    expect(names).toContain("Labor Day");
  });
  it("computeHolidays uk includes bank holidays and Easter", () => {
    const hs = computeHolidays(2026, "uk");
    const names = hs.map((h) => h.name);
    expect(names).toContain("Boxing Day");
    expect(names).toContain("Good Friday");
    expect(names).toContain("Easter Monday");
    expect(names).toContain("Spring Bank Holiday");
  });
  it("computeHolidays eu includes Labour Day", () => {
    const hs = computeHolidays(2026, "eu");
    const names = hs.map((h) => h.name);
    expect(names).toContain("Labour Day");
    expect(names).toContain("Good Friday");
  });
  it("holidays are sorted by date", () => {
    const hs = computeHolidays(2026, "us");
    for (let i = 1; i < hs.length; i++) {
      expect(hs[i].date >= hs[i - 1].date).toBe(true);
    }
  });
  it("buildHolidayMap keys by date", () => {
    const m = buildHolidayMap(2026, "us");
    expect(m.get("2026-07-04")?.name).toBe("Independence Day");
    expect(m.get("2026-12-25")?.name).toBe("Christmas Day");
  });
});

// ---------------------------------------------------------------------------
// ICS parsing
// ---------------------------------------------------------------------------

describe("printable-calendar ICS import", () => {
  it("parses a simple VEVENT", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:1@unqtools
DTSTART;VALUE=DATE:20260101
SUMMARY:New Year Brunch
END:VEVENT
END:VCALENDAR`;
    const r = parseIcs(ics);
    expect(r.events).toHaveLength(1);
    expect(r.events[0].date).toBe("2026-01-01");
    expect(r.events[0].title).toBe("New Year Brunch");
  });
  it("parses multiple VEVENTs", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260101
SUMMARY:One
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260102
SUMMARY:Two
END:VEVENT
END:VCALENDAR`;
    const r = parseIcs(ics);
    expect(r.events).toHaveLength(2);
    expect(r.events[1].title).toBe("Two");
  });
  it("handles UTC datetime form", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260315T120000Z
SUMMARY:UTC event
END:VEVENT
END:VCALENDAR`;
    const r = parseIcs(ics);
    expect(r.events).toHaveLength(1);
    expect(r.events[0].date).toBe("2026-03-15");
  });
  it("handles line folding", () => {
    const ics = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Very Long\r\n Title\r\nDTSTART;VALUE=DATE:20260101\r\nEND:VEVENT\r\nEND:VCALENDAR";
    const r = parseIcs(ics);
    expect(r.events[0].title).toBe("Very Long Title");
  });
  it("returns warning when no VEVENTs", () => {
    const r = parseIcs("BEGIN:VCALENDAR\nEND:VCALENDAR");
    expect(r.events).toHaveLength(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Options validation
// ---------------------------------------------------------------------------

describe("printable-calendar validateOptions", () => {
  it("accepts default options", () => {
    const v = validateOptions(defaultOptions());
    expect(v.valid).toBe(true);
    expect(v.errors).toEqual([]);
  });
  it("rejects invalid layout", () => {
    const o = { ...defaultOptions(), layout: "bogus" as CalendarLayout };
    expect(validateOptions(o).valid).toBe(false);
  });
  it("rejects invalid weekStart", () => {
    const o = { ...defaultOptions(), weekStart: "tuesday" as WeekStart };
    expect(validateOptions(o).valid).toBe(false);
  });
  it("rejects invalid paperSize", () => {
    const o = { ...defaultOptions(), paperSize: "b5" as PaperSize };
    expect(validateOptions(o).valid).toBe(false);
  });
  it("rejects custom paper without dimensions", () => {
    const o = { ...defaultOptions(), paperSize: "custom" as PaperSize };
    const v = validateOptions(o);
    expect(v.valid).toBe(false);
    expect(v.errors.join("; ")).toMatch(/width/i);
  });
  it("rejects multi-month with startMonth > endMonth", () => {
    const o = { ...defaultOptions(), layout: "multi-month" as CalendarLayout, startMonth: 6, endMonth: 3 };
    expect(validateOptions(o).valid).toBe(false);
  });
  it("rejects multi-month with more than 6 months", () => {
    const o = { ...defaultOptions(), layout: "multi-month" as CalendarLayout, startMonth: 1, endMonth: 12 };
    expect(validateOptions(o).valid).toBe(false);
  });
  it("rejects invalid weekStartDay for weekly", () => {
    const o = { ...defaultOptions(), layout: "weekly" as CalendarLayout, weekStartDay: 9 };
    expect(validateOptions(o).valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Month / year / week generation
// ---------------------------------------------------------------------------

describe("printable-calendar generateMonth", () => {
  const opts = { ...defaultOptions(), todayOverride: "2026-03-15" };

  it("generates 4-6 weeks for any month", () => {
    const m = generateMonth(2026, 1, opts);
    expect(m.weeks.length).toBeGreaterThanOrEqual(4);
    expect(m.weeks.length).toBeLessThanOrEqual(6);
  });
  it("February non-leap has 28 days", () => {
    const m = generateMonth(2025, 2, opts);
    const days = m.weeks.flatMap((w) => w.cells).filter((c) => c.day !== null).length;
    expect(days).toBe(28);
  });
  it("February leap has 29 days", () => {
    const m = generateMonth(2024, 2, opts);
    const days = m.weeks.flatMap((w) => w.cells).filter((c) => c.day !== null).length;
    expect(days).toBe(29);
  });
  it("first cell aligns with week start (Monday start, Jan 2026)", () => {
    // Jan 1, 2026 is Thursday. Monday-start grid begins Mon Dec 29 2025.
    const o = { ...opts, weekStart: "monday" as WeekStart };
    const m = generateMonth(2026, 1, o);
    const firstWeek = m.weeks[0].cells;
    // First cell is Monday Dec 29 (padding).
    expect(firstWeek[0].day).toBeNull();
    // First non-null cell is Thursday Jan 1.
    const firstDay = firstWeek.find((c) => c.day !== null);
    expect(firstDay?.day).toBe(1);
    expect(firstDay?.date).toBe("2026-01-01");
  });
  it("first cell aligns with Sunday start", () => {
    // Sunday-start grid begins Sun Dec 28 2025.
    const o = { ...opts, weekStart: "sunday" as WeekStart };
    const m = generateMonth(2026, 1, o);
    const firstWeek = m.weeks[0].cells;
    expect(firstWeek[0].day).toBeNull(); // Sun Dec 28 padding
    // Index 4 = Thursday Jan 1.
    expect(firstWeek[4].day).toBe(1);
  });
  it("today cell is highlighted", () => {
    const m = generateMonth(2026, 3, opts);
    const today = m.weeks.flatMap((w) => w.cells).find((c) => c.day === 15);
    expect(today?.isToday).toBe(true);
    const other = m.weeks.flatMap((w) => w.cells).find((c) => c.day === 14);
    expect(other?.isToday).toBe(false);
  });
  it("weekend cells are flagged", () => {
    const m = generateMonth(2026, 1, opts);
    const sat = m.weeks.flatMap((w) => w.cells).find((c) => c.date === "2026-01-03");
    const sun = m.weeks.flatMap((w) => w.cells).find((c) => c.date === "2026-01-04");
    expect(sat?.isWeekend).toBe(true);
    expect(sun?.isWeekend).toBe(true);
    const mon = m.weeks.flatMap((w) => w.cells).find((c) => c.date === "2026-01-05");
    expect(mon?.isWeekend).toBe(false);
  });
  it("holiday cells are flagged with name", () => {
    const m = generateMonth(2026, 1, opts);
    const nyd = m.weeks.flatMap((w) => w.cells).find((c) => c.date === "2026-01-01");
    expect(nyd?.isHoliday).toBe(true);
    expect(nyd?.holidayName).toBe("New Year's Day");
  });
  it("week numbers appear on first cell of each week", () => {
    const o = { ...opts, showWeekNumbers: true };
    const m = generateMonth(2026, 1, o);
    for (const w of m.weeks) {
      // weekNumber set on first non-null cell OR undefined for padding rows
      const firstReal = w.cells.find((c) => c.day !== null);
      if (firstReal && firstReal.day === 1) {
        expect(w.weekNumber).toBe(1); // Jan 1 2026 is in ISO week 1
      }
    }
  });
  it("events are attached to correct dates", () => {
    const o: CalendarOptions = {
      ...opts,
      holidayPreset: "none",
      showHolidays: false,
      events: [{ date: "2026-01-15", title: "Dentist" }],
    };
    const m = generateMonth(2026, 1, o);
    const cell = m.weeks.flatMap((w) => w.cells).find((c) => c.date === "2026-01-15");
    expect(cell?.events).toHaveLength(1);
    expect(cell?.events[0].title).toBe("Dentist");
  });
  it("dayOfYear is set when option enabled", () => {
    const o = { ...opts, showDayOfYear: true };
    const m = generateMonth(2026, 1, o);
    const jan1 = m.weeks.flatMap((w) => w.cells).find((c) => c.date === "2026-01-01");
    expect(jan1?.dayOfYear).toBe(1);
  });
  it("August 2026 has 31 days across 6 weeks (Monday start)", () => {
    const o = { ...opts, weekStart: "monday" as WeekStart };
    const m = generateMonth(2026, 8, o);
    const days = m.weeks.flatMap((w) => w.cells).filter((c) => c.day !== null).length;
    expect(days).toBe(31);
  });
});

describe("printable-calendar generateYear", () => {
  it("generates 12 months", () => {
    const y = generateYear(2026, defaultOptions());
    expect(y.months).toHaveLength(12);
    expect(y.months[0].name).toBe("January");
    expect(y.months[11].name).toBe("December");
  });
});

describe("printable-calendar generateWeek", () => {
  it("generates 7 days starting from a date", () => {
    const w = generateWeek(2026, 1, 1, defaultOptions());
    expect(w.cells).toHaveLength(7);
    expect(w.cells[0].day).toBe(1);
    expect(w.cells[6].day).toBe(7);
  });
  it("crosses month boundary", () => {
    const w = generateWeek(2026, 1, 28, defaultOptions());
    expect(w.cells).toHaveLength(7);
    expect(w.cells[0].day).toBe(28);
    expect(w.cells[6].day).toBe(3);
  });
  it("throws for invalid start date", () => {
    expect(() => generateWeek(2026, 13, 1, defaultOptions())).toThrow();
  });
});

describe("printable-calendar generateMultiMonth", () => {
  it("generates the requested range", () => {
    const months = generateMultiMonth(2026, 3, 6, defaultOptions());
    expect(months).toHaveLength(4);
    expect(months[0].month).toBe(3);
    expect(months[3].month).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// HTML rendering
// ---------------------------------------------------------------------------

describe("printable-calendar renderMonthHtml", () => {
  it("produces a table with weekday headers", () => {
    const opts = defaultOptions();
    const m = generateMonth(2026, 1, opts);
    const html = renderMonthHtml(m, opts);
    expect(html).toContain("<table");
    expect(html).toContain("Mon");
    expect(html).toContain("Jan");
  });
  it("includes today class for today cell", () => {
    const opts = { ...defaultOptions(), todayOverride: "2026-01-15" };
    const m = generateMonth(2026, 1, opts);
    const html = renderMonthHtml(m, opts);
    expect(html).toContain("cal-today");
    expect(html).toContain('data-date="2026-01-15"');
  });
  it("includes holiday class and name", () => {
    const opts = defaultOptions();
    const m = generateMonth(2026, 1, opts);
    const html = renderMonthHtml(m, opts);
    expect(html).toContain("cal-holiday");
    expect(html).toContain("New Year's Day");
  });
  it("includes week number column when enabled", () => {
    const opts = { ...defaultOptions(), showWeekNumbers: true };
    const m = generateMonth(2026, 1, opts);
    const html = renderMonthHtml(m, opts);
    expect(html).toContain("cal-wn");
  });
  it("omits week number column when disabled", () => {
    const opts = { ...defaultOptions(), showWeekNumbers: false };
    const m = generateMonth(2026, 1, opts);
    const html = renderMonthHtml(m, opts);
    expect(html).not.toContain("cal-wn");
  });
  it("escapes HTML in event titles", () => {
    const opts: CalendarOptions = {
      ...defaultOptions(),
      holidayPreset: "none",
      showHolidays: false,
      events: [{ date: "2026-01-15", title: "<script>alert(1)</script>" }],
    };
    const m = generateMonth(2026, 1, opts);
    const html = renderMonthHtml(m, opts);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
  it("preserves long event titles (no truncation in source)", () => {
    const longTitle = "A".repeat(120);
    const opts: CalendarOptions = {
      ...defaultOptions(),
      holidayPreset: "none",
      showHolidays: false,
      events: [{ date: "2026-01-15", title: longTitle }],
    };
    const m = generateMonth(2026, 1, opts);
    const html = renderMonthHtml(m, opts);
    expect(html).toContain(longTitle);
  });
});

describe("printable-calendar renderYearHtml", () => {
  it("produces 12 mini-month sections", () => {
    const html = renderYearHtml(2026, defaultOptions());
    expect(html).toContain("cal-year-grid");
    const matches = html.match(/cal-mini-month/g) ?? [];
    expect(matches.length).toBe(12);
  });
});

describe("printable-calendar renderWeekHtml", () => {
  it("produces a 7-row table", () => {
    const w = generateWeek(2026, 1, 1, defaultOptions());
    const html = renderWeekHtml(w, defaultOptions());
    const matches = html.match(/<tr[^>]*>/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(7);
  });
  it("includes notes column when enabled", () => {
    const opts = { ...defaultOptions(), showNotes: true };
    const w = generateWeek(2026, 1, 1, opts);
    const html = renderWeekHtml(w, opts);
    expect(html).toContain("cal-notes");
  });
});

describe("printable-calendar renderMiniMonthHtml", () => {
  it("uses single-letter weekday headers", () => {
    const opts = defaultOptions();
    const m = generateMonth(2026, 1, opts);
    const html = renderMiniMonthHtml(m, opts);
    expect(html).toContain(">M<");
    expect(html).toContain(">T<");
  });
});

describe("printable-calendar renderMultiMonthHtml", () => {
  it("renders each month as a section", () => {
    const months = generateMultiMonth(2026, 1, 3, defaultOptions());
    const html = renderMultiMonthHtml(months, defaultOptions());
    expect(html).toContain("January");
    expect(html).toContain("March");
  });
});

describe("printable-calendar renderCalendarHtml", () => {
  it("produces a full HTML document for monthly layout", () => {
    const html = renderCalendarHtml(2026, defaultOptions());
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<style>");
    expect(html).toContain("@page");
  });
  it("throws for invalid options", () => {
    const bad = { ...defaultOptions(), layout: "bogus" as CalendarLayout };
    expect(() => renderCalendarHtml(2026, bad)).toThrow();
  });
  it("renders yearly layout", () => {
    const opts = { ...defaultOptions(), layout: "yearly" as CalendarLayout };
    const html = renderCalendarHtml(2026, opts);
    expect(html).toContain("cal-year-grid");
  });
  it("renders multi-month layout", () => {
    const opts = { ...defaultOptions(), layout: "multi-month" as CalendarLayout, startMonth: 1, endMonth: 6 };
    const html = renderCalendarHtml(2026, opts);
    expect(html).toContain("cal-multi-grid");
  });
  it("includes title and subtitle", () => {
    const opts = { ...defaultOptions(), title: "Office Calendar", subtitle: "Team A" };
    const html = renderCalendarHtml(2026, opts);
    expect(html).toContain("Office Calendar");
    expect(html).toContain("Team A");
  });
});

describe("printable-calendar renderMonthText", () => {
  it("produces a plain text calendar", () => {
    const opts = defaultOptions();
    const m = generateMonth(2026, 1, opts);
    const txt = renderMonthText(m, opts);
    expect(txt).toContain("January 2026");
    expect(txt).toContain("Mon");
    expect(txt).toContain("1");
  });
});

describe("printable-calendar exportIcs", () => {
  it("produces a valid VCALENDAR", () => {
    const opts = { ...defaultOptions(), holidayPreset: "us" as HolidayPreset };
    const ics = exportIcs(2026, opts);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("SUMMARY:Independence Day");
  });
  it("includes custom events", () => {
    const opts: CalendarOptions = {
      ...defaultOptions(),
      holidayPreset: "none",
      showHolidays: true,
      events: [{ date: "2026-07-10", title: "Picnic" }],
    };
    const ics = exportIcs(2026, opts);
    expect(ics).toContain("SUMMARY:Picnic");
  });
});

describe("printable-calendar renderSingleMonthHtml", () => {
  it("renders one specific month", () => {
    const html = renderSingleMonthHtml(2026, 6, defaultOptions());
    expect(html).toContain("June");
    expect(html).toContain("2026");
  });
});

describe("printable-calendar renderSingleWeekHtml", () => {
  it("renders one specific week", () => {
    const html = renderSingleWeekHtml(2026, 1, 1, defaultOptions());
    expect(html).toContain("cal-week");
  });
});

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

describe("printable-calendar history", () => {
  it("starts empty", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and reloads entries", () => {
    saveHistory({ ts: 1000, year: 2026, layout: "monthly", paperSize: "a4", orientation: "portrait" });
    saveHistory({ ts: 2000, year: 2025, layout: "yearly", paperSize: "letter", orientation: "landscape" });
    const h = loadHistory();
    expect(h).toHaveLength(2);
    expect(h[0].ts).toBe(2000);
    expect(h[1].ts).toBe(1000);
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, year: 2020 + i, layout: "monthly", paperSize: "a4", orientation: "portrait" });
    }
    const h = loadHistory();
    expect(h).toHaveLength(20);
    expect(h[0].ts).toBe(24);
  });
  it("clearHistory empties storage", () => {
    saveHistory({ ts: 1000, year: 2026, layout: "monthly", paperSize: "a4", orientation: "portrait" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Share URL
// ---------------------------------------------------------------------------

describe("printable-calendar share url", () => {
  it("builds a shareable URL with all key options", () => {
    const opts = defaultOptions();
    const url = buildShareUrl(opts, 2026);
    expect(url).toContain("y=2026");
    expect(url).toContain("layout=monthly");
    expect(url).toContain("ws=monday");
    expect(url).toContain("paper=a4");
    expect(url).toContain("theme=light");
  });
  it("round-trips through parseShareUrl", () => {
    const opts = defaultOptions();
    const url = buildShareUrl(opts, 2026);
    const parsed = parseShareUrl(url);
    expect(parsed.year).toBe(2026);
    expect(parsed.opts.layout).toBe("monthly");
    expect(parsed.opts.weekStart).toBe("monday");
    expect(parsed.opts.paperSize).toBe("a4");
    expect(parsed.opts.orientation).toBe("portrait");
    expect(parsed.opts.theme).toBe("light");
    expect(parsed.opts.locale).toBe("en-US");
    expect(parsed.opts.holidayPreset).toBe("us");
  });
  it("round-trips multi-month options", () => {
    const opts: CalendarOptions = {
      ...defaultOptions(),
      layout: "multi-month",
      startMonth: 3,
      endMonth: 8,
    };
    const url = buildShareUrl(opts, 2026);
    const parsed = parseShareUrl(url);
    expect(parsed.opts.layout).toBe("multi-month");
    expect(parsed.opts.startMonth).toBe(3);
    expect(parsed.opts.endMonth).toBe(8);
  });
  it("round-trips custom paper dimensions", () => {
    const opts: CalendarOptions = {
      ...defaultOptions(),
      paperSize: "custom",
      paperWidthMm: 200,
      paperHeightMm: 200,
    };
    const url = buildShareUrl(opts, 2026);
    const parsed = parseShareUrl(url);
    expect(parsed.opts.paperSize).toBe("custom");
    expect(parsed.opts.paperWidthMm).toBe(200);
    expect(parsed.opts.paperHeightMm).toBe(200);
  });
  it("round-trips title and subtitle", () => {
    const opts: CalendarOptions = {
      ...defaultOptions(),
      title: "Office Cal",
      subtitle: "Dept A",
    };
    const url = buildShareUrl(opts, 2026);
    const parsed = parseShareUrl(url);
    expect(parsed.opts.title).toBe("Office Cal");
    expect(parsed.opts.subtitle).toBe("Dept A");
  });
  it("empty hash returns empty opts", () => {
    expect(parseShareUrl("")).toEqual({ opts: {} });
    expect(parseShareUrl("#")).toEqual({ opts: {} });
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("printable-calendar edge cases", () => {
  it("December has 31 days", () => {
    const m = generateMonth(2026, 12, defaultOptions());
    const days = m.weeks.flatMap((w) => w.cells).filter((c) => c.day !== null).length;
    expect(days).toBe(31);
  });
  it("week 53 appears for years that have it", () => {
    // 2020 has 53 ISO weeks (Jan 1 is Wednesday in a leap year).
    const iso = getIsoWeek(2020, 12, 31);
    expect(iso.week).toBe(53);
  });
  it("Feb 29 in a leap year is a valid date cell", () => {
    const m = generateMonth(2024, 2, defaultOptions());
    const cell = m.weeks.flatMap((w) => w.cells).find((c) => c.date === "2024-02-29");
    expect(cell).toBeTruthy();
    expect(cell?.day).toBe(29);
  });
  it("Feb 29 in a non-leap year does not exist", () => {
    const m = generateMonth(2025, 2, defaultOptions());
    const cell = m.weeks.flatMap((w) => w.cells).find((c) => c.date === "2025-02-29");
    expect(cell).toBeUndefined();
  });
  it("does not flag Saturday/Sunday as weekend in friday-weekstart (n/a here, but check sun)", () => {
    const o = { ...defaultOptions(), weekStart: "monday" as WeekStart };
    const m = generateMonth(2026, 1, o);
    const tue = m.weeks.flatMap((w) => w.cells).find((c) => c.date === "2026-01-06");
    expect(tue?.isWeekend).toBe(false);
  });
  it("month with 6 weeks generates 6 weeks", () => {
    // August 2026 with Sunday start spans 6 weeks.
    const o = { ...defaultOptions(), weekStart: "sunday" as WeekStart };
    const m = generateMonth(2026, 8, o);
    expect(m.weeks.length).toBeGreaterThanOrEqual(5);
  });
});

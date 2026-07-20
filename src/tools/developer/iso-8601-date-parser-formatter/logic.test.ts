import { describe, it, expect, beforeEach } from "vitest";
import {
  KIND_LABELS,
  ISO_EXAMPLES,
  pad2,
  pad3,
  pad4,
  padExpanded,
  isLeapYear,
  daysInMonth,
  daysInYear,
  weeksInYear,
  calendarToWeek,
  weekToCalendar,
  calendarToOrdinal,
  ordinalToCalendar,
  detectKind,
  parseIso8601,
  parseDuration,
  parseInterval,
  parseRecurring,
  validateIso8601,
  toMs,
  fromMs,
  formatCalendarDate,
  formatWeekDate,
  formatOrdinalDate,
  formatTime,
  formatDateTime,
  formatDuration,
  formatInterval,
  formatRecurring,
  formatAll,
  addDuration,
  subtractDuration,
  durationToSeconds,
  normalizeDuration,
  getComponents,
  explain,
  codeSnippets,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type IsoKind,
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

describe("iso-8601 constants", () => {
  it("has labels for all kinds", () => {
    expect(Object.keys(KIND_LABELS)).toHaveLength(6);
    expect(KIND_LABELS.date).toBe("Calendar date");
    expect(KIND_LABELS.duration).toBe("Duration");
  });
  it("has examples for every kind", () => {
    const seen = new Set<IsoKind>();
    for (const ex of ISO_EXAMPLES) seen.add(ex.kind);
    expect(seen.size).toBe(6);
    expect(ISO_EXAMPLES.length).toBeGreaterThanOrEqual(15);
  });
});

describe("iso-8601 helpers", () => {
  it("pads numbers", () => {
    expect(pad2(3)).toBe("03");
    expect(pad2(12)).toBe("12");
    expect(pad3(15)).toBe("015");
    expect(pad4(26)).toBe("0026");
    expect(pad4(12026)).toBe("12026");
    expect(padExpanded(12026)).toBe("+12026");
    expect(padExpanded(-50)).toBe("-00050");
  });
  it("leap-year logic", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
  });
  it("daysInMonth", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 1)).toBe(31);
  });
  it("daysInYear", () => {
    expect(daysInYear(2026)).toBe(365);
    expect(daysInYear(2024)).toBe(366);
  });
  it("weeksInYear", () => {
    expect(weeksInYear(2026)).toBe(53); // Jan 1, 2026 is Thursday
    expect(weeksInYear(2025)).toBe(52); // Jan 1, 2025 is Wednesday, not leap
    expect(weeksInYear(2020)).toBe(53); // Jan 1, 2020 is Wednesday, leap
  });
});

describe("iso-8601 calendar↔week↔ordinal", () => {
  it("calendarToWeek (2026-01-15)", () => {
    const w = calendarToWeek(2026, 1, 15);
    expect(w.weekYear).toBe(2026);
    expect(w.week).toBe(3);
    expect(w.weekDay).toBe(4); // Thursday
  });
  it("weekToCalendar (2026-W03-4)", () => {
    const c = weekToCalendar(2026, 3, 4);
    expect(c).toEqual({ year: 2026, month: 1, day: 15 });
  });
  it("week↔calendar round trip", () => {
    for (let m = 1; m <= 12; m++) {
      const d = 15;
      const w = calendarToWeek(2026, m, d);
      const c = weekToCalendar(w.weekYear, w.week, w.weekDay);
      expect(c).toEqual({ year: 2026, month: m, day: d });
    }
  });
  it("calendarToOrdinal (2026-01-15)", () => {
    expect(calendarToOrdinal(2026, 1, 15)).toBe(15);
    expect(calendarToOrdinal(2026, 12, 31)).toBe(365);
    expect(calendarToOrdinal(2024, 12, 31)).toBe(366);
  });
  it("ordinalToCalendar (2026-015)", () => {
    expect(ordinalToCalendar(2026, 15)).toEqual({ year: 2026, month: 1, day: 15 });
    expect(ordinalToCalendar(2026, 365)).toEqual({ year: 2026, month: 12, day: 31 });
  });
  it("ordinal↔calendar round trip", () => {
    for (let day = 1; day <= 365; day += 30) {
      const c = ordinalToCalendar(2026, day);
      const o = calendarToOrdinal(c.year, c.month, c.day);
      expect(o).toBe(day);
    }
  });
});

describe("iso-8601 detectKind", () => {
  it("detects calendar date", () => {
    expect(detectKind("2026-01-15")).toBe("date");
    expect(detectKind("20260115")).toBe("date");
    expect(detectKind("2026-W03-4")).toBe("date");
    expect(detectKind("2026-015")).toBe("date");
  });
  it("detects time", () => {
    expect(detectKind("13:45:30")).toBe("time");
    expect(detectKind("13:45:30Z")).toBe("time");
  });
  it("detects datetime", () => {
    expect(detectKind("2026-01-15T13:45:30Z")).toBe("datetime");
    expect(detectKind("20260115T134530Z")).toBe("datetime");
  });
  it("detects duration", () => {
    expect(detectKind("P1Y2M10DT2H30M")).toBe("duration");
    expect(detectKind("-P1D")).toBe("duration");
  });
  it("detects interval", () => {
    expect(detectKind("2026-01-15/2026-02-20")).toBe("interval");
    expect(detectKind("2026-01-15/P1M")).toBe("interval");
  });
  it("detects recurring", () => {
    expect(detectKind("R5/2026-01-15/P1W")).toBe("recurring");
    expect(detectKind("R/2026-01-15/P1W")).toBe("recurring");
  });
});

describe("iso-8601 parse calendar", () => {
  it("parses YYYY-MM-DD", () => {
    const p = parseIso8601("2026-01-15");
    expect(p.kind).toBe("date");
    expect(p.year).toBe(2026);
    expect(p.month).toBe(1);
    expect(p.day).toBe(15);
    expect(p.basic).toBe(false);
  });
  it("parses YYYYMMDD (basic)", () => {
    const p = parseIso8601("20260115");
    expect(p.year).toBe(2026);
    expect(p.month).toBe(1);
    expect(p.day).toBe(15);
    expect(p.basic).toBe(true);
  });
  it("parses week date", () => {
    const p = parseIso8601("2026-W03-4");
    expect(p.weekYear).toBe(2026);
    expect(p.week).toBe(3);
    expect(p.weekDay).toBe(4);
  });
  it("parses ordinal date", () => {
    const p = parseIso8601("2026-015");
    expect(p.year).toBe(2026);
    expect(p.ordinalDay).toBe(15);
  });
  it("parses year-month", () => {
    const p = parseIso8601("2026-06");
    expect(p.year).toBe(2026);
    expect(p.month).toBe(6);
    expect(p.day).toBeUndefined();
  });
  it("parses year only", () => {
    const p = parseIso8601("2026");
    expect(p.year).toBe(2026);
  });
  it("parses expanded years (lenient)", () => {
    const p1 = parseIso8601("+12026-06-15");
    expect(p1.year).toBe(12026);
    const p2 = parseIso8601("-0050-06-15");
    expect(p2.year).toBe(-50);
  });
  it("rejects expanded years in strict mode when < 5 digits", () => {
    const r = validateIso8601("+2026-06-15", { strict: true });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/at least 5 digits/);
  });
  it("rejects out-of-range month", () => {
    const r = validateIso8601("2026-13-15");
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/Month out of range/);
  });
  it("rejects out-of-range day", () => {
    const r = validateIso8601("2026-02-30");
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/Day .* out of range/);
  });
  it("rejects week 53 in a 52-week year", () => {
    const r = validateIso8601("2025-W53-1");
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/only 52 ISO weeks/);
  });
});

describe("iso-8601 parse time", () => {
  it("parses HH:MM:SS", () => {
    const p = parseIso8601("13:45:30");
    expect(p.kind).toBe("time");
    expect(p.hour).toBe(13);
    expect(p.minute).toBe(45);
    expect(p.second).toBe(30);
  });
  it("parses HH:MM:SS.fff", () => {
    const p = parseIso8601("13:45:30.5");
    expect(p.nanos).toBe(500_000_000);
  });
  it("parses comma decimal (lenient)", () => {
    const p = parseIso8601("13:45:30,5");
    expect(p.nanos).toBe(500_000_000);
  });
  it("rejects comma decimal in strict mode", () => {
    const r = validateIso8601("13:45:30,5", { strict: true });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/Comma decimal separator/);
  });
  it("parses Z offset", () => {
    const p = parseIso8601("13:45:30Z");
    expect(p.offsetMinutes).toBe(0);
  });
  it("parses +HH:MM offset", () => {
    const p = parseIso8601("13:45:30+02:00");
    expect(p.offsetMinutes).toBe(120);
  });
  it("parses -HHMM offset (basic)", () => {
    const p = parseIso8601("13:45:30-0530");
    expect(p.offsetMinutes).toBe(-330);
  });
  it("accepts leap second 23:59:60 in lenient", () => {
    const p = parseIso8601("23:59:60");
    expect(p.second).toBe(60);
  });
  it("rejects leap second in non-23:59 position (strict)", () => {
    const r = validateIso8601("12:34:60", { strict: true });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/Leap second/);
  });
  it("accepts 24:00:00", () => {
    const p = parseIso8601("24:00:00");
    expect(p.hour).toBe(24);
  });
  it("rejects 24:00:01", () => {
    const r = validateIso8601("24:00:01");
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/24:00 is valid only/);
  });
});

describe("iso-8601 parse datetime", () => {
  it("parses full datetime with Z", () => {
    const p = parseIso8601("2026-01-15T13:45:30Z");
    expect(p.kind).toBe("datetime");
    expect(p.year).toBe(2026);
    expect(p.hour).toBe(13);
    expect(p.offsetMinutes).toBe(0);
  });
  it("parses basic datetime", () => {
    const p = parseIso8601("20260115T134530Z");
    expect(p.year).toBe(2026);
    expect(p.hour).toBe(13);
    expect(p.basic).toBe(true);
  });
  it("parses datetime with fractional seconds + offset", () => {
    const p = parseIso8601("2026-01-15T13:45:30.123456789+05:30");
    expect(p.nanos).toBe(123_456_789);
    expect(p.offsetMinutes).toBe(330);
  });
});

describe("iso-8601 parse duration", () => {
  it("parses PnYnMnDTnHnMnS", () => {
    const d = parseDuration("P1Y2M10DT2H30M15S");
    expect(d.years).toBe(1);
    expect(d.months).toBe(2);
    expect(d.days).toBe(10);
    expect(d.hours).toBe(2);
    expect(d.minutes).toBe(30);
    expect(d.seconds).toBe(15);
    expect(d.negative).toBe(false);
  });
  it("parses weeks-only duration", () => {
    const d = parseDuration("P6W");
    expect(d.weeks).toBe(6);
  });
  it("parses time-only duration", () => {
    const d = parseDuration("PT2H30M");
    expect(d.hours).toBe(2);
    expect(d.minutes).toBe(30);
  });
  it("parses negative duration", () => {
    const d = parseDuration("-P1D");
    expect(d.days).toBe(1);
    expect(d.negative).toBe(true);
  });
  it("parses fractional seconds", () => {
    const d = parseDuration("PT0.5S");
    expect(d.seconds).toBe(0);
    expect(d.nanos).toBe(500_000_000);
  });
  it("rejects fractional years in strict mode", () => {
    expect(() => parseDuration("P1.5Y", { strict: true })).toThrow(/Fractional value/);
  });
  it("rejects duration not starting with P", () => {
    expect(() => parseDuration("1Y")).toThrow(/must start with "P"/);
  });
});

describe("iso-8601 parse interval", () => {
  it("parses start/end", () => {
    const p = parseInterval("2026-01-15/2026-02-20");
    expect(p.kind).toBe("interval");
    expect(p.start!.year).toBe(2026);
    expect(p.start!.month).toBe(1);
    expect(p.end!.month).toBe(2);
    expect(p.end!.day).toBe(20);
  });
  it("parses start/duration", () => {
    const p = parseInterval("2026-01-15/P1M");
    expect(p.start!.year).toBe(2026);
    expect(p.end!.kind).toBe("duration");
    expect(p.end!.duration!.months).toBe(1);
  });
  it("parses duration/end", () => {
    const p = parseInterval("P1M/2026-02-15");
    expect(p.start!.kind).toBe("duration");
    expect(p.end!.year).toBe(2026);
  });
  it("rejects interval without slash", () => {
    expect(() => parseInterval("2026-01-15")).toThrow(/must contain "\/"/);
  });
});

describe("iso-8601 parse recurring", () => {
  it("parses R5/start/duration", () => {
    const p = parseRecurring("R5/2026-01-15/P1W");
    expect(p.kind).toBe("recurring");
    expect(p.count).toBe(5);
    expect(p.start!.year).toBe(2026);
    expect(p.duration!.weeks).toBe(1);
  });
  it("parses R/ for unbounded", () => {
    const p = parseRecurring("R/2026-01-15/P1W");
    expect(p.count).toBe(Infinity);
  });
  it("rejects count < 1", () => {
    expect(() => parseRecurring("R0/2026-01-15/P1W")).toThrow(/>= 1/);
  });
  it("rejects missing duration", () => {
    expect(() => parseRecurring("R5/2026-01-15/2026-02-15")).toThrow(/must end with a duration/);
  });
});

describe("iso-8601 validate", () => {
  it("returns valid for good input", () => {
    const r = validateIso8601("2026-01-15T13:45:30Z");
    expect(r.valid).toBe(true);
    expect(r.kind).toBe("datetime");
  });
  it("returns error for bad input", () => {
    const r = validateIso8601("not-a-date");
    expect(r.valid).toBe(false);
    expect(r.error).toBeTruthy();
  });
});

describe("iso-8601 formatting", () => {
  it("formatCalendarDate extended and basic", () => {
    const p = parseIso8601("2026-01-15");
    expect(formatCalendarDate(p)).toBe("2026-01-15");
    expect(formatCalendarDate(p, { basic: true })).toBe("20260115");
  });
  it("formatWeekDate from calendar date", () => {
    const p = parseIso8601("2026-01-15");
    expect(formatWeekDate(p)).toBe("2026-W03-4");
  });
  it("formatOrdinalDate from calendar date", () => {
    const p = parseIso8601("2026-01-15");
    expect(formatOrdinalDate(p)).toBe("2026-015");
  });
  it("formatTime with offset", () => {
    const p = parseIso8601("13:45:30+02:00");
    expect(formatTime(p)).toBe("13:45:30+02:00");
  });
  it("formatTime Z for UTC", () => {
    const p = parseIso8601("13:45:30Z");
    expect(formatTime(p)).toBe("13:45:30Z");
  });
  it("formatTime with fractional seconds", () => {
    const p = parseIso8601("13:45:30.5");
    expect(formatTime(p)).toBe("13:45:30.5");
  });
  it("formatDateTime", () => {
    const p = parseIso8601("2026-01-15T13:45:30Z");
    expect(formatDateTime(p)).toBe("2026-01-15T13:45:30Z");
  });
  it("formatDuration round-trip", () => {
    const d = parseDuration("P1Y2M10DT2H30M15S");
    expect(formatDuration(d)).toBe("P1Y2M10DT2H30M15S");
  });
  it("formatDuration negative", () => {
    const d = parseDuration("-P1D");
    expect(formatDuration(d)).toBe("-P1D");
  });
  it("formatInterval", () => {
    const p = parseInterval("2026-01-15/2026-02-20");
    expect(formatInterval(p.start!, p.end!)).toBe("2026-01-15/2026-02-20");
  });
  it("formatRecurring", () => {
    const p = parseRecurring("R5/2026-01-15/P1W");
    expect(formatRecurring(p.count!, p.start!, p.duration!)).toBe("R5/2026-01-15/P1W");
  });
  it("formatRecurring unbounded", () => {
    const p = parseRecurring("R/2026-01-15/P1W");
    expect(formatRecurring(p.count!, p.start!, p.duration!)).toBe("R/2026-01-15/P1W");
  });
});

describe("iso-8601 formatAll", () => {
  it("returns every variant for a datetime", () => {
    const p = parseIso8601("2026-01-15T13:45:30Z");
    const all = formatAll(p);
    expect(all.calendar).toBe("2026-01-15T13:45:30Z");
    expect(all.calendarBasic).toBe("20260115T134530Z");
    expect(all.week).toBe("2026-W03-4T13:45:30Z");
    expect(all.ordinal).toBe("2026-015T13:45:30Z");
    expect(all.dateTimeUtc).toBe("2026-01-15T13:45:30Z");
    expect(all.dateOnly).toBe("2026-01-15");
  });
  it("date-only returns just date for date variants", () => {
    const p = parseIso8601("2026-01-15");
    const all = formatAll(p);
    expect(all.calendar).toBe("2026-01-15");
    expect(all.time).toBe("");
    expect(all.dateOnly).toBe("2026-01-15");
  });
});

describe("iso-8601 toMs / fromMs", () => {
  it("round-trips UTC datetime", () => {
    const p = parseIso8601("2026-01-15T13:45:30Z");
    const ms = toMs(p);
    expect(new Date(ms).toISOString()).toBe("2026-01-15T13:45:30.000Z");
    const back = fromMs(ms, { offsetMinutes: 0 });
    expect(back.year).toBe(2026);
    expect(back.hour).toBe(13);
  });
  it("applies offset correctly", () => {
    const p = parseIso8601("2026-01-15T13:45:30+02:00");
    const ms = toMs(p);
    expect(new Date(ms).toISOString()).toBe("2026-01-15T11:45:30.000Z");
  });
  it("handles 24:00:00", () => {
    const p = parseIso8601("2026-01-15T24:00:00Z");
    const ms = toMs(p);
    expect(new Date(ms).toISOString()).toBe("2026-01-16T00:00:00.000Z");
  });
  it("clamps leap second to 59", () => {
    const p = parseIso8601("2016-12-31T23:59:60Z");
    const ms = toMs(p);
    expect(new Date(ms).toISOString()).toBe("2016-12-31T23:59:59.000Z");
  });
  it("throws for duration kind", () => {
    const p = parseIso8601("P1D");
    expect(() => toMs(p)).toThrow(/only defined for/);
  });
});

describe("iso-8601 duration arithmetic", () => {
  it("durationToSeconds", () => {
    expect(durationToSeconds(parseDuration("PT2H"))).toBe(7200);
    expect(durationToSeconds(parseDuration("P1D"))).toBe(86400);
    expect(durationToSeconds(parseDuration("PT1M30S"))).toBe(90);
  });
  it("normalizeDuration carries overflow", () => {
    const d = normalizeDuration({
      years: 0, months: 0, weeks: 0, days: 0,
      hours: 25, minutes: 70, seconds: 65, nanos: 0, negative: false,
    });
    expect(d.days).toBe(1);
    expect(d.hours).toBe(2);
    expect(d.minutes).toBe(11);
    expect(d.seconds).toBe(5);
  });
  it("addDuration with hours", () => {
    const p = parseIso8601("2026-01-15T13:00:00Z");
    const r = addDuration(p, parseDuration("PT2H"));
    expect(r.hour).toBe(15);
  });
  it("addDuration with days", () => {
    const p = parseIso8601("2026-01-15T13:00:00Z");
    const r = addDuration(p, parseDuration("P1D"));
    expect(r.day).toBe(16);
    expect(r.hour).toBe(13);
  });
  it("addDuration with months clamps to month end", () => {
    const p = parseIso8601("2026-01-31");
    const r = addDuration(p, parseDuration("P1M"));
    expect(r.month).toBe(2);
    expect(r.day).toBe(28); // 2026 is not leap
  });
  it("subtractDuration", () => {
    const p = parseIso8601("2026-01-15T13:00:00Z");
    const r = subtractDuration(p, parseDuration("PT2H"));
    expect(r.hour).toBe(11);
  });
});

describe("iso-8601 getComponents", () => {
  it("returns all views for calendar date", () => {
    const p = parseIso8601("2026-01-15T13:45:30Z");
    const c = getComponents(p);
    expect(c.calendar).toEqual({ year: 2026, month: 1, day: 15 });
    expect(c.week).toEqual({ weekYear: 2026, week: 3, weekDay: 4 });
    expect(c.ordinal).toEqual({ year: 2026, ordinalDay: 15 });
    expect(c.time).toEqual({ hour: 13, minute: 45, second: 30, nanos: 0 });
    expect(c.offset).toEqual({ minutes: 0, label: "Z" });
    expect(c.weekday).toBe("Thursday");
  });
  it("returns null views for date-only input", () => {
    const p = parseIso8601("2026-01-15");
    const c = getComponents(p);
    expect(c.time).toBeNull();
    expect(c.offset).toBeNull();
  });
});

describe("iso-8601 explain", () => {
  it("explains a datetime", () => {
    const p = parseIso8601("2026-01-15T13:45:30Z");
    const e = explain(p);
    expect(e).toContain("2026-01-15");
    expect(e).toContain("ISO week 2026-W03-4");
    expect(e).toContain("ordinal 2026-015");
    expect(e).toContain("UTCZ");
  });
  it("explains a duration", () => {
    const e = explain(parseIso8601("P1Y2M10DT2H30M15S"));
    expect(e).toContain("duration of");
    expect(e).toContain("1 year");
    expect(e).toContain("2 months");
  });
  it("explains an interval", () => {
    const e = explain(parseIso8601("2026-01-15/2026-02-20"));
    expect(e).toContain("Interval from");
  });
  it("explains a recurring interval", () => {
    const e = explain(parseIso8601("R5/2026-01-15/P1W"));
    expect(e).toContain("Repeats 5×");
  });
});

describe("iso-8601 codeSnippets", () => {
  it("returns snippets for datetime", () => {
    const p = parseIso8601("2026-01-15T13:45:30Z");
    const s = codeSnippets(p);
    expect(s.js).toContain("new Date");
    expect(s.python).toContain("datetime");
    expect(s.java).toContain("Instant");
    expect(s.go).toContain("time.Parse");
  });
  it("returns snippets for duration", () => {
    const s = codeSnippets(parseIso8601("P1Y2M10DT2H30M"));
    expect(s.js).toContain("Temporal.Duration");
    expect(s.python).toContain("isodate");
  });
  it("returns snippets for interval", () => {
    const s = codeSnippets(parseIso8601("2026-01-15/2026-02-20"));
    expect(s.js).toContain("until");
    expect(s.java).toContain("Duration.between");
  });
});

describe("iso-8601 history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, kind: "date", strict: false, inputLength: 10, preview: "2026-01-15" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, kind: "date", strict: false, inputLength: 5, preview: `in-${i}` });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, kind: "date", strict: false, inputLength: 5, preview: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("iso-8601 shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("2026-01-15", true);
    expect(url).toContain("i=2026-01-15");
    expect(url).toContain("strict=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("i=2026-01-15&strict=1");
    expect(p.input).toBe("2026-01-15");
    expect(p.strict).toBe(true);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ input: "", strict: false });
  });
  it("round-trips", () => {
    const url = buildShareUrl("P1Y2M10DT2H30M", false);
    const p = parseShareUrl(url.startsWith("?") ? url.slice(1) : url.split("#")[1] ?? "");
    expect(p.input).toBe("P1Y2M10DT2H30M");
    expect(p.strict).toBe(false);
  });
});

describe("iso-8601 round trips (spec acceptance)", () => {
  it("round-trips calendar date", () => {
    const p = parseIso8601("2026-01-15");
    expect(formatDateTime(p)).toBe("2026-01-15");
  });
  it("round-trips week date", () => {
    const p = parseIso8601("2026-W03-4");
    expect(formatWeekDate(p)).toBe("2026-W03-4");
  });
  it("round-trips ordinal date", () => {
    const p = parseIso8601("2026-015");
    expect(formatOrdinalDate(p)).toBe("2026-015");
  });
  it("round-trips datetime with offset", () => {
    const p = parseIso8601("2026-01-15T13:45:30+02:00");
    expect(formatDateTime(p)).toBe("2026-01-15T13:45:30+02:00");
  });
  it("round-trips duration", () => {
    const p = parseDuration("P1Y2M10DT2H30M15S");
    expect(formatDuration(p)).toBe("P1Y2M10DT2H30M15S");
  });
  it("round-trips interval", () => {
    const p = parseInterval("2026-01-15/2026-02-20");
    expect(formatInterval(p.start!, p.end!)).toBe("2026-01-15/2026-02-20");
  });
  it("round-trips recurring", () => {
    const p = parseRecurring("R5/2026-01-15/P1W");
    expect(formatRecurring(p.count!, p.start!, p.duration!)).toBe("R5/2026-01-15/P1W");
  });
});

// Suppress unused-import lint
export type _Unused = IsoKind;

import { describe, it, expect, beforeEach } from "vitest";
import {
  FREQS,
  WEEKDAYS,
  WKST_OPTIONS,
  COMMON_PRESETS,
  pad2,
  pad4,
  isLeapYear,
  daysInMonth,
  daysInYear,
  weekdayToNumber,
  numberToWeekday,
  jsDayToIso,
  isoToJsDay,
  formatIsoDate,
  formatIsoDateTime,
  parseRruleDateValue,
  toDateIso,
  toDateTimeIso,
  compareIsoDates,
  addPeriod,
  periodStart,
  getIsoWeek,
  getDayOfYear,
  parseByDay,
  serializeByDay,
  parseNumberList,
  serializeNumberList,
  parseDateList,
  parseRRuleString,
  serializeRRule,
  serializeUntil,
  parseFullRule,
  parseFullRuleSafe,
  serializeFullRule,
  validateRRule,
  generateOccurrences,
  nextOccurrence,
  applyBySetPos,
  getIsoWeeksInYear,
  toHumanReadable,
  generateIcs,
  generateCodeSnippet,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  defaultParsedRule,
  type ParsedRule,
  type RRule,
  type Freq,
  type Weekday,
  type ByDayEntry,
  type CodeLang,
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

describe("rrule constants", () => {
  it("has 7 frequencies", () => {
    expect(FREQS).toHaveLength(7);
    expect(FREQS.map((f) => f.value)).toEqual(["SECONDLY", "MINUTELY", "HOURLY", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"]);
  });
  it("has 7 weekdays", () => {
    expect(WEEKDAYS).toHaveLength(7);
    expect(WEEKDAYS[0].value).toBe("MO");
    expect(WEEKDAYS[6].value).toBe("SU");
  });
  it("has WKST options", () => {
    expect(WKST_OPTIONS).toHaveLength(7);
  });
  it("has at least 10 common presets", () => {
    expect(COMMON_PRESETS.length).toBeGreaterThanOrEqual(10);
    expect(COMMON_PRESETS[0].rrule).toMatch(/^FREQ=/);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe("rrule helpers", () => {
  it("pad2 pads to 2 digits", () => {
    expect(pad2(3)).toBe("03");
    expect(pad2(12)).toBe("12");
  });
  it("pad4 pads to 4 digits", () => {
    expect(pad4(126)).toBe("0126");
    expect(pad4(12026)).toBe("12026");
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
  });
  it("daysInYear is 366 for leap year", () => {
    expect(daysInYear(2024)).toBe(366);
    expect(daysInYear(2025)).toBe(365);
  });
  it("weekdayToNumber maps MO=1..SU=7", () => {
    expect(weekdayToNumber("MO")).toBe(1);
    expect(weekdayToNumber("FR")).toBe(5);
    expect(weekdayToNumber("SU")).toBe(7);
  });
  it("numberToWeekday is inverse of weekdayToNumber", () => {
    for (let i = 1; i <= 7; i++) {
      expect(weekdayToNumber(numberToWeekday(i))).toBe(i);
    }
  });
  it("jsDayToIso converts Sun=0→7", () => {
    expect(jsDayToIso(0)).toBe(7);
    expect(jsDayToIso(1)).toBe(1);
  });
  it("isoToJsDay is inverse of jsDayToIso", () => {
    for (let i = 0; i < 7; i++) {
      expect(isoToJsDay(jsDayToIso(i))).toBe(i);
    }
  });
  it("formatIsoDate pads", () => {
    expect(formatIsoDate(2025, 3, 7)).toBe("2025-03-07");
  });
  it("formatIsoDateTime supports Z suffix", () => {
    expect(formatIsoDateTime(2025, 3, 7, 9, 30, 0, true)).toBe("2025-03-07T09:30:00Z");
    expect(formatIsoDateTime(2025, 3, 7, 9, 30, 0, false)).toBe("2025-03-07T09:30:00");
  });
  it("parseRruleDateValue parses date-only", () => {
    const r = parseRruleDateValue("2025-03-07");
    expect(r).not.toBeNull();
    expect(r!.isDateOnly).toBe(true);
    expect(r!.date.getUTCFullYear()).toBe(2025);
  });
  it("parseRruleDateValue parses datetime with Z", () => {
    const r = parseRruleDateValue("2025-03-07T09:30:00Z");
    expect(r).not.toBeNull();
    expect(r!.isDateOnly).toBe(false);
    expect(r!.date.getUTCHours()).toBe(9);
  });
  it("parseRruleDateValue rejects invalid dates", () => {
    expect(parseRruleDateValue("2025-13-01")).toBeNull();
    expect(parseRruleDateValue("not-a-date")).toBeNull();
  });
  it("compareIsoDates is correct", () => {
    expect(compareIsoDates("2025-01-01", "2025-01-02")).toBeLessThan(0);
    expect(compareIsoDates("2025-01-02", "2025-01-01")).toBeGreaterThan(0);
    expect(compareIsoDates("2025-01-01", "2025-01-01")).toBe(0);
  });
  it("addPeriod adds days/months/years", () => {
    const d = new Date(Date.UTC(2025, 0, 1));
    expect(toDateIso(addPeriod(d, "DAILY", 7))).toBe("2025-01-08");
    expect(toDateIso(addPeriod(d, "MONTHLY", 1))).toBe("2025-02-01");
    expect(toDateIso(addPeriod(d, "YEARLY", 1))).toBe("2026-01-01");
    expect(toDateIso(addPeriod(d, "WEEKLY", 2))).toBe("2025-01-15");
  });
  it("periodStart returns Monday for WEEKLY", () => {
    // 2026-01-15 is Thursday. Monday-start week begins 2026-01-12.
    const d = new Date(Date.UTC(2026, 0, 15));
    const p = periodStart(d, "WEEKLY", "MO");
    expect(toDateIso(p)).toBe("2026-01-12");
  });
  it("periodStart returns Sunday for WEEKLY with WKST=SU", () => {
    // 2026-01-15 is Thursday. Sunday-start week begins 2026-01-11.
    const d = new Date(Date.UTC(2026, 0, 15));
    const p = periodStart(d, "WEEKLY", "SU");
    expect(toDateIso(p)).toBe("2026-01-11");
  });
  it("periodStart returns first-of-month for MONTHLY", () => {
    const d = new Date(Date.UTC(2026, 5, 15));
    expect(toDateIso(periodStart(d, "MONTHLY", "MO"))).toBe("2026-06-01");
  });
  it("periodStart returns Jan 1 for YEARLY", () => {
    const d = new Date(Date.UTC(2026, 5, 15));
    expect(toDateIso(periodStart(d, "YEARLY", "MO"))).toBe("2026-01-01");
  });
  it("getIsoWeek matches known values", () => {
    expect(getIsoWeek(2026, 1, 1).week).toBe(1);
    expect(getIsoWeek(2025, 12, 29).week).toBe(1);
    expect(getIsoWeek(2025, 12, 29).weekYear).toBe(2026);
  });
  it("getDayOfYear is correct", () => {
    expect(getDayOfYear(2025, 1, 1)).toBe(1);
    expect(getDayOfYear(2025, 12, 31)).toBe(365);
    expect(getDayOfYear(2024, 12, 31)).toBe(366);
  });
  it("getIsoWeeksInYear returns 52 or 53", () => {
    expect(getIsoWeeksInYear(2020)).toBe(53);
    expect(getIsoWeeksInYear(2025)).toBe(52);
    expect(getIsoWeeksInYear(2026)).toBe(53);
  });
});

// ---------------------------------------------------------------------------
// BYDAY parsing & serialization
// ---------------------------------------------------------------------------

describe("rrule byday parsing", () => {
  it("parses simple weekdays", () => {
    const r = parseByDay(["MO", "WE", "FR"]);
    expect(r).toEqual([
      { weekday: "MO" },
      { weekday: "WE" },
      { weekday: "FR" },
    ]);
  });
  it("parses ordinals", () => {
    const r = parseByDay(["1MO", "-1FR", "3WE"]);
    expect(r).toEqual([
      { ordinal: 1, weekday: "MO" },
      { ordinal: -1, weekday: "FR" },
      { ordinal: 3, weekday: "WE" },
    ]);
  });
  it("rejects ordinal 0", () => {
    const r = parseByDay(["0MO"]);
    expect(r).toEqual([]);
  });
  it("rejects invalid weekday", () => {
    const r = parseByDay(["XY"]);
    expect(r).toEqual([]);
  });
  it("serializes back to string", () => {
    expect(serializeByDay([{ weekday: "MO" }, { weekday: "FR" }])).toBe("MO,FR");
    expect(serializeByDay([{ ordinal: -1, weekday: "FR" }])).toBe("-1FR");
  });
});

describe("rrule number list parsing", () => {
  it("parses positive and negative numbers", () => {
    expect(parseNumberList(["1", "-1", "15", "-31"])).toEqual([1, -1, 15, -31]);
  });
  it("rejects non-numeric values", () => {
    expect(parseNumberList(["abc", "5"])).toEqual([5]);
  });
  it("serializes back to string", () => {
    expect(serializeNumberList([1, -1, 15])).toBe("1,-1,15");
  });
});

describe("rrule date list parsing", () => {
  it("parses YYYYMMDD", () => {
    expect(parseDateList(["20260115"])).toEqual(["2026-01-15"]);
  });
  it("parses YYYY-MM-DD", () => {
    expect(parseDateList(["2026-01-15"])).toEqual(["2026-01-15"]);
  });
  it("parses YYYYMMDDTHHMMSSZ", () => {
    expect(parseDateList(["20260115T093000Z"])).toEqual(["2026-01-15T09:30:00Z"]);
  });
  it("rejects invalid dates", () => {
    expect(parseDateList(["20261301"])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// RRULE parsing & serialization
// ---------------------------------------------------------------------------

describe("rrule parseRRuleString", () => {
  it("parses basic FREQ", () => {
    const r = parseRRuleString("FREQ=DAILY");
    expect(r.freq).toBe("DAILY");
  });
  it("parses INTERVAL", () => {
    const r = parseRRuleString("FREQ=WEEKLY;INTERVAL=2");
    expect(r.freq).toBe("WEEKLY");
    expect(r.interval).toBe(2);
  });
  it("parses COUNT", () => {
    const r = parseRRuleString("FREQ=DAILY;COUNT=10");
    expect(r.count).toBe(10);
  });
  it("parses UNTIL (date)", () => {
    const r = parseRRuleString("FREQ=DAILY;UNTIL=20261231");
    expect(r.until).toBe("2026-12-31");
  });
  it("parses UNTIL (datetime)", () => {
    const r = parseRRuleString("FREQ=DAILY;UNTIL=20261231T235959Z");
    expect(r.until).toBe("2026-12-31T23:59:59Z");
  });
  it("parses BYDAY with ordinals", () => {
    const r = parseRRuleString("FREQ=MONTHLY;BYDAY=-1FR");
    expect(r.byDay).toEqual([{ ordinal: -1, weekday: "FR" }]);
  });
  it("parses BYDAY multiple", () => {
    const r = parseRRuleString("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
    expect(r.byDay).toHaveLength(5);
    expect(r.byDay![0].weekday).toBe("MO");
  });
  it("parses BYMONTH and BYMONTHDAY", () => {
    const r = parseRRuleString("FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1");
    expect(r.byMonth).toEqual([1]);
    expect(r.byMonthDay).toEqual([1]);
  });
  it("parses BYSETPOS", () => {
    const r = parseRRuleString("FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1");
    expect(r.bySetPos).toEqual([-1]);
  });
  it("parses WKST", () => {
    const r = parseRRuleString("FREQ=WEEKLY;BYDAY=MO;WKST=SU");
    expect(r.wkst).toBe("SU");
  });
  it("parses BYWEEKNO and BYYEARDAY", () => {
    const r = parseRRuleString("FREQ=YEARLY;BYWEEKNO=1;BYYEARDAY=1");
    expect(r.byWeekNo).toEqual([1]);
    expect(r.byYearDay).toEqual([1]);
  });
  it("parses BYHOUR/BYMINUTE/BYSECOND", () => {
    const r = parseRRuleString("FREQ=DAILY;BYHOUR=9,10;BYMINUTE=30;BYSECOND=0");
    expect(r.byHour).toEqual([9, 10]);
    expect(r.byMinute).toEqual([30]);
    expect(r.bySecond).toEqual([0]);
  });
  it("throws for invalid FREQ", () => {
    expect(() => parseRRuleString("FREQ=BOGUS")).toThrow();
  });
  it("throws for missing FREQ", () => {
    expect(() => parseRRuleString("INTERVAL=2")).toThrow();
  });
  it("throws for invalid INTERVAL", () => {
    expect(() => parseRRuleString("FREQ=DAILY;INTERVAL=0")).toThrow();
  });
  it("ignores unknown properties", () => {
    const r = parseRRuleString("FREQ=DAILY;UNKNOWN=X");
    expect(r.freq).toBe("DAILY");
  });
});

describe("rrule serializeRRule", () => {
  it("serializes basic rule", () => {
    expect(serializeRRule({ freq: "DAILY" })).toBe("FREQ=DAILY");
  });
  it("serializes all properties", () => {
    const r: RRule = {
      freq: "WEEKLY",
      interval: 2,
      count: 10,
      byDay: [{ weekday: "MO" }, { weekday: "FR" }],
      byMonth: [1, 7],
      wkst: "MO",
    };
    const s = serializeRRule(r);
    expect(s).toContain("FREQ=WEEKLY");
    expect(s).toContain("INTERVAL=2");
    expect(s).toContain("COUNT=10");
    expect(s).toContain("BYDAY=MO,FR");
    expect(s).toContain("BYMONTH=1,7");
    expect(s).toContain("WKST=MO");
  });
  it("serializes UNTIL as compact form", () => {
    const r: RRule = { freq: "DAILY", until: "2026-12-31" };
    expect(serializeRRule(r)).toContain("UNTIL=20261231");
  });
  it("serializes datetime UNTIL with Z", () => {
    const r: RRule = { freq: "DAILY", until: "2026-12-31T23:59:59Z" };
    expect(serializeRRule(r)).toContain("UNTIL=20261231T235959Z");
  });
  it("round-trips a complex rule", () => {
    // RFC 5545 canonical order: FREQ, UNTIL, COUNT, INTERVAL, BYSECOND, BYMINUTE,
    // BYHOUR, BYDAY, BYMONTHDAY, BYYEARDAY, BYWEEKNO, BYMONTH, BYSETPOS, WKST.
    const s = "FREQ=MONTHLY;COUNT=12;INTERVAL=1;BYDAY=-1FR";
    const r = parseRRuleString(s);
    expect(serializeRRule(r)).toBe(s);
  });
});

describe("rrule serializeUntil", () => {
  it("serializes date-only as YYYYMMDD", () => {
    expect(serializeUntil("2026-12-31", { freq: "DAILY" })).toBe("20261231");
  });
  it("serializes datetime as YYYYMMDDTHHMMSSZ", () => {
    expect(serializeUntil("2026-12-31T23:59:59Z", { freq: "DAILY" })).toBe("20261231T235959Z");
  });
});

// ---------------------------------------------------------------------------
// Full rule parsing (DTSTART + RRULE + EXDATE + RDATE)
// ---------------------------------------------------------------------------

describe("rrule parseFullRule", () => {
  it("parses DTSTART + RRULE", () => {
    const input = "DTSTART;VALUE=DATE:20260101\nRRULE:FREQ=DAILY;COUNT=3";
    const p = parseFullRule(input);
    expect(p.dtStart?.value).toBe("2026-01-01");
    expect(p.dtStart?.isDateOnly).toBe(true);
    expect(p.rrule.freq).toBe("DAILY");
    expect(p.rrule.count).toBe(3);
  });
  it("parses datetime DTSTART with TZID", () => {
    const input = "DTSTART;TZID=America/New_York:20260101T093000\nRRULE:FREQ=DAILY;COUNT=3";
    const p = parseFullRule(input);
    expect(p.dtStart?.tzid).toBe("America/New_York");
    expect(p.dtStart?.isDateOnly).toBe(false);
  });
  it("parses EXDATE", () => {
    const input = "DTSTART;VALUE=DATE:20260101\nRRULE:FREQ=DAILY;COUNT=10\nEXDATE:20260102,20260103";
    const p = parseFullRule(input);
    expect(p.exDates).toEqual(["2026-01-02", "2026-01-03"]);
  });
  it("parses RDATE", () => {
    const input = "DTSTART;VALUE=DATE:20260101\nRRULE:FREQ=DAILY;COUNT=3\nRDATE:20260105";
    const p = parseFullRule(input);
    expect(p.rDates).toEqual(["2026-01-05"]);
  });
  it("parses bare RRULE without DTSTART", () => {
    const p = parseFullRule("FREQ=DAILY;COUNT=3");
    expect(p.rrule.freq).toBe("DAILY");
    expect(p.dtStart).toBeUndefined();
  });
  it("handles line folding", () => {
    const input = "DTSTART;VALUE=DATE:20260101\r\nRRULE:FREQ=DAILY;\r\n COUNT=3";
    const p = parseFullRule(input);
    expect(p.rrule.count).toBe(3);
  });
  it("throws when no RRULE", () => {
    expect(() => parseFullRule("DTSTART:20260101")).toThrow();
  });
  it("parseFullRuleSafe returns error", () => {
    const r = parseFullRuleSafe("not a rule");
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });
});

describe("rrule serializeFullRule", () => {
  it("serializes date-only DTSTART", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY", count: 3 },
    };
    const s = serializeFullRule(p);
    expect(s).toContain("DTSTART;VALUE=DATE:20260101");
    expect(s).toContain("RRULE:FREQ=DAILY;COUNT=3");
  });
  it("serializes datetime DTSTART with TZID", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01T09:30:00Z", isDateOnly: false, tzid: "America/New_York" },
      rrule: { freq: "DAILY", count: 3 },
    };
    const s = serializeFullRule(p);
    expect(s).toContain("DTSTART;TZID=America/New_York:");
  });
  it("serializes EXDATE and RDATE", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY", count: 5 },
      exDates: ["2026-01-02"],
      rDates: ["2026-01-10"],
    };
    const s = serializeFullRule(p);
    expect(s).toContain("EXDATE:20260102");
    expect(s).toContain("RDATE:20260110");
  });
  it("round-trips through parse", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "WEEKLY", interval: 2, byDay: [{ weekday: "MO" }], count: 10 },
    };
    const s = serializeFullRule(p);
    const parsed = parseFullRule(s);
    expect(parsed.dtStart?.value).toBe("2026-01-01");
    expect(parsed.rrule.freq).toBe("WEEKLY");
    expect(parsed.rrule.interval).toBe(2);
    expect(parsed.rrule.count).toBe(10);
    expect(parsed.rrule.byDay).toEqual([{ weekday: "MO" }]);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("rrule validateRRule", () => {
  it("accepts valid rule", () => {
    const v = validateRRule({ rrule: { freq: "DAILY" }, dtStart: { value: "2026-01-01", isDateOnly: true } });
    expect(v.valid).toBe(true);
  });
  it("rejects COUNT and UNTIL together", () => {
    const v = validateRRule({
      rrule: { freq: "DAILY", count: 10, until: "2026-12-31" },
      dtStart: { value: "2026-01-01", isDateOnly: true },
    });
    expect(v.valid).toBe(false);
    expect(v.error).toMatch(/mutually exclusive/i);
  });
  it("rejects invalid INTERVAL", () => {
    const v = validateRRule({ rrule: { freq: "DAILY", interval: 0 } });
    expect(v.valid).toBe(false);
  });
  it("rejects invalid COUNT", () => {
    const v = validateRRule({ rrule: { freq: "DAILY", count: 0 } });
    expect(v.valid).toBe(false);
  });
  it("rejects UNTIL before DTSTART", () => {
    const v = validateRRule({
      rrule: { freq: "DAILY", until: "2025-12-31" },
      dtStart: { value: "2026-01-01", isDateOnly: true },
    });
    expect(v.valid).toBe(false);
  });
  it("rejects invalid BYMONTH", () => {
    const v = validateRRule({ rrule: { freq: "YEARLY", byMonth: [13] } });
    expect(v.valid).toBe(false);
  });
  it("rejects invalid BYHOUR", () => {
    const v = validateRRule({ rrule: { freq: "DAILY", byHour: [24] } });
    expect(v.valid).toBe(false);
  });
  it("rejects invalid BYMONTHDAY", () => {
    const v = validateRRule({ rrule: { freq: "MONTHLY", byMonthDay: [0] } });
    expect(v.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Occurrence generation
// ---------------------------------------------------------------------------

describe("rrule generateOccurrences daily", () => {
  it("generates daily for 5 days", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY", count: 5 },
    };
    const occ = generateOccurrences(p);
    expect(occ).toEqual([
      "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05",
    ]);
  });
  it("generates daily with INTERVAL=2", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY", interval: 2, count: 3 },
    };
    const occ = generateOccurrences(p);
    expect(occ).toEqual(["2026-01-01", "2026-01-03", "2026-01-05"]);
  });
});

describe("rrule generateOccurrences weekly", () => {
  it("generates weekly on Monday", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-05", isDateOnly: true }, // Monday
      rrule: { freq: "WEEKLY", byDay: [{ weekday: "MO" }], count: 3 },
    };
    const occ = generateOccurrences(p);
    expect(occ).toEqual(["2026-01-05", "2026-01-12", "2026-01-19"]);
  });
  it("generates every weekday (Mon-Fri)", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-05", isDateOnly: true }, // Monday
      rrule: {
        freq: "WEEKLY",
        byDay: [
          { weekday: "MO" }, { weekday: "TU" }, { weekday: "WE" },
          { weekday: "TH" }, { weekday: "FR" },
        ],
        count: 5,
      },
    };
    const occ = generateOccurrences(p);
    expect(occ).toEqual([
      "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09",
    ]);
  });
  it("generates bi-weekly with INTERVAL=2", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-05", isDateOnly: true }, // Monday
      rrule: { freq: "WEEKLY", interval: 2, byDay: [{ weekday: "MO" }], count: 3 },
    };
    const occ = generateOccurrences(p);
    expect(occ).toEqual(["2026-01-05", "2026-01-19", "2026-02-02"]);
  });
});

describe("rrule generateOccurrences monthly", () => {
  it("generates monthly on day 15", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-15", isDateOnly: true },
      rrule: { freq: "MONTHLY", byMonthDay: [15], count: 4 },
    };
    const occ = generateOccurrences(p);
    expect(occ).toEqual([
      "2026-01-15", "2026-02-15", "2026-03-15", "2026-04-15",
    ]);
  });
  it("generates last Friday of each month", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-30", isDateOnly: true }, // Last Friday of Jan 2026 is Jan 30
      rrule: { freq: "MONTHLY", byDay: [{ ordinal: -1, weekday: "FR" }], count: 3 },
    };
    const occ = generateOccurrences(p);
    expect(occ).toEqual([
      "2026-01-30", // last Fri Jan
      "2026-02-27", // last Fri Feb
      "2026-03-27", // last Fri Mar
    ]);
  });
  it("generates first Monday of each month", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-05", isDateOnly: true }, // First Monday of Jan 2026
      rrule: { freq: "MONTHLY", byDay: [{ ordinal: 1, weekday: "MO" }], count: 3 },
    };
    const occ = generateOccurrences(p);
    expect(occ).toEqual([
      "2026-01-05",
      "2026-02-02",
      "2026-03-02",
    ]);
  });
  it("generates with BYSETPOS=-1 (last weekday of month)", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-30", isDateOnly: true },
      rrule: {
        freq: "MONTHLY",
        byDay: [
          { weekday: "MO" }, { weekday: "TU" }, { weekday: "WE" },
          { weekday: "TH" }, { weekday: "FR" },
        ],
        bySetPos: [-1],
        count: 2,
      },
    };
    const occ = generateOccurrences(p);
    expect(occ).toEqual([
      "2026-01-30", // Last weekday of Jan 2026 is Fri Jan 30
      "2026-02-27", // Last weekday of Feb 2026 is Fri Feb 27
    ]);
  });
  it("skips non-existent BYMONTHDAY (Feb 30)", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-30", isDateOnly: true },
      rrule: { freq: "MONTHLY", byMonthDay: [30], count: 3 },
    };
    const occ = generateOccurrences(p);
    expect(occ).toEqual([
      "2026-01-30", "2026-03-30", "2026-04-30",
    ]); // Feb skipped
  });
});

describe("rrule generateOccurrences yearly", () => {
  it("generates yearly on Jan 1", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "YEARLY", byMonth: [1], byMonthDay: [1], count: 3 },
    };
    const occ = generateOccurrences(p);
    expect(occ).toEqual(["2026-01-01", "2027-01-01", "2028-01-01"]);
  });
  it("Feb 29 yearly skips non-leap years", () => {
    const p: ParsedRule = {
      dtStart: { value: "2024-02-29", isDateOnly: true }, // 2024 is leap
      rrule: { freq: "YEARLY", byMonth: [2], byMonthDay: [29], count: 3 },
    };
    const occ = generateOccurrences(p);
    expect(occ).toEqual([
      "2024-02-29",
      "2028-02-29", // 2025/26/27 are not leap
      "2032-02-29",
    ]);
  });
});

describe("rrule generateOccurrences with COUNT and UNTIL", () => {
  it("respects COUNT limit", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY", count: 7 },
    };
    expect(generateOccurrences(p)).toHaveLength(7);
  });
  it("respects UNTIL limit (date)", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY", until: "2026-01-05" },
    };
    const occ = generateOccurrences(p);
    expect(occ).toEqual(["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"]);
  });
  it("UNTIL is inclusive", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY", until: "2026-01-03" },
    };
    expect(generateOccurrences(p)).toHaveLength(3);
  });
});

describe("rrule generateOccurrences with EXDATE and RDATE", () => {
  it("excludes EXDATE entries (COUNT counts only emitted occurrences)", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY", count: 5 },
      exDates: ["2026-01-02", "2026-01-04"],
    };
    const occ = generateOccurrences(p);
    // COUNT=5 means 5 emitted occurrences (EXDATEs do not count toward COUNT
    // per RFC 5545). So we get Jan 1, 3, 5, 6, 7 (Jan 2 and Jan 4 excluded).
    expect(occ).toEqual(["2026-01-01", "2026-01-03", "2026-01-05", "2026-01-06", "2026-01-07"]);
    expect(occ).not.toContain("2026-01-02");
    expect(occ).not.toContain("2026-01-04");
  });
  it("includes RDATE entries", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY", count: 3 },
      rDates: ["2026-01-10", "2026-01-15"],
    };
    const occ = generateOccurrences(p);
    expect(occ).toContain("2026-01-10");
    expect(occ).toContain("2026-01-15");
  });
});

describe("rrule generateOccurrences sub-day frequencies", () => {
  it("generates hourly", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01T00:00:00Z", isDateOnly: false },
      rrule: { freq: "HOURLY", count: 3 },
    };
    const occ = generateOccurrences(p);
    expect(occ).toEqual([
      "2026-01-01T00:00:00Z",
      "2026-01-01T01:00:00Z",
      "2026-01-01T02:00:00Z",
    ]);
  });
  it("generates minutely with INTERVAL", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01T00:00:00Z", isDateOnly: false },
      rrule: { freq: "MINUTELY", interval: 30, count: 3 },
    };
    const occ = generateOccurrences(p);
    expect(occ).toEqual([
      "2026-01-01T00:00:00Z",
      "2026-01-01T00:30:00Z",
      "2026-01-01T01:00:00Z",
    ]);
  });
});

describe("rrule nextOccurrence", () => {
  it("finds next occurrence after a date", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "WEEKLY", byDay: [{ weekday: "MO" }] },
    };
    // After Jan 7 (Wed), next Mon is Jan 12.
    const next = nextOccurrence(p, new Date(Date.UTC(2026, 0, 7)));
    expect(next).toBe("2026-01-12");
  });
  it("returns null for past-UNTIL rule", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY", until: "2026-01-05" },
    };
    const next = nextOccurrence(p, new Date(Date.UTC(2026, 1, 1)));
    expect(next).toBeNull();
  });
});

describe("rrule applyBySetPos", () => {
  it("picks positive position", () => {
    const dates = [
      new Date(Date.UTC(2026, 0, 1)),
      new Date(Date.UTC(2026, 0, 8)),
      new Date(Date.UTC(2026, 0, 15)),
    ];
    const result = applyBySetPos(dates, [1]);
    expect(toDateIso(result[0])).toBe("2026-01-01");
  });
  it("picks negative position (last)", () => {
    const dates = [
      new Date(Date.UTC(2026, 0, 1)),
      new Date(Date.UTC(2026, 0, 8)),
      new Date(Date.UTC(2026, 0, 15)),
    ];
    const result = applyBySetPos(dates, [-1]);
    expect(toDateIso(result[0])).toBe("2026-01-15");
  });
  it("picks multiple positions", () => {
    const dates = [
      new Date(Date.UTC(2026, 0, 1)),
      new Date(Date.UTC(2026, 0, 8)),
      new Date(Date.UTC(2026, 0, 15)),
    ];
    const result = applyBySetPos(dates, [1, -1]);
    expect(result).toHaveLength(2);
  });
  it("ignores out-of-range positions", () => {
    const dates = [
      new Date(Date.UTC(2026, 0, 1)),
    ];
    const result = applyBySetPos(dates, [5]);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Human-readable description
// ---------------------------------------------------------------------------

describe("rrule toHumanReadable", () => {
  it("describes daily", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY" },
    };
    expect(toHumanReadable(p)).toContain("Daily");
    expect(toHumanReadable(p)).toContain("starting 2026-01-01");
  });
  it("describes weekly on Monday", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-05", isDateOnly: true },
      rrule: { freq: "WEEKLY", byDay: [{ weekday: "MO" }] },
    };
    expect(toHumanReadable(p)).toContain("Every Monday");
  });
  it("describes last Friday of month", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-30", isDateOnly: true },
      rrule: { freq: "MONTHLY", byDay: [{ ordinal: -1, weekday: "FR" }] },
    };
    expect(toHumanReadable(p)).toContain("Monthly on the last Friday");
  });
  it("describes with COUNT", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY", count: 10 },
    };
    expect(toHumanReadable(p)).toContain("for 10 occurrences");
  });
  it("describes with UNTIL", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY", until: "2026-12-31" },
    };
    expect(toHumanReadable(p)).toContain("until 2026-12-31");
  });
  it("describes yearly on Jan 1", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "YEARLY", byMonth: [1], byMonthDay: [1] },
    };
    expect(toHumanReadable(p)).toContain("Annually on January 1");
  });
  it("describes datetime with time", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01T09:30:00Z", isDateOnly: false },
      rrule: { freq: "DAILY" },
    };
    expect(toHumanReadable(p)).toContain("at 09:30");
  });
  it("describes EXDATE count", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY", count: 10 },
      exDates: ["2026-01-02", "2026-01-03"],
    };
    expect(toHumanReadable(p)).toContain("excluding 2 dates");
  });
});

// ---------------------------------------------------------------------------
// ICS export
// ---------------------------------------------------------------------------

describe("rrule generateIcs", () => {
  it("produces a valid VCALENDAR with VEVENT", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY", count: 5 },
    };
    const ics = generateIcs(p, { summary: "Daily standup" });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260101");
    expect(ics).toContain("RRULE:FREQ=DAILY;COUNT=5");
    expect(ics).toContain("SUMMARY:Daily standup");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });
  it("includes UID", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY" },
    };
    const ics = generateIcs(p, { uid: "my-uid@x.com" });
    expect(ics).toContain("UID:my-uid@x.com");
  });
  it("includes EXDATE and RDATE", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY", count: 5 },
      exDates: ["2026-01-02"],
      rDates: ["2026-01-10"],
    };
    const ics = generateIcs(p);
    expect(ics).toContain("EXDATE:20260102");
    expect(ics).toContain("RDATE:20260110");
  });
  it("uses CRLF line endings", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY" },
    };
    expect(generateIcs(p)).toContain("\r\n");
  });
  it("escapes special characters in SUMMARY", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY" },
    };
    const ics = generateIcs(p, { summary: "Meeting, part 1; location: A" });
    expect(ics).toContain("Meeting\\, part 1\\; location: A");
  });
});

// ---------------------------------------------------------------------------
// Code snippets
// ---------------------------------------------------------------------------

describe("rrule generateCodeSnippet", () => {
  it("generates rrule.js snippet", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "WEEKLY", byDay: [{ weekday: "MO" }], count: 10 },
    };
    const s = generateCodeSnippet(p, "rrulejs");
    expect(s).toContain("rrule.RRule.WEEKLY");
    expect(s).toContain("count: 10");
    expect(s).toContain("byweekday: [rrule.RRule.MO]");
  });
  it("generates python snippet", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY", count: 5 },
    };
    const s = generateCodeSnippet(p, "python");
    expect(s).toContain("from dateutil.rrule import");
    expect(s).toContain("freq=DAILY");
  });
  it("generates javascript snippet", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY" },
    };
    const s = generateCodeSnippet(p, "javascript");
    expect(s).toContain("RFC 5545");
    expect(s).toContain("FREQ=DAILY");
  });
  it("generates go snippet", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY" },
    };
    const s = generateCodeSnippet(p, "go");
    expect(s).toContain("package main");
    expect(s).toContain("FREQ=DAILY");
  });
});

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

describe("rrule history", () => {
  it("starts empty", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and reloads entries", () => {
    saveHistory({ ts: 1000, freq: "DAILY", interval: 1, hasCount: true, hasUntil: false, preview: "FREQ=DAILY;COUNT=10" });
    saveHistory({ ts: 2000, freq: "WEEKLY", interval: 2, hasCount: false, hasUntil: true, preview: "FREQ=WEEKLY;INTERVAL=2" });
    const h = loadHistory();
    expect(h).toHaveLength(2);
    expect(h[0].ts).toBe(2000);
    expect(h[1].ts).toBe(1000);
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, freq: "DAILY", interval: 1, hasCount: false, hasUntil: false, preview: `r${i}` });
    }
    const h = loadHistory();
    expect(h).toHaveLength(20);
    expect(h[0].ts).toBe(24);
  });
  it("clearHistory empties storage", () => {
    saveHistory({ ts: 1000, freq: "DAILY", interval: 1, hasCount: false, hasUntil: false, preview: "r" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Share URL
// ---------------------------------------------------------------------------

describe("rrule share url", () => {
  it("builds a shareable URL containing the rule", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY", count: 5 },
    };
    const url = buildShareUrl(p);
    expect(url).toContain("rule=");
    expect(url).toContain(encodeURIComponent("FREQ=DAILY"));
    expect(url).toContain(encodeURIComponent("COUNT=5"));
  });
  it("round-trips through parseShareUrl", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-15", isDateOnly: true },
      rrule: { freq: "WEEKLY", interval: 2, byDay: [{ weekday: "MO" }, { weekday: "FR" }], count: 10 },
    };
    const url = buildShareUrl(p);
    const parsed = parseShareUrl(url);
    expect(parsed.ok).toBe(true);
    if (parsed.ok && parsed.value) {
      expect(parsed.value.rrule.freq).toBe("WEEKLY");
      expect(parsed.value.rrule.interval).toBe(2);
      expect(parsed.value.rrule.count).toBe(10);
      expect(parsed.value.rrule.byDay).toEqual([{ weekday: "MO" }, { weekday: "FR" }]);
      expect(parsed.value.dtStart?.value).toBe("2026-01-15");
    }
  });
  it("returns error for empty hash", () => {
    expect(parseShareUrl("").ok).toBe(false);
  });
  it("returns error for hash without rule param", () => {
    expect(parseShareUrl("#foo=bar").ok).toBe(false);
  });
  it("round-trips EXDATE and RDATE", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY", count: 5 },
      exDates: ["2026-01-02"],
      rDates: ["2026-01-10"],
    };
    const url = buildShareUrl(p);
    const parsed = parseShareUrl(url);
    expect(parsed.ok).toBe(true);
    if (parsed.ok && parsed.value) {
      expect(parsed.value.exDates).toEqual(["2026-01-02"]);
      expect(parsed.value.rDates).toEqual(["2026-01-10"]);
    }
  });
});

// ---------------------------------------------------------------------------
// Default rule
// ---------------------------------------------------------------------------

describe("rrule defaultParsedRule", () => {
  it("returns a valid rule", () => {
    const p = defaultParsedRule();
    expect(p.rrule.freq).toBe("WEEKLY");
    expect(p.dtStart).toBeTruthy();
    expect(p.dtStart!.isDateOnly).toBe(true);
    const v = validateRRule(p);
    expect(v.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("rrule edge cases", () => {
  it("handles Feb 29 yearly recurrence (skips non-leap years)", () => {
    const p: ParsedRule = {
      dtStart: { value: "2024-02-29", isDateOnly: true },
      rrule: { freq: "YEARLY", byMonth: [2], byMonthDay: [29], count: 3 },
    };
    const occ = generateOccurrences(p);
    expect(occ[0]).toBe("2024-02-29");
    expect(occ[1]).toBe("2028-02-29");
    expect(occ[2]).toBe("2032-02-29");
  });
  it("handles BYWEEKNO=53 for years with 53 weeks", () => {
    // 2026 has 53 ISO weeks. Week 53 of 2026 begins Dec 28, 2026 (Monday).
    const p: ParsedRule = {
      dtStart: { value: "2026-12-28", isDateOnly: true },
      rrule: { freq: "YEARLY", byWeekNo: [53], byDay: [{ weekday: "MO" }], count: 1 },
    };
    const occ = generateOccurrences(p);
    expect(occ).toContain("2026-12-28");
  });
  it("handles negative BYSETPOS", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-30", isDateOnly: true },
      rrule: {
        freq: "MONTHLY",
        byDay: [{ weekday: "FR" }],
        bySetPos: [-1],
        count: 3,
      },
    };
    const occ = generateOccurrences(p);
    expect(occ).toEqual([
      "2026-01-30", // Last Fri Jan 2026
      "2026-02-27", // Last Fri Feb 2026
      "2026-03-27", // Last Fri Mar 2026
    ]);
  });
  it("UNTIL with datetime works for datetime DTSTART", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01T00:00:00Z", isDateOnly: false },
      rrule: { freq: "DAILY", until: "2026-01-03T23:59:59Z" },
    };
    const occ = generateOccurrences(p);
    expect(occ).toHaveLength(3);
    expect(occ[0]).toBe("2026-01-01T00:00:00Z");
    expect(occ[2]).toBe("2026-01-03T00:00:00Z");
  });
  it("generates monthly BYDAY with multiple ordinals", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-05", isDateOnly: true }, // First Monday of Jan
      rrule: {
        freq: "MONTHLY",
        byDay: [{ ordinal: 1, weekday: "MO" }, { ordinal: 3, weekday: "MO" }],
        count: 4,
      },
    };
    const occ = generateOccurrences(p);
    expect(occ).toEqual([
      "2026-01-05",
      "2026-01-19",
      "2026-02-02",
      "2026-02-16",
    ]);
  });
  it("returns empty for invalid rule", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY", count: 10, until: "2026-12-31" }, // invalid combo
    };
    expect(generateOccurrences(p)).toEqual([]);
  });
  it("respects limit option", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01", isDateOnly: true },
      rrule: { freq: "DAILY" },
    };
    const occ = generateOccurrences(p, { limit: 5 });
    expect(occ).toHaveLength(5);
  });
  it("parses lowercase FREQ", () => {
    const r = parseRRuleString("freq=daily");
    expect(r.freq).toBe("DAILY");
  });
  it("handles datetime DTSTART with EXDATE (datetime)", () => {
    const p: ParsedRule = {
      dtStart: { value: "2026-01-01T09:00:00Z", isDateOnly: false },
      rrule: { freq: "DAILY", count: 5 },
      exDates: ["2026-01-02T09:00:00Z"],
    };
    const occ = generateOccurrences(p);
    expect(occ).not.toContain("2026-01-02T09:00:00Z");
    expect(occ).toContain("2026-01-01T09:00:00Z");
    expect(occ).toContain("2026-01-03T09:00:00Z");
  });
});

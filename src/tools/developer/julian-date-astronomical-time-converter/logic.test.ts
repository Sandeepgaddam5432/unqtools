import { describe, it, expect, beforeEach } from "vitest";
import {
  J2000_JD,
  MJD_OFFSET,
  RJD_OFFSET,
  TJD_OFFSET,
  DJD_OFFSET,
  RATA_DIE_OFFSET,
  UNIX_EPOCH_JD,
  CALENDAR_SYSTEMS,
  MODES,
  WEEKDAYS,
  MONTHS,
  PRECISION_LEVELS,
  isLeapYear,
  daysInMonth,
  validateCalendar,
  calendarToJd,
  jdToCalendar,
  jdToMjd,
  mjdToJd,
  jdToRjd,
  rjdToJd,
  jdToTjd,
  tjdToJd,
  jdToDjd,
  djdToJd,
  jdToRataDie,
  rataDieToJd,
  jdToJ2000,
  j2000ToJd,
  jdToUnixMillis,
  jdToUnixSeconds,
  unixMillisToJd,
  unixSecondsToJd,
  weekdayFromJd,
  weekdayNameFromJd,
  calendarToIso,
  makeCalendar,
  parseCalendarString,
  parseJd,
  convertCalendar,
  convertFromJd,
  parseOrdinal,
  convertOrdinal,
  calendarToOrdinal,
  currentJd,
  currentMjd,
  formatFixed,
  formatConversionTable,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
} from "./logic";

const B = (v: string | number): bigint => BigInt(v);
const NS_PER_MS = B(1_000_000);
// 1 day in milliseconds = 86_400_000

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

describe("julian-date constants", () => {
  it("exposes canonical J2000.0 = 2451545.0", () => {
    expect(J2000_JD).toBe(2_451_545.0);
  });
  it("exposes MJD offset = 2400000.5", () => {
    expect(MJD_OFFSET).toBe(2_400_000.5);
  });
  it("exposes RJD/TJD/DJD/RD offsets", () => {
    expect(RJD_OFFSET).toBe(2_400_000.0);
    expect(TJD_OFFSET).toBe(2_440_000.5);
    expect(DJD_OFFSET).toBe(2_415_020.0);
    expect(RATA_DIE_OFFSET).toBe(1_721_424.5);
  });
  it("exposes Unix epoch as JD 2440587.5", () => {
    expect(UNIX_EPOCH_JD).toBe(2_440_587.5);
  });
  it("has 2 calendar systems and 3 modes", () => {
    expect(CALENDAR_SYSTEMS.length).toBe(2);
    expect(MODES.length).toBe(3);
    expect(CALENDAR_SYSTEMS.map((c) => c.value)).toEqual(["gregorian", "julian"]);
    expect(MODES.map((m) => m.value)).toEqual(["calendar", "jd", "ordinal"]);
  });
  it("has 7 weekday names + 12 month names + 5 precision levels", () => {
    expect(WEEKDAYS).toHaveLength(7);
    expect(MONTHS).toHaveLength(12);
    expect(PRECISION_LEVELS.length).toBeGreaterThanOrEqual(5);
  });
});

describe("julian-date isLeapYear", () => {
  it("Gregorian 2000 is a leap year (divisible by 400)", () => {
    expect(isLeapYear(2000, "gregorian")).toBe(true);
  });
  it("Gregorian 1900 is NOT a leap year (century not / 400)", () => {
    expect(isLeapYear(1900, "gregorian")).toBe(false);
  });
  it("Gregorian 2024 is a leap year", () => {
    expect(isLeapYear(2024, "gregorian")).toBe(true);
  });
  it("Gregorian 2023 is NOT a leap year", () => {
    expect(isLeapYear(2023, "gregorian")).toBe(false);
  });
  it("Julian 1900 IS a leap year (no century rule)", () => {
    expect(isLeapYear(1900, "julian")).toBe(true);
  });
  it("Julian year 0 is a leap year (astronomical numbering)", () => {
    expect(isLeapYear(0, "julian")).toBe(true);
  });
  it("Julian year -4 (5 BC) is a leap year", () => {
    expect(isLeapYear(-4, "julian")).toBe(true);
  });
});

describe("julian-date daysInMonth", () => {
  it("Feb has 29 in 2024 Gregorian", () => {
    expect(daysInMonth(2024, 2, "gregorian")).toBe(29);
  });
  it("Feb has 28 in 2023 Gregorian", () => {
    expect(daysInMonth(2023, 2, "gregorian")).toBe(28);
  });
  it("Apr has 30, Dec has 31", () => {
    expect(daysInMonth(2024, 4, "gregorian")).toBe(30);
    expect(daysInMonth(2024, 12, "gregorian")).toBe(31);
  });
  it("returns 0 for out-of-range month", () => {
    expect(daysInMonth(2024, 13, "gregorian")).toBe(0);
  });
});

describe("julian-date validateCalendar", () => {
  it("accepts a valid Gregorian date", () => {
    expect(validateCalendar({ year: 2024, month: 2, day: 29, hour: 0, minute: 0, second: 0 }, "gregorian")).toBeNull();
  });
  it("rejects Feb 29 in non-leap year", () => {
    expect(validateCalendar({ year: 2023, month: 2, day: 29, hour: 0, minute: 0, second: 0 }, "gregorian")).toMatch(/Day must be/);
  });
  it("rejects month=13", () => {
    expect(validateCalendar({ year: 2024, month: 13, day: 1, hour: 0, minute: 0, second: 0 }, "gregorian")).toMatch(/Month must be 1-12/);
  });
  it("rejects hour=24", () => {
    expect(validateCalendar({ year: 2024, month: 1, day: 1, hour: 24, minute: 0, second: 0 }, "gregorian")).toMatch(/Hour/);
  });
  it("accepts year 0 (1 BC)", () => {
    expect(validateCalendar({ year: 0, month: 1, day: 1, hour: 0, minute: 0, second: 0 }, "gregorian")).toBeNull();
  });
});

describe("julian-date calendarToJd (Gregorian)", () => {
  it("1970-01-01 00:00 UTC → JD 2440587.5 (Unix epoch)", () => {
    const jd = calendarToJd({ year: 1970, month: 1, day: 1, hour: 0, minute: 0, second: 0 }, "gregorian");
    expect(jd).toBeCloseTo(2_440_587.5, 10);
  });
  it("2000-01-01 00:00 UTC → JD 2451544.5", () => {
    const jd = calendarToJd({ year: 2000, month: 1, day: 1, hour: 0, minute: 0, second: 0 }, "gregorian");
    expect(jd).toBeCloseTo(2_451_544.5, 10);
  });
  it("2000-01-01 12:00 UTC → JD 2451545.0 (J2000.0)", () => {
    const jd = calendarToJd({ year: 2000, month: 1, day: 1, hour: 12, minute: 0, second: 0 }, "gregorian");
    expect(jd).toBeCloseTo(J2000_JD, 10);
  });
  it("2025-01-01 00:00 UTC → JD 2460676.5", () => {
    const jd = calendarToJd({ year: 2025, month: 1, day: 1, hour: 0, minute: 0, second: 0 }, "gregorian");
    expect(jd).toBeCloseTo(2_460_676.5, 10);
  });
  it("1582-10-15 00:00 (first Gregorian day) → JD 2299160.5", () => {
    const jd = calendarToJd({ year: 1582, month: 10, day: 15, hour: 0, minute: 0, second: 0 }, "gregorian");
    expect(jd).toBeCloseTo(2_299_160.5, 10);
  });
  it("noon offset is correct: 12:00 → integer JD, 00:00 → integer + 0.5", () => {
    const noon = calendarToJd({ year: 2024, month: 6, day: 15, hour: 12, minute: 0, second: 0 }, "gregorian");
    const midnight = calendarToJd({ year: 2024, month: 6, day: 15, hour: 0, minute: 0, second: 0 }, "gregorian");
    expect(noon - midnight).toBeCloseTo(0.5, 10);
    expect(Number.isInteger(noon)).toBe(true);
  });
});

describe("julian-date calendarToJd (Julian)", () => {
  it("1582-10-04 00:00 (Julian) → JD 2299159.5 (last Julian day)", () => {
    const jd = calendarToJd({ year: 1582, month: 10, day: 4, hour: 0, minute: 0, second: 0 }, "julian");
    expect(jd).toBeCloseTo(2_299_159.5, 10);
  });
  it("Julian 1 BC = year 0: 0000-01-01 noon → known JD", () => {
    // Julian year 0, Jan 1, noon → JD 1721057.5? Verify via round-trip below.
    const jd = calendarToJd({ year: 0, month: 1, day: 1, hour: 12, minute: 0, second: 0 }, "julian");
    expect(Number.isInteger(jd)).toBe(true);
    expect(jd).toBeGreaterThan(1_720_000);
    expect(jd).toBeLessThan(1_722_000);
  });
});

describe("julian-date jdToCalendar round-trip", () => {
  it("round-trips JD 2440587.5 → 1970-01-01 00:00 (Gregorian)", () => {
    const cal = jdToCalendar(2_440_587.5, "gregorian");
    expect(cal.year).toBe(1970);
    expect(cal.month).toBe(1);
    expect(cal.day).toBe(1);
    expect(cal.hour).toBe(0);
    expect(cal.minute).toBe(0);
    expect(cal.second).toBe(0);
  });
  it("round-trips JD 2460676.5 → 2025-01-01 00:00 (Gregorian)", () => {
    const cal = jdToCalendar(2_460_676.5, "gregorian");
    expect(cal.year).toBe(2025);
    expect(cal.month).toBe(1);
    expect(cal.day).toBe(1);
    expect(cal.hour).toBe(0);
  });
  it("round-trips Julian 1582-10-04 → 1582-10-04 (Julian calendar)", () => {
    const jd = calendarToJd({ year: 1582, month: 10, day: 4, hour: 6, minute: 0, second: 0 }, "julian");
    const back = jdToCalendar(jd, "julian");
    expect(back.year).toBe(1582);
    expect(back.month).toBe(10);
    expect(back.day).toBe(4);
    expect(back.hour).toBe(6);
  });
  it("round-trips a BC date", () => {
    const orig = { year: -43, month: 3, day: 15, hour: 12, minute: 0, second: 0 };
    const jd = calendarToJd(orig, "julian");
    const back = jdToCalendar(jd, "julian");
    expect(back.year).toBe(-43);
    expect(back.month).toBe(3);
    expect(back.day).toBe(15);
    expect(back.hour).toBe(12);
  });
  it("JD 0.0 → 4713 BC (proleptic Julian)", () => {
    const cal = jdToCalendar(0.0, "julian");
    expect(cal.year).toBe(-4712);
    expect(cal.month).toBe(1);
    expect(cal.day).toBe(1);
    expect(cal.hour).toBe(12);
  });
});

describe("julian-date JD ↔ MJD/RJD/TJD/DJD/RD/J2000", () => {
  it("MJD = JD − 2400000.5 (Unix epoch → MJD 40587)", () => {
    expect(jdToMjd(2_440_587.5)).toBeCloseTo(40_587, 10);
  });
  it("MJD round-trips", () => {
    const jd = 2_460_684.5;
    expect(mjdToJd(jdToMjd(jd))).toBeCloseTo(jd, 10);
  });
  it("RJD = JD − 2400000", () => {
    expect(jdToRjd(2_440_587.5)).toBeCloseTo(40_587.5, 10);
    expect(rjdToJd(40_587.5)).toBeCloseTo(2_440_587.5, 10);
  });
  it("TJD = JD − 2440000.5", () => {
    expect(jdToTjd(2_440_587.5)).toBeCloseTo(587, 10);
    expect(tjdToJd(587)).toBeCloseTo(2_440_587.5, 10);
  });
  it("DJD = JD − 2415020", () => {
    expect(jdToDjd(2_440_587.5)).toBeCloseTo(25_567.5, 10);
    expect(djdToJd(25_567.5)).toBeCloseTo(2_440_587.5, 10);
  });
  it("Rata Die: 1970-01-01 → RD 719163", () => {
    expect(jdToRataDie(2_440_587.5)).toBeCloseTo(719_163, 10);
    expect(rataDieToJd(719_163)).toBeCloseTo(2_440_587.5, 10);
  });
  it("J2000.0 → 0 days since epoch", () => {
    expect(jdToJ2000(J2000_JD)).toBeCloseTo(0, 10);
    expect(j2000ToJd(0)).toBeCloseTo(J2000_JD, 10);
  });
  it("2025-01-01 → 9131.5 days since J2000.0", () => {
    // 2451545.0 (J2000.0 noon) → 2460676.5 (2025-01-01 midnight) = 9131.5 days
    expect(jdToJ2000(2_460_676.5)).toBeCloseTo(9_131.5, 10);
  });
});

describe("julian-date JD ↔ Unix epoch", () => {
  it("JD 2440587.5 → Unix seconds 0", () => {
    expect(jdToUnixSeconds(2_440_587.5)).toBe(B(0));
    expect(jdToUnixMillis(2_440_587.5)).toBe(B(0));
  });
  it("JD 2440588.5 (next day) → Unix ms 86400000", () => {
    expect(jdToUnixMillis(2_440_588.5)).toBe(B(86_400_000));
    expect(jdToUnixSeconds(2_440_588.5)).toBe(B(86_400));
  });
  it("returns null for out-of-range JD", () => {
    // JS Date range is ±100M days from 1970. JD -100,000,000 is far out of range.
    expect(jdToUnixMillis(-100_000_000)).toBeNull();
    expect(jdToUnixSeconds(-100_000_000)).toBeNull();
  });
  it("Unix ms round-trips to JD", () => {
    const ms = B(1_700_000_000_000);
    const jd = unixMillisToJd(ms);
    expect(jd).toBeCloseTo(2_440_587.5 + 1_700_000_000_000 / 86_400_000, 6);
  });
  it("Unix seconds round-trips to JD", () => {
    const sec = B(1_700_000_000);
    const jd = unixSecondsToJd(sec);
    expect(jd).toBeCloseTo(2_440_587.5 + 1_700_000_000 / 86_400, 6);
  });
});

describe("julian-date weekdayFromJd", () => {
  it("JD 2451545.0 (J2000.0, noon 2000-01-01) → Saturday (6)", () => {
    expect(weekdayFromJd(J2000_JD)).toBe(6);
    expect(weekdayNameFromJd(J2000_JD)).toBe("Saturday");
  });
  it("JD 2440587.5 (Unix epoch midnight) → Thursday (4)", () => {
    expect(weekdayFromJd(2_440_587.5)).toBe(4);
    expect(weekdayNameFromJd(2_440_587.5)).toBe("Thursday");
  });
  it("JD 0.0 (proleptic Julian, 4713 BC) → Monday (1)", () => {
    expect(weekdayFromJd(0)).toBe(1);
    expect(weekdayNameFromJd(0)).toBe("Monday");
  });
  it("handles negative JD (BC dates)", () => {
    // Just ensure no crash and result is in 0..6
    const w = weekdayFromJd(-1000.5);
    expect(w).toBeGreaterThanOrEqual(0);
    expect(w).toBeLessThanOrEqual(6);
  });
});

describe("julian-date calendarToIso", () => {
  it("formats 2025-01-01 00:00:00 Z", () => {
    const iso = calendarToIso({ year: 2025, month: 1, day: 1, hour: 0, minute: 0, second: 0 });
    expect(iso).toBe("2025-01-01T00:00:00Z");
  });
  it("formats BC year with sign (year 0 = 1 BC)", () => {
    const iso = calendarToIso({ year: 0, month: 1, day: 1, hour: 0, minute: 0, second: 0 });
    expect(iso).toBe("0000-01-01T00:00:00Z");
  });
  it("formats negative year (BC) with leading sign", () => {
    const iso = calendarToIso({ year: -44, month: 3, day: 15, hour: 0, minute: 0, second: 0 });
    expect(iso).toBe("-0044-03-15T00:00:00Z");
  });
});

describe("julian-date parseCalendarString", () => {
  it("parses YYYY-MM-DD", () => {
    const p = parseCalendarString("2025-01-15");
    expect(p).toEqual({ year: 2025, month: 1, day: 15, hour: 0, minute: 0, second: 0, fraction: 0 });
  });
  it("parses YYYY-MM-DDTHH:MM:SS", () => {
    const p = parseCalendarString("2025-01-15T13:45:30");
    expect(p?.year).toBe(2025);
    expect(p?.hour).toBe(13);
    expect(p?.minute).toBe(45);
    expect(p?.second).toBe(30);
  });
  it("parses YYYY-MM-DD HH:MM:SS.fff", () => {
    const p = parseCalendarString("2025-01-15 13:45:30.500");
    expect(p?.second).toBe(30);
    expect(p?.fraction).toBeCloseTo(0.5, 6);
  });
  it("parses negative year (BC)", () => {
    const p = parseCalendarString("-0044-03-15");
    expect(p?.year).toBe(-44);
    expect(p?.month).toBe(3);
  });
  it("returns null for garbage", () => {
    expect(parseCalendarString("not-a-date")).toBeNull();
  });
});

describe("julian-date parseJd", () => {
  it("parses fractional JD", () => {
    expect(parseJd("2440587.5")).toBe(2_440_587.5);
  });
  it("parses negative JD", () => {
    expect(parseJd("-1000.25")).toBe(-1000.25);
  });
  it("returns null for empty or non-numeric", () => {
    expect(parseJd("")).toBeNull();
    expect(parseJd("abc")).toBeNull();
  });
});

describe("julian-date convertCalendar", () => {
  it("converts Unix epoch and returns full JulianConversion", () => {
    const r = convertCalendar({ year: 1970, month: 1, day: 1, hour: 0, minute: 0, second: 0 }, "gregorian");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.jd).toBeCloseTo(2_440_587.5, 10);
      expect(r.mjd).toBeCloseTo(40_587, 10);
      // Unix epoch (1970) is 10957.5 days BEFORE J2000.0 (2000-01-01 noon).
      expect(r.j2000).toBeCloseTo(-10_957.5, 10);
      expect(r.unixSeconds).toBe(B(0));
      expect(r.unixMillis).toBe(B(0));
      expect(r.weekday).toBe("Thursday");
      expect(r.iso).toBe("1970-01-01T00:00:00Z");
      expect(r.calendarSystem).toBe("gregorian");
    }
  });
  it("returns error for invalid date", () => {
    const r = convertCalendar({ year: 2023, month: 2, day: 29, hour: 0, minute: 0, second: 0 }, "gregorian");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Day/);
  });
  it("handles Julian calendar system flag", () => {
    const r = convertCalendar({ year: 1582, month: 10, day: 4, hour: 0, minute: 0, second: 0 }, "julian");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.jd).toBeCloseTo(2_299_159.5, 10);
      expect(r.calendarSystem).toBe("julian");
    }
  });
  it("exposes fractionOfDay in [0,1) at midnight = 0", () => {
    const r = convertCalendar({ year: 2025, month: 1, day: 1, hour: 0, minute: 0, second: 0 }, "gregorian");
    if (r.ok) expect(r.fractionOfDay).toBeCloseTo(0, 10);
  });
});

describe("julian-date convertFromJd", () => {
  it("converts JD 2460676.5 → 2025-01-01 00:00 UTC", () => {
    const r = convertFromJd(2_460_676.5, "gregorian");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.calendar.year).toBe(2025);
      expect(r.calendar.month).toBe(1);
      expect(r.calendar.day).toBe(1);
      expect(r.calendar.hour).toBe(0);
      expect(r.mode).toBe("jd");
    }
  });
  it("returns error for non-finite JD", () => {
    const r = convertFromJd(Number.NaN, "gregorian");
    expect(r.ok).toBe(false);
  });
  it("round-trips with calendarToJd", () => {
    const orig = { year: 2024, month: 6, day: 15, hour: 9, minute: 30, second: 45 };
    const jd = calendarToJd(orig, "gregorian");
    const r = convertFromJd(jd, "gregorian");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.calendar.year).toBe(orig.year);
      expect(r.calendar.month).toBe(orig.month);
      expect(r.calendar.day).toBe(orig.day);
      expect(r.calendar.hour).toBe(orig.hour);
      expect(r.calendar.minute).toBe(orig.minute);
      expect(r.calendar.second).toBe(orig.second);
    }
  });
});

describe("julian-date parseOrdinal", () => {
  it("parses YYDDD with pivot 70 (69 → 2069)", () => {
    expect(parseOrdinal("69001")).toEqual({ form: "YYDDD", year: 2069, dayOfYear: 1 });
  });
  it("parses YYDDD with pivot 70 (70 → 1970)", () => {
    expect(parseOrdinal("70001")).toEqual({ form: "YYDDD", year: 1970, dayOfYear: 1 });
  });
  it("parses YYYYDDD (7 digits)", () => {
    expect(parseOrdinal("2025001")).toEqual({ form: "YYYYDDD", year: 2025, dayOfYear: 1 });
  });
  it("returns null for invalid length", () => {
    expect(parseOrdinal("123456")).toBeNull();
    expect(parseOrdinal("1234")).toBeNull();
    expect(parseOrdinal("12345678")).toBeNull();
  });
});

describe("julian-date convertOrdinal", () => {
  it("converts 25001 → 2025-01-01 (YYDDD)", () => {
    const r = convertOrdinal("25001");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.year).toBe(2025);
      expect(r.dayOfYear).toBe(1);
      expect(r.calendar.month).toBe(1);
      expect(r.calendar.day).toBe(1);
      expect(r.form).toBe("YYDDD");
    }
  });
  it("converts 2025001 → 2025-01-01 (YYYYDDD)", () => {
    const r = convertOrdinal("2025001");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.year).toBe(2025);
      expect(r.form).toBe("YYYYDDD");
    }
  });
  it("converts 24366 → 2024-12-31 (leap-year day 366)", () => {
    const r = convertOrdinal("24366");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.year).toBe(2024);
      expect(r.dayOfYear).toBe(366);
      expect(r.calendar.month).toBe(12);
      expect(r.calendar.day).toBe(31);
    }
  });
  it("rejects day-of-year 366 in non-leap year", () => {
    const r = convertOrdinal("2023366");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/exceeds 365/);
  });
  it("rejects invalid input length", () => {
    const r = convertOrdinal("123456");
    expect(r.ok).toBe(false);
  });
});

describe("julian-date calendarToOrdinal", () => {
  it("2025-01-01 → 2025001", () => {
    expect(calendarToOrdinal(2025, 1, 1)).toBe("2025001");
  });
  it("2024-12-31 → 2024366 (leap year)", () => {
    expect(calendarToOrdinal(2024, 12, 31)).toBe("2024366");
  });
  it("2023-12-31 → 2023365 (non-leap year)", () => {
    expect(calendarToOrdinal(2023, 12, 31)).toBe("2023365");
  });
});

describe("julian-date currentJd/currentMjd", () => {
  it("currentJd returns a positive number near today's JD", () => {
    const now = new Date(Date.UTC(2025, 0, 1, 0, 0, 0));
    expect(currentJd(now)).toBeCloseTo(2_460_676.5, 6);
  });
  it("currentMjd returns MJD for a fixed date", () => {
    const now = new Date(Date.UTC(2025, 0, 1, 0, 0, 0));
    expect(currentMjd(now)).toBeCloseTo(60_676, 6);
  });
});

describe("julian-date formatFixed / formatConversionTable", () => {
  it("formatFixed rounds to precision", () => {
    expect(formatFixed(2_440_587.5, 3)).toBe("2440587.500");
    expect(formatFixed(2_440_587.5, 0)).toBe("2440588");
  });
  it("formatConversionTable returns 15 rows", () => {
    const r = convertCalendar({ year: 2025, month: 1, day: 1, hour: 0, minute: 0, second: 0 }, "gregorian");
    expect(r.ok).toBe(true);
    if (r.ok) {
      const rows = formatConversionTable(r, 6);
      expect(rows.length).toBe(15);
      expect(rows.find((x) => x.label.includes("Julian Date"))?.value).toBe("2460676.500000");
    }
  });
});

describe("julian-date history", () => {
  it("loadHistory returns empty when none stored", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saveHistory appends and caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        mode: "jd",
        calendarSystem: "gregorian",
        inputPreview: `jd-${i}`,
        jd: 2_440_587.5 + i,
      });
    }
    const h = loadHistory();
    expect(h.length).toBe(20);
    expect(h[0].inputPreview).toBe("jd-24");
  });
  it("clearHistory empties storage", () => {
    saveHistory({ ts: 1, mode: "jd", calendarSystem: "gregorian", inputPreview: "x", jd: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("julian-date share URL", () => {
  it("buildShareUrl encodes mode + input", () => {
    const url = buildShareUrl("jd", "2460676.5", "gregorian", 6);
    expect(url).toMatch(/mode=jd/);
    expect(url).toMatch(/input=2460676\.5/);
  });
  it("buildShareUrl includes cal and precision only when non-default", () => {
    const url1 = buildShareUrl("calendar", "2025-01-01", "gregorian", 6);
    expect(url1).not.toMatch(/cal=/);
    expect(url1).not.toMatch(/p=/);
    const url2 = buildShareUrl("calendar", "2025-01-01", "julian", 9);
    expect(url2).toMatch(/cal=julian/);
    expect(url2).toMatch(/p=9/);
  });
  it("parseShareUrl round-trips", () => {
    const params = parseShareUrl("#mode=jd&input=2440587.5&cal=julian&p=9");
    expect(params.mode).toBe("jd");
    expect(params.input).toBe("2440587.5");
    expect(params.calendarSystem).toBe("julian");
    expect(params.precision).toBe(9);
  });
  it("parseShareUrl returns defaults for empty", () => {
    const params = parseShareUrl("");
    expect(params.mode).toBe("calendar");
    expect(params.calendarSystem).toBe("gregorian");
    expect(params.precision).toBe(6);
  });
});

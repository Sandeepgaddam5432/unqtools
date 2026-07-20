import { describe, it, expect, beforeEach } from "vitest";
import {
  SECONDS_PER_MINUTE,
  SECONDS_PER_HOUR,
  SECONDS_PER_DAY,
  MS_PER_SECOND,
  MS_PER_MINUTE,
  MS_PER_HOUR,
  MS_PER_DAY,
  durationToSeconds,
  parseDuration,
  parseClockTime,
  isValidClockTime,
  formatHms,
  formatClockHms,
  format12h,
  format24h,
  normalizeDuration,
  toDecimalHours,
  fromDecimalHours,
  formatHuman,
  formatCompact,
  addDurations,
  subtractDurations,
  multiplyDuration,
  divideDuration,
  addInputs,
  subtractInputs,
  durationBetween,
  computeTimesheetRow,
  parseTimesheetRows,
  computeTimesheet,
  renderTimesheetCsv,
  renderTimesheetText,
  roundToMinute,
  floorToMinute,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ArithmeticResult,
  type BetweenResult,
  type TimesheetTotal,
  type TimesheetRow,
  type HistoryEntry,
  type Operation,
  type DurationInput,
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

describe("tdc constants", () => {
  it("SECONDS_PER_MINUTE is 60", () => {
    expect(SECONDS_PER_MINUTE).toBe(60);
  });
  it("SECONDS_PER_HOUR is 3600", () => {
    expect(SECONDS_PER_HOUR).toBe(3600);
  });
  it("SECONDS_PER_DAY is 86400", () => {
    expect(SECONDS_PER_DAY).toBe(86400);
  });
  it("MS_PER_DAY is 86400000", () => {
    expect(MS_PER_DAY).toBe(86_400_000);
  });
  it("MS_PER_HOUR is 3600000", () => {
    expect(MS_PER_HOUR).toBe(3_600_000);
  });
});

describe("tdc durationToSeconds", () => {
  it("converts DurationInput to total seconds", () => {
    expect(durationToSeconds({ days: 1, hours: 2, minutes: 3, seconds: 4 }))
      .toBe(86400 + 7200 + 180 + 4);
  });
  it("handles partial input", () => {
    expect(durationToSeconds({ hours: 1 })).toBe(3600);
  });
  it("handles empty input", () => {
    expect(durationToSeconds({})).toBe(0);
  });
  it("handles negative values", () => {
    expect(durationToSeconds({ hours: -1 })).toBe(-3600);
  });
});

describe("tdc parseDuration", () => {
  it("parses HH:MM:SS", () => {
    expect(parseDuration("01:30:45")).toBe(1 * 3600 + 30 * 60 + 45);
  });
  it("parses HH:MM as hours:minutes", () => {
    expect(parseDuration("01:30")).toBe(1 * 3600 + 30 * 60);
  });
  it("parses mixed units '1d 2h 3m 4s'", () => {
    expect(parseDuration("1d 2h 3m 4s")).toBe(86400 + 7200 + 180 + 4);
  });
  it("parses single-unit suffix '90m'", () => {
    expect(parseDuration("90m")).toBe(5400);
  });
  it("parses decimal hours '1.5h'", () => {
    expect(parseDuration("1.5h")).toBe(5400);
  });
  it("parses decimal days '0.5d'", () => {
    expect(parseDuration("0.5d")).toBe(43200);
  });
  it("parses bare seconds when allowed", () => {
    expect(parseDuration("90", { allowBareSeconds: true })).toBe(90);
  });
  it("returns NaN for bare number when not allowed", () => {
    expect(parseDuration("90")).toBeNaN();
  });
  it("returns NaN for empty input", () => {
    expect(parseDuration("")).toBeNaN();
  });
  it("returns NaN for garbage input", () => {
    expect(parseDuration("not-a-time")).toBeNaN();
  });
});

describe("tdc parseClockTime", () => {
  it("parses 24h HH:MM", () => {
    expect(parseClockTime("14:30")).toBe(14 * 3600 + 30 * 60);
  });
  it("parses 24h HH:MM:SS", () => {
    expect(parseClockTime("14:30:45")).toBe(14 * 3600 + 30 * 60 + 45);
  });
  it("parses 12h HH:MM AM", () => {
    expect(parseClockTime("9:30 AM")).toBe(9 * 3600 + 30 * 60);
  });
  it("parses 12h HH:MM PM", () => {
    expect(parseClockTime("3:30 PM")).toBe(15 * 3600 + 30 * 60);
  });
  it("parses 12h midnight (12 AM)", () => {
    expect(parseClockTime("12:00 AM")).toBe(0);
  });
  it("parses 12h noon (12 PM)", () => {
    expect(parseClockTime("12:00 PM")).toBe(12 * 3600);
  });
  it("parses 12h without colon '8am'", () => {
    expect(parseClockTime("8am")).toBe(8 * 3600);
  });
  it("parses 12h without colon '8pm'", () => {
    expect(parseClockTime("8pm")).toBe(20 * 3600);
  });
  it("rejects invalid 12h hour > 12", () => {
    expect(parseClockTime("13:00 PM")).toBeNaN();
  });
  it("rejects invalid 24h hour > 23", () => {
    expect(parseClockTime("24:00")).toBeNaN();
  });
  it("rejects invalid minute > 59", () => {
    expect(parseClockTime("10:60")).toBeNaN();
  });
  it("rejects empty input", () => {
    expect(parseClockTime("")).toBeNaN();
  });
  it("isValidClockTime returns true for valid", () => {
    expect(isValidClockTime("14:30")).toBe(true);
    expect(isValidClockTime("invalid")).toBe(false);
  });
});

describe("tdc formatHms", () => {
  it("formats under an hour as 00:MM:SS", () => {
    expect(formatHms(75)).toBe("00:01:15");
  });
  it("formats under a day as HH:MM:SS", () => {
    expect(formatHms(3600 + 1800 + 30)).toBe("01:30:30");
  });
  it("formats > 24h as cumulative hours", () => {
    expect(formatHms(49 * 3600 + 30 * 60)).toBe("49:30:00");
  });
  it("formats 0 as 00:00:00", () => {
    expect(formatHms(0)).toBe("00:00:00");
  });
  it("formats negative with leading minus", () => {
    expect(formatHms(-75)).toBe("-00:01:15");
  });
  it("returns empty for NaN", () => {
    expect(formatHms(Number.NaN)).toBe("");
  });
});

describe("tdc formatClockHms / format12h / format24h", () => {
  it("formatClockHms wraps at 24h", () => {
    expect(formatClockHms(25 * 3600)).toBe("01:00:00");
  });
  it("format12h formats AM", () => {
    expect(format12h(9 * 3600 + 30 * 60)).toBe("9:30 AM");
  });
  it("format12h formats PM", () => {
    expect(format12h(15 * 3600 + 30 * 60)).toBe("3:30 PM");
  });
  it("format12h formats midnight as 12:00 AM", () => {
    expect(format12h(0)).toBe("12:00 AM");
  });
  it("format12h formats noon as 12:00 PM", () => {
    expect(format12h(12 * 3600)).toBe("12:00 PM");
  });
  it("format24h formats HH:MM:SS", () => {
    expect(format24h(15 * 3600 + 30 * 60 + 45)).toBe("15:30:45");
  });
});

describe("tdc normalizeDuration", () => {
  it("normalizes 90s to 1m30s", () => {
    expect(normalizeDuration(90)).toEqual({ days: 0, hours: 0, minutes: 1, seconds: 30 });
  });
  it("normalizes 75m to 1h15m", () => {
    expect(normalizeDuration(75 * 60)).toEqual({ days: 0, hours: 1, minutes: 15, seconds: 0 });
  });
  it("normalizes 25h to 1d1h", () => {
    expect(normalizeDuration(25 * 3600)).toEqual({ days: 1, hours: 1, minutes: 0, seconds: 0 });
  });
  it("normalizes 0 to all zeros", () => {
    expect(normalizeDuration(0)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
  it("preserves sign for negative", () => {
    const p = normalizeDuration(-90);
    expect(p.minutes).toBe(-1);
    expect(p.seconds).toBe(-30);
  });
});

describe("tdc toDecimalHours / fromDecimalHours", () => {
  it("converts 90 minutes to 1.5 hours", () => {
    expect(toDecimalHours(90 * 60)).toBe(1.5);
  });
  it("converts 8h 15m to 8.25 hours", () => {
    expect(toDecimalHours(8 * 3600 + 15 * 60)).toBe(8.25);
  });
  it("converts 1.5 decimal hours back to 5400 seconds", () => {
    expect(fromDecimalHours(1.5)).toBe(5400);
  });
  it("converts 7.5 decimal hours back to 27000 seconds", () => {
    expect(fromDecimalHours(7.5)).toBe(27000);
  });
  it("rounds to nearest second on fractional decimal hours", () => {
    expect(fromDecimalHours(1.0001)).toBe(3600);
  });
});

describe("tdc formatHuman", () => {
  it("formats 0 as '0 seconds'", () => {
    expect(formatHuman(0)).toBe("0 seconds");
  });
  it("formats days + hours + minutes + seconds", () => {
    expect(formatHuman(86400 + 7200 + 180 + 4)).toBe("1 day, 2 hours, 3 minutes, 4 seconds");
  });
  it("formats singular units", () => {
    expect(formatHuman(3600 + 60 + 1)).toBe("1 hour, 1 minute, 1 second");
  });
  it("formats negative", () => {
    expect(formatHuman(-90)).toBe("-1 minute, 30 seconds");
  });
  it("returns empty for NaN", () => {
    expect(formatHuman(Number.NaN)).toBe("");
  });
});

describe("tdc formatCompact", () => {
  it("formats 0 as '0s'", () => {
    expect(formatCompact(0)).toBe("0s");
  });
  it("formats mixed as '1d2h3m4s'", () => {
    expect(formatCompact(86400 + 7200 + 180 + 4)).toBe("1d2h3m4s");
  });
  it("omits zero units", () => {
    expect(formatCompact(3600 + 60)).toBe("1h1m");
  });
  it("formats negative", () => {
    expect(formatCompact(-90)).toBe("-1m30s");
  });
});

describe("tdc addDurations", () => {
  it("adds two positive durations", () => {
    const r = addDurations({ hours: 1, minutes: 30 }, { hours: 2, minutes: 45 });
    expect(r.totalSeconds).toBe(3600 + 1800 + 7200 + 2700);
    expect(r.hms).toBe("04:15:00");
  });
  it("accepts number inputs (seconds)", () => {
    const r = addDurations(3600, 1800);
    expect(r.totalSeconds).toBe(5400);
  });
  it("summary contains both operands", () => {
    const r = addDurations({ hours: 1 }, { hours: 2 });
    expect(r.summary).toContain("1h");
    expect(r.summary).toContain("2h");
    expect(r.summary).toContain("3h");
  });
});

describe("tdc subtractDurations", () => {
  it("subtracts smaller from larger", () => {
    const r = subtractDurations({ hours: 5 }, { hours: 2, minutes: 30 });
    expect(r.totalSeconds).toBe(2 * 3600 + 30 * 60);
    expect(r.hms).toBe("02:30:00");
  });
  it("returns negative for underflow", () => {
    const r = subtractDurations({ hours: 1 }, { hours: 2 });
    expect(r.totalSeconds).toBe(-3600);
  });
});

describe("tdc multiplyDuration", () => {
  it("multiplies by integer", () => {
    const r = multiplyDuration({ hours: 2 }, 3);
    expect(r.totalSeconds).toBe(6 * 3600);
  });
  it("multiplies by decimal (truncates to integer seconds)", () => {
    const r = multiplyDuration({ hours: 1 }, 1.5);
    expect(r.totalSeconds).toBe(5400);
  });
});

describe("tdc divideDuration", () => {
  it("divides by integer", () => {
    const r = divideDuration({ hours: 4 }, 2);
    expect(r.totalSeconds).toBe(7200);
    expect(r.exactSeconds).toBe(7200);
  });
  it("divides producing fractional — exact preserved, total truncated", () => {
    const r = divideDuration({ hours: 1 }, 4);
    expect(r.exactSeconds).toBe(900);
    expect(r.totalSeconds).toBe(900);
  });
  it("division by zero returns zero", () => {
    const r = divideDuration({ hours: 1 }, 0);
    expect(r.totalSeconds).toBe(0);
    expect(r.summary).toContain("Division by zero");
  });
});

describe("tdc addInputs / subtractInputs", () => {
  it("addInputs adds two DurationInput objects", () => {
    const r = addInputs({ hours: 1 }, { minutes: 30 });
    expect(r.totalSeconds).toBe(5400);
  });
  it("subtractInputs subtracts two DurationInput objects", () => {
    const r = subtractInputs({ hours: 2 }, { minutes: 30 });
    expect(r.totalSeconds).toBe(5400);
  });
});

describe("tdc durationBetween", () => {
  it("same-day positive duration", () => {
    const r = durationBetween("09:00", "17:00");
    expect(r.totalSeconds).toBe(8 * 3600);
    expect(r.crossedMidnight).toBe(false);
  });
  it("detects cross-midnight when end < start", () => {
    const r = durationBetween("22:00", "02:00");
    expect(r.totalSeconds).toBe(4 * 3600);
    expect(r.crossedMidnight).toBe(true);
  });
  it("nextDay flag forces +24h when end == start", () => {
    const r = durationBetween("12:00", "12:00", { nextDay: true });
    expect(r.totalSeconds).toBe(24 * 3600);
    expect(r.crossedMidnight).toBe(true);
  });
  it("nextDay flag does not add 24h when end > start", () => {
    const r = durationBetween("09:00", "17:00", { nextDay: true });
    expect(r.totalSeconds).toBe(8 * 3600);
  });
  it("12h AM/PM format supported", () => {
    const r = durationBetween("9:00 AM", "5:00 PM");
    expect(r.totalSeconds).toBe(8 * 3600);
  });
  it("invalid start returns error summary", () => {
    const r = durationBetween("invalid", "17:00");
    expect(r.totalSeconds).toBe(0);
    expect(r.summary).toContain("Invalid");
  });
  it("invalid end returns error summary", () => {
    const r = durationBetween("09:00", "invalid");
    expect(r.totalSeconds).toBe(0);
    expect(r.summary).toContain("Invalid");
  });
});

describe("tdc computeTimesheetRow", () => {
  it("computes gross and net for simple row", () => {
    const r = computeTimesheetRow({ start: "09:00", end: "17:00", breakMinutes: 30 });
    expect(r.grossSeconds).toBe(8 * 3600);
    expect(r.netSeconds).toBe(8 * 3600 - 30 * 60);
    expect(r.crossedMidnight).toBe(false);
  });
  it("detects cross-midnight", () => {
    const r = computeTimesheetRow({ start: "22:00", end: "06:00", breakMinutes: 0 });
    expect(r.grossSeconds).toBe(8 * 3600);
    expect(r.crossedMidnight).toBe(true);
  });
  it("handles missing breakMinutes (default 0)", () => {
    const r = computeTimesheetRow({ start: "09:00", end: "17:00" });
    expect(r.breakMinutes).toBe(0);
    expect(r.netSeconds).toBe(8 * 3600);
  });
  it("handles negative break (clamped to 0)", () => {
    const r = computeTimesheetRow({ start: "09:00", end: "17:00", breakMinutes: -10 });
    expect(r.breakMinutes).toBe(0);
  });
  it("handles break larger than gross (net clamped to 0)", () => {
    const r = computeTimesheetRow({ start: "09:00", end: "10:00", breakMinutes: 120 });
    expect(r.netSeconds).toBe(0);
  });
  it("returns error for invalid times", () => {
    const r = computeTimesheetRow({ start: "invalid", end: "17:00" });
    expect(r.error).toBeTruthy();
    expect(r.grossSeconds).toBe(0);
  });
  it("preserves label", () => {
    const r = computeTimesheetRow({ start: "09:00", end: "17:00", label: "Monday" });
    expect(r.label).toBe("Monday");
  });
});

describe("tdc parseTimesheetRows", () => {
  it("parses 24h format with break and label", () => {
    const rows = parseTimesheetRows("09:00 17:00 30 lunch");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      start: "09:00", end: "17:00", breakMinutes: 30, label: "lunch",
    });
  });
  it("parses 12h format with AM/PM", () => {
    const rows = parseTimesheetRows("9:00 AM 5:00 PM 60 meeting");
    expect(rows[0].start).toBe("9:00 AM");
    expect(rows[0].end).toBe("5:00 PM");
    expect(rows[0].breakMinutes).toBe(60);
    expect(rows[0].label).toBe("meeting");
  });
  it("parses no-break row", () => {
    const rows = parseTimesheetRows("09:00 17:00");
    expect(rows[0].breakMinutes).toBe(0);
    expect(rows[0].label).toBe("");
  });
  it("parses multiple rows", () => {
    const rows = parseTimesheetRows("09:00 17:00 30\n22:00 06:00 0 night");
    expect(rows).toHaveLength(2);
    expect(rows[1].label).toBe("night");
  });
  it("returns empty for empty input", () => {
    expect(parseTimesheetRows("")).toEqual([]);
  });
  it("handles missing end (start only)", () => {
    const rows = parseTimesheetRows("09:00");
    expect(rows[0].start).toBe("09:00");
    expect(rows[0].end).toBe("");
  });
});

describe("tdc computeTimesheet", () => {
  it("totals multiple rows", () => {
    const total = computeTimesheet([
      { start: "09:00", end: "17:00", breakMinutes: 30 },
      { start: "10:00", end: "16:00", breakMinutes: 0 },
    ]);
    expect(total.rowCount).toBe(2);
    expect(total.totalGrossSeconds).toBe(8 * 3600 + 6 * 3600);
    expect(total.totalBreakSeconds).toBe(30 * 60);
    expect(total.totalSeconds).toBe(14 * 3600 - 30 * 60);
    expect(total.errorCount).toBe(0);
  });
  it("counts errors", () => {
    const total = computeTimesheet([
      { start: "invalid", end: "17:00" },
      { start: "09:00", end: "17:00" },
    ]);
    expect(total.errorCount).toBe(1);
    expect(total.rowCount).toBe(2);
  });
  it("handles empty list", () => {
    const total = computeTimesheet([]);
    expect(total.rowCount).toBe(0);
    expect(total.totalSeconds).toBe(0);
  });
});

describe("tdc renderTimesheetCsv / renderTimesheetText", () => {
  it("renderTimesheetCsv produces header and rows", () => {
    const total = computeTimesheet([
      { start: "09:00", end: "17:00", breakMinutes: 30, label: "lunch" },
    ]);
    const csv = renderTimesheetCsv(total);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("label,start,end,break_minutes,gross_seconds,net_seconds,crossed_midnight");
    expect(lines[1]).toBe("lunch,09:00,17:00,30,28800,27000,0");
    expect(csv).toContain("TOTALS,,,");
  });
  it("renderTimesheetCsv escapes labels with commas", () => {
    const total = computeTimesheet([
      { start: "09:00", end: "17:00", breakMinutes: 0, label: "team, sync" },
    ]);
    const csv = renderTimesheetCsv(total);
    expect(csv).toContain('"team, sync"');
  });
  it("renderTimesheetText includes net total", () => {
    const total = computeTimesheet([
      { start: "09:00", end: "17:00", breakMinutes: 30 },
    ]);
    const text = renderTimesheetText(total);
    expect(text).toContain("Net total");
    expect(text).toContain("Decimal hrs");
  });
});

describe("tdc roundToMinute / floorToMinute", () => {
  it("roundToMinute rounds 90s to 120s (2 min)", () => {
    expect(roundToMinute(90)).toBe(120);
  });
  it("roundToMinute rounds 30s to 60s (1 min)", () => {
    expect(roundToMinute(30)).toBe(60);
  });
  it("roundToMinute rounds 29s to 0s", () => {
    expect(roundToMinute(29)).toBe(0);
  });
  it("floorToMinute floors 90s to 60s (1 min)", () => {
    expect(floorToMinute(90)).toBe(60);
  });
  it("floorToMinute floors 119s to 60s", () => {
    expect(floorToMinute(119)).toBe(60);
  });
});

describe("tdc history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, mode: "arithmetic", summary: "test", totalSeconds: 3600 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, mode: "arithmetic", summary: `t${i}`, totalSeconds: i });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, mode: "arithmetic", summary: "x", totalSeconds: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("tdc shareable URL", () => {
  it("builds share URL for arithmetic mode when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      mode: "arithmetic",
      op: "add",
      aDays: 0, aHours: 1, aMinutes: 30, aSeconds: 0,
      bDays: 0, bHours: 2, bMinutes: 0, bSeconds: 0,
    });
    expect(url).toContain("mode=arithmetic");
    expect(url).toContain("op=add");
    expect(url).toContain("a=0%7C1%7C30%7C0");
    expect(url).toContain("b=0%7C2%7C0%7C0");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("builds share URL for between mode", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      mode: "between",
      start: "09:00",
      end: "17:00",
      nextDay: false,
    });
    expect(url).toContain("mode=between");
    expect(url).toContain("start=09%3A00");
    expect(url).toContain("end=17%3A00");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("builds share URL for timesheet mode", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      mode: "timesheet",
      rows: "09:00 17:00 30",
    });
    expect(url).toContain("mode=timesheet");
    expect(url).toContain("rows=09%3A00+17%3A00+30");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back for arithmetic", () => {
    const p = parseShareUrl("mode=arithmetic&op=add&a=0|1|30|0&b=0|2|0|0");
    expect(p?.mode).toBe("arithmetic");
    expect(p?.op).toBe("add");
    expect(p?.aHours).toBe(1);
    expect(p?.aMinutes).toBe(30);
    expect(p?.bHours).toBe(2);
  });
  it("parses share URL back for between", () => {
    const p = parseShareUrl("mode=between&start=09:00&end=17:00&nextDay=1");
    expect(p?.mode).toBe("between");
    expect(p?.start).toBe("09:00");
    expect(p?.end).toBe("17:00");
    expect(p?.nextDay).toBe(true);
  });
  it("parses share URL back for timesheet", () => {
    const p = parseShareUrl("mode=timesheet&rows=09%3A00%2017%3A00%2030");
    expect(p?.mode).toBe("timesheet");
    expect(p?.rows).toContain("09:00");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("strips leading # from hash", () => {
    const p = parseShareUrl("#mode=between&start=09:00&end=17:00");
    expect(p?.mode).toBe("between");
    expect(p?.start).toBe("09:00");
  });
});

describe("tdc integration scenarios", () => {
  it("full work day: 9am-5pm with 30-min lunch = 7.5 hours", () => {
    const r = durationBetween("09:00", "17:00");
    const net = r.totalSeconds - 30 * 60;
    expect(toDecimalHours(net)).toBe(7.5);
  });
  it("overnight shift: 22:00 to 06:00 = 8 hours", () => {
    const r = durationBetween("22:00", "06:00");
    expect(toDecimalHours(r.totalSeconds)).toBe(8);
  });
  it("timesheet with 3 rows totaling 24 hours", () => {
    const total = computeTimesheet([
      { start: "08:00", end: "16:00", breakMinutes: 30 },
      { start: "08:00", end: "16:00", breakMinutes: 30 },
      { start: "08:00", end: "16:00", breakMinutes: 30 },
    ]);
    expect(toDecimalHours(total.totalSeconds)).toBe(22.5); // 3 * 7.5
  });
  it("mixed-unit normalization: 75s + 75s = 2m30s", () => {
    const r = addDurations(parseDuration("75s"), parseDuration("75s"));
    expect(r.hms).toBe("00:02:30");
    expect(r.parts.minutes).toBe(2);
    expect(r.parts.seconds).toBe(30);
  });
});

// Suppress unused-import lint for type-only imports
export type _Unused =
  | ArithmeticResult
  | BetweenResult
  | TimesheetTotal
  | TimesheetRow
  | HistoryEntry
  | Operation
  | DurationInput;

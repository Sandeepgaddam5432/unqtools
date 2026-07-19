import { describe, it, expect, beforeEach } from "vitest";
import {
  PAY_PERIOD_TYPES,
  PAY_PERIOD_LABELS,
  PAY_PERIODS_PER_YEAR,
  BREAK_PRESETS,
  DEFAULT_OVERTIME_THRESHOLD,
  DEFAULT_OVERTIME_RATE,
  normalizeEmployeeName,
  clampNonNegative,
  round2,
  round4,
  isValidDate,
  isValidTime,
  timeToMinutes,
  minutesToTime,
  timeToHours,
  hoursToTime,
  formatHoursHuman,
  addDays,
  parseEntryLine,
  parseEntries,
  computeWorkedHours,
  computeOvertime,
  computeRegularPay,
  computeOvertimePay,
  computeGrossPay,
  computeEntryPays,
  computeTimesheet,
  dailyBreakdown,
  summaryStats,
  formatCurrency,
  formatHoursDecimal,
  renderText,
  renderCsv,
  renderHtml,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PayPeriodType,
  type TimesheetInput,
  type TimeEntry,
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

describe("timesheet-generator constants", () => {
  it("has 4 pay period types", () => {
    expect(PAY_PERIOD_TYPES).toHaveLength(4);
    expect(PAY_PERIOD_TYPES).toEqual(["weekly", "bi-weekly", "semi-monthly", "monthly"]);
  });
  it("has labels for each pay period", () => {
    expect(Object.keys(PAY_PERIOD_LABELS)).toHaveLength(4);
    expect(PAY_PERIOD_LABELS["bi-weekly"]).toBe("Bi-Weekly");
  });
  it("has periods-per-year presets", () => {
    expect(PAY_PERIODS_PER_YEAR["weekly"]).toBe(52);
    expect(PAY_PERIODS_PER_YEAR["bi-weekly"]).toBe(26);
    expect(PAY_PERIODS_PER_YEAR["semi-monthly"]).toBe(24);
    expect(PAY_PERIODS_PER_YEAR["monthly"]).toBe(12);
  });
  it("has 4 break presets", () => {
    expect(BREAK_PRESETS).toEqual([0, 30, 60, 90]);
  });
  it("has sensible defaults", () => {
    expect(DEFAULT_OVERTIME_THRESHOLD).toBe(40);
    expect(DEFAULT_OVERTIME_RATE).toBe(1.5);
  });
});

describe("timesheet-generator helpers", () => {
  it("normalizeEmployeeName collapses whitespace", () => {
    expect(normalizeEmployeeName("  John   Doe  ")).toBe("John Doe");
    expect(normalizeEmployeeName("")).toBe("");
  });
  it("clampNonNegative handles NaN/negative/zero", () => {
    expect(clampNonNegative(NaN)).toBe(0);
    expect(clampNonNegative(-5)).toBe(0);
    expect(clampNonNegative(0)).toBe(0);
    expect(clampNonNegative(7.5)).toBe(7.5);
  });
  it("round2 rounds to 2 decimals", () => {
    expect(round2(1.005)).toBeCloseTo(1.01, 2);
    expect(round2(2.345)).toBeCloseTo(2.35, 2);
    expect(round2(NaN)).toBe(0);
  });
  it("round4 rounds to 4 decimals", () => {
    expect(round4(1.23456)).toBeCloseTo(1.2346, 4);
    expect(round4(NaN)).toBe(0);
  });
});

describe("timesheet-generator isValidDate", () => {
  it("accepts valid YYYY-MM-DD", () => {
    expect(isValidDate("2026-07-13")).toBe(true);
  });
  it("rejects bad formats", () => {
    expect(isValidDate("13-07-2026")).toBe(false);
    expect(isValidDate("2026/07/13")).toBe(false);
    expect(isValidDate("")).toBe(false);
    expect(isValidDate("2026-13-40")).toBe(false); // impossible month/day
  });
});

describe("timesheet-generator isValidTime", () => {
  it("accepts valid HH:MM 24h", () => {
    expect(isValidTime("09:00")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
    expect(isValidTime("00:00")).toBe(true);
  });
  it("rejects bad times", () => {
    expect(isValidTime("9:00")).toBe(false);
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("12:60")).toBe(false);
    expect(isValidTime("")).toBe(false);
  });
});

describe("timesheet-generator time conversions", () => {
  it("timeToMinutes converts HH:MM to minutes", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("17:00")).toBe(1020);
    expect(timeToMinutes("bad")).toBe(-1);
  });
  it("minutesToTime converts minutes to HH:MM", () => {
    expect(minutesToTime(0)).toBe("00:00");
    expect(minutesToTime(570)).toBe("09:30");
    expect(minutesToTime(1020)).toBe("17:00");
  });
  it("minutesToTime wraps past 24h", () => {
    expect(minutesToTime(1500)).toBe("01:00"); // 25h → 01:00
    expect(minutesToTime(-30)).toBe("00:00"); // clamps
  });
  it("timeToHours converts HH:MM to decimal hours", () => {
    expect(timeToHours("01:30")).toBeCloseTo(1.5, 4);
    expect(timeToHours("08:00")).toBe(8);
    expect(timeToHours("bad")).toBe(0);
  });
  it("hoursToTime converts decimal hours to HH:MM", () => {
    expect(hoursToTime(1.5)).toBe("01:30");
    expect(hoursToTime(8)).toBe("08:00");
    expect(hoursToTime(-1)).toBe("00:00");
  });
  it("formatHoursHuman formats as Xh YYm", () => {
    expect(formatHoursHuman(8.5)).toBe("8h 30m");
    expect(formatHoursHuman(0)).toBe("0h 00m");
    expect(formatHoursHuman(-1)).toBe("0h 00m");
  });
  it("addDays shifts date by N days", () => {
    expect(addDays("2026-07-13", 1)).toBe("2026-07-14");
    expect(addDays("2026-07-13", 7)).toBe("2026-07-20");
    expect(addDays("2026-07-13", -1)).toBe("2026-07-12");
    expect(addDays("bad", 1)).toBe("bad");
  });
});

describe("timesheet-generator parseEntryLine", () => {
  it("parses a valid line", () => {
    const p = parseEntryLine("2026-07-13,09:00,17:30,30", 1);
    expect(p.ok).toBe(true);
    expect(p.entry).not.toBeNull();
    expect(p.entry!.date).toBe("2026-07-13");
    expect(p.entry!.clockIn).toBe("09:00");
    expect(p.entry!.clockOut).toBe("17:30");
    expect(p.entry!.breakMinutes).toBe(30);
    expect(p.error).toBeNull();
  });
  it("trims whitespace", () => {
    const p = parseEntryLine("  2026-07-13 , 09:00 , 17:30 , 30  ", 1);
    expect(p.ok).toBe(true);
    expect(p.entry!.clockIn).toBe("09:00");
  });
  it("rejects empty line", () => {
    const p = parseEntryLine("", 1);
    expect(p.ok).toBe(false);
    expect(p.entry).toBeNull();
  });
  it("rejects too few fields", () => {
    const p = parseEntryLine("2026-07-13,09:00,17:30", 1);
    expect(p.ok).toBe(false);
    expect(p.error).toContain("Expected 4 fields");
  });
  it("rejects invalid date", () => {
    const p = parseEntryLine("13-07-2026,09:00,17:30,30", 1);
    expect(p.ok).toBe(false);
    expect(p.error).toContain("Invalid date");
  });
  it("rejects invalid time", () => {
    const p = parseEntryLine("2026-07-13,9:00,17:30,30", 1);
    expect(p.ok).toBe(false);
    expect(p.error).toContain("Invalid clock-in");
  });
  it("rejects clock-out before clock-in", () => {
    const p = parseEntryLine("2026-07-13,17:00,09:00,30", 1);
    expect(p.ok).toBe(false);
    expect(p.error).toContain("must be after");
  });
  it("rejects break > span", () => {
    const p = parseEntryLine("2026-07-13,09:00,10:00,120", 1);
    expect(p.ok).toBe(false);
    expect(p.error).toContain("break");
  });
  it("rejects negative break", () => {
    const p = parseEntryLine("2026-07-13,09:00,17:30,-5", 1);
    expect(p.ok).toBe(false);
    expect(p.error).toContain("Invalid break");
  });
});

describe("timesheet-generator parseEntries", () => {
  it("parses multi-line block", () => {
    const text = "2026-07-13,09:00,17:30,30\n2026-07-14,09:00,17:00,30";
    const parsed = parseEntries(text);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].ok).toBe(true);
    expect(parsed[1].ok).toBe(true);
  });
  it("skips blank lines", () => {
    const text = "2026-07-13,09:00,17:30,30\n\n\n2026-07-14,09:00,17:00,30";
    const parsed = parseEntries(text);
    expect(parsed).toHaveLength(2);
  });
  it("returns empty for empty text", () => {
    expect(parseEntries("")).toEqual([]);
  });
  it("preserves errors alongside valid entries", () => {
    const text = "2026-07-13,09:00,17:30,30\nbad-line\n2026-07-14,09:00,17:00,30";
    const parsed = parseEntries(text);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].ok).toBe(true);
    expect(parsed[1].ok).toBe(false);
    expect(parsed[2].ok).toBe(true);
  });
  it("increments line numbers correctly with blanks", () => {
    const text = "2026-07-13,09:00,17:30,30\n\nbad";
    const parsed = parseEntries(text);
    expect(parsed[0].lineNo).toBe(1);
    expect(parsed[1].lineNo).toBe(3); // blank line skipped, lineNo still increments
  });
});

describe("timesheet-generator computeWorkedHours", () => {
  it("computes worked hours with break deduction", () => {
    const entry: TimeEntry = { date: "2026-07-13", clockIn: "09:00", clockOut: "17:30", breakMinutes: 30 };
    // 8.5 - 0.5 = 8.0
    expect(computeWorkedHours(entry)).toBeCloseTo(8, 4);
  });
  it("computes worked hours with no break", () => {
    const entry: TimeEntry = { date: "2026-07-13", clockIn: "09:00", clockOut: "12:00", breakMinutes: 0 };
    expect(computeWorkedHours(entry)).toBeCloseTo(3, 4);
  });
  it("returns 0 for invalid times", () => {
    const entry: TimeEntry = { date: "2026-07-13", clockIn: "bad", clockOut: "17:30", breakMinutes: 0 };
    expect(computeWorkedHours(entry)).toBe(0);
  });
  it("returns 0 when clockOut equals clockIn", () => {
    const entry: TimeEntry = { date: "2026-07-13", clockIn: "09:00", clockOut: "09:00", breakMinutes: 0 };
    expect(computeWorkedHours(entry)).toBe(0);
  });
});

describe("timesheet-generator computeOvertime", () => {
  it("returns all regular when under threshold", () => {
    const r = computeOvertime(35, 40);
    expect(r.regular).toBe(35);
    expect(r.overtime).toBe(0);
  });
  it("returns all regular when equal to threshold", () => {
    const r = computeOvertime(40, 40);
    expect(r.regular).toBe(40);
    expect(r.overtime).toBe(0);
  });
  it("splits when over threshold", () => {
    const r = computeOvertime(48, 40);
    expect(r.regular).toBe(40);
    expect(r.overtime).toBe(8);
  });
  it("handles 0 threshold", () => {
    const r = computeOvertime(8, 0);
    expect(r.regular).toBe(0);
    expect(r.overtime).toBe(8);
  });
});

describe("timesheet-generator pay calculators", () => {
  it("computeRegularPay = hours × rate", () => {
    expect(computeRegularPay(40, 25)).toBe(1000);
    expect(computeRegularPay(-5, 25)).toBe(0);
  });
  it("computeOvertimePay = hours × rate × multiplier", () => {
    expect(computeOvertimePay(8, 25, 1.5)).toBe(300);
    expect(computeOvertimePay(0, 25, 1.5)).toBe(0);
  });
  it("computeOvertimePay treats 0 multiplier as 1", () => {
    expect(computeOvertimePay(8, 25, 0)).toBe(200);
  });
  it("computeGrossPay = regular + overtime", () => {
    expect(computeGrossPay(1000, 300)).toBe(1300);
    expect(computeGrossPay(-1, -1)).toBe(0);
  });
});

describe("timesheet-generator computeEntryPays", () => {
  const entries: TimeEntry[] = [
    { date: "2026-07-13", clockIn: "09:00", clockOut: "17:00", breakMinutes: 0 }, // 8h
    { date: "2026-07-14", clockIn: "09:00", clockOut: "17:00", breakMinutes: 0 }, // 8h
    { date: "2026-07-15", clockIn: "09:00", clockOut: "17:00", breakMinutes: 0 }, // 8h
    { date: "2026-07-16", clockIn: "09:00", clockOut: "17:00", breakMinutes: 0 }, // 8h
    { date: "2026-07-17", clockIn: "09:00", clockOut: "17:00", breakMinutes: 0 }, // 8h
    { date: "2026-07-18", clockIn: "09:00", clockOut: "17:00", breakMinutes: 0 }, // 8h → total 48, OT 8
  ];

  it("allocates regular hours first then overtime", () => {
    const pays = computeEntryPays(entries, 25, 40, 1.5);
    // First 5 entries × 8h = 40 regular. Last entry: 0 reg + 8 OT.
    expect(pays[0].regularHours).toBe(8);
    expect(pays[0].overtimeHours).toBe(0);
    expect(pays[5].regularHours).toBe(0);
    expect(pays[5].overtimeHours).toBe(8);
  });
  it("computes pay per entry correctly", () => {
    const pays = computeEntryPays(entries, 25, 40, 1.5);
    expect(pays[0].pay).toBe(200); // 8 × 25
    expect(pays[5].pay).toBe(300); // 8 × 25 × 1.5
  });
  it("returns empty for no entries", () => {
    expect(computeEntryPays([], 25, 40, 1.5)).toEqual([]);
  });
  it("sorts by date for OT allocation", () => {
    // Reversed input should still produce same allocation by date
    const reversed = [...entries].reverse();
    const pays = computeEntryPays(reversed, 25, 40, 1.5);
    // Find the entry on 2026-07-18 (last date)
    const last = pays.find((p) => p.entry.date === "2026-07-18")!;
    expect(last.regularHours).toBe(0);
    expect(last.overtimeHours).toBe(8);
  });
});

describe("timesheet-generator computeTimesheet", () => {
  const input: TimesheetInput = {
    employeeName: "Jane Doe",
    weekStartDate: "2026-07-13",
    payPeriodType: "weekly",
    entriesText: [
      "2026-07-13,09:00,17:00,30", // 7.5
      "2026-07-14,09:00,17:00,30", // 7.5
      "2026-07-15,09:00,17:00,30", // 7.5
      "2026-07-16,09:00,17:00,30", // 7.5
      "2026-07-17,09:00,17:00,30", // 7.5  → 37.5 reg, no OT
    ].join("\n"),
    hourlyRate: 20,
    overtimeThreshold: 40,
    overtimeRate: 1.5,
  };

  it("computes totals correctly", () => {
    const r = computeTimesheet(input);
    expect(r.employeeName).toBe("Jane Doe");
    expect(r.entries).toHaveLength(5);
    expect(r.totalWorkedHours).toBeCloseTo(37.5, 4);
    expect(r.totalRegularHours).toBeCloseTo(37.5, 4);
    expect(r.totalOvertimeHours).toBe(0);
    expect(r.daysWorked).toBe(5);
    expect(r.totalBreakMinutes).toBe(150);
    expect(r.grossPay).toBe(750); // 37.5 × 20
  });

  it("flags overtime when threshold exceeded", () => {
    const input2: TimesheetInput = {
      ...input,
      entriesText: [
        "2026-07-13,08:00,18:00,30", // 9.5h
        "2026-07-14,08:00,18:00,30",
        "2026-07-15,08:00,18:00,30",
        "2026-07-16,08:00,18:00,30",
        "2026-07-17,08:00,18:00,30", // total 47.5h → 7.5 OT
      ].join("\n"),
    };
    const r = computeTimesheet(input2);
    expect(r.totalWorkedHours).toBeCloseTo(47.5, 4);
    expect(r.totalRegularHours).toBe(40);
    expect(r.totalOvertimeHours).toBeCloseTo(7.5, 4);
    expect(r.grossPay).toBeCloseTo(40 * 20 + 7.5 * 20 * 1.5, 2); // 800 + 225 = 1025
  });

  it("collects parse errors", () => {
    const bad: TimesheetInput = {
      ...input,
      entriesText: "2026-07-13,09:00,17:00,30\nbad-line\n2026-07-14,09:00,17:00,30",
    };
    const r = computeTimesheet(bad);
    expect(r.errors).toHaveLength(1);
    expect(r.entries).toHaveLength(2);
  });

  it("handles empty entries", () => {
    const r = computeTimesheet({ ...input, entriesText: "" });
    expect(r.entries).toEqual([]);
    expect(r.totalWorkedHours).toBe(0);
    expect(r.grossPay).toBe(0);
    expect(r.daysWorked).toBe(0);
  });

  it("handles no hourly rate (hours-only mode)", () => {
    const r = computeTimesheet({ ...input, hourlyRate: 0 });
    expect(r.grossPay).toBe(0);
    expect(r.entries[0].pay).toBe(0);
    expect(r.notes.some((n) => n.includes("No hourly rate"))).toBe(true);
  });

  it("defaults employee name when blank", () => {
    const r = computeTimesheet({ ...input, employeeName: "   " });
    expect(r.employeeName).toBe("Employee");
  });
});

describe("timesheet-generator dailyBreakdown", () => {
  it("groups entries by date", () => {
    const input: TimesheetInput = {
      employeeName: "X",
      weekStartDate: "2026-07-13",
      payPeriodType: "weekly",
      entriesText: [
        "2026-07-13,09:00,12:00,0", // 3h
        "2026-07-13,13:00,17:00,0", // 4h → 7h total
        "2026-07-14,09:00,17:00,30", // 7.5h
      ].join("\n"),
      hourlyRate: 20,
      overtimeThreshold: 40,
      overtimeRate: 1.5,
    };
    const r = computeTimesheet(input);
    const days = dailyBreakdown(r);
    expect(days).toHaveLength(2);
    expect(days[0].date).toBe("2026-07-13");
    expect(days[0].entryCount).toBe(2);
    expect(days[0].workedHours).toBeCloseTo(7, 4);
    expect(days[1].date).toBe("2026-07-14");
    expect(days[1].workedHours).toBeCloseTo(7.5, 4);
  });
  it("returns empty for no entries", () => {
    const r = computeTimesheet({
      employeeName: "X",
      weekStartDate: "2026-07-13",
      payPeriodType: "weekly",
      entriesText: "",
      hourlyRate: 0,
      overtimeThreshold: 40,
      overtimeRate: 1.5,
    });
    expect(dailyBreakdown(r)).toEqual([]);
  });
});

describe("timesheet-generator summaryStats", () => {
  it("computes summary stats", () => {
    const input: TimesheetInput = {
      employeeName: "X",
      weekStartDate: "2026-07-13",
      payPeriodType: "weekly",
      entriesText: [
        "2026-07-13,09:00,17:00,0", // 8
        "2026-07-14,09:00,17:00,0", // 8
        "2026-07-15,09:00,17:00,0", // 8
        "2026-07-16,09:00,17:00,0", // 8
        "2026-07-17,09:00,17:00,0", // 8
        "2026-07-18,09:00,17:00,0", // 8 → 48 total, 8 OT
      ].join("\n"),
      hourlyRate: 25,
      overtimeThreshold: 40,
      overtimeRate: 1.5,
    };
    const r = computeTimesheet(input);
    const s = summaryStats(r);
    expect(s.totalHours).toBeCloseTo(48, 4);
    expect(s.regularHours).toBe(40);
    expect(s.overtimeHours).toBe(8);
    expect(s.daysWorked).toBe(6);
    expect(s.entryCount).toBe(6);
    expect(s.errorCount).toBe(0);
    expect(s.avgHoursPerDay).toBe(8);
    expect(s.hasOvertime).toBe(true);
    expect(s.grossPay).toBe(40 * 25 + 8 * 25 * 1.5);
  });
});

describe("timesheet-generator formatting", () => {
  it("formatCurrency formats with $ and 2 decimals", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
    expect(formatCurrency(-25)).toBe("-$25.00");
    expect(formatCurrency(0)).toBe("$0.00");
  });
  it("formatHoursDecimal formats with 2 decimals", () => {
    expect(formatHoursDecimal(8.5)).toBe("8.50 hrs");
    expect(formatHoursDecimal(0)).toBe("0.00 hrs");
  });
});

describe("timesheet-generator renderText", () => {
  it("renders a text timesheet", () => {
    const r = computeTimesheet({
      employeeName: "Jane",
      weekStartDate: "2026-07-13",
      payPeriodType: "weekly",
      entriesText: "2026-07-13,09:00,17:00,30",
      hourlyRate: 20,
      overtimeThreshold: 40,
      overtimeRate: 1.5,
    });
    const text = renderText(r);
    expect(text).toContain("TIMESHEET");
    expect(text).toContain("Jane");
    expect(text).toContain("2026-07-13");
    expect(text).toContain("WEEKLY SUMMARY");
    expect(text).toContain("7.50 hrs");
  });
  it("renders 'no valid entries' when empty", () => {
    const r = computeTimesheet({
      employeeName: "X",
      weekStartDate: "2026-07-13",
      payPeriodType: "weekly",
      entriesText: "",
      hourlyRate: 0,
      overtimeThreshold: 40,
      overtimeRate: 1.5,
    });
    const text = renderText(r);
    expect(text).toContain("(no valid entries)");
  });
});

describe("timesheet-generator renderCsv", () => {
  it("renders header and rows", () => {
    const r = computeTimesheet({
      employeeName: "Jane",
      weekStartDate: "2026-07-13",
      payPeriodType: "weekly",
      entriesText: "2026-07-13,09:00,17:00,30",
      hourlyRate: 20,
      overtimeThreshold: 40,
      overtimeRate: 1.5,
    });
    const csv = renderCsv(r);
    expect(csv).toContain("date,clock_in,clock_out,break_minutes,hours,regular_hours,overtime_hours,pay");
    expect(csv).toContain("2026-07-13,09:00,17:00,30");
    expect(csv).toContain("# employee,Jane");
    expect(csv).toContain("# gross_pay,150.00");
  });
});

describe("timesheet-generator renderHtml", () => {
  it("renders a valid HTML document", () => {
    const r = computeTimesheet({
      employeeName: "Jane",
      weekStartDate: "2026-07-13",
      payPeriodType: "weekly",
      entriesText: "2026-07-13,09:00,17:00,30",
      hourlyRate: 20,
      overtimeThreshold: 40,
      overtimeRate: 1.5,
    });
    const html = renderHtml(r);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>Timesheet");
    expect(html).toContain("Jane");
    expect(html).toContain("</html>");
  });
  it("escapes HTML in employee name", () => {
    const r = computeTimesheet({
      employeeName: "<script>alert(1)</script>",
      weekStartDate: "2026-07-13",
      payPeriodType: "weekly",
      entriesText: "",
      hourlyRate: 0,
      overtimeThreshold: 40,
      overtimeRate: 1.5,
    });
    const html = renderHtml(r);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("timesheet-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      employeeName: "Jane",
      weekStartDate: "2026-07-13",
      payPeriodType: "weekly",
      totalHours: 40,
      grossPay: 1000,
      daysWorked: 5,
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].employeeName).toBe("Jane");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        employeeName: `Emp${i}`,
        weekStartDate: "2026-07-13",
        payPeriodType: "weekly",
        totalHours: 40,
        grossPay: 1000,
        daysWorked: 5,
      });
    }
    expect(loadHistory()).toHaveLength(20);
    // Newest first
    expect(loadHistory()[0].employeeName).toBe("Emp24");
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      employeeName: "Jane",
      weekStartDate: "2026-07-13",
      payPeriodType: "weekly",
      totalHours: 40,
      grossPay: 1000,
      daysWorked: 5,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("timesheet-generator shareable URL", () => {
  it("builds share URL with all params", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const input: TimesheetInput = {
      employeeName: "Jane Doe",
      weekStartDate: "2026-07-13",
      payPeriodType: "weekly",
      entriesText: "2026-07-13,09:00,17:00,30",
      hourlyRate: 20,
      overtimeThreshold: 40,
      overtimeRate: 1.5,
    };
    const url = buildShareUrl(input);
    expect(url).toContain("employeeName=Jane+Doe");
    expect(url).toContain("weekStartDate=2026-07-13");
    expect(url).toContain("payPeriodType=weekly");
    expect(url).toContain("hourlyRate=20");
    expect(url).toContain("overtimeThreshold=40");
    expect(url).toContain("overtimeRate=1.5");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("parses share URL back", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const input: TimesheetInput = {
      employeeName: "Jane",
      weekStartDate: "2026-07-13",
      payPeriodType: "weekly",
      entriesText: "2026-07-13,09:00,17:00,30",
      hourlyRate: 20,
      overtimeThreshold: 40,
      overtimeRate: 1.5,
    };
    const url = buildShareUrl(input);
    (globalThis as Record<string, unknown>).window = origWindow;

    const parsed = parseShareUrl(url);
    expect(parsed.employeeName).toBe("Jane");
    expect(parsed.weekStartDate).toBe("2026-07-13");
    expect(parsed.payPeriodType).toBe("weekly");
    expect(parsed.entriesText).toBe("2026-07-13,09:00,17:00,30");
    expect(parsed.hourlyRate).toBe(20);
    expect(parsed.overtimeThreshold).toBe(40);
    expect(parsed.overtimeRate).toBe(1.5);
  });

  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });

  it("filters unknown pay period type", () => {
    const parsed = parseShareUrl("payPeriodType=invalid&employeeName=X");
    expect(parsed.payPeriodType).toBeUndefined();
    expect(parsed.employeeName).toBe("X");
  });

  it("ignores non-numeric rate", () => {
    const parsed = parseShareUrl("hourlyRate=abc");
    expect(parsed.hourlyRate).toBeUndefined();
  });
});

// Suppress unused-import lint
export type _Unused = PayPeriodType;

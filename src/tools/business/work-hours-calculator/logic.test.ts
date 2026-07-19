import { describe, it, expect, beforeEach } from "vitest";
import {
  SHIFT_PRESETS,
  BREAK_PRESETS,
  DEFAULT_INPUT,
  RATE_PRESETS,
  parseTime,
  formatTime,
  detectOvernight,
  computeSpanMinutes,
  computeWorkedMinutes,
  computeOvertimeSplit,
  computePay,
  computeEffectiveRate,
  calculate,
  summaryStats,
  formatMoney,
  formatHours,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type WorkHoursInput,
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

describe("work-hours-calculator constants", () => {
  it("has 6 shift presets", () => {
    expect(SHIFT_PRESETS).toHaveLength(6);
  });
  it("has a night preset marked overnight", () => {
    const night = SHIFT_PRESETS.find((p) => p.id === "night22to6");
    expect(night).toBeDefined();
    expect(night!.overnight).toBe(true);
  });
  it("has break presets", () => {
    expect(BREAK_PRESETS).toEqual([0, 15, 30, 60, 90]);
  });
  it("has rate presets", () => {
    expect(RATE_PRESETS.length).toBeGreaterThanOrEqual(5);
    expect(RATE_PRESETS).toContain(0);
  });
  it("has a default input", () => {
    expect(DEFAULT_INPUT.startTime).toBe("09:00");
    expect(DEFAULT_INPUT.endTime).toBe("17:00");
    expect(DEFAULT_INPUT.dateFormat).toBe("24h");
    expect(DEFAULT_INPUT.overtimeRateMultiplier).toBe(1.5);
  });
});

describe("work-hours-calculator parseTime", () => {
  it("parses 24h format with leading zero", () => {
    expect(parseTime("09:30")).toBe(9 * 60 + 30);
  });
  it("parses 24h format without leading zero", () => {
    expect(parseTime("9:30")).toBe(9 * 60 + 30);
  });
  it("parses bare hour (24h)", () => {
    expect(parseTime("9")).toBe(9 * 60);
  });
  it("parses 12:00 AM as midnight", () => {
    expect(parseTime("12:00 am")).toBe(0);
  });
  it("parses 12:00 PM as noon", () => {
    expect(parseTime("12:00 pm")).toBe(12 * 60);
  });
  it("parses 9:30 PM", () => {
    expect(parseTime("9:30 PM")).toBe(21 * 60 + 30);
  });
  it("parses 9pm without minutes", () => {
    expect(parseTime("9pm")).toBe(21 * 60);
  });
  it("parses 12am as midnight", () => {
    expect(parseTime("12am")).toBe(0);
  });
  it("parses 23:59 (max)", () => {
    expect(parseTime("23:59")).toBe(23 * 60 + 59);
  });
  it("returns null for invalid time", () => {
    expect(parseTime("25:00")).toBeNull();
    expect(parseTime("9:60")).toBeNull();
    expect(parseTime("foo")).toBeNull();
    expect(parseTime("")).toBeNull();
  });
  it("rejects hour 13 with AM", () => {
    expect(parseTime("13:00 am")).toBeNull();
  });
});

describe("work-hours-calculator formatTime", () => {
  it("formats 24h", () => {
    expect(formatTime(9 * 60 + 30, "24h")).toBe("09:30");
    expect(formatTime(0, "24h")).toBe("00:00");
    expect(formatTime(23 * 60 + 59, "24h")).toBe("23:59");
  });
  it("formats 12h", () => {
    expect(formatTime(9 * 60 + 30, "12h")).toBe("9:30 AM");
    expect(formatTime(0, "12h")).toBe("12:00 AM");
    expect(formatTime(12 * 60, "12h")).toBe("12:00 PM");
    expect(formatTime(21 * 60 + 30, "12h")).toBe("9:30 PM");
  });
  it("wraps negative minutes", () => {
    expect(formatTime(-30, "24h")).toBe("23:30");
  });
  it("wraps > 24h minutes", () => {
    expect(formatTime(24 * 60 + 30, "24h")).toBe("00:30");
  });
  it("returns --:-- for non-finite", () => {
    expect(formatTime(Number.NaN, "24h")).toBe("--:--");
  });
});

describe("work-hours-calculator detectOvernight + span", () => {
  it("detects end < start as overnight", () => {
    expect(detectOvernight(22 * 60, 6 * 60)).toBe(true);
  });
  it("does not flag when end > start", () => {
    expect(detectOvernight(9 * 60, 17 * 60)).toBe(false);
  });
  it("computeSpanMinutes handles same-day shift", () => {
    expect(computeSpanMinutes(9 * 60, 17 * 60, false)).toBe(8 * 60);
  });
  it("computeSpanMinutes adds 24h when overnight", () => {
    expect(computeSpanMinutes(22 * 60, 6 * 60, true)).toBe(8 * 60);
  });
  it("computeSpanMinutes does NOT add 24h when not overnight (even if end<start)", () => {
    expect(computeSpanMinutes(22 * 60, 6 * 60, false)).toBe(-16 * 60);
  });
  it("computeSpanMinutes handles null inputs", () => {
    expect(computeSpanMinutes(null, 6 * 60, false)).toBe(0);
    expect(computeSpanMinutes(22 * 60, null, false)).toBe(0);
  });
});

describe("work-hours-calculator computeWorkedMinutes + OT split", () => {
  it("subtracts break", () => {
    expect(computeWorkedMinutes(8 * 60, 30)).toBe(7 * 60 + 30);
  });
  it("clamps to >= 0 when break > span", () => {
    expect(computeWorkedMinutes(60, 120)).toBe(0);
  });
  it("clamps negative break to 0", () => {
    expect(computeWorkedMinutes(8 * 60, -30)).toBe(8 * 60);
  });
  it("splits below threshold as all regular", () => {
    expect(computeOvertimeSplit(7 * 60, 8)).toEqual({
      regularMinutes: 7 * 60,
      overtimeMinutes: 0,
    });
  });
  it("splits above threshold", () => {
    expect(computeOvertimeSplit(10 * 60, 8)).toEqual({
      regularMinutes: 8 * 60,
      overtimeMinutes: 2 * 60,
    });
  });
  it("handles 0 threshold (all overtime)", () => {
    expect(computeOvertimeSplit(8 * 60, 0)).toEqual({
      regularMinutes: 0,
      overtimeMinutes: 8 * 60,
    });
  });
});

describe("work-hours-calculator computePay + effectiveRate", () => {
  it("computes pay for regular only", () => {
    expect(computePay(8, 0, 20, 1.5)).toEqual({
      regularPay: 160,
      overtimePay: 0,
      totalPay: 160,
    });
  });
  it("computes pay for regular + overtime", () => {
    expect(computePay(8, 2, 20, 1.5)).toEqual({
      regularPay: 160,
      overtimePay: 60,
      totalPay: 220,
    });
  });
  it("handles zero rate", () => {
    expect(computePay(8, 2, 0, 1.5)).toEqual({
      regularPay: 0,
      overtimePay: 0,
      totalPay: 0,
    });
  });
  it("effective rate is totalPay / workedHours", () => {
    expect(computeEffectiveRate(220, 10)).toBe(22);
  });
  it("effective rate is 0 when workedHours is 0", () => {
    expect(computeEffectiveRate(100, 0)).toBe(0);
  });
});

describe("work-hours-calculator calculate (end-to-end)", () => {
  it("calculates a standard 9-5 with 30 min break", () => {
    const r = calculate({
      startTime: "09:00",
      endTime: "17:00",
      breakMinutes: 30,
      overnightShift: false,
      hourlyRate: 20,
      overtimeAfterHours: 8,
      overtimeRateMultiplier: 1.5,
      dateFormat: "24h",
    });
    expect(r.startMinutes).toBe(9 * 60);
    expect(r.endMinutes).toBe(17 * 60);
    expect(r.spanMinutes).toBe(8 * 60);
    expect(r.workedMinutes).toBe(7 * 60 + 30);
    expect(r.workedHours).toBe(7.5);
    expect(r.regularHours).toBe(7.5);
    expect(r.overtimeHours).toBe(0);
    expect(r.regularPay).toBe(150);
    expect(r.overtimePay).toBe(0);
    expect(r.totalPay).toBe(150);
    expect(r.effectiveRate).toBe(20);
    expect(r.isOvernight).toBe(false);
    expect(r.hasOvertime).toBe(false);
    expect(r.errors).toEqual([]);
  });

  it("calculates an overnight shift 22-06 with break", () => {
    const r = calculate({
      startTime: "22:00",
      endTime: "06:00",
      breakMinutes: 30,
      overnightShift: true,
      hourlyRate: 25,
      overtimeAfterHours: 8,
      overtimeRateMultiplier: 1.5,
      dateFormat: "24h",
    });
    expect(r.spanMinutes).toBe(8 * 60);
    expect(r.workedMinutes).toBe(7 * 60 + 30);
    expect(r.workedHours).toBe(7.5);
    expect(r.isOvernight).toBe(true);
    expect(r.totalPay).toBe(187.5);
  });

  it("auto-detects overnight when end < start", () => {
    const r = calculate({
      ...DEFAULT_INPUT,
      startTime: "22:00",
      endTime: "06:00",
      overnightShift: false,
      hourlyRate: 0,
    });
    expect(r.isOvernight).toBe(true);
    expect(r.spanMinutes).toBe(8 * 60);
  });

  it("calculates overtime above 8h threshold", () => {
    const r = calculate({
      startTime: "09:00",
      endTime: "20:00", // 11h span
      breakMinutes: 30,
      overnightShift: false,
      hourlyRate: 20,
      overtimeAfterHours: 8,
      overtimeRateMultiplier: 1.5,
      dateFormat: "24h",
    });
    expect(r.spanMinutes).toBe(11 * 60);
    expect(r.workedMinutes).toBe(10 * 60 + 30);
    expect(r.regularHours).toBe(8);
    expect(r.overtimeHours).toBe(2.5);
    expect(r.regularPay).toBe(160);
    expect(r.overtimePay).toBe(75); // 2.5 * 20 * 1.5
    expect(r.totalPay).toBe(235);
    expect(r.hasOvertime).toBe(true);
  });

  it("returns errors for invalid times", () => {
    const r = calculate({
      ...DEFAULT_INPUT,
      startTime: "foo",
      endTime: "bar",
    });
    expect(r.startMinutes).toBeNull();
    expect(r.endMinutes).toBeNull();
    expect(r.workedHours).toBe(0);
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("flags break longer than span as error", () => {
    const r = calculate({
      ...DEFAULT_INPUT,
      startTime: "09:00",
      endTime: "10:00", // 1h span
      breakMinutes: 120,
    });
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.workedMinutes).toBe(0); // clamped
  });

  it("works without hourly rate (no pay section)", () => {
    const r = calculate({
      ...DEFAULT_INPUT,
      hourlyRate: 0,
    });
    expect(r.hasRate).toBe(false);
    expect(r.totalPay).toBe(0);
    expect(r.workedHours).toBe(7.5);
  });

  it("works with 12h input formats", () => {
    const r = calculate({
      startTime: "9:00 AM",
      endTime: "5:30 PM",
      breakMinutes: 30,
      overnightShift: false,
      hourlyRate: 20,
      overtimeAfterHours: 8,
      overtimeRateMultiplier: 1.5,
      dateFormat: "12h",
    });
    expect(r.startMinutes).toBe(9 * 60);
    expect(r.endMinutes).toBe(17 * 60 + 30);
    expect(r.spanMinutes).toBe(8 * 60 + 30);
    expect(r.workedHours).toBe(8);
  });
});

describe("work-hours-calculator summaryStats + formatters", () => {
  it("extracts summary stats", () => {
    const r = calculate({
      startTime: "09:00",
      endTime: "20:00",
      breakMinutes: 30,
      overnightShift: false,
      hourlyRate: 20,
      overtimeAfterHours: 8,
      overtimeRateMultiplier: 1.5,
      dateFormat: "24h",
    });
    const s = summaryStats(r);
    expect(s.workedHours).toBeCloseTo(10.5, 5);
    expect(s.regularHours).toBe(8);
    expect(s.overtimeHours).toBe(2.5);
    expect(s.totalPay).toBe(235);
    expect(s.hasRate).toBe(true);
    expect(s.hasOvertime).toBe(true);
  });
  it("formatMoney rounds to 2 decimals", () => {
    expect(formatMoney(123.456)).toBe("123.46");
    expect(formatMoney(0)).toBe("0.00");
  });
  it("formatHours rounds to 2 decimals", () => {
    expect(formatHours(7.5)).toBe("7.50");
    expect(formatHours(0)).toBe("0.00");
  });
});

describe("work-hours-calculator renderText + renderCsv", () => {
  const input: WorkHoursInput = {
    startTime: "09:00",
    endTime: "20:00",
    breakMinutes: 30,
    overnightShift: false,
    hourlyRate: 20,
    overtimeAfterHours: 8,
    overtimeRateMultiplier: 1.5,
    dateFormat: "24h",
  };
  const result = calculate(input);

  it("renderText contains key lines", () => {
    const txt = renderText(input, result);
    expect(txt).toContain("Work Hours Report");
    expect(txt).toContain("Worked hours:");
    expect(txt).toContain("Total pay:");
    expect(txt).toContain("Effective rate:");
  });

  it("renderText shows 12h format when dateFormat=12h", () => {
    const i2: WorkHoursInput = { ...input, dateFormat: "12h" };
    const txt = renderText(i2, result);
    expect(txt).toContain("9:00 AM");
    expect(txt).toContain("8:00 PM");
  });

  it("renderText includes errors when present", () => {
    const badInput: WorkHoursInput = { ...input, startTime: "foo" };
    const badResult = calculate(badInput);
    const txt = renderText(badInput, badResult);
    expect(txt).toContain("Errors:");
    expect(txt).toContain('Invalid start time');
  });

  it("renderCsv has header", () => {
    const csv = renderCsv(input, result);
    expect(csv.split("\n")[0]).toBe("component,value");
  });

  it("renderCsv has worked_hours and total_pay rows", () => {
    const csv = renderCsv(input, result);
    expect(csv).toContain("worked_hours,10.50");
    expect(csv).toContain("total_pay,235.00");
  });

  it("renderCsv omits pay rows when rate is 0", () => {
    const noRate: WorkHoursInput = { ...input, hourlyRate: 0 };
    const noRateResult = calculate(noRate);
    const csv = renderCsv(noRate, noRateResult);
    expect(csv).not.toContain("total_pay");
    expect(csv).not.toContain("hourly_rate");
  });
});

describe("work-hours-calculator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      startTime: "09:00",
      endTime: "17:00",
      breakMinutes: 30,
      overnightShift: false,
      hourlyRate: 20,
      overtimeAfterHours: 8,
      overtimeRateMultiplier: 1.5,
      dateFormat: "24h",
      workedHours: 7.5,
      totalPay: 150,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        startTime: "09:00",
        endTime: "17:00",
        breakMinutes: 30,
        overnightShift: false,
        hourlyRate: 20,
        overtimeAfterHours: 8,
        overtimeRateMultiplier: 1.5,
        dateFormat: "24h",
        workedHours: 7.5,
        totalPay: 150,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      startTime: "09:00",
      endTime: "17:00",
      breakMinutes: 30,
      overnightShift: false,
      hourlyRate: 20,
      overtimeAfterHours: 8,
      overtimeRateMultiplier: 1.5,
      dateFormat: "24h",
      workedHours: 7.5,
      totalPay: 150,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("work-hours-calculator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      startTime: "09:00",
      endTime: "17:00",
      breakMinutes: 30,
      overnightShift: false,
      hourlyRate: 20,
      overtimeAfterHours: 8,
      overtimeRateMultiplier: 1.5,
      dateFormat: "24h",
    });
    expect(url).toContain("start=09");
    expect(url).toContain("end=17");
    expect(url).toContain("break=30");
    expect(url).toContain("rate=20");
    expect(url).toContain("fmt=24h");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("parses share URL back", () => {
    const url = "start=22%3A00&end=06%3A00&break=30&overnight=1&rate=25&otAfter=8&otMult=1.5&fmt=12h";
    const p = parseShareUrl(url);
    expect(p.startTime).toBe("22:00");
    expect(p.endTime).toBe("06:00");
    expect(p.breakMinutes).toBe(30);
    expect(p.overnightShift).toBe(true);
    expect(p.hourlyRate).toBe(25);
    expect(p.overtimeAfterHours).toBe(8);
    expect(p.overtimeRateMultiplier).toBe(1.5);
    expect(p.dateFormat).toBe("12h");
  });

  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.startTime).toBe(DEFAULT_INPUT.startTime);
    expect(p.dateFormat).toBe(DEFAULT_INPUT.dateFormat);
  });

  it("falls back to defaults for missing params", () => {
    const p = parseShareUrl("start=10%3A00");
    expect(p.startTime).toBe("10:00");
    expect(p.endTime).toBe(DEFAULT_INPUT.endTime);
    expect(p.breakMinutes).toBe(DEFAULT_INPUT.breakMinutes);
  });

  it("sanitizes invalid fmt to 24h", () => {
    const p = parseShareUrl("fmt=bogus");
    expect(p.dateFormat).toBe("24h");
  });

  it("sanitizes non-numeric rate to 0", () => {
    const p = parseShareUrl("rate=abc");
    expect(p.hourlyRate).toBe(0);
  });
});

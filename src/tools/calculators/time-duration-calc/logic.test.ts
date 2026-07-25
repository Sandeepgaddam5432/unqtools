import { describe, it, expect } from "vitest";
import {
  parseTime, parseDateTime, durationMinutes, durationMinutesMultiDay,
  breakMinutes, formatDuration, toDecimalHours, toHHMM,
  computeDuration, computePayroll, batchCompute, batchToCsv,
  isValidRange, fmt,
} from "./logic";

describe("parseTime", () => {
  it("parses HH:MM", () => {
    expect(parseTime("09:30")).toBe(570);
  });
  it("returns null for invalid input", () => {
    expect(parseTime("abc")).toBeNull();
  });
  it("rejects out-of-range", () => {
    expect(parseTime("25:00")).toBeNull();
    expect(parseTime("12:60")).toBeNull();
  });
});

describe("parseDateTime", () => {
  it("parses ISO datetime", () => {
    expect(parseDateTime("2024-01-01T09:00:00")).not.toBeNull();
  });
  it("returns null for invalid", () => {
    expect(parseDateTime("notadate")).toBeNull();
  });
});

describe("durationMinutes", () => {
  it("computes same-day difference", () => {
    expect(durationMinutes("09:00", "17:00")).toBe(480);
  });
  it("handles overnight", () => {
    expect(durationMinutes("22:00", "02:00")).toBe(240);
  });
  it("returns null for invalid input", () => {
    expect(durationMinutes("xx", "17:00")).toBeNull();
  });
});

describe("durationMinutesMultiDay", () => {
  it("computes across days", () => {
    const mins = durationMinutesMultiDay("2024-01-01T09:00:00", "2024-01-02T09:00:00");
    expect(mins).toBe(1440);
  });
  it("returns null for invalid input", () => {
    expect(durationMinutesMultiDay("x", "y")).toBeNull();
  });
});

describe("breakMinutes", () => {
  it("sums break durations", () => {
    expect(breakMinutes([{ start: "12:00", end: "12:30" }, { start: "15:00", end: "15:15" }])).toBe(45);
  });
  it("ignores invalid breaks", () => {
    expect(breakMinutes([{ start: "abc", end: "12:30" }])).toBe(0);
  });
});

describe("formatDuration", () => {
  it("formats hours and minutes", () => {
    expect(formatDuration(90)).toBe("1h 30m");
  });
  it("formats under an hour", () => {
    expect(formatDuration(45)).toBe("0h 45m");
  });
  it("em-dash for non-finite", () => {
    expect(formatDuration(NaN)).toBe("—");
  });
});

describe("toDecimalHours / toHHMM", () => {
  it("converts minutes to decimal hours", () => {
    expect(toDecimalHours(90)).toBeCloseTo(1.5, 5);
  });
  it("formats zero-padded HH:MM", () => {
    expect(toHHMM(90)).toBe("01:30");
  });
});

describe("computeDuration", () => {
  it("computes net duration with breaks", () => {
    const r = computeDuration({ start: "09:00", end: "17:00", breaks: [{ start: "12:00", end: "13:00" }] });
    if ("error" in r) throw new Error("should not error");
    expect(r.totalMinutes).toBe(480);
    expect(r.breakMinutes).toBe(60);
    expect(r.netMinutes).toBe(420);
    expect(r.hours).toBeCloseTo(7, 5);
    expect(r.formatted).toBe("7h 0m");
  });
  it("errors on invalid input", () => {
    expect(computeDuration({ start: "abc", end: "17:00", breaks: [] })).toHaveProperty("error");
  });
  it("clamps net to 0 when breaks exceed total", () => {
    const r = computeDuration({ start: "09:00", end: "10:00", breaks: [{ start: "09:00", end: "12:00" }] });
    if ("error" in r) throw new Error("err");
    expect(r.netMinutes).toBe(0);
  });
});

describe("computePayroll", () => {
  it("computes regular pay only when under threshold", () => {
    const r = computePayroll({
      ranges: [{ start: "09:00", end: "13:00", breaks: [] }],
      regularRate: 20, overtimeMultiplier: 1.5, doubleMultiplier: 2,
      overtimeThreshold: 8, doubleThreshold: 12,
    });
    if ("error" in r) throw new Error("err");
    expect(r.regularHours).toBe(4);
    expect(r.overtimeHours).toBe(0);
    expect(r.totalPay).toBe(80);
  });
  it("applies overtime beyond threshold", () => {
    const r = computePayroll({
      ranges: [{ start: "08:00", end: "20:00", breaks: [] }],
      regularRate: 20, overtimeMultiplier: 1.5, doubleMultiplier: 2,
      overtimeThreshold: 8, doubleThreshold: 12,
    });
    if ("error" in r) throw new Error("err");
    expect(r.regularHours).toBe(8);
    expect(r.overtimeHours).toBe(4);
    expect(r.doubleHours).toBe(0);
    expect(r.totalPay).toBeCloseTo(8 * 20 + 4 * 20 * 1.5, 1);
  });
  it("applies double-time beyond double threshold", () => {
    const r = computePayroll({
      ranges: [{ start: "08:00", end: "22:00", breaks: [] }],
      regularRate: 20, overtimeMultiplier: 1.5, doubleMultiplier: 2,
      overtimeThreshold: 8, doubleThreshold: 12,
    });
    if ("error" in r) throw new Error("err");
    expect(r.regularHours).toBe(8);
    expect(r.overtimeHours).toBe(4);
    expect(r.doubleHours).toBe(2);
  });
  it("errors on negative rate", () => {
    expect(computePayroll({
      ranges: [], regularRate: -1, overtimeMultiplier: 1.5,
      doubleMultiplier: 2, overtimeThreshold: 8, doubleThreshold: 12,
    })).toHaveProperty("error");
  });
  it("errors when double < overtime threshold", () => {
    expect(computePayroll({
      ranges: [], regularRate: 10, overtimeMultiplier: 1.5,
      doubleMultiplier: 2, overtimeThreshold: 8, doubleThreshold: 4,
    })).toHaveProperty("error");
  });
});

describe("batchCompute / batchToCsv", () => {
  it("returns result per input", () => {
    const r = batchCompute([
      { start: "09:00", end: "17:00", breaks: [] },
      { start: "abc", end: "17:00", breaks: [] },
    ]);
    expect(r).toHaveLength(2);
    expect("error" in r[1]!.result).toBe(true);
  });
  it("renders CSV with header", () => {
    const csv = batchToCsv(batchCompute([{ start: "09:00", end: "17:00", breaks: [] }]));
    expect(csv.split("\n")[0]).toBe("index,total,break,net,hours,formatted");
    expect(csv).toContain("480");
  });
});

describe("isValidRange / fmt", () => {
  it("validates a good range", () => {
    expect(isValidRange("09:00", "17:00")).toBe(true);
  });
  it("rejects invalid range", () => {
    expect(isValidRange("abc", "17:00")).toBe(false);
  });
  it("fmt trims precision", () => {
    expect(fmt(1.23456, 2)).toBe("1.23");
  });
  it("fmt em-dash for NaN", () => {
    expect(fmt(NaN)).toBe("—");
  });
});

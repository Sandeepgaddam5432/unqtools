import { describe, it, expect } from "vitest";
import {
  entryMinutes, entryGrossMinutes, entryBreakMinutes, computeTimesheet,
  perDayHours, batchCompute, batchToCsv, validateInput, fmt,
  type TimesheetEntry,
} from "./logic";

describe("entryMinutes", () => {
  it("computes net minutes with no breaks", () => {
    const e: TimesheetEntry = { start: "09:00", end: "17:00", breaks: [] };
    expect(entryMinutes(e)).toBe(480);
  });
  it("deducts break minutes", () => {
    const e: TimesheetEntry = { start: "09:00", end: "17:00", breaks: [{ start: "12:00", end: "13:00" }] };
    expect(entryMinutes(e)).toBe(420);
  });
  it("handles overnight", () => {
    const e: TimesheetEntry = { start: "22:00", end: "06:00", breaks: [] };
    expect(entryMinutes(e)).toBe(480);
  });
  it("returns null on invalid input", () => {
    const e: TimesheetEntry = { start: "bad", end: "17:00", breaks: [] };
    expect(entryMinutes(e)).toBeNull();
  });
});

describe("entryGrossMinutes / entryBreakMinutes", () => {
  it("computes gross minutes", () => {
    const e: TimesheetEntry = { start: "09:00", end: "17:00", breaks: [{ start: "12:00", end: "13:00" }] };
    expect(entryGrossMinutes(e)).toBe(480);
  });
  it("computes break minutes", () => {
    const e: TimesheetEntry = { start: "09:00", end: "17:00", breaks: [{ start: "12:00", end: "13:00" }] };
    expect(entryBreakMinutes(e)).toBe(60);
  });
});

describe("computeTimesheet", () => {
  const input = {
    entries: [{ start: "09:00", end: "17:00", breaks: [{ start: "12:00", end: "13:00" }] }] as TimesheetEntry[],
    hourlyRate: 20,
    overtimeRate: 1.5,
    regularThreshold: 8,
  };
  it("computes regular hours with no overtime", () => {
    const r = computeTimesheet(input);
    if ("error" in r) throw new Error("err");
    expect(r.regularHours).toBe(7);
    expect(r.overtimeHours).toBe(0);
    expect(r.regularPay).toBe(140);
    expect(r.totalPay).toBe(140);
  });
  it("computes overtime when threshold exceeded", () => {
    const r = computeTimesheet({ ...input, entries: [{ start: "08:00", end: "20:00", breaks: [{ start: "12:00", end: "13:00" }] }] });
    if ("error" in r) throw new Error("err");
    expect(r.overtimeHours).toBeCloseTo(3, 5);
    expect(r.overtimePay).toBeCloseTo(3 * 20 * 1.5, 2);
  });
  it("computes double-time when threshold exceeded", () => {
    const r = computeTimesheet({
      ...input,
      entries: [{ start: "06:00", end: "22:00", breaks: [] }],
      doubleThreshold: 12,
      doubleRate: 2,
    });
    if ("error" in r) throw new Error("err");
    expect(r.doubleHours).toBeGreaterThan(0);
  });
  it("reports gross and break hours", () => {
    const r = computeTimesheet(input);
    if ("error" in r) throw new Error("err");
    expect(r.grossHours).toBe(8);
    expect(r.breakHours).toBe(1);
  });
  it("errors on empty entries", () => {
    expect(computeTimesheet({ ...input, entries: [] })).toHaveProperty("error");
  });
  it("errors on invalid entry", () => {
    expect(computeTimesheet({ ...input, entries: [{ start: "bad", end: "17:00", breaks: [] }] })).toHaveProperty("error");
  });
  it("errors on negative rate", () => {
    expect(computeTimesheet({ ...input, hourlyRate: -1 })).toHaveProperty("error");
  });
  it("errors when double threshold < regular threshold", () => {
    expect(computeTimesheet({ ...input, doubleThreshold: 4 })).toHaveProperty("error");
  });
});

describe("perDayHours", () => {
  it("groups by date", () => {
    const m = perDayHours([
      { start: "09:00", end: "17:00", breaks: [], date: "2024-01-01" },
      { start: "09:00", end: "13:00", breaks: [], date: "2024-01-01" },
      { start: "09:00", end: "17:00", breaks: [], date: "2024-01-02" },
    ]);
    if ("error" in m) throw new Error("err");
    expect(m["2024-01-01"]).toBe(12);
    expect(m["2024-01-02"]).toBe(8);
  });
  it("uses undated label for missing date", () => {
    const m = perDayHours([{ start: "09:00", end: "17:00", breaks: [] }]);
    if ("error" in m) throw new Error("err");
    expect(m.undated).toBe(8);
  });
});

describe("batchCompute / batchToCsv", () => {
  it("returns result per input", () => {
    const r = batchCompute([
      { entries: [{ start: "09:00", end: "17:00", breaks: [] }], hourlyRate: 20, overtimeRate: 1.5, regularThreshold: 8 },
      { entries: [], hourlyRate: 20, overtimeRate: 1.5, regularThreshold: 8 },
    ]);
    expect(r).toHaveLength(2);
    expect("error" in r[1]!.result).toBe(true);
  });
  it("renders CSV with header", () => {
    const csv = batchToCsv(batchCompute([
      { entries: [{ start: "09:00", end: "17:00", breaks: [] }], hourlyRate: 20, overtimeRate: 1.5, regularThreshold: 8 },
    ]));
    expect(csv.split("\n")[0]).toBe("index,regularHours,overtimeHours,doubleHours,totalHours,totalPay");
    expect(csv).toContain("8");
  });
});

describe("validateInput", () => {
  it("accepts valid input", () => {
    expect(validateInput({ entries: [{ start: "09:00", end: "17:00", breaks: [] }], hourlyRate: 20, overtimeRate: 1.5, regularThreshold: 8 })).toEqual({ ok: true });
  });
  it("rejects invalid input", () => {
    expect(validateInput({ entries: [], hourlyRate: 20, overtimeRate: 1.5, regularThreshold: 8 })).toHaveProperty("error");
  });
});

describe("fmt", () => {
  it("trims precision", () => { expect(fmt(1.23456, 2)).toBe("1.23"); });
  it("em-dash for NaN", () => { expect(fmt(NaN)).toBe("—"); });
});

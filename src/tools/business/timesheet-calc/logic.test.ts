import { describe, it, expect } from "vitest";
import { entryMinutes, computeTimesheet, type TimesheetEntry } from "./logic";

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

describe("computeTimesheet", () => {
  const input = {
    entries: [{ start: "09:00", end: "17:00", breaks: [{ start: "12:00", end: "13:00" }] }] as TimesheetEntry[],
    hourlyRate: 20,
    overtimeRate: 1.5,
    regularThreshold: 8,
  };
  it("computes regular hours with no overtime", () => {
    const r = computeTimesheet(input);
    if ("error" in r) throw new Error("should not error");
    expect(r.regularHours).toBe(7);
    expect(r.overtimeHours).toBe(0);
    expect(r.regularPay).toBe(140);
    expect(r.totalPay).toBe(140);
  });
  it("computes overtime when threshold exceeded", () => {
    const r = computeTimesheet({ ...input, entries: [{ start: "08:00", end: "20:00", breaks: [{ start: "12:00", end: "13:00" }] }] });
    if ("error" in r) throw new Error("should not error");
    expect(r.overtimeHours).toBeCloseTo(3, 5);
    expect(r.overtimePay).toBeCloseTo(3 * 20 * 1.5, 2);
  });
  it("errors on empty entries", () => {
    expect(computeTimesheet({ ...input, entries: [] })).toHaveProperty("error");
  });
  it("errors on invalid entry", () => {
    expect(computeTimesheet({ ...input, entries: [{ start: "bad", end: "17:00", breaks: [] }] })).toHaveProperty("error");
  });
});

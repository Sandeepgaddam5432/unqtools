import { describe, it, expect } from "vitest";
import { parseTime, shiftMinutes, totalHours, computeCoverage, formatTime } from "./logic";

describe("parseTime", () => {
  it("parses HH:MM", () => { expect(parseTime("09:30")).toBe(570); });
  it("rejects invalid", () => { expect(parseTime("bad")).toBeNull(); });
  it("rejects out-of-range", () => { expect(parseTime("25:00")).toBeNull(); });
});

describe("shiftMinutes", () => {
  it("computes start/end", () => {
    const r = shiftMinutes({ employee: "A", start: "09:00", end: "17:00" });
    if ("error" in r) throw new Error("should not error");
    expect(r.start).toBe(540); expect(r.end).toBe(1020);
  });
  it("handles overnight", () => {
    const r = shiftMinutes({ employee: "A", start: "22:00", end: "06:00" });
    if ("error" in r) throw new Error("should not error");
    expect(r.end - r.start).toBe(8 * 60);
  });
  it("errors on invalid input", () => {
    expect(shiftMinutes({ employee: "A", start: "bad", end: "17:00" })).toHaveProperty("error");
  });
});

describe("totalHours", () => {
  it("sums hours", () => {
    const h = totalHours([{ employee: "A", start: "09:00", end: "17:00" }]);
    expect(h).toBe(8);
  });
  it("handles multiple shifts", () => {
    const h = totalHours([
      { employee: "A", start: "09:00", end: "12:00" },
      { employee: "B", start: "10:00", end: "14:00" },
    ]);
    expect(h).toBe(7);
  });
});

describe("computeCoverage", () => {
  it("returns coverage slots", () => {
    const slots = computeCoverage([
      { employee: "A", start: "09:00", end: "11:00" },
      { employee: "B", start: "10:00", end: "12:00" },
    ]);
    if ("error" in slots) throw new Error("should not error");
    expect(slots.length).toBe(3);
    expect(slots.find((s) => s.count === 2)).toBeTruthy();
  });
  it("returns empty for no shifts", () => {
    expect(computeCoverage([])).toEqual([]);
  });
});

describe("formatTime", () => {
  it("formats minutes", () => {
    expect(formatTime(570)).toBe("09:30");
  });
  it("wraps overnight", () => {
    expect(formatTime(1440 + 60)).toBe("01:00");
  });
});

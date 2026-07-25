import { describe, it, expect } from "vitest";
import { parseTime, durationMinutes, breakMinutes, formatDuration, computeDuration } from "./logic";

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
});

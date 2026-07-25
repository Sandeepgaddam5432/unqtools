import { describe, it, expect } from "vitest";
import { parseCron, parseField, describeCron, nextRuns, FIELD_RANGES, DAY_NAMES } from "./logic";

describe("parseCron", () => {
  it("parses 5 fields", () => {
    expect(parseCron("0 * * * *")).toEqual({ minute: "0", hour: "*", dayOfMonth: "*", month: "*", dayOfWeek: "*" });
  });
  it("errors on fewer fields", () => {
    expect(parseCron("0 * * *")).toHaveProperty("error");
  });
  it("errors on extra fields", () => {
    expect(parseCron("0 * * * * extra")).toHaveProperty("error");
  });
});

describe("parseField", () => {
  it("star returns full range", () => {
    expect(parseField("*", FIELD_RANGES.minute).length).toBe(60);
  });
  it("single value", () => {
    expect(parseField("5", FIELD_RANGES.minute)).toEqual([5]);
  });
  it("range", () => {
    expect(parseField("1-3", FIELD_RANGES.minute)).toEqual([1, 2, 3]);
  });
  it("step", () => {
    expect(parseField("*/15", FIELD_RANGES.minute)).toEqual([0, 15, 30, 45]);
  });
  it("list", () => {
    expect(parseField("0,15,30,45", FIELD_RANGES.minute)).toEqual([0, 15, 30, 45]);
  });
  it("names for day-of-week", () => {
    expect(parseField("mon", FIELD_RANGES.dayOfWeek, DAY_NAMES)).toEqual([1]);
  });
});

describe("describeCron", () => {
  it("describes every minute", () => {
    expect(describeCron("* * * * *")).toContain("every minute");
  });
  it("describes specific time", () => {
    const d = describeCron("0 9 * * *");
    expect(d).toContain("at minute 0");
    expect(d).toContain("at hour 9");
  });
  it("returns error message for invalid", () => {
    expect(describeCron("bad")).toBe("Cron must have 5 fields");
  });
});

describe("nextRuns", () => {
  it("returns next N runs", () => {
    const from = new Date("2024-01-01T00:00:00Z");
    const runs = nextRuns("0 * * * *", from, 3);
    if ("error" in runs) throw new Error("should not error");
    expect(runs.length).toBe(3);
    expect(runs[0]!.getMinutes()).toBe(0);
  });
  it("errors on invalid expression", () => {
    expect(nextRuns("bad", new Date(), 3)).toHaveProperty("error");
  });
});

import { describe, it, expect } from "vitest";
import { computeMeetingCost, formatMoney, attendeeBreakdown } from "./logic";

describe("computeMeetingCost", () => {
  it("computes total cost", () => {
    const r = computeMeetingCost({ attendees: [{ name: "A", hourlyRate: 60 }, { name: "B", hourlyRate: 40 }], durationMinutes: 60 });
    if ("error" in r) throw new Error("should not error");
    expect(r.totalCost).toBe(100);
    expect(r.durationHours).toBe(1);
    expect(r.costPerMinute).toBeCloseTo(100 / 60, 5);
  });
  it("applies overhead", () => {
    const r = computeMeetingCost({ attendees: [{ name: "A", hourlyRate: 100 }], durationMinutes: 60, overheadPercent: 20 });
    if ("error" in r) throw new Error("should not error");
    expect(r.withOverhead).toBe(120);
  });
  it("errors on no attendees", () => {
    expect(computeMeetingCost({ attendees: [], durationMinutes: 60 })).toHaveProperty("error");
  });
  it("errors on zero duration", () => {
    expect(computeMeetingCost({ attendees: [{ name: "A", hourlyRate: 50 }], durationMinutes: 0 })).toHaveProperty("error");
  });
  it("errors on negative rate", () => {
    expect(computeMeetingCost({ attendees: [{ name: "A", hourlyRate: -10 }], durationMinutes: 60 })).toHaveProperty("error");
  });
});

describe("formatMoney", () => {
  it("formats with $ and 2 decimals", () => {
    expect(formatMoney(123.456)).toBe("$123.46");
  });
});

describe("attendeeBreakdown", () => {
  it("returns per-attendee cost", () => {
    const b = attendeeBreakdown({ attendees: [{ name: "A", hourlyRate: 60 }, { name: "B", hourlyRate: 40 }], durationMinutes: 30 });
    expect(b[0]).toEqual({ name: "A", cost: 30 });
    expect(b[1]).toEqual({ name: "B", cost: 20 });
  });
});

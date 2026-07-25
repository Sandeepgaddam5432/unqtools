import { describe, it, expect } from "vitest";
import {
  computeMeetingCost,
  attendeeBreakdown,
  computeMeetingCostBatch,
  formatMoney,
  computeStats,
  breakdownToCsv,
  renderReport,
  CURRENCIES,
} from "./logic";

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
    expect(r.overheadCost).toBe(20);
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
  it("deducts break time", () => {
    const r = computeMeetingCost({ attendees: [{ name: "A", hourlyRate: 60 }], durationMinutes: 60, breakMinutes: 15 });
    if ("error" in r) throw new Error("should not error");
    expect(r.workingMinutes).toBe(45);
    expect(r.totalCost).toBe(45); // 60 * 0.75h = 45
  });
  it("errors when break >= duration", () => {
    expect(computeMeetingCost({ attendees: [{ name: "A", hourlyRate: 60 }], durationMinutes: 60, breakMinutes: 60 })).toHaveProperty("error");
  });
  it("computes overtime", () => {
    const r = computeMeetingCost({
      attendees: [{ name: "A", hourlyRate: 100 }],
      durationMinutes: 120,
      overtimeThresholdMinutes: 60,
      overtimeMultiplier: 1.5,
    });
    if ("error" in r) throw new Error("should not error");
    expect(r.overtimeMinutes).toBe(60);
    // 100 * 1h + 100 * 1h * 1.5 = 100 + 150 = 250
    expect(r.overtimeCost).toBe(150);
    expect(r.totalCost).toBe(250);
  });
  it("includes cost per attendee", () => {
    const r = computeMeetingCost({ attendees: [{ name: "A", hourlyRate: 60 }, { name: "B", hourlyRate: 40 }], durationMinutes: 60 });
    if ("error" in r) throw new Error("should not error");
    expect(r.costPerAttendee).toBe(50);
  });
});

describe("attendeeBreakdown", () => {
  it("returns per-attendee cost", () => {
    const b = attendeeBreakdown({ attendees: [{ name: "A", hourlyRate: 60 }, { name: "B", hourlyRate: 40 }], durationMinutes: 30 });
    expect(b[0]).toMatchObject({ name: "A", cost: 30 });
    expect(b[1]).toMatchObject({ name: "B", cost: 20 });
  });
  it("includes overtime cost per attendee", () => {
    const b = attendeeBreakdown({
      attendees: [{ name: "A", hourlyRate: 100 }],
      durationMinutes: 120,
      overtimeThresholdMinutes: 60,
      overtimeMultiplier: 1.5,
    });
    expect(b[0]!.overtimeCost).toBe(150);
    expect(b[0]!.total).toBe(250);
  });
});

describe("computeMeetingCostBatch", () => {
  it("processes multiple inputs", () => {
    const results = computeMeetingCostBatch([
      { attendees: [{ name: "A", hourlyRate: 60 }], durationMinutes: 60 },
      { attendees: [], durationMinutes: 60 },
    ]);
    expect(results.length).toBe(2);
    expect("error" in results[0]!).toBe(false);
    expect("error" in results[1]!).toBe(true);
  });
});

describe("formatMoney", () => {
  it("formats USD with $ and 2 decimals", () => {
    expect(formatMoney(123.456, "USD")).toContain("123.46");
  });
  it("formats EUR", () => {
    expect(formatMoney(50, "EUR")).toContain("50");
  });
});

describe("computeStats", () => {
  it("returns attendee count and working minutes", () => {
    const s = computeStats({ attendees: [{ name: "A", hourlyRate: 60 }], durationMinutes: 60, breakMinutes: 10 });
    expect(s.attendeeCount).toBe(1);
    expect(s.workingMinutes).toBe(50);
  });
});

describe("breakdownToCsv", () => {
  it("generates CSV with header", () => {
    const csv = breakdownToCsv(attendeeBreakdown({ attendees: [{ name: "A", hourlyRate: 60 }], durationMinutes: 60 }));
    expect(csv.split("\n")[0]).toBe("Name,HourlyRate,Hours,BaseCost,OvertimeCost,Total");
    expect(csv).toContain("A");
  });
});

describe("renderReport", () => {
  it("includes key sections", () => {
    const input = { attendees: [{ name: "A", hourlyRate: 60 }], durationMinutes: 60 };
    const r = computeMeetingCost(input);
    if ("error" in r) throw new Error("should not error");
    const report = renderReport(input, r);
    expect(report).toContain("MEETING COST REPORT");
    expect(report).toContain("Total");
    expect(report).toContain("Attendees");
  });
});

describe("CURRENCIES", () => {
  it("contains multiple currencies", () => {
    expect(CURRENCIES.length).toBeGreaterThanOrEqual(5);
    expect(CURRENCIES.some((c) => c.value === "USD")).toBe(true);
  });
});

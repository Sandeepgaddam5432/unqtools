import { describe, it, expect } from "vitest";
import {
  generateMonth,
  autoFillCalendar,
  monthToCsv,
  countByContentType,
  countByPlatform,
  PLATFORMS,
  CONTENT_TYPES,
} from "./logic";

describe("social-content-calendar generateMonth", () => {
  it("returns 42 days (6 weeks)", () => {
    const m = generateMonth(2024, 0); // January 2024
    expect(m.days.length).toBe(42);
  });

  it("groups into 6 weeks of 7", () => {
    const m = generateMonth(2024, 5); // June 2024
    expect(m.weeks.length).toBe(6);
    expect(m.weeks.every((w) => w.length === 7)).toBe(true);
  });

  it("labels the month correctly", () => {
    expect(generateMonth(2024, 0).label).toBe("January 2024");
    expect(generateMonth(2024, 11).label).toBe("December 2024");
  });

  it("flags current-month days", () => {
    const m = generateMonth(2024, 0);
    const currentDays = m.days.filter((d) => d.isCurrentMonth);
    expect(currentDays.length).toBe(31); // January has 31 days
  });

  it("flags weekends", () => {
    const m = generateMonth(2024, 0);
    const weekendDays = m.days.filter((d) => d.isCurrentMonth && d.isWeekend);
    expect(weekendDays.length).toBeGreaterThan(0);
  });

  it("returns invalid for bad input", () => {
    const m = generateMonth(2024, 99);
    expect(m.label).toBe("Invalid");
  });
});

describe("social-content-calendar autoFillCalendar", () => {
  it("fills current-month days with content slot and platform", () => {
    const m = autoFillCalendar(generateMonth(2024, 0));
    const filled = m.days.filter((d) => d.isCurrentMonth && d.contentSlot);
    expect(filled.length).toBe(31);
  });

  it("leaves non-current-month days empty", () => {
    const m = autoFillCalendar(generateMonth(2024, 0));
    const empty = m.days.filter((d) => !d.isCurrentMonth && d.contentSlot);
    expect(empty.length).toBe(0);
  });

  it("rotates through content types", () => {
    const m = autoFillCalendar(generateMonth(2024, 0));
    const types = new Set(m.days.filter((d) => d.isCurrentMonth).map((d) => d.contentSlot));
    expect(types.size).toBeGreaterThan(1);
  });
});

describe("social-content-calendar monthToCsv", () => {
  it("produces CSV with header", () => {
    const csv = monthToCsv(generateMonth(2024, 0));
    expect(csv.split("\n")[0]).toBe("date,day,day_of_week,content_type,platform");
  });

  it("has one row per current-month day", () => {
    const csv = monthToCsv(generateMonth(2024, 0));
    expect(csv.split("\n").length).toBe(32); // 1 header + 31 days
  });
});

describe("social-content-calendar countByContentType", () => {
  it("counts each content type", () => {
    const m = autoFillCalendar(generateMonth(2024, 0));
    const counts = countByContentType(m);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(31);
  });
});

describe("social-content-calendar countByPlatform", () => {
  it("counts each platform", () => {
    const m = autoFillCalendar(generateMonth(2024, 0));
    const counts = countByPlatform(m);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(31);
  });
});

describe("social-content-calendar constants", () => {
  it("PLATFORMS has at least 5 entries", () => {
    expect(PLATFORMS.length).toBeGreaterThanOrEqual(5);
  });

  it("CONTENT_TYPES has at least 8 entries", () => {
    expect(CONTENT_TYPES.length).toBeGreaterThanOrEqual(8);
  });
});

/**
 * Date Difference Calculator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { calculateDateDiff, addToDate, dateDiffToCsv } from "./logic";

describe("calculateDateDiff — basic", () => {
  it("errors on invalid format", () => {
    expect("error" in calculateDateDiff({ startDate: "01/01/2020", endDate: "2020-01-10" })).toBe(true);
  });
  it("computes 30 days difference", () => {
    const r = calculateDateDiff({ startDate: "2020-01-01", endDate: "2020-01-31" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.totalDays).toBe(30);
    expect(r.direction).toBe("future");
  });
  it("handles past direction (negative days)", () => {
    const r = calculateDateDiff({ startDate: "2020-01-31", endDate: "2020-01-01" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.totalDays).toBe(-30);
    expect(r.direction).toBe("past");
  });
  it("handles same-day (0 days)", () => {
    const r = calculateDateDiff({ startDate: "2020-01-01", endDate: "2020-01-01" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.totalDays).toBe(0);
    expect(r.direction).toBe("same");
  });
});

describe("calculateDateDiff — calendar breakdown", () => {
  it("computes 1 year 2 months 10 days", () => {
    const r = calculateDateDiff({ startDate: "2020-01-15", endDate: "2021-03-25" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.years).toBe(1);
    expect(r.months).toBe(2);
    expect(r.days).toBe(10);
  });
  it("humanized string includes non-zero parts", () => {
    const r = calculateDateDiff({ startDate: "2020-01-01", endDate: "2020-01-10" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.humanized).toContain("9 days");
  });
});

describe("calculateDateDiff — business days", () => {
  it("counts only weekdays as business days", () => {
    // 2020-01-06 (Mon) to 2020-01-10 (Fri) = 5 business days, 0 weekend
    const r = calculateDateDiff({ startDate: "2020-01-06", endDate: "2020-01-10" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.businessDays).toBe(4); // exclusive of start, so 4 (Tue-Fri)
    expect(r.totalWeekendDays).toBe(0);
  });
  it("includes weekend days count", () => {
    // 2020-01-03 (Fri) to 2020-01-12 (Sun) spans 2 weekends
    const r = calculateDateDiff({ startDate: "2020-01-03", endDate: "2020-01-12" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.totalWeekendDays).toBeGreaterThan(0);
  });
  it("excludes specified holidays", () => {
    // 2020-01-06 Mon to 2020-01-10 Fri with 2020-01-07 as holiday
    const r = calculateDateDiff({ startDate: "2020-01-06", endDate: "2020-01-10", holidays: ["2020-01-07"] });
    if ("error" in r) throw new Error("Should not error");
    // Tue (7) excluded, Wed (8) Thu (9) Fri (10) = 3 business days
    expect(r.businessDays).toBe(3);
  });
});

describe("calculateDateDiff — extras", () => {
  it("computes ISO week numbers", () => {
    const r = calculateDateDiff({ startDate: "2020-01-01", endDate: "2020-12-31" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.isoWeekStart).toBe(1);
    expect(r.isoWeekEnd).toBe(53);
  });
  it("computes day-of-year", () => {
    const r = calculateDateDiff({ startDate: "2020-01-01", endDate: "2020-02-01" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.dayOfYearStart).toBe(1);
    expect(r.dayOfYearEnd).toBe(32);
  });
  it("computes quarter", () => {
    const r = calculateDateDiff({ startDate: "2020-01-01", endDate: "2020-08-15" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.quarterStart).toBe(1);
    expect(r.quarterEnd).toBe(3);
  });
  it("computes half-year", () => {
    const r = calculateDateDiff({ startDate: "2020-01-01", endDate: "2020-10-15" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.halfYearStart).toBe("H1");
    expect(r.halfYearEnd).toBe("H2");
  });
  it("identifies leap year", () => {
    const r = calculateDateDiff({ startDate: "2020-01-01", endDate: "2020-12-31" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.isLeapYearStart).toBe(true);
  });
  it("provides weekday names", () => {
    const r = calculateDateDiff({ startDate: "2020-01-15", endDate: "2020-06-20" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.weekdayStart).toBe("Wednesday");
    expect(r.weekdayEnd).toBe("Saturday");
  });
  it("generates per-week breakdown", () => {
    const r = calculateDateDiff({ startDate: "2020-01-01", endDate: "2020-01-21" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.perWeekBreakdown.length).toBeGreaterThanOrEqual(3);
    expect(r.perWeekBreakdown[0]!.weekOf).toBe("2020-01-01");
  });
});

describe("addToDate", () => {
  it("adds days", () => {
    expect(addToDate({ startDate: "2020-01-01", days: 10 })).toBe("2020-01-11");
  });
  it("adds weeks", () => {
    expect(addToDate({ startDate: "2020-01-01", weeks: 2 })).toBe("2020-01-15");
  });
  it("adds months with year rollover", () => {
    expect(addToDate({ startDate: "2020-11-15", months: 3 })).toBe("2021-02-15");
  });
  it("adds years", () => {
    expect(addToDate({ startDate: "2020-02-29", years: 4 })).toBe("2024-02-29");
  });
  it("adds business days skipping weekends", () => {
    // 2020-01-03 (Fri) + 5 business days → Mon Jan 6, Tue 7, Wed 8, Thu 9, Fri 10
    expect(addToDate({ startDate: "2020-01-03", businessDays: 5 })).toBe("2020-01-10");
  });
  it("errors on invalid date", () => {
    expect("error" in addToDate({ startDate: "01-01-2020", days: 5 })).toBe(true);
  });
});

describe("dateDiffToCsv", () => {
  it("generates CSV from per-week breakdown", () => {
    const r = calculateDateDiff({ startDate: "2020-01-01", endDate: "2020-01-21" });
    if ("error" in r) throw new Error("Should not error");
    const csv = dateDiffToCsv(r);
    expect(csv.split("\n")[0]).toBe("WeekOf,DaysInWeek");
    expect(csv.split("\n").length).toBe(r.perWeekBreakdown.length + 1);
  });
});

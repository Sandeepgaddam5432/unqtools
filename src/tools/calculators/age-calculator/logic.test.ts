/**
 * Age Calculator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { calculateAge, getZodiac, getChineseZodiac, getBirthstone, getBirthFlower, getGeneration } from "./logic";

describe("calculateAge — basic", () => {
  it("errors on invalid date format", () => {
    expect("error" in calculateAge({ birthdate: "01/15/1990" })).toBe(true);
    expect("error" in calculateAge({ birthdate: "1990-1-5" })).toBe(true);
  });
  it("errors on future birthdate", () => {
    expect("error" in calculateAge({ birthdate: "2099-01-01" })).toBe(true);
  });
  it("computes age 30 years exactly", () => {
    const r = calculateAge({ birthdate: "1990-01-15", targetDate: "2020-01-15" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.years).toBe(30);
    expect(r.months).toBe(0);
    expect(r.days).toBe(0);
  });
  it("computes age with months and days", () => {
    const r = calculateAge({ birthdate: "1990-01-15", targetDate: "2020-06-20" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.years).toBe(30);
    expect(r.months).toBe(5);
    expect(r.days).toBe(5);
  });
  it("handles month rollover (days < 0)", () => {
    // Born March 31, target April 30 → 0 years 0 months 30 days
    const r = calculateAge({ birthdate: "2000-03-31", targetDate: "2000-04-30" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.years).toBe(0);
    expect(r.totalDays).toBe(30);
  });
});

describe("calculateAge — totals", () => {
  it("computes total days/hours/minutes/seconds", () => {
    const r = calculateAge({ birthdate: "2020-01-01", targetDate: "2020-01-02" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.totalDays).toBe(1);
    expect(r.totalHours).toBe(24);
    expect(r.totalMinutes).toBe(1440);
    expect(r.totalSeconds).toBe(86400);
  });
  it("computes total weeks", () => {
    const r = calculateAge({ birthdate: "2020-01-01", targetDate: "2020-01-22" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.totalWeeks).toBe(3);
  });
});

describe("calculateAge — extras", () => {
  it("computes weekday born", () => {
    // 1990-01-15 was a Monday
    const r = calculateAge({ birthdate: "1990-01-15", targetDate: "2020-01-15" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.weekdayBorn).toBe("Monday");
  });
  it("sets eligibility flags correctly", () => {
    const r1 = calculateAge({ birthdate: "2010-01-01", targetDate: "2024-01-01" });
    if ("error" in r1) throw new Error("Should not error");
    expect(r1.years).toBe(14);
    expect(r1.isEligibleToDrive).toBe(false);
    expect(r1.isEligibleToVote).toBe(false);

    const r2 = calculateAge({ birthdate: "2000-01-01", targetDate: "2024-01-01" });
    if ("error" in r2) throw new Error("Should not error");
    expect(r2.isEligibleToVote).toBe(true);
    expect(r2.isEligibleToDrive).toBe(true);
  });
  it("computes retirement date at age 65", () => {
    const r = calculateAge({ birthdate: "1990-01-15", targetDate: "2020-01-15" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.retirementDate).toBe("2055-01-15");
  });
  it("computes next birthday days remaining", () => {
    const r = calculateAge({ birthdate: "1990-06-15", targetDate: "2020-06-10" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.nextBirthday.daysUntil).toBe(5);
  });
  it("rolls over next birthday to next year if already passed", () => {
    const r = calculateAge({ birthdate: "1990-06-15", targetDate: "2020-06-20" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.nextBirthday.daysUntil).toBeGreaterThan(340);
  });
  it("computes life expectancy remaining", () => {
    const r = calculateAge({ birthdate: "1990-01-15", targetDate: "2020-01-15" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.lifeExpectancyRemaining).not.toBeNull();
    expect(r.lifeExpectancyRemaining?.years).toBeCloseTo(43.4, 1);
  });
});

describe("getZodiac", () => {
  it("identifies Capricorn for Dec 25", () => {
    const d = new Date(1990, 11, 25);
    expect(getZodiac(d).sign).toBe("Capricorn");
  });
  it("identifies Leo for July 28", () => {
    const d = new Date(1990, 6, 28);
    expect(getZodiac(d).sign).toBe("Leo");
  });
  it("identifies Aries for March 25", () => {
    const d = new Date(1990, 2, 25);
    expect(getZodiac(d).sign).toBe("Aries");
  });
});

describe("getChineseZodiac", () => {
  it("2020 is Rat", () => { expect(getChineseZodiac(2020)).toBe("Rat"); });
  it("2024 is Dragon", () => { expect(getChineseZodiac(2024)).toBe("Dragon"); });
  it("1988 is Dragon", () => { expect(getChineseZodiac(1988)).toBe("Dragon"); });
});

describe("getBirthstone", () => {
  it("January is Garnet", () => { expect(getBirthstone(1)).toBe("Garnet"); });
  it("April is Diamond", () => { expect(getBirthstone(4)).toBe("Diamond"); });
  it("December is Turquoise", () => { expect(getBirthstone(12)).toBe("Turquoise"); });
});

describe("getBirthFlower", () => {
  it("January is Carnation", () => { expect(getBirthFlower(1)).toBe("Carnation"); });
  it("June is Rose", () => { expect(getBirthFlower(6)).toBe("Rose"); });
});

describe("getGeneration", () => {
  it("1960 is Baby Boomer", () => { expect(getGeneration(1960)).toBe("Baby Boomer"); });
  it("1990 is Millennial", () => { expect(getGeneration(1990)).toBe("Millennial (Gen Y)"); });
  it("2005 is Gen Z", () => { expect(getGeneration(2005)).toBe("Generation Z"); });
  it("2018 is Gen Alpha", () => { expect(getGeneration(2018)).toBe("Generation Alpha"); });
});

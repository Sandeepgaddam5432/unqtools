import { describe, it, expect, beforeEach } from "vitest";
import {
  MS_PER_SECOND,
  MS_PER_MINUTE,
  MS_PER_HOUR,
  MS_PER_DAY,
  MS_PER_WEEK,
  MILESTONE_DAYS,
  MILESTONE_SECONDS,
  MILESTONE_YEARS,
  parseDateTime,
  isValidDate,
  formatDate,
  formatDateTime,
  daysInMonth,
  isLeapYear,
  weekdayLabel,
  weekdayShort,
  calculateYMD,
  calculateNextBirthday,
  getZodiacSign,
  getChineseZodiac,
  getChineseElement,
  calculateAge,
  computeMilestones,
  calculateAgeGap,
  renderAgeText,
  renderMilestonesCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Feb29Policy,
  type ShareState,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

describe("age-calculator constants", () => {
  it("exposes correct ms-per-unit values", () => {
    expect(MS_PER_SECOND).toBe(1000);
    expect(MS_PER_MINUTE).toBe(60_000);
    expect(MS_PER_HOUR).toBe(3_600_000);
    expect(MS_PER_DAY).toBe(86_400_000);
    expect(MS_PER_WEEK).toBe(604_800_000);
  });
  it("exposes milestone arrays", () => {
    expect(MILESTONE_DAYS).toContain(10000);
    expect(MILESTONE_SECONDS).toContain(1_000_000_000);
    expect(MILESTONE_YEARS).toContain(18);
    expect(MILESTONE_YEARS).toContain(21);
  });
});

describe("age-calculator parseDateTime", () => {
  it("parses YYYY-MM-DD as UTC midnight", () => {
    const ms = parseDateTime("2000-01-15");
    expect(Number.isNaN(ms)).toBe(false);
    const d = new Date(ms);
    expect(d.getUTCFullYear()).toBe(2000);
    expect(d.getUTCMonth()).toBe(0);
    expect(d.getUTCDate()).toBe(15);
  });
  it("parses YYYY-MM-DDTHH:MM:SS", () => {
    const ms = parseDateTime("2000-01-15T08:30:45");
    const d = new Date(ms);
    expect(d.getUTCHours()).toBe(8);
    expect(d.getUTCMinutes()).toBe(30);
    expect(d.getUTCSeconds()).toBe(45);
  });
  it("returns NaN for invalid month", () => {
    expect(Number.isNaN(parseDateTime("2025-13-01"))).toBe(true);
  });
  it("returns NaN for Feb 30 (rolled over)", () => {
    expect(Number.isNaN(parseDateTime("2025-02-30"))).toBe(true);
  });
  it("returns NaN for empty/garbage", () => {
    expect(Number.isNaN(parseDateTime(""))).toBe(true);
    expect(Number.isNaN(parseDateTime("not-a-date"))).toBe(true);
  });
  it("accepts Feb 29 in leap year", () => {
    expect(Number.isNaN(parseDateTime("2024-02-29"))).toBe(false);
  });
  it("rejects Feb 29 in non-leap year", () => {
    expect(Number.isNaN(parseDateTime("2025-02-29"))).toBe(true);
  });
});

describe("age-calculator isValidDate / formatDate", () => {
  it("validates a parseable date", () => {
    expect(isValidDate("2000-01-15")).toBe(true);
  });
  it("rejects an invalid date", () => {
    expect(isValidDate("2025-02-30")).toBe(false);
  });
  it("formats a UTC instant as YYYY-MM-DD", () => {
    expect(formatDate(parseDateTime("2000-01-15T14:30:45"))).toBe("2000-01-15");
  });
  it("formats a UTC instant as YYYY-MM-DDTHH:MM:SS", () => {
    expect(formatDateTime(parseDateTime("2000-01-15T14:30:45"))).toBe("2000-01-15T14:30:45");
  });
  it("returns empty string for NaN", () => {
    expect(formatDate(Number.NaN)).toBe("");
    expect(formatDateTime(Number.NaN)).toBe("");
  });
});

describe("age-calculator daysInMonth / isLeapYear", () => {
  it("returns 28 for Feb 2025 (non-leap)", () => {
    expect(daysInMonth(2025, 2)).toBe(28);
  });
  it("returns 29 for Feb 2024 (leap)", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
  });
  it("isLeapYear true for 2024", () => {
    expect(isLeapYear(2024)).toBe(true);
  });
  it("isLeapYear false for 1900 (century rule)", () => {
    expect(isLeapYear(1900)).toBe(false);
  });
  it("isLeapYear true for 2000 (400-year rule)", () => {
    expect(isLeapYear(2000)).toBe(true);
  });
});

describe("age-calculator weekday helpers", () => {
  it("returns correct weekday label", () => {
    expect(weekdayLabel(0)).toBe("Sunday");
    expect(weekdayLabel(1)).toBe("Monday");
    expect(weekdayLabel(6)).toBe("Saturday");
  });
  it("returns correct short weekday", () => {
    expect(weekdayShort(0)).toBe("Sun");
    expect(weekdayShort(3)).toBe("Wed");
  });
});

describe("age-calculator calculateYMD (borrow logic)", () => {
  it("returns 25 years for 2000-01-15 to 2025-01-15", () => {
    const r = calculateYMD(parseDateTime("2000-01-15"), parseDateTime("2025-01-15"));
    expect(r.years).toBe(25);
    expect(r.months).toBe(0);
    expect(r.days).toBe(0);
  });
  it("returns 24y 11m 30d for 2000-01-31 to 2024-12-31 (no negative days)", () => {
    const r = calculateYMD(parseDateTime("2000-01-31"), parseDateTime("2024-12-31"));
    // Borrow from Dec: days = 31 - 31 = 0, months = 11 - 0 = 11, years = 24
    expect(r.years).toBe(24);
    expect(r.months).toBe(11);
    expect(r.days).toBe(0);
  });
  it("Jan 31 + 1 month (to Feb 28) = 0y 0m 28d (no negative days)", () => {
    const r = calculateYMD(parseDateTime("2025-01-31"), parseDateTime("2025-02-28"));
    expect(r.years).toBe(0);
    expect(r.months).toBe(0);
    expect(r.days).toBe(28);
  });
  it("borrow day across month boundary (Feb 14 birth, Mar 1 reference = 0y 0m 15d)", () => {
    const r = calculateYMD(parseDateTime("2025-02-14"), parseDateTime("2025-03-01"));
    expect(r.years).toBe(0);
    expect(r.months).toBe(0);
    expect(r.days).toBe(15);
  });
  it("borrow across year boundary (Dec 25 birth, Jan 5 next year = 0y 0m 11d)", () => {
    const r = calculateYMD(parseDateTime("2024-12-25"), parseDateTime("2025-01-05"));
    expect(r.years).toBe(0);
    expect(r.months).toBe(0);
    expect(r.days).toBe(11);
  });
  it("borrow across year AND month (Dec 25 birth, Feb 5 = 0y 1m 11d)", () => {
    const r = calculateYMD(parseDateTime("2024-12-25"), parseDateTime("2025-02-05"));
    expect(r.years).toBe(0);
    expect(r.months).toBe(1);
    expect(r.days).toBe(11);
  });
  it("returns 0/0/0 for future birth date", () => {
    const r = calculateYMD(parseDateTime("2030-01-01"), parseDateTime("2025-01-01"));
    expect(r).toEqual({ years: 0, months: 0, days: 0 });
  });
  it("Feb 29 birth, leap year reference = exact years", () => {
    const r = calculateYMD(parseDateTime("2000-02-29"), parseDateTime("2024-02-29"));
    expect(r.years).toBe(24);
    expect(r.months).toBe(0);
    expect(r.days).toBe(0);
  });
  it("Feb 29 birth observed Feb 28 in non-leap reference year", () => {
    // 2000-02-29 birth, reference 2025-02-28 with feb28 policy
    // Birth day in 2025 is observed Feb 28 (since 2025 is non-leap)
    const r = calculateYMD(parseDateTime("2000-02-29"), parseDateTime("2025-02-28"), "feb28");
    expect(r.years).toBe(25);
    expect(r.months).toBe(0);
    expect(r.days).toBe(0);
  });
});

describe("age-calculator calculateNextBirthday", () => {
  it("returns next year's birthday when this year's has passed", () => {
    // Birth 2000-06-15, now 2025-07-01 -> next is 2026-06-15
    const r = calculateNextBirthday(parseDateTime("2000-06-15"), parseDateTime("2025-07-01"));
    expect(r.date).toBe("2026-06-15");
    expect(r.daysUntil).toBeGreaterThan(300);
  });
  it("returns this year's birthday when it hasn't passed yet", () => {
    // Birth 2000-12-25, now 2025-01-01 -> next is 2025-12-25
    const r = calculateNextBirthday(parseDateTime("2000-12-25"), parseDateTime("2025-01-01"));
    expect(r.date).toBe("2025-12-25");
  });
  it("returns next year's when today is the birthday", () => {
    // Birth 2000-06-15, now 2025-06-15 (today) -> next is 2026-06-15
    const r = calculateNextBirthday(parseDateTime("2000-06-15"), parseDateTime("2025-06-15"));
    expect(r.date).toBe("2026-06-15");
  });
  it("Feb-29 birth in non-leap reference year observes Feb 28 (feb28 policy)", () => {
    // Birth 2000-02-29, now 2025-01-01 -> next is 2025-02-28
    const r = calculateNextBirthday(parseDateTime("2000-02-29"), parseDateTime("2025-01-01"), "feb28");
    expect(r.date).toBe("2025-02-28");
    expect(r.isLeapObservance).toBe(true);
  });
  it("Feb-29 birth in non-leap reference year observes Mar 1 (mar1 policy)", () => {
    const r = calculateNextBirthday(parseDateTime("2000-02-29"), parseDateTime("2025-01-01"), "mar1");
    expect(r.date).toBe("2025-03-01");
    expect(r.isLeapObservance).toBe(true);
  });
  it("Feb-29 birth in leap reference year uses actual Feb 29", () => {
    // Birth 2000-02-29, now 2024-01-01 -> next is 2024-02-29 (leap year)
    const r = calculateNextBirthday(parseDateTime("2000-02-29"), parseDateTime("2024-01-01"), "feb28");
    expect(r.date).toBe("2024-02-29");
    expect(r.isLeapObservance).toBe(false);
  });
  it("computes daysUntil correctly", () => {
    // Birth 2000-01-15, now 2025-01-10 -> next is 2025-01-15 in 5 days
    const r = calculateNextBirthday(parseDateTime("2000-01-15"), parseDateTime("2025-01-10"));
    expect(r.date).toBe("2025-01-15");
    expect(r.daysUntil).toBe(5);
  });
});

describe("age-calculator getZodiacSign", () => {
  it("returns Aries for Mar 25", () => {
    expect(getZodiacSign(3, 25)).toBe("Aries");
  });
  it("returns Aries for Apr 1", () => {
    expect(getZodiacSign(4, 1)).toBe("Aries");
  });
  it("returns Taurus for May 10", () => {
    expect(getZodiacSign(5, 10)).toBe("Taurus");
  });
  it("returns Capricorn for Dec 25", () => {
    expect(getZodiacSign(12, 25)).toBe("Capricorn");
  });
  it("returns Capricorn for Jan 5 (year-end wrap)", () => {
    expect(getZodiacSign(1, 5)).toBe("Capricorn");
  });
  it("returns Aquarius for Jan 25", () => {
    expect(getZodiacSign(1, 25)).toBe("Aquarius");
  });
  it("returns Pisces for Feb 25", () => {
    expect(getZodiacSign(2, 25)).toBe("Pisces");
  });
  it("returns Pisces for Mar 15", () => {
    expect(getZodiacSign(3, 15)).toBe("Pisces");
  });
  it("boundary: Mar 20 = Pisces, Mar 21 = Aries", () => {
    expect(getZodiacSign(3, 20)).toBe("Pisces");
    expect(getZodiacSign(3, 21)).toBe("Aries");
  });
  it("boundary: Dec 21 = Sagittarius, Dec 22 = Capricorn", () => {
    expect(getZodiacSign(12, 21)).toBe("Sagittarius");
    expect(getZodiacSign(12, 22)).toBe("Capricorn");
  });
});

describe("age-calculator getChineseZodiac", () => {
  it("returns Dragon for 2000", () => {
    expect(getChineseZodiac(2000)).toBe("Dragon");
  });
  it("returns Rat for 2020", () => {
    expect(getChineseZodiac(2020)).toBe("Rat");
  });
  it("returns Ox for 2021", () => {
    expect(getChineseZodiac(2021)).toBe("Ox");
  });
  it("returns Rat for 2008 (cycle reference)", () => {
    expect(getChineseZodiac(2008)).toBe("Rat");
  });
  it("returns Pig for 2019", () => {
    expect(getChineseZodiac(2019)).toBe("Pig");
  });
  it("handles years before reference (1976 = Dragon)", () => {
    expect(getChineseZodiac(1976)).toBe("Dragon");
  });
});

describe("age-calculator getChineseElement", () => {
  it("returns Metal for years ending in 0 or 1", () => {
    expect(getChineseElement(2020)).toBe("Metal");
    expect(getChineseElement(2021)).toBe("Metal");
  });
  it("returns Water for years ending in 2 or 3", () => {
    expect(getChineseElement(2022)).toBe("Water");
    expect(getChineseElement(2023)).toBe("Water");
  });
  it("returns Wood for years ending in 4 or 5", () => {
    expect(getChineseElement(2024)).toBe("Wood");
    expect(getChineseElement(2025)).toBe("Wood");
  });
  it("returns Fire for years ending in 6 or 7", () => {
    expect(getChineseElement(2026)).toBe("Fire");
    expect(getChineseElement(2027)).toBe("Fire");
  });
  it("returns Earth for years ending in 8 or 9", () => {
    expect(getChineseElement(2018)).toBe("Earth");
    expect(getChineseElement(2019)).toBe("Earth");
  });
});

describe("age-calculator calculateAge (top-level)", () => {
  it("returns 25 years for 2000-01-15 to 2025-01-15", () => {
    const r = calculateAge(parseDateTime("2000-01-15"), parseDateTime("2025-01-15"));
    expect(r.years).toBe(25);
    expect(r.months).toBe(0);
    expect(r.days).toBe(0);
    expect(r.summary).toContain("25 years");
  });
  it("computes total days correctly", () => {
    const r = calculateAge(parseDateTime("2000-01-01"), parseDateTime("2025-01-01"));
    // 25 years = 25 * 365 + leap days (2000, 2004, 2008, 2012, 2016, 2020, 2024) = 9131 days
    // (Note: 2000 was leap; we count from Jan 1 2000 to Jan 1 2025.)
    expect(r.totalDays).toBeGreaterThan(9125);
    expect(r.totalDays).toBeLessThan(9140);
  });
  it("includes zodiac + chinese zodiac", () => {
    const r = calculateAge(parseDateTime("2000-01-15"), parseDateTime("2025-01-15"));
    expect(r.zodiac).toBe("Capricorn");
    expect(r.chineseZodiac).toBe("Dragon");
    expect(r.chineseElement).toBe("Metal");
  });
  it("next birthday is correct", () => {
    const r = calculateAge(parseDateTime("2000-06-15"), parseDateTime("2025-01-01"));
    expect(r.nextBirthdayDate).toBe("2025-06-15");
    expect(r.daysUntilNextBirthday).toBeGreaterThan(150);
  });
  it("handles future birth date with warning", () => {
    const r = calculateAge(parseDateTime("2030-01-01"), parseDateTime("2025-01-01"));
    expect(r.years).toBe(0);
    expect(r.warning).toContain("future");
    expect(r.summary).toContain("future");
  });
  it("handles invalid date", () => {
    const r = calculateAge(Number.NaN, parseDateTime("2025-01-01"));
    expect(r.summary).toBe("Invalid date");
    expect(r.warning).toBeTruthy();
  });
  it("includes totalMonths/weeks/hours/minutes/seconds", () => {
    const r = calculateAge(parseDateTime("2000-01-15"), parseDateTime("2025-01-15"));
    expect(r.totalMonths).toBe(25 * 12);
    expect(r.totalWeeks).toBeGreaterThan(1300);
    expect(r.totalHours).toBeGreaterThan(219_000);
    expect(r.totalMinutes).toBeGreaterThan(13_140_000);
    expect(r.totalSeconds).toBeGreaterThan(788_400_000);
  });
  it("Feb-29 birth with feb28 policy returns correct age", () => {
    // 2000-02-29 birth, reference 2025-02-28 (observes Feb 28 in 2025)
    const r = calculateAge(parseDateTime("2000-02-29"), parseDateTime("2025-02-28"), "feb28");
    expect(r.years).toBe(25);
    expect(r.months).toBe(0);
    expect(r.days).toBe(0);
    expect(r.nextBirthdayDate).toBe("2026-02-28");
    expect(r.isLeapObservance).toBe(true);
  });
});

describe("age-calculator computeMilestones", () => {
  it("includes 10000 days milestone", () => {
    const birth = parseDateTime("2000-01-01");
    const now = parseDateTime("2025-01-01");
    const ms = computeMilestones(birth, now);
    const tenK = ms.find((m) => m.label === "10,000 days");
    expect(tenK).toBeDefined();
    // 25 years = 9131 days; 10000 days lands in 2027-05-19 — still in the future.
    expect(tenK!.passed).toBe(false);
    expect(tenK!.daysFromNow).toBeGreaterThan(0);
  });
  it("includes 1000 days milestone (already passed)", () => {
    const birth = parseDateTime("2000-01-01");
    const now = parseDateTime("2025-01-01");
    const ms = computeMilestones(birth, now);
    const oneK = ms.find((m) => m.label === "1,000 days");
    expect(oneK).toBeDefined();
    expect(oneK!.passed).toBe(true);
    expect(oneK!.daysFromNow).toBeLessThan(0);
  });
  it("includes 1 billion seconds milestone", () => {
    const birth = parseDateTime("2000-01-01");
    const now = parseDateTime("2025-01-01");
    const ms = computeMilestones(birth, now);
    const oneB = ms.find((m) => m.label === "1,000,000,000 seconds");
    expect(oneB).toBeDefined();
    // 1B seconds = ~31.7 years; from 2000-01-01 that's ~2031-09-09 — not yet passed at 2025
    expect(oneB!.passed).toBe(false);
    expect(oneB!.daysFromNow).toBeGreaterThan(0);
  });
  it("includes 18 years milestone", () => {
    const birth = parseDateTime("2000-01-01");
    const now = parseDateTime("2025-01-01");
    const ms = computeMilestones(birth, now);
    const eighteen = ms.find((m) => m.label === "18 years");
    expect(eighteen).toBeDefined();
    expect(eighteen!.passed).toBe(true);
    expect(eighteen!.date).toBe("2018-01-01");
  });
  it("clamps 18-year milestone for Feb-29 births (2000-02-29 + 18 = 2018-02-28)", () => {
    const birth = parseDateTime("2000-02-29");
    const now = parseDateTime("2025-01-01");
    const ms = computeMilestones(birth, now);
    const eighteen = ms.find((m) => m.label === "18 years");
    expect(eighteen!.date).toBe("2018-02-28");
  });
  it("returns empty for invalid birth", () => {
    expect(computeMilestones(Number.NaN)).toEqual([]);
  });
});

describe("age-calculator calculateAgeGap", () => {
  it("returns same for identical dates", () => {
    const r = calculateAgeGap(parseDateTime("2000-01-01"), parseDateTime("2000-01-01"));
    expect(r.older).toBe("same");
    expect(r.totalDays).toBe(0);
  });
  it("A older than B by exactly 1 year", () => {
    const r = calculateAgeGap(parseDateTime("2000-01-01"), parseDateTime("2001-01-01"));
    expect(r.older).toBe("a");
    expect(r.years).toBe(1);
    expect(r.months).toBe(0);
    expect(r.days).toBe(0);
  });
  it("B older than A", () => {
    const r = calculateAgeGap(parseDateTime("2001-01-01"), parseDateTime("2000-01-01"));
    expect(r.older).toBe("b");
    expect(r.years).toBe(1);
  });
  it("includes total days", () => {
    const r = calculateAgeGap(parseDateTime("2000-01-01"), parseDateTime("2001-01-01"));
    expect(r.totalDays).toBeGreaterThanOrEqual(365);
    expect(r.totalDays).toBeLessThanOrEqual(366);
  });
  it("summary mentions which is older", () => {
    const r = calculateAgeGap(parseDateTime("2000-01-01"), parseDateTime("2001-01-01"));
    expect(r.summary).toContain("older");
  });
  it("handles invalid date input", () => {
    const r = calculateAgeGap(Number.NaN, parseDateTime("2000-01-01"));
    expect(r.summary).toContain("Invalid");
  });
});

describe("age-calculator renderAgeText / renderMilestonesCsv", () => {
  it("renders age as multi-line text", () => {
    const r = calculateAge(parseDateTime("2000-01-15"), parseDateTime("2025-01-15"));
    const text = renderAgeText(r);
    expect(text).toContain("Summary:");
    expect(text).toContain("Calendar breakdown:");
    expect(text).toContain("Totals:");
    expect(text).toContain("Next birthday:");
    expect(text).toContain("Zodiac: Capricorn");
    expect(text).toContain("Chinese zodiac: Dragon");
  });
  it("renders milestones CSV with header", () => {
    const csv = renderMilestonesCsv([]);
    expect(csv).toContain("label,date,passed,days_from_now");
  });
  it("renders milestones CSV rows", () => {
    const birth = parseDateTime("2000-01-01");
    const now = parseDateTime("2025-01-01");
    const ms = computeMilestones(birth, now);
    const csv = renderMilestonesCsv(ms);
    expect(csv).toContain('"10,000 days"');
    expect(csv).toContain('"1,000,000,000 seconds"');
  });
});

describe("age-calculator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      birth: "2000-01-15",
      reference: "2025-01-15",
      ageSummary: "25 years old",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        birth: "2000-01-15",
        reference: "2025-01-15",
        ageSummary: `${i}`,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      birth: "2000-01-15",
      reference: "2025-01-15",
      ageSummary: "25 years old",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("age-calculator shareable URL", () => {
  it("builds share URL with all params", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const state: ShareState = {
      birth: "2000-02-29",
      birthTime: "08:30",
      reference: "2025-01-01",
      referenceTime: "",
      feb29Policy: "mar1",
      gapA: "2000-01-01",
      gapB: "2001-01-01",
    };
    const url = buildShareUrl(state);
    expect(url).toContain("birth=2000-02-29");
    expect(url).toContain("btime=08%3A30");
    expect(url).toContain("ref=2025-01-01");
    expect(url).toContain("feb29=mar1");
    expect(url).toContain("gapa=2000-01-01");
    expect(url).toContain("gapb=2001-01-01");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const state: ShareState = {
      birth: "2000-02-29",
      birthTime: "08:30",
      reference: "2025-01-01",
      referenceTime: "",
      feb29Policy: "mar1",
      gapA: "2000-01-01",
      gapB: "2001-01-01",
    };
    const url = buildShareUrl(state);
    const hash = url.substring(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed).not.toBeNull();
    expect(parsed!.birth).toBe("2000-02-29");
    expect(parsed!.birthTime).toBe("08:30");
    expect(parsed!.reference).toBe("2025-01-01");
    expect(parsed!.feb29Policy).toBe("mar1");
    expect(parsed!.gapA).toBe("2000-01-01");
    expect(parsed!.gapB).toBe("2001-01-01");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("defaults feb29Policy to feb28 when not present", () => {
    const parsed = parseShareUrl("birth=2000-02-29");
    expect(parsed!.feb29Policy).toBe("feb28");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("#")).toBeNull();
  });
  it("returns null when no relevant params", () => {
    expect(parseShareUrl("foo=bar")).toBeNull();
  });
});

// Suppress unused-import lint
export type _Unused = Feb29Policy;

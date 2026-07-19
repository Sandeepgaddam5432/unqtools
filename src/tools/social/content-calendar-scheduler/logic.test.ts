import { describe, it, expect, beforeEach } from "vitest";
import {
  PLATFORMS,
  FREQUENCIES,
  PLATFORM_LABELS,
  FREQUENCY_LABELS,
  BEST_TIME_TO_POST,
  THEME_PRESETS,
  normalizeTheme,
  parseThemes,
  parseStartTimes,
  isValidTime,
  normalizeTime,
  daysInMonth,
  listMonthDates,
  formatIsoDate,
  parseIsoDate,
  dayOfWeek,
  isWeekend,
  filterWeekends,
  generatePlatformDates,
  rotateThemes,
  daysBetween,
  resolveTime,
  buildPlatformPosts,
  computePlatformSummaries,
  detectConflicts,
  detectGaps,
  computeSummary,
  checkThemeBalance,
  buildCalendar,
  renderText,
  renderCsv,
  renderHtml,
  renderMarkdown,
  renderIcs,
  formatIcsDateTime,
  formatIcsDateTimeFromDate,
  escapeIcsText,
  escapeCsv,
  escapeHtml,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Platform,
  type PostingFrequency,
  type CalendarInput,
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

describe("content-calendar-scheduler constants", () => {
  it("has 6 platforms", () => {
    expect(PLATFORMS).toHaveLength(6);
    expect(PLATFORMS).toContain("twitter");
    expect(PLATFORMS).toContain("youtube");
  });
  it("has 4 frequencies", () => {
    expect(FREQUENCIES).toHaveLength(4);
    expect(FREQUENCIES).toContain("3x-week");
  });
  it("has labels for every platform", () => {
    for (const p of PLATFORMS) {
      expect(PLATFORM_LABELS[p]).toBeTruthy();
    }
  });
  it("has labels for every frequency", () => {
    for (const f of FREQUENCIES) {
      expect(FREQUENCY_LABELS[f]).toBeTruthy();
    }
  });
  it("has best-time-to-post for every platform", () => {
    for (const p of PLATFORMS) {
      expect(BEST_TIME_TO_POST[p]).toMatch(/^\d{2}:\d{2}$/);
    }
  });
  it("has theme presets", () => {
    expect(THEME_PRESETS.length).toBeGreaterThanOrEqual(5);
    expect(THEME_PRESETS).toContain("Education");
  });
});

describe("content-calendar-scheduler normalizeTheme + parseThemes", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeTheme("  Best   Practices  ")).toBe("Best Practices");
  });
  it("handles empty", () => {
    expect(normalizeTheme("")).toBe("");
  });
  it("parses one per line", () => {
    expect(parseThemes("Education\nTips\nNews")).toEqual(["Education", "Tips", "News"]);
  });
  it("skips blank lines", () => {
    expect(parseThemes("A\n\nB\n  \nC")).toEqual(["A", "B", "C"]);
  });
  it("returns empty for empty input", () => {
    expect(parseThemes("")).toEqual([]);
  });
});

describe("content-calendar-scheduler time helpers", () => {
  it("isValidTime accepts HH:MM and H:MM", () => {
    expect(isValidTime("09:00")).toBe(true);
    expect(isValidTime("9:00")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
    expect(isValidTime("00:00")).toBe(true);
  });
  it("isValidTime rejects out-of-range", () => {
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("09:60")).toBe(false);
    expect(isValidTime("abc")).toBe(false);
    expect(isValidTime("")).toBe(false);
  });
  it("normalizeTime zero-pads hour", () => {
    expect(normalizeTime("9:00")).toBe("09:00");
    expect(normalizeTime("09:05")).toBe("09:05");
  });
  it("normalizeTime returns empty for invalid", () => {
    expect(normalizeTime("99:99")).toBe("");
    expect(normalizeTime("")).toBe("");
  });
  it("parseStartTimes parses platform,time lines", () => {
    const out = parseStartTimes("twitter,09:00\ninstagram,12:00");
    expect(out.twitter).toBe("09:00");
    expect(out.instagram).toBe("12:00");
  });
  it("parseStartTimes ignores unknown platforms and bad times", () => {
    const out = parseStartTimes("myspace,09:00\ntwitter,badtime\ntwitter,10:30");
    expect((out as Record<string, unknown>).myspace).toBeUndefined();
    expect(out.twitter).toBe("10:30");
  });
});

describe("content-calendar-scheduler date helpers", () => {
  it("daysInMonth for Jan 2026 = 31", () => {
    expect(daysInMonth(2026, 1)).toBe(31);
  });
  it("daysInMonth for Feb 2024 (leap) = 29", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
  });
  it("daysInMonth for Feb 2025 = 28", () => {
    expect(daysInMonth(2025, 2)).toBe(28);
  });
  it("daysInMonth for April 2026 = 30", () => {
    expect(daysInMonth(2026, 4)).toBe(30);
  });
  it("daysInMonth returns 0 for invalid month", () => {
    expect(daysInMonth(2026, 0)).toBe(0);
    expect(daysInMonth(2026, 13)).toBe(0);
  });
  it("listMonthDates returns N dates", () => {
    const dates = listMonthDates(2026, 1);
    expect(dates).toHaveLength(31);
    expect(dates[0]).toBe("2026-01-01");
    expect(dates[30]).toBe("2026-01-31");
  });
  it("formatIsoDate pads month and day", () => {
    expect(formatIsoDate(2026, 1, 5)).toBe("2026-01-05");
  });
  it("parseIsoDate returns Date for valid ISO", () => {
    const d = parseIsoDate("2026-01-15");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(0); // January
    expect(d!.getDate()).toBe(15);
  });
  it("parseIsoDate returns null for invalid", () => {
    expect(parseIsoDate("not-a-date")).toBeNull();
  });
  it("dayOfWeek for 2026-01-01 = Thursday (4)", () => {
    expect(dayOfWeek("2026-01-01")).toBe(4);
  });
  it("isWeekend true for Sat/Sun", () => {
    expect(isWeekend("2026-01-03")).toBe(true); // Saturday
    expect(isWeekend("2026-01-04")).toBe(true); // Sunday
    expect(isWeekend("2026-01-05")).toBe(false); // Monday
  });
  it("filterWeekends keeps all when includeWeekends true", () => {
    const all = listMonthDates(2026, 1);
    expect(filterWeekends(all, true)).toHaveLength(31);
  });
  it("filterWeekends excludes weekends when false", () => {
    const all = listMonthDates(2026, 1);
    expect(filterWeekends(all, false)).toHaveLength(22); // 31 - 9 weekend days
  });
});

describe("content-calendar-scheduler generatePlatformDates", () => {
  const all = listMonthDates(2026, 1);

  it("daily returns all 31 days with weekends", () => {
    expect(generatePlatformDates(all, "daily", true)).toHaveLength(31);
  });
  it("daily excludes weekends when flag off", () => {
    expect(generatePlatformDates(all, "daily", false)).toHaveLength(22);
  });
  it("3x-week picks Mon/Wed/Fri", () => {
    const dates = generatePlatformDates(all, "3x-week", true);
    // Mon: 5, 12, 19, 26 (4)
    // Wed: 7, 14, 21, 28 (4)
    // Fri: 2, 9, 16, 23, 30 (5)
    expect(dates).toHaveLength(13);
    expect(dates).toContain("2026-01-05");
    expect(dates).toContain("2026-01-30");
    // Saturdays should NOT be present
    expect(dates).not.toContain("2026-01-03");
  });
  it("weekly picks all Mondays (4 in Jan 2026)", () => {
    const dates = generatePlatformDates(all, "weekly", true);
    expect(dates).toEqual(["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26"]);
  });
  it("bi-weekly picks 1st and 3rd Mondays", () => {
    const dates = generatePlatformDates(all, "bi-weekly", true);
    expect(dates).toEqual(["2026-01-05", "2026-01-19"]);
  });
});

describe("content-calendar-scheduler rotateThemes", () => {
  it("returns empty themes when none provided", () => {
    const out = rotateThemes(["2026-01-05", "2026-01-07"], []);
    expect(out).toHaveLength(2);
    expect(out[0].theme).toBe("");
  });
  it("rotates themes in order", () => {
    const out = rotateThemes(["2026-01-05", "2026-01-06", "2026-01-07"], ["A", "B", "C"]);
    expect(out.map((o) => o.theme)).toEqual(["A", "B", "C"]);
  });
  it("wraps around the theme list", () => {
    const out = rotateThemes(
      ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08"],
      ["A", "B"],
    );
    expect(out.map((o) => o.theme)).toEqual(["A", "B", "A", "B"]);
  });
  it("7-day no-repeat rule prevents same theme within 7 days", () => {
    // Two posts on Jan 5 and Jan 6 with single theme: should repeat (no other option)
    const out = rotateThemes(["2026-01-05", "2026-01-06"], ["A"]);
    expect(out[0].theme).toBe("A");
    expect(out[1].theme).toBe("A");
  });
  it("with 2 themes 8 days apart, both themes are used without violation", () => {
    const out = rotateThemes(["2026-01-05", "2026-01-13"], ["A", "B"]);
    expect(out[0].theme).toBe("A");
    // Jan 13 is 8 days after Jan 5, A is allowed again — but cursor moves to B
    expect(out[1].theme).toBe("B");
  });
  it("daysBetween computes whole-day diff", () => {
    expect(daysBetween("2026-01-05", "2026-01-12")).toBe(7);
    expect(daysBetween("2026-01-05", "2026-01-05")).toBe(0);
  });
});

describe("content-calendar-scheduler resolveTime + buildPlatformPosts", () => {
  it("uses provided time when valid", () => {
    expect(resolveTime("twitter", { twitter: "11:30" })).toBe("11:30");
  });
  it("falls back to default when missing", () => {
    expect(resolveTime("twitter", {})).toBe(BEST_TIME_TO_POST.twitter);
  });
  it("falls back to default when invalid", () => {
    expect(resolveTime("twitter", { twitter: "bad" })).toBe(BEST_TIME_TO_POST.twitter);
  });
  it("buildPlatformPosts assigns time + theme per date", () => {
    const dates = ["2026-01-05", "2026-01-07"];
    const themes = [
      { date: "2026-01-05", theme: "Tips" },
      { date: "2026-01-07", theme: "News" },
    ];
    const posts = buildPlatformPosts("twitter", dates, themes, { twitter: "09:00" });
    expect(posts).toHaveLength(2);
    expect(posts[0]).toEqual({
      date: "2026-01-05",
      platform: "twitter",
      time: "09:00",
      theme: "Tips",
    });
    expect(posts[1].theme).toBe("News");
  });
});

describe("content-calendar-scheduler computePlatformSummaries", () => {
  it("groups by platform and theme", () => {
    const posts = [
      { date: "2026-01-05", platform: "twitter" as Platform, time: "09:00", theme: "A" },
      { date: "2026-01-06", platform: "twitter" as Platform, time: "09:00", theme: "A" },
      { date: "2026-01-07", platform: "instagram" as Platform, time: "12:00", theme: "B" },
    ];
    const sums = computePlatformSummaries(posts);
    expect(sums).toHaveLength(2);
    const tw = sums.find((s) => s.platform === "twitter")!;
    expect(tw.totalPosts).toBe(2);
    expect(tw.byTheme["A"]).toBe(2);
  });
  it("returns empty for empty input", () => {
    expect(computePlatformSummaries([])).toEqual([]);
  });
});

describe("content-calendar-scheduler detectConflicts", () => {
  it("detects two platforms at same date+time", () => {
    const posts = [
      { date: "2026-01-05", platform: "twitter" as Platform, time: "09:00", theme: "" },
      { date: "2026-01-05", platform: "instagram" as Platform, time: "09:00", theme: "" },
      { date: "2026-01-06", platform: "twitter" as Platform, time: "09:00", theme: "" },
    ];
    const conflicts = detectConflicts(posts);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].date).toBe("2026-01-05");
    expect(conflicts[0].time).toBe("09:00");
    expect(conflicts[0].platforms).toContain("twitter");
    expect(conflicts[0].platforms).toContain("instagram");
  });
  it("returns empty when no conflicts", () => {
    const posts = [
      { date: "2026-01-05", platform: "twitter" as Platform, time: "09:00", theme: "" },
      { date: "2026-01-05", platform: "instagram" as Platform, time: "10:00", theme: "" },
    ];
    expect(detectConflicts(posts)).toHaveLength(0);
  });
});

describe("content-calendar-scheduler detectGaps", () => {
  it("finds days with no posts", () => {
    const all = listMonthDates(2026, 1);
    const posts = [
      { date: "2026-01-05", platform: "twitter" as Platform, time: "09:00", theme: "" },
    ];
    const gaps = detectGaps(all, posts);
    expect(gaps).toHaveLength(30);
    expect(gaps).not.toContain("2026-01-05");
  });
  it("returns empty when all days have posts", () => {
    const all = ["2026-01-05", "2026-01-06"];
    const posts = [
      { date: "2026-01-05", platform: "twitter" as Platform, time: "09:00", theme: "" },
      { date: "2026-01-06", platform: "twitter" as Platform, time: "09:00", theme: "" },
    ];
    expect(detectGaps(all, posts)).toHaveLength(0);
  });
});

describe("content-calendar-scheduler computeSummary", () => {
  it("computes totals and averages", () => {
    const all = listMonthDates(2026, 1); // 31 days
    const posts = [
      { date: "2026-01-05", platform: "twitter" as Platform, time: "09:00", theme: "A" },
      { date: "2026-01-06", platform: "twitter" as Platform, time: "09:00", theme: "B" },
      { date: "2026-01-07", platform: "instagram" as Platform, time: "12:00", theme: "A" },
    ];
    const s = computeSummary(all, posts);
    expect(s.totalPosts).toBe(3);
    expect(s.daysInMonth).toBe(31);
    expect(s.scheduledDays).toBe(3);
    expect(s.avgPostsPerDay).toBe(0.1); // 3/31 = 0.096... → 0.1
    expect(s.byPlatform.twitter).toBe(2);
    expect(s.byPlatform.instagram).toBe(1);
    expect(s.byTheme["A"]).toBe(2);
    expect(s.byTheme["B"]).toBe(1);
  });
});

describe("content-calendar-scheduler checkThemeBalance", () => {
  it("balanced when single theme", () => {
    const posts = [
      { date: "2026-01-05", platform: "twitter" as Platform, time: "09:00", theme: "A" },
    ];
    const b = checkThemeBalance(posts);
    expect(b.balanced).toBe(true);
    expect(b.themes).toHaveLength(1);
  });
  it("balanced when equal distribution", () => {
    const posts = [
      { date: "2026-01-05", platform: "twitter" as Platform, time: "09:00", theme: "A" },
      { date: "2026-01-06", platform: "twitter" as Platform, time: "09:00", theme: "B" },
    ];
    const b = checkThemeBalance(posts);
    expect(b.balanced).toBe(true);
    expect(b.maxShare).toBe(50);
    expect(b.minShare).toBe(50);
  });
  it("unbalanced when distribution skewed beyond 25pp", () => {
    const posts = [
      { date: "2026-01-05", platform: "twitter" as Platform, time: "09:00", theme: "A" },
      { date: "2026-01-06", platform: "twitter" as Platform, time: "09:00", theme: "A" },
      { date: "2026-01-07", platform: "twitter" as Platform, time: "09:00", theme: "A" },
      { date: "2026-01-08", platform: "twitter" as Platform, time: "09:00", theme: "B" },
    ];
    const b = checkThemeBalance(posts);
    expect(b.balanced).toBe(false);
    expect(b.themes[0].theme).toBe("A"); // sorted by count desc
  });
});

describe("content-calendar-scheduler buildCalendar", () => {
  it("builds full calendar for Jan 2026 single platform weekly", () => {
    const input: CalendarInput = {
      year: 2026,
      month: 1,
      platforms: ["twitter"],
      postingFrequency: "weekly",
      contentThemes: ["Tips", "News"],
      includeWeekends: true,
      startTimes: { twitter: "09:00" },
    };
    const result = buildCalendar(input);
    expect(result.posts).toHaveLength(4); // 4 Mondays
    expect(result.posts.every((p) => p.platform === "twitter")).toBe(true);
    expect(result.byPlatform).toHaveLength(1);
    expect(result.byPlatform[0].totalPosts).toBe(4);
    // 4 Mondays: 2026-01-05, 12, 19, 26 — spans > 7 days, so themes alternate
    expect(result.posts[0].theme).toBe("Tips");
    expect(result.posts[1].theme).toBe("News");
    expect(result.posts[2].theme).toBe("Tips");
    expect(result.posts[3].theme).toBe("News");
    expect(result.conflicts).toHaveLength(0);
    // 31 - 4 = 27 gap days
    expect(result.gaps).toHaveLength(27);
    expect(result.summary.totalPosts).toBe(4);
    expect(result.summary.avgPostsPerDay).toBe(0.13); // 4/31 = 0.129... → 0.13
  });

  it("detects conflicts when two platforms share time", () => {
    const input: CalendarInput = {
      year: 2026,
      month: 1,
      platforms: ["twitter", "instagram"],
      postingFrequency: "weekly",
      contentThemes: ["A"],
      includeWeekends: true,
      startTimes: { twitter: "09:00", instagram: "09:00" },
    };
    const result = buildCalendar(input);
    // 4 Mondays × 2 platforms same time = 4 conflicts
    expect(result.conflicts).toHaveLength(4);
    expect(result.conflicts[0].platforms).toContain("twitter");
    expect(result.conflicts[0].platforms).toContain("instagram");
  });

  it("returns empty posts when no platforms", () => {
    const input: CalendarInput = {
      year: 2026,
      month: 1,
      platforms: [],
      postingFrequency: "weekly",
      contentThemes: ["A"],
      includeWeekends: true,
      startTimes: {},
    };
    const result = buildCalendar(input);
    expect(result.posts).toEqual([]);
    expect(result.byPlatform).toEqual([]);
    expect(result.summary.totalPosts).toBe(0);
  });

  it("works with weekend exclusion", () => {
    const input: CalendarInput = {
      year: 2026,
      month: 1,
      platforms: ["twitter"],
      postingFrequency: "daily",
      contentThemes: ["Tips"],
      includeWeekends: false,
      startTimes: { twitter: "09:00" },
    };
    const result = buildCalendar(input);
    expect(result.posts).toHaveLength(22); // 22 weekdays
    expect(result.posts.every((p) => !isWeekend(p.date))).toBe(true);
  });
});

describe("content-calendar-scheduler renderers", () => {
  const sampleInput: CalendarInput = {
    year: 2026,
    month: 1,
    platforms: ["twitter"],
    postingFrequency: "weekly",
    contentThemes: ["Tips"],
    includeWeekends: true,
    startTimes: { twitter: "09:00" },
  };
  const result = buildCalendar(sampleInput);

  it("renderText contains date headers and posts", () => {
    const txt = renderText(result);
    expect(txt).toContain("Content Calendar");
    expect(txt).toContain("2026-01-05");
    expect(txt).toContain("Twitter / X");
  });
  it("renderText returns empty for empty", () => {
    expect(renderText({ ...result, posts: [] })).toBe("");
  });
  it("renderCsv has header and rows", () => {
    const csv = renderCsv(result);
    expect(csv).toContain("date,platform,time,theme");
    expect(csv).toContain("2026-01-05,twitter,09:00,Tips");
  });
  it("renderHtml produces valid HTML", () => {
    const html = renderHtml(result);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<table>");
    expect(html).toContain("2026-01-05");
  });
  it("renderHtml handles empty", () => {
    const html = renderHtml({ ...result, posts: [] });
    expect(html).toContain("No posts scheduled");
  });
  it("renderMarkdown produces a markdown table", () => {
    const md = renderMarkdown(result);
    expect(md).toContain("# Content Calendar");
    expect(md).toContain("| Date | Time | Platform | Theme |");
    expect(md).toContain("2026-01-05");
  });
  it("renderIcs produces VCALENDAR with VEVENTs", () => {
    const ics = renderIcs(result);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("DTSTART:20260105T090000");
    expect(ics).toContain("SUMMARY:Twitter / X post — Tips");
  });
  it("renderIcs handles empty result gracefully", () => {
    const ics = renderIcs({ ...result, posts: [] });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});

describe("content-calendar-scheduler ICS + escaping helpers", () => {
  it("formatIcsDateTime formats UTC timestamp", () => {
    const d = new Date(Date.UTC(2026, 0, 5, 9, 0, 0));
    expect(formatIcsDateTime(d)).toBe("20260105T090000Z");
  });
  it("formatIcsDateTimeFromDate formats local timestamp", () => {
    expect(formatIcsDateTimeFromDate("2026-01-05", 9, 0)).toBe("20260105T090000");
    expect(formatIcsDateTimeFromDate("2026-01-05", 14, 30)).toBe("20260105T143000");
  });
  it("escapeIcsText escapes special chars", () => {
    expect(escapeIcsText("a,b;c\nd")).toBe("a\\,b\\;c\\nd");
    expect(escapeIcsText("a\\b")).toBe("a\\\\b");
  });
  it("escapeCsv quotes when needed", () => {
    expect(escapeCsv("hello")).toBe("hello");
    expect(escapeCsv("a,b")).toBe('"a,b"');
    expect(escapeCsv('a"b')).toBe('"a""b"');
  });
  it("escapeHtml escapes < > & \" '", () => {
    expect(escapeHtml("<b>")).toBe("&lt;b&gt;");
    expect(escapeHtml("a&b")).toBe("a&amp;b");
    expect(escapeHtml('"x"')).toBe("&quot;x&quot;");
  });
});

describe("content-calendar-scheduler history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      year: 2026,
      month: 1,
      platforms: ["twitter"],
      postingFrequency: "weekly",
      themeCount: 2,
      totalPosts: 4,
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].year).toBe(2026);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        year: 2026,
        month: 1,
        platforms: ["twitter"],
        postingFrequency: "weekly",
        themeCount: 1,
        totalPosts: 1,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, year: 2026, month: 1, platforms: ["twitter"],
      postingFrequency: "weekly", themeCount: 1, totalPosts: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("content-calendar-scheduler shareable URL", () => {
  const input: CalendarInput = {
    year: 2026,
    month: 3,
    platforms: ["twitter", "instagram"],
    postingFrequency: "3x-week",
    contentThemes: ["Tips", "News"],
    includeWeekends: false,
    startTimes: { twitter: "09:00", instagram: "12:00" },
  };

  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(input);
    expect(url).toContain("y=2026");
    expect(url).toContain("m=3");
    expect(url).toContain("p=twitter%2Cinstagram");
    expect(url).toContain("freq=3x-week");
    expect(url).toContain("wk=0");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("round-trips inputs through parseShareUrl", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(input);
    const hash = url.substring(url.indexOf("#") + 1);
    const parsed = parseShareUrl(hash);
    expect(parsed.year).toBe(2026);
    expect(parsed.month).toBe(3);
    expect(parsed.platforms).toEqual(["twitter", "instagram"]);
    expect(parsed.postingFrequency).toBe("3x-week");
    expect(parsed.includeWeekends).toBe(false);
    expect(parsed.contentThemes).toEqual(["Tips", "News"]);
    expect(parsed.startTimes.twitter).toBe("09:00");
    expect(parsed.startTimes.instagram).toBe("12:00");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("parseShareUrl returns defaults for empty hash", () => {
    const p = parseShareUrl("");
    expect(p.platforms).toEqual([]);
    expect(p.postingFrequency).toBe("3x-week");
    expect(p.includeWeekends).toBe(true);
  });

  it("parseShareUrl filters invalid platforms", () => {
    const p = parseShareUrl("y=2026&m=1&p=twitter,myspace,pinterest");
    expect(p.platforms).toEqual(["twitter"]);
  });

  it("parseShareUrl falls back to default frequency when invalid", () => {
    const p = parseShareUrl("y=2026&m=1&freq=hourly");
    expect(p.postingFrequency).toBe("3x-week");
  });
});

// Suppress unused-import lint
export type _Unused = Platform | PostingFrequency;

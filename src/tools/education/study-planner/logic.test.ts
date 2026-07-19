import { describe, it, expect, beforeEach } from "vitest";
import {
  BREAK_PRESETS,
  SESSION_PRESETS,
  DIFFICULTY_MULTIPLIERS,
  DIFFICULTY_SESSIONS_NEEDED,
  DAY_OF_WEEK_LABELS,
  DEFAULTS,
  parseUTCDate,
  formatUTCDate,
  todayUTC,
  getDayOfWeek,
  calculateDaysUntil,
  isValidDate,
  parseTimeToMinutes,
  formatMinutesToTime,
  normalizeSubject,
  parseExcludeDates,
  parseChapterDifficulties,
  getStudyDaysOfWeek,
  computeAvailableStudyDays,
  allocateRevisionDays,
  computeChaptersPerDay,
  generateSessionBlocks,
  pomodoroSchedule,
  allocateChaptersToSessions,
  convertToRevisionSessions,
  getISOWeekKey,
  generateSchedule,
  computeWeeklySummaries,
  computeSummaryStats,
  renderText,
  renderCsv,
  renderHtml,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type StudyInput,
  type ChapterDifficulty,
  type HistoryEntry,
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

describe("study-planner constants", () => {
  it("has 4 break presets", () => {
    expect(BREAK_PRESETS).toEqual([5, 10, 15, 30]);
  });
  it("has 3 session presets", () => {
    expect(SESSION_PRESETS).toEqual([25, 50, 90]);
  });
  it("has 3 difficulty multipliers", () => {
    expect(Object.keys(DIFFICULTY_MULTIPLIERS)).toHaveLength(3);
    expect(DIFFICULTY_MULTIPLIERS.easy).toBeLessThan(DIFFICULTY_MULTIPLIERS.medium);
    expect(DIFFICULTY_MULTIPLIERS.hard).toBeGreaterThan(DIFFICULTY_MULTIPLIERS.medium);
  });
  it("hard chapters need 2 sessions, easy/medium need 1", () => {
    expect(DIFFICULTY_SESSIONS_NEEDED.easy).toBe(1);
    expect(DIFFICULTY_SESSIONS_NEEDED.medium).toBe(1);
    expect(DIFFICULTY_SESSIONS_NEEDED.hard).toBe(2);
  });
  it("has 7 day-of-week labels", () => {
    expect(DAY_OF_WEEK_LABELS).toHaveLength(7);
    expect(DAY_OF_WEEK_LABELS[1]).toBe("Monday");
  });
  it("has defaults", () => {
    expect(DEFAULTS.totalChapters).toBe(12);
    expect(DEFAULTS.includeRevision).toBe(true);
  });
});

describe("study-planner date utilities", () => {
  it("parseUTCDate parses YYYY-MM-DD", () => {
    const d = parseUTCDate("2025-01-06");
    expect(d.getUTCFullYear()).toBe(2025);
    expect(d.getUTCMonth()).toBe(0);
    expect(d.getUTCDate()).toBe(6);
  });
  it("parseUTCDate returns invalid for bad format", () => {
    expect(isNaN(parseUTCDate("not-a-date").getTime())).toBe(true);
    expect(isNaN(parseUTCDate("2025/01/06").getTime())).toBe(true);
  });
  it("formatUTCDate round-trips", () => {
    const d = parseUTCDate("2025-12-31");
    expect(formatUTCDate(d)).toBe("2025-12-31");
  });
  it("isValidDate validates format and real dates", () => {
    expect(isValidDate("2025-01-06")).toBe(true);
    expect(isValidDate("2025-13-01")).toBe(false); // month 13
    expect(isValidDate("2025-01-32")).toBe(false); // day 32
    expect(isValidDate("not-a-date")).toBe(false);
    expect(isValidDate("")).toBe(false);
  });
  it("todayUTC returns YYYY-MM-DD format", () => {
    expect(/^\d{4}-\d{2}-\d{2}$/.test(todayUTC())).toBe(true);
  });
  it("getDayOfWeek returns 0-6 (Mon=1 for 2025-01-06)", () => {
    expect(getDayOfWeek("2025-01-06")).toBe(1); // Monday
    expect(getDayOfWeek("2025-01-05")).toBe(0); // Sunday
    expect(getDayOfWeek("2025-01-11")).toBe(6); // Saturday
  });
  it("calculateDaysUntil computes day difference", () => {
    expect(calculateDaysUntil("2025-01-13", "2025-01-06")).toBe(7);
    expect(calculateDaysUntil("2025-01-06", "2025-01-06")).toBe(0);
    expect(calculateDaysUntil("2025-01-06", "2025-01-13")).toBe(-7);
  });
});

describe("study-planner time utilities", () => {
  it("parseTimeToMinutes parses HH:MM", () => {
    expect(parseTimeToMinutes("09:00")).toBe(540);
    expect(parseTimeToMinutes("00:00")).toBe(0);
    expect(parseTimeToMinutes("23:59")).toBe(1439);
  });
  it("parseTimeToMinutes returns 0 for invalid", () => {
    expect(parseTimeToMinutes("")).toBe(0);
    expect(parseTimeToMinutes("25:00")).toBe(0);
    expect(parseTimeToMinutes("09:60")).toBe(0);
  });
  it("formatMinutesToTime formats minutes as HH:MM", () => {
    expect(formatMinutesToTime(540)).toBe("09:00");
    expect(formatMinutesToTime(0)).toBe("00:00");
    expect(formatMinutesToTime(1439)).toBe("23:59");
  });
  it("formatMinutesToTime wraps modulo 24h", () => {
    expect(formatMinutesToTime(1440)).toBe("00:00");
    expect(formatMinutesToTime(1500)).toBe("01:00");
  });
});

describe("study-planner parsers", () => {
  it("normalizeSubject collapses whitespace", () => {
    expect(normalizeSubject("  Advanced   Mathematics  ")).toBe("Advanced Mathematics");
    expect(normalizeSubject("")).toBe("");
  });
  it("parseExcludeDates parses comma-separated", () => {
    expect(parseExcludeDates("2025-01-01, 2025-01-02")).toEqual(["2025-01-01", "2025-01-02"]);
  });
  it("parseExcludeDates parses newline-separated", () => {
    expect(parseExcludeDates("2025-01-01\n2025-01-02")).toEqual(["2025-01-01", "2025-01-02"]);
  });
  it("parseExcludeDates filters invalid dates", () => {
    expect(parseExcludeDates("2025-01-01, not-a-date, 2025-01-02")).toEqual(["2025-01-01", "2025-01-02"]);
    expect(parseExcludeDates("")).toEqual([]);
  });
  it("parseChapterDifficulties parses easy/medium/hard", () => {
    expect(parseChapterDifficulties("easy, medium, hard")).toEqual(["easy", "medium", "hard"]);
  });
  it("parseChapterDifficulties filters invalid", () => {
    expect(parseChapterDifficulties("easy, xyz, hard, EASY")).toEqual(["easy", "hard", "easy"]);
    expect(parseChapterDifficulties("")).toEqual([]);
  });
  it("getStudyDaysOfWeek prefers weekdays first", () => {
    expect(getStudyDaysOfWeek(5)).toEqual([1, 2, 3, 4, 5]); // Mon-Fri
    expect(getStudyDaysOfWeek(6)).toEqual([1, 2, 3, 4, 5, 6]); // Mon-Sat
    expect(getStudyDaysOfWeek(7)).toEqual([1, 2, 3, 4, 5, 6, 0]); // all week
    expect(getStudyDaysOfWeek(0)).toEqual([]);
    expect(getStudyDaysOfWeek(-1)).toEqual([]); // clamped
  });
});

describe("study-planner computeAvailableStudyDays", () => {
  it("returns Mon-Sat days for studyDaysPerWeek=6", () => {
    const days = computeAvailableStudyDays("2025-01-06", "2025-01-13", 6, []);
    // 01-06 Mon, 07 Tue, 08 Wed, 09 Thu, 10 Fri, 11 Sat, 12 Sun
    // With studyDaysPerWeek=6 (Mon-Sat), exclude Sun 12
    expect(days).toEqual(["2025-01-06", "2025-01-07", "2025-01-08", "2025-01-09", "2025-01-10", "2025-01-11"]);
  });
  it("returns all 7 days for studyDaysPerWeek=7", () => {
    const days = computeAvailableStudyDays("2025-01-06", "2025-01-13", 7, []);
    expect(days).toHaveLength(7);
    expect(days).toContain("2025-01-12"); // Sunday included
  });
  it("excludes exam date (exclusive end)", () => {
    const days = computeAvailableStudyDays("2025-01-06", "2025-01-07", 7, []);
    expect(days).toEqual(["2025-01-06"]);
  });
  it("returns empty if exam is before or on fromDate", () => {
    expect(computeAvailableStudyDays("2025-01-13", "2025-01-13", 7, [])).toEqual([]);
    expect(computeAvailableStudyDays("2025-01-14", "2025-01-13", 7, [])).toEqual([]);
  });
  it("skips excluded dates", () => {
    const days = computeAvailableStudyDays("2025-01-06", "2025-01-09", 7, ["2025-01-07"]);
    expect(days).toEqual(["2025-01-06", "2025-01-08"]);
  });
});

describe("study-planner allocateRevisionDays", () => {
  it("reserves last 2 days as revision when includeRevision=true", () => {
    const days = ["2025-01-06", "2025-01-07", "2025-01-08", "2025-01-09", "2025-01-10"];
    const { studyDays, revisionDays } = allocateRevisionDays(days, true, 2);
    expect(studyDays).toEqual(["2025-01-06", "2025-01-07", "2025-01-08"]);
    expect(revisionDays).toEqual(["2025-01-09", "2025-01-10"]);
  });
  it("returns all as studyDays when includeRevision=false", () => {
    const days = ["2025-01-06", "2025-01-07", "2025-01-08"];
    const { studyDays, revisionDays } = allocateRevisionDays(days, false, 2);
    expect(studyDays).toEqual(days);
    expect(revisionDays).toEqual([]);
  });
  it("handles daysToReserve=0", () => {
    const days = ["2025-01-06", "2025-01-07"];
    const { studyDays, revisionDays } = allocateRevisionDays(days, true, 0);
    expect(studyDays).toEqual(days);
    expect(revisionDays).toEqual([]);
  });
  it("handles when daysToReserve > day count", () => {
    const days = ["2025-01-06"];
    const { studyDays, revisionDays } = allocateRevisionDays(days, true, 2);
    expect(studyDays).toEqual([]);
    expect(revisionDays).toEqual(["2025-01-06"]);
  });
});

describe("study-planner computeChaptersPerDay", () => {
  it("returns requested when time budget allows", () => {
    expect(computeChaptersPerDay(6, 6, 1)).toBe(1);
    expect(computeChaptersPerDay(12, 12, 2)).toBe(2);
  });
  it("auto-adjusts upward when needed", () => {
    // 12 chapters / 6 days = 2 required; user requested 1 → 2
    expect(computeChaptersPerDay(12, 6, 1)).toBe(2);
    // 12 chapters / 4 days = 3 required; user requested 2 → 3
    expect(computeChaptersPerDay(12, 4, 2)).toBe(3);
  });
  it("returns at least 1", () => {
    expect(computeChaptersPerDay(0, 5, 0)).toBe(1);
  });
  it("returns max(1, requested) when studyDayCount<=0", () => {
    expect(computeChaptersPerDay(10, 0, 3)).toBe(3);
    expect(computeChaptersPerDay(10, 0, 0)).toBe(1);
  });
});

describe("study-planner generateSessionBlocks (Pomodoro)", () => {
  it("generates 3 study + 2 break blocks for 2h with 50/15", () => {
    // 120 min = 50 + 50 + 20
    const blocks = generateSessionBlocks("09:00", 50, 15, 2);
    const studies = blocks.filter((b) => b.type === "study");
    const breaks = blocks.filter((b) => b.type === "break");
    expect(studies).toHaveLength(3);
    expect(breaks).toHaveLength(2);
    expect(studies[0].startTime).toBe("09:00");
    expect(studies[0].endTime).toBe("09:50");
    expect(studies[0].sessionNumber).toBe(1);
    expect(breaks[0].startTime).toBe("09:50");
    expect(breaks[0].endTime).toBe("10:05");
    expect(studies[2].durationMin).toBe(20); // truncated last session
  });
  it("inserts long break after every 4 sessions", () => {
    // 240 min = 50*4 + 40
    const blocks = generateSessionBlocks("09:00", 50, 15, 4, 60, 4);
    const longBreaks = blocks.filter((b) => b.type === "long-break");
    expect(longBreaks).toHaveLength(1);
    expect(longBreaks[0].durationMin).toBe(60);
    // 5 study + 3 break + 1 long-break = 9 blocks
    expect(blocks).toHaveLength(9);
  });
  it("returns empty for 0 hours", () => {
    expect(generateSessionBlocks("09:00", 50, 15, 0)).toEqual([]);
  });
  it("returns empty for 0 session duration", () => {
    expect(generateSessionBlocks("09:00", 0, 15, 2)).toEqual([]);
  });
  it("pomodoroSchedule is alias for generateSessionBlocks", () => {
    const a = generateSessionBlocks("09:00", 50, 15, 2);
    const b = pomodoroSchedule("09:00", 50, 15, 2);
    expect(b).toEqual(a);
  });
  it("handles sessionDuration > totalStudyMinutes (single short session)", () => {
    const blocks = generateSessionBlocks("09:00", 60, 15, 0.5); // 30 min
    expect(blocks).toHaveLength(1);
    expect(blocks[0].durationMin).toBe(30);
    expect(blocks[0].type).toBe("study");
  });
});

describe("study-planner allocateChaptersToSessions", () => {
  it("assigns 1 chapter per study session by default", () => {
    const sessions = generateSessionBlocks("09:00", 50, 15, 2); // 3 study + 2 break
    const updated = allocateChaptersToSessions(sessions, [0, 1, 2], []);
    const studies = updated.filter((s) => s.type === "study");
    expect(studies[0].chapter).toBe(1);
    expect(studies[1].chapter).toBe(2);
    expect(studies[2].chapter).toBe(3);
  });
  it("hard chapters take 2 sessions", () => {
    const sessions = generateSessionBlocks("09:00", 50, 15, 2); // 3 study + 2 break
    // Chapter 1 (index 0) = easy, Chapter 2 (index 1) = hard (takes 2 sessions)
    const updated = allocateChaptersToSessions(sessions, [0, 1], ["easy", "hard"]);
    const studies = updated.filter((s) => s.type === "study");
    expect(studies[0].chapter).toBe(1);
    expect(studies[1].chapter).toBe(2);
    expect(studies[2].chapter).toBe(2); // hard chapter spans 2 sessions
  });
  it("does not assign chapters to breaks", () => {
    const sessions = generateSessionBlocks("09:00", 50, 15, 2);
    const updated = allocateChaptersToSessions(sessions, [0], []);
    updated.forEach((s) => {
      if (s.type === "break") expect(s.chapter).toBeUndefined();
    });
  });
  it("stops assigning when study sessions run out", () => {
    // 1 study session, 5 chapters requested — only first assigned
    const sessions = generateSessionBlocks("09:00", 50, 15, 0.5); // 1 study
    const updated = allocateChaptersToSessions(sessions, [0, 1, 2, 3, 4], []);
    const studies = updated.filter((s) => s.type === "study");
    expect(studies[0].chapter).toBe(1);
    expect(studies).toHaveLength(1);
  });
});

describe("study-planner convertToRevisionSessions", () => {
  it("converts study sessions to revision type", () => {
    const sessions = generateSessionBlocks("09:00", 50, 15, 2);
    const converted = convertToRevisionSessions(sessions);
    const studies = converted.filter((s) => s.type === "study");
    const revisions = converted.filter((s) => s.type === "revision");
    expect(studies).toHaveLength(0);
    expect(revisions).toHaveLength(3);
    // Breaks unchanged
    expect(converted.filter((s) => s.type === "break")).toHaveLength(2);
  });
});

describe("study-planner getISOWeekKey", () => {
  it("returns YYYY-Www format", () => {
    expect(getISOWeekKey("2025-01-06")).toBe("2025-W02"); // Mon Jan 6 2025
  });
  it("same week for Mon and Sun of same week", () => {
    expect(getISOWeekKey("2025-01-06")).toBe(getISOWeekKey("2025-01-12")); // Mon & Sun
  });
  it("different weeks for adjacent Sundays/Mondays", () => {
    expect(getISOWeekKey("2025-01-12")).not.toBe(getISOWeekKey("2025-01-13"));
  });
});

describe("study-planner generateSchedule (integration)", () => {
  const baseInput: StudyInput = {
    subjectName: "Mathematics",
    examDate: "2025-02-03", // Monday
    totalChapters: 12,
    chaptersPerDay: 2,
    dailyStudyHours: 2,
    studyDaysPerWeek: 6,
    includeRevision: true,
    startTime: "09:00",
    breakDurationMinutes: 15,
    sessionDurationMinutes: 50,
    excludeDates: "",
    chapterDifficulties: "",
    fromDate: "2025-01-20", // Monday
  };

  it("generates 12 day plans (10 study/review + 2 revision)", () => {
    const plans = generateSchedule(baseInput);
    expect(plans).toHaveLength(12);
    expect(plans.filter((p) => p.type === "study").length).toBe(6); // 12 chapters / 2 per day
    expect(plans.filter((p) => p.type === "review").length).toBe(4); // leftover study days
    expect(plans.filter((p) => p.type === "revision").length).toBe(2); // reserved
  });

  it("assigns chapters 1-12 across first 6 study days", () => {
    const plans = generateSchedule(baseInput);
    const studyPlans = plans.filter((p) => p.type === "study");
    const allChapters = studyPlans.flatMap((p) => p.chapters);
    expect(allChapters).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("sorts plans by date ascending", () => {
    const plans = generateSchedule(baseInput);
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i].date >= plans[i - 1].date).toBe(true);
    }
  });

  it("revision days have type=revision and revision sessions", () => {
    const plans = generateSchedule(baseInput);
    const revPlans = plans.filter((p) => p.type === "revision");
    expect(revPlans).toHaveLength(2);
    revPlans.forEach((p) => {
      expect(p.chapters).toEqual([]);
      const revSessions = p.sessions.filter((s) => s.type === "revision");
      expect(revSessions.length).toBeGreaterThan(0);
    });
  });

  it("returns empty for past exam date", () => {
    const past: StudyInput = { ...baseInput, examDate: "2025-01-19", fromDate: "2025-01-20" };
    expect(generateSchedule(past)).toEqual([]);
  });

  it("returns empty for invalid exam date", () => {
    expect(generateSchedule({ ...baseInput, examDate: "not-a-date" })).toEqual([]);
  });

  it("respects excludeDates", () => {
    const input: StudyInput = {
      ...baseInput,
      examDate: "2025-01-13", // 7 days from 01-20? No, before.
      fromDate: "2025-01-06", // Mon
      excludeDates: "2025-01-07, 2025-01-08",
      totalChapters: 1,
      chaptersPerDay: 1,
    };
    const plans = generateSchedule(input);
    const dates = plans.map((p) => p.date);
    expect(dates).not.toContain("2025-01-07");
    expect(dates).not.toContain("2025-01-08");
  });

  it("respects includeRevision=false", () => {
    const input: StudyInput = { ...baseInput, includeRevision: false };
    const plans = generateSchedule(input);
    expect(plans.filter((p) => p.type === "revision").length).toBe(0);
  });
});

describe("study-planner computeWeeklySummaries", () => {
  it("groups day plans by ISO week", () => {
    const input: StudyInput = {
      subjectName: "Test",
      examDate: "2025-02-03",
      totalChapters: 12,
      chaptersPerDay: 2,
      dailyStudyHours: 2,
      studyDaysPerWeek: 6,
      includeRevision: true,
      startTime: "09:00",
      breakDurationMinutes: 15,
      sessionDurationMinutes: 50,
      excludeDates: "",
      chapterDifficulties: "",
      fromDate: "2025-01-20",
    };
    const plans = generateSchedule(input);
    const summaries = computeWeeklySummaries(plans);
    expect(summaries).toHaveLength(2);
    // Week 1 (Jan 20-26): all 12 chapters, 6 study days, 0 revision
    const w1 = summaries[0];
    expect(w1.totalChapters).toBe(12);
    expect(w1.studyDays).toBe(6);
    expect(w1.revisionDays).toBe(0);
    // Week 2 (Jan 27-Feb 2): 0 chapters (all already covered), 2 revision days
    const w2 = summaries[1];
    expect(w2.totalChapters).toBe(0);
    expect(w2.revisionDays).toBe(2);
  });
  it("returns empty for empty input", () => {
    expect(computeWeeklySummaries([])).toEqual([]);
  });
});

describe("study-planner computeSummaryStats", () => {
  it("computes summary across all day plans", () => {
    const input: StudyInput = {
      subjectName: "Test",
      examDate: "2025-02-03",
      totalChapters: 12,
      chaptersPerDay: 2,
      dailyStudyHours: 2,
      studyDaysPerWeek: 6,
      includeRevision: true,
      startTime: "09:00",
      breakDurationMinutes: 15,
      sessionDurationMinutes: 50,
      excludeDates: "",
      chapterDifficulties: "",
      fromDate: "2025-01-20",
    };
    const plans = generateSchedule(input);
    const stats = computeSummaryStats(plans, 12, 14);
    expect(stats.totalDays).toBe(12);
    expect(stats.studyDays).toBe(6);
    expect(stats.revisionDays).toBe(2);
    expect(stats.reviewDays).toBe(4);
    expect(stats.plannedChapters).toBe(12);
    expect(stats.totalChapters).toBe(12);
    expect(stats.completionPercent).toBe(100);
    expect(stats.totalHours).toBe(24); // 12 days × 2h
    expect(stats.daysUntilExam).toBe(14);
  });
  it("handles 0 chapters", () => {
    const stats = computeSummaryStats([], 0, 0);
    expect(stats.completionPercent).toBe(0);
    expect(stats.totalDays).toBe(0);
  });
});

describe("study-planner renderText", () => {
  it("renders subject name, exam date, and sessions", () => {
    const input: StudyInput = {
      subjectName: "Mathematics",
      examDate: "2025-01-13",
      totalChapters: 2,
      chaptersPerDay: 1,
      dailyStudyHours: 1,
      studyDaysPerWeek: 7,
      includeRevision: false,
      startTime: "09:00",
      breakDurationMinutes: 10,
      sessionDurationMinutes: 30,
      excludeDates: "",
      chapterDifficulties: "",
      fromDate: "2025-01-06",
    };
    const plans = generateSchedule(input);
    const text = renderText(plans, "Mathematics", "2025-01-13", 7);
    expect(text).toContain("Study Plan: Mathematics");
    expect(text).toContain("Exam date: 2025-01-13");
    expect(text).toContain("2025-01-06");
    expect(text).toContain("STUDY");
    expect(text).toContain("Study #1");
    expect(text).toContain("Ch.1");
  });
  it("renders weekly summaries section when present", () => {
    const input: StudyInput = {
      subjectName: "Math",
      examDate: "2025-02-03",
      totalChapters: 4,
      chaptersPerDay: 1,
      dailyStudyHours: 1,
      studyDaysPerWeek: 6,
      includeRevision: true,
      startTime: "09:00",
      breakDurationMinutes: 10,
      sessionDurationMinutes: 30,
      excludeDates: "",
      chapterDifficulties: "",
      fromDate: "2025-01-20",
    };
    const plans = generateSchedule(input);
    const text = renderText(plans, "Math", "2025-02-03", 14);
    expect(text).toContain("Weekly Summaries:");
  });
});

describe("study-planner renderCsv", () => {
  it("renders header row", () => {
    expect(renderCsv([])).toBe("date,day,session_num,chapter,start_time,end_time,type,duration_min");
  });
  it("renders one row per session", () => {
    const input: StudyInput = {
      subjectName: "Math",
      examDate: "2025-01-07",
      totalChapters: 1,
      chaptersPerDay: 1,
      dailyStudyHours: 1,
      studyDaysPerWeek: 7,
      includeRevision: false,
      startTime: "09:00",
      breakDurationMinutes: 10,
      sessionDurationMinutes: 30,
      excludeDates: "",
      chapterDifficulties: "",
      fromDate: "2025-01-06",
    };
    const plans = generateSchedule(input);
    const csv = renderCsv(plans);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("date,day,session_num,chapter,start_time,end_time,type,duration_min");
    // 1 study session (1h = 30+30 → 2 sessions, 1 break in middle = 3 rows)
    // Actually: 60 min = 30+30, so 2 study sessions + 1 break = 3 session rows
    expect(lines.length).toBe(1 + 3);
    expect(csv).toContain("study");
    expect(csv).toContain("break");
  });
});

describe("study-planner renderHtml", () => {
  it("renders standalone HTML document", () => {
    const input: StudyInput = {
      subjectName: "Math",
      examDate: "2025-01-07",
      totalChapters: 1,
      chaptersPerDay: 1,
      dailyStudyHours: 1,
      studyDaysPerWeek: 7,
      includeRevision: false,
      startTime: "09:00",
      breakDurationMinutes: 10,
      sessionDurationMinutes: 30,
      excludeDates: "",
      chapterDifficulties: "",
      fromDate: "2025-01-06",
    };
    const plans = generateSchedule(input);
    const html = renderHtml(plans, "Math", "2025-01-07", 1);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>Study Plan — Math</title>");
    expect(html).toContain("<table>");
    expect(html).toContain("09:00");
    expect(html).toContain("day-study");
  });
  it("escapes HTML in subject name", () => {
    const html = renderHtml([], "<script>alert('x')</script>", "2025-01-07", 1);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("study-planner history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entry: HistoryEntry = {
      ts: 1000,
      subjectName: "Math",
      examDate: "2025-01-13",
      totalChapters: 12,
      studyDays: 6,
      revisionDays: 2,
      totalHours: 24,
    };
    saveHistory(entry);
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].subjectName).toBe("Math");
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        subjectName: `S${i}`,
        examDate: "2025-01-13",
        totalChapters: 10,
        studyDays: 5,
        revisionDays: 1,
        totalHours: 10,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, subjectName: "x", examDate: "2025-01-13",
      totalChapters: 1, studyDays: 1, revisionDays: 0, totalHours: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("study-planner shareable URL", () => {
  const sampleInput = {
    subjectName: "Mathematics",
    examDate: "2025-02-03",
    totalChapters: 12,
    chaptersPerDay: 2,
    dailyStudyHours: 4,
    studyDaysPerWeek: 6,
    includeRevision: true,
    startTime: "09:00",
    breakDurationMinutes: 15,
    sessionDurationMinutes: 50,
    excludeDates: "2025-01-22, 2025-01-29",
    chapterDifficulties: "easy, medium, hard",
  };

  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(sampleInput);
    expect(url).toContain("subj=Mathematics");
    expect(url).toContain("exam=2025-02-03");
    expect(url).toContain("ch=12");
    expect(url).toContain("cpd=2");
    expect(url).toContain("hrs=4");
    expect(url).toContain("dpw=6");
    expect(url).toContain("rev=1");
    expect(url).toContain("start=09%3A00");
    expect(url).toContain("brk=15");
    expect(url).toContain("ses=50");
    expect(url).toContain("excl=");
    expect(url).toContain("diff=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("round-trips through parseShareUrl", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(sampleInput);
    const sepIdx = Math.min(
      url.indexOf("#") === -1 ? Infinity : url.indexOf("#"),
      url.indexOf("?") === -1 ? Infinity : url.indexOf("?"),
    );
    const hash = sepIdx === Infinity ? url : url.slice(sepIdx + 1);
    const parsed = parseShareUrl(hash);
    expect(parsed.subjectName).toBe("Mathematics");
    expect(parsed.examDate).toBe("2025-02-03");
    expect(parsed.totalChapters).toBe(12);
    expect(parsed.chaptersPerDay).toBe(2);
    expect(parsed.dailyStudyHours).toBe(4);
    expect(parsed.studyDaysPerWeek).toBe(6);
    expect(parsed.includeRevision).toBe(true);
    expect(parsed.startTime).toBe("09:00");
    expect(parsed.breakDurationMinutes).toBe(15);
    expect(parsed.sessionDurationMinutes).toBe(50);
    expect(parsed.excludeDates).toBe("2025-01-22, 2025-01-29");
    expect(parsed.chapterDifficulties).toBe("easy, medium, hard");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("handles empty hash by returning defaults", () => {
    const parsed = parseShareUrl("");
    expect(parsed.subjectName).toBe("");
    expect(parsed.examDate).toBe("");
    expect(parsed.totalChapters).toBe(DEFAULTS.totalChapters);
    expect(parsed.includeRevision).toBe(DEFAULTS.includeRevision);
  });

  it("includeRevision=false is preserved", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ ...sampleInput, includeRevision: false });
    expect(url).toContain("rev=0");
    const sepIdx = Math.min(
      url.indexOf("#") === -1 ? Infinity : url.indexOf("#"),
      url.indexOf("?") === -1 ? Infinity : url.indexOf("?"),
    );
    const hash = sepIdx === Infinity ? url : url.slice(sepIdx + 1);
    const parsed = parseShareUrl(hash);
    expect(parsed.includeRevision).toBe(false);
    (globalThis as Record<string, unknown>).window = origWindow;
  });
});

// Suppress unused-import lint
export type _Unused = ChapterDifficulty;

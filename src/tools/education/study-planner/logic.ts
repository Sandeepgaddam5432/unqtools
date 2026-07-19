/**
 * Study Planner & Exam Timetable — pure logic.
 *
 * Plan study schedules: break subjects into daily study blocks with
 * Pomodoro-style sessions (study + break, long break every 4 sessions),
 * reserve revision days before exam, allocate chapters to sessions,
 * compute weekly summaries, render as text/CSV/HTML, history
 * (localStorage), shareable URL.
 *
 * Pure functions only — no DOM, no network.
 */

// ---- Types ----

export type ChapterDifficulty = "easy" | "medium" | "hard";

export type SessionBlockType = "study" | "break" | "long-break" | "revision";

export interface SessionBlock {
  type: SessionBlockType;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  durationMin: number;
  chapter?: number; // 1-indexed
  sessionNumber?: number; // 1-indexed within day for study/revision blocks
}

export type DayType = "study" | "revision" | "review";

export interface DayPlan {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0=Sun ... 6=Sat
  type: DayType;
  sessions: SessionBlock[];
  chapters: number[]; // 1-indexed chapter numbers covered
  totalStudyMinutes: number; // sum of study+revision minutes
}

export interface WeeklySummary {
  weekNumber: string; // ISO year-week (YYYY-Www)
  totalHours: number;
  totalChapters: number;
  studyDays: number;
  revisionDays: number;
}

export interface SummaryStats {
  totalDays: number;
  studyDays: number;
  revisionDays: number;
  reviewDays: number;
  totalSessions: number;
  totalHours: number;
  totalChapters: number;
  plannedChapters: number;
  daysUntilExam: number;
  completionPercent: number;
}

export interface StudyInput {
  subjectName: string;
  examDate: string; // YYYY-MM-DD
  totalChapters: number;
  chaptersPerDay: number;
  dailyStudyHours: number;
  studyDaysPerWeek: number;
  includeRevision: boolean;
  startTime: string; // HH:MM
  breakDurationMinutes: number;
  sessionDurationMinutes: number;
  excludeDates: string; // comma-separated YYYY-MM-DD
  chapterDifficulties: string; // comma-separated easy/medium/hard
  fromDate?: string; // YYYY-MM-DD; default today (UTC)
}

// ---- Constants / Presets ----

export const BREAK_PRESETS = [5, 10, 15, 30];

export const SESSION_PRESETS = [25, 50, 90];

export const DEFAULT_LONG_BREAK_MIN = 60;
export const DEFAULT_SESSIONS_BEFORE_LONG_BREAK = 4;
export const DEFAULT_REVISION_DAYS_RESERVED = 2;

export const DIFFICULTY_MULTIPLIERS: Record<ChapterDifficulty, number> = {
  easy: 0.8,
  medium: 1.0,
  hard: 1.3,
};

export const DIFFICULTY_SESSIONS_NEEDED: Record<ChapterDifficulty, number> = {
  easy: 1,
  medium: 1,
  hard: 2,
};

export const DAY_OF_WEEK_LABELS = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
] as const;

export const DAY_OF_WEEK_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const DEFAULTS = {
  subjectName: "",
  examDate: "",
  totalChapters: 12,
  chaptersPerDay: 1,
  dailyStudyHours: 4,
  studyDaysPerWeek: 6,
  includeRevision: true,
  startTime: "09:00",
  breakDurationMinutes: 15,
  sessionDurationMinutes: 50,
  excludeDates: "",
  chapterDifficulties: "",
};

// ---- Date utilities ----

/** Parse a YYYY-MM-DD string into a UTC Date. Returns invalid Date if format wrong. */
export function parseUTCDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  if (!m) return new Date(NaN);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** Format a Date as YYYY-MM-DD using UTC components. */
export function formatUTCDate(d: Date): string {
  if (isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today's date as YYYY-MM-DD using UTC. */
export function todayUTC(): string {
  return formatUTCDate(new Date());
}

/** Get day of week (0=Sun ... 6=Sat) for a YYYY-MM-DD string. */
export function getDayOfWeek(dateStr: string): number {
  const d = parseUTCDate(dateStr);
  return isNaN(d.getTime()) ? -1 : d.getUTCDay();
}

/** Calculate days between two YYYY-MM-DD strings (end - start). */
export function calculateDaysUntil(examDate: string, fromDate: string): number {
  const start = parseUTCDate(fromDate);
  const end = parseUTCDate(examDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** Validate a YYYY-MM-DD string parses to a real date (no rollover). */
export function isValidDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12) return false;
  if (d < 1 || d > 31) return false;
  // Verify no rollover by constructing UTC date and checking components match
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d &&
    !isNaN(dt.getTime())
  );
}

// ---- Time utilities ----

/** Parse HH:MM into minutes since midnight. Returns 0 if invalid. */
export function parseTimeToMinutes(time: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time || "");
  if (!m) return 0;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return 0;
  return h * 60 + mm;
}

/** Format minutes since midnight as HH:MM. Wraps modulo 24h. */
export function formatMinutesToTime(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// ---- Parsers ----

/** Normalize a subject name (trim, collapse whitespace). */
export function normalizeSubject(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Parse comma/newline-separated YYYY-MM-DD exclusion dates; keep only valid ones. */
export function parseExcludeDates(s: string): string[] {
  if (!s) return [];
  return s
    .split(/[\n,]+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0 && isValidDate(x));
}

/** Parse comma-separated easy/medium/hard difficulty markers per chapter. */
export function parseChapterDifficulties(s: string): ChapterDifficulty[] {
  if (!s) return [];
  const out: ChapterDifficulty[] = [];
  for (const part of s.split(/[\n,]+/)) {
    const t = part.trim().toLowerCase();
    if (t === "easy" || t === "medium" || t === "hard") out.push(t);
  }
  return out;
}

/** Determine which days of week are study days, given N (1-7). */
export function getStudyDaysOfWeek(studyDaysPerWeek: number): number[] {
  // 0=Sun, 1=Mon, ..., 6=Sat
  // Prefer weekdays first (Mon=1..Fri=5), then Sat=6, then Sun=0
  const order = [1, 2, 3, 4, 5, 6, 0];
  const n = Math.max(0, Math.min(7, Math.floor(studyDaysPerWeek)));
  return order.slice(0, n);
}

// ---- Core scheduling functions ----

/** Compute the list of available study-day dates between fromDate (inclusive) and examDate (exclusive). */
export function computeAvailableStudyDays(
  fromDate: string,
  examDate: string,
  studyDaysPerWeek: number,
  excludeDates: string[],
): string[] {
  const out: string[] = [];
  const start = parseUTCDate(fromDate);
  const end = parseUTCDate(examDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return out;
  if (end.getTime() <= start.getTime()) return out;

  const studyDows = new Set(getStudyDaysOfWeek(studyDaysPerWeek));
  const excludeSet = new Set(excludeDates);

  const cur = new Date(start.getTime());
  while (cur.getTime() < end.getTime()) {
    const dateStr = formatUTCDate(cur);
    const dow = cur.getUTCDay();
    if (studyDows.has(dow) && !excludeSet.has(dateStr)) {
      out.push(dateStr);
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/** Split study days into learning days and revision days (last N reserved). */
export function allocateRevisionDays(
  studyDays: string[],
  includeRevision: boolean,
  daysToReserve = DEFAULT_REVISION_DAYS_RESERVED,
): { studyDays: string[]; revisionDays: string[] } {
  if (!includeRevision || daysToReserve <= 0) {
    return { studyDays: [...studyDays], revisionDays: [] };
  }
  // studyDays are sorted ascending (they were generated in date order)
  const sorted = [...studyDays].sort();
  const reserveCount = Math.min(daysToReserve, sorted.length);
  const revisionDays = sorted.slice(sorted.length - reserveCount);
  const learningDays = sorted.slice(0, sorted.length - reserveCount);
  return { studyDays: learningDays, revisionDays };
}

/** Compute chapters-per-day, auto-adjusted upward to fit time budget. */
export function computeChaptersPerDay(
  totalChapters: number,
  studyDayCount: number,
  requested: number,
): number {
  if (studyDayCount <= 0) return Math.max(1, requested);
  const required = Math.ceil(totalChapters / studyDayCount);
  return Math.max(1, Math.max(requested, required));
}

/** Generate Pomodoro-style session blocks for a single day. */
export function generateSessionBlocks(
  startTime: string,
  sessionDurationMin: number,
  breakDurationMin: number,
  dailyStudyHours: number,
  longBreakMin = DEFAULT_LONG_BREAK_MIN,
  sessionsBeforeLongBreak = DEFAULT_SESSIONS_BEFORE_LONG_BREAK,
): SessionBlock[] {
  const blocks: SessionBlock[] = [];
  const totalStudyMinutes = Math.round(dailyStudyHours * 60);
  if (totalStudyMinutes <= 0 || sessionDurationMin <= 0) return blocks;

  let currentMin = parseTimeToMinutes(startTime);
  let studyMinutesDone = 0;
  let sessionCount = 0;

  while (studyMinutesDone < totalStudyMinutes) {
    const remaining = totalStudyMinutes - studyMinutesDone;
    const thisSession = Math.min(sessionDurationMin, remaining);
    const sessionNum = sessionCount + 1;
    const start = formatMinutesToTime(currentMin);
    currentMin += thisSession;
    const end = formatMinutesToTime(currentMin);
    blocks.push({
      type: "study",
      startTime: start,
      endTime: end,
      durationMin: thisSession,
      sessionNumber: sessionNum,
    });
    studyMinutesDone += thisSession;
    sessionCount += 1;

    // Add a break only if more study to come
    if (studyMinutesDone < totalStudyMinutes) {
      const isLongBreak = sessionsBeforeLongBreak > 0
        && sessionCount % sessionsBeforeLongBreak === 0;
      const breakDur = isLongBreak ? longBreakMin : breakDurationMin;
      const bStart = formatMinutesToTime(currentMin);
      currentMin += breakDur;
      const bEnd = formatMinutesToTime(currentMin);
      blocks.push({
        type: isLongBreak ? "long-break" : "break",
        startTime: bStart,
        endTime: bEnd,
        durationMin: breakDur,
      });
    }
  }

  return blocks;
}

/** Alias for generateSessionBlocks — Pomodoro scheduler. */
export function pomodoroSchedule(
  startTime: string,
  sessionDurationMin: number,
  breakDurationMin: number,
  dailyStudyHours: number,
  longBreakMin = DEFAULT_LONG_BREAK_MIN,
  sessionsBeforeLongBreak = DEFAULT_SESSIONS_BEFORE_LONG_BREAK,
): SessionBlock[] {
  return generateSessionBlocks(
    startTime,
    sessionDurationMin,
    breakDurationMin,
    dailyStudyHours,
    longBreakMin,
    sessionsBeforeLongBreak,
  );
}

/** Assign chapters to study sessions (in place over a copy). Hard chapters take 2 sessions. */
export function allocateChaptersToSessions(
  sessions: SessionBlock[],
  chaptersForDay: number[],
  chapterDifficulties: ChapterDifficulty[],
): SessionBlock[] {
  const updated = sessions.map((s) => ({ ...s }));
  const studySessionIdxs: number[] = [];
  updated.forEach((s, i) => {
    if (s.type === "study" || s.type === "revision") studySessionIdxs.push(i);
  });

  let pos = 0;
  for (const chapterIdx of chaptersForDay) {
    if (pos >= studySessionIdxs.length) break;
    const diff = chapterDifficulties[chapterIdx] ?? "medium";
    const sessionsNeeded = DIFFICULTY_SESSIONS_NEEDED[diff];
    for (let k = 0; k < sessionsNeeded && pos < studySessionIdxs.length; k++) {
      updated[studySessionIdxs[pos]].chapter = chapterIdx + 1; // 1-indexed
      pos += 1;
    }
  }
  return updated;
}

/** Convert all "study" sessions in a list to "revision" type (preserving sessionNumber). */
export function convertToRevisionSessions(sessions: SessionBlock[]): SessionBlock[] {
  return sessions.map((s) => (s.type === "study" ? { ...s, type: "revision" as const } : s));
}

/** Get ISO week key (YYYY-Www) for a YYYY-MM-DD date string. */
export function getISOWeekKey(dateStr: string): string {
  const d = parseUTCDate(dateStr);
  if (isNaN(d.getTime())) return "";
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7;
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const weekNum = 1 + Math.round(
    ((tmp.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000)),
  );
  return `${tmp.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

// ---- Master schedule generator ----

/**
 * Generate the full day-by-day schedule.
 * Returns an empty array if exam date is invalid or already passed.
 */
export function generateSchedule(input: StudyInput): DayPlan[] {
  if (!isValidDate(input.examDate)) return [];
  const fromDate = input.fromDate && isValidDate(input.fromDate)
    ? input.fromDate
    : todayUTC();
  const daysUntilExam = calculateDaysUntil(input.examDate, fromDate);
  if (daysUntilExam <= 0) return [];

  const excludeDates = parseExcludeDates(input.excludeDates);
  const difficulties = parseChapterDifficulties(input.chapterDifficulties);

  const allStudyDays = computeAvailableStudyDays(
    fromDate, input.examDate, input.studyDaysPerWeek, excludeDates,
  );
  const { studyDays, revisionDays } = allocateRevisionDays(
    allStudyDays, input.includeRevision,
  );
  const chaptersPerDay = computeChaptersPerDay(
    input.totalChapters, studyDays.length, input.chaptersPerDay,
  );

  const dayPlans: DayPlan[] = [];
  let chapterIdx = 0;

  // Study days
  for (const date of studyDays) {
    const baseSessions = generateSessionBlocks(
      input.startTime,
      input.sessionDurationMinutes,
      input.breakDurationMinutes,
      input.dailyStudyHours,
    );
    const studyMinutes = baseSessions
      .filter((s) => s.type === "study")
      .reduce((sum, s) => sum + s.durationMin, 0);

    if (chapterIdx >= input.totalChapters) {
      // No new chapters — review day
      dayPlans.push({
        date,
        dayOfWeek: getDayOfWeek(date),
        type: "review",
        sessions: baseSessions,
        chapters: [],
        totalStudyMinutes: studyMinutes,
      });
      continue;
    }

    const chaptersForDay: number[] = [];
    for (let i = 0; i < chaptersPerDay && chapterIdx < input.totalChapters; i++) {
      chaptersForDay.push(chapterIdx);
      chapterIdx += 1;
    }
    const sessions = allocateChaptersToSessions(baseSessions, chaptersForDay, difficulties);
    dayPlans.push({
      date,
      dayOfWeek: getDayOfWeek(date),
      type: "study",
      sessions,
      chapters: chaptersForDay.map((c) => c + 1),
      totalStudyMinutes: studyMinutes,
    });
  }

  // Revision days
  for (const date of revisionDays) {
    const baseSessions = generateSessionBlocks(
      input.startTime,
      input.sessionDurationMinutes,
      input.breakDurationMinutes,
      input.dailyStudyHours,
    );
    const revisionSessions = convertToRevisionSessions(baseSessions);
    const revisionMinutes = revisionSessions
      .filter((s) => s.type === "revision")
      .reduce((sum, s) => sum + s.durationMin, 0);
    dayPlans.push({
      date,
      dayOfWeek: getDayOfWeek(date),
      type: "revision",
      sessions: revisionSessions,
      chapters: [],
      totalStudyMinutes: revisionMinutes,
    });
  }

  // Sort by date
  dayPlans.sort((a, b) => a.date.localeCompare(b.date));
  return dayPlans;
}

// ---- Summaries ----

/** Compute weekly summaries from a list of day plans. */
export function computeWeeklySummaries(dayPlans: DayPlan[]): WeeklySummary[] {
  const byWeek = new Map<string, DayPlan[]>();
  for (const dp of dayPlans) {
    const key = getISOWeekKey(dp.date);
    if (!byWeek.has(key)) byWeek.set(key, []);
    byWeek.get(key)!.push(dp);
  }

  const out: WeeklySummary[] = [];
  for (const [weekNumber, plans] of byWeek) {
    const totalStudyMinutes = plans.reduce((sum, p) => sum + p.totalStudyMinutes, 0);
    const totalChapters = plans.reduce((sum, p) => sum + p.chapters.length, 0);
    const studyDays = plans.filter((p) => p.type === "study").length;
    const revisionDays = plans.filter((p) => p.type === "revision").length;
    out.push({
      weekNumber,
      totalHours: Math.round((totalStudyMinutes / 60) * 10) / 10,
      totalChapters,
      studyDays,
      revisionDays,
    });
  }
  out.sort((a, b) => a.weekNumber.localeCompare(b.weekNumber));
  return out;
}

/** Compute summary stats for the whole schedule. */
export function computeSummaryStats(
  dayPlans: DayPlan[],
  totalChapters: number,
  daysUntilExam: number,
): SummaryStats {
  const totalDays = dayPlans.length;
  const studyDays = dayPlans.filter((p) => p.type === "study").length;
  const revisionDays = dayPlans.filter((p) => p.type === "revision").length;
  const reviewDays = dayPlans.filter((p) => p.type === "review").length;
  const totalSessions = dayPlans.reduce(
    (sum, p) => sum + p.sessions.filter((s) => s.type === "study" || s.type === "revision").length,
    0,
  );
  const totalStudyMinutes = dayPlans.reduce((sum, p) => sum + p.totalStudyMinutes, 0);
  const totalHours = Math.round((totalStudyMinutes / 60) * 10) / 10;
  const plannedChapters = dayPlans.reduce((sum, p) => sum + p.chapters.length, 0);
  return {
    totalDays,
    studyDays,
    revisionDays,
    reviewDays,
    totalSessions,
    totalHours,
    totalChapters,
    plannedChapters,
    daysUntilExam,
    completionPercent: totalChapters > 0
      ? Math.round((plannedChapters / totalChapters) * 100)
      : 0,
  };
}

// ---- Renderers ----

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render the schedule as a printable text timetable. */
export function renderText(
  dayPlans: DayPlan[],
  subjectName: string,
  examDate: string,
  daysUntilExam: number,
): string {
  const lines: string[] = [];
  lines.push(`Study Plan: ${normalizeSubject(subjectName) || "Untitled Subject"}`);
  lines.push(`Exam date: ${examDate} (${daysUntilExam} day${daysUntilExam === 1 ? "" : "s"} away)`);
  const studyDayCount = dayPlans.filter((p) => p.type === "study").length;
  const revisionDayCount = dayPlans.filter((p) => p.type === "revision").length;
  lines.push(`Study days: ${studyDayCount} · Revision days: ${revisionDayCount}`);
  lines.push("");
  lines.push("=".repeat(60));
  lines.push("");

  for (const plan of dayPlans) {
    const dowName = DAY_OF_WEEK_LABELS[plan.dayOfWeek] ?? "?";
    const typeLabel = plan.type === "study"
      ? "STUDY"
      : plan.type === "revision"
        ? "REVISION"
        : "REVIEW";
    lines.push(`${plan.date} (${dowName}) — ${typeLabel}`);
    if (plan.chapters.length > 0) {
      lines.push(`  Chapters: ${plan.chapters.join(", ")}`);
    }
    for (const s of plan.sessions) {
      const chapterStr = s.chapter != null ? ` [Ch.${s.chapter}]` : "";
      const label = s.type === "study"
        ? `Study #${s.sessionNumber}`
        : s.type === "revision"
          ? `Revision #${s.sessionNumber}`
          : s.type === "long-break"
            ? "Long break"
            : "Break";
      lines.push(`  ${s.startTime}-${s.endTime}  ${label}${chapterStr}  (${s.durationMin}m)`);
    }
    lines.push("");
  }

  const weekly = computeWeeklySummaries(dayPlans);
  if (weekly.length > 0) {
    lines.push("-".repeat(60));
    lines.push("Weekly Summaries:");
    for (const w of weekly) {
      lines.push(
        `  ${w.weekNumber}: ${w.totalHours}h study, ${w.totalChapters} chapters, ${w.studyDays} study days, ${w.revisionDays} revision days`,
      );
    }
  }
  return lines.join("\n");
}

/** Render the schedule as CSV. Columns: date, day, session_num, chapter, start_time, end_time, type, duration_min. */
export function renderCsv(dayPlans: DayPlan[]): string {
  const lines = ["date,day,session_num,chapter,start_time,end_time,type,duration_min"];
  for (const plan of dayPlans) {
    const dow = DAY_OF_WEEK_SHORT[plan.dayOfWeek] ?? "?";
    if (plan.sessions.length === 0) {
      lines.push([
        plan.date, dow, "", "", "", "", plan.type, "0",
      ].map(escapeCsv).join(","));
      continue;
    }
    plan.sessions.forEach((s, i) => {
      lines.push([
        plan.date,
        dow,
        String(s.sessionNumber ?? i + 1),
        s.chapter != null ? String(s.chapter) : "",
        s.startTime,
        s.endTime,
        s.type,
        String(s.durationMin),
      ].map(escapeCsv).join(","));
    });
  }
  return lines.join("\n");
}

/** Escape HTML special characters. */
function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Render the schedule as a standalone printable HTML document with inline CSS. */
export function renderHtml(
  dayPlans: DayPlan[],
  subjectName: string,
  examDate: string,
  daysUntilExam: number,
): string {
  const title = escapeHtml(normalizeSubject(subjectName) || "Untitled Subject");
  const rows: string[] = [];
  for (const plan of dayPlans) {
    const dow = DAY_OF_WEEK_LABELS[plan.dayOfWeek] ?? "?";
    const typeClass = `day-${plan.type}`;
    const typeLabel = plan.type === "study"
      ? "STUDY"
      : plan.type === "revision"
        ? "REVISION"
        : "REVIEW";
    if (plan.sessions.length === 0) {
      rows.push(
        `<tr class="${typeClass}"><td>${plan.date}</td><td>${dow}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>${typeLabel}</td><td>0</td></tr>`,
      );
      continue;
    }
    plan.sessions.forEach((s, i) => {
      const chapter = s.chapter != null ? `Ch.${s.chapter}` : "—";
      const label = s.type === "study"
        ? `Study #${s.sessionNumber}`
        : s.type === "revision"
          ? `Revision #${s.sessionNumber}`
          : s.type === "long-break"
            ? "Long break"
            : "Break";
      rows.push(
        `<tr class="${typeClass}"><td>${plan.date}</td><td>${dow}</td><td>${s.sessionNumber ?? i + 1}</td><td>${chapter}</td><td>${s.startTime}</td><td>${s.endTime}</td><td>${escapeHtml(label)}</td><td>${s.durationMin}</td></tr>`,
      );
    });
  }

  const weekly = computeWeeklySummaries(dayPlans);
  const weeklyRows = weekly.map((w) =>
    `<tr><td>${w.weekNumber}</td><td>${w.totalHours}</td><td>${w.totalChapters}</td><td>${w.studyDays}</td><td>${w.revisionDays}</td></tr>`,
  ).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Study Plan — ${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 24px; color: #1a1a1a; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { font-size: 13px; color: #666; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  tr.day-study td:first-child { background: #e8f4fd; }
  tr.day-revision td:first-child { background: #fef3c7; }
  tr.day-review td:first-child { background: #f3e8ff; }
  @media print { body { margin: 12px; } }
</style>
</head>
<body>
<h1>Study Plan — ${title}</h1>
<div class="meta">Exam date: ${escapeHtml(examDate)} · ${daysUntilExam} day${daysUntilExam === 1 ? "" : "s"} away</div>
<h2>Schedule</h2>
<table>
<thead><tr><th>Date</th><th>Day</th><th>Session</th><th>Chapter</th><th>Start</th><th>End</th><th>Type</th><th>Min</th></tr></thead>
<tbody>
${rows.join("\n")}
</tbody>
</table>
${weekly.length > 0 ? `
<h2>Weekly Summaries</h2>
<table>
<thead><tr><th>Week</th><th>Hours</th><th>Chapters</th><th>Study days</th><th>Revision days</th></tr></thead>
<tbody>
${weeklyRows}
</tbody>
</table>` : ""}
</body>
</html>`;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:study-planner:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  subjectName: string;
  examDate: string;
  totalChapters: number;
  studyDays: number;
  revisionDays: number;
  totalHours: number;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---- Shareable URL ----

export interface ShareParams {
  subjectName: string;
  examDate: string;
  totalChapters: number;
  chaptersPerDay: number;
  dailyStudyHours: number;
  studyDaysPerWeek: number;
  includeRevision: boolean;
  startTime: string;
  breakDurationMinutes: number;
  sessionDurationMinutes: number;
  excludeDates: string;
  chapterDifficulties: string;
}

/**
 * Build a shareable URL with all inputs encoded in the hash.
 * Large text fields (excludeDates, chapterDifficulties) are base64url-encoded.
 */
export function buildShareUrl(input: ShareParams): string {
  const params = new URLSearchParams();
  if (input.subjectName) params.set("subj", input.subjectName);
  if (input.examDate) params.set("exam", input.examDate);
  params.set("ch", String(input.totalChapters));
  params.set("cpd", String(input.chaptersPerDay));
  params.set("hrs", String(input.dailyStudyHours));
  params.set("dpw", String(input.studyDaysPerWeek));
  params.set("rev", input.includeRevision ? "1" : "0");
  if (input.startTime) params.set("start", input.startTime);
  params.set("brk", String(input.breakDurationMinutes));
  params.set("ses", String(input.sessionDurationMinutes));
  if (input.excludeDates) {
    try {
      const b64 = typeof btoa !== "undefined"
        ? btoa(unescape(encodeURIComponent(input.excludeDates)))
        : Buffer.from(input.excludeDates, "utf8").toString("base64");
      params.set("excl", b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
    } catch {
      params.set("excl-t", input.excludeDates);
    }
  }
  if (input.chapterDifficulties) {
    try {
      const b64 = typeof btoa !== "undefined"
        ? btoa(unescape(encodeURIComponent(input.chapterDifficulties)))
        : Buffer.from(input.chapterDifficulties, "utf8").toString("base64");
      params.set("diff", b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
    } catch {
      params.set("diff-t", input.chapterDifficulties);
    }
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

/** Parse a shareable URL hash back into ShareParams. */
export function parseShareUrl(hash: string): ShareParams {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const empty: ShareParams = {
    subjectName: "",
    examDate: "",
    totalChapters: DEFAULTS.totalChapters,
    chaptersPerDay: DEFAULTS.chaptersPerDay,
    dailyStudyHours: DEFAULTS.dailyStudyHours,
    studyDaysPerWeek: DEFAULTS.studyDaysPerWeek,
    includeRevision: DEFAULTS.includeRevision,
    startTime: DEFAULTS.startTime,
    breakDurationMinutes: DEFAULTS.breakDurationMinutes,
    sessionDurationMinutes: DEFAULTS.sessionDurationMinutes,
    excludeDates: "",
    chapterDifficulties: "",
  };
  if (!clean) return empty;
  const params = new URLSearchParams(clean);

  const num = (k: string, fallback: number): number => {
    const v = params.get(k);
    if (v == null || v === "") return fallback;
    const n = Number(v);
    return Number.isNaN(n) ? fallback : n;
  };

  let excludeDates = "";
  const ex = params.get("excl");
  if (ex) {
    try {
      const b64 = ex.replace(/-/g, "+").replace(/_/g, "/");
      const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
      excludeDates = typeof atob !== "undefined"
        ? decodeURIComponent(escape(atob(padded)))
        : Buffer.from(padded, "base64").toString("utf8");
    } catch {
      excludeDates = "";
    }
  } else {
    excludeDates = params.get("excl-t") ?? "";
  }

  let chapterDifficulties = "";
  const df = params.get("diff");
  if (df) {
    try {
      const b64 = df.replace(/-/g, "+").replace(/_/g, "/");
      const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
      chapterDifficulties = typeof atob !== "undefined"
        ? decodeURIComponent(escape(atob(padded)))
        : Buffer.from(padded, "base64").toString("utf8");
    } catch {
      chapterDifficulties = "";
    }
  } else {
    chapterDifficulties = params.get("diff-t") ?? "";
  }

  return {
    subjectName: params.get("subj") ?? "",
    examDate: params.get("exam") ?? "",
    totalChapters: num("ch", DEFAULTS.totalChapters),
    chaptersPerDay: num("cpd", DEFAULTS.chaptersPerDay),
    dailyStudyHours: num("hrs", DEFAULTS.dailyStudyHours),
    studyDaysPerWeek: num("dpw", DEFAULTS.studyDaysPerWeek),
    includeRevision: params.get("rev") === "1",
    startTime: params.get("start") ?? DEFAULTS.startTime,
    breakDurationMinutes: num("brk", DEFAULTS.breakDurationMinutes),
    sessionDurationMinutes: num("ses", DEFAULTS.sessionDurationMinutes),
    excludeDates,
    chapterDifficulties,
  };
}

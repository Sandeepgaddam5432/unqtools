/**
 * Age Calculator — pure logic.
 *
 * Calculate exact age from a birth date to today (or any reference date) in
 * calendar years/months/days (calendar-aware, no negative-day bugs) plus
 * totals in months/weeks/days/hours/minutes/seconds. Next-birthday
 * countdown with weekday. Feb-29 birthday policy toggle. Milestones.
 * Zodiac sign + Chinese zodiac. Age gap comparison. Shareable URL.
 *
 * Pure functions only — no DOM, no network. Uses UTC for all date math to
 * avoid DST-related surprises.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Feb29Policy = "feb28" | "mar1";

export interface AgeResult {
  /** Calendar years (always non-negative when birth <= now). */
  years: number;
  /** Calendar months 0–11. */
  months: number;
  /** Calendar days (always non-negative). */
  days: number;
  /** Total months = years*12 + months. */
  totalMonths: number;
  /** Total weeks = totalDays / 7. */
  totalWeeks: number;
  /** Total days = floor((now - birth) / MS_PER_DAY). */
  totalDays: number;
  /** Total hours. */
  totalHours: number;
  /** Total minutes. */
  totalMinutes: number;
  /** Total seconds. */
  totalSeconds: number;
  /** Total milliseconds. */
  totalMs: number;
  /** Next birthday UTC ms (using Feb-29 policy in non-leap years). */
  nextBirthdayMs: number;
  /** Next birthday date (YYYY-MM-DD). */
  nextBirthdayDate: string;
  /** Next birthday weekday (e.g. "Monday"). */
  nextBirthdayWeekday: string;
  /** Days until next birthday. */
  daysUntilNextBirthday: number;
  /** Whether the next birthday is a leap-day (Feb 29) being observed in a non-leap year. */
  isLeapObservance: boolean;
  /** Western zodiac sign. */
  zodiac: string;
  /** Chinese zodiac animal. */
  chineseZodiac: string;
  /** Chinese zodiac element (Wood/Fire/Earth/Metal/Water). */
  chineseElement: string;
  /** Plain-English summary line. */
  summary: string;
  /** Optional warning (e.g. birth date in the future). */
  warning?: string;
}

export interface Milestone {
  /** Milestone label e.g. "10,000 days". */
  label: string;
  /** UTC ms when this milestone occurs/occurred. */
  ms: number;
  /** Date string (YYYY-MM-DD). */
  date: string;
  /** True if milestone already passed. */
  passed: boolean;
  /** Days until (negative = days ago). */
  daysFromNow: number;
}

export interface AgeGap {
  /** Absolute difference in years/months/days (calendar-aware). */
  years: number;
  months: number;
  days: number;
  /** Total days between the two birth dates. */
  totalDays: number;
  /** Which of the two is older: 'a' or 'b' or 'same'. */
  older: "a" | "b" | "same";
  /** Plain-English summary. */
  summary: string;
}

export interface HistoryEntry {
  ts: number;
  birth: string;
  reference: string;
  ageSummary: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;
export const MS_PER_WEEK = 7 * MS_PER_DAY;

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CHINESE_ZODIAC_ANIMALS: ReadonlyArray<string> = [
  "Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake",
  "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig",
];

// Chinese elements cycle in 2-year blocks. Index by floor(lastDigit / 2):
//   years ending in 0 or 1 -> Metal
//   years ending in 2 or 3 -> Water
//   years ending in 4 or 5 -> Wood
//   years ending in 6 or 7 -> Fire
//   years ending in 8 or 9 -> Earth
const CHINESE_ELEMENTS: ReadonlyArray<string> = ["Metal", "Water", "Wood", "Fire", "Earth"];

export const MILESTONE_DAYS: ReadonlyArray<number> = [1000, 5000, 10000, 50000, 100000];
export const MILESTONE_SECONDS: ReadonlyArray<number> = [
  1_000_000, 10_000_000, 100_000_000, 1_000_000_000, 10_000_000_000,
];
export const MILESTONE_YEARS: ReadonlyArray<number> = [16, 18, 21, 25, 30, 40, 50, 65, 80, 100];

// ---------------------------------------------------------------------------
// Date parsing & formatting
// ---------------------------------------------------------------------------

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function pad4(n: number): string {
  if (n < 0) return `-${pad4(-n)}`;
  return n < 10 ? `000${n}` : n < 100 ? `00${n}` : n < 1000 ? `0${n}` : String(n);
}

/**
 * Parse a date or date-time string into a UTC ms instant.
 *
 * Accepts:
 *   - "YYYY-MM-DD"             -> midnight UTC
 *   - "YYYY-MM-DDTHH:MM"       -> that time UTC
 *   - "YYYY-MM-DDTHH:MM:SS"    -> that time UTC
 *   - "YYYY-MM-DD HH:MM"       -> space separator also OK
 *
 * Returns NaN for invalid input.
 */
export function parseDateTime(s: string): number {
  const str = (s ?? "").trim();
  if (!str) return Number.NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(str);
  if (!m) return Number.NaN;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = m[4] !== undefined ? Number(m[4]) : 0;
  const minute = m[5] !== undefined ? Number(m[5]) : 0;
  const second = m[6] !== undefined ? Number(m[6]) : 0;
  if (month < 1 || month > 12) return Number.NaN;
  if (day < 1 || day > 31) return Number.NaN;
  if (hour < 0 || hour > 23) return Number.NaN;
  if (minute < 0 || minute > 59) return Number.NaN;
  if (second < 0 || second > 59) return Number.NaN;
  const ms = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  const d = new Date(ms);
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day ||
    d.getUTCHours() !== hour ||
    d.getUTCMinutes() !== minute ||
    d.getUTCSeconds() !== second
  ) {
    return Number.NaN;
  }
  return ms;
}

/** Check if a date string is parseable. */
export function isValidDate(s: string): boolean {
  return !Number.isNaN(parseDateTime(s));
}

/** Format a UTC ms instant as YYYY-MM-DD. */
export function formatDate(ms: number): string {
  if (Number.isNaN(ms)) return "";
  const d = new Date(ms);
  return `${pad4(d.getUTCFullYear())}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Format a UTC ms instant as YYYY-MM-DDTHH:MM:SS. */
export function formatDateTime(ms: number): string {
  if (Number.isNaN(ms)) return "";
  const d = new Date(ms);
  return `${pad4(d.getUTCFullYear())}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}

/** Number of days in a given (year, month) where month is 1-12. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** True if year is a Gregorian leap year. */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Return weekday label (0=Sun..6=Sat). */
export function weekdayLabel(n: number): string {
  return WEEKDAY_LABELS[n] ?? "";
}

/** Return short weekday label (0=Sun..6=Sat). */
export function weekdayShort(n: number): string {
  return WEEKDAY_SHORT[n] ?? "";
}

// ---------------------------------------------------------------------------
// Calendar-aware Y/M/D breakdown with proper borrow logic
// ---------------------------------------------------------------------------

/**
 * Calendar-aware breakdown of (nowMs - birthMs) into years/months/days.
 *
 * Uses the standard "borrow" algorithm:
 *   1. years = nowYear - birthYear
 *   2. months = nowMonth - birthMonth
 *   3. days = nowDay - birthDay
 *   4. If days < 0: borrow one month. days += daysInMonth(nowYear, nowMonth) [previous month's length].
 *      months -= 1.
 *   5. If months < 0: borrow one year. months += 12. years -= 1.
 *
 * If nowMs < birthMs (birth in the future), returns {0, 0, 0} and the caller
 * flags a warning.
 *
 * For Feb-29 births observed on Feb 28 in non-leap years, the "birth day"
 * in the comparison is adjusted before computing. The next-birthday
 * computation honors the Feb-29 policy separately.
 */
export function calculateYMD(
  birthMs: number,
  nowMs: number,
  feb29Policy: Feb29Policy = "feb28",
): { years: number; months: number; days: number } {
  if (Number.isNaN(birthMs) || Number.isNaN(nowMs) || nowMs < birthMs) {
    return { years: 0, months: 0, days: 0 };
  }
  const birth = new Date(birthMs);
  const now = new Date(nowMs);
  const birthYear = birth.getUTCFullYear();
  let birthMonth = birth.getUTCMonth(); // 0-indexed
  let birthDay = birth.getUTCDate();
  const nowYear = now.getUTCFullYear();
  const nowMonth = now.getUTCMonth();
  const nowDay = now.getUTCDate();

  // For Feb-29 births, in non-leap reference years the birthday is observed
  // on Feb 28 (feb28 policy) or Mar 1 (mar1 policy). Adjust the comparison
  // day/month accordingly so the borrow math produces the expected age.
  // In leap reference years, the actual Feb 29 is used.
  const isFeb29Birth = birthMonth === 1 && birthDay === 29;
  if (isFeb29Birth && !isLeapYear(nowYear)) {
    if (feb29Policy === "mar1") {
      birthMonth = 2; // Mar (0-indexed)
      birthDay = 1;
    } else {
      birthDay = 28;
    }
  }

  let years = nowYear - birthYear;
  let months = nowMonth - birthMonth;
  let days = nowDay - birthDay;

  if (days < 0) {
    // Borrow from previous month (the month before nowMonth in nowYear)
    // daysInMonth(nowYear, nowMonth) returns days in nowMonth (1-indexed);
    // we want the previous month's length.
    const prevMonth = nowMonth === 0 ? 12 : nowMonth;
    const prevMonthYear = nowMonth === 0 ? nowYear - 1 : nowYear;
    days += daysInMonth(prevMonthYear, prevMonth);
    months -= 1;
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }
  if (years < 0) years = 0;
  return { years, months, days };
}

// ---------------------------------------------------------------------------
// Next birthday
// ---------------------------------------------------------------------------

/**
 * Compute the next birthday UTC ms from `nowMs`, honoring the Feb-29 policy.
 *
 * Returns { ms, date, weekday, daysUntil, isLeapObservance }.
 *   - isLeapObservance: true if the birth date is Feb-29 and the next birthday
 *     is being observed on Feb 28 or Mar 1 of a non-leap year.
 */
export function calculateNextBirthday(
  birthMs: number,
  nowMs: number,
  feb29Policy: Feb29Policy = "feb28",
): { ms: number; date: string; weekday: string; daysUntil: number; isLeapObservance: boolean } {
  if (Number.isNaN(birthMs) || Number.isNaN(nowMs)) {
    return { ms: Number.NaN, date: "", weekday: "", daysUntil: 0, isLeapObservance: false };
  }
  const birth = new Date(birthMs);
  const now = new Date(nowMs);
  const birthMonth = birth.getUTCMonth();
  const birthDay = birth.getUTCDate();
  const isLeapBirth = birthMonth === 1 && birthDay === 29;
  const nowYear = now.getUTCFullYear();
  const nowMonth = now.getUTCMonth();
  const nowDay = now.getUTCDate();
  const todayMidnight = Date.UTC(nowYear, nowMonth, nowDay, 0, 0, 0, 0);

  /**
   * Resolve the observed birthday for a given year, honoring Feb-29 policy.
   * If birth is Feb 29 and year is non-leap:
   *   - feb28 -> Feb 28 of that year
   *   - mar1  -> Mar 1 of that year
   */
  function observedBirthday(year: number): { ms: number; isObserved: boolean } {
    if (isLeapBirth && !isLeapYear(year)) {
      if (feb29Policy === "mar1") {
        return { ms: Date.UTC(year, 2, 1, 0, 0, 0, 0), isObserved: true };
      }
      return { ms: Date.UTC(year, 1, 28, 0, 0, 0, 0), isObserved: true };
    }
    return { ms: Date.UTC(year, birthMonth, birthDay, 0, 0, 0, 0), isObserved: false };
  }

  // Try this year's birthday
  let { ms, isObserved } = observedBirthday(nowYear);
  if (ms <= todayMidnight) {
    // Already passed or is today -> next year
    const next = observedBirthday(nowYear + 1);
    ms = next.ms;
    isObserved = next.isObserved;
  }
  const daysUntil = Math.round((ms - todayMidnight) / MS_PER_DAY);
  const d = new Date(ms);
  return {
    ms,
    date: formatDate(ms),
    weekday: weekdayLabel(d.getUTCDay()),
    daysUntil,
    isLeapObservance: isObserved,
  };
}

// ---------------------------------------------------------------------------
// Zodiac
// ---------------------------------------------------------------------------

// Western zodiac ranges (sign, start, end) including Capricorn wrap.
const ZODIAC_FULL: ReadonlyArray<{ sign: string; from: [number, number]; to: [number, number] }> = [
  { sign: "Capricorn", from: [12, 22], to: [1, 19] },
  { sign: "Aquarius", from: [1, 20], to: [2, 18] },
  { sign: "Pisces", from: [2, 19], to: [3, 20] },
  { sign: "Aries", from: [3, 21], to: [4, 19] },
  { sign: "Taurus", from: [4, 20], to: [5, 20] },
  { sign: "Gemini", from: [5, 21], to: [6, 20] },
  { sign: "Cancer", from: [6, 21], to: [7, 22] },
  { sign: "Leo", from: [7, 23], to: [8, 22] },
  { sign: "Virgo", from: [8, 23], to: [9, 22] },
  { sign: "Libra", from: [9, 23], to: [10, 22] },
  { sign: "Scorpio", from: [10, 23], to: [11, 21] },
  { sign: "Sagittarius", from: [11, 22], to: [12, 21] },
];

/** Determine Western zodiac sign from month (1-12) and day. */
export function getZodiacSign(month: number, day: number): string {
  for (const r of ZODIAC_FULL) {
    const [fm, fd] = r.from;
    const [tm, td] = r.to;
    if (fm === tm) {
      if (month === fm && day >= fd && day <= td) return r.sign;
    } else {
      // Sign wraps year-end (Capricorn: Dec 22 - Jan 19)
      if ((month === fm && day >= fd) || (month === tm && day <= td)) return r.sign;
    }
  }
  return "Unknown";
}

/** Determine Chinese zodiac animal from year. */
export function getChineseZodiac(year: number): string {
  // 2020 = Rat (index 0). Rat is the first animal in the 12-year cycle.
  // The cycle is: Rat, Ox, Tiger, Rabbit, Dragon, Snake, Horse, Goat, Monkey, Rooster, Dog, Pig.
  // Reference: 2008 = Rat (index 0).
  const refYear = 2008;
  const idx = ((year - refYear) % 12 + 12) % 12;
  return CHINESE_ZODIAC_ANIMALS[idx];
}

/** Determine Chinese element (Wood/Fire/Earth/Metal/Water) from year. */
export function getChineseElement(year: number): string {
  // Elements cycle every 2 years in order: Wood, Fire, Earth, Metal, Water.
  // Wood: years ending in 4 or 5; Fire: 6 or 7; Earth: 8 or 9; Metal: 0 or 1; Water: 2 or 3.
  const lastDigit = ((year % 10) + 10) % 10;
  const idx = Math.floor(lastDigit / 2);
  return CHINESE_ELEMENTS[idx];
}

// ---------------------------------------------------------------------------
// Top-level age calculation
// ---------------------------------------------------------------------------

/** Compute the full age result. */
export function calculateAge(
  birthMs: number,
  nowMs: number = Date.now(),
  feb29Policy: Feb29Policy = "feb28",
): AgeResult {
  if (Number.isNaN(birthMs) || Number.isNaN(nowMs)) {
    return {
      years: 0, months: 0, days: 0,
      totalMonths: 0, totalWeeks: 0, totalDays: 0,
      totalHours: 0, totalMinutes: 0, totalSeconds: 0, totalMs: 0,
      nextBirthdayMs: 0, nextBirthdayDate: "", nextBirthdayWeekday: "",
      daysUntilNextBirthday: 0, isLeapObservance: false,
      zodiac: "Unknown", chineseZodiac: "Unknown", chineseElement: "Unknown",
      summary: "Invalid date",
      warning: "Invalid date input",
    };
  }

  // Birth in the future
  if (birthMs > nowMs) {
    const ymd = { years: 0, months: 0, days: 0 };
    const nextBday = calculateNextBirthday(birthMs, nowMs, feb29Policy);
    const birth = new Date(birthMs);
    return {
      ...ymd,
      totalMonths: 0, totalWeeks: 0, totalDays: 0,
      totalHours: 0, totalMinutes: 0, totalSeconds: 0, totalMs: 0,
      nextBirthdayMs: nextBday.ms,
      nextBirthdayDate: nextBday.date,
      nextBirthdayWeekday: nextBday.weekday,
      daysUntilNextBirthday: nextBday.daysUntil,
      isLeapObservance: nextBday.isLeapObservance,
      zodiac: getZodiacSign(birth.getUTCMonth() + 1, birth.getUTCDate()),
      chineseZodiac: getChineseZodiac(birth.getUTCFullYear()),
      chineseElement: getChineseElement(birth.getUTCFullYear()),
      summary: "Birth date is in the future",
      warning: "Birth date is in the future — age is 0 until the birth date arrives.",
    };
  }

  const ymd = calculateYMD(birthMs, nowMs, feb29Policy);
  const totalMs = nowMs - birthMs;
  const totalSeconds = Math.floor(totalMs / MS_PER_SECOND);
  const totalMinutes = Math.floor(totalMs / MS_PER_MINUTE);
  const totalHours = Math.floor(totalMs / MS_PER_HOUR);
  const totalDays = Math.floor(totalMs / MS_PER_DAY);
  const totalWeeks = totalDays / 7;
  const totalMonths = ymd.years * 12 + ymd.months;

  const nextBday = calculateNextBirthday(birthMs, nowMs, feb29Policy);

  const birth = new Date(birthMs);
  const zodiac = getZodiacSign(birth.getUTCMonth() + 1, birth.getUTCDate());
  const chineseZodiac = getChineseZodiac(birth.getUTCFullYear());
  const chineseElement = getChineseElement(birth.getUTCFullYear());

  // Build summary
  const parts: string[] = [];
  if (ymd.years > 0) parts.push(`${ymd.years} year${ymd.years === 1 ? "" : "s"}`);
  if (ymd.months > 0) parts.push(`${ymd.months} month${ymd.months === 1 ? "" : "s"}`);
  if (ymd.days > 0 || parts.length === 0) parts.push(`${ymd.days} day${ymd.days === 1 ? "" : "s"}`);
  const summary = `${parts.join(", ")} old (${totalDays.toLocaleString()} days total)`;

  return {
    ...ymd,
    totalMonths,
    totalWeeks,
    totalDays,
    totalHours,
    totalMinutes,
    totalSeconds,
    totalMs,
    nextBirthdayMs: nextBday.ms,
    nextBirthdayDate: nextBday.date,
    nextBirthdayWeekday: nextBday.weekday,
    daysUntilNextBirthday: nextBday.daysUntil,
    isLeapObservance: nextBday.isLeapObservance,
    zodiac,
    chineseZodiac,
    chineseElement,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

/** Compute milestone dates for the given birth date. */
export function computeMilestones(birthMs: number, nowMs: number = Date.now()): Milestone[] {
  if (Number.isNaN(birthMs)) return [];
  const out: Milestone[] = [];
  const nowDay = Date.UTC(
    new Date(nowMs).getUTCFullYear(),
    new Date(nowMs).getUTCMonth(),
    new Date(nowMs).getUTCDate(),
    0, 0, 0, 0,
  );

  for (const d of MILESTONE_DAYS) {
    const ms = birthMs + d * MS_PER_DAY;
    out.push({
      label: `${d.toLocaleString()} days`,
      ms,
      date: formatDate(ms),
      passed: ms <= nowMs,
      daysFromNow: Math.round((ms - nowMs) / MS_PER_DAY),
    });
  }
  for (const s of MILESTONE_SECONDS) {
    const ms = birthMs + s * MS_PER_SECOND;
    out.push({
      label: `${s.toLocaleString()} seconds`,
      ms,
      date: formatDate(ms),
      passed: ms <= nowMs,
      daysFromNow: Math.round((ms - nowMs) / MS_PER_DAY),
    });
  }
  // Year milestones via calendar math
  const birth = new Date(birthMs);
  const birthYear = birth.getUTCFullYear();
  const birthMonth = birth.getUTCMonth();
  const birthDay = birth.getUTCDate();
  for (const y of MILESTONE_YEARS) {
    // Clamp to last valid day if needed (Feb 29 + N years)
    const targetYear = birthYear + y;
    const maxDay = daysInMonth(targetYear, birthMonth + 1);
    const targetDay = Math.min(birthDay, maxDay);
    const ms = Date.UTC(targetYear, birthMonth, targetDay, 0, 0, 0, 0);
    out.push({
      label: `${y} years`,
      ms,
      date: formatDate(ms),
      passed: ms <= nowMs,
      daysFromNow: Math.round((ms - nowMs) / MS_PER_DAY),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Age gap comparison
// ---------------------------------------------------------------------------

/** Compute the age gap between two birth dates. */
export function calculateAgeGap(aMs: number, bMs: number): AgeGap {
  if (Number.isNaN(aMs) || Number.isNaN(bMs)) {
    return {
      years: 0, months: 0, days: 0, totalDays: 0,
      older: "same",
      summary: "Invalid date input",
    };
  }
  if (aMs === bMs) {
    return {
      years: 0, months: 0, days: 0, totalDays: 0,
      older: "same",
      summary: "Same birth date — no age gap.",
    };
  }
  const older = aMs < bMs ? "a" : "b";
  const olderMs = older === "a" ? aMs : bMs;
  const youngerMs = older === "a" ? bMs : aMs;
  const ymd = calculateYMD(olderMs, youngerMs, "feb28");
  const totalDays = Math.floor((youngerMs - olderMs) / MS_PER_DAY);
  const parts: string[] = [];
  if (ymd.years > 0) parts.push(`${ymd.years} year${ymd.years === 1 ? "" : "s"}`);
  if (ymd.months > 0) parts.push(`${ymd.months} month${ymd.months === 1 ? "" : "s"}`);
  if (ymd.days > 0 || parts.length === 0) parts.push(`${ymd.days} day${ymd.days === 1 ? "" : "s"}`);
  const summary = `A is ${older === "a" ? "older" : "younger"} than B by ${parts.join(", ")} (${totalDays.toLocaleString()} days total).`;
  return {
    years: ymd.years,
    months: ymd.months,
    days: ymd.days,
    totalDays,
    older,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

/** Render an age result as plain-text summary (multi-line). */
export function renderAgeText(r: AgeResult): string {
  const lines: string[] = [];
  lines.push(`Summary: ${r.summary}`);
  if (r.warning) lines.push(`Note: ${r.warning}`);
  lines.push("");
  lines.push("Calendar breakdown:");
  lines.push(`  ${r.years} year(s), ${r.months} month(s), ${r.days} day(s)`);
  lines.push("");
  lines.push("Totals:");
  lines.push(`  ${r.totalMonths.toLocaleString()} month(s)`);
  lines.push(`  ${r.totalWeeks.toLocaleString()} week(s)`);
  lines.push(`  ${r.totalDays.toLocaleString()} day(s)`);
  lines.push(`  ${r.totalHours.toLocaleString()} hour(s)`);
  lines.push(`  ${r.totalMinutes.toLocaleString()} minute(s)`);
  lines.push(`  ${r.totalSeconds.toLocaleString()} second(s)`);
  lines.push("");
  lines.push(`Next birthday: ${r.nextBirthdayDate} (${r.nextBirthdayWeekday}) — in ${r.daysUntilNextBirthday} day(s)${r.isLeapObservance ? " (Feb-29 observance)" : ""}`);
  lines.push("");
  lines.push(`Zodiac: ${r.zodiac}`);
  lines.push(`Chinese zodiac: ${r.chineseZodiac} (${r.chineseElement})`);
  return lines.join("\n");
}

/** Render milestones as CSV. */
export function renderMilestonesCsv(rows: Milestone[]): string {
  const lines = ["label,date,passed,days_from_now"];
  for (const r of rows) {
    lines.push([
      `"${r.label}"`,
      r.date,
      r.passed ? "yes" : "no",
      r.daysFromNow,
    ].join(","));
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// History (localStorage, max 20)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:age-calculator:history";
const HISTORY_MAX = 20;

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

// ---------------------------------------------------------------------------
// Shareable URL (fragment-encoded, never sent to server)
// ---------------------------------------------------------------------------

export interface ShareState {
  birth: string;
  birthTime: string;
  reference: string;
  referenceTime: string;
  feb29Policy: Feb29Policy;
  // Age gap mode
  gapA: string;
  gapB: string;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.birth) params.set("birth", state.birth);
  if (state.birthTime) params.set("btime", state.birthTime);
  if (state.reference) params.set("ref", state.reference);
  if (state.referenceTime) params.set("rtime", state.referenceTime);
  if (state.feb29Policy === "mar1") params.set("feb29", "mar1");
  if (state.gapA) params.set("gapa", state.gapA);
  if (state.gapB) params.set("gapb", state.gapB);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState | null {
  let clean = hash;
  if (clean.startsWith("#")) clean = clean.slice(1);
  if (clean.startsWith("?")) clean = clean.slice(1);
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const birth = params.get("birth") ?? "";
  const birthTime = params.get("btime") ?? "";
  const reference = params.get("ref") ?? "";
  const referenceTime = params.get("rtime") ?? "";
  const feb29Policy: Feb29Policy = params.get("feb29") === "mar1" ? "mar1" : "feb28";
  const gapA = params.get("gapa") ?? "";
  const gapB = params.get("gapb") ?? "";
  if (!birth && !reference && !gapA && !gapB) return null;
  return { birth, birthTime, reference, referenceTime, feb29Policy, gapA, gapB };
}

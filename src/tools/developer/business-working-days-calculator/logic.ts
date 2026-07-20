/**
 * Business / Working Days Calculator — pure logic.
 *
 * Count the number of business/working days between two dates, and add or
 * subtract N business days to a date. Excludes weekends (configurable: any
 * days of the week, e.g. Sat+Sun or Fri+Sat) and a custom list of holidays.
 * Supports include/exclude end day, half-day handling, country holiday
 * presets, saved reusable holiday sets (localStorage), batch range lists
 * with CSV export, shareable URL fragment, and a history of recent
 * calculations.
 *
 * Pure functions only — no DOM, no network. All date math is done in UTC to
 * avoid DST-related surprises. Holiday strings are normalized to YYYY-MM-DD.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type HalfDayType = "none" | "start-am" | "start-pm" | "end-am" | "end-pm";

export interface CountInput {
  /** Start date YYYY-MM-DD (midnight UTC). */
  start: string;
  /** End date YYYY-MM-DD (midnight UTC). */
  end: string;
  /** 0=Sun, 1=Mon, ... 6=Sat. Default [0, 6] (Sun + Sat). */
  weekendDays?: ReadonlyArray<number>;
  /** Holiday dates as YYYY-MM-DD strings. */
  holidays?: ReadonlyArray<string>;
  /** Include the end date in the count. Default false (i.e. [start, end)). */
  includeEnd?: boolean;
  /** Include the start date in the count. Default true. */
  includeStart?: boolean;
}

export interface AddInput {
  /** Start date YYYY-MM-DD. */
  start: string;
  /** Number of business days to add (negative = subtract). */
  days: number;
  weekendDays?: ReadonlyArray<number>;
  holidays?: ReadonlyArray<string>;
}

export interface DayBreakdownEntry {
  date: string;
  dayOfWeek: number;
  weekday: string;
  type: "business" | "weekend" | "holiday" | "holiday-on-weekend";
}

export interface CountResult {
  /** Total calendar days in range (inclusive of both endpoints when both flags set). */
  totalDays: number;
  /** Number of business days counted. */
  businessDays: number;
  /** Number of weekend days in range. */
  weekendDays: number;
  /** Number of holiday days in range (not counting those that fall on a weekend). */
  holidays: number;
  /** Number of holiday days that fell on a weekend (so not double-counted). */
  holidaysOnWeekend: number;
  /** Half-day-aware business-day count (a half day counts as 0.5). */
  businessDaysDecimal: number;
  /** Per-day breakdown (every day in the range, including skipped). */
  breakdown: DayBreakdownEntry[];
  /** Plain-English summary. */
  summary: string;
  /** True if end < start (so range is empty). */
  reversed: boolean;
}

export interface AddResult {
  /** Resulting ISO date (YYYY-MM-DD). */
  resultDate: string;
  /** Weekday name (e.g. "Monday"). */
  weekday: string;
  /** Day-of-week, 0=Sun..6=Sat. */
  dayOfWeek: number;
  /** Number of business days actually moved (absolute value). */
  businessDaysMoved: number;
  /** Number of weekend days skipped. */
  weekendDaysSkipped: number;
  /** Number of holidays skipped. */
  holidaysSkipped: number;
  /** Calendar days between start and result (signed). */
  calendarDaysDelta: number;
  /** Plain-English summary. */
  summary: string;
}

export interface BatchRange {
  start: string;
  end: string;
  businessDays: number;
  totalDays: number;
  weekends: number;
  holidays: number;
  error?: string;
}

export interface BatchRangeRow {
  start: string;
  end: string;
}

export interface HolidaySet {
  id: string;
  name: string;
  holidays: string[];
  createdAt: number;
}

export interface HistoryEntry {
  ts: number;
  mode: "count" | "add";
  summary: string;
  businessDays: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_WEEKEND_DAYS: ReadonlyArray<number> = [0, 6];

/** Milliseconds per day (UTC). */
export const MS_PER_DAY = 86_400_000;

const WEEKDAY_LABELS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Weekend presets for common regional patterns. */
export const WEEKEND_PRESETS: ReadonlyArray<{ id: string; label: string; days: ReadonlyArray<number> }> = [
  { id: "sat-sun", label: "Saturday + Sunday (most of world)", days: [0, 6] },
  { id: "fri-sat", label: "Friday + Saturday (Gulf / Saudi / UAE)", days: [5, 6] },
  { id: "sun-only", label: "Sunday only (parts of India, Philippines)", days: [0] },
  { id: "fri-sun", label: "Friday + Sunday off (Israel variant)", days: [5, 0] },
  { id: "thu-fri", label: "Thursday + Friday (Iran, Afghanistan)", days: [4, 5] },
  { id: "none", label: "No weekend (continuous operations)", days: [] },
];

/** Compact offline country holiday preset dataset (representative public holidays). */
export const COUNTRY_HOLIDAY_PRESETS: ReadonlyArray<{
  id: string;
  label: string;
  year: number;
  holidays: ReadonlyArray<string>;
}> = [
  {
    id: "us-2025",
    label: "United States — 2025 (Federal)",
    year: 2025,
    holidays: [
      "2025-01-01", "2025-01-20", "2025-02-17", "2025-05-26", "2025-06-19",
      "2025-07-04", "2025-09-01", "2025-10-13", "2025-11-11", "2025-11-27",
      "2025-12-25",
    ],
  },
  {
    id: "us-2026",
    label: "United States — 2026 (Federal)",
    year: 2026,
    holidays: [
      "2026-01-01", "2026-01-19", "2026-02-16", "2026-05-25", "2026-06-19",
      "2026-07-04", "2026-09-07", "2026-10-12", "2026-11-11", "2026-11-26",
      "2026-12-25",
    ],
  },
  {
    id: "uk-2025",
    label: "United Kingdom — 2025 (England & Wales)",
    year: 2025,
    holidays: [
      "2025-01-01", "2025-04-18", "2025-04-21", "2025-05-05", "2025-05-26",
      "2025-08-25", "2025-12-25", "2025-12-26",
    ],
  },
  {
    id: "india-2025",
    label: "India — 2025 (Gazetted central holidays)",
    year: 2025,
    holidays: [
      "2025-01-26", "2025-03-14", "2025-04-14", "2025-08-15", "2025-08-27",
      "2025-10-02", "2025-10-21", "2025-10-31", "2025-12-25",
    ],
  },
  {
    id: "au-2025",
    label: "Australia — 2025 (National)",
    year: 2025,
    holidays: [
      "2025-01-01", "2025-01-27", "2025-03-10", "2025-04-18", "2025-04-19",
      "2025-04-21", "2025-04-25", "2025-06-09", "2025-10-06", "2025-12-25",
      "2025-12-26",
    ],
  },
  {
    id: "ca-2025",
    label: "Canada — 2025 (Federal statutory)",
    year: 2025,
    holidays: [
      "2025-01-01", "2025-04-18", "2025-04-21", "2025-07-01", "2025-09-01",
      "2025-10-13", "2025-11-11", "2025-12-25", "2025-12-26",
    ],
  },
];

// ---------------------------------------------------------------------------
// Date parsing & formatting helpers
// ---------------------------------------------------------------------------

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function pad4(n: number): string {
  if (n < 0) return `-${pad4(-n)}`;
  return n < 10 ? `000${n}` : n < 100 ? `00${n}` : n < 1000 ? `0${n}` : String(n);
}

/**
 * Parse a date string into a UTC ms instant.
 * Accepts "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM[:SS]". Returns NaN for invalid.
 */
export function parseDate(s: string): number {
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
  return !Number.isNaN(parseDate(s));
}

/** Format a UTC ms instant as YYYY-MM-DD. */
export function formatDate(ms: number): string {
  if (Number.isNaN(ms)) return "";
  const d = new Date(ms);
  return `${pad4(d.getUTCFullYear())}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Return weekday label (0=Sun..6=Sat). */
export function weekdayLabel(n: number): string {
  return WEEKDAY_LABELS[n] ?? "";
}

/** Return short weekday label (0=Sun..6=Sat). */
export function weekdayShort(n: number): string {
  return WEEKDAY_SHORT[n] ?? "";
}

/** Get day of week (0=Sun..6=Sat) from a YYYY-MM-DD string. */
export function dayOfWeekOf(s: string): number {
  const ms = parseDate(s);
  if (Number.isNaN(ms)) return -1;
  return new Date(ms).getUTCDay();
}

// ---------------------------------------------------------------------------
// Holiday parsing & normalization
// ---------------------------------------------------------------------------

/** Normalize and validate a list of holiday strings. Returns YYYY-MM-DD list. */
export function normalizeHolidays(input: ReadonlyArray<string> | string): string[] {
  const arr: string[] = [];
  const parts = typeof input === "string"
    ? input.split(/[\n,;\s]+/).filter(Boolean)
    : [...input];
  for (const p of parts) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    const normalized = normalizeOneHoliday(trimmed);
    if (normalized && isValidDate(normalized)) {
      if (!arr.includes(normalized)) arr.push(normalized);
    }
  }
  return arr.sort();
}

function normalizeOneHoliday(s: string): string | null {
  // YYYY-MM-DD or YYYY/MM/DD
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
  if (m) {
    return `${m[1]}-${pad2(Number(m[2]))}-${pad2(Number(m[3]))}`;
  }
  // D-M-YYYY or M/D/YYYY (assume M/D/YYYY US-style when slashes)
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(s);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12) {
      return `${m[3]}-${pad2(b)}-${pad2(a)}`;
    }
    return `${m[3]}-${pad2(a)}-${pad2(b)}`;
  }
  return null;
}

/** Parse a textarea of holidays into a normalized YYYY-MM-DD list. */
export function parseHolidaysText(text: string): string[] {
  if (!text) return [];
  return normalizeHolidays(text.split(/\r?\n/));
}

// ---------------------------------------------------------------------------
// Weekend / holiday predicates
// ---------------------------------------------------------------------------

/** True if the given day-of-week is in the weekend set. */
export function isWeekend(dayOfWeek: number, weekendDays: ReadonlyArray<number>): boolean {
  return weekendDays.includes(dayOfWeek);
}

/** True if the given YYYY-MM-DD date string is in the holiday list. */
export function isHoliday(date: string, holidays: ReadonlyArray<string>): boolean {
  return holidays.includes(date);
}

/** True if the date is a business day (not weekend, not holiday). */
export function isBusinessDay(
  date: string,
  weekendDays: ReadonlyArray<number>,
  holidays: ReadonlyArray<string>,
): boolean {
  const ms = parseDate(date);
  if (Number.isNaN(ms)) return false;
  const dow = new Date(ms).getUTCDay();
  if (isWeekend(dow, weekendDays)) return false;
  if (isHoliday(date, holidays)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Core calculation: count business days between two dates
// ---------------------------------------------------------------------------

/**
 * Count business days between two dates.
 *
 * By default the range is [start, end] inclusive of start, exclusive of end
 * (matches the convention used by most spreadsheet NETWORKDAYS variants
 * when end is "today" and you don't count today). Use includeStart/includeEnd
 * to override either endpoint.
 */
export function countBusinessDays(input: CountInput): CountResult {
  const weekendDays = input.weekendDays ?? DEFAULT_WEEKEND_DAYS;
  const holidays = input.holidays ?? [];
  const includeStart = input.includeStart !== false;
  const includeEnd = input.includeEnd === true;

  const startMs = parseDate(input.start);
  const endMs = parseDate(input.end);

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return {
      totalDays: 0,
      businessDays: 0,
      weekendDays: 0,
      holidays: 0,
      holidaysOnWeekend: 0,
      businessDaysDecimal: 0,
      breakdown: [],
      summary: "Invalid date(s) provided.",
      reversed: false,
    };
  }

  const reversed = endMs < startMs;
  const loMs = Math.min(startMs, endMs);
  const hiMs = Math.max(startMs, endMs);

  const loDate = formatDate(loMs);
  const hiDate = formatDate(hiMs);

  const breakdown: DayBreakdownEntry[] = [];
  let business = 0;
  let weekend = 0;
  let holiday = 0;
  let holidayOnWeekend = 0;
  let totalCalendar = 0;

  for (let cur = loMs; cur <= hiMs; cur += MS_PER_DAY) {
    const dateStr = formatDate(cur);
    const dow = new Date(cur).getUTCDay();
    const isWknd = isWeekend(dow, weekendDays);
    const isHol = isHoliday(dateStr, holidays);

    let type: DayBreakdownEntry["type"] = "business";
    if (isHol && isWknd) {
      type = "holiday-on-weekend";
    } else if (isHol) {
      type = "holiday";
    } else if (isWknd) {
      type = "weekend";
    }

    breakdown.push({
      date: dateStr,
      dayOfWeek: dow,
      weekday: weekdayShort(dow),
      type,
    });

    let inWindow = true;
    if (dateStr === loDate && !includeStart) inWindow = false;
    if (dateStr === hiDate && !includeEnd) inWindow = false;

    if (inWindow) {
      totalCalendar++;
      if (type === "business") business++;
      else if (type === "weekend") weekend++;
      else if (type === "holiday-on-weekend") {
        weekend++;
        holidayOnWeekend++;
      } else if (type === "holiday") holiday++;
    }
  }

  const businessDaysDecimal = business;

  const summaryParts: string[] = [];
  summaryParts.push(`${business} business day${business === 1 ? "" : "s"}`);
  if (weekend > 0) summaryParts.push(`${weekend} weekend day${weekend === 1 ? "" : "s"} skipped`);
  if (holiday > 0) summaryParts.push(`${holiday} holiday${holiday === 1 ? "" : "s"} skipped`);
  if (holidayOnWeekend > 0) summaryParts.push(`${holidayOnWeekend} holiday${holidayOnWeekend === 1 ? "" : "s"} fell on weekend (not double-counted)`);
  const summary = `From ${loDate} to ${hiDate}${reversed ? " (reversed)" : ""}: ${summaryParts.join(", ")}.`;

  return {
    totalDays: totalCalendar,
    businessDays: business,
    weekendDays: weekend,
    holidays: holiday,
    holidaysOnWeekend: holidayOnWeekend,
    businessDaysDecimal,
    breakdown,
    summary,
    reversed,
  };
}

// ---------------------------------------------------------------------------
// Core calculation: add / subtract N business days
// ---------------------------------------------------------------------------

function advanceToNextBusinessDay(
  startMs: number,
  direction: number,
  weekendDays: ReadonlyArray<number>,
  holidays: ReadonlyArray<string>,
): number {
  let cur = startMs;
  for (let i = 0; i < 366; i++) {
    cur += direction * MS_PER_DAY;
    const dateStr = formatDate(cur);
    if (isBusinessDay(dateStr, weekendDays, holidays)) return cur;
  }
  return cur;
}

/**
 * Add (or subtract, if days is negative) N business days to a start date.
 * Walks forward day-by-day, skipping weekends and holidays.
 *
 * When days === 0, returns the start date unchanged (if it's a business day)
 * or the next business day (if start is a weekend/holiday).
 */
export function addBusinessDays(input: AddInput): AddResult {
  const weekendDays = input.weekendDays ?? DEFAULT_WEEKEND_DAYS;
  const holidays = input.holidays ?? [];
  const days = input.days;

  const startMs = parseDate(input.start);
  if (Number.isNaN(startMs)) {
    return {
      resultDate: "",
      weekday: "",
      dayOfWeek: -1,
      businessDaysMoved: 0,
      weekendDaysSkipped: 0,
      holidaysSkipped: 0,
      calendarDaysDelta: 0,
      summary: "Invalid start date.",
    };
  }

  const direction = days >= 0 ? 1 : -1;
  const remaining = Math.abs(days);
  let cur = startMs;
  let moved = 0;
  let weekendsSkipped = 0;
  let holidaysSkipped = 0;

  if (remaining === 0) {
    if (!isBusinessDay(formatDate(cur), weekendDays, holidays)) {
      cur = advanceToNextBusinessDay(cur, direction, weekendDays, holidays);
    }
  } else {
    while (moved < remaining) {
      cur += direction * MS_PER_DAY;
      const dateStr = formatDate(cur);
      const dow = new Date(cur).getUTCDay();
      const isWknd = isWeekend(dow, weekendDays);
      const isHol = isHoliday(dateStr, holidays);
      if (isWknd && isHol) {
        weekendsSkipped++;
      } else if (isWknd) {
        weekendsSkipped++;
      } else if (isHol) {
        holidaysSkipped++;
      } else {
        moved++;
      }
    }
  }

  const resultDate = formatDate(cur);
  const dow = new Date(cur).getUTCDay();
  const deltaDays = Math.round((cur - startMs) / MS_PER_DAY);

  const sign = direction >= 0 ? "from" : "before";
  const summary = `${days} business day${Math.abs(days) === 1 ? "" : "s"} ${direction >= 0 ? "after" : "before"} ${input.start} is ${resultDate} (${weekdayLabel(dow)}). Skipped ${weekendsSkipped} weekend day${weekendsSkipped === 1 ? "" : "s"} and ${holidaysSkipped} holiday${holidaysSkipped === 1 ? "" : "s"} (${deltaDays} calendar day${Math.abs(deltaDays) === 1 ? "" : "s"} ${sign} start).`;

  return {
    resultDate,
    weekday: weekdayLabel(dow),
    dayOfWeek: dow,
    businessDaysMoved: Math.abs(days),
    weekendDaysSkipped: weekendsSkipped,
    holidaysSkipped: holidaysSkipped,
    calendarDaysDelta: deltaDays,
    summary,
  };
}

/** Convenience: subtract N business days (alias for addBusinessDays with negative). */
export function subtractBusinessDays(input: Omit<AddInput, "days"> & { days: number }): AddResult {
  return addBusinessDays({ ...input, days: -input.days });
}

// ---------------------------------------------------------------------------
// Batch range processing
// ---------------------------------------------------------------------------

/** Parse a textarea of "start end" pairs (one per line, whitespace-separated). */
export function parseBatchRanges(text: string): BatchRangeRow[] {
  if (!text) return [];
  const out: BatchRangeRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Try separator-style: "X..Y", "X to Y", "X->Y", "X→Y" (separator is non-whitespace).
    let m = /^(\S+?)\s*(?:\.\.|->|→|to)\s*(\S+)$/.exec(trimmed);
    if (m) {
      out.push({ start: m[1], end: m[2] });
      continue;
    }
    // Try whitespace-separated: "X Y"
    m = /^(\S+)\s+(\S+)$/.exec(trimmed);
    if (m) {
      out.push({ start: m[1], end: m[2] });
      continue;
    }
    // Single date with implicit 1-day range
    out.push({ start: trimmed, end: trimmed });
  }
  return out;
}

/** Compute business days for each row in a batch. */
export function computeBatch(
  rows: ReadonlyArray<BatchRangeRow>,
  options?: {
    weekendDays?: ReadonlyArray<number>;
    holidays?: ReadonlyArray<string>;
    includeEnd?: boolean;
    includeStart?: boolean;
  },
): BatchRange[] {
  const weekendDays = options?.weekendDays ?? DEFAULT_WEEKEND_DAYS;
  const holidays = options?.holidays ?? [];
  const includeEnd = options?.includeEnd === true;
  const includeStart = options?.includeStart !== false;

  return rows.map((row) => {
    if (!isValidDate(row.start) || !isValidDate(row.end)) {
      return {
        start: row.start,
        end: row.end,
        businessDays: 0,
        totalDays: 0,
        weekends: 0,
        holidays: 0,
        error: "Invalid date format",
      };
    }
    const result = countBusinessDays({
      start: row.start,
      end: row.end,
      weekendDays,
      holidays,
      includeEnd,
      includeStart,
    });
    return {
      start: row.start,
      end: row.end,
      businessDays: result.businessDays,
      totalDays: result.totalDays,
      weekends: result.weekendDays,
      holidays: result.holidays,
    };
  });
}

/** Render batch results as CSV. */
export function renderBatchCsv(batch: ReadonlyArray<BatchRange>): string {
  const lines = ["start,end,business_days,total_days,weekends,holidays"];
  for (const r of batch) {
    lines.push([
      r.start,
      r.end,
      String(r.businessDays),
      String(r.totalDays),
      String(r.weekends),
      String(r.holidays),
    ].join(","));
  }
  return lines.join("\n");
}

/** Compute a single batch and return its CSV. */
export function computeBatchCsv(
  rows: ReadonlyArray<BatchRangeRow>,
  options?: {
    weekendDays?: ReadonlyArray<number>;
    holidays?: ReadonlyArray<string>;
    includeEnd?: boolean;
    includeStart?: boolean;
  },
): string {
  const batch = computeBatch(rows, options);
  return renderBatchCsv(batch);
}

// ---------------------------------------------------------------------------
// Saved holiday sets (localStorage)
// ---------------------------------------------------------------------------

const HOLIDAY_SETS_KEY = "unqtools:bwdc:holiday-sets";

export function loadHolidaySets(): HolidaySet[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HOLIDAY_SETS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HolidaySet[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveHolidaySet(name: string, holidays: string[]): HolidaySet[] {
  if (!name.trim()) return loadHolidaySets();
  const set: HolidaySet = {
    id: `hs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    holidays: normalizeHolidays(holidays),
    createdAt: Date.now(),
  };
  const next = [set, ...loadHolidaySets()].slice(0, 20);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HOLIDAY_SETS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function deleteHolidaySet(id: string): HolidaySet[] {
  const next = loadHolidaySets().filter((s) => s.id !== id);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HOLIDAY_SETS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// History (localStorage) — max 20
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:bwdc:history";
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
// Shareable URL (fragment-encoded — never sent to server)
// ---------------------------------------------------------------------------

export interface ShareState {
  mode: "count" | "add";
  start: string;
  end: string;
  days: number;
  weekendDays: number[];
  holidays: string[];
  includeEnd: boolean;
  includeStart: boolean;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  params.set("mode", state.mode);
  if (state.start) params.set("start", state.start);
  if (state.mode === "count" && state.end) params.set("end", state.end);
  if (state.mode === "add") params.set("days", String(state.days));
  if (state.weekendDays.length > 0) params.set("wk", state.weekendDays.join(","));
  if (state.holidays.length > 0) params.set("hol", state.holidays.join(","));
  if (state.mode === "count") {
    params.set("ie", state.includeEnd ? "1" : "0");
    params.set("is", state.includeStart ? "1" : "0");
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState> | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const mode = (params.get("mode") as "count" | "add" | null) ?? "count";
  const start = params.get("start") ?? "";
  const end = params.get("end") ?? "";
  const daysStr = params.get("days");
  const days = daysStr !== null ? Number(daysStr) : 0;
  const wkStr = params.get("wk") ?? "";
  const weekendDays = wkStr
    ? wkStr.split(",")
        .map((s) => Number(s))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    : [];
  const holStr = params.get("hol") ?? "";
  const holidays = holStr ? holStr.split(",").filter((s) => isValidDate(s)) : [];
  const includeEnd = params.get("ie") === "1";
  const includeStart = params.get("is") !== "0";

  return {
    mode,
    start,
    end,
    days,
    weekendDays,
    holidays,
    includeEnd,
    includeStart,
  };
}

// ---------------------------------------------------------------------------
// Plain-text result rendering
// ---------------------------------------------------------------------------

/** Render count result as plain text. */
export function renderCountText(result: CountResult): string {
  const lines: string[] = [];
  lines.push(result.summary);
  lines.push("");
  lines.push(`Total calendar days in range : ${result.totalDays}`);
  lines.push(`Business days                 : ${result.businessDays}`);
  lines.push(`Weekend days                  : ${result.weekendDays}`);
  lines.push(`Holiday days                  : ${result.holidays}`);
  lines.push(`Holidays on weekend (skip)    : ${result.holidaysOnWeekend}`);
  if (result.breakdown.length > 0 && result.breakdown.length <= 100) {
    lines.push("");
    lines.push("--- Day-by-day breakdown ---");
    for (const e of result.breakdown) {
      const tag = e.type === "business" ? "  ✓"
        : e.type === "weekend" ? "  ✗"
        : e.type === "holiday" ? "  H"
        : "  H✗";
      lines.push(`${e.date} ${e.weekday}${tag}`);
    }
  }
  return lines.join("\n");
}

/** Render add/subtract result as plain text. */
export function renderAddText(result: AddResult): string {
  const lines: string[] = [];
  lines.push(result.summary);
  lines.push("");
  lines.push(`Result date       : ${result.resultDate}`);
  lines.push(`Weekday           : ${result.weekday}`);
  lines.push(`Business days     : ${result.businessDaysMoved}`);
  lines.push(`Weekends skipped  : ${result.weekendDaysSkipped}`);
  lines.push(`Holidays skipped  : ${result.holidaysSkipped}`);
  lines.push(`Calendar day delta: ${result.calendarDaysDelta}`);
  return lines.join("\n");
}

/** Half-day helper: compute decimal business days given half-day flags on start/end. */
export function applyHalfDays(
  result: CountResult,
  options: {
    startHalf?: HalfDayType;
    endHalf?: HalfDayType;
    weekendDays: ReadonlyArray<number>;
    holidays: ReadonlyArray<string>;
    start: string;
    end: string;
  },
): number {
  if (result.businessDays === 0) return 0;
  let decimal = result.businessDays;
  if (options.startHalf && options.startHalf !== "none") {
    if (isBusinessDay(options.start, options.weekendDays, options.holidays)) {
      decimal -= 0.5;
    }
  }
  if (options.endHalf && options.endHalf !== "none") {
    if (isBusinessDay(options.end, options.weekendDays, options.holidays)) {
      decimal -= 0.5;
    }
  }
  return Math.max(0, decimal);
}

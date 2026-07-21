/**
 * Printable Calendar Generator — pure logic.
 *
 * Generate print-perfect printable calendars for any year. Pure functions
 * only — no DOM, no network. Produces HTML strings with print CSS, computes
 * month / year / weekly / multi-month grids, ISO week numbers, day-of-year,
 * offline holiday presets (US / UK / EU) including Easter via the Computus
 * algorithm, custom events, themes, paper-size aware CSS, locale month and
 * weekday names. Offline, deterministic, side-effect-free except for the
 * localStorage history helpers (loadHistory/saveHistory/clearHistory) which
 * are intentionally impure for persistence.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CalendarLayout = "monthly" | "yearly" | "weekly" | "multi-month";

export type WeekStart = "sunday" | "monday" | "saturday";

export type PaperSize =
  | "letter"
  | "legal"
  | "tabloid"
  | "a3"
  | "a4"
  | "a5"
  | "custom";

export type Orientation = "portrait" | "landscape";

export type LocaleCode =
  | "en-US"
  | "en-GB"
  | "fr-FR"
  | "de-DE"
  | "es-ES"
  | "it-IT"
  | "pt-PT"
  | "nl-NL"
  | "ja-JP"
  | "zh-CN"
  | "ru-RU";

export type HolidayPreset = "none" | "us" | "uk" | "eu";

export type ThemeName = "light" | "dark" | "sepia" | "blue" | "green";

export interface CalendarEvent {
  /** YYYY-MM-DD. */
  date: string;
  title: string;
  /** Optional hex color, e.g. #ef4444. */
  color?: string;
}

export interface Holiday {
  /** YYYY-MM-DD. */
  date: string;
  name: string;
  /** Optional category such as "federal" or "bank". */
  type?: string;
}

export interface CalendarCell {
  /** Day-of-month 1-31, or null for empty padding cells. */
  day: number | null;
  /** YYYY-MM-DD or null for padding cells. */
  date: string | null;
  isToday: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  events: CalendarEvent[];
  /** ISO week number — set only on the first day of each row (week). */
  weekNumber?: number;
  dayOfYear?: number;
}

export interface CalendarWeek {
  cells: CalendarCell[];
  /** ISO week number of this row. */
  weekNumber?: number;
}

export interface CalendarMonth {
  year: number;
  /** 1-12. */
  month: number;
  name: string;
  weeks: CalendarWeek[];
}

export interface CalendarYear {
  year: number;
  months: CalendarMonth[];
}

export interface CalendarOptions {
  layout: CalendarLayout;
  weekStart: WeekStart;
  locale: LocaleCode;
  paperSize: PaperSize;
  /** Custom width in mm (used only when paperSize === "custom"). */
  paperWidthMm?: number;
  /** Custom height in mm (used only when paperSize === "custom"). */
  paperHeightMm?: number;
  orientation: Orientation;
  showWeekNumbers: boolean;
  showDayOfYear: boolean;
  showHolidays: boolean;
  holidayPreset: HolidayPreset;
  events: CalendarEvent[];
  title?: string;
  subtitle?: string;
  theme: ThemeName;
  showNotes: boolean;
  /** For multi-month layout: starting month (1-12). Default 1. */
  startMonth?: number;
  /** For multi-month layout: ending month (1-12). Default 12. */
  endMonth?: number;
  /** For weekly layout: ISO weekday 1-7 (Mon=1..Sun=7). Default 1. */
  weekStartDay?: number;
  /** Override "today" — useful for tests. ISO YYYY-MM-DD. */
  todayOverride?: string;
}

export interface PaperDim {
  widthMm: number;
  heightMm: number;
  label: string;
}

export interface HistoryEntry {
  ts: number;
  year: number;
  layout: CalendarLayout;
  paperSize: PaperSize;
  orientation: Orientation;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const LAYOUTS: ReadonlyArray<{ value: CalendarLayout; label: string; hint: string }> = [
  { value: "monthly", label: "Monthly", hint: "One month per page, large day cells" },
  { value: "yearly", label: "Yearly", hint: "12 mini-months on a single page" },
  { value: "weekly", label: "Weekly", hint: "One week per row with notes column" },
  { value: "multi-month", label: "Multi-month", hint: "2-6 month grid on one page" },
];

export const WEEK_STARTS: ReadonlyArray<{ value: WeekStart; label: string }> = [
  { value: "sunday", label: "Sunday" },
  { value: "monday", label: "Monday (ISO 8601)" },
  { value: "saturday", label: "Saturday" },
];

export const PAPER_SIZES: ReadonlyArray<{ value: PaperSize; label: string }> = [
  { value: "letter", label: "US Letter (8.5 x 11 in)" },
  { value: "legal", label: "US Legal (8.5 x 14 in)" },
  { value: "tabloid", label: "Tabloid (11 x 17 in)" },
  { value: "a3", label: "A3 (297 x 420 mm)" },
  { value: "a4", label: "A4 (210 x 297 mm)" },
  { value: "a5", label: "A5 (148 x 210 mm)" },
  { value: "custom", label: "Custom" },
];

export const ORIENTATIONS: ReadonlyArray<{ value: Orientation; label: string }> = [
  { value: "portrait", label: "Portrait" },
  { value: "landscape", label: "Landscape" },
];

export const LOCALES: ReadonlyArray<{ value: LocaleCode; label: string }> = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "fr-FR", label: "Fran\u00e7ais" },
  { value: "de-DE", label: "Deutsch" },
  { value: "es-ES", label: "Espa\u00f1ol" },
  { value: "it-IT", label: "Italiano" },
  { value: "pt-PT", label: "Portugu\u00eas" },
  { value: "nl-NL", label: "Nederlands" },
  { value: "ja-JP", label: "\u65e5\u672c\u8a9e" },
  { value: "zh-CN", label: "\u4e2d\u6587 (\u7b80\u4f53)" },
  { value: "ru-RU", label: "\u0420\u0443\u0441\u0441\u043a\u0438\u0439" },
];

export const HOLIDAY_PRESETS: ReadonlyArray<{ value: HolidayPreset; label: string }> = [
  { value: "none", label: "None" },
  { value: "us", label: "US Federal Holidays" },
  { value: "uk", label: "UK Bank Holidays" },
  { value: "eu", label: "Common European Holidays" },
];

export const THEMES: ReadonlyArray<{ value: ThemeName; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "sepia", label: "Sepia" },
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
];

export const THEME_COLORS: Record<ThemeName, {
  bg: string;
  fg: string;
  accent: string;
  weekend: string;
  todayBg: string;
  holiday: string;
}> = {
  light: {
    bg: "#ffffff",
    fg: "#1f2937",
    accent: "#2563eb",
    weekend: "#94a3b8",
    todayBg: "#dbeafe",
    holiday: "#dc2626",
  },
  dark: {
    bg: "#0f172a",
    fg: "#e2e8f0",
    accent: "#60a5fa",
    weekend: "#64748b",
    todayBg: "#1e3a8a",
    holiday: "#f87171",
  },
  sepia: {
    bg: "#f5ecd9",
    fg: "#5b4636",
    accent: "#b8860b",
    weekend: "#a08c75",
    todayBg: "#ecd9b5",
    holiday: "#a0522d",
  },
  blue: {
    bg: "#eff6ff",
    fg: "#1e3a8a",
    accent: "#2563eb",
    weekend: "#7c9fd6",
    todayBg: "#bfdbfe",
    holiday: "#dc2626",
  },
  green: {
    bg: "#f0fdf4",
    fg: "#14532d",
    accent: "#16a34a",
    weekend: "#86b893",
    todayBg: "#bbf7d0",
    holiday: "#dc2626",
  },
};

export const PAPER_DIMS: Record<Exclude<PaperSize, "custom">, PaperDim> = {
  letter: { widthMm: 215.9, heightMm: 279.4, label: "Letter" },
  legal: { widthMm: 215.9, heightMm: 355.6, label: "Legal" },
  tabloid: { widthMm: 279.4, heightMm: 431.8, label: "Tabloid" },
  a3: { widthMm: 297, heightMm: 420, label: "A3" },
  a4: { widthMm: 210, heightMm: 297, label: "A4" },
  a5: { widthMm: 148, heightMm: 210, label: "A5" },
};

const MONTH_NAMES: Record<LocaleCode, string[]> = {
  "en-US": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  "en-GB": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  "fr-FR": ["Janvier", "F\u00e9vrier", "Mars", "Avril", "Mai", "Juin", "Juillet", "Ao\u00fbt", "Septembre", "Octobre", "Novembre", "D\u00e9cembre"],
  "de-DE": ["Januar", "Februar", "M\u00e4rz", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
  "es-ES": ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
  "it-IT": ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"],
  "pt-PT": ["Janeiro", "Fevereiro", "Mar\u00e7o", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
  "nl-NL": ["Januari", "Februari", "Maart", "April", "Mei", "Juni", "Juli", "Augustus", "September", "Oktober", "November", "December"],
  "ja-JP": ["1\u6708", "2\u6708", "3\u6708", "4\u6708", "5\u6708", "6\u6708", "7\u6708", "8\u6708", "9\u6708", "10\u6708", "11\u6708", "12\u6708"],
  "zh-CN": ["\u4e00\u6708", "\u4e8c\u6708", "\u4e09\u6708", "\u56db\u6708", "\u4e94\u6708", "\u516d\u6708", "\u4e03\u6708", "\u516b\u6708", "\u4e5d\u6708", "\u5341\u6708", "\u5341\u4e00\u6708", "\u5341\u4e8c\u6708"],
  "ru-RU": ["\u042f\u043d\u0432\u0430\u0440\u044c", "\u0424\u0435\u0432\u0440\u0430\u043b\u044c", "\u041c\u0430\u0440\u0442", "\u0410\u043f\u0440\u0435\u043b\u044c", "\u041c\u0430\u0439", "\u0418\u044e\u043d\u044c", "\u0418\u044e\u043b\u044c", "\u0410\u0432\u0433\u0443\u0441\u0442", "\u0421\u0435\u043d\u0442\u044f\u0431\u0440\u044c", "\u041e\u043a\u0442\u044f\u0431\u0440\u044c", "\u041d\u043e\u044f\u0431\u0440\u044c", "\u0414\u0435\u043a\u0430\u0431\u0440\u044c"],
};

/** Weekday names indexed by JS getDay() (0=Sun..6=Sat). */
const WEEKDAY_NAMES: Record<LocaleCode, string[]> = {
  "en-US": ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  "en-GB": ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  "fr-FR": ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
  "de-DE": ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
  "es-ES": ["Dom", "Lun", "Mar", "Mi\u00e9", "Jue", "Vie", "S\u00e1b"],
  "it-IT": ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"],
  "pt-PT": ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "S\u00e1b"],
  "nl-NL": ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"],
  "ja-JP": ["\u65e5", "\u6708", "\u706b", "\u6c34", "\u6728", "\u91d1", "\u571f"],
  "zh-CN": ["\u65e5", "\u4e00", "\u4e8c", "\u4e09", "\u56db", "\u4e94", "\u516d"],
  "ru-RU": ["\u0412\u0441", "\u041f\u043d", "\u0412\u0442", "\u0421\u0440", "\u0427\u0442", "\u041f\u0442", "\u0421\u0431"],
};

const MS_PER_DAY = 86400000;

// ---------------------------------------------------------------------------
// Small helpers (exported for tests)
// ---------------------------------------------------------------------------

export function pad2(n: number): string {
  return String(Math.abs(n)).padStart(2, "0");
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  // month is 1-12; Date.UTC(year, month, 0) gives last day of that month.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

export function getMonthName(month: number, locale: LocaleCode = "en-US"): string {
  return MONTH_NAMES[locale][month - 1] ?? `Month ${month}`;
}

/** Weekday names in the order implied by weekStart. Returns 7 strings. */
export function getWeekdayNames(weekStart: WeekStart, locale: LocaleCode = "en-US"): string[] {
  const base = WEEKDAY_NAMES[locale];
  const offset = weekStartOffset(weekStart);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    out.push(base[(i + offset) % 7]);
  }
  return out;
}

/** JS getDay() offset for the given weekStart: how many days after Sunday. */
export function weekStartOffset(weekStart: WeekStart): number {
  switch (weekStart) {
    case "sunday": return 0;
    case "monday": return 1;
    case "saturday": return 6;
  }
}

/** Format a Date (UTC components) as YYYY-MM-DD. */
export function formatIsoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Parse a YYYY-MM-DD string into a UTC Date (or null if invalid). */
export function parseIsoDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

/** Compute the ISO 8601 week number and ISO year for a date. */
export function getIsoWeek(year: number, month: number, day: number): { weekYear: number; week: number } {
  const d = new Date(Date.UTC(year, month - 1, day));
  const dow = d.getUTCDay() || 7; // Mon=1..Sun=7
  const thursday = new Date(d.getTime());
  thursday.setUTCDate(d.getUTCDate() + (4 - dow));
  const isoYear = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4.getTime());
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1));
  const week = Math.floor((thursday.getTime() - week1Monday.getTime()) / (7 * MS_PER_DAY)) + 1;
  return { weekYear: isoYear, week };
}

/** Day-of-year 1-366. */
export function getDayOfYear(year: number, month: number, day: number): number {
  const start = Date.UTC(year, 0, 1);
  const cur = Date.UTC(year, month - 1, day);
  return Math.floor((cur - start) / MS_PER_DAY) + 1;
}

/** Today as YYYY-MM-DD (UTC). */
export function todayIso(): string {
  const d = new Date();
  return formatIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

// ---------------------------------------------------------------------------
// Paper-size helpers
// ---------------------------------------------------------------------------

export function getPaperDim(paperSize: PaperSize, opts?: { customWidthMm?: number; customHeightMm?: number; orientation?: Orientation }): PaperDim {
  if (paperSize === "custom") {
    const w = opts?.customWidthMm ?? 210;
    const h = opts?.customHeightMm ?? 297;
    const orientation = opts?.orientation ?? "portrait";
    return {
      widthMm: orientation === "landscape" ? Math.max(w, h) : Math.min(w, h),
      heightMm: orientation === "landscape" ? Math.min(w, h) : Math.max(w, h),
      label: "Custom",
    };
  }
  const base = PAPER_DIMS[paperSize];
  if (opts?.orientation === "landscape") {
    return { widthMm: base.heightMm, heightMm: base.widthMm, label: base.label };
  }
  return base;
}

// ---------------------------------------------------------------------------
// Holiday computation (offline)
// ---------------------------------------------------------------------------

/** Easter Sunday (Gregorian) using the Computus algorithm. Returns YYYY-MM-DD. */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return formatIsoDate(year, month, day);
}

/** Compute a holiday that falls on the Nth weekday of a month
 *  (e.g. 3rd Monday of January for MLK Day). */
export function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  // weekday: 0=Sun..6=Sat (JS getDay convention).
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstDow = first.getUTCDay();
  const offset = (weekday - firstDow + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return formatIsoDate(year, month, day);
}

/** Last weekday of a month (e.g. last Monday of May for Memorial Day). */
export function lastWeekday(year: number, month: number, weekday: number): string {
  const dim = daysInMonth(year, month);
  const d = new Date(Date.UTC(year, month - 1, dim));
  const dow = d.getUTCDay();
  const offset = (dow - weekday + 7) % 7;
  return formatIsoDate(year, month, dim - offset);
}

/** Add N days to a YYYY-MM-DD string. */
export function addDays(iso: string, n: number): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  d.setUTCDate(d.getUTCDate() + n);
  return formatIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Compute all holidays for a year and preset. Pure. */
export function computeHolidays(year: number, preset: HolidayPreset): Holiday[] {
  const out: Holiday[] = [];
  const push = (date: string, name: string, type?: string) => out.push({ date, name, type });

  if (preset === "none") return out;

  // Common to US/UK/EU
  push(formatIsoDate(year, 1, 1), "New Year's Day", "fixed");
  push(formatIsoDate(year, 12, 25), "Christmas Day", "fixed");

  if (preset === "us") {
    push(nthWeekday(year, 1, 1, 3), "Martin Luther King Jr. Day", "federal");
    push(nthWeekday(year, 2, 1, 3), "Presidents' Day", "federal");
    push(lastWeekday(year, 5, 1), "Memorial Day", "federal");
    push(formatIsoDate(year, 6, 19), "Juneteenth", "federal");
    push(formatIsoDate(year, 7, 4), "Independence Day", "federal");
    push(nthWeekday(year, 9, 1, 1), "Labor Day", "federal");
    push(nthWeekday(year, 10, 1, 2), "Columbus Day", "federal");
    push(formatIsoDate(year, 11, 11), "Veterans Day", "federal");
    push(nthWeekday(year, 11, 4, 4), "Thanksgiving", "federal");
    // If a fixed-date holiday falls on Sunday, observed on Monday; Saturday -> Friday
    for (const h of [...out]) {
      if (h.type !== "fixed") continue;
      const d = parseIsoDate(h.date);
      if (!d) continue;
      const dow = d.getUTCDay();
      if (dow === 0) {
        push(addDays(h.date, 1), `${h.name} (observed)`, "observed");
      } else if (dow === 6) {
        push(addDays(h.date, -1), `${h.name} (observed)`, "observed");
      }
    }
  } else if (preset === "uk") {
    push(formatIsoDate(year, 12, 26), "Boxing Day", "fixed");
    const easter = easterSunday(year);
    push(addDays(easter, -2), "Good Friday", "bank");
    push(addDays(easter, 1), "Easter Monday", "bank");
    push(nthWeekday(year, 5, 1, 1), "Early May Bank Holiday", "bank");
    push(lastWeekday(year, 5, 1), "Spring Bank Holiday", "bank");
    push(lastWeekday(year, 8, 1), "Summer Bank Holiday", "bank");
    // Substitute days: if Sat/Sun, move to next Monday (and Tuesday for Sun+Mon)
    for (const h of [...out]) {
      if (h.type !== "fixed") continue;
      const d = parseIsoDate(h.date);
      if (!d) continue;
      const dow = d.getUTCDay();
      if (dow === 6) {
        push(addDays(h.date, 2), `${h.name} (substitute)`, "substitute");
      } else if (dow === 0) {
        push(addDays(h.date, 1), `${h.name} (substitute)`, "substitute");
      }
    }
  } else if (preset === "eu") {
    push(formatIsoDate(year, 5, 1), "Labour Day", "fixed");
    push(formatIsoDate(year, 12, 26), "St. Stephen's Day", "fixed");
    const easter = easterSunday(year);
    push(addDays(easter, -2), "Good Friday", "religious");
    push(addDays(easter, 1), "Easter Monday", "religious");
  }

  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

// ---------------------------------------------------------------------------
// ICS import (very small, pure parser)
// ---------------------------------------------------------------------------

export interface ParsedIcs {
  events: CalendarEvent[];
  warnings: string[];
}

/** Parse a small subset of ICS — VEVENT blocks with DTSTART and SUMMARY. */
export function parseIcs(text: string): ParsedIcs {
  const events: CalendarEvent[] = [];
  const warnings: string[] = [];
  if (!text || !text.includes("BEGIN:VEVENT")) {
    return { events, warnings: ["No VEVENT blocks found"] };
  }
  // Unfold continuation lines (RFC 5545 §3.1): a line beginning with space
  // or tab continues the previous line. Replace CRLF + leading whitespace
  // with a single space (preserves readability for long text values).
  const unfolded = text.replace(/\r?\n[ \t]+/g, " ");
  const lines = unfolded.split(/\r?\n/);
  let inEvent = false;
  let curDate: string | null = null;
  let curSummary = "";
  for (const line of lines) {
    const l = line.trim();
    if (l === "BEGIN:VEVENT") {
      inEvent = true;
      curDate = null;
      curSummary = "";
    } else if (l === "END:VEVENT") {
      if (inEvent && curDate) {
        events.push({ date: curDate, title: curSummary || "(untitled)" });
      }
      inEvent = false;
    } else if (inEvent) {
      // property:value or property;params:value
      const colon = l.indexOf(":");
      if (colon < 0) continue;
      const propPart = l.slice(0, colon);
      const value = l.slice(colon + 1);
      const propName = propPart.split(";")[0].toUpperCase();
      if (propName === "SUMMARY") {
        curSummary = decodeIcsText(value);
      } else if (propName === "DTSTART") {
        const d = parseIcsDate(value);
        if (d) curDate = d;
        else warnings.push(`Unparseable DTSTART: ${value}`);
      }
    }
  }
  return { events, warnings };
}

function decodeIcsText(s: string): string {
  return s
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseIcsDate(value: string): string | null {
  // value may be "YYYYMMDD" or "YYYYMMDDTHHMMSSZ" or "YYYYMMDDTHHMMSS"
  // possibly with a TZID parameter (already stripped above since we only
  // looked at the part after the colon — but DTSTART;TZID=...:YYYYMMDDTHHMMSS
  // — we already split on the first colon, so value is the date portion).
  const m = /^(\d{4})(\d{2})(\d{2})(?:T\d{6}Z?)?$/.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return formatIsoDate(y, mo, d);
}

// ---------------------------------------------------------------------------
// Cell / month generation
// ---------------------------------------------------------------------------

/** Validate options; collect any errors. */
export function validateOptions(opts: CalendarOptions): ValidationResult {
  const errors: string[] = [];
  if (!opts) {
    return { valid: false, errors: ["Options required"] };
  }
  if (!LAYOUTS.find((l) => l.value === opts.layout)) {
    errors.push(`Invalid layout: ${opts.layout}`);
  }
  if (!WEEK_STARTS.find((w) => w.value === opts.weekStart)) {
    errors.push(`Invalid weekStart: ${opts.weekStart}`);
  }
  if (!PAPER_SIZES.find((p) => p.value === opts.paperSize)) {
    errors.push(`Invalid paperSize: ${opts.paperSize}`);
  }
  if (!ORIENTATIONS.find((o) => o.value === opts.orientation)) {
    errors.push(`Invalid orientation: ${opts.orientation}`);
  }
  if (!LOCALES.find((l) => l.value === opts.locale)) {
    errors.push(`Invalid locale: ${opts.locale}`);
  }
  if (!THEMES.find((t) => t.value === opts.theme)) {
    errors.push(`Invalid theme: ${opts.theme}`);
  }
  if (!HOLIDAY_PRESETS.find((h) => h.value === opts.holidayPreset)) {
    errors.push(`Invalid holidayPreset: ${opts.holidayPreset}`);
  }
  if (opts.paperSize === "custom") {
    if (typeof opts.paperWidthMm !== "number" || opts.paperWidthMm < 10 || opts.paperWidthMm > 2000) {
      errors.push("Custom paper width must be 10-2000 mm");
    }
    if (typeof opts.paperHeightMm !== "number" || opts.paperHeightMm < 10 || opts.paperHeightMm > 2000) {
      errors.push("Custom paper height must be 10-2000 mm");
    }
  }
  if (opts.layout === "multi-month") {
    const s = opts.startMonth ?? 1;
    const e = opts.endMonth ?? 12;
    if (s < 1 || s > 12) errors.push("startMonth must be 1-12");
    if (e < 1 || e > 12) errors.push("endMonth must be 1-12");
    if (s > e) errors.push("startMonth must be <= endMonth");
    if (e - s + 1 > 6) errors.push("multi-month grid supports at most 6 months");
  }
  if (opts.layout === "weekly") {
    const w = opts.weekStartDay ?? 1;
    if (w < 1 || w > 7) errors.push("weekStartDay must be 1-7");
  }
  return { valid: errors.length === 0, errors };
}

export function defaultOptions(): CalendarOptions {
  const now = new Date();
  return {
    layout: "monthly",
    weekStart: "monday",
    locale: "en-US",
    paperSize: "a4",
    orientation: "portrait",
    showWeekNumbers: true,
    showDayOfYear: false,
    showHolidays: true,
    holidayPreset: "us",
    events: [],
    theme: "light",
    showNotes: false,
    startMonth: 1,
    endMonth: 12,
    weekStartDay: 1,
    todayOverride: undefined,
  };
}

/** Build a holiday lookup map for one year. */
export function buildHolidayMap(year: number, preset: HolidayPreset): Map<string, Holiday> {
  const map = new Map<string, Holiday>();
  for (const h of computeHolidays(year, preset)) {
    map.set(h.date, h);
  }
  return map;
}

/** Build an event lookup map (date -> events[]) for fast access. */
export function buildEventMap(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date)!.push(e);
  }
  return map;
}

/** Generate the grid of weeks for a single month. */
export function generateMonth(
  year: number,
  month: number,
  opts: CalendarOptions,
  holidayMap?: Map<string, Holiday>,
  eventMap?: Map<string, CalendarEvent[]>,
): CalendarMonth {
  const hMap = holidayMap ?? (opts.showHolidays ? buildHolidayMap(year, opts.holidayPreset) : new Map<string, Holiday>());
  const eMap = eventMap ?? buildEventMap(opts.events ?? []);
  const todayStr = opts.todayOverride ?? todayIso();
  const dim = daysInMonth(year, month);
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=Sun..6=Sat
  const offset = (firstDow - weekStartOffset(opts.weekStart) + 7) % 7;

  const weeks: CalendarWeek[] = [];
  let day = 1 - offset;
  // Always emit enough weeks to cover all days; up to 6 weeks.
  while (day <= dim) {
    const cells: CalendarCell[] = [];
    let weekNum: number | undefined = undefined;
    for (let i = 0; i < 7; i++) {
      if (day < 1 || day > dim) {
        cells.push({
          day: null,
          date: null,
          isToday: false,
          isWeekend: false,
          isHoliday: false,
          events: [],
        });
      } else {
        const iso = formatIsoDate(year, month, day);
        const d = new Date(Date.UTC(year, month - 1, day));
        const dow = d.getUTCDay(); // 0=Sun..6=Sat
        // Standard weekend: Saturday and Sunday (regardless of week start).
        const isWeekend = dow === 0 || dow === 6;
        const h = hMap.get(iso);
        const evs = eMap.get(iso) ?? [];
        // Compute ISO week number from the first real day of this row.
        if (opts.showWeekNumbers && weekNum === undefined) {
          weekNum = getIsoWeek(year, month, day).week;
        }
        const isFirstRealCell = cells.every((c) => c.day === null);
        cells.push({
          day,
          date: iso,
          isToday: iso === todayStr,
          isWeekend,
          isHoliday: !!h,
          holidayName: h?.name,
          events: evs,
          weekNumber: isFirstRealCell && opts.showWeekNumbers ? weekNum : undefined,
          dayOfYear: opts.showDayOfYear ? getDayOfYear(year, month, day) : undefined,
        });
      }
      day++;
    }
    weeks.push({ cells, weekNumber: weekNum });
  }
  // Ensure at least 6 rows for a tidy grid? No — calendars traditionally emit
  // only as many weeks as needed (4-6). Leave as-is.
  return {
    year,
    month,
    name: getMonthName(month, opts.locale),
    weeks,
  };
}

/** Generate all 12 months for a year. */
export function generateYear(year: number, opts: CalendarOptions): CalendarYear {
  const hMap = opts.showHolidays ? buildHolidayMap(year, opts.holidayPreset) : new Map<string, Holiday>();
  const eMap = buildEventMap(opts.events ?? []);
  const months: CalendarMonth[] = [];
  for (let m = 1; m <= 12; m++) {
    months.push(generateMonth(year, m, opts, hMap, eMap));
  }
  return { year, months };
}

/** Generate a single week (7 days) starting on a given date. */
export function generateWeek(
  year: number,
  month: number,
  day: number,
  opts: CalendarOptions,
): CalendarWeek {
  const hMap = opts.showHolidays ? buildHolidayMap(year, opts.holidayPreset) : new Map<string, Holiday>();
  const eMap = buildEventMap(opts.events ?? []);
  const todayStr = opts.todayOverride ?? todayIso();
  const cells: CalendarCell[] = [];
  const start = parseIsoDate(formatIsoDate(year, month, day));
  if (!start) {
    throw new Error(`Invalid start date: ${year}-${month}-${day}`);
  }
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getTime() + i * MS_PER_DAY);
    const y = d.getUTCFullYear();
    const mo = d.getUTCMonth() + 1;
    const da = d.getUTCDate();
    const iso = formatIsoDate(y, mo, da);
    const dow = d.getUTCDay();
    const h = hMap.get(iso);
    const evs = eMap.get(iso) ?? [];
    cells.push({
      day: da,
      date: iso,
      isToday: iso === todayStr,
      isWeekend: dow === 0 || dow === 6,
      isHoliday: !!h,
      holidayName: h?.name,
      events: evs,
      weekNumber: i === 0 ? getIsoWeek(y, mo, da).week : undefined,
      dayOfYear: opts.showDayOfYear ? getDayOfYear(y, mo, da) : undefined,
    });
  }
  return { cells, weekNumber: cells[0]?.weekNumber };
}

/** Generate a multi-month range (e.g. Jan-Jun or Sep-Dec). */
export function generateMultiMonth(
  year: number,
  startMonth: number,
  endMonth: number,
  opts: CalendarOptions,
): CalendarMonth[] {
  const hMap = opts.showHolidays ? buildHolidayMap(year, opts.holidayPreset) : new Map<string, Holiday>();
  const eMap = buildEventMap(opts.events ?? []);
  const out: CalendarMonth[] = [];
  for (let m = startMonth; m <= endMonth; m++) {
    out.push(generateMonth(year, m, opts, hMap, eMap));
  }
  return out;
}

// ---------------------------------------------------------------------------
// HTML rendering (pure — produces strings, no DOM writes)
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  // Escape the characters that are dangerous in HTML content or in a
  // double-quoted attribute value. Apostrophes are left alone (safe in
  // content and inside double-quoted attributes).
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Render a single month as an HTML table. Pure. */
export function renderMonthHtml(month: CalendarMonth, opts: CalendarOptions): string {
  const colors = THEME_COLORS[opts.theme];
  const wdNames = getWeekdayNames(opts.weekStart, opts.locale);
  const headerCells = wdNames
    .map((n) => `<th scope="col" class="cal-wd">${escapeHtml(n)}</th>`)
    .join("");
  const weekHead = opts.showWeekNumbers
    ? `<th scope="col" class="cal-wn-h" aria-label="Week number">#</th>${headerCells}`
    : headerCells;
  const rows = month.weeks.map((w) => {
    const wn = opts.showWeekNumbers
      ? `<td class="cal-wn">${w.weekNumber ?? ""}</td>`
      : "";
    const cells = w.cells.map((c) => renderCellHtml(c, opts)).join("");
    return `<tr>${wn}${cells}</tr>`;
  }).join("");
  return `<table class="cal-month" aria-label="${escapeHtml(month.name)} ${month.year}">
<thead><tr>${weekHead}</tr></thead>
<tbody>${rows}</tbody>
</table>`;
}

function renderCellHtml(c: CalendarCell, opts: CalendarOptions): string {
  if (c.day === null || c.date === null) {
    return `<td class="cal-empty"></td>`;
  }
  const classes = ["cal-day"];
  if (c.isToday) classes.push("cal-today");
  if (c.isWeekend) classes.push("cal-weekend");
  if (c.isHoliday) classes.push("cal-holiday");
  const dayLabel = c.dayOfYear
    ? `<span class="cal-doy">${c.dayOfYear}</span>`
    : "";
  const holidayBadge = c.isHoliday && c.holidayName
    ? `<span class="cal-hol-name">${escapeHtml(c.holidayName)}</span>`
    : "";
  const eventHtml = c.events.map((e) => {
    const color = e.color ?? "#2563eb";
    return `<span class="cal-evt" style="--evt:${escapeHtml(color)}">${escapeHtml(e.title)}</span>`;
  }).join("");
  return `<td class="${classes.join(" ")}" data-date="${c.date}">
<span class="cal-num">${c.day}${dayLabel}</span>
${holidayBadge}
<span class="cal-evts">${eventHtml}</span>
</td>`;
}

/** Render a full year as a single HTML page with 12 mini-month grids. */
export function renderYearHtml(year: number, opts: CalendarOptions): string {
  const cy = generateYear(year, opts);
  const monthsHtml = cy.months.map((m) => {
    return `<section class="cal-mini-month">
<h3>${escapeHtml(m.name)}</h3>
${renderMiniMonthHtml(m, opts)}
</section>`;
  }).join("");
  return `<div class="cal-year-grid" aria-label="Year ${year}">${monthsHtml}</div>`;
}

/** Render a month as a compact mini-grid (no event detail, no notes). */
export function renderMiniMonthHtml(month: CalendarMonth, opts: CalendarOptions): string {
  const wdNames = getWeekdayNames(opts.weekStart, opts.locale);
  // Mini view uses single-letter weekday headers.
  const headerCells = wdNames
    .map((n) => `<th scope="col">${escapeHtml(n.charAt(0))}</th>`)
    .join("");
  const rows = month.weeks.map((w) => {
    const cells = w.cells.map((c) => {
      if (c.day === null) return `<td class="cal-empty"></td>`;
      const cls = ["mini-day"];
      if (c.isToday) cls.push("cal-today");
      if (c.isHoliday) cls.push("cal-holiday");
      return `<td class="${cls.join(" ")}">${c.day}</td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("");
  return `<table class="cal-mini"><thead><tr>${headerCells}</tr></thead><tbody>${rows}</tbody></table>`;
}

/** Render a single week as a 7-row table with a notes column. */
export function renderWeekHtml(week: CalendarWeek, opts: CalendarOptions): string {
  const colors = THEME_COLORS[opts.theme];
  const wdNames = getWeekdayNames(opts.weekStart, opts.locale);
  const headerCells = wdNames
    .map((n) => `<th scope="col">${escapeHtml(n)}</th>`)
    .join("");
  const notesHead = opts.showNotes ? `<th scope="col">Notes</th>` : "";
  const rows = week.cells.map((c, i) => {
    if (c.day === null) {
      return `<tr><td class="cal-empty"></td>${opts.showNotes ? '<td class="cal-notes"></td>' : ""}</tr>`;
    }
    const classes = ["cal-day"];
    if (c.isToday) classes.push("cal-today");
    if (c.isWeekend) classes.push("cal-weekend");
    if (c.isHoliday) classes.push("cal-holiday");
    const holidayBadge = c.isHoliday && c.holidayName
      ? `<span class="cal-hol-name">${escapeHtml(c.holidayName)}</span>`
      : "";
    const eventHtml = c.events.map((e) => {
      const color = e.color ?? colors.accent;
      return `<span class="cal-evt" style="--evt:${escapeHtml(color)}">${escapeHtml(e.title)}</span>`;
    }).join("");
    return `<tr class="${classes.join(" ")}">
<td class="cal-day-cell" data-date="${c.date}">
<div class="cal-day-num">${c.day} <span class="cal-wd-label">${escapeHtml(wdNames[i])}</span></div>
${holidayBadge}
<div class="cal-evts">${eventHtml}</div>
</td>
${opts.showNotes ? '<td class="cal-notes"></td>' : ""}
</tr>`;
  }).join("");
  return `<table class="cal-week"><thead><tr>${headerCells}${notesHead}</tr></thead><tbody>${rows}</tbody></table>`;
}

/** Render multi-month as a CSS grid of mini-months. */
export function renderMultiMonthHtml(months: CalendarMonth[], opts: CalendarOptions): string {
  const items = months.map((m) => {
    return `<section class="cal-mini-month">
<h3>${escapeHtml(m.name)}</h3>
${renderMiniMonthHtml(m, opts)}
</section>`;
  }).join("");
  return `<div class="cal-multi-grid" aria-label="Multi-month view">${items}</div>`;
}

/** Build the print CSS for a given paper size + orientation + theme. Pure. */
export function getPrintCss(opts: CalendarOptions): string {
  const dim = getPaperDim(opts.paperSize, {
    customWidthMm: opts.paperWidthMm,
    customHeightMm: opts.paperHeightMm,
    orientation: opts.orientation,
  });
  const colors = THEME_COLORS[opts.theme];
  const wMm = dim.widthMm;
  const hMm = dim.heightMm;
  return `
@media print {
  @page { size: ${wMm}mm ${hMm}mm; margin: 10mm; }
  html, body { background: ${colors.bg} !important; }
  .no-print { display: none !important; }
}
:root {
  --cal-bg: ${colors.bg};
  --cal-fg: ${colors.fg};
  --cal-accent: ${colors.accent};
  --cal-weekend: ${colors.weekend};
  --cal-today-bg: ${colors.todayBg};
  --cal-holiday: ${colors.holiday};
}
html, body { background: var(--cal-bg); color: var(--cal-fg); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
.cal-page { max-width: ${wMm}mm; margin: 0 auto; padding: 8mm; background: var(--cal-bg); color: var(--cal-fg); }
.cal-title { font-size: 28px; font-weight: 700; margin: 0 0 4px; color: var(--cal-fg); }
.cal-subtitle { font-size: 14px; color: var(--cal-accent); margin: 0 0 16px; }
.cal-month { width: 100%; border-collapse: collapse; table-layout: fixed; }
.cal-month th, .cal-month td { border: 1px solid rgba(0,0,0,0.15); padding: 6px; vertical-align: top; }
.cal-month th { background: rgba(0,0,0,0.04); font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--cal-accent); }
.cal-wd { text-align: center; }
.cal-wn-h { width: 32px; }
.cal-wn { background: rgba(0,0,0,0.04); text-align: center; font-size: 11px; color: var(--cal-weekend); font-weight: 600; }
.cal-day { height: 80px; }
.cal-num { font-size: 14px; font-weight: 700; color: var(--cal-fg); display: block; }
.cal-doy { font-size: 10px; color: var(--cal-weekend); margin-left: 4px; font-weight: 400; }
.cal-today { background: var(--cal-today-bg) !important; }
.cal-today .cal-num { color: var(--cal-accent); }
.cal-weekend .cal-num { color: var(--cal-weekend); }
.cal-holiday .cal-num { color: var(--cal-holiday); }
.cal-hol-name { display: block; font-size: 10px; color: var(--cal-holiday); margin-top: 2px; }
.cal-evts { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; }
.cal-evt { display: block; font-size: 10px; line-height: 1.25; padding: 1px 4px; border-left: 3px solid var(--evt, var(--cal-accent)); background: rgba(0,0,0,0.03); border-radius: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cal-empty { background: rgba(0,0,0,0.02); }
.cal-year-grid, .cal-multi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.cal-mini-month h3 { font-size: 14px; margin: 0 0 6px; text-align: center; color: var(--cal-fg); }
.cal-mini { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; }
.cal-mini th, .cal-mini td { border: 1px solid rgba(0,0,0,0.12); padding: 3px; text-align: center; }
.cal-mini th { background: rgba(0,0,0,0.04); color: var(--cal-accent); font-weight: 600; }
.cal-mini .mini-day { color: var(--cal-fg); }
.cal-mini .cal-today { background: var(--cal-today-bg); font-weight: 700; }
.cal-mini .cal-holiday { color: var(--cal-holiday); font-weight: 700; }
.cal-week { width: 100%; border-collapse: collapse; }
.cal-week th, .cal-week td { border: 1px solid rgba(0,0,0,0.15); padding: 8px; }
.cal-week th { background: rgba(0,0,0,0.04); color: var(--cal-accent); font-weight: 600; text-align: left; }
.cal-week .cal-day-cell { width: 70%; vertical-align: top; }
.cal-week .cal-notes { width: 30%; background: rgba(0,0,0,0.02); }
.cal-day-num { font-size: 16px; font-weight: 700; }
.cal-wd-label { font-size: 11px; color: var(--cal-weekend); margin-left: 8px; font-weight: 400; }
`.trim();
}

/** Top-level HTML document for one calendar. Pure. */
export function renderCalendarHtml(
  year: number,
  opts: CalendarOptions,
): string {
  const v = validateOptions(opts);
  if (!v.valid) {
    throw new Error(`Invalid calendar options: ${v.errors.join("; ")}`);
  }
  const colors = THEME_COLORS[opts.theme];
  let body = "";
  switch (opts.layout) {
    case "monthly": {
      const m = generateMonth(year, 1, opts);
      // Use a representative month (January) — UI will request specific months.
      body = renderMonthHtml(m, opts);
      break;
    }
    case "yearly": {
      body = renderYearHtml(year, opts);
      break;
    }
    case "weekly": {
      const w = generateWeek(year, 1, 1, opts);
      body = renderWeekHtml(w, opts);
      break;
    }
    case "multi-month": {
      const s = opts.startMonth ?? 1;
      const e = opts.endMonth ?? 12;
      const months = generateMultiMonth(year, s, e, opts);
      body = renderMultiMonthHtml(months, opts);
      break;
    }
  }
  const titleHtml = opts.title
    ? `<h1 class="cal-title">${escapeHtml(opts.title)}</h1>`
    : `<h1 class="cal-title">${year}${opts.layout === "yearly" ? "" : ""}</h1>`;
  const subtitleHtml = opts.subtitle
    ? `<p class="cal-subtitle">${escapeHtml(opts.subtitle)}</p>`
    : "";
  return `<!doctype html>
<html lang="${opts.locale}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(opts.title ?? `Calendar ${year}`)}</title>
<style>${getPrintCss(opts)}</style>
</head>
<body>
<div class="cal-page">
${titleHtml}
${subtitleHtml}
${body}
</div>
</body>
</html>`;
}

/** Render one specific month (used by monthly UI). Pure. */
export function renderSingleMonthHtml(
  year: number,
  month: number,
  opts: CalendarOptions,
): string {
  const m = generateMonth(year, month, opts);
  return renderMonthHtml(m, opts);
}

/** Render one specific week (used by weekly UI). Pure. */
export function renderSingleWeekHtml(
  year: number,
  month: number,
  day: number,
  opts: CalendarOptions,
): string {
  const w = generateWeek(year, month, day, opts);
  return renderWeekHtml(w, opts);
}

/** Plain-text rendering of a month (for quick export / debugging). Pure. */
export function renderMonthText(month: CalendarMonth, opts: CalendarOptions): string {
  const wdNames = getWeekdayNames(opts.weekStart, opts.locale);
  const header = (opts.showWeekNumbers ? "Wk " : "") + wdNames.map((n) => n.padEnd(4)).join("");
  const lines = [`${month.name} ${month.year}`, header];
  for (const w of month.weeks) {
    const wn = opts.showWeekNumbers ? String(w.weekNumber ?? "").padEnd(4) : "";
    const row = w.cells.map((c) => {
      if (c.day === null) return "    ";
      const s = String(c.day).padStart(2, " ");
      let suffix = "  ";
      if (c.isHoliday) suffix = "* ";
      else if (c.isToday) suffix = "> ";
      else if (c.isWeekend) suffix = ". ";
      return (s + suffix).padEnd(4);
    }).join("");
    lines.push(wn + row);
  }
  return lines.join("\n");
}

/** Build the .ics file for a year of holidays + custom events. Pure. */
export function exportIcs(year: number, opts: CalendarOptions): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//UnQTools//Printable Calendar//EN"];
  const events: { date: string; title: string }[] = [];
  if (opts.showHolidays) {
    for (const h of computeHolidays(year, opts.holidayPreset)) {
      events.push({ date: h.date, title: h.name });
    }
  }
  for (const e of opts.events ?? []) {
    events.push({ date: e.date, title: e.title });
  }
  events.sort((a, b) => a.date.localeCompare(b.date));
  for (const e of events) {
    const d = parseIsoDate(e.date);
    if (!d) continue;
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const ymd = `${y}${pad2(m)}${pad2(day)}`;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ymd}-${escapeIcs(e.title)}@unqtools`);
    lines.push(`DTSTART;VALUE=DATE:${ymd}`);
    lines.push(`SUMMARY:${escapeIcs(e.title)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export const PRESETS: ReadonlyArray<{ label: string; opts: Partial<CalendarOptions> }> = [
  { label: "A4 Monthly Wall Calendar", opts: { layout: "monthly", paperSize: "a4", orientation: "portrait", theme: "light", showWeekNumbers: true } },
  { label: "Letter Yearly Overview", opts: { layout: "yearly", paperSize: "letter", orientation: "landscape", theme: "light", showWeekNumbers: true } },
  { label: "A3 Year Planner", opts: { layout: "yearly", paperSize: "a3", orientation: "landscape", theme: "blue", showWeekNumbers: true, showDayOfYear: true } },
  { label: "Weekly Planner A4", opts: { layout: "weekly", paperSize: "a4", orientation: "portrait", theme: "green", showNotes: true, weekStart: "monday" } },
  { label: "Multi-Month (Jan-Jun) Tabloid", opts: { layout: "multi-month", paperSize: "tabloid", orientation: "landscape", theme: "sepia", startMonth: 1, endMonth: 6 } },
  { label: "Mini Booklet A5", opts: { layout: "yearly", paperSize: "a5", orientation: "portrait", theme: "dark" } },
];

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:printable-calendar-generator:history";
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
// Shareable URL (fragment-encoded)
// ---------------------------------------------------------------------------

export function buildShareUrl(opts: CalendarOptions, year: number): string {
  const params = new URLSearchParams();
  params.set("y", String(year));
  params.set("layout", opts.layout);
  params.set("ws", opts.weekStart);
  params.set("loc", opts.locale);
  params.set("paper", opts.paperSize);
  params.set("orient", opts.orientation);
  params.set("theme", opts.theme);
  params.set("hol", String(opts.holidayPreset));
  params.set("wn", String(opts.showWeekNumbers));
  params.set("doy", String(opts.showDayOfYear));
  params.set("notes", String(opts.showNotes));
  if (opts.paperSize === "custom" && opts.paperWidthMm) params.set("pw", String(opts.paperWidthMm));
  if (opts.paperSize === "custom" && opts.paperHeightMm) params.set("ph", String(opts.paperHeightMm));
  if (opts.title) params.set("t", opts.title);
  if (opts.subtitle) params.set("st", opts.subtitle);
  if (opts.layout === "multi-month") {
    params.set("sm", String(opts.startMonth ?? 1));
    params.set("em", String(opts.endMonth ?? 12));
  }
  if (opts.layout === "weekly" && opts.weekStartDay) {
    params.set("wd", String(opts.weekStartDay));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { opts: Partial<CalendarOptions>; year?: number } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { opts: {} };
  const params = new URLSearchParams(clean);
  const opts: Partial<CalendarOptions> = {};
  const layout = params.get("layout") as CalendarLayout | null;
  if (layout && LAYOUTS.find((l) => l.value === layout)) opts.layout = layout;
  const ws = params.get("ws") as WeekStart | null;
  if (ws && WEEK_STARTS.find((w) => w.value === ws)) opts.weekStart = ws;
  const loc = params.get("loc") as LocaleCode | null;
  if (loc && LOCALES.find((l) => l.value === loc)) opts.locale = loc;
  const paper = params.get("paper") as PaperSize | null;
  if (paper && PAPER_SIZES.find((p) => p.value === paper)) opts.paperSize = paper;
  const orient = params.get("orient") as Orientation | null;
  if (orient && ORIENTATIONS.find((o) => o.value === orient)) opts.orientation = orient;
  const theme = params.get("theme") as ThemeName | null;
  if (theme && THEMES.find((t) => t.value === theme)) opts.theme = theme;
  const hol = params.get("hol") as HolidayPreset | null;
  if (hol && HOLIDAY_PRESETS.find((h) => h.value === hol)) opts.holidayPreset = hol;
  if (params.get("wn")) opts.showWeekNumbers = params.get("wn") === "true";
  if (params.get("doy")) opts.showDayOfYear = params.get("doy") === "true";
  if (params.get("notes")) opts.showNotes = params.get("notes") === "true";
  const pw = params.get("pw");
  if (pw) opts.paperWidthMm = Number(pw);
  const ph = params.get("ph");
  if (ph) opts.paperHeightMm = Number(ph);
  const t = params.get("t");
  if (t) opts.title = t;
  const st = params.get("st");
  if (st) opts.subtitle = st;
  const sm = params.get("sm");
  if (sm) opts.startMonth = Number(sm);
  const em = params.get("em");
  if (em) opts.endMonth = Number(em);
  const wd = params.get("wd");
  if (wd) opts.weekStartDay = Number(wd);
  const y = params.get("y");
  const year = y ? Number(y) : undefined;
  return { opts, year };
}

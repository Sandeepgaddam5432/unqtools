import { describe, it, expect, beforeEach } from "vitest";
import {
  LOCALES,
  NUMERIC_MODES,
  STYLE_MODES,
  UNIT_ORDER,
  DEFAULT_THRESHOLDS,
  DEFAULT_OPTIONS,
  SAMPLE_DATES,
  MS_PER_SECOND,
  MS_PER_MINUTE,
  MS_PER_HOUR,
  MS_PER_DAY,
  MS_PER_WEEK,
  MS_PER_MONTH,
  MS_PER_YEAR,
  SNIPPET_LIBRARIES,
  parseDateInput,
  toIsoString,
  pickUnit,
  isJustNow,
  formatRelative,
  formatAcrossLocales,
  formatWithUnit,
  computeBreakdown,
  generateIntlSnippet,
  generateLuxonSnippet,
  generateDayJsSnippet,
  generateDateFnsSnippet,
  getSnippet,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Locale,
  type RtfNumeric,
  type RtfStyle,
  type FormatOptions,
  type SnippetLibrary,
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

const NOW = new Date(2025, 0, 15, 12, 0, 0).getTime(); // 2025-01-15T12:00:00 local

describe("relative-time-formatter constants", () => {
  it("exposes 5 locales", () => {
    expect(LOCALES).toHaveLength(5);
    expect(LOCALES.map((l) => l.value)).toEqual(
      expect.arrayContaining(["en", "es", "fr", "de", "ja"]),
    );
  });
  it("exposes 2 numeric modes", () => {
    expect(NUMERIC_MODES).toHaveLength(2);
  });
  it("exposes 3 style modes", () => {
    expect(STYLE_MODES).toHaveLength(3);
  });
  it("exposes 7 units in order", () => {
    expect(UNIT_ORDER).toEqual([
      "second", "minute", "hour", "day", "week", "month", "year",
    ]);
  });
  it("DEFAULT_THRESHOLDS has expected values", () => {
    expect(DEFAULT_THRESHOLDS.justNowSec).toBe(45);
    expect(DEFAULT_THRESHOLDS.minuteSec).toBe(90);
    expect(DEFAULT_THRESHOLDS.hourMin).toBe(45);
    expect(DEFAULT_THRESHOLDS.dayHour).toBe(22);
    expect(DEFAULT_THRESHOLDS.weekDay).toBe(7);
    expect(DEFAULT_THRESHOLDS.monthDay).toBe(26);
    expect(DEFAULT_THRESHOLDS.yearMonth).toBe(11);
  });
  it("DEFAULT_OPTIONS has expected values", () => {
    expect(DEFAULT_OPTIONS.locale).toBe("en");
    expect(DEFAULT_OPTIONS.numeric).toBe("auto");
    expect(DEFAULT_OPTIONS.style).toBe("long");
    expect(DEFAULT_OPTIONS.thresholds).toBe(DEFAULT_THRESHOLDS);
  });
  it("exposes 12 sample dates", () => {
    expect(SAMPLE_DATES.length).toBeGreaterThanOrEqual(10);
    expect(SAMPLE_DATES.some((s) => s.label.includes("ago"))).toBe(true);
    expect(SAMPLE_DATES.some((s) => s.label.includes("in "))).toBe(true);
  });
  it("exposes 4 snippet libraries", () => {
    expect(SNIPPET_LIBRARIES).toHaveLength(4);
    expect(SNIPPET_LIBRARIES.map((l) => l.value)).toEqual(
      expect.arrayContaining(["intl", "luxon", "dayjs", "date-fns"]),
    );
  });
  it("exposes time-unit constants", () => {
    expect(MS_PER_SECOND).toBe(1000);
    expect(MS_PER_MINUTE).toBe(60_000);
    expect(MS_PER_HOUR).toBe(3_600_000);
    expect(MS_PER_DAY).toBe(86_400_000);
    expect(MS_PER_WEEK).toBe(7 * 86_400_000);
    expect(MS_PER_MONTH).toBeCloseTo(30.4375 * 86_400_000, -2);
    expect(MS_PER_YEAR).toBeCloseTo(365.25 * 86_400_000, -2);
  });
});

describe("relative-time-formatter parseDateInput", () => {
  it("accepts a Date object", () => {
    const d = new Date(2025, 0, 15, 12, 0, 0);
    expect(parseDateInput(d)).toBe(d.getTime());
  });
  it("accepts a number timestamp", () => {
    expect(parseDateInput(NOW)).toBe(NOW);
  });
  it("accepts a YYYY-MM-DD string as local midnight", () => {
    const ms = parseDateInput("2025-01-15");
    const d = new Date(ms);
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });
  it("accepts a YYYY-MM-DDTHH:MM:SS string", () => {
    const ms = parseDateInput("2025-01-15T12:30:45");
    const d = new Date(ms);
    expect(d.getFullYear()).toBe(2025);
    expect(d.getHours()).toBe(12);
    expect(d.getMinutes()).toBe(30);
    expect(d.getSeconds()).toBe(45);
  });
  it("accepts a unix-epoch numeric string", () => {
    expect(parseDateInput(String(NOW))).toBe(NOW);
  });
  it("throws on empty string", () => {
    expect(() => parseDateInput("")).toThrow();
  });
  it("throws on invalid string", () => {
    expect(() => parseDateInput("not a date")).toThrow();
  });
  it("throws on null", () => {
    expect(() => parseDateInput(null as unknown as string)).toThrow();
  });
});

describe("relative-time-formatter toIsoString", () => {
  it("formats a timestamp as YYYY-MM-DDTHH:MM:SS", () => {
    const s = toIsoString(new Date(2025, 0, 15, 12, 30, 45).getTime());
    expect(s).toBe("2025-01-15T12:30:45");
  });
  it("returns empty string for NaN", () => {
    expect(toIsoString(NaN)).toBe("");
  });
  it("pads month/day/hour/min/sec", () => {
    const s = toIsoString(new Date(2025, 2, 5, 4, 7, 9).getTime());
    expect(s).toBe("2025-03-05T04:07:09");
  });
});

describe("relative-time-formatter pickUnit", () => {
  it("returns second/0 for just-now zone", () => {
    const r = pickUnit(-10_000);
    expect(r.unit).toBe("second");
    expect(r.value).toBe(0);
  });
  it("returns second/-50 for 50 seconds ago (above justNow threshold)", () => {
    const r = pickUnit(-50_000);
    expect(r.unit).toBe("second");
    expect(r.value).toBe(-50);
  });
  it("returns minute/-2 for 2 minutes ago", () => {
    const r = pickUnit(-120_000);
    expect(r.unit).toBe("minute");
    expect(r.value).toBe(-2);
  });
  it("returns hour/-3 for 3 hours ago", () => {
    const r = pickUnit(-3 * MS_PER_HOUR);
    expect(r.unit).toBe("hour");
    expect(r.value).toBe(-3);
  });
  it("returns day/-5 for 5 days ago", () => {
    const r = pickUnit(-5 * MS_PER_DAY);
    expect(r.unit).toBe("day");
    expect(r.value).toBe(-5);
  });
  it("returns week/-2 for 14 days ago", () => {
    const r = pickUnit(-14 * MS_PER_DAY);
    expect(r.unit).toBe("week");
    expect(r.value).toBe(-2);
  });
  it("returns month for ~3 months ago", () => {
    const r = pickUnit(-90 * MS_PER_DAY);
    expect(r.unit).toBe("month");
    expect(r.value).toBeLessThan(-2);
    expect(r.value).toBeGreaterThan(-4);
  });
  it("returns year for ~2 years ago", () => {
    const r = pickUnit(-730 * MS_PER_DAY);
    expect(r.unit).toBe("year");
    expect(r.value).toBeLessThanOrEqual(-1);
  });
  it("handles future diffs with positive values", () => {
    const r = pickUnit(2 * MS_PER_HOUR);
    expect(r.unit).toBe("hour");
    expect(r.value).toBe(2);
  });
  it("respects custom thresholds", () => {
    const custom = { ...DEFAULT_THRESHOLDS, justNowSec: 5 };
    expect(pickUnit(-10_000, custom).value).toBe(-10);
  });
});

describe("relative-time-formatter isJustNow", () => {
  it("true for 10 seconds", () => {
    expect(isJustNow(-10_000)).toBe(true);
  });
  it("false for 60 seconds", () => {
    expect(isJustNow(-60_000)).toBe(false);
  });
  it("true at exactly threshold", () => {
    expect(isJustNow(-45_000)).toBe(true);
  });
});

describe("relative-time-formatter formatRelative", () => {
  it("emits 'now' for 0 diff in en auto", () => {
    expect(formatRelative(NOW, NOW, { locale: "en", numeric: "auto" })).toBe("now");
  });
  it("emits 'in 0 seconds' for 0 diff in en always", () => {
    expect(formatRelative(NOW, NOW, { locale: "en", numeric: "always" })).toBe("in 0 seconds");
  });
  it("emits '50 seconds ago' in en always (above justNow threshold)", () => {
    expect(formatRelative(NOW - 50_000, NOW, { locale: "en", numeric: "always" })).toBe("50 seconds ago");
  });
  it("emits '2 minutes ago' in en always", () => {
    expect(formatRelative(NOW - 120_000, NOW, { locale: "en", numeric: "always" })).toBe("2 minutes ago");
  });
  it("emits 'in 3 hours' for future in en always", () => {
    expect(formatRelative(NOW + 3 * MS_PER_HOUR, NOW, { locale: "en", numeric: "always" })).toBe("in 3 hours");
  });
  it("emits '5 days ago' in en always", () => {
    expect(formatRelative(NOW - 5 * MS_PER_DAY, NOW, { locale: "en", numeric: "always" })).toBe("5 days ago");
  });
  it("emits 'in 3 days' for future in en always", () => {
    expect(formatRelative(NOW + 3 * MS_PER_DAY, NOW, { locale: "en", numeric: "always" })).toBe("in 3 days");
  });
  it("supports es locale with numeric always", () => {
    expect(formatRelative(NOW - 5 * MS_PER_DAY, NOW, { locale: "es", numeric: "always" })).toBe("hace 5 días");
  });
  it("supports fr locale with numeric always", () => {
    expect(formatRelative(NOW - 5 * MS_PER_DAY, NOW, { locale: "fr", numeric: "always" })).toBe("il y a 5 jours");
  });
  it("supports de locale with numeric always", () => {
    expect(formatRelative(NOW - 5 * MS_PER_DAY, NOW, { locale: "de", numeric: "always" })).toBe("vor 5 Tagen");
  });
  it("supports ja locale with numeric always", () => {
    expect(formatRelative(NOW - 5 * MS_PER_DAY, NOW, { locale: "ja", numeric: "always" })).toBe("5 日前");
  });
  it("accepts Date inputs", () => {
    const d = new Date(NOW - 5 * MS_PER_DAY);
    expect(formatRelative(d, new Date(NOW), { locale: "en", numeric: "always" })).toBe("5 days ago");
  });
  it("accepts YYYY-MM-DD string input", () => {
    const nowIso = "2025-01-15";
    const pastIso = "2025-01-10"; // 5 days earlier
    expect(formatRelative(pastIso, nowIso, { locale: "en", numeric: "always" })).toBe("5 days ago");
  });
  it("uses auto numeric for 'yesterday' in en", () => {
    // 26 hours ago rounds to -1 day with auto → 'yesterday' in en.
    expect(formatRelative(NOW - 26 * MS_PER_HOUR, NOW, { locale: "en", numeric: "auto" })).toBe("yesterday");
  });
  it("uses auto numeric for 'tomorrow' in en", () => {
    expect(formatRelative(NOW + 26 * MS_PER_HOUR, NOW, { locale: "en", numeric: "auto" })).toBe("tomorrow");
  });
  it("honors style: short", () => {
    const out = formatRelative(NOW - 5 * MS_PER_HOUR, NOW, { locale: "en", numeric: "always", style: "short" });
    expect(out).toContain("5");
    expect(out.toLowerCase()).toContain("hr");
  });
  it("honors style: narrow", () => {
    const out = formatRelative(NOW - 5 * MS_PER_DAY, NOW, { locale: "en", numeric: "always", style: "narrow" });
    expect(out).toContain("5");
    // narrow in en renders '5d ago'
    expect(out.toLowerCase()).toContain("d");
  });
  it("returns a non-empty string for 1-year-ago diff", () => {
    const out = formatRelative(NOW - 400 * MS_PER_DAY, NOW, { locale: "en", numeric: "always" });
    expect(out.length).toBeGreaterThan(0);
    expect(out).toContain("year");
  });
});

describe("relative-time-formatter formatAcrossLocales", () => {
  it("returns 5 phrases by default", () => {
    const arr = formatAcrossLocales(NOW - 5 * MS_PER_DAY, LOCALES.map((l) => l.value), NOW, { numeric: "always" });
    expect(arr).toHaveLength(5);
    expect(arr.map((x) => x.locale).sort()).toEqual(["de", "en", "es", "fr", "ja"]);
  });
  it("returns only requested locales", () => {
    const arr = formatAcrossLocales(NOW - 5 * MS_PER_DAY, ["en", "ja"], NOW, { numeric: "always" });
    expect(arr).toHaveLength(2);
    expect(arr[0].locale).toBe("en");
    expect(arr[0].phrase).toBe("5 days ago");
    expect(arr[1].locale).toBe("ja");
    expect(arr[1].phrase).toBe("5 日前");
  });
  it("each phrase is a non-empty string", () => {
    const arr = formatAcrossLocales(NOW - 3 * MS_PER_HOUR, LOCALES.map((l) => l.value), NOW);
    for (const p of arr) {
      expect(typeof p.phrase).toBe("string");
      expect(p.phrase.length).toBeGreaterThan(0);
    }
  });
});

describe("relative-time-formatter formatWithUnit", () => {
  it("formats -1 day in en auto as 'yesterday'", () => {
    expect(formatWithUnit(-1, "day", { locale: "en", numeric: "auto" })).toBe("yesterday");
  });
  it("formats +1 day in en auto as 'tomorrow'", () => {
    expect(formatWithUnit(1, "day", { locale: "en", numeric: "auto" })).toBe("tomorrow");
  });
  it("formats -2 day in en always as '2 days ago'", () => {
    expect(formatWithUnit(-2, "day", { locale: "en", numeric: "always" })).toBe("2 days ago");
  });
  it("formats +3 hour in en always as 'in 3 hours'", () => {
    expect(formatWithUnit(3, "hour", { locale: "en", numeric: "always" })).toBe("in 3 hours");
  });
});

describe("relative-time-formatter computeBreakdown", () => {
  it("returns direction 'past' for past diff", () => {
    const b = computeBreakdown(NOW - 5 * MS_PER_DAY, NOW);
    expect(b.direction).toBe("past");
  });
  it("returns direction 'future' for future diff", () => {
    const b = computeBreakdown(NOW + 5 * MS_PER_DAY, NOW);
    expect(b.direction).toBe("future");
  });
  it("returns direction 'now' for zero diff", () => {
    const b = computeBreakdown(NOW, NOW);
    expect(b.direction).toBe("now");
  });
  it("computes totalDays correctly", () => {
    const b = computeBreakdown(NOW - 5 * MS_PER_DAY, NOW);
    expect(b.totalDays).toBeCloseTo(5, 5);
  });
  it("computes totalHours correctly", () => {
    const b = computeBreakdown(NOW - 3 * MS_PER_HOUR, NOW);
    expect(b.totalHours).toBeCloseTo(3, 5);
  });
  it("breaks down 1 day 2 hours 3 minutes", () => {
    const diff = MS_PER_DAY + 2 * MS_PER_HOUR + 3 * MS_PER_MINUTE;
    const b = computeBreakdown(NOW - diff, NOW);
    expect(b.days).toBe(1);
    expect(b.hours).toBe(2);
    expect(b.minutes).toBe(3);
    expect(b.seconds).toBe(0);
  });
  it("breaks down years+months+weeks+days", () => {
    // ~400 days ≈ 1 year + 35 days ≈ 1y 1mo 0w 4d (approx; allow slack)
    const diff = 400 * MS_PER_DAY;
    const b = computeBreakdown(NOW - diff, NOW);
    expect(b.years).toBe(1);
    expect(b.months).toBeGreaterThanOrEqual(0);
    expect(b.months).toBeLessThanOrEqual(2);
    expect(b.totalDays).toBeCloseTo(400, 5);
  });
  it("totalMs is signed", () => {
    expect(computeBreakdown(NOW - 1000, NOW).totalMs).toBe(-1000);
    expect(computeBreakdown(NOW + 1000, NOW).totalMs).toBe(1000);
  });
});

describe("relative-time-formatter snippet generators", () => {
  it("Intl snippet contains the constructor and locale", () => {
    const s = generateIntlSnippet(DEFAULT_OPTIONS);
    expect(s).toContain("Intl.RelativeTimeFormat");
    expect(s).toContain('"en"');
    expect(s).toContain("numeric");
    expect(s).toContain("style");
  });
  it("Intl snippet shows example outputs", () => {
    const s = generateIntlSnippet({ ...DEFAULT_OPTIONS, numeric: "always" });
    expect(s).toContain("2 days ago");
    expect(s).toContain("in 3 hours");
  });
  it("Luxon snippet contains toRelative and locale", () => {
    const s = generateLuxonSnippet(DEFAULT_OPTIONS);
    expect(s).toContain("DateTime");
    expect(s).toContain("toRelative");
    expect(s).toContain('"en"');
  });
  it("Day.js snippet contains fromNow and relativeTime plugin", () => {
    const s = generateDayJsSnippet(DEFAULT_OPTIONS);
    expect(s).toContain("dayjs");
    expect(s).toContain("fromNow");
    expect(s).toContain("relativeTime");
  });
  it("date-fns snippet contains formatDistance and locale", () => {
    const s = generateDateFnsSnippet(DEFAULT_OPTIONS);
    expect(s).toContain("formatDistance");
    expect(s).toContain("enUS");
    expect(s).toContain("addSuffix");
  });
  it("getSnippet dispatches to all 4 libraries", () => {
    expect(getSnippet("intl", DEFAULT_OPTIONS)).toContain("Intl");
    expect(getSnippet("luxon", DEFAULT_OPTIONS)).toContain("DateTime");
    expect(getSnippet("dayjs", DEFAULT_OPTIONS)).toContain("dayjs");
    expect(getSnippet("date-fns", DEFAULT_OPTIONS)).toContain("formatDistance");
  });
  it("snippet adapts to es locale", () => {
    const opts: FormatOptions = { ...DEFAULT_OPTIONS, locale: "es" };
    expect(generateIntlSnippet(opts)).toContain('"es"');
    expect(generateDateFnsSnippet(opts)).toContain("es");
  });
});

describe("relative-time-formatter history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, inputIso: "2025-01-10T00:00:00", nowIso: "2025-01-15T00:00:00",
      phrase: "5 days ago", locale: "en", numeric: "always", style: "long",
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].phrase).toBe("5 days ago");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, inputIso: "x", nowIso: "y", phrase: `p${i}`,
        locale: "en", numeric: "always", style: "long",
      });
    }
    expect(loadHistory()).toHaveLength(20);
    // Most recent first
    expect(loadHistory()[0].ts).toBe(24);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, inputIso: "x", nowIso: "y", phrase: "p",
      locale: "en", numeric: "always", style: "long",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("relative-time-formatter shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(
      { locale: "es", numeric: "always", style: "short", thresholds: DEFAULT_THRESHOLDS },
      "2025-01-10",
      "2025-01-15",
    );
    expect(url).toContain("l=es");
    expect(url).toContain("n=always");
    expect(url).toContain("s=short");
    expect(url).toContain("d=2025-01-10");
    expect(url).toContain("r=2025-01-15");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const { options, inputIso, nowIso } = parseShareUrl(
      "l=es&n=always&s=short&t=45,90,45,22,7,26,11&d=2025-01-10&r=2025-01-15",
    );
    expect(options.locale).toBe("es");
    expect(options.numeric).toBe("always");
    expect(options.style).toBe("short");
    expect(options.thresholds.justNowSec).toBe(45);
    expect(options.thresholds.yearMonth).toBe(11);
    expect(inputIso).toBe("2025-01-10");
    expect(nowIso).toBe("2025-01-15");
  });
  it("handles empty hash with defaults", () => {
    const { options, inputIso, nowIso } = parseShareUrl("");
    expect(options.locale).toBe("en");
    expect(options.numeric).toBe("auto");
    expect(options.style).toBe("long");
    expect(options.thresholds).toEqual(DEFAULT_THRESHOLDS);
    expect(inputIso).toBe("");
    expect(nowIso).toBe("");
  });
  it("filters invalid locale", () => {
    const { options } = parseShareUrl("l=zh");
    expect(options.locale).toBe("en");
  });
  it("filters invalid numeric", () => {
    const { options } = parseShareUrl("n=maybe");
    expect(options.numeric).toBe("auto");
  });
  it("round-trips full options", () => {
    const opts: FormatOptions = {
      locale: "ja", numeric: "always", style: "narrow",
      thresholds: { justNowSec: 5, minuteSec: 60, hourMin: 30, dayHour: 20, weekDay: 6, monthDay: 25, yearMonth: 10 },
    };
    const url = buildShareUrl(opts, "2025-01-01", "2025-02-01");
    const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : url.replace(/^\?/, "");
    const { options: parsed, inputIso, nowIso } = parseShareUrl(hash);
    expect(parsed.locale).toBe("ja");
    expect(parsed.numeric).toBe("always");
    expect(parsed.style).toBe("narrow");
    expect(parsed.thresholds.justNowSec).toBe(5);
    expect(parsed.thresholds.yearMonth).toBe(10);
    expect(inputIso).toBe("2025-01-01");
    expect(nowIso).toBe("2025-02-01");
  });
});

// Suppress unused-import lint
export type _Unused = Locale | RtfNumeric | RtfStyle | SnippetLibrary;

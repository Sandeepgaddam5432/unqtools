import { describe, it, expect, beforeEach } from "vitest";
import {
  OUTPUT_FORMATS,
  GRANULARITIES,
  TIMEZONES,
  FORMAT_PATTERNS,
  DEFAULT_OPTIONS,
  MAX_COUNT,
  SAMPLE_SEED,
  mulberry32,
  createPrng,
  nextIntInclusive,
  nextTimestamp,
  validateRange,
  isWeekend,
  isBusinessDay,
  filterBusinessDays,
  toDayBucket,
  toHourBucket,
  toMinuteBucket,
  toSecondBucket,
  sortAsc,
  sortDesc,
  uniqueTimestamps,
  applyGranularity,
  getParts,
  strftime,
  toRelative,
  formatDate,
  generateBatch,
  computeStats,
  renderText,
  renderCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type GenerateOptions,
  type OutputFormat,
  type Granularity,
  type SortMode,
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

describe("random-date-time constants", () => {
  it("exposes 8 output formats", () => {
    expect(OUTPUT_FORMATS).toHaveLength(8);
    expect(OUTPUT_FORMATS.map((o) => o.value)).toEqual(
      expect.arrayContaining(["iso", "unix-s", "unix-ms", "locale", "custom", "relative", "date-only", "time-only"]),
    );
  });
  it("exposes 3 granularities", () => {
    expect(GRANULARITIES).toHaveLength(3);
    expect(GRANULARITIES.map((g) => g.value)).toEqual(
      expect.arrayContaining(["datetime", "date", "time"]),
    );
  });
  it("exposes at least 10 timezones including UTC", () => {
    expect(TIMEZONES.length).toBeGreaterThanOrEqual(10);
    expect(TIMEZONES).toContain("UTC");
  });
  it("exposes at least 5 strftime patterns", () => {
    expect(FORMAT_PATTERNS.length).toBeGreaterThanOrEqual(5);
  });
  it("has sensible defaults", () => {
    expect(DEFAULT_OPTIONS.count).toBeGreaterThan(0);
    expect(DEFAULT_OPTIONS.endMs).toBeGreaterThan(DEFAULT_OPTIONS.startMs);
    expect(DEFAULT_OPTIONS.format).toBe("iso");
    expect(DEFAULT_OPTIONS.timezone).toBe("UTC");
    expect(MAX_COUNT).toBeGreaterThanOrEqual(1000);
    expect(SAMPLE_SEED).toBeGreaterThan(0);
  });
});

describe("random-date-time PRNG", () => {
  it("mulberry32 reproduces the same sequence for the same seed", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });
  it("mulberry32 returns floats in [0, 1)", () => {
    const p = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const v = p.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it("nextIntInclusive returns integers in range", () => {
    const p = createPrng(42);
    for (let i = 0; i < 50; i++) {
      const v = nextIntInclusive(p, 10, 20);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThanOrEqual(20);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
  it("nextIntInclusive swaps inverted ranges", () => {
    const p = createPrng(7);
    const v = nextIntInclusive(p, 100, 50);
    expect(v).toBeGreaterThanOrEqual(50);
    expect(v).toBeLessThanOrEqual(100);
  });
});

describe("random-date-time nextTimestamp", () => {
  it("produces timestamps within the range", () => {
    const p = createPrng(99);
    const start = Date.UTC(2020, 0, 1);
    const end = Date.UTC(2021, 0, 1);
    for (let i = 0; i < 100; i++) {
      const t = nextTimestamp(p, start, end);
      expect(t).toBeGreaterThanOrEqual(start);
      expect(t).toBeLessThanOrEqual(end);
    }
  });
  it("swaps inverted ranges", () => {
    const p = createPrng(7);
    const start = Date.UTC(2020, 0, 1);
    const end = Date.UTC(2021, 0, 1);
    const t = nextTimestamp(p, end, start); // swapped
    expect(t).toBeGreaterThanOrEqual(start);
    expect(t).toBeLessThanOrEqual(end);
  });
});

describe("random-date-time validateRange", () => {
  it("accepts a normal range", () => {
    const v = validateRange(1000, 2000);
    expect(v.ok).toBe(true);
    expect(v.swapped).toBe(false);
    expect(v.startMs).toBe(1000);
    expect(v.endMs).toBe(2000);
  });
  it("swaps an inverted range", () => {
    const v = validateRange(2000, 1000);
    expect(v.ok).toBe(true);
    expect(v.swapped).toBe(true);
    expect(v.startMs).toBe(1000);
    expect(v.endMs).toBe(2000);
  });
  it("rejects an empty range", () => {
    const v = validateRange(1500, 1500);
    expect(v.ok).toBe(false);
    expect(v.error).toBeTruthy();
  });
  it("rejects NaN inputs", () => {
    const v = validateRange(NaN, 1000);
    expect(v.ok).toBe(false);
  });
});

describe("random-date-time weekend/business-day helpers", () => {
  it("flags Saturday as weekend in UTC", () => {
    // 2024-01-06 is a Saturday
    const sat = Date.UTC(2024, 0, 6, 12, 0, 0);
    expect(isWeekend(sat, "UTC")).toBe(true);
    expect(isBusinessDay(sat, "UTC")).toBe(false);
  });
  it("flags Sunday as weekend in UTC", () => {
    // 2024-01-07 is a Sunday
    const sun = Date.UTC(2024, 0, 7, 12, 0, 0);
    expect(isWeekend(sun, "UTC")).toBe(true);
  });
  it("treats Monday as a business day", () => {
    // 2024-01-08 is a Monday
    const mon = Date.UTC(2024, 0, 8, 12, 0, 0);
    expect(isWeekend(mon, "UTC")).toBe(false);
    expect(isBusinessDay(mon, "UTC")).toBe(true);
  });
  it("filterBusinessDays removes weekends", () => {
    // 2024-01-06 (Sat), 2024-01-07 (Sun), 2024-01-08 (Mon)
    const ts = [
      Date.UTC(2024, 0, 6, 12),
      Date.UTC(2024, 0, 7, 12),
      Date.UTC(2024, 0, 8, 12),
    ];
    const filtered = filterBusinessDays(ts, "UTC");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toBe(ts[2]);
  });
  it("falls back to UTC for invalid timezone", () => {
    const sat = Date.UTC(2024, 0, 6, 12);
    expect(isWeekend(sat, "Bogus/Zone")).toBe(true);
  });
});

describe("random-date-time bucket helpers", () => {
  it("toDayBucket rounds to UTC midnight", () => {
    const t = Date.UTC(2024, 5, 15, 13, 45, 30);
    expect(toDayBucket(t)).toBe(Date.UTC(2024, 5, 15));
  });
  it("toHourBucket rounds to the start of the hour", () => {
    const t = Date.UTC(2024, 5, 15, 13, 45, 30);
    expect(toHourBucket(t)).toBe(Date.UTC(2024, 5, 15, 13));
  });
  it("toMinuteBucket rounds to the start of the minute", () => {
    const t = Date.UTC(2024, 5, 15, 13, 45, 30);
    expect(toMinuteBucket(t)).toBe(Date.UTC(2024, 5, 15, 13, 45));
  });
  it("toSecondBucket rounds to the start of the second", () => {
    const t = Date.UTC(2024, 5, 15, 13, 45, 30, 500);
    expect(toSecondBucket(t)).toBe(Date.UTC(2024, 5, 15, 13, 45, 30));
  });
});

describe("random-date-time sort + unique", () => {
  it("sortAsc sorts ascending", () => {
    expect(sortAsc([3, 1, 2])).toEqual([1, 2, 3]);
  });
  it("sortDesc sorts descending", () => {
    expect(sortDesc([1, 3, 2])).toEqual([3, 2, 1]);
  });
  it("uniqueTimestamps removes duplicates", () => {
    expect(uniqueTimestamps([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
  });
  it("sortAsc returns a new array (does not mutate)", () => {
    const a = [3, 1, 2];
    const b = sortAsc(a);
    expect(a).toEqual([3, 1, 2]);
    expect(b).toEqual([1, 2, 3]);
  });
});

describe("random-date-time applyGranularity", () => {
  it("date granularity buckets to midnight", () => {
    const t = Date.UTC(2024, 5, 15, 13, 45, 30);
    expect(applyGranularity(t, "date", Date.UTC(2020, 0, 1))).toBe(Date.UTC(2024, 5, 15));
  });
  it("time granularity moves HH:MM:SS onto base date", () => {
    const t = Date.UTC(2024, 5, 15, 13, 45, 30);
    const base = Date.UTC(2020, 0, 1);
    expect(applyGranularity(t, "time", base)).toBe(Date.UTC(2020, 0, 1, 13, 45, 30));
  });
  it("datetime granularity is a passthrough", () => {
    const t = Date.UTC(2024, 5, 15, 13, 45, 30);
    expect(applyGranularity(t, "datetime", Date.UTC(2020, 0, 1))).toBe(t);
  });
});

describe("random-date-time strftime", () => {
  it("formats %Y-%m-%d %H:%M:%S", () => {
    const t = Date.UTC(2025, 0, 15, 13, 45, 0);
    expect(strftime(t, "%Y-%m-%d %H:%M:%S", "UTC")).toBe("2025-01-15 13:45:00");
  });
  it("formats %Y/%m/%d", () => {
    const t = Date.UTC(2025, 0, 15);
    expect(strftime(t, "%Y/%m/%d", "UTC")).toBe("2025/01/15");
  });
  it("formats %d-%b-%Y", () => {
    const t = Date.UTC(2025, 0, 15);
    expect(strftime(t, "%d-%b-%Y", "UTC")).toBe("15-Jan-2025");
  });
  it("formats %j day of %Y", () => {
    // 2025-01-15 is the 15th day of the year
    const t = Date.UTC(2025, 0, 15);
    expect(strftime(t, "%j day of %Y", "UTC")).toBe("015 day of 2025");
  });
  it("formats %A weekday long", () => {
    // 2025-01-15 is a Wednesday
    const t = Date.UTC(2025, 0, 15);
    expect(strftime(t, "%A", "UTC")).toBe("Wednesday");
  });
  it("formats %B month long", () => {
    const t = Date.UTC(2025, 0, 15);
    expect(strftime(t, "%B", "UTC")).toBe("January");
  });
  it("formats %I:%M %p (12-hour)", () => {
    const t = Date.UTC(2025, 0, 15, 13, 45);
    expect(strftime(t, "%I:%M %p", "UTC")).toBe("01:45 PM");
  });
  it("escapes %% as literal %", () => {
    const t = Date.UTC(2025, 0, 15);
    expect(strftime(t, "100%%", "UTC")).toBe("100%");
  });
  it("handles leap-year day-of-year", () => {
    // 2024-03-01 is the 61st day of leap year 2024
    const t = Date.UTC(2024, 2, 1);
    expect(strftime(t, "%j", "UTC")).toBe("061");
  });
  it("unknown token passes through", () => {
    const t = Date.UTC(2025, 0, 15);
    expect(strftime(t, "%Q", "UTC")).toBe("%Q");
  });
});

describe("random-date-time toRelative", () => {
  it("formats seconds ago", () => {
    const now = Date.UTC(2025, 0, 1, 12, 0, 0);
    const t = now - 30_000;
    expect(toRelative(t, now)).toBe("30 seconds ago");
  });
  it("formats minutes ago", () => {
    const now = Date.UTC(2025, 0, 1, 12, 0, 0);
    const t = now - 5 * 60_000;
    expect(toRelative(t, now)).toBe("5 minutes ago");
  });
  it("formats hours ago", () => {
    const now = Date.UTC(2025, 0, 1, 12, 0, 0);
    const t = now - 3 * 3_600_000;
    expect(toRelative(t, now)).toBe("3 hours ago");
  });
  it("formats days ago", () => {
    const now = Date.UTC(2025, 0, 1, 12, 0, 0);
    const t = now - 2 * 86_400_000;
    expect(toRelative(t, now)).toBe("2 days ago");
  });
  it("formats future dates with 'in'", () => {
    const now = Date.UTC(2025, 0, 1, 12, 0, 0);
    const t = now + 3 * 3_600_000;
    expect(toRelative(t, now)).toBe("in 3 hours");
  });
  it("formats 'just now' for zero difference", () => {
    const now = Date.UTC(2025, 0, 1, 12, 0, 0);
    expect(toRelative(now, now)).toBe("just now");
  });
  it("uses singular for quantity 1", () => {
    const now = Date.UTC(2025, 0, 1, 12, 0, 0);
    const t = now - 3_600_000;
    expect(toRelative(t, now)).toBe("1 hour ago");
  });
});

describe("random-date-time formatDate", () => {
  it("iso format returns ISO string", () => {
    const t = Date.UTC(2025, 0, 15, 13, 45, 0);
    expect(formatDate(t, "iso", "UTC", "")).toBe("2025-01-15T13:45:00.000Z");
  });
  it("unix-s format returns seconds", () => {
    const t = Date.UTC(2025, 0, 15, 13, 45, 0);
    expect(formatDate(t, "unix-s", "UTC", "")).toBe(String(Math.floor(t / 1000)));
  });
  it("unix-ms format returns milliseconds", () => {
    const t = Date.UTC(2025, 0, 15, 13, 45, 0);
    expect(formatDate(t, "unix-ms", "UTC", "")).toBe(String(t));
  });
  it("custom format uses strftime", () => {
    const t = Date.UTC(2025, 0, 15, 13, 45, 0);
    expect(formatDate(t, "custom", "UTC", "%Y-%m-%d")).toBe("2025-01-15");
  });
  it("relative format uses toRelative with now", () => {
    const t = Date.UTC(2025, 0, 15, 13, 45, 0);
    expect(formatDate(t, "relative", "UTC", "", t + 60_000)).toBe("1 minute ago");
  });
  it("date-only format returns YYYY-MM-DD-ish string", () => {
    const t = Date.UTC(2025, 0, 15);
    const out = formatDate(t, "date-only", "UTC", "");
    expect(out).toContain("2025");
    expect(out).toContain("01");
    expect(out).toContain("15");
  });
  it("time-only format returns HH:MM:SS-ish string", () => {
    const t = Date.UTC(2025, 0, 15, 13, 45, 30);
    const out = formatDate(t, "time-only", "UTC", "");
    expect(out).toContain("13");
    expect(out).toContain("45");
  });
  it("locale format does not throw", () => {
    const t = Date.UTC(2025, 0, 15, 13, 45, 0);
    expect(() => formatDate(t, "locale", "UTC", "")).not.toThrow();
  });
  it("falls back to UTC for invalid timezone", () => {
    const t = Date.UTC(2025, 0, 15, 13, 45, 0);
    expect(() => formatDate(t, "locale", "Bogus/Zone", "")).not.toThrow();
  });
});

describe("random-date-time getParts", () => {
  it("returns an array of parts", () => {
    const t = Date.UTC(2025, 0, 15, 13, 45, 0);
    const parts = getParts(t, "UTC");
    expect(Array.isArray(parts)).toBe(true);
    expect(parts.length).toBeGreaterThan(0);
  });
});

describe("random-date-time generateBatch", () => {
  const baseOpts: GenerateOptions = {
    seed: 42,
    count: 10,
    startMs: Date.UTC(2020, 0, 1),
    endMs: Date.UTC(2021, 0, 1),
    format: "iso",
    customPattern: "%Y-%m-%d",
    timezone: "UTC",
    granularity: "datetime",
    businessDaysOnly: false,
    unique: false,
    sort: "none",
  };

  it("produces the requested count", () => {
    const r = generateBatch(baseOpts);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.formatted).toHaveLength(10);
      expect(r.raw).toHaveLength(10);
    }
  });
  it("returns error for count <= 0", () => {
    const r = generateBatch({ ...baseOpts, count: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/greater than 0/i);
  });
  it("returns error for count > MAX_COUNT", () => {
    const r = generateBatch({ ...baseOpts, count: MAX_COUNT + 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/exceeds maximum/i);
  });
  it("returns error for empty range", () => {
    const r = generateBatch({ ...baseOpts, startMs: 1000, endMs: 1000 });
    expect(r.ok).toBe(false);
  });
  it("swaps inverted range", () => {
    const r = generateBatch({ ...baseOpts, startMs: Date.UTC(2021, 0, 1), endMs: Date.UTC(2020, 0, 1) });
    expect(r.ok).toBe(true);
  });
  it("is reproducible for same seed", () => {
    const a = generateBatch(baseOpts);
    const b = generateBatch(baseOpts);
    expect(a).toEqual(b);
  });
  it("produces different output for different seed", () => {
    const a = generateBatch(baseOpts);
    const b = generateBatch({ ...baseOpts, seed: 999 });
    if (a.ok && b.ok) {
      expect(a.raw).not.toEqual(b.raw);
    }
  });
  it("respects business-days-only filter (no weekends in UTC)", () => {
    const r = generateBatch({ ...baseOpts, count: 50, businessDaysOnly: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      for (const ms of r.raw) {
        expect(isWeekend(ms, "UTC")).toBe(false);
      }
    }
  });
  it("respects sort ascending", () => {
    const r = generateBatch({ ...baseOpts, sort: "asc" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      for (let i = 1; i < r.raw.length; i++) {
        expect(r.raw[i]).toBeGreaterThanOrEqual(r.raw[i - 1]);
      }
    }
  });
  it("respects sort descending", () => {
    const r = generateBatch({ ...baseOpts, sort: "desc" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      for (let i = 1; i < r.raw.length; i++) {
        expect(r.raw[i]).toBeLessThanOrEqual(r.raw[i - 1]);
      }
    }
  });
  it("respects unique mode", () => {
    const r = generateBatch({ ...baseOpts, count: 50, unique: true, granularity: "datetime" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const set = new Set(r.raw);
      expect(set.size).toBe(r.raw.length);
    }
  });
  it("rejects unique count exceeding the available range", () => {
    // Tiny range: 5 seconds, asking for 10 unique second-buckets.
    const r = generateBatch({
      ...baseOpts,
      startMs: Date.UTC(2024, 0, 1, 0, 0, 0),
      endMs: Date.UTC(2024, 0, 1, 0, 0, 4),
      count: 10,
      unique: true,
      granularity: "datetime",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/unique/i);
  });
  it("respects date-only granularity (all at midnight)", () => {
    const r = generateBatch({ ...baseOpts, granularity: "date", count: 20 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      for (const ms of r.raw) {
        expect(new Date(ms).getUTCHours()).toBe(0);
        expect(new Date(ms).getUTCMinutes()).toBe(0);
        expect(new Date(ms).getUTCSeconds()).toBe(0);
      }
    }
  });
  it("formats output according to the chosen format", () => {
    const r = generateBatch({ ...baseOpts, format: "unix-s" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      for (const f of r.formatted) {
        expect(f).toMatch(/^\d+$/);
      }
    }
  });
  it("includes stats with min/max/span", () => {
    const r = generateBatch(baseOpts);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.stats.count).toBe(10);
      expect(r.stats.minMs).toBeLessThanOrEqual(r.stats.maxMs);
      expect(r.stats.spanMs).toBeGreaterThanOrEqual(0);
      expect(r.stats.spanDays).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("random-date-time computeStats", () => {
  it("returns zero stats for empty array", () => {
    const s = computeStats([]);
    expect(s.count).toBe(0);
    expect(s.spanMs).toBe(0);
  });
  it("computes min/max/span correctly", () => {
    const arr = [1000, 3000, 2000];
    const s = computeStats(arr);
    expect(s.minMs).toBe(1000);
    expect(s.maxMs).toBe(3000);
    expect(s.spanMs).toBe(2000);
    expect(s.spanDays).toBeCloseTo(2000 / 86_400_000);
  });
});

describe("random-date-time renderers", () => {
  const formatted = ["a", "b", "c"];
  const raw = [1, 2, 3];

  it("renderText joins with newline", () => {
    expect(renderText(formatted)).toBe("a\nb\nc");
  });
  it("renderText returns empty string for empty input", () => {
    expect(renderText([])).toBe("");
  });
  it("renderCsv includes a header row", () => {
    const csv = renderCsv([], []);
    expect(csv).toContain("index,value,epoch_ms");
  });
  it("renderCsv emits one row per value", () => {
    const csv = renderCsv(formatted, raw);
    expect(csv.split("\n").length).toBe(4); // header + 3 rows
  });
  it("renderCsv escapes commas", () => {
    const csv = renderCsv(["a,b", "c"], [1, 2]);
    expect(csv).toContain('"a,b"');
  });
  it("renderJson produces valid JSON", () => {
    const json = renderJson(formatted, raw);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].value).toBe("a");
    expect(parsed[0].epoch_ms).toBe(1);
  });
});

describe("random-date-time history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      seed: 42,
      count: 10,
      startMs: 1000,
      endMs: 2000,
      format: "iso",
      preview: "2025-01-01T00:00:00.000Z",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        seed: i,
        count: 1,
        startMs: 1000,
        endMs: 2000,
        format: "iso",
        preview: "x",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, seed: 1, count: 1, startMs: 1, endMs: 2, format: "iso", preview: "x",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("random-date-time shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(DEFAULT_OPTIONS);
    expect(url).toContain("seed=");
    expect(url).toContain("n=");
    expect(url).toContain("f=iso");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("round-trips options through buildShareUrl + parseShareUrl", () => {
    const opts: GenerateOptions = {
      seed: 7777,
      count: 25,
      startMs: Date.UTC(2022, 0, 1),
      endMs: Date.UTC(2024, 0, 1),
      format: "custom",
      customPattern: "%Y-%m-%d %H:%M:%S",
      timezone: "America/New_York",
      granularity: "datetime",
      businessDaysOnly: true,
      unique: true,
      sort: "asc",
    };
    const url = buildShareUrl(opts);
    const parsed = parseShareUrl(url);
    expect(parsed.seed).toBe(opts.seed);
    expect(parsed.count).toBe(opts.count);
    expect(parsed.startMs).toBe(opts.startMs);
    expect(parsed.endMs).toBe(opts.endMs);
    expect(parsed.format).toBe(opts.format);
    expect(parsed.customPattern).toBe(opts.customPattern);
    expect(parsed.timezone).toBe(opts.timezone);
    expect(parsed.granularity).toBe(opts.granularity);
    expect(parsed.businessDaysOnly).toBe(opts.businessDaysOnly);
    expect(parsed.unique).toBe(opts.unique);
    expect(parsed.sort).toBe(opts.sort);
  });
  it("parses empty hash to defaults", () => {
    const parsed = parseShareUrl("");
    expect(parsed).toEqual(DEFAULT_OPTIONS);
  });
  it("filters unknown enum values", () => {
    const parsed = parseShareUrl("f=bogus&g=bogus&so=bogus");
    expect(parsed.format).toBe(DEFAULT_OPTIONS.format);
    expect(parsed.granularity).toBe(DEFAULT_OPTIONS.granularity);
    expect(parsed.sort).toBe(DEFAULT_OPTIONS.sort);
  });
  it("clamps count > MAX_COUNT to defaults", () => {
    const parsed = parseShareUrl(`n=${MAX_COUNT + 5}`);
    expect(parsed.count).toBe(DEFAULT_OPTIONS.count);
  });
});

// Suppress unused-import lint for type-only imports
export type _Unused = OutputFormat | Granularity | SortMode;

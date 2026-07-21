import { describe, it, expect, beforeEach } from "vitest";
import {
  CRON_PRESETS,
  FIELD_RANGES,
  FIELD_LABELS,
  MODE_LABELS,
  MONTH_NAMES,
  WEEKDAY_NAMES,
  SYNTAX_LABELS,
  defaultField,
  defaultConfig,
  parseField,
  renderField,
  buildExpression,
  parseExpression,
  applyPreset,
  validateConfig,
  validateExpression,
  expandField,
  describeConfig,
  describeExpression,
  computeNextRuns,
  computeNextRunsFromExpression,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CronConfig,
  type CronFieldName,
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

describe("crontab constants", () => {
  it("has 15+ presets", () => {
    expect(CRON_PRESETS.length).toBeGreaterThanOrEqual(15);
  });
  it("includes the required presets (every-5-min, hourly, daily, weekly, monthly)", () => {
    const ids = CRON_PRESETS.map((p) => p.id);
    for (const id of ["every-5-minutes", "hourly", "daily-midnight", "weekly-sunday", "monthly-first"]) {
      expect(ids).toContain(id);
    }
  });
  it("every preset has a valid 5-field unix expression", () => {
    for (const p of CRON_PRESETS) {
      if (p.syntax === "unix") {
        expect(p.expression.split(" ")).toHaveLength(5);
      }
    }
  });
  it("has 5 cron fields with ranges and labels", () => {
    expect(Object.keys(FIELD_RANGES)).toHaveLength(5);
    expect(Object.keys(FIELD_LABELS)).toHaveLength(5);
    expect(FIELD_RANGES.minute).toEqual({ min: 0, max: 59 });
    expect(FIELD_RANGES.dayOfMonth).toEqual({ min: 1, max: 31 });
  });
  it("has 5 cron modes", () => {
    expect(Object.keys(MODE_LABELS)).toHaveLength(5);
  });
  it("has 12 month names and 7 weekday names", () => {
    expect(MONTH_NAMES).toHaveLength(12);
    expect(WEEKDAY_NAMES).toHaveLength(7);
    expect(MONTH_NAMES[0]).toBe("JAN");
    expect(WEEKDAY_NAMES[0]).toBe("SUN");
  });
  it("has 3 syntax modes (unix, quartz, aws)", () => {
    expect(Object.keys(SYNTAX_LABELS)).toHaveLength(3);
    expect(SYNTAX_LABELS.unix).toContain("5-field");
    expect(SYNTAX_LABELS.aws).toContain("EventBridge");
  });
});

describe("crontab defaultField / defaultConfig", () => {
  it("defaultField returns every-mode config", () => {
    expect(defaultField().mode).toBe("every");
  });
  it("defaultConfig returns unix 5-field with all every", () => {
    const cfg = defaultConfig();
    expect(cfg.syntax).toBe("unix");
    expect(cfg.minute.mode).toBe("every");
    expect(cfg.hour.mode).toBe("every");
    expect(cfg.dayOfMonth.mode).toBe("every");
    expect(cfg.month.mode).toBe("every");
    expect(cfg.dayOfWeek.mode).toBe("every");
  });
  it("defaultConfig(quartz) includes seconds", () => {
    const cfg = defaultConfig("quartz");
    expect(cfg.syntax).toBe("quartz");
    expect(cfg.seconds).toBeDefined();
    expect(cfg.seconds!.mode).toBe("every");
  });
});

describe("crontab parseField", () => {
  it("parses *", () => {
    expect(parseField("*", "minute")).toEqual({ mode: "every" });
  });
  it("parses ? as every (Quartz no-specific-value)", () => {
    expect(parseField("?", "dayOfWeek")).toEqual({ mode: "every" });
  });
  it("parses */5 (everyN)", () => {
    expect(parseField("*/5", "minute")).toEqual({ mode: "everyN", step: 5 });
  });
  it("parses 1-5 (range)", () => {
    expect(parseField("1-5", "dayOfWeek")).toEqual({
      mode: "range", rangeStart: 1, rangeEnd: 5,
    });
  });
  it("parses 1-10/2 (rangeStep)", () => {
    expect(parseField("1-10/2", "minute")).toEqual({
      mode: "rangeStep", rangeStart: 1, rangeEnd: 10, step: 2,
    });
  });
  it("parses 1,3,5 (specific list)", () => {
    expect(parseField("1,3,5", "minute")).toEqual({
      mode: "specific", values: [1, 3, 5],
    });
  });
  it("parses list with embedded range 1,3-5,7", () => {
    expect(parseField("1,3-5,7", "minute")).toEqual({
      mode: "specific", values: [1, 3, 4, 5, 7],
    });
  });
  it("parses single value", () => {
    expect(parseField("30", "minute")).toEqual({
      mode: "specific", values: [30],
    });
  });
  it("parses month name JAN → 1", () => {
    expect(parseField("JAN", "month")).toEqual({
      mode: "specific", values: [1],
    });
  });
  it("parses weekday name MON → 1", () => {
    expect(parseField("MON", "dayOfWeek")).toEqual({
      mode: "specific", values: [1],
    });
  });
  it("falls back to every for unknown tokens", () => {
    expect(parseField("xyz", "minute")).toEqual({ mode: "every" });
  });
});

describe("crontab renderField + buildExpression round-trip", () => {
  it("renders every as *", () => {
    expect(renderField("minute", { mode: "every" })).toBe("*");
  });
  it("renders everyN as */N", () => {
    expect(renderField("minute", { mode: "everyN", step: 5 })).toBe("*/5");
  });
  it("renders specific list as comma-joined", () => {
    expect(renderField("minute", { mode: "specific", values: [1, 3, 5] })).toBe("1,3,5");
  });
  it("renders range as A-B", () => {
    expect(renderField("hour", { mode: "range", rangeStart: 9, rangeEnd: 17 })).toBe("9-17");
  });
  it("renders rangeStep as A-B/N", () => {
    expect(renderField("minute", { mode: "rangeStep", rangeStart: 0, rangeEnd: 30, step: 5 })).toBe("0-30/5");
  });
  it("builds 5-field unix expression", () => {
    const cfg: CronConfig = {
      syntax: "unix",
      minute: { mode: "specific", values: [0] },
      hour: { mode: "specific", values: [0] },
      dayOfMonth: { mode: "every" },
      month: { mode: "every" },
      dayOfWeek: { mode: "every" },
    };
    expect(buildExpression(cfg)).toBe("0 0 * * *");
  });
  it("builds 6-field quartz expression with seconds", () => {
    const cfg: CronConfig = {
      syntax: "quartz",
      seconds: { mode: "specific", values: [0] },
      minute: { mode: "specific", values: [0] },
      hour: { mode: "specific", values: [12] },
      dayOfMonth: { mode: "every" },
      month: { mode: "every" },
      dayOfWeek: { mode: "every" },
    };
    expect(buildExpression(cfg)).toBe("0 0 12 * * *");
  });
  it("round-trips parse → build → parse for */5 * * * *", () => {
    const cfg = parseExpression("*/5 * * * *");
    expect(buildExpression(cfg)).toBe("*/5 * * * *");
  });
  it("round-trips parse → build for 0 9-17 * * 1-5", () => {
    const cfg = parseExpression("0 9-17 * * 1-5");
    expect(buildExpression(cfg)).toBe("0 9-17 * * 1-5");
  });
});

describe("crontab applyPreset", () => {
  it("applies every-5-minutes preset", () => {
    const cfg = applyPreset("every-5-minutes")!;
    expect(cfg.minute).toEqual({ mode: "everyN", step: 5 });
    expect(buildExpression(cfg)).toBe("*/5 * * * *");
  });
  it("applies daily-midnight preset", () => {
    const cfg = applyPreset("daily-midnight")!;
    expect(buildExpression(cfg)).toBe("0 0 * * *");
  });
  it("applies weekdays-midnight preset (1-5)", () => {
    const cfg = applyPreset("weekdays-midnight")!;
    expect(cfg.dayOfWeek).toEqual({ mode: "range", rangeStart: 1, rangeEnd: 5 });
  });
  it("returns undefined for unknown preset", () => {
    expect(applyPreset("does-not-exist")).toBeUndefined();
  });
});

describe("crontab expandField", () => {
  it("expands * to full range", () => {
    const set = expandField("minute", { mode: "every" });
    expect(set.size).toBe(60);
    expect(set.has(0)).toBe(true);
    expect(set.has(59)).toBe(true);
  });
  it("expands */15 to 0,15,30,45", () => {
    const set = expandField("minute", { mode: "everyN", step: 15 });
    expect(Array.from(set).sort((a, b) => a - b)).toEqual([0, 15, 30, 45]);
  });
  it("expands specific list", () => {
    const set = expandField("hour", { mode: "specific", values: [0, 12] });
    expect(set.has(0)).toBe(true);
    expect(set.has(12)).toBe(true);
    expect(set.size).toBe(2);
  });
  it("expands range 9-17 to 9..17", () => {
    const set = expandField("hour", { mode: "range", rangeStart: 9, rangeEnd: 17 });
    expect(set.size).toBe(9);
    expect(set.has(9)).toBe(true);
    expect(set.has(17)).toBe(true);
  });
  it("expands rangeStep 0-30/5 to 0,5,10,15,20,25,30", () => {
    const set = expandField("minute", { mode: "rangeStep", rangeStart: 0, rangeEnd: 30, step: 5 });
    expect(set.size).toBe(7);
    expect(set.has(0)).toBe(true);
    expect(set.has(30)).toBe(true);
  });
  it("normalizes dayOfWeek 7 → 0 (Sunday)", () => {
    const set = expandField("dayOfWeek", { mode: "specific", values: [7] });
    expect(set.has(0)).toBe(true);
    expect(set.has(7)).toBe(false);
  });
});

describe("crontab validateConfig", () => {
  it("valid config: 0 0 * * *", () => {
    const cfg = parseExpression("0 0 * * *");
    const r = validateConfig(cfg);
    expect(r.valid).toBe(true);
    expect(r.errors.filter((e) => e.severity === "error")).toHaveLength(0);
  });
  it("catches step out of range: */0", () => {
    const cfg: CronConfig = {
      syntax: "unix",
      minute: { mode: "everyN", step: 0 },
      hour: { mode: "every" },
      dayOfMonth: { mode: "every" },
      month: { mode: "every" },
      dayOfWeek: { mode: "every" },
    };
    const r = validateConfig(cfg);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.severity === "error" && /step 0/.test(e.message))).toBe(true);
  });
  it("catches range start > end", () => {
    const cfg: CronConfig = {
      syntax: "unix",
      minute: { mode: "every" },
      hour: { mode: "range", rangeStart: 17, rangeEnd: 9 },
      dayOfMonth: { mode: "every" },
      month: { mode: "every" },
      dayOfWeek: { mode: "every" },
    };
    const r = validateConfig(cfg);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => /greater than end/.test(e.message))).toBe(true);
  });
  it("catches value out of range (60 in minute)", () => {
    const cfg: CronConfig = {
      syntax: "unix",
      minute: { mode: "specific", values: [60] },
      hour: { mode: "every" },
      dayOfMonth: { mode: "every" },
      month: { mode: "every" },
      dayOfWeek: { mode: "every" },
    };
    const r = validateConfig(cfg);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => /out of range/.test(e.message))).toBe(true);
  });
  it("warns on day-of-month + day-of-week OR semantics (unix)", () => {
    const cfg = parseExpression("0 0 1 * 1");
    const r = validateConfig(cfg);
    // Has at least one warning about OR semantics
    expect(r.errors.some((e) => e.severity === "warning" && /EITHER|OR semantics/.test(e.message))).toBe(true);
  });
  it("warns on AWS AND semantics for restricted dom+dow", () => {
    const cfg: CronConfig = {
      syntax: "aws",
      minute: { mode: "specific", values: [0] },
      hour: { mode: "specific", values: [0] },
      dayOfMonth: { mode: "specific", values: [1] },
      month: { mode: "every" },
      dayOfWeek: { mode: "specific", values: [1] },
      year: { mode: "every" },
    };
    const r = validateConfig(cfg);
    expect(r.errors.some((e) => e.severity === "warning" && /AND semantics/.test(e.message))).toBe(true);
  });
});

describe("crontab validateExpression", () => {
  it("rejects too few fields", () => {
    const r = validateExpression("* * *");
    expect(r.valid).toBe(false);
    expect(r.errors[0].message).toContain("Expected at least 5");
  });
  it("accepts a valid 5-field expression", () => {
    const r = validateExpression("*/5 * * * *");
    expect(r.valid).toBe(true);
  });
});

describe("crontab describeConfig", () => {
  it("describes every-5-minutes", () => {
    const cfg = parseExpression("*/5 * * * *");
    const d = describeConfig(cfg);
    expect(d.short.toLowerCase()).toContain("every 5 minute");
  });
  it("describes daily at midnight", () => {
    const cfg = parseExpression("0 0 * * *");
    const d = describeConfig(cfg);
    expect(d.short.toLowerCase()).toContain("every day");
    expect(d.text).toContain("12:00 AM");
  });
  it("describes daily at noon", () => {
    const cfg = parseExpression("0 12 * * *");
    const d = describeConfig(cfg);
    expect(d.text).toContain("12:00 PM");
  });
  it("describes monthly on day 1", () => {
    const cfg = parseExpression("0 0 1 * *");
    const d = describeConfig(cfg);
    expect(d.short.toLowerCase()).toContain("monthly");
    expect(d.short).toContain("day 1");
  });
  it("describeExpression works for any string", () => {
    const d = describeExpression("0 0 * * 0");
    expect(d.text.length).toBeGreaterThan(0);
  });
});

describe("crontab computeNextRuns", () => {
  it("returns N runs for every-minute expression", () => {
    const cfg = parseExpression("* * * * *");
    const runs = computeNextRuns(cfg, 3, new Date("2026-06-15T10:30:00.000Z"));
    expect(runs).toHaveLength(3);
  });
  it("every-minute runs are consecutive minutes", () => {
    const cfg = parseExpression("* * * * *");
    const runs = computeNextRuns(cfg, 3, new Date("2026-06-15T10:30:00.000Z"));
    expect(runs[1].date.getTime() - runs[0].date.getTime()).toBe(60_000);
  });
  it("every-5-minutes lands on 0,5,10,…", () => {
    const cfg = parseExpression("*/5 * * * *");
    const base = new Date("2026-06-15T10:03:00.000Z");
    const runs = computeNextRuns(cfg, 2, base);
    // First run after 10:03 should be at minute 5
    expect(runs[0].date.getUTCMinutes()).toBe(5);
  });
  it("daily-midnight lands on the next midnight", () => {
    const cfg = parseExpression("0 0 * * *");
    const base = new Date("2026-06-15T10:30:00.000Z");
    const runs = computeNextRuns(cfg, 1, base);
    // The first run should be at 00:00 of the next day in local time.
    expect(runs[0].date.getHours()).toBe(0);
    expect(runs[0].date.getMinutes()).toBe(0);
  });
  it("weekdays-midnight skips Saturday and Sunday", () => {
    const cfg = parseExpression("0 0 * * 1-5");
    // Friday June 19, 2026 — at noon, the next midnight is Sat June 20 (day 6, skipped)
    // The next weekday midnight is Mon June 22 (day 1)
    const base = new Date(2026, 5, 19, 12, 0, 0); // local time
    const runs = computeNextRuns(cfg, 1, base);
    const dow = runs[0].date.getDay();
    expect(dow).toBeGreaterThanOrEqual(1);
    expect(dow).toBeLessThanOrEqual(5);
  });
  it("monthly-first skips to next month", () => {
    const cfg = parseExpression("0 0 1 * *");
    // June 15, 2026 → next run should be July 1, 2026
    const base = new Date(2026, 5, 15, 12, 0, 0);
    const runs = computeNextRuns(cfg, 1, base);
    expect(runs[0].date.getMonth()).toBe(6); // July (0-indexed)
    expect(runs[0].date.getDate()).toBe(1);
  });
  it("respects day-of-month + day-of-week OR semantics", () => {
    // 0 0 1 * 1 = midnight on the 1st OR any Monday
    // June 15, 2026 is a Monday — should run on the next Monday (June 22)
    // OR on July 1 (the 1st), whichever comes first.
    // June 22 is a Monday and June 22 < July 1, so first run = June 22.
    const cfg = parseExpression("0 0 1 * 1");
    const base = new Date(2026, 5, 15, 12, 0, 0); // June 15
    const runs = computeNextRuns(cfg, 1, base);
    // Either June 22 (Monday) or July 1 (1st of month) — must match one of them
    const d = runs[0].date;
    const matches = (d.getDate() === 1) || (d.getDay() === 1);
    expect(matches).toBe(true);
  });
  it("computeNextRunsFromExpression works on string input", () => {
    const runs = computeNextRunsFromExpression("0 * * * *", 1, new Date("2026-06-15T10:30:00.000Z"));
    expect(runs).toHaveLength(1);
    expect(runs[0].date.getMinutes()).toBe(0);
  });
  it("caps at a max-iteration limit for impossible expressions", () => {
    // Feb 31 — never matches (no month has 31 days in Feb)
    const cfg = parseExpression("0 0 31 2 *");
    const runs = computeNextRuns(cfg, 1, new Date(2026, 0, 1, 0, 0, 0));
    expect(runs).toHaveLength(0); // No matches within 1-year cap
  });
});

describe("crontab history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, expression: "0 0 * * *", syntax: "unix", description: "Daily at midnight",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("dedupes by expression+syntax", () => {
    saveHistory({ ts: 1, expression: "0 0 * * *", syntax: "unix", description: "old" });
    saveHistory({ ts: 2, expression: "0 0 * * *", syntax: "unix", description: "new" });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].description).toBe("new");
  });
  it("allows same expression across different syntaxes", () => {
    saveHistory({ ts: 1, expression: "0 0 * * *", syntax: "unix", description: "unix" });
    saveHistory({ ts: 2, expression: "0 0 * * *", syntax: "aws", description: "aws" });
    expect(loadHistory()).toHaveLength(2);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, expression: `*/${i} * * * *`, syntax: "unix", description: `s${i}`,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, expression: "x", syntax: "unix", description: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("crontab shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("0 0 * * *", "unix");
    // URLSearchParams encodes spaces as +; * is unreserved per application/x-www-form-urlencoded
    expect(url).toContain("cron=0+0+*+*+*");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("builds share URL with non-default syntax", () => {
    const url = buildShareUrl("0 0 12 * * ?", "aws");
    expect(url).toContain("syntax=aws");
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("cron=0+0+*+*+*");
    expect(p.expression).toBe("0 0 * * *");
    expect(p.syntax).toBe("unix");
  });
  it("parses share URL with syntax", () => {
    const p = parseShareUrl("cron=0+0+12+%2A+%2A+%3F&syntax=aws");
    expect(p.expression).toBe("0 0 12 * * ?");
    expect(p.syntax).toBe("aws");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ expression: "", syntax: "unix" });
  });
  it("handles hash prefix", () => {
    const p = parseShareUrl("#cron=*/5+%2A+%2A+%2A+%2A");
    expect(p.expression).toBe("*/5 * * * *");
  });
});

// Suppress unused-import lint
export type _Unused = CronFieldName;

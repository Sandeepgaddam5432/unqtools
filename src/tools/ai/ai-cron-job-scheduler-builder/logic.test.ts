import { describe, it, expect, beforeEach } from "vitest";
import {
  CRON_MACROS,
  FIELD_RANGES,
  MONTH_NAMES,
  DOW_NAMES,
  DOW_LABELS,
  NL_PRESETS,
  COMMON_TIMEZONES,
  expandField,
  tokenize,
  detectFlavor,
  parseCron,
  validateCron,
  detectDomDowUnion,
  explainCron,
  parseNaturalLanguage,
  computeNextRuns,
  expandMacro,
  cronToCrontabLine,
  cronToSystemdTimer,
  formatRunDate,
  listTimezones,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  HISTORY_KEY,
  type CronFlavor,
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

// ---------- Constants ----------

describe("ai-cron constants", () => {
  it("has 8 macros", () => {
    expect(Object.keys(CRON_MACROS)).toHaveLength(8);
    expect(CRON_MACROS["@daily"].expr).toBe("0 0 * * *");
    expect(CRON_MACROS["@yearly"].expr).toBe("0 0 1 1 *");
  });
  it("has field ranges for all fields", () => {
    expect(FIELD_RANGES.minute).toEqual([0, 59]);
    expect(FIELD_RANGES.hour).toEqual([0, 23]);
    expect(FIELD_RANGES["day-of-month"]).toEqual([1, 31]);
    expect(FIELD_RANGES.month).toEqual([1, 12]);
    expect(FIELD_RANGES["day-of-week"]).toEqual([0, 6]);
    expect(FIELD_RANGES.second).toEqual([0, 59]);
    expect(FIELD_RANGES.year).toEqual([1970, 2100]);
  });
  it("has month and DOW names", () => {
    expect(MONTH_NAMES.jan).toBe(1);
    expect(MONTH_NAMES.dec).toBe(12);
    expect(DOW_NAMES.sun).toBe(0);
    expect(DOW_NAMES.sat).toBe(6);
  });
  it("has 7 DOW labels", () => {
    expect(DOW_LABELS).toHaveLength(7);
    expect(DOW_LABELS[0]).toBe("Sunday");
    expect(DOW_LABELS[6]).toBe("Saturday");
  });
  it("has NL presets", () => {
    expect(NL_PRESETS.length).toBeGreaterThanOrEqual(15);
    expect(NL_PRESETS).toContain("every 5 minutes");
  });
  it("has common timezones", () => {
    expect(COMMON_TIMEZONES).toContain("UTC");
    expect(COMMON_TIMEZONES).toContain("America/New_York");
    expect(COMMON_TIMEZONES.length).toBeGreaterThanOrEqual(10);
  });
});

// ---------- expandField ----------

describe("ai-cron expandField", () => {
  it("expands *", () => {
    expect(expandField("*", "minute")).toEqual(
      Array.from({ length: 60 }, (_, i) => i),
    );
  });
  it("expands */5", () => {
    expect(expandField("*/5", "minute")).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
  });
  it("expands 1-5", () => {
    expect(expandField("1-5", "hour")).toEqual([1, 2, 3, 4, 5]);
  });
  it("expands list 1,15,30", () => {
    expect(expandField("1,15,30", "minute")).toEqual([1, 15, 30]);
  });
  it("expands range with step 1-10/2", () => {
    expect(expandField("1-10/2", "minute")).toEqual([1, 3, 5, 7, 9]);
  });
  it("expands named months jan-mar", () => {
    expect(expandField("jan-mar", "month")).toEqual([1, 2, 3]);
  });
  it("expands named DOW mon-fri", () => {
    expect(expandField("mon-fri", "day-of-week")).toEqual([1, 2, 3, 4, 5]);
  });
  it("expands Quartz ? to wildcard", () => {
    expect(expandField("?", "day-of-month")).toEqual(
      Array.from({ length: 31 }, (_, i) => i + 1),
    );
  });
  it("expands Quartz L to last", () => {
    expect(expandField("L", "day-of-month")).toEqual([31]);
  });
  it("expands Quartz 0#3 to just 0", () => {
    expect(expandField("0#3", "day-of-week")).toEqual([0]);
  });
  it("expands Quartz 15W to just 15", () => {
    expect(expandField("15W", "day-of-month")).toEqual([15]);
  });
  it("returns empty for unknown field", () => {
    expect(expandField("*", "bogus")).toEqual([]);
  });
});

// ---------- tokenize / detectFlavor ----------

describe("ai-cron tokenize", () => {
  it("tokenizes 5-field standard", () => {
    expect(tokenize("0 9 * * *")).toEqual({ fields: ["0", "9", "*", "*", "*"] });
  });
  it("tokenizes macro", () => {
    expect(tokenize("@daily")).toEqual({ macro: "@daily", fields: [] });
  });
  it("returns null for too few fields", () => {
    expect(tokenize("0 9 * *")).toBeNull();
  });
  it("returns null for too many fields", () => {
    expect(tokenize("0 9 * * * * * *")).toBeNull();
  });
  it("returns null for empty", () => {
    expect(tokenize("")).toBeNull();
  });
});

describe("ai-cron detectFlavor", () => {
  it("returns standard for 5 fields", () => {
    expect(detectFlavor(5)).toBe("standard");
  });
  it("returns quartz for 6 fields", () => {
    expect(detectFlavor(6)).toBe("quartz");
  });
  it("returns quartz for 7 fields", () => {
    expect(detectFlavor(7)).toBe("quartz");
  });
});

// ---------- parseCron ----------

describe("ai-cron parseCron", () => {
  it("parses 5-field standard", () => {
    const p = parseCron("0 9 * * *");
    expect(p.flavor).toBe("standard");
    expect(p.hasSeconds).toBe(false);
    expect(p.hasYear).toBe(false);
    expect(p.fields).toEqual(["0", "9", "*", "*", "*"]);
    expect(p.parsed[0].values).toEqual([0]);
    expect(p.parsed[1].values).toEqual([9]);
  });
  it("parses 6-field quartz", () => {
    const p = parseCron("0 0 9 * * *");
    expect(p.flavor).toBe("quartz");
    expect(p.hasSeconds).toBe(true);
    expect(p.hasYear).toBe(false);
    expect(p.fields).toEqual(["0", "0", "9", "*", "*", "*"]);
  });
  it("parses 7-field quartz with year", () => {
    const p = parseCron("0 0 9 * * * 2025");
    expect(p.hasYear).toBe(true);
    expect(p.fields[6]).toBe("2025");
  });
  it("expands macro", () => {
    const p = parseCron("@daily");
    expect(p.macro).toBe("@daily");
    expect(p.fields).toEqual(["0", "0", "*", "*", "*"]);
  });
  it("handles unknown macro", () => {
    const p = parseCron("@bogus");
    expect(p.macro).toBe("@bogus");
    expect(p.fields).toEqual([]);
  });
  it("returns empty for invalid shape", () => {
    const p = parseCron("bogus");
    expect(p.fields).toEqual([]);
    expect(p.parsed).toEqual([]);
  });
});

// ---------- validateCron ----------

describe("ai-cron validateCron", () => {
  it("accepts valid 5-field", () => {
    const v = validateCron("0 9 * * *");
    expect(v.valid).toBe(true);
    expect(v.errors).toEqual([]);
  });
  it("accepts valid macro", () => {
    const v = validateCron("@daily");
    expect(v.valid).toBe(true);
  });
  it("rejects unknown macro", () => {
    const v = validateCron("@bogus");
    expect(v.valid).toBe(false);
    expect(v.errors[0]).toContain("Unknown macro");
  });
  it("rejects out-of-range minute", () => {
    const v = validateCron("60 9 * * *");
    expect(v.valid).toBe(false);
    expect(v.errors[0]).toContain("out of range");
  });
  it("rejects out-of-range hour", () => {
    const v = validateCron("0 25 * * *");
    expect(v.valid).toBe(false);
  });
  it("rejects bad month name", () => {
    const v = validateCron("0 9 * xyz *");
    expect(v.valid).toBe(false);
    expect(v.errors[0]).toContain("unknown name");
  });
  it("rejects range with start > end", () => {
    const v = validateCron("0 9 * * 5-1");
    expect(v.valid).toBe(false);
    expect(v.errors[0]).toContain("start > end");
  });
  it("warns on DOM/DOW union", () => {
    const v = validateCron("0 0 1 * 0");
    expect(v.valid).toBe(true);
    expect(v.warnings.length).toBeGreaterThanOrEqual(1);
    expect(v.warnings[0]).toContain("OR");
  });
  it("accepts Quartz 6-field", () => {
    const v = validateCron("0 0 9 * * *");
    expect(v.valid).toBe(true);
  });
  it("accepts Quartz ? in DOM and DOW only", () => {
    expect(validateCron("0 0 0 ? * ?").valid).toBe(true);
    // ? in minute field is invalid
    expect(validateCron("? 0 0 * * *").valid).toBe(false);
  });
});

// ---------- detectDomDowUnion ----------

describe("ai-cron detectDomDowUnion", () => {
  it("detects union when both DOM and DOW restricted", () => {
    const w = detectDomDowUnion(parseCron("0 0 1 * 0"));
    expect(w.isUnion).toBe(true);
    expect(w.explanation.length).toBeGreaterThan(0);
  });
  it("no union when DOW is *", () => {
    expect(detectDomDowUnion(parseCron("0 0 1 * *")).isUnion).toBe(false);
  });
  it("no union when DOM is *", () => {
    expect(detectDomDowUnion(parseCron("0 0 * * 0")).isUnion).toBe(false);
  });
  it("no union when both are *", () => {
    expect(detectDomDowUnion(parseCron("0 0 * * *")).isUnion).toBe(false);
  });
});

// ---------- explainCron ----------

describe("ai-cron explainCron", () => {
  it("explains macro", () => {
    expect(explainCron("@daily")).toContain("midnight");
  });
  it("explains every 5 minutes", () => {
    expect(explainCron("*/5 * * * *")).toContain("Every 5 minute");
  });
  it("explains hourly", () => {
    expect(explainCron("0 * * * *")).toContain("top of every hour");
  });
  it("explains daily at midnight", () => {
    expect(explainCron("0 0 * * *")).toContain("midnight");
  });
  it("explains daily at 9am", () => {
    const e = explainCron("0 9 * * *");
    expect(e).toContain("9:00am");
  });
  it("explains every weekday", () => {
    expect(explainCron("0 9 * * 1-5")).toContain("weekday");
  });
  it("explains every weekend", () => {
    const e = explainCron("0 10 * * 6,0");
    expect(e).toMatch(/Saturday|Sunday|weekend/);
  });
  it("explains every Monday", () => {
    expect(explainCron("0 9 * * 1")).toContain("Monday");
  });
  it("explains monthly on 1st", () => {
    expect(explainCron("0 0 1 * *")).toContain("1st");
  });
  it("explains yearly", () => {
    expect(explainCron("0 0 1 1 *")).toContain("January 1st");
  });
  it("explains named months", () => {
    expect(explainCron("0 0 1 jan,jun *")).toContain("January");
  });
  it("explains invalid expression", () => {
    expect(explainCron("60 9 * * *")).toContain("Invalid");
  });
  it("explains Quartz 6-field", () => {
    const e = explainCron("30 0 9 * * *");
    expect(e).toContain("9:00");
  });
});

// ---------- parseNaturalLanguage ----------

describe("ai-cron parseNaturalLanguage", () => {
  it("parses 'every minute'", () => {
    expect(parseNaturalLanguage("every minute").expression).toBe("* * * * *");
    expect(parseNaturalLanguage("every minute").confidence).toBe("high");
  });
  it("parses 'every 5 minutes'", () => {
    expect(parseNaturalLanguage("every 5 minutes").expression).toBe("*/5 * * * *");
  });
  it("parses 'every 15 minutes'", () => {
    expect(parseNaturalLanguage("every 15 minutes").expression).toBe("*/15 * * * *");
  });
  it("parses 'hourly'", () => {
    expect(parseNaturalLanguage("hourly").expression).toBe("0 * * * *");
  });
  it("parses 'every 2 hours'", () => {
    expect(parseNaturalLanguage("every 2 hours").expression).toBe("0 */2 * * *");
  });
  it("parses 'daily at 9am'", () => {
    expect(parseNaturalLanguage("daily at 9am").expression).toBe("0 9 * * *");
  });
  it("parses 'daily at midnight'", () => {
    expect(parseNaturalLanguage("daily at midnight").expression).toBe("0 0 * * *");
  });
  it("parses 'daily at noon'", () => {
    expect(parseNaturalLanguage("daily at noon").expression).toBe("0 12 * * *");
  });
  it("parses 'daily at 9:30am'", () => {
    expect(parseNaturalLanguage("daily at 9:30am").expression).toBe("30 9 * * *");
  });
  it("parses 'daily at 9pm'", () => {
    expect(parseNaturalLanguage("daily at 9pm").expression).toBe("0 21 * * *");
  });
  it("parses 'every weekday at 8am'", () => {
    expect(parseNaturalLanguage("every weekday at 8am").expression).toBe("0 8 * * 1-5");
  });
  it("parses 'every weekend at 10am'", () => {
    expect(parseNaturalLanguage("every weekend at 10am").expression).toBe("0 10 * * 6,0");
  });
  it("parses 'every Monday at 9am'", () => {
    expect(parseNaturalLanguage("every Monday at 9am").expression).toBe("0 9 * * 1");
  });
  it("parses 'every Friday at 5pm'", () => {
    expect(parseNaturalLanguage("every Friday at 5pm").expression).toBe("0 17 * * 5");
  });
  it("parses 'every Monday, Wednesday, Friday at 9am'", () => {
    const r = parseNaturalLanguage("every Monday, Wednesday, Friday at 9am");
    expect(r.expression).toBe("0 9 * * 1,3,5");
  });
  it("parses 'every Sunday at midnight'", () => {
    const r = parseNaturalLanguage("every Sunday at midnight");
    expect(r.expression).toBe("0 0 * * 0");
  });
  it("parses 'monthly on the 1st at midnight'", () => {
    expect(parseNaturalLanguage("monthly on the 1st at midnight").expression).toBe("0 0 1 * *");
  });
  it("parses 'monthly on the 15th at 9am'", () => {
    expect(parseNaturalLanguage("monthly on the 15th at 9am").expression).toBe("0 9 15 * *");
  });
  it("parses 'yearly on January 1st at midnight'", () => {
    expect(parseNaturalLanguage("yearly on January 1st at midnight").expression).toBe("0 0 1 1 *");
  });
  it("parses 'every 30 minutes'", () => {
    expect(parseNaturalLanguage("every 30 minutes").expression).toBe("*/30 * * * *");
  });
  it("parses 'every 3 days'", () => {
    expect(parseNaturalLanguage("every 3 days").expression).toBe("0 0 */3 * *");
  });
  it("parses 'every 3 months'", () => {
    expect(parseNaturalLanguage("every 3 months").expression).toBe("0 0 1 */3 *");
  });
  it("parses 'every 5 seconds' as Quartz", () => {
    const r = parseNaturalLanguage("every 5 seconds");
    expect(r.expression).toBe("*/5 * * * * *");
    expect(r.flavor).toBe("quartz");
  });
  it("parses 'quarterly on the 1st of January, April, July, October at midnight'", () => {
    const r = parseNaturalLanguage("quarterly on the 1st of January, April, July, October at midnight");
    expect(r.expression).toBe("0 0 1 1,4,7,10 *");
  });
  it("returns low confidence for unrecognized input", () => {
    const r = parseNaturalLanguage("when the cows come home");
    expect(r.confidence).toBe("low");
    expect(r.expression).toBe("");
    expect(r.note).toBeDefined();
  });
  it("handles empty input", () => {
    const r = parseNaturalLanguage("");
    expect(r.confidence).toBe("low");
  });
});

// ---------- computeNextRuns ----------

describe("ai-cron computeNextRuns", () => {
  it("computes next 5 runs for every minute", () => {
    const from = new Date("2025-01-15T10:00:00Z");
    const r = computeNextRuns("* * * * *", from, 5, "UTC");
    expect(r.runs).toHaveLength(5);
    expect(r.runs[0].getUTCMinutes()).toBe(1);
  });
  it("computes next 3 runs for daily at midnight", () => {
    const from = new Date("2025-01-15T10:00:00Z");
    const r = computeNextRuns("0 0 * * *", from, 3, "UTC");
    expect(r.runs).toHaveLength(3);
    expect(r.runs[0].getUTCHours()).toBe(0);
    expect(r.runs[0].getUTCMinutes()).toBe(0);
  });
  it("computes next 3 runs for hourly", () => {
    const from = new Date("2025-01-15T10:30:00Z");
    const r = computeNextRuns("0 * * * *", from, 3, "UTC");
    expect(r.runs).toHaveLength(3);
    expect(r.runs[0].getUTCHours()).toBe(11);
    expect(r.runs[0].getUTCMinutes()).toBe(0);
  });
  it("returns empty for invalid expression", () => {
    const r = computeNextRuns("bogus");
    expect(r.runs).toEqual([]);
  });
  it("computes every-5-minutes runs", () => {
    const from = new Date("2025-01-15T10:02:00Z");
    const r = computeNextRuns("*/5 * * * *", from, 3, "UTC");
    expect(r.runs).toHaveLength(3);
    expect(r.runs[0].getUTCMinutes()).toBe(5);
    expect(r.runs[1].getUTCMinutes()).toBe(10);
  });
  it("honors Quartz seconds", () => {
    // Start at 10:00:15 (between second 0 and 30) so first match is 10:00:30.
    const from = new Date("2025-01-15T10:00:15Z");
    const r = computeNextRuns("*/30 * * * * *", from, 3, "UTC");
    expect(r.runs).toHaveLength(3);
    expect(r.runs[0].getUTCSeconds()).toBe(30);
    expect(r.runs[1].getUTCSeconds()).toBe(0);
    expect(r.runs[2].getUTCSeconds()).toBe(30);
  });
  it("respects DOW restriction", () => {
    // Every Sunday at 5pm UTC, starting Wednesday Jan 15 2025.
    const from = new Date("2025-01-15T10:00:00Z"); // Wed
    const r = computeNextRuns("0 17 * * 0", from, 2, "UTC");
    expect(r.runs).toHaveLength(2);
    // First run: Sunday Jan 19.
    expect(r.runs[0].getUTCDay()).toBe(0);
    expect(r.runs[0].getUTCHours()).toBe(17);
  });
});

// ---------- expandMacro / cronToCrontabLine / cronToSystemdTimer ----------

describe("ai-cron expandMacro", () => {
  it("expands @daily", () => {
    expect(expandMacro("@daily")).toBe("0 0 * * *");
  });
  it("returns null for non-macro", () => {
    expect(expandMacro("0 0 * * *")).toBeNull();
  });
});

describe("ai-cron cronToCrontabLine", () => {
  it("emits crontab line with default command", () => {
    const line = cronToCrontabLine("0 9 * * *");
    expect(line).toBe("0 9 * * * /usr/local/bin/job.sh");
  });
  it("emits crontab line with custom command", () => {
    const line = cronToCrontabLine("0 9 * * *", "/run/backup.sh");
    expect(line).toBe("0 9 * * * /run/backup.sh");
  });
  it("handles macros", () => {
    const line = cronToCrontabLine("@daily");
    expect(line).toBe("@daily /usr/local/bin/job.sh");
  });
});

describe("ai-cron cronToSystemdTimer", () => {
  it("emits systemd timer snippet", () => {
    const out = cronToSystemdTimer("0 9 * * *", "backup");
    expect(out).toContain("[Timer]");
    expect(out).toContain("OnCalendar=");
    expect(out).toContain("backup.timer");
    expect(out).toContain("backup.service");
  });
  it("emits enable instruction", () => {
    const out = cronToSystemdTimer("0 9 * * *", "backup");
    expect(out).toContain("systemctl enable");
  });
  it("warns on Quartz seconds", () => {
    const out = cronToSystemdTimer("0 0 9 * * *", "test");
    expect(out).toContain("seconds");
  });
});

// ---------- formatRunDate / listTimezones ----------

describe("ai-cron formatRunDate", () => {
  it("formats a date in UTC", () => {
    const d = new Date("2025-01-15T10:30:00Z");
    const s = formatRunDate(d, "UTC");
    expect(s).toContain("Jan");
    expect(s).toContain("2025");
  });
  it("falls back gracefully for bad tz", () => {
    const d = new Date("2025-01-15T10:30:00Z");
    const s = formatRunDate(d, "Bogus/Nowhere");
    expect(s.length).toBeGreaterThan(0);
  });
});

describe("ai-cron listTimezones", () => {
  it("includes UTC and common tzs", () => {
    const tzs = listTimezones();
    expect(tzs).toContain("UTC");
    expect(tzs.length).toBeGreaterThanOrEqual(10);
  });
});

// ---------- history ----------

describe("ai-cron history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, flavor: "standard", expression: "0 9 * * *", description: "Daily 9am" });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].expression).toBe("0 9 * * *");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, flavor: "standard", expression: `*/${i} * * * *`, description: "" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, flavor: "standard", expression: "0 9 * * *", description: "" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("uses HISTORY_KEY constant", () => {
    expect(HISTORY_KEY).toContain("ai-cron-job-scheduler-builder");
  });
});

// ---------- share URL ----------

describe("ai-cron share URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ expression: "0 9 * * *", flavor: "standard", tz: "UTC", count: 5 });
    // URLSearchParams encodes spaces as +, leaves asterisks unencoded.
    expect(url).toMatch(/expr=0\+9\+(\*|%2A)\+(\*|%2A)\+(\*|%2A)/);
    expect(url).toContain("flavor=standard");
    expect(url).toContain("tz=UTC");
    expect(url).toContain("count=5");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const s = parseShareUrl("expr=0+9+%2A+%2A+%2A&flavor=standard&tz=UTC&count=5");
    expect(s.expression).toBe("0 9 * * *");
    expect(s.flavor).toBe("standard");
    expect(s.tz).toBe("UTC");
    expect(s.count).toBe(5);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ expression: "", flavor: "standard" });
  });
  it("defaults unknown flavor to standard", () => {
    const s = parseShareUrl("flavor=bogus");
    expect(s.flavor).toBe("standard");
  });
  it("parses quartz flavor", () => {
    const s = parseShareUrl("expr=0+0+9+%2A+%2A+%2A&flavor=quartz");
    expect(s.flavor).toBe("quartz");
    expect(s.expression).toBe("0 0 9 * * *");
  });
});

// ---------- LLM prompt / result ----------

describe("ai-cron LLM prompt + result", () => {
  it("builds LLM prompt with user input", () => {
    const p = buildLlmPrompt("daily at 9am");
    expect(p).toContain("cron-expression expert");
    expect(p).toContain("daily at 9am");
    expect(p).toContain("JSON");
  });
  it("renders valid LLM result JSON", () => {
    const json = JSON.stringify({
      expression: "0 9 * * *",
      explanation: "Daily at 9am",
      alternatives: ["0 8 * * *"],
      suggestions: ["Use UTC."],
    });
    const r = renderLlmResult(json);
    expect(r.expression).toBe("0 9 * * *");
    expect(r.explanation).toBe("Daily at 9am");
    expect(r.alternatives).toEqual(["0 8 * * *"]);
    expect(r.suggestions).toEqual(["Use UTC."]);
  });
  it("renders LLM result wrapped in markdown fences", () => {
    const raw = '```json\n{"expression":"0 9 * * *","explanation":"x","alternatives":[],"suggestions":[]}\n```';
    const r = renderLlmResult(raw);
    expect(r.expression).toBe("0 9 * * *");
  });
  it("returns fallback on bad JSON", () => {
    const r = renderLlmResult("not json at all");
    expect(r.expression).toBe("");
    expect(r.explanation).toContain("did not return parseable JSON");
  });
  it("returns fallback on missing braces", () => {
    const r = renderLlmResult("just text");
    expect(r.expression).toBe("");
  });
});

// Suppress unused-import lint for re-exported types
export type _Unused = CronFlavor;

import { describe, it, expect, beforeEach } from "vitest";
import {
  ROUNDING_PRESETS,
  ROUNDING_LABELS,
  ROUNDING_MS,
  MS_PER_SECOND,
  MS_PER_MINUTE,
  MS_PER_HOUR,
  formatDuration,
  parseDuration,
  msToHours,
  hoursToMs,
  computeDuration,
  roundMsUp,
  roundMsNearest,
  computeBillableAmount,
  validateEntry,
  normalizeTaskName,
  normalizeProjectName,
  clampNonNegative,
  formatDate,
  getIsoWeek,
  weekKey,
  buildEntry,
  groupByDay,
  groupByWeek,
  projectSummary,
  billableSummary,
  summaryStats,
  suggestProjects,
  formatCost,
  renderText,
  renderCsv,
  loadEntries,
  saveEntries,
  addEntry,
  removeEntry,
  clearEntries,
  buildShareUrl,
  parseShareUrl,
  type TimeEntry,
  type RoundingPreset,
  type EntryDraft,
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

// ---- Helpers ----

function makeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  const startMs = overrides.startMs ?? Date.UTC(2024, 0, 15, 9, 0, 0); // 2024-01-15 09:00 UTC
  const endMs = overrides.endMs ?? startMs + MS_PER_HOUR; // 1 hour default
  return {
    id: "test-id",
    taskName: "Default task",
    projectName: "",
    billable: false,
    hourlyRate: 0,
    notes: "",
    startMs,
    endMs,
    durationMs: endMs - startMs,
    date: formatDate(startMs),
    rounding: "none",
    ...overrides,
  };
}

// ---- Constants ----

describe("time-tracker constants", () => {
  it("has 4 rounding presets", () => {
    expect(ROUNDING_PRESETS).toEqual(["none", "6min", "15min", "30min"]);
  });
  it("has labels for every preset", () => {
    for (const p of ROUNDING_PRESETS) {
      expect(ROUNDING_LABELS[p]).toBeTruthy();
    }
  });
  it("has correct ms values for presets", () => {
    expect(ROUNDING_MS["none"]).toBe(0);
    expect(ROUNDING_MS["6min"]).toBe(6 * 60 * 1000);
    expect(ROUNDING_MS["15min"]).toBe(15 * 60 * 1000);
    expect(ROUNDING_MS["30min"]).toBe(30 * 60 * 1000);
  });
  it("has correct time constants", () => {
    expect(MS_PER_SECOND).toBe(1000);
    expect(MS_PER_MINUTE).toBe(60000);
    expect(MS_PER_HOUR).toBe(3600000);
  });
});

// ---- Time formatting / parsing ----

describe("time-tracker formatDuration", () => {
  it("formats 0", () => {
    expect(formatDuration(0)).toBe("00:00:00");
  });
  it("formats seconds only", () => {
    expect(formatDuration(45 * MS_PER_SECOND)).toBe("00:00:45");
  });
  it("formats minutes and seconds", () => {
    expect(formatDuration(5 * MS_PER_MINUTE + 30 * MS_PER_SECOND)).toBe("00:05:30");
  });
  it("formats hours", () => {
    expect(formatDuration(2 * MS_PER_HOUR + 15 * MS_PER_MINUTE + 5 * MS_PER_SECOND)).toBe("02:15:05");
  });
  it("pads to 2 digits", () => {
    expect(formatDuration(3 * MS_PER_HOUR + 5 * MS_PER_MINUTE)).toBe("03:05:00");
  });
  it("clamps negative to 0", () => {
    expect(formatDuration(-1000)).toBe("00:00:00");
  });
  it("clamps NaN to 0", () => {
    expect(formatDuration(NaN)).toBe("00:00:00");
  });
});

describe("time-tracker parseDuration", () => {
  it("parses 00:00:00", () => {
    expect(parseDuration("00:00:00")).toBe(0);
  });
  it("parses HH:MM:SS", () => {
    expect(parseDuration("02:30:45")).toBe(2 * MS_PER_HOUR + 30 * MS_PER_MINUTE + 45 * MS_PER_SECOND);
  });
  it("parses single-digit minutes/seconds", () => {
    expect(parseDuration("01:5:5")).toBe(MS_PER_HOUR + 5 * MS_PER_MINUTE + 5 * MS_PER_SECOND);
  });
  it("returns 0 for invalid format", () => {
    expect(parseDuration("invalid")).toBe(0);
  });
  it("returns 0 for empty", () => {
    expect(parseDuration("")).toBe(0);
  });
  it("returns 0 for out-of-range seconds", () => {
    expect(parseDuration("01:00:60")).toBe(0);
  });
});

describe("time-tracker msToHours / hoursToMs", () => {
  it("converts ms to hours", () => {
    expect(msToHours(MS_PER_HOUR)).toBe(1);
    expect(msToHours(2 * MS_PER_HOUR + 30 * MS_PER_MINUTE)).toBe(2.5);
  });
  it("converts hours to ms (round trip)", () => {
    expect(hoursToMs(2.5)).toBe(2.5 * MS_PER_HOUR);
    expect(msToHours(hoursToMs(3.7))).toBeCloseTo(3.7, 5);
  });
});

describe("time-tracker computeDuration", () => {
  it("returns positive diff", () => {
    expect(computeDuration(1000, 5000)).toBe(4000);
  });
  it("clamps to 0 for inverted", () => {
    expect(computeDuration(5000, 1000)).toBe(0);
  });
  it("returns 0 for NaN inputs", () => {
    expect(computeDuration(NaN, 1000)).toBe(0);
    expect(computeDuration(1000, NaN)).toBe(0);
  });
});

// ---- Rounding ----

describe("time-tracker roundMsUp", () => {
  it("no rounding returns same", () => {
    expect(roundMsUp(123456, "none")).toBe(123456);
  });
  it("rounds up to 6 min (1/10 hr)", () => {
    expect(roundMsUp(7 * MS_PER_MINUTE, "6min")).toBe(12 * MS_PER_MINUTE);
  });
  it("rounds up to 15 min", () => {
    expect(roundMsUp(20 * MS_PER_MINUTE, "15min")).toBe(30 * MS_PER_MINUTE);
  });
  it("exact multiple stays the same", () => {
    expect(roundMsUp(15 * MS_PER_MINUTE, "15min")).toBe(15 * MS_PER_MINUTE);
  });
  it("rounds up to 30 min", () => {
    expect(roundMsUp(35 * MS_PER_MINUTE, "30min")).toBe(60 * MS_PER_MINUTE);
  });
});

describe("time-tracker roundMsNearest", () => {
  it("no rounding returns same", () => {
    expect(roundMsNearest(123456, "none")).toBe(123456);
  });
  it("rounds to nearest 15 min (down)", () => {
    expect(roundMsNearest(7 * MS_PER_MINUTE, "15min")).toBe(0);
  });
  it("rounds to nearest 15 min (up)", () => {
    expect(roundMsNearest(8 * MS_PER_MINUTE, "15min")).toBe(15 * MS_PER_MINUTE);
  });
});

// ---- Billable amount ----

describe("time-tracker computeBillableAmount", () => {
  it("returns 0 if not billable", () => {
    expect(computeBillableAmount(MS_PER_HOUR, 100, false, "none")).toBe(0);
  });
  it("computes hours × rate with no rounding", () => {
    expect(computeBillableAmount(2 * MS_PER_HOUR, 50, true, "none")).toBe(100);
  });
  it("applies 15-min rounding (round up) before computing cost", () => {
    // 20 min rounds up to 30 min = 0.5 hr × $60 = $30
    expect(computeBillableAmount(20 * MS_PER_MINUTE, 60, true, "15min")).toBe(30);
  });
  it("handles fractional hours", () => {
    // 90 min = 1.5 hr × $40 = $60
    expect(computeBillableAmount(90 * MS_PER_MINUTE, 40, true, "none")).toBe(60);
  });
  it("clamps negative rate", () => {
    expect(computeBillableAmount(MS_PER_HOUR, -50, true, "none")).toBe(0);
  });
});

// ---- Validation ----

describe("time-tracker validateEntry", () => {
  it("valid when task + duration > 0", () => {
    const r = validateEntry("My task", MS_PER_HOUR);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it("invalid when task name empty", () => {
    const r = validateEntry("", MS_PER_HOUR);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("Task name is required");
  });
  it("invalid when task name whitespace only", () => {
    const r = validateEntry("   ", MS_PER_HOUR);
    expect(r.valid).toBe(false);
  });
  it("invalid when duration 0", () => {
    const r = validateEntry("Task", 0);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("Duration must be greater than 0");
  });
  it("invalid when duration negative", () => {
    const r = validateEntry("Task", -1000);
    expect(r.valid).toBe(false);
  });
  it("collects multiple errors", () => {
    const r = validateEntry("", 0);
    expect(r.errors).toHaveLength(2);
  });
});

// ---- Normalize helpers ----

describe("time-tracker normalizers", () => {
  it("normalizeTaskName trims and collapses whitespace", () => {
    expect(normalizeTaskName("  Fix   the   bug  ")).toBe("Fix the bug");
  });
  it("normalizeProjectName trims", () => {
    expect(normalizeProjectName("  API v2 ")).toBe("API v2");
  });
  it("clampNonNegative zeros negative", () => {
    expect(clampNonNegative(-5)).toBe(0);
    expect(clampNonNegative(NaN)).toBe(0);
    expect(clampNonNegative(42)).toBe(42);
  });
});

// ---- Date helpers ----

describe("time-tracker formatDate", () => {
  it("formats a UTC timestamp as YYYY-MM-DD (local time)", () => {
    const ms = Date.UTC(2024, 5, 15, 12, 0, 0); // 2024-06-15 12:00 UTC
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    expect(formatDate(ms)).toBe(`${y}-${m}-${day}`);
  });
});

describe("time-tracker getIsoWeek", () => {
  it("computes ISO week for known date", () => {
    // 2024-01-01 is Monday → week 1 of 2024
    const d = new Date(Date.UTC(2024, 0, 1));
    const r = getIsoWeek(d);
    expect(r.year).toBe(2024);
    expect(r.week).toBe(1);
    expect(r.weekStart).toBe("2024-01-01");
  });
  it("computes week for mid-year", () => {
    // 2024-06-12 is a Wednesday → ISO week 24 of 2024
    const d = new Date(Date.UTC(2024, 5, 12));
    const r = getIsoWeek(d);
    expect(r.year).toBe(2024);
    expect(r.week).toBe(24);
  });
  it("weekKey returns YYYY-WNN", () => {
    const d = new Date(Date.UTC(2024, 0, 1));
    expect(weekKey(d)).toBe("2024-W01");
  });
});

// ---- buildEntry ----

describe("time-tracker buildEntry", () => {
  it("builds an entry from a draft", () => {
    const draft: EntryDraft = {
      taskName: "  Write docs  ",
      projectName: "API v2",
      billable: true,
      hourlyRate: 75,
      notes: "Updated README",
      startMs: 1000,
      endMs: 1000 + MS_PER_HOUR,
      rounding: "none",
    };
    const e = buildEntry(draft);
    expect(e.taskName).toBe("Write docs");
    expect(e.projectName).toBe("API v2");
    expect(e.billable).toBe(true);
    expect(e.hourlyRate).toBe(75);
    expect(e.durationMs).toBe(MS_PER_HOUR);
    expect(e.id).toMatch(/^tt_/);
  });
  it("defaults empty task to (untitled)", () => {
    const e = buildEntry({
      taskName: "  ",
      projectName: "",
      billable: false,
      hourlyRate: 0,
      notes: "",
      startMs: 1000,
      endMs: 2000,
      rounding: "none",
    });
    expect(e.taskName).toBe("(untitled)");
  });
});

// ---- Grouping ----

describe("time-tracker groupByDay", () => {
  it("groups entries by date", () => {
    const entries = [
      makeEntry({ startMs: Date.UTC(2024, 0, 15, 9, 0, 0), endMs: Date.UTC(2024, 0, 15, 10, 0, 0) }),
      makeEntry({ startMs: Date.UTC(2024, 0, 15, 11, 0, 0), endMs: Date.UTC(2024, 0, 15, 12, 0, 0) }),
      makeEntry({ startMs: Date.UTC(2024, 0, 16, 9, 0, 0), endMs: Date.UTC(2024, 0, 16, 10, 0, 0) }),
    ];
    const days = groupByDay(entries);
    expect(days).toHaveLength(2);
    expect(days[0].entries).toHaveLength(2);
    expect(days[1].entries).toHaveLength(1);
  });
  it("computes totalMs and hours per day", () => {
    const entries = [
      makeEntry({ startMs: Date.UTC(2024, 0, 15, 9, 0, 0), endMs: Date.UTC(2024, 0, 15, 11, 0, 0) }),
    ];
    const days = groupByDay(entries);
    expect(days[0].totalMs).toBe(2 * MS_PER_HOUR);
    expect(days[0].totalHours).toBe(2);
  });
  it("returns empty array for no entries", () => {
    expect(groupByDay([])).toEqual([]);
  });
  it("sorts days chronologically", () => {
    const entries = [
      makeEntry({ startMs: Date.UTC(2024, 0, 16, 9, 0, 0), endMs: Date.UTC(2024, 0, 16, 10, 0, 0) }),
      makeEntry({ startMs: Date.UTC(2024, 0, 15, 9, 0, 0), endMs: Date.UTC(2024, 0, 15, 10, 0, 0) }),
    ];
    const days = groupByDay(entries);
    expect(days[0].date).toBe("2024-01-15");
    expect(days[1].date).toBe("2024-01-16");
  });
});

describe("time-tracker groupByWeek", () => {
  it("groups entries by ISO week", () => {
    const entries = [
      makeEntry({ startMs: Date.UTC(2024, 0, 1, 9, 0, 0), endMs: Date.UTC(2024, 0, 1, 10, 0, 0) }),
      makeEntry({ startMs: Date.UTC(2024, 0, 8, 9, 0, 0), endMs: Date.UTC(2024, 0, 8, 10, 0, 0) }),
    ];
    const weeks = groupByWeek(entries);
    expect(weeks).toHaveLength(2);
    expect(weeks[0].weekKey).toBe("2024-W01");
    expect(weeks[1].weekKey).toBe("2024-W02");
  });
  it("returns empty for no entries", () => {
    expect(groupByWeek([])).toEqual([]);
  });
});

describe("time-tracker projectSummary", () => {
  it("summarizes by project", () => {
    const entries = [
      makeEntry({ projectName: "API", billable: true, hourlyRate: 100, startMs: 1000, endMs: 1000 + 2 * MS_PER_HOUR }),
      makeEntry({ projectName: "API", billable: true, hourlyRate: 100, startMs: 3000, endMs: 3000 + MS_PER_HOUR }),
      makeEntry({ projectName: "Website", billable: false, hourlyRate: 0, startMs: 5000, endMs: 5000 + MS_PER_HOUR }),
    ];
    const ps = projectSummary(entries);
    expect(ps).toHaveLength(2);
    const api = ps.find((p) => p.project === "API");
    expect(api?.entryCount).toBe(2);
    expect(api?.totalHours).toBe(3);
    expect(api?.cost).toBe(300);
  });
  it("groups unassigned under (no project)", () => {
    const entries = [makeEntry({ projectName: "", startMs: 1000, endMs: 2000 })];
    const ps = projectSummary(entries);
    expect(ps[0].project).toBe("(no project)");
  });
  it("sorts by totalMs descending", () => {
    const entries = [
      makeEntry({ projectName: "Short", startMs: 1000, endMs: 2000 }),
      makeEntry({ projectName: "Long", startMs: 3000, endMs: 3000 + 5 * MS_PER_HOUR }),
    ];
    const ps = projectSummary(entries);
    expect(ps[0].project).toBe("Long");
  });
});

describe("time-tracker billableSummary", () => {
  it("computes billable stats", () => {
    const entries = [
      makeEntry({ billable: true, hourlyRate: 100, startMs: 1000, endMs: 1000 + 2 * MS_PER_HOUR }),
      makeEntry({ billable: false, startMs: 3000, endMs: 3000 + MS_PER_HOUR }),
      makeEntry({ billable: true, hourlyRate: 50, startMs: 5000, endMs: 5000 + MS_PER_HOUR }),
    ];
    const b = billableSummary(entries);
    expect(b.billableEntries).toBe(2);
    expect(b.billableHours).toBe(3);
    expect(b.totalCost).toBe(250);
    expect(b.avgRate).toBe(75); // (100 + 50) / 2
  });
  it("returns zeros for empty entries", () => {
    const b = billableSummary([]);
    expect(b.billableEntries).toBe(0);
    expect(b.totalCost).toBe(0);
    expect(b.avgRate).toBe(0);
  });
  it("avgRate ignores zero-rate entries", () => {
    const entries = [
      makeEntry({ billable: true, hourlyRate: 0, startMs: 1000, endMs: 2000 }),
      makeEntry({ billable: true, hourlyRate: 100, startMs: 3000, endMs: 4000 }),
    ];
    const b = billableSummary(entries);
    expect(b.avgRate).toBe(100);
  });
});

describe("time-tracker summaryStats", () => {
  it("computes total stats", () => {
    const entries = [
      makeEntry({ projectName: "A", billable: true, hourlyRate: 50, startMs: 1000, endMs: 1000 + MS_PER_HOUR }),
      makeEntry({ projectName: "B", billable: false, startMs: 3000, endMs: 3000 + 2 * MS_PER_HOUR }),
    ];
    const s = summaryStats(entries);
    expect(s.entryCount).toBe(2);
    expect(s.totalHours).toBe(3);
    expect(s.billableEntries).toBe(1);
    expect(s.billableHours).toBe(1);
    expect(s.totalCost).toBe(50);
    expect(s.uniqueProjects).toBe(2);
  });
});

describe("time-tracker suggestProjects", () => {
  it("returns unique project names sorted alphabetically", () => {
    const entries = [
      makeEntry({ projectName: "Beta" }),
      makeEntry({ projectName: "Alpha" }),
      makeEntry({ projectName: "Beta" }),
      makeEntry({ projectName: "Gamma" }),
    ];
    const s = suggestProjects(entries);
    expect(s).toEqual(["Alpha", "Beta", "Gamma"]);
  });
  it("respects limit (top N by frequency then alphabetical)", () => {
    const entries = [
      makeEntry({ projectName: "Common" }),
      makeEntry({ projectName: "Common" }),
      makeEntry({ projectName: "Common" }),
      makeEntry({ projectName: "Rare" }),
    ];
    // Top 1 by frequency = Common, then alphabetical within that
    const s = suggestProjects(entries, 1);
    expect(s).toEqual(["Common"]);
  });
  it("skips blank project names", () => {
    const entries = [
      makeEntry({ projectName: "" }),
      makeEntry({ projectName: "Real" }),
    ];
    expect(suggestProjects(entries)).toEqual(["Real"]);
  });
});

// ---- Rendering ----

describe("time-tracker formatCost", () => {
  it("formats positive amount", () => {
    expect(formatCost(125.5)).toBe("$125.50");
  });
  it("formats 0", () => {
    expect(formatCost(0)).toBe("$0.00");
  });
});

describe("time-tracker renderText", () => {
  it("renders empty state", () => {
    expect(renderText([])).toContain("No time entries yet.");
  });
  it("renders report with stats and sections", () => {
    const entries = [
      makeEntry({ taskName: "Write code", projectName: "API", billable: true, hourlyRate: 100, startMs: Date.UTC(2024, 0, 15, 9, 0, 0), endMs: Date.UTC(2024, 0, 15, 11, 0, 0) }),
    ];
    const text = renderText(entries);
    expect(text).toContain("TIME TRACKER REPORT");
    expect(text).toContain("Total entries:    1");
    expect(text).toContain("BY DAY");
    expect(text).toContain("Write code");
    expect(text).toContain("Generated by UnQTools");
  });
});

describe("time-tracker renderCsv", () => {
  it("renders header row", () => {
    const csv = renderCsv([]);
    expect(csv.split("\n")[0]).toBe("date,task,project,duration_hours,duration_hms,billable,rate,cost,notes");
  });
  it("renders entry rows", () => {
    const entries = [
      makeEntry({ taskName: "Code", projectName: "API", billable: true, hourlyRate: 100, startMs: 1000, endMs: 1000 + MS_PER_HOUR, notes: "fix bug" }),
    ];
    const csv = renderCsv(entries);
    expect(csv).toContain("Code");
    expect(csv).toContain("API");
    expect(csv).toContain("yes");
    expect(csv).toContain("100.00");
    expect(csv).toContain("fix bug");
  });
  it("escapes commas in notes", () => {
    const entries = [
      makeEntry({ taskName: "T", notes: "has, comma", startMs: 1000, endMs: 2000 }),
    ];
    const csv = renderCsv(entries);
    expect(csv).toContain('"has, comma"');
  });
});

// ---- History (localStorage) ----

describe("time-tracker entries (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadEntries()).toEqual([]);
  });
  it("saves and loads", () => {
    const e = makeEntry({ taskName: "Task A" });
    saveEntries([e]);
    const loaded = loadEntries();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].taskName).toBe("Task A");
  });
  it("caps at 100", () => {
    const entries: TimeEntry[] = [];
    for (let i = 0; i < 150; i++) {
      entries.push(makeEntry({ id: `id_${i}`, taskName: `Task ${i}` }));
    }
    saveEntries(entries);
    expect(loadEntries()).toHaveLength(100);
  });
  it("addEntry prepends", () => {
    const a = makeEntry({ id: "a", taskName: "A" });
    const b = makeEntry({ id: "b", taskName: "B" });
    addEntry(a);
    addEntry(b);
    const loaded = loadEntries();
    expect(loaded[0].id).toBe("b");
    expect(loaded[1].id).toBe("a");
  });
  it("removeEntry filters by id", () => {
    addEntry(makeEntry({ id: "keep", taskName: "Keep" }));
    addEntry(makeEntry({ id: "remove", taskName: "Remove" }));
    removeEntry("remove");
    const loaded = loadEntries();
    expect(loaded.find((e) => e.id === "remove")).toBeUndefined();
    expect(loaded.find((e) => e.id === "keep")).toBeDefined();
  });
  it("clears entries", () => {
    addEntry(makeEntry({ id: "x", taskName: "X" }));
    clearEntries();
    expect(loadEntries()).toEqual([]);
  });
});

// ---- Shareable URL ----

describe("time-tracker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const entries = [makeEntry({ taskName: "Share me" })];
    const url = buildShareUrl(entries);
    expect(url).toContain("entries=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("empty entries → bare query (no entries param)", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl([]);
    // Empty entry list intentionally omits the entries param
    expect(url).not.toContain("entries=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to entries", () => {
    const entries = [
      makeEntry({ id: "abc", taskName: "Parsed Task", projectName: "Proj", billable: true, hourlyRate: 75 }),
    ];
    const url = buildShareUrl(entries);
    const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : url.replace(/^\?/, "");
    const parsed = parseShareUrl(hash);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].taskName).toBe("Parsed Task");
    expect(parsed[0].billable).toBe(true);
    expect(parsed[0].hourlyRate).toBe(75);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual([]);
  });
  it("handles malformed JSON gracefully", () => {
    expect(parseShareUrl("entries=not-json")).toEqual([]);
  });
  it("filters invalid entries (missing taskName/startMs)", () => {
    // Construct a JSON with a malformed entry and a valid one
    const raw = JSON.stringify([
      { id: "ok", taskName: "OK", startMs: 1000, endMs: 2000 },
      { id: "bad" }, // missing taskName + startMs
    ]);
    const hash = `entries=${encodeURIComponent(raw)}`;
    const parsed = parseShareUrl(hash);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].taskName).toBe("OK");
  });
  it("sanitizes unknown rounding values to 'none'", () => {
    const raw = JSON.stringify([
      { id: "x", taskName: "X", startMs: 1000, endMs: 2000, rounding: "bogus" },
    ]);
    const parsed = parseShareUrl(`entries=${encodeURIComponent(raw)}`);
    expect(parsed[0].rounding).toBe("none");
  });
});

// Suppress unused-import lint
export type _Unused = RoundingPreset | TimeEntry | EntryDraft;

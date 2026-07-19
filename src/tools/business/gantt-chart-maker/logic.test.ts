import { describe, it, expect, beforeEach } from "vitest";
import {
  COLOR_PRESETS,
  COLOR_PRESET_LABELS,
  PRIORITY_PALETTE,
  ASCII_MAX_WIDTH,
  normalizeDate,
  daysBetween,
  addDays,
  dayOfWeek,
  isWeekend,
  splitCsvRow,
  parseTasks,
  calcProjectDurationDays,
  calcTaskOffsetDays,
  calcTaskDurationDays,
  computeTaskTimings,
  validateDateRanges,
  detectOverlaps,
  getTaskColor,
  renderAsciiGantt,
  renderHtmlGantt,
  renderText,
  renderCsv,
  summaryStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ColorPreset,
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

describe("gantt-chart-maker constants", () => {
  it("has 3 color presets", () => {
    expect(COLOR_PRESETS).toEqual(["rainbow", "blue-scale", "priority-based"]);
  });
  it("has labels for each preset", () => {
    expect(Object.keys(COLOR_PRESET_LABELS)).toHaveLength(3);
    expect(COLOR_PRESET_LABELS.rainbow).toBe("Rainbow");
  });
  it("has priority palette with multiple colors", () => {
    expect(PRIORITY_PALETTE.length).toBeGreaterThanOrEqual(4);
  });
  it("has ASCII_MAX_WIDTH", () => {
    expect(ASCII_MAX_WIDTH).toBeGreaterThan(10);
    expect(ASCII_MAX_WIDTH).toBeLessThanOrEqual(120);
  });
});

describe("gantt-chart-maker normalizeDate", () => {
  it("returns canonical YYYY-MM-DD for valid date", () => {
    expect(normalizeDate("2026-07-20")).toBe("2026-07-20");
  });
  it("returns empty for invalid date", () => {
    expect(normalizeDate("")).toBe("");
    expect(normalizeDate("not-a-date")).toBe("");
    expect(normalizeDate("2026-13-01")).toBe("");
    expect(normalizeDate("2026-02-31")).toBe("");
  });
  it("rejects wrong format", () => {
    expect(normalizeDate("20-07-2026")).toBe("");
    expect(normalizeDate("2026/07/20")).toBe("");
  });
});

describe("gantt-chart-maker daysBetween", () => {
  it("computes positive diff", () => {
    expect(daysBetween("2026-07-25", "2026-07-20")).toBe(5);
  });
  it("computes negative diff", () => {
    expect(daysBetween("2026-07-20", "2026-07-25")).toBe(-5);
  });
  it("returns 0 for same date", () => {
    expect(daysBetween("2026-07-20", "2026-07-20")).toBe(0);
  });
  it("returns 0 for missing input", () => {
    expect(daysBetween("", "2026-07-20")).toBe(0);
    expect(daysBetween("2026-07-20", "")).toBe(0);
  });
});

describe("gantt-chart-maker addDays", () => {
  it("adds days", () => {
    expect(addDays("2026-07-20", 5)).toBe("2026-07-25");
  });
  it("subtracts days via negative", () => {
    expect(addDays("2026-07-25", -5)).toBe("2026-07-20");
  });
  it("handles month rollover", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
  });
  it("handles year rollover", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("returns empty for empty input", () => {
    expect(addDays("", 5)).toBe("");
  });
});

describe("gantt-chart-maker dayOfWeek + isWeekend", () => {
  it("returns correct day-of-week (UTC)", () => {
    // 2026-07-24 is a Friday (UTC)
    expect(dayOfWeek("2026-07-24")).toBe(5);
    // 2026-07-25 is a Saturday
    expect(dayOfWeek("2026-07-25")).toBe(6);
    // 2026-07-26 is a Sunday
    expect(dayOfWeek("2026-07-26")).toBe(0);
    // 2026-07-27 is a Monday
    expect(dayOfWeek("2026-07-27")).toBe(1);
  });
  it("isWeekend returns true for Sat and Sun", () => {
    expect(isWeekend("2026-07-25")).toBe(true);
    expect(isWeekend("2026-07-26")).toBe(true);
    expect(isWeekend("2026-07-27")).toBe(false);
  });
  it("isWeekend returns false for weekday", () => {
    expect(isWeekend("2026-07-24")).toBe(false);
  });
  it("dayOfWeek returns -1 for invalid input", () => {
    expect(dayOfWeek("")).toBe(-1);
    expect(dayOfWeek("xyz")).toBe(-1);
  });
});

describe("gantt-chart-maker splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
});

describe("gantt-chart-maker parseTasks", () => {
  it("parses valid lines", () => {
    const text = "Design,2026-07-01,2026-07-05,100\nDevelop,2026-07-06,2026-07-15,60";
    const { tasks, errors } = parseTasks(text);
    expect(tasks).toHaveLength(2);
    expect(errors).toHaveLength(0);
    expect(tasks[0].title).toBe("Design");
    expect(tasks[0].startDate).toBe("2026-07-01");
    expect(tasks[0].endDate).toBe("2026-07-05");
    expect(tasks[0].progress).toBe(100);
    expect(tasks[1].progress).toBe(60);
  });
  it("defaults progress to 0 when missing", () => {
    const { tasks } = parseTasks("Design,2026-07-01,2026-07-05");
    expect(tasks[0].progress).toBe(0);
  });
  it("clamps progress to 0..100", () => {
    const { tasks } = parseTasks("A,2026-07-01,2026-07-02,150\nB,2026-07-03,2026-07-04,-10");
    expect(tasks[0].progress).toBe(100);
    expect(tasks[1].progress).toBe(0);
  });
  it("reports error for too few fields", () => {
    const { tasks, errors } = parseTasks("Only title");
    expect(tasks).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("needs title,start_date,end_date");
  });
  it("reports error for invalid start date", () => {
    const { tasks, errors } = parseTasks("T,bad,2026-07-05,50");
    expect(tasks).toHaveLength(0);
    expect(errors[0]).toContain("invalid start_date");
  });
  it("reports error for invalid end date", () => {
    const { tasks, errors } = parseTasks("T,2026-07-01,bad,50");
    expect(tasks).toHaveLength(0);
    expect(errors[0]).toContain("invalid end_date");
  });
  it("reports error when end before start", () => {
    const { tasks, errors } = parseTasks("T,2026-07-10,2026-07-01,50");
    expect(tasks).toHaveLength(0);
    expect(errors[0]).toContain("is before");
  });
  it("skips empty lines", () => {
    const { tasks } = parseTasks("A,2026-07-01,2026-07-02\n\nB,2026-07-03,2026-07-04");
    expect(tasks).toHaveLength(2);
  });
  it("returns empty for empty input", () => {
    expect(parseTasks("")).toEqual({ tasks: [], errors: [] });
    expect(parseTasks("   \n  ")).toEqual({ tasks: [], errors: [] });
  });
  it("handles quoted titles with commas", () => {
    const { tasks } = parseTasks('"Task, with comma",2026-07-01,2026-07-02,0');
    expect(tasks[0].title).toBe("Task, with comma");
  });
});

describe("gantt-chart-maker calcProjectDurationDays", () => {
  it("returns inclusive day count", () => {
    expect(calcProjectDurationDays("2026-07-01", "2026-07-10")).toBe(10);
  });
  it("returns 1 for same day", () => {
    expect(calcProjectDurationDays("2026-07-01", "2026-07-01")).toBe(1);
  });
  it("returns 0 if end < start", () => {
    expect(calcProjectDurationDays("2026-07-10", "2026-07-01")).toBe(0);
  });
  it("returns 0 for missing input", () => {
    expect(calcProjectDurationDays("", "2026-07-10")).toBe(0);
    expect(calcProjectDurationDays("2026-07-01", "")).toBe(0);
  });
  it("handles month boundaries", () => {
    expect(calcProjectDurationDays("2026-07-28", "2026-08-03")).toBe(7);
  });
});

describe("gantt-chart-maker calcTaskOffsetDays", () => {
  it("returns positive offset for later task", () => {
    expect(calcTaskOffsetDays("2026-07-10", "2026-07-01")).toBe(9);
  });
  it("returns 0 for task on project start", () => {
    expect(calcTaskOffsetDays("2026-07-01", "2026-07-01")).toBe(0);
  });
  it("returns negative offset for task before project start", () => {
    expect(calcTaskOffsetDays("2026-06-30", "2026-07-01")).toBe(-1);
  });
});

describe("gantt-chart-maker calcTaskDurationDays", () => {
  it("returns inclusive duration", () => {
    expect(calcTaskDurationDays("2026-07-01", "2026-07-05")).toBe(5);
  });
  it("returns 1 for same day", () => {
    expect(calcTaskDurationDays("2026-07-01", "2026-07-01")).toBe(1);
  });
  it("returns 0 for end before start", () => {
    expect(calcTaskDurationDays("2026-07-10", "2026-07-01")).toBe(0);
  });
});

describe("gantt-chart-maker computeTaskTimings", () => {
  it("computes offsetDays and durationDays for each task", () => {
    const parsed = parseTasks("Design,2026-07-01,2026-07-05,100\nDevelop,2026-07-06,2026-07-15,60");
    const timed = computeTaskTimings(parsed.tasks, "2026-07-01");
    expect(timed[0].offsetDays).toBe(0);
    expect(timed[0].durationDays).toBe(5);
    expect(timed[1].offsetDays).toBe(5);
    expect(timed[1].durationDays).toBe(10);
  });
  it("does not mutate input", () => {
    const parsed = parseTasks("Design,2026-07-01,2026-07-05,100");
    const before = parsed.tasks[0].offsetDays;
    computeTaskTimings(parsed.tasks, "2026-07-01");
    expect(parsed.tasks[0].offsetDays).toBe(before);
  });
});

describe("gantt-chart-maker validateDateRanges", () => {
  it("returns empty when all tasks within range", () => {
    const parsed = parseTasks("Design,2026-07-02,2026-07-05,100");
    const errs = validateDateRanges(parsed.tasks, "2026-07-01", "2026-07-10");
    expect(errs).toEqual([]);
  });
  it("reports task starting before project start", () => {
    const parsed = parseTasks("Design,2026-06-30,2026-07-05,100");
    const errs = validateDateRanges(parsed.tasks, "2026-07-01", "2026-07-10");
    expect(errs.length).toBe(1);
    expect(errs[0]).toContain("starts before");
  });
  it("reports task ending after project end", () => {
    const parsed = parseTasks("Design,2026-07-02,2026-07-15,100");
    const errs = validateDateRanges(parsed.tasks, "2026-07-01", "2026-07-10");
    expect(errs.length).toBe(1);
    expect(errs[0]).toContain("ends after");
  });
  it("reports invalid project range", () => {
    const parsed = parseTasks("Design,2026-07-02,2026-07-05,100");
    const errs = validateDateRanges(parsed.tasks, "2026-07-10", "2026-07-01");
    expect(errs.length).toBe(1);
    expect(errs[0]).toContain("before start");
  });
  it("reports missing project dates", () => {
    const errs = validateDateRanges([], "", "");
    expect(errs[0]).toContain("required");
  });
});

describe("gantt-chart-maker detectOverlaps", () => {
  it("detects overlapping tasks", () => {
    const parsed = parseTasks("A,2026-07-01,2026-07-10,0\nB,2026-07-05,2026-07-15,0");
    const overlaps = detectOverlaps(parsed.tasks);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].titleA).toBe("A");
    expect(overlaps[0].titleB).toBe("B");
    expect(overlaps[0].rangeStart).toBe("2026-07-05");
    expect(overlaps[0].rangeEnd).toBe("2026-07-10");
  });
  it("returns empty for non-overlapping tasks", () => {
    const parsed = parseTasks("A,2026-07-01,2026-07-05,0\nB,2026-07-06,2026-07-10,0");
    expect(detectOverlaps(parsed.tasks)).toHaveLength(0);
  });
  it("detects adjacent days as overlap (inclusive)", () => {
    const parsed = parseTasks("A,2026-07-01,2026-07-05,0\nB,2026-07-05,2026-07-10,0");
    expect(detectOverlaps(parsed.tasks)).toHaveLength(1);
  });
  it("detects multiple overlaps with 3+ tasks", () => {
    const parsed = parseTasks("A,2026-07-01,2026-07-10,0\nB,2026-07-05,2026-07-15,0\nC,2026-07-08,2026-07-20,0");
    const o = detectOverlaps(parsed.tasks);
    expect(o).toHaveLength(3); // A-B, A-C, B-C
  });
  it("returns empty for empty list", () => {
    expect(detectOverlaps([])).toEqual([]);
  });
});

describe("gantt-chart-maker getTaskColor", () => {
  it("returns HSL for rainbow preset", () => {
    const c = getTaskColor("rainbow", 0, 3);
    expect(c).toMatch(/^hsl\(/);
  });
  it("returns HSL for blue-scale preset", () => {
    const c = getTaskColor("blue-scale", 0, 3);
    expect(c).toMatch(/^hsl\(210/);
  });
  it("returns palette color for priority-based preset", () => {
    const c = getTaskColor("priority-based", 0, 3);
    expect(c).toBe(PRIORITY_PALETTE[0]);
  });
  it("cycles palette for priority-based preset", () => {
    const c = getTaskColor("priority-based", PRIORITY_PALETTE.length, 3);
    expect(c).toBe(PRIORITY_PALETTE[0]);
  });
  it("handles index 0 with total 1", () => {
    expect(() => getTaskColor("rainbow", 0, 1)).not.toThrow();
  });
});

describe("gantt-chart-maker renderAsciiGantt", () => {
  const opts = { showProgress: true, showToday: false, showWeekends: false, colorPreset: "rainbow" as ColorPreset, today: "" };
  it("renders ASCII chart with header and rows", () => {
    const parsed = parseTasks("Design,2026-07-01,2026-07-05,100\nDevelop,2026-07-06,2026-07-15,60");
    const txt = renderAsciiGantt(parsed.tasks, "2026-07-01", "2026-07-15", opts);
    expect(txt).toContain("Project: 2026-07-01 → 2026-07-15");
    expect(txt).toContain("Design");
    expect(txt).toContain("Develop");
    expect(txt).toContain("100%");
    expect(txt).toContain("60%");
    expect(txt).toContain("█"); // filled
    expect(txt).toContain("░"); // remaining (60% task has remaining)
  });
  it("shows today marker when showToday and within range", () => {
    const parsed = parseTasks("Design,2026-07-01,2026-07-05,100");
    const txt = renderAsciiGantt(parsed.tasks, "2026-07-01", "2026-07-10", {
      ...opts, showToday: true, today: "2026-07-03",
    });
    expect(txt).toContain("Today: 2026-07-03");
    expect(txt).toContain("T");
    expect(txt).toContain("▼");
  });
  it("hides today marker when today is outside range", () => {
    const parsed = parseTasks("Design,2026-07-01,2026-07-05,100");
    const txt = renderAsciiGantt(parsed.tasks, "2026-07-01", "2026-07-10", {
      ...opts, showToday: true, today: "2026-12-31",
    });
    expect(txt).not.toContain("Today:");
  });
  it("shows weekend dots when showWeekends", () => {
    const parsed = parseTasks("Design,2026-07-01,2026-07-10,100");
    const txt = renderAsciiGantt(parsed.tasks, "2026-07-01", "2026-07-10", {
      ...opts, showWeekends: true,
    });
    // 2026-07-04 is Sat, 2026-07-05 is Sun — should appear as · in the ruler
    expect(txt).toContain("·");
  });
  it("returns placeholder for missing project dates", () => {
    expect(renderAsciiGantt([], "", "", opts)).toContain("set project start and end dates");
  });
  it("returns placeholder for invalid project range", () => {
    expect(renderAsciiGantt([], "2026-07-10", "2026-07-01", opts)).toContain("invalid project range");
  });
  it("returns placeholder for empty tasks", () => {
    expect(renderAsciiGantt([], "2026-07-01", "2026-07-10", opts)).toContain("no tasks");
  });
});

describe("gantt-chart-maker renderHtmlGantt", () => {
  const opts = { showProgress: true, showToday: false, showWeekends: false, colorPreset: "rainbow" as ColorPreset, today: "" };
  it("renders HTML with table and task rows", () => {
    const parsed = parseTasks("Design,2026-07-01,2026-07-05,100\nDevelop,2026-07-06,2026-07-15,60");
    const html = renderHtmlGantt(parsed.tasks, "2026-07-01", "2026-07-15", opts);
    expect(html).toContain("<table>");
    expect(html).toContain("Design");
    expect(html).toContain("Develop");
    expect(html).toContain("bar");
    expect(html).toContain("hsl("); // rainbow color
  });
  it("includes progress overlay when showProgress", () => {
    const parsed = parseTasks("Design,2026-07-01,2026-07-05,50");
    const html = renderHtmlGantt(parsed.tasks, "2026-07-01", "2026-07-10", opts);
    expect(html).toContain("progress-overlay");
  });
  it("omits progress overlay element when showProgress is false", () => {
    const parsed = parseTasks("Design,2026-07-01,2026-07-05,50");
    const html = renderHtmlGantt(parsed.tasks, "2026-07-01", "2026-07-10", { ...opts, showProgress: false });
    // CSS class definition is allowed; only the actual <div class="progress-overlay"> element should be absent
    expect(html).not.toContain('<div class="progress-overlay"');
  });
  it("includes today-marker when today is in range", () => {
    const parsed = parseTasks("Design,2026-07-01,2026-07-05,50");
    const html = renderHtmlGantt(parsed.tasks, "2026-07-01", "2026-07-10", {
      ...opts, showToday: true, today: "2026-07-03",
    });
    expect(html).toContain("today-marker");
  });
  it("escapes HTML in titles", () => {
    const parsed = parseTasks("A & B,2026-07-01,2026-07-05,0");
    const html = renderHtmlGantt(parsed.tasks, "2026-07-01", "2026-07-10", opts);
    expect(html).toContain("A &amp; B");
    expect(html).not.toContain("<script");
  });
  it("returns placeholder for missing project dates", () => {
    expect(renderHtmlGantt([], "", "", opts)).toContain("Set project start");
  });
});

describe("gantt-chart-maker renderText", () => {
  it("renders full text report with overlaps", () => {
    const parsed = parseTasks("A,2026-07-01,2026-07-05,100\nB,2026-07-04,2026-07-10,50");
    const txt = renderText(parsed.tasks, "2026-07-01", "2026-07-10");
    expect(txt).toContain("GANTT CHART REPORT");
    expect(txt).toContain("Duration: 10 days");
    expect(txt).toContain("#1 A");
    expect(txt).toContain("#2 B");
    expect(txt).toContain("Offset:");
    expect(txt).toContain("Duration:");
    expect(txt).toContain("Overlaps: 1");
    expect(txt).toContain('"A" ⨯ "B"');
  });
  it("shows no overlaps message when none", () => {
    const parsed = parseTasks("A,2026-07-01,2026-07-05,100");
    const txt = renderText(parsed.tasks, "2026-07-01", "2026-07-10");
    expect(txt).toContain("Overlaps: none");
  });
});

describe("gantt-chart-maker renderCsv", () => {
  it("renders header", () => {
    expect(renderCsv([], "2026-07-01")).toContain("title,start_date,end_date,duration_days,offset_days,progress");
  });
  it("renders task rows with computed timings", () => {
    const parsed = parseTasks("Design,2026-07-01,2026-07-05,100");
    const csv = renderCsv(parsed.tasks, "2026-07-01");
    expect(csv).toContain("Design,2026-07-01,2026-07-05,5,0,100");
  });
  it("escapes commas in title", () => {
    const parsed = parseTasks('"Task, with comma",2026-07-01,2026-07-02,0');
    const csv = renderCsv(parsed.tasks, "2026-07-01");
    expect(csv).toContain('"Task, with comma"');
  });
});

describe("gantt-chart-maker summaryStats", () => {
  it("computes summary correctly", () => {
    const parsed = parseTasks("Done,2026-07-01,2026-07-05,100\nHalf,2026-07-06,2026-07-10,50\nNew,2026-07-11,2026-07-15,0");
    const stats = summaryStats(parsed.tasks, "2026-07-01", "2026-07-15");
    expect(stats.totalTasks).toBe(3);
    expect(stats.projectDurationDays).toBe(15);
    expect(stats.completedTasks).toBe(1);
    expect(stats.inProgressTasks).toBe(1);
    expect(stats.notStartedTasks).toBe(1);
    expect(stats.overlapCount).toBe(0);
    expect(stats.avgProgress).toBe(50); // (100+50+0)/3 = 50
  });
  it("counts overlaps", () => {
    const parsed = parseTasks("A,2026-07-01,2026-07-10,0\nB,2026-07-05,2026-07-15,0");
    expect(summaryStats(parsed.tasks, "2026-07-01", "2026-07-15").overlapCount).toBe(1);
  });
  it("returns zeros for empty input", () => {
    const stats = summaryStats([], "2026-07-01", "2026-07-10");
    expect(stats.totalTasks).toBe(0);
    expect(stats.avgProgress).toBe(0);
  });
});

describe("gantt-chart-maker history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, projectStartDate: "2026-07-01", projectEndDate: "2026-07-15", taskCount: 3, projectDurationDays: 15 });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].taskCount).toBe(3);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, projectStartDate: "2026-07-01", projectEndDate: "2026-07-15", taskCount: i, projectDurationDays: 15 });
    }
    expect(loadHistory()).toHaveLength(20);
    expect(loadHistory()[0].taskCount).toBe(24);
  });
  it("clears", () => {
    saveHistory({ ts: 1, projectStartDate: "2026-07-01", projectEndDate: "2026-07-15", taskCount: 1, projectDurationDays: 15 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("gantt-chart-maker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      projectStartDate: "2026-07-01",
      projectEndDate: "2026-07-15",
      tasksText: "Design,2026-07-01,2026-07-05,100",
      showProgress: true,
      showToday: false,
      colorPreset: "rainbow",
    });
    expect(url).toContain("start=2026-07-01");
    expect(url).toContain("end=2026-07-15");
    expect(url).toContain("progress=1");
    expect(url).toContain("color=rainbow");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("start=2026-07-01&end=2026-07-15&tasks=A%2C2026-07-01%2C2026-07-05%2C100&progress=1&today=1&color=blue-scale");
    expect(p.projectStartDate).toBe("2026-07-01");
    expect(p.projectEndDate).toBe("2026-07-15");
    expect(p.tasksText).toBe("A,2026-07-01,2026-07-05,100");
    expect(p.showProgress).toBe(true);
    expect(p.showToday).toBe(true);
    expect(p.colorPreset).toBe("blue-scale");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown color preset", () => {
    const p = parseShareUrl("color=unknown");
    expect(p.colorPreset).toBeUndefined();
  });
  it("omits progress/today when not set", () => {
    const p = parseShareUrl("start=2026-07-01&end=2026-07-15");
    expect(p.showProgress).toBe(false);
    expect(p.showToday).toBe(false);
  });
});

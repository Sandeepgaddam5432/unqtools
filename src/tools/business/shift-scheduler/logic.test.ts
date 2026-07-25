import { describe, it, expect } from "vitest";
import {
  parseTime, shiftMinutes, totalHours, computeCoverage, formatTime,
  detectGaps, perEmployeeHours, detectConflicts, coverageStats,
  detectOvertime, batchValidate, shiftsToCsv, coverageToCsv,
  SHIFT_TEMPLATES, fmt,
} from "./logic";

describe("parseTime", () => {
  it("parses HH:MM", () => { expect(parseTime("09:30")).toBe(570); });
  it("rejects invalid", () => { expect(parseTime("bad")).toBeNull(); });
  it("rejects out-of-range", () => { expect(parseTime("25:00")).toBeNull(); });
});

describe("shiftMinutes", () => {
  it("computes start/end", () => {
    const r = shiftMinutes({ employee: "A", start: "09:00", end: "17:00" });
    if ("error" in r) throw new Error("err");
    expect(r.start).toBe(540); expect(r.end).toBe(1020);
  });
  it("handles overnight", () => {
    const r = shiftMinutes({ employee: "A", start: "22:00", end: "06:00" });
    if ("error" in r) throw new Error("err");
    expect(r.end - r.start).toBe(8 * 60);
  });
  it("errors on invalid input", () => {
    expect(shiftMinutes({ employee: "A", start: "bad", end: "17:00" })).toHaveProperty("error");
  });
});

describe("totalHours", () => {
  it("sums hours", () => {
    expect(totalHours([{ employee: "A", start: "09:00", end: "17:00" }])).toBe(8);
  });
  it("handles multiple shifts", () => {
    expect(totalHours([
      { employee: "A", start: "09:00", end: "12:00" },
      { employee: "B", start: "10:00", end: "14:00" },
    ])).toBe(7);
  });
});

describe("computeCoverage", () => {
  it("returns coverage slots", () => {
    const slots = computeCoverage([
      { employee: "A", start: "09:00", end: "11:00" },
      { employee: "B", start: "10:00", end: "12:00" },
    ]);
    if ("error" in slots) throw new Error("err");
    expect(slots.length).toBe(3);
    expect(slots.find((s) => s.count === 2)).toBeTruthy();
  });
  it("returns empty for no shifts", () => {
    expect(computeCoverage([])).toEqual([]);
  });
});

describe("detectGaps", () => {
  it("detects uncovered periods", () => {
    const gaps = detectGaps([
      { employee: "A", start: "09:00", end: "11:00" },
      { employee: "A", start: "13:00", end: "15:00" },
    ], 1);
    if ("error" in gaps) throw new Error("err");
    expect(gaps.length).toBeGreaterThan(0);
  });
});

describe("perEmployeeHours", () => {
  it("groups by employee", () => {
    const m = perEmployeeHours([
      { employee: "A", start: "09:00", end: "11:00" },
      { employee: "A", start: "13:00", end: "15:00" },
      { employee: "B", start: "10:00", end: "12:00" },
    ]);
    if ("error" in m) throw new Error("err");
    expect(m.A).toBe(4);
    expect(m.B).toBe(2);
  });
});

describe("detectConflicts", () => {
  it("detects overlapping shifts for same employee", () => {
    const c = detectConflicts([
      { employee: "A", start: "09:00", end: "13:00" },
      { employee: "A", start: "12:00", end: "16:00" },
    ]);
    if ("error" in c) throw new Error("err");
    expect(c.length).toBe(1);
  });
  it("returns empty when no conflicts", () => {
    const c = detectConflicts([
      { employee: "A", start: "09:00", end: "11:00" },
      { employee: "A", start: "13:00", end: "15:00" },
    ]);
    if ("error" in c) throw new Error("err");
    expect(c.length).toBe(0);
  });
});

describe("coverageStats", () => {
  it("computes min/max/avg", () => {
    const stats = coverageStats([
      { startMin: 540, endMin: 600, count: 1 },
      { startMin: 600, endMin: 660, count: 2 },
      { startMin: 660, endMin: 720, count: 1 },
    ]);
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(2);
    expect(stats.avg).toBeGreaterThan(0);
  });
  it("returns zeros for empty input", () => {
    expect(coverageStats([])).toEqual({ min: 0, max: 0, avg: 0, totalMin: 0 });
  });
});

describe("detectOvertime", () => {
  it("flags overtime beyond threshold", () => {
    const r = detectOvertime([
      { employee: "A", start: "08:00", end: "20:00" },
    ], 8);
    if ("error" in r) throw new Error("err");
    expect(r[0]!.hours).toBe(12);
    expect(r[0]!.overtime).toBe(4);
  });
  it("returns 0 overtime when under threshold", () => {
    const r = detectOvertime([{ employee: "A", start: "09:00", end: "11:00" }], 8);
    if ("error" in r) throw new Error("err");
    expect(r[0]!.overtime).toBe(0);
  });
});

describe("batchValidate", () => {
  it("validates each shift", () => {
    const r = batchValidate([
      { employee: "A", start: "09:00", end: "17:00" },
      { employee: "B", start: "bad", end: "17:00" },
    ]);
    expect(r[0]!.ok).toBe(true);
    expect(r[1]!.ok).toBe(false);
  });
});

describe("shiftsToCsv / coverageToCsv", () => {
  it("renders shifts CSV with header", () => {
    const csv = shiftsToCsv([{ employee: "A", start: "09:00", end: "17:00" }]);
    expect(csv.split("\n")[0]).toBe("employee,start,end");
    expect(csv).toContain("A,09:00,17:00");
  });
  it("renders coverage CSV with header", () => {
    const csv = coverageToCsv([{ startMin: 540, endMin: 600, count: 1 }]);
    expect(csv.split("\n")[0]).toBe("start,end,count");
    expect(csv).toContain("09:00,10:00,1");
  });
});

describe("SHIFT_TEMPLATES", () => {
  it("has at least 4 templates", () => {
    expect(SHIFT_TEMPLATES.length).toBeGreaterThanOrEqual(4);
  });
});

describe("formatTime", () => {
  it("formats minutes", () => { expect(formatTime(570)).toBe("09:30"); });
  it("wraps overnight", () => { expect(formatTime(1440 + 60)).toBe("01:00"); });
});

describe("fmt", () => {
  it("trims precision", () => { expect(fmt(1.23456, 2)).toBe("1.23"); });
  it("em-dash for NaN", () => { expect(fmt(NaN)).toBe("—"); });
});

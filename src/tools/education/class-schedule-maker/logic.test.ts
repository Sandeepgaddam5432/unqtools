import { describe, it, expect } from "vitest";
import {
  createSlot,
  timeToMinutes,
  minutesToTime,
  slotDuration,
  findConflicts,
  findRoomConflicts,
  findTeacherConflicts,
  groupByDay,
  totalWeeklyHours,
  hoursPerSubject,
  assignRoom,
  validateSlot,
  exportScheduleCSV,
  exportScheduleICS,
  findFreeBlocks,
  suggestColor,
  DAYS,
} from "./logic";

describe("class-schedule-maker createSlot", () => {
  it("creates a slot with subject", () => {
    const s = createSlot("Mon", 540, 600, "Math");
    expect(s.subject).toBe("Math");
    expect(s.day).toBe("Mon");
  });
  it("defaults subject to Untitled when empty", () => {
    expect(createSlot("Tue", 540, 600, "").subject).toBe("Untitled");
  });
});

describe("class-schedule-maker timeToMinutes", () => {
  it("parses 09:00 to 540", () => {
    expect(timeToMinutes("09:00")).toBe(540);
  });
  it("parses 13:30 to 810", () => {
    expect(timeToMinutes("13:30")).toBe(810);
  });
  it("returns 0 for invalid format", () => {
    expect(timeToMinutes("abc")).toBe(0);
  });
});

describe("class-schedule-maker minutesToTime", () => {
  it("formats 540 as 09:00", () => {
    expect(minutesToTime(540)).toBe("09:00");
  });
  it("formats 810 as 13:30", () => {
    expect(minutesToTime(810)).toBe("13:30");
  });
  it("roundtrips with timeToMinutes", () => {
    const t = "14:45";
    expect(minutesToTime(timeToMinutes(t))).toBe(t);
  });
});

describe("class-schedule-maker slotDuration", () => {
  it("computes duration in minutes", () => {
    expect(slotDuration(createSlot("Mon", 540, 600, "X"))).toBe(60);
  });
});

describe("class-schedule-maker findConflicts", () => {
  it("finds time overlap on same day", () => {
    const a = createSlot("Mon", 540, 600, "A");
    const b = createSlot("Mon", 590, 650, "B");
    expect(findConflicts([a, b]).length).toBe(1);
  });
  it("returns empty when no overlap", () => {
    const a = createSlot("Mon", 540, 600, "A");
    const b = createSlot("Mon", 600, 660, "B");
    expect(findConflicts([a, b])).toEqual([]);
  });
  it("returns empty across different days", () => {
    const a = createSlot("Mon", 540, 600, "A");
    const b = createSlot("Tue", 540, 600, "B");
    expect(findConflicts([a, b])).toEqual([]);
  });
});

describe("class-schedule-maker findRoomConflicts", () => {
  it("detects same-room double-book", () => {
    const a = createSlot("Mon", 540, 600, "A", "R1");
    const b = createSlot("Mon", 590, 650, "B", "R1");
    expect(findRoomConflicts([a, b]).length).toBe(1);
  });
  it("ignores different rooms", () => {
    const a = createSlot("Mon", 540, 600, "A", "R1");
    const b = createSlot("Mon", 590, 650, "B", "R2");
    expect(findRoomConflicts([a, b])).toEqual([]);
  });
});

describe("class-schedule-maker findTeacherConflicts", () => {
  it("detects same teacher double-book", () => {
    const a = createSlot("Mon", 540, 600, "A", "R1", "Mr Smith");
    const b = createSlot("Mon", 590, 650, "B", "R2", "Mr Smith");
    expect(findTeacherConflicts([a, b]).length).toBe(1);
  });
});

describe("class-schedule-maker groupByDay", () => {
  it("groups and sorts by start time", () => {
    const a = createSlot("Mon", 600, 660, "Late");
    const b = createSlot("Mon", 540, 600, "Early");
    const grouped = groupByDay([a, b]);
    expect(grouped.Mon[0].subject).toBe("Early");
    expect(grouped.Mon[1].subject).toBe("Late");
  });
  it("has 7 days always", () => {
    expect(DAYS.length).toBe(7);
  });
});

describe("class-schedule-maker totalWeeklyHours", () => {
  it("sums slot durations", () => {
    const slots = [createSlot("Mon", 540, 600, "A"), createSlot("Tue", 540, 660, "B")];
    expect(totalWeeklyHours(slots)).toBe(3);
  });
});

describe("class-schedule-maker hoursPerSubject", () => {
  it("groups hours by subject", () => {
    const slots = [createSlot("Mon", 540, 600, "Math"), createSlot("Tue", 540, 660, "Math"), createSlot("Wed", 540, 600, "Art")];
    const m = hoursPerSubject(slots);
    expect(m["Math"]).toBe(3);
    expect(m["Art"]).toBe(1);
  });
});

describe("class-schedule-maker assignRoom", () => {
  it("assigns first available room", () => {
    const slots = [createSlot("Mon", 540, 600, "A", "R1")];
    const newSlot = createSlot("Mon", 550, 610, "B");
    expect(assignRoom(slots, newSlot, ["R1", "R2"])).toBe("R2");
  });
  it("returns null when all rooms occupied", () => {
    const slots = [createSlot("Mon", 540, 600, "A", "R1")];
    const newSlot = createSlot("Mon", 550, 610, "B");
    expect(assignRoom(slots, newSlot, ["R1"])).toBeNull();
  });
});

describe("class-schedule-maker validateSlot", () => {
  it("warns when end before start", () => {
    const w = validateSlot(createSlot("Mon", 600, 540, "X"));
    expect(w.some((x) => x.includes("End time"))).toBe(true);
  });
  it("warns on very long slot", () => {
    const w = validateSlot(createSlot("Mon", 540, 540 + 600, "X"));
    expect(w.some((x) => x.includes("8 hours"))).toBe(true);
  });
  it("passes for valid slot", () => {
    expect(validateSlot(createSlot("Mon", 540, 600, "Math"))).toEqual([]);
  });
});

describe("class-schedule-maker exportScheduleCSV", () => {
  it("has header plus row per slot", () => {
    const slots = [createSlot("Mon", 540, 600, "Math", "R1")];
    const csv = exportScheduleCSV(slots);
    const lines = csv.split("\n");
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain("day,start,end");
  });
});

describe("class-schedule-maker exportScheduleICS", () => {
  it("produces VCALENDAR wrapper", () => {
    const ics = exportScheduleICS([createSlot("Mon", 540, 600, "Math")], new Date("2025-01-06"));
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("SUMMARY:Math");
  });
});

describe("class-schedule-maker findFreeBlocks", () => {
  it("returns free time before first class", () => {
    const slots = [createSlot("Mon", 540, 600, "A")];
    const free = findFreeBlocks(slots, "Mon", 8 * 60, 18 * 60);
    expect(free.length).toBe(2);
    expect(free[0].startMin).toBe(8 * 60);
  });
  it("returns full range when no slots", () => {
    const free = findFreeBlocks([], "Mon", 8 * 60, 18 * 60);
    expect(free.length).toBe(1);
    expect(free[0].endMin - free[0].startMin).toBe(10 * 60);
  });
});

describe("class-schedule-maker suggestColor", () => {
  it("returns consistent color for same subject", () => {
    expect(suggestColor("Math")).toBe(suggestColor("Math"));
  });
  it("returns hex color string", () => {
    expect(suggestColor("Physics")).toMatch(/^#[0-9a-f]{6}$/);
  });
});

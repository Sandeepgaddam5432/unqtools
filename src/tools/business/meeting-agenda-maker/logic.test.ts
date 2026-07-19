import { describe, it, expect, beforeEach } from "vitest";
import {
  MEETING_TYPE_PRESETS,
  normalizeText,
  parseAttendees,
  parseObjectives,
  parseAgendaItems,
  splitCsvRow,
  parseTimeToMinutes,
  formatTime,
  calculateMeetingDuration,
  calculateTotalAgendaTime,
  calculateBufferTime,
  detectOverflow,
  generateTimeSlots,
  getActionItemPlaceholders,
  applyPreset,
  summaryStats,
  renderText,
  renderMarkdown,
  renderHtml,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type MeetingInput,
  type AgendaItem,
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

function sampleInput(overrides: Partial<MeetingInput> = {}): MeetingInput {
  return {
    meetingTitle: "Q3 Planning",
    meetingDate: "2026-03-15",
    startTime: "09:00",
    endTime: "10:30",
    location: "Conference Room A",
    organizer: "Alice",
    attendees: "Alice\nBob\nCharlie",
    agendaItems: "Q3 review,15,Alice\nRoadmap,30,Bob\nOpen Q&A,10,Charlie",
    objectives: "Align on Q3 priorities\nIdentify blockers",
    notes: "Bring laptops.",
    ...overrides,
  };
}

describe("meeting-agenda-maker constants", () => {
  it("has 5 meeting type presets", () => {
    expect(MEETING_TYPE_PRESETS).toHaveLength(5);
  });
  it("presets include standup (15m) and quarterly (180m)", () => {
    const standup = MEETING_TYPE_PRESETS.find((p) => p.value === "standup");
    expect(standup?.defaultDurationMinutes).toBe(15);
    const quarterly = MEETING_TYPE_PRESETS.find((p) => p.value === "quarterly");
    expect(quarterly?.defaultDurationMinutes).toBe(180);
  });
  it("every preset has a sample agenda", () => {
    expect(MEETING_TYPE_PRESETS.every((p) => p.sampleItems.length > 0)).toBe(true);
  });
});

describe("meeting-agenda-maker normalizeText", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeText("  Hello   World  ")).toBe("Hello World");
  });
  it("handles empty", () => {
    expect(normalizeText("")).toBe("");
  });
});

describe("meeting-agenda-maker parseAttendees", () => {
  it("parses one per line", () => {
    expect(parseAttendees("Alice\nBob\nCharlie")).toEqual(["Alice", "Bob", "Charlie"]);
  });
  it("trims and skips blank lines", () => {
    expect(parseAttendees("  Alice  \n\n  Bob  ")).toEqual(["Alice", "Bob"]);
  });
  it("returns empty for empty input", () => {
    expect(parseAttendees("")).toEqual([]);
  });
  it("parses objectives the same way", () => {
    expect(parseObjectives("Goal 1\nGoal 2")).toEqual(["Goal 1", "Goal 2"]);
  });
});

describe("meeting-agenda-maker parseAgendaItems", () => {
  it("parses valid CSV lines", () => {
    const { items, errors } = parseAgendaItems("Q3 review,15,Alice\nRoadmap,30,Bob");
    expect(items).toHaveLength(2);
    expect(errors).toHaveLength(0);
    expect(items[0]).toEqual({ topic: "Q3 review", durationMinutes: 15, presenter: "Alice" });
    expect(items[1]).toEqual({ topic: "Roadmap", durationMinutes: 30, presenter: "Bob" });
  });
  it("allows missing presenter", () => {
    const { items, errors } = parseAgendaItems("Open discussion,20");
    expect(items).toHaveLength(1);
    expect(errors).toHaveLength(0);
    expect(items[0].presenter).toBe("");
  });
  it("parses quoted topics with commas", () => {
    const { items } = parseAgendaItems('"Budget, Q3",25,Alice');
    expect(items).toHaveLength(1);
    expect(items[0].topic).toBe("Budget, Q3");
    expect(items[0].durationMinutes).toBe(25);
  });
  it("skips blank lines", () => {
    const { items } = parseAgendaItems("A,5\n\n\nB,10");
    expect(items).toHaveLength(2);
  });
  it("rejects invalid duration", () => {
    const { items, errors } = parseAgendaItems("Bad,abc,Alice");
    expect(items).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("invalid duration");
  });
  it("rejects line with too few fields", () => {
    const { items, errors } = parseAgendaItems("Just a topic");
    expect(items).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("needs topic");
  });
  it("returns empty for empty input", () => {
    const { items, errors } = parseAgendaItems("");
    expect(items).toEqual([]);
    expect(errors).toEqual([]);
  });
});

describe("meeting-agenda-maker splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
});

describe("meeting-agenda-maker time helpers", () => {
  it("parses HH:MM into minutes", () => {
    expect(parseTimeToMinutes("09:00")).toBe(540);
    expect(parseTimeToMinutes("00:00")).toBe(0);
    expect(parseTimeToMinutes("23:59")).toBe(1439);
  });
  it("returns NaN for invalid", () => {
    expect(Number.isNaN(parseTimeToMinutes("foo"))).toBe(true);
    expect(Number.isNaN(parseTimeToMinutes(""))).toBe(true);
  });
  it("formats minutes as HH:MM", () => {
    expect(formatTime(540)).toBe("09:00");
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(1439)).toBe("23:59");
  });
  it("wraps around midnight on format", () => {
    expect(formatTime(1500)).toBe("01:00");
  });
  it("calculates meeting duration", () => {
    expect(calculateMeetingDuration("09:00", "10:30")).toBe(90);
    expect(calculateMeetingDuration("09:00", "09:00")).toBe(0);
  });
  it("handles overnight duration", () => {
    expect(calculateMeetingDuration("23:00", "01:00")).toBe(120);
  });
  it("returns 0 for invalid times", () => {
    expect(calculateMeetingDuration("foo", "10:00")).toBe(0);
  });
});

describe("meeting-agenda-maker agenda time math", () => {
  const items: AgendaItem[] = [
    { topic: "A", durationMinutes: 15, presenter: "x" },
    { topic: "B", durationMinutes: 30, presenter: "y" },
  ];
  it("sums item durations", () => {
    expect(calculateTotalAgendaTime(items)).toBe(45);
  });
  it("computes positive buffer", () => {
    expect(calculateBufferTime(90, 45)).toBe(45);
  });
  it("computes negative buffer (overflow)", () => {
    expect(calculateBufferTime(30, 45)).toBe(-15);
  });
  it("detects overflow true", () => {
    expect(detectOverflow(30, 45)).toBe(true);
  });
  it("detects overflow false when within bounds", () => {
    expect(detectOverflow(60, 45)).toBe(false);
  });
  it("detects overflow false when exactly equal", () => {
    expect(detectOverflow(45, 45)).toBe(false);
  });
});

describe("meeting-agenda-maker generateTimeSlots", () => {
  const items: AgendaItem[] = [
    { topic: "A", durationMinutes: 15, presenter: "x" },
    { topic: "B", durationMinutes: 30, presenter: "y" },
    { topic: "C", durationMinutes: 5, presenter: "z" },
  ];
  it("generates sequential slots from start time", () => {
    const slots = generateTimeSlots(items, "09:00");
    expect(slots).toHaveLength(3);
    expect(slots[0].startTime).toBe("09:00");
    expect(slots[0].endTime).toBe("09:15");
    expect(slots[1].startTime).toBe("09:15");
    expect(slots[1].endTime).toBe("09:45");
    expect(slots[2].startTime).toBe("09:45");
    expect(slots[2].endTime).toBe("09:50");
  });
  it("indexes slots starting at 1", () => {
    const slots = generateTimeSlots(items, "09:00");
    expect(slots.map((s) => s.index)).toEqual([1, 2, 3]);
  });
  it("returns empty for empty items", () => {
    expect(generateTimeSlots([], "09:00")).toEqual([]);
  });
  it("returns empty for invalid start time", () => {
    expect(generateTimeSlots(items, "foo")).toEqual([]);
  });
});

describe("meeting-agenda-maker action items", () => {
  it("generates one placeholder per agenda item", () => {
    const items: AgendaItem[] = [
      { topic: "A", durationMinutes: 5, presenter: "Alice" },
      { topic: "B", durationMinutes: 5, presenter: "" },
    ];
    const ais = getActionItemPlaceholders(items);
    expect(ais).toHaveLength(2);
    expect(ais[0]).toContain("Action item 1");
    expect(ais[0]).toContain("A");
    expect(ais[0]).toContain("Alice");
    expect(ais[1]).toContain("owner"); // empty presenter fallback
  });
  it("returns empty for empty items", () => {
    expect(getActionItemPlaceholders([])).toEqual([]);
  });
});

describe("meeting-agenda-maker applyPreset", () => {
  it("returns start at 09:00 and end based on default duration", () => {
    const standup = MEETING_TYPE_PRESETS.find((p) => p.value === "standup")!;
    const r = applyPreset(standup);
    expect(r.startTime).toBe("09:00");
    expect(r.endTime).toBe("09:15");
    expect(r.agendaItems).toContain("Yesterday");
  });
  it("quarterly preset ends 3 hours later", () => {
    const quarterly = MEETING_TYPE_PRESETS.find((p) => p.value === "quarterly")!;
    const r = applyPreset(quarterly);
    expect(r.startTime).toBe("09:00");
    expect(r.endTime).toBe("12:00");
  });
});

describe("meeting-agenda-maker summaryStats", () => {
  it("computes all stats", () => {
    const input = sampleInput();
    const { items } = parseAgendaItems(input.agendaItems);
    const attendees = parseAttendees(input.attendees);
    const objectives = parseObjectives(input.objectives);
    const stats = summaryStats(input, items, attendees, objectives);
    expect(stats.attendeeCount).toBe(3);
    expect(stats.agendaItemCount).toBe(3);
    expect(stats.objectiveCount).toBe(2);
    expect(stats.meetingDurationMinutes).toBe(90);
    expect(stats.totalAgendaTimeMinutes).toBe(55); // 15+30+10
    expect(stats.bufferMinutes).toBe(35);
    expect(stats.overflow).toBe(false);
    expect(stats.overflowMinutes).toBe(0);
  });
  it("flags overflow when agenda exceeds meeting", () => {
    const input = sampleInput({
      agendaItems: "A,60,Alice\nB,60,Bob",
      endTime: "10:00", // 60 min
    });
    const { items } = parseAgendaItems(input.agendaItems);
    const stats = summaryStats(input, items, [], []);
    expect(stats.overflow).toBe(true);
    expect(stats.overflowMinutes).toBe(60); // 120 - 60
    expect(stats.bufferMinutes).toBe(-60);
  });
});

describe("meeting-agenda-maker renderText", () => {
  it("renders a text agenda with title, attendees, slots, buffer", () => {
    const input = sampleInput();
    const { items } = parseAgendaItems(input.agendaItems);
    const attendees = parseAttendees(input.attendees);
    const objectives = parseObjectives(input.objectives);
    const slots = generateTimeSlots(items, input.startTime);
    const stats = summaryStats(input, items, attendees, objectives);
    const text = renderText(input, items, attendees, objectives, slots, stats);
    expect(text).toContain("MEETING AGENDA");
    expect(text).toContain("Q3 Planning");
    expect(text).toContain("09:00 – 09:15");
    expect(text).toContain("ATTENDEES:");
    expect(text).toContain("OBJECTIVES:");
    expect(text).toContain("Buffer: 35 min remaining");
    expect(text).toContain("ACTION ITEMS:");
  });
  it("renders overflow warning", () => {
    const input = sampleInput({
      agendaItems: "A,120,Alice",
      endTime: "10:00",
    });
    const { items } = parseAgendaItems(input.agendaItems);
    const stats = summaryStats(input, items, [], []);
    const slots = generateTimeSlots(items, input.startTime);
    const text = renderText(input, items, [], [], slots, stats);
    expect(text).toContain("OVERFLOW");
  });
});

describe("meeting-agenda-maker renderMarkdown", () => {
  it("renders markdown with header + table", () => {
    const input = sampleInput();
    const { items } = parseAgendaItems(input.agendaItems);
    const slots = generateTimeSlots(items, input.startTime);
    const stats = summaryStats(input, items, [], []);
    const md = renderMarkdown(input, items, [], [], slots, stats);
    expect(md).toContain("# Q3 Planning");
    expect(md).toContain("| # | Start | End | Duration | Topic | Presenter |");
    expect(md).toContain("09:00");
    expect(md).toContain("## Action Items");
  });
});

describe("meeting-agenda-maker renderHtml", () => {
  it("renders valid HTML with table rows", () => {
    const input = sampleInput();
    const { items } = parseAgendaItems(input.agendaItems);
    const attendees = parseAttendees(input.attendees);
    const slots = generateTimeSlots(items, input.startTime);
    const stats = summaryStats(input, items, attendees, []);
    const html = renderHtml(input, items, attendees, [], slots, stats);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<table>");
    expect(html).toContain("Q3 Planning");
    expect(html).toContain("<li>Alice</li>");
    expect(html).toContain("Buffer: 35 min remaining");
  });
  it("renders overflow warning class", () => {
    const input = sampleInput({
      agendaItems: "A,120,Alice",
      endTime: "10:00",
    });
    const { items } = parseAgendaItems(input.agendaItems);
    const stats = summaryStats(input, items, [], []);
    const slots = generateTimeSlots(items, input.startTime);
    const html = renderHtml(input, items, [], [], slots, stats);
    expect(html).toContain('class="warn"');
    expect(html).toContain("Overflow");
  });
  it("escapes HTML in user input", () => {
    const input = sampleInput({ meetingTitle: "<script>x</script>" });
    const { items } = parseAgendaItems(input.agendaItems);
    const stats = summaryStats(input, items, [], []);
    const slots = generateTimeSlots(items, input.startTime);
    const html = renderHtml(input, items, [], [], slots, stats);
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("meeting-agenda-maker renderCsv", () => {
  it("renders header + one row per slot", () => {
    const input = sampleInput();
    const { items } = parseAgendaItems(input.agendaItems);
    const slots = generateTimeSlots(items, input.startTime);
    const csv = renderCsv(slots);
    expect(csv).toContain("slot_start,slot_end,duration_minutes,topic,presenter");
    expect(csv).toContain("09:00,09:15,15,Q3 review,Alice");
  });
  it("escapes commas in topic", () => {
    const input = sampleInput({ agendaItems: '"Budget, Q3",25,Alice' });
    const { items } = parseAgendaItems(input.agendaItems);
    const slots = generateTimeSlots(items, input.startTime);
    const csv = renderCsv(slots);
    expect(csv).toContain('"Budget, Q3"');
  });
  it("returns only header for empty slots", () => {
    expect(renderCsv([])).toBe("slot_start,slot_end,duration_minutes,topic,presenter");
  });
});

describe("meeting-agenda-maker history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      title: "Q3",
      date: "2026-03-15",
      attendeeCount: 3,
      itemCount: 3,
      totalAgendaTimeMinutes: 55,
      meetingDurationMinutes: 90,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        title: `Meeting ${i}`,
        date: "2026-03-15",
        attendeeCount: 1,
        itemCount: 1,
        totalAgendaTimeMinutes: 5,
        meetingDurationMinutes: 30,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, title: "x", date: "", attendeeCount: 0, itemCount: 0,
      totalAgendaTimeMinutes: 0, meetingDurationMinutes: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("meeting-agenda-maker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ meetingTitle: "Test", startTime: "09:00" });
    expect(url).toContain("title=Test");
    expect(url).toContain("start=09");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("title=Q3&date=2026-03-15&start=09:00&end=10:30");
    expect(p.meetingTitle).toBe("Q3");
    expect(p.meetingDate).toBe("2026-03-15");
    expect(p.startTime).toBe("09:00");
    expect(p.endTime).toBe("10:30");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("omits missing fields", () => {
    const p = parseShareUrl("title=Just+Title");
    expect(p.meetingTitle).toBe("Just Title");
    expect(p.startTime).toBeUndefined();
  });
});

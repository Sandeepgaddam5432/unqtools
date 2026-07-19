import { describe, it, expect, beforeEach } from "vitest";
import {
  MEETING_TYPE_PRESETS,
  normalizeText,
  splitCsvRow,
  parseAttendees,
  parseDecisions,
  parseParkingLot,
  parseAgendaRecap,
  parseActionItems,
  parseTimeToMinutes,
  formatTime,
  calculateMeetingDuration,
  formatDuration,
  groupActionItemsByOwner,
  sortActionItemsByDueDate,
  todayDateString,
  isValidDateString,
  isOverdue,
  detectOverdueActionItems,
  applyPreset,
  summaryStats,
  formatActionItemLine,
  renderText,
  renderMarkdown,
  renderHtml,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ActionItem,
  type MeetingNotesInput,
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

const TODAY = "2026-07-20";

function makeInput(over: Partial<MeetingNotesInput> = {}): MeetingNotesInput {
  return {
    meetingTitle: "Q3 Review Meeting",
    meetingDate: "2026-07-20",
    startTime: "10:00",
    endTime: "11:30",
    location: "Conference Room A",
    facilitator: "Alice Johnson",
    attendees: "Alice Johnson\nBob Smith\nCarol Lee",
    agendaRecap: "Q3 results,Met revenue target of $1.2M\nRoadmap,Decided to prioritize mobile app",
    decisions: "Approved Q3 budget\nApproved mobile app roadmap\nHired new designer",
    actionItems:
      "Draft proposal,Alice,2026-07-25\nUpdate budget,Bob,2026-07-15\nSend recap,Carol,2026-07-22",
    parkingLot: "Discuss vendor selection next quarter\nRevisit hiring plan in October",
    nextMeetingDate: "2026-08-20",
    ...over,
  };
}

// ---- Constants ----

describe("meeting-notes-maker constants", () => {
  it("has 7 meeting-type presets", () => {
    expect(MEETING_TYPE_PRESETS).toHaveLength(7);
  });
  it("includes standup, weekly, monthly, quarterly, retro, 1:1, brainstorm", () => {
    const values = MEETING_TYPE_PRESETS.map((p) => p.value);
    expect(values).toEqual(
      expect.arrayContaining([
        "standup", "weekly", "monthly", "quarterly", "retro", "1on1", "brainstorm",
      ]),
    );
  });
  it("each preset has sample data for all five textareas", () => {
    for (const p of MEETING_TYPE_PRESETS) {
      expect(p.sampleAttendees.length).toBeGreaterThan(0);
      expect(p.sampleAgendaRecap.length).toBeGreaterThan(0);
      expect(p.sampleDecisions.length).toBeGreaterThan(0);
      expect(p.sampleActionItems.length).toBeGreaterThan(0);
      expect(p.sampleParkingLot.length).toBeGreaterThan(0);
    }
  });
});

// ---- normalizeText ----

describe("meeting-notes-maker normalizeText", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeText("  Hello   World  ")).toBe("Hello World");
  });
  it("handles empty", () => {
    expect(normalizeText("")).toBe("");
  });
});

// ---- splitCsvRow ----

describe("meeting-notes-maker splitCsvRow", () => {
  it("splits simple row", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("handles escaped quotes", () => {
    expect(splitCsvRow('"say ""hi""",x')).toEqual(['say "hi"', "x"]);
  });
  it("handles single field", () => {
    expect(splitCsvRow("just one")).toEqual(["just one"]);
  });
});

// ---- parseAttendees ----

describe("meeting-notes-maker parseAttendees", () => {
  it("parses one per line", () => {
    expect(parseAttendees("Alice\nBob\nCarol")).toEqual(["Alice", "Bob", "Carol"]);
  });
  it("skips blank lines", () => {
    expect(parseAttendees("Alice\n\nBob\n  \nCarol")).toEqual(["Alice", "Bob", "Carol"]);
  });
  it("normalizes whitespace", () => {
    expect(parseAttendees("  Alice   Johnson  ")).toEqual(["Alice Johnson"]);
  });
  it("returns empty for empty input", () => {
    expect(parseAttendees("")).toEqual([]);
  });
  it("handles Windows line endings", () => {
    expect(parseAttendees("Alice\r\nBob")).toEqual(["Alice", "Bob"]);
  });
});

// ---- parseDecisions / parseParkingLot ----

describe("meeting-notes-maker parseDecisions & parseParkingLot", () => {
  it("parseDecisions parses one per line", () => {
    expect(parseDecisions("Approved budget\nHired designer")).toEqual([
      "Approved budget", "Hired designer",
    ]);
  });
  it("parseParkingLot parses one per line", () => {
    expect(parseParkingLot("Discuss vendors\nRevisit hiring")).toEqual([
      "Discuss vendors", "Revisit hiring",
    ]);
  });
  it("both return empty for empty input", () => {
    expect(parseDecisions("")).toEqual([]);
    expect(parseParkingLot("")).toEqual([]);
  });
});

// ---- parseAgendaRecap ----

describe("meeting-notes-maker parseAgendaRecap", () => {
  it("parses topic,discussion_summary", () => {
    const r = parseAgendaRecap("Q3 results,Met revenue target of $1.2M");
    expect(r.errors).toEqual([]);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].topic).toBe("Q3 results");
    expect(r.items[0].discussionSummary).toBe("Met revenue target of $1.2M");
  });
  it("handles topic without discussion summary", () => {
    const r = parseAgendaRecap("Open Q&A");
    expect(r.errors).toEqual([]);
    expect(r.items[0].topic).toBe("Open Q&A");
    expect(r.items[0].discussionSummary).toBe("");
  });
  it("handles quoted commas in summary", () => {
    const r = parseAgendaRecap('Roadmap,"decided mobile, then web"');
    expect(r.items[0].discussionSummary).toBe("decided mobile, then web");
  });
  it("skips blank lines", () => {
    const r = parseAgendaRecap("A,x\n\nB,y");
    expect(r.items).toHaveLength(2);
  });
  it("errors on empty topic only", () => {
    const r = parseAgendaRecap(",some discussion");
    expect(r.errors).toHaveLength(1);
    expect(r.items).toEqual([]);
  });
  it("returns empty for empty input", () => {
    const r = parseAgendaRecap("");
    expect(r.items).toEqual([]);
    expect(r.errors).toEqual([]);
  });
});

// ---- parseActionItems ----

describe("meeting-notes-maker parseActionItems", () => {
  it("parses task,owner,due_date", () => {
    const r = parseActionItems("Draft proposal,Alice,2026-07-25");
    expect(r.errors).toEqual([]);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toEqual({
      task: "Draft proposal",
      owner: "Alice",
      dueDate: "2026-07-25",
    });
  });
  it("allows missing owner and due_date", () => {
    const r = parseActionItems("Just a task");
    expect(r.errors).toEqual([]);
    expect(r.items[0]).toEqual({ task: "Just a task", owner: "", dueDate: "" });
  });
  it("allows missing due_date", () => {
    const r = parseActionItems("Do something,Alice");
    expect(r.items[0].owner).toBe("Alice");
    expect(r.items[0].dueDate).toBe("");
  });
  it("errors on invalid due_date format", () => {
    const r = parseActionItems("Task,Alice,2026/07/25");
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain("YYYY-MM-DD");
  });
  it("errors on empty task only", () => {
    const r = parseActionItems(",Alice,2026-07-25");
    expect(r.errors).toHaveLength(1);
    expect(r.items).toEqual([]);
  });
  it("handles quoted task with comma", () => {
    const r = parseActionItems('"Review Q3, Q4 plan",Alice,2026-07-25');
    expect(r.items[0].task).toBe("Review Q3, Q4 plan");
  });
  it("skips blank lines", () => {
    const r = parseActionItems("A,x,2026-07-25\n\nB,y,2026-07-26");
    expect(r.items).toHaveLength(2);
  });
  it("returns empty for empty input", () => {
    const r = parseActionItems("");
    expect(r.items).toEqual([]);
    expect(r.errors).toEqual([]);
  });
});

// ---- Time helpers ----

describe("meeting-notes-maker time helpers", () => {
  it("parseTimeToMinutes parses HH:MM", () => {
    expect(parseTimeToMinutes("10:30")).toBe(10 * 60 + 30);
  });
  it("parseTimeToMinutes returns NaN for invalid", () => {
    expect(Number.isNaN(parseTimeToMinutes("not a time"))).toBe(true);
  });
  it("formatTime formats minutes back to HH:MM", () => {
    expect(formatTime(10 * 60 + 30)).toBe("10:30");
    expect(formatTime(0)).toBe("00:00");
  });
  it("calculateMeetingDuration computes diff", () => {
    expect(calculateMeetingDuration("10:00", "11:30")).toBe(90);
  });
  it("calculateMeetingDuration wraps midnight", () => {
    expect(calculateMeetingDuration("23:00", "01:00")).toBe(120);
  });
  it("calculateMeetingDuration returns 0 for invalid", () => {
    expect(calculateMeetingDuration("", "11:30")).toBe(0);
  });
  it("formatDuration formats hours + minutes", () => {
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(0)).toBe("0m");
  });
});

// ---- groupActionItemsByOwner ----

describe("meeting-notes-maker groupActionItemsByOwner", () => {
  it("groups by owner alphabetically", () => {
    const items: ActionItem[] = [
      { task: "t1", owner: "Bob", dueDate: "" },
      { task: "t2", owner: "Alice", dueDate: "" },
      { task: "t3", owner: "Bob", dueDate: "" },
    ];
    const groups = groupActionItemsByOwner(items);
    expect(groups).toHaveLength(2);
    expect(groups[0].owner).toBe("Alice");
    expect(groups[1].owner).toBe("Bob");
    expect(groups[1].items).toHaveLength(2);
  });
  it("unassigned goes to (unassigned)", () => {
    const items: ActionItem[] = [
      { task: "t1", owner: "", dueDate: "" },
    ];
    const groups = groupActionItemsByOwner(items);
    expect(groups[0].owner).toBe("(unassigned)");
  });
  it("returns empty for empty input", () => {
    expect(groupActionItemsByOwner([])).toEqual([]);
  });
});

// ---- sortActionItemsByDueDate ----

describe("meeting-notes-maker sortActionItemsByDueDate", () => {
  it("sorts by due date earliest first", () => {
    const items: ActionItem[] = [
      { task: "late", owner: "", dueDate: "2026-08-01" },
      { task: "early", owner: "", dueDate: "2026-07-01" },
      { task: "mid", owner: "", dueDate: "2026-07-15" },
    ];
    const sorted = sortActionItemsByDueDate(items);
    expect(sorted.map((s) => s.task)).toEqual(["early", "mid", "late"]);
  });
  it("places items without due date at the end", () => {
    const items: ActionItem[] = [
      { task: "nodue", owner: "", dueDate: "" },
      { task: "dated", owner: "", dueDate: "2026-07-15" },
    ];
    const sorted = sortActionItemsByDueDate(items);
    expect(sorted[0].task).toBe("dated");
    expect(sorted[1].task).toBe("nodue");
  });
  it("returns empty for empty input", () => {
    expect(sortActionItemsByDueDate([])).toEqual([]);
  });
  it("does not mutate the original array", () => {
    const items: ActionItem[] = [
      { task: "late", owner: "", dueDate: "2026-08-01" },
      { task: "early", owner: "", dueDate: "2026-07-01" },
    ];
    const snapshot = items.map((i) => ({ ...i }));
    sortActionItemsByDueDate(items);
    expect(items).toEqual(snapshot);
  });
});

// ---- Overdue detection ----

describe("meeting-notes-maker overdue detection", () => {
  it("todayDateString returns YYYY-MM-DD", () => {
    const d = new Date(2026, 6, 20); // July 20, 2026
    expect(todayDateString(d)).toBe("2026-07-20");
  });
  it("isValidDateString accepts valid date", () => {
    expect(isValidDateString("2026-07-20")).toBe(true);
  });
  it("isValidDateString rejects bad format", () => {
    expect(isValidDateString("2026/07/20")).toBe(false);
    expect(isValidDateString("")).toBe(false);
    expect(isValidDateString("2026-13-01")).toBe(false);
  });
  it("isOverdue true when due before today", () => {
    expect(isOverdue("2026-07-15", "2026-07-20")).toBe(true);
  });
  it("isOverdue false when due equals today", () => {
    expect(isOverdue("2026-07-20", "2026-07-20")).toBe(false);
  });
  it("isOverdue false when due after today", () => {
    expect(isOverdue("2026-07-25", "2026-07-20")).toBe(false);
  });
  it("isOverdue false for missing due date", () => {
    expect(isOverdue("", TODAY)).toBe(false);
  });
  it("detectOverdueActionItems filters overdue only", () => {
    const items: ActionItem[] = [
      { task: "a", owner: "", dueDate: "2026-07-15" },
      { task: "b", owner: "", dueDate: "2026-07-25" },
      { task: "c", owner: "", dueDate: "" },
    ];
    const overdue = detectOverdueActionItems(items, TODAY);
    expect(overdue).toHaveLength(1);
    expect(overdue[0].task).toBe("a");
  });
});

// ---- applyPreset ----

describe("meeting-notes-maker applyPreset", () => {
  it("returns default start/end times", () => {
    const preset = MEETING_TYPE_PRESETS[0];
    const r = applyPreset(preset);
    expect(r.startTime).toBe("09:00");
    expect(r.endTime).toBe(formatTime(9 * 60 + preset.defaultDurationMinutes));
  });
  it("returns sample data from preset", () => {
    const preset = MEETING_TYPE_PRESETS.find((p) => p.value === "weekly")!;
    const r = applyPreset(preset);
    expect(r.attendees).toBe(preset.sampleAttendees);
    expect(r.agendaRecap).toBe(preset.sampleAgendaRecap);
    expect(r.decisions).toBe(preset.sampleDecisions);
    expect(r.actionItems).toBe(preset.sampleActionItems);
    expect(r.parkingLot).toBe(preset.sampleParkingLot);
  });
  it("standup preset gives 15 min duration", () => {
    const preset = MEETING_TYPE_PRESETS.find((p) => p.value === "standup")!;
    const r = applyPreset(preset);
    expect(calculateMeetingDuration(r.startTime, r.endTime)).toBe(15);
  });
});

// ---- summaryStats ----

describe("meeting-notes-maker summaryStats", () => {
  it("computes all stats", () => {
    const input = makeInput();
    const attendees = parseAttendees(input.attendees);
    const recap = parseAgendaRecap(input.agendaRecap).items;
    const decisions = parseDecisions(input.decisions);
    const actionItems = parseActionItems(input.actionItems).items;
    const parkingLot = parseParkingLot(input.parkingLot);
    const stats = summaryStats(input, attendees, recap, decisions, actionItems, parkingLot, TODAY);
    expect(stats.attendeeCount).toBe(3);
    expect(stats.agendaRecapCount).toBe(2);
    expect(stats.decisionCount).toBe(3);
    expect(stats.actionItemCount).toBe(3);
    expect(stats.parkingLotCount).toBe(2);
    expect(stats.meetingDurationMinutes).toBe(90);
    expect(stats.overdueCount).toBe(1); // 2026-07-15 < 2026-07-20
  });
  it("returns zero counts for empty input", () => {
    const empty = makeInput({
      attendees: "", agendaRecap: "", decisions: "", actionItems: "", parkingLot: "",
    });
    const stats = summaryStats(empty, [], [], [], [], [], TODAY);
    expect(stats.attendeeCount).toBe(0);
    expect(stats.actionItemCount).toBe(0);
    expect(stats.overdueCount).toBe(0);
  });
});

// ---- formatActionItemLine ----

describe("meeting-notes-maker formatActionItemLine", () => {
  it("formats with owner and due date", () => {
    const line = formatActionItemLine(
      { task: "Draft", owner: "Alice", dueDate: "2026-07-25" },
      TODAY,
    );
    expect(line).toBe("[ ] Draft — Alice (due 2026-07-25)");
  });
  it("marks overdue items", () => {
    const line = formatActionItemLine(
      { task: "Late", owner: "Bob", dueDate: "2026-07-15" },
      TODAY,
    );
    expect(line).toContain("[OVERDUE]");
  });
  it("handles missing owner", () => {
    const line = formatActionItemLine(
      { task: "Todo", owner: "", dueDate: "" },
      TODAY,
    );
    expect(line).toBe("[ ] Todo");
  });
});

// ---- renderText ----

describe("meeting-notes-maker renderText", () => {
  it("renders a complete notes document", () => {
    const input = makeInput();
    const attendees = parseAttendees(input.attendees);
    const recap = parseAgendaRecap(input.agendaRecap).items;
    const decisions = parseDecisions(input.decisions);
    const actionItems = parseActionItems(input.actionItems).items;
    const parkingLot = parseParkingLot(input.parkingLot);
    const stats = summaryStats(input, attendees, recap, decisions, actionItems, parkingLot, TODAY);
    const text = renderText(input, attendees, recap, decisions, actionItems, parkingLot, stats, TODAY);
    expect(text).toContain("MEETING NOTES");
    expect(text).toContain("Q3 Review Meeting");
    expect(text).toContain("ATTENDEES:");
    expect(text).toContain("1. Alice Johnson");
    expect(text).toContain("AGENDA RECAP");
    expect(text).toContain("Met revenue target of $1.2M");
    expect(text).toContain("DECISIONS (3)");
    expect(text).toContain("Approved Q3 budget");
    expect(text).toContain("ACTION ITEMS (3 — 1 overdue)");
    expect(text).toContain("[OVERDUE]");
    expect(text).toContain("By owner:");
    expect(text).toContain("PARKING LOT (2)");
    expect(text).toContain("Next meeting: 2026-08-20");
    expect(text).toContain("SUMMARY");
  });
  it("renders minimal notes (no data — falls back to untitled)", () => {
    const input = makeInput({
      meetingTitle: "",
      attendees: "", agendaRecap: "", decisions: "", actionItems: "",
      parkingLot: "", nextMeetingDate: "", location: "", facilitator: "",
    });
    const stats = summaryStats(input, [], [], [], [], [], TODAY);
    const text = renderText(input, [], [], [], [], [], stats, TODAY);
    expect(text).toContain("MEETING NOTES");
    expect(text).toContain("Title: (untitled)");
    expect(text).toContain("SUMMARY");
  });
});

// ---- renderMarkdown ----

describe("meeting-notes-maker renderMarkdown", () => {
  it("renders markdown with headers and tables", () => {
    const input = makeInput();
    const attendees = parseAttendees(input.attendees);
    const recap = parseAgendaRecap(input.agendaRecap).items;
    const decisions = parseDecisions(input.decisions);
    const actionItems = parseActionItems(input.actionItems).items;
    const parkingLot = parseParkingLot(input.parkingLot);
    const stats = summaryStats(input, attendees, recap, decisions, actionItems, parkingLot, TODAY);
    const md = renderMarkdown(input, attendees, recap, decisions, actionItems, parkingLot, stats, TODAY);
    expect(md).toContain("# Q3 Review Meeting");
    expect(md).toContain("## Attendees");
    expect(md).toContain("## Agenda Recap");
    expect(md).toContain("### 1. Q3 results");
    expect(md).toContain("## Decisions (3)");
    expect(md).toContain("## Action Items (3 — 1 overdue)");
    expect(md).toContain("- [ ]");
    expect(md).toContain("**[OVERDUE]**");
    expect(md).toContain("### By Owner");
    expect(md).toContain("## Parking Lot (2)");
    expect(md).toContain("| Metric | Value |");
  });
});

// ---- renderHtml ----

describe("meeting-notes-maker renderHtml", () => {
  it("renders a full HTML document with inline CSS", () => {
    const input = makeInput();
    const attendees = parseAttendees(input.attendees);
    const recap = parseAgendaRecap(input.agendaRecap).items;
    const decisions = parseDecisions(input.decisions);
    const actionItems = parseActionItems(input.actionItems).items;
    const parkingLot = parseParkingLot(input.parkingLot);
    const stats = summaryStats(input, attendees, recap, decisions, actionItems, parkingLot, TODAY);
    const html = renderHtml(input, attendees, recap, decisions, actionItems, parkingLot, stats, TODAY);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<style>");
    expect(html).toContain("Q3 Review Meeting");
    expect(html).toContain("Action Items");
    expect(html).toContain("class=\"overdue\"");
    expect(html).toContain("By Owner");
    expect(html).toContain("Next meeting");
  });
  it("escapes HTML in user content", () => {
    const input = makeInput({ meetingTitle: "<script>alert(1)</script>", attendees: "Alice & Bob" });
    const stats = summaryStats(input, ["Alice & Bob"], [], [], [], [], TODAY);
    const html = renderHtml(input, ["Alice & Bob"], [], [], [], [], stats, TODAY);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Alice &amp; Bob");
  });
});

// ---- renderCsv ----

describe("meeting-notes-maker renderCsv", () => {
  it("renders header and rows with status", () => {
    const items: ActionItem[] = [
      { task: "Late", owner: "Bob", dueDate: "2026-07-15" },
      { task: "Ontrack", owner: "Alice", dueDate: "2026-07-25" },
    ];
    const csv = renderCsv(items, TODAY);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("task,owner,due_date,status");
    expect(lines[1]).toContain("Late");
    expect(lines[1]).toContain("overdue");
    expect(lines[2]).toContain("on-track");
  });
  it("sorts rows by due date", () => {
    const items: ActionItem[] = [
      { task: "later", owner: "", dueDate: "2026-08-01" },
      { task: "earlier", owner: "", dueDate: "2026-07-01" },
    ];
    const csv = renderCsv(items, TODAY);
    expect(csv.split("\n")[1]).toContain("earlier");
    expect(csv.split("\n")[2]).toContain("later");
  });
  it("escapes commas in task", () => {
    const items: ActionItem[] = [
      { task: "Review Q3, Q4", owner: "Alice", dueDate: "2026-07-25" },
    ];
    const csv = renderCsv(items, TODAY);
    expect(csv).toContain('"Review Q3, Q4"');
  });
});

// ---- History ----

describe("meeting-notes-maker history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      title: "Q3 Review",
      date: "2026-07-20",
      attendeeCount: 3,
      decisionCount: 3,
      actionItemCount: 3,
      parkingLotCount: 2,
      meetingDurationMinutes: 90,
      overdueCount: 1,
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].title).toBe("Q3 Review");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        title: `M${i}`,
        date: "2026-07-20",
        attendeeCount: 1,
        decisionCount: 0,
        actionItemCount: 0,
        parkingLotCount: 0,
        meetingDurationMinutes: 30,
        overdueCount: 0,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, title: "x", date: "2026-07-20", attendeeCount: 0, decisionCount: 0,
      actionItemCount: 0, parkingLotCount: 0, meetingDurationMinutes: 0, overdueCount: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---- Shareable URL ----

describe("meeting-notes-maker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      meetingTitle: "Q3 Review",
      attendees: "Alice\nBob",
      actionItems: "Task,Alice,2026-07-25",
    });
    expect(url.startsWith("#")).toBe(true);
    expect(url).toContain("title=Q3+Review");
    expect(url).toContain("att=Alice");
    expect(url).toContain("ai=Task");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const input = makeInput();
    const url = buildShareUrl(input);
    const parsed = parseShareUrl(url);
    expect(parsed.meetingTitle).toBe(input.meetingTitle);
    expect(parsed.meetingDate).toBe(input.meetingDate);
    expect(parsed.startTime).toBe(input.startTime);
    expect(parsed.endTime).toBe(input.endTime);
    expect(parsed.location).toBe(input.location);
    expect(parsed.facilitator).toBe(input.facilitator);
    expect(parsed.attendees).toBe(input.attendees);
    expect(parsed.agendaRecap).toBe(input.agendaRecap);
    expect(parsed.decisions).toBe(input.decisions);
    expect(parsed.actionItems).toBe(input.actionItems);
    expect(parsed.parkingLot).toBe(input.parkingLot);
    expect(parsed.nextMeetingDate).toBe(input.nextMeetingDate);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("strips leading # when parsing", () => {
    const parsed = parseShareUrl("#title=Hello");
    expect(parsed.meetingTitle).toBe("Hello");
  });
  it("preserves newlines in attendees", () => {
    const url = buildShareUrl({ attendees: "Alice\nBob\nCarol" });
    const parsed = parseShareUrl(url);
    expect(parsed.attendees).toBe("Alice\nBob\nCarol");
  });
});
